import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { stopQueue } from "./_player";

const command: Command = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stop music and leave voice channel"),

  async execute(interaction: ChatInputCommandInteraction) {
    stopQueue(interaction.guildId!);
    await interaction.reply("Stopped and left the voice channel.");
  },
};

export default command;
