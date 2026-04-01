import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Flame, Snowflake, Calendar } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useMemo } from 'react';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTeamStore } from '@/lib/store';
import { LinearGradient } from 'expo-linear-gradient';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface MonthRecord {
  monthKey: string; // "2025-03"
  monthLabel: string; // "March 2025"
  wins: number;
  losses: number;
  ties: number;
  otLosses: number;
  gp: number;
  winPct: number; // 0-1
  goalsFor: number;
  goalsAgainst: number;
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function getMoodLabel(winPct: number, gp: number): { label: string; color: string; hot: boolean | null } {
  if (gp < 2) return { label: 'Too early', color: '#64748b', hot: null };
  if (winPct >= 0.75) return { label: 'On Fire 🔥', color: '#f97316', hot: true };
  if (winPct >= 0.55) return { label: 'Hot', color: '#fbbf24', hot: true };
  if (winPct >= 0.45) return { label: 'Even', color: '#94a3b8', hot: null };
  if (winPct >= 0.25) return { label: 'Cold', color: '#38bdf8', hot: false };
  return { label: 'Ice Cold 🥶', color: '#7dd3fc', hot: false };
}

export default function MonthlySplitsScreen() {
  const router = useRouter();
  const games = useTeamStore((s) => s.games);
  const teamName = useTeamStore((s) => s.teams.find((t) => t.id === s.activeTeamId)?.teamName ?? '');

  const { monthlyRecords, overallRecord, bestMonth, worstMonth } = useMemo(() => {
    const completed = games.filter((g) => g.gameResult && g.date);
    const map = new Map<string, MonthRecord>();

    for (const game of completed) {
      const d = new Date(game.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, {
          monthKey: key,
          monthLabel: getMonthLabel(key),
          wins: 0, losses: 0, ties: 0, otLosses: 0, gp: 0,
          winPct: 0, goalsFor: 0, goalsAgainst: 0,
        });
      }
      const m = map.get(key)!;
      m.gp++;
      if (game.gameResult === 'win') m.wins++;
      else if (game.gameResult === 'loss') m.losses++;
      else if (game.gameResult === 'tie') m.ties++;
      else if (game.gameResult === 'otLoss') m.otLosses++;
      m.goalsFor += game.finalScoreUs ?? 0;
      m.goalsAgainst += game.finalScoreThem ?? 0;
    }

    // Compute win pct: ties & OT losses count as half win
    for (const m of map.values()) {
      m.winPct = m.gp > 0 ? (m.wins + (m.ties + m.otLosses) * 0.5) / m.gp : 0;
    }

    const sorted = [...map.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    const allW = sorted.reduce((s, m) => s + m.wins, 0);
    const allL = sorted.reduce((s, m) => s + m.losses, 0);
    const allT = sorted.reduce((s, m) => s + m.ties + m.otLosses, 0);
    const overallRecord = { w: allW, l: allL, t: allT, gp: completed.length };

    const eligible = sorted.filter((m) => m.gp >= 2);
    const bestMonth = eligible.length > 0
      ? eligible.reduce((best, m) => m.winPct > best.winPct ? m : best, eligible[0])
      : null;
    const worstMonth = eligible.length > 0
      ? eligible.reduce((worst, m) => m.winPct < worst.winPct ? m : worst, eligible[0])
      : null;

    return { monthlyRecords: sorted, overallRecord, bestMonth, worstMonth };
  }, [games]);

  const hasData = monthlyRecords.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#080c14' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 12 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowLeft size={20} color="#94a3b8" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 20 }}>Monthly Splits</Text>
            <Text style={{ color: '#475569', fontSize: 13, marginTop: 1 }}>{teamName}</Text>
          </View>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(34,211,238,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={18} color="#22d3ee" />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {!hasData ? (
            <Animated.View entering={FadeIn.delay(100)} style={{ alignItems: 'center', paddingTop: 80 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Calendar size={32} color="#334155" />
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>No game results yet</Text>
              <Text style={{ color: '#475569', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                Log game results to see your team's performance broken down by month.
              </Text>
            </Animated.View>
          ) : (
            <>
              {/* Overall Summary Card */}
              <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginBottom: 20 }}>
                <LinearGradient
                  colors={['rgba(34,211,238,0.12)', 'rgba(34,211,238,0.04)']}
                  style={{ borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(34,211,238,0.2)' }}
                >
                  <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                    Season Overview
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                    <View>
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 34, letterSpacing: -1 }}>
                        {overallRecord.w}–{overallRecord.l}{overallRecord.t > 0 ? `–${overallRecord.t}` : ''}
                      </Text>
                      <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
                        {overallRecord.gp} games played
                      </Text>
                    </View>
                    <View style={{ flex: 1 }} />
                    {bestMonth && bestMonth !== worstMonth && (
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Flame size={13} color="#f97316" />
                          <Text style={{ color: '#f97316', fontSize: 12, fontWeight: '700' }}>{bestMonth.monthLabel.split(' ')[0]}</Text>
                        </View>
                        {worstMonth && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(125,211,252,0.08)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Snowflake size={13} color="#7dd3fc" />
                            <Text style={{ color: '#7dd3fc', fontSize: 12, fontWeight: '700' }}>{worstMonth.monthLabel.split(' ')[0]}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Month Cards */}
              <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                By Month
              </Text>
              <View style={{ gap: 10 }}>
                {[...monthlyRecords].reverse().map((m, i) => {
                  const mood = getMoodLabel(m.winPct, m.gp);
                  const isBest = bestMonth?.monthKey === m.monthKey;
                  const isWorst = worstMonth?.monthKey === m.monthKey && bestMonth?.monthKey !== m.monthKey;
                  const winPctDisplay = Math.round(m.winPct * 100);

                  return (
                    <Animated.View
                      key={m.monthKey}
                      entering={FadeInDown.delay(120 + i * 45).springify()}
                      style={{
                        backgroundColor: '#0f172a',
                        borderRadius: 16, padding: 16,
                        borderWidth: 1,
                        borderColor: isBest
                          ? 'rgba(249,115,22,0.3)'
                          : isWorst
                            ? 'rgba(125,211,252,0.2)'
                            : 'rgba(255,255,255,0.07)',
                      }}
                    >
                      {/* Month name + mood badge */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>{m.monthLabel}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {isBest && <Flame size={14} color="#f97316" />}
                          {isWorst && <Snowflake size={14} color="#7dd3fc" />}
                          <Text style={{ color: mood.color, fontSize: 12, fontWeight: '600' }}>{mood.label}</Text>
                        </View>
                      </View>

                      {/* Record + win% row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                          <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 22 }}>
                            {m.wins}–{m.losses}{m.ties + m.otLosses > 0 ? `–${m.ties + m.otLosses}` : ''}
                          </Text>
                          <Text style={{ color: '#475569', fontSize: 12 }}>({m.gp} GP)</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: mood.color, fontWeight: '800', fontSize: 18 }}>{winPctDisplay}%</Text>
                          <Text style={{ color: '#475569', fontSize: 11 }}>win rate</Text>
                        </View>
                      </View>

                      {/* Win % bar */}
                      <View style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                        <View style={{
                          height: 5, borderRadius: 3,
                          backgroundColor: mood.color,
                          width: `${winPctDisplay}%`,
                          opacity: 0.8,
                        }} />
                      </View>

                      {/* Goals row */}
                      {(m.goalsFor > 0 || m.goalsAgainst > 0) && (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <TrendingUp size={12} color="#4ade80" />
                            <Text style={{ color: '#4ade80', fontSize: 12, fontWeight: '600' }}>{m.goalsFor} GF</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <TrendingDown size={12} color="#f87171" />
                            <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '600' }}>{m.goalsAgainst} GA</Text>
                          </View>
                          <View style={{ flex: 1 }} />
                          {m.goalsFor !== m.goalsAgainst && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                              <Minus size={10} color="#475569" />
                              <Text style={{ color: m.goalsFor > m.goalsAgainst ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: '600' }}>
                                {m.goalsFor > m.goalsAgainst ? '+' : ''}{m.goalsFor - m.goalsAgainst} margin
                              </Text>
                            </View>
                          )}
                        </View>
                      )}
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
