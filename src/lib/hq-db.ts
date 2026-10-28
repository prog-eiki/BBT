import fs from 'node:fs';
import path from 'node:path';
import { BBT_TEAM_INFO, DEFAULT_BBT_PLAYERS } from './valorant-data';
import {
  generateSecureInviteOrResetCode,
  hashOneTimeToken,
  hashPassword,
} from './hq-auth';
import { notifyDatabaseMutated } from './live-sync';
import type {
  BbtHqDatabase,
  MapStrategy,
  OpponentProfile,
  TeamLineup,
  TeamMatch,
  TeamPlayer,
  UpcomingMatchInfo,
  UserAccount,
  UserRole,
} from '../types/hq';

const DATA_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE_PATH = path.join(DATA_DIR, 'bbt-hq-db.json');

function createDefaultUsers(): UserAccount[] {
  const now = '2026-10-20T12:00:00.000Z';
  const accounts: Array<{
    id: string;
    username: string;
    displayName: string;
    playerId: string;
    role: UserRole;
  }> = [
    {
      id: 'user-lunar',
      username: 'Lunar',
      displayName: 'Lunar #7822',
      playerId: 'p-lunar',
      role: 'ADMIN',
    },
    {
      id: 'user-kuronami',
      username: 'Kuronami',
      displayName: 'Kuronami 雨雲 #RED',
      playerId: 'p-kuronami',
      role: 'PLAYER',
    },
    {
      id: 'user-fydi',
      username: 'fydi',
      displayName: 'fydi #9522',
      playerId: 'p-fydi',
      role: 'PLAYER',
    },
    {
      id: 'user-xjoshhd',
      username: 'XJoshHD',
      displayName: 'XJoshHD #9317',
      playerId: 'p-xjoshhd',
      role: 'PLAYER',
    },
    {
      id: 'user-xxsensenmanx',
      username: 'XxSensenmanX',
      displayName: 'XxSensenmanX #7267',
      playerId: 'p-xxsensenmanx',
      role: 'PLAYER',
    },
    {
      id: 'user-shadowlina',
      username: 'ShadowLina',
      displayName: 'ShadowLina #6700',
      playerId: 'p-shadowlina',
      role: 'PLAYER',
    },
  ];

  return accounts.map((acc) => ({
    id: acc.id,
    username: acc.username,
    displayName: acc.displayName,
    playerId: acc.playerId,
    role: acc.role,
    passwordHash: '', // Set securely via Admin First-Time Setup / Player Invite flow
    passwordSalt: '',
    inviteCodeHash: null,
    inviteCodePlainPreview: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    isActive: true,
    canAddNotes: true,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  }));
}

