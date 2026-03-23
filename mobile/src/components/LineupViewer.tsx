import { View, Text, Modal, Pressable, ScrollView , Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { HockeyLineup, Player } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface LineupViewerProps {
  visible: boolean;
  onClose: () => void;
  lineup: HockeyLineup;
  players: Player[];
  opponent: string;
}

export function LineupViewer({
  visible,
  onClose,
  lineup,
  players,
  opponent,
}: LineupViewerProps) {
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
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={Platform.OS === 'android' ? ['top', 'bottom'] : ['bottom']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose} className="p-1">
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Game Lines</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Game Info */}
            <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-4 pb-2">
              <Text className="text-slate-400 text-sm text-center">vs {opponent}</Text>
            </Animated.View>

            {/* Forward Lines Section */}
            <Animated.View entering={FadeIn.delay(100)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4">Forward Lines</Text>

              {lineup.forwardLines.slice(0, lineup.numForwardLines).map((line, index) => {
                const lw = line.lw ? players.find((p) => p.id === line.lw) : null;
                const c = line.c ? players.find((p) => p.id === line.c) : null;
                const rw = line.rw ? players.find((p) => p.id === line.rw) : null;

                return (
                  <Animated.View
                    key={`forward-${index}`}
                    entering={FadeInDown.delay(index * 50)}
                    className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                  >
                    <Text className="text-cyan-400 text-sm font-medium mb-4 text-center">
                      {getLineLabel('forward', index)}
                    </Text>
                    <View className="flex-row justify-around">
                      {/* LW */}
                      <View className="items-center">
                        {lw ? (
                          <>
                            <PlayerAvatar player={lw} size={56} />
                            <Text className="text-white text-sm font-semibold mt-1">#{lw.number}</Text>
                            <Text className="text-slate-400 text-xs">{lw.firstName}</Text>
                          </>
                        ) : (
                          <>
                            <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-lg">-</Text>
                            </View>
                            <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                          </>
                        )}
                        <Text className="text-slate-500 text-[10px] mt-0.5">LW</Text>
                      </View>

                      {/* C */}
                      <View className="items-center">
                        {c ? (
                          <>
                            <PlayerAvatar player={c} size={56} />
                            <Text className="text-white text-sm font-semibold mt-1">#{c.number}</Text>
                            <Text className="text-slate-400 text-xs">{c.firstName}</Text>
                          </>
                        ) : (
                          <>
                            <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-lg">-</Text>
                            </View>
                            <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                          </>
                        )}
                        <Text className="text-slate-500 text-[10px] mt-0.5">C</Text>
                      </View>

                      {/* RW */}
                      <View className="items-center">
                        {rw ? (
                          <>
                            <PlayerAvatar player={rw} size={56} />
                            <Text className="text-white text-sm font-semibold mt-1">#{rw.number}</Text>
                            <Text className="text-slate-400 text-xs">{rw.firstName}</Text>
                          </>
                        ) : (
                          <>
                            <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-lg">-</Text>
                            </View>
                            <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                          </>
                        )}
                        <Text className="text-slate-500 text-[10px] mt-0.5">RW</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>

            {/* Defense Pairs Section */}
            <Animated.View entering={FadeIn.delay(200)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4">Defense Pairs</Text>

              {lineup.defenseLines.slice(0, lineup.numDefenseLines).map((line, index) => {
                const ld = line.ld ? players.find((p) => p.id === line.ld) : null;
                const rd = line.rd ? players.find((p) => p.id === line.rd) : null;

                return (
                  <Animated.View
                    key={`defense-${index}`}
                    entering={FadeInDown.delay(index * 50)}
                    className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                  >
                    <Text className="text-cyan-400 text-sm font-medium mb-4 text-center">
                      {getLineLabel('defense', index)}
                    </Text>
                    <View className="flex-row justify-around px-8">
                      {/* LD */}
                      <View className="items-center">
                        {ld ? (
                          <>
                            <PlayerAvatar player={ld} size={56} />
                            <Text className="text-white text-sm font-semibold mt-1">#{ld.number}</Text>
                            <Text className="text-slate-400 text-xs">{ld.firstName}</Text>
                          </>
                        ) : (
                          <>
                            <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-lg">-</Text>
                            </View>
                            <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                          </>
                        )}
                        <Text className="text-slate-500 text-[10px] mt-0.5">LD</Text>
                      </View>

                      {/* RD */}
                      <View className="items-center">
                        {rd ? (
                          <>
                            <PlayerAvatar player={rd} size={56} />
                            <Text className="text-white text-sm font-semibold mt-1">#{rd.number}</Text>
                            <Text className="text-slate-400 text-xs">{rd.firstName}</Text>
                          </>
                        ) : (
                          <>
                            <View className="w-14 h-14 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-lg">-</Text>
                            </View>
                            <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                          </>
                        )}
                        <Text className="text-slate-500 text-[10px] mt-0.5">RD</Text>
                      </View>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>

            {/* Goalies Section */}
            <Animated.View entering={FadeIn.delay(300)} className="px-5 pt-4">
              <Text className="text-white text-lg font-semibold mb-4">Goalies</Text>

              {lineup.goalieLines.slice(0, lineup.numGoalieLines).map((line, index) => {
                const g = line.g ? players.find((p) => p.id === line.g) : null;

                return (
                  <Animated.View
                    key={`goalie-${index}`}
                    entering={FadeInDown.delay(index * 50)}
                    className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/50"
                  >
                    <Text className="text-cyan-400 text-sm font-medium mb-4 text-center">
                      {getLineLabel('goalie', index)}
                    </Text>
                    <View className="items-center">
                      {g ? (
                        <>
                          <PlayerAvatar player={g} size={64} />
                          <Text className="text-white text-sm font-semibold mt-1">#{g.number}</Text>
                          <Text className="text-slate-400 text-xs">{g.firstName}</Text>
                        </>
                      ) : (
                        <>
                          <View className="w-16 h-16 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-lg">-</Text>
                          </View>
                          <Text className="text-slate-500 text-xs mt-1">Empty</Text>
                        </>
                      )}
                      <Text className="text-slate-500 text-[10px] mt-0.5">G</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// Helper function to check if a lineup has any assigned players
export function hasAssignedPlayers(lineup: HockeyLineup | undefined): boolean {
  if (!lineup) return false;

  // Check forward lines
  for (const line of lineup.forwardLines.slice(0, lineup.numForwardLines)) {
    if (line.lw || line.c || line.rw) return true;
  }

  // Check defense lines
  for (const line of lineup.defenseLines.slice(0, lineup.numDefenseLines)) {
    if (line.ld || line.rd) return true;
  }

  // Check goalie lines
  for (const line of lineup.goalieLines.slice(0, lineup.numGoalieLines)) {
    if (line.g) return true;
  }

  return false;
}
