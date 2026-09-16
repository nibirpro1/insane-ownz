import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "../db/prisma";
import { ownzEmbed, BRAND, section } from "./brand";
import { MAX_LEVEL } from "../config/levelRewards";
import {
  markLeaderboardEdit,
  markLeaderboardSkip,
  markLeaderboardTick,
} from "./metrics";

const MEDALS = ["🥇", "🥈", "🥉"];
/** How often the live board ticks. Discord allows ~5 edits / 5s per channel,
 *  and we skip the edit entirely when nothing changed, so this stays spam-free. */
export const LIVE_REFRESH_MS = 5_000;

/** Last rendered board per guild — used to skip no-op edits. */
const lastRender = new Map<string, string>();

function xpForLevel(level: number) {
  return 5 * level ** 2 + 50 * level + 100;
}

function bar(pct: number) {
  const filled = Math.round(Math.min(Math.max(pct, 0), 1) * 10);
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

/** Top N members of a guild by level, then XP. */
export async function topMembers(guildId: string, take = 10) {
  return prisma.userProfile.findMany({
    where: { guildId },
    orderBy: [{ level: "desc" }, { xp: "desc" }],
    take,
  });
}

/** Rank (1-based) of a specific member, or null if untracked. */
export async function rankOf(guildId: string, userId: string) {
  const me = await prisma.userProfile.findUnique({
    where: { guildId_userId: { guildId, userId } },
  });
  if (!me) return null;
  const ahead = await prisma.userProfile.count({
    where: {
      guildId,
      OR: [{ level: { gt: me.level } }, { level: me.level, xp: { gt: me.xp } }],
    },
  });
  return { profile: me, rank: ahead + 1 };
}

export async function buildLeaderboardEmbed(
  guildId: string,
  guildName: string,
  live = false
): Promise<{ embed: EmbedBuilder; signature: string }> {
  const top = await topMembers(guildId, 10);
  const total = await prisma.userProfile.count({ where: { guildId } });

  if (top.length === 0) {
    return {
      embed: ownzEmbed("neutral")
        .setTitle("🏆 Insane Ownz Live Leaderboard")
        .setDescription("No activity tracked yet. Chat in the server to earn XP!"),
      signature: "empty",
    };
  }

  const rows = top.map((u, i) => {
    const place = MEDALS[i] ?? `\`#${String(i + 1).padStart(2, "0")}\``;
    const needed = xpForLevel(u.level);
    const pct = u.level >= MAX_LEVEL ? 1 : u.xp / needed;
    const progress =
      u.level >= MAX_LEVEL ? "`MAX`" : `\`${bar(pct)}\` ${Math.floor(pct * 100)}%`;
    return `${place} <@${u.userId}>\n　└ **Level ${u.level}** • \`${u.xp} XP\` • ${progress}`;
  });

  const embed = ownzEmbed("primary")
    .setTitle(`🏆 ${guildName} — Insane Ownz Leaderboard`)
    .setDescription(
      [
        live
          ? `🟢 **LIVE** • auto-updates every ${LIVE_REFRESH_MS / 1000}s`
          : "Top members ranked by level, then XP.",
        BRAND.divider,
        section("Top 10"),
        rows.join("\n"),
        "",
        `👥 Tracked members • \`${total}\``,
      ].join("\n")
    )
    .setFooter({ text: `${BRAND.tagline} • Live` });

  const signature = `${total}|${top
    .map((u) => `${u.userId}:${u.level}:${u.xp}`)
    .join(",")}`;

  return { embed, signature };
}

/** Re-render (or create) the pinned live leaderboard message for a guild. */
export async function refreshLiveLeaderboard(client: Client, guildId: string) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId } });
  if (!config?.liveLeaderboardChannelId) return;

  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;

  const channel = guild.channels.cache.get(config.liveLeaderboardChannelId) as
    | TextChannel
    | undefined;
  if (!channel?.isTextBased?.()) return;

  const { embed, signature } = await buildLeaderboardEmbed(guildId, guild.name, true);

  if (config.liveLeaderboardMessageId) {
    // Nothing changed since the last tick — skip the edit so we never spam
    // the channel or burn Discord rate limits.
    if (lastRender.get(guildId) === signature) {
      markLeaderboardSkip();
      return;
    }

    const existing = await channel.messages
      .fetch(config.liveLeaderboardMessageId)
      .catch(() => null);
    if (existing) {
      await existing.edit({ embeds: [embed] }).catch(() => {});
      markLeaderboardEdit();
      lastRender.set(guildId, signature);
      return;
    }
  }

  const sent = await channel.send({ embeds: [embed] }).catch(() => null);
  if (!sent) return;
  await sent.pin().catch(() => {});
  markLeaderboardEdit();
  lastRender.set(guildId, signature);
  await prisma.guildConfig
    .update({
      where: { guildId },
      data: { liveLeaderboardMessageId: sent.id },
    })
    .catch(() => {});
}

/** Drop the cached render so the next tick definitely re-renders. */
export function invalidateLeaderboard(guildId: string) {
  lastRender.delete(guildId);
}

/** Refresh every configured live leaderboard on an interval. */
export function startLeaderboardScheduler(client: Client) {
  let running = false;
  const tick = async () => {
    // Skip if the previous tick is still working — prevents overlapping edits.
    if (running) return;
    running = true;
    try {
      const configs = await prisma.guildConfig
        .findMany({ where: { NOT: { liveLeaderboardChannelId: null } } })
        .catch(() => []);
      for (const config of configs) {
        await refreshLiveLeaderboard(client, config.guildId).catch(() => {});
      }
    } catch (err) {
      console.error("[leaderboard]", err);
    } finally {
      markLeaderboardTick();
      running = false;
    }
  };

  void tick();
  setInterval(() => void tick(), LIVE_REFRESH_MS);
}

