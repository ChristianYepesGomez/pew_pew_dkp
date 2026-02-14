import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWT_SECRET, JWT_REFRESH_SECRET } from '../lib/config.js';
import { error } from '../lib/response.js';
import { ErrorCodes } from '../lib/errorCodes.js';

/**
 * Middleware to verify JWT token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return error(res, 'Access token required', 401, ErrorCodes.UNAUTHORIZED);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return error(res, 'Token expired', 401, ErrorCodes.TOKEN_EXPIRED);
    }
    return error(res, 'Invalid token', 403, ErrorCodes.INVALID_TOKEN);
  }
}

/**
 * Middleware to check user role
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
export function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'Authentication required', 401, ErrorCodes.UNAUTHORIZED);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return error(res, 'Insufficient permissions', 403, ErrorCodes.FORBIDDEN, {
        required: allowedRoles,
        current: req.user.role,
      });
    }

    next();
  };
}

/**
 * Generate a short-lived access token (15 minutes)
 */
export function generateAccessToken(user, guildId = null) {
  const payload = { userId: user.id, username: user.username, role: user.role };
  if (guildId) payload.guildId = guildId;
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

/**
 * Generate a long-lived refresh token (30 days) with unique jti
 */
export function generateRefreshToken(user, guildId = null) {
  const payload = { userId: user.id, type: 'refresh', jti: crypto.randomUUID() };
  if (guildId) payload.guildId = guildId;
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

/**
 * Verify and decode a refresh token. Returns decoded payload or null.
 */
export function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') return null;
    return decoded;
  } catch {
    return null;
  }
}
