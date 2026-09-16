import { ButtonInteraction, Interaction } from "discord.js";
import { InsaneOwnzClient } from "../structures/InsaneOwnzClient";
import {
  handleTicketButton,
  handleTicketSelect,
  handleTicketModal,
  handleTicketCloseModal,
} from "../commands/tickets/ticketButtons";
import { prisma } from "../db/prisma";
import { giveawayEmbed, giveawayRow } from "../lib/giveaways";

async function handleGiveawayEnter(interaction: ButtonInteraction) {
  const giveaway = await prisma.giveaway.findUnique({
    where: { messageId: interaction.message.id },
  });
  if (!giveaway || giveaway.ended) {
    await interaction.reply({ content: "This giveaway is over.", ephemeral: true });
    return;
  }

  const existing = await prisma.giveawayEntry.findUnique({
    where: { giveawayId_userId: { giveawayId: giveaway.id, userId: interaction.user.id } },
  });

  if (existing) {
    await prisma.giveawayEntry.delete({ where: { id: existing.id } });
  } else {
    await prisma.giveawayEntry.create({
      data: { giveawayId: giveaway.id, userId: interaction.user.id },
    });
  }

  const entries = await prisma.giveawayEntry.count({ where: { giveawayId: giveaway.id } });

  await interaction.update({
    embeds: [
      giveawayEmbed({
        prize: giveaway.prize,
        hostId: giveaway.hostId,
        winnerCount: giveaway.winnerCount,
        requiredInvites: giveaway.requiredInvites,
        endsAt: giveaway.endsAt,
        entries,
      }),
    ],
    components: [giveawayRow(false, entries)],
  });

  await interaction.followUp({
    content: existing ? "Your entry was removed." : "You're in! Good luck.",
    ephemeral: true,
  });
}

async function safeError(interaction: Interaction) {
  if (!interaction.isRepliable()) return;
  const payload = { content: "Something went wrong. Please try again.", ephemeral: true } as const;
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    /* interaction expired or already acknowledged */
  }
}

export default {
  name: "interactionCreate",
  once: false,
  async execute(interaction: Interaction, client: InsaneOwnzClient) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      let success = true;
      try {
        await command.execute(interaction, client);
      } catch (err) {
        success = false;
        console.error(`[command:${interaction.commandName}]`, err);
        await safeError(interaction);
      }

      await prisma.commandLog
        .create({
          data: {
            guildId: interaction.guildId ?? "DM",
            userId: interaction.user.id,
            username: interaction.user.username,
            commandName: interaction.commandName,
            channelId: interaction.channelId ?? undefined,
            success,
          },
        })
        .catch(() => {});
      return;
    }

    try {
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === "ticket_select") {
          await handleTicketSelect(interaction);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === "ticket_close_modal") {
          await handleTicketCloseModal(interaction);
        } else if (interaction.customId.startsWith("ticket_modal_")) {
          await handleTicketModal(interaction);
        }
        return;
      }

      if (!interaction.isButton()) return;

      if (interaction.customId === "giveaway_enter") {
        await handleGiveawayEnter(interaction);
        return;
      }

      if (interaction.customId.startsWith("ticket_")) {
        await handleTicketButton(interaction, client);
      }
    } catch (err) {
      console.error("[interaction]", err);
      await safeError(interaction);
    }
  },
};

