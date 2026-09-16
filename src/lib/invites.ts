import { Collection, Guild } from "discord.js";

/** guildId -> (inviteCode -> uses) */
export const inviteCache = new Collection<string, Collection<string, number>>();

export async function cacheGuildInvites(guild: Guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(
      guild.id,
      new Collection(invites.map((i) => [i.code, i.uses ?? 0]))
    );
  } catch {
    /* missing Manage Server permission */
  }
}

/** Returns the user id of whoever's invite was just used, if detectable. */
export async function resolveInviter(guild: Guild): Promise<string | null> {
  const before = inviteCache.get(guild.id);
  let after: Collection<string, number>;
  let used: string | null = null;

  try {
    const invites = await guild.invites.fetch();
    after = new Collection(invites.map((i) => [i.code, i.uses ?? 0]));

    if (before) {
      for (const [code, uses] of after) {
        if (uses > (before.get(code) ?? 0)) {
          used = invites.get(code)?.inviter?.id ?? null;
          break;
        }
      }
    }

    inviteCache.set(guild.id, after);
  } catch {
    return null;
  }

  return used;
}
