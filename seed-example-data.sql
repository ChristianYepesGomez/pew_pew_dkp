-- Example data for testing DKP system
-- Run this after a fresh database initialization

-- Insert test users with various roles and specs
-- Password for all test users is: 123
-- Hash generated with: bcrypt.hashSync('123', 10)

INSERT INTO users (username, password, character_name, character_class, raid_role, spec, role) VALUES
('lolilop', '$2a$10$N9qo8uLOickgx2ZoGZmNh.r3e2QzJiL4aHGPmR8tJFKoP9U5vGJQu', 'Løliløp', 'Rogue', 'DPS', 'Combat', 'raider'),
('worm', '$2a$10$N9qo8uLOickgx2ZoGZmNh.r3e2QzJiL4aHGPmR8tJFKoP9U5vGJQu', 'Wørm', 'Paladin', 'Tank', 'Protection', 'raider'),
('harley', '$2a$10$N9qo8uLOickgx2ZoGZmNh.r3e2QzJiL4aHGPmR8tJFKoP9U5vGJQu', 'Harley', 'Hunter', 'DPS', 'Marksmanship', 'raider'),
('shampi', '$2a$10$N9qo8uLOickgx2ZoGZmNh.r3e2QzJiL4aHGPmR8tJFKoP9U5vGJQu', 'Shampiñon', 'Shaman', 'Healer', 'Restoration', 'raider'),
('booque', '$2a$10$N9qo8uLOickgx2ZoGZmNh.r3e2QzJiL4aHGPmR8tJFKoP9U5vGJQu', 'Booque', 'Warlock', 'DPS', 'Affliction', 'raider');

-- Initialize DKP for test users (starting with 50 DKP each)
INSERT INTO member_dkp (user_id, current_dkp, lifetime_gained, lifetime_spent) VALUES
(2, 50, 50, 0),
(3, 50, 50, 0),
(4, 50, 50, 0),
(5, 50, 50, 0),
(6, 50, 50, 0);

-- Create an example active auction
INSERT INTO auctions (item_name, item_image, item_rarity, min_bid, status, created_by, created_at) VALUES
('Ashes of Al''ar', '🔥', 'legendary', 150, 'active', 1, datetime('now'));

-- Create some example bids for the auction
INSERT INTO auction_bids (auction_id, user_id, amount, created_at) VALUES
(1, 2, 150, datetime('now', '-2 hours')),
(1, 4, 175, datetime('now', '-1 hour'));

-- Create example DKP transaction history
INSERT INTO dkp_transactions (user_id, amount, reason, performed_by, created_at) VALUES
(2, 50, 'Initial DKP allocation', 1, datetime('now', '-7 days')),
(3, 50, 'Initial DKP allocation', 1, datetime('now', '-7 days')),
(4, 50, 'Initial DKP allocation', 1, datetime('now', '-7 days')),
(5, 50, 'Initial DKP allocation', 1, datetime('now', '-7 days')),
(6, 50, 'Initial DKP allocation', 1, datetime('now', '-7 days')),
(2, 25, 'Bonus attendance - 100% raid week', 1, datetime('now', '-3 days')),
(3, 20, 'Tank bonus for progression', 1, datetime('now', '-2 days')),
(4, -30, 'Won item: Sunwell Plate Boots', 1, datetime('now', '-1 day'));
