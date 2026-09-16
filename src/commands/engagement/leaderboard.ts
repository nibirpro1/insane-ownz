import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  PermissionFlagsBits,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import { ownzEmbed } from "../../lib/brand";
import {
  buildLeaderboardEmbed,
  rankOf,
  refreshLiveLeaderboard,
} from "../../lib/leaderboard";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Top members by level — plus a live auto-updating board")
    .addSubcommand((s) =>
      s.setName("view").setDescription("Show the current top 10 and your rank")
    )
    .addSubcommand((s) =>
      s
        .setName("live")
        .setDescription("Set a channel where a live leaderboard auto-updates")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel for the live leaderboard")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s.setName("stop").setDescription("Stop the live leaderboard updates")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "view") {
      const { embed } = await buildLeaderboardEmbed(guildId, interaction.guild!.name);
      const mine = await rankOf(guildId, interaction.user.id);
      if (mine) {
        embed.addFields({
          name: "Your position",
          value: `**#${mine.rank}** • Level ${mine.profile.level} • \`${mine.profile.xp} XP\``,
        });
      }
      return interaction.reply({ embeds: [embed] });
    }

    const member = interaction.member;
    const canManage =
      typeof member?.permissions !== "string" &&
      member?.permissions.has(PermissionFlagsBits.ManageGuild);
    if (!canManage) {
      return interaction.reply({
        content: "You need **Manage Server** to change the live leaderboard.",
        ephemeral: true,
      });
    }

    if (sub === "live") {
      const channel = interaction.options.getChannel("channel", true);
      await prisma.guildConfig.upsert({
        where: { guildId },
        update: {
          liveLeaderboardChannelId: channel.id,
          liveLeaderboardMessageId: null,
        },
        create: {
          guildId,
          liveLeaderboardChannelId: channel.id,
        },
      });
      await refreshLiveLeaderboard(interaction.client, guildId);
      return interaction.reply({
        embeds: [
          ownzEmbed("success")
            .setTitle("🟢 Live Leaderboard Enabled")
            .setDescription(
              `The live leaderboard now lives in <#${channel.id}> and refreshes automatically every minute.`
            ),
        ],
        ephemeral: true,
      });
    }

    await prisma.guildConfig
      .update({
        where: { guildId },
        data: { liveLeaderboardChannelId: null, liveLeaderboardMessageId: null },
      })
      .catch(() => {});
    return interaction.reply({
      embeds: [
        ownzEmbed("warning")
          .setTitle("⏸️ Live Leaderboard Stopped")
          .setDescription("Auto-updates are off. Use `/leaderboard live` to enable again."),
      ],
      ephemeral: true,
    });
  },
};

export default command;
