import { View, Text, Pressable } from 'react-native';
import { useState } from 'react';
import { ListOrdered, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, getPlayerName, SoccerLineup, SoccerDiamondLineup } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { hasAssignedPlayers } from '@/components/LineupViewer';
import { hasAssignedBasketballPlayers } from '@/components/BasketballLineupEditor';
import { hasAssignedBattingOrder } from '@/components/BattingOrderLineupEditor';
import { hasAssignedSoccerPlayers } from '@/components/SoccerLineupEditor';
import { hasAssignedSoccerDiamondPlayers } from '@/components/SoccerDiamondLineupEditor';
import { hasAssignedLacrossePlayers } from '@/components/LacrosseLineupEditor';

interface GameLineupDisplayProps {
  gameId: string;
  onOpenLineupModal: () => void;
  onOpenBasketballLineupModal: () => void;
  onOpenBaseballLineupModal: () => void;
  onOpenBattingOrderModal: () => void;
  onOpenSoccerLineupModal: () => void;
  onOpenSoccerDiamondLineupModal: () => void;
  onOpenLacrosseLineupModal: () => void;
}

export function GameLineupDisplay({
  gameId,
  onOpenLineupModal,
  onOpenBasketballLineupModal,
  onOpenBaseballLineupModal,
  onOpenBattingOrderModal,
  onOpenSoccerLineupModal,
  onOpenSoccerDiamondLineupModal,
  onOpenLacrosseLineupModal,
}: GameLineupDisplayProps) {
  const game = useTeamStore((s) => s.games.find((g) => g.id === gameId));
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const canManageTeam = useTeamStore((s) => s.canManageTeam);

  const [isLinesExpanded, setIsLinesExpanded] = useState(false);
  const [isBasketballLineupExpanded, setIsBasketballLineupExpanded] = useState(false);
  const [isBattingOrderExpanded, setIsBattingOrderExpanded] = useState(false);
  const [isSoccerLineupExpanded, setIsSoccerLineupExpanded] = useState(false);
  const [isSoccerDiamondLineupExpanded, setIsSoccerDiamondLineupExpanded] = useState(false);
  const [isLacrosseLineupExpanded, setIsLacrosseLineupExpanded] = useState(false);

  if (!game) return null;

  return (
    <>
      {/* Lines Display - Only for hockey when lineup is set and has players */}
      {teamSettings.sport === 'hockey' && teamSettings.showLineups !== false && game.lineup && hasAssignedPlayers(game.lineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsLinesExpanded(!isLinesExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">Lines</Text>
                </View>
                {isLinesExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isLinesExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenLineupModal : undefined}
                className="px-4 pb-4"
              >
                {/* Forward Lines Preview */}
                {game.lineup.forwardLines.slice(0, game.lineup.numForwardLines).map((line, index) => {
                  const lw = line.lw ? players.find((p) => p.id === line.lw) : null;
                  const c = line.c ? players.find((p) => p.id === line.c) : null;
                  const rw = line.rw ? players.find((p) => p.id === line.rw) : null;
                  if (!lw && !c && !rw) return null;
                  const positions = ['LW', 'C', 'RW'];
                  return (
                    <View key={`fwd-${index}`} className="mb-4">
                      <Text className="text-slate-400 text-xs mb-2">Line {index + 1}</Text>
                      <View className="flex-row justify-around">
                        {[lw, c, rw].map((player, i) => (
                          <View key={i} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={48} borderWidth={2} borderColor="#10b981" />
                                <Text className="text-white text-xs mt-1">{player.firstName}</Text>
                                <Text className="text-emerald-400 text-xs font-medium">{positions[i]}</Text>
                                <Text className="text-slate-400 text-xs">#{player.number}</Text>
                              </>
                            ) : (
                              <>
                                <View className="w-12 h-12 rounded-full bg-slate-700/50 items-center justify-center border-2 border-slate-600">
                                  <Text className="text-slate-500 text-xs">-</Text>
                                </View>
                                <Text className="text-slate-500 text-xs font-medium mt-1">{positions[i]}</Text>
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Defense Pairs Preview */}
                {game.lineup.defenseLines.slice(0, game.lineup.numDefenseLines).map((line, index) => {
                  const ld = line.ld ? players.find((p) => p.id === line.ld) : null;
                  const rd = line.rd ? players.find((p) => p.id === line.rd) : null;
                  if (!ld && !rd) return null;
                  const positions = ['LD', 'RD'];
                  return (
                    <View key={`def-${index}`} className="mb-4">
                      <Text className="text-slate-400 text-xs mb-2">D-Pair {index + 1}</Text>
                      <View className="flex-row justify-around px-8">
                        {[ld, rd].map((player, i) => (
                          <View key={i} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={48} borderWidth={2} borderColor="#10b981" />
                                <Text className="text-white text-xs mt-1">{player.firstName}</Text>
                                <Text className="text-emerald-400 text-xs font-medium">{positions[i]}</Text>
                                <Text className="text-slate-400 text-xs">#{player.number}</Text>
                              </>
                            ) : (
                              <>
                                <View className="w-12 h-12 rounded-full bg-slate-700/50 items-center justify-center border-2 border-slate-600">
                                  <Text className="text-slate-500 text-xs">-</Text>
                                </View>
                                <Text className="text-slate-500 text-xs font-medium mt-1">{positions[i]}</Text>
                              </>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}

                {/* Goalies Preview */}
                {game.lineup.goalieLines.slice(0, game.lineup.numGoalieLines).map((line, index) => {
                  const g = line.g ? players.find((p) => p.id === line.g) : null;
                  if (!g) return null;
                  return (
                    <View key={`goal-${index}`} className="mb-4">
                      <Text className="text-slate-400 text-xs mb-2">{index === 0 ? 'Starter' : 'Backup'}</Text>
                      <View className="items-center">
                        <PlayerAvatar player={g} size={48} borderWidth={2} borderColor="#10b981" />
                        <Text className="text-white text-xs mt-1">{g.firstName}</Text>
                        <Text className="text-emerald-400 text-xs font-medium">G</Text>
                        <Text className="text-slate-400 text-xs">#{g.number}</Text>
                      </View>
                    </View>
                  );
                })}
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Basketball Lineup Display - Only when lineup is set and has players */}
      {teamSettings.sport === 'basketball' && teamSettings.showLineups !== false && game.basketballLineup && hasAssignedBasketballPlayers(game.basketballLineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsBasketballLineupExpanded(!isBasketballLineupExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">Starting 5</Text>
                </View>
                {isBasketballLineupExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isBasketballLineupExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenBasketballLineupModal : undefined}
                className="px-4 pb-4 active:bg-emerald-500/30"
              >
                {/* Starting 5 Preview */}
                <Text className="text-slate-400 text-xs mb-2">Starting 5</Text>
                <View className="flex-row justify-around mb-2">
                  {/* PG */}
                  {game.basketballLineup.hasPG && (
                    <View className="items-center">
                      {game.basketballLineup.starters.pg ? (
                        <>
                          <PlayerAvatar player={players.find((p) => p.id === game.basketballLineup!.starters.pg)} size={32} />
                          <Text className="text-white text-xs mt-0.5">#{players.find((p) => p.id === game.basketballLineup!.starters.pg)?.number}</Text>
                        </>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                          <Text className="text-slate-500 text-xs">PG</Text>
                        </View>
                      )}
                    </View>
                  )}
                  {/* Guards */}
                  {game.basketballLineup.starters.guards.slice(0, game.basketballLineup.numGuards).map((playerId, i) => {
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={`g-${i}`} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-xs">G</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {/* Forwards */}
                  {game.basketballLineup.starters.forwards.slice(0, game.basketballLineup.numForwards).map((playerId, i) => {
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={`f-${i}`} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-xs">F</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                  {/* Centers */}
                  {game.basketballLineup.starters.centers.slice(0, game.basketballLineup.numCenters).map((playerId, i) => {
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={`c-${i}`} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-xs">C</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Bench count */}
                {game.basketballLineup.bench.filter(Boolean).length > 0 && (
                  <Text className="text-slate-400 text-xs text-center">
                    + {game.basketballLineup.bench.filter(Boolean).length} on bench
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Batting Order Display - For baseball when lineup is set */}
      {teamSettings.sport === 'baseball' && teamSettings.showLineups !== false && game.battingOrderLineup && hasAssignedBattingOrder(game.battingOrderLineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsBattingOrderExpanded(!isBattingOrderExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">
                    Batting Order{(game.battingOrderLineup?.numHitters ?? 9) > 9 ? ` (${game.battingOrderLineup?.numHitters} hitters)` : ''}
                  </Text>
                </View>
                {isBattingOrderExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isBattingOrderExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenBattingOrderModal : undefined}
                className="px-4 pb-4 active:bg-emerald-500/30"
              >
                {/* Batting Order Preview */}
                <View className="gap-1">
                  {(game.battingOrderLineup?.battingOrder ?? []).slice(0, game.battingOrderLineup?.numHitters ?? 9).map((entry, index) => {
                    const player = entry?.playerId ? players.find((p) => p.id === entry.playerId) : null;
                    return (
                      <View key={index} className="flex-row items-center py-1">
                        <Text className="text-emerald-400 font-bold w-6">{index + 1}.</Text>
                        {player ? (
                          <>
                            <Text className="text-white flex-1">{getPlayerName(player)}</Text>
                            <Text className="text-emerald-400 font-semibold">{entry?.position}</Text>
                          </>
                        ) : (
                          <Text className="text-slate-500 flex-1">-</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Batting Order Display - For softball when lineup is set */}
      {teamSettings.sport === 'softball' && teamSettings.showLineups !== false && game.battingOrderLineup && hasAssignedBattingOrder(game.battingOrderLineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsBattingOrderExpanded(!isBattingOrderExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">Batting Order ({game.battingOrderLineup?.numHitters ?? 10} hitters)</Text>
                </View>
                {isBattingOrderExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isBattingOrderExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenBattingOrderModal : undefined}
                className="px-4 pb-4 active:bg-emerald-500/30"
              >
                {/* Batting Order Preview */}
                <View className="gap-1">
                  {(game.battingOrderLineup?.battingOrder ?? []).slice(0, game.battingOrderLineup?.numHitters ?? 10).map((entry, index) => {
                    const player = entry?.playerId ? players.find((p) => p.id === entry.playerId) : null;
                    return (
                      <View key={index} className="flex-row items-center py-1">
                        <Text className="text-emerald-400 font-bold w-6">{index + 1}.</Text>
                        {player ? (
                          <>
                            <Text className="text-white flex-1">{getPlayerName(player)}</Text>
                            <Text className="text-emerald-400 font-semibold">{entry?.position}</Text>
                          </>
                        ) : (
                          <Text className="text-slate-500 flex-1">-</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Soccer Lineup Display - Only when lineup is set and has players */}
      {teamSettings.sport === 'soccer' && teamSettings.showLineups !== false && game.soccerLineup && hasAssignedSoccerPlayers(game.soccerLineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsSoccerLineupExpanded(!isSoccerLineupExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">Lineup</Text>
                </View>
                {isSoccerLineupExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isSoccerLineupExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenSoccerLineupModal : undefined}
                className="px-4 pb-4 active:bg-emerald-500/30"
              >
                {(() => {
                  const sl = game.soccerLineup!;
                  const renderRow = (ids: (string | undefined)[], count: number, prefix: string) => (
                    <View className="flex-row flex-wrap justify-around mb-3">
                      {ids.slice(0, count).map((pid, i) => {
                        const player = pid ? players.find((p) => p.id === pid) : null;
                        return (
                          <View key={`${prefix}-${i}`} className="items-center">
                            {player ? (
                              <>
                                <PlayerAvatar player={player} size={32} />
                                <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                              </>
                            ) : (
                              <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                                <Text className="text-slate-500 text-[10px]">{prefix}{i + 1}</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  );
                  const gkPlayer = sl.gk ? players.find((p) => p.id === sl.gk) : null;
                  return (
                    <>
                      <Text className="text-slate-400 text-xs mb-2">Forwards</Text>
                      {renderRow(sl.forwards, sl.numForwards, 'F')}

                      {sl.numAttMidfielders > 0 && (
                        <>
                          <Text className="text-slate-400 text-xs mb-2">Att. Midfielders</Text>
                          {renderRow(sl.attMidfielders, sl.numAttMidfielders, 'AM')}
                        </>
                      )}

                      {sl.numDefMidfielders > 0 && (
                        <>
                          <Text className="text-slate-400 text-xs mb-2">Def. Midfielders</Text>
                          {renderRow(sl.defMidfielders, sl.numDefMidfielders, 'DM')}
                        </>
                      )}

                      <Text className="text-slate-400 text-xs mb-2">Defenders</Text>
                      {renderRow(sl.defenders, sl.numDefenders, 'D')}

                      <Text className="text-slate-400 text-xs mb-2">Goalkeeper</Text>
                      <View className="flex-row justify-center">
                        <View className="items-center">
                          {gkPlayer ? (
                            <>
                              <PlayerAvatar player={gkPlayer} size={32} />
                              <Text className="text-white text-xs mt-0.5">#{gkPlayer.number}</Text>
                            </>
                          ) : (
                            <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                              <Text className="text-slate-500 text-[10px]">GK</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </>
                  );
                })()}
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Soccer Diamond Lineup Display - Only when lineup is set and has players */}
      {teamSettings.sport === 'soccer' && teamSettings.showLineups !== false && game.soccerDiamondLineup && hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsSoccerDiamondLineupExpanded(!isSoccerDiamondLineupExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">Lineup (Diamond)</Text>
                </View>
                {isSoccerDiamondLineupExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isSoccerDiamondLineupExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenSoccerDiamondLineupModal : undefined}
                className="px-4 pb-4 active:bg-emerald-500/30"
              >
                {/* Forwards Preview */}
                <Text className="text-slate-400 text-xs mb-2">Forwards</Text>
                <View className="flex-row justify-center gap-6 mb-3">
                  {['st1', 'st2'].map((pos) => {
                    const playerId = game.soccerDiamondLineup![pos as keyof SoccerDiamondLineup];
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={pos} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">ST</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* CAM Preview */}
                <Text className="text-slate-400 text-xs mb-2">Attacking Mid</Text>
                <View className="items-center mb-3">
                  {(() => {
                    const player = game.soccerDiamondLineup!.cam ? players.find((p) => p.id === game.soccerDiamondLineup!.cam) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">CAM</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* LM / RM Preview */}
                <Text className="text-slate-400 text-xs mb-2">Wide Mids</Text>
                <View className="flex-row justify-around mb-3">
                  {[
                    { key: 'lm', label: 'LM' },
                    { key: 'rm', label: 'RM' },
                  ].map(({ key, label }) => {
                    const playerId = game.soccerDiamondLineup![key as keyof SoccerDiamondLineup];
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={key} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">{label}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* CDM Preview */}
                <Text className="text-slate-400 text-xs mb-2">Defensive Mid</Text>
                <View className="items-center mb-3">
                  {(() => {
                    const player = game.soccerDiamondLineup!.cdm ? players.find((p) => p.id === game.soccerDiamondLineup!.cdm) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">CDM</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>

                {/* Defense Preview */}
                <Text className="text-slate-400 text-xs mb-2">Defense</Text>
                <View className="flex-row justify-around mb-3">
                  {[
                    { key: 'lb', label: 'LB' },
                    { key: 'cb1', label: 'CB' },
                    { key: 'cb2', label: 'CB' },
                    { key: 'rb', label: 'RB' },
                  ].map(({ key, label }) => {
                    const playerId = game.soccerDiamondLineup![key as keyof SoccerDiamondLineup];
                    const player = playerId ? players.find((p) => p.id === playerId) : null;
                    return (
                      <View key={key} className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">{label}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Goalkeeper Preview */}
                <Text className="text-slate-400 text-xs mb-2">Goalkeeper</Text>
                <View className="flex-row justify-center">
                  {(() => {
                    const player = game.soccerDiamondLineup!.gk ? players.find((p) => p.id === game.soccerDiamondLineup!.gk) : null;
                    return (
                      <View className="items-center">
                        {player ? (
                          <>
                            <PlayerAvatar player={player} size={32} />
                            <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                          </>
                        ) : (
                          <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                            <Text className="text-slate-500 text-[10px]">GK</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* Lacrosse Lineup Display - Only when lineup is set and has players */}
      {teamSettings.sport === 'lacrosse' && teamSettings.showLineups !== false && game.lacrosseLineup && hasAssignedLacrossePlayers(game.lacrosseLineup) && (
        <Animated.View
          entering={FadeInUp.delay(125).springify()}
          className="mx-4 mb-4"
        >
          <View className="bg-emerald-500/20 rounded-2xl border border-emerald-500/30 overflow-hidden">
            {/* Collapsible Header */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsLacrosseLineupExpanded(!isLacrosseLineupExpanded);
              }}
              className="p-4 active:bg-emerald-500/30"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <ListOrdered size={20} color="#10b981" />
                  <Text className="text-emerald-400 font-semibold ml-2">Lineup ({game.lacrosseLineup.numAttackers}A-{game.lacrosseLineup.numMidfielders}M-{game.lacrosseLineup.numDefenders}D)</Text>
                </View>
                {isLacrosseLineupExpanded ? (
                  <ChevronUp size={20} color="#10b981" />
                ) : (
                  <ChevronDown size={20} color="#10b981" />
                )}
              </View>
            </Pressable>

            {/* Expandable Content */}
            {isLacrosseLineupExpanded && (
              <Pressable
                onPress={canManageTeam() ? onOpenLacrosseLineupModal : undefined}
                className="px-4 pb-4 active:bg-emerald-500/30"
              >

              {/* Attackers Preview */}
              <Text className="text-slate-400 text-xs mb-2">Attackers</Text>
              <View className="flex-row justify-around mb-3">
                {game.lacrosseLineup.attackers.slice(0, game.lacrosseLineup.numAttackers).map((playerId, index) => {
                  const player = playerId ? players.find((p) => p.id === playerId) : null;
                  return (
                    <View key={`attacker-${index}`} className="items-center">
                      {player ? (
                        <>
                          <PlayerAvatar player={player} size={32} />
                          <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                        </>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                          <Text className="text-slate-500 text-[10px]">A{index + 1}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Midfielders Preview */}
              <Text className="text-slate-400 text-xs mb-2">Midfielders</Text>
              <View className="flex-row justify-around mb-3">
                {game.lacrosseLineup.midfielders.slice(0, game.lacrosseLineup.numMidfielders).map((playerId, index) => {
                  const player = playerId ? players.find((p) => p.id === playerId) : null;
                  return (
                    <View key={`midfielder-${index}`} className="items-center">
                      {player ? (
                        <>
                          <PlayerAvatar player={player} size={32} />
                          <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                        </>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                          <Text className="text-slate-500 text-[10px]">M{index + 1}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Defenders Preview */}
              <Text className="text-slate-400 text-xs mb-2">Defenders</Text>
              <View className="flex-row justify-around mb-3">
                {game.lacrosseLineup.defenders.slice(0, game.lacrosseLineup.numDefenders).map((playerId, index) => {
                  const player = playerId ? players.find((p) => p.id === playerId) : null;
                  return (
                    <View key={`defender-${index}`} className="items-center">
                      {player ? (
                        <>
                          <PlayerAvatar player={player} size={32} />
                          <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                        </>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                          <Text className="text-slate-500 text-[10px]">D{index + 1}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Goalie Preview */}
              <Text className="text-slate-400 text-xs mb-2">Goalie</Text>
              <View className="flex-row justify-center">
                {(() => {
                  const player = game.lacrosseLineup!.goalie ? players.find((p) => p.id === game.lacrosseLineup!.goalie) : null;
                  return (
                    <View className="items-center">
                      {player ? (
                        <>
                          <PlayerAvatar player={player} size={32} />
                          <Text className="text-white text-xs mt-0.5">#{player.number}</Text>
                        </>
                      ) : (
                        <View className="w-8 h-8 rounded-full bg-slate-700/50 items-center justify-center">
                          <Text className="text-slate-500 text-[10px]">G</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </>
  );
}
