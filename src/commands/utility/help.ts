import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed, section } from "../../lib/brand";
import { InsaneOwnzClient } from "../../structures/InsaneOwnzClient";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all Insane Ownz commands"),

  async execute(interaction: ChatInputCommandInteraction, client: InsaneOwnzClient) {
    const names = [...client.commands.keys()].sort();

    const groups: Record<string, string[]> = {
      "🎫 Tickets": ["ticket", "ticketpanel"],
      "🛡️ Moderation": ["ban", "kick", "mute", "warn", "warnings", "clear", "slowmode", "lock", "lockchannel", "nick"],
      "🎉 Engagement": ["giveaway", "inviteevent", "rank", "leaderboard", "balance", "daily", "levelrewards"],
      "🎵 Music": ["play", "skip", "queue", "stop"],
      "🎮 Fun": ["8ball", "coinflip", "rps", "poll"],
      "⚙️ Utility": ["setup", "setuproles", "announce", "afk", "reactionrole", "userinfo", "serverinfo", "avatar", "ping", "remind", "help"],
    };

    const lines = Object.entries(groups).map(([label, cmds]) => {
      const available = cmds.filter((c) => names.includes(c));
      if (!available.length) return null;
      return `${label}\n${available.map((c) => `\`/${c}\``).join("  ")}`;
    }).filter(Boolean);

    await interaction.reply({
      embeds: [
        ownzEmbed("primary")
          .setTitle("⟢ Insane Ownz — All-in-One Server Bot")
          .setDescription(
            [
              `**${client.commands.size} commands** loaded and ready.`,
              "",
              section("Command Menu"),
              lines.join("\n\n"),
            ].join("\n")
          ),
      ],
      ephemeral: true,
    });
  },
};

export default command;
