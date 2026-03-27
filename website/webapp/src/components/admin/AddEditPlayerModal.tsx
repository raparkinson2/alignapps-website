'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { cn, generateId } from '@/lib/utils';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import { SPORT_POSITIONS, SPORT_POSITION_NAMES } from '@/lib/types';
import type { Player, PlayerRole, PlayerStatus } from '@/lib/types';

interface AddEditPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  player?: Player | null;
}

const emptyForm = {
  firstName: '',
  lastName: '',
  number: '',
  email: '',
  phone: '',
  positions: [] as string[],
  status: 'active' as PlayerStatus,
  isInjured: false,
  isSuspended: false,
  statusEndDate: '',
  roles: [] as PlayerRole[],
};

// Role config: colours + icons matching mobile
const ROLE_CONFIG: Record<string, { label: string; activeClass: string; iconText?: string; emoji?: string }> = {
  captain:  { label: 'Captain',  activeClass: 'bg-amber-500 text-white',   iconText: 'C' },
  admin:    { label: 'Admin',    activeClass: 'bg-[#a78bfa] text-white',   emoji: '🛡️' },
  coach:    { label: 'Coach',    activeClass: 'bg-[#67e8f9] text-[#080c14]', emoji: '🎽' },
  parent:   { label: 'Parent',   activeClass: 'bg-pink-500 text-white',    emoji: '👨‍👧' },
};

