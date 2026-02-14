import { db } from '../database.js';
import { createLogger } from './logger.js';

const log = createLogger('Lib:Helpers');

// ── Config Cache ──
const configCache = {
  values: {},
  lastFetch: 0,
  TTL: 60000, // 1 minute
};

export async function getCachedConfig(key, defaultValue) {
  const now = Date.now();
  if (now - configCache.lastFetch > configCache.TTL) {
    try {
      const configs = await db.all('SELECT config_key, config_value FROM dkp_config');
      configCache.values = {};
      for (const c of configs) {
        configCache.values[c.config_key] = c.config_value;
      }
      configCache.lastFetch = now;
    } catch (e) {
      log.error('Config cache refresh failed', e);
    }
  }
  const value = configCache.values[key];
  return value !== undefined ? value : defaultValue;
}

export function invalidateConfigCache() {
  configCache.lastFetch = 0;
}

// ── Email Validation ──
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidEmail = (email) => email && EMAIL_REGEX.test(email.trim());

// ── Raid Week ──
export function getCurrentRaidWeek() {
  const now = new Date();
  const day = now.getDay();

  const wednesday = new Date(now);
  if (day === 0) wednesday.setDate(wednesday.getDate() + 3);
  else if (day === 4) wednesday.setDate(wednesday.getDate() + 6);
  else if (day === 5) wednesday.setDate(wednesday.getDate() + 5);
  else if (day === 6) wednesday.setDate(wednesday.getDate() + 4);
  else if (day < 3) wednesday.setDate(wednesday.getDate() + (3 - day));

  const startOfYear = new Date(wednesday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((wednesday - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${wednesday.getFullYear()}-${weekNumber.toString().padStart(2, '0')}`;
}

// ── DKP Cap ──
export async function addDkpWithCap(tx, userId, amount, capValue = 250) {
  const current = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', userId);
  const currentDkp = current?.current_dkp || 0;
  const newDkp = Math.min(currentDkp + amount, capValue);
  const actualGain = newDkp - currentDkp;

  if (actualGain > 0) {
    await tx.run(`
      UPDATE member_dkp
      SET current_dkp = ?,
          lifetime_gained = lifetime_gained + ?
      WHERE user_id = ?
    `, newDkp, actualGain, userId);
  }

  return { newDkp, actualGain, wasCapped: actualGain < amount };
}
