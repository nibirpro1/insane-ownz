import {
  CategoryChannel,
  ChannelType,
  Client,
  Events,
  Guild,
  PermissionFlagsBits,
  VoiceBasedChannel,
} from "discord.js";

/**
 * Live server stats channels (like the big servers use):
 *   ⭐ | Members : 11037   → locked voice channel, name shows the live member count
 *   📅 | Wednesday, Sep 16th → locked voice channel, name shows the current date
 *
 * The channels are renamed instead of messaged, so they always sit at the top
 * of the server and stay readable without any bot messages.
 */

const STATS_CATEGORY_NAME = "✦ SERVER STATS";
const MEMBERS_PREFIX = "⭐ | Members :";
const DATE_PREFIX = "📅 |";
const BOOSTS_PREFIX = "👑 | Boosts :";

// Discord only allows ~2 channel name changes per 10 minutes per channel.
// This cooldown keeps every rename inside that limit — quick join/leave bursts
// are simply skipped and picked up by the next scheduler tick.
const RENAME_COOLDOWN_MS = 5.5 * 60 * 1000;
const lastRenameAt = new Map<string, number>();

function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}

export function formatMembersName(memberCount: number): string {
  return `${MEMBERS_PREFIX} ${memberCount}`;
}

export function formatBoostsName(boostCount: number): string {
  return `${BOOSTS_PREFIX} ${boostCount}`;
}

/** Example: "📅 | Wednesday, Sep 16th" (Asia/Dhaka time). */
export function formatDateName(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dhaka",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${DATE_PREFIX} ${get("weekday")}, ${get("month")} ${ordinalSuffix(Number(get("day")))}`;
}

function findStatsChannels(guild: Guild) {
  const members = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildVoice && channel.name.startsWith(MEMBERS_PREFIX)
  ) as VoiceBasedChannel | undefined;
  const date = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildVoice && channel.name.startsWith(DATE_PREFIX)
  ) as VoiceBasedChannel | undefined;
  const boost = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildVoice && channel.name.startsWith(BOOSTS_PREFIX)
  ) as VoiceBasedChannel | undefined;
  return { members, date, boost };
}

/**
 * Finds the stats channels, creating any that are missing (category + the two
 * locked voice channels). Safe to call repeatedly — fully idempotent.
 */
export async function ensureStatsChannels(
  guild: Guild,
  categoryId?: string
): Promise<{
  members: VoiceBasedChannel | null;
  date: VoiceBasedChannel | null;
  boost: VoiceBasedChannel | null;
  createdAny: boolean;
}> {
  const existing = findStatsChannels(guild);
  let members = existing.members ?? null;
  let date = existing.date ?? null;
  let boost = existing.boost ?? null;
  let createdAny = false;

  let parent: CategoryChannel | null = categoryId
    ? (guild.channels.cache.get(categoryId) as CategoryChannel | undefined) ?? null
    : (guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildCategory && channel.name === STATS_CATEGORY_NAME
      ) as CategoryChannel | undefined) ?? null;
  if (!parent) {
    parent = await guild.channels
      .create({ name: STATS_CATEGORY_NAME, type: ChannelType.GuildCategory, reason: "Team Insane live stats" })
      .catch(() => null);
    if (parent) {
      createdAny = true;
      await parent.setPosition(0).catch(() => {});
    }
  }

  const lockedOverwrites = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect] }];
  if (!members) {
    members = await guild.channels
      .create({
        name: formatMembersName(guild.memberCount ?? 0),
        type: ChannelType.GuildVoice,
        parent: parent?.id,
        permissionOverwrites: lockedOverwrites,
        reason: "Team Insane live stats",
      })
      .catch(() => null);
    if (members) createdAny = true;
  }
  if (!date) {
    date = await guild.channels
      .create({
        name: formatDateName(),
        type: ChannelType.GuildVoice,
        parent: parent?.id,
        permissionOverwrites: lockedOverwrites,
        reason: "Team Insane live stats",
      })
      .catch(() => null);
    if (date) createdAny = true;
  }
  if (!boost) {
    boost = await guild.channels
      .create({
        name: formatBoostsName(guild.premiumSubscriptionCount ?? 0),
        type: ChannelType.GuildVoice,
        parent: parent?.id,
        permissionOverwrites: lockedOverwrites,
        reason: "Team Insane live stats",
      })
      .catch(() => null);
    if (boost) createdAny = true;
  }

  return { members, date, boost, createdAny };
}

async function renameWithinLimit(channel: VoiceBasedChannel, desired: string, force = false): Promise<void> {
  if (channel.name === desired) return;
  const now = Date.now();
  if (!force && now - (lastRenameAt.get(channel.id) ?? 0) < RENAME_COOLDOWN_MS) return;
  lastRenameAt.set(channel.id, now);
  await channel.setName(desired, "Team Insane live stats").catch(() => {});
}

/** Updates all stats channel names for a guild (respecting the rename cooldown). */
export async function refreshStats(guild: Guild, force = false): Promise<void> {
  const { members, date, boost } = findStatsChannels(guild);
  if (members) await renameWithinLimit(members, formatMembersName(guild.memberCount ?? 0), force);
  if (date) await renameWithinLimit(date, formatDateName(), force);
  if (boost) await renameWithinLimit(boost, formatBoostsName(guild.premiumSubscriptionCount ?? 0), force);
}

/**
 * Keeps the stats channels live for every guild the bot is in:
 * - creates them when missing (even without running /ready),
 * - refreshes on a schedule and instantly on member join/leave.
 */
export function startServerStatsScheduler(client: Client): void {
  const refreshAll = async () => {
    for (const guild of client.guilds.cache.values()) {
      await ensureStatsChannels(guild);
      await refreshStats(guild);
    }
  };

  // Small delay so the gateway caches are fully populated after login.
  setTimeout(() => void refreshAll(), 15 * 1000);
  setInterval(() => void refreshAll(), RENAME_COOLDOWN_MS);

  // React instantly to member joins/leaves; the cooldown guard inside
  // refreshStats keeps us within Discord's rename rate limits.
  client.on(Events.GuildMemberAdd, (member) => void refreshStats(member.guild));
  client.on(Events.GuildMemberRemove, (member) => void refreshStats(member.guild));

  // A new boost → refresh the boosts counter instantly.
  client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
    if ((oldGuild.premiumSubscriptionCount ?? 0) !== (newGuild.premiumSubscriptionCount ?? 0)) {
      void refreshStats(newGuild);
    }
  });
}
