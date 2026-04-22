import { View, Text, Pressable, ScrollView, Modal, Platform } from 'react-native';
import { useState, useMemo } from 'react';
import { X, Plus, Minus, User, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { cn } from '@/lib/cn';
import { Player, SoccerLineup, getPlayerName } from '@/lib/store';
import {
  createEmptySoccerLineup,
  formatSoccerFormation,
  hasAssignedSoccerPlayers as hasAssigned,
} from '@/lib/soccer-lineup-adapter';
import { PlayerAvatar } from './PlayerAvatar';

interface SoccerLineupEditorProps {
  visible: boolean;
  onClose: () => void;
  onSave: (lineup: SoccerLineup) => void;
  initialLineup?: SoccerLineup;
  players: Player[];
}

type PositionType = 'gk' | 'd' | 'dm' | 'am' | 'f' | 'bench';
type SlotType = 'gk' | 'defender' | 'defMid' | 'attMid' | 'forward' | 'bench';

interface PositionSlotProps {
  playerId?: string;
  players: Player[];
  onSelect: () => void;
  label: string;
}

function PositionSlot({ playerId, players, onSelect, label }: PositionSlotProps) {
  const player = playerId ? players.find((p) => p.id === playerId) : undefined;

  return (
    <Pressable onPress={onSelect} className="items-center">
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

// Re-export for call sites (GameCard, LineupViewerModals, etc.)
export { hasAssigned as hasAssignedSoccerPlayers };

export function SoccerLineupEditor({
  visible,
  onClose,
  onSave,
  initialLineup,
  players,
}: SoccerLineupEditorProps) {
  const [lineup, setLineup] = useState<SoccerLineup>(initialLineup ?? createEmptySoccerLineup());
  const [playerSelectModal, setPlayerSelectModal] = useState<{
    visible: boolean;
    slotType: SlotType;
    slotIndex: number;
  } | null>(null);

  // Outfield total (defenders + defMids + attMids + forwards). Must not exceed 10.
  const outfieldCount = useMemo(
    () =>
      lineup.numDefenders +
      lineup.numDefMidfielders +
      lineup.numAttMidfielders +
      lineup.numForwards,
    [lineup.numDefenders, lineup.numDefMidfielders, lineup.numAttMidfielders, lineup.numForwards]
  );

  const remainingOutfield = 10 - outfieldCount;

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    if (lineup.gk) ids.add(lineup.gk);
    lineup.defenders.forEach((id) => { if (id) ids.add(id); });
    lineup.defMidfielders.forEach((id) => { if (id) ids.add(id); });
    lineup.attMidfielders.forEach((id) => { if (id) ids.add(id); });
    lineup.forwards.forEach((id) => { if (id) ids.add(id); });
    lineup.bench.forEach((id) => { if (id) ids.add(id); });
    return ids;
  }, [lineup]);

  const getPlayersForPosition = (position: PositionType) => {
    const positionMap: Record<PositionType, string[]> = {
      gk: ['GK', 'G'],
      d: ['D', 'CB', 'LB', 'RB', 'DEF'],
      dm: ['M', 'CM', 'CDM', 'LM', 'RM', 'MID'],
      am: ['M', 'CAM', 'AM', 'LM', 'RM', 'MID'],
      f: ['F', 'ST', 'CF', 'LW', 'RW', 'FWD'],
      bench: [],
    };
    const preferred = positionMap[position];

    return [...players].filter((p) => p.status === 'active').sort((a, b) => {
      const aPref = position === 'bench' || preferred.includes(a.position);
      const bPref = position === 'bench' || preferred.includes(b.position);
      const aAssigned = assignedPlayerIds.has(a.id);
      const bAssigned = assignedPlayerIds.has(b.id);

      if (!aAssigned && !bAssigned) {
        if (aPref && !bPref) return -1;
        if (!aPref && bPref) return 1;
      }
      if (!aAssigned && bAssigned) return -1;
      if (aAssigned && !bAssigned) return 1;
      return 0;
    });
  };

  const resizeArr = (arr: (string | undefined)[], newLen: number): (string | undefined)[] => {
    if (newLen <= arr.length) return arr.slice(0, newLen);
    const next = [...arr];
    while (next.length < newLen) next.push(undefined);
    return next;
  };

  const handleConfigChange = (
    type: 'defenders' | 'defMids' | 'attMids' | 'forwards' | 'bench',
    delta: number
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLineup((prev) => {
      const next: SoccerLineup = { ...prev };

      if (type === 'defenders') {
        const proposed = Math.max(3, Math.min(5, prev.numDefenders + delta));
        if (delta > 0 && outfieldCount >= 10) return prev;
        next.numDefenders = proposed;
        next.defenders = resizeArr(prev.defenders, proposed);
      } else if (type === 'defMids') {
        const proposed = Math.max(0, Math.min(5, prev.numDefMidfielders + delta));
        if (delta > 0 && outfieldCount >= 10) return prev;
        next.numDefMidfielders = proposed;
        next.defMidfielders = resizeArr(prev.defMidfielders, proposed);
      } else if (type === 'attMids') {
        const proposed = Math.max(0, Math.min(5, prev.numAttMidfielders + delta));
        if (delta > 0 && outfieldCount >= 10) return prev;
        next.numAttMidfielders = proposed;
        next.attMidfielders = resizeArr(prev.attMidfielders, proposed);
      } else if (type === 'forwards') {
        const proposed = Math.max(1, Math.min(3, prev.numForwards + delta));
        if (delta > 0 && outfieldCount >= 10) return prev;
        next.numForwards = proposed;
        next.forwards = resizeArr(prev.forwards, proposed);
      } else if (type === 'bench') {
        const proposed = Math.max(0, Math.min(15, prev.numBenchSpots + delta));
        next.numBenchSpots = proposed;
        next.bench = resizeArr(prev.bench, proposed);
      }

      return next;
    });
  };

  const handleSelectPosition = (slotType: SlotType, slotIndex: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayerSelectModal({ visible: true, slotType, slotIndex });
  };

  const handlePlayerSelect = (playerId: string | undefined) => {
    if (!playerSelectModal) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setLineup((prev) => {
      const next: SoccerLineup = { ...prev };
      const { slotType, slotIndex } = playerSelectModal;

      if (slotType === 'gk') {
        next.gk = playerId;
      } else if (slotType === 'defender') {
        const arr = [...prev.defenders];
        arr[slotIndex] = playerId;
        next.defenders = arr;
      } else if (slotType === 'defMid') {
        const arr = [...prev.defMidfielders];
        arr[slotIndex] = playerId;
        next.defMidfielders = arr;
      } else if (slotType === 'attMid') {
        const arr = [...prev.attMidfielders];
        arr[slotIndex] = playerId;
        next.attMidfielders = arr;
      } else if (slotType === 'forward') {
        const arr = [...prev.forwards];
        arr[slotIndex] = playerId;
        next.forwards = arr;
      } else if (slotType === 'bench') {
        const arr = [...prev.bench];
        arr[slotIndex] = playerId;
        next.bench = arr;
      }
      return next;
    });

    setPlayerSelectModal(null);
  };

  const handleClearAllLineup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLineup((prev) => ({
      ...prev,
      gk: undefined,
      defenders: prev.defenders.map(() => undefined),
      defMidfielders: prev.defMidfielders.map(() => undefined),
      attMidfielders: prev.attMidfielders.map(() => undefined),
      forwards: prev.forwards.map(() => undefined),
      bench: prev.bench.map(() => undefined),
    }));
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(lineup);
  };

  const handleClose = () => {
    setLineup(initialLineup ?? createEmptySoccerLineup());
    onClose();
  };

  const getPositionType = (slotType: SlotType): PositionType => {
    if (slotType === 'gk') return 'gk';
    if (slotType === 'defender') return 'd';
    if (slotType === 'defMid') return 'dm';
    if (slotType === 'attMid') return 'am';
    if (slotType === 'forward') return 'f';
    return 'bench';
  };

  const slotTitle: Record<SlotType, string> = {
    gk: 'Goalkeeper',
    defender: 'Defender',
    defMid: 'Defensive Midfielder',
    attMid: 'Attacking Midfielder',
    forward: 'Forward',
    bench: 'Bench Player',
  };

  const formation = formatSoccerFormation(lineup);
  const filledBenchCount = lineup.bench.slice(0, lineup.numBenchSpots).filter(Boolean).length;

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
            {/* Formation banner */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4">
              <View className="bg-emerald-500/20 rounded-xl p-3 mb-4 border border-emerald-500/30">
                <Text className="text-emerald-400 text-sm font-medium text-center">
                  Starting XI ({formation}): {outfieldCount + 1}/11 positions
                  {remainingOutfield > 0 && ` (${remainingOutfield} outfield remaining)`}
                </Text>
              </View>
            </Animated.View>

            {/* Goalkeeper */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-2">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Goalkeeper</Text>
                <View className="px-4 py-2 rounded-lg bg-emerald-500/30">
                  <Text className="text-emerald-400 font-medium">Required</Text>
                </View>
              </View>
              <View className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="items-center">
                  <PositionSlot
                    playerId={lineup.gk}
                    players={players}
                    onSelect={() => handleSelectPosition('gk', 0)}
                    label="GK"
                  />
                </View>
              </View>
            </Animated.View>

            {/* Defenders */}
            <Animated.View entering={FadeIn.delay(150)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Defenders (D)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('defenders', -1)}
                    className="p-2"
                    disabled={lineup.numDefenders <= 3}
                  >
                    <Minus size={20} color={lineup.numDefenders <= 3 ? '#475569' : '#10b981'} />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numDefenders}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('defenders', 1)}
                    className="p-2"
                    disabled={lineup.numDefenders >= 5 || outfieldCount >= 10}
                  >
                    <Plus size={20} color={lineup.numDefenders >= 5 || outfieldCount >= 10 ? '#475569' : '#10b981'} />
                  </Pressable>
                </View>
              </View>
              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
              >
                <View className="flex-row flex-wrap justify-around">
                  {lineup.defenders.slice(0, lineup.numDefenders).map((pid, index) => (
                    <View key={`d-${index}`} className="mb-2">
                      <PositionSlot
                        playerId={pid}
                        players={players}
                        onSelect={() => handleSelectPosition('defender', index)}
                        label={`D${index + 1}`}
                      />
                    </View>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>

            {/* Defensive Midfielders */}
            <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Def. Midfielders (DM)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('defMids', -1)}
                    className="p-2"
                    disabled={lineup.numDefMidfielders <= 0}
                  >
                    <Minus size={20} color={lineup.numDefMidfielders <= 0 ? '#475569' : '#10b981'} />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numDefMidfielders}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('defMids', 1)}
                    className="p-2"
                    disabled={lineup.numDefMidfielders >= 5 || outfieldCount >= 10}
                  >
                    <Plus size={20} color={lineup.numDefMidfielders >= 5 || outfieldCount >= 10 ? '#475569' : '#10b981'} />
                  </Pressable>
                </View>
              </View>
              {lineup.numDefMidfielders > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row flex-wrap justify-around">
                    {lineup.defMidfielders.slice(0, lineup.numDefMidfielders).map((pid, index) => (
                      <View key={`dm-${index}`} className="mb-2">
                        <PositionSlot
                          playerId={pid}
                          players={players}
                          onSelect={() => handleSelectPosition('defMid', index)}
                          label={`DM${index + 1}`}
                        />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Attacking Midfielders */}
            <Animated.View entering={FadeIn.delay(250)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Att. Midfielders (AM)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('attMids', -1)}
                    className="p-2"
                    disabled={lineup.numAttMidfielders <= 0}
                  >
                    <Minus size={20} color={lineup.numAttMidfielders <= 0 ? '#475569' : '#10b981'} />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numAttMidfielders}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('attMids', 1)}
                    className="p-2"
                    disabled={lineup.numAttMidfielders >= 5 || outfieldCount >= 10}
                  >
                    <Plus size={20} color={lineup.numAttMidfielders >= 5 || outfieldCount >= 10 ? '#475569' : '#10b981'} />
                  </Pressable>
                </View>
              </View>
              {lineup.numAttMidfielders > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row flex-wrap justify-around">
                    {lineup.attMidfielders.slice(0, lineup.numAttMidfielders).map((pid, index) => (
                      <View key={`am-${index}`} className="mb-2">
                        <PositionSlot
                          playerId={pid}
                          players={players}
                          onSelect={() => handleSelectPosition('attMid', index)}
                          label={`AM${index + 1}`}
                        />
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}
            </Animated.View>

            {/* Forwards */}
            <Animated.View entering={FadeIn.delay(300)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Forwards (F)</Text>
                <View className="flex-row items-center bg-slate-800 rounded-lg">
                  <Pressable
                    onPress={() => handleConfigChange('forwards', -1)}
                    className="p-2"
                    disabled={lineup.numForwards <= 1}
                  >
                    <Minus size={20} color={lineup.numForwards <= 1 ? '#475569' : '#10b981'} />
                  </Pressable>
                  <Text className="text-white font-bold px-3">{lineup.numForwards}</Text>
                  <Pressable
                    onPress={() => handleConfigChange('forwards', 1)}
                    className="p-2"
                    disabled={lineup.numForwards >= 3 || outfieldCount >= 10}
                  >
                    <Plus size={20} color={lineup.numForwards >= 3 || outfieldCount >= 10 ? '#475569' : '#10b981'} />
                  </Pressable>
                </View>
              </View>
              <Animated.View
                entering={FadeInDown.delay(50)}
                className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
              >
                <View className="flex-row flex-wrap justify-around">
                  {lineup.forwards.slice(0, lineup.numForwards).map((pid, index) => (
                    <View key={`f-${index}`} className="mb-2">
                      <PositionSlot
                        playerId={pid}
                        players={players}
                        onSelect={() => handleSelectPosition('forward', index)}
                        label={`F${index + 1}`}
                      />
                    </View>
                  ))}
                </View>
              </Animated.View>
            </Animated.View>

            {/* Bench */}
            <Animated.View entering={FadeIn.delay(350)} className="px-5 pt-4">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-white text-lg font-semibold">Bench</Text>
                <View className="flex-row items-center">
                  <Text className="text-slate-400 text-sm mr-3">{filledBenchCount}/{lineup.numBenchSpots}</Text>
                  <View className="flex-row items-center bg-slate-800 rounded-lg">
                    <Pressable
                      onPress={() => handleConfigChange('bench', -1)}
                      className="p-2"
                      disabled={lineup.numBenchSpots <= 0}
                    >
                      <Minus size={20} color={lineup.numBenchSpots <= 0 ? '#475569' : '#10b981'} />
                    </Pressable>
                    <Text className="text-white font-bold px-3">{lineup.numBenchSpots}</Text>
                    <Pressable
                      onPress={() => handleConfigChange('bench', 1)}
                      className="p-2"
                      disabled={lineup.numBenchSpots >= 15}
                    >
                      <Plus size={20} color={lineup.numBenchSpots >= 15 ? '#475569' : '#10b981'} />
                    </Pressable>
                  </View>
                </View>
              </View>
              {lineup.numBenchSpots > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(50)}
                  className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                >
                  <View className="flex-row flex-wrap justify-start">
                    {lineup.bench.slice(0, lineup.numBenchSpots).map((pid, index) => (
                      <View key={`bench-${index}`} className="w-1/5 items-center mb-4">
                        <PositionSlot
                          playerId={pid}
                          players={players}
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
                Select {playerSelectModal ? slotTitle[playerSelectModal.slotType] : ''}
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
                getPlayersForPosition(getPositionType(playerSelectModal.slotType)).map((player, index) => {
                  const isAssigned = assignedPlayerIds.has(player.id);
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
                            #{player.number} · {player.position}
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