function createInitialBindMatches(): TeamMatch[] {
  return [
    {
      id: 'match-bind-premier-3',
      date: '2026-10-26T19:30:00.000Z',
      opponentName: 'Premier Division Gegner #3',
      opponentTag: 'PRM3',
      opponentId: 'opp-premier-3',
      mapId: 'bind',
      roundsWon: 13,
      roundsLost: 5,
      result: 'WIN',
      competition: 'Premier Stage V26',
      notes: 'Premier Match auf Bind (13:5 Sieg – 42 Kills von Kuronami auf Jett)',
      playerStats: [
        {
          id: 'stat-b3-1',
          playerId: 'p-kuronami',
          playerName: 'Kuronami 雨雲',
          playerTag: 'RED',
          agentId: 'jett',
          kills: 42,
          deaths: 9,
          assists: 3,
          acs: 645,
          headshotPct: 33,
          adr: 391.1,
          kastPct: 89,
          firstKills: 6,
          firstDeaths: 3,
        },
        {
          id: 'stat-b3-2',
          playerId: 'p-xxsensenmanx',
          playerName: 'XxSensenmanX',
          playerTag: '7267',
          agentId: 'cypher',
          kills: 13,
          deaths: 12,
          assists: 7,
          acs: 204,
          headshotPct: 10,
          adr: 114.3,
          kastPct: 83,
          firstKills: 3,
          firstDeaths: 2,
        },
        {
          id: 'stat-b3-3',
          playerId: 'p-fydi',
          playerName: 'fydi',
          playerTag: '9522',
          agentId: 'skye',
          kills: 14,
          deaths: 10,
          assists: 7,
          acs: 196,
          headshotPct: 18,
          adr: 126.7,
          kastPct: 94,
          firstKills: 0,
          firstDeaths: 0,
        },
        {
          id: 'stat-b3-4',
          playerId: 'p-shadowlina',
          playerName: 'ShadowLina',
          playerTag: '6700',
          agentId: 'killjoy',
          kills: 7,
          deaths: 12,
          assists: 8,
          acs: 133,
          headshotPct: 7,
          adr: 96.8,
          kastPct: 83,
          firstKills: 1,
          firstDeaths: 1,
        },
        {
          id: 'stat-b3-5',
          playerId: 'p-xjoshhd',
          playerName: 'XJoshHD',
          playerTag: '9317',
          agentId: 'gekko',
          kills: 4,
          deaths: 13,
          assists: 2,
          acs: 83,
          headshotPct: 8,
          adr: 54.1,
          kastPct: 61,
          firstKills: 1,
          firstDeaths: 1,
        },
      ],
      createdAt: '2026-10-26T20:15:00.000Z',
      updatedAt: '2026-10-26T20:15:00.000Z',
    },
    {
      id: 'match-bind-premier-2',
      date: '2026-10-25T19:00:00.000Z',
      opponentName: 'Premier Division Gegner #2',
      opponentTag: 'PRM2',
      opponentId: 'opp-premier-2',
      mapId: 'bind',
      roundsWon: 13,
      roundsLost: 2,
      result: 'WIN',
      competition: 'Premier Stage V26',
      notes: 'Premier Match auf Bind (13:2 Sieg mit Jett, Cypher, Clove, Killjoy, Tejo)',
      playerStats: [
        {
          id: 'stat-b2-1',
          playerId: 'p-kuronami',
          playerName: 'Kuronami 雨雲',
          playerTag: 'RED',
          agentId: 'jett',
          kills: 26,
          deaths: 7,
          assists: 2,
          acs: 446,
          headshotPct: 35,
          adr: 261.5,
          kastPct: 100,
          firstKills: 5,
          firstDeaths: 2,
        },
        {
          id: 'stat-b2-2',
          playerId: 'p-xxsensenmanx',
          playerName: 'XxSensenmanX',
          playerTag: '7267',
          agentId: 'cypher',
          kills: 15,
          deaths: 9,
          assists: 10,
          acs: 291,
          headshotPct: 7,
          adr: 177.9,
          kastPct: 93,
          firstKills: 2,
          firstDeaths: 0,
        },
        {
          id: 'stat-b2-3',
          playerId: 'p-xjoshhd',
          playerName: 'XJoshHD',
          playerTag: '9317',
          agentId: 'clove',
          kills: 13,
          deaths: 8,
          assists: 11,
          acs: 267,
          headshotPct: 8,
          adr: 166.7,
          kastPct: 80,
          firstKills: 5,
          firstDeaths: 1,
        },
        {
          id: 'stat-b2-4',
          playerId: 'p-shadowlina',
          playerName: 'ShadowLina',
          playerTag: '6700',
          agentId: 'killjoy',
          kills: 9,
          deaths: 5,
          assists: 4,
          acs: 163,
          headshotPct: 18,
          adr: 122.4,
          kastPct: 87,
          firstKills: 0,
          firstDeaths: 0,
        },
        {
          id: 'stat-b2-5',
          playerId: 'p-fydi',
          playerName: 'fydi',
          playerTag: '9522',
          agentId: 'tejo',
          kills: 8,
          deaths: 6,
          assists: 3,
          acs: 136,
          headshotPct: 17,
          adr: 85.9,
          kastPct: 87,
          firstKills: 0,
          firstDeaths: 0,
        },
      ],
      createdAt: '2026-10-25T19:45:00.000Z',
      updatedAt: '2026-10-25T19:45:00.000Z',
    },
    {
      id: 'match-bind-premier-1',
      date: '2026-10-24T18:02:00.000Z',
      opponentName: 'shadow fighters',
      opponentTag: 'SF',
      opponentId: 'opp-shadow-fighters',
      mapId: 'bind',
      roundsWon: 13,
      roundsLost: 0,
      result: 'WIN',
      competition: 'Premier Stage V26',
      notes: 'Premier Match auf Bind gegen shadow fighters (13:0 Flawless Sieg)',
      playerStats: [
        {
          id: 'stat-b1-1',
          playerId: 'p-kuronami',
          playerName: 'Kuronami 雨雲',
          playerTag: 'RED',
          agentId: 'reyna',
          kills: 31,
          deaths: 4,
          assists: 4,
          acs: 654,
          headshotPct: 40,
          adr: 393.2,
          kastPct: 100,
          firstKills: 4,
          firstDeaths: 1,
        },
        {
          id: 'stat-b1-2',
          playerId: 'p-xxsensenmanx',
          playerName: 'XxSensenmanX',
          playerTag: '7267',
          agentId: 'cypher',
          kills: 15,
          deaths: 3,
          assists: 1,
          acs: 303,
          headshotPct: 6,
          adr: 170.2,
          kastPct: 92,
          firstKills: 4,
          firstDeaths: 1,
        },
        {
          id: 'stat-b1-3',
          playerId: 'p-fydi',
          playerName: 'fydi',
          playerTag: '9522',
          agentId: 'omen',
          kills: 8,
          deaths: 3,
          assists: 4,
          acs: 181,
          headshotPct: 14,
          adr: 119.4,
          kastPct: 92,
          firstKills: 1,
          firstDeaths: 0,
        },
        {
          id: 'stat-b1-4',
          playerId: 'p-xjoshhd',
          playerName: 'XJoshHD',
          playerTag: '9317',
          agentId: 'gekko',
          kills: 7,
          deaths: 4,
          assists: 4,
          acs: 149,
          headshotPct: 14,
          adr: 131.8,
          kastPct: 92,
          firstKills: 0,
          firstDeaths: 2,
        },
        {
          id: 'stat-b1-5',
          playerId: 'p-shadowlina',
          playerName: 'ShadowLina',
          playerTag: '6700',
          agentId: 'killjoy',
          kills: 5,
          deaths: 1,
          assists: 1,
          acs: 99,
          headshotPct: 12,
          adr: 61.2,
          kastPct: 100,
          firstKills: 0,
          firstDeaths: 0,
        },
      ],
      createdAt: '2026-10-24T18:45:00.000Z',
      updatedAt: '2026-10-24T18:45:00.000Z',
    },
  ];
}

