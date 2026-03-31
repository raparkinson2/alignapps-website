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
  Star,
  Flame,
  Target,
  Zap,
  Users,
  Calendar,
  TrendingUp,
  Award,
  Share2,
  Crosshair,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
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
  type HockeyGoalieStats,
  type SoccerGoalieStats,
  type LacrosseGoalieStats,
  type BaseballPitcherStats,
} from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Stat helpers ─────────────────────────────────────────────────────────────

function getStatValue(stats: PlayerStats | undefined, key: string): number {
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

function getArchivedPoints(ps: ArchivedPlayerStats, sport: Sport): number {
  const s = ps.stats;
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

// ─── Trophy computation ────────────────────────────────────────────────────────

interface Trophy {
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
): Trophy[] {
  const trophies: Trophy[] = [];
  const eligiblePlayers = allPlayers.filter((p) => {
    const pos = p.position?.toLowerCase();
    return pos !== 'coach' && pos !== 'parent' && !p.roles?.includes('coach' as any) && !p.roles?.includes('parent' as any);
  });

  // ── Current season stat leadership ──────────────────────────────────────────
  const statLeadership: { key: string; label: string; suffix?: string }[] = [];
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
        color: '#f59e0b',
        bg: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.3)',
      });
    }
  }

  // ── Points / scoring leader ──────────────────────────────────────────────────
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
          color: '#f59e0b',
          bg: 'rgba(245,158,11,0.12)',
          border: 'rgba(245,158,11,0.3)',
        });
      }
    }
  }

  // ── Iron Man: attendance ─────────────────────────────────────────────────────
  const completedGames = games.filter((g) => g.gameResult);
  const gamesPlayed = completedGames.length;
  const attended = completedGames.filter((g) => (g.checkedInPlayers ?? []).includes(player.id)).length;
  if (gamesPlayed >= 5 && attended === gamesPlayed) {
    trophies.push({
      id: 'iron-man',
      icon: <Flame size={18} color="#ef4444" />,
      title: 'Iron Man',
      subtitle: `Perfect attendance — ${gamesPlayed} games`,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      border: 'rgba(239,68,68,0.25)',
    });
  } else if (gamesPlayed >= 10 && attended / gamesPlayed >= 0.9) {
    trophies.push({
      id: 'reliable',
      icon: <Shield size={18} color="#22c55e" />,
      title: 'Most Reliable',
      subtitle: `${attended}/${gamesPlayed} games attended`,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.1)',
      border: 'rgba(34,197,94,0.25)',
    });
  }

  // ── Attendance leader this season ────────────────────────────────────────────
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
        color: '#67e8f9',
        bg: 'rgba(103,232,249,0.1)',
        border: 'rgba(103,232,249,0.25)',
      });
    }
  }

  // ── Past season trophies ─────────────────────────────────────────────────────
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
          color: '#a78bfa',
          bg: 'rgba(167,139,250,0.1)',
          border: 'rgba(167,139,250,0.25)',
        });
      }
    }
  }

  // ── Win streak participant ────────────────────────────────────────────────────
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
      color: '#f97316',
      bg: 'rgba(249,115,22,0.1)',
      border: 'rgba(249,115,22,0.25)',
    });
  }

  return trophies;
}

// ─── Sport stat display ────────────────────────────────────────────────────────

interface StatCard {
  label: string;
  value: string | number;
  color: string;
  isHighlight?: boolean;
}

