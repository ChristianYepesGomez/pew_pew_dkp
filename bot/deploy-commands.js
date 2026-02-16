/**
 * Register slash commands with the Discord API.
 *
 * Usage:
 *   node bot/deploy-commands.js           # Register to a specific guild (fast, for development)
 *   node bot/deploy-commands.js --global  # Register globally (takes up to 1 hour to propagate)
 *
 * Requires: DISCORD_TOKEN, DISCORD_CLIENT_ID, and optionally DISCORD_GUILD_ID
 */
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } from '../lib/config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
    console.error('DISCORD_TOKEN and DISCORD_CLIENT_ID must be set.');
    process.exit(1);
  }

  const isGlobal = process.argv.includes('--global');

  // Load all command data
  const commands = [];
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    if (command.data) {
      commands.push(command.data.toJSON());
      console.log(`  Loaded: /${command.data.name}`);
    }
  }

  console.log(`\nRegistering ${commands.length} commands ${isGlobal ? 'globally' : `to guild ${DISCORD_GUILD_ID}`}...`);

  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  if (isGlobal) {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: commands });
  } else {
    if (!DISCORD_GUILD_ID) {
      console.error('DISCORD_GUILD_ID must be set for guild-scoped registration. Use --global for global registration.');
      process.exit(1);
    }
    await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
  }

  console.log('Done!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
