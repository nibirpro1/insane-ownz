import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

// Discord interaction tokens expire after ~15 minutes, so long reminders are
// delivered by DM (with a channel fallback) instead of interaction.followUp().
const MAX_MINUTES = 60 * 24 * 7; // 7 days

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Get reminded after a set time")
    .addIntegerOption((opt) =>
      opt
        .setName("minutes")
        .setDescription("Minutes from now (1 - 10080)")
        .setMinValue(1)
        .setMaxValue(MAX_MINUTES)
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("message").setDescription("What to remind you about").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const minutes = Math.min(
      Math.max(interaction.options.getInteger("minutes", true), 1),
      MAX_MINUTES
    );
    const message = interaction.options.getString("message", true).slice(0, 1000);
    const dueAt = Math.floor((Date.now() + minutes * 60_000) / 1000);

    await interaction.reply({
      embeds: [
        ownzEmbed("primary")
          .setTitle("⏰ Reminder set")
          .setDescription(`I'll ping you <t:${dueAt}:R>.\n\n**${message}**`),
      ],
      ephemeral: true,
    });

    const channel = interaction.channel;
    const timer = setTimeout(async () => {
      const embed = ownzEmbed("primary")
        .setTitle("⏰ Reminder")
        .setDescription(message);
      const sent = await interaction.user.send({ embeds: [embed] }).catch(() => null);
      if (!sent && channel?.isTextBased() && "send" in channel) {
        await channel
          .send({ content: `${interaction.user}`, embeds: [embed] })
          .catch(() => {});
      }
    }, minutes * 60_000);
    // Never keep the process alive just for a reminder.
    if (typeof timer.unref === "function") timer.unref();
  },
};

export default command;