function buildStatCards(player: Player, sport: Sport): StatCard[] {
  const s = player.stats;
  if (!s) return [];

  const gp = getStatValue(s, 'gamesPlayed') || getStatValue(s, 'games');

  switch (sport) {
    case 'hockey': {
      const g = getStatValue(s, 'goals');
      const a = getStatValue(s, 'assists');
      const pim = getStatValue(s, 'pim');
      const pm = getStatValue(s, 'plusMinus');
      if (gp === 0 && g === 0 && a === 0) return [];
      return [
        { label: 'GP', value: gp, color: '#94a3b8' },
        { label: 'G', value: g, color: '#22c55e', isHighlight: true },
        { label: 'A', value: a, color: '#67e8f9', isHighlight: true },
        { label: 'PTS', value: g + a, color: '#f59e0b', isHighlight: true },
        { label: 'PIM', value: pim, color: '#ef4444' },
        { label: '+/-', value: pm >= 0 ? `+${pm}` : `${pm}`, color: pm >= 0 ? '#22c55e' : '#ef4444' },
      ];
    }
    case 'soccer': {
      const g = getStatValue(s, 'goals');
      const a = getStatValue(s, 'assists');
      const yc = getStatValue(s, 'yellowCards');
      if (gp === 0 && g === 0 && a === 0) return [];
      return [
        { label: 'GP', value: gp, color: '#94a3b8' },
        { label: 'G', value: g, color: '#22c55e', isHighlight: true },
        { label: 'A', value: a, color: '#67e8f9', isHighlight: true },
        { label: 'PTS', value: g + a, color: '#f59e0b', isHighlight: true },
        { label: 'YC', value: yc, color: '#f59e0b' },
      ];
    }
    case 'lacrosse': {
      const g = getStatValue(s, 'goals');
      const a = getStatValue(s, 'assists');
      const gb = getStatValue(s, 'groundBalls');
      if (gp === 0 && g === 0 && a === 0) return [];
      return [
        { label: 'GP', value: gp, color: '#94a3b8' },
        { label: 'G', value: g, color: '#22c55e', isHighlight: true },
        { label: 'A', value: a, color: '#67e8f9', isHighlight: true },
        { label: 'PTS', value: g + a, color: '#f59e0b', isHighlight: true },
        { label: 'GB', value: gb, color: '#a78bfa' },
      ];
    }
    case 'basketball': {
      const pts = getStatValue(s, 'points');
      const reb = getStatValue(s, 'rebounds');
      const ast = getStatValue(s, 'assists');
      const stl = getStatValue(s, 'steals');
      const blk = getStatValue(s, 'blocks');
      if (gp === 0 && pts === 0) return [];
      const ppg = gp > 0 ? (pts / gp).toFixed(1) : pts;
      const rpg = gp > 0 ? (reb / gp).toFixed(1) : reb;
      const apg = gp > 0 ? (ast / gp).toFixed(1) : ast;
      return [
        { label: 'GP', value: gp, color: '#94a3b8' },
        { label: 'PPG', value: ppg, color: '#f59e0b', isHighlight: true },
        { label: 'RPG', value: rpg, color: '#22c55e', isHighlight: true },
        { label: 'APG', value: apg, color: '#67e8f9', isHighlight: true },
        { label: 'STL', value: stl, color: '#a78bfa' },
        { label: 'BLK', value: blk, color: '#ef4444' },
      ];
    }
    case 'baseball':
    case 'softball': {
      const ab = getStatValue(s, 'atBats');
      const h = getStatValue(s, 'hits');
      const hr = getStatValue(s, 'homeRuns');
      const rbi = getStatValue(s, 'rbi');
      const k = getStatValue(s, 'strikeouts');
      if (gp === 0 && ab === 0) return [];
      const avg = ab > 0 ? (h / ab).toFixed(3).replace('0.', '.') : '.000';
      return [
        { label: 'GP', value: gp, color: '#94a3b8' },
        { label: 'AVG', value: avg, color: '#f59e0b', isHighlight: true },
        { label: 'H', value: h, color: '#22c55e', isHighlight: true },
        { label: 'HR', value: hr, color: '#ef4444', isHighlight: true },
        { label: 'RBI', value: rbi, color: '#67e8f9' },
        { label: 'K', value: k, color: '#94a3b8' },
      ];
    }
    default:
      return [];
  }
}

