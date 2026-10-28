'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  Home,
  Loader2,
  LogOut,
  Menu,
  Settings,
  Shield,
  Target,
  Users,
  X,
} from 'lucide-react';
import { BBT_TEAM_INFO } from '@/lib/valorant-data';
import { LoginGateway } from '@/components/hq/LoginGateway';
import { DashboardView } from '@/components/hq/DashboardView';
import { MapStrategiesView } from '@/components/hq/MapStrategiesView';
import { LineupBuilderView } from '@/components/hq/LineupBuilderView';
import { PlayerStatsView } from '@/components/hq/PlayerStatsView';
import { OpponentScoutingView } from '@/components/hq/OpponentScoutingView';
import {
  RosterAndUserAdminModal,
  SanitizedUserAccount,
} from '@/components/hq/RosterAndUserAdminModal';
import type {
  BbtHqDatabase,
  MapStrategy,
  PublicUserSession,
  TeamLineup,
} from '@/types/hq';

type NavSection =
  | 'DASHBOARD'
  | 'STRATEGIES'
  | 'LINEUPS'
  | 'STATS'
  | 'SCOUTING';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: Home },
  { id: 'STRATEGIES', label: 'Map-Strategien', icon: BookOpen },
  { id: 'LINEUPS', label: 'Team-Aufstellung', icon: Users },
  { id: 'STATS', label: 'Spielerstatistiken', icon: BarChart3 },
  { id: 'SCOUTING', label: 'Gegner-Scouting', icon: Target },
];

