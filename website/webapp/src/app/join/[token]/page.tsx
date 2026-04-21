'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Check, Shield, AlertTriangle, Loader2, Download, Smartphone } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TeamInfo {
  teamName: string;
  sport: string;
  playerCount: number;
  requireApproval: boolean;
}

interface JoinResult {
  success: boolean;
  teamName: string;
  pending: boolean;
}

interface ApiError {
  status: number;
  message: string;
}

type PageState = 'loading' | 'form' | 'submitting' | 'success' | 'error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.NEXT_PUBLIC_VIBECODE_BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';

function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    hockey: 'Hockey',
    baseball: 'Baseball',
    softball: 'Softball',
    basketball: 'Basketball',
    soccer: 'Soccer',
    lacrosse: 'Lacrosse',
    football: 'Football',
    volleyball: 'Volleyball',
  };
  return labels[sport] || sport.charAt(0).toUpperCase() + sport.slice(1);
}

function sportEmoji(sport: string): string {
  const emojis: Record<string, string> = {
    hockey: '\uD83C\uDFD2',
    baseball: '\u26BE',
    softball: '\uD83E\uDD4E',
    basketball: '\uD83C\uDFC0',
    soccer: '\u26BD',
    lacrosse: '\uD83E\uDD4D',
    football: '\uD83C\uDFC8',
    volleyball: '\uD83C\uDFD0',
  };
  return emojis[sport] || '\uD83C\uDFC6';
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function JoinPage({ params }: { params: { token: string } }) {
  const { token } = params;

  // Page state
  const [pageState, setPageState] = useState<PageState>('loading');
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [joinResult, setJoinResult] = useState<JoinResult | null>(null);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');

  // Validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // ─── Fetch team info on mount ────────────────────────────────────────────

  const fetchTeamInfo = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/invite/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        setApiError({
          status: res.status,
          message: body.error || 'Something went wrong',
        });
        setPageState('error');
        return;
      }
      const data: TeamInfo = await res.json();
      setTeamInfo(data);
      setPageState('form');
    } catch {
      setApiError({ status: 0, message: 'Unable to reach server. Please check your connection.' });
      setPageState('error');
    }
  }, [token]);

  useEffect(() => {
    fetchTeamInfo();
  }, [fetchTeamInfo]);

  // ─── Form validation ─────────────────────────────────────────────────────

  const errors: Record<string, string> = {};
  if (!firstName.trim()) errors.firstName = 'First name is required';
  if (!lastName.trim()) errors.lastName = 'Last name is required';
  if (!phone.trim() && !email.trim()) errors.contact = 'Phone or email is required';
  if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  const isValid = Object.keys(errors).length === 0;

  function shouldShowError(field: string): boolean {
    return submitAttempted || !!touched[field];
  }

  function markTouched(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  // ─── Submit handler ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!isValid) return;

    setPageState('submitting');
    try {
      const res = await fetch(`${BACKEND_URL}/api/invite/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          jerseyNumber: jerseyNumber.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        setApiError({
          status: res.status,
          message: body.error || 'Something went wrong',
        });
        setPageState('error');
        return;
      }

      const data: JoinResult = await res.json();
      setJoinResult(data);
      setPageState('success');
    } catch {
      setApiError({ status: 0, message: 'Unable to reach server. Please check your connection.' });
      setPageState('error');
    }
  }

  // ─── Error screen ─────────────────────────────────────────────────────────

  function renderError() {
    if (!apiError) return null;

    let title = 'Something went wrong';
    let description = apiError.message;
    let iconColor = 'text-rose-400';
    let bgColor = 'bg-rose-500/10';
    let borderColor = 'border-rose-500/20';

    if (apiError.status === 404) {
      title = 'Invite Not Found';
      description = 'This invite link is invalid or has been deactivated.';
    } else if (apiError.status === 410) {
      title = 'Invite Expired';
      description = apiError.message || 'This invite link has expired or reached its maximum uses.';
      iconColor = 'text-amber-400';
      bgColor = 'bg-amber-500/10';
      borderColor = 'border-amber-500/20';
    } else if (apiError.status === 409) {
      title = 'Already a Member';
      description = "You're already on this team!";
      iconColor = 'text-[#67e8f9]';
      bgColor = 'bg-[#67e8f9]/10';
      borderColor = 'border-[#67e8f9]/20';
    }

    return (
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-2xl ${bgColor} flex items-center justify-center mb-5`}>
          <AlertTriangle size={32} className={iconColor} />
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">{title}</h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs">{description}</p>
        {apiError.status === 409 && (
          <div className="mt-6">
            <p className="text-slate-500 text-xs mb-3">Open the app to view your team</p>
            {renderDownloadButtons()}
          </div>
        )}
      </div>
    );
  }

  // ─── Loading screen ────────────────────────────────────────────────────────

  function renderLoading() {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 size={36} className="text-[#67e8f9] animate-spin mb-4" />
        <p className="text-slate-400 text-sm">Loading invite...</p>
      </div>
    );
  }

  // ─── Success screen ────────────────────────────────────────────────────────

  function renderSuccess() {
    const isPending = joinResult?.pending;

    return (
      <div className="flex flex-col items-center text-center">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${
          isPending ? 'bg-amber-500/10' : 'bg-[#22c55e]/10'
        }`}>
          {isPending ? (
            <Shield size={32} className="text-amber-400" />
          ) : (
            <Check size={32} className="text-[#22c55e]" />
          )}
        </div>

        <h2 className="text-xl font-bold text-slate-100 mb-2">
          {isPending ? 'Request Sent!' : "You're on the team!"}
        </h2>
        <p className="text-slate-400 text-sm leading-relaxed max-w-xs mb-8">
          {isPending
            ? 'The team admin will review your request. You\'ll be notified once approved.'
            : `Welcome to ${joinResult?.teamName || 'the team'}! Download the app to get started.`}
        </p>

        {/* Download the App */}
        <div className="w-full border-t border-white/10 pt-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Smartphone size={18} className="text-[#67e8f9]" />
            <p className="text-slate-300 font-semibold text-sm">Download the App</p>
          </div>
          <p className="text-slate-500 text-xs mb-4">
            Get ALIGN Sports to manage your schedule, stats, and team chat.
          </p>
          {renderDownloadButtons()}
        </div>
      </div>
    );
  }

  // ─── Download buttons ──────────────────────────────────────────────────────

  function renderDownloadButtons() {
    return (
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <a
          href="https://apps.apple.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/[0.07] border border-white/10 hover:bg-white/[0.12] transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-200 fill-current" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          <div className="text-left">
            <p className="text-[10px] text-slate-400 leading-none">Download on the</p>
            <p className="text-sm font-semibold text-slate-100 leading-tight">App Store</p>
          </div>
        </a>
        <a
          href="https://play.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/[0.07] border border-white/10 hover:bg-white/[0.12] transition-all"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-200 fill-current" aria-hidden="true">
            <path d="M3.18 23.75c-.36-.17-.68-.5-.82-.9-.06-.18-.09-.6-.09-10.82V2.15l.12-.27c.15-.35.42-.62.77-.78L3.4 1 8.1 5.7l4.7 4.72-4.73 4.73L3.37 19.87l-.19-.12zm1.63-.16l8.15-8.15 2.57 2.57c-2.42 2.42-7.62 7.56-7.72 7.62-.15.08-.68-.02-1-.04zm8.87-8.87l2.4-2.4c1.86 1.07 3.3 1.93 3.43 2.04.2.18.41.6.41.82 0 .23-.21.64-.42.82-.11.1-1.46.9-3.01 1.79l-2.81 1.63-2.4-2.4 2.4-2.3zM4.9 1.35c.14.01.63.12.82.18l7.6 4.4-2.54 2.54L2.65 .33c.32-.04.65-.03.82-.02l1.43 1.04z" />
          </svg>
          <div className="text-left">
            <p className="text-[10px] text-slate-400 leading-none">Get it on</p>
            <p className="text-sm font-semibold text-slate-100 leading-tight">Google Play</p>
          </div>
        </a>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────

  function renderForm() {
    if (!teamInfo) return null;

    return (
      <>
        {/* Team info header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">{sportEmoji(teamInfo.sport)}</div>
          <h1 className="text-2xl font-bold text-slate-100 mb-1">
            Join {teamInfo.teamName}
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <span className="text-xs text-slate-400 bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1">
              {sportLabel(teamInfo.sport)}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-white/[0.05] border border-white/10 rounded-lg px-2.5 py-1">
              <Users size={12} />
              {teamInfo.playerCount} {teamInfo.playerCount === 1 ? 'player' : 'players'}
            </span>
          </div>
          {teamInfo.requireApproval && (
            <div className="flex items-center justify-center gap-1.5 mt-3 text-amber-400 text-xs">
              <Shield size={13} />
              <span>Admin approval required</span>
            </div>
          )}
        </div>

        {/* Join form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              First Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={() => markTouched('firstName')}
              placeholder="First name"
              className={`w-full bg-white/[0.05] border rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                shouldShowError('firstName') && errors.firstName
                  ? 'border-rose-500/50 focus:ring-rose-500/40'
                  : 'border-white/10 focus:ring-[#67e8f9]/40'
              }`}
            />
            {shouldShowError('firstName') && errors.firstName && (
              <p className="text-rose-400 text-xs mt-1">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Last Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={() => markTouched('lastName')}
              placeholder="Last name"
              className={`w-full bg-white/[0.05] border rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                shouldShowError('lastName') && errors.lastName
                  ? 'border-rose-500/50 focus:ring-rose-500/40'
                  : 'border-white/10 focus:ring-[#67e8f9]/40'
              }`}
            />
            {shouldShowError('lastName') && errors.lastName && (
              <p className="text-rose-400 text-xs mt-1">{errors.lastName}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Phone {!email.trim() && <span className="text-rose-400">*</span>}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => markTouched('contact')}
              placeholder="(555) 123-4567"
              className={`w-full bg-white/[0.05] border rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                shouldShowError('contact') && errors.contact && !phone.trim()
                  ? 'border-rose-500/50 focus:ring-rose-500/40'
                  : 'border-white/10 focus:ring-[#67e8f9]/40'
              }`}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Email {!phone.trim() && <span className="text-rose-400">*</span>}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('contact')}
              placeholder="you@example.com"
              className={`w-full bg-white/[0.05] border rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                (shouldShowError('contact') && errors.contact && !email.trim()) ||
                (shouldShowError('contact') && errors.email)
                  ? 'border-rose-500/50 focus:ring-rose-500/40'
                  : 'border-white/10 focus:ring-[#67e8f9]/40'
              }`}
            />
            {shouldShowError('contact') && errors.email && (
              <p className="text-rose-400 text-xs mt-1">{errors.email}</p>
            )}
          </div>

          {/* Contact validation hint */}
          {shouldShowError('contact') && errors.contact && (
            <p className="text-rose-400 text-xs -mt-2">Phone or email is required</p>
          )}

          {/* Jersey Number */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Jersey Number <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={jerseyNumber}
              onChange={(e) => setJerseyNumber(e.target.value)}
              placeholder="#"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 transition-all"
            />
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={pageState === 'submitting'}
            className="w-full py-3 rounded-xl bg-[#67e8f9] text-[#0a0f1a] font-bold text-sm hover:bg-[#5cd5e6] disabled:opacity-60 disabled:cursor-not-allowed transition-all mt-2"
          >
            {pageState === 'submitting' ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Joining...
              </span>
            ) : teamInfo?.requireApproval ? (
              'Request to Join'
            ) : (
              'Join Team'
            )}
          </button>
        </form>
      </>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ backgroundColor: '#080c14' }}>
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-6 shadow-xl">
          {pageState === 'loading' && renderLoading()}
          {(pageState === 'form' || pageState === 'submitting') && renderForm()}
          {pageState === 'success' && renderSuccess()}
          {pageState === 'error' && renderError()}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by ALIGN Sports
        </p>
      </div>
    </div>
  );
}
