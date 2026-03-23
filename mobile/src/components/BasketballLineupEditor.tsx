import { View, Text, Pressable, ScrollView, Modal , Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { Image } from 'expo-image';
import { X, Plus, Minus, User, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import {
  Player,
  BasketballLineup,
  SPORT_POSITION_NAMES,
  getPlayerName,
  getPlayerInitials,
} from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface BasketballLineupEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lineup: BasketballLineup) => void;
  initialLineup?: BasketballLineup;
  availablePlayers: Player[];
}

type PositionType = 'pg' | 'g' | 'f' | 'c' | 'bench';

interface PositionSlotProps {
  position: PositionType;
  playerId?: string;
  players: Player[];
  onSelect: () => void;
  label: string;
}

function PositionSlot({ position, playerId, players, onSelect, label }: PositionSlotProps) {
  const player = playerId ? players.find((p) => p.id === playerId) : undefined;

  return (
    <Pressable
      onPress={onSelect}
      className="items-center"
    >
      <View
        className={cn(
          'w-16 h-16 rounded-full border-2 items-center justify-center overflow-hidden',
          player ? 'border-emerald-500 bg-slate-700' : 'border-slate-600 border-dashed bg-slate-800/50'
        )}
      >
        {player ? (
          <PlayerAvatar player={player} size={60} />
        ) : (
          <User size={24} color="#64748b" />
        )}
      </View>
      <Text className="text-slate-400 text-xs mt-1 font-medium">{label}</Text>
      {player && (
        <Text className="text-white text-xs font-semibold" numberOfLines={1}>
          #{player.number}
        </Text>
      )}
    </Pressable>
  );
}

const createEmptyLineup = (): BasketballLineup => ({
  starters: {
    pg: undefined,
    guards: [undefined, undefined],
    forwards: [undefined],
    centers: [undefined],
  },
  bench: Array(10).fill(undefined),
  numGuards: 2,
  numForwards: 1,
  numCenters: 1,
  hasPG: true,
  numBenchSpots: 10,
});

