import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { logModAction } from "./_modLog";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Member to kick").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the kick")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
    if (!member?.kickable) {
      return interaction.reply({
        content: "I can't kick that user (missing permission or role hierarchy).",
        ephemeral: true,
      });
    }

    await member.kick(reason);
    await interaction.reply(`Kicked **${target.tag}** — ${reason}`);
    await logModAction(interaction, "Kick", target.id, reason);
  },
};

export default command;
