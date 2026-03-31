import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft, Shield, Search, Trophy, Target,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  FileText,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { useTeamStore } from '@/lib/store';
import { useTeamColor, hexToRgba } from '@/lib/theme';

interface OpponentStats {
  opponent: string;
  totalGames: number;
  wins: number;
  losses: number;
  ties: number;
  avgScoreUs: number | null;
  avgScoreThem: number | null;
  lastPlayed: string;
  notes: string[];
  gameIQ: number; // composite score
}

export default function OpponentScoutingScreen() {
  const router = useRouter();
  const teamColor = useTeamColor();
  const games = useTeamStore((s) => s.games);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const opponentStats = useMemo((): OpponentStats[] => {
    const map: Record<string, OpponentStats> = {};

    for (const g of games) {
      if (!g.opponent) continue;
      const key = g.opponent.trim().toLowerCase();
      if (!map[key]) {
        map[key] = {
          opponent: g.opponent.trim(),
          totalGames: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          avgScoreUs: null,
          avgScoreThem: null,
          lastPlayed: g.date,
          notes: [],
          gameIQ: 0,
        };
      }
      const entry = map[key];
      entry.totalGames++;

      if (g.gameResult === 'win') entry.wins++;
      else if (g.gameResult === 'loss' || g.gameResult === 'otLoss') entry.losses++;
      else if (g.gameResult === 'tie') entry.ties++;

      if (g.finalScoreUs != null) {
        entry.avgScoreUs = ((entry.avgScoreUs ?? 0) * (entry.totalGames - 1) + g.finalScoreUs) / entry.totalGames;
      }
      if (g.finalScoreThem != null) {
        entry.avgScoreThem = ((entry.avgScoreThem ?? 0) * (entry.totalGames - 1) + g.finalScoreThem) / entry.totalGames;
      }
      if (g.notes?.trim()) entry.notes.push(g.notes.trim());
      if (g.date > entry.lastPlayed) entry.lastPlayed = g.date;
    }

    return Object.values(map)
      .map((e) => {
        // Game IQ: 50% win rate + 50% goal differential vs opponent
        const winRate = e.totalGames > 0 ? e.wins / e.totalGames : 0;
        const goalDiff =
          e.avgScoreUs != null && e.avgScoreThem != null
            ? Math.max(0, Math.min(1, (e.avgScoreUs - e.avgScoreThem + 5) / 10))
            : winRate;
        e.gameIQ = Math.round((winRate * 0.6 + goalDiff * 0.4) * 100);
        return e;
      })
      .sort((a, b) => b.totalGames - a.totalGames);
  }, [games]);

  const filtered = useMemo(() => {
    if (!search.trim()) return opponentStats;
    const q = search.toLowerCase();
    return opponentStats.filter((o) => o.opponent.toLowerCase().includes(q));
  }, [opponentStats, search]);

  const hasData = opponentStats.some((o) => o.wins > 0 || o.losses > 0 || o.ties > 0);

  function resultBadgeColor(wins: number, losses: number) {
    if (wins > losses) return { bg: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.35)', text: '#22c55e' };
    if (losses > wins) return { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.35)', text: '#ef4444' };
    return { bg: 'rgba(148,163,184,0.18)', border: 'rgba(148,163,184,0.3)', text: '#94a3b8' };
  }

  function gameIQColor(iq: number) {
    if (iq >= 65) return '#22c55e';
    if (iq >= 40) return '#f59e0b';
    return '#ef4444';
  }

  function formatDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#160d2a', '#1e1535', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(30)} className="flex-row items-center px-5 pt-2 pb-3">
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color={teamColor} />
          </Pressable>
          <View className="flex-1">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest">Scouting Report</Text>
            <Text className="text-white text-2xl font-bold">Opponents</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(168,85,247,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={20} color="#c084fc" />
          </View>
        </Animated.View>

        {/* Win Score explanation */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 mb-3">
          <View style={{ backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Trophy size={14} color="#c084fc" />
            <Text style={{ color: '#94a3b8', fontSize: 12, flex: 1, lineHeight: 17 }}>
              <Text style={{ color: '#c084fc', fontWeight: '700' }}>Win Score</Text>
              {' '}is a 0–100 composite: 60% win rate + 40% avg score margin vs this opponent.
            </Text>
          </View>
        </Animated.View>

        {/* Search */}
        <Animated.View entering={FadeIn.delay(60)} className="px-5 mb-3">
          <View className="flex-row items-center bg-slate-800/80 rounded-2xl px-4 py-3 border border-slate-700/40">
            <Search size={16} color="#64748b" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search opponents..."
              placeholderTextColor="#475569"
              className="flex-1 text-white ml-3 text-sm"
              style={{ fontSize: 15 }}
            />
          </View>
        </Animated.View>

        {/* Summary bar */}
        {hasData && (
          <Animated.View entering={FadeIn.delay(80)} className="px-5 mb-4">
            <View className="flex-row" style={{ gap: 8 }}>
              {[
                { label: 'Opponents', value: opponentStats.length, color: '#c084fc' },
                { label: 'vs. Tracked', value: opponentStats.filter((o) => o.wins + o.losses + o.ties > 0).length, color: teamColor },
                {
                  label: 'Win Rate',
                  value: `${opponentStats.reduce((s, o) => s + o.wins, 0) > 0 ? Math.round(opponentStats.reduce((s, o) => s + o.wins, 0) / Math.max(1, opponentStats.reduce((s, o) => s + o.wins + o.losses + o.ties, 0)) * 100) : 0}%`,
                  color: '#22c55e',
                },
              ].map((item) => (
                <View key={item.label} style={{ flex: 1, backgroundColor: 'rgba(30,41,59,0.7)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: item.color, fontWeight: '800', fontSize: 18 }}>{item.value}</Text>
                  <Text className="text-slate-500 text-xs mt-0.5">{item.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        >
          {filtered.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(100).springify()} className="items-center py-16">
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(168,85,247,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Shield size={30} color="#64748b" />
              </View>
              <Text className="text-white font-semibold text-base">No opponents found</Text>
              <Text className="text-slate-500 text-sm mt-2 text-center leading-5">
                {search ? 'Try a different search.' : 'Add games with opponents to build your scouting report.'}
              </Text>
            </Animated.View>
          ) : (
            filtered.map((opp, index) => {
              const badge = resultBadgeColor(opp.wins, opp.losses);
              const isOpen = expanded === opp.opponent;
              const recordGames = opp.wins + opp.losses + opp.ties;

              return (
                <Animated.View
                  key={opp.opponent}
                  entering={FadeInDown.delay(80 + index * 40).springify()}
                  className="mb-3"
                >
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setExpanded(isOpen ? null : opp.opponent);
                    }}
                  >
                    <View
                      style={{
                        backgroundColor: 'rgba(30,41,59,0.8)',
                        borderRadius: isOpen ? 18 : 18,
                        borderWidth: 1,
                        borderColor: isOpen ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.06)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Row */}
                      <View className="flex-row items-center p-4">
                        {/* Game IQ badge */}
                        <View
                          style={{
                            width: 46,
                            height: 46,
                            borderRadius: 14,
                            backgroundColor: `${gameIQColor(opp.gameIQ)}18`,
                            borderWidth: 1.5,
                            borderColor: `${gameIQColor(opp.gameIQ)}40`,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 14,
                          }}
                        >
                          <Text style={{ color: gameIQColor(opp.gameIQ), fontWeight: '800', fontSize: 14 }}>
                            {recordGames > 0 ? opp.gameIQ : '—'}
                          </Text>
                          {recordGames > 0 && (
                            <Text style={{ color: gameIQColor(opp.gameIQ), fontSize: 8, fontWeight: '600' }}>WS</Text>
                          )}
                        </View>

                        <View className="flex-1">
                          <Text className="text-white font-bold text-base" numberOfLines={1}>{opp.opponent}</Text>
                          <View className="flex-row items-center mt-1" style={{ gap: 6 }}>
                            {recordGames > 0 ? (
                              <>
                                <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: badge.border }}>
                                  <Text style={{ color: badge.text, fontWeight: '700', fontSize: 11 }}>
                                    {opp.wins}W {opp.losses}L{opp.ties > 0 ? ` ${opp.ties}T` : ''}
                                  </Text>
                                </View>
                                <Text className="text-slate-500 text-xs">
                                  Last: {formatDate(opp.lastPlayed)}
                                </Text>
                              </>
                            ) : (
                              <Text className="text-slate-500 text-xs">{opp.totalGames} game{opp.totalGames !== 1 ? 's' : ''} · No result logged</Text>
                            )}
                          </View>
                        </View>

                        {recordGames > 0 ? (
                          isOpen ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />
                        ) : null}
                      </View>

                      {/* Expanded detail */}
                      {isOpen && (
                        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(168,85,247,0.15)', padding: 16 }}>
                          {/* Score row */}
                          {(opp.avgScoreUs != null || opp.avgScoreThem != null) && (
                            <View className="flex-row mb-4" style={{ gap: 10 }}>
                              <View style={{ flex: 1, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                                <Text style={{ color: '#22c55e', fontWeight: '800', fontSize: 22 }}>
                                  {opp.avgScoreUs != null ? opp.avgScoreUs.toFixed(1) : '—'}
                                </Text>
                                <Text className="text-slate-500 text-xs mt-0.5">Avg Us</Text>
                              </View>
                              <View style={{ flex: 1, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                                <Text style={{ color: '#f87171', fontWeight: '800', fontSize: 22 }}>
                                  {opp.avgScoreThem != null ? opp.avgScoreThem.toFixed(1) : '—'}
                                </Text>
                                <Text className="text-slate-500 text-xs mt-0.5">Avg Them</Text>
                              </View>
                              <View style={{ flex: 1, backgroundColor: 'rgba(148,163,184,0.08)', borderRadius: 12, padding: 12, alignItems: 'center' }}>
                                <Text style={{ color: '#94a3b8', fontWeight: '800', fontSize: 22 }}>{opp.totalGames}</Text>
                                <Text className="text-slate-500 text-xs mt-0.5">Games</Text>
                              </View>
                            </View>
                          )}

                          {/* Win/loss bar */}
                          {recordGames > 0 && (
                            <View className="mb-4">
                              <View className="flex-row justify-between mb-1">
                                <Text className="text-slate-400 text-xs">Head-to-Head</Text>
                                <Text className="text-slate-500 text-xs">{Math.round(opp.wins / recordGames * 100)}% win rate</Text>
                              </View>
                              <View style={{ height: 8, borderRadius: 4, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(239,68,68,0.3)' }}>
                                <View style={{ flex: opp.wins, backgroundColor: '#22c55e' }} />
                                <View style={{ flex: opp.ties, backgroundColor: '#94a3b8' }} />
                              </View>
                              <View className="flex-row justify-between mt-1">
                                <Text style={{ color: '#22c55e', fontSize: 10 }}>{opp.wins} W</Text>
                                {opp.ties > 0 && <Text style={{ color: '#94a3b8', fontSize: 10 }}>{opp.ties} T</Text>}
                                <Text style={{ color: '#f87171', fontSize: 10 }}>{opp.losses} L</Text>
                              </View>
                            </View>
                          )}

                          {/* Coach notes */}
                          {opp.notes.length > 0 && (
                            <View>
                              <View className="flex-row items-center mb-2" style={{ gap: 6 }}>
                                <FileText size={12} color="#64748b" />
                                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Coach Notes</Text>
                              </View>
                              {opp.notes.map((note, i) => (
                                <View key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 10, marginBottom: 6, borderLeftWidth: 2, borderLeftColor: 'rgba(168,85,247,0.5)' }}>
                                  <Text className="text-slate-300 text-sm leading-5">{note}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
