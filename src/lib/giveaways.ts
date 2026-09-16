import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  TextChannel,
} from "discord.js";
import { prisma } from "../db/prisma";
import { ownzEmbed, section } from "./brand";

export function giveawayRow(disabled = false, count = 0) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("giveaway_enter")
      .setLabel(disabled ? "Giveaway Ended" : `Enter${count ? ` • ${count}` : ""}`)
      .setEmoji("🎟️")
      .setStyle(disabled ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

export function giveawayEmbed(opts: {
  prize: string;
  hostId: string;
  winnerCount: number;
  requiredInvites: number;
  endsAt: Date;
  entries: number;
}) {
  return ownzEmbed("primary")
    .setTitle("🎁 Insane Ownz Giveaway")
    .setDescription(
      [
        `**${opts.prize}**`,
        "",
        section("Details"),
        `🏆 Winners • \`${opts.winnerCount}\``,
        `⏳ Ends • <t:${Math.floor(opts.endsAt.getTime() / 1000)}:R>`,
        `🎟️ Entries • \`${opts.entries}\``,
        opts.requiredInvites > 0
          ? `📨 Requirement • \`${opts.requiredInvites}\` event invites`
          : "📨 Requirement • none",
        "",
        `Hosted by <@${opts.hostId}>`,
      ].join("\n")
    );
}

export async function endGiveaway(client: Client, giveawayId: string) {
  const giveaway = await prisma.giveaway.findUnique({
    where: { id: giveawayId },
    include: { entries: true },
  });
  if (!giveaway || giveaway.ended) return;

  let pool = giveaway.entries.map((e) => e.userId);

  if (giveaway.requiredInvites > 0) {
    const counts = await prisma.inviteRecord.groupBy({
      by: ["inviterId"],
      where: { guildId: giveaway.guildId },
      _count: { inviterId: true },
    });
    const map = new Map(counts.map((c) => [c.inviterId, c._count.inviterId]));
    pool = pool.filter((id) => (map.get(id) ?? 0) >= giveaway.requiredInvites);
  }

  const winners: string[] = [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  while (winners.length < giveaway.winnerCount && shuffled.length) {
    winners.push(shuffled.pop()!);
  }

  await prisma.giveaway.update({
    where: { id: giveaway.id },
    data: { ended: true, winners: winners.join(",") },
  });

  const channel = (await client.channels
    .fetch(giveaway.channelId)
    .catch(() => null)) as TextChannel | null;
  if (!channel) return;

  const embed = ownzEmbed(winners.length ? "success" : "warning")
    .setTitle("🎉 Giveaway Ended")
    .setDescription(
      [
        `🎁 **Prize** • ${giveaway.prize}`,
        `🏆 **Winner(s)** • ${
          winners.length ? winners.map((w) => `<@${w}>`).join(", ") : "nobody met the requirements"
        }`,
        "",
        `Hosted by <@${giveaway.hostId}>`,
      ].join("\n")
    );

  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  if (message) {
    await message.edit({ components: [giveawayRow(true)] }).catch(() => {});
  }

  await channel
    .send({
      content: winners.length ? winners.map((w) => `<@${w}>`).join(" ") : undefined,
      embeds: [embed],
    })
    .catch(() => {});
}

/** Poll every 15s for giveaways that should end. */
export function startGiveawayScheduler(client: Client) {
  setInterval(() => {
    void (async () => {
      try {
        const due = await prisma.giveaway.findMany({
          where: { ended: false, endsAt: { lte: new Date() } },
        });
        for (const g of due) {
          await endGiveaway(client, g.id).catch((e) => console.error("[giveaway]", e));
        }
      } catch (err) {
        console.error("[giveaway-scheduler]", err);
      }
    })();
  }, 15_000);
}


export function parseDuration(input: string): number | null {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factor = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
  return value * factor;
}
