import { View, Text, ScrollView, Pressable, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import {
  ChevronLeft,
  Trophy,
  MapPin,
  Clock,
  Users,
  Shirt,
  Share2,
  CheckCircle2,
  XCircle,
  Beer,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTeamStore, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';

export default function GameRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const photos = useTeamStore((s) => s.photos);
  const teamName = useTeamStore((s) => s.teamName);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const game = games.find((g) => g.id === id);

  if (!game) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center">
        <Text className="text-slate-400">Game not found</Text>
      </View>
    );
  }

  const isCoachOrParent = (p: typeof players[0]) =>
    p.position === 'Coach' || p.position === 'Parent' ||
    p.roles?.includes('coach') || p.roles?.includes('parent');

  const eligiblePlayers = players.filter((p) => !isCoachOrParent(p));
  const invitedPlayers = eligiblePlayers.filter((p) => game.invitedPlayers?.includes(p.id));
  const checkedInPlayers = eligiblePlayers.filter((p) => game.checkedInPlayers?.includes(p.id));
  const checkedOutPlayers = eligiblePlayers.filter((p) => game.checkedOutPlayers?.includes(p.id));
  const beerDutyPlayer = game.beerDutyPlayerId ? players.find((p) => p.id === game.beerDutyPlayerId) : null;
  const gamePhotos = photos.filter((p) => p.gameId === id);

  const result = game.gameResult;
  const hasScore = game.finalScoreUs !== undefined && game.finalScoreThem !== undefined;

  const resultConfig = {
    win: {
      label: 'WIN',
      color: '#22c55e',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/40',
      gradientColors: ['#064e3b', '#0f172a', '#0f172a'] as [string, string, string],
      emoji: '🏆',
    },
    loss: {
      label: 'LOSS',
      color: '#ef4444',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/40',
      gradientColors: ['#450a0a', '#0f172a', '#0f172a'] as [string, string, string],
      emoji: '📉',
    },
    tie: {
      label: 'TIE',
      color: '#94a3b8',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/40',
      gradientColors: ['#1e293b', '#0f172a', '#0f172a'] as [string, string, string],
      emoji: '🤝',
    },
    otLoss: {
      label: 'OT LOSS',
      color: '#f97316',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/40',
      gradientColors: ['#431407', '#0f172a', '#0f172a'] as [string, string, string],
      emoji: '⏱️',
    },
  };

  const config = result ? resultConfig[result] : null;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dateStr = format(parseISO(game.date), 'MMM d, yyyy');
    const scoreStr = hasScore ? `${game.finalScoreUs}-${game.finalScoreThem}` : '';
    const resultLabel = result === 'win' ? 'Won' : result === 'loss' ? 'Lost' : result === 'tie' ? 'Tied' : 'OT Loss';
    const shareText = `${teamName} ${resultLabel} vs ${game.opponent}${scoreStr ? ` (${scoreStr})` : ''} — ${dateStr}`;

    try {
      await Share.share({ message: shareText });
    } catch {}
  };

  const attendanceRate = invitedPlayers.length > 0
    ? Math.round((checkedInPlayers.length / invitedPlayers.length) * 100)
    : 0;

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={config?.gradientColors ?? ['#1e293b', '#0f172a', '#0f172a']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="flex-row items-center justify-between px-4 py-3"
        >
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
          >
            <ChevronLeft size={24} color="white" />
          </Pressable>
          <Text className="text-white font-semibold text-base">Game Recap</Text>
          <Pressable
            onPress={handleShare}
            className="w-10 h-10 rounded-full bg-black/30 items-center justify-center"
          >
            <Share2 size={20} color="white" />
          </Pressable>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: 16 }}
        >
          {/* Hero Result Card */}
          <Animated.View entering={FadeInUp.delay(100).springify()} className="mb-5">
            <View className={`rounded-3xl overflow-hidden border ${config?.borderColor ?? 'border-slate-700/50'}`}>
              <LinearGradient
                colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
                style={{ padding: 32, alignItems: 'center' }}
              >
                {/* Result Badge */}
                {config && (
                  <View className={`px-5 py-2 rounded-full ${config.bgColor} border ${config.borderColor} mb-5`}>
                    <Text style={{ color: config.color, fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>
                      {config.emoji}  {config.label}
                    </Text>
                  </View>
                )}

                {/* Matchup */}
                <Text className="text-slate-400 text-sm mb-2">
                  {format(parseISO(game.date), 'EEEE, MMMM d, yyyy')}
                </Text>
                <Text className="text-white text-xl font-bold text-center mb-4">
                  {teamName} vs {game.opponent}
                </Text>

                {/* Score */}
                {hasScore ? (
                  <View className="flex-row items-center">
                    <View className="items-center min-w-[80px]">
                      <Text className="text-slate-400 text-xs mb-1">{teamName}</Text>
                      <Text style={{ color: config?.color ?? '#ffffff', fontSize: 64, fontWeight: '800', lineHeight: 72 }}>
                        {game.finalScoreUs}
                      </Text>
                    </View>
                    <Text className="text-slate-600 text-3xl font-light mx-4">—</Text>
                    <View className="items-center min-w-[80px]">
                      <Text className="text-slate-400 text-xs mb-1">{game.opponent}</Text>
                      <Text className="text-slate-300 font-bold" style={{ fontSize: 64, fontWeight: '800', lineHeight: 72 }}>
                        {game.finalScoreThem}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text className="text-slate-500 text-base">No score recorded</Text>
                )}
              </LinearGradient>
            </View>
          </Animated.View>

          {/* Game Info Row */}
          <Animated.View entering={FadeInDown.delay(150).springify()} className="flex-row mb-4 gap-3">
            <View className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/30">
              <View className="flex-row items-center mb-1">
                <Clock size={13} color="#67e8f9" />
                <Text className="text-cyan-300 text-xs font-medium ml-1">Time</Text>
              </View>
              <Text className="text-white font-semibold text-sm">{game.time}</Text>
            </View>
            <View className="flex-1 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/30">
              <View className="flex-row items-center mb-1">
                <MapPin size={13} color="#67e8f9" />
                <Text className="text-cyan-300 text-xs font-medium ml-1">Location</Text>
              </View>
              <Text className="text-white font-semibold text-sm" numberOfLines={2}>{game.location}</Text>
            </View>
          </Animated.View>

          {/* Attendance Card */}
          {invitedPlayers.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).springify()} className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/30">
              <View className="flex-row items-center mb-4">
                <Users size={16} color="#67e8f9" />
                <Text className="text-white font-semibold ml-2">Attendance</Text>
                <View className="ml-auto flex-row items-center">
                  <Text className="text-cyan-400 font-bold text-lg">{checkedInPlayers.length}</Text>
                  <Text className="text-slate-500 text-sm">/{invitedPlayers.length}</Text>
                  {invitedPlayers.length > 0 && (
                    <Text className="text-slate-400 text-xs ml-2">({attendanceRate}%)</Text>
                  )}
                </View>
              </View>

              {/* Attendance Bar */}
              <View className="h-2 bg-slate-700 rounded-full mb-4 overflow-hidden">
                <View
                  style={{ width: `${attendanceRate}%`, backgroundColor: config?.color ?? '#67e8f9', borderRadius: 4 }}
                  className="h-full"
                />
              </View>

              {/* Checked In Players */}
              {checkedInPlayers.length > 0 && (
                <View className="mb-3">
                  <View className="flex-row items-center mb-2">
                    <CheckCircle2 size={13} color="#22c55e" />
                    <Text className="text-green-400 text-xs font-medium ml-1">Played ({checkedInPlayers.length})</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {checkedInPlayers.map((player) => (
                      <View key={player.id} className="flex-row items-center bg-green-500/10 rounded-full px-2.5 py-1 border border-green-500/20">
                        <PlayerAvatar player={player} size={18} />
                        <Text className="text-green-300 text-xs font-medium ml-1.5">{getPlayerName(player)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Checked Out Players */}
              {checkedOutPlayers.length > 0 && (
                <View>
                  <View className="flex-row items-center mb-2">
                    <XCircle size={13} color="#ef4444" />
                    <Text className="text-red-400 text-xs font-medium ml-1">Absent ({checkedOutPlayers.length})</Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {checkedOutPlayers.map((player) => (
                      <View key={player.id} className="flex-row items-center bg-red-500/10 rounded-full px-2.5 py-1 border border-red-500/20">
                        <PlayerAvatar player={player} size={18} />
                        <Text className="text-red-300 text-xs font-medium ml-1.5">{getPlayerName(player)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Animated.View>
          )}

          {/* Beer Duty */}
          {beerDutyPlayer && teamSettings.showRefreshmentDuty && (
            <Animated.View entering={FadeInDown.delay(250).springify()} className="bg-amber-500/10 rounded-2xl p-4 mb-4 border border-amber-500/20 flex-row items-center">
              <Beer size={20} color="#f59e0b" />
              <View className="ml-3 flex-1">
                <Text className="text-amber-400 font-semibold">
                  {teamSettings.refreshmentDutyIs21Plus !== false ? 'Beer Duty' : 'Refreshment Duty'}
                </Text>
                <Text className="text-amber-300 text-sm">{getPlayerName(beerDutyPlayer)}</Text>
              </View>
              <PlayerAvatar player={beerDutyPlayer} size={36} />
            </Animated.View>
          )}

          {/* Game Notes */}
          {game.notes && (
            <Animated.View entering={FadeInDown.delay(270).springify()} className="bg-slate-800/60 rounded-2xl p-4 mb-4 border border-slate-700/30">
              <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">Notes</Text>
              <Text className="text-slate-300 text-sm leading-relaxed">{game.notes}</Text>
            </Animated.View>
          )}

          {/* Photos */}
          {gamePhotos.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).springify()} className="mb-4">
              <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-3">Photos</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                <View className="flex-row gap-2 pr-4">
                  {gamePhotos.map((photo) => (
                    <Image
                      key={photo.id}
                      source={{ uri: photo.uri }}
                      style={{ width: 120, height: 120, borderRadius: 12 }}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </ScrollView>
            </Animated.View>
          )}

          {/* Share Button */}
          <Animated.View entering={FadeInDown.delay(320).springify()}>
            <Pressable
              onPress={handleShare}
              className="bg-white/10 rounded-2xl py-4 flex-row items-center justify-center border border-white/10 active:bg-white/20"
            >
              <Share2 size={18} color="#94a3b8" />
              <Text className="text-slate-300 font-semibold ml-2">Share Result</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
