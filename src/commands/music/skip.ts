import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { skipSong } from "./_player";

const command: Command = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),

  async execute(interaction: ChatInputCommandInteraction) {
    skipSong(interaction.guildId!);
    await interaction.reply("Skipped.");
  },
};

export default command;
