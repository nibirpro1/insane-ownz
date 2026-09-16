import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nick")
    .setDescription("Change a member's nickname")
    .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    .addStringOption((o) =>
      o.setName("nickname").setDescription("New nickname (empty = reset)").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.options.getMember("user") as any;
    const nick = interaction.options.getString("nickname");

    if (!member) {
      await interaction.reply({ content: "Member not found.", ephemeral: true });
      return;
    }

    await member.setNickname(nick ?? null).catch(async () => {
      await interaction.reply({ content: "I can't change that member's nickname (role hierarchy).", ephemeral: true });
    });

    if (!interaction.replied) {
      await interaction.reply({
        content: nick ? `Nickname set to **${nick}** for ${member}.` : `Nickname reset for ${member}.`,
      });
    }
  },
};

export default command;
