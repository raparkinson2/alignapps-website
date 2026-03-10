'use client';

import React, { useState } from 'react';
import { ChevronDown, CheckCircle2, AlertCircle, Circle, ChevronRight, ExternalLink, Calendar } from 'lucide-react';
import { cn, getDueDateColor } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useTeamStore } from '@/lib/store';
import { pushPaymentPeriodToSupabase } from '@/lib/realtime-sync';
import { getPlayerName } from '@/lib/types';
import type { PaymentPeriod, Player, TeamSettings } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface PaymentPeriodCardProps {
  period: PaymentPeriod;
  players: Player[];
  teamSettings: TeamSettings;
  isAdmin: boolean;
}

function formatDueDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try { return format(parseISO(dateStr), 'MMMM d, yyyy'); } catch { return dateStr; }
}

function getDaysOverdue(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  try {
    const due = parseISO(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = differenceInDays(today, due);
    return diff > 0 ? diff : 0;
  } catch { return null; }
}

export default function PaymentPeriodCard({ period, players, teamSettings, isAdmin }: PaymentPeriodCardProps) {
  const [expanded, setExpanded] = useState(false);
  const updatePlayerPayment = useTeamStore((s) => s.updatePlayerPayment);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const paidCount = period.playerPayments.filter((pp) => pp.status === 'paid').length;
  const totalCount = players.length;
  const progressPct = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  // Financials matching mobile
  const totalCollected = period.playerPayments.reduce((sum, pp) => sum + (pp.amount ?? 0), 0);
  const teamTotalOwed = totalCount * period.amount;
  const remainingBalance = teamTotalOwed - totalCollected;

  const dueDateColor = getDueDateColor(period.dueDate);
  const daysOverdue = getDaysOverdue(period.dueDate);
  const isOverdue = daysOverdue !== null && daysOverdue > 0;

  const handleTogglePayment = async (playerId: string) => {
    if (!isAdmin) return;
    const existing = period.playerPayments.find((pp) => pp.playerId === playerId);
    const newStatus: 'paid' | 'unpaid' | 'partial' =
      existing?.status === 'paid' ? 'unpaid' :
      existing?.status === 'partial' ? 'paid' : 'paid';

    updatePlayerPayment(period.id, playerId, newStatus);

    if (activeTeamId) {
      const updatedPeriod = {
        ...period,
        playerPayments: period.playerPayments.some((pp) => pp.playerId === playerId)
          ? period.playerPayments.map((pp) => pp.playerId === playerId ? { ...pp, status: newStatus } : pp)
          : [...period.playerPayments, { playerId, status: newStatus, entries: [] }],
      };
      await pushPaymentPeriodToSupabase(updatedPeriod, activeTeamId);
    }
  };

  const PAYMENT_APP_COLORS: Record<string, string> = {
    venmo: '#3D95CE', paypal: '#003087', cashapp: '#00D632', zelle: '#6D1ED4', applepay: '#1c1c1e',
  };

  const getPaymentUrl = (app: string, username: string): string | null => {
    if (app === 'venmo') return `https://venmo.com/${username.replace('@', '')}`;
    if (app === 'paypal') return `https://paypal.me/${username}`;
    if (app === 'cashapp') return `https://cash.app/$${username.replace('$', '')}`;
    return null;
  };

  return (
    <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl overflow-hidden">
      {/* Card header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-4 hover:bg-[#152236] transition-colors text-left"
      >
        {/* Title + due date row */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white text-lg">{period.title}</h3>
          {period.dueDate && (
            <div className="flex items-center gap-1.5" style={{ color: dueDateColor }}>
              <Calendar size={13} />
              <span className="text-xs font-medium">Due {formatDueDate(period.dueDate)}</span>
            </div>
          )}
        </div>

        {/* Team totals box — matches mobile */}
        <div className={cn(
          'rounded-xl px-3.5 py-3 mb-3 border',
          remainingBalance <= 0 ? 'bg-[#22c55e]/10 border-[#22c55e]/20' : 'bg-amber-500/10 border-amber-500/20'
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-xs', remainingBalance <= 0 ? 'text-[#22c55e]/70' : 'text-amber-400/70')}>Team Total</p>
              <p className={cn('text-lg font-semibold', remainingBalance <= 0 ? 'text-[#22c55e]' : 'text-amber-400')}>${teamTotalOwed.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Collected</p>
              <p className="text-[#22c55e]/90 text-lg font-semibold">${totalCollected.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Remaining</p>
              <p className={cn('text-lg font-semibold', remainingBalance <= 0 ? 'text-[#22c55e]' : 'text-rose-400/90')}>
                ${Math.max(0, remainingBalance).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Amount + progress row */}
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[#22c55e] font-bold">${period.amount}</span>
            <span className="text-slate-500 text-xs ml-1">per player</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">{paidCount}/{totalCount} paid</span>
            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <ChevronDown size={16} className={cn('text-slate-400 transition-transform', expanded && 'rotate-180')} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/10">
          {/* Payment method pill links */}
          {teamSettings.paymentMethods && teamSettings.paymentMethods.length > 0 && (
            <div className="px-4 py-3 border-b border-white/[0.07]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Pay via</p>
              <div className="flex flex-wrap gap-2">
                {teamSettings.paymentMethods.map((pm, i) => {
                  const href = getPaymentUrl(pm.app, pm.username);
                  const color = PAYMENT_APP_COLORS[pm.app] ?? '#334155';
                  const label = pm.displayName || pm.app;
                  const inner = (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                      style={{ backgroundColor: color }}
                    >
                      <ExternalLink size={10} />
                      {label}
                    </span>
                  );
                  if (href) return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{inner}</a>;
                  return (
                    <span key={i} title={pm.app === 'zelle' ? `Zelle: send to ${pm.username}` : `Apple Cash: ${pm.username}`}>
                      {inner}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Player rows — matching mobile style */}
          <div className="divide-y divide-white/[0.05]">
            {players.map((player) => {
              const pp = period.playerPayments.find((p) => p.playerId === player.id);
              const status = pp?.status ?? 'unpaid';
              const paidAmount = pp?.amount ?? 0;
              const balance = period.amount - paidAmount;
              const playerIsOverdue = isOverdue && status !== 'paid';
              const progressPercent = period.amount > 0 ? Math.min(100, (paidAmount / period.amount) * 100) : 0;

              const getStatusText = () => {
                if (period.type === 'league_dues' || !period.type) {
                  if (status === 'paid') return `Paid $${paidAmount || period.amount}`;
                  if (status === 'partial') return `$${balance} remaining · $${paidAmount} paid`;
                  return `$${period.amount} remaining`;
                } else {
                  if (status === 'paid') return `$${paidAmount || period.amount} paid`;
                  if (status === 'partial') return `$${paidAmount} paid · $${balance} remaining`;
                  return 'No payment yet';
                }
              };

              const rowBg =
                status === 'paid' ? 'bg-[#22c55e]/10'
                : status === 'partial' ? 'bg-amber-500/10'
                : 'bg-white/[0.02]';

              const statusColor =
                status === 'paid' ? 'text-[#22c55e]'
                : playerIsOverdue ? 'text-rose-400'
                : status === 'partial' ? 'text-amber-400'
                : 'text-slate-400';

              return (
                <div
                  key={player.id}
                  onClick={() => isAdmin && handleTogglePayment(player.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    rowBg,
                    playerIsOverdue && 'border-l-4 border-rose-500',
                    isAdmin && 'cursor-pointer hover:brightness-110'
                  )}
                >
                  <Avatar player={player} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{getPlayerName(player)}</p>
                      {playerIsOverdue && (
                        <span className="shrink-0 bg-rose-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          {daysOverdue === 0 ? 'Due Today' : `${daysOverdue}d overdue`}
                        </span>
                      )}
                    </div>
                    <p className={cn('text-xs mt-0.5', statusColor)}>{getStatusText()}</p>
                    {status === 'partial' && (
                      <div className="w-full h-1.5 bg-slate-700 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', playerIsOverdue ? 'bg-rose-500' : 'bg-amber-500')}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {status === 'paid' ? (
                      <CheckCircle2 size={24} className="text-[#22c55e]" />
                    ) : playerIsOverdue || status === 'partial' ? (
                      <AlertCircle size={24} className={playerIsOverdue ? 'text-rose-400' : 'text-amber-400'} />
                    ) : (
                      <Circle size={24} className="text-slate-600" />
                    )}
                  </div>
                  <ChevronRight size={16} className="text-slate-600 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
