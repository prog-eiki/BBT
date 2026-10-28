'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Save,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  BBT_TEAM_INFO,
  getAgentByIdOrName,
  getMapByIdOrName,
  getRoleColor,
  VALORANT_MAPS_LIST,
} from '@/lib/valorant-data';
import { AgentPickerModal } from './AgentPickerModal';
import { ExportLineupModal } from './ExportLineupModal';
import type { MapStrategy, TeamLineup, TeamPlayer } from '@/types/hq';

interface LineupBuilderViewProps {
  lineups: TeamLineup[];
  players: TeamPlayer[];
  strategies: MapStrategy[];
  initialLineup?: TeamLineup | null;
  isAdmin: boolean;
  canAddNotes: boolean;
  onSaveLineup: (lineup: Partial<TeamLineup> & { mapId: string; name: string }) => Promise<void>;
  onDeleteLineup: (lineupId: string) => Promise<void>;
  onAddLineupNote: (lineupId: string, notes: string) => Promise<void>;
  onOpenRosterModal: () => void;
}

function createFreshDraft(mapId: string, players: TeamPlayer[]): TeamLineup {
  const mapObj = getMapByIdOrName(mapId);
  const defaultAgents = ['jett', 'omen', 'killjoy', 'sova', 'cypher'];
  const now = new Date().toISOString();

  return {
    id: `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mapId: mapObj?.id || 'ascent',
    name: `${mapObj?.name || 'Ascent'} Main`,
    slots: [0, 1, 2, 3, 4].map((idx) => ({
      slotIndex: idx,
      playerId: players[idx]?.id || null,
      agentId: defaultAgents[idx] || null,
    })),
    substitute: {
      playerId: players[5]?.id || null,
      agentId: null,
    },
    strategyId: null,
    notes: '',
    allowDuplicateAgents: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const LineupBuilderView: React.FC<LineupBuilderViewProps> = ({
  lineups,
  players,
  strategies,
  initialLineup,
  isAdmin,
  canAddNotes,
  onSaveLineup,
  onDeleteLineup,
  onAddLineupNote,
  onOpenRosterModal,
}) => {
  const [draft, setDraft] = useState<TeamLineup>(() => {
    if (initialLineup) return structuredClone(initialLineup);
    if (lineups.length > 0) return structuredClone(lineups[0]);
    return createFreshDraft('ascent', players);
  });

  const [pickerSlot, setPickerSlot] = useState<number | 'sub' | null>(null);
  const [exportTarget, setExportTarget] = useState<TeamLineup | null>(null);
  const [filterMapId, setFilterMapId] = useState<string>('ALL');
  const [duplicateMapTarget, setDuplicateMapTarget] = useState<{
    source: TeamLineup;
    targetMapId: string;
    newName: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [playerNoteDraft, setPlayerNoteDraft] = useState('');

  useEffect(() => {
    if (initialLineup) {
      setDraft(structuredClone(initialLineup));
    }
  }, [initialLineup]);

  const selectedMap =
    getMapByIdOrName(draft.mapId) || VALORANT_MAPS_LIST[0];

  const handleMapChange = (nextMapId: string) => {
    const nextMapObj = getMapByIdOrName(nextMapId);
    const oldMapObj = getMapByIdOrName(draft.mapId);
    let nextName = draft.name;
    if (
      !nextName.trim() ||
      (oldMapObj &&
        nextName.trim().toLowerCase() ===
          `${oldMapObj.name.toLowerCase()} main`)
    ) {
      nextName = `${nextMapObj?.name || nextMapId} Main`;
    }

    setDraft((prev) => ({
      ...prev,
      mapId: nextMapId,
      name: nextName,
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleAssignPlayerToSlot = (
    slotIndex: number,
    newPlayerId: string | null
  ) => {
    setDraft((prev) => {
      const nextSlots = prev.slots.map((s) => ({ ...s }));
      const oldPlayerId = nextSlots[slotIndex]?.playerId || null;

      // If this player was already in another active slot, swap them cleanly
      if (newPlayerId) {
        const existingSlotIdx = nextSlots.findIndex(
          (s, idx) => idx !== slotIndex && s.playerId === newPlayerId
        );
        if (existingSlotIdx >= 0) {
          nextSlots[existingSlotIdx].playerId = oldPlayerId;
        }
      }

      nextSlots[slotIndex] = {
        ...nextSlots[slotIndex],
        slotIndex,
        playerId: newPlayerId,
      };

      // If substitute had the same player, swap or clear substitute
      let nextSub = prev.substitute ? { ...prev.substitute } : null;
      if (newPlayerId && nextSub?.playerId === newPlayerId) {
        nextSub = { ...nextSub, playerId: oldPlayerId };
      }

      return {
        ...prev,
        slots: nextSlots,
        substitute: nextSub,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleAssignAgent = (agentId: string) => {
    if (pickerSlot === null) return;
    if (pickerSlot === 'sub') {
      setDraft((prev) => ({
        ...prev,
        substitute: {
          playerId: prev.substitute?.playerId || null,
          agentId,
        },
        updatedAt: new Date().toISOString(),
      }));
      return;
    }

    setDraft((prev) => {
      const nextSlots = prev.slots.map((s, idx) =>
        idx === pickerSlot ? { ...s, agentId } : s
      );
      return {
        ...prev,
        slots: nextSlots,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleSaveCurrentLineup = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await onSaveLineup({
        ...draft,
        name: draft.name.trim() || `${selectedMap.name} Main`,
        updatedAt: new Date().toISOString(),
      });
      setSavedBanner(true);
      setTimeout(() => setSavedBanner(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewLineup = () => {
    const fresh = createFreshDraft(draft.mapId, players);
    setDraft(fresh);
  };

  const handleConfirmDuplicateToMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duplicateMapTarget || !isAdmin) return;
    const { source, targetMapId, newName } = duplicateMapTarget;
    const now = new Date().toISOString();
    const copy: TeamLineup = {
      ...structuredClone(source),
      id: `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mapId: targetMapId,
      name: newName.trim() || `${getMapByIdOrName(targetMapId)?.name || targetMapId} Copy`,
      createdAt: now,
      updatedAt: now,
    };
    await onSaveLineup(copy);
    setDraft(copy);
    setDuplicateMapTarget(null);
  };

  const usedAgentIds = draft.slots
    .map((s) => s.agentId)
    .filter((id): id is string => Boolean(id));

  const mapStrategies = strategies.filter(
    (s) => s.mapId.toLowerCase() === draft.mapId.toLowerCase()
  );

  const filteredSavedLineups = lineups.filter(
    (l) =>
      filterMapId === 'ALL' ||
      l.mapId.toLowerCase() === filterMapId.toLowerCase()
  );

  return (
    <div className="space-y-8">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-wider text-white">
            Team-Aufstellung
          </h1>
          <p className="text-xs sm:text-sm text-[#878C8F]">
            Erstelle und verwalte deine Team-Lineups für jede Map inkl. 1920×1080 PNG-Export.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && (
            <button
              type="button"
              onClick={onOpenRosterModal}
              className="px-3.5 py-2 rounded-xl bg-[#141821] hover:bg-[#1B202C] border border-white/10 text-xs font-semibold text-[#ECE8E1] flex items-center gap-2 transition"
            >
              <UserPlus className="w-4 h-4 text-[#C8A273]" />
              <span>Teamkader ({players.length})</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={handleCreateNewLineup}
              className="px-3.5 py-2 rounded-xl bg-[#141821] hover:bg-[#1B202C] border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4 text-[#C8A273]" />
              <span>Neues Lineup</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExportTarget(draft)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-xs sm:text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(158,20,27,0.45)] transition"
          >
            <Download className="w-4 h-4" />
            <span>PNG Export (1920×1080)</span>
          </button>
        </div>
      </div>

      {/* Horizontal Map Selector Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {VALORANT_MAPS_LIST.map((map) => {
          const isSelected = map.id === selectedMap.id;
          return (
            <button
              key={map.id}
              type="button"
              onClick={() => handleMapChange(map.id)}
              className={`group relative rounded-xl overflow-hidden shrink-0 w-28 sm:w-32 h-14 border transition ${
                isSelected
                  ? 'border-[#9E141B] ring-2 ring-[#9E141B]/50'
                  : 'border-white/10 opacity-70 hover:opacity-100 hover:border-[#C8A273]/40'
              }`}
            >
              <img
                src={map.listViewIcon || map.splash}
                alt={map.name}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent flex items-end p-2">
                <span className="font-display font-bold text-xs uppercase tracking-wider text-white">
                  {map.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Map Hero Banner (Matches Top-Right Screen in Reference Image) */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 h-36 sm:h-44 bg-[#0E1015] shadow-xl">
        <img
          src={selectedMap.splash}
          alt={selectedMap.name}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(7,8,10,0.96) 0%, rgba(7,8,10,0.72) 45%, rgba(7,8,10,0.2) 100%)',
          }}
        />
        <div className="relative z-10 h-full px-6 sm:px-8 flex flex-col justify-center">
          <span className="text-xs text-[#C8A273] font-medium">
            Ausgewählte Map
          </span>
          <h2 className="text-3xl sm:text-5xl font-display font-extrabold uppercase tracking-wider text-white mt-0.5">
            {selectedMap.name}
          </h2>
          <span className="text-xs text-[#878C8F] mt-1">
            VALORANT • Competitive ({selectedMap.sites})
          </span>
        </div>
      </div>

      {/* Lineup Name & Substitute Row */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-7">
          <label className="block text-xs font-semibold text-[#878C8F] mb-1.5">
            Lineup Name
          </label>
          <input
            type="text"
            value={draft.name}
            disabled={!isAdmin}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="z. B. Ascent Main"
            className="w-full px-4 py-2.5 rounded-xl bg-[#0F1218] border border-white/10 text-sm font-medium text-white focus:outline-none focus:border-[#9E141B] disabled:opacity-60"
          />
        </div>

        <div className="md:col-span-5">
          <label className="block text-xs font-semibold text-[#878C8F] mb-1.5">
            Ersatzspieler (optional)
          </label>
          <div className="flex items-center gap-2">
            <select
              value={draft.substitute?.playerId || ''}
              disabled={!isAdmin}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  substitute: {
                    playerId: e.target.value || null,
                    agentId: prev.substitute?.agentId || null,
                  },
                }))
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0F1218] border border-white/10 text-sm text-white focus:outline-none focus:border-[#9E141B] disabled:opacity-60"
            >
              <option value="">— Kein Ersatzspieler —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} #{p.tag}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setPickerSlot('sub')}
              className="px-3 py-2.5 rounded-xl bg-[#141821] hover:bg-[#1B202C] border border-white/10 text-xs font-semibold text-[#C8A273] shrink-0 transition disabled:opacity-50"
              title="Ersatzspieler-Agent wählen"
            >
              {draft.substitute?.agentId
                ? getAgentByIdOrName(draft.substitute.agentId)?.name
                : '+ Sub-Agent'}
            </button>
          </div>
        </div>
      </div>

      {/* Main 5-Card Lineup Display + Right Strategy/Save Column */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left/Center: 5 Vertical Agent Portrait Cards (Desktop 5 side-by-side, Mobile responsive grid) */}
        <div className="xl:col-span-9 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {[0, 1, 2, 3, 4].map((slotIdx) => {
            const slot = draft.slots[slotIdx] || {
              slotIndex: slotIdx,
              playerId: null,
              agentId: null,
            };
            const assignedPlayer = players.find((p) => p.id === slot.playerId);
            const assignedAgent = getAgentByIdOrName(slot.agentId);
            const roleColor = getRoleColor(assignedAgent?.role);

            return (
              <div
                key={slotIdx}
                className="group relative rounded-2xl bg-[#0E1117] border border-white/10 hover:border-[#9E141B]/70 overflow-hidden flex flex-col justify-between min-h-[410px] shadow-[0_14px_35px_rgba(0,0,0,0.65)] transition"
              >
                {/* Top Crimson Accent on First/Active Card */}
                <div
                  className="h-1 w-full"
                  style={{
                    background:
                      slotIdx === 0
                        ? 'linear-gradient(90deg, #9E141B, #C8A273)'
                        : 'rgba(255,255,255,0.06)',
                  }}
                />

                {/* Top Bar inside Card */}
                <div className="relative z-20 px-3 pt-2.5 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-black/50 text-[#878C8F] border border-white/5">
                    #{slotIdx + 1}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setPickerSlot(slotIdx)}
                      className="p-1.5 rounded-lg bg-black/50 hover:bg-[#9E141B] text-[#878C8F] hover:text-white transition"
                      title="Agent ändern"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Tall Full Agent Portrait */}
                <div
                  onClick={() => isAdmin && setPickerSlot(slotIdx)}
                  className={`relative flex-1 flex items-center justify-center overflow-hidden min-h-[220px] ${
                    isAdmin ? 'cursor-pointer' : ''
                  }`}
                >
                  {/* Radial Glow behind portrait */}
                  <div
                    className="absolute inset-0 opacity-30 pointer-events-none"
                    style={{
                      background: `radial-gradient(circle at 50% 45%, ${roleColor}44 0%, transparent 72%)`,
                    }}
                  />

                  {assignedAgent?.fullPortrait || assignedAgent?.displayIcon ? (
                    <img
                      src={
                        assignedAgent.fullPortrait || assignedAgent.displayIcon
                      }
                      alt={assignedAgent.name}
                      className="relative z-10 h-[250px] w-auto object-contain group-hover:scale-105 transition duration-300 drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)]"
                    />
                  ) : (
                    <div className="relative z-10 flex flex-col items-center justify-center text-center p-4">
                      <Shield className="w-10 h-10 text-[#878C8F]/50 mb-2" />
                      <span className="text-xs font-display font-bold uppercase tracking-wider text-[#878C8F]">
                        Agent wählen
                      </span>
                    </div>
                  )}
                </div>

                {/* Bottom Player & Agent Info Plate */}
                <div className="relative z-20 p-3.5 bg-gradient-to-t from-[#08090D] via-[#0C0E14]/95 to-transparent border-t border-white/5 space-y-2.5">
                  {/* Player Dropdown & Tag */}
                  <div>
                    {isAdmin ? (
                      <select
                        value={slot.playerId || ''}
                        onChange={(e) =>
                          handleAssignPlayerToSlot(
                            slotIdx,
                            e.target.value || null
                          )
                        }
                        className="w-full bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer truncate"
                      >
                        <option value="" className="bg-[#0F1218] text-gray-400">
                          — Spieler wählen —
                        </option>
                        {players.map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            className="bg-[#0F1218] text-white"
                          >
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-sm font-bold text-white truncate">
                        {assignedPlayer?.name || 'Unbesetzt'}
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-[#878C8F]">
                      {assignedPlayer ? `#${assignedPlayer.tag}` : '#----'}
                    </div>
                  </div>

                  {/* Agent Selection Button */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setPickerSlot(slotIdx)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#141822] hover:bg-[#1B202E] border border-white/10 flex items-center gap-2 text-left transition"
                  >
                    {assignedAgent?.displayIcon ? (
                      <img
                        src={assignedAgent.displayIcon}
                        alt={assignedAgent.name}
                        className="w-5 h-5 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-white/10 shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-white truncate">
                      {assignedAgent?.name || 'Agent wählen'}
                    </span>
                  </button>

                  {/* Role Badge */}
                  <div className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2">
                    {assignedAgent?.roleIcon ? (
                      <img
                        src={assignedAgent.roleIcon}
                        alt={assignedAgent.role}
                        className="w-3.5 h-3.5 object-contain opacity-80"
                      />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: roleColor }}
                      />
                    )}
                    <span
                      className="text-[11px] font-medium truncate"
                      style={{ color: roleColor }}
                    >
                      {assignedAgent?.role || 'Keine Rolle'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Panel: Strategy / Notes / Duplicate Toggle / Save */}
        <div className="xl:col-span-3 flex flex-col justify-between p-5 rounded-2xl bg-[#0F1218] border border-white/10 space-y-4">
          <div className="space-y-4">
            {/* Optional Link to Map Strategy */}
            <div>
              <label className="block text-xs font-semibold text-[#ECE8E1] mb-1.5">
                Verknüpfte Map-Strategie (optional)
              </label>
              <select
                value={draft.strategyId || ''}
                disabled={!isAdmin}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    strategyId: e.target.value || null,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-[#090A0E] border border-white/10 text-xs text-white focus:outline-none focus:border-[#9E141B]"
              >
                <option value="">— Keine Strategie verknüpft —</option>
                {mapStrategies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.side} • {s.site})
                  </option>
                ))}
              </select>
            </div>

            {/* Strategie / Notiz Textarea */}
            <div>
              <label className="block text-xs font-semibold text-[#ECE8E1] mb-1.5">
                Strategie / Notiz (optional)
              </label>
              <textarea
                rows={5}
                maxLength={500}
                disabled={!isAdmin}
                value={draft.notes}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="z. B. Wichtige Hinweise, Taktiken oder Besonderheiten..."
                className="w-full p-3 rounded-xl bg-[#090A0E] border border-white/10 text-xs text-white placeholder-[#878C8F]/60 focus:outline-none focus:border-[#9E141B] resize-none"
              />
              <div className="text-right text-[10px] font-mono text-[#878C8F] mt-1">
                {draft.notes.length}/500
              </div>
            </div>

            {/* Player Note Quick Append (if logged in as PLAYER with canAddNotes) */}
            {!isAdmin && canAddNotes && (
              <div className="p-3 rounded-xl bg-[#141821] border border-white/10 space-y-2">
                <div className="text-[11px] font-semibold text-[#C8A273]">
                  Eigene Spieler-Notiz zum Lineup ergänzen:
                </div>
                <input
                  type="text"
                  value={playerNoteDraft}
                  onChange={(e) => setPlayerNoteDraft(e.target.value)}
                  placeholder="Kurzer taktischer Hinweis..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#090A0E] border border-white/10 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!playerNoteDraft.trim()) return;
                    await onAddLineupNote(draft.id, playerNoteDraft.trim());
                    setPlayerNoteDraft('');
                  }}
                  className="w-full py-1.5 rounded-lg bg-[#9E141B] text-xs font-bold text-white"
                >
                  Notiz speichern
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-white/10">
            {/* Agent Duplicates Toggle */}
            <label className="flex items-center justify-between cursor-pointer select-none py-1">
              <span className="text-xs font-medium text-[#ECE8E1]">
                Agent-Duplikate erlauben
              </span>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={Boolean(draft.allowDuplicateAgents)}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    allowDuplicateAgents: e.target.checked,
                  }))
                }
                className="accent-[#9E141B] w-4 h-4 rounded"
              />
            </label>

            {isAdmin && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveCurrentLineup}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(158,20,27,0.5)] transition disabled:opacity-50"
              >
                {savedBanner ? (
                  <>
                    <Check className="w-4 h-4 text-[#73FBD3]" />
                    <span>Lineup gespeichert!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>
                      {saving ? 'Speichere...' : 'Lineup speichern'}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Esports Graphic Preview Card (Shows BBT Logo, Map, Lineup Name, 5 Portraits, Sub) */}
      <div className="p-6 rounded-2xl bg-[#0B0D12] border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={BBT_TEAM_INFO.logoUrl}
              alt="BBT"
              className="w-10 h-10 object-contain"
            />
            <div>
              <div className="text-[11px] font-mono uppercase tracking-widest text-[#C8A273]">
                BIGBLACKTEA (BBT) • E-SPORTS LINEUP-VORSCHAU
              </div>
              <h3 className="text-lg font-display font-bold uppercase text-white">
                {draft.name || `${selectedMap.name} Main`} — {selectedMap.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExportTarget(draft)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-[#9E141B] border border-white/10 text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2 transition"
          >
            <Sparkles className="w-4 h-4 text-[#C8A273]" />
            <span>1920×1080 PNG Vorschau & Download</span>
          </button>
        </div>
      </div>

      {/* Saved Lineups & Templates Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-display font-bold uppercase tracking-wider text-white">
              Gespeicherte Team-Lineups ({filteredSavedLineups.length})
            </h2>
            <p className="text-xs text-[#878C8F]">
              Wähle ein gespeichertes Lineup zur Bearbeitung, zum PNG-Export oder dupliziere es als Vorlage für eine andere Map.
            </p>
          </div>

          <select
            value={filterMapId}
            onChange={(e) => setFilterMapId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#0F1218] border border-white/10 text-xs text-white"
          >
            <option value="ALL">Alle Maps ({lineups.length})</option>
            {VALORANT_MAPS_LIST.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {filteredSavedLineups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSavedLineups.map((lu) => {
              const mapObj = getMapByIdOrName(lu.mapId);
              const isCurrent = lu.id === draft.id;
              const subPlayer = lu.substitute?.playerId
                ? players.find((p) => p.id === lu.substitute?.playerId)
                : null;

              return (
                <div
                  key={lu.id}
                  className={`rounded-2xl overflow-hidden border transition flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-[#141822] border-[#9E141B] shadow-[0_0_25px_rgba(158,20,27,0.3)]'
                      : 'bg-[#0F1218] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    {/* Card Map Header */}
                    <div className="relative h-20 overflow-hidden">
                      <img
                        src={mapObj?.splash}
                        alt={mapObj?.name || lu.mapId}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-transparent p-3.5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-mono uppercase text-[#C8A273]">
                            {mapObj?.name || lu.mapId}
                          </span>
                          <h3 className="text-base font-display font-bold uppercase text-white">
                            {lu.name}
                          </h3>
                        </div>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded bg-[#73FBD3]/20 border border-[#73FBD3]/40 text-[10px] font-mono text-[#73FBD3]">
                            Im Editor
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 5 Mini Slots */}
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-5 gap-1.5">
                        {lu.slots.slice(0, 5).map((s, idx) => {
                          const p = players.find((pl) => pl.id === s.playerId);
                          const a = getAgentByIdOrName(s.agentId);
                          return (
                            <div
                              key={idx}
                              className="p-1.5 rounded-lg bg-[#090A0E] border border-white/5 flex flex-col items-center text-center"
                            >
                              {a?.displayIcon ? (
                                <img
                                  src={a.displayIcon}
                                  alt={a.name}
                                  className="w-8 h-8 rounded-full object-cover mb-1"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-white/5 mb-1" />
                              )}
                              <span className="text-[10px] font-bold text-white truncate w-full">
                                {p?.name || 'Offen'}
                              </span>
                              <span className="text-[9px] text-[#C8A273] truncate w-full">
                                {a?.name || '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {subPlayer && (
                        <div className="text-[11px] text-[#878C8F] flex items-center justify-between px-2 py-1 rounded bg-white/[0.02]">
                          <span>Ersatzspieler:</span>
                          <span className="text-[#ECE8E1] font-medium">
                            {subPlayer.name} #{subPlayer.tag}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="px-4 py-3 bg-[#090A0E]/80 border-t border-white/5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft(structuredClone(lu))}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-white transition"
                    >
                      Öffnen
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExportTarget(lu)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-[#9E141B] text-[#C8A273] hover:text-white transition"
                        title="Als PNG exportieren"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            setDuplicateMapTarget({
                              source: lu,
                              targetMapId: lu.mapId,
                              newName: `${lu.name} (Kopie)`,
                            })
                          }
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#ECE8E1] transition"
                          title="Duplizieren / Als Vorlage für andere Map verwenden"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteLineup(lu.id)}
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-red-900/60 text-[#878C8F] hover:text-red-200 transition"
                          title="Lineup löschen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-[#0F1218] border border-dashed border-white/10 text-center text-xs text-[#878C8F]">
            Keine gespeicherten Lineups für diesen Filter gefunden.
          </div>
        )}
      </div>

      {/* Agent Picker Modal */}
      <AgentPickerModal
        isOpen={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        selectedAgentId={
          pickerSlot === 'sub'
            ? draft.substitute?.agentId || null
            : typeof pickerSlot === 'number'
            ? draft.slots[pickerSlot]?.agentId || null
            : null
        }
        usedAgentIds={usedAgentIds}
        allowDuplicateAgents={Boolean(draft.allowDuplicateAgents)}
        onToggleAllowDuplicates={(allow) =>
          setDraft((prev) => ({ ...prev, allowDuplicateAgents: allow }))
        }
        onSelectAgent={handleAssignAgent}
        slotLabel={
          pickerSlot === 'sub'
            ? 'Ersatzspieler'
            : typeof pickerSlot === 'number'
            ? `Slot #${pickerSlot + 1}`
            : ''
        }
        playerName={
          pickerSlot === 'sub'
            ? players.find((p) => p.id === draft.substitute?.playerId)?.name
            : typeof pickerSlot === 'number'
            ? players.find((p) => p.id === draft.slots[pickerSlot]?.playerId)
                ?.name
            : undefined
        }
      />

      {/* PNG Export Preview & Download Modal */}
      <ExportLineupModal
        isOpen={Boolean(exportTarget)}
        onClose={() => setExportTarget(null)}
        lineup={exportTarget}
        players={players}
      />

      {/* Duplicate / Template for Another Map Modal */}
      {duplicateMapTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setDuplicateMapTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-[#0F1218] border border-white/15 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-bold uppercase text-white mb-1">
              Lineup duplizieren / Als Vorlage nutzen
            </h3>
            <p className="text-xs text-[#878C8F] mb-4">
              Übernehme alle 5 Spieler und Agents für dieselbe oder eine andere Map.
            </p>

            <form onSubmit={handleConfirmDuplicateToMap} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                  Ziel-Map
                </label>
                <select
                  value={duplicateMapTarget.targetMapId}
                  onChange={(e) => {
                    const nextMap = getMapByIdOrName(e.target.value);
                    setDuplicateMapTarget((prev) =>
                      prev
                        ? {
                            ...prev,
                            targetMapId: e.target.value,
                            newName: `${nextMap?.name || e.target.value} Main`,
                          }
                        : null
                    );
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
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
                  Name des neuen Lineups
                </label>
                <input
                  type="text"
                  value={duplicateMapTarget.newName}
                  onChange={(e) =>
                    setDuplicateMapTarget((prev) =>
                      prev ? { ...prev, newName: e.target.value } : null
                    )
                  }
                  required
                  className="w-full px-3.5 py-2 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDuplicateMapTarget(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-xs text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#9E141B] hover:bg-[#B81720] text-xs font-bold uppercase text-white"
                >
                  Vorlage speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
