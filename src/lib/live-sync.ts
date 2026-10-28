import fs from 'fs';
import path from 'path';
import type {
  StrategyPlayerAssignment,
  StrategySide,
  StrategySite,
  StrategyStep,
  StrategyType,
  TacticalBoardPage,
} from '../types/hq';

export interface LiveParticipant {
  clientId: string;
  username: string;
  displayName: string;
  role: string;
  color: string;
  cursorX: number | null; // 0..100 on the 2D map
  cursorY: number | null; // 0..100 on the 2D map
  activePageIndex: number;
  lastSeenAt: number;
}

export interface LiveTacticalBoardState {
  revision: number;
  updatedAt: string;
  updatedBy: string;
   updatedByClientId: string;
  editingStrategyId: string | null;
  mapId: string;
  name: string;
  subtitle: string;
  side: StrategySide;
  site: StrategySite;
  type: StrategyType;
  assignments: StrategyPlayerAssignment[];
  steps: StrategyStep[];
  notes: string;
  boardPages: TacticalBoardPage[];
  activePageIndex: number;
  radarTintMode: 'VALOPLANT' | 'ORIGINAL';
  rotateMap180: boolean;
}

export type LiveBroadcastEvent =
  | {
      type: 'BOARD_UPDATE';
      board: LiveTacticalBoardState;
      senderClientId: string;
    }
  | {
      type: 'PRESENCE_UPDATE';
      participants: LiveParticipant[];
      senderClientId: string;
    }
  | {
      type: 'DB_MUTATED';
      timestamp: string;
      actor: string;
      action: string;
    };

const DATA_DIR = path.join(process.cwd(), 'data');
const LIVE_BOARD_PATH = path.join(DATA_DIR, 'bbt-live-board.json');

const MEMBER_COLORS = [
  '#73FBD3',
  '#E63946',
  '#F59E0B',
  '#38BDF8',
  '#A855F7',
  '#10B981',
  '#F472B6',
];

function getColorForUser(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}

function createInitialLiveBoard(): LiveTacticalBoardState {
  return {
    revision: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: 'System',
    updatedByClientId: 'system',
    editingStrategyId: null,
    mapId: 'ascent',
    name: 'ASCENT B EXECUTE',
    subtitle: '',
    side: 'Angriff',
    site: 'B',
    type: 'Execute',
    assignments: [0, 1, 2, 3, 4].map((slotIndex) => ({
      slotIndex,
      playerId: null,
      agentId: null,
      callsignOrTask: '',
    })),
    steps: [
      {
        id: 'step-live-1',
        phase: 'Pre-Round / Setup',
        timing: '1:40',
        description: '',
      },
    ],
    notes: '',
    boardPages: [
      {
        id: 'page-live-1',
        name: 'Page 1',
        agentTokens: [],
        abilityTokens: [],
        drawings: [],
        textNotes: [],
        zones: [],
        images: [],
      },
    ],
    activePageIndex: 0,
    radarTintMode: 'VALOPLANT',
    rotateMap180: false,
  };
}

// Global singleton across Next.js hot reloads / route invocations
const globalForLive = globalThis as unknown as {
  __bbtLiveBoardState?: LiveTacticalBoardState;
  __bbtLiveParticipants?: Map<string, LiveParticipant>;
  __bbtLiveListeners?: Set<(event: LiveBroadcastEvent) => void>;
  __bbtSaveTimer?: NodeJS.Timeout | null;
};

function ensureInitialized(): {
  board: LiveTacticalBoardState;
  participants: Map<string, LiveParticipant>;
  listeners: Set<(event: LiveBroadcastEvent) => void>;
} {
  if (!globalForLive.__bbtLiveListeners) {
    globalForLive.__bbtLiveListeners = new Set();
  }
  if (!globalForLive.__bbtLiveParticipants) {
    globalForLive.__bbtLiveParticipants = new Map();
  }
  if (!globalForLive.__bbtLiveBoardState) {
    try {
      if (fs.existsSync(LIVE_BOARD_PATH)) {
        const raw = fs.readFileSync(LIVE_BOARD_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as LiveTacticalBoardState;
        if (parsed && Array.isArray(parsed.boardPages)) {
          globalForLive.__bbtLiveBoardState = parsed;
        }
      }
    } catch {
      // ignore corrupted file
    }
    if (!globalForLive.__bbtLiveBoardState) {
      globalForLive.__bbtLiveBoardState = createInitialLiveBoard();
    }
  }
  return {
    board: globalForLive.__bbtLiveBoardState,
    participants: globalForLive.__bbtLiveParticipants,
    listeners: globalForLive.__bbtLiveListeners,
  };
}

function schedulePersistToDisk(board: LiveTacticalBoardState) {
  if (globalForLive.__bbtSaveTimer) {
    clearTimeout(globalForLive.__bbtSaveTimer);
  }
  globalForLive.__bbtSaveTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LIVE_BOARD_PATH, JSON.stringify(board, null, 2), 'utf-8');
    } catch {
      // ignore write error
    }
  }, 250);
}

