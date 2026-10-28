'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type {
  AgentRole,
  BoardAbilityToken,
  BoardAgentToken,
  BoardDrawingPath,
  BoardImageOverlay,
  BoardTextNote,
  BoardZoneShape,
  MapStrategy,
  StrategyPlayerAssignment,
  StrategySide,
  StrategySite,
  StrategyStep,
  StrategyType,
  TacticalBoardPage,
  TeamPlayer,
  ValorantAgentAsset,
} from '@/types/hq';
import {
  AGENT_ROLES_META,
  STRATEGY_SIDES,
  STRATEGY_TYPES,
  VALORANT_AGENTS_LIST,
  VALORANT_MAPS_LIST,
  getAgentByIdOrName,
  getMapByIdOrName,
  getRoleColor,
} from '@/lib/valorant-data';
import type {
  LiveParticipant,
  LiveTacticalBoardState,
} from '@/lib/live-sync';
import { AgentPickerModal } from './AgentPickerModal';

interface MapStrategiesViewProps {
  strategies: MapStrategy[];
  players: TeamPlayer[];
  initialStrategy?: MapStrategy | null;
  openCreateModalOnMount?: boolean;
  onClearCreateTrigger?: () => void;
  isAdmin?: boolean;
  canAddNotes?: boolean;
  canEdit?: boolean;
  initialOpenCreate?: boolean;
  currentUsername?: string;
  currentDisplayName?: string;
  onSaveStrategy: (
    strategy: Partial<MapStrategy> & { mapId: string; name: string }
  ) => Promise<void>;
  onDeleteStrategy: (strategyId: string) => Promise<void>;
  onAddStrategyNote?: (strategyId: string, notes: string) => Promise<void>;
}

type BoardTool =
  | 'select'
  | 'draw'
  | 'eraser'
  | 'text'
  | 'image'
  | 'vision'
  | 'circle'
  | 'rect'
  | 'tripwire';

type AgentFilterTab = 'ALL' | 'ON_MAP' | 'ROLE';

const TOOL_COLORS = [
  { id: 'amber', label: 'Taktik-Gold', hex: '#F59E0B' },
  { id: 'white', label: 'Weiß', hex: '#F8FAFC' },
  { id: 'teal', label: 'Ally-Türkis', hex: '#10B981' },
  { id: 'red', label: 'Enemy-Rot', hex: '#EF4444' },
  { id: 'cyan', label: 'Utility-Blau', hex: '#38BDF8' },
  { id: 'purple', label: 'Violett', hex: '#A855F7' },
];

