import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { authLimiter } from '../lib/rateLimiters.js';
import { getBlizzardOAuthUrl, getUserToken, getUserCharacters, isBlizzardOAuthConfigured } from '../services/blizzardAPI.js';
import { JWT_SECRET, FRONTEND_URL } from '../lib/config.js';

const router = Router();

function toBase64Url(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

// Get Blizzard OAuth authorization URL
router.get('/url', authenticateToken, (req, res) => {
  if (!isBlizzardOAuthConfigured()) {
    return res.status(503).json({ error: 'Blizzard API not configured' });
  }

  const state = jwt.sign(
    { userId: req.user.userId, type: 'blizzard_oauth' },
    JWT_SECRET,
    { expiresIn: '10m' }
  );

  const protocol = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
  const host = req.get('host');
  const redirectUri = `${protocol}://${host}/api/auth/blizzard/callback`;

  const url = getBlizzardOAuthUrl(redirectUri, state);
  res.json({ url, configured: true });
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

  let decoded;
  try {
    decoded = jwt.verify(state, JWT_SECRET);
    if (decoded.type !== 'blizzard_oauth') {
      return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Invalid state parameter' })}`);
    }
  } catch {
    return res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Expired or invalid state. Please try again.' })}`);
  }

  try {
    const protocol = (req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
    const host = req.get('host');
    const redirectUri = `${protocol}://${host}/api/auth/blizzard/callback`;

    const userToken = await getUserToken(code, redirectUri);
    const characters = await getUserCharacters(userToken);

    console.log(`Blizzard OAuth: fetched ${characters.length} characters for user ${decoded.userId}`);
    res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ characters })}`);
  } catch (err) {
    console.error('Blizzard OAuth callback error:', err.message);
    res.redirect(`${frontendUrl}/blizzard-callback.html#data=${toBase64Url({ error: 'Failed to fetch characters from Blizzard. Please try again.' })}`);
  }
});

export default router;
