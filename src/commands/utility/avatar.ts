import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("Show a user's avatar")
    .addUserOption((o) => o.setName("user").setDescription("User (default: you)")),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const url = user.displayAvatarURL({ size: 1024 });

    await interaction.reply({
      embeds: [
        ownzEmbed("accent")
          .setTitle(`🖼️ ${user.username}'s Avatar`)
          .setImage(url)
          .setDescription(`[Open full size](${url})`),
      ],
    });
  },
};

export default command;
