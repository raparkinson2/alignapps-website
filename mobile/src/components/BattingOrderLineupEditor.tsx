import { View, Text, Pressable, ScrollView, Modal , Platform } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { X, Plus, Minus, User, Trash2, GripVertical } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Sortable, { useItemContext } from 'react-native-sortables';
import { cn } from '@/lib/cn';
import {
  Player,
  BattingOrderLineup,
  getPlayerName,
} from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface BattingOrderLineupEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lineup: BattingOrderLineup) => void;
  initialLineup?: BattingOrderLineup;
  availablePlayers: Player[];
  sport: 'baseball' | 'softball';
}

// Get positions for batting order based on sport
const getPositionsForSport = (sport: 'baseball' | 'softball'): string[] => {
  if (sport === 'softball') {
    return ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SF', 'DH'];
  }
  return ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
};

const getPositionName = (position: string): string => {
  const names: Record<string, string> = {
    P: 'Pitcher',
    C: 'Catcher',
    '1B': 'First Base',
    '2B': 'Second Base',
    '3B': 'Third Base',
    SS: 'Shortstop',
    LF: 'Left Field',
    CF: 'Center Field',
    RF: 'Right Field',
    SF: 'Short Fielder',
    DH: 'Designated Hitter',
  };
  return names[position] || position;
};

const createEmptyLineup = (sport: 'baseball' | 'softball'): BattingOrderLineup => {
  const numHitters = sport === 'baseball' ? 9 : 10;
  return {
    battingOrder: Array(numHitters).fill(undefined),
    numHitters,
  };
};

// Entry type for the batting order
type BattingOrderEntry = {
  playerId: string;
  position: string;
} | undefined;

// Animated order number that updates during drag
function AnimatedOrderNumber({ itemKey }: { itemKey: string }) {
  const { keyToIndex } = useItemContext();
  const [displayNumber, setDisplayNumber] = useState(1);

  useAnimatedReaction(
    () => keyToIndex.value[itemKey],
    (index) => {
      if (index !== undefined) {
        runOnJS(setDisplayNumber)(index + 1);
      }
    },
    [itemKey]
  );

  return (
    <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
      <Text className="text-emerald-400 font-bold">{displayNumber}</Text>
    </View>
  );
}

