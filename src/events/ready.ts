import { ActivityType } from "discord.js";
import { InsaneOwnzClient } from "../structures/InsaneOwnzClient";
import { cacheGuildInvites } from "../lib/invites";
import { startGiveawayScheduler } from "../lib/giveaways";
import { setBrandIcon } from "../lib/brand";
import { startLeaderboardScheduler } from "../lib/leaderboard";
import { startServerInfoScheduler } from "../lib/serverInfo";
import { startServerStatsScheduler } from "../lib/serverStats";

export default {
  name: "ready",
  once: true,
  async execute(client: InsaneOwnzClient) {
    console.log(`[INFO] Insane Ownz is online as ${client.user?.tag}`);

    // Insane Ownz logo (bot avatar) is reused as the icon on every embed.
    setBrandIcon(client.user?.displayAvatarURL({ size: 256 }));

    client.user?.setActivity("Insane Ownz • /help", { type: ActivityType.Watching });

    for (const guild of client.guilds.cache.values()) {
      await cacheGuildInvites(guild);
    }

    startGiveawayScheduler(client);
    startLeaderboardScheduler(client);
    startServerInfoScheduler(client);
    startServerStatsScheduler(client);
  },
};
