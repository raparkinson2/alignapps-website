'use client';

import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { pushGameToSupabase } from '@/lib/realtime-sync';
import { useTeamStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { getPlayerName } from '@/lib/types';
import type {
  Game, Player, Sport,
  HockeyLineup, HockeyForwardLine, HockeyDefenseLine,
  BasketballLineup,
  BaseballLineup,
  SoccerLineup,
  LacrosseLineup,
} from '@/lib/types';

interface LineupModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: Game;
  players: Player[];
  sport: Sport;
  isAdmin: boolean;
}

// ── Position slot component ────────────────────────────────────────────────────

function PositionSlot({
  label,
  playerId,
  players,
  isAdmin,
  onChange,
}: {
  label: string;
  playerId: string | undefined;
  players: Player[];
  isAdmin: boolean;
  onChange: (id: string | undefined) => void;
}) {
  const player = players.find((p) => p.id === playerId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 w-8 shrink-0 text-right">{label}</span>
      {isAdmin ? (
        <select
          value={playerId ?? ''}
          onChange={(e) => onChange(e.target.value || undefined)}
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#a78bfa]/40 focus:border-[#a78bfa]/40"
        >
          <option value="">— Empty —</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {getPlayerName(p)}{p.number ? ` #${p.number}` : ''}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex-1 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-slate-300">
          {player ? `${getPlayerName(player)}${player.number ? ` #${player.number}` : ''}` : <span className="text-slate-600">Empty</span>}
        </div>
      )}
    </div>
  );
}

// ── Hockey lineup ──────────────────────────────────────────────────────────────

function HockeyLineupEditor({
  lineup,
  players,
  isAdmin,
  onChange,
}: {
  lineup: HockeyLineup;
  players: Player[];
  isAdmin: boolean;
  onChange: (l: HockeyLineup) => void;
}) {
  const numFwd = lineup.numForwardLines ?? 4;
  const numDef = lineup.numDefenseLines ?? 3;

  const updateForward = (lineIdx: number, pos: keyof HockeyForwardLine, id: string | undefined) => {
    const lines = [...(lineup.forwardLines ?? [])];
    while (lines.length <= lineIdx) lines.push({});
    lines[lineIdx] = { ...lines[lineIdx], [pos]: id };
    onChange({ ...lineup, forwardLines: lines });
  };

  const updateDefense = (lineIdx: number, pos: keyof HockeyDefenseLine, id: string | undefined) => {
    const lines = [...(lineup.defenseLines ?? [])];
    while (lines.length <= lineIdx) lines.push({});
    lines[lineIdx] = { ...lines[lineIdx], [pos]: id };
    onChange({ ...lineup, defenseLines: lines });
  };

  const updateGoalie = (id: string | undefined) => {
    onChange({ ...lineup, goalieLines: [{ g: id }] });
  };

  return (
    <div className="space-y-5">
      {/* Forward lines */}
      {Array.from({ length: numFwd }, (_, i) => (
        <div key={`fwd-${i}`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Line {i + 1}</p>
          <div className="space-y-2">
            <PositionSlot label="LW" playerId={lineup.forwardLines?.[i]?.lw} players={players} isAdmin={isAdmin} onChange={(id) => updateForward(i, 'lw', id)} />
            <PositionSlot label="C" playerId={lineup.forwardLines?.[i]?.c} players={players} isAdmin={isAdmin} onChange={(id) => updateForward(i, 'c', id)} />
            <PositionSlot label="RW" playerId={lineup.forwardLines?.[i]?.rw} players={players} isAdmin={isAdmin} onChange={(id) => updateForward(i, 'rw', id)} />
          </div>
        </div>
      ))}

      {/* Defense lines */}
      {Array.from({ length: numDef }, (_, i) => (
        <div key={`def-${i}`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">D-Line {i + 1}</p>
          <div className="space-y-2">
            <PositionSlot label="LD" playerId={lineup.defenseLines?.[i]?.ld} players={players} isAdmin={isAdmin} onChange={(id) => updateDefense(i, 'ld', id)} />
            <PositionSlot label="RD" playerId={lineup.defenseLines?.[i]?.rd} players={players} isAdmin={isAdmin} onChange={(id) => updateDefense(i, 'rd', id)} />
          </div>
        </div>
      ))}

      {/* Goalie */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Goalie</p>
        <PositionSlot label="G" playerId={lineup.goalieLines?.[0]?.g} players={players} isAdmin={isAdmin} onChange={updateGoalie} />
      </div>
    </div>
  );
}

// ── Basketball lineup ──────────────────────────────────────────────────────────

function BasketballLineupEditor({
  lineup,
  players,
  isAdmin,
  onChange,
}: {
  lineup: BasketballLineup;
  players: Player[];
  isAdmin: boolean;
  onChange: (l: BasketballLineup) => void;
}) {
  const starters = lineup.starters ?? { pg: undefined, guards: [], forwards: [], centers: [] };
  const bench = lineup.bench ?? [];

  const POSITIONS = [
    { key: 'pg', label: 'PG' },
    { key: 'sg', label: 'SG' },
    { key: 'sf', label: 'SF' },
    { key: 'pf', label: 'PF' },
    { key: 'c', label: 'C' },
  ];

  // Simple flat 5 starters
  const startersFlat: (string | undefined)[] = [
    starters.pg,
    starters.guards?.[0],
    starters.forwards?.[0],
    starters.forwards?.[1] ?? starters.centers?.[0],
    starters.centers?.[0] ?? starters.forwards?.[2],
  ];

  const updateStarter = (idx: number, id: string | undefined) => {
    const next = [...startersFlat];
    next[idx] = id;
    onChange({
      ...lineup,
      starters: {
        pg: next[0],
        guards: [next[1]],
        forwards: [next[2], next[3]],
        centers: [next[4]],
      },
      bench: bench,
    });
  };

  const updateBench = (idx: number, id: string | undefined) => {
    const next = [...bench];
    while (next.length <= idx) next.push(undefined);
    next[idx] = id;
    onChange({ ...lineup, bench: next });
  };

  const numBench = lineup.numBenchSpots ?? 5;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Starting 5</p>
        <div className="space-y-2">
          {POSITIONS.map((pos, i) => (
            <PositionSlot key={pos.key} label={pos.label} playerId={startersFlat[i]} players={players} isAdmin={isAdmin} onChange={(id) => updateStarter(i, id)} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bench</p>
        <div className="space-y-2">
          {Array.from({ length: numBench }, (_, i) => (
            <PositionSlot key={`bench-${i}`} label={`B${i + 1}`} playerId={bench[i]} players={players} isAdmin={isAdmin} onChange={(id) => updateBench(i, id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Soccer lineup ──────────────────────────────────────────────────────────────

function SoccerLineupEditor({
  lineup,
  players,
  isAdmin,
  onChange,
}: {
  lineup: SoccerLineup;
  players: Player[];
  isAdmin: boolean;
  onChange: (l: SoccerLineup) => void;
}) {
  const SLOTS: { key: keyof SoccerLineup; label: string }[] = [
    { key: 'gk', label: 'GK' },
    { key: 'lb', label: 'LB' },
    { key: 'cb1', label: 'CB1' },
    { key: 'cb2', label: 'CB2' },
    { key: 'rb', label: 'RB' },
    { key: 'lm', label: 'LM' },
    { key: 'cm1', label: 'CM1' },
    { key: 'cm2', label: 'CM2' },
    { key: 'rm', label: 'RM' },
    { key: 'st1', label: 'ST1' },
    { key: 'st2', label: 'ST2' },
  ];

  return (
    <div className="space-y-2">
      {SLOTS.map((slot) => (
        <PositionSlot
          key={slot.key}
          label={slot.label}
          playerId={lineup[slot.key]}
          players={players}
          isAdmin={isAdmin}
          onChange={(id) => onChange({ ...lineup, [slot.key]: id })}
        />
      ))}
    </div>
  );
}

// ── Baseball lineup ────────────────────────────────────────────────────────────

function BaseballLineupEditor({
  lineup,
  players,
  isAdmin,
  onChange,
}: {
  lineup: BaseballLineup;
  players: Player[];
  isAdmin: boolean;
  onChange: (l: BaseballLineup) => void;
}) {
  const SLOTS: { key: keyof BaseballLineup; label: string }[] = [
    { key: 'pitcher', label: 'P' },
    { key: 'catcher', label: 'C' },
    { key: 'firstBase', label: '1B' },
    { key: 'secondBase', label: '2B' },
    { key: 'thirdBase', label: '3B' },
    { key: 'shortstop', label: 'SS' },
    { key: 'lf', label: 'LF' },
    { key: 'cf', label: 'CF' },
    { key: 'rf', label: 'RF' },
  ];

  return (
    <div className="space-y-2">
      {SLOTS.map((slot) => (
        <PositionSlot
          key={slot.key}
          label={slot.label}
          playerId={lineup[slot.key]}
          players={players}
          isAdmin={isAdmin}
          onChange={(id) => onChange({ ...lineup, [slot.key]: id })}
        />
      ))}
    </div>
  );
}

// ── Lacrosse lineup ────────────────────────────────────────────────────────────

function LacrosseLineupEditor({
  lineup,
  players,
  isAdmin,
  onChange,
}: {
  lineup: LacrosseLineup;
  players: Player[];
  isAdmin: boolean;
  onChange: (l: LacrosseLineup) => void;
}) {
  const numAtk = lineup.numAttackers ?? 3;
  const numMid = lineup.numMidfielders ?? 3;
  const numDef = lineup.numDefenders ?? 3;

  const updateSlot = (arr: (string | undefined)[], idx: number, id: string | undefined) => {
    const next = [...arr];
    while (next.length <= idx) next.push(undefined);
    next[idx] = id;
    return next;
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Goalie</p>
        <PositionSlot label="G" playerId={lineup.goalie} players={players} isAdmin={isAdmin} onChange={(id) => onChange({ ...lineup, goalie: id })} />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attack</p>
        <div className="space-y-2">
          {Array.from({ length: numAtk }, (_, i) => (
            <PositionSlot key={`atk-${i}`} label={`A${i + 1}`} playerId={lineup.attackers?.[i]} players={players} isAdmin={isAdmin}
              onChange={(id) => onChange({ ...lineup, attackers: updateSlot(lineup.attackers ?? [], i, id) })} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Midfield</p>
        <div className="space-y-2">
          {Array.from({ length: numMid }, (_, i) => (
            <PositionSlot key={`mid-${i}`} label={`M${i + 1}`} playerId={lineup.midfielders?.[i]} players={players} isAdmin={isAdmin}
              onChange={(id) => onChange({ ...lineup, midfielders: updateSlot(lineup.midfielders ?? [], i, id) })} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Defense</p>
        <div className="space-y-2">
          {Array.from({ length: numDef }, (_, i) => (
            <PositionSlot key={`def-${i}`} label={`D${i + 1}`} playerId={lineup.defenders?.[i]} players={players} isAdmin={isAdmin}
              onChange={(id) => onChange({ ...lineup, defenders: updateSlot(lineup.defenders ?? [], i, id) })} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Generic lineup type selector ──────────────────────────────────────────────

type LineupType = 'hockey' | 'basketball' | 'baseball' | 'soccer' | 'lacrosse';

function getDefaultLineup(type: LineupType): Partial<Game> {
  switch (type) {
    case 'hockey': return { lineup: { forwardLines: [{}, {}, {}, {}], defenseLines: [{}, {}, {}], goalieLines: [{}], numForwardLines: 4, numDefenseLines: 3, numGoalieLines: 1 } };
    case 'basketball': return { basketballLineup: { starters: { pg: undefined, guards: [], forwards: [], centers: [] }, bench: [], numGuards: 2, numForwards: 2, numCenters: 1, hasPG: true, numBenchSpots: 5 } };
    case 'baseball': return { baseballLineup: {} };
    case 'soccer': return { soccerLineup: {} };
    case 'lacrosse': return { lacrosseLineup: { goalie: undefined, attackers: [], midfielders: [], defenders: [], numAttackers: 3, numMidfielders: 3, numDefenders: 3 } };
    default: return {};
  }
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function LineupModal({ isOpen, onClose, game, players, sport, isAdmin }: LineupModalProps) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const updateGame = useTeamStore((s) => s.updateGame);

  const [saving, setSaving] = useState(false);

  // Determine lineup type based on sport and what's set
  const lineupType: LineupType = (() => {
    if (sport === 'hockey') return 'hockey';
    if (sport === 'basketball') return 'basketball';
    if (sport === 'baseball' || sport === 'softball') return 'baseball';
    if (sport === 'soccer') return 'soccer';
    if (sport === 'lacrosse') return 'lacrosse';
    return 'hockey';
  })();

  const [localGame, setLocalGame] = useState<Game>(game);

  useEffect(() => {
    if (!isOpen) return;
    // Initialize with default lineup if none set
    let g = { ...game };
    if (lineupType === 'hockey' && !g.lineup) {
      const def = getDefaultLineup('hockey');
      g = { ...g, ...def };
    } else if (lineupType === 'basketball' && !g.basketballLineup) {
      const def = getDefaultLineup('basketball');
      g = { ...g, ...def };
    } else if (lineupType === 'baseball' && !g.baseballLineup) {
      const def = getDefaultLineup('baseball');
      g = { ...g, ...def };
    } else if (lineupType === 'soccer' && !g.soccerLineup) {
      const def = getDefaultLineup('soccer');
      g = { ...g, ...def };
    } else if (lineupType === 'lacrosse' && !g.lacrosseLineup) {
      const def = getDefaultLineup('lacrosse');
      g = { ...g, ...def };
    }
    setLocalGame(g);
  }, [isOpen, game, lineupType]);

  const handleSave = async () => {
    if (!activeTeamId) return;
    setSaving(true);
    updateGame(localGame.id, localGame);
    await pushGameToSupabase(localGame, activeTeamId);
    setSaving(false);
    onClose();
  };

  // Active players for lineup selection
  const activePlayers = players.filter((p) => p.status === 'active');

  const title = `${game.opponent} — Lineup`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {/* Lineup editor based on sport */}
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {lineupType === 'hockey' && localGame.lineup && (
            <HockeyLineupEditor
              lineup={localGame.lineup}
              players={activePlayers}
              isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, lineup: l }))}
            />
          )}
          {lineupType === 'basketball' && localGame.basketballLineup && (
            <BasketballLineupEditor
              lineup={localGame.basketballLineup}
              players={activePlayers}
              isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, basketballLineup: l }))}
            />
          )}
          {lineupType === 'baseball' && localGame.baseballLineup && (
            <BaseballLineupEditor
              lineup={localGame.baseballLineup}
              players={activePlayers}
              isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, baseballLineup: l }))}
            />
          )}
          {lineupType === 'soccer' && localGame.soccerLineup && (
            <SoccerLineupEditor
              lineup={localGame.soccerLineup}
              players={activePlayers}
              isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, soccerLineup: l }))}
            />
          )}
          {lineupType === 'lacrosse' && localGame.lacrosseLineup && (
            <LacrosseLineupEditor
              lineup={localGame.lacrosseLineup}
              players={activePlayers}
              isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, lacrosseLineup: l }))}
            />
          )}
        </div>

        {/* Footer */}
        <div className={cn('flex gap-3 pt-2', !isAdmin && 'hidden')}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#a78bfa] text-white font-bold hover:bg-[#a78bfa]/90 transition-all text-sm disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Lineup'}
          </button>
        </div>
        {!isAdmin && (
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">
            Close
          </button>
        )}
      </div>
    </Modal>
  );
}
