/**
 * cleanup-midnight-bosses.js
 * Elimina zones y bosses de Midnight de la DB para que el seed
 * los regenere correctamente en el próximo restart del servidor.
 *
 * Uso: node scripts/cleanup-midnight-bosses.js
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

(async () => {
  // Show current state
  const zones = await db.all('SELECT id, wcl_zone_id, name, slug, expansion, is_current FROM wcl_zones ORDER BY id');
  console.log('Zones actuales:');
  zones.forEach(z => console.log(` id=${z.id} wclZone=${z.wcl_zone_id} "${z.name}" exp=${z.expansion} current=${z.is_current}`));

  const bosses = await db.all('SELECT id, zone_id, wcl_encounter_id, name, slug FROM wcl_bosses ORDER BY id');
  console.log(`\nBosses actuales: ${bosses.length}`);
  bosses.forEach(b => console.log(` id=${b.id} zone=${b.zone_id} encID=${b.wcl_encounter_id} "${b.name}"`));

  // Delete Midnight-related data (zones and their bosses)
  const midnightZones = zones.filter(z => z.expansion === 'Midnight');
  if (midnightZones.length === 0) {
    console.log('\nNo hay zones de Midnight, nada que limpiar.');
    process.exit(0);
  }

  console.log(`\nEliminando ${midnightZones.length} zone(s) de Midnight y sus bosses...`);
  for (const zone of midnightZones) {
    const deleted = await db.run('DELETE FROM wcl_bosses WHERE zone_id = ?', zone.id);
    console.log(` - Borrados ${deleted.rowsAffected ?? '?'} bosses del zone "${zone.name}"`);
    await db.run('DELETE FROM wcl_zones WHERE id = ?', zone.id);
    console.log(` - Zone "${zone.name}" eliminada`);
  }

  // Also clean up any bosses with encounterID=0 that may be orphaned in non-Midnight zones
  const orphanBosses = await db.all('SELECT b.id, b.name, z.name as zone_name FROM wcl_bosses b JOIN wcl_zones z ON b.zone_id = z.id WHERE b.wcl_encounter_id = 0');
  if (orphanBosses.length > 0) {
    console.log(`\nBosses huérfanos con encounterID=0 en otras zonas:`);
    orphanBosses.forEach(b => console.log(` - "${b.name}" en zone "${b.zone_name}"`));
    await db.run('DELETE FROM wcl_bosses WHERE wcl_encounter_id = 0');
    console.log(`Eliminados ${orphanBosses.length} boss(es) huérfanos.`);
  }

  console.log('\n✓ Limpieza completada. El siguiente restart del servidor regenerará los datos correctamente.');
  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
