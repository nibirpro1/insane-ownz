# Deploy Guide — Insane Ownz Bot + Dashboard

Everything (bot + dashboard) runs as **one app** on **one Railway service**. Follow these in order.

The included `ecosystem.config.cjs` also supports a VPS or always-on computer with PM2.

---

## 1. Create the bot on Discord

1. Go to https://discord.com/developers/applications → **New Application** → name it (e.g. "Insane Ownz").
2. Left sidebar → **Bot** → **Reset Token** → copy it. This is `DISCORD_TOKEN`. (Keep it secret — anyone with it controls your bot.)
3. Same **Bot** page → turn ON:
   - **Message Content Intent**
   - **Server Members Intent**
4. Left sidebar → **General Information** → copy **Application ID**. This is `CLIENT_ID`.
5. In Discord (desktop/web), turn on **Developer Mode**: User Settings → Advanced → Developer Mode.
6. Right-click your server icon → **Copy Server ID**. This is `GUILD_ID`.

---

## 2. Push the code to GitHub

1. Create a new repo at https://github.com/new (e.g. `insane-ownz`).
2. On your computer, inside the unzipped project folder:
   ```bash
   git init
   git add .
   git commit -m "Insane Ownz bot with dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/insane-ownz.git
   git push -u origin main
   ```

---

## 3. Create the Railway project

1. Go to https://railway.app → sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → pick your `insane-ownz` repo.
3. Railway will try to build immediately — that's fine, it'll fail until you add the database and variables below. Continue.

## 4. Add the database

1. In the same Railway project: **+ New** → **Database** → **Add PostgreSQL**.
2. Click the Postgres service → **Variables** tab → copy the value of `DATABASE_URL`.

## 5. Set environment variables

Click your **bot service** (not the database) → **Variables** tab → add:

| Variable | Value |
|---|---|
| `DISCORD_TOKEN` | from Step 1.2 |
| `CLIENT_ID` | from Step 1.4 |
| `GUILD_ID` | from Step 1.6 |
| `DATABASE_URL` | paste from Step 4.2, or use `${{Postgres.DATABASE_URL}}` so it stays linked automatically |
| `DASHBOARD_PASSWORD` | any strong password you choose — this locks your dashboard |
| `PORT` | `3000` |
| `MOD_LOG_CHANNEL_ID` | optional, a channel ID for mod logs |
| `TICKET_CATEGORY_ID` | optional, a category ID for tickets |

## 6. Deploy

1. Railway auto-redeploys when you save variables. Watch the **Deployments** tab.
2. On success, the logs should show the bot logging in and:
   ```
   📊 Dashboard API listening on port 3000
   ```
3. If it crashed, open the deploy logs — usually a missing/typo'd variable. Fix and it redeploys automatically.

> The `npm start` script runs `prisma migrate deploy` automatically before starting the bot, so your database tables are created on first deploy — you don't need to run migrations by hand.

## 7. Register slash commands (one-time)

Install the Railway CLI once on your computer:
```bash
npm i -g @railway/cli
railway login
railway link          # pick your project when prompted
railway run npm run deploy-commands
```
This registers `/setup`, `/ticketpanel`, `/play`, etc. with Discord. Re-run it only if you add or rename commands later.

## 8. Invite the bot to your server

Open this in a browser (replace `YOUR_CLIENT_ID`):
```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
```
Pick your server → Authorize.

Then in Discord, run:
```
/setup mod_log:#mod-log welcome:#welcome ticket_category:Tickets level_up:#level-up
```

## 9. Open the dashboard

1. Railway → your bot service → **Settings** → **Networking** → **Generate Domain**.
2. Open the generated URL (`https://your-app.up.railway.app`) in a browser.
3. Enter the `DASHBOARD_PASSWORD` you set in Step 5.
4. You'll see: activity log (who ran what command, when), the AutoMod feed, and stats.

## 10. Run 24/7 with PM2 (VPS or Windows machine)

Use this instead of Railway when you are running the bot on your own always-on machine:

```bash
npm install
npm run prisma:generate
npm run build
npx prisma migrate deploy
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Keep `.env` beside `package.json`, and never commit it. PM2 will restart the bot after a crash
and after the machine reboots once startup persistence is configured:

- Linux VPS: run `pm2 startup`, then run the command PM2 prints, followed by `pm2 save`.
- Windows: run `npm install -g pm2-windows-startup`, then `pm2-startup install`, followed by `pm2 save`.

On Windows, after `.env` is configured, the included launcher performs the setup in one step:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start-24-7.ps1
```

---

## Troubleshooting

- **"Application did not respond" on a slash command** → commands weren't registered — redo Step 7.
- **Dashboard shows "Server not found — check GUILD_ID"** → the bot isn't in that server, or `GUILD_ID` is wrong — recheck Step 1.6.
- **Bot online but dashboard 404s** → make sure `PORT` is set and matches what Railway expects (Railway sets its own `PORT` automatically in most cases — if that conflicts, remove your manual `PORT` variable and let Railway inject its own).
- **Deploy fails on `prisma migrate deploy`** → double check `DATABASE_URL` is exactly the Postgres service's connection string.
