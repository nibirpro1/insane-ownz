import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure Insane Ownz bot channels for this server")
    .addChannelOption((opt) =>
      opt.setName("mod_log").setDescription("Channel for moderation logs")
    )
    .addChannelOption((opt) =>
      opt.setName("welcome").setDescription("Channel for welcome messages")
    )
    .addChannelOption((opt) =>
      opt.setName("ticket_category").setDescription("Category for support tickets")
    )
    .addChannelOption((opt) =>
      opt.setName("ticket_log").setDescription("Channel for ticket logs and transcripts")
    )
    .addRoleOption((opt) =>
      opt.setName("ticket_staff").setDescription("Role pinged and given access to tickets")
    )
    .addChannelOption((opt) =>
      opt.setName("level_up").setDescription("Channel for level-up announcements")
    )
    .addRoleOption((opt) =>
      opt.setName("auto_role").setDescription("Role automatically given to new members")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    const modLog = interaction.options.getChannel("mod_log");
    const welcome = interaction.options.getChannel("welcome");
    const ticketCategory = interaction.options.getChannel("ticket_category");
    const ticketLog = interaction.options.getChannel("ticket_log");
    const ticketStaff = interaction.options.getRole("ticket_staff");
    const levelUp = interaction.options.getChannel("level_up");
    const autoRole = interaction.options.getRole("auto_role");

    await prisma.guildConfig.upsert({
      where: { guildId: interaction.guildId! },
      update: {
        ...(modLog && { modLogChannelId: modLog.id }),
        ...(welcome && { welcomeChannelId: welcome.id }),
        ...(ticketCategory && { ticketCategoryId: ticketCategory.id }),
        ...(ticketLog && { ticketLogChannelId: ticketLog.id }),
        ...(ticketStaff && { ticketStaffRoleId: ticketStaff.id }),
        ...(levelUp && { levelUpChannelId: levelUp.id }),
        ...(autoRole && { autoRoleId: autoRole.id }),
      },
      create: {
        guildId: interaction.guildId!,
        modLogChannelId: modLog?.id,
        welcomeChannelId: welcome?.id,
        ticketCategoryId: ticketCategory?.id,
        ticketLogChannelId: ticketLog?.id,
        ticketStaffRoleId: ticketStaff?.id,
        levelUpChannelId: levelUp?.id,
        autoRoleId: autoRole?.id,
      },
    });

    await interaction.reply({ content: "Insane Ownz configuration updated.", ephemeral: true });
  },
};

export default command;
