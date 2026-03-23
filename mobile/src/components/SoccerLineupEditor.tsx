import { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SoccerLineup, Player, getPlayerName, getPlayerInitials } from '@/lib/store';
import { cn } from '@/lib/cn';
import { PlayerAvatar } from './PlayerAvatar';

interface SoccerLineupEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lineup: SoccerLineup) => void;
  initialLineup?: SoccerLineup;
  players: Player[];
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

const POSITION_NAMES: Record<PositionKey, string> = {
  gk: 'Goalkeeper',
  lb: 'Left Back',
  cb1: 'Center Back',
  cb2: 'Center Back',
  rb: 'Right Back',
  lm: 'Left Midfield',
  cm1: 'Center Midfield',
  cm2: 'Center Midfield',
  rm: 'Right Midfield',
  st1: 'Striker',
  st2: 'Striker',
};

const createEmptyLineup = (): SoccerLineup => ({
  gk: undefined,
  lb: undefined,
  cb1: undefined,
  cb2: undefined,
  rb: undefined,
  lm: undefined,
  cm1: undefined,
  cm2: undefined,
  rm: undefined,
  st1: undefined,
  st2: undefined,
});

// Helper function to check if a lineup has any assigned players
export function hasAssignedSoccerPlayers(lineup: SoccerLineup | undefined): boolean {
  if (!lineup) return false;
  return !!(
    lineup.gk ||
    lineup.lb ||
    lineup.cb1 ||
    lineup.cb2 ||
    lineup.rb ||
    lineup.lm ||
    lineup.cm1 ||
    lineup.cm2 ||
    lineup.rm ||
    lineup.st1 ||
    lineup.st2
  );
}

export function SoccerLineupEditor({
  visible,
  onClose,
  onSave,
  initialLineup,
  players,
}: SoccerLineupEditorProps) {
  const [lineup, setLineup] = useState<SoccerLineup>(initialLineup || createEmptyLineup());
  const [selectedPosition, setSelectedPosition] = useState<PositionKey | null>(null);

  // Get all assigned player IDs
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(lineup).forEach((playerId) => {
      if (playerId) ids.add(playerId);
    });
    return ids;
  }, [lineup]);

  // Available players (not assigned to any position)
  const availablePlayers = useMemo(() => {
    return players.filter((p) => p.status === 'active' && !assignedPlayerIds.has(p.id));
  }, [players, assignedPlayerIds]);

  const handlePositionSelect = (position: PositionKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPosition(position);
  };

  const handlePlayerSelect = (playerId: string) => {
    if (!selectedPosition) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLineup((prev) => ({
      ...prev,
      [selectedPosition]: playerId,
    }));
    setSelectedPosition(null);
  };

  const handleRemovePlayer = (position: PositionKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => ({
      ...prev,
      [position]: undefined,
    }));
  };

  const handleClearAllPositions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLineup(createEmptyLineup());
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(lineup);
  };

  const handleClose = () => {
    setLineup(initialLineup || createEmptyLineup());
    onClose();
  };

  const getPlayer = (playerId: string | undefined) => {
    return playerId ? players.find((p) => p.id === playerId) : null;
  };

  // Check if any players are assigned
  const hasAnyAssigned = assignedPlayerIds.size > 0;

  const renderPositionSlot = (position: PositionKey, size: 'large' | 'medium' = 'medium') => {
    const player = getPlayer(lineup[position]);
    const isSelected = selectedPosition === position;
    const slotSize = size === 'large' ? 64 : 48;

    return (
      <Pressable
        onPress={() => handlePositionSelect(position)}
        onLongPress={() => player && handleRemovePlayer(position)}
        className={`items-center ${isSelected ? 'opacity-50' : ''}`}
      >
        {player ? (
          <>
            <View
              className="border-2 border-emerald-500 rounded-full"
              style={{ width: slotSize + 4, height: slotSize + 4 }}
            >
              <PlayerAvatar player={player} size={slotSize} />
            </View>
            <Text className="text-white text-xs font-semibold mt-1">#{player.number}</Text>
          </>
        ) : (
          <>
            <View
              className={`rounded-full bg-slate-700/50 items-center justify-center border-2 ${
                isSelected ? 'border-emerald-500' : 'border-slate-600'
              }`}
              style={{ width: slotSize + 4, height: slotSize + 4 }}
            >
              <Text className="text-slate-500 text-lg">+</Text>
            </View>
            <Text className="text-slate-500 text-[10px] mt-1">Tap to add</Text>
          </>
        )}
        <Text className="text-emerald-400 text-[10px] font-medium mt-0.5">
          {POSITION_LABELS[position]}
        </Text>
      </Pressable>
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
            <Pressable onPress={handleClose} className="p-1">
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Set Lineup</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleClearAllPositions}
                className="bg-slate-800 px-3 py-2 rounded-lg flex-row items-center"
                disabled={!hasAnyAssigned}
              >
                <Trash2 size={16} color={!hasAnyAssigned ? '#475569' : '#f87171'} />
                <Text className={cn(
                  'ml-1.5 font-medium text-sm',
                  !hasAnyAssigned ? 'text-slate-600' : 'text-red-400'
                )}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="bg-emerald-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-slate-900 font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Formation Layout (4-4-2) */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-6">
              <Text className="text-white text-lg font-semibold mb-4 text-center">
                Starting XI (4-4-2)
              </Text>

              <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50">
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
              </View>
            </Animated.View>

            {/* Player Selection */}
            {selectedPosition && (
              <Animated.View entering={FadeInDown.delay(50)} className="px-5 pt-6">
                <Text className="text-white text-lg font-semibold mb-3">
                  Select {POSITION_NAMES[selectedPosition]}
                </Text>

                <View className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
                  {availablePlayers.length === 0 ? (
                    <View className="p-4">
                      <Text className="text-slate-400 text-center">
                        All players are assigned to positions
                      </Text>
                    </View>
                  ) : (
                    availablePlayers.map((player, index) => (
                      <Pressable
                        key={player.id}
                        onPress={() => handlePlayerSelect(player.id)}
                        className={`flex-row items-center p-3 ${
                          index < availablePlayers.length - 1 ? 'border-b border-slate-700/50' : ''
                        }`}
                      >
                        <PlayerAvatar player={player} size={40} />
                        <View className="ml-3 flex-1">
                          <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                          <Text className="text-slate-400 text-xs">#{player.number}</Text>
                        </View>
                        <Text className="text-slate-500 text-xs">{player.position}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </Animated.View>
            )}

            {/* Instructions */}
            <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-6">
              <View className="bg-slate-800/40 rounded-xl p-4">
                <Text className="text-slate-400 text-sm text-center">
                  Tap a position to assign a player. Long press to remove.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
