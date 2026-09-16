import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  TextChannel,
} from "discord.js";
import { prisma } from "../db/prisma";
import { resolveInviter } from "../lib/invites";
import { ownzEmbed } from "../lib/brand";
import { createWelcomeCard } from "../lib/welcomeCard";

export default {
  name: "guildMemberAdd",
  once: false,
  async execute(member: GuildMember) {
    const freshMember = await member.fetch().catch(() => member);
    const inviterId = await resolveInviter(member.guild);

    const event = await prisma.inviteEvent.findUnique({
      where: { guildId: member.guild.id },
    });

    if (event?.active && inviterId && inviterId !== member.id) {
      await prisma.inviteRecord
        .create({
          data: {
            guildId: member.guild.id,
            inviterId,
            joinedId: member.id,
          },
        })
        .catch(() => {});
    }

    const config = await prisma.guildConfig.findUnique({
      where: { guildId: member.guild.id },
    });

    // Auto-role
    if (config?.autoRoleId) {
      const autoRole = member.guild.roles.cache.get(config.autoRoleId);
      const botMember = member.guild.members.me;
      if (autoRole && botMember && botMember.roles.highest.comparePositionTo(autoRole) > 0) {
        await freshMember.roles.add(autoRole, "Insane Ownz auto-role").catch((error) => {
          console.error("[auto-role]", error);
        });
      } else {
        console.warn(`[auto-role] Cannot assign ${config.autoRoleId}; move the bot role above the member role.`);
      }
    }

    if (!config?.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(
      config.welcomeChannelId
    ) as TextChannel;
    if (!channel) return;

    // ── Premium welcome experience ─────────────────────────────────────────
    // 1. Hand-drawn welcome card (avatar + brand gradient) as the embed image.
    // 2. Quick-start buttons: rules, roles, ticket + the verify button.
    const rulesChannel = member.guild.channels.cache.find((item) => item.name.endsWith("│rules"));
    const rolesChannel = member.guild.channels.cache.find((item) => item.name.endsWith("│roles"));
    const ticketChannel = member.guild.channels.cache.find((item) => item.name.endsWith("│ticket-support"));
    const channelLink = (ch?: { id: string }) =>
      ch ? `https://discord.com/channels/${member.guild.id}/${ch.id}` : null;

    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const [label, emoji, target] of [
      ["Server Rules", "📜", rulesChannel],
      ["Get Your Roles", "🎭", rolesChannel],
      ["Open a Ticket", "🎫", ticketChannel],
    ] as const) {
      const url = channelLink(target);
      if (url) {
        row.addComponents(
          new ButtonBuilder().setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Link).setURL(url)
        );
      }
    }
    row.addComponents(
      new ButtonBuilder().setCustomId("verify_member").setLabel("Verify").setEmoji("✅").setStyle(ButtonStyle.Success)
    );

    const card = await createWelcomeCard({
      name: member.user.displayName,
      avatarUrl: member.user.displayAvatarURL({ extension: "png", size: 256, forceStatic: true }),
      memberNumber: member.guild.memberCount,
      serverName: "Team Insane",
    }).catch(() => null);

    const embed = ownzEmbed("accent")
      .setTitle(`✦ Welcome, ${member.user.displayName}!`)
      .setDescription(
        [
          `${member} just joined **${member.guild.name}** — the squad just got crazier! 🎉`,
          "",
          "📜 Read the rules and verify to unlock the whole server.",
          "🎭 Grab your division, edition and age roles.",
          "🎫 Stuck? Open a ticket in `🎫│ticket-support` — staff is always around.",
          "",
          "বাংলায়: নিয়ম পড়ো, রোল নাও, আর পুরো মজা নাও! 🔥",
        ].join("\n")
      )
      .addFields(
        { name: "👥 Member", value: `#${member.guild.memberCount}`, inline: true },
        { name: "📨 Invited by", value: inviterId ? `<@${inviterId}>` : "Direct join", inline: true },
        {
          name: "🕒 Account",
          value: `Created <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
      );
    if (card) {
      embed.setImage("attachment://welcome.png");
    }

    const files = card ? [new AttachmentBuilder(card, { name: "welcome.png" })] : [];
    await channel.send({ embeds: [embed], components: [row], files }).catch(() => {});
  },
};
