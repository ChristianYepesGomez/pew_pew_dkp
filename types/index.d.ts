import { Request } from 'express';

// ── User roles ──
export type UserRole = 'admin' | 'officer' | 'raider';
export type RaidRole = 'Tank' | 'Healer' | 'DPS';

// ── Database row types ──
export interface User {
  id: number;
  username: string;
  password: string;
  character_name: string | null;
  character_class: string | null;
  raid_role: RaidRole;
  role: UserRole;
  server?: string;
  spec?: string;
  email?: string;
  avatar?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  reset_token?: string;
  reset_token_expires?: string;
}

export interface MemberDkp {
  id: number;
  user_id: number;
  current_dkp: number;
  lifetime_gained: number;
  lifetime_spent: number;
  weekly_vault_completed: number;
  vault_week?: string;
  role: RaidRole;
}

export interface Character {
  id: number;
  user_id: number;
  character_name: string;
  character_class: string;
  spec?: string;
  raid_role: RaidRole;
  is_primary: number;
  realm?: string;
  realm_slug?: string;
  created_at: string;
}

export interface Auction {
  id: number;
  item_name: string;
  item_name_en?: string;
  item_image: string;
  item_rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  min_bid: number;
  status: 'active' | 'completed' | 'cancelled';
  created_by: number;
  winner_id?: number;
  winning_bid?: number;
  ends_at: string;
  duration_minutes: number;
  ended_at?: string;
  created_at: string;
}

export interface DkpTransaction {
  id: number;
  user_id: number;
  amount: number;
  reason: string;
  performed_by?: number;
  auction_id?: number;
  created_at: string;
}

// ── Express augmented request ──
export interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    role: UserRole;
  };
}

// ── Helper return types ──
export interface DkpCapResult {
  newDkp: number;
  actualGain: number;
  wasCapped: boolean;
}
