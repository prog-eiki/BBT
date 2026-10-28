'use client';

import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  KeyRound,
  Lock,
  Plus,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AGENT_ROLES_META } from '@/lib/valorant-data';
import type {
  AgentRole,
  PublicUserSession,
  TeamPlayer,
  UserRole,
} from '@/types/hq';

export interface SanitizedUserAccount {
  id: string;
  username: string;
  displayName: string;
  playerId: string | null;
  role: UserRole;
  isActive: boolean;
  canAddNotes: boolean;
  hasPasswordSet: boolean;
  inviteCodePlainPreview: string | null;
  lastLoginAt: string | null;
}

interface RosterAndUserAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'ROSTER' | 'USERS' | 'PASSWORD';
  session: PublicUserSession;
  players: TeamPlayer[];
  users: SanitizedUserAccount[];
  onUpsertPlayer: (
    player: Partial<TeamPlayer> & { name: string; tag: string }
  ) => Promise<void>;
  onDeletePlayer: (playerId: string) => Promise<void>;
  onUpsertUser: (userPayload: Record<string, any>) => Promise<void>;
  onGenerateInviteCode: (userId: string) => Promise<string | null>;
}

export const RosterAndUserAdminModal: React.FC<
  RosterAndUserAdminModalProps
> = ({
  isOpen,
  onClose,
  initialTab = 'ROSTER',
  session,
  players,
  users,
  onUpsertPlayer,
  onDeletePlayer,
  onUpsertUser,
  onGenerateInviteCode,
}) => {
  const isAdmin = session.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'USERS' | 'PASSWORD'>(
    isAdmin ? initialTab : 'PASSWORD'
  );

  // Roster Form State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [pName, setPName] = useState('');
  const [pTag, setPTag] = useState('');
  const [pRole, setPRole] = useState<AgentRole>('Duelist');
  const [pStarter, setPStarter] = useState(true);

  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newUserPlayerId, setNewUserPlayerId] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('PLAYER');

  // Invite Code Copy Feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Own Password Change Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  if (!isOpen) return null;

  const startEditPlayer = (p: TeamPlayer) => {
    setEditingPlayerId(p.id);
    setPName(p.name);
    setPTag(p.tag);
    setPRole(p.primaryRole);
    setPStarter(p.isStarter);
  };

  const resetPlayerForm = () => {
    setEditingPlayerId(null);
    setPName('');
    setPTag('');
    setPRole('Duelist');
    setPStarter(true);
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pTag.trim()) return;
    await onUpsertPlayer({
      id: editingPlayerId || undefined,
      name: pName.trim(),
      tag: pTag.trim().replace(/^#/, ''),
      primaryRole: pRole,
      isStarter: pStarter,
    });
    resetPlayerForm();
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const linkedPlayer = players.find((p) => p.id === newUserPlayerId);
    await onUpsertUser({
      username: newUsername.trim(),
      displayName: linkedPlayer
        ? `${linkedPlayer.name} #${linkedPlayer.tag}`
        : newUsername.trim(),
      playerId: newUserPlayerId || null,
      role: newUserRole,
      canAddNotes: true,
    });
    setNewUsername('');
    setNewUserPlayerId('');
    setNewUserRole('PLAYER');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({
        type: 'error',
        text: 'Das neue Passwort muss mindestens 8 Zeichen lang sein.',
      });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwMsg({
        type: 'error',
        text: 'Die neuen Passwörter stimmen nicht überein.',
      });
      return;
    }

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CHANGE_OWN_PASSWORD',
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Passwortänderung fehlgeschlagen.');
      }
      setPwMsg({
        type: 'success',
        text: 'Dein Passwort wurde erfolgreich aktualisiert.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      setPwMsg({
        type: 'error',
        text: err.message || 'Fehler beim Ändern des Passworts.',
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0E1015] border border-[#C8A273]/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#9E141B]" />

        {/* Header */}
        <div className="px-6 py-4 bg-[#14171F] border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#C8A273]">
              BIGBLACKTEA (BBT) • SYSTEMVERWALTUNG
            </div>
            <h2 className="text-xl font-display font-bold uppercase tracking-wider text-white">
              {isAdmin
                ? 'Teamkader, Benutzerkonten & Sicherheit'
                : 'Kontoeinstellungen & Passwort'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-[#9E141B] text-[#878C8F] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 bg-[#0B0D12] border-b border-white/10 flex items-center gap-3 overflow-x-auto">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('ROSTER')}
                className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition ${
                  activeTab === 'ROSTER'
                    ? 'border-[#9E141B] text-white'
                    : 'border-transparent text-[#878C8F] hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 text-[#C8A273]" />
                <span>Teamkader ({players.length} Spieler)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('USERS')}
                className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition ${
                  activeTab === 'USERS'
                    ? 'border-[#9E141B] text-white'
                    : 'border-transparent text-[#878C8F] hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4 text-[#73FBD3]" />
                <span>Benutzer & Rollen ({users.length})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('PASSWORD')}
            className={`px-4 py-2.5 text-xs font-display font-bold uppercase tracking-wider border-b-2 flex items-center gap-2 transition ${
              activeTab === 'PASSWORD'
                ? 'border-[#9E141B] text-white'
                : 'border-transparent text-[#878C8F] hover:text-white'
            }`}
          >
            <Lock className="w-4 h-4 text-[#C8A273]" />
            <span>Eigenes Passwort ändern</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: TEAMKADER (PLAYERS) */}
          {activeTab === 'ROSTER' && isAdmin && (
            <div className="space-y-6">
              <form
                onSubmit={handleSavePlayer}
                className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-4"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[#C8A273]">
                  {editingPlayerId
                    ? 'Spieler bearbeiten'
                    : 'Neuen Spieler zum Kader hinzufügen'}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] text-[#878C8F] mb-1">
                      Spielername *
                    </label>
                    <input
                      type="text"
                      required
                      value={pName}
                      onChange={(e) => setPName(e.target.value)}
                      placeholder="z. B. Lunar"
                      className="w-full px-3 py-2 rounded-lg bg-[#090A0E] border border-white/15 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#878C8F] mb-1">
                      Riot-Tag (ohne #) *
                    </label>
                    <input
                      type="text"
                      required
                      value={pTag}
                      onChange={(e) => setPTag(e.target.value)}
                      placeholder="z. B. 7822 oder RED"
                      className="w-full px-3 py-2 rounded-lg bg-[#090A0E] border border-white/15 text-xs font-mono text-[#C8A273]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#878C8F] mb-1">
                      Hauptrolle
                    </label>
                    <select
                      value={pRole}
                      onChange={(e) => setPRole(e.target.value as AgentRole)}
                      className="w-full px-3 py-2 rounded-lg bg-[#090A0E] border border-white/15 text-xs text-white"
                    >
                      {AGENT_ROLES_META.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-2 px-3 rounded-lg bg-[#9E141B] hover:bg-[#B81720] text-xs font-bold uppercase text-white"
                    >
                      {editingPlayerId ? 'Aktualisieren' : '+ Hinzufügen'}
                    </button>
                    {editingPlayerId && (
                      <button
                        type="button"
                        onClick={resetPlayerForm}
                        className="py-2 px-2.5 rounded-lg bg-white/5 text-xs text-[#878C8F]"
                      >
                        Abbrechen
                      </button>
                    )}
                  </div>
                </div>
              </form>

              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-[#090A0E] border border-white/10 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">
                        {p.name}{' '}
                        <span className="font-mono text-xs text-[#C8A273]">
                          #{p.tag}
                        </span>
                      </div>
                      <div className="text-xs text-[#878C8F] mt-0.5">
                        Rolle: {p.primaryRole} •{' '}
                        {p.isStarter ? 'Stammkader' : 'Ersatz / 6th Man'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditPlayer(p)}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#C8A273]" />
                        <span>Bearbeiten</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePlayer(p.id)}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-200"
                        title="Spieler entfernen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: BENUTZERKONTEN, ROLLEN & EINLADUNGSCODES */}
          {activeTab === 'USERS' && isAdmin && (
            <div className="space-y-6">
              {/* Create Additional User Account */}
              <form
                onSubmit={handleCreateNewUser}
                className="p-4 rounded-xl bg-[#141821] border border-white/10 space-y-3"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-[#C8A273] flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Neues Benutzerkonto anlegen</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Eindeutiger Benutzername"
                    className="px-3 py-2 rounded-lg bg-[#090A0E] border border-white/15 text-xs text-white"
                  />

                  <select
                    value={newUserPlayerId}
                    onChange={(e) => setNewUserPlayerId(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-[#090A0E] border border-white/15 text-xs text-white"
                  >
                    <option value="">— Zugeordnetes Teammitglied —</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} #{p.tag}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="px-3 py-2 rounded-lg bg-[#090A0E] border border-white/15 text-xs text-white"
                  >
                    <option value="PLAYER">Rolle: Spieler</option>
                    <option value="ADMIN">Rolle: Admin</option>
                  </select>

                  <button
                    type="submit"
                    className="py-2 px-4 rounded-lg bg-[#9E141B] hover:bg-[#B81720] text-xs font-bold uppercase text-white"
                  >
                    Konto erstellen
                  </button>
                </div>
              </form>

              {/* List of 6+ Team Accounts */}
              <div className="space-y-3">
                {users.map((u) => {
                  const linkedPlayer = players.find(
                    (p) => p.id === u.playerId
                  );
                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-xl bg-[#090A0E] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {u.username}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                              u.role === 'ADMIN'
                                ? 'bg-[#9E141B]/30 border border-[#9E141B] text-[#C8A273]'
                                : 'bg-white/5 border border-white/10 text-[#73FBD3]'
                            }`}
                          >
                            {u.role === 'ADMIN' ? 'Admin' : 'Spieler'}
                          </span>
                          {!u.isActive && (
                            <span className="px-2 py-0.5 rounded bg-red-950 text-[10px] font-mono text-red-300">
                              Deaktiviert
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-[#878C8F]">
                          Spieler-Zuordnung:{' '}
                          <strong className="text-[#ECE8E1]">
                            {linkedPlayer
                              ? `${linkedPlayer.name} #${linkedPlayer.tag}`
                              : 'Keine'}
                          </strong>{' '}
                          • Status:{' '}
                          {u.hasPasswordSet ? (
                            <span className="text-[#73FBD3]">
                              Eigenes Passwort aktiv
                            </span>
                          ) : (
                            <span className="text-[#C8A273]">
                              Wartet auf Passwort-Einrichtung
                            </span>
                          )}
                        </div>

                        {u.inviteCodePlainPreview && (
                          <div className="mt-1.5 inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#141821] border border-[#C8A273]/30">
                            <span className="text-[11px] text-[#878C8F]">
                              Aktiver Einladungs-/Reset-Code:
                            </span>
                            <code className="text-xs font-mono font-bold text-[#73FBD3]">
                              {u.inviteCodePlainPreview}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyCode(u.inviteCodePlainPreview!)
                              }
                              className="text-xs text-[#C8A273] hover:text-white flex items-center gap-1"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>
                                {copiedCode === u.inviteCodePlainPreview
                                  ? 'Kopiert!'
                                  : 'Kopieren'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Admin Controls for User */}
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            onUpsertUser({
                              id: u.id,
                              username: u.username,
                              role: e.target.value,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#141821] border border-white/10 text-xs text-white"
                        >
                          <option value="PLAYER">Spieler</option>
                          <option value="ADMIN">Admin</option>
                        </select>

                        {u.role === 'PLAYER' && (
                          <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141821] border border-white/10 text-xs text-[#ECE8E1] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={u.canAddNotes}
                              onChange={(e) =>
                                onUpsertUser({
                                  id: u.id,
                                  username: u.username,
                                  canAddNotes: e.target.checked,
                                })
                              }
                              className="accent-[#9E141B]"
                            />
                            <span>Notizen erlaubt</span>
                          </label>
                        )}

                        <button
                          type="button"
                          onClick={() => onGenerateInviteCode(u.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[#9E141B] border border-white/10 text-xs text-[#C8A273] hover:text-white flex items-center gap-1.5 transition"
                          title="Neuen Einladungs- oder Passwort-Reset-Code generieren"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Reset-Code erzeugen</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onUpsertUser({
                              id: u.id,
                              username: u.username,
                              isActive: !u.isActive,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#878C8F] hover:text-white"
                        >
                          {u.isActive ? 'Deaktivieren' : 'Aktivieren'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: EIGENES PASSWORT ÄNDERN */}
          {activeTab === 'PASSWORD' && (
            <form
              onSubmit={handleChangeOwnPassword}
              className="max-w-md mx-auto space-y-4 py-2"
            >
              <div className="p-3.5 rounded-xl bg-[#141821] border border-white/10 text-xs text-[#878C8F]">
                Angemeldet als{' '}
                <strong className="text-white">{session.username}</strong> (
                {session.role === 'ADMIN' ? 'Admin' : 'Spieler'}). Dein Passwort wird kryptographisch gehasht gespeichert.
              </div>

              {pwMsg && (
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    pwMsg.type === 'success'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-[#73FBD3]'
                      : 'bg-red-950/50 border-red-500/40 text-red-200'
                  }`}
                >
                  {pwMsg.text}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                  Aktuelles Passwort
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                  Neues Passwort (mind. 8 Zeichen)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#C8A273] mb-1">
                  Neues Passwort bestätigen
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] text-xs font-display font-bold uppercase tracking-wider text-white shadow-lg"
              >
                Passwort aktualisieren
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
