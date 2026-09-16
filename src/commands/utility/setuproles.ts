import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command } from "../../structures/Command";
import { ownzEmbed } from "../../lib/brand";
import { levelRewards } from "../../config/levelRewards";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setuproles")
    .setDescription("Create all Insane Ownz level reward roles in this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const wanted = levelRewards
      .filter((r) => r.roleName)
      .map((r) => ({ name: r.roleName!, level: r.level }));

    const created: string[] = [];
    const existed: string[] = [];
    const failed: string[] = [];

    for (const item of wanted) {
      const found = guild.roles.cache.find((r) => r.name === item.name);
      if (found) {
        existed.push(`${found} • Level ${item.level}`);
        continue;
      }
      const role = await guild.roles
        .create({ name: item.name, reason: "Insane Ownz level rewards" })
        .catch(() => null);
      if (role) created.push(`${role} • Level ${item.level}`);
      else failed.push(`${item.name} • Level ${item.level}`);
    }

    await interaction.editReply({
      embeds: [
        ownzEmbed(failed.length ? "warning" : "success")
          .setTitle("🎭 Insane Ownz Level Roles")
          .setDescription(
            [
              created.length ? `**Created**\n${created.join("\n")}` : null,
              existed.length ? `**Already existed**\n${existed.join("\n")}` : null,
              failed.length
                ? `**Failed** (check bot permissions / role position)\n${failed.join("\n")}`
                : null,
            ]
              .filter(Boolean)
              .join("\n\n")
          ),
      ],
    });
  },
};

export default command;
