'use client';

import React, { useState } from 'react';
import { Plus, Trash2, CreditCard, CheckCircle2, AlertCircle, Zap, ExternalLink } from 'lucide-react';
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

const PAYMENT_APPS: { value: PaymentApp; label: string }[] = [
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'cashapp', label: 'Cash App' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'applepay', label: 'Apple Cash' },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

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
    setNewTitle('');
    setNewAmount('');
    setNewType('misc');
    setNewDueDate('');
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
    const updatedSettings = {
      ...teamSettings,
      paymentMethods: [...(teamSettings.paymentMethods ?? []), pm],
    };
    setTeamSettings(updatedSettings);
    await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
    setNewPmUsername('');
    setSavingPm(false);
  };

  const handleRemovePaymentMethod = async (app: PaymentApp) => {
    if (!activeTeamId) return;
    const updatedSettings = {
      ...teamSettings,
      paymentMethods: (teamSettings.paymentMethods ?? []).filter((p) => p.app !== app),
    };
    setTeamSettings(updatedSettings);
    await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
  };

  const handleStripeConnect = async () => {
    if (!activeTeamId || !currentPlayerId) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/payments/connect/onboard?teamId=${activeTeamId}&adminId=${currentPlayerId}`
      );
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
        {isAdmin && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-medium hover:bg-[#67e8f9]/20 transition-all"
          >
            <Plus size={15} />
            Add Period
          </button>
        )}
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

      {/* Payment periods */}
      {paymentPeriods.length === 0 ? (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-8 text-center mb-6">
          <p className="text-slate-400 text-sm">No payment periods yet</p>
          {isAdmin && (
            <p className="text-slate-500 text-xs mt-1">Add a period to track payments</p>
          )}
        </div>
      ) : (
        <div className="space-y-3 mb-6">
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

      {/* Payment Methods — admin only */}
      {isAdmin && (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">Payment Methods</h2>
          <div className="space-y-2 mb-3">
            {(teamSettings.paymentMethods ?? []).length === 0 && (
              <p className="text-xs text-slate-500">No payment methods added yet</p>
            )}
            {(teamSettings.paymentMethods ?? []).map((pm) => (
              <div key={pm.app} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
                <span className="text-sm text-slate-300 flex-1">{pm.displayName}: {pm.username}</span>
                <button
                  onClick={() => handleRemovePaymentMethod(pm.app)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
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
              placeholder="Username / handle"
              className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm"
            />
            <button
              onClick={handleAddPaymentMethod}
              disabled={savingPm || !newPmUsername.trim()}
              className="px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] hover:bg-[#67e8f9]/20 transition-all disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Stripe Setup — admin only */}
      {isAdmin && (
        <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#635BFF]/10 flex items-center justify-center shrink-0">
              <CreditCard size={17} className="text-[#635BFF]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Stripe Payments</h2>
              <p className="text-xs text-slate-500">Accept payments directly in the app</p>
            </div>
          </div>

          {isStripeConnected ? (
            <div className="flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl px-3 py-2.5 mb-4">
              <CheckCircle2 size={15} className="text-[#22c55e] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#22c55e]">Stripe Connected</p>
                <p className="text-xs text-slate-400 truncate">{teamSettings.stripeAccountId}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-4">
              <AlertCircle size={15} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-400">Setup Required</p>
                <p className="text-xs text-slate-400">Connect a Stripe account to accept payments</p>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-4">
            {[
              { label: 'Players pay dues directly in the app', sub: 'No more chasing payments' },
              { label: 'Funds deposited to your bank account', sub: 'Via your connected Stripe account' },
              { label: 'Stripe processing fee: 2.9% + 30¢', sub: 'Per transaction, billed by Stripe' },
              { label: 'Platform fee: 0.5% per transaction', sub: '' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <Zap size={12} className="text-[#635BFF] shrink-0 mt-1" />
                <div>
                  <p className="text-xs text-slate-300">{item.label}</p>
                  {item.sub && <p className="text-xs text-slate-500">{item.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {stripeError && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 mb-3">{stripeError}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleStripeConnect}
              disabled={stripeLoading}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                'bg-[#635BFF] text-white hover:bg-[#635BFF]/90 disabled:opacity-60'
              )}
            >
              <ExternalLink size={14} />
              {stripeLoading ? 'Loading...' : isStripeConnected ? 'Re-connect Stripe' : 'Connect with Stripe'}
            </button>
            {isStripeConnected && (
              <button
                onClick={handleStripeDisconnect}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>
      )}

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
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPeriod}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold hover:bg-[#67e8f9]/90 transition-all text-sm disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Add Period'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
