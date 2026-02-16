/**
 * Pre-recorded WarcraftLogs API responses for testing.
 */

export const MOCK_REPORT_DATA = {
  code: 'abc123test',
  title: 'Test Raid - Nerub-ar Palace',
  startTime: Date.now() - 3600000,
  endTime: Date.now(),
  duration: 3600000,
  region: 'EU',
  guildName: 'Pew Pew Kittens',
  participantCount: 2,
  bossesKilled: 1,
  totalBosses: 2,
  totalAttempts: 3,
  participants: [
    { name: 'TestWarrior', server: 'Sanguino', class: 'Warrior' },
    { name: 'TestPriest', server: 'Sanguino', class: 'Priest' },
  ],
  bosses: [
    { id: 1, name: 'Ulgrax', encounterID: 2902, difficulty: 4, kill: true },
  ],
  fights: [
    { id: 1, name: 'Ulgrax', encounterID: 2902, difficulty: 4, kill: true, startTime: 0, endTime: 180000, duration: 180000 },
    { id: 2, name: 'Ulgrax', encounterID: 2902, difficulty: 4, kill: false, startTime: 200000, endTime: 350000, duration: 150000 },
  ],
};

export const MOCK_GUILD_REPORTS = [
  {
    code: 'guild_report_1',
    title: 'Weekly Raid',
    startTime: Date.now() - 86400000,
    endTime: Date.now() - 82800000,
    zone: { name: 'Nerub-ar Palace' },
  },
  {
    code: 'guild_report_2',
    title: 'Alt Run',
    startTime: Date.now() - 172800000,
    endTime: Date.now() - 169200000,
    zone: { name: 'Nerub-ar Palace' },
  },
];

export const MOCK_FIGHT_STATS = {
  damage: [
    { name: 'TestWarrior', total: 5000000, activeTime: 180000 },
    { name: 'TestPriest', total: 2000000, activeTime: 180000 },
  ],
  healing: [
    { name: 'TestPriest', total: 4000000, activeTime: 180000 },
  ],
  damageTaken: [
    { name: 'TestWarrior', total: 3000000 },
    { name: 'TestPriest', total: 1500000 },
  ],
  deaths: [
    { name: 'TestWarrior', total: 1 },
  ],
  wipeDeathsFiltered: 0,
};

export const MOCK_USER_REPORTS = {
  userName: 'TestUploader',
  reports: [
    {
      code: 'user_report_1',
      title: 'Raid Night',
      startTime: Date.now() - 86400000,
      endTime: Date.now() - 82800000,
    },
  ],
};
