import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { getQueue } from "./_player";

const command: Command = {
  data: new SlashCommandBuilder().setName("queue").setDescription("View the current song queue"),

  async execute(interaction: ChatInputCommandInteraction) {
    const queue = getQueue(interaction.guildId!);
    if (!queue || queue.songs.length === 0) {
      return interaction.reply("Queue is empty.");
    }

    const list = queue.songs
      .map((s, i) => `${i === 0 ? "▶️" : `${i}.`} ${s.title}`)
      .join("\n");

    await interaction.reply(list);
  },
};

export default command;
