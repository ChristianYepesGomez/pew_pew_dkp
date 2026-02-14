// Test environment setup — must run before any imports
import { existsSync, unlinkSync } from 'fs';

process.env.TURSO_DATABASE_URL = 'file:./data/test.db';
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-prod';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // random port

// Remove stale test database so each worker starts fresh
// (avoids migration errors from leftover data between test files)
const testDbPath = './data/test.db';
if (existsSync(testDbPath)) {
  try { unlinkSync(testDbPath); } catch (_e) { /* may be locked by another worker */ }
}
