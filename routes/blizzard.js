import { Router } from 'express';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../lib/rateLimiters.js';
import { getBlizzardOAuthUrl, getUserToken, getUserCharacters, isBlizzardOAuthConfigured } from '../services/blizzardAPI.js';
import { FRONTEND_URL } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Blizzard');
const router = Router();

// ── OAuth CSRF State Protection ──
const OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET;
if (isBlizzardOAuthConfigured() && !OAUTH_STATE_SECRET) {
  throw new Error('FATAL: OAUTH_STATE_SECRET env var must be set when Blizzard OAuth is configured');
}

function signState(data) {
  const payload = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');
}

function verifyState(state) {
  try {
    const { payload, hmac } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const expected = crypto.createHmac('sha256', OAUTH_STATE_SECRET).update(payload).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    const data = JSON.parse(payload);
    // Reject states older than 10 minutes
    if (Date.now() - data.ts > 10 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

function toBase64Url(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

// Get Blizzard OAuth authorization URL
router.get('/url', authenticateToken, (req, res) => {
  if (!isBlizzardOAuthConfigured()) {
    return error(res, 'Blizzard API not configured', 503, ErrorCodes.EXTERNAL_API_ERROR);
  }

  const state = signState({ userId: req.user.userId, ts: Date.now() });

  const protocol = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/auth/blizzard/callback`;

  const url = getBlizzardOAuthUrl(redirectUri, state);
  return success(res, { url, configured: true });
});

// Blizzard OAuth callback - redirects popup to frontend for same-origin postMessage
router.get('/callback', authLimiter, async (req, res) => {
  const { code, state, error: authError } = req.query;
  const frontendUrl = FRONTEND_URL.split(',')[0].trim().replace(/\/+$/, '');

  if (authError) {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Authorization denied by user' })}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Missing authorization code' })}`);
  }

  // Verify CSRF state
  const stateData = verifyState(state);
  if (!stateData) {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Expired or invalid state. Please try again.' })}`);
  }

  try {
    const protocol = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/blizzard/callback`;

    const userToken = await getUserToken(code, redirectUri);
    const characters = await getUserCharacters(userToken);

    log.info(`Blizzard OAuth: fetched ${characters.length} characters for user ${stateData.userId}`);
    res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ characters })}`);
  } catch (err) {
    log.error('Blizzard OAuth callback error', err);
    res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Failed to fetch characters from Blizzard. Please try again.' })}`);
  }
});

export default router;
