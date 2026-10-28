import { NextRequest, NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  clearLoginFailures,
  createSignedSessionToken,
  getSessionFromRequest,
  hashPassword,
  recordLoginFailure,
  SESSION_COOKIE_NAME,
  verifyPassword,
} from '@/lib/hq-auth';
import {
  claimInviteOrResetPassword,
  getHqDatabase,
  isInitialAdminSetupNeeded,
  saveHqDatabase,
  setupInitialAdminAccount,
} from '@/lib/hq-db';

export async function GET(req: NextRequest) {
  const db = getHqDatabase();
  const setupNeeded = isInitialAdminSetupNeeded(db);
  const session = getSessionFromRequest(req);

  // Verify user still exists and is active in DB
  if (session) {
    const dbUser = db.users.find((u) => u.id === session.userId && u.isActive);
    if (dbUser) {
      return NextResponse.json({
        authenticated: true,
        isInitialSetupNeeded: setupNeeded,
        session: {
          userId: dbUser.id,
          username: dbUser.username,
          displayName: dbUser.displayName,
          playerId: dbUser.playerId,
          role: dbUser.role,
          canAddNotes: dbUser.role === 'ADMIN' ? true : dbUser.canAddNotes,
        },
        rosterUsernames: db.users
          .filter((u) => u.isActive)
          .map((u) => ({
            username: u.username,
            displayName: u.displayName,
            role: u.role,
            hasPassword: Boolean(u.passwordHash),
          })),
      });
    }
  }

  return NextResponse.json({
    authenticated: false,
    isInitialSetupNeeded: setupNeeded,
    session: null,
    rosterUsernames: db.users
      .filter((u) => u.isActive)
      .map((u) => ({
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        hasPassword: Boolean(u.passwordHash),
      })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || 'LOGIN');

    if (action === 'LOGOUT') {
      const res = NextResponse.json({ ok: true, authenticated: false });
      res.cookies.set(SESSION_COOKIE_NAME, '', {
        httpOnly: true,
        path: '/',
        maxAge: 0,
        sameSite: 'lax',
      });
      return res;
    }

    if (action === 'INITIAL_ADMIN_SETUP') {
      const username = String(body.username || 'Lunar').trim();
      const password = String(body.password || '');

      const { adminUser, memberInvites } = setupInitialAdminAccount(
        username,
        password
      );
      const token = createSignedSessionToken(adminUser);

      const res = NextResponse.json({
        ok: true,
        authenticated: true,
        token,
        session: {
          userId: adminUser.id,
          username: adminUser.username,
          displayName: adminUser.displayName,
          playerId: adminUser.playerId,
          role: adminUser.role,
          canAddNotes: true,
        },
        memberInvites,
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 14,
        sameSite: 'lax',
      });
      return res;
    }

    if (action === 'CLAIM_INVITE_OR_RESET') {
      const username = String(body.username || '').trim();
      const code = String(body.code || '').trim();
      const newPassword = String(body.newPassword || '');

      const { user } = claimInviteOrResetPassword(username, code, newPassword);
      const token = createSignedSessionToken(user);

      const res = NextResponse.json({
        ok: true,
        authenticated: true,
        token,
        session: {
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          playerId: user.playerId,
          role: user.role,
          canAddNotes: user.role === 'ADMIN' ? true : user.canAddNotes,
        },
      });

      res.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 14,
        sameSite: 'lax',
      });
      return res;
    }

    if (action === 'CHANGE_OWN_PASSWORD') {
      const session = getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json(
          { error: 'Nicht angemeldet.' },
          { status: 401 }
        );
      }
      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Das neue Passwort muss mindestens 8 Zeichen lang sein.' },
          { status: 400 }
        );
      }

      const db = getHqDatabase();
      const user = db.users.find((u) => u.id === session.userId && u.isActive);
      if (!user) {
        return NextResponse.json(
          { error: 'Benutzerkonto nicht gefunden.' },
          { status: 404 }
        );
      }

      if (!verifyPassword(currentPassword, user.passwordHash, user.passwordSalt)) {
        return NextResponse.json(
          { error: 'Das aktuelle Passwort ist nicht korrekt.' },
          { status: 403 }
        );
      }

      const { salt, hash } = hashPassword(newPassword);
      user.passwordSalt = salt;
      user.passwordHash = hash;
      user.updatedAt = new Date().toISOString();
      saveHqDatabase(
        db,
        user.username,
        'PASSWORD_CHANGE',
        `Benutzer ${user.username} hat sein Passwort geändert.`
      );

      return NextResponse.json({
        ok: true,
        message: 'Passwort erfolgreich geändert.',
      });
    }

    // Default: LOGIN
    const usernameInput = String(body.username || '').trim();
    const passwordInput = String(body.password || '');

    if (!usernameInput || !passwordInput) {
      return NextResponse.json(
        { error: 'Bitte Benutzernamen und Passwort eingeben.' },
        { status: 400 }
      );
    }

    const rateKey = `login:${usernameInput.toLowerCase()}`;
    const rateStatus = checkLoginRateLimit(rateKey);
    if (!rateStatus.allowed) {
      return NextResponse.json(
        {
          error: `Zu viele fehlgeschlagene Anmeldeversuche. Bitte warte ${rateStatus.retryAfterSeconds} Sekunden.`,
        },
        { status: 429 }
      );
    }

    const db = getHqDatabase();
    const user = db.users.find(
      (u) => u.username.toLowerCase() === usernameInput.toLowerCase()
    );

    if (!user || !user.isActive) {
      recordLoginFailure(rateKey);
      return NextResponse.json(
        { error: 'Ungültiger Benutzername oder Passwort.' },
        { status: 401 }
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          error:
            'Für dieses Konto wurde noch kein Passwort vergeben. Bitte nutze deinen Einladungscode unter „Einladung / Passwort-Reset“ oder wende dich an den Admin.',
          needsInviteClaim: true,
        },
        { status: 403 }
      );
    }

    const valid = verifyPassword(
      passwordInput,
      user.passwordHash,
      user.passwordSalt
    );
    if (!valid) {
      recordLoginFailure(rateKey);
      return NextResponse.json(
        { error: 'Ungültiger Benutzername oder Passwort.' },
        { status: 401 }
      );
    }

    clearLoginFailures(rateKey);
    user.lastLoginAt = new Date().toISOString();
    saveHqDatabase(db, user.username, 'USER_LOGIN', `${user.username} hat sich angemeldet.`);

    const token = createSignedSessionToken(user);
    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      token,
      session: {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        playerId: user.playerId,
        role: user.role,
        canAddNotes: user.role === 'ADMIN' ? true : user.canAddNotes,
      },
    });

    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
      sameSite: 'lax',
    });
    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Fehler bei der Authentifizierung.' },
      { status: 400 }
    );
  }
}
