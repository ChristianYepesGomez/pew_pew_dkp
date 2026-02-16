import { Router } from 'express';
import webPush from 'web-push';
import { authenticateToken } from '../middleware/auth.js';
import { userLimiter } from '../lib/rateLimiters.js';
import { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } from '../lib/config.js';
import { createLogger } from '../lib/logger.js';
import { success, error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

const log = createLogger('Route:Notifications');
const router = Router();

// Configure web-push with VAPID keys (if available)
const pushEnabled = VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY;
if (pushEnabled) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  log.info('Web Push configured with VAPID keys');
} else {
  log.warn('Web Push disabled — VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set');
}

// GET /api/notifications/vapid-public-key — return VAPID public key for frontend subscription
router.get('/vapid-public-key', authenticateToken, (_req, res) => {
  if (!pushEnabled) {
    return error(res, 'Push notifications not configured', 503, ErrorCodes.EXTERNAL_API_ERROR);
  }
  return success(res, { publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/notifications/subscribe — register a push subscription
router.post('/subscribe', authenticateToken, userLimiter, async (req, res) => {
  if (!pushEnabled) {
    return error(res, 'Push notifications not configured', 503, ErrorCodes.EXTERNAL_API_ERROR);
  }

  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return error(res, 'Invalid push subscription: endpoint and keys (p256dh, auth) required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    // Upsert: if this endpoint already exists for this user, update keys
    const existing = await req.db.get(
      'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      req.user.userId, endpoint
    );

    if (existing) {
      await req.db.run(
        'UPDATE push_subscriptions SET keys_p256dh = ?, keys_auth = ?, created_at = datetime(\'now\') WHERE id = ?',
        keys.p256dh, keys.auth, existing.id
      );
    } else {
      await req.db.run(
        'INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth) VALUES (?, ?, ?, ?)',
        req.user.userId, endpoint, keys.p256dh, keys.auth
      );
    }

    // Ensure notification preferences row exists with defaults
    await req.db.run(
      `INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)`,
      req.user.userId
    );

    log.info('Push subscription registered', { userId: req.user.userId });
    return success(res, null, 'Subscribed to push notifications');
  } catch (err) {
    log.error('Failed to register push subscription', err);
    return error(res, 'Failed to register push subscription', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// DELETE /api/notifications/subscribe — unregister a push subscription
router.delete('/subscribe', authenticateToken, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return error(res, 'Endpoint required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const result = await req.db.run(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      req.user.userId, endpoint
    );

    if (result.changes === 0) {
      return error(res, 'Subscription not found', 404, ErrorCodes.NOT_FOUND);
    }

    log.info('Push subscription removed', { userId: req.user.userId });
    return success(res, null, 'Unsubscribed from push notifications');
  } catch (err) {
    log.error('Failed to remove push subscription', err);
    return error(res, 'Failed to remove push subscription', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// GET /api/notifications/preferences — get user's notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    let prefs = await req.db.get(
      'SELECT outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council FROM notification_preferences WHERE user_id = ?',
      req.user.userId
    );

    if (!prefs) {
      // Create defaults
      await req.db.run('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)', req.user.userId);
      prefs = { outbid: 1, bis_auction: 1, raid_reminder: 1, dkp_adjusted: 0, loot_council: 0 };
    }

    return success(res, { preferences: prefs });
  } catch (err) {
    log.error('Failed to get notification preferences', err);
    return error(res, 'Failed to get notification preferences', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// PUT /api/notifications/preferences — update notification preferences
router.put('/preferences', authenticateToken, userLimiter, async (req, res) => {
  const { outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council } = req.body;

  // Validate: all values must be 0 or 1 (if provided)
  const fields = { outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council };
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined && val !== 0 && val !== 1) {
      return error(res, `Invalid value for ${key}: must be 0 or 1`, 400, ErrorCodes.VALIDATION_ERROR);
    }
  }

  try {
    // Ensure row exists
    await req.db.run('INSERT OR IGNORE INTO notification_preferences (user_id) VALUES (?)', req.user.userId);

    // Build dynamic UPDATE with only provided fields
    const updates = [];
    const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (updates.length === 0) {
      return error(res, 'No preferences to update', 400, ErrorCodes.VALIDATION_ERROR);
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.user.userId);

    await req.db.run(
      `UPDATE notification_preferences SET ${updates.join(', ')} WHERE user_id = ?`,
      ...values
    );

    const updated = await req.db.get(
      'SELECT outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council FROM notification_preferences WHERE user_id = ?',
      req.user.userId
    );

    log.info('Notification preferences updated', { userId: req.user.userId });
    return success(res, { preferences: updated });
  } catch (err) {
    log.error('Failed to update notification preferences', err);
    return error(res, 'Failed to update notification preferences', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// ── Helper: send push notification to a user ──
// Used by other modules (auctions, calendar, dkp) to trigger push notifications.
// Accepts db parameter for multi-tenant support.
export async function sendPushToUser(db, userId, payload) {
  if (!pushEnabled) return;

  const subscriptions = await db.all(
    'SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?',
    userId
  );

  const notification = JSON.stringify(payload);

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
    };

    try {
      await webPush.sendNotification(pushSubscription, notification);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or invalid — clean up
        await db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', sub.endpoint);
        log.info('Removed expired push subscription', { userId, endpoint: sub.endpoint });
      } else {
        log.error('Push notification failed', err);
      }
    }
  }
}

// ── Helper: send push notification to a user (with preference check) ──
export async function notifyUser(db, userId, type, payload) {
  if (!pushEnabled) return;

  const prefs = await db.get(
    'SELECT outbid, bis_auction, raid_reminder, dkp_adjusted, loot_council FROM notification_preferences WHERE user_id = ?',
    userId
  );

  // If no preferences row, use defaults (outbid + bis_auction + raid_reminder = on)
  const defaults = { outbid: 1, bis_auction: 1, raid_reminder: 1, dkp_adjusted: 0, loot_council: 0 };
  const effectivePrefs = prefs || defaults;

  if (!effectivePrefs[type]) return;

  await sendPushToUser(db, userId, payload);
}

export default router;
