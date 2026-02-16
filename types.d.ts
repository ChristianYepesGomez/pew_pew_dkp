// Global type declarations for DKP Backend
// Extends Express Request with properties added by middleware at runtime

interface DbInterface {
  get(sql: string, ...args: any[]): Promise<any>;
  all(sql: string, ...args: any[]): Promise<any[]>;
  run(sql: string, ...args: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  exec(sql: string): Promise<any>;
  batch(stmts: any[]): Promise<any>;
  transaction<T>(fn: (tx: TransactionDb) => Promise<T>): Promise<T>;
}

interface TransactionDb {
  get(sql: string, ...args: any[]): Promise<any>;
  all(sql: string, ...args: any[]): Promise<any[]>;
  run(sql: string, ...args: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
}

interface JwtUser {
  userId: number;
  username: string;
  role: 'admin' | 'officer' | 'raider';
  guildId?: number;
  iat?: number;
  exp?: number;
}

interface Guild {
  id: string;
  name: string;
  slug: string;
  realm?: string;
  region?: string;
  database_name: string;
  plan: 'free' | 'premium';
  created_at?: string;
  owner_id: string;
  discord_guild_id?: string;
  settings?: string;
}

declare global {
  namespace Express {
    interface Request {
      db: DbInterface;
      user?: JwtUser;
      guild?: Guild;
      id?: string;
    }
  }
}

declare module 'socket.io' {
  interface Socket {
    user?: JwtUser;
  }
}

export {}
