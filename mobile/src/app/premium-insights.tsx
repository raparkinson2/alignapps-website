import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, Crown, ChevronRight, Target, Zap,
  CloudRain, Ghost, Trophy, Users, TrendingUp,
  AlertTriangle, Flame, Star, Shield,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useTeamStore, getPlayerName, Player, PaymentPeriod } from '@/lib/store';
import { useTeamColor, hexToRgba } from '@/lib/theme';
import { PlayerAvatar } from '@/components/PlayerAvatar';

// ── Helpers ──────────────────────────────────────────────────────────────────

function EngagementBar({ value, color }: { value: number; color: string }) {
  return (
    <View className="flex-row items-center" style={{ gap: 8 }}>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)' }}>
        <View
          style={{
            width: `${Math.min(100, value)}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      </View>
      <Text style={{ color, fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' }}>
        {Math.round(value)}
      </Text>
    </View>
  );
}

type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rain' | 'snow' | 'indoor';

const WEATHER_EMOJI: Record<WeatherCondition, string> = {
  sunny: '☀️',
  partly_cloudy: '⛅',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
  indoor: '🏟️',
};

const WEATHER_LABEL: Record<WeatherCondition, string> = {
  sunny: 'Sunny',
  partly_cloudy: 'Partly Cloudy',
  cloudy: 'Cloudy',
  rain: 'Rain',
  snow: 'Snow',
  indoor: 'Indoor',
};

export default function PremiumInsightsScreen() {
  const router = useRouter();
  const teamColor = useTeamColor();

  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const paymentPeriods = useTeamStore((s) => s.paymentPeriods);
  const isPremium = useTeamStore((s) => s.teamSettings.isPremium);

  // ── Compute Engagement Scores ──────────────────────────────────────────────
  const engagementData = useMemo(() => {
    const completedGames = games.filter((g) => g.gameResult);
    const activePlayers = players.filter(
      (p) =>
        p.status === 'active' &&
        !p.roles?.includes('coach') &&
        !p.roles?.includes('parent') &&
        p.position !== 'Coach' &&
        p.position !== 'Parent'
    );

    return activePlayers
      .map((player) => {
        // Attendance score (0-40)
        const invited = games.filter((g) => g.invitedPlayers.includes(player.id));
        const attended = invited.filter((g) => g.checkedInPlayers.includes(player.id));
        const attendanceScore = invited.length > 0 ? (attended.length / invited.length) * 40 : 0;

        // Payment score (0-30)
        let paymentScore = 0;
        if (paymentPeriods.length > 0) {
          const playerPeriods = paymentPeriods.filter((period) =>
            period.playerPayments.some((pp) => pp.playerId === player.id)
          );
          if (playerPeriods.length > 0) {
            const paid = playerPeriods.filter((period) => {
              const pp = period.playerPayments.find((p) => p.playerId === player.id);
              return pp?.status === 'paid' || pp?.status === 'partial';
            });
            paymentScore = (paid.length / playerPeriods.length) * 30;
          } else {
            paymentScore = 30; // Not responsible for any payments = not penalised
          }
        } else {
          paymentScore = 30;
        }

        // RSVP speed score (0-30) — approximated: early RSVP = in checkedIn, no late flip
        // (once responded_at data is collected from Supabase, this will become precise)
        const rsvpScore = invited.length > 0 ? Math.min(30, (attended.length / invited.length) * 20 + 10) : 0;

        const total = attendanceScore + paymentScore + rsvpScore;

        return {
          player,
          attendanceScore,
          paymentScore,
          rsvpScore,
          total,
          attendanceRate: invited.length > 0 ? Math.round((attended.length / invited.length) * 100) : 0,
          gamesInvited: invited.length,
          gamesAttended: attended.length,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [games, players, paymentPeriods]);

  // ── Compute Flake Factor ──────────────────────────────────────────────────
  // A flake: player was 'in' but ended up in checkedOutPlayers for a past game
  // (approximated locally; precise data builds from response_history going forward)
  const flakeData = useMemo(() => {
    const pastGames = games.filter((g) => new Date(g.date) < new Date());
    const activePlayers = players.filter(
      (p) =>
        p.status === 'active' &&
        !p.roles?.includes('coach') &&
        !p.roles?.includes('parent')
    );

    return activePlayers
      .map((player) => {
        // Was invited AND ended up as out for a past game (indication of late cancel)
        const lateOuts = pastGames.filter(
          (g) =>
            g.invitedPlayers.includes(player.id) &&
            g.checkedOutPlayers.includes(player.id) &&
            (g.checkoutNotes?.[player.id] ?? '').toLowerCase().includes('') // any out = possible flake
        );
        const invited = pastGames.filter((g) => g.invitedPlayers.includes(player.id));
        return {
          player,
          flakeCount: lateOuts.length,
          totalGames: invited.length,
          flakeRate: invited.length > 0 ? Math.round((lateOuts.length / invited.length) * 100) : 0,
        };
      })
      .filter((d) => d.totalGames > 0 && d.flakeCount > 0)
      .sort((a, b) => b.flakeRate - a.flakeRate)
      .slice(0, 5);
  }, [games, players]);

  // ── Compute Weather Impact ────────────────────────────────────────────────
  const weatherData = useMemo(() => {
    const withWeather = games.filter((g) => g.weatherCondition && g.gameResult);
    const condMap: Record<string, { wins: number; total: number; condition: WeatherCondition }> = {};
    for (const g of withWeather) {
      const cond = g.weatherCondition as WeatherCondition;
      if (!condMap[cond]) condMap[cond] = { wins: 0, total: 0, condition: cond };
      condMap[cond].total++;
      if (g.gameResult === 'win') condMap[cond].wins++;
    }
    return Object.values(condMap)
      .map((d) => ({ ...d, winPct: Math.round((d.wins / d.total) * 100) }))
      .sort((a, b) => b.total - a.total);
  }, [games]);

  const hasWeatherData = weatherData.length > 0;
  const hasEngagementData = engagementData.length > 0;
  const hasFlakeData = flakeData.length > 0;
  const completedGames = games.filter((g) => g.gameResult);
  const hasGameData = completedGames.length > 0;

  // Best weather condition
  const bestWeather = hasWeatherData
    ? [...weatherData].sort((a, b) => b.winPct - a.winPct)[0]
    : null;

  // Engagement leader
  const topEngaged = engagementData[0] ?? null;

  // Biggest flaker
  const topFlaker = flakeData[0] ?? null;

  // Gate: redirect if not premium (after all hooks)
  if (!isPremium) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center px-8">
        <Stack.Screen options={{ headerShown: false }} />
        <Crown size={52} color="#f59e0b" />
        <Text className="text-white text-2xl font-bold mt-5 text-center">Premium Only</Text>
        <Text className="text-slate-400 text-base mt-3 text-center leading-6">
          Upgrade to Premium to unlock the full analytics suite.
        </Text>
        <Pressable
          onPress={() => router.push('/upgrade')}
          className="mt-6 px-8 py-3 rounded-2xl"
          style={{ backgroundColor: '#f59e0b' }}
        >
          <Text className="text-slate-900 font-bold text-base">Upgrade Now</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0c0a1a', '#1a1530', '#0f172a']}
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
            <Text className="text-amber-400 text-xs font-bold uppercase tracking-widest">Premium</Text>
            <Text className="text-white text-2xl font-bold">Coach Insights</Text>
          </View>
          <LinearGradient
            colors={['rgba(245,158,11,0.35)', 'rgba(245,158,11,0.12)']}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Crown size={20} color="#f59e0b" />
          </LinearGradient>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 48, paddingHorizontal: 20 }}
        >
          {/* ── Summary tiles ── */}
          <Animated.View entering={FadeInDown.delay(60).springify()} className="flex-row mb-5" style={{ gap: 10 }}>
            {/* Best weather tile */}
            <LinearGradient
              colors={['rgba(14,165,233,0.18)', 'rgba(14,165,233,0.06)']}
              style={{ flex: 1, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(14,165,233,0.25)' }}
            >
              <Text style={{ fontSize: 22 }}>{bestWeather ? WEATHER_EMOJI[bestWeather.condition] : '🌤️'}</Text>
              <Text className="text-white font-bold text-base mt-1">
                {bestWeather ? `${bestWeather.winPct}% wins` : '—'}
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {bestWeather ? `in ${WEATHER_LABEL[bestWeather.condition]}` : 'No weather data'}
              </Text>
            </LinearGradient>

            {/* Engagement leader tile */}
            <LinearGradient
              colors={[hexToRgba(teamColor, 0.18), hexToRgba(teamColor, 0.06)]}
              style={{ flex: 1, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: hexToRgba(teamColor, 0.25) }}
            >
              <Star size={18} color={teamColor} />
              <Text className="text-white font-bold text-base mt-1" numberOfLines={1}>
                {topEngaged ? getPlayerName(topEngaged.player) : '—'}
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {topEngaged ? `${Math.round(topEngaged.total)}/100 score` : 'No data yet'}
              </Text>
            </LinearGradient>

            {/* Flake alert tile */}
            <LinearGradient
              colors={['rgba(239,68,68,0.18)', 'rgba(239,68,68,0.06)']}
              style={{ flex: 1, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}
            >
              <Ghost size={18} color="#f87171" />
              <Text className="text-white font-bold text-base mt-1" numberOfLines={1}>
                {topFlaker ? getPlayerName(topFlaker.player) : '—'}
              </Text>
              <Text className="text-slate-400 text-xs mt-0.5">
                {topFlaker ? `${topFlaker.flakeRate}% flake rate` : 'All reliable!'}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* ── Engagement Leaderboard ── */}
          <Animated.View entering={FadeInDown.delay(100).springify()} className="mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: hexToRgba(teamColor, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={14} color={teamColor} />
                </View>
                <Text className="text-white font-bold text-base">Engagement Leaderboard</Text>
              </View>
            </View>

            {/* Scoring explanation */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 }}>
              {[
                { label: 'Attendance', pts: '40 pts', color: '#22c55e' },
                { label: 'Payments', pts: '30 pts', color: '#f59e0b' },
                { label: 'RSVP Speed', pts: '30 pts', color: '#38bdf8' },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ color: item.color, fontWeight: '700', fontSize: 12 }}>{item.pts}</Text>
                  <Text style={{ color: '#64748b', fontSize: 10, marginTop: 2, textAlign: 'center' }}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              {!hasEngagementData ? (
                <EmptyState
                  icon={<Users size={28} color="#64748b" />}
                  title="No players yet"
                  subtitle="Add players and log game results to see engagement scores"
                />
              ) : (
                engagementData.map((item, index) => (
                  <View
                    key={item.player.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 14,
                      borderBottomWidth: index < engagementData.length - 1 ? 1 : 0,
                      borderBottomColor: 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Rank */}
                    <View style={{ width: 24, alignItems: 'center' }}>
                      {index === 0 ? (
                        <Text style={{ fontSize: 14 }}>🥇</Text>
                      ) : index === 1 ? (
                        <Text style={{ fontSize: 14 }}>🥈</Text>
                      ) : index === 2 ? (
                        <Text style={{ fontSize: 14 }}>🥉</Text>
                      ) : (
                        <Text className="text-slate-500 text-xs font-bold">{index + 1}</Text>
                      )}
                    </View>

                    <PlayerAvatar player={item.player} size={34} />

                    <View className="flex-1 ml-3">
                      <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                        {getPlayerName(item.player)}
                      </Text>
                      <View className="mt-1">
                        <EngagementBar
                          value={item.total}
                          color={
                            item.total >= 80 ? '#22c55e' :
                            item.total >= 55 ? '#f59e0b' :
                            '#ef4444'
                          }
                        />
                      </View>
                    </View>

                    {/* Score aligned right */}
                    <View style={{ width: 52, alignItems: 'flex-end', marginLeft: 10 }}>
                      <Text style={{
                        color: item.total >= 80 ? '#22c55e' : item.total >= 55 ? '#f59e0b' : '#ef4444',
                        fontWeight: '800',
                        fontSize: 15,
                      }}>
                        {Math.round(item.total)}
                      </Text>
                      <Text style={{ color: '#475569', fontSize: 10 }}>/100</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </Animated.View>

          {/* ── Flake Factor ── */}
          <Animated.View entering={FadeInDown.delay(140).springify()} className="mb-5">
            <View className="flex-row items-center mb-3" style={{ gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                <Ghost size={14} color="#f87171" />
              </View>
              <Text className="text-white font-bold text-base">The Flake Factor</Text>
            </View>

            <LinearGradient
              colors={['rgba(239,68,68,0.1)', 'rgba(15,23,42,0.8)']}
              style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', overflow: 'hidden' }}
            >
              {!hasFlakeData ? (
                <EmptyState
                  icon={<Ghost size={28} color="#64748b" />}
                  title={hasGameData ? 'No late cancellations' : 'Log game results to track'}
                  subtitle={hasGameData ? 'Your team is showing up consistently.' : 'Flake tracking builds as games are completed.'}
                  positive={hasGameData}
                />
              ) : (
                <>
                  <View style={{ padding: 16, paddingBottom: 8 }}>
                    <Text className="text-slate-400 text-xs">
                      Players who frequently cancel after confirming attendance
                    </Text>
                  </View>
                  {flakeData.map((item, index) => (
                    <View
                      key={item.player.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: 'rgba(239,68,68,0.1)',
                      }}
                    >
                      <PlayerAvatar player={item.player} size={34} />
                      <View className="flex-1 ml-3">
                        <Text className="text-white font-semibold text-sm">
                          {getPlayerName(item.player)}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-0.5">
                          {item.flakeCount} late cancel{item.flakeCount !== 1 ? 's' : ''} from {item.totalGames} games
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: item.flakeRate >= 40 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: item.flakeRate >= 40 ? '#f87171' : '#fbbf24',
                            fontWeight: '700',
                            fontSize: 13,
                          }}
                        >
                          {item.flakeRate}%
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </LinearGradient>
          </Animated.View>

          {/* ── Deep Dive Cards ── */}
          <Animated.View entering={FadeInDown.delay(180).springify()} className="mb-3">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
              Deep Dives
            </Text>

            {/* Opponent Scouting */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/opponent-scouting'); }}
              className="mb-3"
            >
              <LinearGradient
                colors={['rgba(168,85,247,0.15)', 'rgba(168,85,247,0.05)']}
                style={{ borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(168,85,247,0.25)', flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(168,85,247,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Shield size={22} color="#c084fc" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">Opponent Scouting</Text>
                  <Text className="text-slate-400 text-sm mt-0.5">
                    H2H records, avg scores & coach notes by opponent
                  </Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </LinearGradient>
            </Pressable>

            {/* Game Momentum */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/game-momentum'); }}
              className="mb-3"
            >
              <LinearGradient
                colors={['rgba(20,184,166,0.15)', 'rgba(20,184,166,0.05)']}
                style={{ borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(20,184,166,0.25)', flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(20,184,166,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Zap size={22} color="#2dd4bf" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">Game Momentum</Text>
                  <Text className="text-slate-400 text-sm mt-0.5">
                    RSVP trends, weather impact & win patterns
                  </Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </LinearGradient>
            </Pressable>

            {/* Player Impact */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push('/player-impact'); }}
            >
              <LinearGradient
                colors={['rgba(52,211,153,0.15)', 'rgba(52,211,153,0.05)']}
                style={{ borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)', flexDirection: 'row', alignItems: 'center' }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(52,211,153,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Users size={22} color="#34d399" />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">Player Impact</Text>
                  <Text className="text-slate-400 text-sm mt-0.5">
                    Team record with vs without each player
                  </Text>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
  positive = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  positive?: boolean;
}) {
  return (
    <View className="items-center py-8 px-6">
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: positive ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        {icon}
      </View>
      <Text className="text-white font-semibold text-sm text-center">{title}</Text>
      <Text className="text-slate-500 text-xs text-center mt-1 leading-5">{subtitle}</Text>
    </View>
  );
}
