// Runs once before all test files — clean up stale test DBs
import { existsSync, unlinkSync } from 'fs';

export function setup() {
  for (const dbPath of ['./data/test.db', './data/test-platform.db']) {
    if (existsSync(dbPath)) {
      try { unlinkSync(dbPath); } catch (_e) { /* may be locked */ }
    }
  }
}
