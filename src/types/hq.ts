export type AgentRole = 'Duelist' | 'Initiator' | 'Controller' | 'Sentinel';

export type UserRole = 'ADMIN' | 'PLAYER';

export type StrategySide = 'Angriff' | 'Verteidigung';

export type StrategySite = 'A' | 'B' | 'C' | 'Mid' | 'Global';

export type StrategyType =
  | 'Default'
  | 'Execute'
  | 'Rush'
  | 'Retake'
  | 'Fake'
  | 'Lurk'
  | 'Pistol'
  | 'Eco / Force';

export interface ValorantAgentAbility {
  slot: string;
  name: string;
  icon: string;
}

export interface ValorantAgentAsset {
  id: string;
  name: string;
  role: AgentRole;
  roleIcon: string;
  displayIcon: string;
  fullPortrait: string;
  bustPortrait: string;
  background?: string;
  colors?: string[];
  abilities?: ValorantAgentAbility[];
}

export interface ValorantMapCallout {
  regionName: string;
  superRegionName: string;
  location: { x: number; y: number; z?: number };
}

export interface ValorantMapAsset {
  id: string;
  name: string;
  coordinates: string;
  sites: string;
  availableSites: StrategySite[];
  splash: string;
  stylizedBackground?: string;
  listViewIcon: string;
  displayIcon?: string; // Official 2D top-down tactical radar minimap
  callouts?: ValorantMapCallout[];
}

