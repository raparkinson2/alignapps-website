import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Dimensions,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { X, TrendingUp, Trophy, Flame, Share2, Zap, Medal, Shield } from 'lucide-react-native';
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
import type { Sport, ArchivedSeason, Player } from '@/lib/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDE_DURATION = 8000;
const PROGRESS_H_PAD = 16;
const PROGRESS_GAP = 4;

// ─── Per-slide theme colors ─────────────────────────────────────────────────

const SLIDE_THEMES = {
  intro:   { primary: '#67e8f9', label: 'intro' },
  anchor:  { primary: '#38bdf8', label: 'anchor' },
  producer:{ primary: '#f97316', label: 'producer' },
  team:    { primary: '#22c55e', label: 'team' },
  share:   { primary: '#a78bfa', label: 'share' },
} as const;

type SlideKey = keyof typeof SLIDE_THEMES;

// ─── Progress Segment ───────────────────────────────────────────────────────
// Each segment is its own component — fixes the hooks-in-loops violation.

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
    <View
      style={{
        width: segmentWidth, height: 3,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 2, overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          { height: 3, backgroundColor: '#ffffff', borderRadius: 2 },
          animStyle,
        ]}
      />
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatValue(stats: unknown, key: string): number {
  if (!stats) return 0;
  return (stats as Record<string, number>)[key] ?? 0;
}

function getTopStat(player: Player, sport: Sport): { label: string; value: number } {
  const s = player.stats;
  if (!s) return { label: 'Games', value: player.gameLogs?.length ?? 0 };
  switch (sport) {
    case 'hockey':
    case 'lacrosse':
      return { label: 'Points', value: getStatValue(s, 'goals') + getStatValue(s, 'assists') };
    case 'soccer':
      return { label: 'Goals', value: getStatValue(s, 'goals') };
    case 'basketball':
      return { label: 'Points', value: getStatValue(s, 'points') };
    case 'baseball':
    case 'softball':
      return { label: 'Hits', value: getStatValue(s, 'hits') };
    default:
      return { label: 'Games', value: player.gameLogs?.length ?? 0 };
  }
}

function getSecondaryStat(player: Player, sport: Sport): { label: string; value: number } {
  const s = player.stats;
  if (!s) return { label: 'GP', value: player.gameLogs?.length ?? 0 };
  switch (sport) {
    case 'hockey': return { label: 'Goals', value: getStatValue(s, 'goals') };
    case 'soccer': return { label: 'Assists', value: getStatValue(s, 'assists') };
    case 'lacrosse': return { label: 'Goals', value: getStatValue(s, 'goals') };
    case 'basketball': return { label: 'Assists', value: getStatValue(s, 'assists') };
    case 'baseball':
    case 'softball': return { label: 'RBI', value: getStatValue(s, 'rbi') };
    default: return { label: 'GP', value: player.gameLogs?.length ?? 0 };
  }
}