export function BasketballLineupEditor({
  visible,
  onClose,
  onSave,
  initialLineup,
  availablePlayers,
}: BasketballLineupEditorProps) {
  const [lineup, setLineup] = useState<BasketballLineup>(initialLineup ?? createEmptyLineup());
  const [playerSelectModal, setPlayerSelectModal] = useState<{
    visible: boolean;
    slotType: 'pg' | 'guard' | 'forward' | 'center' | 'bench';
    slotIndex: number;
  } | null>(null);

  // Calculate current starting 5 count
  const currentStarterCount = useMemo(() => {
    let count = 0;
    if (lineup.hasPG) count += 1;
    count += lineup.numGuards;
    count += lineup.numForwards;
    count += lineup.numCenters;
    return count;
  }, [lineup.hasPG, lineup.numGuards, lineup.numForwards, lineup.numCenters]);

  const remainingSlots = 5 - currentStarterCount;

  // Get all currently assigned player IDs
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (lineup.starters.pg) ids.add(lineup.starters.pg);
    lineup.starters.guards.forEach((id) => { if (id) ids.add(id); });
    lineup.starters.forwards.forEach((id) => { if (id) ids.add(id); });
    lineup.starters.centers.forEach((id) => { if (id) ids.add(id); });
    lineup.bench.forEach((id) => { if (id) ids.add(id); });
    return ids;
  }, [lineup]);

  // Filter players by position preference
  const getPlayersForPosition = (position: PositionType) => {
    const positionMap: Record<PositionType, string[]> = {
      pg: ['PG', 'G'],
      g: ['G', 'PG', 'SG'],
      f: ['F', 'SF', 'PF'],
      c: ['C', 'PF'],
      bench: [], // All players for bench
    };

    const preferredPositions = positionMap[position];

    return [...availablePlayers].sort((a, b) => {
      const aPreferred = position === 'bench' || preferredPositions.includes(a.position);
      const bPreferred = position === 'bench' || preferredPositions.includes(b.position);
      const aAssigned = assignedPlayerIds.has(a.id);
      const bAssigned = assignedPlayerIds.has(b.id);

      if (!aAssigned && !bAssigned) {
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
      }
      if (!aAssigned && bAssigned) return -1;
      if (aAssigned && !bAssigned) return 1;
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return 0;
    });
  };

  const handleConfigChange = (
    type: 'pg' | 'guards' | 'forwards' | 'centers' | 'bench',
    delta: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => {
      const newLineup = { ...prev, starters: { ...prev.starters } };

      if (type === 'pg') {
        const newValue = prev.hasPG ? false : true;
        // Check if we can add (need room in starting 5)
        if (newValue && currentStarterCount >= 5) return prev;
        newLineup.hasPG = newValue;
        if (!newValue) newLineup.starters.pg = undefined;
      } else if (type === 'guards') {
        const newNum = Math.max(0, Math.min(3, prev.numGuards + delta));
        // Check if adding would exceed 5 starters
        if (delta > 0 && currentStarterCount >= 5) return prev;
        newLineup.numGuards = newNum;
        // Trim guards array if reducing
        if (newNum < prev.numGuards) {
          newLineup.starters.guards = prev.starters.guards.slice(0, newNum);
        } else {
          // Expand guards array if increasing
          newLineup.starters.guards = [...prev.starters.guards];
          while (newLineup.starters.guards.length < newNum) {
            newLineup.starters.guards.push(undefined);
          }
        }
      } else if (type === 'forwards') {
        const newNum = Math.max(0, Math.min(3, prev.numForwards + delta));
        if (delta > 0 && currentStarterCount >= 5) return prev;
        newLineup.numForwards = newNum;
        if (newNum < prev.numForwards) {
          newLineup.starters.forwards = prev.starters.forwards.slice(0, newNum);
        } else {
          newLineup.starters.forwards = [...prev.starters.forwards];
          while (newLineup.starters.forwards.length < newNum) {
            newLineup.starters.forwards.push(undefined);
          }
        }
      } else if (type === 'centers') {
        const newNum = Math.max(0, Math.min(2, prev.numCenters + delta));
        if (delta > 0 && currentStarterCount >= 5) return prev;
        newLineup.numCenters = newNum;
        if (newNum < prev.numCenters) {
          newLineup.starters.centers = prev.starters.centers.slice(0, newNum);
        } else {
          newLineup.starters.centers = [...prev.starters.centers];
          while (newLineup.starters.centers.length < newNum) {
            newLineup.starters.centers.push(undefined);
          }
        }
      } else if (type === 'bench') {
        const currentBenchSpots = prev.numBenchSpots ?? 10;
        const newNum = Math.max(0, Math.min(15, currentBenchSpots + delta));
        newLineup.numBenchSpots = newNum;
        // Adjust bench array size
        if (newNum < prev.bench.length) {
          newLineup.bench = prev.bench.slice(0, newNum);
        } else {
          newLineup.bench = [...prev.bench];
          while (newLineup.bench.length < newNum) {
            newLineup.bench.push(undefined);
          }
        }
      }

      return newLineup;
    });
  };

  const handleSelectPosition = (
    slotType: 'pg' | 'guard' | 'forward' | 'center' | 'bench',
    slotIndex: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerSelectModal({ visible: true, slotType, slotIndex });
  };

  const handlePlayerSelect = (playerId: string | undefined) => {
    if (!playerSelectModal) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLineup((prev) => {
      const newLineup = { ...prev, starters: { ...prev.starters } };

      if (playerSelectModal.slotType === 'pg') {
        newLineup.starters.pg = playerId;
      } else if (playerSelectModal.slotType === 'guard') {
        const newGuards = [...prev.starters.guards];
        newGuards[playerSelectModal.slotIndex] = playerId;
        newLineup.starters.guards = newGuards;
      } else if (playerSelectModal.slotType === 'forward') {
        const newForwards = [...prev.starters.forwards];
        newForwards[playerSelectModal.slotIndex] = playerId;
        newLineup.starters.forwards = newForwards;
      } else if (playerSelectModal.slotType === 'center') {
        const newCenters = [...prev.starters.centers];
        newCenters[playerSelectModal.slotIndex] = playerId;
        newLineup.starters.centers = newCenters;
      } else if (playerSelectModal.slotType === 'bench') {
        const newBench = [...prev.bench];
        newBench[playerSelectModal.slotIndex] = playerId;
        newLineup.bench = newBench;
      }

      return newLineup;
    });

    setPlayerSelectModal(null);
  };

  const handleClearAllLineup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLineup((prev) => ({
      ...prev,
      starters: {
        pg: undefined,
        guards: prev.starters.guards.map(() => undefined),
        forwards: prev.starters.forwards.map(() => undefined),
        centers: prev.starters.centers.map(() => undefined),
      },
      bench: prev.bench.map(() => undefined),
    }));
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(lineup);
  };

  const handleClose = () => {
    setLineup(initialLineup ?? createEmptyLineup());
    onClose();
  };

  const getPositionLabel = (slotType: string): PositionType => {
    if (slotType === 'pg') return 'pg';
    if (slotType === 'guard') return 'g';
    if (slotType === 'forward') return 'f';
    if (slotType === 'center') return 'c';
    return 'bench';
  };

  // Count filled bench spots (only count within the configured number of bench spots)
  const filledBenchCount = lineup.bench.slice(0, lineup.numBenchSpots ?? 10).filter(Boolean).length;

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
            <Text className="text-white text-lg font-semibold">Set Lineup</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleClearAllLineup}
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
            {/* Starting 5 Configuration */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4">
              <View className="bg-emerald-500/20 rounded-xl p-3 mb-4 border border-emerald-500/30">
                <Text className="text-emerald-400 text-sm font-medium text-center">
                  Starting 5: {currentStarterCount}/5 positions configured
                  {remainingSlots > 0 && ` (${remainingSlots} remaining)`}
                </Text>
              </View>
            </Animated.View>

            {/* Point Guard Section */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-2">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Point Guard</Text>
                <Pressable
                  onPress={() => handleConfigChange('pg', 0)}
                  className={cn(
                    'px-4 py-2 rounded-lg',
                    lineup.hasPG ? 'bg-emerald-500/30' : 'bg-slate-800'
                  )}
                >
                  <Text className={lineup.hasPG ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                    {lineup.hasPG ? 'Enabled' : 'Disabled'}
                  </Text>
                </Pressable>
              </View>

              {lineup.hasPG && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="items-center">
                    <PositionSlot
                      position="pg"
                      playerId={lineup.starters.pg}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('pg', 0)}
                      label="PG"
                    />
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Guards Section */}
            <Animated.View entering={FadeIn.delay(150)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Guards (G)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('guards', -1)}
                    className="p-2"
                    disabled={lineup.numGuards <= 0}
                  >
                    <Minus
                      size={20}
                      color={lineup.numGuards <= 0 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numGuards}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('guards', 1)}
                    className="p-2"
                    disabled={lineup.numGuards >= 3 || currentStarterCount >= 5}
                  >
                    <Plus
                      size={20}
                      color={lineup.numGuards >= 3 || currentStarterCount >= 5 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>

              {lineup.numGuards > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row justify-around">
                    {lineup.starters.guards.slice(0, lineup.numGuards).map((playerId, index) => (
                      <PositionSlot
                        key={`guard-${index}`}
                        position="g"
                        playerId={playerId}
                        players={availablePlayers}
                        onSelect={() => handleSelectPosition('guard', index)}
                        label={`G${index + 1}`}
                      />
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Centers Section */}
            <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Centers (C)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('centers', -1)}
                    className="p-2"
                    disabled={lineup.numCenters <= 0}
                  >
                    <Minus
                      size={20}
                      color={lineup.numCenters <= 0 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numCenters}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('centers', 1)}
                    className="p-2"
                    disabled={lineup.numCenters >= 2 || currentStarterCount >= 5}
                  >
                    <Plus
                      size={20}
                      color={lineup.numCenters >= 2 || currentStarterCount >= 5 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>

              {lineup.numCenters > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row justify-around">
                    {lineup.starters.centers.slice(0, lineup.numCenters).map((playerId, index) => (
                      <PositionSlot
                        key={`center-${index}`}
                        position="c"
                        playerId={playerId}
                        players={availablePlayers}
                        onSelect={() => handleSelectPosition('center', index)}
                        label={`C${index + 1}`}
                      />
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Forwards Section */}
            <Animated.View entering={FadeIn.delay(250)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Forwards (F)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('forwards', -1)}
                    className="p-2"
                    disabled={lineup.numForwards <= 0}
                  >
                    <Minus
                      size={20}
                      color={lineup.numForwards <= 0 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numForwards}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('forwards', 1)}
                    className="p-2"
                    disabled={lineup.numForwards >= 3 || currentStarterCount >= 5}
                  >
                    <Plus
                      size={20}
                      color={lineup.numForwards >= 3 || currentStarterCount >= 5 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>

              {lineup.numForwards > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row justify-around">
                    {lineup.starters.forwards.slice(0, lineup.numForwards).map((playerId, index) => (
                      <PositionSlot
                        key={`forward-${index}`}
                        position="f"
                        playerId={playerId}
                        players={availablePlayers}
                        onSelect={() => handleSelectPosition('forward', index)}
                        label={`F${index + 1}`}
                      />
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Bench Section */}
            <Animated.View entering={FadeIn.delay(300)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Bench</Text>
                <View className="flex-row items-center">
                  <Text className="text-slate-400 text-sm mr-3">{filledBenchCount}/{lineup.numBenchSpots ?? 10}</Text>
                  <View className="flex-row items-center bg-slate-800 rounded-lg">
                    <Pressable
                      onPress={() => handleConfigChange('bench', -1)}
                      className="p-2"
                      disabled={(lineup.numBenchSpots ?? 10) <= 0}
                    >
                      <Minus
                        size={20}
                        color={(lineup.numBenchSpots ?? 10) <= 0 ? '#475569' : '#10b981'}
                      />
                    </Pressable>
                    <Text className="text-white font-bold px-3">{lineup.numBenchSpots ?? 10}</Text>
                    <Pressable
                      onPress={() => handleConfigChange('bench', 1)}
                      className="p-2"
                      disabled={(lineup.numBenchSpots ?? 10) >= 15}
                    >
                      <Plus
                        size={20}
                        color={(lineup.numBenchSpots ?? 10) >= 15 ? '#475569' : '#10b981'}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              {(lineup.numBenchSpots ?? 10) > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row flex-wrap justify-start">
                    {lineup.bench.slice(0, lineup.numBenchSpots ?? 10).map((playerId, index) => (
                      <View key={`bench-${index}`} className="w-1/5 items-center mb-4">
                        <PositionSlot
                          position="bench"
                          playerId={playerId}
                          players={availablePlayers}
                          onSelect={() => handleSelectPosition('bench', index)}
                          label={`#${index + 1}`}
                        />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>

      {/* Player Selection Modal */}
      <Modal
        visible={playerSelectModal?.visible ?? false}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPlayerSelectModal(null)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setPlayerSelectModal(null)} className="p-1">
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">
                Select {playerSelectModal?.slotType === 'pg' ? 'Point Guard' :
                  playerSelectModal?.slotType === 'guard' ? 'Guard' :
                  playerSelectModal?.slotType === 'forward' ? 'Forward' :
                  playerSelectModal?.slotType === 'center' ? 'Center' : 'Bench Player'}
              </Text>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              {/* Clear selection option */}
              <Pressable
                onPress={() => handlePlayerSelect(undefined)}
                className="flex-row items-center p-4 rounded-xl mb-2 bg-slate-800/60 border border-slate-700/50"
              >
                <View className="w-12 h-12 rounded-full bg-slate-700 items-center justify-center">
                  <X size={20} color="#94a3b8" />
                </View>
                <Text className="text-slate-400 ml-4 font-medium">Clear Position</Text>
              </Pressable>

              {playerSelectModal &&
                getPlayersForPosition(getPositionLabel(playerSelectModal.slotType)).map((player, index) => {
                  const isAssigned = assignedPlayerIds.has(player.id);
                  const positionName = SPORT_POSITION_NAMES.basketball[player.position] || player.position;

                  return (
                    <Animated.View
                      key={player.id}
                      entering={FadeInDown.delay(index * 30)}
                    >
                      <Pressable
                        onPress={() => handlePlayerSelect(player.id)}
                        className={cn(
                          'flex-row items-center p-4 rounded-xl mb-2 border',
                          isAssigned
                            ? 'bg-slate-800/40 border-slate-700/30'
                            : 'bg-slate-800/60 border-slate-700/50'
                        )}
                      >
                        <PlayerAvatar player={player} size={48} />
                        <View className="flex-1 ml-4">
                          <Text
                            className={cn(
                              'font-semibold',
                              isAssigned ? 'text-slate-500' : 'text-white'
                            )}
                          >
                            {getPlayerName(player)}
                          </Text>
                          <Text className="text-slate-400 text-sm">
                            #{player.number} · {positionName}
                          </Text>
                        </View>
                        {isAssigned && (
                          <View className="bg-slate-700 px-2 py-1 rounded">
                            <Text className="text-slate-400 text-xs">In Lineup</Text>
                          </View>
                        )}
                      </Pressable>
                    </Animated.View>
                  );
                })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </Modal>
  );
}

// Helper function to check if a basketball lineup has any assigned players
export function hasAssignedBasketballPlayers(lineup: BasketballLineup | undefined): boolean {
  if (!lineup) return false;

  if (lineup.starters.pg) return true;
  if (lineup.starters.guards.some(Boolean)) return true;
  if (lineup.starters.forwards.some(Boolean)) return true;
  if (lineup.starters.centers.some(Boolean)) return true;
  if (lineup.bench.some(Boolean)) return true;

  return false;
}
