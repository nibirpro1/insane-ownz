import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  TextChannel,
  GuildMember,
  PermissionFlagsBits,
} from "discord.js";
import { InsaneOwnzClient } from "../../structures/InsaneOwnzClient";
import { prisma } from "../../db/prisma";
import { findCategory } from "../../config/ticketCategories";
import { ownzEmbed, section } from "../../lib/brand";
import {
  buildTranscript,
  deliverTranscript,
  closedRow,
  createTicketChannel,
  isTicketStaff,
  logTicket,
  ticketControlRow,
} from "../../lib/tickets";

/** Department selected → open a modal asking for subject + details. */
export async function handleTicketSelect(interaction: StringSelectMenuInteraction) {
  const categoryId = interaction.values[0];
  const category = findCategory(categoryId);
  if (!category) {
    await interaction.reply({ content: "That department no longer exists.", ephemeral: true });
    return;
  }

  const existing = await prisma.ticket.findFirst({
    where: { guildId: interaction.guildId!, ownerId: interaction.user.id, status: "open" },
  });
  if (existing) {
    await interaction.reply({
      content: `You already have an open ticket: <#${existing.channelId}>`,
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket_modal_${categoryId}`)
    .setTitle(`${category.label} Ticket`)
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("subject")
          .setLabel("Subject")
          .setPlaceholder("Short summary of your issue")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(90)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("details")
          .setLabel("Details")
          .setPlaceholder("Explain what happened, include IGN / links if relevant")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

/** Modal submitted → create the ticket channel. */
export async function handleTicketModal(interaction: ModalSubmitInteraction) {
  const categoryId = interaction.customId.replace("ticket_modal_", "");
  const category = findCategory(categoryId);
  if (!category) return;

  await interaction.deferReply({ ephemeral: true });

  const { channel, number } = await createTicketChannel({
    guild: interaction.guild!,
    ownerId: interaction.user.id,
    ownerName: interaction.user.username,
    categoryId,
    subject: interaction.fields.getTextInputValue("subject"),
    details: interaction.fields.getTextInputValue("details"),
  });

  await interaction.editReply(`Ticket #${number} created: ${channel}`);

  await logTicket(
    interaction.guild!,
    [
      `**Ticket:** #${number} (${category.label})`,
      `**Owner:** <@${interaction.user.id}>`,
      `**Channel:** <#${channel.id}>`,
    ],
    "🎫 Ticket Opened"
  );
}

export async function handleTicketButton(
  interaction: ButtonInteraction,
  _client: InsaneOwnzClient
) {
  const { customId } = interaction;
  const member = interaction.member as GuildMember;
  const channel = interaction.channel as TextChannel;

  // Legacy panel buttons still work.
  if (customId.startsWith("ticket_open_")) {
    await interaction.reply({
      content: "Please use the department menu on the support panel.",
      ephemeral: true,
    });
    return;
  }

  const ticket = await prisma.ticket.findFirst({
    where: { channelId: interaction.channelId! },
  });
  if (!ticket) {
    await interaction.reply({ content: "This is not a ticket channel.", ephemeral: true });
    return;
  }

  const staff = await isTicketStaff(member);

  if (customId === "ticket_claim" || customId === "ticket_unclaim") {
    if (!staff) {
      await interaction.reply({ content: "Staff only.", ephemeral: true });
      return;
    }
    const claiming = customId === "ticket_claim";
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { claimedBy: claiming ? interaction.user.id : null },
    });

    await interaction.message.edit({ components: [ticketControlRow(claiming)] }).catch(() => {});
    await interaction.reply({
      embeds: [
        ownzEmbed(claiming ? "success" : "warning")
          .setTitle(claiming ? "🖐️ Ticket Claimed" : "↩️ Ticket Unclaimed")
          .setDescription(
            claiming
              ? `${interaction.user} is now handling this ticket.`
              : `${interaction.user} released this ticket. Another staff can claim it.`
          ),
      ],
    });
    return;
  }

  if (customId === "ticket_transcript") {
    if (!staff) {
      await interaction.reply({ content: "Staff only.", ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const { file, count, participants } = await deliverTranscript(
      channel,
      interaction.user.id
    );
    await interaction.editReply({
      embeds: [
        ownzEmbed("accent")
          .setTitle("📄 Transcript Ready")
          .setDescription(
            [
              `**Channel:** <#${channel.id}>`,
              `**Messages:** \`${count}\``,
              `**Participants:** \`${participants.length}\``,
              "",
              "A copy was also posted in the ticket log channel.",
            ].join("\n")
          ),
      ],
      files: [file],
    });
    return;
  }

  if (customId === "ticket_close") {
    const modal = new ModalBuilder()
      .setCustomId("ticket_close_modal")
      .setTitle("Close Ticket")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Reason (optional)")
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(400)
            .setRequired(false)
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (customId === "ticket_reopen") {
    if (!staff) {
      await interaction.reply({ content: "Staff only.", ephemeral: true });
      return;
    }
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "open", closedAt: null, closedBy: null, closeReason: null },
    });
    await channel.permissionOverwrites
      .edit(ticket.ownerId, { ViewChannel: true, SendMessages: true })
      .catch(() => {});
    await interaction.reply({
      embeds: [
        ownzEmbed("success")
          .setTitle("🔓 Ticket Reopened")
          .setDescription(`Reopened by ${interaction.user}.`),
      ],
    });
    return;
  }

  if (customId === "ticket_delete") {
    if (!staff) {
      await interaction.reply({ content: "Staff only.", ephemeral: true });
      return;
    }
    await interaction.reply({
      embeds: [
        ownzEmbed("danger")
          .setTitle("🗑️ Deleting Channel")
          .setDescription("This channel will be removed in 5 seconds."),
      ],
    });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
  }
}

/** Close modal submitted → archive the ticket. */
export async function handleTicketCloseModal(interaction: ModalSubmitInteraction) {
  const channel = interaction.channel as TextChannel;
  const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
  if (!ticket) return;

  await interaction.deferReply();

  const reason = interaction.fields.getTextInputValue("reason") || "No reason provided";

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      status: "closed",
      closedAt: new Date(),
      closedBy: interaction.user.id,
      closeReason: reason,
    },
  });

  const { file } = await buildTranscript(channel);

  await channel.permissionOverwrites
    .edit(ticket.ownerId, { SendMessages: false })
    .catch(() => {});

  await interaction.editReply({
    embeds: [
      ownzEmbed("danger")
        .setTitle(`🔒 Ticket #${ticket.number} Closed`)
        .setDescription(
          [
            `Closed by ${interaction.user}.`,
            "",
            section("Reason"),
            reason,
            "",
            "Staff can reopen, download the transcript, or delete this channel below.",
          ].join("\n")
        ),
    ],
    components: [closedRow()],
  });

  await logTicket(
    interaction.guild!,
    [
      `**Ticket:** #${ticket.number} (${ticket.category})`,
      `**Owner:** <@${ticket.ownerId}>`,
      `**Closed by:** <@${interaction.user.id}>`,
      `**Reason:** ${reason}`,
    ],
    "🔒 Ticket Closed",
    [file]
  );

  // Try DM the owner a copy.
  const owner = await interaction.guild!.members.fetch(ticket.ownerId).catch(() => null);
  await owner?.send({
    embeds: [
      ownzEmbed("neutral")
        .setTitle(`Your Insane Ownz ticket #${ticket.number} was closed`)
        .setDescription(`**Reason:** ${reason}`),
    ],
  }).catch(() => {});
}

export const TICKET_STAFF_PERM = PermissionFlagsBits.ManageMessages;
