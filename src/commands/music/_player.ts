import {
  AudioPlayer,
  AudioPlayerStatus,
  VoiceConnection,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import play from "play-dl";

interface GuildQueue {
  connection: VoiceConnection;
  player: AudioPlayer;
  songs: { title: string; url: string }[];
  playing: boolean;
}

const queues = new Map<string, GuildQueue>();

export function getQueue(guildId: string) {
  return queues.get(guildId);
}

export async function playSong(
  guildId: string,
  voiceChannel: any,
  song: { title: string; url: string }
) {
  let queue = queues.get(guildId);

  if (!queue) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

    const player = createAudioPlayer();
    connection.subscribe(player);

    queue = { connection, player, songs: [], playing: false };
    queues.set(guildId, queue);

    player.on(AudioPlayerStatus.Idle, () => {
      queue!.songs.shift();
      if (queue!.songs.length > 0) {
        playNext(guildId);
      } else {
        queue!.connection.destroy();
        queues.delete(guildId);
      }
    });
  }

  queue.songs.push(song);
  if (!queue.playing) {
    playNext(guildId);
  }
}

async function playNext(guildId: string) {
  const queue = queues.get(guildId);
  if (!queue || queue.songs.length === 0) return;

  queue.playing = true;
  const stream = await play.stream(queue.songs[0].url);
  const resource = createAudioResource(stream.stream, { inputType: stream.type });
  queue.player.play(resource);
}

export function skipSong(guildId: string) {
  const queue = queues.get(guildId);
  queue?.player.stop();
}

export function stopQueue(guildId: string) {
  const queue = queues.get(guildId);
  if (!queue) return;
  queue.songs = [];
  queue.connection.destroy();
  queues.delete(guildId);
}
