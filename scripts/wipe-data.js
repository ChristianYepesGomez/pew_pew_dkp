/**
 * wipe-data.js
 * Borra todos los datos de prueba de la base de datos.
 * Conserva configuración (dkp_config, raid_days), catálogos (wcl_zones, wcl_bosses,
 * raid_items, epgp_item_values) y la estructura de migraciones.
 *
 * Uso: node scripts/wipe-data.js
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import { createDbInterface } from '../database.js';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('ERROR: TURSO_DATABASE_URL no definida');
  process.exit(1);
}

const client = createClient({ url, authToken });
const db = createDbInterface(client);

const TABLES_TO_WIPE = [
  // Sesiones / tokens
  'refresh_tokens',
  'discord_link_codes',
  'invite_codes',

  // Notificaciones
  'push_subscriptions',
  'notification_preferences',

  // Boss stats (datos de prueba de WCL)
  'boss_records',
  'player_boss_performance',
  'player_boss_deaths',
  'player_fight_performance',
  'boss_stats_processed',
  'boss_kill_log',
  'boss_statistics',

  // Loot Council
  'loot_votes',
  'loot_responses',
  'loot_decisions',

  // EPGP
  'epgp_transactions',
  'member_epgp',

  // Calendario
  'calendar_dkp_rewards',
  'member_availability',

  // BIS
  'bis_items',

  // Personajes alts
  'characters',

  // Raids y asistencia
  'raid_attendance',
  'raids',

  // WCL reports procesados
  'warcraft_logs_processed',

  // Subastas
  'auction_rolls',
  'auction_bids',
  'auctions',

  // DKP
  'dkp_transactions',
  'member_dkp',

  // Usuarios (al final, por foreign keys)
  'users',
];

// Tablas que se conservan:
// dkp_config, raid_days, wcl_zones, wcl_bosses, raid_items,
// item_popularity, epgp_item_values, bot_config, db_migrations

async function wipe() {
  console.log('=== WIPE DE DATOS DE PRUEBA ===\n');
  console.log('Tablas que se borrarán:');
  TABLES_TO_WIPE.forEach(t => console.log(`  - ${t}`));
  console.log('\nTablas que se conservan: dkp_config, raid_days, wcl_zones,');
  console.log('wcl_bosses, raid_items, item_popularity, epgp_item_values, bot_config\n');

  let total = 0;
  for (const table of TABLES_TO_WIPE) {
    try {
      const result = await db.run(`DELETE FROM ${table}`);
      const rows = result.changes ?? 0;
      total += rows;
      console.log(`  ✓ ${table}: ${rows} filas eliminadas`);
    } catch (err) {
      console.error(`  ✗ ${table}: ${err.message}`);
    }
  }

  // Reset autoincrement sequences (sqlite_sequence)
  try {
    await db.run(`DELETE FROM sqlite_sequence WHERE name IN (${TABLES_TO_WIPE.map(() => '?').join(',')})`, ...TABLES_TO_WIPE);
    console.log('\n  ✓ Secuencias de autoincrement reseteadas');
  } catch (_e) {
    // sqlite_sequence puede no existir en Turso remote, ignorar
  }

  console.log(`\n=== LISTO: ${total} filas eliminadas en total ===`);
  process.exit(0);
}

wipe().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