function getProducerCopy(value: number, label: string, sport: Sport): { headline: string; body: string } {
  if (value === 0) {
    return {
      headline: 'Every shift counts.',
      body: `Not every contribution shows up in the box score. Your presence and effort matter.`,
    };
  }
  if (value >= 30 || (sport === 'basketball' && value >= 200)) {
    return {
      headline: `${value} ${label}. Unstoppable.`,
      body: `You were one of the most dangerous players on the roster this season.`,
    };
  }
  if (value >= 15 || (sport === 'basketball' && value >= 100)) {
    return {
      headline: `${value} ${label}. Solid producer.`,
      body: `You were a consistent offensive threat every time you stepped on the ice.`,
    };
  }
  return {
    headline: `${value} ${label} this season.`,
    body: `Building something. Keep grinding — the big numbers are coming.`,
  };
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function SeasonWrappedScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId)?.teamName ?? '');
  const teamColor = useTeamColor();
  const sport: Sport = (teamSettings?.sport as Sport) ?? 'hockey';

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  const firstName = currentPlayer?.firstName ?? 'Player';

  // ── Data calculations ──────────────────────────────────────────────────────

  const { attendancePct, gamesPlayed, totalTeamGames } = useMemo(() => {
    const completed = games.filter((g) => g.gameResult);
    const total = completed.length;
    const played = currentPlayer?.gameLogs?.length ?? 0;
    const pct = total > 0 ? Math.round((played / total) * 100) : (played > 0 ? 100 : 0);
    return { attendancePct: pct, gamesPlayed: played, totalTeamGames: total };
  }, [games, currentPlayer]);

  const topStat = useMemo(
    () => currentPlayer ? getTopStat(currentPlayer, sport) : { label: 'Games', value: 0 },
    [currentPlayer, sport],
  );

  const secondaryStat = useMemo(
    () => currentPlayer ? getSecondaryStat(currentPlayer, sport) : { label: 'GP', value: 0 },
    [currentPlayer, sport],
  );

  const producerCopy = useMemo(
    () => getProducerCopy(topStat.value, topStat.label, sport),
    [topStat, sport],
  );

  const { longestWinStreak, biggestBlowout } = useMemo(() => {
    const completed = [...games]
      .filter((g) => g.gameResult)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let currentStreak = 0;
    let maxStreak = 0;
    let maxDiff = 0;
    let blowoutGame: (typeof games)[0] | null = null;

    for (const g of completed) {
      if (g.gameResult === 'win') {
        currentStreak++;
        if (currentStreak > maxStreak) maxStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
      if (g.finalScoreUs != null && g.finalScoreThem != null && g.gameResult === 'win') {
        const diff = g.finalScoreUs - g.finalScoreThem;
        if (diff > maxDiff) { maxDiff = diff; blowoutGame = g; }
      }
    }

    return {
      longestWinStreak: maxStreak,
      biggestBlowout: blowoutGame
        ? { diff: maxDiff, us: blowoutGame.finalScoreUs, them: blowoutGame.finalScoreThem, opponent: blowoutGame.opponent }
        : null,
    };
  }, [games]);

  // ── Slide definitions ──────────────────────────────────────────────────────

  const SLIDES: SlideKey[] = ['intro', 'anchor', 'producer', 'team', 'share'];
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

  const goToSlide = useCallback((index: number) => {
    if (index >= TOTAL) { router.back(); return; }
    if (index < 0) return;
    setCurrentSlide(index);
  }, [TOTAL, router]);

  const startTimer = useCallback((duration: number) => {
    startTimeRef.current = Date.now();
    remainingRef.current = duration;
    slideProgress.value = 0;
    slideProgress.value = withTiming(1, {
      duration,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) runOnJS(goToSlide)(currentSlide + 1);
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      goToSlide(currentSlide + 1);
    }, duration);
  }, [currentSlide, goToSlide, slideProgress]);

  // Restart timer whenever slide changes
  useEffect(() => {
    isPausedRef.current = false;
    remainingRef.current = SLIDE_DURATION;
    // Share slide: hold indefinitely
    if (SLIDES[currentSlide] === 'share') {
      slideProgress.value = 1;
      return;
    }
    startTimer(SLIDE_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
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

  // ── Share ──────────────────────────────────────────────────────────────────

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const uri = await captureRef(cardRef, { format: 'png', quality: 1.0 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { dialogTitle: 'My Season Wrapped', mimeType: 'image/png' });
      } else {
        await Share.share({ message: `${firstName}'s Season Wrapped — ${gamesPlayed} games, ${topStat.value} ${topStat.label} with ${teamName}` });
      }
    } catch {
      Alert.alert('Could not share', 'Try again in a moment.');
    }
  }, [firstName, gamesPlayed, topStat, teamName]);

  // ── Current slide theme ────────────────────────────────────────────────────

  const slideKey = SLIDES[currentSlide];
  const slideThemeColor = slideKey === 'intro' || slideKey === 'share' ? teamColor : SLIDE_THEMES[slideKey].primary;

  // ── Slide content ──────────────────────────────────────────────────────────

  const renderSlide = () => {
    switch (slideKey) {

      // ── Slide 0: Intro ─────────────────────────────────────────────────────
      case 'intro':
        return (
          <Animated.View
            key="intro"
            entering={FadeInDown.delay(200).springify()}
            exiting={FadeOut.duration(150)}
            style={styles.slideContent}
          >
            <View style={[styles.iconRing, { borderColor: hexToRgba(teamColor, 0.5), backgroundColor: hexToRgba(teamColor, 0.15) }]}>
              <Trophy size={44} color={teamColor} />
            </View>
            <Text style={styles.eyebrow}>
              {teamSettings.currentSeasonName ?? 'This Season'}
            </Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              Your{'\n'}Season{'\n'}Wrapped.
            </Text>
            <Text style={styles.body}>
              {firstName}, here's everything you put into this season with {teamName}.
            </Text>
            <Text style={styles.tapHint}>Tap to continue →</Text>
          </Animated.View>
        );

      // ── Slide 1: The Anchor (attendance) ───────────────────────────────────
      case 'anchor':
        return (
          <Animated.View
            key="anchor"
            entering={FadeInDown.delay(150).springify()}
            exiting={FadeOut.duration(150)}
            style={styles.slideContent}
          >
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
              <Text style={styles.statSub}>
                {gamesPlayed} of {totalTeamGames} games played
              </Text>
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

      // ── Slide 2: The Producer (offense) ───────────────────────────────────
      case 'producer':
        return (
          <Animated.View
            key="producer"
            entering={FadeInDown.delay(150).springify()}
            exiting={FadeOut.duration(150)}
            style={styles.slideContent}
          >
            <Text style={styles.eyebrow}>The Producer</Text>
            <Text style={[styles.headline, { marginTop: 16 }]}>
              {producerCopy.headline}
            </Text>
            <Text style={[styles.body, { marginTop: 12 }]}>
              {producerCopy.body}
            </Text>

            <View style={[styles.statCard, { borderColor: hexToRgba('#f97316', 0.3) }]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, justifyContent: 'center' }}>
                <Text style={[styles.bigNumber, { color: '#f97316' }]}>{topStat.value}</Text>
                <Text style={{ color: '#f97316', fontSize: 22, fontWeight: '700', marginBottom: 8 }}>{topStat.label}</Text>
              </View>
              {secondaryStat.value > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
                  <Text style={[styles.statSub, { color: '#94a3b8' }]}>{secondaryStat.value} {secondaryStat.label}</Text>
                </View>
              )}
            </View>

            {topStat.value > 0 && (
              <Animated.View entering={FadeInUp.delay(400)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <Flame size={16} color="#f97316" />
                  <Text style={{ color: '#f97316', fontSize: 13, fontWeight: '600' }}>Season contribution</Text>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        );

      // ── Slide 3: Team Story ─────────────────────────────────────────────────
      case 'team':
        return (
          <Animated.View
            key="team"
            entering={FadeInDown.delay(150).springify()}
            exiting={FadeOut.duration(150)}
            style={styles.slideContent}
          >
            <Text style={styles.eyebrow}>The Team</Text>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                      <Text style={styles.statLabel}>Longest Win Streak</Text>
                      <Text style={[styles.bigNumber, { color: '#22c55e', fontSize: 44, lineHeight: 50 }]}>
                        {longestWinStreak} in a row
                      </Text>
                    </View>
                    <Zap size={32} color="#22c55e" />
                  </View>
                </Animated.View>
              )}

              {biggestBlowout && (
                <Animated.View entering={FadeInDown.delay(350)} style={[styles.statCard, { borderColor: hexToRgba('#22c55e', 0.2), paddingVertical: 14 }]}>
                  <Text style={styles.statLabel}>Biggest Blowout</Text>
                  <Text style={[styles.bigNumber, { color: '#22c55e', fontSize: 40, lineHeight: 46 }]}>
                    {biggestBlowout.us}–{biggestBlowout.them}
                  </Text>
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

      // ── Slide 4: Share Card ─────────────────────────────────────────────────
      case 'share':
        return (
          <Animated.View
            key="share"
            entering={FadeInDown.delay(200).springify()}
            style={[styles.slideContent, { justifyContent: 'flex-start', paddingTop: 10 }]}
          >
            <Text style={[styles.eyebrow, { marginBottom: 16 }]}>Share your season.</Text>

            {/* The trading card — captured by ViewShot */}
            <View ref={cardRef} collapsable={false}>
              <LinearGradient
                colors={[hexToRgba(teamColor, 0.55), '#0f172a', hexToRgba(teamColor, 0.2)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.tradingCard}
              >
                {/* Top row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    {teamSettings.currentSeasonName ?? 'Season'} Wrapped
                  </Text>
                  <TrendingUp size={16} color={teamColor} />
                </View>

                {/* Jersey number circle */}
                <View style={[styles.jerseyCircle, { borderColor: teamColor }]}>
                  <Text style={{ color: '#ffffff', fontSize: 40, fontWeight: '900' }}>
                    {currentPlayer?.number || '—'}
                  </Text>
                </View>

                {/* Name + team */}
                <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: '900', marginTop: 14, textAlign: 'center', letterSpacing: -0.5 }}>
                  {currentPlayer ? getPlayerName(currentPlayer) : firstName}
                </Text>
                <Text style={{ color: hexToRgba(teamColor, 0.9), fontSize: 12, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' }}>
                  {teamName}
                </Text>

                {/* Stats row */}
                <View style={styles.cardStatsRow}>
                  <View style={styles.cardStatCell}>
                    <Text style={styles.cardStatNumber}>{attendancePct}%</Text>
                    <Text style={styles.cardStatLabel}>ATD</Text>
                  </View>
                  <View style={styles.cardStatDivider} />
                  <View style={styles.cardStatCell}>
                    <Text style={styles.cardStatNumber}>{topStat.value}</Text>
                    <Text style={styles.cardStatLabel}>{topStat.label.toUpperCase().slice(0, 3)}</Text>
                  </View>
                  <View style={styles.cardStatDivider} />
                  <View style={styles.cardStatCell}>
                    <Text style={styles.cardStatNumber}>{secondaryStat.value}</Text>
                    <Text style={styles.cardStatLabel}>{secondaryStat.label.toUpperCase().slice(0, 3)}</Text>
                  </View>
                  <View style={styles.cardStatDivider} />
                  <View style={styles.cardStatCell}>
                    <Text style={styles.cardStatNumber}>{gamesPlayed}</Text>
                    <Text style={styles.cardStatLabel}>GP</Text>
                  </View>
                </View>

                {/* Footer branding */}
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 18 }}>
                  Align Sports
                </Text>
              </LinearGradient>
            </View>

            {/* Share button */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.shareButton,
                { backgroundColor: pressed ? hexToRgba(teamColor, 0.9) : teamColor },
              ]}
            >
              <Share2 size={18} color="#0f172a" />
              <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 16, marginLeft: 8 }}>
                Share to Social
              </Text>
            </Pressable>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />

      {/* Dynamic background gradient per slide */}
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
            Wrapped
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Slide content */}
        <View style={{ flex: 1 }}>
          {renderSlide()}
        </View>

        {/* Touch zones — long press to pause, tap to navigate */}
        {slideKey !== 'share' && (
          <View style={[StyleSheet.absoluteFillObject, { top: 60, flexDirection: 'row' }]} pointerEvents="box-none">
            <Pressable
              onPress={handleTapLeft}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={{ flex: 3, height: '100%' }}
            />
            <Pressable
              onPress={handleTapRight}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={{ flex: 7, height: '100%' }}
            />
          </View>
        )}
      </SafeAreaView>
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
    fontSize: 12,
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
  tradingCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    width: '100%',
  },
  jerseyCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginTop: 18,
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
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  cardStatLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  cardStatDivider: {
    width: 1,
    height: 36,
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
  },
});