function createInitialOpponents(): OpponentProfile[] {
  return [
    {
      id: 'opp-shadow-fighters',
      teamName: 'shadow fighters',
      teamTag: 'SF',
      logoUrl: '',
      knownPlayers: [],
      preferredMaps: [],
      observedComps: [],
      playstyle: '',
      strengths: [],
      weaknesses: [],
      tacticalNotes: '',
      scoutingNotes: [],
      matchPlan: {
        selectedLineupIds: [],
        selectedStrategyIds: [],
        tacticalInstructions: '',
      },
      createdAt: '2026-10-24T18:45:00.000Z',
      updatedAt: '2026-10-24T18:45:00.000Z',
    },
  ];
}

function createInitialLineups(): TeamLineup[] {
  return [
    {
      id: 'lineup-bind-main',
      mapId: 'bind',
      name: 'Bind Premier Main',
      slots: [
        { slotIndex: 0, playerId: 'p-kuronami', agentId: 'jett' },
        { slotIndex: 1, playerId: 'p-xxsensenmanx', agentId: 'cypher' },
        { slotIndex: 2, playerId: 'p-fydi', agentId: 'skye' },
        { slotIndex: 3, playerId: 'p-xjoshhd', agentId: 'gekko' },
        { slotIndex: 4, playerId: 'p-shadowlina', agentId: 'killjoy' },
      ],
      substitute: {
        playerId: 'p-lunar',
        agentId: 'reyna',
      },
      strategyId: null,
      notes: 'Unsere gespielte Premier-Aufstellung auf Bind (Double Sentinel + Double Initiator + Jett).',
      allowDuplicateAgents: false,
      createdBy: 'Lunar',
      createdAt: '2026-10-26T20:00:00.000Z',
      updatedAt: '2026-10-26T20:00:00.000Z',
    },
  ];
}

export function createDefaultDatabase(): BbtHqDatabase {
  return {
    version: 1,
    team: { ...BBT_TEAM_INFO },
    players: structuredClone(DEFAULT_BBT_PLAYERS),
    users: createDefaultUsers(),
    strategies: [], // Keine vorab erfundenen Strategien!
    lineups: createInitialLineups(),
    matches: createInitialBindMatches(),
    opponents: createInitialOpponents(),
    upcomingMatch: null,
    auditLogs: [
      {
        id: 'audit-init',
        timestamp: new Date().toISOString(),
        actor: 'System',
        action: 'SYSTEM_INIT',
        details: 'BBT Premier Team HQ Datenbank initialisiert (inkl. 3 Premier-Matches auf Bind).',
      },
    ],
  };
}

function normalizeDb(raw: Partial<BbtHqDatabase>): BbtHqDatabase {
  const base = createDefaultDatabase();
  const players =
    Array.isArray(raw.players) && raw.players.length > 0
      ? raw.players
      : base.players;

  // Ensure all 6 default user accounts exist alongside any custom ones
  const existingUsers = Array.isArray(raw.users) ? raw.users : [];
  const mergedUsers: UserAccount[] = [...existingUsers];
  for (const defUser of base.users) {
    const found = mergedUsers.some(
      (u) =>
        u.id === defUser.id ||
        u.username.trim().toLowerCase() === defUser.username.trim().toLowerCase()
    );
    if (!found) {
      mergedUsers.push(defUser);
    }
  }

  const matches = Array.isArray(raw.matches)
    ? [...raw.matches].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )
    : base.matches;

  return {
    version: raw.version || 1,
    team: {
      ...base.team,
      ...(raw.team || {}),
    },
    players,
    users: mergedUsers,
    strategies: Array.isArray(raw.strategies) ? raw.strategies : [],
    lineups: Array.isArray(raw.lineups) ? raw.lineups : base.lineups,
    matches,
    opponents: Array.isArray(raw.opponents) ? raw.opponents : base.opponents,
    upcomingMatch: raw.upcomingMatch !== undefined ? raw.upcomingMatch : null,
    auditLogs: Array.isArray(raw.auditLogs)
      ? raw.auditLogs.slice(0, 150)
      : base.auditLogs,
  };
}

