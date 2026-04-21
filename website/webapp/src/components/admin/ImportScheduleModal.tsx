'use client';

import React, { useState, useRef } from 'react';
import { FileText, Check, AlertCircle, ChevronRight, Calendar, Upload } from 'lucide-react';
import Papa from 'papaparse';
import { useTeamStore } from '@/lib/store';
import type { Game } from '@/lib/types';
import { pushGameToSupabase } from '@/lib/realtime-sync';
import Modal from '@/components/ui/Modal';

// ─── CSV Parsing (mirrors mobile csv-schedule-import.ts) ─────────────────────

interface ImportedGame {
  opponent: string;
  date: string;
  time: string;
  location: string;
  address: string;
  jerseyColor: string;
  notes: string;
}

const COLUMN_MAP: Record<string, keyof ImportedGame> = {
  'opponent': 'opponent', 'team': 'opponent', 'vs': 'opponent', 'versus': 'opponent',
  'opponent name': 'opponent', 'opponentname': 'opponent', 'opponent_name': 'opponent',
  'opposing team': 'opponent', 'opposing_team': 'opponent', 'opposingteam': 'opponent',
  'other team': 'opponent', 'team name': 'opponent', 'away team': 'opponent', 'home team': 'opponent',
  'date': 'date', 'game date': 'date', 'gamedate': 'date', 'game_date': 'date',
  'day': 'date', 'game day': 'date', 'gameday': 'date', 'game_day': 'date',
  'time': 'time', 'game time': 'time', 'gametime': 'time', 'game_time': 'time',
  'start time': 'time', 'starttime': 'time', 'start_time': 'time', 'start': 'time',
  'location': 'location', 'venue': 'location', 'field': 'location', 'place': 'location',
  'stadium': 'location', 'arena': 'location', 'rink': 'location', 'gym': 'location',
  'facility': 'location', 'field name': 'location', 'field_name': 'location', 'fieldname': 'location',
  'address': 'address', 'venue address': 'address', 'venueaddress': 'address', 'venue_address': 'address',
  'street': 'address', 'street address': 'address', 'street_address': 'address',
  'full address': 'address', 'full_address': 'address',
  'jersey': 'jerseyColor', 'jersey color': 'jerseyColor', 'jerseycolor': 'jerseyColor',
  'jersey_color': 'jerseyColor', 'color': 'jerseyColor', 'uniform': 'jerseyColor',
  'uniform color': 'jerseyColor', 'uniform_color': 'jerseyColor',
  'notes': 'notes', 'note': 'notes', 'comments': 'notes', 'comment': 'notes',
  'details': 'notes', 'description': 'notes', 'memo': 'notes', 'info': 'notes',
};

function matchColumn(header: string): keyof ImportedGame | null {
  const normalized = header.trim().toLowerCase();
  return COLUMN_MAP[normalized] || null;
}

function parseFlexibleDate(dateStr: string): string {
  const trimmed = dateStr.trim();
  if (!trimmed) return '';
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2] - 1, +isoMatch[3]).toISOString();
  const slashFull = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashFull) return new Date(+slashFull[3], +slashFull[1] - 1, +slashFull[2]).toISOString();
  const slashShort = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) return new Date(+slashShort[3] + 2000, +slashShort[1] - 1, +slashShort[2]).toISOString();
  const dashUS = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashUS) return new Date(+dashUS[3], +dashUS[1] - 1, +dashUS[2]).toISOString();
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()).toISOString();
  return trimmed;
}

function parseFlexibleTime(timeStr: string): string {
  const trimmed = timeStr.trim();
  if (!trimmed) return '';
  const time24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (time24) {
    let hours = +time24[1];
    const mins = time24[2];
    if (hours >= 0 && hours <= 23) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      if (hours === 0) hours = 12;
      else if (hours > 12) hours -= 12;
      return `${hours}:${mins} ${ampm}`;
    }
  }
  const time12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)$/);
  if (time12) return `${+time12[1]}:${time12[2]} ${time12[3].toUpperCase()}`;
  const shortTime = trimmed.match(/^(\d{1,2})\s*(am|pm|AM|PM)$/);
  if (shortTime) return `${+shortTime[1]}:00 ${shortTime[2].toUpperCase()}`;
  return trimmed;
}

