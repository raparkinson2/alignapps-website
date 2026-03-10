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

// ── Shared: Player circle (avatar + name + position label) ─────────────────────

function PlayerCircle({
  playerId,
  posLabel,
  players,
  isAdmin,
  size = 'md',
  onChange,
}: {
  playerId: string | undefined;
  posLabel: string;
  players: Player[];
  isAdmin: boolean;
  size?: 'sm' | 'md' | 'lg';
  onChange: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const player = players.find((p) => p.id === playerId);

  const AVATAR_COLORS = [
    '#0891b2', '#7c3aed', '#059669', '#ea580c', '#e11d48', '#2563eb',
  ];
  const hashId = (id: string) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  };

  const circleSize = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-10 h-10' : 'w-14 h-14';
  const textSize = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm';
  const nameSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="flex flex-col items-center gap-0.5 relative">
      <button
        onClick={() => isAdmin && setOpen((v) => !v)}
        className={cn(
          circleSize,
          'rounded-full flex items-center justify-center font-bold text-white border-2 transition-all shrink-0',
          player
            ? 'border-white/20 hover:border-white/40'
            : isAdmin
            ? 'border-dashed border-white/20 bg-slate-700/50 hover:border-[#a78bfa]/50 hover:bg-[#a78bfa]/10'
            : 'border-white/10 bg-slate-700/30'
        )}
        style={player ? { backgroundColor: AVATAR_COLORS[hashId(player.id) % AVATAR_COLORS.length] } : undefined}
        title={isAdmin ? 'Click to assign player' : undefined}
      >
        {player ? (
          <span className={cn(textSize, 'font-bold select-none')}>
            {player.number ? `#${player.number}` : player.firstName[0]}
          </span>
        ) : (
          <span className="text-slate-500 text-lg select-none">-</span>
        )}
      </button>

      {/* Name below circle */}
      <span className={cn(nameSize, 'text-slate-400 text-center leading-tight max-w-[56px] truncate')}>
        {player ? player.firstName : isAdmin ? 'Empty' : ''}
      </span>
      <span className={cn(nameSize, 'text-emerald-400 font-semibold uppercase tracking-wide')}>{posLabel}</span>

      {/* Dropdown picker (admin only) */}
      {isAdmin && open && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-[#0f1a2e] border border-white/10 rounded-xl shadow-2xl min-w-[160px] max-h-48 overflow-y-auto">
          <button
            onClick={() => { onChange(undefined); setOpen(false); }}
            className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-white/[0.05] transition-colors border-b border-white/[0.05]"
          >
            — Empty —
          </button>
          {players.map((p) => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={cn(
                'w-full px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.05]',
                p.id === playerId ? 'text-[#a78bfa] font-semibold' : 'text-slate-300'
              )}
            >
              {getPlayerName(p)}{p.number ? ` #${p.number}` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Hockey ─────────────────────────────────────────────────────────────────────

function HockeyLineupEditor({ lineup, players, isAdmin, onChange }: {
  lineup: HockeyLineup; players: Player[]; isAdmin: boolean; onChange: (l: HockeyLineup) => void;
}) {
  const numFwd = lineup.numForwardLines ?? 4;
  const numDef = lineup.numDefenseLines ?? 3;
  const ordinals = ['1st', '2nd', '3rd', '4th'];

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

  return (
    <div className="space-y-3">
      <p className="text-base font-semibold text-white">Forward Lines</p>
      {Array.from({ length: numFwd }, (_, i) => (
        <div key={`fwd-${i}`} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <p className="text-cyan-400 text-sm font-medium mb-4 text-center">{ordinals[i]} Line</p>
          <div className="flex justify-around">
            <PlayerCircle posLabel="LW" playerId={lineup.forwardLines?.[i]?.lw} players={players} isAdmin={isAdmin} onChange={(id) => updateForward(i, 'lw', id)} />
            <PlayerCircle posLabel="C" playerId={lineup.forwardLines?.[i]?.c} players={players} isAdmin={isAdmin} onChange={(id) => updateForward(i, 'c', id)} />
            <PlayerCircle posLabel="RW" playerId={lineup.forwardLines?.[i]?.rw} players={players} isAdmin={isAdmin} onChange={(id) => updateForward(i, 'rw', id)} />
          </div>
        </div>
      ))}

      <p className="text-base font-semibold text-white pt-2">Defense Pairs</p>
      {Array.from({ length: numDef }, (_, i) => (
        <div key={`def-${i}`} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
          <p className="text-cyan-400 text-sm font-medium mb-4 text-center">{ordinals[i]} Pair</p>
          <div className="flex justify-around px-8">
            <PlayerCircle posLabel="LD" playerId={lineup.defenseLines?.[i]?.ld} players={players} isAdmin={isAdmin} onChange={(id) => updateDefense(i, 'ld', id)} />
            <PlayerCircle posLabel="RD" playerId={lineup.defenseLines?.[i]?.rd} players={players} isAdmin={isAdmin} onChange={(id) => updateDefense(i, 'rd', id)} />
          </div>
        </div>
      ))}

      <p className="text-base font-semibold text-white pt-2">Goalies</p>
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Starter</p>
        <div className="flex justify-center">
          <PlayerCircle posLabel="G" size="lg" playerId={lineup.goalieLines?.[0]?.g} players={players} isAdmin={isAdmin} onChange={(id) => onChange({ ...lineup, goalieLines: [{ g: id }] })} />
        </div>
      </div>
    </div>
  );
}

// ── Basketball ─────────────────────────────────────────────────────────────────

function BasketballLineupEditor({ lineup, players, isAdmin, onChange }: {
  lineup: BasketballLineup; players: Player[]; isAdmin: boolean; onChange: (l: BasketballLineup) => void;
}) {
  const starters = lineup.starters ?? { pg: undefined, guards: [], forwards: [], centers: [] };
  const bench = lineup.bench ?? [];
  const numBench = lineup.numBenchSpots ?? 5;

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
    onChange({ ...lineup, starters: { pg: next[0], guards: [next[1]], forwards: [next[2], next[3]], centers: [next[4]] }, bench });
  };

  const updateBench = (idx: number, id: string | undefined) => {
    const next = [...bench];
    while (next.length <= idx) next.push(undefined);
    next[idx] = id;
    onChange({ ...lineup, bench: next });
  };

  return (
    <div className="space-y-3">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Starting 5</p>
        {/* PG centered at top */}
        <div className="flex justify-center mb-4">
          <PlayerCircle posLabel="PG" playerId={startersFlat[0]} players={players} isAdmin={isAdmin} onChange={(id) => updateStarter(0, id)} />
        </div>
        {/* SG + SF */}
        <div className="flex justify-around mb-4">
          <PlayerCircle posLabel="SG" playerId={startersFlat[1]} players={players} isAdmin={isAdmin} onChange={(id) => updateStarter(1, id)} />
          <PlayerCircle posLabel="SF" playerId={startersFlat[2]} players={players} isAdmin={isAdmin} onChange={(id) => updateStarter(2, id)} />
        </div>
        {/* PF + C */}
        <div className="flex justify-around">
          <PlayerCircle posLabel="PF" playerId={startersFlat[3]} players={players} isAdmin={isAdmin} onChange={(id) => updateStarter(3, id)} />
          <PlayerCircle posLabel="C" playerId={startersFlat[4]} players={players} isAdmin={isAdmin} onChange={(id) => updateStarter(4, id)} />
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Bench</p>
        <div className="flex flex-wrap justify-around gap-3">
          {Array.from({ length: numBench }, (_, i) => (
            <PlayerCircle key={`bench-${i}`} posLabel={`B${i + 1}`} size="sm" playerId={bench[i]} players={players} isAdmin={isAdmin} onChange={(id) => updateBench(i, id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Baseball / Softball ────────────────────────────────────────────────────────

function BaseballLineupEditor({ lineup, players, isAdmin, isSoftball, onChange }: {
  lineup: BaseballLineup; players: Player[]; isAdmin: boolean; isSoftball?: boolean; onChange: (l: BaseballLineup) => void;
}) {
  type Pos = keyof BaseballLineup;
  const up = (pos: Pos, id: string | undefined) => onChange({ ...lineup, [pos]: id });

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
      <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Starting Lineup</p>

      {/* Outfield */}
      <div className="flex justify-around mb-5">
        <PlayerCircle posLabel="LF" playerId={lineup.lf} players={players} isAdmin={isAdmin} onChange={(id) => up('lf', id)} />
        <PlayerCircle posLabel="CF" size="lg" playerId={lineup.cf} players={players} isAdmin={isAdmin} onChange={(id) => up('cf', id)} />
        <PlayerCircle posLabel="RF" playerId={lineup.rf} players={players} isAdmin={isAdmin} onChange={(id) => up('rf', id)} />
      </div>

      {/* Short fielder (softball only) */}
      {isSoftball && (
        <div className="flex justify-center mb-4">
          <PlayerCircle posLabel="SF" playerId={(lineup as BaseballLineup & { shortFielder?: string }).shortFielder} players={players} isAdmin={isAdmin} onChange={(id) => up('shortFielder' as Pos, id)} />
        </div>
      )}

      {/* SS + 2B */}
      <div className="flex justify-center gap-16 mb-4">
        <PlayerCircle posLabel="SS" playerId={lineup.shortstop} players={players} isAdmin={isAdmin} onChange={(id) => up('shortstop', id)} />
        <PlayerCircle posLabel="2B" playerId={lineup.secondBase} players={players} isAdmin={isAdmin} onChange={(id) => up('secondBase', id)} />
      </div>

      {/* 3B + 1B */}
      <div className="flex justify-between px-6 mb-4">
        <PlayerCircle posLabel="3B" playerId={lineup.thirdBase} players={players} isAdmin={isAdmin} onChange={(id) => up('thirdBase', id)} />
        <PlayerCircle posLabel="1B" playerId={lineup.firstBase} players={players} isAdmin={isAdmin} onChange={(id) => up('firstBase', id)} />
      </div>

      {/* Pitcher */}
      <div className="flex justify-center mb-4">
        <PlayerCircle posLabel="P" size="lg" playerId={lineup.pitcher} players={players} isAdmin={isAdmin} onChange={(id) => up('pitcher', id)} />
      </div>

      {/* Catcher */}
      <div className="flex justify-center">
        <PlayerCircle posLabel="C" size="lg" playerId={lineup.catcher} players={players} isAdmin={isAdmin} onChange={(id) => up('catcher', id)} />
      </div>
    </div>
  );
}

// ── Soccer ─────────────────────────────────────────────────────────────────────

function SoccerLineupEditor({ lineup, players, isAdmin, onChange }: {
  lineup: SoccerLineup; players: Player[]; isAdmin: boolean; onChange: (l: SoccerLineup) => void;
}) {
  const up = (pos: keyof SoccerLineup, id: string | undefined) => onChange({ ...lineup, [pos]: id });

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
      <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Formation</p>

      {/* Strikers */}
      <div className="flex justify-center gap-12 mb-5">
        <PlayerCircle posLabel="ST" playerId={lineup.st1} players={players} isAdmin={isAdmin} onChange={(id) => up('st1', id)} />
        <PlayerCircle posLabel="ST" playerId={lineup.st2} players={players} isAdmin={isAdmin} onChange={(id) => up('st2', id)} />
      </div>

      {/* Midfield */}
      <div className="flex justify-around mb-5">
        <PlayerCircle posLabel="LM" playerId={lineup.lm} players={players} isAdmin={isAdmin} onChange={(id) => up('lm', id)} />
        <PlayerCircle posLabel="CM" playerId={lineup.cm1} players={players} isAdmin={isAdmin} onChange={(id) => up('cm1', id)} />
        <PlayerCircle posLabel="CM" playerId={lineup.cm2} players={players} isAdmin={isAdmin} onChange={(id) => up('cm2', id)} />
        <PlayerCircle posLabel="RM" playerId={lineup.rm} players={players} isAdmin={isAdmin} onChange={(id) => up('rm', id)} />
      </div>

      {/* Defense */}
      <div className="flex justify-around mb-5">
        <PlayerCircle posLabel="LB" playerId={lineup.lb} players={players} isAdmin={isAdmin} onChange={(id) => up('lb', id)} />
        <PlayerCircle posLabel="CB" playerId={lineup.cb1} players={players} isAdmin={isAdmin} onChange={(id) => up('cb1', id)} />
        <PlayerCircle posLabel="CB" playerId={lineup.cb2} players={players} isAdmin={isAdmin} onChange={(id) => up('cb2', id)} />
        <PlayerCircle posLabel="RB" playerId={lineup.rb} players={players} isAdmin={isAdmin} onChange={(id) => up('rb', id)} />
      </div>

      {/* Goalkeeper */}
      <div className="flex justify-center">
        <PlayerCircle posLabel="GK" size="lg" playerId={lineup.gk} players={players} isAdmin={isAdmin} onChange={(id) => up('gk', id)} />
      </div>
    </div>
  );
}

// ── Lacrosse ───────────────────────────────────────────────────────────────────

function LacrosseLineupEditor({ lineup, players, isAdmin, onChange }: {
  lineup: LacrosseLineup; players: Player[]; isAdmin: boolean; onChange: (l: LacrosseLineup) => void;
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
    <div className="space-y-3">
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Goalie</p>
        <div className="flex justify-center">
          <PlayerCircle posLabel="G" size="lg" playerId={lineup.goalie} players={players} isAdmin={isAdmin} onChange={(id) => onChange({ ...lineup, goalie: id })} />
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Attack</p>
        <div className="flex justify-around">
          {Array.from({ length: numAtk }, (_, i) => (
            <PlayerCircle key={`atk-${i}`} posLabel={`A${i + 1}`} playerId={lineup.attackers?.[i]} players={players} isAdmin={isAdmin}
              onChange={(id) => onChange({ ...lineup, attackers: updateSlot(lineup.attackers ?? [], i, id) })} />
          ))}
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Midfield</p>
        <div className="flex justify-around">
          {Array.from({ length: numMid }, (_, i) => (
            <PlayerCircle key={`mid-${i}`} posLabel={`M${i + 1}`} playerId={lineup.midfielders?.[i]} players={players} isAdmin={isAdmin}
              onChange={(id) => onChange({ ...lineup, midfielders: updateSlot(lineup.midfielders ?? [], i, id) })} />
          ))}
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
        <p className="text-cyan-400 text-sm font-medium mb-4 text-center">Defense</p>
        <div className="flex justify-around">
          {Array.from({ length: numDef }, (_, i) => (
            <PlayerCircle key={`def-${i}`} posLabel={`D${i + 1}`} playerId={lineup.defenders?.[i]} players={players} isAdmin={isAdmin}
              onChange={(id) => onChange({ ...lineup, defenders: updateSlot(lineup.defenders ?? [], i, id) })} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Defaults ───────────────────────────────────────────────────────────────────

type LineupType = 'hockey' | 'basketball' | 'baseball' | 'softball' | 'soccer' | 'lacrosse';

function getDefaultLineup(type: LineupType): Partial<Game> {
  switch (type) {
    case 'hockey': return { lineup: { forwardLines: [{}, {}, {}, {}], defenseLines: [{}, {}, {}], goalieLines: [{}], numForwardLines: 4, numDefenseLines: 3, numGoalieLines: 1 } };
    case 'basketball': return { basketballLineup: { starters: { pg: undefined, guards: [], forwards: [], centers: [] }, bench: [], numGuards: 2, numForwards: 2, numCenters: 1, hasPG: true, numBenchSpots: 5 } };
    case 'baseball':
    case 'softball': return { baseballLineup: {} };
    case 'soccer': return { soccerLineup: {} };
    case 'lacrosse': return { lacrosseLineup: { goalie: undefined, attackers: [], midfielders: [], defenders: [], numAttackers: 3, numMidfielders: 3, numDefenders: 3 } };
    default: return {};
  }
}

function getModalTitle(sport: Sport): string {
  switch (sport) {
    case 'hockey': return 'Game Lines';
    case 'basketball': return 'Starting 5';
    case 'baseball': return 'Game Lineup';
    case 'softball': return 'Game Lineup';
    case 'soccer': return 'Formation';
    case 'lacrosse': return 'Game Lineup';
    default: return 'Lineup';
  }
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export default function LineupModal({ isOpen, onClose, game, players, sport, isAdmin }: LineupModalProps) {
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const updateGame = useTeamStore((s) => s.updateGame);
  const [saving, setSaving] = useState(false);

  const lineupType: LineupType = (() => {
    if (sport === 'hockey') return 'hockey';
    if (sport === 'basketball') return 'basketball';
    if (sport === 'softball') return 'softball';
    if (sport === 'baseball') return 'baseball';
    if (sport === 'soccer') return 'soccer';
    if (sport === 'lacrosse') return 'lacrosse';
    return 'hockey';
  })();

  const [localGame, setLocalGame] = useState<Game>(game);

  useEffect(() => {
    if (!isOpen) return;
    let g = { ...game };
    if (lineupType === 'hockey' && !g.lineup) g = { ...g, ...getDefaultLineup('hockey') };
    else if (lineupType === 'basketball' && !g.basketballLineup) g = { ...g, ...getDefaultLineup('basketball') };
    else if ((lineupType === 'baseball' || lineupType === 'softball') && !g.baseballLineup) g = { ...g, ...getDefaultLineup('baseball') };
    else if (lineupType === 'soccer' && !g.soccerLineup) g = { ...g, ...getDefaultLineup('soccer') };
    else if (lineupType === 'lacrosse' && !g.lacrosseLineup) g = { ...g, ...getDefaultLineup('lacrosse') };
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

  const activePlayers = players.filter((p) => p.status === 'active');
  const title = `${game.opponent} — ${getModalTitle(sport)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-3">
          {lineupType === 'hockey' && localGame.lineup && (
            <HockeyLineupEditor lineup={localGame.lineup} players={activePlayers} isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, lineup: l }))} />
          )}
          {lineupType === 'basketball' && localGame.basketballLineup && (
            <BasketballLineupEditor lineup={localGame.basketballLineup} players={activePlayers} isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, basketballLineup: l }))} />
          )}
          {(lineupType === 'baseball' || lineupType === 'softball') && localGame.baseballLineup && (
            <BaseballLineupEditor lineup={localGame.baseballLineup} players={activePlayers} isAdmin={isAdmin}
              isSoftball={lineupType === 'softball'}
              onChange={(l) => setLocalGame((g) => ({ ...g, baseballLineup: l }))} />
          )}
          {lineupType === 'soccer' && localGame.soccerLineup && (
            <SoccerLineupEditor lineup={localGame.soccerLineup} players={activePlayers} isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, soccerLineup: l }))} />
          )}
          {lineupType === 'lacrosse' && localGame.lacrosseLineup && (
            <LacrosseLineupEditor lineup={localGame.lacrosseLineup} players={activePlayers} isAdmin={isAdmin}
              onChange={(l) => setLocalGame((g) => ({ ...g, lacrosseLineup: l }))} />
          )}
        </div>

        {isAdmin ? (
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#a78bfa] text-white font-bold hover:bg-[#a78bfa]/90 transition-all text-sm disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-slate-200 transition-all text-sm font-medium">
            Close
          </button>
        )}
      </div>
    </Modal>
  );
}
