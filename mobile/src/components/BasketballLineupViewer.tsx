import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BasketballLineup, Player, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface BasketballLineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: BasketballLineup;
  players: Player[];
  opponent: string;
}

export function BasketballLineupViewer({
  visible,
  onClose,
  lineup,
  players,
  opponent,
}: BasketballLineupViewerProps) {
  const getPlayer = (playerId: string | undefined) => {
    return playerId ? players.find((p) => p.id === playerId) : null;
  };

  const pg = getPlayer(lineup.starters.pg);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose} className="p-1">
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Game Lineup</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Game Info */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4 pb-2">
              <Text className="text-slate-400 text-sm text-center">vs {opponent}</Text>
            </Animated.View>

            {/* Starting 5 Section */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4">Starting 5</Text>

              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
              >
                {/* Point Guard */}
                {lineup.hasPG && (
                  <View className="mb-4">
                    <Text className="text-emerald-400 text-xs font-medium mb-2 text-center">Point Guard</Text>
                    <View className="items-center">
                      {pg ? (
                        <>
                          <PlayerAvatar player={pg} size={56} />
                          <Text className="text-white text-sm font-semibold mt-1">#{pg.number}</Text>
                          <Text className="text-slate-400 text-xs">{pg.firstName}</Text>
                        </>
                      ) : (
                        <>
                          <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-lg">-</Text>
                          </View>
                          <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                        </>
                      )}
                    </View>
                  </View>
                )}

                {/* Guards */}
                {lineup.numGuards > 0 && (
                  <View className="mb-4">
                    <Text className="text-emerald-400 text-xs font-medium mb-2 text-center">Guards</Text>
                    <View className="flex-row justify-around">
                      {lineup.starters.guards.slice(0, lineup.numGuards).map((playerId, index) => {
                        const player = getPlayer(playerId);
                        return (
                          <View key={`guard-${index}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={56} />
                                <Text className="text-white text-sm font-semibold mt-1">#{player.number}</Text>
                                <Text className="text-slate-400 text-xs">{getPlayerName(player).split(' ')[0]}</Text>
                              </>
                            ) : (
                              <>
                                <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                                  <Text className="text-slate-500 text-lg">-</Text>
                                </View>
                                <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                              </>
                            )}
                            <Text className="text-slate-500 text-[10px] mt-0.5">G{index + 1}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Forwards */}
                {lineup.numForwards > 0 && (
                  <View className="mb-4">
                    <Text className="text-emerald-400 text-xs font-medium mb-2 text-center">Forwards</Text>
                    <View className="flex-row justify-around">
                      {lineup.starters.forwards.slice(0, lineup.numForwards).map((playerId, index) => {
                        const player = getPlayer(playerId);
                        return (
                          <View key={`forward-${index}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={56} />
                                <Text className="text-white text-sm font-semibold mt-1">#{player.number}</Text>
                                <Text className="text-slate-400 text-xs">{getPlayerName(player).split(' ')[0]}</Text>
                              </>
                            ) : (
                              <>
                                <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                                  <Text className="text-slate-500 text-lg">-</Text>
                                </View>
                                <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                              </>
                            )}
                            <Text className="text-slate-500 text-[10px] mt-0.5">F{index + 1}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Centers */}
                {lineup.numCenters > 0 && (
                  <View>
                    <Text className="text-emerald-400 text-xs font-medium mb-2 text-center">Centers</Text>
                    <View className="flex-row justify-around">
                      {lineup.starters.centers.slice(0, lineup.numCenters).map((playerId, index) => {
                        const player = getPlayer(playerId);
                        return (
                          <View key={`center-${index}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={56} />
                                <Text className="text-white text-sm font-semibold mt-1">#{player.number}</Text>
                                <Text className="text-slate-400 text-xs">{getPlayerName(player).split(' ')[0]}</Text>
                              </>
                            ) : (
                              <>
                                <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                                  <Text className="text-slate-500 text-lg">-</Text>
                                </View>
                                <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                              </>
                            )}
                            <Text className="text-slate-500 text-[10px] mt-0.5">C{index + 1}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </Animated.View>
            </Animated.View>

            {/* Bench Section */}
            {lineup.bench.some(Boolean) && (
              <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-4">
                <Text className="text-white text-lg font-semibold mb-4">Bench</Text>

                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row flex-wrap justify-start">
                    {lineup.bench.map((playerId, index) => {
                      const player = getPlayer(playerId);
                      if (!player) return null;
                      return (
                        <View key={`bench-${index}`} className="w-1/4 items-center mb-4">
                          <PlayerAvatar player={player} size={48} />
                          <Text className="text-white text-xs font-semibold mt-1">#{player.number}</Text>
                          <Text className="text-slate-400 text-[10px]">{getPlayerName(player).split(' ')[0]}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>
              </Animated.View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
