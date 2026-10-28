import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { PublicUserSession, UserAccount, UserRole } from '../types/hq';

const SESSION_COOKIE_NAME = 'bbt_hq_session';

function getServerSecret(): string {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) {
    return process.env.AUTH_SECRET;
  }
  // Deterministic machine-local HMAC secret derived from project path + environment
  return crypto
    .createHash('sha256')
    .update(`bbt-premier-hq-hmac-${process.cwd()}`)
    .digest('hex');
}

export function hashPassword(plainPassword: string, existingSalt?: string): {
  salt: string;
  hash: string;
} {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, 64).toString('hex');
  return { salt, hash: derived };
}

export function verifyPassword(
  plainPassword: string,
  storedHash: string,
  storedSalt: string
): boolean {
  if (!storedHash || !storedSalt) return false;
  try {
    const { hash } = hashPassword(plainPassword, storedSalt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function hashOneTimeToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token.trim())
    .digest('hex');
}

export function generateSecureInviteOrResetCode(): string {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `BBT-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

// Simple in-memory rate limiter against brute force login attempts
interface RateLimitRecord {
  failures: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, RateLimitRecord>();

export function checkLoginRateLimit(key: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec) return { allowed: true, retryAfterSeconds: 0 };
  if (rec.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const rec = loginAttempts.get(key) || { failures: 0, lockedUntil: 0 };
  rec.failures += 1;
  if (rec.failures >= 5) {
    rec.lockedUntil = now + 30 * 1000; // 30s lockout after 5 failed attempts
    rec.failures = 0;
  }
  loginAttempts.set(key, rec);
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}

export interface SignedSessionPayload extends PublicUserSession {
  exp: number;
}

export function createSignedSessionToken(user: UserAccount): string {
  const payload: SignedSessionPayload = {
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    playerId: user.playerId,
    role: user.role,
    canAddNotes: user.role === 'ADMIN' ? true : Boolean(user.canAddNotes),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  };

  const base64Payload = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', getServerSecret())
    .update(base64Payload)
    .digest('base64url');

  return `${base64Payload}.${signature}`;
}

export function verifySignedSessionToken(
  token?: string | null
): SignedSessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [base64Payload, signature] = token.split('.');
  if (!base64Payload || !signature) return null;

  const expectedSig = crypto
    .createHmac('sha256', getServerSecret())
    .update(base64Payload)
    .digest('base64url');

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf-8')
    ) as SignedSessionPayload;
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(
  req: NextRequest
): SignedSessionPayload | null {
  const cookieVal = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieVal) {
    const verified = verifySignedSessionToken(cookieVal);
    if (verified) return verified;
  }
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifySignedSessionToken(token);
  }
  return null;
}

export function hasRolePermission(
  session: SignedSessionPayload | null,
  requiredRole: UserRole
): boolean {
  if (!session) return false;
  if (session.role === 'ADMIN') return true;
  return requiredRole === 'PLAYER';
}

export { SESSION_COOKIE_NAME };
