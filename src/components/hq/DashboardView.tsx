'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  Crosshair,
  Plus,
  Shield,
  Swords,
  Target,
  Users,
  X,
} from 'lucide-react';
import {
  BBT_TEAM_INFO,
  getAgentByIdOrName,
  getMapByIdOrName,
  VALORANT_MAPS_LIST,
} from '@/lib/valorant-data';
import { computeStatistics } from '@/lib/stats-calculator';
import type {
  BbtHqDatabase,
  MapStrategy,
  TeamLineup,
  UpcomingMatchInfo,
} from '@/types/hq';

interface DashboardViewProps {
  db: BbtHqDatabase;
  isAdmin: boolean;
  onNavigateTab: (
    tab: 'DASHBOARD' | 'STRATEGIES' | 'LINEUPS' | 'STATS' | 'SCOUTING'
  ) => void;
  onQuickCreateStrategy: () => void;
  onQuickCreateLineup: () => void;
  onQuickCreateMatch: () => void;
  onOpenLineup: (lineup: TeamLineup) => void;
  onOpenStrategy: (strategy: MapStrategy) => void;
  onSaveUpcomingMatch: (upcoming: UpcomingMatchInfo | null) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  db,
  isAdmin,
  onNavigateTab,
  onQuickCreateStrategy,
  onQuickCreateLineup,
  onQuickCreateMatch,
  onOpenLineup,
  onOpenStrategy,
  onSaveUpcomingMatch,
}) => {
  const [isUpcomingModalOpen, setIsUpcomingModalOpen] = useState(false);
  const [upOppName, setUpOppName] = useState(
    db.upcomingMatch?.opponentName || ''
  );
  const [upMapId, setUpMapId] = useState(
    db.upcomingMatch?.mapId || 'bind'
  );
  const [upDate, setUpDate] = useState(
    db.upcomingMatch?.date
      ? db.upcomingMatch.date.slice(0, 16)
      : '2026-10-31T19:00'
  );
  const [upCompetition, setUpCompetition] = useState(
    db.upcomingMatch?.competition || 'Premier'
  );

  const statsOverview = useMemo(
    () => computeStatistics(db.matches, db.players),
    [db.matches, db.players]
  );

  const recentMatches = db.matches.slice(0, 4);
  const recentStrategies = db.strategies.slice(0, 2);
  const recentLineups = db.lineups.slice(0, 2);
  const recentOpponents = db.opponents.slice(0, 3);
  const topPerformers = statsOverview.playerRankings
    .filter((p) => p.matchesPlayed > 0)
    .slice(0, 3);

  const handleSaveUpcoming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upOppName.trim()) return;
    await onSaveUpcomingMatch({
      id: db.upcomingMatch?.id || `up-${Date.now()}`,
      opponentName: upOppName.trim(),
      mapId: upMapId,
      date: new Date(upDate).toISOString(),
      competition: upCompetition.trim() || 'Premier',
    });
    setIsUpcomingModalOpen(false);
  };

  const heroMapSplash =
    getMapByIdOrName('bind')?.splash ||
    getMapByIdOrName('ascent')?.splash ||
    '';

  return (
    <div className="space-y-6">
      {/* 1. Hero Banner (exact BBT Premier Team HQ aesthetic) */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0E1015] shadow-[0_20px_60px_rgba(0,0,0,0.75)]">
        {/* Background Map / Crimson Artwork */}
        {heroMapSplash && (
          <img
            src={heroMapSplash}
            alt="BBT Premier HQ Backdrop"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-25"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(8,9,13,0.98) 0%, rgba(12,14,19,0.88) 50%, rgba(158,20,27,0.38) 100%)',
          }}
        />
        {/* Diagonal Red Tactical Accent Top-Left */}
        <div
          className="absolute top-0 left-0 w-36 h-12 bg-gradient-to-r from-[#9E141B] to-transparent opacity-65"
          style={{ clipPath: 'polygon(0 0, 100% 0, 72% 100%, 0% 100%)' }}
        />

        <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <img
              src={BBT_TEAM_INFO.logoUrl}
              alt="BigBlackTea Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_6px_22px_rgba(158,20,27,0.65)] shrink-0"
            />
            <div>
              <div className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.25em] text-[#878C8F]">
                WILLKOMMEN BEI{' '}
                <span className="text-[#C8A273] font-bold">BIGBLACKTEA</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-extrabold uppercase tracking-wider text-white mt-0.5">
                PREMIER TEAM HQ
              </h1>
              <p className="text-sm sm:text-base text-[#C8A273]/90 font-medium mt-1">
                Strategie. Teamwork. Erfolg.
              </p>
            </div>
          </div>

          {/* Team Quick Pulse */}
          <div className="flex flex-wrap items-center gap-3">
            {statsOverview.totalMatches > 0 && (
              <div className="px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 backdrop-blur-md">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#878C8F]">
                  Team Winrate • Team K/D
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-lg font-display font-bold text-[#73FBD3]">
                    {statsOverview.teamWinrate !== null
                      ? `${statsOverview.teamWinrate}%`
                      : '—'}
                  </span>
                  <span className="text-white/20">|</span>
                  <span className="text-lg font-display font-bold text-[#C8A273]">
                    {statsOverview.teamKd !== null
                      ? statsOverview.teamKd.toFixed(2)
                      : '—'}{' '}
                    K/D
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Four KPI Counter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('STRATEGIES')}
          className="group text-left p-5 rounded-2xl bg-[#0F1218] hover:bg-[#141821] border border-white/10 hover:border-[#C8A273]/40 transition flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#C8A273] group-hover:bg-[#9E141B]/20 group-hover:text-white transition">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#878C8F]">Gespeicherte Strategien</div>
            <div className="text-3xl font-display font-extrabold text-white mt-0.5">
              {db.strategies.length}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('LINEUPS')}
          className="group text-left p-5 rounded-2xl bg-[#0F1218] hover:bg-[#141821] border border-white/10 hover:border-[#C8A273]/40 transition flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#C8A273] group-hover:bg-[#9E141B]/20 group-hover:text-white transition">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#878C8F]">Lineups</div>
            <div className="text-3xl font-display font-extrabold text-white mt-0.5">
              {db.lineups.length}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('SCOUTING')}
          className="group text-left p-5 rounded-2xl bg-[#0F1218] hover:bg-[#141821] border border-white/10 hover:border-[#C8A273]/40 transition flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#C8A273] group-hover:bg-[#9E141B]/20 group-hover:text-white transition">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#878C8F]">Gegnerprofile</div>
            <div className="text-3xl font-display font-extrabold text-white mt-0.5">
              {db.opponents.length}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab('STATS')}
          className="group text-left p-5 rounded-2xl bg-[#0F1218] hover:bg-[#141821] border border-white/10 hover:border-[#C8A273]/40 transition flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#C8A273] group-hover:bg-[#9E141B]/20 group-hover:text-white transition">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-[#878C8F]">Gespielte Matches</div>
            <div className="text-3xl font-display font-extrabold text-white mt-0.5">
              {db.matches.length}
            </div>
          </div>
        </button>
      </div>

      {/* 3. Middle Row: Nächstes Match & Letzte Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Nächstes Match + Letzte Spielerstatistiken */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-bold uppercase tracking-wider text-white">
                Nächstes Match
              </h2>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsUpcomingModalOpen(true)}
                  className="text-xs text-[#C8A273] hover:text-white transition"
                >
                  {db.upcomingMatch ? 'Bearbeiten' : '+ Termin planen'}
                </button>
              )}
            </div>

            {db.upcomingMatch ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-[#141821] border border-white/10">
                  <div className="w-16 h-16 rounded-xl bg-[#090A0E] border border-white/10 flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-xl font-display font-extrabold text-white leading-none">
                      {new Date(db.upcomingMatch.date).getDate()}
                    </span>
                    <span className="text-[10px] font-mono uppercase text-[#C8A273] mt-0.5">
                      {new Date(db.upcomingMatch.date).toLocaleDateString(
                        'de-DE',
                        { month: 'short' }
                      )}
                    </span>
                    <span className="text-[10px] font-mono text-[#878C8F]">
                      {new Date(db.upcomingMatch.date).toLocaleTimeString(
                        'de-DE',
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-base font-display font-bold text-white truncate">
                      vs. {db.upcomingMatch.opponentName}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#878C8F] mt-1">
                      <Shield className="w-3.5 h-3.5 text-[#9E141B]" />
                      <span>{db.upcomingMatch.competition}</span>
                      <span>•</span>
                      <span className="text-[#C8A273] font-medium">
                        {getMapByIdOrName(db.upcomingMatch.mapId)?.name ||
                          db.upcomingMatch.mapId}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onSaveUpcomingMatch(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#878C8F] hover:text-white transition"
                    >
                      Zurücksetzen
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigateTab('SCOUTING')}
                    className="px-4 py-2 rounded-xl bg-[#9E141B]/25 hover:bg-[#9E141B] border border-[#9E141B] text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5 transition"
                  >
                    <span>Matchplan & Scouting</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-6 px-4 rounded-xl bg-[#0B0D12] border border-dashed border-white/10">
                <Calendar className="w-7 h-7 text-[#878C8F] mb-2" />
                <div className="text-xs font-semibold text-[#ECE8E1]">
                  Kein kommendes Match geplant
                </div>
                <p className="text-[11px] text-[#878C8F] mt-0.5 max-w-xs">
                  Plane euer nächstes Premier-Match oder bereite euch im Gegner-Scouting vor.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsUpcomingModalOpen(true)}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-[#9E141B] border border-white/10 text-xs font-semibold text-white transition"
                  >
                    + Nächstes Match festlegen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Letzte eingetragene Spielerstatistiken (Top Performer) */}
          <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C8A273]" />
                <span>Aktuelle Spielerstatistiken</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('STATS')}
                className="text-xs text-[#C8A273] hover:text-white transition"
              >
                Alle ansehen →
              </button>
            </div>

            {topPerformers.length > 0 ? (
              <div className="space-y-2">
                {topPerformers.map((p) => {
                  const mainAgent = p.topAgents[0]
                    ? getAgentByIdOrName(p.topAgents[0].agentId)
                    : null;
                  return (
                    <div
                      key={p.playerId}
                      onClick={() => onNavigateTab('STATS')}
                      className="cursor-pointer flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#141821] hover:bg-[#191E29] border border-white/5 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[#090A0E] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {mainAgent?.displayIcon ? (
                            <img
                              src={mainAgent.displayIcon}
                              alt={mainAgent.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Crosshair className="w-4 h-4 text-[#C8A273]" />
                          )}
                        </div>
                        <div className="truncate">
                          <span className="text-xs font-bold text-white">
                            {p.playerName}
                          </span>{' '}
                          <span className="text-[11px] font-mono text-[#878C8F]">
                            #{p.playerTag}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-[#878C8F] block">
                            K/D
                          </span>
                          <span className="font-mono font-bold text-[#73FBD3]">
                            {p.kd !== null ? p.kd.toFixed(2) : '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#878C8F] block">
                            ACS
                          </span>
                          <span className="font-mono font-bold text-white">
                            {p.avgAcs ?? '—'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#878C8F] block">
                            Kills
                          </span>
                          <span className="font-mono font-bold text-[#C8A273]">
                            {p.kills}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#878C8F] py-4 text-center">
                Noch keine Matchstatistiken eingetragen.
              </div>
            )}
          </div>
        </div>

        {/* Right: Letzte Matches + Zuletzt bearbeitete Gegnerprofile */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-display font-bold uppercase tracking-wider text-white">
                Letzte Matches
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('STATS')}
                className="text-xs text-[#C8A273] hover:text-white transition"
              >
                Matchhistorie öffnen →
              </button>
            </div>

            {recentMatches.length > 0 ? (
              <div className="space-y-2.5">
                {recentMatches.map((match) => {
                  const mapAsset = getMapByIdOrName(match.mapId);
                  const isWin = match.result === 'WIN';
                  return (
                    <div
                      key={match.id}
                      onClick={() => onNavigateTab('STATS')}
                      className="cursor-pointer group flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-[#141821] hover:bg-[#191E2A] border border-white/5 hover:border-white/15 transition"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img
                          src={BBT_TEAM_INFO.logoUrl}
                          alt="BBT"
                          className="w-9 h-9 object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            BBT{' '}
                            <span className="text-[#878C8F] font-normal">
                              vs.
                            </span>{' '}
                            {match.opponentName}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#878C8F] mt-0.5">
                            <span>
                              {new Date(match.date).toLocaleDateString('de-DE')}
                            </span>
                            <span>•</span>
                            <span className="text-[#C8A273] font-medium">
                              {mapAsset?.name || match.mapId}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-lg font-display font-extrabold tracking-wider text-white">
                          {match.roundsWon} : {match.roundsLost}
                        </div>
                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider min-w-[76px] text-center ${
                            isWin
                              ? 'bg-[#73FBD3]/15 text-[#73FBD3] border border-[#73FBD3]/30'
                              : 'bg-[#9E141B]/30 text-red-200 border border-[#9E141B]'
                          }`}
                        >
                          {isWin ? 'Sieg' : 'Niederlage'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center rounded-xl bg-[#0B0D12] border border-dashed border-white/10">
                <Swords className="w-8 h-8 text-[#878C8F] mx-auto mb-2" />
                <div className="text-sm font-semibold text-white">
                  Noch keine Matches gespeichert
                </div>
                <p className="text-xs text-[#878C8F] mt-1">
                  Trage das erste gespielte Premier-Match ein, um Statistiken zu berechnen.
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={onQuickCreateMatch}
                    className="mt-3 px-4 py-2 rounded-xl bg-[#9E141B] text-xs font-bold uppercase tracking-wider text-white"
                  >
                    + Match eintragen
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Zuletzt bearbeitete Gegnerprofile */}
          <div className="p-5 rounded-2xl bg-[#0F1218] border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-[#C8A273]" />
                <span>Zuletzt bearbeitete Gegnerprofile</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('SCOUTING')}
                className="text-xs text-[#C8A273] hover:text-white transition"
              >
                Gegner-Scouting →
              </button>
            </div>

            {recentOpponents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {recentOpponents.map((opp) => {
                  const matchesVsOpp = db.matches.filter(
                    (m) =>
                      m.opponentId === opp.id ||
                      m.opponentName.toLowerCase() ===
                        opp.teamName.toLowerCase()
                  );
                  return (
                    <button
                      key={opp.id}
                      type="button"
                      onClick={() => onNavigateTab('SCOUTING')}
                      className="text-left p-3.5 rounded-xl bg-[#141821] hover:bg-[#191E2A] border border-white/5 hover:border-[#C8A273]/30 transition"
                    >
                      <div className="text-xs font-bold text-white truncate">
                        {opp.teamName}
                      </div>
                      <div className="text-[11px] text-[#878C8F] mt-1 flex items-center justify-between">
                        <span>{matchesVsOpp.length} Begegnung(en)</span>
                        <span className="text-[#C8A273]">
                          {opp.scoutingNotes.length} Notiz(en)
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#878C8F] py-3">
                Noch keine Gegnerprofile angelegt.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Letzte Strategien | Zuletzt bearbeitete Lineups | Schnellzugriff */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Letzte Strategien */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-[#0F1218] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white">
              Letzte Strategien
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('STRATEGIES')}
              className="text-xs text-[#C8A273] hover:text-white transition"
            >
              Alle ({db.strategies.length})
            </button>
          </div>

          {recentStrategies.length > 0 ? (
            <div className="space-y-2.5">
              {recentStrategies.map((strat) => {
                const mapObj = getMapByIdOrName(strat.mapId);
                return (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => onOpenStrategy(strat)}
                    className="w-full text-left flex items-center gap-3.5 p-2.5 rounded-xl bg-[#141821] hover:bg-[#1A1F2B] border border-white/5 hover:border-white/15 transition"
                  >
                    <img
                      src={mapObj?.listViewIcon || mapObj?.splash}
                      alt={mapObj?.name || strat.mapId}
                      className="w-16 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-display font-bold uppercase text-white truncate">
                        {strat.name}
                      </div>
                      <div className="text-[11px] text-[#878C8F] mt-0.5">
                        {strat.side} • {strat.site} Site • {strat.type}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-[#878C8F] shrink-0">
                      {new Date(strat.updatedAt).toLocaleDateString('de-DE')}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-5 px-3 rounded-xl bg-[#0B0D12] border border-dashed border-white/10">
              <p className="text-xs text-[#878C8F]">
                Noch keine Map-Strategien gespeichert.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onQuickCreateStrategy}
                  className="mt-2.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#9E141B] text-xs font-semibold text-white border border-white/10 transition"
                >
                  + Erste Strategie anlegen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Zuletzt bearbeitete Lineups */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-[#0F1218] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white">
              Zuletzt bearbeitete Lineups
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab('LINEUPS')}
              className="text-xs text-[#C8A273] hover:text-white transition"
            >
              Alle ({db.lineups.length})
            </button>
          </div>

          {recentLineups.length > 0 ? (
            <div className="space-y-2.5">
              {recentLineups.map((lu) => {
                const mapObj = getMapByIdOrName(lu.mapId);
                const activeCount = lu.slots.filter(
                  (s) => s.playerId || s.agentId
                ).length;
                return (
                  <button
                    key={lu.id}
                    type="button"
                    onClick={() => onOpenLineup(lu)}
                    className="w-full text-left flex items-center gap-3.5 p-2.5 rounded-xl bg-[#141821] hover:bg-[#1A1F2B] border border-white/5 hover:border-white/15 transition"
                  >
                    <img
                      src={mapObj?.listViewIcon || mapObj?.splash}
                      alt={mapObj?.name || lu.mapId}
                      className="w-16 h-12 rounded-lg object-cover shrink-0 border border-white/10"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-display font-bold uppercase text-white truncate">
                        {lu.name}
                      </div>
                      <div className="text-[11px] text-[#878C8F] mt-0.5">
                        {activeCount} Spieler • {mapObj?.name || lu.mapId}
                      </div>
                    </div>
                    <div className="text-[10px] font-mono text-[#878C8F] shrink-0">
                      {new Date(lu.updatedAt).toLocaleDateString('de-DE')}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-5 px-3 rounded-xl bg-[#0B0D12] border border-dashed border-white/10">
              <p className="text-xs text-[#878C8F]">
                Noch keine Lineups gespeichert.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onQuickCreateLineup}
                  className="mt-2.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#9E141B] text-xs font-semibold text-white border border-white/10 transition"
                >
                  + Lineup erstellen
                </button>
              )}
            </div>
          )}
        </div>

        {/* Schnellzugriff */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-[#0F1218] border border-white/10 flex flex-col justify-between">
          <h2 className="text-sm font-display font-bold uppercase tracking-wider text-white mb-3">
            Schnellzugriff
          </h2>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={onQuickCreateStrategy}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#B81720] hover:from-[#B5171F] hover:to-[#D41C27] text-xs font-display font-bold uppercase tracking-wider text-white flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(158,20,27,0.4)] transition"
            >
              <Plus className="w-4 h-4" />
              <span>Strategie erstellen</span>
            </button>

            <button
              type="button"
              onClick={onQuickCreateLineup}
              className="w-full py-2.5 px-4 rounded-xl bg-[#141821] hover:bg-[#1B202C] border border-white/10 text-xs font-semibold text-[#ECE8E1] flex items-center justify-center gap-2 transition"
            >
              <Users className="w-4 h-4 text-[#C8A273]" />
              <span>Lineup erstellen</span>
            </button>

            <button
              type="button"
              onClick={onQuickCreateMatch}
              className="w-full py-2.5 px-4 rounded-xl bg-[#141821] hover:bg-[#1B202C] border border-white/10 text-xs font-semibold text-[#ECE8E1] flex items-center justify-center gap-2 transition"
            >
              <Swords className="w-4 h-4 text-[#73FBD3]" />
              <span>Match eintragen</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal to schedule Upcoming Match */}
      {isUpcomingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setIsUpcomingModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#0F1218] border border-white/15 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-bold uppercase text-white">
                Nächstes Match planen
              </h3>
              <button
                type="button"
                onClick={() => setIsUpcomingModalOpen(false)}
                className="text-[#878C8F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUpcoming} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                  Gegnerisches Team
                </label>
                <input
                  type="text"
                  value={upOppName}
                  onChange={(e) => setUpOppName(e.target.value)}
                  placeholder="z. B. Team Vendetta"
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Map
                  </label>
                  <select
                    value={upMapId}
                    onChange={(e) => setUpMapId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
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
                    Wettbewerb
                  </label>
                  <input
                    type="text"
                    value={upCompetition}
                    onChange={(e) => setUpCompetition(e.target.value)}
                    placeholder="Premier"
                    className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                  Datum & Uhrzeit
                </label>
                <input
                  type="datetime-local"
                  value={upDate}
                  onChange={(e) => setUpDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUpcomingModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#9E141B] hover:bg-[#B81720] text-xs font-bold uppercase text-white"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
