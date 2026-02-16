import { Client, Collection, GatewayIntentBits } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { DISCORD_TOKEN } from '../lib/config.js';
import { setupNotifications } from './notifications.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('Bot');
const __dirname = dirname(fileURLToPath(import.meta.url));

let client = null;

/**
 * Initialize and start the Discord bot.
 * @param {import('socket.io').Server} io - Socket.IO server for notification hooks
 * @returns {Client|null} The Discord client, or null if DISCORD_TOKEN is not set
 */
export async function startBot(io) {
  if (!DISCORD_TOKEN) {
    log.info('DISCORD_TOKEN not set — bot disabled');
    return null;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
    ],
  });

  // Load commands
  client.commands = new Collection();
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    if (command.data && command.execute) {
      client.commands.set(command.data.name, command);
      log.debug(`Loaded command: /${command.data.name}`);
    }
  }

  // Load events
  const eventsPath = join(__dirname, 'events');
  const eventFiles = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = join(eventsPath, file);
    const event = await import(pathToFileURL(filePath).href);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }

  // Hook notifications into Socket.IO
  if (io) {
    setupNotifications(client, io);
  }

  // Login
  await client.login(DISCORD_TOKEN);
  log.info('Discord bot started');

  return client;
}

/**
 * Get the current Discord client instance (may be null).
 */
export function getClient() {
  return client;
}
