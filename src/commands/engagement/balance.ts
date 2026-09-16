import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your coin balance"),

  async execute(interaction: ChatInputCommandInteraction) {
    const profile = await prisma.userProfile.findUnique({
      where: {
        guildId_userId: { guildId: interaction.guildId!, userId: interaction.user.id },
      },
    });

    await interaction.reply(`You have **${profile?.balance ?? 0}** coins.`);
  },
};

export default command;
