'use client';

import React, { useState, useRef } from 'react';
import {
  Shield, Pencil, Trash2, Plus, AlertTriangle, Trophy, Crown, ChevronRight, ChevronDown,
  Settings, Image as ImageIcon, Palette, Users, UserCog, LayoutList, MessageSquare,
  CreditCard, DollarSign, Beer, Coffee, Download, Archive, X, Calendar, Upload, Link2, BellRing,
  CalendarSync, Copy, Check,
} from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import {
  pushTeamSettingsToSupabase,
  deletePlayerFromSupabase,
} from '@/lib/realtime-sync';
import { cn } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabase';
import { getPlayerName, isCoachOrParent } from '@/lib/types';
import type { Player, TeamSettings } from '@/lib/types';
import AddEditPlayerModal from '@/components/admin/AddEditPlayerModal';
import TeamSettingsForm from '@/components/admin/TeamSettingsForm';
import ExportStatsModal from '@/components/admin/ExportStatsModal';
import TransferOwnershipModal from '@/components/admin/TransferOwnershipModal';
import DangerZoneModal from '@/components/admin/DangerZoneModal';
import InviteLinkModal from '@/components/admin/InviteLinkModal';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';

// ─── Card row component (matches mobile admin card style) ───────────────────

function AdminCard({
  icon: Icon,
  iconColor = 'text-[#67e8f9]',
  iconBg = 'bg-[#67e8f9]/20',
  title,
  subtitle,
  onClick,
  rightContent,
  chevron = true,
}: {
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle: string;
  onClick?: () => void;
  rightContent?: React.ReactNode;
  chevron?: boolean;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 text-left transition-all mb-3',
        onClick && 'hover:bg-[#152236] cursor-pointer'
      )}
    >
      <div className={cn('p-2 rounded-full shrink-0', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
      </div>
      {rightContent}
      {chevron && onClick && <ChevronRight size={20} className="text-slate-600 shrink-0" />}
    </Wrapper>
  );
}

// ─── Toggle card (matches mobile switch rows) ───────────────────────────────

