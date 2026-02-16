import { randomUUID } from 'crypto';

/**
 * Assigns a unique request ID to each incoming request.
 * Uses the client-provided x-request-id header if present, otherwise generates a new UUID.
 */
export function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