export function BattingOrderLineupEditor({
  visible,
  onClose,
  onSave,
  initialLineup,
  availablePlayers,
  sport,
}: BattingOrderLineupEditorProps) {
  const [lineup, setLineup] = useState<BattingOrderLineup>(initialLineup ?? createEmptyLineup(sport));
  const [selectingSlot, setSelectingSlot] = useState<number | null>(null);
  const [selectingPosition, setSelectingPosition] = useState<{ slot: number; playerId: string } | null>(null);

  const positions = getPositionsForSport(sport);
  const minHitters = sport === 'baseball' ? 9 : 10;
  const maxHitters = minHitters + 10; // Allow up to +10 extra hitters (designated hitters)

  // Get all currently assigned player IDs
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    lineup.battingOrder.forEach((entry) => {
      if (entry?.playerId) ids.add(entry.playerId);
    });
    return ids;
  }, [lineup]);

  // Get assigned positions
  const assignedPositions = useMemo(() => {
    const positionsSet = new Set<string>();
    lineup.battingOrder.forEach((entry) => {
      if (entry?.position && entry.position !== 'DH') {
        positionsSet.add(entry.position);
      }
    });
    return positionsSet;
  }, [lineup]);

  const handleNumHittersChange = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => {
      const newNum = Math.max(minHitters, Math.min(maxHitters, prev.numHitters + delta));
      const newBattingOrder = [...prev.battingOrder];

      if (newNum > prev.numHitters) {
        // Add slots
        while (newBattingOrder.length < newNum) {
          newBattingOrder.push(undefined);
        }
      } else if (newNum < prev.numHitters) {
        // Remove slots from the end
        newBattingOrder.splice(newNum);
      }

      return {
        ...prev,
        numHitters: newNum,
        battingOrder: newBattingOrder,
      };
    });
  };

  const handleSelectPlayer = (playerId: string) => {
    if (selectingSlot === null) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // After selecting player, show position picker
    setSelectingPosition({ slot: selectingSlot, playerId });
    setSelectingSlot(null);
  };

  const handleSelectPosition = (position: string) => {
    if (!selectingPosition) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLineup((prev) => {
      const newBattingOrder = [...prev.battingOrder];
      newBattingOrder[selectingPosition.slot] = {
        playerId: selectingPosition.playerId,
        position,
      };
      return { ...prev, battingOrder: newBattingOrder };
    });
    setSelectingPosition(null);
  };

  const handleClearSlot = (slot: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => {
      const newBattingOrder = [...prev.battingOrder];
      newBattingOrder[slot] = undefined;
      return { ...prev, battingOrder: newBattingOrder };
    });
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLineup((prev) => ({
      ...prev,
      battingOrder: Array(prev.numHitters).fill(undefined),
    }));
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(lineup);
  };

  const handleClose = () => {
    setLineup(initialLineup ?? createEmptyLineup(sport));
    setSelectingSlot(null);
    setSelectingPosition(null);
    onClose();
  };

  const getPlayer = useCallback((playerId: string) => {
    return availablePlayers.find((p) => p.id === playerId);
  }, [availablePlayers]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={handleClose} className="p-1">
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Batting Order</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleClearAll}
                className="bg-slate-800 px-3 py-2 rounded-lg flex-row items-center"
                disabled={assignedPlayerIds.size === 0}
              >
                <Trash2 size={16} color={assignedPlayerIds.size === 0 ? '#475569' : '#f87171'} />
                <Text className={cn(
                  'ml-1.5 font-medium text-sm',
                  assignedPlayerIds.size === 0 ? 'text-slate-600' : 'text-red-400'
                )}>Clear</Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="bg-emerald-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Hitter Count */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Number of Hitters</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleNumHittersChange(-1)}
                    className="p-2"
                    disabled={lineup.numHitters <= minHitters}
                  >
                    <Minus
                      size={20}
                      color={lineup.numHitters <= minHitters ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numHitters}</Text>
                  <Pressable
                    onPress={() => handleNumHittersChange(1)}
                    className="p-2"
                    disabled={lineup.numHitters >= maxHitters}
                  >
                    <Plus
                      size={20}
                      color={lineup.numHitters >= maxHitters ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>
            </Animated.View>

            {/* Batting Order List */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-2">
              <Text className="text-white text-lg font-semibold mb-4">Lineup Card</Text>

              <View className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden">
                <Sortable.Grid
                  data={lineup.battingOrder.slice(0, lineup.numHitters).map((entry, index) => ({
                    id: `slot-${index}`,
                    entry,
                    originalIndex: index,
                  }))}
                  columns={1}
                  renderItem={({ item, index: visualIndex }) => {
                    const player = item.entry?.playerId ? getPlayer(item.entry.playerId) : null;

                    return (
                      <View
                        className={cn(
                          'flex-row items-center p-3 bg-slate-800/60',
                          visualIndex < lineup.numHitters - 1 && 'border-b border-slate-700/50'
                        )}
                      >
                        {/* Drag Handle */}
                        {player ? (
                          <Sortable.Handle>
                            <View className="p-2 mr-1">
                              <GripVertical size={18} color="#64748b" />
                            </View>
                          </Sortable.Handle>
                        ) : (
                          <View className="w-[34px]" />
                        )}

                        {/* Order Number - animates with current position during drag */}
                        <AnimatedOrderNumber itemKey={item.id} />

                        {/* Player Info / Empty Slot */}
                        <Pressable
                          onPress={() => setSelectingSlot(visualIndex)}
                          className="flex-1 flex-row items-center"
                        >
                          {player ? (
                            <>
                              <PlayerAvatar player={player} size={40} />
                              <View className="ml-3 flex-1">
                                <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                                <Text className="text-slate-400 text-xs">#{player.number}</Text>
                              </View>
                              <View className="bg-emerald-500/20 px-2 py-1 rounded">
                                <Text className="text-emerald-400 font-semibold text-sm">{item.entry?.position}</Text>
                              </View>
                            </>
                          ) : (
                            <View className="flex-row items-center flex-1">
                              <View className="w-10 h-10 rounded-full bg-slate-700/50 items-center justify-center border-2 border-dashed border-slate-600">
                                <User size={18} color="#64748b" />
                              </View>
                              <Text className="text-slate-500 ml-3">Tap to add player</Text>
                            </View>
                          )}
                        </Pressable>

                        {/* Clear Button */}
                        {player && (
                          <Pressable
                            onPress={() => handleClearSlot(visualIndex)}
                            className="p-2 ml-2"
                          >
                            <X size={18} color="#ef4444" />
                          </Pressable>
                        )}
                      </View>
                    );
                  }}
                  keyExtractor={(item) => item.id}
                  onDragEnd={({ data }) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    // Update batting order with the new order and reassign IDs
                    const newBattingOrder = data.map((item) => item.entry);
                    setLineup((prev) => ({
                      ...prev,
                      battingOrder: newBattingOrder,
                    }));
                  }}
                  customHandle
                  dragActivationDelay={150}
                  activeItemScale={1.02}
                  activeItemOpacity={0.9}
                  activeItemShadowOpacity={0.3}
                />
              </View>
            </Animated.View>

            {/* Tips */}
            <Animated.View entering={FadeIn.delay(150)} className="px-5 pt-4">
              <View className="bg-slate-800/40 rounded-xl p-4">
                <Text className="text-slate-400 text-sm text-center">
                  Tap a slot to add a player, then select their position.
                </Text>
                <Text className="text-slate-500 text-xs text-center mt-1">
                  Hold and drag the grip icon to reorder the batting lineup.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* Player Selection Modal */}
      <Modal
        visible={selectingSlot !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectingSlot(null)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setSelectingSlot(null)} className="p-1">
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">
                Select Batter #{selectingSlot !== null ? selectingSlot + 1 : ''}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1">
              {availablePlayers
                .sort((a, b) => {
                  const aAssigned = assignedPlayerIds.has(a.id);
                  const bAssigned = assignedPlayerIds.has(b.id);
                  if (!aAssigned && bAssigned) return -1;
                  if (aAssigned && !bAssigned) return 1;
                  return 0;
                })
                .map((player) => {
                  const isAssigned = assignedPlayerIds.has(player.id);
                  return (
                    <Pressable
                      key={player.id}
                      onPress={() => handleSelectPlayer(player.id)}
                      className={cn(
                        'flex-row items-center px-5 py-3 border-b border-slate-800',
                        isAssigned && 'opacity-50'
                      )}
                    >
                      <PlayerAvatar player={player} size={48} />
                      <View className="ml-4 flex-1">
                        <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                        <Text className="text-slate-400 text-sm">#{player.number}</Text>
                      </View>
                      {isAssigned && (
                        <Text className="text-slate-500 text-xs">In lineup</Text>
                      )}
                    </Pressable>
                  );
                })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Position Selection Modal */}
      <Modal
        visible={selectingPosition !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectingPosition(null)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setSelectingPosition(null)} className="p-1">
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Select Position</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              <View className="flex-row flex-wrap justify-center gap-3">
                {positions.map((position) => {
                  const isAssigned = assignedPositions.has(position) && position !== 'DH';
                  return (
                    <Pressable
                      key={position}
                      onPress={() => handleSelectPosition(position)}
                      className={cn(
                        'w-[30%] py-4 rounded-xl border items-center',
                        isAssigned
                          ? 'bg-slate-800/40 border-slate-700/50 opacity-50'
                          : 'bg-emerald-500/20 border-emerald-500/50'
                      )}
                    >
                      <Text className={cn(
                        'font-bold text-lg',
                        isAssigned ? 'text-slate-500' : 'text-emerald-400'
                      )}>{position}</Text>
                      <Text className={cn(
                        'text-xs mt-1',
                        isAssigned ? 'text-slate-600' : 'text-slate-400'
                      )}>{getPositionName(position)}</Text>
                      {isAssigned && (
                        <Text className="text-slate-600 text-[10px] mt-1">Assigned</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </Modal>
  );
}

// Helper function to check if a lineup has any assigned players
export function hasAssignedBattingOrder(lineup: BattingOrderLineup | undefined): boolean {
  if (!lineup || !lineup.battingOrder) return false;
  return lineup.battingOrder.some((entry) => entry?.playerId);
}