export default function AddEditPlayerModal({ isOpen, onClose, player }: AddEditPlayerModalProps) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);

  const sport = teamSettings.sport;
  const positions = SPORT_POSITIONS[sport] ?? [];
  const positionNames = SPORT_POSITION_NAMES[sport] ?? {};

  // Which roles are enabled for this team (always include admin + captain)
  const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
  const showCoach = enabledRoles.includes('coach');
  const showParent = enabledRoles.includes('parent');
  // Captain and Admin are always available
  const availableRoles: PlayerRole[] = [
    'captain',
    'admin',
    ...(showCoach ? ['coach' as PlayerRole] : []),
    ...(showParent ? ['parent' as PlayerRole] : []),
  ];

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (player) {
      const isCoach = player.roles?.includes('coach') || player.position === 'Coach';
      const isParent = player.roles?.includes('parent') || player.position === 'Parent';
      // Filter out role-specific pseudo-positions from stored positions array
      const cleanPositions = (player.positions ?? (player.position ? [player.position] : []))
        .filter((p) => p !== 'Coach' && p !== 'Parent');
      setForm({
        firstName: player.firstName,
        lastName: player.lastName,
        number: (isCoach || isParent) ? '' : (player.number ?? ''),
        email: player.email ?? '',
        phone: player.phone ?? '',
        positions: cleanPositions,
        status: player.status,
        isInjured: player.isInjured ?? false,
        isSuspended: player.isSuspended ?? false,
        statusEndDate: player.statusEndDate ?? '',
        roles: player.roles ?? [],
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [player, isOpen]);

  const set = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const togglePosition = (pos: string) => {
    setForm((prev) => ({
      ...prev,
      positions: prev.positions.includes(pos)
        ? prev.positions.filter((p) => p !== pos)
        : [...prev.positions, pos],
    }));
  };

  const toggleRole = (role: PlayerRole) => {
    if (role === 'admin' && player?.id === currentPlayerId && player?.roles.includes('admin')) return;
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const toggleStatus = (field: 'isInjured' | 'isSuspended') => {
    setForm((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    if (!form.firstName.trim()) { setError('First name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!activeTeamId) { setError('No active team'); return; }

    setSaving(true);
    setError(null);

    try {
      const isCoachRole = form.roles.includes('coach');
      const isParentRole = form.roles.includes('parent');
      // Strip any role-specific pseudo-positions
      const cleanPositions = form.positions.filter((p) => p !== 'Coach' && p !== 'Parent');
      const primaryPos = isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : (cleanPositions[0] ?? ''));
      const updatedPlayer: Player = {
        id: player?.id ?? generateId(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        number: (isCoachRole || isParentRole) ? '' : form.number.trim(),
        position: primaryPos,
        positions: isCoachRole ? ['Coach'] : (isParentRole ? ['Parent'] : cleanPositions),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        status: form.status,
        roles: form.roles,
        isInjured: form.isInjured,
        isSuspended: form.isSuspended,
        statusEndDate: form.statusEndDate || undefined,
        avatar: player?.avatar,
        stats: player?.stats,
        goalieStats: player?.goalieStats,
        pitcherStats: player?.pitcherStats,
        gameLogs: player?.gameLogs ?? [],
        unavailableDates: player?.unavailableDates ?? [],
      };

      if (player) {
        updatePlayer(player.id, updatedPlayer);
      } else {
        addPlayer(updatedPlayer);
      }
      const result = await pushPlayerToSupabase(updatedPlayer, activeTeamId);
      if (!result.success) {
        // Roll back local store change on failure
        if (player) {
          updatePlayer(player.id, player);
        } else {
          useTeamStore.getState().removePlayer(updatedPlayer.id);
        }
        setError(`Failed to save player: ${result.error ?? 'Unknown error'}`);
        setSaving(false);
        return;
      }
      onClose();
    } catch {
      setError('Failed to save player. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isSelfAdmin = (role: PlayerRole) =>
    role === 'admin' && player?.id === currentPlayerId && (player?.roles ?? []).includes('admin');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={player ? 'Edit Player' : 'Add Player'} size="lg">
      <div className="space-y-5">
        {error && (
          <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</p>
        )}

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">First Name *</label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Last Name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
        </div>

        {/* Jersey Number */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Jersey Number</label>
          <input
            type="text"
            value={form.number}
            onChange={(e) => set('number', e.target.value)}
            placeholder="e.g. 17"
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
          />
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="player@email.com"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="(555) 000-0000"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
            />
          </div>
        </div>

        {/* Positions — single scrollable row */}
        {positions.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Position(s)</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {positions.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => togglePosition(pos)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all whitespace-nowrap',
                    form.positions.includes(pos)
                      ? 'border-[#67e8f9]/50 bg-[#67e8f9]/10 text-[#67e8f9]'
                      : 'border-white/10 text-slate-400 hover:border-white/20'
                  )}
                >
                  {pos}
                  {positionNames[pos] && (
                    <span className="ml-1 text-[10px] opacity-60">({positionNames[pos]})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Player Status — 2×2 grid matching mobile */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Player Status</label>
          {/* Row 1: Active / Reserve */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            {(['active', 'reserve'] as PlayerStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('status', s)}
                className={cn(
                  'py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all',
                  form.status === s
                    ? s === 'active'
                      ? 'bg-[#22c55e] text-white'
                      : 'bg-slate-600 text-white'
                    : 'bg-white/[0.05] border border-white/10 text-slate-400 hover:border-white/20'
                )}
              >
                {form.status === s && <span className="text-xs">✓</span>}
                {s === 'active' ? 'Active' : 'Reserve'}
              </button>
            ))}
          </div>
          {/* Row 2: Injured / Suspended */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => toggleStatus('isInjured')}
              className={cn(
                'py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all',
                form.isInjured
                  ? 'bg-red-500 text-white'
                  : 'bg-white/[0.05] border border-white/10 text-slate-400 hover:border-white/20'
              )}
            >
              <span className={cn('font-black text-base leading-none', form.isInjured ? 'text-white' : 'text-red-400')}>+</span>
              Injured
            </button>
            <button
              type="button"
              onClick={() => toggleStatus('isSuspended')}
              className={cn(
                'py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all',
                form.isSuspended
                  ? 'bg-red-600 text-white'
                  : 'bg-white/[0.05] border border-white/10 text-slate-400 hover:border-white/20'
              )}
            >
              <span className={cn('text-xs font-black', form.isSuspended ? 'text-white' : 'text-red-400')}>SUS</span>
              Suspended
            </button>
          </div>
          {/* End date if injured or suspended */}
          {(form.isInjured || form.isSuspended) && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <label className="block text-xs font-medium text-amber-400 mb-1.5">End Date <span className="text-amber-500/60">(auto-mark OUT for games)</span></label>
              <input
                type="date"
                value={form.statusEndDate}
                onChange={(e) => set('statusEndDate', e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 [color-scheme:dark] text-sm"
              />
            </div>
          )}
        </div>

        {/* Roles — full-width flex row, only enabled roles */}
        {availableRoles.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Roles</label>
            <div className="flex gap-2">
              {availableRoles.map((role) => {
                const cfg = ROLE_CONFIG[role];
                const active = form.roles.includes(role);
                const locked = isSelfAdmin(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    disabled={locked}
                    className={cn(
                      'flex-1 py-3 rounded-xl text-sm font-semibold flex flex-col items-center justify-center gap-1 transition-all',
                      active ? cfg.activeClass : 'bg-white/[0.05] border border-white/10 text-slate-400 hover:border-white/20',
                      locked && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {cfg.emoji ? (
                      <span className="text-base leading-none">{cfg.emoji}</span>
                    ) : cfg.iconText ? (
                      <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-xs font-black',
                        active ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-500'
                      )}>{cfg.iconText}</span>
                    ) : null}
                    <span>{cfg.label}</span>
                    {locked && <span className="text-[10px] opacity-60">(you)</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Captain and Admin are always available. Coach and Parent can be enabled in Team Settings.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold hover:bg-[#67e8f9]/90 transition-all text-sm disabled:opacity-60"
          >
            {saving ? 'Saving...' : player ? 'Save Changes' : 'Add Player'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