export function getHqDatabase(): BbtHqDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      const initial = createDefaultDatabase();
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(content) as Partial<BbtHqDatabase>;
    return normalizeDb(parsed);
  } catch (err) {
    console.error('Fehler beim Lesen der BBT-HQ-Datenbank:', err);
    return createDefaultDatabase();
  }
}

export function saveHqDatabase(
  db: BbtHqDatabase,
  actor = 'System',
  action?: string,
  details?: string
): BbtHqDatabase {
  const normalized = normalizeDb(db);
  if (action && details) {
    normalized.auditLogs = [
      {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        actor,
        action,
        details,
      },
      ...(normalized.auditLogs || []),
    ].slice(0, 150);
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      DB_FILE_PATH,
      JSON.stringify(normalized, null, 2),
      'utf-8'
    );

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const dayKey = new Date().toISOString().slice(0, 10);
    const backupFile = path.join(BACKUP_DIR, `bbt-hq-backup-${dayKey}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(normalized, null, 2), 'utf-8');
  } catch (err) {
    console.error('Fehler beim Speichern der BBT-HQ-Datenbank:', err);
  }

  try {
    notifyDatabaseMutated(actor || 'System', action || 'UPDATE');
  } catch {
    // ignore broadcast error
  }

  return normalized;
}

export function isInitialAdminSetupNeeded(db?: BbtHqDatabase): boolean {
  const current = db || getHqDatabase();
  const hasConfiguredAdmin = current.users.some(
    (u) => u.role === 'ADMIN' && u.isActive && Boolean(u.passwordHash)
  );
  return !hasConfiguredAdmin;
}

// ============================================================================
// MUTATION HELPERS (WITH REFERENTIAL CONSISTENCY)
// ============================================================================

export function upsertTeamPlayer(
  input: Partial<TeamPlayer> & { name: string; tag: string },
  actor: string
): BbtHqDatabase {
  const db = getHqDatabase();
  const cleanName = input.name.trim();
  const cleanTag = input.tag.trim().replace(/^#/, '');
  const now = new Date().toISOString();

  const idx = db.players.findIndex((p) => p.id === input.id);
  if (idx >= 0) {
    const prev = db.players[idx];
    db.players[idx] = {
      ...prev,
      ...input,
      name: cleanName,
      tag: cleanTag,
      updatedAt: now,
    };

    // Cascade name/tag change into match stats and user accounts
    for (const match of db.matches) {
      for (const ps of match.playerStats) {
        if (ps.playerId === prev.id) {
          ps.playerName = cleanName;
          ps.playerTag = cleanTag;
        }
      }
    }
    for (const u of db.users) {
      if (u.playerId === prev.id) {
        u.displayName = `${cleanName} #${cleanTag}`;
      }
    }

    return saveHqDatabase(
      db,
      actor,
      'PLAYER_UPDATE',
      `Spieler aktualisiert: ${cleanName} #${cleanTag}`
    );
  }

  const newPlayer: TeamPlayer = {
    id: input.id || `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: cleanName,
    tag: cleanTag,
    primaryRole: input.primaryRole || 'Duelist',
    favoriteAgents: Array.isArray(input.favoriteAgents)
      ? input.favoriteAgents
      : ['jett'],
    isStarter: input.isStarter ?? false,
    avatarUrl: input.avatarUrl || '',
    notes: input.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  db.players.push(newPlayer);
  return saveHqDatabase(
    db,
    actor,
    'PLAYER_CREATE',
    `Spieler zum Kader hinzugefügt: ${cleanName} #${cleanTag}`
  );
}

export function deleteTeamPlayer(playerId: string, actor: string): BbtHqDatabase {
  const db = getHqDatabase();
  const target = db.players.find((p) => p.id === playerId);
  db.players = db.players.filter((p) => p.id !== playerId);

  // Clean up references in lineups & strategies
  for (const lineup of db.lineups) {
    for (const slot of lineup.slots) {
      if (slot.playerId === playerId) slot.playerId = null;
    }
    if (lineup.substitute?.playerId === playerId) {
      lineup.substitute.playerId = null;
    }
  }
  for (const strat of db.strategies) {
    for (const assign of strat.assignments) {
      if (assign.playerId === playerId) assign.playerId = null;
    }
  }

  return saveHqDatabase(
    db,
    actor,
    'PLAYER_DELETE',
    `Spieler aus Kader entfernt: ${target ? `${target.name} #${target.tag}` : playerId}`
  );
}

