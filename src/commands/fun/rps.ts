import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const CHOICES = ["rock", "paper", "scissors"] as const;
const EMOJI: Record<string, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("Play rock-paper-scissors against Insane Ownz")
    .addStringOption((o) =>
      o
        .setName("choice")
        .setDescription("Your move")
        .setRequired(true)
        .addChoices(...CHOICES.map((c) => ({ name: c, value: c })))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getString("choice", true);
    const bot = CHOICES[Math.floor(Math.random() * CHOICES.length)];

    let result: string;
    if (user === bot) result = "🤝 It's a tie!";
    else if (
      (user === "rock" && bot === "scissors") ||
      (user === "paper" && bot === "rock") ||
      (user === "scissors" && bot === "paper")
    )
      result = "🏆 You win!";
    else result = "🤖 Insane Ownz wins!";

    await interaction.reply({
      embeds: [
        ownzEmbed("primary")
          .setTitle("🎮 Rock Paper Scissors")
          .setDescription(
            `You: ${EMOJI[user]} **${user}**\nInsane Ownz: ${EMOJI[bot]} **${bot}**\n\n${result}`
          ),
      ],
    });
  },
};

export default command;
