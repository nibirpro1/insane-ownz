import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import { ownzEmbed, section } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("reactionrole")
    .setDescription("Manage reaction roles")
    .addSubcommand((s) =>
      s
        .setName("add")
        .setDescription("Bind a role to an emoji on a message")
        .addStringOption((o) => o.setName("message_id").setDescription("Message ID (in this channel)").setRequired(true))
        .addStringOption((o) => o.setName("emoji").setDescription("Emoji").setRequired(true))
        .addRoleOption((o) => o.setName("role").setDescription("Role to grant").setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName("remove")
        .setDescription("Remove a reaction role binding")
        .addStringOption((o) => o.setName("message_id").setDescription("Message ID").setRequired(true))
        .addStringOption((o) => o.setName("emoji").setDescription("Emoji").setRequired(true))
    )
    .addSubcommand((s) => s.setName("list").setDescription("List reaction role bindings"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const channel = interaction.channel as TextChannel;

    if (sub === "list") {
      const rows = await prisma.reactionRole.findMany({ where: { guildId } });
      await interaction.reply({
        embeds: [
          ownzEmbed("accent")
            .setTitle("🎭 Reaction Roles")
            .setDescription(
              rows.length
                ? section("Bindings") +
                    rows
                      .map((r) => `${r.emoji} → <@&${r.roleId}> • \`${r.messageId}\` in <#${r.channelId}>`)
                      .join("\n")
                : "No reaction roles configured."
            ),
        ],
        ephemeral: true,
      });
      return;
    }

    const messageId = interaction.options.getString("message_id", true);
    const emoji = interaction.options.getString("emoji", true);

    if (sub === "add") {
      const role = interaction.options.getRole("role", true);
      const message = await channel.messages.fetch(messageId).catch(() => null);
      if (!message) {
        await interaction.reply({ content: "Message not found in this channel.", ephemeral: true });
        return;
      }
      await message.react(emoji).catch(() => {});
      await prisma.reactionRole.upsert({
        where: { messageId_emoji: { messageId, emoji } },
        update: { roleId: role.id },
        create: { guildId, channelId: channel.id, messageId, emoji, roleId: role.id },
      });
      await interaction.reply({
        content: `Bound ${emoji} to ${role} on [this message](${message.url}).`,
        ephemeral: true,
      });
      return;
    }

    // remove
    await prisma.reactionRole.deleteMany({ where: { messageId, emoji } });
    await interaction.reply({ content: `Removed ${emoji} binding from that message.`, ephemeral: true });
  },
};

export default command;
