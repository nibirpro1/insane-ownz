import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from "discord.js";
import play from "play-dl";
import { Command } from "../../structures/Command";
import { playSong } from "./_player";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song in your voice channel")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("Song name or YouTube URL").setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: "Join a voice channel first.",
        ephemeral: true,
      });
    }

    const query = interaction.options.getString("query", true);
    await interaction.deferReply();

    const searchResult = play.yt_validate(query) === "video"
      ? { url: query, title: query }
      : (await play.search(query, { limit: 1 }))[0];

    if (!searchResult) {
      return interaction.editReply("No results found.");
    }

    await playSong(interaction.guildId!, voiceChannel, {
      title: (searchResult as any).title ?? query,
      url: (searchResult as any).url,
    });

    await interaction.editReply(`Queued: **${(searchResult as any).title ?? query}**`);
  },
};

export default command;
