import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  TextChannel,
} from "discord.js";
import { prisma } from "../db/prisma";
import { resolveInviter } from "../lib/invites";
import { ownzEmbed } from "../lib/brand";

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

    const embed = ownzEmbed("accent")
      .setTitle(`✦ Welcome, ${member.user.displayName}!`)
      .setDescription(
        [
          `${member} just joined **${member.guild.name}**.`,
          "",
          "You are now part of the **Team Insane** community.",
          "Read the rules, explore the channels, and make yourself at home.",
        ].join("\n")
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setImage("https://dummyimage.com/1200x240/111827/22d3ee.png&text=TEAM+INSANE")
      .addFields(
        { name: "👥 Member", value: `#${member.guild.memberCount}`, inline: true },
        { name: "📨 Invited by", value: inviterId ? `<@${inviterId}>` : "Unknown", inline: true },
        { name: "🎖️ Role", value: config.autoRoleId ? "Insane Ownz Member" : "Member", inline: true },
        { name: "🚀 Start here", value: "<#" + (member.guild.channels.cache.find((item) => item.name.endsWith("│rules"))?.id ?? channel.id) + ">  •  <#" + (member.guild.channels.cache.find((item) => item.name.endsWith("│general"))?.id ?? channel.id) + ">", inline: false },
      );

    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_member")
          .setLabel("Verify Rules")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
      )],
    }).catch(() => {});
  },
};
