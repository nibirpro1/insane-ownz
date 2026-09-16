import { GuildMember, Message, TextChannel } from "discord.js";
import { prisma } from "../db/prisma";
import { ownzEmbed } from "../lib/brand";
import { MAX_LEVEL, rewardForLevel, nextReward } from "../config/levelRewards";
import { AUTOMOD } from "../config/automod";
import { getAfk, clearAfk } from "../lib/afk";

const XP_PER_MESSAGE = 5;
const XP_COOLDOWN_MS = 60_000;
const cooldowns = new Map<string, number>();

function xpForLevel(level: number) {
  return 5 * level ** 2 + 50 * level + 100;
}

const INVITE_RE = /(discord\.gg|discord\.com\/invite)\/\w+/i;
const LINK_RE = /https?:\/\/\S+/i;

// --- Anti-spam bookkeeping (in-memory, per process) -----------------------
const messageWindow = new Map<string, number[]>();

function isSpamming(key: string): boolean {
  if (!AUTOMOD.antiSpamEnabled) return false;
  const now = Date.now();
  const timestamps = (messageWindow.get(key) ?? []).filter((t) => now - t < AUTOMOD.spamWindowMs);
  timestamps.push(now);
  messageWindow.set(key, timestamps);
  return timestamps.length > AUTOMOD.spamMessageLimit;
}

