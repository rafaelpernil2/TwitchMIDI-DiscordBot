import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const commands = [
  new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Ask a question about TwitchMIDI documentation')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('The question you want to ask')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('auth')
    .setDescription('Authenticate with your TwitchMIDI credentials')
    .addStringOption((option) =>
      option
        .setName('email')
        .setDescription('Your TwitchMIDI+ email')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('license_key')
        .setDescription('Your TwitchMIDI license key')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('forget')
    .setDescription('Delete your stored credentials from the bot'),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear your conversation history and start fresh'),
].map((command) => command.toJSON());

if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID");
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    const data: any = await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands }
    );

    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
  } catch (error) {
    console.error(error);
  }
})();
