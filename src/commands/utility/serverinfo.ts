import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed, section } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show information about this server"),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild!;
    await guild.fetch();

    const text = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voice = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;

    await interaction.reply({
      embeds: [
        ownzEmbed("primary")
          .setTitle(`🌐 ${guild.name}`)
          .setThumbnail(guild.iconURL({ size: 256 }))
          .setDescription(
            [
              section("Overview"),
              `**Owner:** <@${guild.ownerId}>`,
              `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
              `**Members:** \`${guild.memberCount}\``,
              `**Boosts:** \`${guild.premiumSubscriptionCount}\` (Level ${guild.premiumTier})`,
              "",
              section("Channels"),
              `💬 Text • \`${text}\`  🔊 Voice • \`${voice}\``,
              `🎭 Roles • \`${guild.roles.cache.size}\``,
            ].join("\n")
          ),
      ],
    });
  },
};

export default command;
