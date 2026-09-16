/**
 * Tiny in-memory runtime metrics for the dashboard "Live status" page.
 * Anything that can be read back from the database (last command, last
 * ticket, last automod action) is queried there instead of stored here.
 */
export const runtime = {
  /** When this process booted — used for uptime and "last restart". */
  bootedAt: new Date(),
  /** Last time the live leaderboard scheduler completed a tick. */
  lastLeaderboardTick: null as Date | null,
  /** Last time a live leaderboard message was actually edited/sent. */
  lastLeaderboardEdit: null as Date | null,
  /** Number of leaderboard edits skipped because nothing changed. */
  leaderboardSkippedEdits: 0,
};

export function markLeaderboardTick() {
  runtime.lastLeaderboardTick = new Date();
}

export function markLeaderboardEdit() {
  runtime.lastLeaderboardEdit = new Date();
}

export function markLeaderboardSkip() {
  runtime.leaderboardSkippedEdits += 1;
}
