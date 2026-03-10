'use client';

import React, { useState } from 'react';
import { Shield, Pencil, Trash2, Plus, AlertTriangle, Trophy } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { pushTeamSettingsToSupabase, deletePlayerFromSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/utils';
import AddEditPlayerModal from '@/components/admin/AddEditPlayerModal';
import TeamSettingsForm from '@/components/admin/TeamSettingsForm';
import Avatar from '@/components/ui/Avatar';
import type { Player } from '@/lib/types';
import { getPlayerName } from '@/lib/types';
import Modal from '@/components/ui/Modal';

type AdminTab = 'players' | 'settings' | 'season';

export default function AdminPage() {
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const { isAdmin, currentPlayer } = usePermissions();

  const [activeTab, setActiveTab] = useState<AdminTab>('players');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [deletingPlayer, setDeletingPlayer] = useState<Player | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [archiving, setArchiving] = useState(false);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <Shield size={48} className="text-slate-600" />
        <h2 className="text-xl font-bold text-slate-400">Access Denied</h2>
        <p className="text-slate-500 text-sm">You must be an admin to view this page</p>
      </div>
    );
  }

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    setShowPlayerModal(true);
  };

  const handleDeletePlayer = async (player: Player) => {
    removePlayer(player.id);
    await deletePlayerFromSupabase(player.id);
    setDeletingPlayer(null);
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

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'players', label: 'Players' },
    { key: 'settings', label: 'Team Settings' },
    { key: 'season', label: 'Season' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#a78bfa]/10 flex items-center justify-center">
          <Trophy size={18} className="text-[#a78bfa]" />
        </div>
        <h1 className="text-xl font-bold text-slate-100">Admin</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/10 rounded-xl p-1 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-[#0f1a2e] text-slate-100 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Players tab */}
      {activeTab === 'players' && (
        <div>
          <div className="flex items-center justify-between mb-4">
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
                    {player.number && <span className="ml-1 text-slate-500">#{player.number}</span>}
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
                    {player.roles.map((role) => (
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
                  {/* Don't allow deleting current player */}
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

      {/* Settings tab */}
      {activeTab === 'settings' && <TeamSettingsForm />}

      {/* Season tab */}
      {activeTab === 'season' && (
        <div className="max-w-md space-y-6">
          {/* Current season name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Current Season Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                defaultValue={teamSettings.currentSeasonName ?? ''}
                onChange={(e) => setTeamSettings({ currentSeasonName: e.target.value })}
                placeholder="e.g. Winter 2025"
                className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
              />
            </div>
          </div>

          {/* Archive season */}
          <div className="bg-[#0f1a2e] border border-white/10 rounded-2xl p-5">
            <h3 className="font-semibold text-slate-200 mb-1">Archive Season</h3>
            <p className="text-xs text-slate-500 mb-4">
              Saves current stats and record to history, then resets for a new season. This cannot be undone.
            </p>
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium hover:bg-orange-500/20 transition-all"
            >
              Archive Current Season
            </button>
          </div>

          {/* Season history */}
          {(teamSettings.seasonHistory ?? []).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Past Seasons</h3>
              <div className="space-y-2">
                {(teamSettings.seasonHistory ?? []).map((season) => (
                  <div key={season.id} className="flex items-center gap-3 bg-[#0f1a2e] border border-white/10 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200">{season.seasonName}</p>
                      <p className="text-xs text-slate-500 capitalize">{season.sport}</p>
                    </div>
                    <p className="text-sm font-mono text-slate-400">
                      {season.teamRecord.wins}-{season.teamRecord.losses}
                      {season.teamRecord.ties != null && season.teamRecord.ties > 0 ? `-${season.teamRecord.ties}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
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

      {/* Archive season confirm */}
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
    </div>
  );
}
