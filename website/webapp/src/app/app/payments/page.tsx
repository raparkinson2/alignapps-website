'use client';

import React, { useState } from 'react';
import { Plus, CreditCard, CheckCircle2, AlertCircle, Zap, ExternalLink, Users, X } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { pushPaymentPeriodToSupabase, pushTeamSettingsToSupabase } from '@/lib/realtime-sync';
import { generateId, cn } from '@/lib/utils';
import PaymentPeriodCard from '@/components/payments/PaymentPeriodCard';
import Modal from '@/components/ui/Modal';
import type { PaymentPeriod, PaymentPeriodType, PaymentApp, PaymentMethod } from '@/lib/types';

const PERIOD_TYPES: { value: PaymentPeriodType; label: string }[] = [
  { value: 'league_dues', label: 'League Dues' },
  { value: 'substitute', label: 'Substitute' },
  { value: 'facility_rental', label: 'Facility Rental' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'event', label: 'Event' },
  { value: 'referee', label: 'Referee' },
  { value: 'misc', label: 'Misc' },
];

const PAYMENT_APPS: { value: PaymentApp; label: string; color: string }[] = [
  { value: 'venmo', label: 'Venmo', color: '#3D95CE' },
  { value: 'paypal', label: 'PayPal', color: '#003087' },
  { value: 'cashapp', label: 'Cash App', color: '#00D632' },
  { value: 'zelle', label: 'Zelle', color: '#6D1ED4' },
  { value: 'applepay', label: 'Apple Cash', color: '#1c1c1e' },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

function getPaymentUrl(pm: PaymentMethod): string | null {
  if (pm.app === 'venmo') return `https://venmo.com/${pm.username.replace('@', '')}`;
  if (pm.app === 'paypal') return `https://paypal.me/${pm.username}`;
  if (pm.app === 'cashapp') return `https://cash.app/$${pm.username.replace('$', '')}`;
  return null;
}

export default function PaymentsPage() {
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const addPaymentPeriod = useTeamStore((s) => s.addPaymentPeriod);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const { isAdmin } = usePermissions();

  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newType, setNewType] = useState<PaymentPeriodType>('misc');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment methods state
  const [newPmApp, setNewPmApp] = useState<PaymentApp>('venmo');
  const [newPmUsername, setNewPmUsername] = useState('');
  const [savingPm, setSavingPm] = useState(false);

  // Stripe state
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const activePlayers = players.filter((p) => p.status === 'active');
  const paymentMethods = teamSettings.paymentMethods ?? [];

  const totalOwed = paymentPeriods.reduce((sum, period) => {
    return sum + period.amount * activePlayers.length;
  }, 0);
  const totalCollected = paymentPeriods.reduce((sum, period) => {
    return sum + period.playerPayments.reduce((s2, pp) => {
      if (pp.status === 'paid') return s2 + period.amount;
      if (pp.status === 'partial') return s2 + (pp.amount ?? 0);
      return s2;
    }, 0);
  }, 0);

  const handleAddPeriod = async () => {
    if (!newTitle.trim()) { setFormError('Title is required'); return; }
    if (!newAmount || isNaN(parseFloat(newAmount))) { setFormError('Valid amount is required'); return; }
    if (!activeTeamId) return;
    setSaving(true);
    setFormError(null);
    const period: PaymentPeriod = {
      id: generateId(),
      title: newTitle.trim(),
      amount: parseFloat(newAmount),
      type: newType,
      dueDate: newDueDate || undefined,
      playerPayments: [],
      createdAt: new Date().toISOString(),
    };
    addPaymentPeriod(period);
    await pushPaymentPeriodToSupabase(period, activeTeamId);
    setShowAdd(false);
    setNewTitle(''); setNewAmount(''); setNewType('misc'); setNewDueDate('');
    setSaving(false);
  };

  const handleAddPaymentMethod = async () => {
    if (!newPmUsername.trim() || !activeTeamId) return;
    setSavingPm(true);
    const pm: PaymentMethod = {
      app: newPmApp,
      username: newPmUsername.trim(),
      displayName: PAYMENT_APPS.find((a) => a.value === newPmApp)?.label ?? newPmApp,
    };
    const updatedSettings = { ...teamSettings, paymentMethods: [...paymentMethods, pm] };
    setTeamSettings(updatedSettings);
    await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
    setNewPmUsername('');
    setSavingPm(false);
  };

  const handleRemovePaymentMethod = async (index: number) => {
    if (!activeTeamId) return;
    const updatedSettings = {
      ...teamSettings,
      paymentMethods: paymentMethods.filter((_, i) => i !== index),
    };
    setTeamSettings(updatedSettings);
    await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
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
    try {
      await fetch(`${BACKEND_URL}/api/payments/connect/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: activeTeamId }),
      });
      const updatedSettings = { ...teamSettings, stripeAccountId: undefined, stripeOnboardingComplete: false };
      setTeamSettings(updatedSettings);
      await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
    } catch {
      setStripeError('Failed to disconnect Stripe.');
    }
  };

  const isStripeConnected = !!(teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-slate-100">Payments</h1>
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-500 mb-1">Collected</p>
          <p className="text-2xl font-bold text-[#22c55e]">${totalCollected.toFixed(0)}</p>
        </div>
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-slate-500 mb-1">Total Owed</p>
          <p className="text-2xl font-bold text-slate-100">${totalOwed.toFixed(0)}</p>
        </div>
      </div>

      {/* ── Section 1: Stripe ──────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard size={16} className="text-[#635BFF]" />
            <h2 className="text-[#635BFF] font-semibold text-sm">Pay with Stripe</h2>
          </div>

          <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl overflow-hidden">
            {isStripeConnected ? (
              <>
                {/* Connected status */}
                <div className="flex items-center gap-2 bg-[#22c55e]/10 border-b border-[#22c55e]/20 px-4 py-3">
                  <CheckCircle2 size={15} className="text-[#22c55e] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#22c55e]">Stripe Connected</p>
                    <p className="text-xs text-slate-400 truncate">{teamSettings.stripeAccountId}</p>
                  </div>
                </div>

                {/* Feature bullets */}
                <div className="px-4 py-3 space-y-2 border-b border-white/[0.07]">
                  {[
                    { label: 'Players pay dues directly in the app', sub: 'No more chasing payments' },
                    { label: 'Funds deposited to your bank account', sub: 'Via your connected Stripe account' },
                    { label: 'Stripe processing fee: 2.9% + 30¢', sub: 'Per transaction, billed by Stripe' },
                    { label: 'Platform fee: 0.5% per transaction', sub: '' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap size={12} className="text-[#635BFF] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-300">{item.label}</p>
                        {item.sub && <p className="text-xs text-slate-500">{item.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Buttons */}
                <div className="flex gap-2 px-4 py-3">
                  <button
                    onClick={handleStripeConnect}
                    disabled={stripeLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#635BFF] text-white hover:bg-[#635BFF]/90 disabled:opacity-60 transition-all"
                  >
                    <ExternalLink size={14} />
                    {stripeLoading ? 'Loading...' : 'Re-connect Stripe'}
                  </button>
                  <button
                    onClick={handleStripeDisconnect}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Not connected */}
                <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-3">
                  <AlertCircle size={15} className="text-amber-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-400">Setup Required</p>
                    <p className="text-xs text-slate-400">Connect a Stripe account to accept in-app payments</p>
                  </div>
                </div>

                {/* Feature bullets */}
                <div className="px-4 py-3 space-y-2 border-b border-white/[0.07]">
                  {[
                    { label: 'Players pay dues directly in the app', sub: 'No more chasing payments' },
                    { label: 'Funds deposited to your bank account', sub: 'Via your connected Stripe account' },
                    { label: 'Stripe processing fee: 2.9% + 30¢', sub: 'Per transaction, billed by Stripe' },
                    { label: 'Platform fee: 0.5% per transaction', sub: '' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Zap size={12} className="text-[#635BFF] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-slate-300">{item.label}</p>
                        {item.sub && <p className="text-xs text-slate-500">{item.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                {stripeError && (
                  <p className="text-xs text-rose-400 bg-rose-500/10 border-b border-rose-500/20 px-4 py-2">{stripeError}</p>
                )}

                <div className="px-4 py-3">
                  <button
                    onClick={handleStripeConnect}
                    disabled={stripeLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-[#635BFF] text-white hover:bg-[#635BFF]/90 disabled:opacity-60 transition-all"
                  >
                    <ExternalLink size={14} />
                    {stripeLoading ? 'Loading...' : 'Connect with Stripe'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Section 2: Payment Apps (pills) ───────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ExternalLink size={16} className="text-[#67e8f9]" />
            <h2 className="text-[#67e8f9] font-semibold text-sm">Payment Apps</h2>
          </div>
          {isAdmin && (
            <button
              onClick={() => { /* scroll to add form */ }}
              className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center hover:bg-[#22c55e]/80 transition-all"
            >
              <Plus size={16} className="text-white" />
            </button>
          )}
        </div>

        {paymentMethods.length === 0 ? (
          <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-2">
            <ExternalLink size={28} className="text-slate-700" />
            <p className="text-slate-500 text-sm text-center">
              {isAdmin ? 'Add Venmo, PayPal, Zelle, etc. below' : 'No payment apps configured'}
            </p>
          </div>
        ) : (
          <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Tap to pay externally</p>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((pm, index) => {
                const appInfo = PAYMENT_APPS.find((a) => a.value === pm.app);
                const href = getPaymentUrl(pm);
                const pill = (
                  <div
                    key={index}
                    className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-white text-xs font-medium"
                    style={{ backgroundColor: appInfo?.color ?? '#334155' }}
                  >
                    <ExternalLink size={11} className="text-white/80" />
                    <span>{pm.displayName || appInfo?.label || pm.app}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleRemovePaymentMethod(index)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center hover:bg-rose-400 transition-colors"
                      >
                        <X size={8} className="text-white" />
                      </button>
                    )}
                  </div>
                );

                if (href) {
                  return (
                    <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="relative">
                      {pill}
                    </a>
                  );
                }
                return (
                  <div key={index} className="relative" title={pm.app === 'zelle' ? `Zelle: send to ${pm.username}` : `Apple Cash: send to ${pm.username}`}>
                    {pill}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add payment method form (admin only) */}
        {isAdmin && (
          <div className="mt-3 bg-[#0f1a2e] border border-white/10 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-3">Add payment method</p>
            <div className="flex gap-2">
              <select
                value={newPmApp}
                onChange={(e) => setNewPmApp(e.target.value as PaymentApp)}
                className="bg-[#0d1526] border border-white/10 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
              >
                {PAYMENT_APPS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={newPmUsername}
                onChange={(e) => setNewPmUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddPaymentMethod()}
                placeholder="Username / handle"
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm"
              />
              <button
                onClick={handleAddPaymentMethod}
                disabled={savingPm || !newPmUsername.trim()}
                className="px-3 py-2 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20 transition-all disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 3: Payment Tracking ──────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#a78bfa]" />
            <h2 className="text-[#a78bfa] font-semibold text-sm">Payment Tracking</h2>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-8 h-8 rounded-full bg-[#22c55e] flex items-center justify-center hover:bg-[#22c55e]/80 transition-all"
            >
              <Plus size={16} className="text-white" />
            </button>
          )}
        </div>

        {paymentPeriods.length === 0 ? (
          <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-slate-400 text-sm">No payment periods yet</p>
            {isAdmin && <p className="text-slate-500 text-xs mt-1">Use the + button to create a payment period</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {paymentPeriods.map((period) => (
              <PaymentPeriodCard
                key={period.id}
                period={period}
                players={activePlayers}
                teamSettings={teamSettings}
                isAdmin={isAdmin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add period modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Payment Period" size="md">
        <div className="space-y-4">
          {formError && (
            <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{formError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Spring League Dues"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Amount per player ($) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as PaymentPeriodType)}
              className="w-full bg-[#0d1526] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            >
              {PERIOD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Due Date <span className="text-slate-500">(optional)</span></label>
            <input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">
              Cancel
            </button>
            <button onClick={handleAddPeriod} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold hover:bg-[#67e8f9]/90 transition-all text-sm disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Period'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
