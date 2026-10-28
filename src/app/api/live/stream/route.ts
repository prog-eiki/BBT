import { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/hq-auth';
import {
  getLiveBoardSnapshot,
  removeParticipantPresence,
  subscribeToLiveEvents,
  touchParticipantPresence,
} from '@/lib/live-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('clientId') || `client-${Date.now()}`;
  const session = getSessionFromRequest(req);

  const username =
    session?.username || searchParams.get('username') || 'BBT-Member';
  const displayName =
    session?.displayName || searchParams.get('displayName') || username;
  const role = session?.role || 'PLAYER';

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // stream closed
        }
      };

      // Register presence immediately
      touchParticipantPresence({
        clientId,
        username,
        displayName,
        role,
      });

      // Send initial snapshot
      const snapshot = getLiveBoardSnapshot();
      sendEvent({
        type: 'SNAPSHOT',
        board: snapshot.board,
        participants: snapshot.participants,
      });

      // Subscribe to real-time broadcast events
      unsubscribe = subscribeToLiveEvents((event) => {
        sendEvent(event);
      });

      // Keep-alive ping every 15 seconds
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          // ignore
        }
      }, 15_000);

      req.signal.addEventListener('abort', () => {
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (unsubscribe) unsubscribe();
        removeParticipantPresence(clientId);
      });
    },
    cancel() {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (unsubscribe) unsubscribe();
      removeParticipantPresence(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
