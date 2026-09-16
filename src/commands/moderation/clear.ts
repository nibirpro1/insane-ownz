import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
} from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Bulk delete messages in this channel")
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("1–100 messages").setRequired(true)
    )
    .addUserOption((o) =>
      o.setName("user").setDescription("Only delete this user's messages")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction: ChatInputCommandInteraction) {
    const amount = interaction.options.getInteger("amount", true);
    const target = interaction.options.getUser("user");
    const channel = interaction.channel as TextChannel;

    if (amount < 1 || amount > 100) {
      await interaction.reply({ content: "Amount must be between 1 and 100.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    let deleted = 0;
    if (target) {
      const fetched = await channel.messages.fetch({ limit: 100 });
      const filtered = fetched.filter((m) => m.author.id === target.id).first(amount);
      for (const msg of filtered) {
        await msg.delete().catch(() => {});
        deleted++;
      }
    } else {
      const res = await channel.bulkDelete(amount, true).catch(() => null);
      deleted = res?.size ?? 0;
    }

    await interaction.editReply({
      embeds: [
        ownzEmbed("success")
          .setTitle("🧹 Messages Cleared")
          .setDescription(
            `Deleted **${deleted}** message(s)${target ? ` from ${target}` : ""} in ${channel}.`
          ),
      ],
    });
  },
};

export default command;
