'use client';

import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Edit3,
  MessageSquarePlus,
  Plus,
  Save,
  Search,
  Shield,
  Swords,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  getAgentByIdOrName,
  getMapByIdOrName,
  VALORANT_AGENTS_LIST,
  VALORANT_MAPS_LIST,
} from '@/lib/valorant-data';
import type {
  MapStrategy,
  OpponentObservedComp,
  OpponentPlayerEntry,
  OpponentPreferredMap,
  OpponentProfile,
  ScoutingNoteCategory,
  TeamLineup,
  TeamMatch,
} from '@/types/hq';

interface OpponentScoutingViewProps {
  opponents: OpponentProfile[];
  matches: TeamMatch[];
  lineups: TeamLineup[];
  strategies: MapStrategy[];
  isAdmin: boolean;
  canAddNotes: boolean;
  onSaveOpponent: (
    opp: Partial<OpponentProfile> & { teamName: string }
  ) => Promise<void>;
  onDeleteOpponent: (opponentId: string) => Promise<void>;
  onAddScoutingNote: (
    opponentId: string,
    category: ScoutingNoteCategory,
    content: string
  ) => Promise<void>;
  onOpenLineupInEditor: (lineup: TeamLineup) => void;
  onOpenStrategyInViewer: (strategy: MapStrategy) => void;
}

const SCOUTING_CATEGORIES: ScoutingNoteCategory[] = [
  'Angriff',
  'Verteidigung',
  'Early-Game',
  'Flanks / Lurk',
  'Agent-Pool',
  'Defensiv-Schwachstelle',
  'Allgemein',
];

