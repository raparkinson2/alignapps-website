import { View, Text, Modal, Pressable, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SoccerLineup, Player } from '@/lib/store';
import { formatSoccerFormation } from '@/lib/soccer-lineup-adapter';
import { PlayerAvatar } from './PlayerAvatar';

interface SoccerLineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: SoccerLineup;
  players: Player[];
  opponent: string;
}

export function SoccerLineupViewer({
  visible,
  onClose,
  lineup,
  players,
  opponent,
}: SoccerLineupViewerProps) {
  const getPlayer = (playerId: string | undefined) => {
    return playerId ? players.find((p) => p.id === playerId) : null;
  };

  const renderSlot = (
    playerId: string | undefined,
    label: string,
    size: 'large' | 'medium' = 'medium',
    key?: string,
  ) => {
    const player = getPlayer(playerId);
    const slotSize = size === 'large' ? 64 : 48;
    return (
      <View key={key} className="items-center">
        {player ? (
          <>
            <PlayerAvatar player={player} size={slotSize} />
            <Text className="text-white text-xs font-semibold mt-1">#{player.number}</Text>
          </>
        ) : (
          <>
            <View
              className="rounded-full bg-slate-700/50 items-center justify-center"
              style={{ width: slotSize, height: slotSize }}
            >
              <Text className="text-slate-500 text-lg">-</Text>
            </View>
            <Text className="text-slate-500 text-[10px] mt-1">Empty</Text>
          </>
        )}
        <Text className="text-emerald-400 text-[10px] font-medium mt-0.5">{label}</Text>
      </View>
    );
  };

  const formation = formatSoccerFormation(lineup);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose} className="p-1">
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Game Lineup</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4 pb-2">
              <Text className="text-slate-400 text-sm text-center">vs {opponent}</Text>
            </Animated.View>

            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4 text-center">
                Starting XI ({formation})
              </Text>

              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50"
              >
                {/* Forwards Row (top) */}
                <View className="flex-row flex-wrap justify-around mb-5">
                  {lineup.forwards.slice(0, lineup.numForwards).map((pid, i) =>
                    renderSlot(pid, `F${i + 1}`, 'medium', `f-${i}`)
                  )}
                </View>

                {/* Attacking Midfielders Row */}
                {lineup.numAttMidfielders > 0 && (
                  <View className="flex-row flex-wrap justify-around mb-5">
                    {lineup.attMidfielders.slice(0, lineup.numAttMidfielders).map((pid, i) =>
                      renderSlot(pid, `AM${i + 1}`, 'medium', `am-${i}`)
                    )}
                  </View>
                )}

                {/* Defensive Midfielders Row */}
                {lineup.numDefMidfielders > 0 && (
                  <View className="flex-row flex-wrap justify-around mb-5">
                    {lineup.defMidfielders.slice(0, lineup.numDefMidfielders).map((pid, i) =>
                      renderSlot(pid, `DM${i + 1}`, 'medium', `dm-${i}`)
                    )}
                  </View>
                )}

                {/* Defenders Row */}
                <View className="flex-row flex-wrap justify-around mb-5">
                  {lineup.defenders.slice(0, lineup.numDefenders).map((pid, i) =>
                    renderSlot(pid, `D${i + 1}`, 'medium', `d-${i}`)
                  )}
                </View>

                {/* Goalkeeper */}
                <View className="items-center">
                  {renderSlot(lineup.gk, 'GK', 'large', 'gk')}
                </View>
              </Animated.View>

              {/* Bench section */}
              {lineup.numBenchSpots > 0 && lineup.bench.some(Boolean) && (
                <Animated.View
                  entering={FadeIn.delay(150)}
                  className="mt-4 bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50"
                >
                  <Text className="text-slate-400 text-sm font-medium mb-3">Bench</Text>
                  <View className="flex-row flex-wrap">
                    {lineup.bench.slice(0, lineup.numBenchSpots).map((pid, i) => (
                      <View key={`bench-${i}`} className="w-1/5 items-center mb-4">
                        {renderSlot(pid, `#${i + 1}`, 'medium')}
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
