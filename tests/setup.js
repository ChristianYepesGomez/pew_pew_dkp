// Test environment setup — must run before any imports
import { existsSync, unlinkSync } from 'fs';

process.env.TURSO_DATABASE_URL = 'file:./data/test.db';
process.env.PLATFORM_DATABASE_URL = 'file:./data/test-platform.db';
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-prod';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // random port
process.env.CRON_SECRET = 'test-cron-secret';

// Remove stale test databases so each worker starts fresh
for (const dbPath of ['./data/test.db', './data/test-platform.db']) {
  if (existsSync(dbPath)) {
    try { unlinkSync(dbPath); } catch (_e) { /* may be locked by another worker */ }
  }
}