function ToggleCard({
  icon: Icon,
  iconColor = 'text-[#67e8f9]',
  iconBg = 'bg-[#67e8f9]/20',
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="w-full flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 mb-3">
      <div className={cn('p-2 rounded-full shrink-0', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
      </div>
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
  );
}

// ─── Sub-toggle card (indented, matches mobile sub-toggles) ─────────────────

function SubToggleCard({
  icon: Icon,
  iconColor = 'text-amber-400',
  iconBg = 'bg-amber-500/20',
  title,
  subtitle,
  checked,
  onChange,
}: {
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="w-full flex items-center gap-3 bg-[#0f1a2e]/60 border border-white/5 rounded-2xl p-4 mb-3 ml-4">
      <div className={cn('p-2 rounded-full shrink-0', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{title}</p>
        <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
      </div>
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
  );
}

// ─── Section header ─────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-6 first:mt-0">
      {children}
    </p>
  );
}

// ─── Main admin page ────────────────────────────────────────────────────────

export default function AdminPage() {
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const setTeamName = useTeamStore((s) => s.setTeamName);
  const { isAdmin, currentPlayer } = usePermissions();

  // Modal states
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRosterExpanded, setShowRosterExpanded] = useState(false);
  const [showExportStats, setShowExportStats] = useState(false);
  const [showTransferOwnership, setShowTransferOwnership] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [calendarSubscribing, setCalendarSubscribing] = useState(false);
  const [calendarCopied, setCalendarCopied] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);

  // Ownership
  const teamOwnerId = teamSettings.teamOwnerId;
  const isOwner = !teamOwnerId ? isAdmin : teamOwnerId === currentPlayerId;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Shield size={48} className="text-slate-600" />
        <h2 className="text-xl font-bold text-slate-400">Access Denied</h2>
        <p className="text-slate-500 text-sm">You must be an admin to view this page</p>
      </div>
    );
  }

  // Sync helpers
  const syncSettings = (updates: Partial<TeamSettings>) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamSettingsToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
      }, 50);
    }
  };

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowPlayerModal(true);
  };

  const handleDeletePlayer = async (player: Player) => {
    removePlayer(player.id);
    await deletePlayerFromSupabase(player.id);
    setDeletingPlayer(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTeamId) return;
    setUploadingLogo(true);
    try {
      const supabase = getSupabaseClient();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${activeTeamId}/team-logo.${ext}`;
      const arrayBuffer = await file.arrayBuffer();
      await supabase.storage.from('team-photos').upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });
      const { data: urlData } = supabase.storage.from('team-photos').getPublicUrl(path);
      // Append cache-buster so the browser loads the new version
      const url = `${urlData.publicUrl}?t=${Date.now()}`;
      syncSettings({ teamLogo: url });
    } catch (err) {
      console.error('Logo upload failed:', err);
    } finally {
      setUploadingLogo(false);
      // Reset file input so re-selecting the same file triggers onChange
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = () => {
    syncSettings({ teamLogo: undefined });
  };

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
  function adminHeaders(): Record<string, string> {
    const secret = process.env.NEXT_PUBLIC_INTERNAL_API_SECRET;
    if (!secret) return {};
    return { 'x-admin-secret': secret };
  }

  const handleSubscribeCalendar = async () => {
    if (!activeTeamId || calendarSubscribing) return;
    setCalendarSubscribing(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/calendar/generate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ teamId: activeTeamId }),
      });
      if (!res.ok) throw new Error('Failed to generate calendar URL');
      const data = (await res.json()) as { url: string };
      const webcalUrl = data.url.replace(/^https?:\/\//, 'webcal://');
      window.open(webcalUrl, '_self');
    } catch (err) {
      console.error('Calendar subscribe failed:', err);
    } finally {
      setCalendarSubscribing(false);
    }
  };

  const handleCopyCalendarLink = async () => {
    if (!activeTeamId || calendarCopied) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/calendar/generate-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ teamId: activeTeamId }),
      });
      if (!res.ok) throw new Error('Failed to generate calendar URL');
      const data = (await res.json()) as { url: string };
      await navigator.clipboard.writeText(data.url);
      setCalendarCopied(true);
      setTimeout(() => setCalendarCopied(false), 2000);
    } catch (err) {
      console.error('Copy calendar link failed:', err);
    }
  };

  const handleArchiveSeason = async () => {
    if (!activeTeamId || !newSeasonName.trim()) return;
    setArchiving(true);
    const archivedSeason = {
      id: `season-${Date.now()}`,
      seasonName: newSeasonName.trim(),
      sport: teamSettings.sport,
      archivedAt: new Date().toISOString(),
      teamRecord: teamSettings.record ?? { wins: 0, losses: 0, ties: 0 },
      playerStats: players.map((p) => ({
        playerId: p.id,
        playerName: getPlayerName(p),
        jerseyNumber: p.number,
        position: p.position,
        positions: p.positions,
        stats: p.stats,
        goalieStats: p.goalieStats,
        pitcherStats: p.pitcherStats,
      })),
    };
    const updatedSettings = {
      ...teamSettings,
      seasonHistory: [...(teamSettings.seasonHistory ?? []), archivedSeason],
      record: { wins: 0, losses: 0, ties: 0, otLosses: 0 },
      currentSeasonName: '',
    };
    setTeamSettings(updatedSettings);
    await pushTeamSettingsToSupabase(activeTeamId, teamName, updatedSettings);
    setArchiving(false);
    setShowArchiveConfirm(false);
    setNewSeasonName('');
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#a78bfa]/10 flex items-center justify-center">
          <Trophy size={18} className="text-[#a78bfa]" />
        </div>
        <h1 className="text-xl font-bold text-slate-100">Control Panel</h1>
      </div>

      {/* Premium Status Card */}
      {teamSettings.isPremium ? (
        <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Crown size={18} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-400 font-bold text-sm">Premium Active</p>
            <p className="text-emerald-400/70 text-xs mt-0.5">All features unlocked for your team</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <Crown size={18} className="text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-400 font-bold text-sm">Upgrade to Premium</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Stats, records, payments &amp; more</p>
          </div>
          <div className="bg-amber-500/25 rounded-xl px-2.5 py-1 shrink-0">
            <span className="text-amber-400 font-bold text-xs">$49.99/yr</span>
          </div>
        </div>
      )}

      {/* ── Team Identity ──────────────────────────────────────────────── */}
      <SectionHeader>Team Identity</SectionHeader>

      {/* Team Name */}
      <AdminCard
        icon={Settings}
        title="Team Name"
        subtitle={teamName}
        onClick={() => setShowSettingsModal(true)}
      />

      {/* Team Logo */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLogoUpload}
      />
      <div className="w-full flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 mb-3">
        <div className="p-2 rounded-full shrink-0 bg-[#67e8f9]/20">
          <ImageIcon size={20} className="text-[#67e8f9]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Team Logo</p>
          <p className="text-slate-400 text-xs mt-0.5">
            {uploadingLogo ? 'Uploading...' : teamSettings.teamLogo ? 'Tap to change' : 'Tap to add logo'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {teamSettings.teamLogo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={teamSettings.teamLogo}
                alt="Team logo"
                className="w-10 h-10 rounded-full object-cover border border-white/10"
              />
              <button
                onClick={handleRemoveLogo}
                className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => logoInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-all"
              >
                <Pencil size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-white/10 rounded-lg transition-all"
            >
              <Plus size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Jersey Colors */}
      <AdminCard
        icon={Palette}
        title="Jersey Colors"
        subtitle={`${teamSettings.jerseyColors?.length ?? 0} colors configured`}
        onClick={() => setShowSettingsModal(true)}
        rightContent={
          <div className="flex items-center mr-1">
            {(teamSettings.jerseyColors ?? []).slice(0, 3).map((c, i) => (
              <span
                key={`preview-${i}`}
                className="w-6 h-6 rounded-full border-2 border-slate-700 -ml-2 first:ml-0"
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>
        }
      />

      {/* Manage Roster */}
      <AdminCard
        icon={Users}
        title="Manage Roster"
        subtitle={`${players.length} members on roster`}
        onClick={() => setShowRosterExpanded(!showRosterExpanded)}
        rightContent={showRosterExpanded ? <ChevronDown size={20} className="text-slate-600 shrink-0" /> : undefined}
        chevron={!showRosterExpanded}
      />

      {/* Invite to Team */}
      <AdminCard
        icon={Link2}
        title="Invite to Team"
        subtitle="Share a link to join the team"
        iconColor="text-violet-400"
        iconBg="bg-violet-500/20"
        onClick={() => setShowInviteLink(true)}
      />

      {/* Roster expanded */}
      {showRosterExpanded && (
        <div className="mb-3 -mt-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-sm text-slate-400">{players.length} total players</p>
            <button
              onClick={() => { setEditingPlayer(null); setShowPlayerModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] text-sm font-medium hover:bg-[#67e8f9]/20 transition-all"
            >
              <Plus size={15} />
              Add Player
            </button>
          </div>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-xl px-4 py-3 hover:bg-[#152236] transition-all"
              >
                <Avatar player={player} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {getPlayerName(player)}
                    {player.number && !isCoachOrParent(player) && <span className="ml-1 text-slate-500">#{player.number}</span>}
                  </p>
                  <div className="flex gap-1.5 flex-wrap mt-0.5">
                    <span className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded font-medium',
                      player.status === 'active'
                        ? 'bg-[#22c55e]/15 text-[#22c55e]'
                        : 'bg-slate-500/15 text-slate-400'
                    )}>
                      {player.status}
                    </span>
                    {player.roles?.map((role) => (
                      <span key={role} className="text-[10px] px-1.5 py-0.5 rounded bg-[#a78bfa]/15 text-[#a78bfa] font-medium capitalize">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleEditPlayer(player)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
                  >
                    <Pencil size={14} />
                  </button>
                  {player.id !== currentPlayer?.id && (
                    <button
                      onClick={() => setDeletingPlayer(player)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Configuration ──────────────────────────────────────────────── */}
      <SectionHeader>Configuration</SectionHeader>

      {/* Configure Roles */}
      <AdminCard
        icon={UserCog}
        title="Configure Roles"
        subtitle={`${(teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent']).length} roles enabled`}
        onClick={() => setShowSettingsModal(true)}
      />

      {/* Subscribe to Team Calendar */}
      <div className="w-full flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-2xl p-4 mb-3">
        <div className="p-2 rounded-full shrink-0 bg-emerald-500/20">
          <CalendarSync size={20} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Subscribe to Team Calendar</p>
          <p className="text-slate-400 text-xs mt-0.5">Sync all games and events to your calendar app</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyCalendarLink}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-all"
            title="Copy calendar link"
          >
            {calendarCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
          </button>
          <button
            onClick={handleSubscribeCalendar}
            disabled={calendarSubscribing}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            {calendarSubscribing ? 'Opening...' : 'Subscribe'}
          </button>
        </div>
      </div>

      {/* Lineup Management */}
      <ToggleCard
        icon={LayoutList}
        title="Lineup Management"
        subtitle={
          teamSettings.sport === 'hockey'
            ? 'Set forward, defense, and goalie lines'
            : teamSettings.sport === 'basketball'
              ? 'Set starting five and rotations'
              : teamSettings.sport === 'baseball'
                ? 'Set batting order and field positions'
                : 'Set formation and starting lineup'
        }
        checked={teamSettings.showLineups !== false}
        onChange={(v) => syncSettings({ showLineups: v })}
      />

      {/* Softball Mode */}
      {teamSettings.sport === 'softball' && teamSettings.showLineups !== false && (
        <SubToggleCard
          icon={Users}
          title="Softball Mode"
          subtitle="Enable 10th fielder (Short Fielder)"
          checked={teamSettings.isSoftball === true}
          onChange={(v) => syncSettings({ isSoftball: v })}
        />
      )}

      {/* RSVP Auto-Reminders */}
      <ToggleCard
        icon={BellRing}
        title="RSVP Auto-Reminders"
        subtitle="Nudge players who haven't responded 48h and 4h before games"
        checked={teamSettings.autoRemindersEnabled !== false}
        onChange={(v) => syncSettings({ autoRemindersEnabled: v })}
      />

      {/* Team Chat */}
      <ToggleCard
        icon={MessageSquare}
        title="Team Chat"
        subtitle="Enable in-app team messaging"
        checked={teamSettings.showTeamChat !== false}
        onChange={(v) => syncSettings({ showTeamChat: v })}
      />

      {/* Photos */}
      <ToggleCard
        icon={ImageIcon}
        title="Photos"
        subtitle="Share team photos and memories"
        checked={teamSettings.showPhotos !== false}
        onChange={(v) => syncSettings({ showPhotos: v })}
      />

      {/* Payments */}
      <ToggleCard
        icon={DollarSign}
        title="Payments"
        subtitle="Track team dues and payments"
        checked={teamSettings.showPayments !== false}
        onChange={(v) => syncSettings({ showPayments: v })}
      />

      {/* Stripe sub-row */}
      {teamSettings.showPayments !== false && (
        <div className="ml-4 mb-3">
          <div className="flex items-center gap-3 bg-[#0f1a2e]/60 border border-white/5 rounded-2xl p-4">
            <div className="p-2 rounded-full shrink-0" style={{ backgroundColor: '#635BFF20' }}>
              <CreditCard size={20} style={{ color: '#635BFF' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">Setup Stripe</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete
                  ? 'Connected · tap to manage'
                  : 'Let players pay dues in-app'}
              </p>
            </div>
            {teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete && (
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
            )}
            <ChevronRight size={20} className="text-slate-600 shrink-0" />
          </div>
        </div>
      )}

      {/* Refreshments */}
      <ToggleCard
        icon={teamSettings.showRefreshmentDuty !== false && teamSettings.refreshmentDutyIs21Plus ? Beer : Coffee}
        title="Refreshments"
        subtitle="Assign players to bring refreshments"
        checked={teamSettings.showRefreshmentDuty !== false}
        onChange={(v) => syncSettings({ showRefreshmentDuty: v })}
      />

      {/* 21+ sub-toggle */}
      {teamSettings.showRefreshmentDuty !== false && (
        <SubToggleCard
          icon={Beer}
          title="21+ Beverages"
          subtitle={teamSettings.refreshmentDutyIs21Plus ? 'Showing beer mug icon' : 'Showing juice box icon'}
          checked={teamSettings.refreshmentDutyIs21Plus === true}
          onChange={(v) => syncSettings({ refreshmentDutyIs21Plus: v })}
        />
      )}

      {/* ── Performance ────────────────────────────────────────────────── */}
      {teamSettings.showTeamStats !== false && (
        <>
          <SectionHeader>Performance</SectionHeader>

          <AdminCard
            icon={Download}
            title="Export Stats"
            subtitle="Download roster stats as CSV — Premium"
            onClick={() => setShowExportStats(true)}
          />

          <AdminCard
            icon={Archive}
            title="End Season"
            subtitle={
              teamSettings.currentSeasonName
                ? `Archive ${teamSettings.currentSeasonName} and reset stats`
                : 'Archive current stats and start fresh'
            }
            onClick={() => setShowArchiveConfirm(true)}
          />
        </>
      )}

      {/* ── Management ─────────────────────────────────────────────────── */}
      <SectionHeader>Management</SectionHeader>

      {/* Transfer Ownership */}
      {isOwner && (
        <AdminCard
          icon={Crown}
          title="Transfer Ownership"
          subtitle="Hand over team control to another admin or coach"
          onClick={() => setShowTransferOwnership(true)}
        />
      )}

      {/* Danger Zone */}
      <AdminCard
        icon={AlertTriangle}
        title="Danger Zone"
        subtitle="Erase or delete team data"
        onClick={() => setShowDangerZone(true)}
      />

      {/* Bottom spacer */}
      <div className="h-12" />

      {/* ── Modals ─────────────────────────────────────────────────────── */}

      {/* Add/Edit Player Modal */}
      <AddEditPlayerModal
        isOpen={showPlayerModal}
        onClose={() => { setShowPlayerModal(false); setEditingPlayer(null); }}
        player={editingPlayer}
      />

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deletingPlayer}
        onClose={() => setDeletingPlayer(null)}
        title="Delete Player"
        size="sm"
      >
        {deletingPlayer && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Are you sure you want to delete <strong>{getPlayerName(deletingPlayer)}</strong>? This cannot be undone.</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingPlayer(null)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlayer(deletingPlayer)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Team Settings Modal (for team name, jersey colors, roles) */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title="Team Settings"
        size="lg"
      >
        <TeamSettingsForm />
      </Modal>

      {/* Archive Season Modal */}
      <Modal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        title="Archive Season"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-orange-400 text-sm">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>This will save the current season stats and record, then reset everything for a new season.</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Season Name *</label>
            <input
              type="text"
              value={newSeasonName}
              onChange={(e) => setNewSeasonName(e.target.value)}
              placeholder={teamSettings.currentSeasonName || 'e.g. Winter 2025'}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowArchiveConfirm(false)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleArchiveSeason}
              disabled={archiving || !newSeasonName.trim()}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all text-sm disabled:opacity-60"
            >
              {archiving ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Export Stats Modal */}
      <ExportStatsModal isOpen={showExportStats} onClose={() => setShowExportStats(false)} />

      {/* Transfer Ownership Modal */}
      <TransferOwnershipModal isOpen={showTransferOwnership} onClose={() => setShowTransferOwnership(false)} />

      {/* Danger Zone Modal */}
      <DangerZoneModal isOpen={showDangerZone} onClose={() => setShowDangerZone(false)} />
      <InviteLinkModal isOpen={showInviteLink} onClose={() => setShowInviteLink(false)} />
    </div>
  );
}
