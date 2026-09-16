import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "../../db/prisma";

export async function logModAction(
  interaction: ChatInputCommandInteraction,
  action: string,
  targetId: string,
  reason: string
) {
  const config = await prisma.guildConfig.findUnique({
    where: { guildId: interaction.guildId! },
  });
  if (!config?.modLogChannelId) return;

  const channel = interaction.guild?.channels.cache.get(
    config.modLogChannelId
  ) as TextChannel;
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(`Mod Action: ${action}`)
    .setColor(0xe74c3c)
    .addFields(
      { name: "Target", value: `<@${targetId}>`, inline: true },
      { name: "Moderator", value: `${interaction.user}`, inline: true },
      { name: "Reason", value: reason }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}
