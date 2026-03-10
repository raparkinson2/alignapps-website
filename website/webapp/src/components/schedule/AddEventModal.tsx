'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import LocationSearch from '@/components/ui/LocationSearch';
import { cn, generateId } from '@/lib/utils';
import { pushEventToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import type { Event } from '@/lib/types';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEvent?: Event | null;
}

function timeStrToForm(timeStr: string): { timeValue: string; timePeriod: 'AM' | 'PM' } {
  if (!timeStr) return { timeValue: '7:00', timePeriod: 'PM' };
  const match = timeStr.trim().match(/^(\d{1,2}:\d{2})\s*(AM|PM)$/i);
  if (match) return { timeValue: match[1], timePeriod: match[2].toUpperCase() as 'AM' | 'PM' };
  const [h, m] = timeStr.split(':').map(Number);
  if (!isNaN(h) && !isNaN(m)) {
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return { timeValue: `${hour}:${String(m).padStart(2, '0')}`, timePeriod: period };
  }
  return { timeValue: '7:00', timePeriod: 'PM' };
}

const emptyForm = {
  title: '',
  date: '',
  timeValue: '7:00',
  timePeriod: 'PM' as 'AM' | 'PM',
  location: '',
  address: '',
  notes: '',
};

export default function AddEventModal({ isOpen, onClose, existingEvent }: AddEventModalProps) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const addEvent = useTeamStore((s) => s.addEvent);
  const updateEvent = useTeamStore((s) => s.updateEvent);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existingEvent) {
      const { timeValue, timePeriod } = timeStrToForm(existingEvent.time);
      setForm({
        title: existingEvent.title,
        date: existingEvent.date?.split('T')[0] ?? '',
        timeValue,
        timePeriod,
        location: existingEvent.location,
        address: existingEvent.address ?? '',
        notes: existingEvent.notes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [existingEvent, isOpen]);

  const set = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.date) { setError('Date is required'); return; }
    if (!activeTeamId) { setError('No active team'); return; }

    setSaving(true);
    setError(null);

    try {
      const event: Event = {
        id: existingEvent?.id ?? generateId(),
        title: form.title.trim(),
        type: existingEvent?.type === 'meeting' || existingEvent?.type === 'social' ? existingEvent.type : 'other',
        date: form.date,
        time: `${form.timeValue} ${form.timePeriod}`,
        location: form.location.trim(),
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
        invitedPlayers: existingEvent?.invitedPlayers ?? [],
        confirmedPlayers: existingEvent?.confirmedPlayers ?? [],
        declinedPlayers: existingEvent?.declinedPlayers ?? [],
      };

      if (existingEvent) {
        updateEvent(event.id, event);
      } else {
        addEvent(event);
      }
      await pushEventToSupabase(event, activeTeamId);
      onClose();
    } catch {
      setError('Failed to save event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={existingEvent ? 'Edit Event' : 'Add Event'} size="md">
      <div className="space-y-4">
        {error && (
          <p className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">{error}</p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Event name"
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40"
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
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40 [color-scheme:dark]"
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
                className="flex-1 min-w-0 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40 text-sm"
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
                        ? 'bg-[#3b82f6] text-white'
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
            placeholder="Search for a place..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Notes <span className="text-slate-500">(optional)</span></label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Any notes for the team..."
            rows={3}
            className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20 transition-all text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#3b82f6] text-white font-bold hover:bg-[#3b82f6]/90 transition-all text-sm disabled:opacity-60"
          >
            {saving ? 'Saving...' : existingEvent ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
