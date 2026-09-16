import { ButtonStyle } from "discord.js";

export interface TicketCategory {
  id: string;
  label: string;
  emoji: string;
  style: ButtonStyle;
  blurb: string;
}

/** Insane Ownz support departments — customise freely. */
export const TICKET_CATEGORIES: TicketCategory[] = [
  {
    id: "lobby",
    label: "Lobby",
    emoji: "🏙️",
    style: ButtonStyle.Secondary,
    blurb: "Hub, roles and general server issues.",
  },
  {
    id: "survival",
    label: "Survival",
    emoji: "🌲",
    style: ButtonStyle.Secondary,
    blurb: "Survival world reports, rollbacks and claims.",
  },
  {
    id: "duels",
    label: "Duels",
    emoji: "⚔️",
    style: ButtonStyle.Secondary,
    blurb: "Match disputes, ranking and duel bugs.",
  },
  {
    id: "arcade",
    label: "Arcade",
    emoji: "🕹️",
    style: ButtonStyle.Secondary,
    blurb: "Minigame bugs and score issues.",
  },
  {
    id: "event",
    label: "Events",
    emoji: "🎯",
    style: ButtonStyle.Secondary,
    blurb: "Event entries, rewards and scheduling.",
  },
  {
    id: "giveaway",
    label: "Giveaway Claim",
    emoji: "🎁",
    style: ButtonStyle.Secondary,
    blurb: "Claim a prize you have won.",
  },
  {
    id: "support",
    label: "General Support",
    emoji: "💬",
    style: ButtonStyle.Primary,
    blurb: "Anything that does not fit another department.",
  },
  {
    id: "appeal",
    label: "Ban / Mute Appeal",
    emoji: "🛡️",
    style: ButtonStyle.Danger,
    blurb: "Appeal a punishment issued by staff.",
  },
];

export function findCategory(id: string) {
  return TICKET_CATEGORIES.find((c) => c.id === id);
}
