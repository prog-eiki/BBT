'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { BBT_TEAM_INFO } from '@/lib/valorant-data';
import type { PublicUserSession } from '@/types/hq';

interface RosterUsernameInfo {
  username: string;
  displayName: string;
  role: 'ADMIN' | 'PLAYER';
  hasPassword: boolean;
}

interface LoginGatewayProps {
  isInitialSetupNeeded: boolean;
  rosterUsernames: RosterUsernameInfo[];
  onAuthenticated: (session: PublicUserSession, token?: string) => void;
}

export const LoginGateway: React.FC<LoginGatewayProps> = ({
  isInitialSetupNeeded,
  rosterUsernames,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'CLAIM_INVITE' | 'INITIAL_SETUP'>(
    isInitialSetupNeeded ? 'INITIAL_SETUP' : 'LOGIN'
  );

  const [username, setUsername] = useState(
    isInitialSetupNeeded ? 'Lunar' : ''
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupResultInvites, setSetupResultInvites] = useState<
    Array<{ username: string; inviteCode: string }> | null
  >(null);
  const [pendingSession, setPendingSession] = useState<{
    session: PublicUserSession;
    token?: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LOGIN',
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsInviteClaim) {
          setMode('CLAIM_INVITE');
        }
        throw new Error(data.error || 'Anmeldung fehlgeschlagen.');
      }
      onAuthenticated(data.session, data.token);
    } catch (err: any) {
      setError(err.message || 'Fehler bei der Anmeldung.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Das Admin-Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Die eingegebenen Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'INITIAL_ADMIN_SETUP',
          username: username.trim() || 'Lunar',
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ersteinrichtung fehlgeschlagen.');
      }
      setSetupResultInvites(data.memberInvites || []);
      setPendingSession({ session: data.session, token: data.token });
    } catch (err: any) {
      setError(err.message || 'Fehler bei der Admin-Ersteinrichtung.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !inviteCode.trim()) {
      setError('Bitte Benutzernamen und Einladungs-/Reset-Code eingeben.');
      return;
    }
    if (password.length < 8) {
      setError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLAIM_INVITE_OR_RESET',
          username: username.trim(),
          code: inviteCode.trim(),
          newPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Code konnte nicht eingelöst werden.');
      }
      onAuthenticated(data.session, data.token);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Setzen des Passworts.');
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-[#07080A] text-[#ECE8E1] flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Atmospheric Dark Red & Tactical Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 15%, rgba(158, 20, 27, 0.25) 0%, rgba(7, 8, 10, 0.92) 55%, #07080A 100%)',
        }}
      />
      <div className="absolute inset-0 bg-tactical-grid opacity-40 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Top Accent Line */}
        <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#9E141B]" />

        <div className="bg-[#0E1015]/95 border border-white/10 rounded-b-2xl shadow-[0_28px_90px_rgba(0,0,0,0.95)] p-6 sm:p-8 backdrop-blur-xl">
          {/* Original BBT Logo & Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              <div className="absolute -inset-3 rounded-full bg-[#9E141B]/25 blur-xl" />
              <img
                src={BBT_TEAM_INFO.logoUrl}
                alt="BigBlackTea Original Logo"
                className="relative w-20 h-20 object-contain drop-shadow-[0_6px_20px_rgba(158,20,27,0.6)]"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.25em] text-[#C8A273] mb-1">
              <span>BIGBLACKTEA • BBT</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-wider text-white">
              BIGBLACKTEA MEMBER LOGIN
            </h1>
            <p className="text-xs text-[#878C8F] mt-1">
              Premier Team HQ • Strategie, Lineups, Statistiken & Scouting
            </p>
          </div>

          {/* Post-Setup Invite Codes Handout Screen */}
          {setupResultInvites && pendingSession ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#73FBD3] shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-100 leading-relaxed">
                  <strong className="block text-[#73FBD3] font-semibold mb-0.5">
                    Admin-Konto ({pendingSession.session.username}) erfolgreich eingerichtet!
                  </strong>
                  Für die übrigen 5 Teammitglieder wurden einmalige Einladungscodes generiert. Du kannst diese Codes jetzt kopieren oder später jederzeit in der Benutzerverwaltung einsehen.
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {setupResultInvites.map((item) => (
                  <div
                    key={item.username}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#14171F] border border-white/10"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">
                        {item.username}
                      </div>
                      <div className="text-[11px] font-mono text-[#C8A273]">
                        {item.inviteCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyInvite(item.inviteCode)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#ECE8E1] flex items-center gap-1.5 transition"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#C8A273]" />
                      <span>
                        {copiedCode === item.inviteCode ? 'Kopiert!' : 'Kopieren'}
                      </span>
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  onAuthenticated(pendingSession.session, pendingSession.token)
                }
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-sm shadow-[0_0_25px_rgba(158,20,27,0.5)] transition"
              >
                Weiter zum BBT Dashboard →
              </button>
            </div>
          ) : (
            <>
              {/* Mode Switch Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#090A0E] border border-white/10 mb-5">
                {isInitialSetupNeeded ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('INITIAL_SETUP');
                      setError(null);
                    }}
                    className={`col-span-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                      mode === 'INITIAL_SETUP'
                        ? 'bg-[#9E141B] text-white shadow'
                        : 'text-[#878C8F] hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Sichere Admin-Ersteinrichtung</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('LOGIN');
                        setError(null);
                      }}
                      className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                        mode === 'LOGIN'
                          ? 'bg-[#9E141B] text-white shadow'
                          : 'text-[#878C8F] hover:text-white'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Mitglieder-Login</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('CLAIM_INVITE');
                        setError(null);
                      }}
                      className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition ${
                        mode === 'CLAIM_INVITE'
                          ? 'bg-[#9E141B] text-white shadow'
                          : 'text-[#878C8F] hover:text-white'
                      }`}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Einladung / Reset</span>
                    </button>
                  </>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Quick Team Member Selector Chips */}
              <div className="mb-4">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#878C8F] mb-1.5">
                  Teammitglied schnell auswählen:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(rosterUsernames.length > 0
                    ? rosterUsernames
                    : [
                        { username: 'Lunar', displayName: 'Lunar', role: 'ADMIN', hasPassword: false },
                        { username: 'Kuronami', displayName: 'Kuronami', role: 'PLAYER', hasPassword: false },
                        { username: 'fydi', displayName: 'fydi', role: 'PLAYER', hasPassword: false },
                        { username: 'XJoshHD', displayName: 'XJoshHD', role: 'PLAYER', hasPassword: false },
                        { username: 'XxSensenmanX', displayName: 'XxSensenmanX', role: 'PLAYER', hasPassword: false },
                        { username: 'ShadowLina', displayName: 'ShadowLina', role: 'PLAYER', hasPassword: false },
                      ]
                  ).map((member) => {
                    const active =
                      username.trim().toLowerCase() ===
                      member.username.toLowerCase();
                    return (
                      <button
                        key={member.username}
                        type="button"
                        onClick={() => setUsername(member.username)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
                          active
                            ? 'bg-[#9E141B]/30 border-[#9E141B] text-white'
                            : 'bg-[#14171F] border-white/10 text-[#878C8F] hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span>{member.username}</span>
                        {member.role === 'ADMIN' && (
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#C8A273]/20 text-[#C8A273]">
                            ADMIN
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {mode === 'INITIAL_SETUP' && (
                <form onSubmit={handleInitialSetupSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-[#9E141B]/15 border border-[#C8A273]/30 text-xs text-[#ECE8E1] leading-relaxed">
                    <div className="flex items-center gap-1.5 font-bold text-[#C8A273] mb-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ersteinrichtung des ersten Admins</span>
                    </div>
                    Es ist kein Standardpasswort hinterlegt. Lege jetzt dein persönliches Admin-Passwort fest, um das BBT Team HQ freizuschalten.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Admin-Benutzername
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="z. B. Lunar"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Neues Admin-Passwort (mind. 8 Zeichen)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Sicheres Passwort wählen..."
                        required
                        minLength={8}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878C8F] hover:text-white"
                        aria-label="Passwort ein-/ausblenden"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Passwort bestätigen
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen..."
                      required
                      minLength={8}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-sm shadow-[0_0_25px_rgba(158,20,27,0.5)] transition disabled:opacity-50"
                  >
                    {loading
                      ? 'Richte Admin-Konto ein...'
                      : 'Admin-Konto einrichten & Anmelden'}
                  </button>
                </form>
              )}

              {mode === 'LOGIN' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Benutzername
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="z. B. Lunar, Kuronami, fydi..."
                      required
                      autoComplete="username"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Dein persönliches Passwort"
                        required
                        autoComplete="current-password"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878C8F] hover:text-white"
                        aria-label="Passwort ein-/ausblenden"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(158,20,27,0.5)] transition disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{loading ? 'Prüfe Zugangsdaten...' : 'Anmelden'}</span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('CLAIM_INVITE');
                        setError(null);
                      }}
                      className="text-xs text-[#878C8F] hover:text-[#C8A273] transition"
                    >
                      Einladungscode erhalten oder Passwort zurücksetzen?
                    </button>
                  </div>
                </form>
              )}

              {mode === 'CLAIM_INVITE' && (
                <form onSubmit={handleClaimInviteSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-[#878C8F] leading-relaxed">
                    Gib deinen Benutzernamen und den vom Admin erhaltenen Einladungs- oder Zurücksetzungscode (`BBT-XXXX-...`) ein, um dein persönliches Passwort festzulegen.
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Benutzername
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Dein BBT Benutzername"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Einladungs- / Zurücksetzungscode
                    </label>
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="BBT-XXXX-XXXX-XXXX"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm font-mono text-[#73FBD3] focus:outline-none focus:border-[#9E141B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Neues eigenes Passwort (mind. 8 Zeichen)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Neues Passwort..."
                        required
                        minLength={8}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878C8F] hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-[#C8A273] mb-1.5">
                      Passwort bestätigen
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen..."
                      required
                      minLength={8}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#090A0E] border border-white/15 text-sm text-white focus:outline-none focus:border-[#9E141B]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#9E141B] to-[#C81D25] hover:from-[#B5171F] hover:to-[#E0242E] text-white font-display font-bold uppercase tracking-wider text-sm shadow-[0_0_25px_rgba(158,20,27,0.5)] transition disabled:opacity-50"
                  >
                    {loading ? 'Speichere Passwort...' : 'Passwort speichern & Anmelden'}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
