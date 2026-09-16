import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import { ownzEmbed, section } from "../../lib/brand";

const MEDALS = ["🥇", "🥈", "🥉"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inviteevent")
    .setDescription("Insane Ownz invite event tracking")
    .addSubcommand((s) =>
      s.setName("start").setDescription("Start a fresh invite event (resets the board)")
    )
    .addSubcommand((s) => s.setName("stop").setDescription("Stop the running invite event"))
    .addSubcommand((s) => s.setName("check").setDescription("Show status and leaderboard")),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub !== "check") {
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if (!isAdmin) {
        await interaction.reply({ content: "Manage Server required.", ephemeral: true });
        return;
      }
    }

    if (sub === "start") {
      await prisma.inviteRecord.deleteMany({ where: { guildId } });
      await prisma.inviteEvent.upsert({
        where: { guildId },
        update: { active: true, startedAt: new Date(), startedBy: interaction.user.id },
        create: {
          guildId,
          active: true,
          startedAt: new Date(),
          startedBy: interaction.user.id,
        },
      });

      await interaction.reply({
        embeds: [
          ownzEmbed("success")
            .setTitle("🎯 Invite Event Started")
            .setDescription(
              "The board has been reset. Every join from now on counts toward the event."
            ),
        ],
      });
      return;
    }

    if (sub === "stop") {
      await prisma.inviteEvent.upsert({
        where: { guildId },
        update: { active: false },
        create: { guildId, active: false },
      });

      await interaction.reply({
        embeds: [
          ownzEmbed("warning")
            .setTitle("🛑 Invite Event Stopped")
            .setDescription("New joins are no longer counted. The board is preserved."),
        ],
      });
      return;
    }

    const event = await prisma.inviteEvent.findUnique({ where: { guildId } });
    const counts = await prisma.inviteRecord.groupBy({
      by: ["inviterId"],
      where: { guildId },
      _count: { inviterId: true },
      orderBy: { _count: { inviterId: "desc" } },
      take: 10,
    });

    const board = counts.length
      ? counts
          .map(
            (c, i) =>
              `${MEDALS[i] ?? `\`#${i + 1}\``} <@${c.inviterId}> • **${c._count.inviterId}** invites`
          )
          .join("\n")
      : "No event invites recorded yet.";

    const embed = ownzEmbed(event?.active ? "accent" : "neutral")
      .setTitle("🎯 Insane Ownz Invite Event")
      .setDescription(
        [
          `**Status** • ${event?.active ? "🟢 RUNNING" : "🔴 STOPPED"}`,
          `**Started** • ${
            event?.startedAt ? `<t:${Math.floor(event.startedAt.getTime() / 1000)}:f>` : "Not started"
          }`,
          "",
          section("Leaderboard"),
          board,
        ].join("\n")
      )
      .addFields({
        name: "ℹ️ Scope",
        value: "Only joins recorded after the latest `/inviteevent start` are counted.",
      });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
