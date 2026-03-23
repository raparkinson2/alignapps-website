import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BaseballLineup, Player, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface BaseballLineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: BaseballLineup;
  players: Player[];
  opponent: string;
  isSoftball?: boolean; // When true, shows 10th fielder position
}

type PositionKey = 'lf' | 'cf' | 'rf' | 'thirdBase' | 'shortstop' | 'secondBase' | 'firstBase' | 'pitcher' | 'catcher' | 'shortFielder';

const POSITION_LABELS: Record<PositionKey, string> = {
  lf: 'LF',
  cf: 'CF',
  rf: 'RF',
  thirdBase: '3B',
  shortstop: 'SS',
  secondBase: '2B',
  firstBase: '1B',
  pitcher: 'P',
  catcher: 'C',
  shortFielder: 'SF',
};

export function BaseballLineupViewer({
  visible,
  onClose,
  lineup,
  players,
  opponent,
  isSoftball = false,
}: BaseballLineupViewerProps) {
  const getPlayer = (playerId: string | undefined) => {
    return playerId ? players.find((p) => p.id === playerId) : null;
  };

  const renderPositionSlot = (position: PositionKey, size: 'large' | 'medium' = 'medium') => {
    const player = getPlayer(lineup[position]);
    const slotSize = size === 'large' ? 64 : 52;

    return (
      <View className="items-center">
        {player ? (
          <>
            <PlayerAvatar player={player} size={slotSize} />
            <Text className="text-white text-xs font-semibold mt-1">#{player.number}</Text>
            <Text className="text-slate-400 text-[10px]">{getPlayerName(player).split(' ')[0]}</Text>
          </>
        ) : (
          <>
            <View
              className="rounded-full bg-slate-700/50 items-center justify-center"
              style={{ width: slotSize, height: slotSize }}
            >
              <Text className="text-slate-500 text-lg">-</Text>
            </View>
            <Text className="text-slate-500 text-xs mt-1">Empty</Text>
          </>
        )}
        <Text className="text-emerald-400 text-[10px] font-medium mt-0.5">
          {POSITION_LABELS[position]}
        </Text>
      </View>
    );
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
            <Text className="text-white text-lg font-semibold">Game Lineup</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Game Info */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4 pb-2">
              <Text className="text-slate-400 text-sm text-center">vs {opponent}</Text>
            </Animated.View>

            {/* Diamond Layout */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4 text-center">
                Starting Lineup
              </Text>

              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50"
              >
                {/* Outfield Row */}
                <View className="flex-row justify-around mb-6">
                  {renderPositionSlot('lf')}
                  {renderPositionSlot('cf', 'large')}
                  {renderPositionSlot('rf')}
                </View>

                {/* Short Fielder - Only for Softball (10th fielder between outfield and infield) */}
                {isSoftball && (
                  <View className="items-center mb-4">
                    {renderPositionSlot('shortFielder')}
                  </View>
                )}

                {/* Infield Row - SS and 2B */}
                <View className="flex-row justify-center gap-16 mb-4">
                  {renderPositionSlot('shortstop')}
                  {renderPositionSlot('secondBase')}
                </View>

                {/* Infield Row - 3B and 1B */}
                <View className="flex-row justify-between px-6 mb-4">
                  {renderPositionSlot('thirdBase')}
                  {renderPositionSlot('firstBase')}
                </View>

                {/* Pitcher */}
                <View className="items-center mb-4">
                  {renderPositionSlot('pitcher', 'large')}
                </View>

                {/* Catcher */}
                <View className="items-center">
                  {renderPositionSlot('catcher', 'large')}
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
