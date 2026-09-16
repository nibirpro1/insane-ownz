import { EmbedBuilder } from "discord.js";

/**
 * Insane Ownz brand system.
 * Neon-violet / cyan identity, matching the Vyntric Hub logo.
 */
export const BRAND = {
  name: "Insane Ownz",
  tagline: "Insane Ownz • Systems Online",
  colors: {
    primary: 0x7c5cff,
    accent: 0x22d3ee,
    success: 0x2dd4a7,
    warning: 0xfbbf24,
    danger: 0xf43f5e,
    neutral: 0x2b2d42,
  },
  divider: "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬",
} as const;

/**
 * Logo URL used in every embed (author icon + footer icon).
 * Set automatically on ready from the bot's own avatar, so uploading
 * assets/vyntric-logo.png as the bot avatar brands the whole bot.
 */
let brandIconUrl: string | undefined;

export function setBrandIcon(url?: string) {
  brandIconUrl = url;
}

export function getBrandIcon() {
  return brandIconUrl;
}

type Tone = keyof typeof BRAND.colors;

export function ownzEmbed(tone: Tone = "primary") {
  return new EmbedBuilder()
    .setColor(BRAND.colors[tone])
    .setAuthor({ name: BRAND.name, iconURL: brandIconUrl })
    .setFooter({ text: BRAND.tagline, iconURL: brandIconUrl })
    .setTimestamp();
}

export function section(title: string) {
  return `**${title}**\n${BRAND.divider}`;
}
