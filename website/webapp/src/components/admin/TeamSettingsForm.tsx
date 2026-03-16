'use client';

import React, { useState } from 'react';
import {
  Plus, Trash2, AlertTriangle, Check, ChevronRight,
  LayoutList, MessageSquare, Image, CreditCard,
  BarChart2, Trophy, Coffee, Beer, TrendingUp,
  User, UserMinus, UserCog, Users,
  CheckCircle2, AlertCircle, ExternalLink, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { pushTeamSettingsToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import { SPORT_NAMES } from '@/lib/types';
import type { TeamSettings, Sport } from '@/lib/types';

const SPORTS: Sport[] = ['hockey', 'baseball', 'basketball', 'soccer', 'lacrosse', 'softball'];
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

// ── Shared toggle card ─────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  desc,
  checked,
  disabled,
  onChange,
  sub,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  sub?: React.ReactNode;
}) {
  return (
    <div className={cn('space-y-0', disabled && 'opacity-40 pointer-events-none')}>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn('p-2 rounded-full shrink-0', iconBg)}>
              <Icon size={20} className={iconColor} />
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm">{label}</p>
              <p className="text-slate-400 text-xs mt-0.5">{desc}</p>
            </div>
          </div>
          {/* Toggle switch */}
          <button
            type="button"
            onClick={() => onChange(!checked)}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors shrink-0',
              checked ? 'bg-[#22c55e]' : 'bg-slate-700'
            )}
          >
            <span className={cn(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
              checked ? 'left-[22px]' : 'left-0.5'
            )} />
          </button>
        </div>
      </div>
      {/* Sub-toggle indented */}
      {sub}
    </div>
  );
}

function SubFeatureCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  desc,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="ml-6 mt-1.5 bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={cn('p-1.5 rounded-full shrink-0', iconBg)}>
            <Icon size={15} className={iconColor} />
          </div>
          <div className="min-w-0">
            <p className="text-slate-200 font-medium text-xs">{label}</p>
            <p className="text-slate-500 text-[11px] mt-0.5">{desc}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={cn(
            'relative w-9 h-5 rounded-full transition-colors shrink-0',
            checked ? 'bg-[#22c55e]' : 'bg-slate-700'
          )}
        >
          <span className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )} />
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2 mt-5 first:mt-0">
      {children}
    </p>
  );
}

// ── Stripe Setup Modal ─────────────────────────────────────────────────────────

