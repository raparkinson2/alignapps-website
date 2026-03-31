import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft,
  Trophy,
  Shield,
  Crown,
  Flame,
  Target,
  Zap,
  Users,
  Calendar,
  Award,
  Share2,
  Crosshair,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import {
  useTeamStore,
  getPlayerName,
  type Player,
  type Sport,
  type ArchivedSeason,
  type ArchivedPlayerStats,
  type PlayerStats,
} from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTENT_WIDTH = SCREEN_WIDTH - 40; // 20px padding each side
const TABLE_SEASON_COL = 104;

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function getStatValue(stats: PlayerStats | undefined | null, key: string): number {
  if (!stats) return 0;
  return (stats as unknown as Record<string, number>)[key] ?? 0;
}

function getPoints(player: Player, sport: Sport): number {
  const s = player.stats;
  if (!s) return 0;
  switch (sport) {
    case 'hockey': return getStatValue(s, 'goals') + getStatValue(s, 'assists');
    case 'soccer': return getStatValue(s, 'goals') + getStatValue(s, 'assists');
    case 'lacrosse': return getStatValue(s, 'goals') + getStatValue(s, 'assists');
    case 'basketball': return getStatValue(s, 'points');
    case 'baseball':
    case 'softball': return getStatValue(s, 'hits');
    default: return 0;
  }
}

function getArchivedPlayerStats(season: ArchivedSeason, playerId: string): ArchivedPlayerStats | undefined {
  return season.playerStats.find((ps) => ps.playerId === playerId);
}

// ─── Trophy computation ────────────────────────────────────────────────────────

interface TrophyItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
}

