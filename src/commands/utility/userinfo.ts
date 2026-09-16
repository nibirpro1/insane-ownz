import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed, section } from "../../lib/brand";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a member")
    .addUserOption((o) => o.setName("user").setDescription("Member (default: you)")),

  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const member = interaction.options.getMember("user") as GuildMember | null
      ?? (interaction.member as GuildMember);

    const roles = member?.roles.cache
      .filter((r) => r.id !== interaction.guildId)
      .sort((a, b) => b.position - a.position)
      .map((r) => `${r}`)
      .slice(0, 10)
      .join(" ") || "None";

    await interaction.reply({
      embeds: [
        ownzEmbed("accent")
          .setTitle(`👤 ${user.username}`)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .setDescription(
            [
              section("Account"),
              `**ID:** \`${user.id}\``,
              `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
              ...(member?.joinedTimestamp
                ? [`**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`]
                : []),
              "",
              section("Roles"),
              roles,
            ].join("\n")
          ),
      ],
    });
  },
};

export default command;
