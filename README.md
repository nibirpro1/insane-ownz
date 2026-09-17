# Insane Ownz Bot

All-in-one Discord bot for the **Insane Ownz** server. Moderation, tickets, giveaways,
invite events, levelling, polls and music — all under one neon-violet Insane Ownz identity.

## Branding

- Upload your Team Insane logo as the bot avatar in the
  [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Avatar.
- Every embed automatically uses the bot avatar as author + footer icon
  (`src/lib/brand.ts`, applied on ready).
- Colours: violet `#7C5CFF`, cyan `#22D3EE`, plus success/warning/danger tones.

## Dashboard

Same process as the bot — no separate hosting needed. It shows:
- **Activity log** — every slash command, who ran it, when (filter by user/command)
- **AutoMod feed** — messages it removed automatically and why (scam links, spam, invites, blocked words)
- **Stats** — commands run, open tickets, automod actions, staff warnings, top commands

Set `DASHBOARD_PASSWORD` in `.env`, then once deployed, open your app's URL in a browser and enter that password.

## AutoMod (Discord rules protection)

Configured in `src/config/automod.ts`, on by default:
- Blocks "free Nitro" / fake gift-link scams (`blockScamLinks`)
- Blocks invite links from other servers (`blockInvites`)
- Blocks mass mentions (`maxMentions`)
- Rate-limits spam — 5+ messages in 6s gets a timeout (`antiSpamEnabled`)
- Optional link/word blocklists you can fill in yourself

Every action is written to the dashboard's AutoMod feed automatically.

## Setup

```bash
npm install
cp .env.example .env       # fill in token, client id, guild id, database url
npm run prisma:migrate
npm run deploy-commands
npm run dev
```

Then in Discord run:

```
/setup mod_log:#mod-log welcome:#welcome ticket_category:Tickets level_up:#level-up
```

## Features

### Tickets (`/ticketpanel`)
Department panel with buttons (Lobby, Survival, Duels, Arcade, Events, Giveaway Claim,
General Support, Ban/Mute Appeal — edit `src/config/ticketCategories.ts`).
Each click opens a private channel with Claim / Close buttons. One open ticket per user.

### Restricted channels (`/lockchannel enabled:true mute_minutes:10`)
Posts a bilingual (English + বাংলা) restriction notice and enforces it: any non-staff
message is deleted instantly and the sender gets a timeout, plus a DM explaining why.
Turn it off with `/lockchannel enabled:false`.

### Giveaways (`/giveaway start|end|reroll`)
Button-entry giveaways with live entry counter, winner count, optional
`required_invites` gate tied to the invite event, and automatic ending
(scheduler polls every 15s).

### Invite event (`/inviteevent start|stop|check`)
Tracks who invited each new member (invite-code diffing), resets the board on `start`,
and `check` shows status + top-10 leaderboard with medals.

### Levelling
XP per message (60s cooldown), Insane Ownz level-up embed with coin reward, posted in the
configured level-up channel. `/rank`, `/leaderboard`, `/balance`, `/daily`.

### Welcome, goodbye & boost cards (`guildMemberAdd` / `guildMemberRemove` / `guildMemberUpdate`)
Canvas-drawn cards (member avatar, brand gradient, member number) with one look per moment:
- **Welcome** — `+1 NEW MEMBER`, posted in the welcome channel with quick-start buttons:
  📜 Server Rules, 🎭 Get Your Roles, 🎫 Open a Ticket, ✅ Verify + invite attribution and account age
- **Goodbye** — `-1 MEMBER` card with "we are now N members strong" when someone leaves
- **Legend Boost** — `NEW BOOST` thank-you card posted in announcements when someone boosts,
  with boost count and server level

### Live server stats (`✦ SERVER STATS`)
Three locked voice channels pinned at the top of the server, updated by the bot:
- `⭐ | Members : 1234` — live member count (refreshes on every join/leave)
- `📅 | Thursday, Sep 17th` — current date in Asia/Dhaka time (changes every day)
- `👑 | Boosts : 7` — live boost count (refreshes instantly on new boosts)

They are created automatically on bot startup (and by `/ready` full setup). Renames
respect Discord's rate limit, so the counters never get stuck or throttled.

### Moderation & more
`/ban`, `/kick`, `/mute`, `/warn`, `/warnings`, `/poll`, `/remind`, plus music
(`/play`, `/skip`, `/queue`, `/stop`).
