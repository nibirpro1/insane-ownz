import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextChannel,
  AttachmentBuilder,
} from "discord.js";
import { prisma } from "../db/prisma";
import { TICKET_CATEGORIES, findCategory } from "../config/ticketCategories";
import { ownzEmbed, section } from "./brand";

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_META: Record<Priority, { emoji: string; label: string }> = {
  low: { emoji: "🟢", label: "Low" },
  normal: { emoji: "🔵", label: "Normal" },
  high: { emoji: "🟠", label: "High" },
  urgent: { emoji: "🔴", label: "Urgent" },
};

export function ticketPanelSelect() {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Select a department to open a ticket")
      .addOptions(
        TICKET_CATEGORIES.map((c) => ({
          label: c.label,
          value: c.id,
          description: c.blurb.slice(0, 90),
          emoji: c.emoji,
        }))
      )
  );
}

export function ticketControlRow(claimed: boolean) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(claimed ? "ticket_unclaim" : "ticket_claim")
      .setLabel(claimed ? "Unclaim" : "Claim")
      .setEmoji(claimed ? "↩️" : "🖐️")
      .setStyle(claimed ? ButtonStyle.Secondary : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

export function closedRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_reopen")
      .setLabel("Reopen")
      .setEmoji("🔓")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("ticket_delete")
      .setLabel("Delete channel")
      .setEmoji("🗑️")
      .setStyle(ButtonStyle.Danger)
  );
}

export async function nextTicketNumber(guildId: string) {
  const config = await prisma.guildConfig.upsert({
    where: { guildId },
    update: { ticketCounter: { increment: 1 } },
    create: { guildId, ticketCounter: 1 },
  });
  return config.ticketCounter;
}

export async function isTicketStaff(member: GuildMember) {
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  const config = await prisma.guildConfig.findUnique({
    where: { guildId: member.guild.id },
  });
  if (config?.ticketStaffRoleId) return member.roles.cache.has(config.ticketStaffRoleId);
  return false;
}

export async function createTicketChannel(opts: {
  guild: Guild;
  ownerId: string;
  ownerName: string;
  categoryId: string;
  subject: string;
  details: string;
}) {
  const category = findCategory(opts.categoryId)!;
  const config = await prisma.guildConfig.findUnique({
    where: { guildId: opts.guild.id },
  });
  const number = await nextTicketNumber(opts.guild.id);

  const channel = await opts.guild.channels.create({
    name: `${category.id}-${String(number).padStart(4, "0")}`,
    type: ChannelType.GuildText,
    parent: config?.ticketCategoryId ?? undefined,
    topic: `Insane Ownz ticket #${number} • ${category.label} • owner ${opts.ownerId}`,
    permissionOverwrites: [
      {
        id: opts.guild.roles.everyone,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: opts.ownerId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      ...(config?.ticketStaffRoleId
        ? [
            {
              id: config.ticketStaffRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            },
          ]
        : []),
    ],
  });

  const ticket = await prisma.ticket.create({
    data: {
      guildId: opts.guild.id,
      channelId: channel.id,
      ownerId: opts.ownerId,
      category: category.id,
      number,
      subject: opts.subject,
      details: opts.details,
    },
  });

  const embed = ownzEmbed("accent")
    .setTitle(`${category.emoji} ${category.label} • Ticket #${number}`)
    .setDescription(
      [
        `Hey <@${opts.ownerId}>, welcome to your private Insane Ownz ticket.`,
        "",
        section("Details"),
        `**Subject:** ${opts.subject}`,
        `**Priority:** ${PRIORITY_META.normal.emoji} ${PRIORITY_META.normal.label}`,
        `**Status:** 🟡 Waiting for staff`,
        "",
        section("Your message"),
        opts.details.slice(0, 900) || "*No extra details provided.*",
      ].join("\n")
    );

  const mention = config?.ticketStaffRoleId ? `<@&${config.ticketStaffRoleId}> ` : "";
  const msg = await channel.send({
    content: `${mention}<@${opts.ownerId}>`,
    embeds: [embed],
    components: [ticketControlRow(false)],
  });
  await msg.pin().catch(() => {});

  return { channel, ticket, number };
}

export function transcriptText(
  channelName: string,
  channelId: string,
  entries: { at: Date; tag: string; content: string }[]
) {
  const header = [
    `Insane Ownz ticket transcript`,
    `Channel: #${channelName} (${channelId})`,
    `Generated: ${new Date().toISOString()}`,
    `Messages: ${entries.length}`,
    "".padEnd(50, "-"),
  ];
  const lines = entries.length
    ? entries.map((e) => `[${e.at.toISOString()}] ${e.tag}: ${e.content}`)
    : ["<no messages>"];
  return [...header, ...lines].join("\n");
}

/** Build the .txt transcript attachment plus quick stats. */
export async function buildTranscript(channel: TextChannel) {
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  const entries = messages
    ? [...messages.values()].reverse().map((m) => ({
        at: m.createdAt,
        tag: m.author.tag,
        content: m.content || (m.embeds.length ? "<embed>" : "<attachment>"),
      }))
    : [];

  const participants = [...new Set(entries.map((e) => e.tag))];
  const text = transcriptText(channel.name, channel.id, entries);

  const file = new AttachmentBuilder(Buffer.from(text, "utf8"), {
    name: `${channel.name}-transcript.txt`,
  });

  return { file, count: entries.length, participants, text };
}

/**
 * Build a transcript, post it (embed + .txt) into the ticket log channel,
 * and hand the attachment back for the ephemeral reply.
 */
export async function deliverTranscript(channel: TextChannel, requesterId: string) {
  const { file, count, participants } = await buildTranscript(channel);
  const ticket = await prisma.ticket
    .findFirst({ where: { channelId: channel.id } })
    .catch(() => null);

  await logTicket(
    channel.guild,
    [
      `📄 Transcript for <#${channel.id}>`,
      "",
      section("Summary"),
      ticket ? `**Ticket:** #${ticket.number} • ${ticket.category}` : `**Channel:** ${channel.name}`,
      ticket?.ownerId ? `**Opened by:** <@${ticket.ownerId}>` : null,
      `**Requested by:** <@${requesterId}>`,
      `**Messages:** \`${count}\``,
      `**Participants:** ${participants.length ? participants.map((p) => `\`${p}\``).join(", ") : "—"}`,
      "",
      "Full log attached as a `.txt` file below.",
    ]
      .filter(Boolean) as string[],
    "📄 Ticket Transcript",
    [file]
  );

  // A fresh attachment is needed because the first one is consumed by the log send.
  const { file: replyFile } = await buildTranscript(channel);
  return { file: replyFile, count, participants };
}

export async function logTicket(
  guild: Guild,
  embedLines: string[],
  title: string,
  files: AttachmentBuilder[] = []
) {
  const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
  if (!config?.ticketLogChannelId) return;
  const log = guild.channels.cache.get(config.ticketLogChannelId) as TextChannel | undefined;
  if (!log) return;
  await log
    .send({
      embeds: [ownzEmbed("neutral").setTitle(title).setDescription(embedLines.join("\n"))],
      files,
    })
    .catch(() => {});
}