export const OpponentScoutingView: React.FC<OpponentScoutingViewProps> = ({
  opponents,
  matches,
  lineups,
  strategies,
  isAdmin,
  canAddNotes,
  onSaveOpponent,
  onDeleteOpponent,
  onAddScoutingNote,
  onOpenLineupInEditor,
  onOpenStrategyInViewer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    opponents[0]?.id || null
  );
  const [activeSubTab, setActiveSubTab] = useState<
    'PROFILE' | 'NOTES' | 'MATCHPLAN'
  >('PROFILE');

  // New Scouting Note Form
  const [noteCategory, setNoteCategory] =
    useState<ScoutingNoteCategory>('Angriff');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Matchplan state synced with active opponent
  const [planMapId, setPlanMapId] = useState<string>('bind');
  const [planLineupIds, setPlanLineupIds] = useState<string[]>([]);
  const [planStrategyIds, setPlanStrategyIds] = useState<string[]>([]);
  const [planInstructions, setPlanInstructions] = useState<string>('');
  const [planSavedToast, setPlanSavedToast] = useState(false);

  // Opponent Profile Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Partial<OpponentProfile> | null>(
    null
  );
  const [strengthsInput, setStrengthsInput] = useState('');
  const [weaknessesInput, setWeaknessesInput] = useState('');

  const filteredOpponents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return opponents.filter((o) => {
      if (!q) return true;
      return (
        o.teamName.toLowerCase().includes(q) ||
        (o.teamTag || '').toLowerCase().includes(q) ||
        o.knownPlayers.some(
          (kp) =>
            kp.name.toLowerCase().includes(q) ||
            kp.riotId.toLowerCase().includes(q)
        )
      );
    });
  }, [opponents, searchQuery]);

  const activeOpponent = useMemo(() => {
    if (filteredOpponents.length === 0) return null;
    const found =
      filteredOpponents.find((o) => o.id === selectedOpponentId) ||
      filteredOpponents[0];
    return found;
  }, [filteredOpponents, selectedOpponentId]);

  // Synchronize Matchplan inputs when switching opponent
  React.useEffect(() => {
    if (activeOpponent) {
      setPlanMapId(activeOpponent.matchPlan?.plannedMapId || 'bind');
      setPlanLineupIds(activeOpponent.matchPlan?.selectedLineupIds || []);
      setPlanStrategyIds(activeOpponent.matchPlan?.selectedStrategyIds || []);
      setPlanInstructions(
        activeOpponent.matchPlan?.tacticalInstructions || ''
      );
    }
  }, [activeOpponent?.id]);

  const pastEncounters = useMemo(() => {
    if (!activeOpponent) return [];
    return matches.filter(
      (m) =>
        m.opponentId === activeOpponent.id ||
        m.opponentName.trim().toLowerCase() ===
          activeOpponent.teamName.trim().toLowerCase()
    );
  }, [matches, activeOpponent]);

  const handleOpenCreateModal = () => {
    setEditingOpp({
      teamName: '',
      teamTag: '',
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
    });
    setStrengthsInput('');
    setWeaknessesInput('');
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (opp: OpponentProfile) => {
    setEditingOpp(structuredClone(opp));
    setStrengthsInput((opp.strengths || []).join('\n'));
    setWeaknessesInput((opp.weaknesses || []).join('\n'));
    setIsEditorOpen(true);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditingOpp((prev) =>
          prev ? { ...prev, logoUrl: reader.result as string } : null
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveOpponentEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOpp || !editingOpp.teamName?.trim()) return;

    const cleanStrengths = strengthsInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const cleanWeaknesses = weaknessesInput
      .split('\n')
      .map((w) => w.trim())
      .filter(Boolean);

    await onSaveOpponent({
      ...editingOpp,
      teamName: editingOpp.teamName.trim(),
      strengths: cleanStrengths,
      weaknesses: cleanWeaknesses,
    });
    setIsEditorOpen(false);
    setEditingOpp(null);
  };

  const handleSubmitScoutingNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOpponent || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      await onAddScoutingNote(
        activeOpponent.id,
        noteCategory,
        noteContent.trim()
      );
      setNoteContent('');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveMatchPlan = async () => {
    if (!activeOpponent || !isAdmin) return;
    await onSaveOpponent({
      ...activeOpponent,
      teamName: activeOpponent.teamName,
      matchPlan: {
        plannedMapId: planMapId,
        selectedLineupIds: planLineupIds,
        selectedStrategyIds: planStrategyIds,
        tacticalInstructions: planInstructions,
        updatedAt: new Date().toISOString(),
      },
    });
    setPlanSavedToast(true);
    setTimeout(() => setPlanSavedToast(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-wider text-white">
            Gegner-Scouting
          </h1>
          <p className="text-xs sm:text-sm text-[#878C8F]">
            Erfasse gegnerische Teams, bekannte Riot-IDs, beobachtete Agent-Aufstellungen, Schwachstellen und euren Matchplan.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(158,20,27,0.45)] transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Gegnerprofil anlegen</span>
          </button>
        )}
      </div>

      {/* Main Layout: Left Opponent List + Right Scouting & Matchplan Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Sidebar: Opponents List */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#878C8F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Gegner oder Riot-ID suchen..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#0F1218] border border-white/10 text-xs text-white focus:outline-none focus:border-[#9E141B]"
            />
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filteredOpponents.length > 0 ? (
              filteredOpponents.map((opp) => {
                const isSelected = activeOpponent?.id === opp.id;
                const oppMatches = matches.filter(
                  (m) =>
                    m.opponentId === opp.id ||
                    m.opponentName.toLowerCase() === opp.teamName.toLowerCase()
                );
                const winsVs = oppMatches.filter(
                  (m) => m.result === 'WIN'
                ).length;
                const lossesVs = oppMatches.length - winsVs;

                return (
                  <button
                    key={opp.id}
                    type="button"
                    onClick={() => setSelectedOpponentId(opp.id)}
                    className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                      isSelected
                        ? 'bg-[#141822] border-[#9E141B] shadow-[0_0_20px_rgba(158,20,27,0.3)]'
                        : 'bg-[#0F1218] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#090A0E] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {opp.logoUrl ? (
                          <img
                            src={opp.logoUrl}
                            alt={opp.teamName}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <Target className="w-5 h-5 text-[#C8A273]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-display font-bold uppercase text-white truncate">
                          {opp.teamName}
                        </div>
                        <div className="text-[11px] text-[#878C8F]">
                          {opp.scoutingNotes.length} Notiz(en) •{' '}
                          {opp.knownPlayers.length} Spieler
                        </div>
                      </div>
                    </div>

                    {oppMatches.length > 0 && (
                      <span className="px-2 py-0.5 rounded bg-white/5 text-[10px] font-mono text-[#73FBD3] shrink-0">
                        {winsVs}S–{lossesVs}N
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="p-6 rounded-xl bg-[#0F1218] border border-dashed border-white/10 text-center text-xs text-[#878C8F]">
                Keine Gegnerprofile gefunden.
              </div>
            )}
          </div>
        </div>

        {/* Right Area: Selected Opponent Dossier */}
        <div className="lg:col-span-9">
          {activeOpponent ? (
            <div className="rounded-2xl bg-[#0F1218] border border-white/10 overflow-hidden shadow-2xl">
              {/* Opponent Header Banner */}
              <div className="p-6 bg-gradient-to-r from-[#141822] via-[#10131B] to-[#9E141B]/25 border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#090A0E] border border-[#C8A273]/30 flex items-center justify-center overflow-hidden shrink-0">
                    {activeOpponent.logoUrl ? (
                      <img
                        src={activeOpponent.logoUrl}
                        alt={activeOpponent.teamName}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Target className="w-8 h-8 text-[#C8A273]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-[#C8A273]">
                        GEGNER-AKTE
                      </span>
                      {activeOpponent.teamTag && (
                        <span className="px-2 py-0.5 rounded bg-[#9E141B]/30 border border-[#9E141B] text-[10px] font-mono text-white">
                          [{activeOpponent.teamTag}]
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-display font-extrabold uppercase text-white">
                      {activeOpponent.teamName}
                    </h2>
                    <div className="text-xs text-[#878C8F] mt-0.5">
                      {pastEncounters.length} bisherige Begegnung(en) mit BBT •
                      Zuletzt aktualisiert am{' '}
                      {new Date(activeOpponent.updatedAt).toLocaleDateString(
                        'de-DE'
                      )}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(activeOpponent)}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#C8A273]" />
                      <span>Profil bearbeiten</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteOpponent(activeOpponent.id)}
                      className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 transition"
                      title="Gegnerprofil löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-Navigation Tabs */}
              <div className="px-6 pt-3 bg-[#0B0D12] border-b border-white/10 flex items-center gap-2 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('PROFILE')}
                  className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition ${
                    activeSubTab === 'PROFILE'
                      ? 'border-[#9E141B] text-white'
                      : 'border-transparent text-[#878C8F] hover:text-white'
                  }`}
                >
                  Übersicht, Kader & Tendenz
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('NOTES')}
                  className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
                    activeSubTab === 'NOTES'
                      ? 'border-[#9E141B] text-white'
                      : 'border-transparent text-[#878C8F] hover:text-white'
                  }`}
                >
                  <span>Scouting-Notizen</span>
                  <span className="px-1.5 py-0.2 rounded bg-white/10 font-mono text-[10px] text-[#C8A273]">
                    {activeOpponent.scoutingNotes.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('MATCHPLAN')}
                  className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 transition flex items-center gap-1.5 ${
                    activeSubTab === 'MATCHPLAN'
                      ? 'border-[#9E141B] text-[#73FBD3]'
                      : 'border-transparent text-[#878C8F] hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-[#73FBD3]" />
                  <span>Matchplan gegen diesen Gegner</span>
                </button>
              </div>

              {/* TAB 1: PROFILE, KNOWN PLAYERS, OBSERVED COMPS, ENCOUNTERS */}
              {activeSubTab === 'PROFILE' && (
                <div className="p-6 space-y-6">
                  {/* Top Row: Playstyle, Strengths, Weaknesses */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-[#090A0E] border border-white/10">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#C8A273] mb-2">
                        Vermutete Spielstile
                      </h3>
                      <p className="text-xs text-[#ECE8E1] leading-relaxed whitespace-pre-wrap">
                        {activeOpponent.playstyle ||
                          'Noch kein Spielstil manuell eingetragen.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#090A0E] border border-white/10">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#73FBD3] mb-2">
                        Beobachtete Stärken
                      </h3>
                      {activeOpponent.strengths.length > 0 ? (
                        <ul className="space-y-1 text-xs text-[#ECE8E1] list-disc list-inside">
                          {activeOpponent.strengths.map((st, idx) => (
                            <li key={idx}>{st}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-[#878C8F]">
                          Keine Stärken eingetragen.
                        </p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-[#090A0E] border border-white/10">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2">
                        Defensive & Taktische Schwachstellen
                      </h3>
                      {activeOpponent.weaknesses.length > 0 ? (
                        <ul className="space-y-1 text-xs text-[#ECE8E1] list-disc list-inside">
                          {activeOpponent.weaknesses.map((wk, idx) => (
                            <li key={idx}>{wk}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-[#878C8F]">
                          Keine Schwachstellen eingetragen.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Known Players & Riot IDs + Preferred Maps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Bekannte Spieler & Riot-IDs */}
                    <div className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                          Bekannte Spieler & Riot-IDs
                        </h3>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(activeOpponent)}
                            className="text-[11px] text-[#C8A273] hover:underline"
                          >
                            + Spieler pflegen
                          </button>
                        )}
                      </div>

                      {activeOpponent.knownPlayers.length > 0 ? (
                        <div className="space-y-2">
                          {activeOpponent.knownPlayers.map((kp) => (
                            <div
                              key={kp.id}
                              className="p-2.5 rounded-lg bg-[#090A0E] border border-white/5 flex items-center justify-between gap-2"
                            >
                              <div>
                                <div className="text-xs font-bold text-white">
                                  {kp.name}{' '}
                                  <span className="font-mono font-normal text-[#C8A273]">
                                    ({kp.riotId})
                                  </span>
                                </div>
                                {kp.notes && (
                                  <div className="text-[11px] text-[#878C8F]">
                                    {kp.notes}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {kp.mainAgents.map((agId) => {
                                  const a = getAgentByIdOrName(agId);
                                  return a?.displayIcon ? (
                                    <img
                                      key={agId}
                                      src={a.displayIcon}
                                      alt={a.name}
                                      title={a.name}
                                      className="w-6 h-6 rounded-full border border-white/10"
                                    />
                                  ) : null;
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#878C8F] py-2">
                          Noch keine gegnerischen Riot-IDs hinterlegt.
                        </p>
                      )}
                    </div>

                    {/* Bekannte bevorzugte Maps & Beobachtete Agent-Aufstellungen */}
                    <div className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-4">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                          Bekannte bevorzugte Maps
                        </h3>
                        {activeOpponent.preferredMaps.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {activeOpponent.preferredMaps.map((pm, idx) => {
                              const mObj = getMapByIdOrName(pm.mapId);
                              return (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white flex items-center gap-1.5"
                                >
                                  <strong className="text-[#C8A273]">
                                    {mObj?.name || pm.mapId}:
                                  </strong>
                                  <span>{pm.preference}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-[#878C8F]">
                            Noch keine Map-Präferenzen erfasst.
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-white/10">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                          Beobachtete Agent-Aufstellungen
                        </h3>
                        {activeOpponent.observedComps.length > 0 ? (
                          <div className="space-y-2">
                            {activeOpponent.observedComps.map((comp) => {
                              const mObj = getMapByIdOrName(comp.mapId);
                              return (
                                <div
                                  key={comp.id}
                                  className="p-2.5 rounded-lg bg-[#090A0E] border border-white/5 flex items-center justify-between gap-2"
                                >
                                  <span className="text-xs font-bold text-[#C8A273]">
                                    {mObj?.name || comp.mapId}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {comp.agents.map((agId, idx) => {
                                      const a = getAgentByIdOrName(agId);
                                      return a?.displayIcon ? (
                                        <img
                                          key={idx}
                                          src={a.displayIcon}
                                          alt={a.name}
                                          title={a.name}
                                          className="w-6 h-6 rounded-full border border-white/10"
                                        />
                                      ) : null;
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-[#878C8F]">
                            Noch keine beobachteten Agent-Comps eingetragen.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Eigene taktische Notizen & Bisherige Begegnungen mit BBT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-xl bg-[#090A0E] border border-white/10">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#C8A273] mb-2">
                        Eigene taktische Notizen
                      </h3>
                      <p className="text-xs text-[#ECE8E1] whitespace-pre-wrap leading-relaxed">
                        {activeOpponent.tacticalNotes ||
                          'Keine allgemeinen taktischen Notizen hinterlegt.'}
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-[#090A0E] border border-white/10">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-2">
                        Bisherige Begegnungen mit BBT ({pastEncounters.length})
                      </h3>
                      {pastEncounters.length > 0 ? (
                        <div className="space-y-2">
                          {pastEncounters.map((m) => {
                            const mObj = getMapByIdOrName(m.mapId);
                            const isWin = m.result === 'WIN';
                            return (
                              <div
                                key={m.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#141821] border border-white/5 text-xs"
                              >
                                <div>
                                  <span className="font-bold text-white">
                                    {mObj?.name || m.mapId}
                                  </span>{' '}
                                  <span className="text-[#878C8F]">
                                    ({new Date(m.date).toLocaleDateString('de-DE')})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white">
                                    {m.roundsWon}:{m.roundsLost}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      isWin
                                        ? 'bg-[#73FBD3]/15 text-[#73FBD3]'
                                        : 'bg-[#9E141B]/30 text-red-200'
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
                        <p className="text-xs text-[#878C8F]">
                          Noch keine gespielten Matches gegen dieses Team gespeichert.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCOUTING NOTES (MANUALLY ENTERED BY TEAM MEMBERS) */}
              {activeSubTab === 'NOTES' && (
                <div className="p-6 space-y-6">
                  {canAddNotes && (
                    <form
                      onSubmit={handleSubmitScoutingNote}
                      className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#C8A273] flex items-center gap-1.5">
                          <MessageSquarePlus className="w-4 h-4" />
                          <span>Neue Scouting-Beobachtung eintragen</span>
                        </h3>
                        <span className="text-[11px] text-[#878C8F]">
                          z. B. Häufige A-Executes, Aggressives Early-Game, Häufige Flanks...
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <select
                          value={noteCategory}
                          onChange={(e) =>
                            setNoteCategory(
                              e.target.value as ScoutingNoteCategory
                            )
                          }
                          className="px-3 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                        >
                          {SCOUTING_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          required
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Deine konkrete Beobachtung zu diesem Gegner..."
                          className="sm:col-span-3 px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingNote}
                          className="px-4 py-2 rounded-xl bg-[#9E141B] hover:bg-[#B81720] text-xs font-bold uppercase tracking-wider text-white transition"
                        >
                          {savingNote
                            ? 'Speichere...'
                            : 'Scouting-Notiz speichern'}
                        </button>
                      </div>
                    </form>
                  )}

                  {activeOpponent.scoutingNotes.length > 0 ? (
                    <div className="space-y-2.5">
                      {activeOpponent.scoutingNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-4 rounded-xl bg-[#090A0E] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-[#9E141B]/25 border border-[#9E141B] text-[10px] font-mono text-[#C8A273]">
                                {note.category}
                              </span>
                              <span className="text-xs font-bold text-white">
                                {note.author}
                              </span>
                              <span className="text-[10px] text-[#878C8F]">
                                •{' '}
                                {new Date(note.createdAt).toLocaleDateString(
                                  'de-DE'
                                )}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-[#ECE8E1]">
                              {note.content}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-xl bg-[#090A0E] border border-dashed border-white/10 text-center text-xs text-[#878C8F]">
                      Noch keine Scouting-Notizen für {activeOpponent.teamName}{' '}
                      erfasst. Alle Beobachtungen werden ausschließlich manuell durch das Team eingetragen.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MATCHPLAN GEGEN DIESEN GEGNER */}
              {activeSubTab === 'MATCHPLAN' && (
                <div className="p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <h3 className="text-lg font-display font-bold uppercase text-white">
                        Matchplan gegen {activeOpponent.teamName}
                      </h3>
                      <p className="text-xs text-[#878C8F]">
                        Wähle unsere geplanten BBT-Lineups, ordne passende Map-Strategien zu und halte konkrete taktische Anweisungen fest.
                      </p>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={handleSaveMatchPlan}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] text-xs font-display font-bold uppercase tracking-wider text-white flex items-center gap-2 shadow-lg"
                      >
                        {planSavedToast ? (
                          <>
                            <Check className="w-4 h-4 text-[#73FBD3]" />
                            <span>Matchvorbereitung gespeichert!</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            <span>Matchvorbereitung speichern</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Planned Map */}
                  <div className="max-w-xs">
                    <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1.5">
                      Geplante Map für das Match
                    </label>
                    <select
                      value={planMapId}
                      disabled={!isAdmin}
                      onChange={(e) => setPlanMapId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                    >
                      {VALORANT_MAPS_LIST.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Select Planned Lineups */}
                    <div className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-[#C8A273]" />
                        <span>Geplante BBT-Lineups zuordnen</span>
                      </h4>

                      {lineups.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {lineups.map((lu) => {
                            const checked = planLineupIds.includes(lu.id);
                            const mObj = getMapByIdOrName(lu.mapId);
                            return (
                              <div
                                key={lu.id}
                                className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                                  checked
                                    ? 'bg-[#9E141B]/20 border-[#9E141B]'
                                    : 'bg-[#090A0E] border-white/5'
                                }`}
                              >
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-white flex-1">
                                  <input
                                    type="checkbox"
                                    disabled={!isAdmin}
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setPlanLineupIds((prev) => [
                                          ...prev,
                                          lu.id,
                                        ]);
                                      } else {
                                        setPlanLineupIds((prev) =>
                                          prev.filter((id) => id !== lu.id)
                                        );
                                      }
                                    }}
                                    className="accent-[#9E141B]"
                                  />
                                  <div>
                                    <span className="font-bold">{lu.name}</span>{' '}
                                    <span className="text-[10px] font-mono text-[#C8A273]">
                                      [{mObj?.name || lu.mapId}]
                                    </span>
                                  </div>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => onOpenLineupInEditor(lu)}
                                  className="text-[11px] text-[#73FBD3] hover:underline"
                                >
                                  Öffnen →
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#878C8F]">
                          Noch keine Lineups gespeichert.
                        </p>
                      )}
                    </div>

                    {/* Select Planned Map Strategies */}
                    <div className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#C8A273]" />
                        <span>Geeignete Map-Strategien zuordnen</span>
                      </h4>

                      {strategies.length > 0 ? (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {strategies.map((st) => {
                            const checked = planStrategyIds.includes(st.id);
                            const mObj = getMapByIdOrName(st.mapId);
                            return (
                              <div
                                key={st.id}
                                className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                                  checked
                                    ? 'bg-[#9E141B]/20 border-[#9E141B]'
                                    : 'bg-[#090A0E] border-white/5'
                                }`}
                              >
                                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-white flex-1">
                                  <input
                                    type="checkbox"
                                    disabled={!isAdmin}
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setPlanStrategyIds((prev) => [
                                          ...prev,
                                          st.id,
                                        ]);
                                      } else {
                                        setPlanStrategyIds((prev) =>
                                          prev.filter((id) => id !== st.id)
                                        );
                                      }
                                    }}
                                    className="accent-[#9E141B]"
                                  />
                                  <div>
                                    <span className="font-bold">{st.name}</span>{' '}
                                    <span className="text-[10px] font-mono text-[#C8A273]">
                                      [{mObj?.name || st.mapId} • {st.side} •{' '}
                                      {st.site}]
                                    </span>
                                  </div>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => onOpenStrategyInViewer(st)}
                                  className="text-[11px] text-[#73FBD3] hover:underline"
                                >
                                  Details →
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#878C8F]">
                          Noch keine Map-Strategien im Strategie-Bereich angelegt.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Tactical Instructions */}
                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1.5">
                      Konkrete taktische Hinweise & Gameplan für das Match
                    </label>
                    <textarea
                      rows={5}
                      disabled={!isAdmin}
                      value={planInstructions}
                      onChange={(e) => setPlanInstructions(e.target.value)}
                      placeholder="Notiere hier konkrete Anti-Strats, Pistol-Round Pläne, Operator-Konter und Fokus-Ziele für unser Team..."
                      className="w-full p-3.5 rounded-xl bg-[#090A0E] border border-white/15 text-xs sm:text-sm text-white resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#0F1218] border border-dashed border-white/15 p-12 text-center">
              <Target className="w-10 h-10 text-[#C8A273] mx-auto mb-3" />
              <h2 className="text-xl font-display font-bold uppercase text-white">
                Kein Gegnerprofil ausgewählt
              </h2>
              <p className="text-xs text-[#878C8F] mt-1">
                Wähle links einen Gegner aus oder lege ein neues Gegnerprofil an.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Opponent Create / Edit Modal */}
      {isEditorOpen && editingOpp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
          onClick={() => setIsEditorOpen(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0E1015] border border-[#C8A273]/30 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#9E141B]" />

            <div className="px-6 py-4 bg-[#14171F] border-b border-white/10 flex items-center justify-between">
              <h2 className="text-xl font-display font-bold uppercase tracking-wider text-white">
                {editingOpp.id
                  ? 'Gegnerprofil bearbeiten'
                  : 'Neues Gegnerprofil anlegen'}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-[#9E141B] text-[#878C8F] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveOpponentEditor}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Team Name, Tag, Logo */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Gegnerischer Teamname *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingOpp.teamName || ''}
                    onChange={(e) =>
                      setEditingOpp((prev) =>
                        prev ? { ...prev, teamName: e.target.value } : null
                      )
                    }
                    placeholder="z. B. shadow fighters"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Team-Kürzel (optional)
                  </label>
                  <input
                    type="text"
                    value={editingOpp.teamTag || ''}
                    onChange={(e) =>
                      setEditingOpp((prev) =>
                        prev ? { ...prev, teamTag: e.target.value } : null
                      )
                    }
                    placeholder="z. B. SF"
                    className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Teamlogo (optional)
                  </label>
                  <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#090A0E] border border-dashed border-white/20 text-xs text-[#ECE8E1] hover:border-[#C8A273]">
                    <Upload className="w-4 h-4 text-[#C8A273]" />
                    <span>
                      {editingOpp.logoUrl ? 'Logo ändern' : 'Logo hochladen'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Known Opponent Players & Riot IDs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase text-[#C8A273]">
                    Bekannte Spieler & Riot-IDs
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingOpp((prev) => {
                        if (!prev) return null;
                        const next: OpponentPlayerEntry[] = [
                          ...(prev.knownPlayers || []),
                          {
                            id: `op-p-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                            name: '',
                            riotId: '',
                            mainAgents: ['jett'],
                            notes: '',
                          },
                        ];
                        return { ...prev, knownPlayers: next };
                      })
                    }
                    className="text-xs text-[#73FBD3] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Gegnerspieler hinzufügen</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {(editingOpp.knownPlayers || []).map((kp, idx) => {
                    const updateKp = (patch: Partial<OpponentPlayerEntry>) => {
                      setEditingOpp((prev) => {
                        if (!prev) return null;
                        const list = [...(prev.knownPlayers || [])];
                        list[idx] = { ...list[idx], ...patch };
                        return { ...prev, knownPlayers: list };
                      });
                    };

                    return (
                      <div
                        key={kp.id}
                        className="p-2.5 rounded-xl bg-[#141821] border border-white/10 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
                      >
                        <input
                          type="text"
                          value={kp.name}
                          onChange={(e) => updateKp({ name: e.target.value })}
                          placeholder="Spielername"
                          className="px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={kp.riotId}
                          onChange={(e) => updateKp({ riotId: e.target.value })}
                          placeholder="Riot-ID (z. B. Player#EUW)"
                          className="px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs font-mono text-[#C8A273]"
                        />
                        <select
                          value={kp.mainAgents[0] || 'jett'}
                          onChange={(e) =>
                            updateKp({ mainAgents: [e.target.value] })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white"
                        >
                          {VALORANT_AGENTS_LIST.map((a) => (
                            <option key={a.id} value={a.id}>
                              Main: {a.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={kp.notes || ''}
                            onChange={(e) =>
                              updateKp({ notes: e.target.value })
                            }
                            placeholder="Hinweis (z. B. Operator)"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setEditingOpp((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      knownPlayers: (
                                        prev.knownPlayers || []
                                      ).filter((_, i) => i !== idx),
                                    }
                                  : null
                              )
                            }
                            className="p-1.5 text-[#878C8F] hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Maps & Observed Agent Comps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bevorzugte Maps */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase text-[#C8A273]">
                      Bekannte bevorzugte Maps
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingOpp((prev) => {
                          if (!prev) return null;
                          const next: OpponentPreferredMap[] = [
                            ...(prev.preferredMaps || []),
                            { mapId: 'bind', preference: 'Stark' },
                          ];
                          return { ...prev, preferredMaps: next };
                        })
                      }
                      className="text-xs text-[#73FBD3] hover:underline"
                    >
                      + Map hinzufügen
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingOpp.preferredMaps || []).map((pm, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          value={pm.mapId}
                          onChange={(e) =>
                            setEditingOpp((prev) => {
                              if (!prev) return null;
                              const list = [...(prev.preferredMaps || [])];
                              list[idx] = { ...list[idx], mapId: e.target.value };
                              return { ...prev, preferredMaps: list };
                            })
                          }
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white"
                        >
                          {VALORANT_MAPS_LIST.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={pm.preference}
                          onChange={(e) =>
                            setEditingOpp((prev) => {
                              if (!prev) return null;
                              const list = [...(prev.preferredMaps || [])];
                              list[idx] = {
                                ...list[idx],
                                preference: e.target.value as any,
                              };
                              return { ...prev, preferredMaps: list };
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-[#C8A273]"
                        >
                          <option value="Stark">Stark</option>
                          <option value="Standard">Standard</option>
                          <option value="Schwach">Schwach</option>
                          <option value="Permaban">Permaban</option>
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setEditingOpp((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    preferredMaps: (
                                      prev.preferredMaps || []
                                    ).filter((_, i) => i !== idx),
                                  }
                                : null
                            )
                          }
                          className="text-[#878C8F] hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beobachtete Agent-Aufstellungen */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold uppercase text-[#C8A273]">
                      Beobachtete Agent-Aufstellungen
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingOpp((prev) => {
                          if (!prev) return null;
                          const next: OpponentObservedComp[] = [
                            ...(prev.observedComps || []),
                            {
                              id: `comp-${Date.now()}`,
                              mapId: 'bind',
                              agents: ['jett', 'omen', 'skye', 'cypher', 'raze'],
                            },
                          ];
                          return { ...prev, observedComps: next };
                        })
                      }
                      className="text-xs text-[#73FBD3] hover:underline"
                    >
                      + Comp hinzufügen
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingOpp.observedComps || []).map((comp, idx) => (
                      <div
                        key={comp.id}
                        className="p-2 rounded-lg bg-[#141821] border border-white/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <select
                            value={comp.mapId}
                            onChange={(e) =>
                              setEditingOpp((prev) => {
                                if (!prev) return null;
                                const list = [...(prev.observedComps || [])];
                                list[idx] = {
                                  ...list[idx],
                                  mapId: e.target.value,
                                };
                                return { ...prev, observedComps: list };
                              })
                            }
                            className="px-2 py-1 rounded bg-[#090A0E] text-xs text-[#C8A273]"
                          >
                            {VALORANT_MAPS_LIST.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingOpp((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      observedComps: (
                                        prev.observedComps || []
                                      ).filter((_, i) => i !== idx),
                                    }
                                  : null
                              )
                            }
                            className="text-[#878C8F] hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-5 gap-1">
                          {[0, 1, 2, 3, 4].map((slotIdx) => (
                            <select
                              key={slotIdx}
                              value={comp.agents[slotIdx] || 'jett'}
                              onChange={(e) =>
                                setEditingOpp((prev) => {
                                  if (!prev) return null;
                                  const list = [...(prev.observedComps || [])];
                                  const nextAg = [...list[idx].agents];
                                  nextAg[slotIdx] = e.target.value;
                                  list[idx] = { ...list[idx], agents: nextAg };
                                  return { ...prev, observedComps: list };
                                })
                              }
                              className="px-1 py-1 rounded bg-[#090A0E] text-[10px] text-white"
                            >
                              {VALORANT_AGENTS_LIST.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Playstyle, Strengths, Weaknesses, Tactical Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Vermutete Spielstile
                  </label>
                  <textarea
                    rows={3}
                    value={editingOpp.playstyle || ''}
                    onChange={(e) =>
                      setEditingOpp((prev) =>
                        prev ? { ...prev, playstyle: e.target.value } : null
                      )
                    }
                    placeholder="z. B. Sehr aggressives Early-Game auf A-Main, langsamer Mid-Default..."
                    className="w-full p-3 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                    Eigene taktische Notizen
                  </label>
                  <textarea
                    rows={3}
                    value={editingOpp.tacticalNotes || ''}
                    onChange={(e) =>
                      setEditingOpp((prev) =>
                        prev ? { ...prev, tacticalNotes: e.target.value } : null
                      )
                    }
                    placeholder="Allgemeine Hinweise zum Gegner..."
                    className="w-full p-3 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#73FBD3] mb-1">
                    Stärken (eine pro Zeile)
                  </label>
                  <textarea
                    rows={3}
                    value={strengthsInput}
                    onChange={(e) => setStrengthsInput(e.target.value)}
                    placeholder="Starke Pistol-Runden&#10;Gute Post-Plant Crossfires"
                    className="w-full p-3 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-red-400 mb-1">
                    Schwächen (eine pro Zeile)
                  </label>
                  <textarea
                    rows={3}
                    value={weaknessesInput}
                    onChange={(e) => setWeaknessesInput(e.target.value)}
                    placeholder="Keine Flank-Watch bei schnellen B-Hits&#10;Überrotieren früh bei Fakes"
                    className="w-full p-3 rounded-xl bg-[#090A0E] border border-white/15 text-xs text-white resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-xs font-semibold text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] text-xs font-display font-bold uppercase tracking-wider text-white shadow-lg"
                >
                  Gegnerprofil speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
