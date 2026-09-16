import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { logModAction } from "./_modLog";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Member to ban").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for the ban")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild?.members.fetch(target.id).catch(() => null);
    if (!member?.bannable) {
      return interaction.reply({
        content: "I can't ban that user (missing permission or role hierarchy).",
        ephemeral: true,
      });
    }

    await member.ban({ reason });
    await interaction.reply(`Banned **${target.tag}** — ${reason}`);
    await logModAction(interaction, "Ban", target.id, reason);
  },
};

export default command;
