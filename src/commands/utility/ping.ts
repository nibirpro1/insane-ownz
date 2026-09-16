import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check Insane Ownz's latency"),

  async execute(interaction: ChatInputCommandInteraction) {
    const sent = await interaction.reply({ fetchReply: true, content: "🏓" });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    await interaction.editReply({
      content: null,
      embeds: [
        ownzEmbed("accent")
          .setTitle("🏓 Pong!")
          .setDescription(
            [`📡 Latency • \`${roundtrip}ms\``, `💓 Websocket • \`${ws}ms\``].join("\n")
          ),
      ],
    });
  },
};

export default command;
