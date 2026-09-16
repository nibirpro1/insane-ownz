import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { TICKET_CATEGORIES } from "../../config/ticketCategories";
import { ownzEmbed, section } from "../../lib/brand";
import { ticketPanelSelect } from "../../lib/tickets";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Post the Insane Ownz support panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = ownzEmbed("primary")
      .setTitle("⟢ Insane Ownz Support Desk")
      .setDescription(
        [
          "Pick the department that matches your issue, fill the short form, and Insane Ownz opens a private channel just for you.",
          "",
          section("How it works"),
          "`1` Choose a department in the menu below",
          "`2` Write a subject and a short description",
          "`3` A private ticket channel opens and staff gets pinged",
          "",
          "🔒 One open ticket per member. Everything stays private between you and staff.",
        ].join("\n")
      )
      .addFields(
        TICKET_CATEGORIES.slice(0, 6).map((c) => ({
          name: `${c.emoji} ${c.label}`,
          value: c.blurb,
          inline: true,
        }))
      );

    await interaction.reply({ embeds: [embed], components: [ticketPanelSelect()] });
  },
};

export default command;
