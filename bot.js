const { Client, GatewayIntentBits, Partials } = require('discord.js');

// Only the bot token is needed for this file
const DISCORD_BOT_TOKEN = "MTM4NzIwODUxMDE1NjE3NzQ1OA.GmfQcu.iuSEECl2F56gCqkdF_v4sei1UIH67Mr-2SCgKA"; // <-- Replace with your actual bot token

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.GuildMember]
});

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.on('warn', (info) => {
    console.warn('Discord client warning:', info);
});

client.on('disconnect', () => {
    console.warn('Bot disconnected from Discord!');
});

client.login(DISCORD_BOT_TOKEN);