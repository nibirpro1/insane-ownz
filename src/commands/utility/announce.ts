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
    .setName("announce")
    .setDescription("Send a Insane Ownz-branded announcement")
    .addStringOption((o) => o.setName("title").setDescription("Announcement title").setRequired(true))
    .addStringOption((o) => o.setName("message").setDescription("Announcement text").setRequired(true))
    .addChannelOption((o) => o.setName("channel").setDescription("Target channel (default: here)"))
    .addRoleOption((o) => o.setName("ping").setDescription("Role to ping"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    const title = interaction.options.getString("title", true);
    const message = interaction.options.getString("message", true).replace(/\\n/g, "\n");
    const channel = (interaction.options.getChannel("channel") ?? interaction.channel) as TextChannel;
    const ping = interaction.options.getRole("ping");

    await channel.send({
      content: ping ? `${ping}` : undefined,
      embeds: [ownzEmbed("primary").setTitle(`📢 ${title}`).setDescription(message)],
    });

    await interaction.reply({ content: `Announcement sent to ${channel}.`, ephemeral: true });
  },
};

export default command;
