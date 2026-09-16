import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { logModAction } from "./_modLog";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Timeout a member")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Member to mute").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Duration in minutes")
        .setRequired(true)
    )
    .addStringOption((opt) => opt.setName("reason").setDescription("Reason"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user", true);
    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
    if (!member?.moderatable) {
      return interaction.reply({
        content: "I can't timeout that user.",
        ephemeral: true,
      });
    }

    await member.timeout(minutes * 60 * 1000, reason);
    await interaction.reply(`Muted **${target.tag}** for ${minutes} minute(s) — ${reason}`);
    await logModAction(interaction, "Mute", target.id, `${reason} (${minutes}m)`);
  },
};

export default command;
