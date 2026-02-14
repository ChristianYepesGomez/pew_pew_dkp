import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// Only enable encryption if key is configured
const keyBuffer = ENCRYPTION_KEY ? Buffer.from(ENCRYPTION_KEY, 'hex') : null;

if (ENCRYPTION_KEY && (!keyBuffer || keyBuffer.length !== 32)) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}

export function encryptToken(plaintext) {
  if (!plaintext || !keyBuffer) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptToken(ciphertext) {
  if (!ciphertext || !keyBuffer) return ciphertext;
  try {
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    return ciphertext; // Return as-is if decryption fails (e.g., legacy unencrypted data)
  }
}
