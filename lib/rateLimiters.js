import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

// In express-rate-limit v7+, max: 0 blocks ALL requests.
// For tests, skip the middleware entirely.
const noopMiddleware = (_req, _res, next) => next();

// Rate limiting for auth endpoints
export const authLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for password reset emails (3 per hour per IP)
export const forgotPasswordLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for sensitive admin operations (DKP, WCL, etc.)
export const adminLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for user operations (bidding, etc.)
export const userLimiter = isTest ? noopMiddleware : rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
