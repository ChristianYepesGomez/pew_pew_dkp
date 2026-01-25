import bcrypt from 'bcryptjs';
import { db, initDatabase } from './database.js';

// Initialize database first
initDatabase();

console.log('🌱 Starting seed script...');

// WoW Classes and their possible specs
const CLASS_SPECS = {
  Warrior: { specs: ['Arms', 'Fury', 'Protection'], roles: ['DPS', 'DPS', 'Tank'] },
  Paladin: { specs: ['Holy', 'Protection', 'Retribution'], roles: ['Healer', 'Tank', 'DPS'] },
  Hunter: { specs: ['Beast Mastery', 'Marksmanship', 'Survival'], roles: ['DPS', 'DPS', 'DPS'] },
  Rogue: { specs: ['Assassination', 'Combat', 'Subtlety'], roles: ['DPS', 'DPS', 'DPS'] },
  Priest: { specs: ['Discipline', 'Holy', 'Shadow'], roles: ['Healer', 'Healer', 'DPS'] },
  Shaman: { specs: ['Elemental', 'Enhancement', 'Restoration'], roles: ['DPS', 'DPS', 'Healer'] },
  Mage: { specs: ['Arcane', 'Fire', 'Frost'], roles: ['DPS', 'DPS', 'DPS'] },
  Warlock: { specs: ['Affliction', 'Demonology', 'Destruction'], roles: ['DPS', 'DPS', 'DPS'] },
  Druid: { specs: ['Balance', 'Feral', 'Restoration'], roles: ['DPS', 'DPS', 'Healer'] },
  'Death Knight': { specs: ['Blood', 'Frost', 'Unholy'], roles: ['Tank', 'DPS', 'DPS'] },
};

const CLASSES = Object.keys(CLASS_SPECS);

// Helper function to get random spec for a class
function getRandomSpec(characterClass) {
  const classData = CLASS_SPECS[characterClass];
  const index = Math.floor(Math.random() * classData.specs.length);
  return {
    spec: classData.specs[index],
    raidRole: classData.roles[index]
  };
}

// Test users with fantasy WoW-like names (specifying spec/role for variety)
const TEST_USERS = [
  // Tanks (4)
  { name: 'Shadowmourne', class: 'Death Knight', spec: 'Blood', raidRole: 'Tank' },
  { name: 'Ironclad', class: 'Warrior', spec: 'Protection', raidRole: 'Tank' },
  { name: 'Lightbringer', class: 'Paladin', spec: 'Protection', raidRole: 'Tank' },
  { name: 'Bearform', class: 'Druid', spec: 'Feral', raidRole: 'Tank' },

  // Healers (5)
  { name: 'Holylight', class: 'Priest', spec: 'Holy', raidRole: 'Healer' },
  { name: 'Crystalsong', class: 'Priest', spec: 'Discipline', raidRole: 'Healer' },
  { name: 'Divineaura', class: 'Paladin', spec: 'Holy', raidRole: 'Healer' },
  { name: 'Naturecall', class: 'Druid', spec: 'Restoration', raidRole: 'Healer' },
  { name: 'Tidalwave', class: 'Shaman', spec: 'Restoration', raidRole: 'Healer' },

  // DPS (16)
  { name: 'Frostweaver', class: 'Mage', spec: 'Frost', raidRole: 'DPS' },
  { name: 'Nightstalker', class: 'Rogue', spec: 'Subtlety', raidRole: 'DPS' },
  { name: 'Moonfire', class: 'Druid', spec: 'Balance', raidRole: 'DPS' },
  { name: 'Thunderstrike', class: 'Shaman', spec: 'Elemental', raidRole: 'DPS' },
  { name: 'Soulreaper', class: 'Warlock', spec: 'Affliction', raidRole: 'DPS' },
  { name: 'Silentshot', class: 'Hunter', spec: 'Marksmanship', raidRole: 'DPS' },
  { name: 'Bladestorm', class: 'Warrior', spec: 'Fury', raidRole: 'DPS' },
  { name: 'Darkwhisper', class: 'Rogue', spec: 'Assassination', raidRole: 'DPS' },
  { name: 'Flameheart', class: 'Mage', spec: 'Fire', raidRole: 'DPS' },
  { name: 'Earthshaker', class: 'Shaman', spec: 'Enhancement', raidRole: 'DPS' },
  { name: 'Voidwalker', class: 'Warlock', spec: 'Demonology', raidRole: 'DPS' },
  { name: 'Starfall', class: 'Druid', spec: 'Balance', raidRole: 'DPS' },
  { name: 'Bonecrusher', class: 'Death Knight', spec: 'Unholy', raidRole: 'DPS' },
  { name: 'Swiftarrow', class: 'Hunter', spec: 'Beast Mastery', raidRole: 'DPS' },
  { name: 'Frostbite', class: 'Mage', spec: 'Arcane', raidRole: 'DPS' },
  { name: 'Shadowdancer', class: 'Rogue', spec: 'Combat', raidRole: 'DPS' },
];