/** Returns a violation reason, or null if the message is fine. */
function automodViolation(message: Message): string | null {
  if (!AUTOMOD.enabled) return null;
  const content = message.content;
  const lower = content.toLowerCase();

  if (AUTOMOD.blockScamLinks) {
    const hasKeyword = AUTOMOD.scamKeywords.some((k) => lower.includes(k.toLowerCase()));
    const hasFakeDomain = AUTOMOD.scamDomainHints.some((d) => lower.includes(d.toLowerCase()));
    if ((hasKeyword || hasFakeDomain) && LINK_RE.test(content)) {
      return "This looks like a Nitro/Steam scam link, which is against Discord's rules.";
    }
  }

  if (AUTOMOD.blockInvites && INVITE_RE.test(content)) return "Discord invite links are not allowed here.";
  if (AUTOMOD.blockLinks && LINK_RE.test(content)) {
    const allowed = AUTOMOD.allowedDomains.some((d) => lower.includes(d.toLowerCase()));
    if (!allowed) return "Links are not allowed here.";
  }
  const mentions = message.mentions.users.size + message.mentions.roles.size;
  if (mentions > AUTOMOD.maxMentions) return "Mass mentions are not allowed.";
  const bad = AUTOMOD.blockedWords.find((w) => lower.includes(w.toLowerCase()));
  if (bad) return "Your message contained a blocked word.";
  return null;
}

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message) {
    if (message.author.bot || !message.guildId) return;

    // --- AFK handling -------------------------------------------------
    const afkKey = { guildId: message.guildId, userId: message.author.id };
    if (getAfk(afkKey.guildId, afkKey.userId)) {
      clearAfk(afkKey.guildId, afkKey.userId);
      await message.reply({ content: `👋 Welcome back ${message.author}, your AFK was removed.` })
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 5000))
        .catch(() => {});
    }
    for (const [, user] of message.mentions.users) {
      const afk = getAfk(message.guildId, user.id);
      if (afk) {
        await message.reply({
          content: `💤 **${user.username}** is AFK: ${afk.reason} • <t:${Math.floor(afk.since / 1000)}:R>`,
        }).then((m) => setTimeout(() => m.delete().catch(() => {}), 8000)).catch(() => {});
        break;
      }
    }

    // --- AutoMod ------------------------------------------------------
    const automodMember = message.member as GuildMember | null;
    if (!automodMember?.permissions.has("ManageMessages")) {
      const violation = automodViolation(message);
      const spamming = isSpamming(`${message.guildId}-${message.author.id}`);

      if (violation || spamming) {
        const reason = violation ?? "Posting too fast (spam).";
        await message.delete().catch(() => {});

        await prisma.automodLog
          .create({
            data: {
              guildId: message.guildId,
              userId: message.author.id,
              username: message.author.username,
              channelId: message.channelId,
              reason,
              action: spamming && !violation ? "mute" : "delete",
            },
          })
          .catch(() => {});

        if (spamming && !violation) {
          await automodMember
            ?.timeout(AUTOMOD.spamMuteMinutes * 60_000, "Insane Ownz AutoMod: spam")
            .catch(() => {});
        }

        if (AUTOMOD.warnOnDelete) {
          await message.author.send({
            embeds: [
              ownzEmbed("danger")
                .setTitle("🛡️ Insane Ownz AutoMod")
                .setDescription(`Your message in <#${message.channelId}> was removed.\n**Reason:** ${reason}`),
            ],
          }).catch(() => {});
        }
        return;
      }
    }

    // --- Restricted channel enforcement -------------------------------
    const restricted = await prisma.restrictedChannel.findUnique({
      where: { channelId: message.channelId },
    });
    if (restricted) {
      const member = message.member as GuildMember | null;
      const isStaff = member?.permissions.has("ManageMessages");
      if (!isStaff) {
        await message.delete().catch(() => {});
        await member
          ?.timeout(restricted.muteMinutes * 60_000, "Posted in a restricted Insane Ownz channel")
          .catch(() => {});
        await message.author
          .send({
            embeds: [
              ownzEmbed("danger")
                .setTitle("⛔ Restricted Channel")
                .setDescription(
                  [
                    `Your message in <#${message.channelId}> was removed and you were muted for **${restricted.muteMinutes} minutes**.`,
                    "",
                    `আপনার মেসেজটি মুছে ফেলা হয়েছে এবং আপনাকে **${restricted.muteMinutes} মিনিটের** জন্য মিউট করা হয়েছে।`,
                  ].join("\n")
                ),
            ],
          })
          .catch(() => {});
        return;
      }
    }

    // --- Levelling -----------------------------------------------------
    const key = `${message.guildId}-${message.author.id}`;
    const now = Date.now();
    if (cooldowns.get(key) && now - cooldowns.get(key)! < XP_COOLDOWN_MS) {
      return;
    }
    cooldowns.set(key, now);

    const profile = await prisma.userProfile.upsert({
      where: {
        guildId_userId: { guildId: message.guildId, userId: message.author.id },
      },
      update: { xp: { increment: XP_PER_MESSAGE } },
      create: {
        guildId: message.guildId,
        userId: message.author.id,
        xp: XP_PER_MESSAGE,
      },
    });

    const needed = xpForLevel(profile.level);
    if (profile.xp < needed) return;

    // Max level 100 — no further level ups
    if (profile.level >= MAX_LEVEL) return;

    const newLevel = profile.level + 1;
    const reward = rewardForLevel(newLevel);
    const coinReward = 50 + (reward?.coins ?? 0);

    await prisma.userProfile.update({
      where: {
        guildId_userId: { guildId: message.guildId, userId: message.author.id },
      },
      data: { level: newLevel, xp: 0, balance: { increment: coinReward } },
    });

    // Assign reward role if configured for this level
    let roleGranted: string | null = null;
    if (reward?.roleName && message.guild) {
      const role = message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === reward.roleName!.toLowerCase()
      );
      if (role && message.member) {
        await (message.member as GuildMember)
          .roles.add(role, `Insane Ownz level ${newLevel} reward`)
          .then(() => {
            roleGranted = role.name;
          })
          .catch(() => {});
      }
    }

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: message.guildId },
    });

    const channel =
      (config?.levelUpChannelId
        ? (message.guild?.channels.cache.get(config.levelUpChannelId) as TextChannel)
        : null) ?? (message.channel as TextChannel);

    const upcoming = nextReward(newLevel);
    const embed = ownzEmbed("primary")
      .setTitle("⚡ Level Up")
      .setDescription(
        [
          `${message.author} reached **Level ${newLevel}**.`,
          "",
          `🎖️ Level reward • \`+${coinReward}\` coins`,
          ...(roleGranted ? [`🏅 Role unlocked • \`@${roleGranted}\``] : []),
          ...(newLevel >= MAX_LEVEL
            ? [`👑 **MAX LEVEL ${MAX_LEVEL} reached!**`]
            : [
                `🎯 Next level at • \`${xpForLevel(newLevel)} XP\``,
                ...(upcoming
                  ? [`🎁 Next reward at **Level ${upcoming.level}** • \`${upcoming.coins}\` coins${upcoming.roleName ? ` + \`@${upcoming.roleName}\`` : ""}`]
                  : []),
              ]),
        ].join("\n")
      )
      .setThumbnail(message.author.displayAvatarURL());

    channel.send({ content: `${message.author}`, embeds: [embed] }).catch(() => {});
  },
};
