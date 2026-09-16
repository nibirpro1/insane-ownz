import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const ANSWERS = [
  "Yes, definitely.", "Without a doubt.", "Most likely.", "Signs point to yes.",
  "Ask again later.", "Cannot predict now.", "Reply hazy, try again.",
  "Don't count on it.", "My reply is no.", "Very doubtful.",
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("Ask the Insane Ownz magic 8-ball")
    .addStringOption((o) => o.setName("question").setDescription("Your question").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString("question", true);
    const answer = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];

    await interaction.reply({
      embeds: [
        ownzEmbed("primary")
          .setTitle("🎱 Insane Ownz 8-Ball")
          .setDescription(`**Q:** ${question}\n**A:** ${answer}`),
      ],
    });
  },
};

export default command;
