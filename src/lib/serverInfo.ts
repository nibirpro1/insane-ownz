import { Client, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "../db/prisma";
import { BRAND, ownzEmbed, section } from "./brand";

const dashboardTitle = "📅 Team Insane Daily Info";

async function renderDashboard(channel: TextChannel) {
  const guild = channel.guild;
  await guild.members.fetch().catch(() => {});
  const textChannels = guild.channels.cache.filter((item) => item.isTextBased()).size;
  const voiceChannels = guild.channels.cache.filter((item) => item.isVoiceBased()).size;
  const profiles = await prisma.userProfile.count({ where: { guildId: guild.id } }).catch(() => 0);
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(now);

  const embed = ownzEmbed("accent")
    .setTitle(dashboardTitle)
    .setDescription([
      `Welcome to **${guild.name}**. Here is the current server snapshot.`,
      "",
      section("Today"),
      `📅 **${date}**`,
      `🕒 Updated <t:${Math.floor(Date.now() / 1000)}:R>`,
      "",
      section("Server Stats"),
      `👥 Members • **${guild.memberCount}**`,
      `💬 Text channels • **${textChannels}**`,
      `🔊 Voice channels • **${voiceChannels}**`,
      `📈 Tracked players • **${profiles}**`,
      "",
      section("Level System"),
      "💬 Chat to earn XP every minute.",
      "🏆 Use `/rank` for your progress and `/leaderboard` for the top players.",
      "💰 Use `/daily` and `/balance` for the economy.",
      "",
      "🎫 Need help? Open a ticket in `🎫│ticket-support`.",
    ].join("\n"))
    .setFooter({ text: `${BRAND.tagline} • Refreshes automatically` });

  const messages = await channel.messages.fetch({ limit: 30 }).catch(() => null);
  const existing = messages?.find(
    (message) => message.author.id === message.client.user?.id && message.embeds[0]?.title === dashboardTitle
  );
  if (existing) {
    await existing.edit({ embeds: [embed] }).catch(() => {});
    return;
  }
  await channel.send({ embeds: [embed] }).catch(() => {});
}

export function startServerInfoScheduler(client: Client) {
  const refresh = async () => {
    for (const guild of client.guilds.cache.values()) {
      const channel = guild.channels.cache.find(
        (item) => item.isTextBased() && item.name.endsWith("│help-forum")
      ) as TextChannel | undefined;
      if (channel) await renderDashboard(channel);
    }
  };

  void refresh();
  setInterval(() => void refresh(), 60 * 60 * 1000);
}

export function buildSelfRolePanel() {
  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle("🎭 Choose Your Roles")
    .setDescription([
      "Choose one option from each menu. You can change these anytime.",
      "",
      "🌍 **Division** — choose your region",
      "⛏️ **Edition** — Java or Bedrock",
      "🎂 **Age group** — optional community label",
    ].join("\n"));
}
