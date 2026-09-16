import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Flip a coin"),

  async execute(interaction: ChatInputCommandInteraction) {
    const heads = Math.random() < 0.5;
    await interaction.reply({
      embeds: [
        ownzEmbed("accent")
          .setTitle("🪙 Coin Flip")
          .setDescription(`${interaction.user} flipped **${heads ? "Heads" : "Tails"}**!`),
      ],
    });
  },
};

export default command;
