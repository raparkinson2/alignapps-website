import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Users } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { useTeamStore, getPlayerName } from '@/lib/store';
import { useTeamColor } from '@/lib/theme';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface PlayerImpact {
  playerId: string;
  withWins: number;
  withLosses: number;
  withTies: number;
  withTotal: number;
  withoutWins: number;
  withoutLosses: number;
  withoutTies: number;
  withoutTotal: number;
  withWinPct: number;
  withoutWinPct: number;
  delta: number; // withWinPct - withoutWinPct
}

function winPct(wins: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((wins / total) * 100);
}

function recordStr(w: number, l: number, t: number): string {
  if (t > 0) return `${w}–${l}–${t}`;
  return `${w}–${l}`;
}

export default function PlayerImpactScreen() {
  const router = useRouter();
  const teamColor = useTeamColor();
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);

  const impactData = useMemo((): PlayerImpact[] => {
    const completedGames = games.filter((g) => g.gameResult && g.invitedPlayers?.length > 0);
    if (completedGames.length < 3) return [];

    const eligible = players.filter((p) => {
      const pos = p.position?.toLowerCase();
      return pos !== 'coach' && pos !== 'parent' &&
        !p.roles?.includes('coach' as any) && !p.roles?.includes('parent' as any);
    });

    return eligible
      .map((p): PlayerImpact | null => {
        const withGames = completedGames.filter(
          (g) => g.invitedPlayers?.includes(p.id) && g.checkedInPlayers?.includes(p.id)
        );
        const withoutGames = completedGames.filter(
          (g) => g.invitedPlayers?.includes(p.id) && !g.checkedInPlayers?.includes(p.id)
        );

        // Need at least 2 games in each bucket to be meaningful
        if (withGames.length < 2 && withoutGames.length < 2) return null;
        if (withGames.length + withoutGames.length < 4) return null;

        const wW = withGames.filter((g) => g.gameResult === 'win').length;
        const wL = withGames.filter((g) => g.gameResult === 'loss' || g.gameResult === 'otLoss').length;
        const wT = withGames.filter((g) => g.gameResult === 'tie').length;

        const woW = withoutGames.filter((g) => g.gameResult === 'win').length;
        const woL = withoutGames.filter((g) => g.gameResult === 'loss' || g.gameResult === 'otLoss').length;
        const woT = withoutGames.filter((g) => g.gameResult === 'tie').length;

        const withWP = winPct(wW, withGames.length);
        const withoutWP = winPct(woW, withoutGames.length);

        return {
          playerId: p.id,
          withWins: wW, withLosses: wL, withTies: wT, withTotal: withGames.length,
          withoutWins: woW, withoutLosses: woL, withoutTies: woT, withoutTotal: withoutGames.length,
          withWinPct: withWP,
          withoutWinPct: withoutWP,
          delta: withWP - withoutWP,
        };
      })
      .filter((d): d is PlayerImpact => d !== null)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [games, players]);

  const hasData = impactData.length > 0;

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0d1f1a', '#0a1628', '#0f172a']}
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
            <Text className="text-emerald-400 text-xs font-semibold uppercase tracking-widest">Analytics</Text>
            <Text className="text-white text-2xl font-bold">Player Impact</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(52,211,153,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={20} color="#34d399" />
          </View>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 mb-4">
          <View style={{ backgroundColor: 'rgba(52,211,153,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(52,211,153,0.2)' }}>
            <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 17 }}>
              Team win rate when each player <Text style={{ color: '#34d399', fontWeight: '700' }}>plays</Text> vs when they <Text style={{ color: '#f87171', fontWeight: '700' }}>miss</Text> a game. Requires 4+ tracked games per player.
            </Text>
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        >
          {!hasData ? (
            <Animated.View entering={FadeInDown.delay(80).springify()}>
              <LinearGradient
                colors={['rgba(30,41,59,0.8)', 'rgba(15,23,42,0.6)']}
                style={{ borderRadius: 20, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <Text style={{ fontSize: 48, marginBottom: 16 }}>📊</Text>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16, marginBottom: 8, textAlign: 'center' }}>
                  Not enough data yet
                </Text>
                <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                  Log results for at least 4 games per player — with some attending and some missing — to see their impact on the team's win rate.
                </Text>
              </LinearGradient>
            </Animated.View>
          ) : (
            impactData.map((item, i) => {
              const player = players.find((p) => p.id === item.playerId);
              if (!player) return null;

              const isPositive = item.delta > 0;
              const isNeutral = Math.abs(item.delta) < 5;
              const accentColor = isNeutral ? '#94a3b8' : isPositive ? '#34d399' : '#f87171';
              const deltaLabel = isNeutral
                ? 'No impact'
                : isPositive
                ? `+${item.delta}% with`
                : `${item.delta}% with`;

              return (
                <Animated.View
                  key={item.playerId}
                  entering={FadeInDown.delay(60 + i * 40).springify()}
                  style={{ marginBottom: 12 }}
                >
                  <LinearGradient
                    colors={
                      isNeutral
                        ? ['rgba(30,41,59,0.7)', 'rgba(15,23,42,0.5)']
                        : isPositive
                        ? ['rgba(52,211,153,0.1)', 'rgba(15,23,42,0.6)']
                        : ['rgba(248,113,113,0.1)', 'rgba(15,23,42,0.6)']
                    }
                    style={{
                      borderRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: isNeutral
                        ? 'rgba(255,255,255,0.06)'
                        : isPositive
                        ? 'rgba(52,211,153,0.25)'
                        : 'rgba(248,113,113,0.25)',
                    }}
                  >
                    {/* Player row */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                      <PlayerAvatar player={player} size={40} />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                          {getPlayerName(player)}
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>
                          #{player.number} · {player.position}
                        </Text>
                      </View>
                      {/* Delta badge */}
                      <View style={{
                        backgroundColor: isNeutral ? 'rgba(148,163,184,0.15)' : isPositive ? 'rgba(52,211,153,0.2)' : 'rgba(248,113,113,0.2)',
                        borderRadius: 20,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                      }}>
                        {isNeutral
                          ? <Minus size={12} color={accentColor} />
                          : isPositive
                          ? <TrendingUp size={12} color={accentColor} />
                          : <TrendingDown size={12} color={accentColor} />
                        }
                        <Text style={{ color: accentColor, fontWeight: '800', fontSize: 13 }}>
                          {deltaLabel}
                        </Text>
                      </View>
                    </View>

                    {/* With / Without bars */}
                    <View style={{ gap: 10 }}>
                      {/* With player */}
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                          <Text style={{ color: '#34d399', fontSize: 12, fontWeight: '600' }}>
                            ✓ With  {recordStr(item.withWins, item.withLosses, item.withTies)}
                          </Text>
                          <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 13 }}>
                            {item.withTotal > 0 ? `${item.withWinPct}%` : '—'}
                          </Text>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          {item.withTotal > 0 && (
                            <LinearGradient
                              colors={['#34d399', '#10b981']}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                              style={{ width: `${item.withWinPct}%`, height: 8, borderRadius: 4 }}
                            />
                          )}
                        </View>
                      </View>

                      {/* Without player */}
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                          <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>
                            ✗ Without  {recordStr(item.withoutWins, item.withoutLosses, item.withoutTies)}
                          </Text>
                          <Text style={{ color: '#f87171', fontWeight: '800', fontSize: 13 }}>
                            {item.withoutTotal > 0 ? `${item.withoutWinPct}%` : '—'}
                          </Text>
                        </View>
                        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                          {item.withoutTotal > 0 && (
                            <LinearGradient
                              colors={['#f87171', '#ef4444']}
                              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                              style={{ width: `${item.withoutWinPct}%`, height: 8, borderRadius: 4 }}
                            />
                          )}
                        </View>
                      </View>
                    </View>

                    {/* Games sample size note */}
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 10 }}>
                      {item.withTotal} game{item.withTotal !== 1 ? 's' : ''} played · {item.withoutTotal} game{item.withoutTotal !== 1 ? 's' : ''} missed
                    </Text>
                  </LinearGradient>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