function buildGoalieCards(goalieStats: HockeyGoalieStats | SoccerGoalieStats | LacrosseGoalieStats | undefined): StatCard[] {
  if (!goalieStats) return [];
  const gp = getStatValue(goalieStats as PlayerStats, 'games');
  const wins = getStatValue(goalieStats as PlayerStats, 'wins');
  const losses = getStatValue(goalieStats as PlayerStats, 'losses');
  const sa = getStatValue(goalieStats as PlayerStats, 'shotsAgainst');
  const sv = getStatValue(goalieStats as PlayerStats, 'saves');
  const ga = getStatValue(goalieStats as PlayerStats, 'goalsAgainst');
  if (gp === 0) return [];
  const svPct = sa > 0 ? (sv / sa * 100).toFixed(1) : '0.0';
  const gaa = gp > 0 ? (ga / gp).toFixed(2) : '0.00';
  return [
    { label: 'GP', value: gp, color: '#94a3b8' },
    { label: 'W', value: wins, color: '#22c55e', isHighlight: true },
    { label: 'L', value: losses, color: '#ef4444' },
    { label: 'SA', value: sa, color: '#94a3b8' },
    { label: 'SV%', value: `${svPct}%`, color: '#67e8f9', isHighlight: true },
    { label: 'GAA', value: gaa, color: '#a78bfa', isHighlight: true },
  ];
}

// ─── Career totals across seasons ─────────────────────────────────────────────

interface SeasonStatRow {
  seasonName: string;
  statCards: StatCard[];
  isCurrent?: boolean;
}

