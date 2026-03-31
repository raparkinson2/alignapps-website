import { View, Text, Modal, Pressable, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Calendar } from 'lucide-react-native';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTeamStore, Player, Sport, GameLogEntry, PlayerStats, HockeyGoalieStats, BaseballPitcherStats, getPlayerPositions } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { syncError } from '@/lib/sync-error-handler';

// Edit mode type for game stats
type GameStatEditMode = 'batter' | 'pitcher' | 'skater' | 'goalie' | 'lacrosse' | 'lacrosse_goalie';

function isGoalie(position: string): boolean {
  return position === 'G' || position === 'GK';
}

function isPitcher(position: string): boolean {
  return position === 'P';
}

function getGameStatFields(sport: Sport, position: string): { key: string; label: string }[] {
  const playerIsGoaliePos = isGoalie(position);
  const playerIsPitcherPos = isPitcher(position);

  if (playerIsGoaliePos && (sport === 'hockey' || sport === 'soccer')) {
    return [
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
    ];
  }

  if (playerIsGoaliePos && sport === 'lacrosse') {
    return [
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
      { key: 'groundBalls', label: 'Ground Balls' },
    ];
  }

  if (playerIsPitcherPos && (sport === 'baseball' || sport === 'softball')) {
    return [
      { key: 'innings', label: 'Innings' },
      { key: 'strikeouts', label: 'Strikeouts (K)' },
      { key: 'walks', label: 'Walks (BB)' },
      { key: 'hits', label: 'Hits' },
      { key: 'homeRuns', label: 'Home Runs' },
      { key: 'earnedRuns', label: 'Earned Runs' },
    ];
  }

  switch (sport) {
    case 'hockey':
      return [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'pim', label: 'PIM' },
        { key: 'plusMinus', label: '+/-' },
      ];
    case 'baseball':
    case 'softball':
      return [
        { key: 'atBats', label: 'At Bats' },
        { key: 'hits', label: 'Hits' },
        { key: 'walks', label: 'Walks' },
        { key: 'strikeouts', label: 'Strikeouts' },
        { key: 'rbi', label: 'RBI' },
        { key: 'runs', label: 'Runs' },
        { key: 'homeRuns', label: 'Home Runs' },
      ];
    case 'basketball':
      return [
        { key: 'points', label: 'Points' },
        { key: 'rebounds', label: 'Rebounds' },
        { key: 'assists', label: 'Assists' },
        { key: 'steals', label: 'Steals' },
        { key: 'blocks', label: 'Blocks' },
      ];
    case 'soccer':
      return [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'yellowCards', label: 'Yellow Cards' },
      ];
    case 'lacrosse':
      return [
        { key: 'goals', label: 'Goals' },
        { key: 'assists', label: 'Assists' },
        { key: 'groundBalls', label: 'Ground Balls' },
        { key: 'causedTurnovers', label: 'Caused Turnovers' },
      ];
    default:
      return [];
  }
}

interface GameStatsModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  selectedStatsPlayer: Player | null;
  gameStatsEditMode: GameStatEditMode;
  editGameStats: Record<string, string>;
  setEditGameStats: (stats: Record<string, string>) => void;
  onSaved: () => void;
}

