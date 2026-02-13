import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth.js';
import { registerClient, unregisterClient, getActiveBuffs } from '../services/buffManager.js';
import { JWT_SECRET } from '../lib/config.js';

const router = Router();

// SSE endpoint for real-time buff updates
// Note: EventSource doesn't support custom headers, so we accept token as query param
router.get('/stream', (req, res) => {
  // Get token from query param (EventSource workaround) or header
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Generate unique client ID
  const clientId = `${req.user.id}_${Date.now()}`;

  // Register this client
  registerClient(clientId, res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Keep-alive ping every 30s
  const keepAlive = setInterval(() => {
    res.write(`: keepalive\n\n`);
  }, 30000);

  // Cleanup on close
  req.on('close', () => {
    clearInterval(keepAlive);
    unregisterClient(clientId);
  });
});

// Get current active buffs (for initial load)
router.get('/active', authenticateToken, (req, res) => {
  res.json(getActiveBuffs());
});

export default router;
