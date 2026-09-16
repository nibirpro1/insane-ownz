interface AfkEntry {
  reason: string;
  since: number;
}

const afkMap = new Map<string, AfkEntry>();

export function setAfk(guildId: string, userId: string, reason: string) {
  afkMap.set(`${guildId}-${userId}`, { reason, since: Date.now() });
}

export function getAfk(guildId: string, userId: string) {
  return afkMap.get(`${guildId}-${userId}`);
}

export function clearAfk(guildId: string, userId: string) {
  return afkMap.delete(`${guildId}-${userId}`);
}
