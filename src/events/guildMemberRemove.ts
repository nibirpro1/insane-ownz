import { AttachmentBuilder, GuildMember, TextChannel } from "discord.js";
import { prisma } from "../db/prisma";
import { ownzEmbed } from "../lib/brand";
import { createWelcomeCard } from "../lib/welcomeCard";

export default {
  name: "guildMemberRemove",
  once: false,
  async execute(member: GuildMember) {
    const config = await prisma.guildConfig.findUnique({ where: { guildId: member.guild.id } });
    const configured = config?.welcomeChannelId
      ? (member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel | undefined)
      : undefined;
    const channel =
      (configured && configured.isTextBased() ? configured : undefined) ??
      (member.guild.channels.cache.find((item) => item.name.endsWith("│welcome")) as TextChannel | undefined);
    if (!channel) return;

    const displayName = member.user?.displayName ?? member.user?.username ?? "a member";
    const card = await createWelcomeCard({
      variant: "leave",
      name: displayName,
      avatarUrl: member.user
        ? member.user.displayAvatarURL({ extension: "png", size: 256, forceStatic: true })
        : "",
      memberNumber: member.guild.memberCount,
      serverName: "Team Insane",
    }).catch(() => null);

    const embed = ownzEmbed("danger")
      .setTitle(`👋 ${displayName} left the squad`)
      .setDescription(
        [
          `**${displayName}** just left **${member.guild.name}**.`,
          "",
          `We are now **${member.guild.memberCount}** members strong — the door is always open! 🚪`,
        ].join("\n")
      )
      .addFields(
        { name: "👥 Members now", value: `#${member.guild.memberCount}`, inline: true },
        {
          name: "🗓️ Stayed since",
          value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Unknown",
          inline: true,
        },
      );
    if (card) embed.setImage("attachment://goodbye.png");

    const files = card ? [new AttachmentBuilder(card, { name: "goodbye.png" })] : [];
    await channel.send({ embeds: [embed], files }).catch(() => {});
  },
};