'use client';

import React, { useState } from 'react';
import { AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import Modal from '@/components/ui/Modal';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

export default function DangerZoneModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [action, setAction] = useState<'menu' | 'erase' | 'delete'>('menu');
  const [confirmText, setConfirmText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamName = useTeamStore((s) => s.teamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const logout = useTeamStore((s) => s.logout);
  const setGames = useTeamStore((s) => s.setGames);
  const setEvents = useTeamStore((s) => s.setEvents);
  const setPhotos = useTeamStore((s) => s.setPhotos);
  const setChatMessages = useTeamStore((s) => s.setChatMessages);
  const setPaymentPeriods = useTeamStore((s) => s.setPaymentPeriods);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const players = useTeamStore((s) => s.players);
  const setPlayers = useTeamStore((s) => s.setPlayers);
  const { currentPlayer } = usePermissions();

  const handleClose = () => {
    setAction('menu');
    setConfirmText('');
    setError(null);
    onClose();
  };

  const handleEraseData = async () => {
    if (confirmText !== 'ERASE') return;
    setProcessing(true);
    setError(null);
    try {
      // Call backend to erase team data from Supabase
      if (activeTeamId) {
        await fetch(`${BACKEND_URL}/api/auth/erase-team-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: activeTeamId }),
        });
      }
      // Reset local store data
      setGames([]);
      setEvents([]);
      setPhotos([]);
      setChatMessages([]);
      setPaymentPeriods([]);
      // Reset player stats
      setPlayers(players.map((p) => ({
        ...p,
        stats: undefined,
        goalieStats: undefined,
        pitcherStats: undefined,
      })));
      setTeamSettings({
        record: { wins: 0, losses: 0, ties: 0, otLosses: 0 },
        currentSeasonName: '',
      });
      handleClose();
    } catch (err) {
      setError('Failed to erase data. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (confirmText !== 'DELETE') return;
    setProcessing(true);
    setError(null);
    try {
      if (activeTeamId) {
        await fetch(`${BACKEND_URL}/api/auth/delete-team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: activeTeamId }),
        });
      }
      logout();
      handleClose();
    } catch (err) {
      setError('Failed to delete team. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Danger Zone" size="sm">
      <div className="space-y-4">
        {action === 'menu' && (
          <>
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>These actions are destructive and cannot be undone. Proceed with caution.</span>
            </div>

            <button
              onClick={() => { setAction('erase'); setConfirmText(''); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-orange-500/5 hover:border-orange-500/20 transition-all text-left"
            >
              <div className="p-2 rounded-full bg-orange-500/20 shrink-0">
                <RotateCcw size={18} className="text-orange-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Erase Team Data</p>
                <p className="text-slate-500 text-xs mt-0.5">Remove all games, events, stats, and photos. Keeps roster.</p>
              </div>
            </button>

            <button
              onClick={() => { setAction('delete'); setConfirmText(''); }}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-rose-500/5 hover:border-rose-500/20 transition-all text-left"
            >
              <div className="p-2 rounded-full bg-rose-500/20 shrink-0">
                <Trash2 size={18} className="text-rose-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Delete Team</p>
                <p className="text-slate-500 text-xs mt-0.5">Permanently delete this team and all data. You will be logged out.</p>
              </div>
            </button>
          </>
        )}

        {action === 'erase' && (
          <>
            <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 text-orange-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>This will permanently erase all games, events, stats, photos, chat messages, and payment records for <strong>{teamName}</strong>. Your roster will be kept.</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Type <strong className="text-orange-400">ERASE</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ERASE"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setAction('menu'); setConfirmText(''); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleEraseData}
                disabled={confirmText !== 'ERASE' || processing}
                className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-all text-sm disabled:opacity-40"
              >
                {processing ? 'Erasing...' : 'Erase Data'}
              </button>
            </div>
          </>
        )}

        {action === 'delete' && (
          <>
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>This will permanently delete <strong>{teamName}</strong> and all associated data. All members will lose access. You will be logged out.</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Type <strong className="text-rose-400">DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
              />
            </div>
            {error && <p className="text-rose-400 text-xs">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => { setAction('menu'); setConfirmText(''); setError(null); }}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={confirmText !== 'DELETE' || processing}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all text-sm disabled:opacity-40"
              >
                {processing ? 'Deleting...' : 'Delete Team'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
