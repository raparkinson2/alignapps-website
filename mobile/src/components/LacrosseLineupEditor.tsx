import { View, Text, Pressable, ScrollView, Modal , Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { X, Plus, Minus, User, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import {
  Player,
  LacrosseLineup,
  getPlayerName,
} from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface LacrosseLineupEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lineup: LacrosseLineup) => void;
  initialLineup?: LacrosseLineup;
  availablePlayers: Player[];
}

type PositionType = 'goalie' | 'attacker' | 'midfielder' | 'defender';

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
          'w-14 h-14 rounded-full border-2 items-center justify-center overflow-hidden',
          player ? 'border-emerald-500 bg-slate-700' : 'border-slate-600 border-dashed bg-slate-800/50'
        )}
      >
        {player ? (
          <PlayerAvatar player={player} size={52} />
        ) : (
          <User size={20} color="#64748b" />
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

const createEmptyLineup = (): LacrosseLineup => ({
  goalie: undefined,
  attackers: [undefined, undefined, undefined],
  midfielders: [undefined, undefined, undefined],
  defenders: [undefined, undefined, undefined],
  numAttackers: 3,
  numMidfielders: 3,
  numDefenders: 3,
});

export function LacrosseLineupEditor({
  visible,
  onClose,
  onSave,
  initialLineup,
  availablePlayers,
}: LacrosseLineupEditorProps) {
  const [lineup, setLineup] = useState<LacrosseLineup>(initialLineup ?? createEmptyLineup());
  const [playerSelectModal, setPlayerSelectModal] = useState<{
    visible: boolean;
    slotType: 'goalie' | 'attacker' | 'midfielder' | 'defender';
    slotIndex: number;
  } | null>(null);

  // Calculate total field players
  const totalFieldPlayers = useMemo(() => {
    return 1 + lineup.numAttackers + lineup.numMidfielders + lineup.numDefenders;
  }, [lineup.numAttackers, lineup.numMidfielders, lineup.numDefenders]);

  // Get all currently assigned player IDs
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (lineup.goalie) ids.add(lineup.goalie);
    lineup.attackers.forEach((id) => { if (id) ids.add(id); });
    lineup.midfielders.forEach((id) => { if (id) ids.add(id); });
    lineup.defenders.forEach((id) => { if (id) ids.add(id); });
    return ids;
  }, [lineup]);

  // Filter players by position preference
  const getPlayersForPosition = (position: PositionType) => {
    const positionMap: Record<PositionType, string[]> = {
      goalie: ['G'],
      attacker: ['A'],
      midfielder: ['M'],
      defender: ['D'],
    };

    const preferredPositions = positionMap[position];

    return [...availablePlayers].sort((a, b) => {
      const aPreferred = preferredPositions.includes(a.position);
      const bPreferred = preferredPositions.includes(b.position);
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
    type: 'attackers' | 'midfielders' | 'defenders',
    delta: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => {
      const newLineup = { ...prev };

      if (type === 'attackers') {
        const newNum = Math.max(3, Math.min(4, prev.numAttackers + delta));
        newLineup.numAttackers = newNum;
        if (newNum < prev.numAttackers) {
          newLineup.attackers = prev.attackers.slice(0, newNum);
        } else {
          newLineup.attackers = [...prev.attackers];
          while (newLineup.attackers.length < newNum) {
            newLineup.attackers.push(undefined);
          }
        }
      } else if (type === 'midfielders') {
        const newNum = Math.max(3, Math.min(3, prev.numMidfielders + delta));
        newLineup.numMidfielders = newNum;
        if (newNum < prev.numMidfielders) {
          newLineup.midfielders = prev.midfielders.slice(0, newNum);
        } else {
          newLineup.midfielders = [...prev.midfielders];
          while (newLineup.midfielders.length < newNum) {
            newLineup.midfielders.push(undefined);
          }
        }
      } else if (type === 'defenders') {
        const newNum = Math.max(3, Math.min(4, prev.numDefenders + delta));
        newLineup.numDefenders = newNum;
        if (newNum < prev.numDefenders) {
          newLineup.defenders = prev.defenders.slice(0, newNum);
        } else {
          newLineup.defenders = [...prev.defenders];
          while (newLineup.defenders.length < newNum) {
            newLineup.defenders.push(undefined);
          }
        }
      }

      return newLineup;
    });
  };

  const handleSelectPosition = (
    slotType: 'goalie' | 'attacker' | 'midfielder' | 'defender',
    slotIndex: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerSelectModal({ visible: true, slotType, slotIndex });
  };

  const handlePlayerSelect = (playerId: string | undefined) => {
    if (!playerSelectModal) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLineup((prev) => {
      const newLineup = { ...prev };

      if (playerSelectModal.slotType === 'goalie') {
        newLineup.goalie = playerId;
      } else if (playerSelectModal.slotType === 'attacker') {
        const newAttackers = [...prev.attackers];
        newAttackers[playerSelectModal.slotIndex] = playerId;
        newLineup.attackers = newAttackers;
      } else if (playerSelectModal.slotType === 'midfielder') {
        const newMidfielders = [...prev.midfielders];
        newMidfielders[playerSelectModal.slotIndex] = playerId;
        newLineup.midfielders = newMidfielders;
      } else if (playerSelectModal.slotType === 'defender') {
        const newDefenders = [...prev.defenders];
        newDefenders[playerSelectModal.slotIndex] = playerId;
        newLineup.defenders = newDefenders;
      }

      return newLineup;
    });

    setPlayerSelectModal(null);
  };

  const handleClearAllLineup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLineup((prev) => ({
      ...prev,
      goalie: undefined,
      attackers: prev.attackers.map(() => undefined),
      midfielders: prev.midfielders.map(() => undefined),
      defenders: prev.defenders.map(() => undefined),
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
    if (slotType === 'goalie') return 'goalie';
    if (slotType === 'attacker') return 'attacker';
    if (slotType === 'midfielder') return 'midfielder';
    return 'defender';
  };

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
            {/* Total Players Info */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4">
              <View className="bg-emerald-500/20 rounded-xl p-3 mb-4 border border-emerald-500/30">
                <Text className="text-emerald-400 text-sm font-medium text-center">
                  Total Field Players: {totalFieldPlayers} (1 G + {lineup.numAttackers} A + {lineup.numMidfielders} M + {lineup.numDefenders} D)
                </Text>
              </View>
            </Animated.View>

            {/* Attackers Section */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-2">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Attackers (A)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('attackers', -1)}
                    className="p-2"
                    disabled={lineup.numAttackers <= 3}
                  >
                    <Minus
                      size={20}
                      color={lineup.numAttackers <= 3 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numAttackers}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('attackers', 1)}
                    className="p-2"
                    disabled={lineup.numAttackers >= 4}
                  >
                    <Plus
                      size={20}
                      color={lineup.numAttackers >= 4 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>

              <View className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row justify-around flex-wrap gap-y-3">
                  {lineup.attackers.slice(0, lineup.numAttackers).map((playerId, index) => (
                    <PositionSlot
                      key={`attacker-${index}`}
                      position="attacker"
                      playerId={playerId}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('attacker', index)}
                      label={`A${index + 1}`}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Midfielders Section */}
            <Animated.View entering={FadeIn.delay(150)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Midfielders (M)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('midfielders', -1)}
                    className="p-2"
                    disabled={lineup.numMidfielders <= 3}
                  >
                    <Minus
                      size={20}
                      color={lineup.numMidfielders <= 3 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numMidfielders}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('midfielders', 1)}
                    className="p-2"
                    disabled={lineup.numMidfielders >= 3}
                  >
                    <Plus
                      size={20}
                      color={lineup.numMidfielders >= 3 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>

              <View className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row justify-around flex-wrap gap-y-3">
                  {lineup.midfielders.slice(0, lineup.numMidfielders).map((playerId, index) => (
                    <PositionSlot
                      key={`midfielder-${index}`}
                      position="midfielder"
                      playerId={playerId}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('midfielder', index)}
                      label={`M${index + 1}`}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Defenders Section */}
            <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Defenders (D)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('defenders', -1)}
                    className="p-2"
                    disabled={lineup.numDefenders <= 3}
                  >
                    <Minus
                      size={20}
                      color={lineup.numDefenders <= 3 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numDefenders}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('defenders', 1)}
                    className="p-2"
                    disabled={lineup.numDefenders >= 4}
                  >
                    <Plus
                      size={20}
                      color={lineup.numDefenders >= 4 ? '#475569' : '#10b981'}
                    />
                  </Pressable>
                </View>
              </View>

              <View className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row justify-around flex-wrap gap-y-3">
                  {lineup.defenders.slice(0, lineup.numDefenders).map((playerId, index) => (
                    <PositionSlot
                      key={`defender-${index}`}
                      position="defender"
                      playerId={playerId}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('defender', index)}
                      label={`D${index + 1}`}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>

            {/* Goalie Section */}
            <Animated.View entering={FadeIn.delay(300)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4">Goalie</Text>
              <View className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="items-center">
                  <PositionSlot
                    position="goalie"
                    playerId={lineup.goalie}
                    players={availablePlayers}
                    onSelect={() => handleSelectPosition('goalie', 0)}
                    label="G"
                  />
                </View>
              </View>
            </Animated.View>

            {/* Tips */}
            <Animated.View entering={FadeIn.delay(350)} className="px-5 pt-4">
              <View className="bg-slate-800/40 rounded-xl p-4">
                <Text className="text-slate-400 text-sm text-center">
                  Boys: 3A, 3M, 3D | Girls: 4A, 3M, 4D
                </Text>
                <Text className="text-slate-500 text-xs text-center mt-1">
                  Use +/- to adjust the number of positions
                </Text>
              </View>
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
                Select {playerSelectModal?.slotType === 'goalie' ? 'Goalie' :
                  playerSelectModal?.slotType === 'attacker' ? 'Attacker' :
                  playerSelectModal?.slotType === 'midfielder' ? 'Midfielder' : 'Defender'}
              </Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1">
              {/* Clear option */}
              <Pressable
                onPress={() => handlePlayerSelect(undefined)}
                className="flex-row items-center px-5 py-4 border-b border-slate-800"
              >
                <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center">
                  <X size={20} color="#ef4444" />
                </View>
                <Text className="text-red-400 font-medium ml-4">Clear Position</Text>
              </Pressable>

              {/* Players list */}
              {playerSelectModal && getPlayersForPosition(getPositionLabel(playerSelectModal.slotType)).map((player) => {
                const isAssigned = assignedPlayerIds.has(player.id);
                return (
                  <Pressable
                    key={player.id}
                    onPress={() => handlePlayerSelect(player.id)}
                    className={cn(
                      'flex-row items-center px-5 py-3 border-b border-slate-800',
                      isAssigned && 'opacity-50'
                    )}
                  >
                    <PlayerAvatar player={player} size={48} />
                    <View className="ml-4 flex-1">
                      <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                      <Text className="text-slate-400 text-sm">#{player.number} - {player.position}</Text>
                    </View>
                    {isAssigned && (
                      <Text className="text-slate-500 text-xs">Assigned</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </Modal>
  );
}

// Helper function to check if a lineup has any assigned players
export function hasAssignedLacrossePlayers(lineup: LacrosseLineup | undefined): boolean {
  if (!lineup) return false;

  if (lineup.goalie) return true;
  if (lineup.attackers.some(Boolean)) return true;
  if (lineup.midfielders.some(Boolean)) return true;
  if (lineup.defenders.some(Boolean)) return true;

  return false;
}