function parseScheduleCSV(csvString: string): { games: ImportedGame[]; errors: string[]; skippedRows: number } {
  const errors: string[] = [];
  let skippedRows = 0;
  const result = Papa.parse<Record<string, string>>(csvString, {
    header: true, skipEmptyLines: true, transformHeader: (h) => h.trim(),
  });
  if (result.errors.length > 0) {
    result.errors.forEach((e) => errors.push(`Row ${(e.row ?? 0) + 2}: ${e.message}`));
  }
  const headers = result.meta.fields || [];
  const columnMapping = new Map<string, keyof ImportedGame>();
  for (const header of headers) {
    const mapped = matchColumn(header);
    if (mapped) columnMapping.set(header, mapped);
  }
  if (!Array.from(columnMapping.values()).includes('opponent')) {
    errors.push('Could not find an "Opponent" or "Team" column. Make sure your CSV has a header row.');
    return { games: [], errors, skippedRows: 0 };
  }
  const games: ImportedGame[] = [];
  for (const row of result.data) {
    const game: ImportedGame = { opponent: '', date: '', time: '', location: '', address: '', jerseyColor: '', notes: '' };
    columnMapping.forEach((field, csvHeader) => {
      game[field as keyof ImportedGame] = (row[csvHeader] || '').trim();
    });
    if (!game.opponent) { skippedRows++; continue; }
    if (game.date) game.date = parseFlexibleDate(game.date);
    if (game.time) game.time = parseFlexibleTime(game.time);
    games.push(game);
  }
  return { games, errors, skippedRows };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ImportScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'choose' | 'preview' | 'importing' | 'results';

export default function ImportScheduleModal({ isOpen, onClose }: ImportScheduleModalProps) {
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const addGame = useTeamStore((s) => s.addGame);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('choose');
  const [parsedGames, setParsedGames] = useState<ImportedGame[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [importResults, setImportResults] = useState<{ added: number; skipped: number; errors: string[] }>({ added: 0, skipped: 0, errors: [] });

  const resetState = () => {
    setStep('choose');
    setParsedGames([]);
    setParseErrors([]);
    setSelectedIndexes(new Set());
    setImportResults({ added: 0, skipped: 0, errors: [] });
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const isDuplicate = (imported: ImportedGame): string | null => {
    if (!imported.opponent || !imported.date) return null;
    const importedDate = imported.date.split('T')[0];
    const match = games.find((g) => {
      const existingDate = g.date?.split('T')[0];
      return g.opponent.toLowerCase() === imported.opponent.toLowerCase() && existingDate === importedDate;
    });
    if (match) return `vs ${match.opponent} on ${match.date?.split('T')[0] || 'same date'}`;
    return null;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const csvString = await file.text();
    const parsed = parseScheduleCSV(csvString);
    setParsedGames(parsed.games);
    setParseErrors(parsed.errors);

    const selected = new Set<number>();
    parsed.games.forEach((g, i) => {
      if (!isDuplicate(g)) selected.add(i);
    });
    setSelectedIndexes(selected);

    if (parsed.games.length === 0) {
      setParseErrors((prev) => [
        ...prev,
        parsed.errors.length > 0 ? '' : 'The CSV file appears to be empty or has no recognizable columns.',
      ].filter(Boolean));
      return;
    }

    setStep('preview');

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleGame = (index: number) => {
    const next = new Set(selectedIndexes);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelectedIndexes(next);
  };

  const handleImport = async () => {
    setStep('importing');
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];
    const toImport = parsedGames.filter((_, i) => selectedIndexes.has(i));
    const activePlayers = players.filter((p) => p.status === 'active');

    for (const imported of toImport) {
      if (isDuplicate(imported)) { skipped++; continue; }
      try {
        const newGame: Game = {
          id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
          opponent: imported.opponent,
          date: imported.date || new Date().toISOString(),
          time: imported.time || '7:00 PM',
          location: imported.location || '',
          address: imported.address || '',
          jerseyColor: imported.jerseyColor || '',
          notes: imported.notes || undefined,
          checkedInPlayers: [],
          checkedOutPlayers: [],
          invitedPlayers: activePlayers.map((p) => p.id),
          photos: [],
          showBeerDuty: false,
          inviteReleaseOption: 'now',
          invitesSent: true,
        };
        addGame(newGame);
        if (activeTeamId) pushGameToSupabase(newGame, activeTeamId).catch(console.error);
        added++;
      } catch {
        errors.push(`vs ${imported.opponent}: failed to add`);
      }
    }

    setImportResults({ added, skipped, errors });
    setStep('results');
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    } catch {}
    return dateStr;
  };

  // ─── Step title ────────────────────────────────────────────────────────────
  const stepTitle = step === 'choose' ? 'Import Schedule'
    : step === 'preview' ? 'Review Import'
    : step === 'importing' ? 'Importing...'
    : 'Results';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={stepTitle} size="lg">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Step: Choose */}
      {step === 'choose' && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Quickly add multiple games to your schedule at once.
          </p>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
          >
            <div className="p-2.5 rounded-full bg-orange-500/20">
              <FileText size={22} className="text-orange-400" />
            </div>
            <div className="flex-1">
              <p className="text-slate-100 font-semibold">Import from CSV</p>
              <p className="text-slate-400 text-sm mt-0.5">
                Upload a spreadsheet with game opponents, dates, times, locations
              </p>
            </div>
            <ChevronRight size={20} className="text-slate-500" />
          </button>

          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <p className="text-orange-400 text-sm font-semibold mb-2">CSV Format Tips</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              Your CSV should have a header row. We auto-detect columns like:<br /><br />
              &bull; Opponent / Team / Vs<br />
              &bull; Date (MM/DD/YYYY or YYYY-MM-DD)<br />
              &bull; Time (3:00 PM or 15:00)<br />
              &bull; Location / Venue / Field<br />
              &bull; Address<br />
              &bull; Jersey Color<br />
              &bull; Notes
            </p>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div>
            <p className="text-slate-100 font-semibold">
              {parsedGames.length} game{parsedGames.length !== 1 ? 's' : ''} found
            </p>
            {parsedGames.filter((g) => isDuplicate(g)).length > 0 && (
              <p className="text-amber-400 text-sm mt-1">
                {parsedGames.filter((g) => isDuplicate(g)).length} already on schedule (auto-deselected)
              </p>
            )}
            {parseErrors.length > 0 && (
              <p className="text-red-400 text-sm mt-1">
                {parseErrors.length} warning{parseErrors.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
            {parsedGames.map((g, i) => {
              const dup = isDuplicate(g);
              const selected = selectedIndexes.has(i);
              const details = [formatDisplayDate(g.date), g.time, g.location].filter(Boolean).join(' \u00b7 ');

              return (
                <button
                  key={i}
                  onClick={() => !dup && toggleGame(i)}
                  disabled={!!dup}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                    dup ? 'bg-white/5 opacity-50 cursor-not-allowed'
                    : selected ? 'bg-white/10 border border-orange-500/30'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    dup ? 'bg-slate-600/30'
                    : selected ? 'bg-orange-500'
                    : 'bg-slate-700 border border-slate-600'
                  }`}>
                    {selected && !dup && <Check size={14} className="text-white" strokeWidth={3} />}
                    {dup && <AlertCircle size={14} className="text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${dup ? 'text-slate-500' : 'text-slate-100'}`}>
                      vs {g.opponent}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">
                      {details || 'No date/time/location'}
                    </p>
                    {dup && (
                      <p className="text-amber-500 text-xs mt-0.5">Duplicate: {dup}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleImport}
            disabled={selectedIndexes.size === 0}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
              selectedIndexes.size > 0
                ? 'bg-orange-500 hover:bg-orange-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Import {selectedIndexes.size} Game{selectedIndexes.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-100 font-semibold mt-4">Importing Games...</p>
          <p className="text-slate-400 text-sm mt-2">Adding to schedule and syncing</p>
        </div>
      )}

      {/* Step: Results */}
      {step === 'results' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center py-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              importResults.added > 0 ? 'bg-green-500/20' : 'bg-amber-500/20'
            }`}>
              {importResults.added > 0
                ? <Check size={28} className="text-green-500" strokeWidth={3} />
                : <AlertCircle size={28} className="text-amber-500" />
              }
            </div>
            <p className="text-slate-100 text-lg font-bold mt-3">
              {importResults.added > 0 ? 'Import Complete!' : 'No Games Added'}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-2">
            {importResults.added > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-slate-100">{importResults.added} game{importResults.added !== 1 ? 's' : ''} added</span>
              </div>
            )}
            {importResults.skipped > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-slate-400">{importResults.skipped} skipped (duplicates)</span>
              </div>
            )}
            {importResults.errors.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-400">{importResults.errors.length} error{importResults.errors.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {importResults.errors.length > 0 && (
            <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/20 space-y-1">
              {importResults.errors.map((e, i) => (
                <p key={i} className="text-red-400 text-sm">{e}</p>
              ))}
            </div>
          )}

          <button
            onClick={handleClose}
            className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