export function GameStatsModal({
  visible,
  onClose,
  gameId,
  selectedStatsPlayer,
  gameStatsEditMode,
  editGameStats,
  setEditGameStats,
  onSaved,
}: GameStatsModalProps) {
  const games = useTeamStore((s) => s.games);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const addGameLog = useTeamStore((s) => s.addGameLog);
  const updateGameLog = useTeamStore((s) => s.updateGameLog);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const game = games.find((g) => g.id === gameId);

  // Get stat fields for the currently selected player
  const currentGameStatFields = selectedStatsPlayer ? (() => {
    let positionForStats: string;
    if (gameStatsEditMode === 'pitcher') {
      positionForStats = 'P';
    } else if (gameStatsEditMode === 'goalie' || gameStatsEditMode === 'lacrosse_goalie') {
      positionForStats = teamSettings.sport === 'soccer' ? 'GK' : 'G';
    } else {
      positionForStats = 'batter';
    }
    return getGameStatFields(teamSettings.sport, positionForStats);
  })() : [];

  const saveGameStats = () => {
    if (!selectedStatsPlayer || !game) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let positionForStats: string;
    let statType: 'skater' | 'goalie' | 'batter' | 'pitcher' | 'lacrosse' | 'lacrosse_goalie';

    if (gameStatsEditMode === 'pitcher') {
      positionForStats = 'P';
      statType = 'pitcher';
    } else if (gameStatsEditMode === 'goalie') {
      positionForStats = teamSettings.sport === 'soccer' ? 'GK' : 'G';
      statType = 'goalie';
    } else if (gameStatsEditMode === 'lacrosse_goalie') {
      positionForStats = 'G';
      statType = 'lacrosse_goalie';
    } else if (gameStatsEditMode === 'batter') {
      positionForStats = 'batter';
      statType = 'batter';
    } else if (gameStatsEditMode === 'lacrosse') {
      positionForStats = 'batter';
      statType = 'lacrosse';
    } else {
      positionForStats = 'batter';
      statType = 'skater';
    }

    const statFields = getGameStatFields(teamSettings.sport, positionForStats);
    const newStats: Record<string, number> = {};
    statFields.forEach((field) => {
      newStats[field.key] = parseInt(editGameStats[field.key] || '0', 10) || 0;
    });

    const existingLog = (selectedStatsPlayer.gameLogs || []).find(
      log => (log.gameId === game.id || log.id.startsWith(game.id)) && log.statType === statType
    );

    if (existingLog) {
      updateGameLog(selectedStatsPlayer.id, existingLog.id, {
        stats: newStats as unknown as PlayerStats,
      });
    } else {
      const gameLogEntry: GameLogEntry = {
        id: `${game.id}-${Date.now()}`,
        gameId: game.id,
        date: game.date,
        stats: newStats as unknown as PlayerStats,
        statType,
      };
      addGameLog(selectedStatsPlayer.id, gameLogEntry);
    }

    // Recalculate cumulative stats from all game logs of this type
    const currentPlayerData = players.find(p => p.id === selectedStatsPlayer.id);
    const currentLogs = currentPlayerData?.gameLogs || [];

    let allLogsOfType: GameLogEntry[];
    if (existingLog) {
      allLogsOfType = currentLogs
        .filter(log => log.statType === statType)
        .map(log => log.id === existingLog.id ? { ...log, stats: newStats as unknown as PlayerStats } : log);
    } else {
      allLogsOfType = [
        ...currentLogs.filter(log => log.statType === statType),
        { id: `${game.id}-new`, gameId: game.id, date: game.date, stats: newStats as unknown as PlayerStats, statType }
      ];
    }

    const cumulativeStats: Record<string, number> = {};
    allLogsOfType.forEach(log => {
      const logStats = log.stats as unknown as Record<string, number>;
      Object.keys(logStats).forEach(key => {
        cumulativeStats[key] = (cumulativeStats[key] || 0) + (logStats[key] || 0);
      });
    });

    if (gameStatsEditMode === 'goalie' || gameStatsEditMode === 'lacrosse_goalie') {
      cumulativeStats.games = allLogsOfType.length;
    } else {
      cumulativeStats.gamesPlayed = allLogsOfType.length;
    }

    if (gameStatsEditMode === 'pitcher') {
      updatePlayer(selectedStatsPlayer.id, { pitcherStats: cumulativeStats as unknown as BaseballPitcherStats });
    } else if (gameStatsEditMode === 'goalie' || gameStatsEditMode === 'lacrosse_goalie') {
      updatePlayer(selectedStatsPlayer.id, { goalieStats: cumulativeStats as unknown as HockeyGoalieStats });
    } else {
      updatePlayer(selectedStatsPlayer.id, { stats: cumulativeStats as unknown as PlayerStats });
    }

    if (activeTeamId) {
      const updated = useTeamStore.getState().players.find(p => p.id === selectedStatsPlayer.id);
      if (updated) pushPlayerToSupabase(updated, activeTeamId).catch(syncError('sync'));
    }

    onSaved();
    Alert.alert('Stats Saved', `Game stats ${existingLog ? 'updated' : 'saved'} for ${selectedStatsPlayer.firstName} ${selectedStatsPlayer.lastName}.`);
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1" edges={['top']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable
              onPress={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
            >
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Game Stats</Text>
            <Pressable
              onPress={saveGameStats}
              className="w-10 h-10 rounded-full bg-violet-500 items-center justify-center"
            >
              <Check size={24} color="#fff" />
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
            {/* Player Info */}
            {selectedStatsPlayer && (
              <View className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-4">
                <PlayerAvatar player={selectedStatsPlayer} size={48} borderWidth={2} borderColor="#8b5cf6" />
                <View className="flex-1 ml-3">
                  <Text className="text-white text-base font-semibold">
                    {selectedStatsPlayer.firstName} {selectedStatsPlayer.lastName}
                  </Text>
                  <Text className="text-slate-400 text-sm">#{selectedStatsPlayer.number}</Text>
                </View>
                <View className="bg-violet-500/20 px-3 py-1.5 rounded-lg">
                  <Text className="text-violet-400 text-xs font-medium">
                    {gameStatsEditMode === 'skater'
                      ? (teamSettings.sport === 'hockey' ? 'Skater' : 'Player')
                      : gameStatsEditMode === 'lacrosse_goalie'
                        ? 'Goalie'
                        : gameStatsEditMode === 'lacrosse'
                          ? 'Player'
                          : gameStatsEditMode === 'batter'
                            ? (teamSettings.sport === 'basketball' ? 'Player' : 'Batter')
                            : gameStatsEditMode.charAt(0).toUpperCase() + gameStatsEditMode.slice(1)}
                  </Text>
                </View>
              </View>
            )}

            {/* Game Info */}
            <View className="bg-slate-800/40 rounded-xl p-3 mb-4">
              <View className="flex-row items-center">
                <Calendar size={16} color="#64748b" />
                <Text className="text-slate-400 text-sm ml-2">
                  vs {game.opponent} • {format(parseISO(game.date), 'MMM d, yyyy')}
                </Text>
              </View>
            </View>

            {/* Stat Fields */}
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Enter Stats
            </Text>

            {currentGameStatFields.map((field) => (
              <View key={field.key} className="mb-3">
                <Text className="text-slate-400 text-xs mb-1.5">{field.label}</Text>
                {field.key === 'plusMinus' ? (
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const current = parseInt(editGameStats[field.key] || '0', 10) || 0;
                        setEditGameStats({ ...editGameStats, [field.key]: String(current - 1) });
                      }}
                      className="bg-red-500/20 border border-red-500/50 rounded-lg w-14 h-11 items-center justify-center active:bg-red-500/40"
                    >
                      <Text className="text-red-400 text-xl font-bold">−</Text>
                    </Pressable>
                    <View className="flex-1 mx-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 items-center">
                      <Text className="text-white text-lg font-semibold">
                        {(() => {
                          const val = parseInt(editGameStats[field.key] || '0', 10) || 0;
                          return val > 0 ? `+${val}` : String(val);
                        })()}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const current = parseInt(editGameStats[field.key] || '0', 10) || 0;
                        setEditGameStats({ ...editGameStats, [field.key]: String(current + 1) });
                      }}
                      className="bg-green-500/20 border border-green-500/50 rounded-lg w-14 h-11 items-center justify-center active:bg-green-500/40"
                    >
                      <Text className="text-green-400 text-xl font-bold">+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <TextInput
                    className="bg-slate-800 rounded-lg px-3 py-2.5 text-white text-base border border-slate-700"
                    value={editGameStats[field.key] === '0' ? '' : editGameStats[field.key]}
                    onChangeText={(text) => setEditGameStats({ ...editGameStats, [field.key]: text.replace(/[^0-9-]/g, '') || '0' })}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#64748b"
                  />
                )}
              </View>
            ))}

            {/* Save Button */}
            <Pressable
              onPress={saveGameStats}
              className="bg-violet-500 rounded-xl py-3.5 items-center mt-4 mb-8 active:bg-violet-600"
            >
              <Text className="text-white text-base font-semibold">Save Stats</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// Re-export the type so the screen can use it
export type { GameStatEditMode };
