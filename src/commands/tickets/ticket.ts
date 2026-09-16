import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  TextChannel,
  GuildMember,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import { ownzEmbed, section } from "../../lib/brand";
import {
  PRIORITIES,
  PRIORITY_META,
  Priority,
  buildTranscript,
  deliverTranscript,
  isTicketStaff,
} from "../../lib/tickets";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the current Insane Ownz ticket")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Add a member to this ticket")
        .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a member from this ticket")
        .addUserOption((o) => o.setName("user").setDescription("Member").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("rename")
        .setDescription("Rename this ticket channel")
        .addStringOption((o) => o.setName("name").setDescription("New name").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("priority")
        .setDescription("Set ticket priority")
        .addStringOption((o) =>
          o
            .setName("level")
            .setDescription("Priority level")
            .setRequired(true)
            .addChoices(
              ...PRIORITIES.map((p) => ({ name: PRIORITY_META[p].label, value: p }))
            )
        )
    )
    .addSubcommand((s) => s.setName("transcript").setDescription("Download the transcript"))
    .addSubcommand((s) => s.setName("info").setDescription("Show ticket information")),

  async execute(interaction: ChatInputCommandInteraction) {
    const channel = interaction.channel as TextChannel;
    const ticket = await prisma.ticket.findFirst({ where: { channelId: channel.id } });
    if (!ticket) {
      await interaction.reply({ content: "This is not a ticket channel.", ephemeral: true });
      return;
    }

    const staff = await isTicketStaff(interaction.member as GuildMember);
    const sub = interaction.options.getSubcommand();

    if (sub === "info") {
      const meta = PRIORITY_META[(ticket.priority as Priority) ?? "normal"];
      await interaction.reply({
        embeds: [
          ownzEmbed("accent")
            .setTitle(`🎫 Ticket #${ticket.number}`)
            .setDescription(
              [
                section("Overview"),
                `**Department:** ${ticket.category}`,
                `**Owner:** <@${ticket.ownerId}>`,
                `**Subject:** ${ticket.subject ?? "—"}`,
                `**Priority:** ${meta.emoji} ${meta.label}`,
                `**Status:** ${ticket.status === "open" ? "🟢 Open" : "🔒 Closed"}`,
                `**Claimed by:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Nobody yet"}`,
                `**Opened:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>`,
              ].join("\n")
            ),
        ],
      });
      return;
    }

    if (!staff) {
      await interaction.reply({ content: "Staff only.", ephemeral: true });
      return;
    }

    if (sub === "add" || sub === "remove") {
      const user = interaction.options.getUser("user", true);
      const adding = sub === "add";
      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: adding,
        SendMessages: adding,
        ReadMessageHistory: adding,
      });
      await interaction.reply({
        embeds: [
          ownzEmbed(adding ? "success" : "warning")
            .setTitle(adding ? "➕ Member Added" : "➖ Member Removed")
            .setDescription(`${user} ${adding ? "can now see" : "no longer has access to"} this ticket.`),
        ],
      });
      return;
    }

    if (sub === "rename") {
      const name = interaction.options.getString("name", true);
      await channel.setName(name.slice(0, 90));
      await interaction.reply({ content: `Renamed to **${name}**.` });
      return;
    }

    if (sub === "priority") {
      const level = interaction.options.getString("level", true) as Priority;
      await prisma.ticket.update({ where: { id: ticket.id }, data: { priority: level } });
      const meta = PRIORITY_META[level];
      await interaction.reply({
        embeds: [
          ownzEmbed("warning")
            .setTitle("⚙️ Priority Updated")
            .setDescription(`This ticket is now **${meta.emoji} ${meta.label}** priority.`),
        ],
      });
      return;
    }

    if (sub === "transcript") {
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
    }
  },
};

export default command;
