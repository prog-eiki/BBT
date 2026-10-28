import { NextRequest, NextResponse } from 'next/server';
import {
  generateSecureInviteOrResetCode,
  getSessionFromRequest,
  hashOneTimeToken,
  hashPassword,
} from '@/lib/hq-auth';
import {
  deleteLineup,
  deleteMatch,
  deleteOpponentProfile,
  deleteStrategy,
  deleteTeamPlayer,
  generateUserInviteOrResetCode,
  getHqDatabase,
  isInitialAdminSetupNeeded,
  saveHqDatabase,
  updateUpcomingMatch,
  upsertLineup,
  upsertMatch,
  upsertOpponentProfile,
  upsertStrategy,
  upsertTeamPlayer,
} from '@/lib/hq-db';
import type { BbtHqDatabase } from '@/types/hq';

function sanitizeDbForClient(db: BbtHqDatabase, isAdmin: boolean) {
  return {
    version: db.version,
    team: db.team,
    players: db.players,
    strategies: db.strategies,
    lineups: db.lineups,
    matches: db.matches,
    opponents: db.opponents,
    upcomingMatch: db.upcomingMatch,
    auditLogs: db.auditLogs,
    users: isAdmin
      ? db.users.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          playerId: u.playerId,
          role: u.role,
          isActive: u.isActive,
          canAddNotes: u.canAddNotes,
          hasPasswordSet: Boolean(u.passwordHash),
          inviteCodePlainPreview: u.inviteCodePlainPreview || null,
          lastLoginAt: u.lastLoginAt || null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        }))
      : [],
  };
}

export async function GET(req: NextRequest) {
  const db = getHqDatabase();
  const setupNeeded = isInitialAdminSetupNeeded(db);
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(
      {
        error: 'Nicht autorisiert. Bitte melde dich an.',
        authenticated: false,
        isInitialSetupNeeded: setupNeeded,
      },
      { status: 401 }
    );
  }

  const dbUser = db.users.find((u) => u.id === session.userId && u.isActive);
  if (!dbUser) {
    return NextResponse.json(
      { error: 'Sitzung ungültig oder Benutzer deaktiviert.', authenticated: false },
      { status: 401 }
    );
  }

  const isAdmin = dbUser.role === 'ADMIN';
  return NextResponse.json({
    ok: true,
    session: {
      userId: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.displayName,
      playerId: dbUser.playerId,
      role: dbUser.role,
      canAddNotes: isAdmin ? true : dbUser.canAddNotes,
    },
    data: sanitizeDbForClient(db, isAdmin),
  });
}

