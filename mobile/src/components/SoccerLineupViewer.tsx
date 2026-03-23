import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SoccerLineup, Player } from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface SoccerLineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: SoccerLineup;
  players: Player[];
  opponent: string;
}

type PositionKey = 'gk' | 'lb' | 'cb1' | 'cb2' | 'rb' | 'lm' | 'cm1' | 'cm2' | 'rm' | 'st1' | 'st2';

const POSITION_LABELS: Record<PositionKey, string> = {
  gk: 'GK',
  lb: 'LB',
  cb1: 'CB',
  cb2: 'CB',
  rb: 'RB',
  lm: 'LM',
  cm1: 'CM',
  cm2: 'CM',
  rm: 'RM',
  st1: 'ST',
  st2: 'ST',
};

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

  const renderPositionSlot = (position: PositionKey, size: 'large' | 'medium' = 'medium') => {
    const player = getPlayer(lineup[position]);
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

            {/* Formation Layout */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4 text-center">
                Starting XI
              </Text>

              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50"
              >
                {/* Strikers Row */}
                <View className="flex-row justify-center gap-12 mb-5">
                  {renderPositionSlot('st1')}
                  {renderPositionSlot('st2')}
                </View>

                {/* Midfield Row */}
                <View className="flex-row justify-around mb-5">
                  {renderPositionSlot('lm')}
                  {renderPositionSlot('cm1')}
                  {renderPositionSlot('cm2')}
                  {renderPositionSlot('rm')}
                </View>

                {/* Defense Row */}
                <View className="flex-row justify-around mb-5">
                  {renderPositionSlot('lb')}
                  {renderPositionSlot('cb1')}
                  {renderPositionSlot('cb2')}
                  {renderPositionSlot('rb')}
                </View>

                {/* Goalkeeper */}
                <View className="items-center">
                  {renderPositionSlot('gk', 'large')}
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
