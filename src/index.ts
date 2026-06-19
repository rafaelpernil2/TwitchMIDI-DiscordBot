import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, MessageFlags } from 'discord.js';
import { MCPService } from './services/mcp.js';
import { askGemini } from './services/llm.js';
import { dbService } from './services/db.js';
import { chunkMessage } from './utils/chunk.js';
import { sanitizeForDiscord } from './utils/sanitize.js';

// Shown to users when the model/MCP backend errors out. Keep it actionable:
// the most common self-fix after a backend change is to re-run /forget + /auth.
const USER_FACING_ERROR =
  "⚠️ Something went wrong while answering. This can happen after a docs/service update.\n" +
  "Please try `/forget` and then `/auth` again to reconnect — that fixes most issues.\n" +
  "If it keeps failing, the service may be temporarily down; try again in a minute.";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

const userHistories = new Map<string, { role: string; parts: { text: string }[] }[]>();
const MAX_HISTORY_LENGTH = 10;

client.once(Events.ClientReady, async (c) => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'auth') {
    const email = interaction.options.getString('email');
    const licenseKey = interaction.options.getString('license_key');

    if (!email || !licenseKey) {
      await interaction.reply({ content: 'Email and license key are required.', flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const tempMcp = new MCPService();
      await tempMcp.connect(email, licenseKey);

      dbService.saveUserCredentials(interaction.user.id, email, licenseKey);
      await interaction.reply({ content: 'Successfully authenticated and saved your credentials securely.', flags: MessageFlags.Ephemeral });
    } catch (err: any) {
      console.error(err);
      await interaction.reply({ content: 'Authentication failed. Please check your username and license key.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  if (interaction.commandName === 'forget') {
    const deleted = dbService.deleteUserCredentials(interaction.user.id);
    userHistories.delete(interaction.user.id);
    await interaction.reply({
      content: deleted
        ? 'Your stored credentials and conversation history have been deleted.'
        : 'You have no stored credentials.',
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'clear') {
    const had = userHistories.delete(interaction.user.id);
    await interaction.reply({
      content: had
        ? 'Your conversation history has been cleared. Starting fresh!'
        : 'You have no conversation history to clear.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName === 'docs') {
    const query = interaction.options.getString('query');
    if (!query) {
      await interaction.reply('Please provide a query.');
      return;
    }

    const creds = dbService.getUserCredentials(interaction.user.id);
    if (!creds) {
      await interaction.reply({ content: 'You must authenticate first using `/auth <username> <license_key>`.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content: 'Your question is queued. I\'ll answer shortly...' });

    try {
      const mcpService = new MCPService();
      await mcpService.connect(creds.email, creds.licenseKey);

      const history = userHistories.get(interaction.user.id) || [];
      const responseText = await askGemini(mcpService, query, history);

      history.push({ role: 'user', parts: [{ text: query }] });
      history.push({ role: 'model', parts: [{ text: responseText }] });
      if (history.length > MAX_HISTORY_LENGTH) {
         history.splice(0, history.length - MAX_HISTORY_LENGTH);
      }
      userHistories.set(interaction.user.id, history);

      const chunks = chunkMessage(sanitizeForDiscord(responseText));

      await interaction.editReply(chunks[0]);

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp(chunks[i]);
      }
    } catch (err: any) {
      console.error(err);
      await interaction.editReply(USER_FACING_ERROR);
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const isDM = message.channel.isDMBased();
  const isMentioned = message.mentions.has(client.user!.id);

  if (!isDM && !isMentioned) return;

  const content = message.content.replace(`<@${client.user!.id}>`, '').trim();
  if (!content) return;

  const creds = dbService.getUserCredentials(message.author.id);
  if (!creds) {
    await message.reply('You must authenticate first using `/auth <username> <license_key>`.');
    return;
  }

  const replyMessage = await message.reply('Your question is queued. I\'ll answer shortly...');

  try {
    const mcpService = new MCPService();
    await mcpService.connect(creds.email, creds.licenseKey);

    const history = userHistories.get(message.author.id) || [];
    const responseText = await askGemini(mcpService, content, history);
    
    history.push({ role: 'user', parts: [{ text: content }] });
    history.push({ role: 'model', parts: [{ text: responseText }] });
    if (history.length > MAX_HISTORY_LENGTH) {
        history.splice(0, history.length - MAX_HISTORY_LENGTH);
    }
    userHistories.set(message.author.id, history);

    const chunks = chunkMessage(sanitizeForDiscord(responseText));

    await replyMessage.edit(chunks[0]);

    for (let i = 1; i < chunks.length; i++) {
      await message.reply(chunks[i]);
    }
  } catch (err: any) {
    console.error(err);
    await replyMessage.edit(USER_FACING_ERROR);
  }
});

client.login(process.env.DISCORD_TOKEN);
