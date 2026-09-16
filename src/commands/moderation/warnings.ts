import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View a member's warning history")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("Member to check").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("user", true);
    const warnings = await prisma.warning.findMany({
      where: { guildId: interaction.guildId!, userId: target.id },
      orderBy: { createdAt: "desc" },
    });

    if (warnings.length === 0) {
      return interaction.reply(`${target.tag} has no warnings.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`Warnings for ${target.tag}`)
      .setColor(0xf5a623)
      .setDescription(
        warnings
          .slice(0, 10)
          .map((w, i) => `**${i + 1}.** ${w.reason} — <t:${Math.floor(w.createdAt.getTime() / 1000)}:R>`)
          .join("\n")
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
