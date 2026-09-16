import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed, section } from "../../lib/brand";

const NUMBER_EMOJIS = ["1\u20e3", "2\u20e3", "3\u20e3", "4\u20e3", "5\u20e3"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("Create a Insane Ownz poll")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("Poll question").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("options")
        .setDescription("Comma-separated options (max 5)")
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString("question", true);
    const options = interaction.options
      .getString("options", true)
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .slice(0, 5);

    const embed = ownzEmbed("accent")
      .setTitle("📊 Insane Ownz Poll")
      .setDescription(
        [
          `**${question}**`,
          "",
          section("Options"),
          ...options.map((o, i) => `${NUMBER_EMOJIS[i]} ${o}`),
          "",
          `Poll by ${interaction.user}`,
        ].join("\n")
      );

    const reply = await interaction.reply({ embeds: [embed], fetchReply: true });
    for (let i = 0; i < options.length; i++) {
      await reply.react(NUMBER_EMOJIS[i]);
    }
  },
};

export default command;
