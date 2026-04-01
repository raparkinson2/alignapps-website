import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import {
  X, TrendingUp, Trophy, Flame, Share2,
  Medal, Target, Star, Swords, Shield, Crosshair,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { useTeamStore, getPlayerName } from '@/lib/store';
import { useTeamColor, hexToRgba } from '@/lib/theme';
import type { Sport, Player, GameLogEntry } from '@/lib/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_DURATION = 8000;
const PROGRESS_H_PAD = 16;
const PROGRESS_GAP = 3;

// ─── Slide keys & themes ─────────────────────────────────────────────────────

type SlideKey =
  | 'intro'
  | 'record'
  | 'anchor'
  | 'producer'
  | 'breakdown'
  | 'best-game'
  | 'trophies'
  | 'discipline'
  | 'team'
  | 'share';

const SLIDE_THEMES: Record<SlideKey, { primary: string }> = {
  intro:        { primary: '#67e8f9' },
  record:       { primary: '#a78bfa' },
  anchor:       { primary: '#38bdf8' },
  producer:     { primary: '#f97316' },
  breakdown:    { primary: '#fb923c' },
  'best-game':  { primary: '#f59e0b' },
  trophies:     { primary: '#fbbf24' },
  discipline:   { primary: '#ef4444' },
  team:         { primary: '#22c55e' },
  share:        { primary: '#67e8f9' },
};

// ─── Progress Segment ────────────────────────────────────────────────────────

interface ProgressSegmentProps {
  state: 'past' | 'active' | 'future';
  activeProgress: ReturnType<typeof useSharedValue<number>>;
  segmentWidth: number;
}

function ProgressSegment({ state, activeProgress, segmentWidth }: ProgressSegmentProps) {
  const animStyle = useAnimatedStyle(() => {
    const w =
      state === 'past' ? segmentWidth :
      state === 'active' ? activeProgress.value * segmentWidth :
      0;
    return { width: w };
  });
  return (
    <View style={{ width: segmentWidth, height: 3, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 2, overflow: 'hidden' }}>
      <Animated.View style={[{ height: 3, backgroundColor: '#ffffff', borderRadius: 2 }, animStyle]} />
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStat(stats: unknown, key: string): number {
  if (!stats) return 0;
  return (stats as Record<string, number>)[key] ?? 0;
}

function statAbbrev(label: string): string {
  const map: Record<string, string> = {
    points: 'PTS', goals: 'G', assists: 'AST', hits: 'H',
    rebounds: 'REB', rbi: 'RBI', 'home runs': 'HR',
    'penalty minutes': 'PIM', fouls: 'FLS',
  };
  return map[label.toLowerCase()] ?? label.toUpperCase().slice(0, 3);
}

function getTopStat(player: Player, sport: Sport): { label: string; value: number } {
  const s = player.stats;
  if (!s) return { label: 'Games', value: player.gameLogs?.length ?? 0 };
  switch (sport) {
    case 'hockey':
    case 'lacrosse':
      return { label: 'Points', value: getStat(s, 'goals') + getStat(s, 'assists') };
    case 'soccer':
      return { label: 'Goals', value: getStat(s, 'goals') };
    case 'basketball':
      return { label: 'Points', value: getStat(s, 'points') };
    case 'baseball':
    case 'softball':
      return { label: 'Hits', value: getStat(s, 'hits') };
    default:
      return { label: 'Games', value: player.gameLogs?.length ?? 0 };
  }
}

function getProducerCopy(value: number, label: string, sport: Sport): { headline: string; body: string } {
  if (value === 0) return {
    headline: 'Every shift counts.',
    body: 'Not every contribution shows up in the box score. Your presence and effort matter.',
  };
  if (value >= 30 || (sport === 'basketball' && value >= 200)) return {
    headline: `${value} ${label}. Unstoppable.`,
    body: `You were one of the most dangerous players on the roster this season.`,
  };
  if (value >= 15 || (sport === 'basketball' && value >= 100)) return {
    headline: `${value} ${label}. Solid producer.`,
    body: `You were a consistent offensive threat every time you stepped out there.`,
  };
  return {
    headline: `${value} ${label} this season.`,
    body: `Building something. Keep grinding — the big numbers are coming.`,
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SeasonWrappedScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const teamName = useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId)?.teamName ?? '');
  const teamColor = useTeamColor();
  const sport: Sport = (teamSettings?.sport as Sport) ?? 'hockey';

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );
  const firstName = currentPlayer?.firstName ?? 'Player';

  // ── Attendance — gameLogs / invited (source of truth = stats entered) ───────
  const { attendancePct, gamesPlayed, gamesInvited, totalTeamGames } = useMemo(() => {
    const completed = games.filter((g) => g.gameResult);
    const total = completed.length;
    if (!currentPlayer) return { attendancePct: 0, gamesPlayed: 0, gamesInvited: 0, totalTeamGames: total };
    const invited = completed.filter((g) => g.invitedPlayers?.includes(currentPlayer.id));
    const invitedIds = new Set(invited.map((g) => g.id));
    const played = (currentPlayer.gameLogs ?? []).filter(
      (log) => !log.gameId || invitedIds.has(log.gameId),
    ).length;
    const pct = invited.length > 0 ? Math.min(100, Math.round((played / invited.length) * 100)) : 0;
    return { attendancePct: pct, gamesPlayed: played, gamesInvited: invited.length, totalTeamGames: total };
  }, [games, currentPlayer]);

  // ── Team record ────────────────────────────────────────────────────────────
  const teamRecord = useMemo(() => {
    const completed = games.filter((g) => g.gameResult);
    const wins = completed.filter((g) => g.gameResult === 'win').length;
    const losses = completed.filter((g) => g.gameResult === 'loss' || g.gameResult === 'otLoss').length;
    const ties = completed.filter((g) => g.gameResult === 'tie').length;
    return { wins, losses, ties, total: completed.length };
  }, [games]);

  // ── Top stat ───────────────────────────────────────────────────────────────
  const topStat = useMemo(
    () => currentPlayer ? getTopStat(currentPlayer, sport) : { label: 'Games', value: 0 },
    [currentPlayer, sport],
  );

  const producerCopy = useMemo(
    () => getProducerCopy(topStat.value, topStat.label, sport),
    [topStat, sport],
  );

  // ── Goals + Assists (for producer & breakdown slides) ─────────────────────
  const goals = useMemo(() => getStat(currentPlayer?.stats, 'goals'), [currentPlayer]);
  const assists = useMemo(() => getStat(currentPlayer?.stats, 'assists'), [currentPlayer]);
  const hasGoalsAssists = useMemo(
    () => ['hockey', 'lacrosse', 'soccer', 'basketball'].includes(sport),
    [sport],
  );

  // ── Best single game ───────────────────────────────────────────────────────
  const bestGame = useMemo(() => {
    if (!currentPlayer?.gameLogs?.length) return null;
    let bestLog: GameLogEntry | null = null;
    let bestValue = 0;
    for (const log of currentPlayer.gameLogs) {
      const s = log.stats as unknown as Record<string, number>;
      let val = 0;
      switch (sport) {
        case 'hockey': case 'lacrosse': case 'soccer':
          val = (s.goals ?? 0) + (s.assists ?? 0); break;
        case 'basketball': val = s.points ?? 0; break;
        case 'baseball': case 'softball': val = s.hits ?? 0; break;
        default: val = (s.goals ?? 0) + (s.assists ?? 0);
      }
      if (val > bestValue) { bestValue = val; bestLog = log; }
    }
    if (!bestLog || bestValue === 0) return null;
    const game = games.find((g) => g.id === bestLog!.gameId);
    const s = bestLog.stats as unknown as Record<string, number>;
    return {
      log: bestLog, value: bestValue, game,
      goals: s.goals ?? 0, assists: s.assists ?? 0,
      points: s.points ?? 0, hits: s.hits ?? 0,
      date: bestLog.date,
    };
  }, [currentPlayer, games, sport]);

  // ── Trophies ───────────────────────────────────────────────────────────────
  const earnedTrophies = useMemo(() => {
    if (!currentPlayer) return [];
    const list: Array<{ title: string; subtitle: string; color: string }> = [];
    const eligible = players.filter(
      (p) => !p.roles?.includes('coach') && !p.roles?.includes('parent') && p.stats,
    );
    const myStats = (currentPlayer.stats ?? {}) as unknown as Record<string, number>;

    // Points leader (hockey/lacrosse/basketball)
    if (['hockey', 'lacrosse', 'basketball'].includes(sport)) {
      const myPts = (myStats.goals ?? 0) + (myStats.assists ?? 0);
      const maxPts = Math.max(0, ...eligible.map((p) => {
        const s = (p.stats ?? {}) as Record<string, number>;
        return (s.goals ?? 0) + (s.assists ?? 0);
      }));
      if (myPts > 0 && myPts >= maxPts) {
        list.push({ title: 'Team Points Leader', subtitle: `${myPts} pts this season`, color: '#f59e0b' });
      }
    }

    // Goals leader
    const myGoals = myStats.goals ?? 0;
    const maxGoals = Math.max(0, ...eligible.map((p) => getStat(p.stats, 'goals')));
    if (myGoals > 0 && myGoals >= maxGoals) {
      list.push({ title: 'Team Goals Leader', subtitle: `${myGoals} goals this season`, color: '#ef4444' });
    }

    // Assists leader
    const myAssists = myStats.assists ?? 0;
    const maxAssists = Math.max(0, ...eligible.map((p) => getStat(p.stats, 'assists')));
    if (myAssists > 0 && myAssists >= maxAssists) {
      list.push({ title: 'Team Assists Leader', subtitle: `${myAssists} assists this season`, color: '#3b82f6' });
    }

    // Iron Man
    if (attendancePct >= 100 && gamesInvited >= 5) {
      list.push({ title: 'Iron Man', subtitle: 'Perfect attendance all season', color: '#67e8f9' });
    } else if (attendancePct >= 90 && gamesInvited >= 8) {
      list.push({ title: 'Most Reliable', subtitle: `${attendancePct}% attendance`, color: '#38bdf8' });
    }

    return list;
  }, [currentPlayer, players, sport, attendancePct, gamesInvited]);

  // ── Discipline data ────────────────────────────────────────────────────────
  const disciplineData = useMemo(() => {
    const s = (currentPlayer?.stats ?? {}) as Record<string, number>;
    switch (sport) {
      case 'hockey': return { label: 'Penalty Minutes', abbrev: 'PIM', value: s.pim ?? 0 };
      case 'lacrosse': return { label: 'Penalty Minutes', abbrev: 'PIM', value: s.pim ?? 0 };
      case 'soccer': return { label: 'Fouls', abbrev: 'FLS', value: s.fouls ?? 0 };
      default: return null;
    }
  }, [currentPlayer, sport]);

  // ── Win streak + blowout ───────────────────────────────────────────────────
  const { longestWinStreak, biggestBlowout } = useMemo(() => {
    const completed = [...games]
      .filter((g) => g.gameResult)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let streak = 0, maxStreak = 0, maxDiff = 0;
    let blowoutGame: (typeof games)[0] | null = null;
    for (const g of completed) {
      if (g.gameResult === 'win') { streak++; if (streak > maxStreak) maxStreak = streak; }
      else { streak = 0; }
      if (g.finalScoreUs != null && g.finalScoreThem != null && g.gameResult === 'win') {
        const diff = g.finalScoreUs - g.finalScoreThem;
        if (diff > maxDiff) { maxDiff = diff; blowoutGame = g; }
      }
    }
    return {
      longestWinStreak: maxStreak,
      biggestBlowout: blowoutGame
        ? { diff: maxDiff, us: (blowoutGame as typeof games[0]).finalScoreUs, them: (blowoutGame as typeof games[0]).finalScoreThem, opponent: (blowoutGame as typeof games[0]).opponent }
        : null,
    };
  }, [games]);

  // ── Dynamic slide list ────────────────────────────────────────────────────
  const SLIDES: SlideKey[] = useMemo(() => {
    const s: SlideKey[] = ['intro', 'record', 'anchor', 'producer'];
    if (hasGoalsAssists && (goals > 0 || assists > 0)) s.push('breakdown');
    if (bestGame) s.push('best-game');
    s.push('trophies');
    if (disciplineData) s.push('discipline');
    s.push('team', 'share');
    return s;
  }, [hasGoalsAssists, goals, assists, bestGame, disciplineData]);

  const TOTAL = SLIDES.length;
  const segmentWidth = (SCREEN_WIDTH - PROGRESS_H_PAD * 2 - PROGRESS_GAP * (TOTAL - 1)) / TOTAL;

  // ── Navigation & animation ─────────────────────────────────────────────────
  const [currentSlide, setCurrentSlide] = useState(0);
  const slideProgress = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(SLIDE_DURATION);
  const isPausedRef = useRef(false);
  const cardRef = useRef<View>(null);
  const posterRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  const goToSlide = useCallback((index: number) => {
    if (index >= TOTAL) { router.back(); return; }
    if (index < 0) return;
    setCurrentSlide(index);
  }, [TOTAL, router]);

  const startTimer = useCallback((duration: number) => {
    startTimeRef.current = Date.now();
    remainingRef.current = duration;
    slideProgress.value = 0;
    slideProgress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(goToSlide)(currentSlide + 1);
    });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => goToSlide(currentSlide + 1), duration);
  }, [currentSlide, goToSlide, slideProgress]);

  useEffect(() => {
    isPausedRef.current = false;
    remainingRef.current = SLIDE_DURATION;
    if (SLIDES[currentSlide] === 'share') { slideProgress.value = 1; return; }
    startTimer(SLIDE_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide]);

  const handlePressIn = useCallback(() => {
    if (SLIDES[currentSlide] === 'share') return;
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    const elapsed = Date.now() - startTimeRef.current;
    remainingRef.current = Math.max(200, remainingRef.current - elapsed);
    cancelAnimation(slideProgress);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [currentSlide, slideProgress]);

  const handlePressOut = useCallback(() => {
    if (SLIDES[currentSlide] === 'share') return;
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    startTimer(remainingRef.current);
  }, [currentSlide, startTimer]);

  const handleTapLeft = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToSlide(currentSlide - 1);
  }, [currentSlide, goToSlide]);

  const handleTapRight = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goToSlide(currentSlide + 1);
  }, [currentSlide, goToSlide]);

  // ── Share: capture the full wrapped poster ────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!posterRef.current) return;
    try {
      setIsSharing(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Small delay to ensure the poster is fully laid out before capture
      await new Promise((r) => setTimeout(r, 150));
      const uri = await captureRef(posterRef, { format: 'png', quality: 1.0 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { dialogTitle: 'My Season Wrapped', mimeType: 'image/png' });
      } else {
        Alert.alert('Sharing not available', 'Sharing is not supported on this device.');
      }
    } catch {
      Alert.alert('Could not share', 'Try again in a moment.');
    } finally {
      setIsSharing(false);
    }
  }, []);

  // ── Slide theme color ──────────────────────────────────────────────────────
  const slideKey = SLIDES[currentSlide];
  const slideThemeColor =
    slideKey === 'intro' || slideKey === 'share' ? teamColor : SLIDE_THEMES[slideKey].primary;

  // ── Slide content ──────────────────────────────────────────────────────────
  const renderSlide = () => {
    switch (slideKey) {

      // ── Intro ──────────────────────────────────────────────────────────────
      case 'intro':
        return (
          <Animated.View key="intro" entering={FadeInDown.delay(200).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <View style={[styles.iconRing, { borderColor: hexToRgba(teamColor, 0.5), backgroundColor: hexToRgba(teamColor, 0.15) }]}>
              <Trophy size={44} color={teamColor} />
            </View>
            <Text style={styles.eyebrow}>{teamSettings.currentSeasonName ?? 'This Season'}</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>Your{'\n'}Season{'\n'}Wrapped.</Text>
            <Text style={styles.body}>{firstName}, here's everything you put into this season with {teamName}.</Text>
            <Text style={styles.tapHint}>Tap to continue →</Text>
          </Animated.View>
        );

      // ── Team Record ────────────────────────────────────────────────────────
      case 'record': {
        const { wins, losses, ties } = teamRecord;
        const winRate = teamRecord.total > 0 ? Math.round((wins / teamRecord.total) * 100) : 0;
        const recordHeadline =
          winRate >= 70 ? 'As a squad,\nyou were\ndominant.'
          : winRate >= 50 ? 'A winning\nseason\ntogether.'
          : 'You fought\nfor every\ngame.';
        return (
          <Animated.View key="record" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>Season Record</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>{recordHeadline}</Text>
            <View style={[styles.statCard, { borderColor: hexToRgba('#a78bfa', 0.3), marginTop: 28 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Text style={[styles.bigNumber, { color: '#22c55e' }]}>{wins}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 40, fontWeight: '300', marginBottom: 4, marginHorizontal: 4 }}>-</Text>
                <Text style={[styles.bigNumber, { color: '#ef4444' }]}>{losses}</Text>
                {ties > 0 && (
                  <>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 40, fontWeight: '300', marginBottom: 4, marginHorizontal: 4 }}>-</Text>
                    <Text style={[styles.bigNumber, { color: '#94a3b8' }]}>{ties}</Text>
                  </>
                )}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 6 }}>
                <Text style={[styles.statLabel, { color: '#22c55e' }]}>W</Text>
                <Text style={[styles.statLabel, { color: '#ef4444' }]}>L</Text>
                {ties > 0 && <Text style={[styles.statLabel, { color: '#94a3b8' }]}>T</Text>}
              </View>
              <Text style={[styles.statSub, { marginTop: 10 }]}>{winRate}% win rate · {teamRecord.total} games played</Text>
            </View>
          </Animated.View>
        );
      }

      // ── Attendance (Anchor) ────────────────────────────────────────────────
      case 'anchor':
        return (
          <Animated.View key="anchor" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>The Anchor</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              {attendancePct >= 90
                ? `You showed\nup every\nsingle time.`
                : attendancePct >= 70
                  ? `You were\nalways\nthere.`
                  : `You put in\nthe time.`}
            </Text>
            <View style={[styles.statCard, { borderColor: hexToRgba('#38bdf8', 0.3) }]}>
              <Text style={[styles.bigNumber, { color: '#38bdf8' }]}>{attendancePct}%</Text>
              <Text style={styles.statLabel}>Attendance Rate</Text>
              <Text style={styles.statSub}>{gamesPlayed} of {gamesInvited} games attended</Text>
            </View>
            {attendancePct >= 90 && (
              <Animated.View entering={FadeInUp.delay(400)} style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: hexToRgba('#38bdf8', 0.15), borderColor: hexToRgba('#38bdf8', 0.4) }]}>
                  <Text style={{ color: '#38bdf8', fontSize: 13, fontWeight: '700' }}>🔒 Iron Man</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        );

      // ── Producer (top offensive stat) ─────────────────────────────────────
      case 'producer':
        return (
          <Animated.View key="producer" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>The Producer</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>{producerCopy.headline}</Text>
            <Text style={[styles.body, { marginTop: 12 }]}>{producerCopy.body}</Text>

            <View style={[styles.statCard, { borderColor: hexToRgba('#f97316', 0.3), marginTop: 24 }]}>
              {/* Big points number */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, justifyContent: 'center' }}>
                <Text style={[styles.bigNumber, { color: '#f97316' }]}>{topStat.value}</Text>
                <Text style={{ color: '#f97316', fontSize: 24, fontWeight: '700', marginBottom: 10 }}>{topStat.label}</Text>
              </View>

              {/* Goals + Assists sub-row (for hockey/lacrosse/soccer) */}
              {hasGoalsAssists && (goals > 0 || assists > 0) && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', width: '100%' }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>{goals}</Text>
                    <Text style={styles.statLabel}>Goals</Text>
                  </View>
                  <View style={{ width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>{assists}</Text>
                    <Text style={styles.statLabel}>Assists</Text>
                  </View>
                </View>
              )}
            </View>

            {topStat.value > 0 && (
              <Animated.View entering={FadeInUp.delay(400)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 18 }}>
                <Flame size={16} color="#f97316" />
                <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>Season Contribution</Text>
              </Animated.View>
            )}
          </Animated.View>
        );

      // ── Scoring Breakdown ──────────────────────────────────────────────────
      case 'breakdown': {
        const total = goals + assists;
        const gPct = total > 0 ? (goals / total) * 100 : 50;
        return (
          <Animated.View key="breakdown" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>Scoring Breakdown</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              {gPct >= 60 ? `You're a\nfinisher.`
               : gPct <= 40 ? `You're a\nplaymaker.`
               : `Balanced\non both\nends.`}
            </Text>
            <View style={[styles.statCard, { borderColor: hexToRgba('#fb923c', 0.3), marginTop: 28 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%' }}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#ef4444', fontSize: 56, fontWeight: '900', lineHeight: 62, letterSpacing: -2 }}>{goals}</Text>
                  <Text style={[styles.statLabel, { color: '#ef4444' }]}>Goals</Text>
                </View>
                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 32, fontWeight: '300' }}>+</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ color: '#38bdf8', fontSize: 56, fontWeight: '900', lineHeight: 62, letterSpacing: -2 }}>{assists}</Text>
                  <Text style={[styles.statLabel, { color: '#38bdf8' }]}>Assists</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 16, width: '100%' }} />
              <Text style={{ color: '#fb923c', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 }}>{total} Total Points</Text>
            </View>
          </Animated.View>
        );
      }

      // ── Best Single Game ───────────────────────────────────────────────────
      case 'best-game':
        if (!bestGame) return null;
        return (
          <Animated.View key="best-game" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>Best Performance</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>Your{'\n'}finest{'\n'}hour.</Text>
            <View style={[styles.statCard, { borderColor: hexToRgba('#f59e0b', 0.35), marginTop: 28 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, justifyContent: 'center' }}>
                <Text style={[styles.bigNumber, { color: '#f59e0b' }]}>{bestGame.value}</Text>
                <Text style={{ color: '#f59e0b', fontSize: 22, fontWeight: '700', marginBottom: 10 }}>
                  {sport === 'basketball' ? 'PTS' : sport === 'baseball' || sport === 'softball' ? 'H' : 'PTS'}
                </Text>
              </View>
              {(bestGame.goals > 0 || bestGame.assists > 0) && hasGoalsAssists && (
                <Text style={[styles.statSub, { marginTop: 4 }]}>
                  {bestGame.goals}G · {bestGame.assists}A
                </Text>
              )}
              {bestGame.game?.opponent ? (
                <Text style={[styles.statSub, { marginTop: 8, color: 'rgba(255,255,255,0.5)' }]}>
                  vs {bestGame.game.opponent}
                </Text>
              ) : null}
              {bestGame.date ? (
                <Text style={[styles.statSub, { color: 'rgba(255,255,255,0.3)' }]}>
                  {formatDate(bestGame.date)}
                </Text>
              ) : null}
            </View>
            <Animated.View entering={FadeInUp.delay(400)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 18 }}>
              <Star size={16} color="#f59e0b" />
              <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '600' }}>Season highlight</Text>
            </Animated.View>
          </Animated.View>
        );

      // ── Trophies ───────────────────────────────────────────────────────────
      case 'trophies':
        return (
          <Animated.View key="trophies" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>Trophy Cabinet</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              {earnedTrophies.length >= 3 ? `Legend\nstatus\nunlocked.`
               : earnedTrophies.length >= 1 ? `You left\nyour\nmark.`
               : `The climb\nstarts\nhere.`}
            </Text>
            {earnedTrophies.length > 0 ? (
              <View style={{ gap: 10, marginTop: 24, width: '100%' }}>
                {earnedTrophies.slice(0, 4).map((trophy, i) => (
                  <Animated.View
                    key={trophy.title}
                    entering={FadeInDown.delay(200 + i * 80)}
                    style={[styles.trophyRow, { borderColor: hexToRgba(trophy.color, 0.35) }]}
                  >
                    <View style={[styles.trophyIcon, { backgroundColor: hexToRgba(trophy.color, 0.15) }]}>
                      <Trophy size={18} color={trophy.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: trophy.color, fontSize: 14, fontWeight: '800' }}>{trophy.title}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 }}>{trophy.subtitle}</Text>
                    </View>
                  </Animated.View>
                ))}
              </View>
            ) : (
              <View style={[styles.statCard, { borderColor: hexToRgba('#fbbf24', 0.2), marginTop: 28 }]}>
                <Medal size={32} color="rgba(255,255,255,0.2)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '600', marginTop: 12, textAlign: 'center' }}>
                  No league titles yet.
                </Text>
                <Text style={[styles.statSub, { marginTop: 4 }]}>Keep building — the hardware is coming.</Text>
              </View>
            )}
          </Animated.View>
        );

      // ── Discipline ────────────────────────────────────────────────────────
      case 'discipline':
        if (!disciplineData) return null;
        return (
          <Animated.View key="discipline" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>
              {disciplineData.value === 0 ? 'Clean Season' : 'The Enforcer'}
            </Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              {disciplineData.value === 0
                ? `Spotless.\nNot a\nsingle call.`
                : disciplineData.value >= 20
                  ? `You played\nwith serious\nedge.`
                  : `Tough but\naccountable.`}
            </Text>
            <View style={[styles.statCard, { borderColor: hexToRgba('#ef4444', disciplineData.value > 0 ? 0.35 : 0.15), marginTop: 28 }]}>
              <Text style={[styles.bigNumber, { color: disciplineData.value > 0 ? '#ef4444' : '#22c55e' }]}>
                {disciplineData.value}
              </Text>
              <Text style={styles.statLabel}>{disciplineData.label}</Text>
              {disciplineData.value === 0 && (
                <Text style={[styles.statSub, { marginTop: 6, color: '#22c55e' }]}>Perfect conduct</Text>
              )}
            </View>
          </Animated.View>
        );

      // ── Team Momentum ──────────────────────────────────────────────────────
      case 'team':
        return (
          <Animated.View key="team" entering={FadeInDown.delay(150).springify()} exiting={FadeOut.duration(150)} style={styles.slideContent}>
            <Text style={styles.eyebrow}>Team Momentum</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              {longestWinStreak >= 4
                ? 'As a squad,\nyou were\nelite.'
                : longestWinStreak >= 2
                  ? 'You built\nmomentum\ntogether.'
                  : 'You fought\nfor every\ngame.'}
            </Text>
            <View style={{ gap: 10, width: '100%', marginTop: 8 }}>
              {longestWinStreak >= 2 && (
                <Animated.View entering={FadeInDown.delay(250)} style={[styles.statCard, { borderColor: hexToRgba('#22c55e', 0.3), paddingVertical: 14 }]}>
                  <Text style={styles.statLabel}>Longest Win Streak</Text>
                  <Text style={[styles.bigNumber, { color: '#22c55e', fontSize: 44, lineHeight: 50, marginTop: 4 }]}>
                    {longestWinStreak} in a Row
                  </Text>
                </Animated.View>
              )}
              {biggestBlowout && (
                <Animated.View entering={FadeInDown.delay(350)} style={[styles.statCard, { borderColor: hexToRgba('#22c55e', 0.2), paddingVertical: 14 }]}>
                  <Text style={styles.statLabel}>Biggest Blowout</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 4 }}>
                    <Text style={[styles.bigNumber, { color: '#22c55e', fontSize: 40, lineHeight: 46 }]}>{biggestBlowout.us}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28, fontWeight: '300' }}>–</Text>
                    <Text style={[styles.bigNumber, { color: 'rgba(255,255,255,0.5)', fontSize: 40, lineHeight: 46 }]}>{biggestBlowout.them}</Text>
                  </View>
                  {biggestBlowout.opponent ? (
                    <Text style={styles.statSub}>vs {biggestBlowout.opponent}</Text>
                  ) : null}
                </Animated.View>
              )}
              {longestWinStreak < 2 && !biggestBlowout && (
                <Animated.View entering={FadeInDown.delay(250)} style={[styles.statCard, { borderColor: hexToRgba('#22c55e', 0.2), paddingVertical: 18 }]}>
                  <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 26 }}>
                    The grind is{'\n'}part of the story.
                  </Text>
                  <Text style={[styles.statSub, { marginTop: 6 }]}>Next season, the streak starts.</Text>
                </Animated.View>
              )}
            </View>
          </Animated.View>
        );

      // ── Share Card ─────────────────────────────────────────────────────────
      case 'share': {
        const gp = currentPlayer?.gameLogs?.length ?? gamesPlayed;
        const pimVal = disciplineData?.value ?? 0;
        return (
          <Animated.View key="share" entering={FadeInDown.delay(200).springify()} style={[styles.slideContent, { justifyContent: 'flex-start', paddingTop: 10 }]}>
            <Text style={[styles.eyebrow, { marginBottom: 16 }]}>Share your season.</Text>

            {/* Trading card captured by ViewShot */}
            <View ref={cardRef} collapsable={false}>
              <LinearGradient
                colors={[hexToRgba(teamColor, 0.6), '#0f172a', hexToRgba(teamColor, 0.25)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tradingCard}
              >
                {/* Top row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, width: '100%' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {teamSettings.currentSeasonName ?? 'Season'} Wrapped
                  </Text>
                  <TrendingUp size={14} color={teamColor} />
                </View>

                {/* Jersey number */}
                <View style={[styles.jerseyCircle, { borderColor: teamColor }]}>
                  <Text style={{ color: '#ffffff', fontSize: 38, fontWeight: '900' }}>
                    {currentPlayer?.number || '—'}
                  </Text>
                </View>

                {/* Name + team */}
                <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900', marginTop: 12, textAlign: 'center', letterSpacing: -0.5 }}>
                  {currentPlayer ? getPlayerName(currentPlayer) : firstName}
                </Text>
                <Text style={{ color: hexToRgba(teamColor, 0.9), fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3, textAlign: 'center' }}>
                  {teamName}
                </Text>

                {/* Main stats row */}
                <View style={styles.cardStatsRow}>
                  <View style={styles.cardStatCell}>
                    <Text style={styles.cardStatNumber}>{attendancePct}%</Text>
                    <Text style={styles.cardStatLabel}>ATT</Text>
                  </View>
                  <View style={styles.cardStatDivider} />
                  <View style={styles.cardStatCell}>
                    <Text style={styles.cardStatNumber}>{gp}</Text>
                    <Text style={styles.cardStatLabel}>GP</Text>
                  </View>
                  <View style={styles.cardStatDivider} />
                  {hasGoalsAssists ? (
                    <>
                      <View style={styles.cardStatCell}>
                        <Text style={styles.cardStatNumber}>{goals}</Text>
                        <Text style={styles.cardStatLabel}>G</Text>
                      </View>
                      <View style={styles.cardStatDivider} />
                      <View style={styles.cardStatCell}>
                        <Text style={styles.cardStatNumber}>{assists}</Text>
                        <Text style={styles.cardStatLabel}>AST</Text>
                      </View>
                      <View style={styles.cardStatDivider} />
                      <View style={styles.cardStatCell}>
                        <Text style={[styles.cardStatNumber, { color: teamColor }]}>{topStat.value}</Text>
                        <Text style={styles.cardStatLabel}>PTS</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={styles.cardStatCell}>
                        <Text style={[styles.cardStatNumber, { color: teamColor }]}>{topStat.value}</Text>
                        <Text style={styles.cardStatLabel}>{statAbbrev(topStat.label)}</Text>
                      </View>
                      {disciplineData && (
                        <>
                          <View style={styles.cardStatDivider} />
                          <View style={styles.cardStatCell}>
                            <Text style={styles.cardStatNumber}>{pimVal}</Text>
                            <Text style={styles.cardStatLabel}>{disciplineData.abbrev}</Text>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>

                {/* Trophies + record row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Trophy size={11} color={hexToRgba(teamColor, 0.8)} />
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700' }}>
                      {earnedTrophies.length} {earnedTrophies.length === 1 ? 'Trophy' : 'Trophies'}
                    </Text>
                  </View>
                  <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700' }}>
                    {teamRecord.wins}W – {teamRecord.losses}L{teamRecord.ties > 0 ? ` – ${teamRecord.ties}T` : ''}
                  </Text>
                </View>

                {/* Footer */}
                <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 8, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 14 }}>
                  Align Sports
                </Text>
              </LinearGradient>
            </View>

            {/* Share button — high contrast, always visible */}
            <Pressable
              onPress={handleShare}
              disabled={isSharing}
              style={({ pressed }) => [
                styles.shareButton,
                { opacity: pressed || isSharing ? 0.75 : 1 },
              ]}
            >
              {isSharing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Share2 size={18} color="#ffffff" />
              )}
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16, marginLeft: 8 }}>
                {isSharing ? 'Preparing...' : 'Share to Social'}
              </Text>
            </Pressable>
          </Animated.View>
        );
      }

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />

      <Animated.View key={slideKey} entering={FadeIn.duration(400)} style={StyleSheet.absoluteFillObject}>
        <LinearGradient
          colors={[hexToRgba(slideThemeColor, 0.18), '#020617', '#000000']}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* Progress bars */}
        <View style={{ flexDirection: 'row', paddingHorizontal: PROGRESS_H_PAD, paddingTop: 10, gap: PROGRESS_GAP }}>
          {SLIDES.map((_, i) => (
            <ProgressSegment
              key={i}
              state={i < currentSlide ? 'past' : i === currentSlide ? 'active' : 'future'}
              activeProgress={slideProgress}
              segmentWidth={segmentWidth}
            />
          ))}
        </View>

        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={18} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
            {currentSlide + 1} / {TOTAL}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Slide content */}
        <View style={{ flex: 1 }}>{renderSlide()}</View>

        {/* Touch zones */}
        {slideKey !== 'share' && (
          <View style={[StyleSheet.absoluteFillObject, { top: 60, flexDirection: 'row' }]} pointerEvents="box-none">
            <Pressable onPress={handleTapLeft} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 3, height: '100%' }} />
            <Pressable onPress={handleTapRight} onPressIn={handlePressIn} onPressOut={handlePressOut} style={{ flex: 7, height: '100%' }} />
          </View>
        )}
      </SafeAreaView>

      {/* ── Offscreen Wrapped Poster (captured for sharing) ───────────────── */}
      <View
        ref={posterRef}
        collapsable={false}
        style={{
          position: 'absolute',
          left: -SCREEN_WIDTH * 3,
          width: SCREEN_WIDTH,
          backgroundColor: '#020617',
        }}
      >
        <LinearGradient
          colors={[hexToRgba(teamColor, 0.45), '#020617', hexToRgba(teamColor, 0.2)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: '100%', padding: 28, paddingBottom: 36 }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: '800', letterSpacing: 2.5, textTransform: 'uppercase' }}>
                Season Wrapped
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                {teamSettings.currentSeasonName ?? 'This Season'}
              </Text>
            </View>
            <TrendingUp size={20} color={teamColor} />
          </View>

          {/* Player identity */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2.5, borderColor: teamColor, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '900' }}>{currentPlayer?.number || '—'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 }}>
                {currentPlayer ? getPlayerName(currentPlayer) : firstName}
              </Text>
              <Text style={{ color: hexToRgba(teamColor, 0.9), fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
                {teamName}
              </Text>
            </View>
          </View>

          {/* Season stats grid */}
          <View style={posterStyles.section}>
            <Text style={posterStyles.sectionLabel}>Season Stats</Text>
            <View style={posterStyles.statsGrid}>
              {hasGoalsAssists ? (
                <>
                  <View style={posterStyles.statCell}>
                    <Text style={[posterStyles.statNum, { color: '#f97316' }]}>{topStat.value}</Text>
                    <Text style={posterStyles.statLbl}>PTS</Text>
                  </View>
                  <View style={posterStyles.divider} />
                  <View style={posterStyles.statCell}>
                    <Text style={posterStyles.statNum}>{goals}</Text>
                    <Text style={posterStyles.statLbl}>G</Text>
                  </View>
                  <View style={posterStyles.divider} />
                  <View style={posterStyles.statCell}>
                    <Text style={posterStyles.statNum}>{assists}</Text>
                    <Text style={posterStyles.statLbl}>AST</Text>
                  </View>
                  <View style={posterStyles.divider} />
                </>
              ) : (
                <>
                  <View style={posterStyles.statCell}>
                    <Text style={[posterStyles.statNum, { color: '#f97316' }]}>{topStat.value}</Text>
                    <Text style={posterStyles.statLbl}>{statAbbrev(topStat.label)}</Text>
                  </View>
                  <View style={posterStyles.divider} />
                </>
              )}
              <View style={posterStyles.statCell}>
                <Text style={posterStyles.statNum}>{gamesPlayed}</Text>
                <Text style={posterStyles.statLbl}>GP</Text>
              </View>
              <View style={posterStyles.divider} />
              <View style={posterStyles.statCell}>
                <Text style={[posterStyles.statNum, { color: attendancePct >= 90 ? '#22c55e' : attendancePct >= 70 ? '#f59e0b' : '#ef4444' }]}>
                  {attendancePct}%
                </Text>
                <Text style={posterStyles.statLbl}>ATT</Text>
              </View>
            </View>
          </View>

          {/* Team record */}
          <View style={posterStyles.section}>
            <Text style={posterStyles.sectionLabel}>Season Record</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Text style={{ color: '#22c55e', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{teamRecord.wins}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 24, fontWeight: '300' }}>W</Text>
              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 24, marginHorizontal: 4 }}>–</Text>
              <Text style={{ color: '#ef4444', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{teamRecord.losses}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 24, fontWeight: '300' }}>L</Text>
              {teamRecord.ties > 0 && (
                <>
                  <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 24, marginHorizontal: 4 }}>–</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>{teamRecord.ties}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 24, fontWeight: '300' }}>T</Text>
                </>
              )}
            </View>
          </View>

          {/* Win streak */}
          {longestWinStreak >= 2 && (
            <View style={posterStyles.section}>
              <Text style={posterStyles.sectionLabel}>Longest Win Streak</Text>
              <Text style={{ color: '#22c55e', fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginTop: 6 }}>
                {longestWinStreak} in a Row
              </Text>
            </View>
          )}

          {/* Trophies */}
          {earnedTrophies.length > 0 && (
            <View style={posterStyles.section}>
              <Text style={posterStyles.sectionLabel}>Trophy Cabinet · {earnedTrophies.length}</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                {earnedTrophies.map((t) => (
                  <View key={t.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>{t.title}</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>· {t.subtitle}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Best game */}
          {bestGame && (
            <View style={posterStyles.section}>
              <Text style={posterStyles.sectionLabel}>Best Performance</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                <Text style={{ color: '#f59e0b', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>
                  {bestGame.value} {sport === 'basketball' ? 'PTS' : sport === 'baseball' || sport === 'softball' ? 'H' : 'PTS'}
                </Text>
                {bestGame.game?.opponent ? (
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>vs {bestGame.game.opponent}</Text>
                ) : null}
              </View>
              {hasGoalsAssists && (bestGame.goals > 0 || bestGame.assists > 0) && (
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2 }}>
                  {bestGame.goals}G · {bestGame.assists}A
                </Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={{ marginTop: 28, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              Align Sports
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: 0.5 }}>
              alignsports.app
            </Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  slideContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    justifyContent: 'center',
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  headline: {
    color: '#ffffff',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 54,
    letterSpacing: -1,
  },
  body: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 16,
  },
  tapHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 32,
  },
  statCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  bigNumber: {
    color: '#ffffff',
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 70,
    letterSpacing: -2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  statSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  iconRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  trophyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradingCard: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    width: '100%',
  },
  jerseyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginTop: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  cardStatNumber: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardStatLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  cardStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 20,
    width: '100%',
    backgroundColor: '#1d4ed8',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

const posterStyles = StyleSheet.create({
  section: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statLbl: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
});
