/**
 * Pre-recorded Blizzard API responses for testing.
 */

export const MOCK_CHARACTER_EQUIPMENT = {
  character: { name: 'TestWarrior', realm: { slug: 'sanguino' }, level: 80 },
  equipped_items: [
    {
      slot: { type: 'HEAD' },
      item: { id: 212345, name: 'Helm of Testing' },
      level: { value: 639 },
      quality: { type: 'EPIC' },
      iconUrl: 'https://example.com/helm.png',
    },
    {
      slot: { type: 'CHEST' },
      item: { id: 212346, name: 'Chestplate of Mocking' },
      level: { value: 639 },
      quality: { type: 'EPIC' },
      iconUrl: 'https://example.com/chest.png',
    },
  ],
};

export const MOCK_CHARACTER_MEDIA = {
  avatar: 'https://render.worldofwarcraft.com/eu/character/sanguino/test-avatar.jpg',
  render: 'https://render.worldofwarcraft.com/eu/character/sanguino/test-render.jpg',
};

export const MOCK_EQUIPMENT_ERROR = {
  error: 'Character not found',
};
