import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BattingOrderLineup, Player, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface BattingOrderLineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: BattingOrderLineup;
  players: Player[];
  opponent: string;
  sport: 'baseball' | 'softball';
}

export function BattingOrderLineupViewer({
  visible,
  onClose,
  lineup,
  players,
  opponent,
  sport,
}: BattingOrderLineupViewerProps) {
  const getPlayer = (playerId: string | undefined) => {
    return playerId ? players.find((p) => p.id === playerId) : null;
  };

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
            <Text className="text-white text-lg font-semibold">Batting Order</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Game Info */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4 pb-2">
              <Text className="text-slate-400 text-sm text-center">vs {opponent}</Text>
            </Animated.View>

            {/* Lineup Card */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-4">
              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden"
              >
                {lineup.battingOrder.slice(0, lineup.numHitters).map((entry, index) => {
                  const player = entry?.playerId ? getPlayer(entry.playerId) : null;

                  return (
                    <View
                      key={index}
                      className={`flex-row items-center p-3 ${
                        index < lineup.numHitters - 1 ? 'border-b border-slate-700/50' : ''
                      }`}
                    >
                      {/* Order Number */}
                      <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                        <Text className="text-emerald-400 font-bold">{index + 1}</Text>
                      </View>

                      {/* Player Info */}
                      {player ? (
                        <>
                          <PlayerAvatar player={player} size={40} />
                          <View className="ml-3 flex-1">
                            <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                            <Text className="text-slate-400 text-xs">#{player.number}</Text>
                          </View>
                          <View className="bg-emerald-500/20 px-2 py-1 rounded">
                            <Text className="text-emerald-400 font-semibold text-sm">{entry?.position}</Text>
                          </View>
                        </>
                      ) : (
                        <View className="flex-1">
                          <View className="w-10 h-10 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-lg">-</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
