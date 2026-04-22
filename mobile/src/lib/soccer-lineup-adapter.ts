import type { SoccerLineup, LegacySoccerLineup } from './store-types';

export function createEmptySoccerLineup(): SoccerLineup {
  return {
    gk: undefined,
    defenders: [undefined, undefined, undefined, undefined],
    defMidfielders: [undefined, undefined, undefined, undefined],
    attMidfielders: [],
    forwards: [undefined, undefined],
    bench: [],
    numDefenders: 4,
    numDefMidfielders: 4,
    numAttMidfielders: 0,
    numForwards: 2,
    numBenchSpots: 0,
  };
}

function isNewShape(raw: unknown): raw is SoccerLineup {
  return !!raw && typeof raw === 'object' && Array.isArray((raw as any).defenders);
}

export function adaptLegacySoccerLineup(raw: unknown): SoccerLineup | undefined {
  if (!raw) return undefined;
  if (isNewShape(raw)) return raw;

  const legacy = raw as LegacySoccerLineup;
  return {
    gk: legacy.gk,
    defenders: [legacy.lb, legacy.cb1, legacy.cb2, legacy.rb],
    defMidfielders: [legacy.lm, legacy.cm1, legacy.cm2, legacy.rm],
    attMidfielders: [],
    forwards: [legacy.st1, legacy.st2],
    bench: [],
    numDefenders: 4,
    numDefMidfielders: 4,
    numAttMidfielders: 0,
    numForwards: 2,
    numBenchSpots: 0,
  };
}

export function hasAssignedSoccerPlayers(lineup: SoccerLineup | undefined): boolean {
  if (!lineup) return false;
  if (lineup.gk) return true;
  if (lineup.defenders?.some(Boolean)) return true;
  if (lineup.defMidfielders?.some(Boolean)) return true;
  if (lineup.attMidfielders?.some(Boolean)) return true;
  if (lineup.forwards?.some(Boolean)) return true;
  if (lineup.bench?.some(Boolean)) return true;
  return false;
}

export function formatSoccerFormation(lineup: SoccerLineup): string {
  const d = lineup.numDefenders;
  const dm = lineup.numDefMidfielders;
  const am = lineup.numAttMidfielders;
  const f = lineup.numForwards;

  if (dm > 0 && am > 0) return `${d}-${dm}-${am}-${f}`;
  if (am === 0 && dm > 0) return `${d}-${dm}-${f}`;
  if (dm === 0 && am > 0) return `${d}-${am}-${f}`;
  return `${d}-${f}`;
}
