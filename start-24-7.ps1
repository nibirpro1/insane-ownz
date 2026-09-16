$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Write-Error "Missing .env. Copy .env.example to .env and fill in the Discord token, IDs, database URL, and dashboard password."
}

$required = @("DISCORD_TOKEN", "CLIENT_ID", "GUILD_ID", "DATABASE_URL", "DASHBOARD_PASSWORD")
$envText = Get-Content ".env" -Raw
$missing = $required | Where-Object {
    $pattern = "(?m)^\s*{0}\s*=\s*(?!your_|choose_|$)" -f [regex]::Escape($_)
    $envText -notmatch $pattern
}

if ($missing.Count -gt 0) {
    Write-Error ("Missing or placeholder environment values: " + ($missing -join ", "))
}

npm run prisma:generate
npm run build
npx prisma migrate deploy
npx pm2 startOrRestart ecosystem.config.cjs --update-env
npx pm2 save
npx pm2 status