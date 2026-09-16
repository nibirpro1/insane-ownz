import express from "express";
import { Server } from "http";
import cors from "cors";
import path from "path";
import { prisma } from "../db/prisma";
import { ChannelType } from "discord.js";
import { InsaneOwnzClient } from "../structures/InsaneOwnzClient";
import { runtime } from "../lib/metrics";
import {
  invalidateLeaderboard,
  refreshLiveLeaderboard,
  LIVE_REFRESH_MS,
} from "../lib/leaderboard";

/**
 * Very small auth: the dashboard sends the password back on every request
 * as `Authorization: Bearer <password>`. There's only one admin password
 * (DASHBOARD_PASSWORD), so no user accounts / sessions are needed.
 */
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: "DASHBOARD_PASSWORD is not set on the server." });
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== expected) {
    return res.status(401).json({ error: "Invalid password." });
  }
  next();
}

/** Express 4 does not catch rejected async handlers — this wrapper does. */
function wrap(
  fn: (req: express.Request, res: express.Response) => Promise<unknown> | unknown
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}

export function startDashboard(client: InsaneOwnzClient): Server {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/health", (_req, res) => res.json({ ok: true, botOnline: client.isReady() }));

  // Login check — frontend calls this once to validate the password before storing it.
  app.post("/api/login", (req, res) => {
    const expected = process.env.DASHBOARD_PASSWORD;
    if (!expected) return res.status(500).json({ error: "DASHBOARD_PASSWORD is not set on the server." });
    if (req.body?.password === expected) return res.json({ ok: true });
    return res.status(401).json({ error: "Wrong password." });
  });

  app.use("/api", requireAuth);


  // Server overview: name, icon, member count, pulled live from Discord — not the DB.
  app.get("/api/overview", (req, res) => {
    const guildId = String(req.query.guildId ?? process.env.GUILD_ID ?? "");
    const guild = client.guilds.cache.get(guildId);
    res.json({
      botOnline: client.isReady(),
      guildId,
      guildName: guild?.name ?? null,
      memberCount: guild?.memberCount ?? null,
      iconUrl: guild?.iconURL() ?? null,
    });
  });

  // Recent command usage — the core "who did what, when" activity log.
  app.get("/api/command-logs", wrap(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const user = req.query.user ? String(req.query.user) : undefined;
    const command = req.query.command ? String(req.query.command) : undefined;
    const logs = await prisma.commandLog.findMany({
      where: {
        ...(user ? { username: { contains: user, mode: "insensitive" } } : {}),
        ...(command ? { commandName: { contains: command, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(logs);
  }));

  // AutoMod feed — messages deleted, users muted/warned by the automatic rule engine.
  app.get("/api/automod-logs", wrap(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const logs = await prisma.automodLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(logs);
  }));

  // Manual moderation (/warn, /ban, /kick issued by staff)
  app.get("/api/warnings", wrap(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const logs = await prisma.warning.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    res.json(logs);
  }));

  // Aggregate numbers for the top cards + chart on the dashboard.
  app.get("/api/stats", wrap(async (req, res) => {
    const [totalCommands, totalWarnings, totalAutomod, openTickets, topCommandsRaw, topUsersRaw] =
      await Promise.all([
        prisma.commandLog.count(),
        prisma.warning.count(),
        prisma.automodLog.count(),
        prisma.ticket.count({ where: { status: "open" } }),
        prisma.commandLog.groupBy({
          by: ["commandName"],
          _count: { commandName: true },
          orderBy: { _count: { commandName: "desc" } },
          take: 5,
        }),
        prisma.commandLog.groupBy({
          by: ["username"],
          _count: { username: true },
          orderBy: { _count: { username: "desc" } },
          take: 5,
        }),
      ]);

    res.json({
      totalCommands,
      totalWarnings,
      totalAutomod,
      openTickets,
      topCommands: topCommandsRaw.map((c) => ({ name: c.commandName, count: c._count.commandName })),
      topUsers: topUsersRaw.map((u) => ({ name: u.username, count: u._count.username })),
    });
  }));


  // Live status: uptime, gateway ping, loaded commands and the freshest
  // timestamp for each moving part of the bot.
  app.get("/api/status", wrap(async (req, res) => {
    const guildId = String(req.query.guildId ?? process.env.GUILD_ID ?? "");
    const [lastCommand, lastTicket, lastAutomod] = await Promise.all([
      prisma.commandLog.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
      prisma.ticket.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
      prisma.automodLog.findFirst({ orderBy: { createdAt: "desc" } }).catch(() => null),
    ]);

    res.json({
      botOnline: client.isReady(),
      guildId,
      uptimeSeconds: Math.floor(process.uptime()),
      startedAt: runtime.bootedAt.toISOString(),
      pingMs: client.ws.ping >= 0 ? Math.round(client.ws.ping) : null,
      commandsLoaded: client.commands?.size ?? 0,
      leaderboardIntervalMs: LIVE_REFRESH_MS,
      lastLeaderboardTick: runtime.lastLeaderboardTick?.toISOString() ?? null,
      lastLeaderboardEdit: runtime.lastLeaderboardEdit?.toISOString() ?? null,
      leaderboardSkippedEdits: runtime.leaderboardSkippedEdits,
      lastCommand: lastCommand
        ? {
            name: lastCommand.commandName,
            username: lastCommand.username,
            success: lastCommand.success,
            at: lastCommand.createdAt.toISOString(),
          }
        : null,
      lastTicket: lastTicket
        ? {
            number: lastTicket.number,
            status: lastTicket.status,
            at: lastTicket.createdAt.toISOString(),
          }
        : null,
      lastAutomod: lastAutomod
        ? {
            action: lastAutomod.action,
            username: lastAutomod.username,
            reason: lastAutomod.reason,
            at: lastAutomod.createdAt.toISOString(),
          }
        : null,
    });
  }));

  // Per-command breakdown used by the Command history page.
  app.get("/api/command-history", wrap(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
    const names = String(req.query.commands ?? "help,ticket,leaderboard,setup")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    const groups = await Promise.all(
      names.map(async (name) => {
        const [rows, total, failed] = await Promise.all([
          prisma.commandLog.findMany({
            where: { commandName: name },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.commandLog.count({ where: { commandName: name } }),
          prisma.commandLog.count({ where: { commandName: name, success: false } }),
        ]);
        return {
          command: name,
          total,
          failed,
          lastUsedAt: rows[0]?.createdAt.toISOString() ?? null,
          entries: rows.map((r) => ({
            id: r.id,
            username: r.username,
            channelId: r.channelId,
            success: r.success,
            createdAt: r.createdAt.toISOString(),
          })),
        };
      })
    );

    res.json({ groups });
  }));

  // Text channels of the server, for the Setup panel dropdowns.
  app.get("/api/channels", (req, res) => {
    const guildId = String(req.query.guildId ?? process.env.GUILD_ID ?? "");
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return res.json({ channels: [] });
    const channels = guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildText)
      .map((c) => ({ id: c.id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ channels });
  });

  // Current server configuration (what /setup wrote).
  app.get("/api/config", wrap(async (req, res) => {
    const guildId = String(req.query.guildId ?? process.env.GUILD_ID ?? "");
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    res.json({ guildId, config });
  }));

  // Save configuration from the dashboard. Saving a live leaderboard channel
  // immediately syncs the bot: it posts/pins a board in the new channel and
  // the scheduler keeps editing that one message (no re-posting, no spam).
  app.post("/api/config", wrap(async (req, res) => {
    const guildId = String(req.body?.guildId ?? process.env.GUILD_ID ?? "");
    if (!guildId) return res.status(400).json({ error: "No guild selected." });

    const body = req.body ?? {};
    const clean = (v: unknown) => {
      if (v === null || v === "") return null;
      return typeof v === "string" ? v : undefined;
    };

    const fields = {
      modLogChannelId: clean(body.modLogChannelId),
      welcomeChannelId: clean(body.welcomeChannelId),
      levelUpChannelId: clean(body.levelUpChannelId),
      ticketLogChannelId: clean(body.ticketLogChannelId),
      liveLeaderboardChannelId: clean(body.liveLeaderboardChannelId),
    };
    const data = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    ) as Record<string, string | null>;

    const previous = await prisma.guildConfig.findUnique({ where: { guildId } });
    const boardChanged =
      "liveLeaderboardChannelId" in data &&
      data.liveLeaderboardChannelId !== (previous?.liveLeaderboardChannelId ?? null);

    // A new board channel means the old pinned message no longer applies.
    if (boardChanged) data.liveLeaderboardMessageId = null;

    const config = await prisma.guildConfig.upsert({
      where: { guildId },
      update: data,
      create: { guildId, ...data },
    });

    if (boardChanged) {
      invalidateLeaderboard(guildId);
      // Fire-and-forget so the dashboard save stays instant.
      void refreshLiveLeaderboard(client, guildId).catch((err) =>
        console.error("[dashboard] leaderboard sync", err)
      );
    }

    res.json({ ok: true, config, leaderboardSynced: boardChanged });
  }));

  // Anything else that isn't an API call falls back to the dashboard page.
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
  });

  // Any handler failure becomes clean JSON instead of crashing the process.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[dashboard]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Server error. Check the bot logs." });
  });

  const port = Number(process.env.PORT ?? 3000);
  const server = app.listen(port, () => {
    console.log(`📊 Dashboard API listening on port ${port}`);
  });

  return server;
}
