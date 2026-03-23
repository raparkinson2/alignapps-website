import { View, Text, Pressable, ScrollView, Modal, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { Image } from 'expo-image';
import { X, Plus, Minus, Check, User, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import {
  Player,
  HockeyLineup,
  HockeyForwardLine,
  HockeyDefenseLine,
  HockeyGoalieLine,
  SPORT_POSITION_NAMES,
  getPlayerName,
  getPlayerInitials,
} from '@/lib/store';
import { PlayerAvatar } from './PlayerAvatar';

interface LineupEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lineup: HockeyLineup) => void;
  initialLineup?: HockeyLineup;
  availablePlayers: Player[];
}

type PositionType = 'lw' | 'c' | 'rw' | 'ld' | 'rd' | 'g';

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
          player ? 'border-cyan-500 bg-slate-700' : 'border-slate-600 border-dashed bg-slate-800/50'
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
          {player.firstName}
        </Text>
      )}
    </Pressable>
  );
}

const createEmptyLineup = (): HockeyLineup => ({
  forwardLines: [{ lw: undefined, c: undefined, rw: undefined }],
  defenseLines: [{ ld: undefined, rd: undefined }],
  goalieLines: [{ g: undefined }],
  numForwardLines: 1,
  numDefenseLines: 1,
  numGoalieLines: 1,
});

