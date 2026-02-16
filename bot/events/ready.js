import { Events } from 'discord.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('Bot:Ready');

export const name = Events.ClientReady;
export const once = true;

export function execute(client) {
  log.info(`Discord bot online as ${client.user.tag} — serving ${client.guilds.cache.size} guild(s)`);
  client.user.setActivity('/dkp | Pew Pew Kittens');
}
