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
    .setName("lock")
    .setDescription("Lock or unlock this channel for @everyone")
    .addBooleanOption((o) =>
      o.setName("locked").setDescription("true = lock, false = unlock").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const locked = interaction.options.getBoolean("locked", true);
    const channel = interaction.channel as TextChannel;

    await channel.permissionOverwrites.edit(interaction.guild!.roles.everyone, {
      SendMessages: locked ? false : null,
    });

    await interaction.reply({
      embeds: [
        ownzEmbed(locked ? "danger" : "success")
          .setTitle(locked ? "🔒 Channel Locked" : "🔓 Channel Unlocked")
          .setDescription(
            locked
              ? `${channel} has been locked. Only staff can send messages.`
              : `${channel} is open again.`
          ),
      ],
    });
  },
};

export default command;
