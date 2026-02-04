/**
 * Auction Stress Test
 *
 * Simulates 20 concurrent users bidding on an auction simultaneously
 * to detect race conditions, data integrity issues, and concurrency bugs.
 *
 * Usage: node tests/auction-stress-test.js
 *
 * Requires the local server to be running on port 3000.
 */

import axios from 'axios';
import { io as ioClient } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000/api';
const WS_URL = 'http://localhost:3000';
const NUM_USERS = 20;
const DKP_PER_USER = 1000;
const TEST_PASSWORD = 'StressTest123!';

// ── Helpers ──────────────────────────────────────────────────────────

function api(token) {
  return axios.create({
    baseURL: BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true, // Don't throw on non-2xx
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ FAIL: ${msg}`);
  }
}

// ── Setup ────────────────────────────────────────────────────────────

async function loginOrCreateAdmin() {
  // Try logging in first
  let res = await api().post('/auth/login', {
    username: 'stress_admin',
    password: TEST_PASSWORD,
  });

  if (res.status === 200) return res.data.token;

  // No admin exists yet — we can't create one via API without auth.
  // Create a bootstrap admin by registering the first user (if possible)
  // or using an existing admin account.

  // Try with common admin accounts
  for (const cred of [
    { username: 'admin', password: 'admin' },
    { username: 'admin', password: 'admin123' },
    { username: 'Admin', password: 'admin' },
  ]) {
    res = await api().post('/auth/login', cred);
    if (res.status === 200) {
      // Use this admin to create our test admin
      const adminToken = res.data.token;
      const createRes = await api(adminToken).post('/members', {
        username: 'stress_admin',
        password: TEST_PASSWORD,
        characterName: 'StressAdmin',
        characterClass: 'Warrior',
        raidRole: 'Tank',
        role: 'admin',
        initialDkp: 5000,
      });
      if (createRes.status === 201) {
        const loginRes = await api().post('/auth/login', {
          username: 'stress_admin',
          password: TEST_PASSWORD,
        });
        return loginRes.data.token;
      }
    }
  }

  throw new Error(
    'Cannot find or create an admin user. Please create one manually:\n' +
    '  username: stress_admin, password: StressTest123!, role: admin'
  );
}

async function createTestUsers(adminToken) {
  console.log(`\n── Creating ${NUM_USERS} test users ──`);
  const users = [];

  for (let i = 1; i <= NUM_USERS; i++) {
    const username = `stressuser${i}`;
    const characterName = `TestChar${i}`;
    const classes = ['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid', 'Death Knight'];
    const charClass = classes[i % classes.length];

    // Try login first (user might already exist)
    let loginRes = await api().post('/auth/login', {
      username,
      password: TEST_PASSWORD,
    });

    if (loginRes.status === 200) {
      users.push({
        id: loginRes.data.user.id,
        username,
        characterName: loginRes.data.user.characterName,
        token: loginRes.data.token,
      });
      continue;
    }

    // Create the user
    const createRes = await api(adminToken).post('/members', {
      username,
      password: TEST_PASSWORD,
      characterName,
      characterClass: charClass,
      raidRole: 'DPS',
      role: 'raider',
      initialDkp: DKP_PER_USER,
    });

    if (createRes.status !== 201) {
      console.error(`  Failed to create ${username}: ${createRes.data?.error}`);
      continue;
    }

    loginRes = await api().post('/auth/login', { username, password: TEST_PASSWORD });
    users.push({
      id: loginRes.data.user.id,
      username,
      characterName,
      token: loginRes.data.token,
    });
  }

  console.log(`  Created/loaded ${users.length} users`);
  return users;
}

async function ensureUserDkp(adminToken, users) {
  // Reset all test users to DKP_PER_USER
  for (const u of users) {
    // Get current DKP
    const meRes = await api(u.token).get('/auth/me');
    const currentDkp = meRes.data?.currentDkp ?? 0;
    const diff = DKP_PER_USER - currentDkp;
    if (diff !== 0) {
      await api(adminToken).post('/dkp/adjust', {
        userId: u.id,
        amount: diff,
        reason: 'Stress test DKP reset',
      });
    }
  }
  console.log(`  All users reset to ${DKP_PER_USER} DKP`);
}

async function createAuction(adminToken) {
  const res = await api(adminToken).post('/auctions', {
    itemName: 'Stress Test Item',
    itemNameEN: 'Stress Test Item',
    itemImage: '🎁',
    itemRarity: 'epic',
    minBid: 0,
    itemId: 242394,
    durationMinutes: 10, // Long enough for the test
  });

  if (res.status !== 201) {
    throw new Error(`Failed to create auction: ${JSON.stringify(res.data)}`);
  }
  console.log(`  Auction created: id=${res.data.id}`);
  return res.data;
}

async function cancelAllActiveAuctions(adminToken) {
  const res = await api(adminToken).get('/auctions/active');
  if (res.data?.auctions?.length) {
    for (const a of res.data.auctions) {
      await api(adminToken).post(`/auctions/${a.id}/cancel`);
    }
    console.log(`  Cancelled ${res.data.auctions.length} active auctions`);
  }
}

async function getAuctionBids(adminToken, auctionId) {
  // Read bids from the active auctions endpoint
  const res = await api(adminToken).get('/auctions/active');
  // Use == for comparison (API may return number or string)
  const auction = res.data?.auctions?.find(a => Number(a.id) === Number(auctionId));
  return auction?.bids || [];
}

// ── Test Scenarios ───────────────────────────────────────────────────

async function test1_simultaneousBidsDifferentAmounts(adminToken, users, auctionId) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('TEST 1: 20 users bid simultaneously with different amounts');
  console.log('══════════════════════════════════════════════════════');

  // Each user bids a unique amount: 10, 20, 30, ... 200
  const bidPromises = users.map((u, i) => {
    const amount = (i + 1) * 10;
    return api(u.token)
      .post(`/auctions/${auctionId}/bid`, { amount })
      .then(res => ({ user: u.username, amount, status: res.status, data: res.data }));
  });

  const results = await Promise.all(bidPromises);

  const successes = results.filter(r => r.status === 200);
  const failures = results.filter(r => r.status !== 200);

  console.log(`  Results: ${successes.length} succeeded, ${failures.length} failed`);

  // In a correct system, NOT all bids can succeed because each bid must be
  // higher than the current highest. Only bids that arrive in ascending order succeed.
  // But with unique amounts sent simultaneously, the outcome depends on server processing order.

  // Check: at least one bid should succeed (the first one processed)
  assert(successes.length >= 1, `At least 1 bid succeeded (got ${successes.length})`);

  // Check database state
  const bids = await getAuctionBids(adminToken, auctionId);
  const userBidCounts = {};
  for (const b of bids) {
    userBidCounts[b.userId] = (userBidCounts[b.userId] || 0) + 1;
  }

  // CRITICAL: No user should have more than 1 bid (UNIQUE constraint)
  const duplicates = Object.entries(userBidCounts).filter(([, count]) => count > 1);
  assert(duplicates.length === 0, `No duplicate bids per user (found ${duplicates.length} users with duplicates)`);

  // Check highest bid is actually the max
  const maxBid = Math.max(...bids.map(b => b.amount));
  const bidAmounts = bids.map(b => b.amount).sort((a, b) => a - b);
  console.log(`  Bids in DB: ${bids.length}, amounts: [${bidAmounts.join(', ')}]`);
  console.log(`  Highest bid: ${maxBid}`);

  return { successes: successes.length, failures: failures.length, bidsInDb: bids.length };
}

async function test2_sameAmountRace(adminToken, users, auctionId) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('TEST 2: 10 users bid the SAME amount simultaneously');
  console.log('══════════════════════════════════════════════════════');

  // First, place an initial bid to set a baseline
  await api(users[0].token).post(`/auctions/${auctionId}/bid`, { amount: 300 });
  await sleep(100);

  // Now 10 users all try to bid 500 at the same time
  const racers = users.slice(1, 11);
  const bidPromises = racers.map(u =>
    api(u.token)
      .post(`/auctions/${auctionId}/bid`, { amount: 500 })
      .then(res => ({ user: u.username, status: res.status, data: res.data }))
  );

  const results = await Promise.all(bidPromises);
  const successes = results.filter(r => r.status === 200);
  const failures = results.filter(r => r.status !== 200);

  console.log(`  Results: ${successes.length} succeeded, ${failures.length} failed`);

  // Check DB state
  const bids = await getAuctionBids(adminToken, auctionId);
  const bids500 = bids.filter(b => b.amount === 500);

  // With proper concurrency control, only 1 user should have a bid of 500
  // because after the first succeeds, subsequent ones should fail
  // ("bid must be higher than current highest bid")
  // But WITHOUT proper locking, multiple users might all pass the check
  console.log(`  Bids of 500 DKP in DB: ${bids500.length}`);
  assert(bids500.length <= 1, `At most 1 bid of 500 DKP should exist (got ${bids500.length}) - RACE CONDITION if >1`);

  return { bids500Count: bids500.length, totalBids: bids.length };
}

async function test3_dkpOvercommit(adminToken, users, auctionId) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('TEST 3: Same user overbids DKP across simultaneous auctions');
  console.log('══════════════════════════════════════════════════════');

  // Create a second auction
  const auction2 = await createAuction(adminToken);

  const user = users[0]; // Has 1000 DKP

  // Simultaneously bid 900 DKP on both auctions
  const [res1, res2] = await Promise.all([
    api(user.token).post(`/auctions/${auctionId}/bid`, { amount: 900 }),
    api(user.token).post(`/auctions/${auction2.id}/bid`, { amount: 900 }),
  ]);

  console.log(`  Auction 1 bid (900): ${res1.status} - ${JSON.stringify(res1.data)}`);
  console.log(`  Auction 2 bid (900): ${res2.status} - ${JSON.stringify(res2.data)}`);

  const bothSucceeded = res1.status === 200 && res2.status === 200;
  assert(!bothSucceeded,
    `User with 1000 DKP should NOT succeed bidding 900 on two auctions (${res1.status}, ${res2.status}) - RACE CONDITION if both succeed`
  );

  // Check total committed DKP
  const bids1 = await getAuctionBids(adminToken, auctionId);
  const bids2 = await getAuctionBids(adminToken, auction2.id);

  const userBid1 = bids1.find(b => Number(b.userId) === Number(user.id));
  const userBid2 = bids2.find(b => Number(b.userId) === Number(user.id));
  const totalCommitted = (userBid1?.amount || 0) + (userBid2?.amount || 0);

  console.log(`  User committed: ${userBid1?.amount || 0} + ${userBid2?.amount || 0} = ${totalCommitted} DKP (has ${DKP_PER_USER})`);
  assert(totalCommitted <= DKP_PER_USER,
    `Total committed DKP (${totalCommitted}) should not exceed balance (${DKP_PER_USER}) - OVERCOMMIT if exceeded`
  );

  // Cancel the second auction for cleanup
  await api(adminToken).post(`/auctions/${auction2.id}/cancel`);

  return { bothSucceeded, totalCommitted };
}

async function test4_rapidFireSameUser(adminToken, users, auctionId) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('TEST 4: Single user sends 20 rapid-fire bids');
  console.log('══════════════════════════════════════════════════════');

  const user = users[1]; // Use a different user

  // Send 20 bids in rapid succession (10, 20, 30, ... 200)
  const bidPromises = [];
  for (let i = 1; i <= 20; i++) {
    bidPromises.push(
      api(user.token)
        .post(`/auctions/${auctionId}/bid`, { amount: i * 50 })
        .then(res => ({ amount: i * 50, status: res.status, data: res.data }))
    );
  }

  const results = await Promise.all(bidPromises);
  const successes = results.filter(r => r.status === 200);
  const failures = results.filter(r => r.status !== 200);

  console.log(`  Results: ${successes.length} succeeded, ${failures.length} failed`);

  // Check DB - user should have exactly 1 bid (the highest successful one)
  const bids = await getAuctionBids(adminToken, auctionId);
  const userBids = bids.filter(b => Number(b.userId) === Number(user.id));

  assert(userBids.length === 1, `User should have exactly 1 bid in DB (got ${userBids.length})`);

  if (userBids.length === 1) {
    console.log(`  Final bid amount: ${userBids[0].amount}`);
  }

  return { successes: successes.length, userBidCount: userBids.length };
}

async function test5_escalatingBidWar(adminToken, users, auctionId) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('TEST 5: Simulated bid war - 20 users escalate bids');
  console.log('══════════════════════════════════════════════════════');

  // 5 rounds of bidding, each round all users try to outbid
  const allResults = [];

  for (let round = 1; round <= 5; round++) {
    const baseAmount = round * 100;
    const roundPromises = users.map((u, i) => {
      const amount = baseAmount + i + 1; // Slightly different amounts
      return api(u.token)
        .post(`/auctions/${auctionId}/bid`, { amount })
        .then(res => ({
          round, user: u.username, amount, status: res.status, error: res.data?.error,
        }));
    });

    const roundResults = await Promise.all(roundPromises);
    allResults.push(...roundResults);

    const roundSuccesses = roundResults.filter(r => r.status === 200).length;
    console.log(`  Round ${round}: ${roundSuccesses}/${users.length} bids succeeded (amounts: ${baseAmount + 1}-${baseAmount + users.length})`);
  }

  // Final state check
  const bids = await getAuctionBids(adminToken, auctionId);
  const uniqueUsers = new Set(bids.map(b => b.userId));
  const maxBid = Math.max(...bids.map(b => b.amount));

  assert(uniqueUsers.size === bids.length, `Each user has at most 1 bid (${uniqueUsers.size} unique users, ${bids.length} bids)`);
  console.log(`  Final state: ${bids.length} bids from ${uniqueUsers.size} users, highest: ${maxBid}`);

  // Check all bids are valid (amount > 0, user has enough DKP)
  for (const bid of bids) {
    const meRes = await api(users.find(u => Number(u.id) === Number(bid.userId))?.token || adminToken).get('/auth/me');
    const dkp = meRes.data?.currentDkp ?? 0;
    if (bid.amount > dkp) {
      console.log(`  WARNING: User ${bid.userId} has bid ${bid.amount} but only ${dkp} DKP`);
    }
  }

  return { totalBids: bids.length, uniqueUsers: uniqueUsers.size, maxBid };
}

async function test6_socketEventConsistency(adminToken, users, auctionId) {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('TEST 6: Socket events arrive for all successful bids');
  console.log('══════════════════════════════════════════════════════');

  const receivedEvents = [];
  const socket = ioClient(WS_URL);

  await new Promise((resolve) => {
    socket.on('connect', resolve);
    setTimeout(resolve, 2000); // Timeout after 2s
  });

  socket.on('bid_placed', (data) => {
    receivedEvents.push(data);
  });

  await sleep(200); // Let socket stabilize

  // 10 users bid with ascending amounts
  const bidders = users.slice(0, 10);
  const bidPromises = bidders.map((u, i) => {
    const amount = 600 + (i + 1) * 5; // 605, 610, 615, ...
    return api(u.token)
      .post(`/auctions/${auctionId}/bid`, { amount })
      .then(res => ({ user: u.username, amount, status: res.status }));
  });

  const results = await Promise.all(bidPromises);
  const successes = results.filter(r => r.status === 200);

  // Wait for socket events to arrive
  await sleep(1000);

  console.log(`  HTTP successes: ${successes.length}`);
  console.log(`  Socket events received: ${receivedEvents.length}`);

  assert(receivedEvents.length === successes.length,
    `Socket events (${receivedEvents.length}) should match successful bids (${successes.length})`
  );

  // Verify event data integrity
  for (const evt of receivedEvents) {
    assert(evt.auctionId !== undefined, `Event has auctionId`);
    assert(evt.amount > 0, `Event amount > 0 (${evt.amount})`);
    assert(evt.characterName, `Event has characterName (${evt.characterName})`);
  }

  socket.disconnect();

  return { httpSuccesses: successes.length, socketEvents: receivedEvents.length };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║        AUCTION SYSTEM STRESS TEST                   ║');
  console.log('║        20 concurrent users, race conditions         ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  try {
    // Verify server is running
    const healthRes = await api().get('/../../health');
    if (healthRes.status !== 200) {
      throw new Error('Server not running at localhost:3000. Start it with: node server.js');
    }
    console.log('Server is healthy');

    // Setup
    const adminToken = await loginOrCreateAdmin();
    console.log('Admin authenticated');

    const users = await createTestUsers(adminToken);
    if (users.length < NUM_USERS) {
      console.warn(`  WARNING: Only ${users.length}/${NUM_USERS} users available`);
    }

    await cancelAllActiveAuctions(adminToken);
    await ensureUserDkp(adminToken, users);

    // ── Run Tests ──

    // Test 1: Simultaneous different amounts
    const auction1 = await createAuction(adminToken);
    await test1_simultaneousBidsDifferentAmounts(adminToken, users, auction1.id);
    await api(adminToken).post(`/auctions/${auction1.id}/cancel`);

    // Test 2: Same amount race
    await ensureUserDkp(adminToken, users);
    const auction2 = await createAuction(adminToken);
    await test2_sameAmountRace(adminToken, users, auction2.id);
    await api(adminToken).post(`/auctions/${auction2.id}/cancel`);

    // Test 3: DKP overcommit across auctions
    await ensureUserDkp(adminToken, users);
    const auction3 = await createAuction(adminToken);
    await test3_dkpOvercommit(adminToken, users, auction3.id);
    await api(adminToken).post(`/auctions/${auction3.id}/cancel`);

    // Test 4: Rapid-fire same user
    await ensureUserDkp(adminToken, users);
    const auction4 = await createAuction(adminToken);
    await test4_rapidFireSameUser(adminToken, users, auction4.id);
    await api(adminToken).post(`/auctions/${auction4.id}/cancel`);

    // Test 5: Escalating bid war
    await ensureUserDkp(adminToken, users);
    const auction5 = await createAuction(adminToken);
    await test5_escalatingBidWar(adminToken, users, auction5.id);
    await api(adminToken).post(`/auctions/${auction5.id}/cancel`);

    // Test 6: Socket event consistency
    await ensureUserDkp(adminToken, users);
    const auction6 = await createAuction(adminToken);
    await test6_socketEventConsistency(adminToken, users, auction6.id);
    await api(adminToken).post(`/auctions/${auction6.id}/cancel`);

    // ── Summary ──
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log(`║  RESULTS: ${passed} passed, ${failed} failed                     `);
    console.log('╚══════════════════════════════════════════════════════╝');

    if (failed > 0) {
      console.log('\n⚠ Race conditions detected! The bid system needs transaction-level protection.');
    } else {
      console.log('\n✓ All tests passed. No race conditions detected.');
    }

  } catch (error) {
    console.error('\n✗ Test suite error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('  → Make sure the server is running: node server.js');
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
