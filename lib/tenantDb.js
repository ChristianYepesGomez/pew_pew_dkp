import { createClient } from '@libsql/client';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { createDbInterface } from '../database.js';
import { createLogger } from './logger.js';

const log = createLogger('TenantDB');

const MAX_POOL_SIZE = parseInt(process.env.TENANT_POOL_MAX || '50', 10);
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Pool entry: { db, lastAccess, databaseName }
const pool = new Map();

// Periodic sweep to close idle connections
let sweepTimer = null;

function startSweep() {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of pool) {
      if (now - entry.lastAccess > IDLE_TIMEOUT_MS) {
        log.info(`Closing idle tenant connection: ${key}`);
        pool.delete(key);
      }
    }
    if (pool.size === 0) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }, SWEEP_INTERVAL_MS);
  // Don't block process exit
  if (sweepTimer.unref) sweepTimer.unref();
}

function buildTenantUrl(databaseName) {
  // Production: Turso cloud databases
  const tursoOrg = process.env.TURSO_ORG;
  if (tursoOrg) {
    return `libsql://${databaseName}-${tursoOrg}.turso.io`;
  }
  // Development: local file-based databases
  const filePath = `./data/${databaseName}.db`;
  const dir = dirname(filePath);
  if (dir && dir !== '.' && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return `file:${filePath}`;
}

export function getTenantDb(databaseName) {
  // Return existing connection if available
  if (pool.has(databaseName)) {
    const entry = pool.get(databaseName);
    entry.lastAccess = Date.now();
    return entry.db;
  }

  // Evict least recently used if at capacity
  if (pool.size >= MAX_POOL_SIZE) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, entry] of pool) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      log.info(`Evicting LRU tenant connection: ${oldestKey}`);
      pool.delete(oldestKey);
    }
  }

  // Create new connection
  const url = buildTenantUrl(databaseName);
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = createDbInterface(client);
  pool.set(databaseName, { db, lastAccess: Date.now(), databaseName });

  startSweep();
  log.info(`Created tenant connection: ${databaseName} (pool size: ${pool.size})`);

  return db;
}

export function closeTenantDb(databaseName) {
  if (pool.has(databaseName)) {
    pool.delete(databaseName);
    log.info(`Closed tenant connection: ${databaseName}`);
  }
}

export function closeAllTenantDbs() {
  const count = pool.size;
  pool.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
  if (count > 0) log.info(`Closed all ${count} tenant connections`);
}

export function getPoolSize() {
  return pool.size;
}
