'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import LocationSearch from '@/components/ui/LocationSearch';
import { cn, generateId } from '@/lib/utils';
import { pushGameToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import type { Game } from '@/lib/types';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingGame?: Game | null;
}

const emptyForm = {
  opponent: '',
  date: '',
  timeValue: '7:00',
  timePeriod: 'PM' as 'AM' | 'PM',
  location: '',
  address: '',
  jerseyColor: '',
  notes: '',
  showBeerDuty: false,
};

function formToTimeStr(value: string, period: 'AM' | 'PM'): string {
  return `${value} ${period}`;
}

function timeStrToForm(timeStr: string): { timeValue: string; timePeriod: 'AM' | 'PM' } {
  if (!timeStr) return { timeValue: '7:00', timePeriod: 'PM' };
  const match = timeStr.trim().match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (match) return { timeValue: match[1], timePeriod: match[2].toUpperCase() as 'AM' | 'PM' };
  // Parse 24h format
  const [h, m] = timeStr.split(':').map(Number);
  if (!isNaN(h) && !isNaN(m)) {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return { timeValue: `${hour}:${String(m).padStart(2, '0')}`, timePeriod: period };
  }
  return { timeValue: '7:00', timePeriod: 'PM' };
}

export default function AddGameModal({ isOpen, onClose, existingGame }: AddGameModalProps) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const addGame = useTeamStore((s) => s.addGame);
  const updateGame = useTeamStore((s) => s.updateGame);

  const [form, setForm] = useState(() => {
    if (existingGame) {
      const { timeValue, timePeriod } = timeStrToForm(existingGame.time);
      return {
        opponent: existingGame.opponent,
        date: existingGame.date,
        timeValue,
        timePeriod,
        location: existingGame.location,
        address: existingGame.address ?? '',
        jerseyColor: existingGame.jerseyColor ?? '',
        notes: existingGame.notes ?? '',
        showBeerDuty: existingGame.showBeerDuty ?? false,
      };
    }
    return emptyForm;
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (existingGame) {
      const { timeValue, timePeriod } = timeStrToForm(existingGame.time);
      setForm({
        opponent: existingGame.opponent,
        date: existingGame.date,
        timeValue,
        timePeriod,
        location: existingGame.location,
        address: existingGame.address ?? '',
        jerseyColor: existingGame.jerseyColor ?? '',
        notes: existingGame.notes ?? '',
        showBeerDuty: existingGame.showBeerDuty ?? false,
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [existingGame, isOpen]);

  const set = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.opponent.trim()) { setError('Opponent is required'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!activeTeamId) { setError('No active team'); return; }

    setSaving(true);
    setError(null);

    try {
      const game: Game = {
        id: existingGame?.id ?? generateId(),
        opponent: form.opponent.trim(),
        date: form.date,
        time: formToTimeStr(form.timeValue, form.timePeriod),
        location: form.location.trim(),
        address: form.address.trim(),
        jerseyColor: form.jerseyColor,
        notes: form.notes.trim() || undefined,
        showBeerDuty: form.showBeerDuty,
        checkedInPlayers: existingGame?.checkedInPlayers ?? [],
        checkedOutPlayers: existingGame?.checkedOutPlayers ?? [],
        invitedPlayers: existingGame?.invitedPlayers ?? [],
        photos: existingGame?.photos ?? [],
        finalScoreUs: existingGame?.finalScoreUs,
        finalScoreThem: existingGame?.finalScoreThem,
        gameResult: existingGame?.gameResult,
        resultRecorded: existingGame?.resultRecorded ?? false,
      };

      if (existingGame) {
        updateGame(game.id, game);
      } else {
        addGame(game);
      }
      await pushGameToSupabase(game, activeTeamId);
      onClose();
    } catch {
      setError('Failed to save game. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existingGame ? 'Edit Game' : 'Add Game'} size="md">
      <div className="space-y-4">
        {error && (
          <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Opponent *</label>
          <input
            type="text"
            value={form.opponent}
            onChange={(e) => set('opponent', e.target.value)}
            placeholder="Team name"
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
          />
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Time</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={form.timeValue}
                onChange={(e) => set('timeValue', e.target.value)}
                placeholder="7:00"
                className="flex-1 min-w-0 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm"
              />
              <div className="flex rounded-xl overflow-hidden border border-white/10">
                {(['AM', 'PM'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('timePeriod', p)}
                    className={cn(
                      'px-2.5 py-2 text-xs font-semibold transition-all',
                      form.timePeriod === p
                        ? 'bg-[#67e8f9] text-[#080c14]'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Location search */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Location</label>
          <LocationSearch
            value={form.location}
            onChange={(name, address) => setForm((prev) => ({ ...prev, location: name, address }))}
            placeholder="Search rink, arena, field..."
          />
        </div>

        {/* Jersey Color */}
        {teamSettings.jerseyColors && teamSettings.jerseyColors.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Jersey Color</label>
            <div className="flex flex-wrap gap-2">
              {teamSettings.jerseyColors.map((jc) => (
                <button
                  key={jc.name}
                  type="button"
                  onClick={() => set('jerseyColor', jc.name)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm transition-all',
                    form.jerseyColor === jc.name
                      ? 'border-[#67e8f9]/50 bg-[#67e8f9]/10 text-[#67e8f9]'
                      : 'border-white/10 text-slate-400 hover:border-white/20'
                  )}
                >
                  <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: jc.color }} />
                  {jc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Refreshment duty */}
        {teamSettings.showRefreshmentDuty && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showBeerDuty}
              onChange={(e) => set('showBeerDuty', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#67e8f9]"
            />
            <span className="text-sm text-slate-300 flex items-center gap-1.5">
              {teamSettings.refreshmentDutyIs21Plus ? '🍺' : '🥤'}
              Show {teamSettings.refreshmentDutyIs21Plus ? 'beer' : 'refreshment'} duty for this game
            </span>
          </label>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes <span className="text-slate-500">(optional)</span></label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Any notes for the team..."
            rows={3}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#67e8f9] text-[#080c14] font-bold hover:bg-[#67e8f9]/90 transition-all text-sm disabled:opacity-60"
          >
            {saving ? 'Saving...' : existingGame ? 'Save Changes' : 'Add Game'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
