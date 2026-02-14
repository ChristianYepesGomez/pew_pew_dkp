import { Router } from 'express';
import { success } from '../lib/response.js';

const router = Router();

// Health check (for Docker/Render) — no auth required
router.get('/health', async (req, res) => {
  const checks = {};

  // Database connectivity
  try {
    await req.db.get('SELECT 1');
    checks.database = 'ok';
  } catch (_e) {
    checks.database = 'error';
  }

  const healthy = Object.values(checks).every(v => v === 'ok');
  return success(res, {
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
  }, null, healthy ? 200 : 503);
});

export default router;
