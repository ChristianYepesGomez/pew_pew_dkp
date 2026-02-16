import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { io as ioClient } from 'socket.io-client';
import { request, setupTestDb, cleanupTestDb, createTestUser, setUserDkp } from './helpers.js';
import { app, io } from '../server.js';

describe('Socket.IO real-time events', () => {
  let httpServer;
  let serverPort;
  let adminToken, _adminId;
  let userToken, userId;

  beforeAll(async () => {
    await setupTestDb();
    await cleanupTestDb();

    const admin = await createTestUser({ role: 'admin' });
    const user = await createTestUser({ role: 'raider' });
    adminToken = admin.token;
    _adminId = admin.userId;
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
      reconnection: false,
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

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.disconnect();
          reject(new Error('Expected connect_error but timed out'));
        }, 5000);

        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          client.disconnect();
          // Server sends "Invalid token" from the auth middleware
          expect(err.message).toContain('Invalid token');
          resolve();
        });

        client.on('connect', () => {
          clearTimeout(timeout);
          client.disconnect();
          reject(new Error('Should not have connected'));
        });
      });
    });

    it('rejects connection without token', async () => {
      const client = ioClient(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          client.disconnect();
          reject(new Error('Expected connect_error but timed out'));
        }, 5000);

        client.on('connect_error', (err) => {
          clearTimeout(timeout);
          client.disconnect();
          expect(err.message).toContain('Authentication required');
          resolve();
        });

        client.on('connect', () => {
          clearTimeout(timeout);
          client.disconnect();
          reject(new Error('Should not have connected without token'));
        });
      });
    });
  });

  // ── DKP events ──
  describe('DKP events', () => {
    it('emits dkp_updated when DKP is adjusted', async () => {
      const client = createClient(adminToken);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { client.disconnect(); reject(new Error('Timeout waiting for dkp_updated')); }, 5000);

        client.on('connect', async () => {
          // Listen for the event BEFORE triggering
          client.on('dkp_updated', (data) => {
            clearTimeout(timeout);
            expect(data).toHaveProperty('userId');
            expect(data).toHaveProperty('newDkp');
            expect(data).toHaveProperty('amount');
            client.disconnect();
            resolve();
          });

          // Trigger the event via API
          try {
            await request
              .post('/api/dkp/adjust')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({ userId, amount: 5, reason: 'Socket test' });
          } catch (err) {
            clearTimeout(timeout);
            client.disconnect();
            reject(err);
          }
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
        const timeout = setTimeout(() => { client.disconnect(); reject(new Error('Timeout waiting for auction_started')); }, 5000);

        client.on('connect', async () => {
          client.on('auction_started', (data) => {
            clearTimeout(timeout);
            expect(data).toHaveProperty('id');
            client.disconnect();
            resolve();
          });

          try {
            await request
              .post('/api/auctions')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({ itemName: 'Socket Test Item', durationMinutes: 5 });
          } catch (err) {
            clearTimeout(timeout);
            client.disconnect();
            reject(err);
          }
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
