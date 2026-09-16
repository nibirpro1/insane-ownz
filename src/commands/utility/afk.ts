import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";
import { setAfk } from "../../lib/afk";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set your AFK status")
    .addStringOption((o) => o.setName("reason").setDescription("Why are you AFK?")),

  async execute(interaction: ChatInputCommandInteraction) {
    const reason = interaction.options.getString("reason") ?? "AFK";
    setAfk(interaction.guildId!, interaction.user.id, reason);

    await interaction.reply({
      embeds: [
        ownzEmbed("neutral")
          .setTitle("💤 AFK Set")
          .setDescription(`You're now AFK: **${reason}**\nAnyone who pings you will be notified.`),
      ],
      ephemeral: true,
    });
  },
};

export default command;