function broadcastEvent(event: LiveBroadcastEvent) {
  const { listeners } = ensureInitialized();
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // ignore dead listener
    }
  }
}

export function getActiveParticipants(): LiveParticipant[] {
  const { participants } = ensureInitialized();
  const now = Date.now();
  const cutoff = now - 35_000; // 35 seconds timeout
  for (const [id, p] of participants.entries()) {
    if (p.lastSeenAt < cutoff) {
      participants.delete(id);
    }
  }
  return Array.from(participants.values());
}

export function getLiveBoardSnapshot(): {
  board: LiveTacticalBoardState;
  participants: LiveParticipant[];
} {
  const { board } = ensureInitialized();
  return {
    board,
    participants: getActiveParticipants(),
  };
}

export function updateLiveBoardState(
  patch: Partial<LiveTacticalBoardState>,
  actor: {
    clientId: string;
    username: string;
    displayName: string;
    role: string;
  }
): LiveTacticalBoardState {
  const state = ensureInitialized();
  const nextRevision = (state.board.revision || 0) + 1;

  const updated: LiveTacticalBoardState = {
    ...state.board,
    ...patch,
    revision: nextRevision,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.displayName || actor.username,
    updatedByClientId: actor.clientId,
  };

  globalForLive.__bbtLiveBoardState = updated;
  schedulePersistToDisk(updated);

  // Also touch participant presence
  touchParticipantPresence({
    clientId: actor.clientId,
    username: actor.username,
    displayName: actor.displayName,
    role: actor.role,
    activePageIndex: updated.activePageIndex,
  });

  broadcastEvent({
    type: 'BOARD_UPDATE',
    board: updated,
    senderClientId: actor.clientId,
  });

  return updated;
}

export function touchParticipantPresence(input: {
  clientId: string;
  username: string;
  displayName: string;
  role: string;
  cursorX?: number | null;
  cursorY?: number | null;
  activePageIndex?: number;
}): LiveParticipant[] {
  const { participants } = ensureInitialized();
  const existing = participants.get(input.clientId);

  const updated: LiveParticipant = {
    clientId: input.clientId,
    username: input.username,
    displayName: input.displayName || input.username,
    role: input.role,
    color: existing?.color || getColorForUser(input.username),
    cursorX:
      input.cursorX !== undefined ? input.cursorX : existing?.cursorX ?? null,
    cursorY:
      input.cursorY !== undefined ? input.cursorY : existing?.cursorY ?? null,
    activePageIndex:
      input.activePageIndex !== undefined
        ? input.activePageIndex
        : existing?.activePageIndex ?? 0,
    lastSeenAt: Date.now(),
  };

  participants.set(input.clientId, updated);
  const activeList = getActiveParticipants();

  broadcastEvent({
    type: 'PRESENCE_UPDATE',
    participants: activeList,
    senderClientId: input.clientId,
  });

  return activeList;
}

export function removeParticipantPresence(clientId: string): void {
  const { participants } = ensureInitialized();
  if (participants.delete(clientId)) {
    broadcastEvent({
      type: 'PRESENCE_UPDATE',
      participants: getActiveParticipants(),
      senderClientId: clientId,
    });
  }
}

export function notifyDatabaseMutated(actor: string, action: string): void {
  broadcastEvent({
    type: 'DB_MUTATED',
    timestamp: new Date().toISOString(),
    actor,
    action,
  });
}

export function subscribeToLiveEvents(
  listener: (event: LiveBroadcastEvent) => void
): () => void {
  const { listeners } = ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
