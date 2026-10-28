import { getAgentByIdOrName, getMapByIdOrName } from './valorant-data';
import type { TeamMatch, TeamPlayer } from '../types/hq';

export interface StatsFilter {
  playerId?: string; // 'ALL' or player id
  mapId?: string; // 'ALL' or map id
  agentId?: string; // 'ALL' or agent id
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
}

export interface ComputedAgentUsage {
  agentId: string;
  agentName: string;
  matches: number;
  wins: number;
  losses: number;
  winrate: number | null;
  pickSharePct: number;
  kills: number;
  deaths: number;
  kd: number | null;
}

export interface ComputedMapPerformance {
  mapId: string;
  mapName: string;
  matches: number;
  wins: number;
  losses: number;
  winrate: number | null;
  roundsWon: number;
  roundsLost: number;
}

export interface ComputedPlayerStats {
  playerId: string;
  playerName: string;
  playerTag: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winrate: number | null; // null if matchesPlayed === 0
  kills: number;
  deaths: number;
  assists: number;
  kd: number | null; // null if matchesPlayed === 0
  avgKillsPerMatch: number | null;
  avgAcs: number | null;
  avgHsPct: number | null;
  avgAdr: number | null;
  topAgents: ComputedAgentUsage[];
  mapStats: ComputedMapPerformance[];
}

export interface ComputedTeamOverview {
  totalMatches: number;
  wins: number;
  losses: number;
  teamWinrate: number | null;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  teamKd: number | null;
  avgAcs: number | null;
  avgHsPct: number | null;
  playerRankings: ComputedPlayerStats[];
  teamAgentUsage: ComputedAgentUsage[];
  teamMapPerformance: ComputedMapPerformance[];
}

export function filterMatches(matches: TeamMatch[], filter: StatsFilter): TeamMatch[] {
  return matches.filter((m) => {
    // Map Filter
    if (filter.mapId && filter.mapId !== 'ALL') {
      const mMap = getMapByIdOrName(m.mapId)?.id || m.mapId.toLowerCase();
      const fMap = getMapByIdOrName(filter.mapId)?.id || filter.mapId.toLowerCase();
      if (mMap !== fMap) return false;
    }

    // Date From Filter
    if (filter.dateFrom) {
      const matchDay = m.date.slice(0, 10);
      if (matchDay < filter.dateFrom) return false;
    }

    // Date To Filter
    if (filter.dateTo) {
      const matchDay = m.date.slice(0, 10);
      if (matchDay > filter.dateTo) return false;
    }

    // Player & Agent Filter: check if at least one player entry in this match matches
    const hasPlayerFilter = Boolean(filter.playerId && filter.playerId !== 'ALL');
    const hasAgentFilter = Boolean(filter.agentId && filter.agentId !== 'ALL');

    if (hasPlayerFilter || hasAgentFilter) {
      const targetAgentId = hasAgentFilter
        ? getAgentByIdOrName(filter.agentId)?.id || filter.agentId!.toLowerCase()
        : null;

      const matchedEntry = m.playerStats.some((ps) => {
        const playerMatch = !hasPlayerFilter || ps.playerId === filter.playerId;
        const psAgentId = getAgentByIdOrName(ps.agentId)?.id || ps.agentId.toLowerCase();
        const agentMatch = !targetAgentId || psAgentId === targetAgentId;
        return playerMatch && agentMatch;
      });

      if (!matchedEntry) return false;
    }

    return true;
  });
}

