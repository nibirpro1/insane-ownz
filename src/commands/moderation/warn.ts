import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import { logModAction } from "./_modLog";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Member to warn").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the warning").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason", true);

    await prisma.warning.create({
      data: {
        guildId: interaction.guildId!,
        userId: target.id,
        moderator: interaction.user.id,
        reason,
      },
    });

    await interaction.reply(`Warned **${target.tag}** — ${reason}`);
    await logModAction(interaction, "Warn", target.id, reason);
  },
};

export default command;
