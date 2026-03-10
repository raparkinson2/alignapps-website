'use client';

import React, { useState } from 'react';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pushTeamSettingsToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import { SPORT_NAMES } from '@/lib/types';
import type { TeamSettings, Sport } from '@/lib/types';

const SPORTS: Sport[] = ['hockey', 'baseball', 'basketball', 'soccer', 'lacrosse', 'softball'];

interface FeatureToggle {
  key: keyof TeamSettings;
  label: string;
  dependsOn?: keyof TeamSettings;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  { key: 'showTeamChat', label: 'Team Chat' },
  { key: 'showPhotos', label: 'Photos' },
  { key: 'showPayments', label: 'Payments' },
  { key: 'showTeamStats', label: 'Stats' },
  { key: 'showTeamRecords', label: 'Records' },
  { key: 'showLineups', label: 'Lineups' },
  { key: 'showRefreshmentDuty', label: 'Refreshment Duty' },
  { key: 'allowPlayerSelfStats', label: 'Allow Players to Manage Own Stats', dependsOn: 'showTeamStats' },
];

export default function TeamSettingsForm() {
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const setTeamName = useTeamStore((s) => s.setTeamName);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);

  const [localName, setLocalName] = useState(teamName);
  const [localSettings, setLocalSettings] = useState<TeamSettings>({ ...teamSettings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sportWarning, setSportWarning] = useState(false);

  // Jersey color add state
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#ffffff');

  const updateLocal = (updates: Partial<TeamSettings>) => {
    setLocalSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleSportChange = (sport: Sport) => {
    if (sport !== localSettings.sport) setSportWarning(true);
    updateLocal({ sport });
  };

  const handleAddJerseyColor = () => {
    if (!newColorName.trim()) return;
    updateLocal({
      jerseyColors: [...(localSettings.jerseyColors ?? []), { name: newColorName.trim(), color: newColorHex }],
    });
    setNewColorName('');
    setNewColorHex('#ffffff');
  };

  const handleRemoveJerseyColor = (name: string) => {
    updateLocal({
      jerseyColors: (localSettings.jerseyColors ?? []).filter((c) => c.name !== name),
    });
  };

  const handleSave = async () => {
    if (!activeTeamId) return;
    setSaving(true);
    setTeamName(localName);
    setTeamSettings(localSettings);
    await pushTeamSettingsToSupabase(activeTeamId, localName, localSettings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Team name */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Team Name</label>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40"
        />
      </div>

      {/* Sport */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1.5">Sport</label>
        {sportWarning && (
          <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 mb-2 text-orange-400 text-xs">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Changing sport will affect position groupings on the roster and stats pages.</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {SPORTS.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => handleSportChange(sport)}
              className={cn(
                'px-3 py-1.5 rounded-xl border text-sm font-medium capitalize transition-all',
                localSettings.sport === sport
                  ? 'border-[#67e8f9]/50 bg-[#67e8f9]/10 text-[#67e8f9]'
                  : 'border-white/10 text-slate-400 hover:border-white/20'
              )}
            >
              {SPORT_NAMES[sport]}
            </button>
          ))}
        </div>
      </div>

      {/* Feature toggles */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Features</label>
        <div className="grid grid-cols-2 gap-2">
          {FEATURE_TOGGLES.map((toggle) => {
            const value = localSettings[toggle.key] as boolean | undefined;
            const isDisabled = toggle.dependsOn ? !(localSettings[toggle.dependsOn] as boolean | undefined) : false;
            return (
              <label
                key={toggle.key}
                className={cn(
                  'flex items-center gap-2.5 cursor-pointer p-2 rounded-xl hover:bg-white/[0.03]',
                  isDisabled && 'opacity-40 cursor-not-allowed'
                )}
              >
                <input
                  type="checkbox"
                  checked={!isDisabled && (value ?? false)}
                  disabled={isDisabled}
                  onChange={(e) => {
                    if (!isDisabled) updateLocal({ [toggle.key]: e.target.checked });
                  }}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 accent-[#67e8f9] disabled:cursor-not-allowed"
                />
                <span className="text-sm text-slate-300">{toggle.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Jersey colors */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Jersey Colors</label>
        <div className="space-y-2 mb-3">
          {(localSettings.jerseyColors ?? []).map((jc) => (
            <div key={jc.name} className="flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2">
              <span className="w-5 h-5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: jc.color }} />
              <span className="text-sm text-slate-300 flex-1">{jc.name}</span>
              <button
                onClick={() => handleRemoveJerseyColor(jc.name)}
                className="text-slate-500 hover:text-rose-400 p-1 rounded-lg hover:bg-rose-500/10 transition-all"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="color"
            value={newColorHex}
            onChange={(e) => setNewColorHex(e.target.value)}
            className="w-10 h-10 rounded-xl border border-white/10 bg-transparent cursor-pointer"
            title="Pick color"
          />
          <input
            type="text"
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
            placeholder="Color name"
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#67e8f9]/40 text-sm"
          />
          <button
            onClick={handleAddJerseyColor}
            className="px-3 py-2 rounded-xl bg-[#67e8f9]/10 border border-[#67e8f9]/20 text-[#67e8f9] hover:bg-[#67e8f9]/20 transition-all"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Save button */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            'w-full py-3 rounded-xl font-bold text-sm transition-all',
            saved
              ? 'bg-[#22c55e] text-white'
              : 'bg-[#67e8f9] text-[#080c14] hover:bg-[#67e8f9]/90',
            saving && 'opacity-60 cursor-not-allowed'
          )}
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