function computeTrophies(
  player: Player,
  allPlayers: Player[],
  seasonHistory: ArchivedSeason[],
  sport: Sport,
  games: { checkedInPlayers?: string[]; gameResult?: string }[]
): TrophyItem[] {
  const trophies: TrophyItem[] = [];
  const eligiblePlayers = allPlayers.filter((p) => {
    const pos = p.position?.toLowerCase();
    return pos !== 'coach' && pos !== 'parent' && !p.roles?.includes('coach' as any) && !p.roles?.includes('parent' as any);
  });

  const statLeadership: { key: string; label: string }[] = [];
  if (sport === 'hockey') {
    statLeadership.push({ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' }, { key: 'pim', label: 'PIM' });
  } else if (sport === 'soccer') {
    statLeadership.push({ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' });
  } else if (sport === 'lacrosse') {
    statLeadership.push({ key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' }, { key: 'groundBalls', label: 'Ground Balls' });
  } else if (sport === 'basketball') {
    statLeadership.push({ key: 'points', label: 'Points' }, { key: 'rebounds', label: 'Rebounds' }, { key: 'assists', label: 'Assists' });
  } else if (sport === 'baseball' || sport === 'softball') {
    statLeadership.push({ key: 'hits', label: 'Hits' }, { key: 'homeRuns', label: 'Home Runs' }, { key: 'rbi', label: 'RBI' });
  }

  for (const { key, label } of statLeadership) {
    const playerVal = getStatValue(player.stats, key);
    if (playerVal <= 0) continue;
    const max = Math.max(...eligiblePlayers.map((p) => getStatValue(p.stats, key)));
    if (playerVal === max) {
      trophies.push({
        id: `lead-${key}`,
        icon: <Target size={18} color="#f59e0b" />,
        title: `Team ${label} Leader`,
        subtitle: `${playerVal} ${label.toLowerCase()} this season`,
        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',
      });
    }
  }

  if (sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') {
    const myPts = getPoints(player, sport);
    if (myPts > 0) {
      const maxPts = Math.max(...eligiblePlayers.map((p) => getPoints(p, sport)));
      if (myPts === maxPts) {
        trophies.push({
          id: 'lead-pts',
          icon: <Zap size={18} color="#f59e0b" />,
          title: 'Team Points Leader',
          subtitle: `${myPts} pts this season`,
          color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)',
        });
      }
    }
  }

  const completedGames = games.filter((g) => g.gameResult);
  const gamesPlayed = completedGames.length;
  const attended = completedGames.filter((g) => (g.checkedInPlayers ?? []).includes(player.id)).length;

  if (gamesPlayed >= 5 && attended === gamesPlayed) {
    trophies.push({
      id: 'iron-man',
      icon: <Flame size={18} color="#ef4444" />,
      title: 'Iron Man',
      subtitle: `Perfect attendance — ${gamesPlayed} games`,
      color: '#ef4444', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)',
    });
  } else if (gamesPlayed >= 10 && attended / gamesPlayed >= 0.9) {
    trophies.push({
      id: 'reliable',
      icon: <Shield size={18} color="#22c55e" />,
      title: 'Most Reliable',
      subtitle: `${attended}/${gamesPlayed} games attended`,
      color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.25)',
    });
  }

  if (attended > 0 && gamesPlayed > 0) {
    const maxAttendance = Math.max(
      ...eligiblePlayers.map((p) =>
        completedGames.filter((g) => (g.checkedInPlayers ?? []).includes(p.id)).length
      )
    );
    if (attended === maxAttendance && attended >= 3 && !trophies.find((t) => t.id === 'iron-man')) {
      trophies.push({
        id: 'most-attendance',
        icon: <Calendar size={18} color="#67e8f9" />,
        title: 'Most Games Attended',
        subtitle: `${attended} games this season`,
        color: '#67e8f9', bg: 'rgba(103,232,249,0.1)', border: 'rgba(103,232,249,0.25)',
      });
    }
  }

  for (const season of seasonHistory) {
    const ps = getArchivedPlayerStats(season, player.id);
    if (!ps) continue;
    for (const { key, label } of statLeadership) {
      const myVal = getStatValue(ps.stats, key);
      if (myVal <= 0) continue;
      const max = Math.max(...season.playerStats.map((p) => getStatValue(p.stats, key)));
      if (myVal === max) {
        trophies.push({
          id: `arch-${season.id}-${key}`,
          icon: <Award size={18} color="#a78bfa" />,
          title: `${season.seasonName} ${label} Leader`,
          subtitle: `Led team with ${myVal} ${label.toLowerCase()}`,
          color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)',
        });
      }
    }
  }

  const sortedCompleted = [...completedGames].sort(
    (a, b) => new Date((a as any).date || 0).getTime() - new Date((b as any).date || 0).getTime()
  );
  let streak = 0, maxStreak = 0;
  for (const g of sortedCompleted) {
    if (g.gameResult === 'win' && (g.checkedInPlayers ?? []).includes(player.id)) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 0;
    }
  }
  if (maxStreak >= 5) {
    trophies.push({
      id: 'hot-streak',
      icon: <Flame size={18} color="#f97316" />,
      title: `${maxStreak}-Game Win Streak`,
      subtitle: 'Contributed to team winning streak',
      color: '#f97316', bg: 'rgba(249,115,22,0.1)', border: 'rgba(249,115,22,0.25)',
    });
  }

  return trophies;
}

// ─── Stats Table types ─────────────────────────────────────────────────────────

interface StatsRow {
  label: string;
  values: (string | number)[];
  isCurrent?: boolean;
  isCareer?: boolean;
}

interface StatsTableData {
  headers: string[];
  rows: StatsRow[];
  colors: string[];
  highlightIndices: number[];
}

// ─── Stats table builders ──────────────────────────────────────────────────────

function buildSkaterTable(
  player: Player,
  seasonHistory: ArchivedSeason[],
  sport: Sport,
  currentSeasonName?: string,
): StatsTableData | null {
  const sorted = [...seasonHistory].sort(
    (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime(),
  );

  if (sport === 'hockey') {
    type R = { gp: number; g: number; a: number; pim: number; pm: number };
    const extract = (s: PlayerStats | undefined | null): R | null => {
      if (!s) return null;
      const gp = getStatValue(s, 'gamesPlayed') || getStatValue(s, 'games');
      const g = getStatValue(s, 'goals'), a = getStatValue(s, 'assists');
      const pim = getStatValue(s, 'pim'), pm = getStatValue(s, 'plusMinus');
      if (gp === 0 && g === 0 && a === 0) return null;
      return { gp, g, a, pim, pm };
    };
    const fmt = (r: R): (string | number)[] => [
      r.gp, r.g, r.a, r.g + r.a, r.pim,
      r.pm >= 0 ? `+${r.pm}` : `${r.pm}`,
    ];
    const rows: StatsRow[] = [];
    let c: R = { gp: 0, g: 0, a: 0, pim: 0, pm: 0 };
    let n = 0;
    const curr = extract(player.stats);
    if (curr) {
      rows.push({ label: currentSeasonName || 'Current', values: fmt(curr), isCurrent: true });
      c.gp += curr.gp; c.g += curr.g; c.a += curr.a; c.pim += curr.pim; c.pm += curr.pm; n++;
    }
    for (const season of sorted) {
      const r = extract(getArchivedPlayerStats(season, player.id)?.stats);
      if (!r) continue;
      rows.push({ label: season.seasonName, values: fmt(r) });
      c.gp += r.gp; c.g += r.g; c.a += r.a; c.pim += r.pim; c.pm += r.pm; n++;
    }
    if (n === 0) return null;
    if (n > 1) rows.push({ label: 'CAREER', values: fmt(c), isCareer: true });
    return {
      headers: ['GP', 'G', 'A', 'PTS', 'PIM', '+/-'],
      rows,
      colors: ['#94a3b8', '#22c55e', '#67e8f9', '#f59e0b', '#ef4444', '#94a3b8'],
      highlightIndices: [1, 2, 3],
    };
  }

  if (sport === 'soccer') {
    type R = { gp: number; g: number; a: number; yc: number };
    const extract = (s: PlayerStats | undefined | null): R | null => {
      if (!s) return null;
      const gp = getStatValue(s, 'gamesPlayed') || getStatValue(s, 'games');
      const g = getStatValue(s, 'goals'), a = getStatValue(s, 'assists'), yc = getStatValue(s, 'yellowCards');
      if (gp === 0 && g === 0 && a === 0) return null;
      return { gp, g, a, yc };
    };
    const fmt = (r: R): (string | number)[] => [r.gp, r.g, r.a, r.g + r.a, r.yc];
    const rows: StatsRow[] = [];
    let c: R = { gp: 0, g: 0, a: 0, yc: 0 };
    let n = 0;
    const curr = extract(player.stats);
    if (curr) {
      rows.push({ label: currentSeasonName || 'Current', values: fmt(curr), isCurrent: true });
      c.gp += curr.gp; c.g += curr.g; c.a += curr.a; c.yc += curr.yc; n++;
    }
    for (const season of sorted) {
      const r = extract(getArchivedPlayerStats(season, player.id)?.stats);
      if (!r) continue;
      rows.push({ label: season.seasonName, values: fmt(r) });
      c.gp += r.gp; c.g += r.g; c.a += r.a; c.yc += r.yc; n++;
    }
    if (n === 0) return null;
    if (n > 1) rows.push({ label: 'CAREER', values: fmt(c), isCareer: true });
    return {
      headers: ['GP', 'G', 'A', 'PTS', 'YC'],
      rows,
      colors: ['#94a3b8', '#22c55e', '#67e8f9', '#f59e0b', '#fbbf24'],
      highlightIndices: [1, 2, 3],
    };
  }

  if (sport === 'lacrosse') {
    type R = { gp: number; g: number; a: number; gb: number };
    const extract = (s: PlayerStats | undefined | null): R | null => {
      if (!s) return null;
      const gp = getStatValue(s, 'gamesPlayed') || getStatValue(s, 'games');
      const g = getStatValue(s, 'goals'), a = getStatValue(s, 'assists'), gb = getStatValue(s, 'groundBalls');
      if (gp === 0 && g === 0 && a === 0) return null;
      return { gp, g, a, gb };
    };
    const fmt = (r: R): (string | number)[] => [r.gp, r.g, r.a, r.g + r.a, r.gb];
    const rows: StatsRow[] = [];
    let c: R = { gp: 0, g: 0, a: 0, gb: 0 };
    let n = 0;
    const curr = extract(player.stats);
    if (curr) {
      rows.push({ label: currentSeasonName || 'Current', values: fmt(curr), isCurrent: true });
      c.gp += curr.gp; c.g += curr.g; c.a += curr.a; c.gb += curr.gb; n++;
    }
    for (const season of sorted) {
      const r = extract(getArchivedPlayerStats(season, player.id)?.stats);
      if (!r) continue;
      rows.push({ label: season.seasonName, values: fmt(r) });
      c.gp += r.gp; c.g += r.g; c.a += r.a; c.gb += r.gb; n++;
    }
    if (n === 0) return null;
    if (n > 1) rows.push({ label: 'CAREER', values: fmt(c), isCareer: true });
    return {
      headers: ['GP', 'G', 'A', 'PTS', 'GB'],
      rows,
      colors: ['#94a3b8', '#22c55e', '#67e8f9', '#f59e0b', '#a78bfa'],
      highlightIndices: [1, 2, 3],
    };
  }

  if (sport === 'basketball') {
    type R = { gp: number; pts: number; reb: number; ast: number; stl: number; blk: number };
    const extract = (s: PlayerStats | undefined | null): R | null => {
      if (!s) return null;
      const gp = getStatValue(s, 'gamesPlayed') || getStatValue(s, 'games');
      const pts = getStatValue(s, 'points'), reb = getStatValue(s, 'rebounds'), ast = getStatValue(s, 'assists');
      const stl = getStatValue(s, 'steals'), blk = getStatValue(s, 'blocks');
      if (gp === 0 && pts === 0) return null;
      return { gp, pts, reb, ast, stl, blk };
    };
    const fmt = (r: R): (string | number)[] => {
      const ppg = r.gp > 0 ? (r.pts / r.gp).toFixed(1) : '0.0';
      const rpg = r.gp > 0 ? (r.reb / r.gp).toFixed(1) : '0.0';
      const apg = r.gp > 0 ? (r.ast / r.gp).toFixed(1) : '0.0';
      return [r.gp, ppg, rpg, apg, r.stl, r.blk];
    };
    const rows: StatsRow[] = [];
    let c: R = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
    let n = 0;
    const curr = extract(player.stats);
    if (curr) {
      rows.push({ label: currentSeasonName || 'Current', values: fmt(curr), isCurrent: true });
      c.gp += curr.gp; c.pts += curr.pts; c.reb += curr.reb; c.ast += curr.ast; c.stl += curr.stl; c.blk += curr.blk; n++;
    }
    for (const season of sorted) {
      const r = extract(getArchivedPlayerStats(season, player.id)?.stats);
      if (!r) continue;
      rows.push({ label: season.seasonName, values: fmt(r) });
      c.gp += r.gp; c.pts += r.pts; c.reb += r.reb; c.ast += r.ast; c.stl += r.stl; c.blk += r.blk; n++;
    }
    if (n === 0) return null;
    if (n > 1) rows.push({ label: 'CAREER', values: fmt(c), isCareer: true });
    return {
      headers: ['GP', 'PPG', 'RPG', 'APG', 'STL', 'BLK'],
      rows,
      colors: ['#94a3b8', '#f59e0b', '#22c55e', '#67e8f9', '#a78bfa', '#ef4444'],
      highlightIndices: [1, 2, 3],
    };
  }

  if (sport === 'baseball' || sport === 'softball') {
    type R = { gp: number; ab: number; h: number; hr: number; rbi: number; k: number };
    const extract = (s: PlayerStats | undefined | null): R | null => {
      if (!s) return null;
      const gp = getStatValue(s, 'gamesPlayed') || getStatValue(s, 'games');
      const ab = getStatValue(s, 'atBats'), h = getStatValue(s, 'hits');
      const hr = getStatValue(s, 'homeRuns'), rbi = getStatValue(s, 'rbi'), k = getStatValue(s, 'strikeouts');
      if (gp === 0 && ab === 0) return null;
      return { gp, ab, h, hr, rbi, k };
    };
    const fmt = (r: R): (string | number)[] => {
      const avg = r.ab > 0 ? (r.h / r.ab).toFixed(3).replace('0.', '.') : '.000';
      return [r.gp, avg, r.h, r.hr, r.rbi, r.k];
    };
    const rows: StatsRow[] = [];
    let c: R = { gp: 0, ab: 0, h: 0, hr: 0, rbi: 0, k: 0 };
    let n = 0;
    const curr = extract(player.stats);
    if (curr) {
      rows.push({ label: currentSeasonName || 'Current', values: fmt(curr), isCurrent: true });
      c.gp += curr.gp; c.ab += curr.ab; c.h += curr.h; c.hr += curr.hr; c.rbi += curr.rbi; c.k += curr.k; n++;
    }
    for (const season of sorted) {
      const r = extract(getArchivedPlayerStats(season, player.id)?.stats);
      if (!r) continue;
      rows.push({ label: season.seasonName, values: fmt(r) });
      c.gp += r.gp; c.ab += r.ab; c.h += r.h; c.hr += r.hr; c.rbi += r.rbi; c.k += r.k; n++;
    }
    if (n === 0) return null;
    if (n > 1) rows.push({ label: 'CAREER', values: fmt(c), isCareer: true });
    return {
      headers: ['GP', 'AVG', 'H', 'HR', 'RBI', 'K'],
      rows,
      colors: ['#94a3b8', '#f59e0b', '#22c55e', '#ef4444', '#67e8f9', '#94a3b8'],
      highlightIndices: [1, 2, 3],
    };
  }

  return null;
}

function buildGoalieTable(
  player: Player,
  seasonHistory: ArchivedSeason[],
  currentSeasonName?: string,
): StatsTableData | null {
  const sorted = [...seasonHistory].sort(
    (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime(),
  );
  type R = { gp: number; w: number; l: number; sa: number; sv: number; ga: number };
  const extract = (gs: Player['goalieStats'] | null | undefined): R | null => {
    if (!gs) return null;
    const gp = getStatValue(gs as unknown as PlayerStats, 'games');
    const w = getStatValue(gs as unknown as PlayerStats, 'wins');
    const l = getStatValue(gs as unknown as PlayerStats, 'losses');
    const sa = getStatValue(gs as unknown as PlayerStats, 'shotsAgainst');
    const sv = getStatValue(gs as unknown as PlayerStats, 'saves');
    const ga = getStatValue(gs as unknown as PlayerStats, 'goalsAgainst');
    if (gp === 0) return null;
    return { gp, w, l, sa, sv, ga };
  };
  const fmt = (r: R): (string | number)[] => {
    const svPct = r.sa > 0 ? `${(r.sv / r.sa * 100).toFixed(1)}%` : '—';
    const gaa = r.gp > 0 ? (r.ga / r.gp).toFixed(2) : '—';
    return [r.gp, r.w, r.l, svPct, gaa];
  };
  const rows: StatsRow[] = [];
  let c: R = { gp: 0, w: 0, l: 0, sa: 0, sv: 0, ga: 0 };
  let n = 0;
  const curr = extract(player.goalieStats);
  if (curr) {
    rows.push({ label: currentSeasonName || 'Current', values: fmt(curr), isCurrent: true });
    c.gp += curr.gp; c.w += curr.w; c.l += curr.l; c.sa += curr.sa; c.sv += curr.sv; c.ga += curr.ga; n++;
  }
  for (const season of sorted) {
    const ps = getArchivedPlayerStats(season, player.id);
    const r = extract(ps?.goalieStats as Player['goalieStats'] | undefined);
    if (!r) continue;
    rows.push({ label: season.seasonName, values: fmt(r) });
    c.gp += r.gp; c.w += r.w; c.l += r.l; c.sa += r.sa; c.sv += r.sv; c.ga += r.ga; n++;
  }
  if (n === 0) return null;
  if (n > 1) rows.push({ label: 'CAREER', values: fmt(c), isCareer: true });
  return {
    headers: ['GP', 'W', 'L', 'SV%', 'GAA'],
    rows,
    colors: ['#94a3b8', '#22c55e', '#ef4444', '#67e8f9', '#a78bfa'],
    highlightIndices: [1, 3, 4],
  };
}

// ─── StatsTable component ──────────────────────────────────────────────────────

function StatsTable({ data, title }: { data: StatsTableData; title?: string }) {
  const numCols = data.headers.length;
  const statColWidth = (CONTENT_WIDTH - TABLE_SEASON_COL) / numCols;

  return (
    <View style={{ marginBottom: 20 }}>
      {title && (
        <Text style={{
          color: '#475569', fontSize: 11, fontWeight: '700',
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
        }}>
          {title}
        </Text>
      )}

      <View style={{
        backgroundColor: 'rgba(8,12,20,0.97)',
        borderRadius: 18,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(103,232,249,0.1)',
      }}>
        {/* Column header row */}
        <View style={{
          flexDirection: 'row',
          paddingVertical: 9,
          paddingHorizontal: 14,
          backgroundColor: 'rgba(0,0,0,0.45)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}>
          <View style={{ width: TABLE_SEASON_COL }}>
            <Text style={{ color: '#1e3a52', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
              SEASON
            </Text>
          </View>
          {data.headers.map((h) => (
            <View key={h} style={{ width: statColWidth, alignItems: 'center' }}>
              <Text style={{ color: '#1e3a52', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
                {h}
              </Text>
            </View>
          ))}
        </View>

        {/* Data rows */}
        {data.rows.map((row, ri) => (
          <View
            key={`${row.label}-${ri}`}
            style={{
              flexDirection: 'row',
              paddingVertical: row.isCareer ? 13 : 11,
              paddingHorizontal: 14,
              borderTopWidth: ri > 0 ? 1 : 0,
              borderTopColor: row.isCareer
                ? 'rgba(103,232,249,0.18)'
                : 'rgba(255,255,255,0.04)',
              backgroundColor: row.isCareer ? 'rgba(103,232,249,0.04)' : 'transparent',
              alignItems: 'center',
            }}
          >
            {/* Season label */}
            <View style={{
              width: TABLE_SEASON_COL,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
              {row.isCurrent && (
                <View style={{
                  width: 5, height: 5, borderRadius: 3,
                  backgroundColor: '#67e8f9', flexShrink: 0,
                }} />
              )}
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{
                  color: row.isCareer ? '#67e8f9' : row.isCurrent ? '#e2e8f0' : '#64748b',
                  fontSize: row.isCareer ? 10 : 12,
                  fontWeight: row.isCareer ? '800' : row.isCurrent ? '600' : '400',
                  letterSpacing: row.isCareer ? 1 : 0,
                  flex: 1,
                }}
              >
                {row.label}
              </Text>
            </View>

            {/* Stat value cells */}
            {row.values.map((val, ci) => {
              const isHighlight = data.highlightIndices.includes(ci);
              const color = data.colors[ci] ?? '#94a3b8';
              return (
                <View key={ci} style={{ width: statColWidth, alignItems: 'center' }}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.65}
                    style={{
                      color: isHighlight ? color : '#475569',
                      fontSize: row.isCareer ? 14 : 13,
                      fontWeight: row.isCareer ? '800' : isHighlight ? '700' : '500',
                      width: statColWidth - 4,
                      textAlign: 'center',
                    }}
                  >
                    {val}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const games = useTeamStore((s) => s.games);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const player = players.find((p) => p.id === id);
  const sport: Sport = (teamSettings?.sport as Sport) ?? 'hockey';
  const seasonHistory = teamSettings?.seasonHistory ?? [];
  const currentSeasonName = teamSettings?.currentSeasonName;

  const isMyCard = id === currentPlayerId;

  const skaterTable = useMemo(
    () => player ? buildSkaterTable(player, seasonHistory, sport, currentSeasonName) : null,
    [player, seasonHistory, sport, currentSeasonName],
  );

  const goalieTable = useMemo(
    () => player ? buildGoalieTable(player, seasonHistory, currentSeasonName) : null,
    [player, seasonHistory, currentSeasonName],
  );

  const completedGames = useMemo(() => games.filter((g) => g.gameResult), [games]);

  const trophies = useMemo(
    () => (player ? computeTrophies(player, players, seasonHistory, sport, completedGames) : []),
    [player, players, seasonHistory, sport, completedGames],
  );

  const totalInvited = useMemo(
    () => games.filter((g) => g.invitedPlayers?.includes(id ?? '')).length,
    [games, id],
  );
  const totalCheckedIn = useMemo(
    () => completedGames.filter((g) => g.checkedInPlayers?.includes(id ?? '')).length,
    [completedGames, id],
  );
  const attendancePct = completedGames.length > 0
    ? Math.round((totalCheckedIn / completedGames.length) * 100)
    : 0;

  const handleShare = async () => {
    if (!player) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const currentRow = skaterTable?.rows.find((r) => r.isCurrent);
    const statSummary = currentRow
      ? currentRow.values.map((v, i) => `${skaterTable!.headers[i]}: ${v}`).join(' | ')
      : '';
    const trophyLine = trophies.length > 0
      ? `\n🏆 ${trophies.map((t) => t.title).join(', ')}`
      : '';
    const message = `${getPlayerName(player)} #${player.number} — ${teamName}\n${sport.charAt(0).toUpperCase() + sport.slice(1)} · ${player.position}\n\n📊 ${statSummary}${trophyLine}\n\nTracked with AlignSports`;
    await Share.share({ message });
  };

  if (!player) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#64748b', fontSize: 16 }}>Player not found</Text>
      </View>
    );
  }

  const isCoach = player.position === 'Coach' || player.roles?.includes('coach' as any);
  const isParent = player.position === 'Parent' || player.roles?.includes('parent' as any);
  const isAdmin = player.roles?.includes('admin');
  const isCaptain = player.roles?.includes('captain');
  const hasStats = skaterTable !== null || goalieTable !== null;

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      <LinearGradient
        colors={['#080c14', '#0f172a', '#0d1a2e']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingVertical: 10,
          }}
        >
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.07)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={22} color="#94a3b8" />
          </Pressable>

          <Text style={{ color: '#334155', fontSize: 13, fontWeight: '600' }}>
            {isMyCard ? 'My Card' : 'Player Card'}
          </Text>

          <Pressable
            onPress={handleShare}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.07)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Share2 size={18} color="#67e8f9" />
          </Pressable>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* ── Hero Card ─────────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={{ paddingHorizontal: 20, marginBottom: 20 }}
          >
            <LinearGradient
              colors={['#0f1e35', '#0a1628']}
              style={{
                borderRadius: 28, overflow: 'hidden',
                borderWidth: 1, borderColor: 'rgba(103,232,249,0.12)',
              }}
            >
              {/* Jersey number watermark */}
              <View style={{ position: 'absolute', right: -10, top: -10, opacity: 0.06 }}>
                <Text style={{ color: '#67e8f9', fontSize: 160, fontWeight: '900', letterSpacing: -8 }}>
                  {player.number || '0'}
                </Text>
              </View>

              {/* Top cyan accent line */}
              <View style={{ height: 3, borderRadius: 3, marginHorizontal: 32, marginTop: 0, overflow: 'hidden' }}>
                <LinearGradient
                  colors={['transparent', '#67e8f9', 'transparent']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 3, borderRadius: 2 }}
                />
              </View>

              {/* Player info */}
              <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {/* Avatar */}
                  <View style={{ marginRight: 18 }}>
                    <View style={{
                      width: 100, height: 100, borderRadius: 50,
                      borderWidth: 2.5, borderColor: '#67e8f9', padding: 3, backgroundColor: '#0a1628',
                    }}>
                      <PlayerAvatar player={player} size={92} />
                    </View>
                    <View style={{
                      position: 'absolute', bottom: -4, right: -4,
                      backgroundColor: '#67e8f9', borderRadius: 12,
                      paddingHorizontal: 8, paddingVertical: 3,
                      borderWidth: 2, borderColor: '#0a1628',
                    }}>
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>
                        #{player.number}
                      </Text>
                    </View>
                  </View>

                  {/* Name & info */}
                  <View style={{ flex: 1, paddingBottom: 4 }}>
                    <Text
                      style={{
                        color: '#ffffff', fontSize: 24, fontWeight: '900',
                        letterSpacing: -0.5, lineHeight: 28, marginBottom: 4,
                      }}
                      numberOfLines={2}
                    >
                      {player.firstName}{'\n'}{player.lastName}
                    </Text>
                    <Text style={{ color: '#67e8f9', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>
                      {(player.positions?.length ?? 0) > 1
                        ? player.positions!.join(' / ')
                        : player.position}
                      {' · '}
                      <Text style={{ color: '#64748b' }}>{teamName}</Text>
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {isAdmin && (
                        <View style={{ backgroundColor: 'rgba(167,139,250,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(167,139,250,0.4)' }}>
                          <Text style={{ color: '#a78bfa', fontSize: 11, fontWeight: '700' }}>ADMIN</Text>
                        </View>
                      )}
                      {isCaptain && (
                        <View style={{ backgroundColor: 'rgba(245,158,11,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Crown size={10} color="#f59e0b" />
                          <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '700' }}>CAPTAIN</Text>
                        </View>
                      )}
                      {isCoach && (
                        <View style={{ backgroundColor: 'rgba(103,232,249,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(103,232,249,0.3)' }}>
                          <Text style={{ color: '#67e8f9', fontSize: 11, fontWeight: '700' }}>COACH</Text>
                        </View>
                      )}
                      {player.status === 'reserve' && (
                        <View style={{ backgroundColor: 'rgba(148,163,184,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)' }}>
                          <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700' }}>RESERVE</Text>
                        </View>
                      )}
                      {player.isInjured && (
                        <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}>
                          <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '700' }}>INJURED</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 24 }} />

              {/* Attendance stats */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 18 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 22 }}>{totalCheckedIn}</Text>
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Games In</Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 22 }}>{totalInvited}</Text>
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Invited</Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{
                    fontWeight: '800', fontSize: 22,
                    color: attendancePct >= 80 ? '#22c55e' : attendancePct >= 50 ? '#f59e0b' : '#ef4444',
                  }}>
                    {attendancePct}%
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Attendance</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Stats Table ───────────────────────────────────────────────── */}
          {skaterTable && (
            <Animated.View
              entering={FadeInDown.delay(140).springify()}
              style={{ paddingHorizontal: 20 }}
            >
              <StatsTable
                data={skaterTable}
                title={goalieTable ? 'Skater Stats' : 'Stats'}
              />
            </Animated.View>
          )}

          {goalieTable && (
            <Animated.View
              entering={FadeInDown.delay(160).springify()}
              style={{ paddingHorizontal: 20 }}
            >
              <StatsTable
                data={goalieTable}
                title={skaterTable ? 'Goalie Stats' : 'Stats'}
              />
            </Animated.View>
          )}

          {/* ── Trophy Cabinet ─────────────────────────────────────────────── */}
          {trophies.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={{ paddingHorizontal: 20, marginBottom: 20 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <Trophy size={14} color="#f59e0b" />
                <Text style={{
                  color: '#475569', fontSize: 11, fontWeight: '700',
                  letterSpacing: 1.2, textTransform: 'uppercase',
                }}>
                  Trophy Cabinet
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {trophies.map((trophy, i) => (
                  <Animated.View
                    key={trophy.id}
                    entering={FadeInDown.delay(220 + i * 40).springify()}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      backgroundColor: trophy.bg, borderRadius: 14,
                      padding: 14, borderWidth: 1, borderColor: trophy.border, gap: 12,
                    }}
                  >
                    <View style={{
                      width: 38, height: 38, borderRadius: 11,
                      backgroundColor: `${trophy.color}20`,
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {trophy.icon}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: trophy.color, fontWeight: '700', fontSize: 14 }}>{trophy.title}</Text>
                      <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>{trophy.subtitle}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Empty state */}
          {!hasStats && !isCoach && !isParent && trophies.length === 0 && (
            <Animated.View
              entering={FadeInDown.delay(160).springify()}
              style={{ paddingHorizontal: 20, alignItems: 'center', paddingVertical: 24 }}
            >
              <Crosshair size={36} color="#1e293b" />
              <Text style={{ color: '#334155', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 }}>
                No stats recorded yet.{'\n'}Trophies and stats will appear here as the season progresses.
              </Text>
            </Animated.View>
          )}

          {/* Coach / Parent message */}
          {(isCoach || isParent) && (
            <Animated.View
              entering={FadeInDown.delay(160).springify()}
              style={{ paddingHorizontal: 20, alignItems: 'center', paddingVertical: 24 }}
            >
              <Users size={36} color="#1e293b" />
              <Text style={{ color: '#334155', fontSize: 14, textAlign: 'center', marginTop: 12 }}>
                {isCoach ? 'Coaches' : 'Parents'} don't have individual stats.
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
