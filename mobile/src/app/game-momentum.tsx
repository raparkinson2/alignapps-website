import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, Zap, Users, Trophy, TrendingUp, TrendingDown,
  CloudRain, Sun, Cloud, CloudSnow, Building2,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useTeamStore } from '@/lib/store';
import { useTeamColor, hexToRgba } from '@/lib/theme';

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'indoor';

const WEATHER_META: Record<WeatherCondition, { emoji: string; label: string; color: string }> = {
  sunny:         { emoji: '☀️', label: 'Sunny',        color: '#fbbf24' },
  partly_cloudy: { emoji: '⛅', label: 'Partly Cloudy', color: '#94a3b8' },
  cloudy:        { emoji: '☁️', label: 'Cloudy',        color: '#64748b' },
  rain:          { emoji: '🌧️', label: 'Rain',          color: '#38bdf8' },
  snow:          { emoji: '❄️', label: 'Snow',          color: '#bae6fd' },
  indoor:        { emoji: '🏟️', label: 'Indoor',        color: '#a78bfa' },
};

export default function GameMomentumScreen() {
  const router = useRouter();
  const teamColor = useTeamColor();
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);

  // ── Player Count vs Win Rate ──────────────────────────────────────────────
  const playerCountWinData = useMemo(() => {
    const scored = games.filter((g) => g.gameResult);
    if (scored.length === 0) return null;

    const rosterSize = players.filter(
      (p) =>
        p.status === 'active' &&
        p.position !== 'Coach' &&
        p.position !== 'Parent' &&
        !p.roles?.includes('coach') &&
        !p.roles?.includes('parent'),
    ).length;

    if (rosterSize === 0) return null;

    // Build bands of 3 from full roster downward, max 5 bands
    type Band = { label: string; min: number; max: number; wins: number; total: number };
    const bands: Band[] = [];

    // Full roster band
    bands.push({ label: `${rosterSize}/${rosterSize}`, min: rosterSize, max: Infinity, wins: 0, total: 0 });

    // Bands of 3 going down
    let top = rosterSize - 1;
    while (top > 0 && bands.length < 4) {
      const bandMax = top;
      const bandMin = Math.max(1, top - 2);
      bands.push({ label: `${bandMin}–${bandMax}`, min: bandMin, max: bandMax, wins: 0, total: 0 });
      top = bandMin - 1;
    }

    // Catch-all bottom band
    if (top > 0) {
      bands.push({ label: `< ${top + 1}`, min: 0, max: top, wins: 0, total: 0 });
    }

    for (const g of scored) {
      const count = (g.checkedInPlayers ?? []).length;
      for (const band of bands) {
        if (count >= band.min && count <= band.max) {
          band.total++;
          if (g.gameResult === 'win') band.wins++;
          break;
        }
      }
    }

    const activeBands = bands
      .map((b) => ({ ...b, winPct: b.total > 0 ? Math.round((b.wins / b.total) * 100) : null }));

    return { bands: activeBands, rosterSize };
  }, [games, players]);

  // ── Weather Impact ────────────────────────────────────────────────────────
  const weatherImpact = useMemo(() => {
    const withWeather = games.filter((g) => g.weatherCondition && g.gameResult);
    if (withWeather.length === 0) return [];

    const map: Record<string, { condition: WeatherCondition; wins: number; total: number; avgTemp: number; tempCount: number }> = {};
    for (const g of withWeather) {
      const cond = g.weatherCondition as WeatherCondition;
      if (!map[cond]) map[cond] = { condition: cond, wins: 0, total: 0, avgTemp: 0, tempCount: 0 };
      map[cond].total++;
      if (g.gameResult === 'win') map[cond].wins++;
      if (g.weatherTemp != null) {
        map[cond].avgTemp += g.weatherTemp;
        map[cond].tempCount++;
      }
    }

    return Object.values(map)
      .map((d) => ({
        ...d,
        winPct: Math.round((d.wins / d.total) * 100),
        avgTemp: d.tempCount > 0 ? Math.round(d.avgTemp / d.tempCount) : null,
      }))
      .sort((a, b) => {
        const order: WeatherCondition[] = ['sunny', 'partly_cloudy', 'cloudy', 'rain', 'snow', 'indoor'];
        return order.indexOf(a.condition) - order.indexOf(b.condition);
      });
  }, [games]);

  // ── Temperature Range Impact ──────────────────────────────────────────────
  const tempRangeImpact = useMemo(() => {
    const withTemp = games.filter((g) => g.weatherTemp != null && g.gameResult);
    if (withTemp.length === 0) return [];

    const buckets = [
      { label: '40–50°F', emoji: '🧊', min: 40, max: 50, color: '#93c5fd', wins: 0, total: 0 },
      { label: '50–60°F', emoji: '🌬️', min: 50, max: 60, color: '#60a5fa', wins: 0, total: 0 },
      { label: '60–70°F', emoji: '🌤️',  min: 60, max: 70, color: '#34d399', wins: 0, total: 0 },
      { label: '70–80°F', emoji: '☀️',  min: 70, max: 80, color: '#fbbf24', wins: 0, total: 0 },
      { label: '80–90°F', emoji: '🌡️', min: 80, max: 90, color: '#fb923c', wins: 0, total: 0 },
      { label: '90°F+',   emoji: '🔥', min: 90, max: 999, color: '#f87171', wins: 0, total: 0 },
    ];

    for (const g of withTemp) {
      const temp = g.weatherTemp!;
      for (const bucket of buckets) {
        if (temp >= bucket.min && temp < bucket.max) {
          bucket.total++;
          if (g.gameResult === 'win') bucket.wins++;
          break;
        }
      }
    }

    return buckets
      .filter((b) => b.total > 0)
      .map((b) => ({ ...b, winPct: Math.round((b.wins / b.total) * 100) }));
  }, [games]);

  // ── Win Streak & Momentum ─────────────────────────────────────────────────
  const momentumData = useMemo(() => {
    const completed = [...games]
      .filter((g) => g.gameResult)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (completed.length === 0) return null;

    let currentStreak = 0;
    let streakType: 'win' | 'loss' | null = null;
    for (const g of completed) {
      const isWin = g.gameResult === 'win';
      if (streakType === null) {
        streakType = isWin ? 'win' : 'loss';
        currentStreak = 1;
      } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin && g.gameResult !== 'tie')) {
        currentStreak++;
      } else {
        break;
      }
    }

    // RSVP trend: avg check-in rate for wins vs losses
    const winGames = completed.filter((g) => g.gameResult === 'win');
    const lossGames = completed.filter((g) => g.gameResult === 'loss');

    return { currentStreak, streakType, totalGames: completed.length };
  }, [games]);

  const hasWeather = weatherImpact.length > 0;
  const hasTempData = tempRangeImpact.length > 0;
  const hasPlayerCount = playerCountWinData !== null && playerCountWinData.bands.length > 0;
  const hasMomentum = momentumData !== null;
  const bestWeather = hasWeather ? weatherImpact[0] : null;

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#071a18', '#0d2220', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(30)} className="flex-row items-center px-5 pt-2 pb-4">
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color={teamColor} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-teal-400 text-xs font-semibold uppercase tracking-widest">Patterns</Text>
            <Text className="text-white text-2xl font-bold">Game Momentum</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(20,184,166,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="#2dd4bf" />
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        >
          {/* ── Current Streak Card ── */}
          {hasMomentum && (
            <Animated.View entering={FadeInDown.delay(60).springify()} className="mb-5">
              <LinearGradient
                colors={
                  momentumData.streakType === 'win'
                    ? ['rgba(34,197,94,0.18)', 'rgba(34,197,94,0.05)']
                    : ['rgba(239,68,68,0.18)', 'rgba(239,68,68,0.05)']
                }
                style={{ borderRadius: 20, padding: 18, borderWidth: 1, borderColor: momentumData.streakType === 'win' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)', flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
                    Current Streak
                  </Text>
                  <View className="flex-row items-end mt-1" style={{ gap: 8 }}>
                    <Text style={{ color: '#ffffff', fontSize: 42, fontWeight: '800', lineHeight: 48 }}>
                      {momentumData.currentStreak}
                    </Text>
                    <Text
                      style={{
                        color: momentumData.streakType === 'win' ? '#22c55e' : '#ef4444',
                        fontSize: 18,
                        fontWeight: '700',
                        marginBottom: 6,
                      }}
                    >
                      {momentumData.streakType === 'win' ? 'WIN' : 'LOSS'}
                    </Text>
                  </View>
                  <Text className="text-slate-500 text-xs mt-1">
                    Over {momentumData.totalGames} tracked game{momentumData.totalGames !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={{ fontSize: 52 }}>
                  {momentumData.streakType === 'win' ? '🔥' : '📉'}
                </Text>
              </LinearGradient>
            </Animated.View>
          )}

          {/* ── Win Rate by Players Available ── */}
          <Animated.View entering={FadeInDown.delay(100).springify()} className="mb-5">
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: hexToRgba(teamColor, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                <Users size={14} color={teamColor} />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">Win Rate by Players Available</Text>
              </View>
              {playerCountWinData && (
                <Text className="text-slate-500 text-xs">Roster: {playerCountWinData.rosterSize}</Text>
              )}
            </View>

            <View style={{ backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {!hasPlayerCount ? (
                <EmptyState
                  emoji="👥"
                  title="Log game results to unlock"
                  subtitle="Shows your win rate based on how many players showed up"
                />
              ) : (
                <View style={{ padding: 16 }}>
                  <Text className="text-slate-400 text-xs mb-4">
                    Win rate by number of players who checked in
                  </Text>
                  {playerCountWinData!.bands.map((band, i) => (
                    <View key={band.label} style={{ marginBottom: i < playerCountWinData!.bands.length - 1 ? 14 : 0 }}>
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-white font-semibold text-sm">{band.label} players</Text>
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                          {band.winPct === null ? (
                            <Text className="text-slate-500 text-xs italic">No data</Text>
                          ) : (
                            <>
                              <Text style={{ color: band.winPct >= 60 ? '#22c55e' : band.winPct >= 40 ? '#f59e0b' : '#ef4444', fontWeight: '700', fontSize: 14 }}>
                                {band.winPct}%
                              </Text>
                              <Text className="text-slate-500 text-xs">({band.total}g)</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View style={{ height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        {band.winPct !== null && (
                          <LinearGradient
                            colors={band.winPct >= 60 ? ['#22c55e', '#16a34a'] : band.winPct >= 40 ? ['#f59e0b', '#d97706'] : ['#ef4444', '#dc2626']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{ width: `${band.winPct}%`, height: 10, borderRadius: 5 }}
                          />
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Weather Impact ── */}
          <Animated.View entering={FadeInDown.delay(140).springify()} className="mb-5">
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(56,189,248,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <CloudRain size={14} color="#38bdf8" />
              </View>
              <Text className="text-white font-bold text-base">Weather Impact</Text>
            </View>

            <View style={{ backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {!hasWeather && !hasTempData ? (
                <EmptyState
                  emoji="🌤️"
                  title="No weather data yet"
                  subtitle={"Weather auto-tags when you log a final score on a past game. It builds up over time as you record results."}
                />
              ) : (
                <View style={{ padding: 16 }}>
                  {/* Best conditions banner */}
                  {bestWeather && (
                    <View
                      style={{
                        backgroundColor: `${WEATHER_META[bestWeather.condition].color}15`,
                        borderRadius: 14,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: `${WEATHER_META[bestWeather.condition].color}30`,
                        marginBottom: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 30, marginRight: 12 }}>{WEATHER_META[bestWeather.condition].emoji}</Text>
                      <View className="flex-1">
                        <Text style={{ color: WEATHER_META[bestWeather.condition].color, fontWeight: '800', fontSize: 16 }}>
                          Best Conditions: {WEATHER_META[bestWeather.condition].label}
                        </Text>
                        <Text className="text-slate-400 text-sm mt-0.5">
                          You win {bestWeather.winPct}% of games in {WEATHER_META[bestWeather.condition].label.toLowerCase()}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Condition rows */}
                  {weatherImpact.map((item) => {
                    const meta = WEATHER_META[item.condition];
                    return (
                      <View key={item.condition} className="mb-4">
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                            <Text className="text-white font-semibold text-sm">{meta.label}</Text>
                            {item.avgTemp != null && (
                              <Text className="text-slate-500 text-xs">~{item.avgTemp}°F</Text>
                            )}
                          </View>
                          <View className="flex-row items-center" style={{ gap: 6 }}>
                            <Text style={{ color: item.winPct >= 60 ? '#22c55e' : item.winPct >= 40 ? '#f59e0b' : '#ef4444', fontWeight: '700', fontSize: 14 }}>
                              {item.winPct}%
                            </Text>
                            <Text className="text-slate-500 text-xs">({item.total}g)</Text>
                          </View>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          <View
                            style={{
                              width: `${item.winPct}%`,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: meta.color,
                            }}
                          />
                        </View>
                      </View>
                    );
                  })}

                  {/* Temperature Range section */}
                  {hasTempData && (
                    <>
                      <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginBottom: 14, marginTop: hasWeather ? 2 : 0 }} />
                      <View className="flex-row items-center mb-3" style={{ gap: 6 }}>
                        <Text style={{ fontSize: 14 }}>🌡️</Text>
                        <Text className="text-slate-300 font-bold text-sm">Temperature Impact</Text>
                      </View>
                      {tempRangeImpact.map((bucket) => (
                        <View key={bucket.label} className="mb-3">
                          <View className="flex-row items-center justify-between mb-1.5">
                            <View className="flex-row items-center" style={{ gap: 7 }}>
                              <Text style={{ fontSize: 13 }}>{bucket.emoji}</Text>
                              <Text className="text-white text-sm" style={{ fontWeight: '600' }}>{bucket.label}</Text>
                            </View>
                            <View className="flex-row items-center" style={{ gap: 5 }}>
                              <Text
                                style={{
                                  color: bucket.winPct >= 60 ? '#22c55e' : bucket.winPct >= 40 ? '#f59e0b' : '#ef4444',
                                  fontWeight: '700',
                                  fontSize: 13,
                                }}
                              >
                                {bucket.winPct}%
                              </Text>
                              <Text className="text-slate-500 text-xs">({bucket.total}g)</Text>
                            </View>
                          </View>
                          <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                            <LinearGradient
                              colors={[bucket.color, `${bucket.color}99`]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{ width: `${bucket.winPct}%`, height: 7, borderRadius: 4 }}
                            />
                          </View>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          </Animated.View>

          {/* ── Home vs Away (if location data exists) ── */}
          <Animated.View entering={FadeInDown.delay(180).springify()} className="mb-5">
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Trophy size={14} color="#f59e0b" />
              </View>
              <Text className="text-white font-bold text-base">Scoring Patterns</Text>
            </View>
            <ScoringPatternCard games={games} teamColor={teamColor} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ScoringPatternCard({ games, teamColor }: { games: ReturnType<typeof useTeamStore.getState>['games']; teamColor: string }) {
  const scored = games.filter((g) => g.finalScoreUs != null && g.finalScoreThem != null && g.gameResult);
  if (scored.length === 0) {
    return (
      <View style={{ backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
        <EmptyState emoji="⚽" title="Log game scores to unlock" subtitle="Scoring patterns appear after at least one scored game" />
      </View>
    );
  }

  const wins = scored.filter((g) => g.gameResult === 'win');
  const losses = scored.filter((g) => g.gameResult === 'loss');
  const avgScored = scored.reduce((s, g) => s + (g.finalScoreUs ?? 0), 0) / scored.length;
  const avgAllowed = scored.reduce((s, g) => s + (g.finalScoreThem ?? 0), 0) / scored.length;
  const avgWinScore = wins.length > 0 ? wins.reduce((s, g) => s + (g.finalScoreUs ?? 0), 0) / wins.length : 0;
  const avgLossScore = losses.length > 0 ? losses.reduce((s, g) => s + (g.finalScoreThem ?? 0), 0) / losses.length : 0;

  return (
    <View style={{ backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 16 }}>
      <View className="flex-row mb-4" style={{ gap: 10 }}>
        {[
          { label: 'Avg Scored', value: avgScored.toFixed(1), color: '#22c55e' },
          { label: 'Avg Allowed', value: avgAllowed.toFixed(1), color: '#ef4444' },
          { label: 'Differential', value: (avgScored - avgAllowed > 0 ? '+' : '') + (avgScored - avgAllowed).toFixed(1), color: avgScored > avgAllowed ? '#22c55e' : '#ef4444' },
        ].map((stat) => (
          <View key={stat.label} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 10, alignItems: 'center' }}>
            <Text style={{ color: stat.color, fontWeight: '800', fontSize: 18 }}>{stat.value}</Text>
            <Text className="text-slate-500 text-xs mt-0.5 text-center">{stat.label}</Text>
          </View>
        ))}
      </View>
      {wins.length > 0 && losses.length > 0 && (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 }}>
          <Text className="text-slate-400 text-xs leading-5">
            When you win, you average{' '}
            <Text className="text-green-400 font-semibold">{avgWinScore.toFixed(1)} goals</Text>.
            When you lose, opponents average{' '}
            <Text className="text-red-400 font-semibold">{avgLossScore.toFixed(1)} goals</Text> against you.
          </Text>
        </View>
      )}
    </View>
  );
}

function EmptyState({ emoji, title, subtitle }: { emoji: string; title: string; subtitle: string }) {
  return (
    <View className="items-center py-8 px-6">
      <Text style={{ fontSize: 32, marginBottom: 12 }}>{emoji}</Text>
      <Text className="text-white font-semibold text-sm text-center">{title}</Text>
      <Text className="text-slate-500 text-xs text-center mt-1 leading-5">{subtitle}</Text>
    </View>
  );
}