export function LineupEditor({
  visible,
  onClose,
  onSave,
  initialLineup,
  availablePlayers,
}: LineupEditorProps) {
  const [lineup, setLineup] = useState<HockeyLineup>(initialLineup ?? createEmptyLineup());
  const [playerSelectModal, setPlayerSelectModal] = useState<{
    visible: boolean;
    lineType: 'forward' | 'defense' | 'goalie';
    lineIndex: number;
    position: PositionType;
  } | null>(null);

  // Get all currently assigned player IDs
  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    lineup.forwardLines.forEach((line) => {
      if (line.lw) ids.add(line.lw);
      if (line.c) ids.add(line.c);
      if (line.rw) ids.add(line.rw);
    });
    lineup.defenseLines.forEach((line) => {
      if (line.ld) ids.add(line.ld);
      if (line.rd) ids.add(line.rd);
    });
    lineup.goalieLines.forEach((line) => {
      if (line.g) ids.add(line.g);
    });
    return ids;
  }, [lineup]);

  // Filter players by position preference
  const getPlayersForPosition = (position: PositionType) => {
    const positionMap: Record<PositionType, string[]> = {
      lw: ['LW', 'C', 'RW'],
      c: ['C', 'LW', 'RW'],
      rw: ['RW', 'C', 'LW'],
      ld: ['LD', 'RD'],
      rd: ['RD', 'LD'],
      g: ['G'],
    };

    const preferredPositions = positionMap[position];

    // Sort players: preferred positions first, then unassigned first
    return [...availablePlayers].sort((a, b) => {
      const aPreferred = preferredPositions.includes(a.position);
      const bPreferred = preferredPositions.includes(b.position);
      const aAssigned = assignedPlayerIds.has(a.id);
      const bAssigned = assignedPlayerIds.has(b.id);

      // Unassigned preferred players first
      if (!aAssigned && !bAssigned) {
        if (aPreferred && !bPreferred) return -1;
        if (!aPreferred && bPreferred) return 1;
      }
      // Then unassigned non-preferred
      if (!aAssigned && bAssigned) return -1;
      if (aAssigned && !bAssigned) return 1;
      // Then assigned preferred
      if (aPreferred && !bPreferred) return -1;
      if (!aPreferred && bPreferred) return 1;
      return 0;
    });
  };

  const handleNumLinesChange = (
    type: 'forward' | 'defense' | 'goalie',
    delta: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => {
      const newLineup = { ...prev };

      if (type === 'forward') {
        const newNum = Math.max(1, Math.min(4, prev.numForwardLines + delta));
        newLineup.numForwardLines = newNum;
        // Add or remove lines
        while (newLineup.forwardLines.length < newNum) {
          newLineup.forwardLines = [...newLineup.forwardLines, { lw: undefined, c: undefined, rw: undefined }];
        }
        if (newLineup.forwardLines.length > newNum) {
          newLineup.forwardLines = newLineup.forwardLines.slice(0, newNum);
        }
      } else if (type === 'defense') {
        const newNum = Math.max(1, Math.min(4, prev.numDefenseLines + delta));
        newLineup.numDefenseLines = newNum;
        while (newLineup.defenseLines.length < newNum) {
          newLineup.defenseLines = [...newLineup.defenseLines, { ld: undefined, rd: undefined }];
        }
        if (newLineup.defenseLines.length > newNum) {
          newLineup.defenseLines = newLineup.defenseLines.slice(0, newNum);
        }
      } else {
        const newNum = Math.max(1, Math.min(2, prev.numGoalieLines + delta));
        newLineup.numGoalieLines = newNum;
        while (newLineup.goalieLines.length < newNum) {
          newLineup.goalieLines = [...newLineup.goalieLines, { g: undefined }];
        }
        if (newLineup.goalieLines.length > newNum) {
          newLineup.goalieLines = newLineup.goalieLines.slice(0, newNum);
        }
      }

      return newLineup;
    });
  };

  const handleSelectPosition = (
    lineType: 'forward' | 'defense' | 'goalie',
    lineIndex: number,
    position: PositionType
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerSelectModal({ visible: true, lineType, lineIndex, position });
  };

  const handlePlayerSelect = (playerId: string | undefined) => {
    if (!playerSelectModal) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLineup((prev) => {
      const newLineup = { ...prev };

      if (playerSelectModal.lineType === 'forward') {
        const newLines = [...prev.forwardLines];
        newLines[playerSelectModal.lineIndex] = {
          ...newLines[playerSelectModal.lineIndex],
          [playerSelectModal.position]: playerId,
        };
        newLineup.forwardLines = newLines;
      } else if (playerSelectModal.lineType === 'defense') {
        const newLines = [...prev.defenseLines];
        newLines[playerSelectModal.lineIndex] = {
          ...newLines[playerSelectModal.lineIndex],
          [playerSelectModal.position]: playerId,
        };
        newLineup.defenseLines = newLines;
      } else {
        const newLines = [...prev.goalieLines];
        newLines[playerSelectModal.lineIndex] = {
          ...newLines[playerSelectModal.lineIndex],
          [playerSelectModal.position]: playerId,
        };
        newLineup.goalieLines = newLines;
      }

      return newLineup;
    });

    setPlayerSelectModal(null);
  };

  const handleClearAllLines = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLineup((prev) => ({
      ...prev,
      forwardLines: prev.forwardLines.map(() => ({ lw: undefined, c: undefined, rw: undefined })),
      defenseLines: prev.defenseLines.map(() => ({ ld: undefined, rd: undefined })),
      goalieLines: prev.goalieLines.map(() => ({ g: undefined })),
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

  const getLineLabel = (type: 'forward' | 'defense' | 'goalie', index: number) => {
    const ordinals = ['1st', '2nd', '3rd', '4th'];
    if (type === 'forward') return `${ordinals[index]} Line`;
    if (type === 'defense') return `${ordinals[index]} Pair`;
    return index === 0 ? 'Starter' : 'Backup';
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
            <Text className="text-white text-lg font-semibold">Set Lines</Text>
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={handleClearAllLines}
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
                className="bg-cyan-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-slate-900 font-semibold">Save</Text>
              </Pressable>
            </View>
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Forward Lines Section */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-6">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Forward Lines</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleNumLinesChange('forward', -1)}
                    className="p-2"
                    disabled={lineup.numForwardLines <= 1}
                  >
                    <Minus
                      size={20}
                      color={lineup.numForwardLines <= 1 ? '#475569' : '#67e8f9'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numForwardLines}</Text>
                  <Pressable
                    onPress={() => handleNumLinesChange('forward', 1)}
                    className="p-2"
                    disabled={lineup.numForwardLines >= 4}
                  >
                    <Plus
                      size={20}
                      color={lineup.numForwardLines >= 4 ? '#475569' : '#67e8f9'}
                    />
                  </Pressable>
                </View>
              </View>

              {lineup.forwardLines.slice(0, lineup.numForwardLines).map((line, index) => (
                <Animated.View
                  key={`forward-${index}`}
                  entering={FadeInDown.delay(index * 50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <Text className="text-cyan-400 text-sm font-medium mb-4 text-center">
                    {getLineLabel('forward', index)}
                  </Text>
                  <View className="flex-row justify-around">
                    <PositionSlot
                      position="lw"
                      playerId={line.lw}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('forward', index, 'lw')}
                      label="LW"
                    />
                    <PositionSlot
                      position="c"
                      playerId={line.c}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('forward', index, 'c')}
                      label="C"
                    />
                    <PositionSlot
                      position="rw"
                      playerId={line.rw}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('forward', index, 'rw')}
                      label="RW"
                    />
                  </View>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Defense Lines Section */}
            <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Defense Pairs</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleNumLinesChange('defense', -1)}
                    className="p-2"
                    disabled={lineup.numDefenseLines <= 1}
                  >
                    <Minus
                      size={20}
                      color={lineup.numDefenseLines <= 1 ? '#475569' : '#67e8f9'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numDefenseLines}</Text>
                  <Pressable
                    onPress={() => handleNumLinesChange('defense', 1)}
                    className="p-2"
                    disabled={lineup.numDefenseLines >= 4}
                  >
                    <Plus
                      size={20}
                      color={lineup.numDefenseLines >= 4 ? '#475569' : '#67e8f9'}
                    />
                  </Pressable>
                </View>
              </View>

              {lineup.defenseLines.slice(0, lineup.numDefenseLines).map((line, index) => (
                <Animated.View
                  key={`defense-${index}`}
                  entering={FadeInDown.delay(index * 50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <Text className="text-cyan-400 text-sm font-medium mb-4 text-center">
                    {getLineLabel('defense', index)}
                  </Text>
                  <View className="flex-row justify-around px-8">
                    <PositionSlot
                      position="ld"
                      playerId={line.ld}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('defense', index, 'ld')}
                      label="LD"
                    />
                    <PositionSlot
                      position="rd"
                      playerId={line.rd}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('defense', index, 'rd')}
                      label="RD"
                    />
                  </View>
                </Animated.View>
              ))}
            </Animated.View>

            {/* Goalie Section */}
            <Animated.View entering={FadeIn.delay(300)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Goalies</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleNumLinesChange('goalie', -1)}
                    className="p-2"
                    disabled={lineup.numGoalieLines <= 1}
                  >
                    <Minus
                      size={20}
                      color={lineup.numGoalieLines <= 1 ? '#475569' : '#67e8f9'}
                    />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numGoalieLines}</Text>
                  <Pressable
                    onPress={() => handleNumLinesChange('goalie', 1)}
                    className="p-2"
                    disabled={lineup.numGoalieLines >= 2}
                  >
                    <Plus
                      size={20}
                      color={lineup.numGoalieLines >= 2 ? '#475569' : '#67e8f9'}
                    />
                  </Pressable>
                </View>
              </View>

              {lineup.goalieLines.slice(0, lineup.numGoalieLines).map((line, index) => (
                <Animated.View
                  key={`goalie-${index}`}
                  entering={FadeInDown.delay(index * 50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <Text className="text-cyan-400 text-sm font-medium mb-4 text-center">
                    {getLineLabel('goalie', index)}
                  </Text>
                  <View className="items-center">
                    <PositionSlot
                      position="g"
                      playerId={line.g}
                      players={availablePlayers}
                      onSelect={() => handleSelectPosition('goalie', index, 'g')}
                      label="G"
                    />
                  </View>
                </Animated.View>
              ))}
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
                Select {playerSelectModal?.position.toUpperCase()}
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
                getPlayersForPosition(playerSelectModal.position).map((player, index) => {
                  const isAssigned = assignedPlayerIds.has(player.id);
                  const positionName = SPORT_POSITION_NAMES.hockey[player.position] || player.position;

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
