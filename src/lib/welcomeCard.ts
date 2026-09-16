import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import fs from "node:fs";
import path from "node:path";

/**
 * Premium Team Insane welcome card, drawn fully with @napi-rs/canvas so it
 * looks identical on Windows and on the Railway Linux container:
 *   - dark gradient background with violet/cyan brand glows
 *   - circular avatar with a cyan → violet gradient ring
 *   - auto-shrinking member name in Poppins
 *   - "member #N" line and a small brand footer
 * Shipped fonts live in assets/fonts so no system font is required.
 */

const WIDTH = 1200;
const HEIGHT = 400;

const fonts: { file: string; family: string }[] = [
  { file: "Poppins-ExtraBold.ttf", family: "InsaneBold" },
  { file: "Poppins-Medium.ttf", family: "InsaneMedium" },
];

let fontsRegistered = false;
function ensureFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;
  try {
    const dir = path.join(process.cwd(), "assets", "fonts");
    for (const font of fonts) {
      const file = path.join(dir, font.file);
      if (fs.existsSync(file)) GlobalFonts.registerFromPath(file, font.family);
    }
  } catch {
    // Fall back to whatever system font is available.
  }
}

function boldFont(size: number): string {
  return `${size}px InsaneBold, sans-serif`;
}

function mediumFont(size: number): string {
  return `${size}px InsaneMedium, sans-serif`;
}

/** Spaced caps title like "W E L C O M E   T O". */
function spaced(text: string): string {
  return text.split("").join(" ");
}

function drawBackground(ctx: SKRSContext2D): void {
  const base = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  base.addColorStop(0, "#0e0f1e");
  base.addColorStop(0.55, "#151029");
  base.addColorStop(1, "#0a1a25");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Violet glow — top left.
  const violet = ctx.createRadialGradient(190, 40, 20, 190, 40, 460);
  violet.addColorStop(0, "rgba(124, 92, 255, 0.55)");
  violet.addColorStop(1, "rgba(124, 92, 255, 0)");
  ctx.fillStyle = violet;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Cyan glow — bottom right.
  const cyan = ctx.createRadialGradient(1060, 400, 20, 1060, 400, 460);
  cyan.addColorStop(0, "rgba(34, 211, 238, 0.38)");
  cyan.addColorStop(1, "rgba(34, 211, 238, 0)");
  ctx.fillStyle = cyan;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Faint diagonal beams for depth.
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 46;
  for (let i = 0; i < 5; i++) {
    const offset = 950 + i * 120;
    ctx.beginPath();
    ctx.moveTo(offset, HEIGHT + 40);
    ctx.lineTo(offset + 260, -40);
    ctx.stroke();
  }
  ctx.restore();

  // Thin neon frame.
  ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, WIDTH - 3, HEIGHT - 3);
}

function drawRoundedRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadAvatar(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`avatar download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export interface WelcomeCardOptions {
  name: string;
  avatarUrl: string;
  memberNumber: number;
  serverName: string;
}

export async function createWelcomeCard(options: WelcomeCardOptions): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  drawBackground(ctx);

  // Avatar — circular crop + gradient ring.
  const cx = 132;
  const cy = HEIGHT / 2;
  const radius = 94;
  let drewAvatar = false;
  try {
    const avatar = await loadImage(await loadAvatar(options.avatarUrl));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();
    drewAvatar = true;
  } catch {
    // Default avatar could not load — draw a violet disc instead.
  }
  if (!drewAvatar) {
    const disc = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    disc.addColorStop(0, "#7c5cff");
    disc.addColorStop(1, "#22d3ee");
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const ring = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ring.addColorStop(0, "#22d3ee");
  ring.addColorStop(1, "#7c5cff");
  ctx.strokeStyle = ring;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.stroke();

  // Texts.
  const textX = cx + radius + 58;
  const maxWidth = WIDTH - textX - 56;

  ctx.fillStyle = "#22d3ee";
  ctx.font = mediumFont(26);
  ctx.fillText(spaced("WELCOME TO"), textX, 118);

  let nameSize = 74;
  do {
    ctx.font = boldFont(nameSize);
    nameSize -= 4;
  } while (ctx.measureText(options.name).width > maxWidth && nameSize > 30);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(options.name.slice(0, 32), textX, 212);

  ctx.fillStyle = "#a9b3d9";
  ctx.font = mediumFont(28);
  ctx.fillText(`You are member #${options.memberNumber} of ${options.serverName}`, textX, 268);

  ctx.fillStyle = "#6f7ba3";
  ctx.font = mediumFont(22);
  ctx.fillText("Team Insane • Enjoy the stay", textX, 316);

  // Small "new member" pill at the top right.
  ctx.font = mediumFont(20);
  const pillText = `+1 NEW MEMBER`;
  const pillWidth = ctx.measureText(pillText).width + 44;
  ctx.fillStyle = "rgba(124, 92, 255, 0.22)";
  drawRoundedRect(ctx, WIDTH - pillWidth - 34, 40, pillWidth, 44, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(124, 92, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#c9b8ff";
  ctx.fillText(pillText, WIDTH - pillWidth - 12, 69);

  return canvas.encode("png");
}