export function upsertStrategy(
  input: Partial<MapStrategy> & { mapId: string; name: string },
  actor: string
): BbtHqDatabase {
  const db = getHqDatabase();
  const now = new Date().toISOString();
  const idx = db.strategies.findIndex((s) => s.id === input.id);

  if (idx >= 0) {
    const prev = db.strategies[idx];
    db.strategies[idx] = {
      ...prev,
      ...input,
      name: input.name.trim(),
      mapId: input.mapId.toLowerCase(),
      updatedAt: now,
    };
    return saveHqDatabase(
      db,
      actor,
      'STRATEGY_UPDATE',
      `Map-Strategie bearbeitet: ${input.name.trim()} (${input.mapId})`
    );
  }

  const created: MapStrategy = {
    id: input.id || `strat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mapId: input.mapId.toLowerCase(),
    name: input.name.trim(),
    subtitle: input.subtitle || '',
    side: input.side || 'Angriff',
    site: input.site || 'A',
    type: input.type || 'Execute',
    assignments: Array.isArray(input.assignments)
      ? input.assignments
      : [0, 1, 2, 3, 4].map((slotIndex) => ({
          slotIndex,
          playerId: db.players[slotIndex]?.id || null,
          agentId: null,
          callsignOrTask: '',
        })),
    steps: Array.isArray(input.steps) ? input.steps : [],
    notes: input.notes || '',
    tacticalImage: input.tacticalImage || null,
    boardPages: Array.isArray(input.boardPages) ? input.boardPages : undefined,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  db.strategies.unshift(created);
  return saveHqDatabase(
    db,
    actor,
    'STRATEGY_CREATE',
    `Neue Map-Strategie erstellt: ${created.name} (${created.mapId})`
  );
}

export function deleteStrategy(strategyId: string, actor: string): BbtHqDatabase {
  const db = getHqDatabase();
  const target = db.strategies.find((s) => s.id === strategyId);
  db.strategies = db.strategies.filter((s) => s.id !== strategyId);
  return saveHqDatabase(
    db,
    actor,
    'STRATEGY_DELETE',
    `Map-Strategie gelöscht: ${target?.name || strategyId}`
  );
}

export function upsertLineup(
  input: Partial<TeamLineup> & { mapId: string; name: string },
  actor: string
): BbtHqDatabase {
  const db = getHqDatabase();
  const now = new Date().toISOString();
  const idx = db.lineups.findIndex((l) => l.id === input.id);

  // Enforce unique agents unless allowDuplicateAgents is enabled
  const allowDups = Boolean(input.allowDuplicateAgents);
  const rawSlots = Array.isArray(input.slots)
    ? input.slots.slice(0, 5)
    : [0, 1, 2, 3, 4].map((slotIndex) => ({
        slotIndex,
        playerId: db.players[slotIndex]?.id || null,
        agentId: null,
      }));

  if (!allowDups) {
    const seenAgents = new Set<string>();
    for (const s of rawSlots) {
      if (s.agentId) {
        const key = s.agentId.toLowerCase();
        if (seenAgents.has(key)) {
          s.agentId = null;
        } else {
          seenAgents.add(key);
        }
      }
    }
  }

  if (idx >= 0) {
    const prev = db.lineups[idx];
    db.lineups[idx] = {
      ...prev,
      ...input,
      mapId: input.mapId.toLowerCase(),
      name: input.name.trim(),
      slots: rawSlots,
      allowDuplicateAgents: allowDups,
      updatedAt: now,
    };
    return saveHqDatabase(
      db,
      actor,
      'LINEUP_UPDATE',
      `Lineup gespeichert: ${input.name.trim()} (${input.mapId})`
    );
  }

  const created: TeamLineup = {
    id: input.id || `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mapId: input.mapId.toLowerCase(),
    name: input.name.trim(),
    slots: rawSlots,
    substitute: input.substitute || null,
    strategyId: input.strategyId || null,
    notes: input.notes || '',
    allowDuplicateAgents: allowDups,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  db.lineups.unshift(created);
  return saveHqDatabase(
    db,
    actor,
    'LINEUP_CREATE',
    `Neues Lineup erstellt: ${created.name} (${created.mapId})`
  );
}

export function deleteLineup(lineupId: string, actor: string): BbtHqDatabase {
  const db = getHqDatabase();
  const target = db.lineups.find((l) => l.id === lineupId);
  db.lineups = db.lineups.filter((l) => l.id !== lineupId);
  return saveHqDatabase(
    db,
    actor,
    'LINEUP_DELETE',
    `Lineup gelöscht: ${target?.name || lineupId}`
  );
}

export function upsertMatch(
  input: Partial<TeamMatch> & {
    opponentName: string;
    mapId: string;
    roundsWon: number;
    roundsLost: number;
  },
  actor: string
): { db: BbtHqDatabase; isDuplicate?: boolean } {
  const db = getHqDatabase();
  const now = new Date().toISOString();
  const cleanOpp = input.opponentName.trim();
  const cleanMap = input.mapId.trim().toLowerCase();
  const rw = Math.max(0, Number(input.roundsWon) || 0);
  const rl = Math.max(0, Number(input.roundsLost) || 0);
  const result: 'WIN' | 'LOSS' =
    input.result || (rw >= rl ? 'WIN' : 'LOSS');
  const matchDate = input.date || now;

  const existingIdx = db.matches.findIndex((m) => m.id === input.id);

  // Prevent accidental duplicate match on creation
  if (existingIdx < 0) {
    const dayPrefix = matchDate.slice(0, 10);
    const duplicate = db.matches.find(
      (m) =>
        m.date.slice(0, 10) === dayPrefix &&
        m.mapId.toLowerCase() === cleanMap &&
        m.opponentName.trim().toLowerCase() === cleanOpp.toLowerCase() &&
        m.roundsWon === rw &&
        m.roundsLost === rl
    );
    if (duplicate) {
      return { db, isDuplicate: true };
    }
  }

  // Ensure opponent profile exists or is linked
  let oppProfile = db.opponents.find(
    (o) =>
      o.id === input.opponentId ||
      o.teamName.trim().toLowerCase() === cleanOpp.toLowerCase()
  );
  if (!oppProfile) {
    oppProfile = {
      id: `opp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      teamName: cleanOpp,
      teamTag: input.opponentTag || '',
      logoUrl: '',
      knownPlayers: [],
      preferredMaps: [],
      observedComps: [],
      playstyle: '',
      strengths: [],
      weaknesses: [],
      tacticalNotes: '',
      scoutingNotes: [],
      matchPlan: {
        selectedLineupIds: [],
        selectedStrategyIds: [],
        tacticalInstructions: '',
      },
      createdAt: now,
      updatedAt: now,
    };
    db.opponents.push(oppProfile);
  }

  const normalizedStats = (input.playerStats || []).map((ps, idx) => {
    const matchedPlayer = db.players.find((p) => p.id === ps.playerId);
    return {
      id: ps.id || `mps-${Date.now()}-${idx}`,
      playerId: ps.playerId,
      playerName: matchedPlayer?.name || ps.playerName || 'Spieler',
      playerTag: matchedPlayer?.tag || ps.playerTag || '',
      agentId: (ps.agentId || 'jett').toLowerCase(),
      kills: Math.max(0, Number(ps.kills) || 0),
      deaths: Math.max(0, Number(ps.deaths) || 0),
      assists: Math.max(0, Number(ps.assists) || 0),
      acs:
        ps.acs !== undefined && ps.acs !== null && String(ps.acs) !== ''
          ? Math.max(0, Number(ps.acs))
          : null,
      headshotPct:
        ps.headshotPct !== undefined &&
        ps.headshotPct !== null &&
        String(ps.headshotPct) !== ''
          ? Math.min(100, Math.max(0, Number(ps.headshotPct)))
          : null,
      adr:
        ps.adr !== undefined && ps.adr !== null && String(ps.adr) !== ''
          ? Math.max(0, Number(ps.adr))
          : null,
      kastPct:
        ps.kastPct !== undefined &&
        ps.kastPct !== null &&
        String(ps.kastPct) !== ''
          ? Math.min(100, Math.max(0, Number(ps.kastPct)))
          : null,
      firstKills:
        ps.firstKills !== undefined && ps.firstKills !== null
          ? Math.max(0, Number(ps.firstKills))
          : null,
      firstDeaths:
        ps.firstDeaths !== undefined && ps.firstDeaths !== null
          ? Math.max(0, Number(ps.firstDeaths))
          : null,
    };
  });

  if (existingIdx >= 0) {
    const prev = db.matches[existingIdx];
    db.matches[existingIdx] = {
      ...prev,
      ...input,
      date: matchDate,
      opponentName: cleanOpp,
      opponentId: oppProfile.id,
      mapId: cleanMap,
      roundsWon: rw,
      roundsLost: rl,
      result,
      playerStats: normalizedStats,
      updatedAt: now,
    };
    const saved = saveHqDatabase(
      db,
      actor,
      'MATCH_UPDATE',
      `Match aktualisiert: ${cleanMap.toUpperCase()} vs. ${cleanOpp} (${rw}:${rl})`
    );
    return { db: saved };
  }

  const created: TeamMatch = {
    id: input.id || `match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    date: matchDate,
    opponentName: cleanOpp,
    opponentTag: input.opponentTag || oppProfile.teamTag || '',
    opponentId: oppProfile.id,
    mapId: cleanMap,
    roundsWon: rw,
    roundsLost: rl,
    result,
    competition: input.competition || 'Premier',
    notes: input.notes || '',
    playerStats: normalizedStats,
    createdAt: now,
    updatedAt: now,
  };
  db.matches.unshift(created);
  const saved = saveHqDatabase(
    db,
    actor,
    'MATCH_CREATE',
    `Neues Match eingetragen: ${cleanMap.toUpperCase()} vs. ${cleanOpp} (${rw}:${rl})`
  );
  return { db: saved };
}

export function deleteMatch(matchId: string, actor: string): BbtHqDatabase {
  const db = getHqDatabase();
  const target = db.matches.find((m) => m.id === matchId);
  db.matches = db.matches.filter((m) => m.id !== matchId);
  return saveHqDatabase(
    db,
    actor,
    'MATCH_DELETE',
    `Match gelöscht: ${
      target
        ? `${target.mapId.toUpperCase()} vs. ${target.opponentName} (${target.roundsWon}:${target.roundsLost})`
        : matchId
    }`
  );
}

export function upsertOpponentProfile(
  input: Partial<OpponentProfile> & { teamName: string },
  actor: string
): BbtHqDatabase {
  const db = getHqDatabase();
  const now = new Date().toISOString();
  const cleanName = input.teamName.trim();

  const idx = db.opponents.findIndex(
    (o) =>
      o.id === input.id ||
      o.teamName.trim().toLowerCase() === cleanName.toLowerCase()
  );

  if (idx >= 0) {
    const prev = db.opponents[idx];
    const oldName = prev.teamName;
    db.opponents[idx] = {
      ...prev,
      ...input,
      teamName: cleanName,
      knownPlayers: Array.isArray(input.knownPlayers)
        ? input.knownPlayers
        : prev.knownPlayers,
      preferredMaps: Array.isArray(input.preferredMaps)
        ? input.preferredMaps
        : prev.preferredMaps,
      observedComps: Array.isArray(input.observedComps)
        ? input.observedComps
        : prev.observedComps,
      strengths: Array.isArray(input.strengths)
        ? input.strengths
        : prev.strengths,
      weaknesses: Array.isArray(input.weaknesses)
        ? input.weaknesses
        : prev.weaknesses,
      scoutingNotes: Array.isArray(input.scoutingNotes)
        ? input.scoutingNotes
        : prev.scoutingNotes,
      matchPlan: input.matchPlan
        ? { ...prev.matchPlan, ...input.matchPlan, updatedAt: now }
        : prev.matchPlan,
      updatedAt: now,
    };

    if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
      for (const m of db.matches) {
        if (
          m.opponentId === prev.id ||
          m.opponentName.trim().toLowerCase() === oldName.toLowerCase()
        ) {
          m.opponentName = cleanName;
        }
      }
    }

    return saveHqDatabase(
      db,
      actor,
      'OPPONENT_UPDATE',
      `Gegnerprofil aktualisiert: ${cleanName}`
    );
  }

  const created: OpponentProfile = {
    id: input.id || `opp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    teamName: cleanName,
    teamTag: (input.teamTag || '').trim(),
    logoUrl: input.logoUrl || '',
    knownPlayers: Array.isArray(input.knownPlayers) ? input.knownPlayers : [],
    preferredMaps: Array.isArray(input.preferredMaps) ? input.preferredMaps : [],
    observedComps: Array.isArray(input.observedComps) ? input.observedComps : [],
    playstyle: input.playstyle || '',
    strengths: Array.isArray(input.strengths) ? input.strengths : [],
    weaknesses: Array.isArray(input.weaknesses) ? input.weaknesses : [],
    tacticalNotes: input.tacticalNotes || '',
    scoutingNotes: Array.isArray(input.scoutingNotes) ? input.scoutingNotes : [],
    matchPlan: input.matchPlan || {
      selectedLineupIds: [],
      selectedStrategyIds: [],
      tacticalInstructions: '',
      updatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
  db.opponents.unshift(created);
  return saveHqDatabase(
    db,
    actor,
    'OPPONENT_CREATE',
    `Neues Gegnerprofil angelegt: ${cleanName}`
  );
}

export function deleteOpponentProfile(
  opponentId: string,
  actor: string
): BbtHqDatabase {
  const db = getHqDatabase();
  const target = db.opponents.find((o) => o.id === opponentId);
  db.opponents = db.opponents.filter((o) => o.id !== opponentId);
  return saveHqDatabase(
    db,
    actor,
    'OPPONENT_DELETE',
    `Gegnerprofil gelöscht: ${target?.teamName || opponentId}`
  );
}

export function updateUpcomingMatch(
  upcoming: UpcomingMatchInfo | null,
  actor: string
): BbtHqDatabase {
  const db = getHqDatabase();
  db.upcomingMatch = upcoming;
  return saveHqDatabase(
    db,
    actor,
    'UPCOMING_MATCH_UPDATE',
    upcoming
      ? `Nächstes Match geplant: vs. ${upcoming.opponentName} (${upcoming.mapId})`
      : 'Geplantes Match entfernt'
  );
}

// ============================================================================
// USER & AUTHENTICATION MANAGEMENT (ADMIN ONLY)
// ============================================================================

export function setupInitialAdminAccount(
  username: string,
  plainPassword: string
): { db: BbtHqDatabase; adminUser: UserAccount; memberInvites: Array<{ username: string; inviteCode: string }> } {
  const db = getHqDatabase();
  if (!isInitialAdminSetupNeeded(db)) {
    throw new Error('Die Admin-Ersteinrichtung wurde bereits abgeschlossen.');
  }
  if (!plainPassword || plainPassword.length < 8) {
    throw new Error('Das Admin-Passwort muss mindestens 8 Zeichen lang sein.');
  }

  const now = new Date().toISOString();
  const cleanUser = username.trim() || 'Lunar';
  let adminAccount = db.users.find(
    (u) => u.username.toLowerCase() === cleanUser.toLowerCase()
  );

  const { salt, hash } = hashPassword(plainPassword);

  if (adminAccount) {
    adminAccount.role = 'ADMIN';
    adminAccount.passwordSalt = salt;
    adminAccount.passwordHash = hash;
    adminAccount.isActive = true;
    adminAccount.inviteCodeHash = null;
    adminAccount.inviteCodePlainPreview = null;
    adminAccount.lastLoginAt = now;
    adminAccount.updatedAt = now;
  } else {
    adminAccount = {
      id: `user-${Date.now()}`,
      username: cleanUser,
      displayName: cleanUser,
      playerId: 'p-lunar',
      role: 'ADMIN',
      passwordSalt: salt,
      passwordHash: hash,
      inviteCodeHash: null,
      inviteCodePlainPreview: null,
      isActive: true,
      canAddNotes: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    };
    db.users.unshift(adminAccount);
  }

  // Generate individual one-time invite codes for all other team members who don't have a password yet
  const memberInvites: Array<{ username: string; inviteCode: string }> = [];
  for (const u of db.users) {
    if (u.id !== adminAccount.id && !u.passwordHash) {
      const code = generateSecureInviteOrResetCode();
      u.inviteCodeHash = hashOneTimeToken(code);
      u.inviteCodePlainPreview = code;
      u.updatedAt = now;
      memberInvites.push({ username: u.username, inviteCode: code });
    }
  }

  const saved = saveHqDatabase(
    db,
    adminAccount.username,
    'ADMIN_INITIAL_SETUP',
    `Ersteinrichtung abgeschlossen für Admin ${adminAccount.username}. Einladungscodes für ${memberInvites.length} Teammitglieder erstellt.`
  );

  return { db: saved, adminUser: adminAccount, memberInvites };
}

export function generateUserInviteOrResetCode(
  targetUserId: string,
  actor: string
): { db: BbtHqDatabase; code: string; username: string } {
  const db = getHqDatabase();
  const user = db.users.find((u) => u.id === targetUserId);
  if (!user) {
    throw new Error('Benutzerkonto nicht gefunden.');
  }

  const code = generateSecureInviteOrResetCode();
  const hashed = hashOneTimeToken(code);
  const now = new Date().toISOString();

  user.inviteCodeHash = hashed;
  user.inviteCodePlainPreview = code;
  user.resetTokenHash = hashed;
  user.resetTokenExpiresAt = new Date(
    Date.now() + 1000 * 60 * 60 * 48
  ).toISOString(); // 48 hours valid
  user.updatedAt = now;

  const saved = saveHqDatabase(
    db,
    actor,
    'USER_INVITE_RESET_GENERATED',
    `Einladungs-/Zurücksetzungscode für ${user.username} generiert.`
  );

  return { db: saved, code, username: user.username };
}

export function claimInviteOrResetPassword(
  usernameInput: string,
  codeInput: string,
  newPlainPassword: string
): { db: BbtHqDatabase; user: UserAccount } {
  if (!newPlainPassword || newPlainPassword.length < 8) {
    throw new Error('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
  }
  const db = getHqDatabase();
  const user = db.users.find(
    (u) => u.username.trim().toLowerCase() === usernameInput.trim().toLowerCase()
  );
  if (!user || !user.isActive) {
    throw new Error('Benutzerkonto nicht gefunden oder deaktiviert.');
  }

  const inputHash = hashOneTimeToken(codeInput);
  const matchesInvite =
    Boolean(user.inviteCodeHash) && user.inviteCodeHash === inputHash;
  const matchesReset =
    Boolean(user.resetTokenHash) &&
    user.resetTokenHash === inputHash &&
    (!user.resetTokenExpiresAt ||
      new Date(user.resetTokenExpiresAt).getTime() > Date.now());

  if (!matchesInvite && !matchesReset) {
    throw new Error(
      'Ungültiger oder abgelaufener Einladungs-/Zurücksetzungscode.'
    );
  }

  const { salt, hash } = hashPassword(newPlainPassword);
  const now = new Date().toISOString();
  user.passwordSalt = salt;
  user.passwordHash = hash;
  user.inviteCodeHash = null;
  user.inviteCodePlainPreview = null;
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.lastLoginAt = now;
  user.updatedAt = now;

  const saved = saveHqDatabase(
    db,
    user.username,
    'USER_PASSWORD_SET',
    `Eigenes Passwort erfolgreich eingerichtet für ${user.username}.`
  );

  return { db: saved, user };
}
