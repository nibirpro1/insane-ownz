import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextChannel,
} from "discord.js";
import { prisma } from "../../db/prisma";
import { Command } from "../../structures/Command";
import { levelRewards } from "../../config/levelRewards";
import { ownzEmbed, section } from "../../lib/brand";
import { ticketPanelSelect } from "../../lib/tickets";
import { TICKET_CATEGORIES } from "../../config/ticketCategories";
import { buildSelfRolePanel } from "../../lib/serverInfo";
import { ensureStatsChannels, refreshStats } from "../../lib/serverStats";

const managedCategories = [
  "✦ INFO CENTER", "✦ COMMUNITY", "✦ SUPPORT CENTER", "✦ STAFF HQ", "✦ EVENTS & FUN", "✦ PUBLIC VOICE", "✦ PRIVATE VOICE",
  "Insane Ownz Hub", "Insane Ownz Tickets", "Welcome", "chat", "support", "mod log", "testing",
];
const managedChannels = [
  "👋│welcome", "📜│rules", "📢│announcements", "🌐│server-info", "🎭│roles", "💬│general", "👋│introductions", "🎨│media",
  "💡│suggestions", "📊│polls", "⚡│level-up", "🎫│ticket-support", "📁│ticket-logs", "❓│help-forum", "🛡️│mod-logs",
  "staff-chat", "staff-logs", "giveaways", "invite-event", "leaderboard", "command-bot", "chatting",
  "level", "ticket-log", "ticket_staff", "mod-log", "general-chat", "fun-chat", "media-chat", "ticket", "📊│dashboard", "📚│command-guide",
  "interface", "join-to-create",
];
const managedVoice = ["🔊│public-voice", "🎥│live-voice", "🎵│music-voice", "🔒│team-voice", "🔒│team-voice-2", "🔒│team-voice-3"];
const managedRoles = [
  "Team Insane", "Insane Ownz Member", "Insane Ownz Staff", "Insane Moderator", "Event Manager", "Ticket Staff", "Verified",
  "Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh", "International",
  "Java Edition", "Bedrock Edition", "Both Edition", "Age 13-17", "Age 18+",
  ...levelRewards.flatMap((reward) => reward.roleName ? [reward.roleName] : []),
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ready")
    .setDescription("Build the complete Team Insane server setup")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild) return interaction.editReply("This command can only be used in a server.");

    const created: string[] = [];
    const failed: string[] = [];
    const currentId = interaction.channelId;
    const currentParentId = guild.channels.cache.get(currentId)?.parentId;
    for (const channel of guild.channels.cache.values()) {
      if (channel.id === currentId) continue;
      if (channel.id === currentParentId) continue;
      await channel.delete("Team Insane fresh setup: remove old server layout").catch(() => {});
    }
    for (const role of guild.roles.cache.values()) {
      if (role.editable && role.id !== guild.id) await role.delete("Team Insane fresh setup: remove old roles").catch(() => {});
    }

    const makeRole = async (name: string, color: number) => {
      const result = await guild.roles.create({ name, color, reason: "Team Insane full setup" }).catch(() => null);
      if (result) created.push(`@${name}`); else failed.push(`@${name}`);
      return result;
    };
    const teamRole = await makeRole("Team Insane", 0x22d3ee);
    const staffRole = await makeRole("Insane Ownz Staff", 0x7c5cff);
    const moderatorRole = await makeRole("Insane Moderator", 0xef4444);
    const eventRole = await makeRole("Event Manager", 0xf59e0b);
    const ticketStaffRole = await makeRole("Ticket Staff", 0x22c55e);
    const memberRole = await makeRole("Verified", 0x22d3ee);
    const divisionRoles = await Promise.all([
      ["Dhaka", 0x3b82f6], ["Chattogram", 0x22c55e], ["Rajshahi", 0xf97316], ["Khulna", 0xa855f7],
      ["Barishal", 0xeab308], ["Sylhet", 0x92400e], ["Rangpur", 0xe5e7eb], ["Mymensingh", 0x64748b], ["International", 0x06b6d4],
    ].map(([name, color]) => makeRole(name as string, color as number)));
    const editionRoles = await Promise.all([
      makeRole("Java Edition", 0xf59e0b), makeRole("Bedrock Edition", 0x22c55e), makeRole("Both Edition", 0x8b5cf6),
    ]);
    const ageRoles = await Promise.all([makeRole("Age 13-17", 0xec4899), makeRole("Age 18+", 0x14b8a6)]);
    for (const reward of levelRewards) if (reward.roleName) await makeRole(reward.roleName, 0xa855f7);

    const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    if (botMember) {
      const managedRoleObjects = guild.roles.cache.filter((item) =>
        managedRoles.some((name) => name.toLowerCase() === item.name.toLowerCase())
      );
      for (const item of managedRoleObjects.values()) {
        await item.setPosition(Math.max(1, botMember.roles.highest.position - 1)).catch(() => {});
      }
    }

    const staffIds = [teamRole?.id, staffRole?.id, moderatorRole?.id, eventRole?.id, ticketStaffRole?.id].filter(Boolean) as string[];
    const staffPermissions = staffIds.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }));
    const staffOnly = [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, ...staffPermissions];
    const ownerOnly = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ...(guild.members.me ? [{ id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] : []),
    ];
    const readOnly = [{ id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] }];

    const makeCategory = async (name: string, permissionOverwrites?: any) => {
      const result = await guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites, reason: "Team Insane full setup" }).catch(() => null);
      if (result) created.push(`Category: ${name}`); else failed.push(`Category: ${name}`);
      return result;
    };
    const makeText = async (name: string, parentId?: string, permissionOverwrites?: any) => {
      const result = await guild.channels.create({ name, type: ChannelType.GuildText, parent: parentId, permissionOverwrites, reason: "Team Insane full setup" }).catch(() => null);
      if (result) created.push(`#${name}`); else failed.push(`#${name}`);
      return result as TextChannel | null;
    };
    const makeVoice = async (name: string, parentId?: string, permissionOverwrites?: any) => {
      const result = await guild.channels.create({ name, type: ChannelType.GuildVoice, parent: parentId, permissionOverwrites, reason: "Team Insane full setup" }).catch(() => null);
      if (result) created.push(`Voice: ${name}`); else failed.push(`Voice: ${name}`);
    };

    // Live stats first, so the category sits at the very top of the server.
    const statsCategory = await makeCategory("✦ SERVER STATS");
    const stats = await ensureStatsChannels(guild, statsCategory?.id);
    if (stats.createdAny) created.push("✦ SERVER STATS (⭐ Members + 📅 Date)");
    await refreshStats(guild, true);

    const info = await makeCategory("✦ INFO CENTER");
    const community = await makeCategory("✦ COMMUNITY");
    const support = await makeCategory("✦ SUPPORT CENTER");
    const staff = await makeCategory("✦ STAFF HQ", staffOnly);
    const events = await makeCategory("✦ EVENTS & FUN");
    const publicVoice = await makeCategory("✦ PUBLIC VOICE");
    const privateVoice = await makeCategory("✦ PRIVATE VOICE", staffOnly);

    const welcome = await makeText("👋│welcome", info?.id);
    const rules = await makeText("📜│rules", info?.id, readOnly);
    const announcements = await makeText("📢│announcements", info?.id, readOnly);
    const serverInfo = await makeText("🌐│server-info", info?.id, readOnly);
    const rolesChannel = await makeText("🎭│roles", info?.id);
    const general = await makeText("💬│general", community?.id);
    await makeText("👋│introductions", community?.id);
    await makeText("🎨│media", community?.id);
    await makeText("💡│suggestions", community?.id);
    await makeText("📊│polls", community?.id);
    const levelUp = await makeText("⚡│level-up", community?.id, readOnly);
    const ticketSupport = await makeText("🎫│ticket-support", support?.id);
    const ticketLogs = await makeText("📁│ticket-logs", support?.id, staffOnly);
    await makeText("❓│help-forum", support?.id);
    const modLogs = await makeText("🛡️│mod-logs", staff?.id, staffOnly);
    await makeText("💬│staff-chat", staff?.id, staffOnly);
    await makeText("📋│staff-logs", staff?.id, staffOnly);
    const commandGuide = await makeText("📚│command-guide", staff?.id, staffOnly);
    const dashboardChannel = await makeText("📊│dashboard", staff?.id, ownerOnly);
    await makeText("🎁│giveaways", events?.id);
    await makeText("🎯│invite-event", events?.id);
    const leaderboard = await makeText("🏆│leaderboard", events?.id);
    await makeVoice("🔊│public-voice", publicVoice?.id);
    await makeVoice("🎥│live-voice", publicVoice?.id);
    await makeVoice("🎵│music-voice", publicVoice?.id);
    await makeVoice("🔒│team-voice", privateVoice?.id, staffOnly);
    await makeVoice("🔒│team-voice-2", privateVoice?.id, staffOnly);
    await makeVoice("🔒│team-voice-3", privateVoice?.id, staffOnly);

    await prisma.guildConfig.upsert({
      where: { guildId: guild.id },
      update: {
        welcomeChannelId: welcome?.id,
        modLogChannelId: modLogs?.id,
        ticketCategoryId: support?.id,
        ticketLogChannelId: ticketLogs?.id,
        ticketStaffRoleId: ticketStaffRole?.id ?? staffRole?.id,
        levelUpChannelId: levelUp?.id,
        autoRoleId: memberRole?.id,
        liveLeaderboardChannelId: leaderboard?.id,
      },
      create: {
        guildId: guild.id,
        welcomeChannelId: welcome?.id,
        modLogChannelId: modLogs?.id,
        ticketCategoryId: support?.id,
        ticketLogChannelId: ticketLogs?.id,
        ticketStaffRoleId: ticketStaffRole?.id ?? staffRole?.id,
        levelUpChannelId: levelUp?.id,
        autoRoleId: memberRole?.id,
        liveLeaderboardChannelId: leaderboard?.id,
      },
    });

    await welcome?.send({ embeds: [ownzEmbed("accent").setTitle("⟢ Welcome to Team Insane").setDescription("Read the rules, choose your roles, and enjoy the community.")] }).catch(() => {});
    await rules?.send({
      embeds: [ownzEmbed("primary").setTitle("📜 Team Insane Rules").setDescription([
        "Read these rules before entering the community.", "", section("Community Code"),
        "🤝 **Respect:** no harassment, hate, racism, or targeted abuse.",
        "🛡️ **Safety:** no scams, malicious links, token loggers, or suspicious files.",
        "⛏️ **Minecraft:** no hacks, cheats, exploits, x-ray, griefing, or stealing.",
        "💬 **Channels:** keep conversations in the correct places.",
        "🚫 **Spam:** no flooding, mass mentions, invite spam, or self-promotion.",
        "🔞 **Content:** keep content appropriate and safe for the community.",
        "🧾 **Evidence:** do not fake reports, screenshots, or accusations.",
        "🎁 **Events:** do not abuse giveaways, invites, or reward systems.",
        "👮 **Staff:** follow moderation decisions and open a ticket for appeals.",
        "📜 **Discord:** follow Discord Terms of Service and Community Guidelines.",
        "", "Click **Verify Member** below to unlock the community.",
      ].join("\n"))],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("verify_member").setLabel("Verify Member").setEmoji("✅").setStyle(ButtonStyle.Success)
      )],
    }).catch(() => {});
    await announcements?.send({ embeds: [ownzEmbed("primary").setTitle("📢 Team Insane Announcements").setDescription("Official updates, events, giveaways, and server news appear here.")] }).catch(() => {});
    await general?.send({ embeds: [ownzEmbed("neutral").setTitle("💬 Team Insane Community").setDescription("Chat with the community and use `/help` to explore the bot.")] }).catch(() => {});
    await serverInfo?.send({ embeds: [ownzEmbed("accent").setTitle("🌐 Team Insane Server Info").setDescription([
      "Welcome to the official Team Insane hub.", "", section("Quick Start"),
      "✅ Verify in #📜│rules", "👋 Introduce yourself in #👋│introductions", "🎫 Need help? Open a ticket in #🎫│ticket-support", "🏆 Join events and check #🏆│leaderboard", "🎙️ Meet the community in the public voice rooms",
    ].join("\n"))] }).catch(() => {});
    if (ticketSupport) {
      const panel = ownzEmbed("primary").setTitle("⟢ Team Insane Support Center").setDescription([
        "Choose a department below to open a private ticket.", "", section("Departments"),
        TICKET_CATEGORIES.map((item) => `${item.emoji} **${item.label}** — ${item.blurb}`).join("\n"),
      ].join("\n"));
      await ticketSupport.send({ embeds: [panel], components: [ticketPanelSelect()] }).catch(() => {});
    }
    if (rolesChannel) {
      const divisionMenu = new StringSelectMenuBuilder()
        .setCustomId("self_roles_division")
        .setPlaceholder("🌍 Select your division")
        .addOptions(divisionRoles.filter(Boolean).map((role) => ({ label: role!.name, value: role!.name })));
      const editionMenu = new StringSelectMenuBuilder()
        .setCustomId("self_roles_edition")
        .setPlaceholder("⛏️ Select your Minecraft edition")
        .addOptions(editionRoles.filter(Boolean).map((role) => ({ label: role!.name, value: role!.name })));
      const ageMenu = new StringSelectMenuBuilder()
        .setCustomId("self_roles_age")
        .setPlaceholder("🎂 Select your age group")
        .addOptions(ageRoles.filter(Boolean).map((role) => ({ label: role!.name, value: role!.name })));
      await rolesChannel.send({
        embeds: [buildSelfRolePanel()],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(divisionMenu),
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(editionMenu),
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(ageMenu),
        ],
      }).catch(() => {});
    }
    if (dashboardChannel) {
      const dashboardUrl = process.env.DASHBOARD_URL ?? "http://localhost:3000";
      await dashboardChannel.send({
        embeds: [ownzEmbed("accent").setTitle("📊 Private Owner Dashboard").setDescription([
          "This channel is visible only to the server owner and the bot.",
          "",
          `🔗 **Dashboard:** ${dashboardUrl}`,
          "🔐 Login with the `DASHBOARD_PASSWORD` configured on the bot host.",
          "📈 View commands, moderation logs, AutoMod activity, tickets, and server statistics.",
        ].join("\n"))],
      }).catch(() => {});
    }
    if (commandGuide) {
      const guide = [
        ownzEmbed("primary").setTitle("📚 Team Insane Command Guide").setDescription([
          "এই private guide-এ bot-এর command-এর কাজ সহজ বাংলায় দেওয়া হলো।",
          "সব command দেখতে `/help` লিখুন।",
        ].join("\n")),
        ownzEmbed("accent").setTitle("🎫 Ticket ও Support").setDescription([
          "`/ticketpanel` — support menu পোস্ট করে।",
          "`/ticket` — বর্তমান ticket manage করে।",
          "`/ready` — পুরো server fresh setup করে; সাবধানে ব্যবহার করবেন।",
          "`/setup` — channel, role ও bot configuration manually সেট করে।",
          "`/reactionrole` — message reaction দিয়ে role দেওয়ার system বানায়।",
          "",
          "**ব্যবহার:** প্রথমে `#🎫│ticket-support`-এ ticket panel রাখুন।",
        ].join("\n")),
        ownzEmbed("danger").setTitle("🛡️ Moderation ও Security").setDescription([
          "`/ban` — member ban করে।",
          "`/kick` — member server থেকে remove করে।",
          "`/mute` — member-কে নির্দিষ্ট সময় timeout করে।",
          "`/warn` — warning দেয়; `/warnings` — warning history দেখায়।",
          "`/clear` — channel-এর পুরনো message মুছে।",
          "`/slowmode` — channel slowmode চালু/বন্ধ করে।",
          "`/lock` বা `/lockchannel` — channel lock করে।",
          "`/nick` — member nickname পরিবর্তন করে।",
          "",
          "AutoMod scam, invite spam, mass mention ও repeated spam নিজে handle করে।",
        ].join("\n")),
        ownzEmbed("success").setTitle("🎉 Level, Event ও Economy").setDescription([
          "`/rank` — নিজের level ও XP দেখায়।",
          "`/leaderboard` — server-এর top player দেখায়।",
          "`/balance` — coin balance দেখায়।",
          "`/daily` — daily coin reward নেয়।",
          "`/levelrewards` — level reward list দেখায়।",
          "`/giveaway start` — giveaway শুরু করে।",
          "`/inviteevent start` — invite competition শুরু করে।",
          "`/inviteevent check` — invite leaderboard দেখে।",
        ].join("\n")),
        ownzEmbed("warning").setTitle("🎵 Fun, Music ও Utility").setDescription([
          "`/play` — voice channel-এ গান চালায়; `/queue` — queue দেখে।",
          "`/skip` — বর্তমান গান skip করে; `/stop` — music বন্ধ করে।",
          "`/8ball`, `/coinflip`, `/rps` — fun games।",
          "`/poll` — vote poll বানায়।",
          "`/announce` — সুন্দর announcement পাঠায়।",
          "`/serverinfo` — server statistics দেখায়।",
          "`/userinfo` — member information দেখায়।",
          "`/avatar` — profile avatar দেখায়।",
          "`/ping` — bot response ও latency check করে।",
          "`/remind` — reminder সেট করে; `/afk` — AFK status দেয়।",
          "`/help` — পুরো command menu দেখায়।",
        ].join("\n")),
      ];
      await commandGuide.send({ embeds: guide }).catch(() => {});
    }

    const summary = [
      "✅ **Team Insane full setup complete**",
      `Created ${created.length} items. Failed ${failed.length}.`,
      failed.length ? `⚠️ Failed: ${failed.join(", ")}` : "Roles, permissions, categories, text channels, voice channels, welcome content, and ticket panel are ready.",
      "Use `/help` for all commands. Ticket panel: #ticket-support.",
    ].join("\n");
    await interaction.editReply({ content: summary }).catch(() => {});
  },
};

export default command;
