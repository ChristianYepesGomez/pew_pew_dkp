import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express from 'express';

// Initialize Sentry (no-op without DSN)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
}
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { createLogger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { db, initDatabase } from './database.js';
import { initPlatformDatabase } from './platformDb.js';
import { getAllGuilds } from './lib/provisioning.js';
import { getTenantDb, closeAllTenantDbs } from './lib/tenantDb.js';
import { seedRaidData } from './services/raids.js';
import { startBuffManager } from './services/buffManager.js';
import { seedRaidItems, scheduleItemRefresh } from './services/raidItems.js';
import { getAllDungeonItems } from './services/dungeonItems.js';
import { scheduleExistingAuctions, setIO as setAuctionIO } from './lib/auctionScheduler.js';
import { JWT_SECRET, FRONTEND_URL, DISCORD_TOKEN } from './lib/config.js';
import { startBot } from './bot/index.js';

const log = createLogger('Server');

// Route modules
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import blizzardRoutes from './routes/blizzard.js';
import armoryRoutes from './routes/armory.js';
import raidsRoutes from './routes/raids.js';
import importRoutes from './routes/import.js';
import buffsRoutes from './routes/buffs.js';
import bossesRoutes from './routes/bosses.js';
import membersRoutes, { vaultRouter as vaultRoutes } from './routes/members.js';
import charactersRoutes from './routes/characters.js';
import dkpRoutes from './routes/dkp.js';
import calendarRoutes from './routes/calendar.js';
import auctionsRoutes from './routes/auctions.js';
import itemsRoutes from './routes/items.js';
import bisRoutes from './routes/bis.js';
import warcraftlogsRoutes from './routes/warcraftlogs.js';
import analyticsRoutes from './routes/analytics.js';
import onboardingRoutes from './routes/onboarding.js';
import notificationsRoutes from './routes/notifications.js';
import lootCouncilRoutes from './routes/lootCouncil.js';
import epgpRoutes from './routes/epgp.js';
import cooldownsRoutes from './routes/cooldowns.js';

const app = express();

// Trust first proxy (required for rate limiting behind Render/Cloudflare)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const server = createServer(app);

// CORS - support comma-separated origins and strip trailing slashes
const allowedOrigins = FRONTEND_URL
  .split(',')
  .map(u => u.trim().replace(/\/+$/, ''));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};

const io = new Server(server, { cors: corsOptions });

// Give auction scheduler access to Socket.IO for real-time updates
setAuctionIO(io);

// Configuration
const PORT = process.env.PORT || 3000;

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Correlation ID middleware — assigns x-request-id to every request
app.use(requestId);

// Request logging middleware — logs method, path, status, duration, requestId, userId
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log.info('Request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.userId,
    });
  });
  next();
});

// Sentry request context — attach user & request info for error reports
if (process.env.SENTRY_DSN) {
  app.use((req, res, next) => {
    Sentry.setUser(req.user ? { id: req.user.userId, username: req.user.username } : null);
    Sentry.setTag('requestId', req.id);
    Sentry.setContext('request', {
      method: req.method,
      path: req.path,
      requestId: req.id,
    });
    next();
  });
}

// Make io accessible to routes via app.set('io', io) / req.app.get('io')
app.set('io', io);

// Base middleware: inject default guild DB into every request.
// Tenant middleware (resolveTenant) overrides this for multi-tenant requests.
app.use((req, _res, next) => {
  req.db = db;
  next();
});

// Mount extracted route modules
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth/blizzard', blizzardRoutes);
app.use('/api/armory', armoryRoutes);
app.use('/api/raids', raidsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/buffs', buffsRoutes);
app.use('/api/bosses', bossesRoutes);
app.use('/api/members', membersRoutes);
app.use('/api', vaultRoutes);
app.use('/api/characters', charactersRoutes);
app.use('/api/dkp', dkpRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/auctions', auctionsRoutes);
app.use('/api', itemsRoutes);
app.use('/api/bis', bisRoutes);
app.use('/api/warcraftlogs', warcraftlogsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/loot-council', lootCouncilRoutes);
app.use('/api/epgp', epgpRoutes);
app.use('/api/cooldowns', cooldownsRoutes);

// ============================================
// WEBSOCKET HANDLING
// ============================================

// Socket.IO authentication middleware - verify JWT on connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (_err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  log.info('Client connected', { socketId: socket.id, userId: socket.user?.userId });

  // Auto-join guild room if token is scoped to a guild
  if (socket.user?.guildId) {
    socket.join(`guild_${socket.user.guildId}`);
  }

  socket.on('join_guild', (guildId) => {
    socket.join(`guild_${guildId}`);
  });

  socket.on('disconnect', () => {
    log.info('Client disconnected', { socketId: socket.id });
  });
});

// Sentry Express error handler (must be after all routes)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
  log.info(`${signal} received, shutting down gracefully`);

  // Stop accepting new connections
  server.close(() => {
    log.info('HTTP server closed');
  });

  // Close Socket.IO connections
  io.close();

  // Close tenant database connections
  closeAllTenantDbs();

  // Force exit after timeout
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// START SERVER
// ============================================

async function startServer() {
  // Initialize platform database (guilds, platform_users, memberships)
  await initPlatformDatabase();

  // Initialize default guild database (backward compat / single-tenant)
  await initDatabase();

  // Startup tasks for the default guild DB
  await seedRaidData(db);
  await seedRaidItems(db);
  await scheduleExistingAuctions(db);

  // Also run startup tasks for all registered tenant guilds
  try {
    const guilds = await getAllGuilds();
    for (const guild of guilds) {
      try {
        const guildDb = getTenantDb(guild.database_name);
        await seedRaidData(guildDb);
        await seedRaidItems(guildDb);
        await scheduleExistingAuctions(guildDb);
      } catch (err) {
        log.error(`Failed startup tasks for guild ${guild.name}`, err);
      }
    }
    if (guilds.length > 0) {
      log.info(`Completed startup tasks for ${guilds.length} tenant guild(s)`);
    }
  } catch (err) {
    log.warn('Could not load tenant guilds (platform DB may be empty)', err);
  }

  // Start global buff manager for synchronized buff effects
  startBuffManager(db);

  // Schedule weekly raid items refresh from Blizzard API (non-blocking)
  scheduleItemRefresh(db);

  // Pre-warm dungeon items cache so first user request doesn't wait for Blizzard API
  getAllDungeonItems().catch(err => log.warn('Dungeon items warmup failed (non-fatal)', err));

  // Start Discord bot (no-op if DISCORD_TOKEN not set)
  if (DISCORD_TOKEN) {
    startBot(io).catch(err => log.error('Discord bot failed to start', err));
  }

  server.listen(PORT, () => {
    log.info('DKP Backend Server started', { port: PORT, build: 'v4.0 Multi-Tenant' });
  });
}

// Only auto-start when run directly (not imported by tests)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
  startServer().catch((err) => {
    log.error('Fatal: server failed to start', err);
    process.exit(1);
  });
}

// Global error handlers
process.on('unhandledRejection', (reason, _promise) => {
  log.error('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)));
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception', error);
  Sentry.captureException(error);
  Sentry.close(2000).then(() => process.exit(1));
});

export { app, io, startServer };
