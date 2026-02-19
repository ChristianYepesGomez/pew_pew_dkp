#!/usr/bin/env node
/**
 * Generates a CSV for guild members to pick their class/spec.
 * Upload to Google Sheets and add data validation dropdowns.
 *
 * Usage: node scripts/generate-roster-sheet.js
 */

import 'dotenv/config';
import { createClient } from '@libsql/client';
import { writeFileSync } from 'fs';

// ── DB connection (reuse env vars) ──────────────────────────────
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:./data/dkp.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// ── WoW Class → Specs mapping ───────────────────────────────────
const CLASS_SPECS = {
  'Death Knight': ['Blood', 'Frost', 'Unholy'],
  'Demon Hunter': ['Havoc', 'Vengeance'],
  'Druid': ['Balance', 'Feral', 'Guardian', 'Restoration'],
  'Evoker': ['Augmentation', 'Devastation', 'Preservation'],
  'Hunter': ['Beast Mastery', 'Marksmanship', 'Survival'],
  'Mage': ['Arcane', 'Fire', 'Frost'],
  'Monk': ['Brewmaster', 'Mistweaver', 'Windwalker'],
  'Paladin': ['Holy', 'Protection', 'Retribution'],
  'Priest': ['Discipline', 'Holy', 'Shadow'],
  'Rogue': ['Assassination', 'Outlaw', 'Subtlety'],
  'Shaman': ['Elemental', 'Enhancement', 'Restoration'],
  'Warlock': ['Affliction', 'Demonology', 'Destruction'],
  'Warrior': ['Arms', 'Fury', 'Protection'],
};

// ── Fetch active members ────────────────────────────────────────
const result = await client.execute(
  'SELECT character_name, character_class, spec FROM users WHERE is_active = 1 ORDER BY character_name COLLATE NOCASE'
);

const members = result.rows;
console.log(`Found ${members.length} active members`);

// ── Generate main CSV ───────────────────────────────────────────
const headers = ['Nombre', 'Clase', 'Spec', 'Rol', 'Notas'];
const rows = [headers.join(',')];

for (const m of members) {
  const name = (m.character_name || '').replace(/,/g, '');
  rows.push(`${name},,,,`);
}

// Add some empty rows for new members
for (let i = 0; i < 10; i++) {
  rows.push(',,,,');
}

writeFileSync('scripts/roster-picks.csv', rows.join('\n'), 'utf-8');
console.log('✓ Created scripts/roster-picks.csv');

// ── Generate reference sheet (class → specs) ────────────────────
const refHeaders = ['Clase', 'Specs disponibles', 'Roles'];
const refRows = [refHeaders.join(',')];

const classRoles = {
  'Death Knight': 'Tank / DPS',
  'Demon Hunter': 'Tank / DPS',
  'Druid': 'Tank / Healer / DPS',
  'Evoker': 'Healer / DPS',
  'Hunter': 'DPS',
  'Mage': 'DPS',
  'Monk': 'Tank / Healer / DPS',
  'Paladin': 'Tank / Healer / DPS',
  'Priest': 'Healer / DPS',
  'Rogue': 'DPS',
  'Shaman': 'Healer / DPS',
  'Warlock': 'DPS',
  'Warrior': 'Tank / DPS',
};

for (const [cls, specs] of Object.entries(CLASS_SPECS)) {
  refRows.push(`${cls},"${specs.join(', ')}",${classRoles[cls]}`);
}

writeFileSync('scripts/roster-reference.csv', refRows.join('\n'), 'utf-8');
console.log('✓ Created scripts/roster-reference.csv');

// ── Print summary ───────────────────────────────────────────────
console.log('\n📋 Instrucciones para Google Sheets:');
console.log('1. Ve a sheets.google.com → Nuevo spreadsheet');
console.log('2. Archivo → Importar → Sube roster-picks.csv');
console.log('3. Crea una 2ª pestaña "Referencia" e importa roster-reference.csv');
console.log('4. Selecciona la columna B (Clase) → Datos → Validación de datos');
console.log('   → Lista de elementos → pega las 13 clases separadas por coma');
console.log('5. Para Spec: usa validación dependiente o lista general');
console.log('6. Columna Rol: validación con Tank, Healer, DPS');
console.log('7. Comparte el link con permisos de "Editor" en Discord');

await client.close();