-- Update existing users with appropriate specs and raid roles
UPDATE users SET spec = 'Arms', raid_role = 'DPS' WHERE id = 1;
UPDATE users SET spec = 'Fury', raid_role = 'DPS', character_name = 'Løliløp' WHERE id = 2;
UPDATE users SET spec = 'Protection', raid_role = 'Tank', character_name = 'Wørm' WHERE id = 3;
UPDATE users SET spec = 'Marksmanship', raid_role = 'DPS' WHERE id = 4;
UPDATE users SET spec = 'Restoration', raid_role = 'Healer', character_name = 'Shampiñon' WHERE id = 5;
