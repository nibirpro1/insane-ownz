import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";
import { levelRewards, MAX_LEVEL } from "../../config/levelRewards";
import { prisma } from "../../db/prisma";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("levelrewards")
    .setDescription("View all Insane Ownz level rewards (max level 100)"),

  async execute(interaction: ChatInputCommandInteraction) {
    const profile = await prisma.userProfile.findUnique({
      where: {
        guildId_userId: {
          guildId: interaction.guildId!,
          userId: interaction.user.id,
        },
      },
    });
    const currentLevel = profile?.level ?? 1;

    const lines = levelRewards.map((r) => {
      const unlocked = currentLevel >= r.level;
      const rolePart = r.roleName ? ` + \`@${r.roleName}\`` : "";
      return `${unlocked ? "✅" : "🔒"} **Level ${r.level}** — \`${r.coins}\` coins${rolePart}`;
    });

    const embed = ownzEmbed("primary")
      .setTitle("🏆 Insane Ownz Level Rewards")
      .setDescription(
        [
          `Your level: **${currentLevel}** / ${MAX_LEVEL}`,
          "",
          ...lines,
          "",
          `Level up by chatting — rewards are given automatically!`,
        ].join("\n")
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
