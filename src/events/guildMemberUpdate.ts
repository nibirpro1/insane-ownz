import { AttachmentBuilder, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { ownzEmbed } from "../lib/brand";
import { createWelcomeCard } from "../lib/welcomeCard";

export default {
  name: "guildMemberUpdate",
  once: false,
  async execute(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember | PartialGuildMember) {
    // Fire only when someone starts boosting.
    if (oldMember.premiumSinceTimestamp || !newMember.premiumSinceTimestamp) return;

    const guild = newMember.guild;
    const channel = guild.channels.cache.find((item) => item.name.endsWith("│announcements")) as
      | TextChannel
      | undefined;
    if (!channel) return;

    const boosts = guild.premiumSubscriptionCount ?? 0;
    const displayName = newMember.user?.displayName ?? "Someone";
    const card = await createWelcomeCard({
      variant: "boost",
      name: displayName,
      avatarUrl: newMember.user
        ? newMember.user.displayAvatarURL({ extension: "png", size: 256, forceStatic: true })
        : "",
      memberNumber: guild.memberCount,
      serverName: "Team Insane",
      boostCount: boosts,
    }).catch(() => null);

    const embed = ownzEmbed("primary")
      .setTitle(`⚡ ${displayName} just boosted the server!`)
      .setDescription(
        [
          `Massive thanks to ${newMember} for boosting **${guild.name}**! 💜`,
          "",
          `The server now has **${boosts}** boost${boosts === 1 ? "" : "s"} → **Level ${guild.premiumTier}**.`,
          "Boosters get legend status in the community. 🏆",
        ].join("\n")
      )
      .addFields(
        { name: "⚡ Boosts", value: `${boosts}`, inline: true },
        { name: "🏅 Server level", value: `Level ${guild.premiumTier}`, inline: true },
        { name: "👤 Booster", value: `${newMember}`, inline: true },
      );
    if (card) embed.setImage("attachment://boost.png");

    const files = card ? [new AttachmentBuilder(card, { name: "boost.png" })] : [];
    await channel.send({ embeds: [embed], files }).catch(() => {});
  },
};