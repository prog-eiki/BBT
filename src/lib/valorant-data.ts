import rawAssets from '../data/raw_assets.json';
import type {
  AgentRole,
  StrategySite,
  StrategySide,
  StrategyType,
  TeamPlayer,
  ValorantAgentAsset,
  ValorantMapAsset,
} from '../types/hq';

export const BBT_TEAM_INFO = {
  name: 'BigBlackTea',
  shortName: 'BBT',
  motto: 'Strategie. Teamwork. Erfolg.',
  logoUrl: '/bbt-logo.png',
  originalLogoUrl: '/bbt-original.png',
  bannerUrl: '/bbt-banner.png',
};

export const AGENT_ROLES_META: {
  id: AgentRole;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    id: 'Duelist',
    label: 'Duelist',
    description: 'Entry & First Contact',
    color: '#E63946',
  },
  {
    id: 'Initiator',
    label: 'Initiator',
    description: 'Info & Winkel-Clear',
    color: '#73FBD3',
  },
  {
    id: 'Controller',
    label: 'Controller',
    description: 'Smokes & Map-Control',
    color: '#C8A273',
  },
  {
    id: 'Sentinel',
    label: 'Sentinel',
    description: 'Anchor & Flank-Watch',
    color: '#60A5FA',
  },
];

export const STRATEGY_SIDES: StrategySide[] = ['Angriff', 'Verteidigung'];

export const STRATEGY_TYPES: StrategyType[] = [
  'Default',
  'Execute',
  'Rush',
  'Retake',
  'Fake',
  'Lurk',
  'Pistol',
  'Eco / Force',
];

export const VALORANT_AGENTS_LIST: ValorantAgentAsset[] = (
  rawAssets.agents as any[]
).map((agent) => ({
  id: agent.id,
  name: agent.name,
  role: agent.role as AgentRole,
  roleIcon: agent.roleIcon || '',
  displayIcon: agent.displayIcon || '',
  fullPortrait: agent.fullPortrait || agent.displayIcon || '',
  bustPortrait: agent.bustPortrait || agent.fullPortrait || agent.displayIcon || '',
  background: agent.background || '',
  colors: agent.colors || [],
  abilities: agent.abilities || [],
}));

const THREE_SITE_MAPS = new Set(['haven', 'lotus']);

export const VALORANT_MAPS_LIST: ValorantMapAsset[] = (
  rawAssets.maps as any[]
).map((map) => {
  const id = String(map.id).toLowerCase();
  const availableSites: StrategySite[] = THREE_SITE_MAPS.has(id)
    ? ['A', 'B', 'C', 'Mid', 'Global']
    : ['A', 'B', 'Mid', 'Global'];

  return {
    id,
    name: map.name,
    coordinates: map.coordinates || '',
    sites: map.sites || (THREE_SITE_MAPS.has(id) ? 'A/B/C Sites' : 'A/B Sites'),
    availableSites,
    splash: map.splash || '',
    stylizedBackground: map.stylizedBackground || map.splash || '',
    listViewIcon: map.listViewIcon || map.splash || '',
    displayIcon: map.displayIcon || '',
    callouts: map.callouts || [],
  };
});

export const DEFAULT_BBT_PLAYERS: TeamPlayer[] = [
  {
    id: 'p-lunar',
    name: 'Lunar',
    tag: '7822',
    primaryRole: 'Duelist',
    favoriteAgents: ['jett', 'reyna'],
    isStarter: true,
    notes: 'IGL & Entry Duelist',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
  },
  {
    id: 'p-kuronami',
    name: 'Kuronami 雨雲',
    tag: 'RED',
    primaryRole: 'Duelist',
    favoriteAgents: ['jett', 'reyna', 'omen'],
    isStarter: true,
    notes: 'Primary Star Duelist / Operator',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
  },
  {
    id: 'p-fydi',
    name: 'fydi',
    tag: '9522',
    primaryRole: 'Initiator',
    favoriteAgents: ['skye', 'tejo', 'omen', 'killjoy'],
    isStarter: true,
    notes: 'Flex Initiator / Controller',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
  },
  {
    id: 'p-xjoshhd',
    name: 'XJoshHD',
    tag: '9317',
    primaryRole: 'Initiator',
    favoriteAgents: ['gekko', 'clove', 'sova'],
    isStarter: true,
    notes: 'Initiator & Controller Flex',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
  },
  {
    id: 'p-xxsensenmanx',
    name: 'XxSensenmanX',
    tag: '7267',
    primaryRole: 'Sentinel',
    favoriteAgents: ['cypher', 'kayo'],
    isStarter: true,
    notes: 'Site Anchor & Lurker',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
  },
  {
    id: 'p-shadowlina',
    name: 'ShadowLina',
    tag: '6700',
    primaryRole: 'Sentinel',
    favoriteAgents: ['killjoy', 'sage', 'viper'],
    isStarter: false,
    notes: 'Sentinel Specialist',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
  },
];

export function getAgentByIdOrName(
  idOrName: string | null | undefined
): ValorantAgentAsset | undefined {
  if (!idOrName) return undefined;
  const clean = idOrName.trim().toLowerCase();
  return VALORANT_AGENTS_LIST.find(
    (a) =>
      a.id.toLowerCase() === clean ||
      a.name.toLowerCase() === clean ||
      (clean === 'kayo' && a.name.toLowerCase() === 'kay/o') ||
      (clean === 'kay/o' && a.id.toLowerCase() === 'kayo')
  );
}

export function getMapByIdOrName(
  idOrName: string | null | undefined
): ValorantMapAsset | undefined {
  if (!idOrName) return undefined;
  const clean = idOrName.trim().toLowerCase();
  return VALORANT_MAPS_LIST.find(
    (m) => m.id.toLowerCase() === clean || m.name.toLowerCase() === clean
  );
}

export function getRoleColor(role?: AgentRole | string): string {
  switch (role) {
    case 'Duelist':
      return '#E63946';
    case 'Initiator':
      return '#73FBD3';
    case 'Controller':
      return '#C8A273';
    case 'Sentinel':
      return '#60A5FA';
    default:
      return '#C8A273';
  }
}
