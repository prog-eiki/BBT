'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  ChevronDown,
  ChevronRight,
  Crosshair,
  Edit3,
  Plus,
  RotateCcw,
  Swords,
  Trash2,
  X,
} from 'lucide-react';
import {
  getAgentByIdOrName,
  getMapByIdOrName,
  VALORANT_AGENTS_LIST,
  VALORANT_MAPS_LIST,
} from '@/lib/valorant-data';
import {
  ComputedPlayerStats,
  computeStatistics,
} from '@/lib/stats-calculator';
import type {
  MatchPlayerStat,
  TeamMatch,
  TeamPlayer,
} from '@/types/hq';

interface PlayerStatsViewProps {
  matches: TeamMatch[];
  players: TeamPlayer[];
  openMatchModalOnMount?: boolean;
  onClearMatchModalTrigger?: () => void;
  isAdmin: boolean;
  onSaveMatch: (
    match: Partial<TeamMatch> & {
      opponentName: string;
      mapId: string;
      roundsWon: number;
      roundsLost: number;
    }
  ) => Promise<void>;
  onDeleteMatch: (matchId: string) => Promise<void>;
}

export const PlayerStatsView: React.FC<PlayerStatsViewProps> = ({
  matches,
  players,
  openMatchModalOnMount,
  onClearMatchModalTrigger,
  isAdmin,
  onSaveMatch,
  onDeleteMatch,
}) => {
  // Filters
  const [filterPlayerId, setFilterPlayerId] = useState<string>('ALL');
  const [filterMapId, setFilterMapId] = useState<string>('ALL');
  const [filterAgentId, setFilterAgentId] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Selected Player Profile Drawer/Card
  const [inspectedPlayerId, setInspectedPlayerId] = useState<string | null>(
    null
  );

  // Expanded Match Scoreboard ID
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(
    matches[0]?.id || null
  );

  // Match Form Modal State
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | undefined>(
    undefined
  );
  const [formDate, setFormDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [formOpponent, setFormOpponent] = useState<string>('');
  const [formMapId, setFormMapId] = useState<string>('bind');
  const [formRoundsWon, setFormRoundsWon] = useState<number>(13);
  const [formRoundsLost, setFormRoundsLost] = useState<number>(8);
  const [formResult, setFormResult] = useState<'WIN' | 'LOSS'>('WIN');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formPlayerRows, setFormPlayerRows] = useState<MatchPlayerStat[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingMatch, setSavingMatch] = useState(false);

  useEffect(() => {
    if (openMatchModalOnMount && isAdmin) {
      handleOpenNewMatchModal();
      onClearMatchModalTrigger?.();
    }
  }, [openMatchModalOnMount, isAdmin]);

  const stats = useMemo(
    () =>
      computeStatistics(matches, players, {
        playerId: filterPlayerId,
        mapId: filterMapId,
        agentId: filterAgentId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    [matches, players, filterPlayerId, filterMapId, filterAgentId, dateFrom, dateTo]
  );

  const inspectedPlayerStats: ComputedPlayerStats | null = useMemo(() => {
    if (!inspectedPlayerId) return null;
    return (
      stats.playerRankings.find((p) => p.playerId === inspectedPlayerId) || null
    );
  }, [stats.playerRankings, inspectedPlayerId]);

  const handleOpenNewMatchModal = () => {
    const defaultAgents = ['jett', 'cypher', 'skye', 'gekko', 'killjoy'];
    setEditingMatchId(undefined);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormOpponent('');
    setFormMapId('bind');
    setFormRoundsWon(13);
    setFormRoundsLost(7);
    setFormResult('WIN');
    setFormNotes('');
    setFormError(null);
    setFormPlayerRows(
      [0, 1, 2, 3, 4].map((idx) => {
        const p = players[idx];
        return {
          id: `row-${idx}`,
          playerId: p?.id || '',
          playerName: p?.name || '',
          playerTag: p?.tag || '',
          agentId: defaultAgents[idx] || 'jett',
          kills: 15,
          deaths: 10,
          assists: 5,
          acs: 210,
          headshotPct: 20,
        };
      })
    );
    setIsMatchModalOpen(true);
  };

  const handleOpenEditMatchModal = (m: TeamMatch) => {
    setEditingMatchId(m.id);
    setFormDate(m.date.slice(0, 10));
    setFormOpponent(m.opponentName);
    setFormMapId(m.mapId);
    setFormRoundsWon(m.roundsWon);
    setFormRoundsLost(m.roundsLost);
    setFormResult(m.result);
    setFormNotes(m.notes || '');
    setFormError(null);
    setFormPlayerRows(
      m.playerStats.map((ps) => ({
        ...ps,
      }))
    );
    setIsMatchModalOpen(true);
  };

  const handleSaveMatchForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!formOpponent.trim()) {
      setFormError('Bitte den Namen des gegnerischen Teams angeben.');
      return;
    }

    // Check that no player is selected twice in the same match
    const chosenIds = formPlayerRows
      .map((r) => r.playerId)
      .filter(Boolean);
    if (new Set(chosenIds).size !== chosenIds.length) {
      setFormError(
        'Jeder eingesetzte Spieler darf im selben Match nur einmal vorkommen.'
      );
      return;
    }

    setSavingMatch(true);
    try {
      await onSaveMatch({
        id: editingMatchId,
        date: new Date(`${formDate}T19:00:00.000Z`).toISOString(),
        opponentName: formOpponent.trim(),
        mapId: formMapId,
        roundsWon: Number(formRoundsWon) || 0,
        roundsLost: Number(formRoundsLost) || 0,
        result: formResult,
        notes: formNotes.trim(),
        playerStats: formPlayerRows.map((row) => {
          const p = players.find((pl) => pl.id === row.playerId);
          return {
            ...row,
            playerName: p?.name || row.playerName || 'Spieler',
            playerTag: p?.tag || row.playerTag || '',
            kills: Math.max(0, Number(row.kills) || 0),
            deaths: Math.max(0, Number(row.deaths) || 0),
            assists: Math.max(0, Number(row.assists) || 0),
            acs:
              row.acs !== undefined && row.acs !== null && String(row.acs) !== ''
                ? Number(row.acs)
                : null,
            headshotPct:
              row.headshotPct !== undefined &&
              row.headshotPct !== null &&
              String(row.headshotPct) !== ''
                ? Number(row.headshotPct)
                : null,
          };
        }),
      });
      setIsMatchModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Fehler beim Speichern des Matches.');
    } finally {
      setSavingMatch(false);
    }
  };

  const hasActiveFilters =
    filterPlayerId !== 'ALL' ||
    filterMapId !== 'ALL' ||
    filterAgentId !== 'ALL' ||
    Boolean(dateFrom) ||
    Boolean(dateTo);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-wider text-white">
            Spielerstatistiken
          </h1>
          <p className="text-xs sm:text-sm text-[#878C8F]">
            Analysiere die Leistung deines Teams – alle Kennzahlen werden exakt aus den gespeicherten Matchdaten berechnet.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenNewMatchModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(158,20,27,0.45)] transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Match eintragen</span>
          </button>
        )}
      </div>

      {/* Filter Bar (Matches Bottom-Right Screen in Reference Image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <select
          value={filterPlayerId}
          onChange={(e) => setFilterPlayerId(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#0F1218] border border-white/10 text-xs text-white focus:outline-none focus:border-[#9E141B]"
        >
          <option value="ALL">Alle Spieler</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} #{p.tag}
            </option>
          ))}
        </select>

        <select
          value={filterMapId}
          onChange={(e) => setFilterMapId(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#0F1218] border border-white/10 text-xs text-white focus:outline-none focus:border-[#9E141B]"
        >
          <option value="ALL">Alle Maps</option>
          {VALORANT_MAPS_LIST.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={filterAgentId}
          onChange={(e) => setFilterAgentId(e.target.value)}
          className="px-3.5 py-2.5 rounded-xl bg-[#0F1218] border border-white/10 text-xs text-white focus:outline-none focus:border-[#9E141B]"
        >
          <option value="ALL">Alle Agenten</option>
          {VALORANT_AGENTS_LIST.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.role})
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 lg:col-span-2">
          <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0F1218] border border-white/10">
            <Calendar className="w-3.5 h-3.5 text-[#C8A273] shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none w-full"
              title="Zeitraum Von"
            />
            <span className="text-[#878C8F] text-xs">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none w-full"
              title="Zeitraum Bis"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFilterPlayerId('ALL');
                setFilterMapId('ALL');
                setFilterAgentId('ALL');
                setDateFrom('');
                setDateTo('');
              }}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#C8A273] transition"
              title="Filter zurücksetzen"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4 Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10">
          <div className="text-xs text-[#878C8F]">Team K/D</div>
          <div className="text-3xl font-display font-extrabold text-white mt-1">
            {stats.teamKd !== null ? stats.teamKd.toFixed(2) : '—'}
          </div>
          <div className="text-[11px] font-mono text-[#878C8F] mt-1">
            {stats.totalKills} Kills / {stats.totalDeaths} Deaths
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10">
          <div className="text-xs text-[#878C8F]">Team Winrate</div>
          <div className="text-3xl font-display font-extrabold text-white mt-1">
            {stats.teamWinrate !== null ? `${stats.teamWinrate}%` : '—'}
          </div>
          <div className="text-[11px] font-mono text-[#73FBD3] mt-1">
            {stats.totalMatches > 0
              ? `${stats.wins}S – ${stats.losses}N`
              : 'Keine gewerteten Matches'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10">
          <div className="text-xs text-[#878C8F]">Gesamt Matches</div>
          <div className="text-3xl font-display font-extrabold text-white mt-1">
            {stats.totalMatches}
          </div>
          <div className="text-[11px] font-mono text-[#878C8F] mt-1">
            Ø ACS: {stats.avgAcs ?? '—'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10">
          <div className="text-xs text-[#878C8F]">Gesamt Kills</div>
          <div className="text-3xl font-display font-extrabold text-white mt-1">
            {stats.totalKills.toLocaleString('de-DE')}
          </div>
          <div className="text-[11px] font-mono text-[#C8A273] mt-1">
            {stats.totalAssists} Assists • Ø HS: {stats.avgHsPct !== null ? `${stats.avgHsPct}%` : '—'}
          </div>
        </div>
      </div>

      {/* Main Content Grid: Left Player Comparison Table & Profiles + Right Agent & Map Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Player Table + Individual Profile + Match Scoreboards */}
        <div className="lg:col-span-8 space-y-6">
          {/* Player Comparison Table */}
          <div className="rounded-2xl bg-[#0F1218] border border-white/10 overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white">
                Spielerübersicht & Vergleich (Klick für Detailprofil)
              </h2>
              <span className="text-[11px] text-[#878C8F]">
                {stats.playerRankings.length} Spieler im Kader
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-mono uppercase text-[#878C8F] bg-[#0B0D12]">
                    <th className="py-3 px-4">Spieler</th>
                    <th className="py-3 px-3 text-right">K/D</th>
                    <th className="py-3 px-3 text-right">ACS</th>
                    <th className="py-3 px-3 text-right">HS%</th>
                    <th className="py-3 px-3 text-right">Winrate</th>
                    <th className="py-3 px-3 text-right">Ø Kills</th>
                    <th className="py-3 px-3 text-right">K / D / A</th>
                    <th className="py-3 px-4 text-right">Matches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {stats.playerRankings.map((p) => {
                    const topAg = p.topAgents[0]
                      ? getAgentByIdOrName(p.topAgents[0].agentId)
                      : null;
                    const isInspected = inspectedPlayerId === p.playerId;

                    return (
                      <tr
                        key={p.playerId}
                        onClick={() =>
                          setInspectedPlayerId(
                            isInspected ? null : p.playerId
                          )
                        }
                        className={`cursor-pointer transition ${
                          isInspected
                            ? 'bg-[#9E141B]/20'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#141822] border border-[#C8A273]/30 overflow-hidden flex items-center justify-center shrink-0">
                              {topAg?.displayIcon ? (
                                <img
                                  src={topAg.displayIcon}
                                  alt={topAg.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Crosshair className="w-4 h-4 text-[#878C8F]" />
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{p.playerName}</span>
                                <span className="text-[11px] font-mono font-normal text-[#878C8F]">
                                  #{p.playerTag}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#C8A273]">
                                {p.topAgents.length > 0
                                  ? p.topAgents
                                      .slice(0, 2)
                                      .map((a) => a.agentName)
                                      .join(', ')
                                  : 'Noch kein Match'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                          {p.kd !== null ? (
                            <span
                              className={
                                p.kd >= 1.2
                                  ? 'text-[#73FBD3]'
                                  : p.kd >= 1.0
                                  ? 'text-white'
                                  : 'text-[#C8A273]'
                              }
                            >
                              {p.kd.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[#878C8F]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-[#ECE8E1]">
                          {p.avgAcs !== null ? p.avgAcs : '—'}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-[#ECE8E1]">
                          {p.avgHsPct !== null ? `${p.avgHsPct}%` : '—'}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono">
                          {p.winrate !== null ? (
                            <span className="text-white font-semibold">
                              {p.winrate}%
                            </span>
                          ) : (
                            <span className="text-[#878C8F]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-[#C8A273]">
                          {p.avgKillsPerMatch !== null
                            ? p.avgKillsPerMatch
                            : '—'}
                        </td>

                        <td className="py-3.5 px-3 text-right font-mono text-[#878C8F]">
                          {p.matchesPlayed > 0
                            ? `${p.kills} / ${p.deaths} / ${p.assists}`
                            : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 font-mono text-white">
                            <span>{p.matchesPlayed}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-[#878C8F]" />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Detailed Player Profile Card (when a player row is clicked) */}
          {inspectedPlayerStats && (
            <div className="p-6 rounded-2xl bg-[#121620] border border-[#C8A273]/40 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#C8A273]">
                    INDIVIDUELLES SPIELERPROFIL
                  </div>
                  <h3 className="text-2xl font-display font-extrabold uppercase text-white">
                    {inspectedPlayerStats.playerName}{' '}
                    <span className="text-sm font-mono text-[#878C8F]">
                      #{inspectedPlayerStats.playerTag}
                    </span>
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedPlayerId(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#878C8F] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {inspectedPlayerStats.matchesPlayed > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-[#090A0E] border border-white/5">
                      <div className="text-[11px] text-[#878C8F]">
                        K/D Ratio
                      </div>
                      <div className="text-xl font-display font-bold text-[#73FBD3]">
                        {inspectedPlayerStats.kd?.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-[#878C8F]">
                        {inspectedPlayerStats.kills}K /{' '}
                        {inspectedPlayerStats.deaths}D /{' '}
                        {inspectedPlayerStats.assists}A
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#090A0E] border border-white/5">
                      <div className="text-[11px] text-[#878C8F]">
                        Siege / Niederlagen
                      </div>
                      <div className="text-xl font-display font-bold text-white">
                        {inspectedPlayerStats.wins}S –{' '}
                        {inspectedPlayerStats.losses}N
                      </div>
                      <div className="text-[10px] font-mono text-[#C8A273]">
                        Winrate: {inspectedPlayerStats.winrate}%
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#090A0E] border border-white/5">
                      <div className="text-[11px] text-[#878C8F]">
                        Ø Kills / Match
                      </div>
                      <div className="text-xl font-display font-bold text-white">
                        {inspectedPlayerStats.avgKillsPerMatch}
                      </div>
                      <div className="text-[10px] font-mono text-[#878C8F]">
                        {inspectedPlayerStats.matchesPlayed} Matches gesamt
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-[#090A0E] border border-white/5">
                      <div className="text-[11px] text-[#878C8F]">
                        Ø ACS & Headshot%
                      </div>
                      <div className="text-xl font-display font-bold text-white">
                        {inspectedPlayerStats.avgAcs ?? '—'} ACS
                      </div>
                      <div className="text-[10px] font-mono text-[#73FBD3]">
                        HS%: {inspectedPlayerStats.avgHsPct !== null ? `${inspectedPlayerStats.avgHsPct}%` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Player's Most Played Agents & Map Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#C8A273] mb-2">
                        Häufigste Agents ({inspectedPlayerStats.playerName})
                      </h4>
                      <div className="space-y-1.5">
                        {inspectedPlayerStats.topAgents.map((ag) => {
                          const asset = getAgentByIdOrName(ag.agentId);
                          return (
                            <div
                              key={ag.agentId}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#090A0E] border border-white/5 text-xs"
                            >
                              <div className="flex items-center gap-2">
                                {asset?.displayIcon && (
                                  <img
                                    src={asset.displayIcon}
                                    alt={ag.agentName}
                                    className="w-5 h-5 rounded-full"
                                  />
                                )}
                                <span className="font-semibold text-white">
                                  {ag.agentName}
                                </span>
                              </div>
                              <span className="font-mono text-[#878C8F]">
                                {ag.matches}M • {ag.kd?.toFixed(2)} K/D •{' '}
                                {ag.winrate}% WR
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#C8A273] mb-2">
                        Map-Statistiken ({inspectedPlayerStats.playerName})
                      </h4>
                      <div className="space-y-1.5">
                        {inspectedPlayerStats.mapStats.map((mp) => (
                          <div
                            key={mp.mapId}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#090A0E] border border-white/5 text-xs"
                          >
                            <span className="font-semibold text-white">
                              {mp.mapName}
                            </span>
                            <span className="font-mono text-[#73FBD3]">
                              {mp.wins}S–{mp.losses}N ({mp.winrate}% WR)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#878C8F] py-4">
                  Für {inspectedPlayerStats.playerName} wurden im gewählten Zeitraum noch keine Matches erfasst.
                </div>
              )}
            </div>
          )}

          {/* Match History & Scoreboards Section */}
          <div className="rounded-2xl bg-[#0F1218] border border-white/10 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Swords className="w-4 h-4 text-[#C8A273]" />
                <span>Gespeicherte Matches ({matches.length})</span>
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenNewMatchModal}
                  className="text-xs text-[#C8A273] hover:text-white transition"
                >
                  + Weiteres Match eintragen
                </button>
              )}
            </div>

            {matches.length > 0 ? (
              <div className="divide-y divide-white/10">
                {matches.map((m) => {
                  const mapObj = getMapByIdOrName(m.mapId);
                  const isWin = m.result === 'WIN';
                  const isExpanded = expandedMatchId === m.id;

                  return (
                    <div key={m.id} className="bg-[#0F1218]">
                      {/* Match Summary Header Row */}
                      <div
                        onClick={() =>
                          setExpandedMatchId(isExpanded ? null : m.id)
                        }
                        className="cursor-pointer px-5 py-3.5 hover:bg-white/[0.02] flex flex-wrap items-center justify-between gap-4 transition"
                      >
                        <div className="flex items-center gap-3.5">
                          <img
                            src={mapObj?.listViewIcon || mapObj?.splash}
                            alt={mapObj?.name || m.mapId}
                            className="w-14 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                          />
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                              <span>BBT vs. {m.opponentName}</span>
                              <span className="text-xs font-mono text-[#C8A273]">
                                [{mapObj?.name || m.mapId}]
                              </span>
                            </div>
                            <div className="text-[11px] text-[#878C8F]">
                              {new Date(m.date).toLocaleDateString('de-DE')} •{' '}
                              {m.competition || 'Premier'}
                              {m.notes ? ` • ${m.notes}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-lg font-display font-extrabold text-white">
                            {m.roundsWon} : {m.roundsLost}
                          </span>
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                              isWin
                                ? 'bg-[#73FBD3]/15 text-[#73FBD3] border border-[#73FBD3]/30'
                                : 'bg-[#9E141B]/30 text-red-200 border border-[#9E141B]'
                            }`}
                          >
                            {isWin ? 'Sieg' : 'Niederlage'}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-[#878C8F] transition ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded Match Scoreboard */}
                      {isExpanded && (
                        <div className="px-5 pb-4 pt-2 bg-[#090A0E] border-t border-white/5 space-y-3">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="text-[10px] font-mono uppercase text-[#878C8F] border-b border-white/10">
                                  <th className="py-2">Spieler</th>
                                  <th className="py-2">Agent</th>
                                  <th className="py-2 text-right">ACS</th>
                                  <th className="py-2 text-right">K</th>
                                  <th className="py-2 text-right">D</th>
                                  <th className="py-2 text-right">A</th>
                                  <th className="py-2 text-right">K/D</th>
                                  <th className="py-2 text-right">HS%</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5">
                                {m.playerStats.map((ps) => {
                                  const ag = getAgentByIdOrName(ps.agentId);
                                  const rowKd =
                                    ps.deaths === 0
                                      ? ps.kills
                                      : ps.kills / ps.deaths;
                                  return (
                                    <tr key={ps.id}>
                                      <td className="py-2 font-bold text-white">
                                        {ps.playerName}{' '}
                                        <span className="font-mono font-normal text-[#878C8F]">
                                          #{ps.playerTag}
                                        </span>
                                      </td>
                                      <td className="py-2">
                                        <div className="flex items-center gap-2">
                                          {ag?.displayIcon && (
                                            <img
                                              src={ag.displayIcon}
                                              alt={ag.name}
                                              className="w-5 h-5 rounded-full"
                                            />
                                          )}
                                          <span className="text-[#C8A273]">
                                            {ag?.name || ps.agentId}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="py-2 text-right font-mono text-white">
                                        {ps.acs ?? '—'}
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-white">
                                        {ps.kills}
                                      </td>
                                      <td className="py-2 text-right font-mono text-[#878C8F]">
                                        {ps.deaths}
                                      </td>
                                      <td className="py-2 text-right font-mono text-[#878C8F]">
                                        {ps.assists}
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-[#73FBD3]">
                                        {rowKd.toFixed(2)}
                                      </td>
                                      <td className="py-2 text-right font-mono text-[#ECE8E1]">
                                        {ps.headshotPct !== undefined &&
                                        ps.headshotPct !== null
                                          ? `${ps.headshotPct}%`
                                          : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {isAdmin && (
                            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditMatchModal(m)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white flex items-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-[#C8A273]" />
                                <span>Match bearbeiten</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteMatch(m.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-xs text-red-200 flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Löschen</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-[#878C8F]">
                Noch keine Matches gespeichert.
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Columns: Beliebteste Agents (Team) & Map-Performance */}
        <div className="lg:col-span-4 space-y-6">
          {/* Beliebteste Agents (Team) */}
          <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10 space-y-4">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white">
              Beliebteste Agents (Team)
            </h2>

            {stats.teamAgentUsage.length > 0 ? (
              <div className="space-y-3.5">
                {stats.teamAgentUsage.slice(0, 6).map((ag) => {
                  const asset = getAgentByIdOrName(ag.agentId);
                  return (
                    <div key={ag.agentId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          {asset?.displayIcon ? (
                            <img
                              src={asset.displayIcon}
                              alt={ag.agentName}
                              className="w-7 h-7 rounded-full object-cover border border-white/10"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-white/10" />
                          )}
                          <div>
                            <span className="font-bold text-white">
                              {ag.agentName}
                            </span>
                            <span className="text-[10px] text-[#878C8F] block">
                              {ag.matches} Picks • {ag.kd?.toFixed(2)} K/D
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-[#ECE8E1]">
                          {ag.pickSharePct}%
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-[#181C26] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#9E141B] to-[#E63946]"
                          style={{
                            width: `${Math.min(100, Math.max(8, ag.pickSharePct * 2.2))}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#878C8F] py-4">
                Keine Agent-Daten für diesen Filter.
              </div>
            )}
          </div>

          {/* Map-Performance */}
          <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10 space-y-4">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white">
              Map-Performance
            </h2>

            {stats.teamMapPerformance.length > 0 ? (
              <div className="space-y-3.5">
                {stats.teamMapPerformance.map((mp) => {
                  const mapAsset = getMapByIdOrName(mp.mapId);
                  return (
                    <div key={mp.mapId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={mapAsset?.listViewIcon || mapAsset?.splash}
                            alt={mp.mapName}
                            className="w-8 h-8 rounded-full object-cover border border-white/10"
                          />
                          <div>
                            <span className="font-bold text-white">
                              {mp.mapName}
                            </span>
                            <span className="text-[10px] text-[#878C8F] block">
                              {mp.wins}S – {mp.losses}N ({mp.roundsWon}:
                              {mp.roundsLost} Runden)
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-[#73FBD3]">
                          {mp.winrate !== null ? `${mp.winrate}%` : '—'}
                        </span>
                      </div>

                      <div className="h-1.5 w-full rounded-full bg-[#181C26] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#73FBD3]"
                          style={{ width: `${mp.winrate || 0}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#878C8F] py-4">
                Noch keine Map-Statistiken vorhanden.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Match Entry / Edit Modal */}
      {isMatchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
          onClick={() => setIsMatchModalOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0E1015] border border-[#C8A273]/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#9E141B]" />

            <div className="px-6 py-4 bg-[#14171F] border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold uppercase tracking-wider text-white">
                {editingMatchId ? 'Match bearbeiten' : 'Neues Match eintragen'}
              </h2>
              <button
                type="button"
                onClick={() => setIsMatchModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-[#9E141B] text-[#878C8F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveMatchForm}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200">
                  {formError}
                </div>
              )}

              {/* Match Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Datum *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Gegnerisches Team *
                  </label>
                  <input
                    type="text"
                    required
                    value={formOpponent}
                    onChange={(e) => setFormOpponent(e.target.value)}
                    placeholder="z. B. shadow fighters"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Map *
                  </label>
                  <select
                    value={formMapId}
                    onChange={(e) => setFormMapId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  >
                    {VALORANT_MAPS_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Ergebnis
                  </label>
                  <select
                    value={formResult}
                    onChange={(e) =>
                      setFormResult(e.target.value as 'WIN' | 'LOSS')
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  >
                    <option value="WIN">Sieg (WIN)</option>
                    <option value="LOSS">Niederlage (LOSS)</option>
                  </select>
                </div>
              </div>

              {/* Score & Notes */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    BBT Runden (Eigene)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={formRoundsWon}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormRoundsWon(val);
                      if (val > formRoundsLost) setFormResult('WIN');
                      else if (val < formRoundsLost) setFormResult('LOSS');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm font-mono font-bold text-[#73FBD3]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Gegner Runden
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={formRoundsLost}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFormRoundsLost(val);
                      if (formRoundsWon > val) setFormResult('WIN');
                      else if (formRoundsWon < val) setFormResult('LOSS');
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm font-mono font-bold text-red-400"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Match-Notiz (optional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="z. B. Premier Playoffs / Starke Defense-Hälfte"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  />
                </div>
              </div>

              {/* 5 Player Stats Rows */}
              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-2">
                  Individuelle Spielerstatistiken (5 eingesetzte Spieler)
                </label>

                <div className="space-y-2.5">
                  {formPlayerRows.map((row, idx) => {
                    const updateRow = (patch: Partial<MatchPlayerStat>) => {
                      setFormPlayerRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))
                      );
                    };

                    return (
                      <div
                        key={row.id || idx}
                        className="p-3 rounded-xl bg-[#141821] border border-white/10 grid grid-cols-2 sm:grid-cols-7 gap-2.5 items-center"
                      >
                        <div className="col-span-2 sm:col-span-2">
                          <label className="block text-[10px] text-[#878C8F] mb-0.5">
                            Spieler #{idx + 1}
                          </label>
                          <select
                            value={row.playerId}
                            onChange={(e) => {
                              const p = players.find(
                                (pl) => pl.id === e.target.value
                              );
                              updateRow({
                                playerId: e.target.value,
                                playerName: p?.name || '',
                                playerTag: p?.tag || '',
                              });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white"
                          >
                            {players.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} #{p.tag}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#878C8F] mb-0.5">
                            Agent
                          </label>
                          <select
                            value={row.agentId}
                            onChange={(e) =>
                              updateRow({ agentId: e.target.value })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-[#C8A273]"
                          >
                            {VALORANT_AGENTS_LIST.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#878C8F] mb-0.5">
                            Kills *
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={row.kills}
                            onChange={(e) =>
                              updateRow({ kills: Number(e.target.value) })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs font-mono text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#878C8F] mb-0.5">
                            Deaths *
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={row.deaths}
                            onChange={(e) =>
                              updateRow({ deaths: Number(e.target.value) })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs font-mono text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#878C8F] mb-0.5">
                            Assists *
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={row.assists}
                            onChange={(e) =>
                              updateRow({ assists: Number(e.target.value) })
                            }
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs font-mono text-white"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 col-span-2 sm:col-span-1">
                          <div>
                            <label className="block text-[10px] text-[#878C8F] mb-0.5">
                              ACS
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={row.acs ?? ''}
                              onChange={(e) =>
                                updateRow({
                                  acs:
                                    e.target.value === ''
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              placeholder="opt."
                              className="w-full px-2 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs font-mono text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#878C8F] mb-0.5">
                              HS%
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={row.headshotPct ?? ''}
                              onChange={(e) =>
                                updateRow({
                                  headshotPct:
                                    e.target.value === ''
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              placeholder="%"
                              className="w-full px-2 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs font-mono text-white"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsMatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-xs font-semibold text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={savingMatch}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] text-xs font-display font-bold uppercase tracking-wider text-white shadow-lg disabled:opacity-50"
                >
                  {savingMatch ? 'Speichere...' : 'Match & Statistiken speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
