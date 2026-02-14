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
import { initDatabase } from './database.js';
import { seedRaidData } from './services/raids.js';
import { startBuffManager } from './services/buffManager.js';
import { scheduleExistingAuctions, setIO as setAuctionIO } from './lib/auctionScheduler.js';
import { JWT_SECRET, FRONTEND_URL } from './lib/config.js';

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
app.use(express.json());

// Make io accessible to routes via app.set('io', io) / req.app.get('io')
app.set('io', io);

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
  console.log('Client connected:', socket.id, '- user:', socket.user?.userId);

  socket.on('join_guild', (guildId) => {
    socket.join(`guild_${guildId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Sentry Express error handler (must be after all routes)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ============================================
// START SERVER
// ============================================

async function startServer() {
  await initDatabase();
  await seedRaidData();
  await scheduleExistingAuctions();

  // Start global buff manager for synchronized buff effects
  startBuffManager();

  server.listen(PORT, () => {
    console.log('==========================================');
    console.log('  DKP Backend Server - BUILD v3.0 Turso');
    console.log('==========================================');
    console.log(`🎮 DKP Server running on port ${PORT}`);
    console.log(`📡 WebSocket ready for real-time updates`);
    console.log(`🌟 Global buff manager active`);
  });
}

// Only auto-start when run directly (not imported by tests)
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isMainModule) {
  startServer();
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  Sentry.captureException(reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  Sentry.captureException(error);
  Sentry.close(2000).then(() => process.exit(1));
});

export { app, io, startServer };
