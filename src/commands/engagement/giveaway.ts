import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import {
  endGiveaway,
  giveawayEmbed,
  giveawayRow,
  parseDuration,
} from "../../lib/giveaways";
import { ownzEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Run Insane Ownz giveaways")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a giveaway")
        .addStringOption((o) =>
          o.setName("prize").setDescription("What is being given away").setRequired(true)
        )
        .addStringOption((o) =>
          o
            .setName("duration")
            .setDescription("Duration, e.g. 30m, 6h, 2d")
            .setRequired(true)
        )
        .addIntegerOption((o) =>
          o.setName("winners").setDescription("Number of winners (default 1)").setMinValue(1)
        )
        .addIntegerOption((o) =>
          o
            .setName("required_invites")
            .setDescription("Event invites needed to be eligible")
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End a giveaway now")
        .addStringOption((o) =>
          o.setName("message_id").setDescription("Giveaway message id").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("reroll")
        .setDescription("Reroll a finished giveaway")
        .addStringOption((o) =>
          o.setName("message_id").setDescription("Giveaway message id").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction, client) {
    const sub = interaction.options.getSubcommand();

    if (sub === "start") {
      const prize = interaction.options.getString("prize", true);
      const durationRaw = interaction.options.getString("duration", true);
      const winnerCount = interaction.options.getInteger("winners") ?? 1;
      const requiredInvites = interaction.options.getInteger("required_invites") ?? 0;

      const ms = parseDuration(durationRaw);
      if (!ms) {
        await interaction.reply({
          content: "Duration must look like `30m`, `6h` or `2d`.",
          ephemeral: true,
        });
        return;
      }

      const endsAt = new Date(Date.now() + ms);
      const channel = interaction.channel as TextChannel;

      const message = await channel.send({
        embeds: [
          giveawayEmbed({
            prize,
            hostId: interaction.user.id,
            winnerCount,
            requiredInvites,
            endsAt,
            entries: 0,
          }),
        ],
        components: [giveawayRow()],
      });

      await prisma.giveaway.create({
        data: {
          guildId: interaction.guildId!,
          channelId: channel.id,
          messageId: message.id,
          hostId: interaction.user.id,
          prize,
          winnerCount,
          requiredInvites,
          endsAt,
        },
      });

      await interaction.reply({ content: "Giveaway started.", ephemeral: true });
      return;
    }

    const messageId = interaction.options.getString("message_id", true);
    const giveaway = await prisma.giveaway.findUnique({ where: { messageId } });
    if (!giveaway) {
      await interaction.reply({ content: "No giveaway with that message id.", ephemeral: true });
      return;
    }

    if (sub === "end") {
      await endGiveaway(client, giveaway.id);
      await interaction.reply({ content: "Giveaway ended.", ephemeral: true });
      return;
    }

    // reroll
    const entries = await prisma.giveawayEntry.findMany({
      where: { giveawayId: giveaway.id },
    });
    if (!entries.length) {
      await interaction.reply({ content: "No entries to reroll.", ephemeral: true });
      return;
    }
    const winner = entries[Math.floor(Math.random() * entries.length)];

    await interaction.reply({
      embeds: [
        ownzEmbed("success")
          .setTitle("🔁 Giveaway Reroll")
          .setDescription(`New winner • <@${winner.userId}> for **${giveaway.prize}**`),
      ],
    });
  },
};

export default command;