export async function POST(req: NextRequest) {
  const db = getHqDatabase();
  const session = getSessionFromRequest(req);

  if (!session) {
    return NextResponse.json(
      { error: 'Zugriff verweigert: Bitte zuerst anmelden.' },
      { status: 401 }
    );
  }

  const currentUser = db.users.find(
    (u) => u.id === session.userId && u.isActive
  );
  if (!currentUser) {
    return NextResponse.json(
      { error: 'Benutzerkonto ist inaktiv oder existiert nicht mehr.' },
      { status: 403 }
    );
  }

  const isAdmin = currentUser.role === 'ADMIN';
  const canAddNotes = isAdmin || Boolean(currentUser.canAddNotes);
  const actor = currentUser.username;

  try {
    const body = await req.json();
    const action = String(body.action || '');
    const payload = body.payload || {};

    // ========================================================================
    // PLAYER ALLOWED NOTE ACTIONS (WHEN canAddNotes IS ENABLED)
    // ========================================================================
    if (action === 'ADD_SCOUTING_NOTE') {
      if (!canAddNotes) {
        return NextResponse.json(
          { error: 'Keine Berechtigung zum Hinzufügen von Notizen.' },
          { status: 403 }
        );
      }
      const oppId = String(payload.opponentId || '');
      const content = String(payload.content || '').trim();
      const category = payload.category || 'Allgemein';
      if (!oppId || !content) {
        return NextResponse.json(
          { error: 'Gegner-ID und Notiztext sind erforderlich.' },
          { status: 400 }
        );
      }

      const opp = db.opponents.find((o) => o.id === oppId);
      if (!opp) {
        return NextResponse.json(
          { error: 'Gegnerprofil nicht gefunden.' },
          { status: 404 }
        );
      }

      opp.scoutingNotes.unshift({
        id: `sn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        category,
        content,
        author: actor,
        createdAt: new Date().toISOString(),
      });
      opp.updatedAt = new Date().toISOString();

      const updatedDb = saveHqDatabase(
        db,
        actor,
        'SCOUTING_NOTE_ADD',
        `Scouting-Notiz zu ${opp.teamName} hinzugefügt.`
      );
      return NextResponse.json({
        ok: true,
        data: sanitizeDbForClient(updatedDb, isAdmin),
      });
    }

    if (action === 'ADD_STRATEGY_NOTE') {
      if (!canAddNotes) {
        return NextResponse.json(
          { error: 'Keine Berechtigung zum Hinzufügen von Notizen.' },
          { status: 403 }
        );
      }
      const strategyId = String(payload.strategyId || '');
      const noteText = String(payload.notes ?? '').trim();
      const strat = db.strategies.find((s) => s.id === strategyId);
      if (!strat) {
        return NextResponse.json(
          { error: 'Strategie nicht gefunden.' },
          { status: 404 }
        );
      }
      const prefix = strat.notes ? `${strat.notes}\n` : '';
      strat.notes = `${prefix}[${actor}]: ${noteText}`;
      strat.updatedAt = new Date().toISOString();

      const updatedDb = saveHqDatabase(
        db,
        actor,
        'STRATEGY_NOTE_ADD',
        `Notiz zu Strategie „${strat.name}“ ergänzt.`
      );
      return NextResponse.json({
        ok: true,
        data: sanitizeDbForClient(updatedDb, isAdmin),
      });
    }

    if (action === 'ADD_LINEUP_NOTE') {
      if (!canAddNotes) {
        return NextResponse.json(
          { error: 'Keine Berechtigung zum Hinzufügen von Notizen.' },
          { status: 403 }
        );
      }
      const lineupId = String(payload.lineupId || '');
      const noteText = String(payload.notes ?? '').trim();
      const lineup = db.lineups.find((l) => l.id === lineupId);
      if (!lineup) {
        return NextResponse.json(
          { error: 'Lineup nicht gefunden.' },
          { status: 404 }
        );
      }
      const prefix = lineup.notes ? `${lineup.notes}\n` : '';
      lineup.notes = `${prefix}[${actor}]: ${noteText}`;
      lineup.updatedAt = new Date().toISOString();

      const updatedDb = saveHqDatabase(
        db,
        actor,
        'LINEUP_NOTE_ADD',
        `Notiz zu Lineup „${lineup.name}“ ergänzt.`
      );
      return NextResponse.json({
        ok: true,
        data: sanitizeDbForClient(updatedDb, isAdmin),
      });
    }

    // ========================================================================
    // ADMIN-ONLY ENFORCEMENT FOR ALL OTHER WRITE / MANAGEMENT OPERATIONS
    // ========================================================================
    if (!isAdmin) {
      return NextResponse.json(
        {
          error:
            'Zugriff verweigert: Für diese Aktion sind Admin-Berechtigungen erforderlich.',
        },
        { status: 403 }
      );
    }

    switch (action) {
      case 'UPSERT_PLAYER': {
        const updatedDb = upsertTeamPlayer(payload, actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'DELETE_PLAYER': {
        const updatedDb = deleteTeamPlayer(String(payload.id || ''), actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'UPSERT_STRATEGY': {
        const updatedDb = upsertStrategy(payload, actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'DELETE_STRATEGY': {
        const updatedDb = deleteStrategy(String(payload.id || ''), actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'UPSERT_LINEUP': {
        const updatedDb = upsertLineup(payload, actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'DELETE_LINEUP': {
        const updatedDb = deleteLineup(String(payload.id || ''), actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'UPSERT_MATCH': {
        const { db: updatedDb, isDuplicate } = upsertMatch(payload, actor);
        if (isDuplicate) {
          return NextResponse.json(
            {
              error:
                'Doppeltes Match erkannt: Ein identisches Match (Datum, Map, Gegner und Score) ist bereits gespeichert.',
            },
            { status: 409 }
          );
        }
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'DELETE_MATCH': {
        const updatedDb = deleteMatch(String(payload.id || ''), actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'UPSERT_OPPONENT': {
        const updatedDb = upsertOpponentProfile(payload, actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'DELETE_OPPONENT': {
        const updatedDb = deleteOpponentProfile(String(payload.id || ''), actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'UPDATE_UPCOMING_MATCH': {
        const updatedDb = updateUpcomingMatch(payload.upcomingMatch || null, actor);
        return NextResponse.json({
          ok: true,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'ADMIN_GENERATE_INVITE_CODE': {
        const targetUserId = String(payload.userId || '');
        const { db: updatedDb, code, username } = generateUserInviteOrResetCode(
          targetUserId,
          actor
        );
        return NextResponse.json({
          ok: true,
          generatedCode: code,
          targetUsername: username,
          data: sanitizeDbForClient(updatedDb, isAdmin),
        });
      }

      case 'ADMIN_UPSERT_USER': {
        const now = new Date().toISOString();
        const userId = String(payload.id || '');
        const username = String(payload.username || '').trim();
        if (!username) {
          return NextResponse.json(
            { error: 'Benutzername darf nicht leer sein.' },
            { status: 400 }
          );
        }

        const duplicateUsername = db.users.find(
          (u) =>
            u.id !== userId &&
            u.username.toLowerCase() === username.toLowerCase()
        );
        if (duplicateUsername) {
          return NextResponse.json(
            { error: 'Dieser Benutzername ist bereits vergeben.' },
            { status: 409 }
          );
        }

        const existingUser = db.users.find((u) => u.id === userId);
        if (existingUser) {
          // Prevent deactivating the last active admin
          const nextRole = payload.role === 'ADMIN' ? 'ADMIN' : 'PLAYER';
          const nextActive =
            typeof payload.isActive === 'boolean'
              ? payload.isActive
              : existingUser.isActive;

          if (
            existingUser.role === 'ADMIN' &&
            (nextRole !== 'ADMIN' || !nextActive)
          ) {
            const otherActiveAdmins = db.users.filter(
              (u) =>
                u.id !== existingUser.id && u.role === 'ADMIN' && u.isActive
            );
            if (otherActiveAdmins.length === 0) {
              return NextResponse.json(
                {
                  error:
                    'Mindestens ein aktiver Admin-Account muss im System verbleiben.',
                },
                { status: 400 }
              );
            }
          }

          existingUser.username = username;
          existingUser.displayName =
            String(payload.displayName || '').trim() || username;
          existingUser.playerId = payload.playerId ?? existingUser.playerId;
          existingUser.role = nextRole;
          existingUser.isActive = nextActive;
          existingUser.canAddNotes =
            typeof payload.canAddNotes === 'boolean'
              ? payload.canAddNotes
              : existingUser.canAddNotes;

          if (payload.newPassword && String(payload.newPassword).length >= 8) {
            const { salt, hash } = hashPassword(String(payload.newPassword));
            existingUser.passwordSalt = salt;
            existingUser.passwordHash = hash;
            existingUser.inviteCodeHash = null;
            existingUser.inviteCodePlainPreview = null;
          }

          existingUser.updatedAt = now;
          const updatedDb = saveHqDatabase(
            db,
            actor,
            'USER_UPDATE',
            `Benutzerkonto aktualisiert: ${existingUser.username} (${existingUser.role})`
          );
          return NextResponse.json({
            ok: true,
            data: sanitizeDbForClient(updatedDb, isAdmin),
          });
        } else {
          const inviteCode = generateSecureInviteOrResetCode();
          const hasInitialPass =
            payload.newPassword && String(payload.newPassword).length >= 8;
          const passData = hasInitialPass
            ? hashPassword(String(payload.newPassword))
            : { salt: '', hash: '' };

          db.users.push({
            id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            username,
            displayName: String(payload.displayName || '').trim() || username,
            playerId: payload.playerId || null,
            role: payload.role === 'ADMIN' ? 'ADMIN' : 'PLAYER',
            passwordSalt: passData.salt,
            passwordHash: passData.hash,
            inviteCodeHash: hasInitialPass ? null : hashOneTimeToken(inviteCode),
            inviteCodePlainPreview: hasInitialPass ? null : inviteCode,
            isActive: true,
            canAddNotes: payload.canAddNotes ?? true,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now,
          });

          const updatedDb = saveHqDatabase(
            db,
            actor,
            'USER_CREATE',
            `Neues Benutzerkonto angelegt: ${username}`
          );
          return NextResponse.json({
            ok: true,
            generatedCode: hasInitialPass ? null : inviteCode,
            data: sanitizeDbForClient(updatedDb, isAdmin),
          });
        }
      }

      default:
        return NextResponse.json(
          { error: `Unbekannte Aktion: ${action}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Serverfehler beim Verarbeiten der Anfrage.' },
      { status: 500 }
    );
  }
}
