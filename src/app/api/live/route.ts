import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/hq-auth';
import {
  getLiveBoardSnapshot,
  removeParticipantPresence,
  touchParticipantPresence,
  updateLiveBoardState,
} from '@/lib/live-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = getLiveBoardSnapshot();
  return NextResponse.json({
    ok: true,
    board: snapshot.board,
    participants: snapshot.participants,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const body = await req.json();
    const action = String(body.action || '');
    const clientId = String(body.clientId || 'anon');

    const actor = {
      clientId,
      username: session?.username || String(body.username || 'BBT-Member'),
      displayName:
        session?.displayName || String(body.displayName || 'BBT Member'),
      role: session?.role || 'PLAYER',
    };

    if (action === 'UPDATE_BOARD') {
      const boardPatch = body.board || {};
      const updated = updateLiveBoardState(boardPatch, actor);
      return NextResponse.json({
        ok: true,
        board: updated,
      });
    }

    if (action === 'CURSOR_MOVE' || action === 'HEARTBEAT') {
      const participants = touchParticipantPresence({
        ...actor,
        cursorX:
          typeof body.cursorX === 'number' ? body.cursorX : body.cursorX ?? undefined,
        cursorY:
          typeof body.cursorY === 'number' ? body.cursorY : body.cursorY ?? undefined,
        activePageIndex:
          typeof body.activePageIndex === 'number'
            ? body.activePageIndex
            : undefined,
      });
      return NextResponse.json({
        ok: true,
        participants,
      });
    }

    if (action === 'LEAVE') {
      removeParticipantPresence(clientId);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: 'Unbekannte Live-Aktion' },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Live-Sync Fehler',
      },
      { status: 500 }
    );
  }
}