function createEmptyBoardPage(index: number): TacticalBoardPage {
  return {
    id: `page-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: `Page ${index}`,
    agentTokens: [],
    abilityTokens: [],
    drawings: [],
    textNotes: [],
    zones: [],
    images: [],
  };
}

function clampPct(val: number): number {
  return Math.max(2, Math.min(98, Number(val.toFixed(2))));
}

function computeVisionConePath(
  x: number,
  y: number,
  targetX: number,
  targetY: number,
  spreadDeg = 62
): string {
  const dx = targetX - x;
  const dy = targetY - y;
  const dist = Math.max(4, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const halfSpread = ((spreadDeg / 2) * Math.PI) / 180;

  const x1 = x + dist * Math.cos(angle - halfSpread);
  const y1 = y + dist * Math.sin(angle - halfSpread);
  const x2 = x + dist * Math.cos(angle + halfSpread);
  const y2 = y + dist * Math.sin(angle + halfSpread);

  return `M ${x} ${y} L ${x1} ${y1} A ${dist} ${dist} 0 0 1 ${x2} ${y2} Z`;
}

export function MapStrategiesView({
  strategies,
  players,
  initialStrategy = null,
  openCreateModalOnMount = false,
  onClearCreateTrigger,
  isAdmin = true,
  canAddNotes = true,
  canEdit: canEditProp,
  initialOpenCreate = false,
  currentUsername = 'BBT-Member',
  currentDisplayName = 'BBT Member',
  onSaveStrategy,
  onDeleteStrategy,
}: MapStrategiesViewProps) {
  const canEdit = canEditProp ?? isAdmin ?? canAddNotes ?? true;
  // Top-level workspace mode: 'BOARD' (ValoPlant 2D interactive map) or 'LIBRARY' (saved list & filter overview)
  const [workspaceMode, setWorkspaceMode] = useState<'BOARD' | 'LIBRARY'>('BOARD');
  const [showStrategyDetailsDrawer, setShowStrategyDetailsDrawer] = useState(false);
  const [showMapDropdown, setShowMapDropdown] = useState(false);
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [showBoardSettings, setShowBoardSettings] = useState(false);

  // Real-Time Live Multi-User Collaboration State
  const clientId = useMemo(
    () => `board-${Math.random().toString(36).slice(2, 10)}`,
    []
  );
  const [liveSyncEnabled, setLiveSyncEnabled] = useState<boolean>(true);
  const [liveConnected, setLiveConnected] = useState<boolean>(false);
  const [liveParticipants, setLiveParticipants] = useState<LiveParticipant[]>([]);
  const [lastLiveEditor, setLastLiveEditor] = useState<string>('');
  const [lastLiveUpdatedAt, setLastLiveUpdatedAt] = useState<string>('');

  const isApplyingRemoteRef = useRef<boolean>(false);
  const hasHydratedLiveRef = useRef<boolean>(false);
  const lastAppliedRevisionRef = useRef<number>(0);
  const broadcastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCursorSentAtRef = useRef<number>(0);

  // Library Filter State
  const [filterMap, setFilterMap] = useState<string>('ALL');
  const [filterSide, setFilterSide] = useState<string>('ALL');
  const [filterSite, setFilterSite] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Current Strategy Form & Board State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formMapId, setFormMapId] = useState<string>('ascent');
  const [formName, setFormName] = useState<string>('');
  const [formSubtitle, setFormSubtitle] = useState<string>('');
  const [formSide, setFormSide] = useState<StrategySide>('Angriff');
  const [formSite, setFormSite] = useState<StrategySite>('B');
  const [formType, setFormType] = useState<StrategyType>('Execute');
  const [formAssignments, setFormAssignments] = useState<StrategyPlayerAssignment[]>(() =>
    [0, 1, 2, 3, 4].map((slotIndex) => ({
      slotIndex,
      playerId: players[slotIndex]?.id || null,
      agentId: null,
      callsignOrTask: '',
    }))
  );
  const [formSteps, setFormSteps] = useState<StrategyStep[]>([
    {
      id: 'step-1',
      phase: 'Pre-Round / Setup',
      timing: '1:40',
      description: '',
    },
  ]);
  const [formNotes, setFormNotes] = useState<string>('');
  const [formTacticalImage, setFormTacticalImage] = useState<string | null>(null);

  // Multi-page Tactical Board State
  const [boardPages, setBoardPages] = useState<TacticalBoardPage[]>(() => [
    createEmptyBoardPage(1),
  ]);
  const [activePageIndex, setActivePageIndex] = useState<number>(0);
  const [undoStack, setUndoStack] = useState<TacticalBoardPage[][]>([]);

  // Board Visual Settings
  const [radarTintMode, setRadarTintMode] = useState<'VALOPLANT' | 'ORIGINAL'>('VALOPLANT');
  const [showCalloutLabels, setShowCalloutLabels] = useState<boolean>(true);
  const [rotateMap180, setRotateMap180] = useState<boolean>(false);
  const [mapZoom, setMapZoom] = useState<number>(1);

  // Active Tool & Right Sidebar State
  const [activeTool, setActiveTool] = useState<BoardTool>('select');
  const [activeColor, setActiveColor] = useState<string>('#F59E0B');
  const [drawDashed, setDrawDashed] = useState<boolean>(false);
  const [drawWithArrowHead, setDrawWithArrowHead] = useState<boolean>(true);

  const [agentFilterTab, setAgentFilterTab] = useState<AgentFilterTab>('ALL');
  const [agentRoleFilter, setAgentRoleFilter] = useState<AgentRole | 'ALL'>('ALL');
  const [agentSideMode, setAgentSideMode] = useState<'ally' | 'enemy'>('ally');
  const [selectedSidebarAgentId, setSelectedSidebarAgentId] = useState<string>('sova');

  // Selection & Dragging State on the 2D Map
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingTextNoteId, setEditingTextNoteId] = useState<string | null>(null);
  const [isTrashHovered, setIsTrashHovered] = useState<boolean>(false);

  const [draggingState, setDraggingState] = useState<{
    kind:
      | 'agent'
      | 'agent-vision-handle'
      | 'ability'
      | 'text'
      | 'zone-move'
      | 'zone-handle'
      | 'zone-p2'
      | 'image';
    id: string;
    offsetX?: number;
    offsetY?: number;
  } | null>(null);

  const [activeDrawingPoints, setActiveDrawingPoints] = useState<
    { x: number; y: number }[] | null
  >(null);

  const [saving, setSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [pickerSlotIndex, setPickerSlotIndex] = useState<number | null>(null);

  const mapBoardRef = useRef<HTMLDivElement | null>(null);
  const imageOverlayInputRef = useRef<HTMLInputElement | null>(null);
  const detailsImageInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Apply remote LiveTacticalBoardState received via SSE or poll
  const applyRemoteBoardState = useCallback(
    (remote: LiveTacticalBoardState, isInitialSnapshot = false) => {
      if (!remote || !Array.isArray(remote.boardPages)) return;
      if (
        !isInitialSnapshot &&
        remote.updatedByClientId === clientId
      ) {
        lastAppliedRevisionRef.current = Math.max(
          lastAppliedRevisionRef.current,
          remote.revision || 0
        );
        return;
      }
      if (
        !isInitialSnapshot &&
        remote.revision <= lastAppliedRevisionRef.current
      ) {
        return;
      }

      isApplyingRemoteRef.current = true;
      lastAppliedRevisionRef.current = remote.revision || 0;
      setLastLiveEditor(remote.updatedBy || '');
      setLastLiveUpdatedAt(remote.updatedAt || '');

      setEditingId(remote.editingStrategyId || null);
      setFormMapId(remote.mapId || 'ascent');
      setFormName(remote.name ?? '');
      setFormSubtitle(remote.subtitle ?? '');
      setFormSide(remote.side || 'Angriff');
      setFormSite(remote.site || 'B');
      setFormType(remote.type || 'Execute');
      if (Array.isArray(remote.assignments) && remote.assignments.length > 0) {
        setFormAssignments(remote.assignments);
      }
      if (Array.isArray(remote.steps) && remote.steps.length > 0) {
        setFormSteps(remote.steps);
      }
      setFormNotes(remote.notes ?? '');
      setBoardPages(
        remote.boardPages.length > 0
          ? remote.boardPages
          : [createEmptyBoardPage(1)]
      );
      setActivePageIndex(
        Math.min(
          remote.activePageIndex || 0,
          Math.max(0, remote.boardPages.length - 1)
        )
      );
      if (remote.radarTintMode) {
        setRadarTintMode(remote.radarTintMode);
      }
      if (typeof remote.rotateMap180 === 'boolean') {
        setRotateMap180(remote.rotateMap180);
      }

      setTimeout(() => {
        isApplyingRemoteRef.current = false;
        hasHydratedLiveRef.current = true;
      }, 35);
    },
    [clientId]
  );

  // Subscribe to Real-Time Live Stream (/api/live/stream) + fallback poll (/api/live)
  useEffect(() => {
    if (!liveSyncEnabled) {
      setLiveConnected(false);
      return;
    }

    const streamUrl = `/api/live/stream?clientId=${encodeURIComponent(
      clientId
    )}&username=${encodeURIComponent(
      currentUsername
    )}&displayName=${encodeURIComponent(currentDisplayName)}`;

    const es = new EventSource(streamUrl);

    es.onopen = () => {
      setLiveConnected(true);
    };

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'SNAPSHOT') {
          setLiveConnected(true);
          if (Array.isArray(data.participants)) {
            setLiveParticipants(data.participants);
          }
          // Only hydrate from snapshot if user didn't explicitly click a specific strategy from Dashboard
          if (data.board && !initialStrategy && !openCreateModalOnMount && !initialOpenCreate) {
            applyRemoteBoardState(data.board, true);
          } else {
            hasHydratedLiveRef.current = true;
          }
        } else if (data.type === 'BOARD_UPDATE' && data.board) {
          applyRemoteBoardState(data.board, false);
        } else if (data.type === 'PRESENCE_UPDATE' && Array.isArray(data.participants)) {
          setLiveParticipants(data.participants);
        }
      } catch {
        // ignore malformed event
      }
    };

    es.onerror = () => {
      setLiveConnected(false);
    };

    // Resilient fallback poll every 2.5s + heartbeat
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/live', { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        if (json.ok) {
          setLiveConnected(true);
          if (Array.isArray(json.participants)) {
            setLiveParticipants(json.participants);
          }
          if (json.board) {
            applyRemoteBoardState(json.board, false);
          }
        }
      } catch {
        // ignore network hiccup
      }
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      es.close();
      fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'LEAVE', clientId }),
      }).catch(() => {});
    };
  }, [
    liveSyncEnabled,
    clientId,
    currentUsername,
    currentDisplayName,
    initialStrategy,
    openCreateModalOnMount,
    initialOpenCreate,
    applyRemoteBoardState,
  ]);

  // Automatically broadcast local board changes to all other connected team members in real time
  useEffect(() => {
    if (!liveSyncEnabled || !hasHydratedLiveRef.current || isApplyingRemoteRef.current) {
      return;
    }

    if (broadcastTimerRef.current) {
      clearTimeout(broadcastTimerRef.current);
    }

    broadcastTimerRef.current = setTimeout(() => {
      if (isApplyingRemoteRef.current) return;
      fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_BOARD',
          clientId,
          username: currentUsername,
          displayName: currentDisplayName,
          board: {
            editingStrategyId: editingId,
            mapId: formMapId,
            name: formName,
            subtitle: formSubtitle,
            side: formSide,
            site: formSite,
            type: formType,
            assignments: formAssignments,
            steps: formSteps,
            notes: formNotes,
            boardPages,
            activePageIndex,
            radarTintMode,
            rotateMap180,
          },
        }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res?.ok && res.board) {
            lastAppliedRevisionRef.current = Math.max(
              lastAppliedRevisionRef.current,
              res.board.revision || 0
            );
            setLastLiveEditor(res.board.updatedBy || currentDisplayName);
            setLastLiveUpdatedAt(res.board.updatedAt || '');
          }
        })
        .catch(() => {});
    }, 45);

    return () => {
      if (broadcastTimerRef.current) {
        clearTimeout(broadcastTimerRef.current);
      }
    };
  }, [
    liveSyncEnabled,
    clientId,
    currentUsername,
    currentDisplayName,
    editingId,
    formMapId,
    formName,
    formSubtitle,
    formSide,
    formSite,
    formType,
    formAssignments,
    formSteps,
    formNotes,
    boardPages,
    activePageIndex,
    radarTintMode,
    rotateMap180,
  ]);

  // Throttled live cursor position broadcast on the 2D Map
  const broadcastCursorMove = useCallback(
    (x: number | null, y: number | null) => {
      if (!liveSyncEnabled) return;
      const now = Date.now();
      if (x !== null && now - lastCursorSentAtRef.current < 85) {
        return;
      }
      lastCursorSentAtRef.current = now;
      fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CURSOR_MOVE',
          clientId,
          username: currentUsername,
          displayName: currentDisplayName,
          cursorX: x,
          cursorY: y,
          activePageIndex,
        }),
      }).catch(() => {});
    },
    [liveSyncEnabled, clientId, currentUsername, currentDisplayName, activePageIndex]
  );

  // Load initial strategy or create mode on mount
  useEffect(() => {
    if (initialOpenCreate || openCreateModalOnMount) {
      hasHydratedLiveRef.current = true;
      startNewStrategy('corrode');
      onClearCreateTrigger?.();
      return;
    }
    if (initialStrategy) {
      hasHydratedLiveRef.current = true;
      loadStrategyIntoWorkspace(initialStrategy);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStrategy, openCreateModalOnMount]);

  const currentMapAsset = useMemo(
    () => getMapByIdOrName(formMapId) || VALORANT_MAPS_LIST[0],
    [formMapId]
  );

  const currentPage: TacticalBoardPage = useMemo(
    () => boardPages[activePageIndex] || boardPages[0] || createEmptyBoardPage(1),
    [boardPages, activePageIndex]
  );

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-19), structuredClone(boardPages)]);
  }, [boardPages]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setBoardPages(last);
      return prev.slice(0, -1);
    });
  }, []);

  const updateCurrentPage = useCallback(
    (updater: (page: TacticalBoardPage) => TacticalBoardPage, recordUndo = true) => {
      if (recordUndo) {
        pushUndoSnapshot();
      }
      setBoardPages((prev) => {
        const safeIdx = Math.min(activePageIndex, Math.max(0, prev.length - 1));
        return prev.map((p, idx) => (idx === safeIdx ? updater(p) : p));
      });
    },
    [activePageIndex, pushUndoSnapshot]
  );

  function startNewStrategy(defaultMapId?: string) {
    const targetMap = defaultMapId || formMapId || 'ascent';
    const mapAsset = getMapByIdOrName(targetMap) || VALORANT_MAPS_LIST[0];
    setEditingId(null);
    setFormMapId(mapAsset.id);
    setFormName('');
    setFormSubtitle('');
    setFormSide('Angriff');
    setFormSite(mapAsset.availableSites[0] || 'A');
    setFormType('Execute');
    setFormAssignments(
      [0, 1, 2, 3, 4].map((slotIndex) => ({
        slotIndex,
        playerId: players[slotIndex]?.id || null,
        agentId: null,
        callsignOrTask: '',
      }))
    );
    setFormSteps([
      {
        id: `step-${Date.now()}-1`,
        phase: 'Setup & Pre-Round',
        timing: '1:40',
        description: '',
      },
    ]);
    setFormNotes('');
    setFormTacticalImage(null);
    setBoardPages([createEmptyBoardPage(1)]);
    setActivePageIndex(0);
    setUndoStack([]);
    setSelectedItemId(null);
    setWorkspaceMode('BOARD');
  }

  function loadStrategyIntoWorkspace(strat: MapStrategy) {
    setEditingId(strat.id);
    setFormMapId(strat.mapId);
    setFormName(strat.name);
    setFormSubtitle(strat.subtitle || '');
    setFormSide(strat.side);
    setFormSite(strat.site);
    setFormType(strat.type);
    setFormAssignments(
      strat.assignments.length === 5
        ? strat.assignments.map((a, idx) => ({ ...a, slotIndex: idx }))
        : [0, 1, 2, 3, 4].map((slotIndex) => ({
            slotIndex,
            playerId:
              strat.assignments[slotIndex]?.playerId || players[slotIndex]?.id || null,
            agentId: strat.assignments[slotIndex]?.agentId || null,
            callsignOrTask: strat.assignments[slotIndex]?.callsignOrTask || '',
          }))
    );
    setFormSteps(
      strat.steps.length > 0
        ? strat.steps.map((st, idx) =>
            typeof st === 'string'
              ? {
                  id: `step-${idx}-${Date.now()}`,
                  phase: `Phase ${idx + 1}`,
                  timing: '1:10',
                  description: st,
                }
              : st
          )
        : [
            {
              id: `step-${Date.now()}`,
              phase: 'Execute',
              timing: '1:10',
              description: '',
            },
          ]
    );
    setFormNotes(strat.notes || '');
    setFormTacticalImage(strat.tacticalImage || null);

    if (Array.isArray(strat.boardPages) && strat.boardPages.length > 0) {
      setBoardPages(structuredClone(strat.boardPages));
    } else {
      // Seed Page 1 with any assigned agents if boardPages wasn't created yet
      const seededTokens: BoardAgentToken[] = strat.assignments
        .filter((a) => a.agentId)
        .map((a, idx) => ({
          id: `tok-seed-${idx}-${Date.now()}`,
          agentId: a.agentId!,
          side: 'ally' as const,
          playerId: a.playerId || null,
          x: 34 + idx * 8,
          y: 78,
          hasVisionCone: false,
          visionAngle: -90,
          visionLength: 18,
        }));
      const page1 = createEmptyBoardPage(1);
      page1.agentTokens = seededTokens;
      setBoardPages([page1]);
    }
    setActivePageIndex(0);
    setUndoStack([]);
    setSelectedItemId(null);
    setWorkspaceMode('BOARD');
  }

  // Sync ally agents placed on Page 1 with the 5 BBT Strategy Player Assignments
  const syncBoardAgentsToAssignments = useCallback(
    (tokens: BoardAgentToken[]) => {
      const allyTokens = tokens.filter((t) => t.side === 'ally').slice(0, 5);
      if (allyTokens.length === 0) return;
      setFormAssignments((prev) =>
        prev.map((slot, idx) => {
          const tok = allyTokens[idx];
          if (!tok) return slot;
          return {
            ...slot,
            agentId: tok.agentId,
            playerId: tok.playerId || slot.playerId,
          };
        })
      );
    },
    []
  );

  // Convert client mouse/touch coordinates into 0..100% coordinates inside mapBoardRef
  const getBoardCoords = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const el = mapBoardRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      const rawX = ((clientX - rect.left) / rect.width) * 100;
      const rawY = ((clientY - rect.top) / rect.height) * 100;
      return {
        x: clampPct(rawX),
        y: clampPct(rawY),
      };
    },
    []
  );

  // Place an Agent on the 2D Map
  const placeAgentOnMap = useCallback(
    (agentId: string, x: number, y: number, side: 'ally' | 'enemy' = agentSideMode) => {
      if (!canEdit) return;
      // Assign a default BBT player if ally and unassigned
      const existingAllyCount = currentPage.agentTokens.filter(
        (t) => t.side === 'ally'
      ).length;
      const defaultPlayer =
        side === 'ally' ? players[existingAllyCount % Math.max(1, players.length)] : null;

      const newToken: BoardAgentToken = {
        id: `agent-tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agentId,
        side,
        playerId: defaultPlayer?.id || null,
        x: clampPct(x),
        y: clampPct(y),
        hasVisionCone: false,
        visionAngle: side === 'ally' ? -90 : 90,
        visionLength: 18,
      };

      updateCurrentPage((page) => {
        const nextTokens = [...page.agentTokens, newToken];
        if (activePageIndex === 0) {
          syncBoardAgentsToAssignments(nextTokens);
        }
        return {
          ...page,
          agentTokens: nextTokens,
        };
      });
      setSelectedItemId(newToken.id);
      setSelectedSidebarAgentId(agentId);
      setActiveTool('select');
    },
    [
      canEdit,
      agentSideMode,
      currentPage.agentTokens,
      players,
      updateCurrentPage,
      activePageIndex,
      syncBoardAgentsToAssignments,
    ]
  );

  // Place an Ability Icon on the 2D Map
  const placeAbilityOnMap = useCallback(
    (
      agentId: string,
      slot: string,
      name: string,
      icon: string,
      x: number,
      y: number
    ) => {
      if (!canEdit) return;
      const isSmokeOrZone =
        name.toLowerCase().includes('smoke') ||
        name.toLowerCase().includes('cloud') ||
        name.toLowerCase().includes('shroud') ||
        name.toLowerCase().includes('nebula') ||
        name.toLowerCase().includes('molly') ||
        name.toLowerCase().includes('swarm') ||
        name.toLowerCase().includes('recon') ||
        name.toLowerCase().includes('lockdown') ||
        name.toLowerCase().includes('salvo');

      const newAbility: BoardAbilityToken = {
        id: `abil-tok-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        agentId,
        abilitySlot: slot,
        abilityName: name,
        abilityIcon: icon,
        side: agentSideMode,
        x: clampPct(x),
        y: clampPct(y),
        radius: isSmokeOrZone ? 6.5 : 0,
        color: agentSideMode === 'ally' ? '#10B981' : '#EF4444',
      };

      updateCurrentPage((page) => ({
        ...page,
        abilityTokens: [...page.abilityTokens, newAbility],
      }));
      setSelectedItemId(newAbility.id);
      setActiveTool('select');
    },
    [canEdit, agentSideMode, updateCurrentPage]
  );

  // Delete any item by ID from current page
  const deleteItemFromBoard = useCallback(
    (itemId: string) => {
      if (!canEdit) return;
      updateCurrentPage((page) => ({
        ...page,
        agentTokens: page.agentTokens.filter((t) => t.id !== itemId),
        abilityTokens: page.abilityTokens.filter((t) => t.id !== itemId),
        drawings: page.drawings.filter((d) => d.id !== itemId),
        textNotes: page.textNotes.filter((n) => n.id !== itemId),
        zones: page.zones.filter((z) => z.id !== itemId),
        images: page.images.filter((img) => img.id !== itemId),
      }));
      if (selectedItemId === itemId) {
        setSelectedItemId(null);
      }
    },
    [canEdit, updateCurrentPage, selectedItemId]
  );

  // Keyboard Delete / Backspace & Ctrl+Z support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (workspaceMode !== 'BOARD' || !canEdit) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedItemId) {
        e.preventDefault();
        deleteItemFromBoard(selectedItemId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'Escape') {
        setSelectedItemId(null);
        setEditingTextNoteId(null);
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workspaceMode, canEdit, selectedItemId, deleteItemFromBoard, handleUndo]);

  // HTML5 Drag & Drop onto the 2D Map Canvas
  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!canEdit) return;
    const coords = getBoardCoords(e.clientX, e.clientY);
    if (!coords) return;

    const rawData = e.dataTransfer.getData('application/bbt-tactical-item');
    if (!rawData) return;

    try {
      const parsed = JSON.parse(rawData);
      if (parsed.type === 'AGENT' && parsed.agentId) {
        placeAgentOnMap(parsed.agentId, coords.x, coords.y, parsed.side || agentSideMode);
      } else if (parsed.type === 'ABILITY') {
        placeAbilityOnMap(
          parsed.agentId,
          parsed.slot,
          parsed.name,
          parsed.icon,
          coords.x,
          coords.y
        );
      }
    } catch {
      // ignore invalid drag payload
    }
  };

  // Pointer Down on the 2D Map Background
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const coords = getBoardCoords(e.clientX, e.clientY);
    if (!coords) return;

    if (!canEdit) {
      setSelectedItemId(null);
      return;
    }

    if (activeTool === 'select') {
      setSelectedItemId(null);
      setEditingTextNoteId(null);
      return;
    }

    if (activeTool === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setActiveDrawingPoints([coords]);
      return;
    }

    if (activeTool === 'text') {
      const newNote: BoardTextNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        text: 'Taktischer Callout...',
        x: coords.x,
        y: coords.y,
        accentColor: activeColor,
      };
      updateCurrentPage((page) => ({
        ...page,
        textNotes: [...page.textNotes, newNote],
      }));
      setSelectedItemId(newNote.id);
      setEditingTextNoteId(newNote.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'circle') {
      const newZone: BoardZoneShape = {
        id: `zone-circle-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'circle',
        x: coords.x,
        y: coords.y,
        radius: 7.5,
        color: activeColor,
      };
      updateCurrentPage((page) => ({
        ...page,
        zones: [...page.zones, newZone],
      }));
      setSelectedItemId(newZone.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'rect') {
      const newZone: BoardZoneShape = {
        id: `zone-rect-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'rect',
        x: clampPct(coords.x - 6),
        y: clampPct(coords.y - 4),
        x2: clampPct(coords.x + 6),
        y2: clampPct(coords.y + 4),
        color: activeColor,
      };
      updateCurrentPage((page) => ({
        ...page,
        zones: [...page.zones, newZone],
      }));
      setSelectedItemId(newZone.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'tripwire') {
      const newZone: BoardZoneShape = {
        id: `zone-wire-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'tripwire',
        x: clampPct(coords.x - 4),
        y: clampPct(coords.y - 2),
        x2: clampPct(coords.x + 4),
        y2: clampPct(coords.y + 2),
        color: '#38BDF8',
      };
      updateCurrentPage((page) => ({
        ...page,
        zones: [...page.zones, newZone],
      }));
      setSelectedItemId(newZone.id);
      setActiveTool('select');
      return;
    }

    if (activeTool === 'vision') {
      const newZone: BoardZoneShape = {
        id: `zone-vision-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        type: 'vision',
        x: coords.x,
        y: coords.y,
        x2: clampPct(coords.x + 12),
        y2: clampPct(coords.y - 12),
        color: '#10B981',
      };
      updateCurrentPage((page) => ({
        ...page,
        zones: [...page.zones, newZone],
      }));
      setSelectedItemId(newZone.id);
      setActiveTool('select');
      return;
    }
  };

  // Pointer Move on the 2D Map Canvas (handles dragging tokens, handles, and drawing paths)
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const coords = getBoardCoords(e.clientX, e.clientY);
    if (!coords) return;

    broadcastCursorMove(coords.x, coords.y);

    if (!canEdit) return;

    // 1. Drawing path in progress
    if (activeDrawingPoints && activeDrawingPoints.length > 0) {
      const lastPt = activeDrawingPoints[activeDrawingPoints.length - 1];
      if (Math.hypot(coords.x - lastPt.x, coords.y - lastPt.y) > 0.9) {
        setActiveDrawingPoints((prev) => (prev ? [...prev, coords] : null));
      }
      return;
    }

    // 2. Dragging an item or handle
    if (!draggingState) return;

    // Check if pointer is hovering over the top-right Trash Dropzone (x > 91%, y < 12%)
    const overTrash = coords.x >= 90 && coords.y <= 12;
    setIsTrashHovered(overTrash);

    updateCurrentPage((page) => {
      if (draggingState.kind === 'agent') {
        return {
          ...page,
          agentTokens: page.agentTokens.map((t) =>
            t.id === draggingState.id ? { ...t, x: coords.x, y: coords.y } : t
          ),
        };
      }

      if (draggingState.kind === 'agent-vision-handle') {
        return {
          ...page,
          agentTokens: page.agentTokens.map((t) => {
            if (t.id !== draggingState.id) return t;
            const dx = coords.x - t.x;
            const dy = coords.y - t.y;
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            const dist = Math.max(5, Math.min(45, Math.hypot(dx, dy)));
            return {
              ...t,
              hasVisionCone: true,
              visionAngle: Number(angleDeg.toFixed(1)),
              visionLength: Number(dist.toFixed(1)),
            };
          }),
        };
      }

      if (draggingState.kind === 'ability') {
        return {
          ...page,
          abilityTokens: page.abilityTokens.map((t) =>
            t.id === draggingState.id ? { ...t, x: coords.x, y: coords.y } : t
          ),
        };
      }

      if (draggingState.kind === 'text') {
        return {
          ...page,
          textNotes: page.textNotes.map((n) =>
            n.id === draggingState.id ? { ...n, x: coords.x, y: coords.y } : n
          ),
        };
      }

      if (draggingState.kind === 'image') {
        return {
          ...page,
          images: page.images.map((img) =>
            img.id === draggingState.id ? { ...img, x: coords.x, y: coords.y } : img
          ),
        };
      }

      if (draggingState.kind === 'zone-move') {
        return {
          ...page,
          zones: page.zones.map((z) => {
            if (z.id !== draggingState.id) return z;
            const dx = coords.x - z.x;
            const dy = coords.y - z.y;
            return {
              ...z,
              x: coords.x,
              y: coords.y,
              x2: z.x2 !== undefined ? clampPct(z.x2 + dx) : undefined,
              y2: z.y2 !== undefined ? clampPct(z.y2 + dy) : undefined,
            };
          }),
        };
      }

      if (draggingState.kind === 'zone-handle') {
        return {
          ...page,
          zones: page.zones.map((z) => {
            if (z.id !== draggingState.id) return z;
            if (z.type === 'circle') {
              const dist = Math.max(2.5, Math.min(32, Math.hypot(coords.x - z.x, coords.y - z.y)));
              return { ...z, radius: Number(dist.toFixed(1)) };
            }
            return {
              ...z,
              x2: coords.x,
              y2: coords.y,
            };
          }),
        };
      }

      return page;
    }, false);
  };

  // Pointer Up on the 2D Map Canvas
  const handleCanvasPointerUp = () => {
    if (activeDrawingPoints && activeDrawingPoints.length > 1) {
      const newPath: BoardDrawingPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        points: activeDrawingPoints,
        color: activeColor,
        dashed: drawDashed,
        hasArrowHead: drawWithArrowHead,
        strokeWidth: 0.55,
      };
      updateCurrentPage((page) => ({
        ...page,
        drawings: [...page.drawings, newPath],
      }));
    }
    setActiveDrawingPoints(null);

    if (draggingState) {
      if (isTrashHovered) {
        deleteItemFromBoard(draggingState.id);
        showToast('Element vom Taktik-Board entfernt.');
      }
      setDraggingState(null);
      setIsTrashHovered(false);
    }
  };

  // Upload an Image Overlay onto the 2D Board (like the lineup preview in the top-left of the Ascent screenshot)
  const handleBoardImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const newImg: BoardImageOverlay = {
          id: `img-${Date.now()}`,
          dataUrl: reader.result,
          x: 15,
          y: 22,
          width: 24,
          label: file.name.replace(/\.[^/.]+$/, ''),
        };
        updateCurrentPage((page) => ({
          ...page,
          images: [...page.images, newImg],
        }));
        setSelectedItemId(newImg.id);
        setActiveTool('select');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Export the 2D Map Board as a high-res PNG image using native HTML5 Canvas
  const handleExportBoardPng = async () => {
    try {
      const size = 1400;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Dotted Dark Background
      ctx.fillStyle = '#0B0C0E';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      for (let gx = 16; gx < size; gx += 28) {
        for (let gy = 16; gy < size; gy += 28) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const loadImg = (src: string): Promise<HTMLImageElement | null> =>
        new Promise((resolve) => {
          if (!src) return resolve(null);
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => resolve(im);
          im.onerror = () => resolve(null);
          im.src = src;
        });

      // 2. Draw 2D Radar Map
      const radarImg = await loadImg(
        currentMapAsset.displayIcon || currentMapAsset.splash
      );
      if (radarImg) {
        ctx.save();
        if (radarTintMode === 'VALOPLANT') {
          ctx.filter =
            'sepia(0.82) hue-rotate(342deg) saturate(1.75) brightness(0.95) contrast(1.15)';
        }
        if (rotateMap180) {
          ctx.translate(size / 2, size / 2);
          ctx.rotate(Math.PI);
          ctx.translate(-size / 2, -size / 2);
        }
        const pad = 42;
        ctx.drawImage(radarImg, pad, pad, size - pad * 2, size - pad * 2);
        ctx.restore();
      }

      // 3. Draw Vision Cones from Agents
      for (const tok of currentPage.agentTokens) {
        if (!tok.hasVisionCone) continue;
        const cx = (tok.x / 100) * size;
        const cy = (tok.y / 100) * size;
        const rad = ((tok.visionLength ?? 18) / 100) * size;
        const angle = ((tok.visionAngle ?? -90) * Math.PI) / 180;
        const spread = (32 * Math.PI) / 180;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rad, angle - spread, angle + spread);
        ctx.closePath();
        ctx.fillStyle =
          tok.side === 'ally'
            ? 'rgba(16, 185, 129, 0.28)'
            : 'rgba(239, 68, 68, 0.28)';
        ctx.fill();
        ctx.strokeStyle = tok.side === 'ally' ? '#10B981' : '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
      }

      // 4. Draw Zones & Tripwires
      for (const z of currentPage.zones) {
        const zx = (z.x / 100) * size;
        const zy = (z.y / 100) * size;
        ctx.save();
        if (z.type === 'circle') {
          const r = ((z.radius || 7) / 100) * size;
          ctx.beginPath();
          ctx.arc(zx, zy, r, 0, Math.PI * 2);
          ctx.fillStyle = `${z.color}38`;
          ctx.fill();
          ctx.strokeStyle = z.color;
          ctx.lineWidth = 3.5;
          ctx.stroke();
        } else if (z.type === 'rect') {
          const x2 = ((z.x2 ?? z.x + 10) / 100) * size;
          const y2 = ((z.y2 ?? z.y + 8) / 100) * size;
          ctx.fillStyle = `${z.color}33`;
          ctx.strokeStyle = z.color;
          ctx.lineWidth = 3.5;
          ctx.fillRect(
            Math.min(zx, x2),
            Math.min(zy, y2),
            Math.abs(x2 - zx),
            Math.abs(y2 - zy)
          );
          ctx.strokeRect(
            Math.min(zx, x2),
            Math.min(zy, y2),
            Math.abs(x2 - zx),
            Math.abs(y2 - zy)
          );
        } else if (z.type === 'tripwire') {
          const x2 = ((z.x2 ?? z.x + 8) / 100) * size;
          const y2 = ((z.y2 ?? z.y) / 100) * size;
          ctx.strokeStyle = z.color || '#38BDF8';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(zx, zy);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(zx - 6, zy - 6, 12, 12);
          ctx.fillRect(x2 - 6, y2 - 6, 12, 12);
        }
        ctx.restore();
      }

      // 5. Draw Arrows & Paths
      for (const d of currentPage.drawings) {
        if (d.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = d.color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (d.dashed) {
          ctx.setLineDash([14, 10]);
        }
        ctx.beginPath();
        d.points.forEach((pt, idx) => {
          const px = (pt.x / 100) * size;
          const py = (pt.y / 100) * size;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.restore();
      }

      // 6. Draw Agent Tokens
      for (const tok of currentPage.agentTokens) {
        const agent = getAgentByIdOrName(tok.agentId);
        if (!agent) continue;
        const ax = (tok.x / 100) * size;
        const ay = (tok.y / 100) * size;
        const r = 26;
        const agImg = await loadImg(agent.displayIcon);

        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, Math.PI * 2);
        ctx.fillStyle = '#0F131A';
        ctx.fill();
        ctx.clip();
        if (agImg) {
          ctx.drawImage(agImg, ax - r, ay - r, r * 2, r * 2);
        }
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, Math.PI * 2);
        ctx.strokeStyle = tok.side === 'ally' ? '#10B981' : '#EF4444';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
      }

      // 7. Draw Text Callout Notes
      for (const note of currentPage.textNotes) {
        const nx = (note.x / 100) * size;
        const ny = (note.y / 100) * size;
        ctx.save();
        ctx.font = 'bold 18px sans-serif';
        const tw = ctx.measureText(note.text).width + 28;
        const th = 36;
        ctx.fillStyle = 'rgba(20, 23, 31, 0.94)';
        ctx.fillRect(nx - tw / 2, ny - th / 2, tw, th);
        ctx.fillStyle = note.accentColor || '#F59E0B';
        ctx.fillRect(nx - tw / 2, ny - th / 2, 5, th);
        ctx.fillStyle = '#F2EDE4';
        ctx.fillText(note.text, nx - tw / 2 + 14, ny + 6);
        ctx.restore();
      }

      // 8. Header Watermark
      ctx.fillStyle = '#C8A273';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(
        `BIGBLACKTEA (BBT) • ${currentMapAsset.name.toUpperCase()} (${formSide.toUpperCase()}) — ${
          formName || currentPage.name
        }`,
        32,
        40
      );

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const cleanName = (formName || `${currentMapAsset.name}-${formSide}`)
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      link.download = `bbt-taktik-${cleanName}-page-${activePageIndex + 1}.png`;
      link.href = dataUrl;
      link.click();
      showToast('2D Taktik-Board als PNG exportiert!');
    } catch {
      showToast('PNG-Export fehlgeschlagen.');
    }
  };

  // Save Strategy to Database
  const handleSaveStrategySubmit = async () => {
    const finalName =
      formName.trim() || `${currentMapAsset.name.toUpperCase()} ${formSite} ${formType.toUpperCase()}`;
    setSaving(true);
    try {
      await onSaveStrategy({
        id: editingId || undefined,
        mapId: formMapId,
        name: finalName,
        subtitle: formSubtitle.trim(),
        side: formSide,
        site: formSite,
        type: formType,
        assignments: formAssignments,
        steps: formSteps.filter(
          (s) => s.phase.trim().length > 0 || s.description.trim().length > 0
        ),
        notes: formNotes.trim(),
        tacticalImage: formTacticalImage,
        boardPages,
      });
      if (!formName.trim()) {
        setFormName(finalName);
      }
      showToast(`Strategie „${finalName}“ dauerhaft gespeichert!`);
    } finally {
      setSaving(false);
    }
  };

  // Duplicate Strategy
  const handleDuplicateCurrentStrategy = async () => {
    if (!canEdit) return;
    const baseName =
      formName.trim() || `${currentMapAsset.name.toUpperCase()} ${formSite}`;
    setSaving(true);
    try {
      await onSaveStrategy({
        mapId: formMapId,
        name: `${baseName} (Kopie)`,
        subtitle: formSubtitle,
        side: formSide,
        site: formSite,
        type: formType,
        assignments: formAssignments,
        steps: formSteps,
        notes: formNotes,
        tacticalImage: formTacticalImage,
        boardPages: structuredClone(boardPages),
      });
      showToast(`Kopie von „${baseName}“ erstellt!`);
    } finally {
      setSaving(false);
    }
  };

  // Agents shown in Right Sidebar
  const onMapAgentIds = useMemo(
    () => new Set(currentPage.agentTokens.map((t) => t.agentId.toLowerCase())),
    [currentPage.agentTokens]
  );

  const filteredSidebarAgents = useMemo(() => {
    return VALORANT_AGENTS_LIST.filter((agent) => {
      if (agentFilterTab === 'ON_MAP' && !onMapAgentIds.has(agent.id.toLowerCase())) {
        return false;
      }
      if (agentFilterTab === 'ROLE' && agentRoleFilter !== 'ALL') {
        return agent.role === agentRoleFilter;
      }
      return true;
    });
  }, [agentFilterTab, agentRoleFilter, onMapAgentIds]);

  const selectedSidebarAgent: ValorantAgentAsset = useMemo(
    () =>
      getAgentByIdOrName(selectedSidebarAgentId) ||
      VALORANT_AGENTS_LIST.find((a) => a.id === 'sova') ||
      VALORANT_AGENTS_LIST[0],
    [selectedSidebarAgentId]
  );

  // Filtered Strategies for Library & Switcher
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      if (filterMap !== 'ALL' && s.mapId.toLowerCase() !== filterMap.toLowerCase()) {
        return false;
      }
      if (filterSide !== 'ALL' && s.side !== filterSide) return false;
      if (filterSite !== 'ALL' && s.site !== filterSite) return false;
      if (filterType !== 'ALL' && s.type !== filterType) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inName = s.name.toLowerCase().includes(q);
        const inNotes = s.notes.toLowerCase().includes(q);
        if (!inName && !inNotes) return false;
      }
      return true;
    });
  }, [strategies, filterMap, filterSide, filterSite, filterType, searchQuery]);

  // Currently selected Agent Token on the map (for quick inspector bar)
  const selectedAgentToken = useMemo(
    () => currentPage.agentTokens.find((t) => t.id === selectedItemId) || null,
    [currentPage.agentTokens, selectedItemId]
  );

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-[#73FBD3]/50 bg-[#0F141A]/95 px-4 py-3 text-xs font-bold text-[#73FBD3] shadow-2xl backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#73FBD3]" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* LIVE COLLABORATION STATUS & ONLINE BBT TEAMMATES BAR                  */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#1E332B] bg-gradient-to-r from-[#0C1513] via-[#0F1319] to-[#131015] px-4 py-2.5 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[#10B981]/40 bg-[#10B981]/15 px-3 py-1">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                liveSyncEnabled && liveConnected
                  ? 'animate-pulse bg-[#10B981] shadow-[0_0_8px_#10B981]'
                  : 'bg-[#8C837A]'
              }`}
            />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#73FBD3]">
              {liveSyncEnabled
                ? liveConnected
                  ? 'Live-Ansicht aktiv (Echtzeit-Sync)'
                  : 'Verbinde Live-Sync...'
                : 'Live-Sync pausiert'}
            </span>
          </div>

          <span className="text-xs text-[#9E9589]">
            Jede Änderung auf der Map (Agents ziehen, Pfeile, Smokes, Notizen) ist sofort für alle Teammitglieder sichtbar.
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Teammates in Tactical Room */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8A273]">
              Im Taktik-Raum ({ Math.max(1, liveParticipants.length) }):
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {liveParticipants.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2B1B20] bg-[#161922] px-2.5 py-1 text-[11px] font-bold text-[#F2EDE4]">
                  <span className="h-2 w-2 rounded-full bg-[#73FBD3]" />
                  {currentDisplayName} (Du)
                </span>
              ) : (
                liveParticipants.map((p) => {
                  const isMe = p.clientId === clientId;
                  return (
                    <span
                      key={p.clientId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2E3B] bg-[#161922] px-2.5 py-1 text-[11px] font-bold text-[#F2EDE4]"
                      title={`Aktiv auf Page ${(p.activePageIndex || 0) + 1}`}
                    >
                      <span
                        style={{ backgroundColor: p.color || '#73FBD3' }}
                        className="h-2 w-2 rounded-full"
                      />
                      <span>
                        {p.displayName}
                        {isMe ? ' (Du)' : ''}
                      </span>
                    </span>
                  );
                })
              )}
            </div>
          </div>

          {lastLiveEditor && (
            <span className="hidden rounded-lg bg-[#161922] px-2.5 py-1 text-[11px] text-[#8C837A] xl:inline-block">
              Zuletzt geändert von{' '}
              <strong className="text-[#F2EDE4]">{lastLiveEditor}</strong>
              {lastLiveUpdatedAt
                ? ` (${new Date(lastLiveUpdatedAt).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })})`
                : ''}
            </span>
          )}

          <button
            type="button"
            onClick={() => setLiveSyncEnabled((v) => !v)}
            className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase transition ${
              liveSyncEnabled
                ? 'border-[#10B981]/50 bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20'
                : 'border-[#2B1B20] bg-[#161922] text-[#8C837A] hover:text-white'
            }`}
          >
            {liveSyncEnabled ? '⚡ Live Ein' : '⏸ Live Aus'}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TOP BAR (Matches ValoPlant screenshots + BBT Strategy Controls)       */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#26161B] bg-[#0D0E12] px-4 py-3 shadow-xl">
        {/* Left: Map Selector Pill + Attack/Defense Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Map Selector Button with Splash Image */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowMapDropdown((v) => !v);
                setShowStrategyDropdown(false);
              }}
              className="group relative flex h-11 min-w-[165px] items-center justify-between overflow-hidden rounded-xl border border-[#382026] bg-[#14161D] px-4 text-left shadow-md transition hover:border-[#E63946]"
            >
              <img
                src={currentMapAsset.listViewIcon || currentMapAsset.splash}
                alt={currentMapAsset.name}
                className="absolute inset-0 h-full w-full object-cover opacity-45 transition duration-300 group-hover:scale-105 group-hover:opacity-60"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0B0C0E]/90 via-[#0B0C0E]/60 to-transparent" />
              <div className="relative z-10 flex items-center gap-2">
                <span className="font-display text-base font-black uppercase tracking-wider text-white drop-shadow">
                  {currentMapAsset.name}
                </span>
              </div>
              <span className="relative z-10 ml-3 text-xs text-[#C8A273]">▾</span>
            </button>

            {/* Map Grid Dropdown */}
            {showMapDropdown && (
              <div className="absolute left-0 top-13 z-50 w-[340px] rounded-2xl border border-[#382026] bg-[#0E1015] p-3 shadow-2xl sm:w-[420px]">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A273]">
                    VALORANT Map wählen (2D Taktik-Radar)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMapDropdown(false)}
                    className="text-xs text-[#8C837A] hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {VALORANT_MAPS_LIST.map((m) => {
                    const active = m.id === formMapId;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setFormMapId(m.id);
                          if (!m.availableSites.includes(formSite)) {
                            setFormSite(m.availableSites[0] || 'A');
                          }
                          setShowMapDropdown(false);
                        }}
                        className={`group relative h-16 overflow-hidden rounded-xl border text-left transition ${
                          active
                            ? 'border-[#E63946] ring-2 ring-[#E63946]/30'
                            : 'border-[#25171B] hover:border-[#C8A273]/50'
                        }`}
                      >
                        <img
                          src={m.listViewIcon || m.splash}
                          alt={m.name}
                          className="h-full w-full object-cover opacity-55 transition group-hover:scale-105 group-hover:opacity-75"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
                        <div className="absolute bottom-1.5 left-2.5 right-2 flex items-center justify-between">
                          <span className="font-display text-xs font-extrabold uppercase tracking-wider text-white">
                            {m.name}
                          </span>
                          {active && (
                            <span className="h-2 w-2 rounded-full bg-[#73FBD3]" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Attack / Defense Toggle Button (Matches Screenshot Sword/Shield Pill) */}
          <button
            type="button"
            onClick={() =>
              canEdit &&
              setFormSide((prev) =>
                prev === 'Angriff' ? 'Verteidigung' : 'Angriff'
              )
            }
            className={`flex h-11 items-center gap-2.5 rounded-xl border px-4 text-xs font-extrabold uppercase tracking-wider transition ${
              formSide === 'Angriff'
                ? 'border-[#E63946]/50 bg-[#1B1215] text-[#F2EDE4] hover:border-[#E63946]'
                : 'border-[#73FBD3]/50 bg-[#101C1B] text-[#73FBD3] hover:border-[#73FBD3]'
            }`}
            title="Klicken zum Wechseln zwischen Attack (Angriff) und Defense (Verteidigung)"
          >
            <span className="text-sm">
              {formSide === 'Angriff' ? '⚔️' : '🛡️'}
            </span>
            <span>{formSide === 'Angriff' ? 'Attack' : 'Defense'}</span>
          </button>

          {/* Site Selector Pills (A / B / C / Mid) */}
          <div className="hidden items-center gap-1 rounded-xl border border-[#23181C] bg-[#13151B] p-1 lg:flex">
            {currentMapAsset.availableSites.map((siteOption) => (
              <button
                key={siteOption}
                type="button"
                onClick={() => canEdit && setFormSite(siteOption)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wider transition ${
                  formSite === siteOption
                    ? 'bg-[#E63946] text-white shadow'
                    : 'text-[#8C837A] hover:text-white'
                }`}
              >
                {siteOption === 'Global' || siteOption === 'Mid'
                  ? siteOption
                  : `${siteOption}-Site`}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Strategy Name Input & Saved Strategy Dropdown (like "B Push ▾" in screenshot) */}
        <div className="flex flex-1 flex-wrap items-center justify-center gap-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={formName}
              disabled={!canEdit}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={`Strategiename (z. B. ${currentMapAsset.name.toUpperCase()} ${formSite} PUSH)`}
              className="h-11 w-56 rounded-l-xl border border-[#2B1B20] bg-[#14171E] px-3.5 text-xs font-bold text-[#F2EDE4] placeholder-[#6E675F] focus:border-[#E63946] focus:outline-none sm:w-64"
            />
            <button
              type="button"
              onClick={() => {
                setShowStrategyDropdown((v) => !v);
                setShowMapDropdown(false);
              }}
              className="flex h-11 items-center gap-1.5 rounded-r-xl border border-l-0 border-[#2B1B20] bg-[#191C24] px-3 text-xs font-bold text-[#C8A273] transition hover:bg-[#222631] hover:text-white"
              title="Gespeicherte Strategien öffnen oder neue Strategie anlegen"
            >
              <span>▾</span>
              <span className="rounded bg-[#26181D] px-1.5 py-0.5 text-[10px] text-[#F2EDE4]">
                {strategies.length}
              </span>
            </button>

            {/* Strategy Switcher Dropdown */}
            {showStrategyDropdown && (
              <div className="absolute left-0 top-12 z-50 w-80 rounded-2xl border border-[#382026] bg-[#0F1117] p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#C8A273]">
                    Gespeicherte Map-Strategien ({strategies.length})
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        startNewStrategy(formMapId);
                        setShowStrategyDropdown(false);
                      }}
                      className="rounded-lg bg-[#E63946]/20 px-2 py-1 text-[10px] font-bold uppercase text-[#E63946] hover:bg-[#E63946] hover:text-white"
                    >
                      + Neu / Leer
                    </button>
                  )}
                </div>

                {strategies.length === 0 ? (
                  <p className="py-4 text-center text-xs text-[#8C837A]">
                    Noch keine Strategien gespeichert. Ziehe Agents auf die Map und klicke auf „Speichern“.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {strategies.map((s) => {
                      const mapObj = getMapByIdOrName(s.mapId);
                      const isCurrent = s.id === editingId;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            loadStrategyIntoWorkspace(s);
                            setShowStrategyDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                            isCurrent
                              ? 'border-[#73FBD3]/60 bg-[#73FBD3]/10'
                              : 'border-[#23181C] bg-[#14171F] hover:border-[#C8A273]/40'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-[#F2EDE4]">
                              {s.name}
                            </div>
                            <div className="text-[10px] text-[#8C837A]">
                              {mapObj?.name || s.mapId} • {s.side} • Site {s.site} • {s.type}
                            </div>
                          </div>
                          {isCurrent && (
                            <span className="text-[10px] font-bold uppercase text-[#73FBD3]">
                              Aktiv
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Strategy Type Dropdown */}
          <select
            value={formType}
            disabled={!canEdit}
            onChange={(e) => setFormType(e.target.value as StrategyType)}
            className="h-11 rounded-xl border border-[#2B1B20] bg-[#14171E] px-3 text-xs font-bold text-[#C8A273] focus:border-[#E63946] focus:outline-none"
          >
            {STRATEGY_TYPES.map((t) => (
              <option key={t} value={t}>
                Typ: {t}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Mode Toggle + Details Drawer + Save Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStrategyDetailsDrawer((v) => !v)}
            className={`h-11 rounded-xl border px-3.5 text-xs font-bold uppercase tracking-wider transition ${
              showStrategyDetailsDrawer
                ? 'border-[#C8A273] bg-[#C8A273]/15 text-[#F2EDE4]'
                : 'border-[#2B1B20] bg-[#14171E] text-[#C8A273] hover:border-[#C8A273]/50 hover:text-white'
            }`}
          >
            📋 Ablaufschritte & Kader
          </button>

          <button
            type="button"
            onClick={() =>
              setWorkspaceMode((m) => (m === 'BOARD' ? 'LIBRARY' : 'BOARD'))
            }
            className={`h-11 rounded-xl border px-3.5 text-xs font-bold uppercase tracking-wider transition ${
              workspaceMode === 'LIBRARY'
                ? 'border-[#73FBD3] bg-[#73FBD3]/15 text-[#73FBD3]'
                : 'border-[#2B1B20] bg-[#14171E] text-[#9E9589] hover:text-white'
            }`}
          >
            {workspaceMode === 'BOARD'
              ? `📚 Alle Strategien (${strategies.length})`
              : '🗺️ Zurück zum 2D Map-Board'}
          </button>

          {canEdit && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveStrategySubmit}
              className="flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#8B1A25] to-[#E63946] px-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg shadow-[#E63946]/25 transition hover:brightness-110 disabled:opacity-50"
            >
              <span>💾</span>
              <span>{saving ? 'Speichert...' : 'Strategie speichern'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* COLLAPSIBLE DRAWER: BBT PLAYER ASSIGNMENTS, TACTICAL STEPS & NOTES    */}
      {/* ===================================================================== */}
      {showStrategyDetailsDrawer && (
        <div className="rounded-2xl border border-[#382026] bg-[#101218] p-5 shadow-2xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#25171B] pb-3">
            <div>
              <h3 className="font-display text-base font-extrabold uppercase tracking-wider text-[#F2EDE4]">
                Taktische Details, BBT-Spielerzuweisung & Ablaufschritte
              </h3>
              <p className="text-xs text-[#8C837A]">
                Ally-Agents auf dem 2D-Board werden automatisch mit den 5 BBT-Spielerslots synchronisiert.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && editingId && (
                <button
                  type="button"
                  onClick={handleDuplicateCurrentStrategy}
                  className="rounded-lg border border-[#C8A273]/40 bg-[#C8A273]/10 px-3 py-1.5 text-xs font-bold text-[#C8A273] hover:bg-[#C8A273]/20"
                >
                  Strategie duplizieren
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowStrategyDetailsDrawer(false)}
                className="rounded-lg border border-[#2B1B20] bg-[#161922] px-3 py-1.5 text-xs font-bold text-[#9E9589] hover:text-white"
              >
                Schließen ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 6 cols: 5 Assigned BBT Players & Agents */}
            <div className="space-y-3 lg:col-span-6">
              <div className="text-xs font-bold uppercase tracking-wider text-[#C8A273]">
                Zugewiesene BBT-Spieler & Agents (5er Kader)
              </div>
              <div className="space-y-2">
                {formAssignments.map((slot, idx) => {
                  const agent = getAgentByIdOrName(slot.agentId);
                  return (
                    <div
                      key={slot.slotIndex}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-[#23171B] bg-[#151821] p-2.5 sm:grid-cols-12 sm:items-center"
                    >
                      <div className="sm:col-span-4">
                        <select
                          value={slot.playerId || ''}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const val = e.target.value || null;
                            setFormAssignments((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, playerId: val } : item
                              )
                            );
                          }}
                          className="w-full rounded-lg border border-[#2B1B20] bg-[#0E1015] px-2.5 py-1.5 text-xs font-bold text-[#F2EDE4]"
                        >
                          <option value="">— Spieler wählen —</option>
                          {players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} #{p.tag}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setPickerSlotIndex(idx)}
                          className="flex w-full items-center gap-2 rounded-lg border border-[#2B1B20] bg-[#0E1015] px-2.5 py-1 text-left text-xs transition hover:border-[#E63946]"
                        >
                          {agent ? (
                            <>
                              <img
                                src={agent.displayIcon}
                                alt={agent.name}
                                className="h-6 w-6 rounded object-cover"
                              />
                              <span className="truncate font-bold text-[#F2EDE4]">
                                {agent.name}
                              </span>
                            </>
                          ) : (
                            <span className="py-0.5 text-[#8C837A]">+ Agent wählen</span>
                          )}
                        </button>
                      </div>

                      <div className="sm:col-span-4">
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={slot.callsignOrTask}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormAssignments((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, callsignOrTask: val } : item
                              )
                            );
                          }}
                          placeholder="Aufgabe (z. B. Smoke CT)"
                          className="w-full rounded-lg border border-[#2B1B20] bg-[#0E1015] px-2.5 py-1.5 text-xs text-[#F2EDE4] placeholder-[#6E675F]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 6 cols: Step-by-step tactical description & free notes */}
            <div className="space-y-4 lg:col-span-6">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C8A273]">
                    Schrittweise taktische Beschreibung
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormSteps((prev) => [
                          ...prev,
                          {
                            id: `step-${Date.now()}-${prev.length + 1}`,
                            phase: `Phase ${prev.length + 1}`,
                            timing: '1:00',
                            description: '',
                          },
                        ])
                      }
                      className="rounded-lg bg-[#E63946]/15 px-2.5 py-1 text-[11px] font-bold text-[#E63946] hover:bg-[#E63946] hover:text-white"
                    >
                      + Schritt hinzufügen
                    </button>
                  )}
                </div>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {formSteps.map((step, sIdx) => (
                    <div
                      key={step.id}
                      className="flex items-start gap-2 rounded-xl border border-[#23171B] bg-[#151821] p-2.5"
                    >
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E63946]/20 text-[10px] font-black text-[#E63946]">
                        {sIdx + 1}
                      </span>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={step.phase}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormSteps((prev) =>
                                prev.map((st, i) =>
                                  i === sIdx ? { ...st, phase: val } : st
                                )
                              );
                            }}
                            placeholder="Phase (z. B. Pre-Round / Entry)"
                            className="w-2/3 rounded border border-[#2B1B20] bg-[#0E1015] px-2 py-1 text-xs font-bold text-[#F2EDE4]"
                          />
                          <input
                            type="text"
                            disabled={!canEdit}
                            value={step.timing}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormSteps((prev) =>
                                prev.map((st, i) =>
                                  i === sIdx ? { ...st, timing: val } : st
                                )
                              );
                            }}
                            placeholder="Timing (1:15)"
                            className="w-1/3 rounded border border-[#2B1B20] bg-[#0E1015] px-2 py-1 text-xs text-[#73FBD3]"
                          />
                        </div>
                        <input
                          type="text"
                          disabled={!canEdit}
                          value={step.description}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormSteps((prev) =>
                              prev.map((st, i) =>
                                i === sIdx ? { ...st, description: val } : st
                              )
                            );
                          }}
                          placeholder="Taktischer Ablauf (z. B. Sova Recon Back-Site -> Jett Dash auf Logs)"
                          className="w-full rounded border border-[#2B1B20] bg-[#0E1015] px-2 py-1 text-xs text-[#D6CFC7]"
                        />
                      </div>
                      {canEdit && formSteps.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormSteps((prev) => prev.filter((_, i) => i !== sIdx))
                          }
                          className="text-xs text-[#8C837A] hover:text-[#E63946]"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#C8A273]">
                  Freie taktische Notizen & Win-Conditions
                </label>
                <textarea
                  rows={2}
                  disabled={!canEdit}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Win-Condition, Post-Plant Positionen, Anti-Flash Hinweise..."
                  className="w-full rounded-xl border border-[#2B1B20] bg-[#151821] p-2.5 text-xs text-[#F2EDE4] placeholder-[#6E675F]"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MAIN WORKSPACE: VALOPLANT-STYLE 2D INTERACTIVE MAP BOARD              */}
      {/* ===================================================================== */}
      {workspaceMode === 'BOARD' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* ----------------------------------------------------------------- */}
          {/* CENTER 2D MAP BOARD CANVAS (9 cols on XL)                         */}
          {/* ----------------------------------------------------------------- */}
          <div className="relative flex min-h-[640px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-[#25171B] bg-[#0B0C0E] p-3 shadow-2xl xl:col-span-9">
            {/* Dotted Dark Tactical Grid Background (Matches Screenshot) */}
            <div
              className="pointer-events-none absolute inset-0 opacity-65"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255, 255, 255, 0.14) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}
            />

            {/* Top-Left Floating Action Bar (Settings, Undo, Save, PNG Export) */}
            <div
              data-export-ignore="true"
              className="absolute left-4 top-4 z-30 flex items-center gap-1.5 rounded-xl border border-[#2A2D37] bg-[#151820]/95 p-1.5 shadow-xl backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => setShowBoardSettings((v) => !v)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm transition ${
                  showBoardSettings
                    ? 'bg-[#E63946] text-white'
                    : 'text-[#C8A273] hover:bg-[#222632] hover:text-white'
                }`}
                title="Map-Darstellung & Radar-Einstellungen"
              >
                ⚙️
              </button>
              <button
                type="button"
                disabled={undoStack.length === 0 || !canEdit}
                onClick={handleUndo}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sm text-[#D6CFC7] transition hover:bg-[#222632] hover:text-white disabled:opacity-35"
                title="Rückgängig (Strg+Z)"
              >
                ↺
              </button>
              {canEdit && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveStrategySubmit}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-sm text-[#73FBD3] transition hover:bg-[#222632]"
                  title="Strategie jetzt speichern"
                >
                  💾
                </button>
              )}
              <button
                type="button"
                onClick={handleExportBoardPng}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-sm text-[#F2EDE4] transition hover:bg-[#222632]"
                title="2D Taktik-Map als hochauflösendes PNG herunterladen"
              >
                📷
              </button>
            </div>

            {/* Settings Popover */}
            {showBoardSettings && (
              <div
                data-export-ignore="true"
                className="absolute left-4 top-16 z-40 w-64 space-y-3 rounded-2xl border border-[#382026] bg-[#12151C]/95 p-4 text-xs shadow-2xl backdrop-blur-md"
              >
                <div className="flex items-center justify-between border-b border-[#25171B] pb-2">
                  <span className="font-bold uppercase tracking-wider text-[#C8A273]">
                    Radar-Optionen
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowBoardSettings(false)}
                    className="text-[#8C837A] hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-[#D6CFC7]">ValoPlant Bronze-Radar</span>
                    <input
                      type="checkbox"
                      checked={radarTintMode === 'VALOPLANT'}
                      onChange={(e) =>
                        setRadarTintMode(e.target.checked ? 'VALOPLANT' : 'ORIGINAL')
                      }
                      className="accent-[#E63946]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-[#D6CFC7]">Map Callouts anzeigen</span>
                    <input
                      type="checkbox"
                      checked={showCalloutLabels}
                      onChange={(e) => setShowCalloutLabels(e.target.checked)}
                      className="accent-[#E63946]"
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between">
                    <span className="text-[#D6CFC7]">Map um 180° drehen</span>
                    <input
                      type="checkbox"
                      checked={rotateMap180}
                      onChange={(e) => setRotateMap180(e.target.checked)}
                      className="accent-[#E63946]"
                    />
                  </label>

                  <div className="pt-1">
                    <div className="mb-1 flex justify-between text-[11px] text-[#8C837A]">
                      <span>Map-Zoom</span>
                      <span>{Math.round(mapZoom * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.85}
                      max={1.35}
                      step={0.05}
                      value={mapZoom}
                      onChange={(e) => setMapZoom(Number(e.target.value))}
                      className="w-full accent-[#E63946]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Top-Right Floating Red Trash Dropzone (Matches Screenshot) */}
            <div
              data-export-ignore="true"
              onClick={() => {
                if (selectedItemId) {
                  deleteItemFromBoard(selectedItemId);
                  showToast('Ausgewähltes Element gelöscht.');
                } else {
                  showToast('Ziehe ein Element hierher oder wähle es aus, um es zu löschen.');
                }
              }}
              className={`absolute right-4 top-4 z-30 flex h-12 w-12 cursor-pointer items-center justify-center rounded-xl border-2 transition ${
                isTrashHovered || selectedItemId
                  ? 'scale-105 border-[#EF4444] bg-[#EF4444]/25 text-[#EF4444] shadow-lg shadow-[#EF4444]/30'
                  : 'border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]/80 hover:border-[#EF4444] hover:bg-[#EF4444]/20'
              }`}
              title="Ziehe Agents, Fähigkeiten oder Notizen in den Papierkorb oder klicke zum Löschen"
            >
              <span className="text-lg">🗑️</span>
            </div>

            {/* Selected Agent Inspector Pill (Top Center Floating) */}
            {selectedAgentToken && canEdit && (
              <div
                data-export-ignore="true"
                className="absolute top-4 z-30 flex flex-wrap items-center gap-2 rounded-xl border border-[#382026] bg-[#13161E]/95 px-3 py-1.5 text-xs shadow-2xl backdrop-blur-md"
              >
                <span className="font-bold uppercase tracking-wider text-[#C8A273]">
                  Agent auf Map:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    updateCurrentPage((page) => ({
                      ...page,
                      agentTokens: page.agentTokens.map((t) =>
                        t.id === selectedAgentToken.id
                          ? { ...t, hasVisionCone: !t.hasVisionCone }
                          : t
                      ),
                    }));
                  }}
                  className={`rounded-lg px-2.5 py-1 font-bold transition ${
                    selectedAgentToken.hasVisionCone
                      ? 'bg-[#10B981] text-black'
                      : 'bg-[#1E222D] text-[#D6CFC7] hover:text-white'
                  }`}
                >
                  👁️ Sichtkegel {selectedAgentToken.hasVisionCone ? 'An' : 'Aus'}
                </button>

                <select
                  value={selectedAgentToken.playerId || ''}
                  onChange={(e) => {
                    const pid = e.target.value || null;
                    updateCurrentPage((page) => ({
                      ...page,
                      agentTokens: page.agentTokens.map((t) =>
                        t.id === selectedAgentToken.id ? { ...t, playerId: pid } : t
                      ),
                    }));
                  }}
                  className="rounded-lg border border-[#2B1B20] bg-[#0E1015] px-2 py-1 text-xs font-bold text-[#F2EDE4]"
                >
                  <option value="">— BBT-Spieler zuordnen —</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    updateCurrentPage((page) => ({
                      ...page,
                      agentTokens: page.agentTokens.map((t) =>
                        t.id === selectedAgentToken.id
                          ? { ...t, side: t.side === 'ally' ? 'enemy' : 'ally' }
                          : t
                      ),
                    }));
                  }}
                  className={`rounded-lg px-2 py-1 font-bold uppercase ${
                    selectedAgentToken.side === 'ally'
                      ? 'bg-[#10B981]/20 text-[#10B981]'
                      : 'bg-[#EF4444]/20 text-[#EF4444]'
                  }`}
                >
                  {selectedAgentToken.side === 'ally' ? 'Ally' : 'Enemy'}
                </button>

                <button
                  type="button"
                  onClick={() => deleteItemFromBoard(selectedAgentToken.id)}
                  className="rounded-lg bg-[#EF4444]/20 px-2 py-1 font-bold text-[#EF4444] hover:bg-[#EF4444] hover:text-white"
                >
                  Löschen ✕
                </button>
              </div>
            )}

            {/* =============================================================== */}
            {/* SQUARE INTERACTIVE 2D RADAR CONTAINER                           */}
            {/* =============================================================== */}
            <div
              ref={mapBoardRef}
              onDragOver={handleCanvasDragOver}
              onDrop={handleCanvasDrop}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={() => broadcastCursorMove(null, null)}
              style={{
                transform: `scale(${mapZoom})`,
              }}
              className={`relative aspect-square w-full max-w-[660px] select-none overflow-hidden rounded-2xl transition-transform duration-150 ${
                activeTool === 'draw' ||
                activeTool === 'circle' ||
                activeTool === 'rect' ||
                activeTool === 'tripwire' ||
                activeTool === 'vision'
                  ? 'cursor-crosshair'
                  : activeTool === 'text'
                  ? 'cursor-text'
                  : 'cursor-default'
              }`}
            >
              {/* Top-Down 2D Map Radar Image (Official VALORANT displayIcon) */}
              {currentMapAsset.displayIcon ? (
                <img
                  src={currentMapAsset.displayIcon}
                  alt={`${currentMapAsset.name} 2D Radar`}
                  draggable={false}
                  style={{
                    filter:
                      radarTintMode === 'VALOPLANT'
                        ? 'sepia(0.82) hue-rotate(342deg) saturate(1.75) brightness(0.95) contrast(1.15) drop-shadow(0 12px 28px rgba(0,0,0,0.85))'
                        : 'drop-shadow(0 12px 28px rgba(0,0,0,0.85))',
                    transform: rotateMap180 ? 'rotate(180deg)' : 'none',
                  }}
                  className="pointer-events-none h-full w-full object-contain p-4 transition-transform duration-300"
                />
              ) : (
                <img
                  src={currentMapAsset.splash}
                  alt={currentMapAsset.name}
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover opacity-60"
                />
              )}

              {/* Subtle Watermark Header inside Exported Map */}
              <div className="pointer-events-none absolute left-4 top-3 z-10 flex items-center gap-2 opacity-75">
                <span className="font-display text-xs font-black uppercase tracking-widest text-[#C8A273]">
                  BBT TACTICAL BOARD • {currentMapAsset.name.toUpperCase()} ({formSide.toUpperCase()})
                </span>
                {formName && (
                  <span className="rounded bg-[#E63946]/25 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {formName}
                  </span>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SVG OVERLAY: ZONES, VISION CONES, TRIPWIRES & DRAWN ARROWS    */}
              {/* ------------------------------------------------------------- */}
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="pointer-events-none absolute inset-0 z-10 h-full w-full"
              >
                <defs>
                  {TOOL_COLORS.map((col) => (
                    <marker
                      key={col.id}
                      id={`arrow-${col.hex.replace('#', '')}`}
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1 L 10 5 L 0 9 z" fill={col.hex} />
                    </marker>
                  ))}
                  <radialGradient id="allyVisionGrad" cx="20%" cy="50%" r="85%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.48" />
                    <stop offset="70%" stopColor="#10B981" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.03" />
                  </radialGradient>
                  <radialGradient id="enemyVisionGrad" cx="20%" cy="50%" r="85%">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.48" />
                    <stop offset="70%" stopColor="#EF4444" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0.03" />
                  </radialGradient>
                </defs>

                {/* 1. Agent-Attached Vision Cones */}
                {currentPage.agentTokens
                  .filter((t) => t.hasVisionCone)
                  .map((t) => {
                    const angleRad = ((t.visionAngle ?? -90) * Math.PI) / 180;
                    const len = t.visionLength ?? 18;
                    const tx = t.x + len * Math.cos(angleRad);
                    const ty = t.y + len * Math.sin(angleRad);
                    const d = computeVisionConePath(t.x, t.y, tx, ty, 64);
                    const strokeCol = t.side === 'ally' ? '#10B981' : '#EF4444';
                    return (
                      <g key={`vis-${t.id}`}>
                        <path
                          d={d}
                          fill={
                            t.side === 'ally'
                              ? 'url(#allyVisionGrad)'
                              : 'url(#enemyVisionGrad)'
                          }
                          stroke={strokeCol}
                          strokeWidth="0.35"
                          strokeDasharray="1.2 0.8"
                        />
                        <line
                          x1={t.x}
                          y1={t.y}
                          x2={tx}
                          y2={ty}
                          stroke={strokeCol}
                          strokeWidth="0.3"
                          strokeOpacity="0.7"
                        />
                      </g>
                    );
                  })}

                {/* 2. Placed Tactical Zones (Smokes, Rectangles, Tripwires, Standalone Vision Cones) */}
                {currentPage.zones.map((zone) => {
                  const isSelected = selectedItemId === zone.id;
                  if (zone.type === 'circle') {
                    const r = zone.radius || 7;
                    return (
                      <g
                        key={zone.id}
                        className="pointer-events-auto cursor-move"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            deleteItemFromBoard(zone.id);
                            return;
                          }
                          setSelectedItemId(zone.id);
                          setDraggingState({ kind: 'zone-move', id: zone.id });
                        }}
                      >
                        <circle
                          cx={zone.x}
                          cy={zone.y}
                          r={r}
                          fill={zone.color}
                          fillOpacity="0.22"
                          stroke={zone.color}
                          strokeWidth={isSelected ? '0.6' : '0.4'}
                        />
                        <circle
                          cx={zone.x}
                          cy={zone.y}
                          r="0.7"
                          fill="#FFFFFF"
                          fillOpacity="0.85"
                        />
                      </g>
                    );
                  }

                  if (zone.type === 'rect') {
                    const x2 = zone.x2 ?? zone.x + 10;
                    const y2 = zone.y2 ?? zone.y + 8;
                    const rx = Math.min(zone.x, x2);
                    const ry = Math.min(zone.y, y2);
                    const rw = Math.max(1, Math.abs(x2 - zone.x));
                    const rh = Math.max(1, Math.abs(y2 - zone.y));
                    return (
                      <g
                        key={zone.id}
                        className="pointer-events-auto cursor-move"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            deleteItemFromBoard(zone.id);
                            return;
                          }
                          setSelectedItemId(zone.id);
                          setDraggingState({ kind: 'zone-move', id: zone.id });
                        }}
                      >
                        <rect
                          x={rx}
                          y={ry}
                          width={rw}
                          height={rh}
                          rx="0.8"
                          fill={zone.color}
                          fillOpacity="0.20"
                          stroke={zone.color}
                          strokeWidth={isSelected ? '0.6' : '0.4'}
                          strokeDasharray="1.4 0.8"
                        />
                      </g>
                    );
                  }

                  if (zone.type === 'tripwire') {
                    const x2 = zone.x2 ?? zone.x + 8;
                    const y2 = zone.y2 ?? zone.y;
                    return (
                      <g
                        key={zone.id}
                        className="pointer-events-auto cursor-move"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            deleteItemFromBoard(zone.id);
                            return;
                          }
                          setSelectedItemId(zone.id);
                          setDraggingState({ kind: 'zone-move', id: zone.id });
                        }}
                      >
                        <line
                          x1={zone.x}
                          y1={zone.y}
                          x2={x2}
                          y2={y2}
                          stroke={zone.color || '#38BDF8'}
                          strokeWidth="0.65"
                        />
                        <rect
                          x={zone.x - 0.9}
                          y={zone.y - 0.9}
                          width="1.8"
                          height="1.8"
                          fill="#FFFFFF"
                          stroke="#0B0C0E"
                          strokeWidth="0.25"
                        />
                        <rect
                          x={x2 - 0.9}
                          y={y2 - 0.9}
                          width="1.8"
                          height="1.8"
                          fill="#FFFFFF"
                          stroke="#0B0C0E"
                          strokeWidth="0.25"
                        />
                      </g>
                    );
                  }

                  if (zone.type === 'vision') {
                    const x2 = zone.x2 ?? zone.x + 12;
                    const y2 = zone.y2 ?? zone.y - 12;
                    const d = computeVisionConePath(zone.x, zone.y, x2, y2, 62);
                    return (
                      <g
                        key={zone.id}
                        className="pointer-events-auto cursor-move"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'eraser') {
                            deleteItemFromBoard(zone.id);
                            return;
                          }
                          setSelectedItemId(zone.id);
                          setDraggingState({ kind: 'zone-move', id: zone.id });
                        }}
                      >
                        <path
                          d={d}
                          fill="url(#allyVisionGrad)"
                          stroke={zone.color || '#10B981'}
                          strokeWidth="0.4"
                        />
                      </g>
                    );
                  }

                  return null;
                })}

                {/* 3. Ability Radius Rings */}
                {currentPage.abilityTokens
                  .filter((ab) => ab.radius && ab.radius > 0)
                  .map((ab) => (
                    <circle
                      key={`ab-rad-${ab.id}`}
                      cx={ab.x}
                      cy={ab.y}
                      r={ab.radius}
                      fill={ab.color || '#10B981'}
                      fillOpacity="0.22"
                      stroke={ab.color || '#10B981'}
                      strokeWidth="0.45"
                    />
                  ))}

                {/* 4. Drawn Tactical Arrows & Paths */}
                {currentPage.drawings.map((path) => {
                  if (path.points.length < 2) return null;
                  const pts = path.points.map((p) => `${p.x},${p.y}`).join(' ');
                  const markerId = `arrow-${path.color.replace('#', '')}`;
                  return (
                    <polyline
                      key={path.id}
                      points={pts}
                      fill="none"
                      stroke={path.color}
                      strokeWidth={path.strokeWidth || 0.65}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={path.dashed ? '1.6 1.2' : undefined}
                      markerEnd={
                        path.hasArrowHead !== false ? `url(#${markerId})` : undefined
                      }
                      className="pointer-events-auto cursor-pointer"
                      onPointerDown={(e) => {
                        if (activeTool === 'eraser') {
                          e.stopPropagation();
                          deleteItemFromBoard(path.id);
                        } else if (activeTool === 'select') {
                          e.stopPropagation();
                          setSelectedItemId(path.id);
                        }
                      }}
                    />
                  );
                })}

                {/* Active Drawing Preview */}
                {activeDrawingPoints && activeDrawingPoints.length > 1 && (
                  <polyline
                    points={activeDrawingPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="0.65"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={drawDashed ? '1.6 1.2' : undefined}
                    markerEnd={
                      drawWithArrowHead
                        ? `url(#arrow-${activeColor.replace('#', '')})`
                        : undefined
                    }
                  />
                )}
              </svg>

              {/* ------------------------------------------------------------- */}
              {/* DRAGGABLE ZONE & VISION CONE HANDLES                          */}
              {/* ------------------------------------------------------------- */}
              {canEdit &&
                currentPage.agentTokens
                  .filter((t) => t.hasVisionCone)
                  .map((t) => {
                    const angleRad = ((t.visionAngle ?? -90) * Math.PI) / 180;
                    const len = t.visionLength ?? 18;
                    const tx = clampPct(t.x + len * Math.cos(angleRad));
                    const ty = clampPct(t.y + len * Math.sin(angleRad));
                    return (
                      <div
                        key={`vis-handle-${t.id}`}
                        style={{ left: `${tx}%`, top: `${ty}%` }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(t.id);
                          setDraggingState({
                            kind: 'agent-vision-handle',
                            id: t.id,
                          });
                        }}
                        className=" absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[#0B0C0E] bg-white shadow-md hover:scale-125"
                        title="Ziehen, um den Sichtkegel zu drehen oder zu verlängern"
                      />
                    );
                  })}

              {canEdit &&
                currentPage.zones.map((zone) => {
                  const hx =
                    zone.type === 'circle'
                      ? clampPct(zone.x + (zone.radius || 7))
                      : zone.x2 ?? clampPct(zone.x + 8);
                  const hy =
                    zone.type === 'circle'
                      ? zone.y
                      : zone.y2 ?? clampPct(zone.y + 6);
                  return (
                    <div
                      key={`z-handle-${zone.id}`}
                      style={{ left: `${hx}%`, top: `${hy}%` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelectedItemId(zone.id);
                        setDraggingState({ kind: 'zone-handle', id: zone.id });
                      }}
                      className="absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-[#0B0C0E] bg-white shadow-md hover:scale-125"
                      title="Ziehen zum Skalieren / Ausrichten"
                    />
                  );
                })}

              {/* ------------------------------------------------------------- */}
              {/* DRAGGABLE LINEUP SCREENSHOT / IMAGE OVERLAYS                  */}
              {/* ------------------------------------------------------------- */}
              {currentPage.images.map((img) => {
                const isSelected = selectedItemId === img.id;
                return (
                  <div
                    key={img.id}
                    style={{
                      left: `${img.x}%`,
                      top: `${img.y}%`,
                      width: `${img.width || 24}%`,
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (activeTool === 'eraser') {
                        deleteItemFromBoard(img.id);
                        return;
                      }
                      setSelectedItemId(img.id);
                      if (canEdit) {
                        setDraggingState({ kind: 'image', id: img.id });
                      }
                    }}
                    className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab overflow-hidden rounded-xl border-2 bg-[#0F1117] shadow-2xl ${
                      isSelected ? 'border-[#73FBD3]' : 'border-[#382026]'
                    }`}
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.label || 'Overlay'}
                      draggable={false}
                      className="h-auto w-full object-cover"
                    />
                    {isSelected && canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItemFromBoard(img.id);
                        }}
                        className="absolute right-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-[#EF4444]"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* DRAGGABLE ABILITY TOKENS ON MAP                               */}
              {/* ------------------------------------------------------------- */}
              {currentPage.abilityTokens.map((ab) => {
                const isSelected = selectedItemId === ab.id;
                return (
                  <div
                    key={ab.id}
                    style={{ left: `${ab.x}%`, top: `${ab.y}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (activeTool === 'eraser') {
                        deleteItemFromBoard(ab.id);
                        return;
                      }
                      setSelectedItemId(ab.id);
                      if (canEdit) {
                        setDraggingState({ kind: 'ability', id: ab.id });
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!canEdit) return;
                      updateCurrentPage((page) => ({
                        ...page,
                        abilityTokens: page.abilityTokens.map((item) =>
                          item.id === ab.id
                            ? { ...item, radius: item.radius ? 0 : 6.5 }
                            : item
                        ),
                      }));
                    }}
                    title={`${ab.abilityName} (Doppelklick: Smoke-/Radius-Kreis ein/aus)`}
                    className={`absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-[#11141B]/95 p-1 shadow-lg transition hover:scale-110 active:cursor-grabbing ${
                      ab.side === 'ally'
                        ? 'border-[#10B981]'
                        : 'border-[#EF4444]'
                    } ${isSelected ? 'ring-2 ring-white' : ''}`}
                  >
                    <img
                      src={ab.abilityIcon}
                      alt={ab.abilityName}
                      draggable={false}
                      className="h-full w-full object-contain brightness-125"
                    />
                  </div>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* DRAGGABLE AGENT TOKENS ON MAP (Matches ValoPlant Screenshots) */}
              {/* ------------------------------------------------------------- */}
              {currentPage.agentTokens.map((tok) => {
                const agent = getAgentByIdOrName(tok.agentId);
                if (!agent) return null;
                const assignedPlayer = players.find((p) => p.id === tok.playerId);
                const isSelected = selectedItemId === tok.id;

                return (
                  <div
                    key={tok.id}
                    style={{ left: `${tok.x}%`, top: `${tok.y}%` }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (activeTool === 'eraser') {
                        deleteItemFromBoard(tok.id);
                        return;
                      }
                      if (activeTool === 'vision') {
                        updateCurrentPage((page) => ({
                          ...page,
                          agentTokens: page.agentTokens.map((item) =>
                            item.id === tok.id
                              ? { ...item, hasVisionCone: !item.hasVisionCone }
                              : item
                          ),
                        }));
                        setSelectedItemId(tok.id);
                        setActiveTool('select');
                        return;
                      }
                      setSelectedItemId(tok.id);
                      setSelectedSidebarAgentId(tok.agentId);
                      if (canEdit) {
                        setDraggingState({ kind: 'agent', id: tok.id });
                      }
                    }}
                    className="group absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                  >
                    <div
                      className={`relative h-9 w-9 overflow-hidden rounded-full border-[2.5px] bg-[#0F131A] shadow-xl transition group-hover:scale-110 sm:h-10 sm:w-10 ${
                        tok.side === 'ally'
                          ? 'border-[#10B981] shadow-[#10B981]/25'
                          : 'border-[#EF4444] shadow-[#EF4444]/25'
                      } ${isSelected ? 'ring-2 ring-white' : ''}`}
                    >
                      <img
                        src={agent.displayIcon}
                        alt={agent.name}
                        draggable={false}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    {/* Player / Agent Name Badge under Token */}
                    {assignedPlayer && (
                      <div className="pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap rounded bg-[#0B0C0E]/90 px-1.5 py-0.2 text-[9px] font-extrabold tracking-tight text-[#F2EDE4] shadow">
                        {assignedPlayer.name}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* DRAGGABLE TACTICAL CALLOUT TEXT BOXES ("Early B Main Info")   */}
              {/* ------------------------------------------------------------- */}
              {currentPage.textNotes.map((note) => {
                const isSelected = selectedItemId === note.id;
                const isEditing = editingTextNoteId === note.id;
                return (
                  <div
                    key={note.id}
                    style={{
                      left: `${note.x}%`,
                      top: `${note.y}%`,
                      borderLeftColor: note.accentColor || '#F59E0B',
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (activeTool === 'eraser') {
                        deleteItemFromBoard(note.id);
                        return;
                      }
                      setSelectedItemId(note.id);
                      if (canEdit && !isEditing) {
                        setDraggingState({ kind: 'text', id: note.id });
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (canEdit) {
                        setEditingTextNoteId(note.id);
                      }
                    }}
                    className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-r-lg border border-l-4 border-[#2C313C] bg-[#14171F]/95 px-2.5 py-1.5 shadow-xl backdrop-blur-sm ${
                      isSelected ? 'ring-1 ring-[#73FBD3]' : ''
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={note.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCurrentPage(
                            (page) => ({
                              ...page,
                              textNotes: page.textNotes.map((n) =>
                                n.id === note.id ? { ...n, text: val } : n
                              ),
                            }),
                            false
                          );
                        }}
                        onBlur={() => setEditingTextNoteId(null)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            setEditingTextNoteId(null);
                          }
                        }}
                        className="min-w-[130px] bg-transparent text-xs font-bold text-white focus:outline-none"
                      />
                    ) : (
                      <div className="flex items-center gap-2 whitespace-nowrap text-xs font-bold text-[#F2EDE4]">
                        <span>{note.text}</span>
                        {isSelected && canEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTextNoteId(note.id);
                            }}
                            className="text-[10px] text-[#73FBD3] hover:underline"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ------------------------------------------------------------- */}
              {/* LIVE TEAMMATE CURSORS ON THE 2D MAP                           */}
              {/* ------------------------------------------------------------- */}
              {liveSyncEnabled &&
                liveParticipants
                  .filter(
                    (p) =>
                      p.clientId !== clientId &&
                      typeof p.cursorX === 'number' &&
                      typeof p.cursorY === 'number' &&
                      (p.activePageIndex ?? 0) === activePageIndex
                  )
                  .map((p) => (
                    <div
                      key={`cursor-${p.clientId}`}
                      style={{
                        left: `${p.cursorX}%`,
                        top: `${p.cursorY}%`,
                      }}
                      className="pointer-events-none absolute z-40 transition-all duration-75"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={p.color || '#73FBD3'}
                        className="-translate-x-0.5 -translate-y-0.5 drop-shadow"
                      >
                        <path d="M4 2L20 11L12 13L9 21L4 2Z" stroke="#0B0C0E" strokeWidth="2" />
                      </svg>
                      <div
                        style={{ backgroundColor: p.color || '#73FBD3' }}
                        className="ml-3 -mt-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-black text-[#0B0C0E] shadow-lg"
                      >
                        {p.displayName}
                      </div>
                    </div>
                  ))}
            </div>

            {/* Bottom-Left Multi-Page Selector ("+ | Page 1 ▾" from Screenshots) */}
            <div
              data-export-ignore="true"
              className="absolute bottom-4 left-4 z-30 flex items-center gap-1 rounded-xl border border-[#2A2D37] bg-[#151820]/95 p-1 shadow-xl backdrop-blur-md"
            >
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = boardPages.length + 1;
                    const newPage = createEmptyBoardPage(nextNum);
                    // Copy agents from current page as starting point for next phase
                    newPage.agentTokens = structuredClone(currentPage.agentTokens);
                    setBoardPages((prev) => [...prev, newPage]);
                    setActivePageIndex(boardPages.length);
                    showToast(`Phase „Page ${nextNum}“ erstellt (Agents übernommen).`);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E222D] text-sm font-black text-[#73FBD3] transition hover:bg-[#E63946] hover:text-white"
                  title="Neue Taktik-Phase / Seite hinzufügen"
                >
                  +
                </button>
              )}

              <div className="flex items-center gap-1 px-1">
                {boardPages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setActivePageIndex(idx);
                      setSelectedItemId(null);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                      idx === activePageIndex
                        ? 'bg-[#E63946] text-white shadow'
                        : 'text-[#9E9589] hover:bg-[#222632] hover:text-white'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              {canEdit && boardPages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setBoardPages((prev) =>
                      prev.filter((_, idx) => idx !== activePageIndex)
                    );
                    setActivePageIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="px-2 text-xs text-[#8C837A] hover:text-[#EF4444]"
                  title="Aktuelle Seite löschen"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Bottom-Right Helper Hint */}
            <div
              data-export-ignore="true"
              className="pointer-events-none absolute bottom-4 right-4 z-20 hidden rounded-xl border border-[#23181C] bg-[#12141B]/90 px-3 py-1.5 text-[11px] text-[#8C837A] md:block"
            >
              💡 Ziehe Agents & Fähigkeiten rechts per Drag & Drop auf die Map • Doppelklick auf Text zum Bearbeiten
            </div>
          </div>

          {/* ----------------------------------------------------------------- */}
          {/* RIGHT SIDEBAR: TOOLS & DRAGGABLE AGENTS (Matches Screenshots)     */}
          {/* ----------------------------------------------------------------- */}
          <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-[#25171B] bg-[#111319] p-4 shadow-2xl xl:col-span-3">
            <div className="space-y-4">
              {/* 1. TOOLS SECTION (2x5 Icon Grid matching ValoPlant Screenshot) */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-display text-xs font-extrabold uppercase tracking-wider text-[#9E9589]">
                    Tools
                  </span>
                  <span className="text-[10px] font-bold uppercase text-[#73FBD3]">
                    {activeTool === 'select'
                      ? 'Auswählen / Verschieben'
                      : activeTool === 'draw'
                      ? 'Pfeil / Pfad zeichnen'
                      : activeTool === 'eraser'
                      ? 'Radierer aktiv'
                      : activeTool === 'text'
                      ? 'Klicke auf Map für Text'
                      : activeTool === 'vision'
                      ? 'Klicke für Sichtkegel'
                      : activeTool === 'circle'
                      ? 'Klicke für Smoke/Kreis'
                      : activeTool === 'rect'
                      ? 'Klicke für Zone/Box'
                      : 'Klicke für Tripwire'}
                  </span>
                </div>

                {/* Hidden file input for Image Overlay Tool */}
                <input
                  ref={imageOverlayInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBoardImageUpload}
                  className="hidden"
                />

                <div className="grid grid-cols-5 gap-2">
                  {/* Row 1 */}
                  <button
                    type="button"
                    onClick={() => setActiveTool('draw')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'draw'
                        ? 'border-[#E63946] bg-[#E63946]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Pfeil oder Laufweg zeichnen"
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('eraser')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'eraser'
                        ? 'border-[#E63946] bg-[#E63946]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Radierer (Klicke auf Linien, Agents oder Zonen zum Entfernen)"
                  >
                    🧹
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!canEdit) return;
                      updateCurrentPage(() => createEmptyBoardPage(activePageIndex + 1));
                      setSelectedItemId(null);
                      showToast('Aktuelle Board-Seite geleert.');
                    }}
                    className="flex h-11 items-center justify-center rounded-xl border border-[#252834] bg-[#191C26] text-base text-[#D6CFC7] transition hover:border-[#EF4444] hover:text-[#EF4444]"
                    title="Aktuelle Seite komplett leeren"
                  >
                    🗑️
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('text')}
                    className={`flex h-11 items-center justify-center rounded-xl border font-display text-sm font-black transition ${
                      activeTool === 'text'
                        ? 'border-[#E63946] bg-[#E63946]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Callout-Textfeld auf der Map platzieren (z. B. 'Smoke CT & Market')"
                  >
                    TT
                  </button>

                  <button
                    type="button"
                    onClick={() => imageOverlayInputRef.current?.click()}
                    className="flex h-11 items-center justify-center rounded-xl border border-[#252834] bg-[#191C26] text-base text-[#D6CFC7] transition hover:border-[#C8A273]/50"
                    title="Lineup-Screenshot oder Bild auf das Board laden"
                  >
                    🖼️
                  </button>

                  {/* Row 2 */}
                  <button
                    type="button"
                    onClick={() => setActiveTool('select')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'select'
                        ? 'border-[#73FBD3] bg-[#73FBD3]/20 text-[#73FBD3] shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Auswählen & Bewegen (Standard)"
                  >
                    🖱️
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('vision')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'vision'
                        ? 'border-[#10B981] bg-[#10B981]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Sichtkegel (Vision Cone) auf Agent oder Map setzen"
                  >
                    👁️
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('circle')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'circle'
                        ? 'border-[#E63946] bg-[#E63946]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Smoke / Kreis-Zone auf der Map platzieren"
                  >
                    ⭕
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('rect')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'rect'
                        ? 'border-[#E63946] bg-[#E63946]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Rechteck-Zone (Breach Stun / Site-Box) platzieren"
                  >
                    ▭
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTool('tripwire')}
                    className={`flex h-11 items-center justify-center rounded-xl border text-base transition ${
                      activeTool === 'tripwire'
                        ? 'border-[#38BDF8] bg-[#38BDF8]/25 text-white shadow'
                        : 'border-[#252834] bg-[#191C26] text-[#D6CFC7] hover:border-[#C8A273]/50'
                    }`}
                    title="Cypher Tripwire / Setup-Linie mit 2 Ankerpunkten platzieren"
                  >
                    ▽
                  </button>
                </div>

                {/* Color & Line Style Sub-Bar */}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#222530] bg-[#161922] px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {TOOL_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setActiveColor(c.hex)}
                        style={{ backgroundColor: c.hex }}
                        className={`h-4 w-4 rounded-full transition ${
                          activeColor === c.hex
                            ? 'scale-125 ring-2 ring-white'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDrawDashed((v) => !v)}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                        drawDashed
                          ? 'bg-[#E63946] text-white'
                          : 'bg-[#222634] text-[#8C837A] hover:text-white'
                      }`}
                      title="Gestrichelte Linie (z. B. Rotation / Lurk-Pfad)"
                    >
                      - - -
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawWithArrowHead((v) => !v)}
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase transition ${
                        drawWithArrowHead
                          ? 'bg-[#73FBD3]/20 text-[#73FBD3]'
                          : 'bg-[#222634] text-[#8C837A] hover:text-white'
                      }`}
                      title="Pfeilspitze ein/aus"
                    >
                      ➔
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. AGENTS SECTION (Matches ValoPlant Screenshot: All | On Map | Role + Ally | Enemy + 4-Col Grid) */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xs font-extrabold uppercase tracking-wider text-[#9E9589]">
                    Agents
                  </span>
                  <span className="text-[10px] text-[#8C837A]">
                    Auf Map ziehen oder klicken
                  </span>
                </div>

                {/* Filter Tabs: All | On Map | Role */}
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#181B24] p-1">
                  {(
                    [
                      { id: 'ALL', label: 'All' },
                      {
                        id: 'ON_MAP',
                        label: `On Map (${currentPage.agentTokens.length})`,
                      },
                      { id: 'ROLE', label: 'Role' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setAgentFilterTab(tab.id)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition ${
                        agentFilterTab === tab.id
                          ? 'bg-[#2A2F3D] text-white shadow'
                          : 'text-[#8C837A] hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Role Sub-Filter when 'Role' tab is active */}
                {agentFilterTab === 'ROLE' && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setAgentRoleFilter('ALL')}
                      className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                        agentRoleFilter === 'ALL'
                          ? 'bg-[#E63946] text-white'
                          : 'bg-[#181B24] text-[#8C837A]'
                      }`}
                    >
                      Alle
                    </button>
                    {AGENT_ROLES_META.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setAgentRoleFilter(r.id)}
                        className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${
                          agentRoleFilter === r.id
                            ? 'bg-[#E63946] text-white'
                            : 'bg-[#181B24] text-[#8C837A] hover:text-white'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Ally vs Enemy Toggle (Matches Screenshot) */}
                <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[#181B24] p-1">
                  <button
                    type="button"
                    onClick={() => setAgentSideMode('ally')}
                    className={`rounded-lg py-1.5 text-xs font-extrabold uppercase tracking-wider transition ${
                      agentSideMode === 'ally'
                        ? 'border border-[#10B981]/60 bg-[#10B981]/20 text-[#10B981] shadow'
                        : 'text-[#8C837A] hover:text-white'
                    }`}
                  >
                    Ally (BBT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentSideMode('enemy')}
                    className={`rounded-lg py-1.5 text-xs font-extrabold uppercase tracking-wider transition ${
                      agentSideMode === 'enemy'
                        ? 'border border-[#EF4444]/60 bg-[#EF4444]/20 text-[#EF4444] shadow'
                        : 'text-[#8C837A] hover:text-white'
                    }`}
                  >
                    Enemy
                  </button>
                </div>

                {/* 4-Column Draggable Agent Portrait Grid */}
                <div className="grid max-h-[300px] grid-cols-4 gap-2 overflow-y-auto pr-1">
                  {filteredSidebarAgents.map((agent) => {
                    const isOnMap = onMapAgentIds.has(agent.id.toLowerCase());
                    const isSelectedSidebar =
                      selectedSidebarAgent.id.toLowerCase() ===
                      agent.id.toLowerCase();

                    return (
                      <div
                        key={agent.id}
                        draggable={canEdit}
                        onDragStart={(e) => {
                          setSelectedSidebarAgentId(agent.id);
                          e.dataTransfer.setData(
                            'application/bbt-tactical-item',
                            JSON.stringify({
                              type: 'AGENT',
                              agentId: agent.id,
                              side: agentSideMode,
                            })
                          );
                        }}
                        onClick={() => {
                          setSelectedSidebarAgentId(agent.id);
                          // Place near center with slight offset so multiple clicks don't stack identically
                          const offset =
                            (currentPage.agentTokens.length % 5) * 6 - 12;
                          placeAgentOnMap(
                            agent.id,
                            50 + offset,
                            formSide === 'Angriff' ? 76 : 26,
                            agentSideMode
                          );
                        }}
                        title={`${agent.name} (${agent.role}) – Auf die Map ziehen oder klicken`}
                        className={`group relative aspect-square cursor-grab overflow-hidden rounded-xl border-2 bg-[#181B24] transition hover:scale-105 active:cursor-grabbing ${
                          isOnMap
                            ? agentSideMode === 'ally'
                              ? 'border-[#10B981] shadow-md shadow-[#10B981]/20'
                              : 'border-[#EF4444] shadow-md shadow-[#EF4444]/20'
                            : isSelectedSidebar
                            ? 'border-[#C8A273]'
                            : 'border-[#262A36] hover:border-[#8C837A]'
                        }`}
                      >
                        <img
                          src={agent.displayIcon}
                          alt={agent.name}
                          draggable={false}
                          className="h-full w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-1 py-0.5 text-center">
                          <span className="block truncate text-[9px] font-bold text-[#F2EDE4]">
                            {agent.name}
                          </span>
                        </div>
                        {isOnMap && (
                          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#10B981] ring-1 ring-black" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. SELECTED AGENT ABILITIES BAR (Drag Smokes/Recon/Traps onto Map) */}
            <div className="rounded-xl border border-[#252834] bg-[#161922] p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={selectedSidebarAgent.displayIcon}
                    alt={selectedSidebarAgent.name}
                    className="h-6 w-6 rounded-md object-cover"
                  />
                  <span className="font-display text-xs font-extrabold uppercase tracking-wider text-white">
                    {selectedSidebarAgent.name} Utility
                  </span>
                </div>
                <span className="text-[10px] text-[#8C837A]">
                  Auf Map ziehen
                </span>
              </div>

              {selectedSidebarAgent.abilities &&
              selectedSidebarAgent.abilities.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {selectedSidebarAgent.abilities.map((ab) => (
                    <div
                      key={ab.slot}
                      draggable={canEdit}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/bbt-tactical-item',
                          JSON.stringify({
                            type: 'ABILITY',
                            agentId: selectedSidebarAgent.id,
                            slot: ab.slot,
                            name: ab.name,
                            icon: ab.icon,
                          })
                        );
                      }}
                      onClick={() =>
                        placeAbilityOnMap(
                          selectedSidebarAgent.id,
                          ab.slot,
                          ab.name,
                          ab.icon,
                          50,
                          50
                        )
                      }
                      title={`${ab.name} – Auf Map ziehen oder klicken`}
                      className="flex cursor-grab flex-col items-center justify-center rounded-xl border border-[#262A36] bg-[#11131A] p-2 transition hover:border-[#73FBD3] hover:bg-[#1B202C] active:cursor-grabbing"
                    >
                      <img
                        src={ab.icon}
                        alt={ab.name}
                        draggable={false}
                        className="h-7 w-7 object-contain"
                      />
                      <span className="mt-1 max-w-full truncate text-[9px] font-bold text-[#9E9589]">
                        {ab.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-[#8C837A]">
                  Wähle einen Agenten, um seine Fähigkeiten auf die Map zu ziehen.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* SAVED STRATEGIES LIBRARY & FILTER VIEW                              */
        /* =================================================================== */
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#26161B] bg-[#121014] p-4 sm:grid-cols-2 lg:grid-cols-5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Strategie suchen..."
              className="rounded-xl border border-[#2B1B20] bg-[#0B0C0E] px-3.5 py-2.5 text-xs text-[#F2EDE4]"
            />
            <select
              value={filterMap}
              onChange={(e) => setFilterMap(e.target.value)}
              className="rounded-xl border border-[#2B1B20] bg-[#0B0C0E] px-3 py-2.5 text-xs text-[#F2EDE4]"
            >
              <option value="ALL">Alle Maps</option>
              {VALORANT_MAPS_LIST.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={filterSide}
              onChange={(e) => setFilterSide(e.target.value)}
              className="rounded-xl border border-[#2B1B20] bg-[#0B0C0E] px-3 py-2.5 text-xs text-[#F2EDE4]"
            >
              <option value="ALL">Beide Seiten (Attack & Defense)</option>
              {STRATEGY_SIDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="rounded-xl border border-[#2B1B20] bg-[#0B0C0E] px-3 py-2.5 text-xs text-[#F2EDE4]"
            >
              <option value="ALL">Alle Sites (A/B/C/Mid)</option>
              {(['A', 'B', 'C', 'Mid', 'Global'] as StrategySite[]).map((site) => (
                <option key={site} value={site}>
                  Site {site}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-[#2B1B20] bg-[#0B0C0E] px-3 py-2.5 text-xs text-[#F2EDE4]"
            >
              <option value="ALL">Alle Strategietypen</option>
              {STRATEGY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {filteredStrategies.length === 0 ? (
            <div className="rounded-2xl border border-[#26161B] bg-[#121014] p-10 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E63946]/30 bg-[#E63946]/10 text-2xl">
                🗺️
              </div>
              <h3 className="font-display text-lg font-extrabold uppercase tracking-wider text-[#F2EDE4]">
                Keine gespeicherten Map-Strategien gefunden
              </h3>
              <p className="mx-auto mt-1 max-w-lg text-xs text-[#8C837A]">
                Öffne das interaktive 2D Taktik-Board, ziehe eure Agents und Utility auf die Map (z. B. „CORRODE AGGRESSIVE“, „CORRODE DEFAULT“ oder „CORRODE LOCKDOWN“) und speichere die Strategie.
              </p>
              <button
                type="button"
                onClick={() => setWorkspaceMode('BOARD')}
                className="mt-4 rounded-xl bg-[#E63946] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white"
              >
                Zum 2D Map-Board wechseln
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredStrategies.map((strat) => {
                const mapObj = getMapByIdOrName(strat.mapId) || VALORANT_MAPS_LIST[0];
                const pageCount = strat.boardPages?.length || 1;
                const tokenCount =
                  strat.boardPages?.[0]?.agentTokens?.length ||
                  strat.assignments.filter((a) => a.agentId).length;

                return (
                  <div
                    key={strat.id}
                    className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#28181D] bg-[#121014] shadow-xl transition hover:border-[#E63946]/60"
                  >
                    <div>
                      <div className="relative h-32 overflow-hidden">
                        <img
                          src={mapObj.splash}
                          alt={mapObj.name}
                          className="h-full w-full object-cover opacity-50 transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#121014] via-[#121014]/50 to-transparent" />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                          <span className="rounded-md bg-black/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                            {mapObj.name}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              strat.side === 'Angriff'
                                ? 'bg-[#E63946]/80 text-white'
                                : 'bg-[#73FBD3]/25 text-[#73FBD3]'
                            }`}
                          >
                            {strat.side}
                          </span>
                          <span className="rounded-md bg-[#C8A273]/25 px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#C8A273]">
                            Site {strat.site} • {strat.type}
                          </span>
                        </div>
                        <div className="absolute bottom-2 left-3 right-3">
                          <h4 className="font-display text-lg font-black uppercase tracking-wide text-white">
                            {strat.name}
                          </h4>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="mb-3 flex items-center justify-between text-[11px] text-[#8C837A]">
                          <span>
                            {pageCount} Board-Phase(n) • {tokenCount} Agents platziert
                          </span>
                          <span>
                            {new Date(strat.updatedAt).toLocaleDateString('de-DE')}
                          </span>
                        </div>

                        {strat.notes && (
                          <p className="line-clamp-2 text-xs text-[#D6CFC7]">
                            {strat.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#221519] bg-[#0E0D10] px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => loadStrategyIntoWorkspace(strat)}
                        className="text-xs font-extrabold uppercase tracking-wider text-[#73FBD3] hover:underline"
                      >
                        Im 2D Map-Board öffnen →
                      </button>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onDeleteStrategy(strat.id)}
                          className="text-xs font-bold text-[#8C837A] hover:text-[#EF4444]"
                        >
                          Löschen
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Agent Picker Modal for the 5 Player Slots Drawer */}
      <AgentPickerModal
        isOpen={pickerSlotIndex !== null}
        slotLabel={
          pickerSlotIndex !== null
            ? `Slot #${pickerSlotIndex + 1}`
            : 'Agent wählen'
        }
        selectedAgentId={
          pickerSlotIndex !== null
            ? formAssignments[pickerSlotIndex]?.agentId || null
            : null
        }
        usedAgentIds={[]}
        allowDuplicateAgents={true}
        onToggleAllowDuplicates={() => {}}
        onSelectAgent={(agentId) => {
          if (pickerSlotIndex === null) return;
          setFormAssignments((prev) =>
            prev.map((item, idx) =>
              idx === pickerSlotIndex ? { ...item, agentId } : item
            )
          );
          setPickerSlotIndex(null);
        }}
        onClose={() => setPickerSlotIndex(null)}
      />
    </div>
  );
}
