'use client';

import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight, CalendarOff, Link as LinkIcon, BarChart3, TrendingUp,
  Plus, Trash2, X, Bell, BellRing, Mail, HelpCircle, Lightbulb,
  Bug, FileText, ChevronRight, Check, ExternalLink, LogOut,
  UserPlus, Globe, UserCheck, Trophy, Calendar,
  CheckCircle2, Send, ShieldCheck, Eye,
} from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import {
  pushPollToSupabase, deletePollFromSupabase,
  pushTeamLinkToSupabase, deleteTeamLinkFromSupabase,
  pushPlayerToSupabase,
} from '@/lib/realtime-sync';
import { generateId, cn } from '@/lib/utils';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import type { Poll, PollOption, TeamLink, Player } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/supabase-auth';

// ── Shared MenuItem component ──────────────────────────────────────────────────

function MenuItem({
  icon: Icon,
  iconBg = 'bg-[#67e8f9]/10',
  iconColor = 'text-[#67e8f9]',
  label,
  sub,
  badge,
  onClick,
  href,
  danger,
  last = false,
}: {
  icon: React.ElementType;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sub?: string;
  badge?: number;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  last?: boolean;
}) {
  const inner = (
    <div className={cn(
      'flex items-center gap-3 px-4 py-4 transition-colors',
      danger ? 'hover:bg-rose-500/[0.04]' : 'hover:bg-white/[0.03]',
      !last && 'border-b border-white/[0.05]'
    )}>
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', danger ? 'bg-rose-500/10' : iconBg)}>
        <Icon size={20} className={danger ? 'text-rose-400' : iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', danger ? 'text-rose-400' : 'text-slate-100')}>{label}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {badge != null && badge > 0 && (
        <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 mr-1">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <ChevronRight size={16} className="text-slate-600 shrink-0" />
    </div>
  );

  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className="block">{inner}</a>;
  return <button onClick={onClick} className="w-full text-left block">{inner}</button>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">{title}</p>
      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ── My Availability ────────────────────────────────────────────────────────────

function AvailabilityPage({ player, activeTeamId, onBack }: { player: Player; activeTeamId: string | null; onBack: () => void }) {
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [saving, setSaving] = useState(false);

  const unavailable = player.unavailableDates ?? [];
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const toDateStr = (d: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const isUnavailable = (d: number) => unavailable.includes(toDateStr(d));
  const isPast = (d: number) => new Date(viewYear, viewMonth, d) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const toggleDay = async (d: number) => {
    if (isPast(d) || saving) return;
    const ds = toDateStr(d);
    const newDates = isUnavailable(d)
      ? unavailable.filter(x => x !== ds)
      : [...unavailable, ds];
    setSaving(true);
    updatePlayer(player.id, { unavailableDates: newDates });
    if (activeTeamId) await pushPlayerToSupabase({ ...player, unavailableDates: newDates }, activeTeamId);
    setSaving(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">My Availability</h1>
      </div>

      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
            <ChevronRight size={16} className="rotate-180" />
          </button>
          <span className="text-sm font-semibold text-slate-200">{monthName}</span>
          <button onClick={nextMonth} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-slate-600 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const past = isPast(d);
            const unavail = isUnavailable(d);
            const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            return (
              <button
                key={d}
                onClick={() => toggleDay(d)}
                disabled={past}
                className={cn(
                  'aspect-square rounded-xl text-xs font-medium transition-all',
                  past ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
                  unavail
                    ? 'bg-rose-500/25 border border-rose-500/50 text-rose-300 font-bold'
                    : isToday
                    ? 'bg-[#67e8f9]/15 border border-[#67e8f9]/40 text-[#67e8f9]'
                    : 'bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                )}
              >{d}</button>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 mt-4 text-center">Tap a date to mark yourself unavailable</p>
      </div>

      {unavailable.length > 0 && (
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Unavailable Dates</p>
          <div className="flex flex-wrap gap-2">
            {[...unavailable].sort().map(d => (
              <span key={d} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                {new Date(d + 'T12:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })}
                <button
                  onClick={async () => {
                    const newDates = unavailable.filter(x => x !== d);
                    updatePlayer(player.id, { unavailableDates: newDates });
                    if (activeTeamId) await pushPlayerToSupabase({ ...player, unavailableDates: newDates }, activeTeamId);
                  }}
                  className="text-rose-500 hover:text-rose-300 transition-colors"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team Links ─────────────────────────────────────────────────────────────────

function TeamLinksPage({ activeTeamId, currentPlayerId, isAdmin, teamLinks, setTeamLinks, onBack }: {
  activeTeamId: string | null; currentPlayerId: string | null; isAdmin: boolean;
  teamLinks: TeamLink[]; setTeamLinks: (l: TeamLink[]) => void; onBack: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!title.trim() || !url.trim() || !activeTeamId || !currentPlayerId) return;
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) finalUrl = `https://${finalUrl}`;
    setSaving(true);
    const link: TeamLink = { id: generateId(), title: title.trim(), url: finalUrl, createdBy: currentPlayerId, createdAt: new Date().toISOString() };
    setTeamLinks([...teamLinks, link]);
    await pushTeamLinkToSupabase(link, activeTeamId);
    setSaving(false); setShowAdd(false); setTitle(''); setUrl('');
  };

  const handleDelete = async (linkId: string) => {
    setTeamLinks(teamLinks.filter(l => l.id !== linkId));
    await deleteTeamLinkFromSupabase(linkId);
  };

  const subText = teamLinks.length > 0 ? `${teamLinks.length} link${teamLinks.length !== 1 ? 's' : ''}` : 'Add useful links for your team';

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">Team Links</h1>
      </div>

      <p className="text-sm text-slate-500 mb-4">{subText}</p>

      {teamLinks.length === 0 && (
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-8 text-center mb-4">
          <Globe size={32} className="text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No team links yet</p>
          <p className="text-slate-600 text-xs mt-1">Add useful links for your team</p>
        </div>
      )}

      {teamLinks.length > 0 && (
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden mb-4">
          {teamLinks.map((link, i) => (
            <div key={link.id} className={cn('flex items-center gap-3 px-4 py-3.5', i < teamLinks.length - 1 && 'border-b border-white/[0.05]')}>
              <div className="w-9 h-9 rounded-full bg-[#67e8f9]/10 flex items-center justify-center shrink-0">
                <Globe size={16} className="text-[#67e8f9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">{link.title}</p>
                <p className="text-xs text-slate-500 truncate">{link.url}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-slate-500 hover:text-[#67e8f9] hover:bg-[#67e8f9]/10 transition-all">
                  <ExternalLink size={14} />
                </a>
                {isAdmin && (
                  <button onClick={() => handleDelete(link.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <button onClick={() => setShowAdd(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-semibold hover:bg-[#67e8f9]/20 transition-all">
          <Plus size={16} />Add Link
        </button>
      )}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Team Link" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. League Website" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">URL *</label>
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm font-medium hover:text-slate-200 transition-all">Cancel</button>
            <button onClick={handleAdd} disabled={saving || !title.trim() || !url.trim()} className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold text-sm hover:bg-[#67e8f9]/90 transition-all disabled:opacity-60">
              {saving ? 'Saving...' : 'Add Link'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Team Polls ─────────────────────────────────────────────────────────────────

function TeamPollsPage({ activeTeamId, currentPlayerId, isAdmin, polls, setPolls, onBack }: {
  activeTeamId: string | null; currentPlayerId: string | null; isAdmin: boolean;
  polls: Poll[]; setPolls: (p: Poll[]) => void; onBack: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [saving, setSaving] = useState(false);

  const activePolls = polls.filter(p => p.isActive);
  const closedPolls = polls.filter(p => !p.isActive);

  const handleCreate = async () => {
    if (!question.trim() || options.filter(o => o.trim()).length < 2 || !activeTeamId || !currentPlayerId) return;
    setSaving(true);
    const pollOptions: PollOption[] = options.filter(o => o.trim()).map(text => ({ id: generateId(), text: text.trim(), votes: [] }));
    const poll: Poll = { id: generateId(), question: question.trim(), options: pollOptions, createdBy: currentPlayerId, createdAt: new Date().toISOString(), isActive: true, allowMultipleVotes: allowMultiple };
    const newPolls = [poll, ...polls];
    setPolls(newPolls);
    await pushPollToSupabase(poll, activeTeamId);
    setSaving(false); setShowCreate(false); setQuestion(''); setOptions(['', '']); setAllowMultiple(false);
  };

  const handleVote = async (poll: Poll, optionId: string) => {
    if (!currentPlayerId || !activeTeamId) return;
    const updatedPoll = {
      ...poll,
      options: poll.options.map(o => {
        if (o.id === optionId) {
          const hasVoted = o.votes.includes(currentPlayerId);
          return { ...o, votes: hasVoted ? o.votes.filter(v => v !== currentPlayerId) : [...o.votes, currentPlayerId] };
        }
        if (!poll.allowMultipleVotes) return { ...o, votes: o.votes.filter(v => v !== currentPlayerId) };
        return o;
      }),
    };
    setPolls(polls.map(p => p.id === poll.id ? updatedPoll : p));
    await pushPollToSupabase(updatedPoll, activeTeamId);
  };

  const handleClose = async (poll: Poll) => {
    if (!activeTeamId) return;
    const updated = { ...poll, isActive: false };
    setPolls(polls.map(p => p.id === poll.id ? updated : p));
    await pushPollToSupabase(updated, activeTeamId);
  };

  const handleDelete = async (pollId: string) => {
    setPolls(polls.filter(p => p.id !== pollId));
    await deletePollFromSupabase(pollId);
  };

  const PollCard = ({ poll }: { poll: Poll }) => {
    const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
    const hasVoted = poll.options.some(o => o.votes.includes(currentPlayerId ?? ''));
    const showResults = !poll.isActive || hasVoted;
    return (
      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-slate-100 flex-1">{poll.question}</p>
          <div className="flex items-center gap-1 shrink-0">
            {!poll.isActive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-500">Closed</span>}
            {isAdmin && poll.isActive && (
              <button onClick={() => handleClose(poll)} className="text-xs px-2 py-0.5 rounded-lg text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 border border-white/10 transition-all">Close</button>
            )}
            {isAdmin && (
              <button onClick={() => handleDelete(poll.id)} className="p-1 text-slate-600 hover:text-rose-400 transition-colors"><Trash2 size={12} /></button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {poll.options.map(option => {
            const pct = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0;
            const myVote = option.votes.includes(currentPlayerId ?? '');
            return (
              <button key={option.id} onClick={() => poll.isActive && handleVote(poll, option.id)} disabled={!poll.isActive}
                className={cn('w-full relative rounded-xl px-3 py-2.5 text-left text-sm overflow-hidden transition-all', poll.isActive ? 'hover:bg-white/[0.05] cursor-pointer' : 'cursor-default', myVote ? 'border border-[#67e8f9]/30' : 'border border-white/[0.07]')}
              >
                {showResults && <div className={cn('absolute inset-0 rounded-xl', myVote ? 'bg-[#67e8f9]/10' : 'bg-white/[0.03]')} style={{ width: `${pct}%` }} />}
                <span className="relative flex items-center justify-between gap-2">
                  <span className={cn('font-medium', myVote ? 'text-[#67e8f9]' : 'text-slate-300')}>
                    {option.text}{myVote && <Check size={11} className="inline ml-1.5" />}
                  </span>
                  {showResults && <span className="text-xs text-slate-500 shrink-0">{pct}%</span>}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-600 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
      </div>
    );
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
            <ChevronRight size={18} className="rotate-180" />
          </button>
          <h1 className="text-xl font-bold text-slate-100">Team Polls</h1>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-medium hover:bg-[#67e8f9]/20 transition-all">
            <Plus size={14} />Create Poll
          </button>
        )}
      </div>

      {activePolls.length === 0 && closedPolls.length === 0 && (
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-8 text-center">
          <BarChart3 size={32} className="text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No polls yet</p>
          <p className="text-slate-600 text-xs mt-1">Create and vote on team decisions</p>
        </div>
      )}

      {activePolls.length > 0 && <div className="space-y-3 mb-4">{activePolls.map(p => <PollCard key={p.id} poll={p} />)}</div>}
      {closedPolls.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 px-1">Closed Polls</p>
          <div className="space-y-3 opacity-70">{closedPolls.map(p => <PollCard key={p.id} poll={p} />)}</div>
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Poll" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Question *</label>
            <input type="text" value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask the team..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Options</label>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={opt} onChange={e => { const o = [...options]; o[i] = e.target.value; setOptions(o); }} placeholder={`Option ${i + 1}`} className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
                  {options.length > 2 && <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-all"><X size={14} /></button>}
                </div>
              ))}
            </div>
            {options.length < 6 && <button onClick={() => setOptions([...options, ''])} className="mt-2 text-xs text-[#67e8f9] hover:opacity-80 transition-opacity">+ Add option</button>}
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <span className="text-sm text-slate-300">Allow multiple votes</span>
            <button onClick={() => setAllowMultiple(v => !v)} className={cn('w-11 h-6 rounded-full transition-all relative', allowMultiple ? 'bg-[#67e8f9]' : 'bg-slate-700')}>
              <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', allowMultiple ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">Cancel</button>
            <button onClick={handleCreate} disabled={saving || !question.trim() || options.filter(o => o.trim()).length < 2} className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold hover:bg-[#67e8f9]/90 transition-all text-sm disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Poll'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Stats & Analytics ──────────────────────────────────────────────────────────

function StatsAnalyticsPage({ teamSettings, onBack }: { teamSettings: { showTeamStats?: boolean; showTeamRecords?: boolean }; onBack: () => void }) {
  const router = useRouter();
  const items = [
    { icon: UserCheck, label: 'Attendance', sub: 'Track player game attendance', href: '/app/schedule', color: 'text-[#67e8f9]', bg: 'bg-[#67e8f9]/10' },
    ...(teamSettings.showTeamRecords ? [{ icon: Trophy, label: 'Team Records', sub: 'Wins, losses and season records', href: '/app/records', color: 'text-amber-400', bg: 'bg-amber-400/10' }] : []),
    ...(teamSettings.showTeamStats ? [{ icon: BarChart3, label: 'View Team Stats', sub: 'Player and team statistics', href: '/app/stats', color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10' }] : []),
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">Stats and Analytics</h1>
      </div>
      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden">
        {items.map((item, i) => (
          <button key={item.label} onClick={() => router.push(item.href)} className={cn('w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.03] transition-colors', i < items.length - 1 && 'border-b border-white/[0.05]')}>
            <div className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', item.bg)}>
              <item.icon size={20} className={item.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100">{item.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
            </div>
            <ChevronRight size={16} className="text-slate-600" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsPage({ player, activeTeamId, onBack }: { player: Player; activeTeamId: string | null; onBack: () => void }) {
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const prefs = player.notificationPreferences ?? {
    gameInvites: true, gameReminderDayBefore: true, gameReminderHoursBefore: true,
    chatMessages: true, chatMentions: true, paymentReminders: true,
  };

  const toggle = async (key: keyof typeof prefs) => {
    if (typeof prefs[key] !== 'boolean') return;
    const updated = { ...prefs, [key]: !prefs[key] };
    updatePlayer(player.id, { notificationPreferences: updated });
    if (activeTeamId) await pushPlayerToSupabase({ ...player, notificationPreferences: updated }, activeTeamId);
  };

  const sections = [
    {
      title: 'Game Notifications',
      items: [
        { key: 'gameInvites' as const, label: 'Game Invites', sub: "Get notified when you're added to a game" },
        { key: 'gameReminderDayBefore' as const, label: 'Reminder (Day Before)', sub: '24 hour reminder before game' },
        { key: 'gameReminderHoursBefore' as const, label: 'Reminder (2 Hours Before)', sub: '2 hour reminder before game' },
      ],
    },
    {
      title: 'Communication',
      items: [
        { key: 'chatMessages' as const, label: 'Chat Messages', sub: 'New messages in team chat' },
        { key: 'chatMentions' as const, label: '@Mentions', sub: 'When someone mentions you in chat' },
      ],
    },
    {
      title: 'Payments',
      items: [
        { key: 'paymentReminders' as const, label: 'Payment Reminders', sub: 'Reminders for upcoming payments' },
      ],
    },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">Notification Settings</h1>
      </div>
      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.title}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1 mb-2">{section.title}</p>
            <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden">
              {section.items.map((item, i) => (
                <div key={item.key} className={cn('flex items-center justify-between gap-3 px-4 py-4', i < section.items.length - 1 && 'border-b border-white/[0.05]')}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{item.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
                  </div>
                  <button onClick={() => toggle(item.key)} className={cn('w-11 h-6 rounded-full transition-all relative shrink-0', prefs[item.key] ? 'bg-[#67e8f9]' : 'bg-slate-700')}>
                    <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', prefs[item.key] ? 'left-[22px]' : 'left-0.5')} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Email Team ─────────────────────────────────────────────────────────────────

function EmailTeamModal({ isOpen, onClose, players, teamName }: { isOpen: boolean; onClose: () => void; players: Player[]; teamName: string }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const playersWithEmail = players.filter(p => p.email && p.email.trim());
  const allSelected = playersWithEmail.length > 0 && selectedIds.length === playersWithEmail.length;

  const toggleAll = () => setSelectedIds(allSelected ? [] : playersWithEmail.map(p => p.id));
  const toggle = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || selectedIds.length === 0) return;
    setSending(true);
    try {
      const recipientEmails = players.filter(p => selectedIds.includes(p.id) && p.email).map(p => p.email as string);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-team-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({ to: recipientEmails, subject: subject.trim(), body: body.trim(), teamName }),
      });
      if (!res.ok) throw new Error('Failed');
      setSent(true);
      setTimeout(() => { setSent(false); onClose(); setSubject(''); setBody(''); setSelectedIds([]); }, 1800);
    } catch {
      // fallback: open mailto
      const emails = players.filter(p => selectedIds.includes(p.id) && p.email).map(p => p.email!).join(',');
      window.open(`mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
      onClose(); setSubject(''); setBody(''); setSelectedIds([]);
    }
    setSending(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Email Team" size="md">
      {sent ? (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <p className="text-white font-semibold">Email sent!</p>
          <p className="text-slate-400 text-sm">Your message was sent to {selectedIds.length} player{selectedIds.length !== 1 ? 's' : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Team announcement..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Message</label>
            <textarea rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm resize-none" />
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Recipients</label>
              <button onClick={toggleAll} className="text-xs text-[#67e8f9] hover:opacity-80">
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden max-h-44 overflow-y-auto">
              {playersWithEmail.map((p, i) => (
                <button key={p.id} onClick={() => toggle(p.id)}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] transition-colors', i < playersWithEmail.length - 1 && 'border-b border-white/[0.05]')}
                >
                  <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0', selectedIds.includes(p.id) ? 'bg-[#67e8f9] border-[#67e8f9]' : 'border-slate-600')}>
                    {selectedIds.includes(p.id) && <Check size={11} className="text-[#080c14]" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 font-medium">{p.firstName} {p.lastName}</p>
                    <p className="text-xs text-slate-500 truncate">{p.email}</p>
                  </div>
                </button>
              ))}
              {playersWithEmail.length === 0 && <p className="text-slate-500 text-xs text-center py-4">No players have email addresses on file</p>}
            </div>
            <p className="text-xs text-slate-600 mt-1.5">{selectedIds.length} of {playersWithEmail.length} selected</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5">
            <p className="text-blue-400 text-xs">Emails will be sent from noreply@alignapps.com</p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 text-sm font-medium hover:text-slate-200 transition-all">Cancel</button>
            <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim() || selectedIds.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold text-sm hover:bg-[#67e8f9]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Send size={14} />
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────────

function NotificationsViewPage({ onBack }: { onBack: () => void }) {
  const notifications = useTeamStore((s) => s.notifications);
  const markNotificationRead = useTeamStore((s) => s.markNotificationRead);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const myNotifications = notifications.filter(n => n.toPlayerId === currentPlayerId);
  const unreadCount = myNotifications.filter(n => !n.read).length;

  const handleMarkAllRead = () => myNotifications.forEach(n => { if (!n.read) markNotificationRead(n.id); });

  const getIcon = (type: string) => {
    if (type === 'game_invite') return <Calendar size={18} className="text-green-400" />;
    if (type === 'game_reminder') return <BellRing size={18} className="text-amber-400" />;
    return <Bell size={18} className="text-[#67e8f9]" />;
  };

  const getBg = (type: string, read: boolean) => {
    if (read) return 'bg-slate-800/40 border-slate-700/30';
    if (type === 'game_invite') return 'bg-green-500/10 border-slate-700/50';
    if (type === 'game_reminder') return 'bg-amber-500/10 border-slate-700/50';
    return 'bg-[#67e8f9]/10 border-slate-700/50';
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
            <ChevronRight size={18} className="rotate-180" />
          </button>
          <h1 className="text-xl font-bold text-slate-100">Notifications</h1>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors">
            <CheckCircle2 size={14} />Mark all read
          </button>
        )}
      </div>

      {myNotifications.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center">
            <Bell size={36} className="text-slate-600" />
          </div>
          <p className="text-slate-400 font-medium">No notifications yet</p>
          <p className="text-slate-500 text-sm text-center">You&apos;ll see game invites and reminders here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {unreadCount > 0 && <p className="text-[#67e8f9] text-sm font-semibold px-1">{unreadCount} new notification{unreadCount !== 1 ? 's' : ''}</p>}
          {myNotifications.map(n => (
            <button key={n.id} onClick={() => markNotificationRead(n.id)}
              className={cn('w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:brightness-110', getBg(n.type, n.read))}
            >
              <div className={cn('p-2 rounded-full shrink-0', n.read ? 'bg-slate-700/50' : 'bg-slate-800/80')}>
                {getIcon(n.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <p className={cn('text-sm font-semibold', n.read ? 'text-slate-400' : 'text-white')}>{n.title}</p>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-[#67e8f9] shrink-0" />}
                </div>
                <p className={cn('text-xs mb-1', n.read ? 'text-slate-500' : 'text-slate-300')}>{n.message}</p>
                <p className="text-xs text-slate-600">{new Date(n.createdAt).toLocaleDateString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create New Team ────────────────────────────────────────────────────────────

function CreateTeamPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">Create New Team</h1>
      </div>

      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-6 text-center mb-5">
        <div className="w-16 h-16 rounded-full bg-[#67e8f9]/10 flex items-center justify-center mx-auto mb-4">
          <UserPlus size={28} className="text-[#67e8f9]" />
        </div>
        <h2 className="text-white font-bold text-lg mb-2">Start a New Team</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Creating a new team requires signing up for a separate team account. You can manage multiple teams and switch between them in the app.
        </p>
        <a
          href="https://alignapps.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold text-sm hover:bg-[#67e8f9]/90 transition-all"
        >
          <ExternalLink size={15} />
          Create Team on AlignApps.com
        </a>
      </div>

      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Already created a team?</p>
        <p className="text-slate-400 text-sm leading-relaxed">
          If you&apos;ve already created a new team, sign in with your new team credentials or ask your admin to add you. Once added, you&apos;ll be able to switch between teams from the More tab.
        </p>
      </div>
    </div>
  );
}

// ── FAQs ───────────────────────────────────────────────────────────────────────

function FAQsPage({ onBack }: { onBack: () => void }) {
  const faqs = [
    { q: 'How do I check in for a game?', a: 'Go to the Schedule tab, tap on the game you want to check in for, then tap the check-in button next to your name. You can mark yourself as "In" or "Out".' },
    { q: 'How do I set my unavailable dates?', a: "Go to More → My Availability. Here you can select dates when you'll be unavailable. The app will automatically check you out for any games or practices that fall on your unavailable dates." },
    { q: 'How do I create a poll?', a: 'Go to More → Team Polls and tap the "+" button. You can create single or multiple choice polls, set deadlines, and notify team members.' },
    { q: "What's the difference between roles?", a: 'Admins have full access to all features including payments and player management. Coaches can edit player profiles and stats. Captains can manage games and lineups. Parents have view-only access to schedule, roster, and payments.' },
    { q: 'How do I switch between teams?', a: "If you're on multiple teams, go to More → Switch Team. You'll see all teams you belong to and can tap to switch between them." },
    { q: 'How do I delete my account?', a: 'Contact support at rob@alignapps.com to request account deletion. This action is permanent and cannot be undone.' },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all">
          <ChevronRight size={18} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-slate-100">FAQs</h1>
      </div>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-4">
            <p className="text-green-400 font-semibold text-sm mb-2">{faq.q}</p>
            <p className="text-slate-400 text-sm leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature Request ────────────────────────────────────────────────────────────

function FeatureRequestPage({ currentPlayer, onBack }: { currentPlayer: Player | null; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [email, setEmail] = useState(currentPlayer?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !reason.trim()) return;
    setSubmitting(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/send-team-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          to: ['rob@alignapps.com'],
          subject: `Feature Request: ${title.trim()}`,
          body: `Title: ${title.trim()}\n\nDescription:\n${description.trim()}\n\nReason:\n${reason.trim()}\n\nContact: ${email.trim() || 'Not provided'}`,
          teamName: 'Align Sports Web',
        }),
      });
      setSubmitted(true);
      setTitle(''); setDescription(''); setReason('');
    } catch { /* silent */ }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"><ChevronRight size={18} className="rotate-180" /></button>
          <h1 className="text-xl font-bold text-slate-100">Feature Request</h1>
        </div>
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <p className="text-white font-bold text-lg">Request submitted!</p>
          <p className="text-slate-400 text-sm text-center">Thanks for your suggestion. We&apos;ll review it and get back to you.</p>
          <button onClick={() => setSubmitted(false)} className="mt-2 px-5 py-2.5 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-medium hover:bg-[#67e8f9]/20 transition-all">Submit Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"><ChevronRight size={18} className="rotate-180" /></button>
        <h1 className="text-xl font-bold text-slate-100">Feature Request</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Brief title for your request" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description *</label>
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} placeholder="Describe the feature in detail..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Why would this help? *</label>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this feature would be useful..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm" />
        </div>
        <button onClick={handleSubmit} disabled={submitting || !title.trim() || !description.trim() || !reason.trim()}
          className="w-full py-3 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold text-sm hover:bg-[#67e8f9]/90 transition-all disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
      </div>
    </div>
  );
}

// ── Report Bug ─────────────────────────────────────────────────────────────────

function ReportBugPage({ currentPlayer, onBack }: { currentPlayer: Player | null; onBack: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [email, setEmail] = useState(currentPlayer?.email ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/send-team-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          to: ['rob@alignapps.com'],
          subject: `Bug Report: ${title.trim()}`,
          body: `Title: ${title.trim()}\n\nDescription:\n${description.trim()}\n\nSteps to Reproduce:\n${steps.trim() || 'Not provided'}\n\nPlatform: Web\nContact: ${email.trim() || 'Not provided'}`,
          teamName: 'Align Sports Web',
        }),
      });
      setSubmitted(true);
      setTitle(''); setDescription(''); setSteps('');
    } catch { /* silent */ }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"><ChevronRight size={18} className="rotate-180" /></button>
          <h1 className="text-xl font-bold text-slate-100">Report Bug</h1>
        </div>
        <div className="flex flex-col items-center py-16 gap-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <p className="text-white font-bold text-lg">Bug reported!</p>
          <p className="text-slate-400 text-sm text-center">Thanks for letting us know. We&apos;ll look into it.</p>
          <button onClick={() => setSubmitted(false)} className="mt-2 px-5 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm font-medium hover:bg-rose-500/20 transition-all">Report Another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"><ChevronRight size={18} className="rotate-180" /></button>
        <h1 className="text-xl font-bold text-slate-100">Report Bug</h1>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Bug Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the bug" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">What happened? *</label>
          <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what went wrong..." className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Steps to reproduce</label>
          <textarea rows={3} value={steps} onChange={e => setSteps(e.target.value)} placeholder="1. Go to...\n2. Click...\n3. See error" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-sm" />
        </div>
        <button onClick={handleSubmit} disabled={submitting || !title.trim() || !description.trim()}
          className="w-full py-3 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-500/90 transition-all disabled:opacity-50">
          {submitting ? 'Sending...' : 'Submit Bug Report'}
        </button>
      </div>
    </div>
  );
}

// ── Notices ────────────────────────────────────────────────────────────────────

function NoticesPage({ onBack }: { onBack: () => void }) {
  const [permOpen, setPermOpen] = useState(false);
  const [privOpen, setPrivOpen] = useState(false);

  const permSections = [
    { color: 'text-purple-400', title: 'Admin Only', items: ['Access Admin Panel', 'Add/edit/delete games & events', 'Set lineups', 'Send invites', 'Create team links & polls', 'Add/remove players from roster', 'Edit player profiles', 'Create & delete payment periods', 'Connect Stripe', 'Add/remove championships', 'Delete the team'] },
    { color: 'text-[#a78bfa]', title: 'Admin + Captain', items: ['Edit player stats'] },
    { color: 'text-slate-300', title: 'All Players', items: ['RSVP to games & events', 'View schedule', 'View roster', 'Email team', 'Participate in polls', 'View team links', 'Upload & delete own photos', 'Send team chat messages'] },
    { color: 'text-amber-400', title: 'Parents (View Only)', items: ['View schedule', 'View roster', 'View payment status', 'No access to Admin Panel', 'No access to Team Chat'] },
  ];

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"><ChevronRight size={18} className="rotate-180" /></button>
        <h1 className="text-xl font-bold text-slate-100">Notices</h1>
      </div>
      <div className="space-y-3">
        {/* Permissions */}
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden">
          <button onClick={() => setPermOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#a78bfa]/10 flex items-center justify-center">
                <ShieldCheck size={18} className="text-[#a78bfa]" />
              </div>
              <p className="text-sm font-semibold text-slate-100">Permissions Breakdown</p>
            </div>
            <ChevronRight size={16} className={cn('text-slate-600 transition-transform', permOpen && 'rotate-90')} />
          </button>
          {permOpen && (
            <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-4">
              {permSections.map(s => (
                <div key={s.title}>
                  <p className={cn('text-sm font-semibold mb-1.5', s.color)}>{s.title}</p>
                  <ul className="space-y-1">
                    {s.items.map(item => (
                      <li key={item} className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />{item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Privacy Policy */}
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden">
          <button onClick={() => setPrivOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-4 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#67e8f9]/10 flex items-center justify-center">
                <Eye size={18} className="text-[#67e8f9]" />
              </div>
              <p className="text-sm font-semibold text-slate-100">Privacy Policy</p>
            </div>
            <ChevronRight size={16} className={cn('text-slate-600 transition-transform', privOpen && 'rotate-90')} />
          </button>
          {privOpen && (
            <div className="px-4 pb-4 border-t border-white/[0.05] pt-3 space-y-3 text-xs text-slate-400 leading-relaxed">
              <p className="text-[#67e8f9] font-bold text-sm">ALIGN Sports Privacy Policy</p>
              <p className="text-slate-500 text-[11px]">Effective Date: January 1, 2025</p>
              <p>ALIGN Sports (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), operated by ALIGN Apps, provides a team management platform that allows users to manage schedules, track availability, send invites, post announcements, and communicate within teams (the &quot;Services&quot;).</p>
              <p>This Privacy Policy explains how we collect, use, disclose, store, and protect information when you use the ALIGN Sports application.</p>
              <p className="font-semibold text-slate-300">Information We Collect</p>
              <p>We collect information you provide directly (name, email, phone, jersey number), team data (schedules, attendance, payments), and usage data to improve the app.</p>
              <p className="font-semibold text-slate-300">How We Use Your Information</p>
              <p>We use your information to provide and improve our services, send notifications, process payments via Stripe, and communicate with you about your team.</p>
              <p className="font-semibold text-slate-300">Data Security</p>
              <p>We use industry-standard security measures. Payment data is handled exclusively by Stripe (PCI-DSS Level 1 certified). We never store card numbers or CVVs.</p>
              <p className="font-semibold text-slate-300">Contact</p>
              <p>For privacy questions, contact us at <span className="text-[#67e8f9]">rob@alignapps.com</span></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'home' | 'availability' | 'links' | 'polls' | 'stats' | 'notifications' | 'notif-view' | 'create-team' | 'faqs' | 'feature-request' | 'report-bug' | 'notices';

export default function MorePage() {
  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teams = useTeamStore((s) => s.teams);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const switchTeam = useTeamStore((s) => s.switchTeam);
  const polls = useTeamStore((s) => s.polls);
  const setPolls = useTeamStore((s) => s.setPolls);
  const teamLinks = useTeamStore((s) => s.teamLinks);
  const setTeamLinks = useTeamStore((s) => s.setTeamLinks);
  const logout = useTeamStore((s) => s.logout);
  const notifications = useTeamStore((s) => s.notifications);
  const { isAdmin } = usePermissions();
  const router = useRouter();

  const currentPlayer = players.find(p => p.id === currentPlayerId) ?? null;
  const [tab, setTab] = useState<Tab>('home');
  const [showEmailTeam, setShowEmailTeam] = useState(false);

  const otherTeams = useMemo(() => teams.filter(t => t.id !== activeTeamId), [teams, activeTeamId]);
  const unreadCount = notifications.filter(n => n.toPlayerId === currentPlayerId && !n.read).length;

  const handleSignOut = async () => {
    await signOut();
    logout();
    router.push('/login');
  };

  // Sub-pages
  if (tab === 'availability' && currentPlayer) return <AvailabilityPage player={currentPlayer} activeTeamId={activeTeamId} onBack={() => setTab('home')} />;
  if (tab === 'links') return <TeamLinksPage activeTeamId={activeTeamId} currentPlayerId={currentPlayerId} isAdmin={isAdmin} teamLinks={teamLinks} setTeamLinks={setTeamLinks} onBack={() => setTab('home')} />;
  if (tab === 'polls') return <TeamPollsPage activeTeamId={activeTeamId} currentPlayerId={currentPlayerId} isAdmin={isAdmin} polls={polls} setPolls={setPolls} onBack={() => setTab('home')} />;
  if (tab === 'stats') return <StatsAnalyticsPage teamSettings={teamSettings} onBack={() => setTab('home')} />;
  if (tab === 'notifications' && currentPlayer) return <NotificationsPage player={currentPlayer} activeTeamId={activeTeamId} onBack={() => setTab('home')} />;
  if (tab === 'notif-view') return <NotificationsViewPage onBack={() => setTab('home')} />;
  if (tab === 'create-team') return <CreateTeamPage onBack={() => setTab('home')} />;
  if (tab === 'faqs') return <FAQsPage onBack={() => setTab('home')} />;
  if (tab === 'feature-request') return <FeatureRequestPage currentPlayer={currentPlayer} onBack={() => setTab('home')} />;
  if (tab === 'report-bug') return <ReportBugPage currentPlayer={currentPlayer} onBack={() => setTab('home')} />;
  if (tab === 'notices') return <NoticesPage onBack={() => setTab('home')} />;

  // Build link sub-text dynamically
  const linksSubText = teamLinks.length > 0 ? `${teamLinks.length} link${teamLinks.length !== 1 ? 's' : ''}` : 'Add useful links for your team';
  const pollsSubText = 'Create and vote on polls';

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-slate-100 mb-5">More</h1>

      {/* Player profile card */}
      {currentPlayer && (
        <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl p-4 mb-5 flex items-center gap-4">
          <Avatar player={currentPlayer} size="lg" />
          <div className="min-w-0">
            <p className="font-bold text-slate-100 text-base truncate">{currentPlayer.firstName} {currentPlayer.lastName}</p>
            <p className="text-sm text-slate-400 truncate">{teamName}</p>
            {currentPlayer.number && <p className="text-xs text-slate-500 mt-0.5">#{currentPlayer.number}</p>}
          </div>
        </div>
      )}

      {/* TEAM section */}
      <SectionCard title="Team">
        {otherTeams.length > 0 && (
          <>
            {otherTeams.map((team) => (
              <MenuItem
                key={team.id}
                icon={ArrowLeftRight}
                iconBg="bg-[#67e8f9]/10"
                iconColor="text-[#67e8f9]"
                label="Switch Team"
                sub={`You're on ${teams.length} team${teams.length !== 1 ? 's' : ''}`}
                onClick={() => switchTeam(team.id)}
              />
            ))}
          </>
        )}
        <MenuItem icon={CalendarOff} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="My Availability" sub="Set dates you're unavailable" onClick={() => setTab('availability')} />
        <MenuItem icon={LinkIcon} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Team Links" sub={linksSubText} onClick={() => setTab('links')} />
        <MenuItem icon={BarChart3} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Team Polls" sub={pollsSubText} onClick={() => setTab('polls')} />
        <MenuItem icon={TrendingUp} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Stats and Analytics" sub="Attendance and team statistics" onClick={() => setTab('stats')} />
        <MenuItem icon={UserPlus} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Create New Team" sub="Start a new team" onClick={() => setTab('create-team')} last />
      </SectionCard>

      {/* COMMUNICATION & ALERTS section */}
      <SectionCard title="Communication &amp; Alerts">
        <MenuItem icon={Bell} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Notifications" sub="Game invites &amp; reminders" badge={unreadCount} onClick={() => setTab('notif-view')} />
        <MenuItem icon={BellRing} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Notification Settings" sub="Manage push notification preferences" onClick={() => setTab('notifications')} />
        <MenuItem icon={Mail} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Email Team" sub="Send an email to all players" onClick={() => setShowEmailTeam(true)} last />
      </SectionCard>

      {/* SUPPORT section */}
      <SectionCard title="Support">
        <MenuItem icon={HelpCircle} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="FAQs" sub="Frequently asked questions" onClick={() => setTab('faqs')} />
        <MenuItem icon={Lightbulb} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Feature Request" sub="Suggest a new feature" onClick={() => setTab('feature-request')} />
        <MenuItem icon={Bug} iconBg="bg-rose-500/10" iconColor="text-rose-400" label="Report Bug" sub="Let us know about issues" onClick={() => setTab('report-bug')} />
        <MenuItem icon={FileText} iconBg="bg-[#67e8f9]/10" iconColor="text-[#67e8f9]" label="Notices" sub="Policies and additional information" onClick={() => setTab('notices')} last />
      </SectionCard>

      {/* Sign Out */}
      <div className="bg-[#0f1a2e] border border-white/[0.07] rounded-2xl overflow-hidden mb-6">
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 hover:bg-rose-500/[0.04] transition-colors text-left">
          <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
            <LogOut size={20} className="text-rose-400" />
          </div>
          <span className="text-sm font-semibold text-rose-400 flex-1">Sign Out</span>
        </button>
      </div>

      <p className="text-center text-xs text-slate-700 pb-6">AlignApps © {new Date().getFullYear()}</p>

      <EmailTeamModal isOpen={showEmailTeam} onClose={() => setShowEmailTeam(false)} players={players} teamName={teamName} />
    </div>
  );
}
