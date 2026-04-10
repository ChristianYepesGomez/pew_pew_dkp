import { createLogger } from './logger.js';

const log = createLogger('DBResilience');

// ── Retryable error detection ──────────────────────────────────

const RETRYABLE_CODES = new Set([
  'SQLITE_BUSY', 'SQLITE_LOCKED',
  'CONNECT_TIMEOUT', 'ECONNREFUSED', 'ECONNRESET',
  'FETCH_ERROR', 'UND_ERR_CONNECT_TIMEOUT',
  'HRANA_WEBSOCKET_ERROR', 'PROXY_ERROR',
]);

const NON_RETRYABLE_CODES = new Set([
  'SQLITE_CONSTRAINT', 'SQL_INPUT_ERROR', 'SQLITE_ERROR',
  'SQLITE_RANGE', 'SQLITE_MISMATCH',
]);

function isRetryable(err) {
  const code = err.code || err.rawCode || '';
  if (NON_RETRYABLE_CODES.has(code)) return false;
  if (RETRYABLE_CODES.has(code)) return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('network') || msg.includes('timeout') ||
    msg.includes('econnrefused') || msg.includes('econnreset') ||
    msg.includes('fetch failed') || msg.includes('socket hang up');
}

// ── Circuit Breaker ────────────────────────────────────────────

const CLOSED = 'CLOSED';
const OPEN = 'OPEN';
const HALF_OPEN = 'HALF_OPEN';

class CircuitBreaker {
  constructor(label, { failureThreshold = 5, cooldownMs = 30_000 } = {}) {
    this.label = label;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.state = CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  async execute(fn) {
    if (this.state === OPEN) {
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = HALF_OPEN;
        log.info(`Circuit half-open, testing connection`, { label: this.label });
      } else {
        throw new CircuitOpenError(this.label);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === HALF_OPEN) {
      log.info(`Circuit closed, connection restored`, { label: this.label });
    }
    this.failures = 0;
    this.state = CLOSED;
  }

  _onFailure(err) {
    if (!isRetryable(err)) return;
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = OPEN;
      log.error(`Circuit OPEN after ${this.failures} failures`, { label: this.label, error: err.message });
    }
  }

  getState() {
    return { state: this.state, failures: this.failures, lastFailure: this.lastFailureTime || null };
  }
}

export class CircuitOpenError extends Error {
  constructor(label) {
    super(`Database circuit breaker OPEN (${label}) — service temporarily unavailable`);
    this.name = 'CircuitOpenError';
    this.statusCode = 503;
  }
}

// ── Retry with exponential backoff ─────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry(fn, label, { maxAttempts = 3, baseDelayMs = 200, maxDelayMs = 5000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err;
      const jitter = Math.random() * 100;
      const delay = Math.min(baseDelayMs * 2 ** attempt + jitter, maxDelayMs);
      log.warn(`DB retry ${attempt + 1}/${maxAttempts - 1}`, { label, error: err.message, delayMs: Math.round(delay) });
      await sleep(delay);
    }
  }
  throw lastError;
}

// ── Resilient Executor (composes circuit breaker + retry) ──────

export function createResilientExecutor(label = 'db') {
  const breaker = new CircuitBreaker(label);

  return {
    execute(fn) {
      return breaker.execute(() => withRetry(fn, label));
    },
    getState() {
      return breaker.getState();
    },
  };
}