async function seedDatabase() {
  try {
    // 1. Delete default admin user and any existing test users
    console.log('🗑️  Cleaning up existing users...');

    const usersToDelete = ['admin', 'lolilop', 'inky', ...TEST_USERS.map(u => u.name.toLowerCase())];

    for (const username of usersToDelete) {
      const user = db.prepare("SELECT id FROM users WHERE username = ?").get(username);
      if (user) {
        db.prepare('DELETE FROM member_dkp WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM dkp_transactions WHERE user_id = ?').run(user.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
        console.log(`  🗑️  Removed: ${username}`);
      }
    }
    console.log('✅ Cleanup complete');

    // 2. Create Lolilop (admin)
    console.log('👑 Creating admin user: Lolilop...');
    const lolilop = await createUser({
      username: 'lolilop',
      password: 'Hc04091520@',
      characterName: 'Lolilop',
      characterClass: 'Priest',
      spec: 'Holy',
      raidRole: 'Healer',
      role: 'admin',
      dkp: 100
    });
    console.log(`✅ Lolilop created (ID: ${lolilop.id})`);

    // 3. Create Inky (admin)
    console.log('👑 Creating admin user: Inky...');
    const inky = await createUser({
      username: 'inky',
      password: 'inky123',
      characterName: 'Inky',
      characterClass: 'Warlock',
      spec: 'Affliction',
      raidRole: 'DPS',
      role: 'admin',
      dkp: 100
    });
    console.log(`✅ Inky created (ID: ${inky.id})`);

    // 4. Create test users (25 total, some officers, rest raiders)
    console.log('👥 Creating test users...');
    const officerCount = 3; // 3 officers

    for (let i = 0; i < TEST_USERS.length; i++) {
      const testUser = TEST_USERS[i];
      // Use predefined spec/raidRole if available, otherwise randomize
      const spec = testUser.spec || getRandomSpec(testUser.class).spec;
      const raidRole = testUser.raidRole || getRandomSpec(testUser.class).raidRole;
      const username = testUser.name.toLowerCase();
      const role = i < officerCount ? 'officer' : 'raider';
      const dkp = Math.floor(Math.random() * 150) + 20; // Random DKP between 20-170

      // Check if user already exists
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        console.log(`⏭️  Skipping ${testUser.name} (already exists)`);
        continue;
      }

      const user = await createUser({
        username: username,
        password: `${username}123`,
        characterName: testUser.name,
        characterClass: testUser.class,
        spec: spec,
        raidRole: raidRole,
        role: role,
        dkp: dkp
      });

      console.log(`✅ ${testUser.name} created as ${role} (${testUser.class} - ${spec}, ${raidRole}) - ${dkp} DKP`);
    }

    const tanks = TEST_USERS.filter(u => u.raidRole === 'Tank').map(u => u.name);
    const healers = TEST_USERS.filter(u => u.raidRole === 'Healer').map(u => u.name);
    const dps = TEST_USERS.filter(u => u.raidRole === 'DPS').map(u => u.name);

    console.log('\n🎉 Seed completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Admins: Lolilop, Inky');
    console.log(`   - Officers: ${TEST_USERS.slice(0, 3).map(u => u.name).join(', ')}`);
    console.log(`   - Raiders: ${TEST_USERS.slice(3).map(u => u.name).join(', ')}`);
    console.log(`\n⚔️  Raid Composition (${TEST_USERS.length} members):`);
    console.log(`   - Tanks (${tanks.length}): ${tanks.join(', ')}`);
    console.log(`   - Healers (${healers.length}): ${healers.join(', ')}`);
    console.log(`   - DPS (${dps.length}): ${dps.join(', ')}`);
    console.log('\n🔐 Passwords:');
    console.log('   - Lolilop: Hc04091520@');
    console.log('   - Inky: inky123');
    console.log('   - Test users: {username}123 (e.g., shadowmourne123)');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

async function createUser({ username, password, characterName, characterClass, spec, raidRole, role, dkp }) {
  const hashedPassword = await bcrypt.hash(password, 10);

  const result = db.prepare(`
    INSERT INTO users (username, password, character_name, character_class, spec, raid_role, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(username, hashedPassword, characterName, characterClass, spec, raidRole, role);

  db.prepare(`
    INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained)
    VALUES (?, ?, ?)
  `).run(result.lastInsertRowid, dkp, dkp);

  return { id: result.lastInsertRowid };
}

// Run the seed
seedDatabase();
