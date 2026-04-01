import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Check, X, HelpCircle, TrendingUp, Calendar, Users } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, getPlayerName, Player, Game } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useMemo, useState } from 'react';

interface AttendanceStats {
  playerId: string;
  playerName: string;
  gamesIn: number;
  gamesOut: number;
  noResponse: number;
  gamesInvited: number;   // games with a result where player was invited
  gamesPlayed: number;    // games where stats were entered (source of truth)
  attendanceRate: number; // gamesPlayed / gamesInvited × 100
}

interface GameAttendance {
  gameId: string;
  date: string;
  opponent: string;
  response: 'in' | 'out' | 'no_response';
}

export default function AttendanceScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const games = useTeamStore((s) => s.games);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Completed games (source of truth — a game counts once it has a result)
  const completedGames = useMemo(
    () => games.filter((g) => g.gameResult),
    [games],
  );

  // Past games (for RSVP history display in the modal)
  const gamesWithAttendance = useMemo(() => {
    const now = new Date();
    return games
      .filter((game) => {
        const isPast = new Date(game.date) < now;
        const hasResponses = (game.checkedInPlayers?.length ?? 0) > 0 || (game.checkedOutPlayers?.length ?? 0) > 0;
        return isPast || hasResponses;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [games]);

  // Calculate attendance stats for each player
  // Attendance Rate = Games Played (from stats/gameLogs) ÷ Games Invited (completed games)
  const attendanceStats = useMemo(() => {
    const stats: AttendanceStats[] = players.map((player) => {
      // RSVP counts (informational only)
      let gamesIn = 0;
      let gamesOut = 0;
      let noResponse = 0;

      gamesWithAttendance.forEach((game) => {
        if (game.invitedPlayers?.includes(player.id)) {
          if (game.checkedInPlayers?.includes(player.id)) {
            gamesIn++;
          } else if (game.checkedOutPlayers?.includes(player.id)) {
            gamesOut++;
          } else {
            noResponse++;
          }
        }
      });

      // Denominator: completed games where player was invited
      const invitedCompleted = completedGames.filter((g) => g.invitedPlayers?.includes(player.id));
      const gamesInvited = invitedCompleted.length;

      // Numerator: game logs (stats entered = player actually played)
      const invitedIds = new Set(invitedCompleted.map((g) => g.id));
      const gamesPlayed = (player.gameLogs ?? []).filter(
        (log) => !log.gameId || invitedIds.has(log.gameId),
      ).length;

      const attendanceRate = gamesInvited > 0
        ? Math.min(100, Math.round((gamesPlayed / gamesInvited) * 100))
        : 0;

      return {
        playerId: player.id,
        playerName: getPlayerName(player),
        gamesIn,
        gamesOut,
        noResponse,
        gamesInvited,
        gamesPlayed,
        attendanceRate,
      };
    });

    return stats
      .filter((s) => s.gamesInvited > 0)
      .sort((a, b) => {
        if (b.attendanceRate !== a.attendanceRate) {
          return b.attendanceRate - a.attendanceRate;
        }
        return b.gamesInvited - a.gamesInvited;
      });
  }, [players, completedGames, gamesWithAttendance]);

  // Team totals
  const teamTotals = useMemo(() => {
    const totals = attendanceStats.reduce(
      (acc, stat) => ({
        gamesIn: acc.gamesIn + stat.gamesIn,
        gamesOut: acc.gamesOut + stat.gamesOut,
        noResponse: acc.noResponse + stat.noResponse,
        totalPlayed: acc.totalPlayed + stat.gamesPlayed,
        totalInvited: acc.totalInvited + stat.gamesInvited,
      }),
      { gamesIn: 0, gamesOut: 0, noResponse: 0, totalPlayed: 0, totalInvited: 0 },
    );

    const overallRate = totals.totalInvited > 0
      ? Math.min(100, Math.round((totals.totalPlayed / totals.totalInvited) * 100))
      : 0;

    return { ...totals, overallRate };
  }, [attendanceStats]);

  // Get game-by-game attendance for selected player
  const playerGameAttendance = useMemo((): GameAttendance[] => {
    if (!selectedPlayer) return [];

    return gamesWithAttendance
      .filter((game) => game.invitedPlayers?.includes(selectedPlayer.id))
      .map((game) => {
        let response: 'in' | 'out' | 'no_response' = 'no_response';
        if (game.checkedInPlayers?.includes(selectedPlayer.id)) {
          response = 'in';
        } else if (game.checkedOutPlayers?.includes(selectedPlayer.id)) {
          response = 'out';
        }

        return {
          gameId: game.id,
          date: game.date,
          opponent: game.opponent,
          response,
        };
      });
  }, [selectedPlayer, gamesWithAttendance]);

  const getPlayer = (playerId: string) => players.find((p) => p.id === playerId);

  const getAttendanceColor = (rate: number) => {
    if (rate >= 80) return '#22c55e';
    if (rate >= 60) return '#eab308';
    if (rate >= 40) return '#f97316';
    return '#ef4444';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePlayerPress = (playerId: string) => {
    const player = getPlayer(playerId);
    if (player) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedPlayer(player);
      setModalVisible(true);
    }
  };

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="flex-row items-center px-4 pt-2 pb-4"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center mr-3"
          >
            <ChevronLeft size={24} color="#fff" />
          </Pressable>
          <Text className="text-white text-2xl font-bold flex-1">Attendance</Text>
        </Animated.View>

        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Team Summary Card */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <View className="bg-slate-800/80 rounded-2xl p-5 mb-6 border border-slate-700/50">
              <View className="flex-row items-center mb-4">
                <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center">
                  <TrendingUp size={20} color="#67e8f9" />
                </View>
                <Text className="text-white text-lg font-bold ml-3">Team Summary</Text>
              </View>

              {/* Overall Attendance Rate */}
              <View className="items-center mb-5">
                <Text className="text-slate-400 text-sm mb-1">Overall Attendance Rate</Text>
                <Text
                  className="text-4xl font-bold"
                  style={{ color: getAttendanceColor(teamTotals.overallRate) }}
                >
                  {teamTotals.overallRate.toFixed(0)}%
                </Text>
              </View>

              {/* Stats Row */}
              <View className="flex-row justify-between">
                <View className="flex-1 items-center">
                  <View className="flex-row items-center mb-1">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-green-400 text-xs ml-1">IN</Text>
                  </View>
                  <Text className="text-white text-2xl font-bold">{teamTotals.gamesIn}</Text>
                </View>
                <View className="w-px bg-slate-700" />
                <View className="flex-1 items-center">
                  <View className="flex-row items-center mb-1">
                    <X size={16} color="#ef4444" />
                    <Text className="text-red-400 text-xs ml-1">OUT</Text>
                  </View>
                  <Text className="text-white text-2xl font-bold">{teamTotals.gamesOut}</Text>
                </View>
                <View className="w-px bg-slate-700" />
                <View className="flex-1 items-center">
                  <View className="flex-row items-center mb-1">
                    <HelpCircle size={16} color="#94a3b8" />
                    <Text className="text-slate-400 text-xs ml-1">NO RESPONSE</Text>
                  </View>
                  <Text className="text-white text-2xl font-bold">{teamTotals.noResponse}</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Players Section Header */}
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            className="flex-row items-center mb-3"
          >
            <Users size={16} color="#94a3b8" />
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider ml-2">
              Player Attendance
            </Text>
          </Animated.View>

          {/* Player Stats */}
          {attendanceStats.length === 0 ? (
            <Animated.View
              entering={FadeInDown.delay(200).springify()}
              className="bg-slate-800/60 rounded-xl p-6 items-center"
            >
              <Calendar size={40} color="#64748b" />
              <Text className="text-slate-400 text-center mt-3">
                No past games with attendance data yet.
              </Text>
              <Text className="text-slate-500 text-sm text-center mt-1">
                Attendance will be tracked as games are played.
              </Text>
            </Animated.View>
          ) : (
            attendanceStats.map((stat, index) => {
              const player = getPlayer(stat.playerId);
              if (!player) return null;

              return (
                <Animated.View
                  key={stat.playerId}
                  entering={FadeInDown.delay(200 + index * 30).springify()}
                >
                  <Pressable
                    onPress={() => handlePlayerPress(stat.playerId)}
                    className="bg-slate-800/60 rounded-xl p-4 mb-3 border border-slate-700/30 active:bg-slate-700/60"
                  >
                    <View className="flex-row items-center mb-3">
                      <PlayerAvatar player={player} size={44} />
                      <View className="flex-1 ml-3">
                        <Text className="text-white font-semibold">{stat.playerName}</Text>
                        <Text className="text-slate-400 text-sm">
                          {stat.gamesInvited} game{stat.gamesInvited !== 1 ? 's' : ''} invited
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text
                          className="text-xl font-bold"
                          style={{ color: getAttendanceColor(stat.attendanceRate) }}
                        >
                          {stat.attendanceRate.toFixed(0)}%
                        </Text>
                        <Text className="text-slate-500 text-xs">attendance</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${stat.attendanceRate}%`,
                          backgroundColor: getAttendanceColor(stat.attendanceRate),
                        }}
                      />
                    </View>

                    {/* Stats Row */}
                    <View className="flex-row justify-between">
                      <View className="flex-row items-center">
                        <View className="flex-row items-center bg-green-500/20 rounded-full px-2.5 py-1">
                          <Check size={12} color="#22c55e" />
                          <Text className="text-green-400 text-xs font-medium ml-1">
                            {stat.gamesIn} In
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        <View className="flex-row items-center bg-red-500/20 rounded-full px-2.5 py-1">
                          <X size={12} color="#ef4444" />
                          <Text className="text-red-400 text-xs font-medium ml-1">
                            {stat.gamesOut} Out
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center">
                        <View className="flex-row items-center bg-slate-600/50 rounded-full px-2.5 py-1">
                          <HelpCircle size={12} color="#94a3b8" />
                          <Text className="text-slate-400 text-xs font-medium ml-1">
                            {stat.noResponse} No Response
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Player Game History Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl max-h-[80%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              {selectedPlayer && (
                <View className="flex-row items-center flex-1">
                  <PlayerAvatar player={selectedPlayer} size={40} />
                  <View className="ml-3 flex-1">
                    <Text className="text-white text-lg font-bold">{getPlayerName(selectedPlayer)}</Text>
                    <Text className="text-slate-400 text-sm">Game History</Text>
                  </View>
                </View>
              )}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setModalVisible(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {/* Game List */}
            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {playerGameAttendance.length === 0 ? (
                <View className="items-center py-8">
                  <Calendar size={40} color="#64748b" />
                  <Text className="text-slate-400 text-center mt-3">No games found</Text>
                </View>
              ) : (
                playerGameAttendance.map((game, index) => (
                  <View
                    key={game.gameId}
                    className="flex-row items-center py-3 border-b border-slate-800"
                  >
                    {/* Response Icon */}
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        game.response === 'in'
                          ? 'bg-green-500/20'
                          : game.response === 'out'
                          ? 'bg-red-500/20'
                          : 'bg-slate-700/50'
                      }`}
                    >
                      {game.response === 'in' ? (
                        <Check size={20} color="#22c55e" />
                      ) : game.response === 'out' ? (
                        <X size={20} color="#ef4444" />
                      ) : (
                        <HelpCircle size={20} color="#94a3b8" />
                      )}
                    </View>

                    {/* Game Details */}
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-medium">vs {game.opponent}</Text>
                      <Text className="text-slate-400 text-sm">{formatDate(game.date)}</Text>
                    </View>

                    {/* Response Label */}
                    <View
                      className={`px-3 py-1 rounded-full ${
                        game.response === 'in'
                          ? 'bg-green-500/20'
                          : game.response === 'out'
                          ? 'bg-red-500/20'
                          : 'bg-slate-700/50'
                      }`}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          game.response === 'in'
                            ? 'text-green-400'
                            : game.response === 'out'
                            ? 'text-red-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {game.response === 'in' ? 'In' : game.response === 'out' ? 'Out' : 'No Response'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