export interface TeamPlayer {
  id: string;
  name: string;
  tag: string; // without leading #, e.g. "7822", "RED"
  primaryRole: AgentRole;
  favoriteAgents: string[];
  isStarter: boolean;
  avatarUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  playerId: string | null;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  inviteCodeHash?: string | null;
  inviteCodePlainPreview?: string | null;
  resetTokenHash?: string | null;
  resetTokenExpiresAt?: string | null;
  isActive: boolean;
  canAddNotes: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyPlayerAssignment {
  slotIndex: number;
  playerId: string | null;
  agentId: string | null;
  callsignOrTask?: string;
}

// ============================================================================
// INTERACTIVE TACTICAL MAP BOARD TYPES (VALOPLANT-STYLE)
// Coordinates x, y are normalized percentages (0..100) relative to the map board
// ============================================================================

export interface StrategyStep {
  id: string;
  phase: string;
  timing: string;
  description: string;
}

export interface BoardAgentToken {
  id: string;
  agentId: string;
  side: 'ally' | 'enemy';
  playerId?: string | null;
  label?: string;
  x: number; // 0..100
  y: number; // 0..100
  hasVisionCone?: boolean;
  visionAngle?: number; // degrees
  visionLength?: number; // % of board
}

export interface BoardAbilityToken {
  id: string;
  agentId: string;
  abilitySlot: string;
  abilityName: string;
  abilityIcon: string;
  side: 'ally' | 'enemy';
  x: number;
  y: number;
  radius?: number;
  color?: string;
}

export interface BoardDrawingPath {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  dashed?: boolean;
  hasArrowHead?: boolean;
  strokeWidth?: number;
}

export interface BoardTextNote {
  id: string;
  text: string;
  x: number;
  y: number;
  accentColor?: string;
}

export interface BoardZoneShape {
  id: string;
  type: 'circle' | 'rect' | 'tripwire' | 'vision';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  radius?: number;
  color: string;
  label?: string;
}

export interface BoardImageOverlay {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width?: number;
  label?: string;
}

export interface TacticalBoardPage {
  id: string;
  name: string;
  agentTokens: BoardAgentToken[];
  abilityTokens: BoardAbilityToken[];
  drawings: BoardDrawingPath[];
  textNotes: BoardTextNote[];
  zones: BoardZoneShape[];
  images: BoardImageOverlay[];
}

export interface MapStrategy {
  id: string;
  mapId: string;
  name: string;
  subtitle?: string;
  side: StrategySide;
  site: StrategySite;
  type: StrategyType;
  assignments: StrategyPlayerAssignment[];
  steps: Array<StrategyStep | string>;
  notes: string;
  tacticalImage?: string | null;
  boardPages?: TacticalBoardPage[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LineupSlot {
  slotIndex: number;
  playerId: string | null;
  agentId: string | null;
}

export interface TeamLineup {
  id: string;
  mapId: string;
  name: string;
  slots: LineupSlot[]; // 5 active slots
  substitute?: {
    playerId: string | null;
    agentId: string | null;
  } | null;
  strategyId?: string | null;
  notes: string;
  allowDuplicateAgents: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchPlayerStat {
  id: string;
  playerId: string;
  playerName: string;
  playerTag: string;
  agentId: string;
  kills: number;
  deaths: number;
  assists: number;
  acs?: number | null;
  headshotPct?: number | null;
  adr?: number | null;
  kastPct?: number | null;
  firstKills?: number | null;
  firstDeaths?: number | null;
}

export interface TeamMatch {
  id: string;
  date: string; // ISO string
  opponentName: string;
  opponentTag?: string;
  opponentId?: string | null;
  mapId: string;
  roundsWon: number;
  roundsLost: number;
  result: 'WIN' | 'LOSS';
  competition?: string;
  notes?: string;
  playerStats: MatchPlayerStat[];
  createdAt: string;
  updatedAt: string;
}

export interface OpponentPlayerEntry {
  id: string;
  name: string;
  riotId: string;
  mainAgents: string[];
  notes?: string;
}

export interface OpponentPreferredMap {
  mapId: string;
  preference: 'Stark' | 'Standard' | 'Schwach' | 'Permaban';
  notes?: string;
}

export interface OpponentObservedComp {
  id: string;
  mapId: string;
  agents: string[];
  notes?: string;
}

export type ScoutingNoteCategory =
  | 'Angriff'
  | 'Verteidigung'
  | 'Early-Game'
  | 'Flanks / Lurk'
  | 'Agent-Pool'
  | 'Defensiv-Schwachstelle'
  | 'Allgemein';

export interface ScoutingNote {
  id: string;
  category: ScoutingNoteCategory;
  content: string;
  author: string;
  createdAt: string;
}

export interface OpponentMatchPlan {
  plannedDate?: string;
  plannedMapId?: string;
  selectedLineupIds: string[];
  selectedStrategyIds: string[];
  tacticalInstructions: string;
  updatedAt?: string;
}

export interface OpponentProfile {
  id: string;
  teamName: string;
  teamTag?: string;
  logoUrl?: string;
  knownPlayers: OpponentPlayerEntry[];
  preferredMaps: OpponentPreferredMap[];
  observedComps: OpponentObservedComp[];
  playstyle: string;
  strengths: string[];
  weaknesses: string[];
  tacticalNotes: string;
  scoutingNotes: ScoutingNote[];
  matchPlan: OpponentMatchPlan;
  createdAt: string;
  updatedAt: string;
}

export interface UpcomingMatchInfo {
  id: string;
  opponentName: string;
  opponentId?: string | null;
  date: string;
  mapId: string;
  competition: string;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export interface BbtHqDatabase {
  version: number;
  team: {
    name: string;
    shortName: string;
    motto: string;
    logoUrl: string;
    originalLogoUrl: string;
    bannerUrl: string;
  };
  players: TeamPlayer[];
  users: UserAccount[];
  strategies: MapStrategy[];
  lineups: TeamLineup[];
  matches: TeamMatch[];
  opponents: OpponentProfile[];
  upcomingMatch: UpcomingMatchInfo | null;
  auditLogs: AuditLogEntry[];
}

export interface PublicUserSession {
  userId: string;
  username: string;
  displayName: string;
  playerId: string | null;
  role: UserRole;
  canAddNotes: boolean;
}
