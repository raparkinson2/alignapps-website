'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Mail, Phone } from 'lucide-react';
import { signInWithEmail } from '@/lib/supabase-auth';
import { getSupabaseClient } from '@/lib/supabase';
import { loadTeamFromSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import { isAlreadyHashed, verifyPassword } from '@/lib/crypto';
import { cn } from '@/lib/utils';

interface PlayerRow {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

interface TeamOption {
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
  isPhone?: boolean;
}

function isPhoneInput(value: string): boolean {
  const digitsOnly = value.replace(/\D/g, '');
  return digitsOnly.length >= 7 && !value.includes('@');
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Multi-team flow
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [pendingIdentifier, setPendingIdentifier] = useState<string | null>(null);
  const [pendingIsPhone, setPendingIsPhone] = useState(false);
  const [step, setStep] = useState<'login' | 'team-select'>('login');

  const setIsLoggedIn = useTeamStore((s) => s.setIsLoggedIn);
  const setCurrentPlayerId = useTeamStore((s) => s.setCurrentPlayerId);
  const setActiveTeamId = useTeamStore((s) => s.setActiveTeamId);
  const setUserEmail = useTeamStore((s) => s.setUserEmail);
  const setUserPhone = useTeamStore((s) => s.setUserPhone);

  const isPhone = isPhoneInput(identifier);

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setAppleLoading(false);
    }
    // On success the browser redirects to Apple — loading stays until redirect
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const supabase = getSupabaseClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
    // On success the browser redirects to Google — loading stays until redirect
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmed = identifier.trim();

    try {
      if (isPhoneInput(trimmed)) {
        // ── Phone login ──────────────────────────────────────────────────────
        const normalized = normalizePhone(trimmed);
        const supabase = getSupabaseClient();

        const { data: phoneRows, error: phoneErr } = await supabase
          .from('players')
          .select('id, team_id, first_name, last_name, roles, password')
          .or(`phone.eq.${normalized},phone.eq.+1${normalized}`);

        if (phoneErr || !phoneRows || phoneRows.length === 0) {
          setError('No account found with this phone number.');
          setLoading(false);
          return;
        }

        // Verify password against the first matching row that has a password
        const rowWithPw = phoneRows.find((r: any) => r.password);
        if (!rowWithPw) {
          setError('No password set for this account. Please use the mobile app to set one.');
          setLoading(false);
          return;
        }

        const storedPw: string = rowWithPw.password;
        let passwordOk = false;
        if (isAlreadyHashed(storedPw)) {
          passwordOk = await verifyPassword(password, storedPw);
        } else {
          // Legacy plain-text password
          passwordOk = storedPw === password;
        }

        if (!passwordOk) {
          setError('Incorrect password.');
          setLoading(false);
          return;
        }

        // Deduplicate by team_id (keep first match per team)
        const seen = new Set<string>();
        const uniqueRows = phoneRows.filter((r: any) => {
          if (seen.has(r.team_id)) return false;
          seen.add(r.team_id);
          return true;
        });

        if (uniqueRows.length === 1) {
          await proceedWithPhonePlayer(uniqueRows[0] as PlayerRow, normalized);
        } else {
          // Multiple teams
          const teamIds = uniqueRows.map((r: any) => r.team_id);
          const { data: teamsData } = await supabase.from('teams').select('id, name').in('id', teamIds);
          const teamNameMap: Record<string, string> = {};
          for (const t of teamsData ?? []) teamNameMap[t.id] = t.name;

          const options: TeamOption[] = (uniqueRows as PlayerRow[]).map((p) => ({
            teamId: p.team_id,
            teamName: teamNameMap[p.team_id] ?? 'Unknown Team',
            playerId: p.id,
            playerName: `${p.first_name} ${p.last_name}`.trim(),
            isPhone: true,
          }));

          setPendingIdentifier(normalized);
          setPendingIsPhone(true);
          setTeamOptions(options);
          setStep('team-select');
          setLoading(false);
        }
      } else {
        // ── Email login ──────────────────────────────────────────────────────
        const email = trimmed;
        const result = await signInWithEmail(email, password);
        if (!result.success || !result.userId) {
          setError(result.error ?? 'Sign in failed');
          setLoading(false);
          return;
        }

        const userId = result.userId;
        const supabase = getSupabaseClient();

        const { data: playerRows, error: playerError } = await supabase
          .from('players')
          .select('id, team_id, first_name, last_name, roles')
          .eq('auth_user_id', userId);

        if (playerError || !playerRows || playerRows.length === 0) {
          // Fallback: look up by email directly (covers players without auth_user_id)
          const { data: emailRows } = await supabase
            .from('players')
            .select('id, team_id, first_name, last_name, roles')
            .eq('email', email.toLowerCase());

          if (!emailRows || emailRows.length === 0) {
            setError('No player account found for this email.');
            setLoading(false);
            return;
          }

          if (emailRows.length === 1) {
            await proceedWithTeam(emailRows[0] as PlayerRow, userId, email);
          } else {
            await showTeamSelector(emailRows as PlayerRow[], userId, email, false);
          }
          return;
        }

        if (playerRows.length === 1) {
          await proceedWithTeam(playerRows[0] as PlayerRow, userId, email);
        } else {
          await showTeamSelector(playerRows as PlayerRow[], userId, email, false);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const showTeamSelector = async (
    rows: PlayerRow[],
    userId: string,
    emailValue: string,
    _isPhone: boolean
  ) => {
    const supabase = getSupabaseClient();
    const teamIds = rows.map((p) => p.team_id);
    const { data: teamsData } = await supabase.from('teams').select('id, name').in('id', teamIds);
    const teamNameMap: Record<string, string> = {};
    for (const t of teamsData ?? []) teamNameMap[t.id] = t.name;

    const options: TeamOption[] = rows.map((p) => ({
      teamId: p.team_id,
      teamName: teamNameMap[p.team_id] ?? 'Unknown Team',
      playerId: p.id,
      playerName: `${p.first_name} ${p.last_name}`.trim(),
    }));

    setPendingUserId(userId);
    setPendingIdentifier(emailValue);
    setPendingIsPhone(false);
    setTeamOptions(options);
    setStep('team-select');
    setLoading(false);
  };

  const proceedWithTeam = async (player: PlayerRow, _userId: string, emailValue: string) => {
    const ok = await loadTeamFromSupabase(player.team_id);
    if (!ok) {
      setError('Failed to load team data. Please try again.');
      setLoading(false);
      return;
    }
    setCurrentPlayerId(player.id);
    setActiveTeamId(player.team_id);
    setUserEmail(emailValue);
    setIsLoggedIn(true);
    router.push('/app/schedule');
  };

  const proceedWithPhonePlayer = async (player: PlayerRow, phone: string) => {
    const ok = await loadTeamFromSupabase(player.team_id);
    if (!ok) {
      setError('Failed to load team data. Please try again.');
      setLoading(false);
      return;
    }
    setCurrentPlayerId(player.id);
    setActiveTeamId(player.team_id);
    setUserPhone(phone);
    setIsLoggedIn(true);
    router.push('/app/schedule');
  };

  const handleTeamSelect = async (option: TeamOption) => {
    if (!pendingIdentifier) return;
    setLoading(true);
    setError(null);

    if (option.isPhone || pendingIsPhone) {
      const playerRow: PlayerRow = {
        id: option.playerId,
        team_id: option.teamId,
        first_name: option.playerName.split(' ')[0] ?? '',
        last_name: option.playerName.split(' ').slice(1).join(' ') ?? '',
        roles: [],
      };
      await proceedWithPhonePlayer(playerRow, pendingIdentifier);
    } else {
      const playerRow: PlayerRow = {
        id: option.playerId,
        team_id: option.teamId,
        first_name: option.playerName.split(' ')[0] ?? '',
        last_name: option.playerName.split(' ').slice(1).join(' ') ?? '',
        roles: [],
      };
      await proceedWithTeam(playerRow, pendingUserId ?? '', pendingIdentifier);
    }
  };

  if (step === 'team-select') {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0f1a2e] border border-white/10 rounded-2xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-100">Select Team</h1>
            <p className="text-slate-400 mt-1 text-sm">You belong to multiple teams. Which would you like to open?</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-4 text-rose-400 text-sm">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            {teamOptions.map((option) => (
              <button
                key={option.teamId}
                onClick={() => handleTeamSelect(option)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-[#67e8f9]/30 transition-all text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-[#67e8f9]/10 flex items-center justify-center text-lg shrink-0">
                  🏆
                </div>
                <div>
                  <p className="font-medium text-slate-100">{option.teamName}</p>
                  <p className="text-xs text-slate-400">{option.playerName}</p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { setStep('login'); setError(null); }}
            className="mt-4 w-full text-center text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#0f1a2e] border border-white/10 rounded-2xl p-8">
        {/* Logo / branding */}
        <div className="flex justify-center mb-8">
          <img src="/align-logo.png" alt="ALIGN Sports" className="w-28 h-28 object-contain" />
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-5 text-rose-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="identifier">
              Email or Phone Number
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                {isPhone ? <Phone size={16} /> : <Mail size={16} />}
              </div>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or (555) 123-4567"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 focus:border-[#67e8f9]/40 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 pr-11 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 focus:border-[#67e8f9]/40 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-3 rounded-xl font-bold text-[#080c14] bg-[#67e8f9] hover:bg-[#67e8f9]/90 transition-colors',
              loading && 'opacity-60 cursor-not-allowed'
            )}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-slate-500 text-xs">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Sign in with Apple */}
        <button
          type="button"
          onClick={handleAppleSignIn}
          disabled={appleLoading || googleLoading}
          className={cn(
            'w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-white bg-black border border-white/20 hover:bg-white/5 transition-colors',
            (appleLoading || googleLoading) && 'opacity-60 cursor-not-allowed'
          )}
        >
          {/* Apple logo SVG */}
          <svg width="18" height="18" viewBox="0 0 814 1000" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.8 135.4-317.9 269-317.9 70.5 0 129.2 46.4 173.8 46.4 42.7 0 109.4-49 188.4-49 30.6 0 108.2 2.6 168.5 80.1zm-198.6-77.5c31.6-36.2 53.9-86.5 53.9-136.8 0-7.1-.6-14.3-1.9-20.1-51.3 1.9-112.3 34.2-149.2 75.8-28.5 32.4-55.1 83.1-55.1 134.1 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 46.4 0 102.7-30.9 136.8-72.4z"/>
          </svg>
          {appleLoading ? 'Redirecting to Apple...' : 'Sign in with Apple'}
        </button>

        {/* Sign in with Google */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={appleLoading || googleLoading}
          className={cn(
            'w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-slate-100 bg-white/[0.06] border border-white/20 hover:bg-white/[0.1] transition-colors mt-2.5',
            (appleLoading || googleLoading) && 'opacity-60 cursor-not-allowed'
          )}
        >
          {/* Google logo SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? 'Redirecting to Google...' : 'Sign in with Google'}
        </button>

        <p className="text-center text-xs text-slate-500 mt-3">
          New player joining a team? Sign in with Apple or Google — no password needed.
        </p>
      </div>
    </div>
  );
}
