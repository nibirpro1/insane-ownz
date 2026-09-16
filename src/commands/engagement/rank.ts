import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Check your (or someone else's) level and XP")
    .addUserOption((opt) => opt.setName("user").setDescription("User to check")),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user") ?? interaction.user;

    const profile = await prisma.userProfile.findUnique({
      where: {
        guildId_userId: { guildId: interaction.guildId!, userId: target.id },
      },
    });

    const embed = new EmbedBuilder()
      .setTitle(`${target.username}'s Rank`)
      .setColor(0x2ecc71)
      .addFields(
        { name: "Level", value: `${profile?.level ?? 1}`, inline: true },
        { name: "XP", value: `${profile?.xp ?? 0}`, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
