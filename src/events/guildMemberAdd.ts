import { GuildMember, TextChannel } from "discord.js";
import { prisma } from "../db/prisma";
import { resolveInviter } from "../lib/invites";
import { ownzEmbed } from "../lib/brand";

export default {
  name: "guildMemberAdd",
  once: false,
  async execute(member: GuildMember) {
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
      await member.roles.add(config.autoRoleId, "Insane Ownz auto-role").catch(() => {});
    }

    if (!config?.welcomeChannelId) return;

    const channel = member.guild.channels.cache.get(
      config.welcomeChannelId
    ) as TextChannel;
    if (!channel) return;

    const embed = ownzEmbed("accent")
      .setTitle("⟢ Welcome to Insane Ownz")
      .setDescription(
        [
          `${member} just landed in **${member.guild.name}**.`,
          "",
          `👥 Member • \`#${member.guild.memberCount}\``,
          inviterId ? `📨 Invited by • <@${inviterId}>` : "📨 Invited by • unknown",
        ].join("\n")
      )
      .setThumbnail(member.user.displayAvatarURL());

    await channel.send({ embeds: [embed] }).catch(() => {});
  },
};