function StripeSetupModal({
  isOpen,
  onClose,
  isConnected,
  stripeAccountId,
  teamName,
  onConnect,
  onDisconnect,
  isLoading,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  isConnected: boolean;
  stripeAccountId?: string;
  teamName: string;
  onConnect: () => void;
  onDisconnect: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#0f172a] border border-slate-700/60 rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-[#635BFF]/20 rounded-xl p-2.5">
              <CreditCard size={20} color="#635BFF" />
            </div>
            <div>
              <p className="text-white font-bold text-base">Stripe Payments</p>
              <p className="text-slate-500 text-xs">{teamName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Status banner */}
          {isConnected ? (
            <div className="flex items-center gap-3 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-4 py-3">
              <CheckCircle2 size={18} className="text-[#22c55e] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[#22c55e] font-semibold text-sm">Stripe Connected</p>
                <p className="text-green-400/70 text-xs truncate mt-0.5">{stripeAccountId}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-amber-400 font-semibold text-sm">Setup Required</p>
                <p className="text-amber-400/70 text-xs mt-0.5">Connect a Stripe account to accept payments</p>
              </div>
            </div>
          )}

          {/* Info rows */}
          <div className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 space-y-3">
            {[
              { label: 'Players pay dues directly in the app', sub: 'No more chasing payments' },
              { label: 'Funds deposited to your bank account', sub: 'Via your connected Stripe account' },
              { label: 'Stripe processing fee applies', sub: '2.9% + 30¢ per transaction, billed by Stripe' },
              { label: 'Small platform fee', sub: '0.5% per transaction' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Zap size={13} className="text-[#635BFF] shrink-0 mt-0.5" />
                <div>
                  <p className="text-slate-200 text-xs font-medium">{item.label}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Action buttons */}
          {isConnected ? (
            <div className="space-y-2">
              <button
                onClick={onConnect}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-[#635BFF] text-white hover:bg-[#635BFF]/90 disabled:opacity-60 transition-all"
              >
                <ExternalLink size={15} />
                {isLoading ? 'Loading...' : 'Re-connect Stripe Account'}
              </button>
              {!confirmDisconnect ? (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  className="w-full py-3 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                >
                  Disconnect Stripe
                </button>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 space-y-2">
                  <p className="text-rose-400 text-xs text-center">Players will no longer be able to pay via Stripe. Continue?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDisconnect(false)} className="flex-1 py-2 rounded-lg text-xs font-medium text-slate-400 bg-slate-700/60 hover:bg-slate-700 transition-all">
                      Cancel
                    </button>
                    <button onClick={() => { onDisconnect(); setConfirmDisconnect(false); }} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-500/90 transition-all">
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-[#635BFF] text-white hover:bg-[#635BFF]/90 disabled:opacity-60 transition-all"
            >
              <CreditCard size={15} />
              {isLoading ? 'Loading...' : 'Connect with Stripe'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Stripe sub-row (indented, clickable) ───────────────────────────────────────

function StripeSubRow({
  isConnected,
  stripeAccountId,
  onClick,
}: {
  isConnected: boolean;
  stripeAccountId?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-6 mt-1.5 w-[calc(100%-1.5rem)] bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 flex items-center justify-between gap-3 hover:bg-slate-700/40 transition-all text-left"
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="p-1.5 rounded-full bg-[#635BFF]/20 shrink-0">
          <CreditCard size={15} className="text-[#635BFF]" />
        </div>
        <div className="min-w-0">
          <p className="text-slate-200 font-medium text-xs">Setup Stripe Payments</p>
          <p className="text-slate-500 text-[11px] mt-0.5 truncate">
            {isConnected ? 'Connected · tap to manage' : 'Let players pay dues in-app'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isConnected && <span className="w-2 h-2 rounded-full bg-green-400" />}
        <ChevronRight size={14} className="text-slate-600" />
      </div>
    </button>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────────

export default function TeamSettingsForm() {
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const setTeamName = useTeamStore((s) => s.setTeamName);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);

  const [localName, setLocalName] = useState(teamName);
  const [localSettings, setLocalSettings] = useState<TeamSettings>({ ...teamSettings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sportWarning, setSportWarning] = useState(false);

  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#ffffff');

  // Stripe modal state
  const [stripeModalOpen, setStripeModalOpen] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const updateLocal = (updates: Partial<TeamSettings>) =>
    setLocalSettings((prev) => ({ ...prev, ...updates }));

  const handleSportChange = (sport: Sport) => {
    if (sport !== localSettings.sport) setSportWarning(true);
    updateLocal({ sport });
  };

  const handleAddJerseyColor = () => {
    if (!newColorName.trim()) return;
    updateLocal({
      jerseyColors: [...(localSettings.jerseyColors ?? []), { name: newColorName.trim(), color: newColorHex }],
    });
    setNewColorName('');
    setNewColorHex('#ffffff');
  };

  const handleRemoveJerseyColor = (name: string) => {
    updateLocal({ jerseyColors: (localSettings.jerseyColors ?? []).filter((c) => c.name !== name) });
  };

  const handleSave = async () => {
    if (!activeTeamId) return;
    setSaving(true);
    setTeamName(localName);
    setTeamSettings(localSettings);
    await pushTeamSettingsToSupabase(activeTeamId, localName, localSettings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleStripeConnect = async () => {
    if (!activeTeamId || !currentPlayerId) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/payments/connect/onboard?teamId=${activeTeamId}&adminId=${currentPlayerId}`);
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not start Stripe onboarding');
      window.open(data.url, '_blank');
    } catch (err: unknown) {
      setStripeError(err instanceof Error ? err.message : 'Could not start Stripe setup. Please try again.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleStripeDisconnect = async () => {
    if (!activeTeamId) return;
    setStripeError(null);
    try {
      await fetch(`${BACKEND_URL}/api/payments/connect/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: activeTeamId }),
      });
      const updatedSettings = { ...teamSettings, stripeAccountId: undefined, stripeOnboardingComplete: false };
      setTeamSettings(updatedSettings);
      setLocalSettings((prev) => ({ ...prev, stripeAccountId: undefined, stripeOnboardingComplete: false }));
      await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
      setStripeModalOpen(false);
    } catch {
      setStripeError('Failed to disconnect Stripe.');
    }
  };

  const isStripeConnected = !!(teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete);

  const f = (key: keyof TeamSettings) => localSettings[key] as boolean | undefined;
  const set = (key: keyof TeamSettings) => (v: boolean) => updateLocal({ [key]: v });

  const roles = [
    { id: 'player' as const,  label: 'Player',  desc: 'Active team member',            icon: User,    iconColor: 'text-green-400',  iconBg: 'bg-green-500/20',  activeBg: 'bg-green-500',  required: true },
    { id: 'reserve' as const, label: 'Reserve', desc: 'Backup / substitute player',     icon: UserMinus, iconColor: 'text-slate-400', iconBg: 'bg-slate-600/20', activeBg: 'bg-slate-500',  required: false },
    { id: 'coach' as const,   label: 'Coach',   desc: 'Team coach (no jersey # needed)',icon: UserCog, iconColor: 'text-[#67e8f9]',  iconBg: 'bg-cyan-500/20',   activeBg: 'bg-cyan-500',   required: false },
    { id: 'parent' as const,  label: 'Parent',  desc: 'Parent / guardian of a player',  icon: Users,   iconColor: 'text-pink-400',   iconBg: 'bg-pink-500/20',   activeBg: 'bg-pink-500',   required: false },
  ];

  const enabledRoles = localSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];

  return (
    <>
      <div className="space-y-1 w-full">

        {/* ── Team Name ─────────────────────────────────────────────────────── */}
        <SectionLabel>Team Identity</SectionLabel>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Team Name</label>
          <input
            type="text"
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
          />
        </div>

        {/* ── Jersey Colors ─────────────────────────────────────────────────── */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Jersey Colors</label>
          <div className="space-y-2 mb-3">
            {(localSettings.jerseyColors ?? []).map((jc) => (
              <div key={jc.name} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
                <span className="w-5 h-5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: jc.color }} />
                <span className="text-sm text-slate-300 flex-1">{jc.name}</span>
                <button onClick={() => handleRemoveJerseyColor(jc.name)} className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="color" value={newColorHex} onChange={(e) => setNewColorHex(e.target.value)} className="w-10 h-10 rounded-xl border border-white/10 bg-transparent cursor-pointer" />
            <input type="text" value={newColorName} onChange={(e) => setNewColorName(e.target.value)} placeholder="Color name" className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
            <button onClick={handleAddJerseyColor} className="px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] hover:bg-[#67e8f9]/20 transition-all">
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* ── Organization ──────────────────────────────────────────────────── */}
        <SectionLabel>Organization</SectionLabel>
        <div className="space-y-1.5 mb-1">
          <FeatureCard
            icon={LayoutList} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
            label="Lineups" desc="Set and manage game lineups"
            checked={f('showLineups') !== false}
            onChange={set('showLineups')}
          />
        </div>

        {/* ── Communication ─────────────────────────────────────────────────── */}
        <SectionLabel>Communication</SectionLabel>
        <div className="space-y-1.5 mb-1">
          <FeatureCard
            icon={MessageSquare} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
            label="Team Chat" desc="Enable in-app team messaging"
            checked={f('showTeamChat') !== false}
            onChange={set('showTeamChat')}
          />
        </div>

        {/* ── Team Features ─────────────────────────────────────────────────── */}
        <SectionLabel>Team Features</SectionLabel>
        <div className="space-y-1.5 mb-1">

          {/* Photos */}
          <FeatureCard
            icon={Image} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
            label="Photos" desc="Share team photos and media"
            checked={f('showPhotos') !== false}
            onChange={set('showPhotos')}
          />

          {/* Payments + Stripe sub-row */}
          <FeatureCard
            icon={CreditCard} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
            label="Payments" desc="Collect dues and track payments"
            checked={f('showPayments') !== false}
            onChange={set('showPayments')}
            sub={f('showPayments') !== false ? (
              <StripeSubRow
                isConnected={isStripeConnected}
                stripeAccountId={teamSettings.stripeAccountId}
                onClick={() => { setStripeError(null); setStripeModalOpen(true); }}
              />
            ) : undefined}
          />

          {/* Stats */}
          <FeatureCard
            icon={BarChart2} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
            label="Team Stats" desc="Track player and team statistics"
            checked={f('showTeamStats') !== false}
            onChange={set('showTeamStats')}
            sub={f('showTeamStats') !== false ? (
              <div className="space-y-1.5">
                <SubFeatureCard
                  icon={TrendingUp} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
                  label="Allow Players to Manage Own Stats" desc="Players can log their own stats"
                  checked={f('allowPlayerSelfStats') === true}
                  onChange={set('allowPlayerSelfStats')}
                />
                <SubFeatureCard
                  icon={Trophy} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
                  label="Team Records" desc="Show wins, losses and season record"
                  checked={f('showTeamRecords') === true}
                  onChange={set('showTeamRecords')}
                />
              </div>
            ) : undefined}
          />

          {/* Refreshments */}
          <FeatureCard
            icon={Coffee} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
            label="Refreshment Duty" desc="Assign and track snack duty"
            checked={f('showRefreshmentDuty') !== false}
            onChange={set('showRefreshmentDuty')}
            sub={f('showRefreshmentDuty') !== false ? (
              <SubFeatureCard
                icon={Beer} iconColor="text-[#67e8f9]" iconBg="bg-[#67e8f9]/20"
                label="21+ Beverages (show beer mug)" desc="Show beer mug icon for adult beverages"
                checked={f('refreshmentDutyIs21Plus') === true}
                onChange={set('refreshmentDutyIs21Plus')}
              />
            ) : undefined}
          />
        </div>

        {/* ── Roles ─────────────────────────────────────────────────────────── */}
        <SectionLabel>Roles</SectionLabel>
        <p className="text-xs text-slate-500 mb-3 px-1">Select which roles are available when adding or editing players.</p>
        <div className="space-y-2 mb-1">
          {roles.map((role) => {
            const isEnabled = enabledRoles.includes(role.id);
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => {
                  if (role.required) return;
                  const next = isEnabled
                    ? enabledRoles.filter((r) => r !== role.id)
                    : [...enabledRoles, role.id];
                  updateLocal({ enabledRoles: next });
                }}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all',
                  isEnabled
                    ? `${role.iconBg} border-slate-600/60`
                    : 'bg-slate-800/50 border-slate-700/50',
                  role.required ? 'cursor-not-allowed' : 'hover:brightness-110'
                )}
              >
                <div className={cn('p-2 rounded-full shrink-0', role.iconBg)}>
                  <role.icon size={20} className={role.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-semibold text-sm', isEnabled ? 'text-white' : 'text-slate-500')}>
                    {role.label}
                    {role.required && <span className="text-slate-500 font-normal text-xs ml-1">(Required)</span>}
                  </p>
                  <p className={cn('text-xs mt-0.5', isEnabled ? 'text-slate-400' : 'text-slate-600')}>{role.desc}</p>
                </div>
                <div className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all',
                  isEnabled ? `${role.activeBg} border-transparent` : 'border-slate-600'
                )}>
                  {isEnabled && <Check size={13} className="text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Save ──────────────────────────────────────────────────────────── */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'w-full py-3 rounded-xl font-bold text-sm transition-all',
              saved ? 'bg-[#22c55e] text-white' : 'bg-[#67e8f9] text-[#080c14] hover:bg-[#67e8f9]/90',
              saving && 'opacity-60 cursor-not-allowed'
            )}
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* ── Stripe Setup Modal ─────────────────────────────────────────────── */}
      <StripeSetupModal
        isOpen={stripeModalOpen}
        onClose={() => setStripeModalOpen(false)}
        isConnected={isStripeConnected}
        stripeAccountId={teamSettings.stripeAccountId}
        teamName={teamName}
        onConnect={handleStripeConnect}
        onDisconnect={handleStripeDisconnect}
        isLoading={stripeLoading}
        error={stripeError}
      />
    </>
  );
}