export default function BigBlackTeaPremierHqApp() {
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isInitialSetupNeeded, setIsInitialSetupNeeded] = useState(false);
  const [rosterUsernames, setRosterUsernames] = useState<any[]>([]);
  const [session, setSession] = useState<PublicUserSession | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [db, setDb] = useState<(BbtHqDatabase & { users: SanitizedUserAccount[] }) | null>(
    null
  );

  // Navigation & Deep-Link State
  const [activeNav, setActiveNav] = useState<NavSection>('DASHBOARD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [focusedLineup, setFocusedLineup] = useState<TeamLineup | null>(null);
  const [focusedStrategy, setFocusedStrategy] = useState<MapStrategy | null>(
    null
  );
  const [triggerCreateStrategy, setTriggerCreateStrategy] = useState(false);
  const [triggerCreateMatch, setTriggerCreateMatch] = useState(false);

  // Modals & Toasts
  const [adminModalState, setAdminModalState] = useState<{
    open: boolean;
    tab: 'ROSTER' | 'USERS' | 'PASSWORD';
  }>({ open: false, tab: 'ROSTER' });
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((prev) => (prev?.message === message ? null : prev));
      }, 3500);
    },
    []
  );

  const fetchHqData = useCallback(
    async (tokenOverride?: string | null) => {
      const headers: Record<string, string> = {};
      const activeTok = tokenOverride ?? authToken;
      if (activeTok) {
        headers['Authorization'] = `Bearer ${activeTok}`;
      }
      const res = await fetch('/api/hq', { headers, cache: 'no-store' });
      if (!res.ok) {
        if (res.status === 401) {
          setAuthenticated(false);
          setSession(null);
        }
        return;
      }
      const payload = await res.json();
      if (payload.ok && payload.data) {
        setDb(payload.data);
        if (payload.session) {
          setSession(payload.session);
        }
      }
    },
    [authToken]
  );

  // Check authentication status on initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth', { cache: 'no-store' });
        const data = await res.json();
        if (!mounted) return;
        setIsInitialSetupNeeded(Boolean(data.isInitialSetupNeeded));
        setRosterUsernames(data.rosterUsernames || []);
        if (data.authenticated && data.session) {
          setAuthenticated(true);
          setSession(data.session);
          await fetchHqData();
        } else {
          setAuthenticated(false);
        }
      } catch (err) {
        console.error('Auth-Check Fehler:', err);
      } finally {
        if (mounted) setAuthChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [fetchHqData]);

  // Real-time live database refresh when another team member saves data
  useEffect(() => {
    if (!authenticated || !session) return;
    const cid = `hq-${session.username}-${Math.random().toString(36).slice(2, 7)}`;
    const es = new EventSource(
      `/api/live/stream?clientId=${encodeURIComponent(cid)}&username=${encodeURIComponent(
        session.username
      )}&displayName=${encodeURIComponent(session.displayName)}`
    );
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'DB_MUTATED') {
          fetchHqData();
        }
      } catch {
        // ignore
      }
    };
    return () => {
      es.close();
    };
  }, [authenticated, session, fetchHqData]);

  const mutateHq = useCallback(
    async (action: string, payload: Record<string, any> = {}) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      const res = await fetch('/api/hq', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Aktion fehlgeschlagen.', 'error');
        throw new Error(data.error || 'Aktion fehlgeschlagen.');
      }
      if (data.data) {
        setDb(data.data);
      }
      return data;
    },
    [authToken, showToast]
  );

  const handleLogout = async () => {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'LOGOUT' }),
    });
    setAuthenticated(false);
    setSession(null);
    setAuthToken(null);
    setDb(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#07080A] text-[#ECE8E1] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-[#9E141B]" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#C8A273]">
          Lade BigBlackTea Premier Team HQ...
        </span>
      </div>
    );
  }

  if (!authenticated || !session) {
    return (
      <LoginGateway
        isInitialSetupNeeded={isInitialSetupNeeded}
        rosterUsernames={rosterUsernames}
        onAuthenticated={async (nextSession, token) => {
          setSession(nextSession);
          if (token) setAuthToken(token);
          setIsInitialSetupNeeded(false);
          setAuthenticated(true);
          await fetchHqData(token);
        }}
      />
    );
  }

  if (!db) {
    return (
      <div className="min-h-screen bg-[#07080A] text-[#ECE8E1] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-[#9E141B]" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#C8A273]">
          Synchronisiere Teamdatenbank...
        </span>
      </div>
    );
  }

  const isAdmin = session.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#07080A] text-[#ECE8E1] flex">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-2.5 text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-[#0F1218] border-[#73FBD3]/50 text-[#73FBD3]'
              : 'bg-red-950/95 border-red-500/50 text-red-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Desktop Left Sidebar (Consistent across all pages, matches Reference Design) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between bg-[#090B0F] border-r border-white/10 sticky top-0 h-screen">
        <div>
          {/* BBT Brand Header */}
          <div
            onClick={() => setActiveNav('DASHBOARD')}
            className="cursor-pointer px-6 py-6 flex items-center gap-3.5 border-b border-white/5"
          >
            <img
              src={BBT_TEAM_INFO.logoUrl}
              alt="BigBlackTea Logo"
              className="w-11 h-11 object-contain drop-shadow-[0_4px_14px_rgba(158,20,27,0.6)]"
            />
            <div>
              <div className="font-display font-extrabold text-lg uppercase tracking-wider text-white leading-tight">
                BIGBLACKTEA
              </div>
              <div className="text-xs font-mono text-[#878C8F]">BBT</div>
            </div>
          </div>

          {/* 5 Core Navigation Items */}
          <nav className="p-3.5 space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-[#9E141B]/45 to-[#9E141B]/10 text-white border border-[#9E141B]/60 shadow-[0_0_20px_rgba(158,20,27,0.25)]'
                      : 'text-[#878C8F] hover:text-white hover:bg-white/[0.03]'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-[#E63946]" />
                  )}
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-[#878C8F]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-white/5">
                <div className="px-4 pb-1.5 text-[10px] font-mono uppercase tracking-wider text-[#878C8F]">
                  Administration
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setAdminModalState({ open: true, tab: 'USERS' })
                  }
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-[#C8A273] hover:bg-white/[0.04] transition"
                >
                  <Shield className="w-4 h-4" />
                  <span>Benutzer & Kader</span>
                </button>
              </div>
            )}
          </nav>
        </div>

        {/* Bottom Logged-in User Profile Card */}
        <div className="p-4 border-t border-white/10 bg-[#07080B]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#9E141B] to-[#141821] border border-[#C8A273]/40 flex items-center justify-center font-display font-bold text-sm text-white shrink-0">
                {session.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {session.username}
                </div>
                <div className="text-[11px] text-[#878C8F]">
                  {isAdmin ? 'Admin' : 'Spieler'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setAdminModalState({
                    open: true,
                    tab: isAdmin ? 'ROSTER' : 'PASSWORD',
                  })
                }
                className="p-1.5 rounded-lg text-[#878C8F] hover:text-white hover:bg-white/5 transition"
                title="Einstellungen & Passwort"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-[#878C8F] hover:text-red-400 hover:bg-red-950/30 transition"
                title="Abmelden"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/80 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-64 h-full bg-[#090B0F] border-r border-white/10 flex flex-col justify-between p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <img
                    src={BBT_TEAM_INFO.logoUrl}
                    alt="BBT"
                    className="w-9 h-9 object-contain"
                  />
                  <span className="font-display font-bold text-base uppercase text-white">
                    BIGBLACKTEA
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#878C8F] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                        isActive
                          ? 'bg-[#9E141B] text-white'
                          : 'text-[#878C8F] hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between">
              <div className="text-xs">
                <div className="font-bold text-white">{session.username}</div>
                <div className="text-[#878C8F]">
                  {isAdmin ? 'Admin' : 'Spieler'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-red-950/50 text-xs text-red-200"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Right Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-8 bg-[#07080A]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white/5 text-[#ECE8E1]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#878C8F]">
              <span className="text-[#C8A273] font-bold">BBT HQ</span>
              <span>/</span>
              <span className="text-white">
                {NAV_ITEMS.find((n) => n.id === activeNav)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Activity / Audit Log Bell */}
            <button
              type="button"
              onClick={() => setAuditDrawerOpen((s) => !s)}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#878C8F] hover:text-white transition relative"
              title="Letzte Team-Aktivitäten"
            >
              <Bell className="w-4 h-4" />
              {db.auditLogs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#73FBD3]" />
              )}
            </button>

            {/* User Profile Pill */}
            <button
              type="button"
              onClick={() =>
                setAdminModalState({
                  open: true,
                  tab: isAdmin ? 'USERS' : 'PASSWORD',
                })
              }
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#0F1218] hover:bg-[#141821] border border-white/10 transition"
            >
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-white leading-tight">
                  {session.username}
                </div>
                <div className="text-[10px] text-[#C8A273] leading-tight">
                  {isAdmin ? 'Admin' : 'Spieler'}
                </div>
              </div>
              <Settings className="w-4 h-4 text-[#878C8F]" />
            </button>
          </div>
        </header>

        {/* Optional Audit Log Popover */}
        {auditDrawerOpen && (
          <div className="fixed right-6 top-16 z-40 w-80 max-h-96 overflow-y-auto rounded-2xl bg-[#0E1117] border border-white/15 shadow-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-display font-bold uppercase text-white">
                Team-Aktivitätsprotokoll
              </span>
              <button
                type="button"
                onClick={() => setAuditDrawerOpen(false)}
                className="text-[#878C8F] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {db.auditLogs.slice(0, 12).map((log) => (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-[#141821] border border-white/5 text-xs"
              >
                <div className="flex items-center justify-between text-[10px] text-[#C8A273] font-mono">
                  <span>{log.actor}</span>
                  <span>
                    {new Date(log.timestamp).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-[#ECE8E1] mt-0.5">{log.details}</div>
              </div>
            ))}
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {activeNav === 'DASHBOARD' && (
            <DashboardView
              db={db}
              isAdmin={isAdmin}
              onNavigateTab={(tab) => setActiveNav(tab)}
              onQuickCreateStrategy={() => {
                setTriggerCreateStrategy(true);
                setActiveNav('STRATEGIES');
              }}
              onQuickCreateLineup={() => {
                setFocusedLineup(null);
                setActiveNav('LINEUPS');
              }}
              onQuickCreateMatch={() => {
                setTriggerCreateMatch(true);
                setActiveNav('STATS');
              }}
              onOpenLineup={(lu) => {
                setFocusedLineup(lu);
                setActiveNav('LINEUPS');
              }}
              onOpenStrategy={(strat) => {
                setFocusedStrategy(strat);
                setActiveNav('STRATEGIES');
              }}
              onSaveUpcomingMatch={async (upcoming) => {
                await mutateHq('UPDATE_UPCOMING_MATCH', {
                  upcomingMatch: upcoming,
                });
                showToast(
                  upcoming
                    ? 'Nächstes Match gespeichert!'
                    : 'Geplantes Match zurückgesetzt.'
                );
              }}
            />
          )}

          {activeNav === 'STRATEGIES' && (
            <MapStrategiesView
              strategies={db.strategies}
              players={db.players}
              initialStrategy={focusedStrategy}
              openCreateModalOnMount={triggerCreateStrategy}
              onClearCreateTrigger={() => setTriggerCreateStrategy(false)}
              isAdmin={isAdmin}
              canAddNotes={session.canAddNotes}
              currentUsername={session.username}
              currentDisplayName={session.displayName}
              onSaveStrategy={async (strat) => {
                await mutateHq('UPSERT_STRATEGY', strat);
                showToast('Map-Strategie erfolgreich gespeichert!');
              }}
              onDeleteStrategy={async (strategyId) => {
                await mutateHq('DELETE_STRATEGY', { id: strategyId });
                showToast('Map-Strategie gelöscht.');
              }}
              onAddStrategyNote={async (strategyId, notes) => {
                await mutateHq('ADD_STRATEGY_NOTE', { strategyId, notes });
                showToast('Notiz zur Strategie hinzugefügt!');
              }}
            />
          )}

          {activeNav === 'LINEUPS' && (
            <LineupBuilderView
              lineups={db.lineups}
              players={db.players}
              strategies={db.strategies}
              initialLineup={focusedLineup}
              isAdmin={isAdmin}
              canAddNotes={session.canAddNotes}
              onSaveLineup={async (lineup) => {
                await mutateHq('UPSERT_LINEUP', lineup);
                showToast('Team-Lineup erfolgreich gespeichert!');
              }}
              onDeleteLineup={async (lineupId) => {
                await mutateHq('DELETE_LINEUP', { id: lineupId });
                showToast('Lineup gelöscht.');
              }}
              onAddLineupNote={async (lineupId, notes) => {
                await mutateHq('ADD_LINEUP_NOTE', { lineupId, notes });
                showToast('Notiz zum Lineup hinzugefügt!');
              }}
              onOpenRosterModal={() =>
                setAdminModalState({ open: true, tab: 'ROSTER' })
              }
            />
          )}

          {activeNav === 'STATS' && (
            <PlayerStatsView
              matches={db.matches}
              players={db.players}
              openMatchModalOnMount={triggerCreateMatch}
              onClearMatchModalTrigger={() => setTriggerCreateMatch(false)}
              isAdmin={isAdmin}
              onSaveMatch={async (matchInput) => {
                await mutateHq('UPSERT_MATCH', matchInput);
                showToast('Match und Spielerstatistiken gespeichert!');
              }}
              onDeleteMatch={async (matchId) => {
                await mutateHq('DELETE_MATCH', { id: matchId });
                showToast('Match gelöscht.');
              }}
            />
          )}

          {activeNav === 'SCOUTING' && (
            <OpponentScoutingView
              opponents={db.opponents}
              matches={db.matches}
              lineups={db.lineups}
              strategies={db.strategies}
              isAdmin={isAdmin}
              canAddNotes={session.canAddNotes}
              onSaveOpponent={async (opp) => {
                await mutateHq('UPSERT_OPPONENT', opp);
                showToast('Gegnerprofil & Matchplan gespeichert!');
              }}
              onDeleteOpponent={async (opponentId) => {
                await mutateHq('DELETE_OPPONENT', { id: opponentId });
                showToast('Gegnerprofil gelöscht.');
              }}
              onAddScoutingNote={async (opponentId, category, content) => {
                await mutateHq('ADD_SCOUTING_NOTE', {
                  opponentId,
                  category,
                  content,
                });
                showToast('Scouting-Beobachtung hinzugefügt!');
              }}
              onOpenLineupInEditor={(lu) => {
                setFocusedLineup(lu);
                setActiveNav('LINEUPS');
              }}
              onOpenStrategyInViewer={(st) => {
                setFocusedStrategy(st);
                setActiveNav('STRATEGIES');
              }}
            />
          )}
        </main>
      </div>

      {/* Roster & User Administration Modal */}
      <RosterAndUserAdminModal
        isOpen={adminModalState.open}
        onClose={() => setAdminModalState((s) => ({ ...s, open: false }))}
        initialTab={adminModalState.tab}
        session={session}
        players={db.players}
        users={db.users || []}
        onUpsertPlayer={async (player) => {
          await mutateHq('UPSERT_PLAYER', player);
          showToast('Spieler im Kader gespeichert!');
        }}
        onDeletePlayer={async (playerId) => {
          await mutateHq('DELETE_PLAYER', { id: playerId });
          showToast('Spieler aus Kader entfernt.');
        }}
        onUpsertUser={async (userPayload) => {
          await mutateHq('ADMIN_UPSERT_USER', userPayload);
          showToast('Benutzerkonto aktualisiert!');
        }}
        onGenerateInviteCode={async (userId) => {
          const res = await mutateHq('ADMIN_GENERATE_INVITE_CODE', { userId });
          showToast(
            `Einladungs-/Reset-Code für ${res.targetUsername} generiert!`
          );
          return res.generatedCode || null;
        }}
      />
    </div>
  );
}
