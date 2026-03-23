import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { LacrosseLineup, Player, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface LacrosseLineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: LacrosseLineup;
  players: Player[];
  opponent: string;
}

export function LacrosseLineupViewer({
  visible,
  onClose,
  lineup,
  players,
  opponent,
}: LacrosseLineupViewerProps) {
  const getPlayer = (playerId: string | undefined) => {
    return playerId ? players.find((p) => p.id === playerId) : null;
  };

  const renderPositionSlot = (playerId: string | undefined, label: string, size: 'large' | 'medium' = 'medium') => {
    const player = getPlayer(playerId);
    const slotSize = size === 'large' ? 64 : 48;

    return (
      <View className="items-center">
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
        <Text className="text-emerald-400 text-[10px] font-medium mt-0.5">
          {label}
        </Text>
      </View>
    );
  };

  const totalPlayers = 1 + lineup.numAttackers + lineup.numMidfielders + lineup.numDefenders;

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

            {/* Formation Info */}
            <Animated.View entering={FadeIn.delay(75)} className="px-5 pt-2 pb-4">
              <View className="bg-emerald-500/20 rounded-xl p-3 border border-emerald-500/30">
                <Text className="text-emerald-400 text-sm font-medium text-center">
                  {totalPlayers} Players: 1G + {lineup.numAttackers}A + {lineup.numMidfielders}M + {lineup.numDefenders}D
                </Text>
              </View>
            </Animated.View>

            {/* Formation Layout */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-2">
              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50"
              >
                {/* Attackers Row */}
                <View className="mb-2">
                  <Text className="text-slate-400 text-xs text-center mb-3">Attackers</Text>
                  <View className="flex-row justify-around">
                    {lineup.attackers.slice(0, lineup.numAttackers).map((playerId, index) => (
                      <View key={`attacker-${index}`}>
                        {renderPositionSlot(playerId, `A${index + 1}`)}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Midfield Row */}
                <View className="my-4">
                  <Text className="text-slate-400 text-xs text-center mb-3">Midfielders</Text>
                  <View className="flex-row justify-around">
                    {lineup.midfielders.slice(0, lineup.numMidfielders).map((playerId, index) => (
                      <View key={`midfielder-${index}`}>
                        {renderPositionSlot(playerId, `M${index + 1}`)}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Defense Row */}
                <View className="my-4">
                  <Text className="text-slate-400 text-xs text-center mb-3">Defenders</Text>
                  <View className="flex-row justify-around">
                    {lineup.defenders.slice(0, lineup.numDefenders).map((playerId, index) => (
                      <View key={`defender-${index}`}>
                        {renderPositionSlot(playerId, `D${index + 1}`)}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Goalie */}
                <View className="mt-4">
                  <Text className="text-slate-400 text-xs text-center mb-3">Goalie</Text>
                  <View className="items-center">
                    {renderPositionSlot(lineup.goalie, 'G', 'large')}
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