export function computeStatistics(
  matches: TeamMatch[],
  players: TeamPlayer[],
  filter: StatsFilter = {}
): ComputedTeamOverview {
  const filteredMatches = filterMatches(matches, filter);
  const hasPlayerFilter = Boolean(filter.playerId && filter.playerId !== 'ALL');
  const targetAgentId =
    filter.agentId && filter.agentId !== 'ALL'
      ? getAgentByIdOrName(filter.agentId)?.id || filter.agentId.toLowerCase()
      : null;

  let totalKills = 0;
  let totalDeaths = 0;
  let totalAssists = 0;
  let acsSum = 0;
  let acsCount = 0;
  let hsSum = 0;
  let hsCount = 0;

  let wins = 0;
  let losses = 0;

  // Map aggregation at team level
  const mapMap = new Map<
    string,
    {
      mapId: string;
      mapName: string;
      matches: number;
      wins: number;
      losses: number;
      roundsWon: number;
      roundsLost: number;
    }
  >();

  // Agent aggregation at team level
  const teamAgentMap = new Map<
    string,
    {
      agentId: string;
      agentName: string;
      matches: number;
      wins: number;
      losses: number;
      kills: number;
      deaths: number;
    }
  >();

  let totalAgentPicksCount = 0;

  for (const m of filteredMatches) {
    const isWin = m.result === 'WIN';
    if (isWin) wins += 1;
    else losses += 1;

    const mapAsset = getMapByIdOrName(m.mapId);
    const mapKey = mapAsset?.id || m.mapId.toLowerCase();
    const mapName = mapAsset?.name || m.mapId;

    const existingMap = mapMap.get(mapKey) || {
      mapId: mapKey,
      mapName,
      matches: 0,
      wins: 0,
      losses: 0,
      roundsWon: 0,
      roundsLost: 0,
    };
    existingMap.matches += 1;
    if (isWin) existingMap.wins += 1;
    else existingMap.losses += 1;
    existingMap.roundsWon += m.roundsWon;
    existingMap.roundsLost += m.roundsLost;
    mapMap.set(mapKey, existingMap);

    for (const ps of m.playerStats) {
      if (hasPlayerFilter && ps.playerId !== filter.playerId) continue;
      const psAgentAsset = getAgentByIdOrName(ps.agentId);
      const psAgentId = psAgentAsset?.id || ps.agentId.toLowerCase();
      if (targetAgentId && psAgentId !== targetAgentId) continue;

      totalKills += ps.kills;
      totalDeaths += ps.deaths;
      totalAssists += ps.assists;

      if (typeof ps.acs === 'number' && !Number.isNaN(ps.acs)) {
        acsSum += ps.acs;
        acsCount += 1;
      }
      if (typeof ps.headshotPct === 'number' && !Number.isNaN(ps.headshotPct)) {
        hsSum += ps.headshotPct;
        hsCount += 1;
      }

      totalAgentPicksCount += 1;
      const agentEntry = teamAgentMap.get(psAgentId) || {
        agentId: psAgentId,
        agentName: psAgentAsset?.name || ps.agentId,
        matches: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
      };
      agentEntry.matches += 1;
      if (isWin) agentEntry.wins += 1;
      else agentEntry.losses += 1;
      agentEntry.kills += ps.kills;
      agentEntry.deaths += ps.deaths;
      teamAgentMap.set(psAgentId, agentEntry);
    }
  }

  // Per-player calculations
  const targetPlayers = hasPlayerFilter
    ? players.filter((p) => p.id === filter.playerId)
    : players;

  const playerRankings: ComputedPlayerStats[] = targetPlayers.map((player) => {
    let pMatches = 0;
    let pWins = 0;
    let pLosses = 0;
    let pKills = 0;
    let pDeaths = 0;
    let pAssists = 0;
    let pAcsSum = 0;
    let pAcsCount = 0;
    let pHsSum = 0;
    let pHsCount = 0;
    let pAdrSum = 0;
    let pAdrCount = 0;

    const pAgentMap = new Map<
      string,
      {
        agentId: string;
        agentName: string;
        matches: number;
        wins: number;
        losses: number;
        kills: number;
        deaths: number;
      }
    >();

    const pMapMap = new Map<
      string,
      {
        mapId: string;
        mapName: string;
        matches: number;
        wins: number;
        losses: number;
        roundsWon: number;
        roundsLost: number;
      }
    >();

    for (const m of filteredMatches) {
      const entry = m.playerStats.find(
        (ps) =>
          ps.playerId === player.id ||
          ps.playerName.trim().toLowerCase() === player.name.trim().toLowerCase()
      );
      if (!entry) continue;

      const entryAgentAsset = getAgentByIdOrName(entry.agentId);
      const entryAgentId = entryAgentAsset?.id || entry.agentId.toLowerCase();
      if (targetAgentId && entryAgentId !== targetAgentId) continue;

      const isWin = m.result === 'WIN';
      pMatches += 1;
      if (isWin) pWins += 1;
      else pLosses += 1;

      pKills += entry.kills;
      pDeaths += entry.deaths;
      pAssists += entry.assists;

      if (typeof entry.acs === 'number' && !Number.isNaN(entry.acs)) {
        pAcsSum += entry.acs;
        pAcsCount += 1;
      }
      if (typeof entry.headshotPct === 'number' && !Number.isNaN(entry.headshotPct)) {
        pHsSum += entry.headshotPct;
        pHsCount += 1;
      }
      if (typeof entry.adr === 'number' && !Number.isNaN(entry.adr)) {
        pAdrSum += entry.adr;
        pAdrCount += 1;
      }

      // Agent usage for player
      const agRec = pAgentMap.get(entryAgentId) || {
        agentId: entryAgentId,
        agentName: entryAgentAsset?.name || entry.agentId,
        matches: 0,
        wins: 0,
        losses: 0,
        kills: 0,
        deaths: 0,
      };
      agRec.matches += 1;
      if (isWin) agRec.wins += 1;
      else agRec.losses += 1;
      agRec.kills += entry.kills;
      agRec.deaths += entry.deaths;
      pAgentMap.set(entryAgentId, agRec);

      // Map stats for player
      const mapAsset = getMapByIdOrName(m.mapId);
      const mapKey = mapAsset?.id || m.mapId.toLowerCase();
      const mapRec = pMapMap.get(mapKey) || {
        mapId: mapKey,
        mapName: mapAsset?.name || m.mapId,
        matches: 0,
        wins: 0,
        losses: 0,
        roundsWon: 0,
        roundsLost: 0,
      };
      mapRec.matches += 1;
      if (isWin) mapRec.wins += 1;
      else mapRec.losses += 1;
      mapRec.roundsWon += m.roundsWon;
      mapRec.roundsLost += m.roundsLost;
      pMapMap.set(mapKey, mapRec);
    }

    const kd =
      pMatches === 0
        ? null
        : pDeaths === 0
        ? pKills
        : Number((pKills / pDeaths).toFixed(2));

    const winrate =
      pMatches === 0 ? null : Number(((pWins / pMatches) * 100).toFixed(1));

    const avgKillsPerMatch =
      pMatches === 0 ? null : Number((pKills / pMatches).toFixed(1));

    const avgAcs = pAcsCount === 0 ? null : Math.round(pAcsSum / pAcsCount);
    const avgHsPct =
      pHsCount === 0 ? null : Number((pHsSum / pHsCount).toFixed(1));
    const avgAdr =
      pAdrCount === 0 ? null : Number((pAdrSum / pAdrCount).toFixed(1));

    const topAgents: ComputedAgentUsage[] = Array.from(pAgentMap.values())
      .map((ag) => ({
        agentId: ag.agentId,
        agentName: ag.agentName,
        matches: ag.matches,
        wins: ag.wins,
        losses: ag.losses,
        winrate: Number(((ag.wins / ag.matches) * 100).toFixed(1)),
        pickSharePct:
          pMatches > 0 ? Math.round((ag.matches / pMatches) * 100) : 0,
        kills: ag.kills,
        deaths: ag.deaths,
        kd:
          ag.deaths === 0
            ? ag.kills
            : Number((ag.kills / ag.deaths).toFixed(2)),
      }))
      .sort((a, b) => b.matches - a.matches || (b.kd || 0) - (a.kd || 0));

    const mapStats: ComputedMapPerformance[] = Array.from(pMapMap.values())
      .map((mp) => ({
        ...mp,
        winrate: Number(((mp.wins / mp.matches) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.matches - a.matches);

    return {
      playerId: player.id,
      playerName: player.name,
      playerTag: player.tag,
      matchesPlayed: pMatches,
      wins: pWins,
      losses: pLosses,
      winrate,
      kills: pKills,
      deaths: pDeaths,
      assists: pAssists,
      kd,
      avgKillsPerMatch,
      avgAcs,
      avgHsPct,
      avgAdr,
      topAgents,
      mapStats,
    };
  });

  // Sort players: those with matches first by K/D desc, then by name
  playerRankings.sort((a, b) => {
    if (a.matchesPlayed === 0 && b.matchesPlayed === 0) {
      return a.playerName.localeCompare(b.playerName);
    }
    if (a.matchesPlayed === 0) return 1;
    if (b.matchesPlayed === 0) return -1;
    return (b.kd ?? 0) - (a.kd ?? 0) || b.kills - a.kills;
  });

  const totalMatches = filteredMatches.length;
  const teamWinrate =
    totalMatches === 0 ? null : Number(((wins / totalMatches) * 100).toFixed(1));

  const teamKd =
    totalMatches === 0 || (totalKills === 0 && totalDeaths === 0)
      ? null
      : totalDeaths === 0
      ? totalKills
      : Number((totalKills / totalDeaths).toFixed(2));

  const teamAgentUsage: ComputedAgentUsage[] = Array.from(teamAgentMap.values())
    .map((ag) => ({
      agentId: ag.agentId,
      agentName: ag.agentName,
      matches: ag.matches,
      wins: ag.wins,
      losses: ag.losses,
      winrate: Number(((ag.wins / ag.matches) * 100).toFixed(1)),
      pickSharePct:
        totalAgentPicksCount > 0
          ? Math.round((ag.matches / totalAgentPicksCount) * 100)
          : 0,
      kills: ag.kills,
      deaths: ag.deaths,
      kd:
        ag.deaths === 0
          ? ag.kills
          : Number((ag.kills / ag.deaths).toFixed(2)),
    }))
    .sort((a, b) => b.matches - a.matches || (b.kd || 0) - (a.kd || 0));

  const teamMapPerformance: ComputedMapPerformance[] = Array.from(mapMap.values())
    .map((mp) => ({
      ...mp,
      winrate: Number(((mp.wins / mp.matches) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.matches - a.matches || (b.winrate || 0) - (a.winrate || 0));

  return {
    totalMatches,
    wins,
    losses,
    teamWinrate,
    totalKills,
    totalDeaths,
    totalAssists,
    teamKd,
    avgAcs: acsCount === 0 ? null : Math.round(acsSum / acsCount),
    avgHsPct: hsCount === 0 ? null : Number((hsSum / hsCount).toFixed(1)),
    playerRankings,
    teamAgentUsage,
    teamMapPerformance,
  };
}
