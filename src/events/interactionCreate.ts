import {
  ActionRowBuilder,
  ButtonInteraction,
  Interaction,
  ModalBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { InsaneOwnzClient } from "../structures/InsaneOwnzClient";
import {
  handleTicketButton,
  handleTicketSelect,
  handleTicketModal,
  handleTicketCloseModal,
} from "../commands/tickets/ticketButtons";
import { prisma } from "../db/prisma";
import { giveawayEmbed, giveawayRow } from "../lib/giveaways";
import { ownzEmbed } from "../lib/brand";

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

async function handleMemberVerification(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const role = guild.roles.cache.find((item) => item.name.toLowerCase() === "verified");
  if (!role) {
    await interaction.reply({ content: "The Verified role is not configured yet. Ask staff to run `/ready`.", ephemeral: true });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id);
  if (member.roles.cache.has(role.id)) {
    await interaction.reply({ content: "You are already verified. Welcome to Team Insane!", ephemeral: true });
    return;
  }

  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (!botMember || botMember.roles.highest.comparePositionTo(role) <= 0) {
    await interaction.reply({ content: "Verification is temporarily unavailable. Staff must move the bot role above `Verified`.", ephemeral: true });
    return;
  }

  await member.roles.add(role, "Team Insane member verification");
  await interaction.reply({ content: "✅ Verified! Welcome to Team Insane.", ephemeral: true });
}

async function showMinecraftApplication(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("minecraft_application_modal")
    .setTitle("Team Insane Minecraft Application");

  const minecraftName = new TextInputBuilder()
    .setCustomId("minecraft_name")
    .setLabel("Minecraft username")
    .setPlaceholder("Your Java or Bedrock username")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(32);
  const edition = new TextInputBuilder()
    .setCustomId("minecraft_edition")
    .setLabel("Java or Bedrock?")
    .setPlaceholder("Java / Bedrock / Both")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(16);
  const country = new TextInputBuilder()
    .setCustomId("country")
    .setLabel("Country or timezone")
    .setPlaceholder("Bangladesh / UTC+6")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(40);
  const reason = new TextInputBuilder()
    .setCustomId("join_reason")
    .setLabel("Why do you want to join?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(minecraftName),
    new ActionRowBuilder<TextInputBuilder>().addComponents(edition),
    new ActionRowBuilder<TextInputBuilder>().addComponents(country),
    new ActionRowBuilder<TextInputBuilder>().addComponents(reason),
  );
  await interaction.showModal(modal);
}

async function handleMinecraftApplication(interaction: ModalSubmitInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const minecraftName = interaction.fields.getTextInputValue("minecraft_name");
  const edition = interaction.fields.getTextInputValue("minecraft_edition");
  const country = interaction.fields.getTextInputValue("country");
  const reason = interaction.fields.getTextInputValue("join_reason");
  const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
  const logChannel = config?.modLogChannelId ? guild.channels.cache.get(config.modLogChannelId) : null;
  const verifiedRole = guild.roles.cache.find((role) => role.name.toLowerCase() === "verified");
  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);

  if (verifiedRole && member && botMember && botMember.roles.highest.comparePositionTo(verifiedRole) > 0) {
    await member.roles.add(verifiedRole, "Minecraft application completed").catch(() => {});
  }

  if (logChannel?.isTextBased()) {
    await logChannel.send({
      embeds: [ownzEmbed("accent").setTitle("⛏️ Minecraft Application").setDescription([
        `**Member:** ${interaction.user} (\`${interaction.user.id}\`)`,
        `**Minecraft:** \`${minecraftName}\``,
        `**Edition:** \`${edition}\``,
        `**Country/Timezone:** \`${country}\``,
        `**Reason:** ${reason}`,
      ].join("\n"))],
    }).catch(() => {});
  }

  await interaction.reply({ content: "✅ Application submitted. Your Verified role has been updated.", ephemeral: true });
}

async function handleSelfRoleSelect(interaction: StringSelectMenuInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const groups: Record<string, string[]> = {
    self_roles_division: ["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh", "International"],
    self_roles_edition: ["Java Edition", "Bedrock Edition", "Both Edition"],
    self_roles_age: ["Age 13-17", "Age 18+"],
  };
  const group = groups[interaction.customId];
  const selectedName = interaction.values[0];
  const member = await guild.members.fetch(interaction.user.id);
  const selectedRole = guild.roles.cache.find((role) => role.name === selectedName);
  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (!selectedRole || !botMember || botMember.roles.highest.comparePositionTo(selectedRole) <= 0) {
    await interaction.reply({ content: "This role is not available yet. Please ask staff to move the bot role higher.", ephemeral: true });
    return;
  }

  for (const name of group) {
    const oldRole = guild.roles.cache.find((role) => role.name === name);
    if (oldRole && member.roles.cache.has(oldRole.id) && oldRole.id !== selectedRole.id) {
      await member.roles.remove(oldRole, "Updated self-role choice").catch(() => {});
    }
  }
  await member.roles.add(selectedRole, "Self-role selection");
  await interaction.reply({ content: `✅ Updated: **${selectedRole.name}**`, ephemeral: true });
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
        } else if (interaction.customId.startsWith("self_roles_")) {
          await handleSelfRoleSelect(interaction);
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        if (interaction.customId === "ticket_close_modal") {
          await handleTicketCloseModal(interaction);
        } else if (interaction.customId.startsWith("ticket_modal_")) {
          await handleTicketModal(interaction);
        } else if (interaction.customId === "minecraft_application_modal") {
          await handleMinecraftApplication(interaction);
        }
        return;
      }

      if (!interaction.isButton()) return;

      if (interaction.customId === "giveaway_enter") {
        await handleGiveawayEnter(interaction);
        return;
      }

      if (interaction.customId === "verify_member") {
        await handleMemberVerification(interaction);
        return;
      }

      if (interaction.customId === "minecraft_application") {
        await showMinecraftApplication(interaction);
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

