import "dotenv/config";
import { GatewayIntentBits, Partials } from "discord.js";
import { InsaneOwnzClient } from "./structures/InsaneOwnzClient";
import { loadCommands } from "./handlers/loadCommands";
import { loadEvents } from "./handlers/loadEvents";
import { startDashboard } from "./api/server";
import { prisma } from "./db/prisma";

const client = new InsaneOwnzClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Keep the bot alive when a stray promise or listener throws.
process.on("unhandledRejection", (reason) => console.error("[unhandledRejection]", reason));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

if (!process.env.DISCORD_TOKEN) {
  console.error("[FATAL] DISCORD_TOKEN is missing. Set it in your environment (.env or Railway variables).");
  process.exit(1);
}
if (!process.env.DASHBOARD_PASSWORD) {
  console.warn("[WARN] DASHBOARD_PASSWORD is not set — the dashboard will refuse every login until you set it.");
}

loadCommands(client);
loadEvents(client);
const dashboardServer = startDashboard(client);

let shuttingDown = false;
const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[INFO] Received ${signal}; shutting down cleanly.`);

  await new Promise<void>((resolve) => dashboardServer.close(() => resolve()));
  client.destroy();
  await prisma.$disconnect();
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[FATAL] Discord login failed — check DISCORD_TOKEN and the bot intents.", err);
  process.exit(1);
});

