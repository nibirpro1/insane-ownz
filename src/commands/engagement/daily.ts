import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";

const DAILY_AMOUNT = 100;
const COOLDOWN_HOURS = 24;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily coins"),

  async execute(interaction: ChatInputCommandInteraction) {
    const key = {
      guildId_userId: { guildId: interaction.guildId!, userId: interaction.user.id },
    };
    const profile = await prisma.userProfile.upsert({
      where: key,
      update: {},
      create: { guildId: interaction.guildId!, userId: interaction.user.id },
    });

    if (profile.lastDaily) {
      const hoursSince = (Date.now() - profile.lastDaily.getTime()) / 3_600_000;
      if (hoursSince < COOLDOWN_HOURS) {
        const hoursLeft = (COOLDOWN_HOURS - hoursSince).toFixed(1);
        return interaction.reply({
          content: `You've already claimed today. Try again in ${hoursLeft}h.`,
          ephemeral: true,
        });
      }
    }

    await prisma.userProfile.update({
      where: key,
      data: { balance: { increment: DAILY_AMOUNT }, lastDaily: new Date() },
    });

    await interaction.reply(`You claimed **${DAILY_AMOUNT}** coins! Come back tomorrow.`);
  },
};

export default command;
