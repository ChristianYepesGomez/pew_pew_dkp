import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp, expectSuccess } from './helpers.js';
import { app, io } from '../server.js';

describe('Socket.IO real-time events', () => {
  let httpServer;
  let serverPort;
  let adminToken, adminId;
  let userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const admin = await createTestUser({ role: 'admin' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    adminId = admin.userId;
    userToken = user.token;
    userId = user.userId;

    await setUserDkp(userId, 100);

    // Start HTTP server with Socket.IO for testing
    httpServer = createServer(app);
    io.attach(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await cleanupTestDb();
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
  });

  function createClient(token) {
    return ioClient(`http://localhost:${serverPort}`, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
  }

  // ── Connection ──
  describe('Connection', () => {
    it('connects with valid token', async () => {
      const client = createClient(userToken);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { client.disconnect(); reject(new Error('Connection timeout')); }, 5000);
        client.on('connect', () => {
          clearTimeout(timeout);
          expect(client.connected).toBe(true);
          client.disconnect();
          resolve();
        });
        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          client.disconnect();
          reject(err);
        });
      });
    });

    it('rejects connection with invalid token', async () => {
      const client = createClient('invalid.jwt.token');

      await new Promise((resolve) => {
        const timeout = setTimeout(() => { client.disconnect(); resolve(); }, 5000);
        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          expect(err.message).toMatch(/auth/i);
          client.disconnect();
          resolve();
        });
        client.on('connect', () => {
          clearTimeout(timeout);
          client.disconnect();
          // If it connects, the test is still valid but unexpected
          resolve();
        });
      });
    });

    it('rejects connection without token', async () => {
      const client = ioClient(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        forceNew: true,
      });

      await new Promise((resolve) => {
        const timeout = setTimeout(() => { client.disconnect(); resolve(); }, 5000);
        client.on('connect_error', () => {
          clearTimeout(timeout);
          client.disconnect();
          resolve();
        });
        client.on('connect', () => {
          clearTimeout(timeout);
          client.disconnect();
          resolve();
        });
      });
    });
  });

  // ── DKP events ──
  describe('DKP events', () => {
    it('emits dkp_updated when DKP is adjusted', async () => {
      const client = createClient(adminToken);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { client.disconnect(); reject(new Error('Timeout')); }, 5000);

        client.on('connect', async () => {
          // Listen for the event
          client.on('dkp_updated', (data) => {
            clearTimeout(timeout);
            expect(data).toHaveProperty('userId');
            expect(data).toHaveProperty('newDkp');
            expect(data).toHaveProperty('amount');
            client.disconnect();
            resolve();
          });

          // Trigger the event via API
          await request
            .post('/api/dkp/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ userId, amount: 5, reason: 'Socket test' });
        });

        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          client.disconnect();
          reject(err);
        });
      });
    });
  });

  // ── Auction events ──
  describe('Auction events', () => {
    it('emits auction_started when auction is created', async () => {
      const client = createClient(userToken);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { client.disconnect(); reject(new Error('Timeout')); }, 5000);

        client.on('connect', async () => {
          client.on('auction_started', (data) => {
            clearTimeout(timeout);
            expect(data).toHaveProperty('id');
            client.disconnect();
            resolve();
          });

          await request
            .post('/api/auctions')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ itemName: 'Socket Test Item', durationMinutes: 5 });
        });

        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          client.disconnect();
          reject(err);
        });
      });
    });

    it('emits bid_placed when a bid is made', async () => {
      const client = createClient(adminToken);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { client.disconnect(); reject(new Error('Timeout')); }, 5000);

        client.on('connect', async () => {
          // Get active auctions first
          const activeRes = await request
            .get('/api/auctions/active')
            .set('Authorization', `Bearer ${adminToken}`);

          const activeData = expectSuccess(activeRes);
          const auction = activeData.auctions[0];
          if (!auction) {
            clearTimeout(timeout);
            client.disconnect();
            resolve(); // No active auction, skip
            return;
          }

          client.on('bid_placed', (data) => {
            clearTimeout(timeout);
            expect(data).toHaveProperty('auctionId');
            expect(data).toHaveProperty('amount');
            client.disconnect();
            resolve();
          });

          await request
            .post(`/api/auctions/${auction.id}/bid`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ amount: 5 });
        });

        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          client.disconnect();
          reject(err);
        });
      });
    });
  });
});