function buildCareerRows(
  player: Player,
  seasonHistory: ArchivedSeason[],
  sport: Sport,
  currentSeasonName?: string
): SeasonStatRow[] {
  const rows: SeasonStatRow[] = [];

  // Add archived seasons (most recent first)
  const archived = [...seasonHistory].sort(
    (a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  );
  for (const season of archived) {
    const ps = getArchivedPlayerStats(season, player.id);
    if (!ps?.stats) continue;
    const mockPlayer: Player = { ...player, stats: ps.stats, goalieStats: ps.goalieStats as Player['goalieStats'] };
    const cards = buildStatCards(mockPlayer, sport);
    if (cards.length > 0) {
      rows.push({ seasonName: season.seasonName, statCards: cards });
    }
  }

  // Current season last (or first if displayed reversed — will be displayed at top)
  const currentCards = buildStatCards(player, sport);
  if (currentCards.length > 0) {
    rows.unshift({ seasonName: currentSeasonName || 'Current Season', statCards: currentCards, isCurrent: true });
  }

  return rows;
}

// ─── Stat Card Grid ───────────────────────────────────────────────────────────
// Renders stats in rows of 3 so values like "95.2%" never wrap on narrow phones.

function StatCardGrid({ cards }: { cards: StatCard[] }) {
  const GAP = 8;
  const COLS = 3;
  const totalHPad = 40; // 20px each side from parent paddingHorizontal
  const cardWidth = (SCREEN_WIDTH - totalHPad - GAP * (COLS - 1)) / COLS;

  const rows: StatCard[][] = [];
  for (let i = 0; i < cards.length; i += COLS) {
    rows.push(cards.slice(i, i + COLS));
  }

  return (
    <View style={{ gap: GAP }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: GAP }}>
          {row.map((card) => (
            <View
              key={card.label}
              style={{
                width: cardWidth,
                backgroundColor: card.isHighlight
                  ? 'rgba(15,30,53,0.9)'
                  : 'rgba(15,23,42,0.7)',
                borderRadius: 16,
                paddingVertical: 14,
                paddingHorizontal: 4,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: card.isHighlight
                  ? `${card.color}30`
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={{
                  color: card.color,
                  fontSize: card.isHighlight ? 26 : 22,
                  fontWeight: '900',
                  letterSpacing: -0.5,
                  width: cardWidth - 8,
                  textAlign: 'center',
                }}
              >
                {card.value}
              </Text>
              <Text
                style={{
                  color: '#475569',
                  fontSize: 10,
                  fontWeight: '700',
                  marginTop: 2,
                  letterSpacing: 0.5,
                }}
              >
                {card.label}
              </Text>
            </View>
          ))}
        </View>
      ))}
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
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isAdminOrCaptain = currentPlayer?.roles?.includes('admin') || currentPlayer?.roles?.includes('captain');

  const statCards = useMemo(
    () => (player ? buildStatCards(player, sport) : []),
    [player, sport]
  );

  const goalieCards = useMemo(
    () => (player ? buildGoalieCards(player.goalieStats) : []),
    [player]
  );

  const careerRows = useMemo(
    () => (player ? buildCareerRows(player, seasonHistory, sport, currentSeasonName) : []),
    [player, seasonHistory, sport, currentSeasonName]
  );

  const completedGames = useMemo(
    () => games.filter((g) => g.gameResult),
    [games]
  );

  const trophies = useMemo(
    () => (player ? computeTrophies(player, players, seasonHistory, sport, completedGames) : []),
    [player, players, seasonHistory, sport, completedGames]
  );

  // Attendance stats
  const totalInvited = useMemo(
    () => games.filter((g) => g.invitedPlayers?.includes(id ?? '')).length,
    [games, id]
  );
  const totalCheckedIn = useMemo(
    () => completedGames.filter((g) => g.checkedInPlayers?.includes(id ?? '')).length,
    [completedGames, id]
  );
  const attendancePct = completedGames.length > 0
    ? Math.round((totalCheckedIn / completedGames.length) * 100)
    : 0;

  const handleShare = async () => {
    if (!player) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const statSummary = statCards
      .filter((s) => s.isHighlight)
      .map((s) => `${s.label}: ${s.value}`)
      .join(' | ');

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

  const hasStats = statCards.length > 0 || goalieCards.length > 0;
  const hasCareer = careerRows.length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      {/* Full-screen background gradient */}
      <LinearGradient
        colors={['#080c14', '#0f172a', '#0d1a2e']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 10,
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.07)',
              alignItems: 'center',
              justifyContent: 'center',
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
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.07)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={18} color="#67e8f9" />
          </Pressable>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          {/* ── Hero Card ───────────────────────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(80).springify()}
            style={{ paddingHorizontal: 20, marginBottom: 20 }}
          >
            <LinearGradient
              colors={['#0f1e35', '#0a1628']}
              style={{
                borderRadius: 28,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(103,232,249,0.12)',
              }}
            >
              {/* Jersey number watermark */}
              <View
                style={{
                  position: 'absolute',
                  right: -10,
                  top: -10,
                  opacity: 0.06,
                }}
              >
                <Text
                  style={{
                    color: '#67e8f9',
                    fontSize: 160,
                    fontWeight: '900',
                    letterSpacing: -8,
                  }}
                >
                  {player.number || '0'}
                </Text>
              </View>

              {/* Top cyan accent line */}
              <View
                style={{
                  height: 3,
                  borderRadius: 3,
                  marginHorizontal: 32,
                  marginTop: 0,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={['transparent', '#67e8f9', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: 3, borderRadius: 2 }}
                />
              </View>

              {/* Player info section */}
              <View style={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                  {/* Avatar with ring */}
                  <View style={{ marginRight: 18 }}>
                    <View
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 50,
                        borderWidth: 2.5,
                        borderColor: '#67e8f9',
                        padding: 3,
                        backgroundColor: '#0a1628',
                      }}
                    >
                      <PlayerAvatar player={player} size={92} />
                    </View>
                    {/* Jersey badge */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        backgroundColor: '#67e8f9',
                        borderRadius: 12,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderWidth: 2,
                        borderColor: '#0a1628',
                      }}
                    >
                      <Text style={{ color: '#000', fontWeight: '900', fontSize: 12 }}>
                        #{player.number}
                      </Text>
                    </View>
                  </View>

                  {/* Name & info */}
                  <View style={{ flex: 1, paddingBottom: 4 }}>
                    <Text
                      style={{
                        color: '#ffffff',
                        fontSize: 24,
                        fontWeight: '900',
                        letterSpacing: -0.5,
                        lineHeight: 28,
                        marginBottom: 4,
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

                    {/* Role badges */}
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
              <View style={{ flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 18, gap: 0 }}>
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
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 22,
                      color: attendancePct >= 80 ? '#22c55e' : attendancePct >= 50 ? '#f59e0b' : '#ef4444',
                    }}
                  >
                    {attendancePct}%
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>Attendance</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Current Season Stats ─────────────────────────────────────────── */}
          {hasStats && (
            <Animated.View
              entering={FadeInDown.delay(140).springify()}
              style={{ paddingHorizontal: 20, marginBottom: 20 }}
            >
              <Text
                style={{
                  color: '#475569',
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginBottom: 12,
                }}
              >
                {currentSeasonName ? `${currentSeasonName} Stats` : 'This Season'}
              </Text>

              {/* Skater / field stats */}
              {statCards.length > 0 && (
                <StatCardGrid cards={statCards} />
              )}

              {/* Goalie stats */}
              {goalieCards.length > 0 && (
                <View style={{ marginTop: statCards.length > 0 ? 8 : 0 }}>
                  <StatCardGrid cards={goalieCards} />
                </View>
              )}
            </Animated.View>
          )}

          {/* ── Trophy Cabinet ───────────────────────────────────────────────── */}
          {trophies.length > 0 && (
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              style={{ paddingHorizontal: 20, marginBottom: 20 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <Trophy size={14} color="#f59e0b" />
                <Text
                  style={{
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  Trophy Cabinet
                </Text>
              </View>

              <View style={{ gap: 8 }}>
                {trophies.map((trophy, i) => (
                  <Animated.View
                    key={trophy.id}
                    entering={FadeInDown.delay(220 + i * 40).springify()}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: trophy.bg,
                      borderRadius: 14,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: trophy.border,
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        backgroundColor: `${trophy.color}20`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
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

          {/* ── Career History ───────────────────────────────────────────────── */}
          {hasCareer && (
            <Animated.View
              entering={FadeInDown.delay(280).springify()}
              style={{ paddingHorizontal: 20, marginBottom: 20 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                <TrendingUp size={14} color="#67e8f9" />
                <Text
                  style={{
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: '700',
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  Career History
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: 'rgba(15,23,42,0.7)',
                  borderRadius: 18,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}
              >
                {careerRows.map((row, i) => {
                  const highlights = row.statCards.filter((s) => s.isHighlight).slice(0, 3);
                  return (
                    <View
                      key={`${row.seasonName}-${i}`}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        borderTopWidth: i > 0 ? 1 : 0,
                        borderTopColor: 'rgba(255,255,255,0.04)',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flex: 1.2 }}>
                        <Text
                          style={{
                            color: row.isCurrent ? '#67e8f9' : '#94a3b8',
                            fontWeight: row.isCurrent ? '700' : '600',
                            fontSize: 13,
                          }}
                        >
                          {row.seasonName}
                        </Text>
                        {row.isCurrent && (
                          <View
                            style={{
                              backgroundColor: 'rgba(103,232,249,0.15)',
                              borderRadius: 4,
                              paddingHorizontal: 5,
                              paddingVertical: 1,
                              alignSelf: 'flex-start',
                              marginTop: 2,
                            }}
                          >
                            <Text style={{ color: '#67e8f9', fontSize: 9, fontWeight: '700' }}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 2, flexDirection: 'row', justifyContent: 'flex-end', gap: 16 }}>
                        {highlights.map((s) => (
                          <View key={s.label} style={{ alignItems: 'center' }}>
                            <Text style={{ color: s.color, fontWeight: '800', fontSize: 16 }}>{s.value}</Text>
                            <Text style={{ color: '#334155', fontSize: 10, marginTop: 1 }}>{s.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Empty state for no stats */}
          {!hasStats && !isCoach && !isParent && trophies.length === 0 && (
            <Animated.View
              entering={FadeInDown.delay(160).springify()}
              style={{ paddingHorizontal: 20, alignItems: 'center', paddingVertical: 24 }}
            >
              <Crosshair size={36} color="#1e293b" />
              <Text style={{ color: '#334155', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 20 }}>
                No stats recorded yet.{'\n'}Trophies and career history will appear here as the season progresses.
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
