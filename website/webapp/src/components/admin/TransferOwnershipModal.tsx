'use client';

import React, { useState } from 'react';
import { Crown, AlertTriangle } from 'lucide-react';
import { useTeamStore } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { pushTeamSettingsToSupabase } from '@/lib/realtime-sync';
import { getPlayerName } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

export default function TransferOwnershipModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const { currentPlayer } = usePermissions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Eligible players: admins or coaches, not the current user
  const eligible = players.filter(
    (p) =>
      p.id !== currentPlayer?.id &&
      p.status === 'active' &&
      (p.roles?.includes('admin') || p.roles?.includes('coach'))
  );

  const selectedPlayer = eligible.find((p) => p.id === selectedId) ?? null;

  const handleTransfer = async () => {
    if (!selectedId || !activeTeamId) return;
    setTransferring(true);
    const updated = { ...teamSettings, teamOwnerId: selectedId };
    setTeamSettings(updated);
    await pushTeamSettingsToSupabase(activeTeamId, teamName, updated);
    setTransferring(false);
    setConfirmStep(false);
    setSelectedId(null);
    onClose();
  };

  const handleClose = () => {
    setSelectedId(null);
    setConfirmStep(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Transfer Ownership" size="md">
      <div className="space-y-4">
        {!confirmStep ? (
          <>
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>Transfer team ownership to another admin or coach. You will remain an admin but will no longer be the owner.</span>
            </div>

            {eligible.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">
                No other admins or coaches available. Add an admin or coach first.
              </p>
            ) : (
              <div className="space-y-2">
                {eligible.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => setSelectedId(player.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                      selectedId === player.id
                        ? 'bg-[#67e8f9]/10 border-[#67e8f9]/30'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'
                    )}
                  >
                    <Avatar player={player} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{getPlayerName(player)}</p>
                      <div className="flex gap-1 mt-0.5">
                        {player.roles?.map((r) => (
                          <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-[#a78bfa]/15 text-[#a78bfa] font-medium capitalize">{r}</span>
                        ))}
                      </div>
                    </div>
                    {selectedId === player.id && (
                      <div className="w-5 h-5 rounded-full bg-[#67e8f9] flex items-center justify-center shrink-0">
                        <Crown size={11} className="text-[#080c14]" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setConfirmStep(true)}
              disabled={!selectedId}
              className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 transition-all disabled:opacity-40"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>
                Are you sure you want to transfer ownership to{' '}
                <strong>{selectedPlayer ? getPlayerName(selectedPlayer) : ''}</strong>?
                This action cannot be undone from your account.
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmStep(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleTransfer}
                disabled={transferring}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold hover:bg-rose-600 transition-all text-sm disabled:opacity-60"
              >
                {transferring ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
