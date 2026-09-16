import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Set slowmode on this channel (0 to disable)")
    .addIntegerOption((o) =>
      o.setName("seconds").setDescription("Delay in seconds (0 = off, max 21600)").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const seconds = interaction.options.getInteger("seconds", true);
    const channel = interaction.channel as TextChannel;

    if (seconds < 0 || seconds > 21600) {
      await interaction.reply({ content: "Seconds must be between 0 and 21600.", ephemeral: true });
      return;
    }

    await channel.setRateLimitPerUser(seconds);
    await interaction.reply({
      embeds: [
        ownzEmbed(seconds === 0 ? "success" : "warning")
          .setTitle(seconds === 0 ? "🐇 Slowmode Disabled" : "🐢 Slowmode Enabled")
          .setDescription(
            seconds === 0
              ? `Slowmode removed in ${channel}.`
              : `${channel} now has a **${seconds}s** delay between messages.`
          ),
      ],
    });
  },
};

export default command;
