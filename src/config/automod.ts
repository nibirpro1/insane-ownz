/**
 * Insane Ownz AutoMod configuration.
 * Edit these lists to fit your server. Staff (ManageMessages) are exempt.
 */
export const AUTOMOD = {
  enabled: true,
  // Delete messages containing Discord invites from other servers
  blockInvites: true,
  // Delete messages containing links (http/https)
  blockLinks: false,
  // Allowed link domains when blockLinks is on (e.g. ["youtube.com"])
  allowedDomains: [] as string[],
  // Messages with more mentions than this are deleted
  maxMentions: 5,
  // Blocked words/phrases (case-insensitive)
  blockedWords: [] as string[],

  // --- Anti-scam -------------------------------------------------------
  // Blocks common "free Nitro" phishing patterns (fake gift links, look-alike
  // domains). This is the #1 way members get their accounts stolen, and
  // spreading it violates Discord's Community Guidelines, so it's on by default.
  blockScamLinks: true,
  scamKeywords: ["free nitro", "steam gift", "discord-nitro", "discordgift", "nitro-gift"] as string[],
  scamDomainHints: ["dlscord", "discorcl", "disc0rd", "discrod", "steamcomrnunity", "stearncommunity"] as string[],

  // --- Anti-spam ---------------------------------------------------------
  // If a member posts more than `spamMessageLimit` messages within
  // `spamWindowMs`, the extra messages are removed and they're timed out.
  antiSpamEnabled: true,
  spamMessageLimit: 5,
  spamWindowMs: 6_000,
  spamMuteMinutes: 5,

  // Actions
  warnOnDelete: true,
  muteMinutesOnRepeat: 10,
};
