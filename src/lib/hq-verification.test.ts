import assert from 'node:assert/strict';
import { computeStatistics } from './stats-calculator.ts';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  createSignedSessionToken,
  generateSecureInviteOrResetCode,
  hashOneTimeToken,
  hashPassword,
  recordLoginFailure,
  verifyPassword,
  verifySignedSessionToken,
} from './hq-auth.ts';
import { createDefaultDatabase } from './hq-db.ts';

console.log('=== BIGBLACKTEA (BBT) PREMIER TEAM HQ – VERIFICATION SUITE ===');

// 1. Verify Default Database & 3 Bind Matches from Screenshots
const db = createDefaultDatabase();
assert.equal(db.team.name, 'BigBlackTea');
assert.equal(db.team.shortName, 'BBT');
assert.equal(db.players.length, 6, 'Default roster must contain the 6 BBT players');
assert.equal(db.users.length, 6, 'Default user accounts must contain the 6 BBT team members');
assert.equal(db.strategies.length, 0, 'Must not contain pre-invented fake strategies');
assert.equal(db.matches.length, 3, 'Must contain the 3 uploaded Bind Premier matches');

// Verify no plaintext passwords in default users
for (const u of db.users) {
  assert.equal(u.passwordHash, '', `User ${u.username} must not have a hardcoded password`);
}

// 2. Verify Statistics Calculations on the 3 Bind Matches
const statsAll = computeStatistics(db.matches, db.players);
assert.equal(statsAll.totalMatches, 3);
assert.equal(statsAll.wins, 3);
assert.equal(statsAll.losses, 0);
assert.equal(statsAll.teamWinrate, 100);

// Kuronami stats across the 3 Bind screenshots:
// Match 1: 31K / 4D (Reyna, 654 ACS, 40% HS)
// Match 2: 26K / 7D (Jett, 446 ACS, 35% HS)
// Match 3: 42K / 9D (Jett, 645 ACS, 33% HS)
// Total Kills = 31 + 26 + 42 = 99; Total Deaths = 4 + 7 + 9 = 20; K/D = 99 / 20 = 4.95
const kuronamiStats = statsAll.playerRankings.find((p) => p.playerId === 'p-kuronami');
assert.ok(kuronamiStats, 'Kuronami stats must exist');
assert.equal(kuronamiStats.kills, 99);
assert.equal(kuronamiStats.deaths, 20);
assert.equal(kuronamiStats.kd, 4.95);
assert.equal(kuronamiStats.matchesPlayed, 3);
assert.equal(kuronamiStats.winrate, 100);
assert.equal(kuronamiStats.avgKillsPerMatch, 33);

// Lunar has 0 matches in the 3 Bind screenshots -> must return null for winrate and kd (no misleading percentages!)
const lunarStats = statsAll.playerRankings.find((p) => p.playerId === 'p-lunar');
assert.ok(lunarStats, 'Lunar stats must exist');
assert.equal(lunarStats.matchesPlayed, 0);
assert.equal(lunarStats.winrate, null, '0 matches must have null winrate, not 0%');
assert.equal(lunarStats.kd, null, '0 matches must have null K/D');

// Empty filter (e.g. map with 0 matches) must return null teamWinrate & teamKd
const emptyMapStats = computeStatistics(db.matches, db.players, { mapId: 'ascent' });
assert.equal(emptyMapStats.totalMatches, 0);
assert.equal(emptyMapStats.teamWinrate, null);
assert.equal(emptyMapStats.teamKd, null);

// 3. Verify Cryptographic Password Hashing, Session Signing & Rate Limiting
const { salt, hash } = hashPassword('MySecureBBTPass2026!');
assert.notEqual(hash, 'MySecureBBTPass2026!');
assert.equal(verifyPassword('MySecureBBTPass2026!', hash, salt), true);
assert.equal(verifyPassword('WrongPassword', hash, salt), false);

const inviteCode = generateSecureInviteOrResetCode();
assert.ok(inviteCode.startsWith('BBT-'));
const tokenHash = hashOneTimeToken(inviteCode);
assert.equal(tokenHash, hashOneTimeToken(inviteCode));

const testUser = {
  ...db.users[0],
  passwordHash: hash,
  passwordSalt: salt,
};
const sessionToken = createSignedSessionToken(testUser);
const verifiedSession = verifySignedSessionToken(sessionToken);
assert.ok(verifiedSession);
assert.equal(verifiedSession.username, 'Lunar');
assert.equal(verifiedSession.role, 'ADMIN');
assert.equal(verifySignedSessionToken(`${sessionToken}tampered`), null);

// Rate limiter test
const rateKey = 'test:bruteforce';
clearLoginFailures(rateKey);
for (let i = 0; i < 5; i++) {
  recordLoginFailure(rateKey);
}
const rateCheck = checkLoginRateLimit(rateKey);
assert.equal(rateCheck.allowed, false, 'Must lock out after 5 failed login attempts');
clearLoginFailures(rateKey);

console.log('✅ Alle Berechnungen, Sicherheitsprüfungen und DB-Checks erfolgreich bestanden!');
