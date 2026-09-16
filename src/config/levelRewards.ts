export interface LevelReward {
  level: number;
  coins: number;
  /** Role name in the server. Bot assigns it if it exists (and bot has perms). */
  roleName?: string;
  label?: string;
}

/**
 * Insane Ownz level rewards — max level 100.
 * Rewards unlock every 5 levels. Milestone levels (5/10/25/50/75/100)
 * also grant a role if a role with `roleName` exists in the server.
 */
export const MAX_LEVEL = 100;

export const levelRewards: LevelReward[] = [
  { level: 5, coins: 250, roleName: "Insane Ownz Rookie", label: "Rookie role + coins" },
  { level: 10, coins: 500, roleName: "Insane Ownz Active", label: "Active role + coins" },
  { level: 15, coins: 750 },
  { level: 20, coins: 1000 },
  { level: 25, coins: 1500, roleName: "Insane Ownz Regular", label: "Regular role + coins" },
  { level: 30, coins: 1750 },
  { level: 35, coins: 2000 },
  { level: 40, coins: 2250 },
  { level: 50, coins: 3000, roleName: "Insane Ownz Elite", label: "Elite role + coins" },
  { level: 60, coins: 3500 },
  { level: 70, coins: 4000 },
  { level: 75, coins: 5000, roleName: "Insane Ownz Legend", label: "Legend role + coins" },
  { level: 80, coins: 5500 },
  { level: 90, coins: 6500 },
  { level: 100, coins: 10000, roleName: "Insane Ownz Immortal", label: "Immortal role + coins" },
];

export function rewardForLevel(level: number): LevelReward | undefined {
  return levelRewards.find((r) => r.level === level);
}

export function nextReward(level: number): LevelReward | undefined {
  return levelRewards.find((r) => r.level > level);
}
