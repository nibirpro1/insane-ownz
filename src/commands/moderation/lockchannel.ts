import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { prisma } from "../../db/prisma";
import { ownzEmbed, section } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("lockchannel")
    .setDescription("Mark this channel as restricted (auto-delete + auto-mute)")
    .addBooleanOption((opt) =>
      opt.setName("enabled").setDescription("Turn restriction on or off").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("mute_minutes")
        .setDescription("Timeout length applied to offenders (default 10)")
        .setMinValue(1)
        .setMaxValue(10080)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction: ChatInputCommandInteraction) {
    const enabled = interaction.options.getBoolean("enabled", true);
    const muteMinutes = interaction.options.getInteger("mute_minutes") ?? 10;

    if (!enabled) {
      await prisma.restrictedChannel.deleteMany({
        where: { channelId: interaction.channelId },
      });
      await interaction.reply({
        embeds: [
          ownzEmbed("success")
            .setTitle("🔓 Restriction Removed")
            .setDescription("Members can post in this channel again."),
        ],
      });
      return;
    }

    await prisma.restrictedChannel.upsert({
      where: { channelId: interaction.channelId },
      update: { muteMinutes },
      create: {
        channelId: interaction.channelId,
        guildId: interaction.guildId!,
        muteMinutes,
      },
    });

    const embed = ownzEmbed("danger")
      .setTitle("⛔ Restricted Channel • নিষিদ্ধ চ্যানেল")
      .setDescription(
        [
          section("English"),
          "Do **not** send messages, attachments, stickers or any other content here. Anything posted is deleted instantly and the sender receives a temporary mute.",
          "",
          section("বাংলা"),
          "এই চ্যানেলে **কোনো মেসেজ, ছবি, ফাইল, স্টিকার বা অন্য কোনো কনটেন্ট পাঠাবেন না।** এখানে কিছু পাঠালে সেটি সঙ্গে সঙ্গে মুছে ফেলা হবে এবং প্রেরককে সাময়িক মিউট দেওয়া হবে।",
        ].join("\n")
      )
      .addFields(
        {
          name: "⚠️ Automatic punishment",
          value: `Content deleted + ${muteMinutes} minute timeout`,
        },
        {
          name: "⚠️ স্বয়ংক্রিয় শাস্তি",
          value: `কনটেন্ট মুছে ফেলা + ${muteMinutes} মিনিটের টাইমআউট`,
        },
        {
          name: "\u200b",
          value: "This rule applies to everyone. • এই নিয়ম সবার জন্য প্রযোজ্য।",
        }
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
