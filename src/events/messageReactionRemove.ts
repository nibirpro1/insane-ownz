import { MessageReaction, User, PartialMessageReaction, PartialUser } from "discord.js";
import { prisma } from "../db/prisma";

export default {
  name: "messageReactionRemove",
  once: false,
  async execute(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot || !reaction.message.guildId) return;
    if (reaction.partial) reaction = await reaction.fetch().catch(() => reaction);

    const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name!;
    const binding = await prisma.reactionRole.findUnique({
      where: { messageId_emoji: { messageId: reaction.message.id, emoji } },
    });
    if (!binding) return;

    const member = await reaction.message.guild?.members.fetch(user.id).catch(() => null);
    await member?.roles.remove(binding.roleId, "Insane Ownz reaction role removed").catch(() => {});
  },
};
