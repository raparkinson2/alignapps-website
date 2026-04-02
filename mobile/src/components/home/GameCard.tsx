import { View, Text, Pressable } from 'react-native';
import {
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Beer,
  ListOrdered,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTeamStore, Game, getPlayerName } from '@/lib/store';
import { cn } from '@/lib/cn';
import { JerseyIcon } from '@/components/JerseyIcon';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { hasAssignedPlayers } from '@/components/LineupViewer';
import { hasAssignedBasketballPlayers } from '@/components/BasketballLineupEditor';
import { hasAssignedBaseballPlayers } from '@/components/BaseballLineupEditor';
import { hasAssignedBattingOrder } from '@/components/BattingOrderLineupEditor';
import { hasAssignedSoccerPlayers } from '@/components/SoccerLineupEditor';
import { hasAssignedSoccerDiamondPlayers } from '@/components/SoccerDiamondLineupEditor';
import { hasAssignedLacrossePlayers } from '@/components/LacrosseLineupEditor';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

const getDateLabel = (dateString: string): string => {
  const date = parseISO(dateString);
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'EEE, MMM d');
};

// Helper to convert hex codes to readable color names
const hexToColorName = (hex: string): string => {
  const colorMap: Record<string, string> = {
    '#ffffff': 'White',
    '#000000': 'Black',
    '#1a1a1a': 'Black',
    '#ff0000': 'Red',
    '#00ff00': 'Green',
    '#0000ff': 'Blue',
    '#1e40af': 'Blue',
    '#ffff00': 'Yellow',
    '#ff6600': 'Orange',
    '#800080': 'Purple',
    '#ffc0cb': 'Pink',
    '#808080': 'Gray',
    '#a52a2a': 'Brown',
    '#00ffff': 'Cyan',
    '#000080': 'Navy',
    '#008000': 'Green',
    '#c0c0c0': 'Silver',
    '#ffd700': 'Gold',
    '#8b0000': 'Maroon',
    '#2563eb': 'Blue',
    '#dc2626': 'Red',
    '#16a34a': 'Green',
    '#ca8a04': 'Yellow',
    '#9333ea': 'Purple',
    '#ea580c': 'Orange',
  };

  const lowerHex = hex.toLowerCase();
  if (colorMap[lowerHex]) return colorMap[lowerHex];

  // If hex starts with #, try to identify the color family
  if (hex.startsWith('#') && hex.length === 7) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    // Simple color detection
    if (r > 200 && g > 200 && b > 200) return 'White';
    if (r < 50 && g < 50 && b < 50) return 'Black';
    if (r > g && r > b) return r > 150 ? 'Red' : 'Maroon';
    if (g > r && g > b) return 'Green';
    if (b > r && b > g) return 'Blue';
    if (r > 200 && g > 200 && b < 100) return 'Yellow';
    if (r > 200 && g < 150 && b < 100) return 'Orange';
    return 'Gray';
  }

  return 'Gray'; // Default for unrecognized formats
};

// Helper to convert color names to hex (reverse of hexToColorName)
const colorNameToHex = (name: string): string => {
  const nameMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#1a1a1a',
    'dark': '#1a1a1a',
    'red': '#dc2626',
    'green': '#16a34a',
    'blue': '#2563eb',
    'yellow': '#ca8a04',
    'orange': '#ea580c',
    'purple': '#9333ea',
    'pink': '#ffc0cb',
    'gray': '#808080',
    'grey': '#808080',
    'brown': '#a52a2a',
    'cyan': '#00ffff',
    'navy': '#000080',
    'silver': '#c0c0c0',
    'gold': '#ffd700',
    'maroon': '#8b0000',
  };
  return nameMap[name.toLowerCase()] || '#808080';
};

export interface GameCardProps {
  game: Game;
  index: number;
  onPress: () => void;
  onViewLines: () => void;
  skipAnimation?: boolean;
  hideDateBadge?: boolean;
  hideWeather?: boolean;
}

export function GameCard({ game, index, onPress, onViewLines, skipAnimation = false, hideDateBadge = false, hideWeather = false }: GameCardProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const players = useTeamStore((s) => s.players);
  const checkedInCount = game.checkedInPlayers?.length ?? 0;
  const checkedOutCount = game.checkedOutPlayers?.length ?? 0;
  const invitedCount = game.invitedPlayers?.length ?? 0;
  const pendingCount = invitedCount - checkedInCount - checkedOutCount;

  // Get refreshment duty player if assigned and feature is enabled
  const showRefreshmentDuty = teamSettings?.showRefreshmentDuty !== false;
  const is21Plus = teamSettings?.refreshmentDutyIs21Plus !== false;
  const beerDutyPlayer = showRefreshmentDuty && (game.showBeerDuty !== false) && game.beerDutyPlayerId
    ? players.find((p) => p.id === game.beerDutyPlayerId)
    : null;

  // Look up jersey color by name or hex code (handles both cases)
  const safeJerseyColor = game.jerseyColor ?? '#1a1a1a';
  const jerseyColorInfo = (teamSettings?.jerseyColors ?? []).find((c) => c.name === safeJerseyColor || c.color === safeJerseyColor);
  // If found in settings, use the name. Otherwise, try to convert hex to color name
  const jerseyColorName = jerseyColorInfo?.name || hexToColorName(safeJerseyColor);
  const jerseyColorHex = jerseyColorInfo?.color || (safeJerseyColor.startsWith('#') ? safeJerseyColor : colorNameToHex(safeJerseyColor));

  // Check if lines are set (for hockey only)
  const showLinesButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'hockey' && hasAssignedPlayers(game.lineup);
  // Check if lineup is set (for basketball)
  const showBasketballLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'basketball' && hasAssignedBasketballPlayers(game.basketballLineup);
  // Check if lineup is set (for baseball — field positions OR batting order)
  const showBaseballLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'baseball' && (hasAssignedBaseballPlayers(game.baseballLineup) || hasAssignedBattingOrder(game.battingOrderLineup));
  // Check if lineup is set (for softball — uses batting order)
  const showSoftballLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'softball' && hasAssignedBattingOrder(game.battingOrderLineup);
  // Check if lineup is set (for soccer — 4-4-2 or diamond)
  const showSoccerLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'soccer' && (hasAssignedSoccerPlayers(game.soccerLineup) || hasAssignedSoccerDiamondPlayers(game.soccerDiamondLineup));
  // Check if lineup is set (for lacrosse)
  const showLacrosseLineupButton = teamSettings?.showLineups !== false && teamSettings?.sport === 'lacrosse' && hasAssignedLacrossePlayers(game.lacrosseLineup);

  const cardContent = (
    <Pressable
      onPress={onPress}
      className={cn('active:scale-[0.98]', !skipAnimation && 'mb-3')}
      style={{ transform: [{ scale: 1 }] }}
    >
      <View className="bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700/50">
        {/* Jersey Color Bar */}
        <View style={{ backgroundColor: jerseyColorHex, height: 5 }} />

        <View className="p-3">
          {/* Date Badge & Opponent */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center">
              {!hideDateBadge && (
                <View className="bg-cyan-500/20 px-2 py-px rounded-full mr-2">
                  <Text className="text-cyan-400 text-xs font-medium">
                    {getDateLabel(game.date)}
                  </Text>
                </View>
              )}
              <Text className="text-white text-lg font-bold">vs {game.opponent}</Text>
            </View>
            <ChevronRight size={18} color="#94a3b8" strokeWidth={2.5} />
          </View>

          {/* Info Grid */}
          <View className="flex-row items-center mb-2">
            <View className="flex-row items-center">
              <Clock size={14} color="#67e8f9" strokeWidth={2} />
              <Text className="text-slate-300 text-sm ml-1.5">{game.time}</Text>
            </View>
            <View className="flex-row items-center ml-4">
              <JerseyIcon size={14} color={jerseyColorHex} />
              <Text className="text-slate-300 text-sm ml-1.5">{jerseyColorName}</Text>
            </View>
            {!hideWeather && (game.weatherCondition || game.weatherTemp != null) && (
              <View className="flex-row items-center ml-4" style={{ gap: 3 }}>
                <Text style={{ fontSize: 14 }}>
                  {game.weatherCondition === 'sunny' ? '☀️'
                    : game.weatherCondition === 'partly_cloudy' ? '⛅'
                    : game.weatherCondition === 'cloudy' ? '☁️'
                    : game.weatherCondition === 'rain' ? '🌧️'
                    : game.weatherCondition === 'snow' ? '❄️'
                    : game.weatherCondition === 'indoor' ? '🏟️'
                    : '🌡️'}
                </Text>
                {game.weatherTemp != null && (
                  <Text className="text-slate-300 text-sm font-medium">{game.weatherTemp}°F</Text>
                )}
              </View>
            )}
          </View>

          {/* Location */}
          <View className="flex-row items-center mb-2">
            <MapPin size={14} color="#67e8f9" strokeWidth={2} />
            <Text className="text-slate-400 text-sm ml-1.5" numberOfLines={1}>{game.location}</Text>
          </View>

          {/* Game Lines Button */}
          {showLinesButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lines</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Basketball) */}
          {showBasketballLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Baseball) */}
          {showBaseballLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Soccer) */}
          {showSoccerLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Softball) */}
          {showSoftballLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Batting Order</Text>
            </Pressable>
          )}

          {/* Game Lineup Button (Lacrosse) */}
          {showLacrosseLineupButton && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onViewLines();
              }}
              className="bg-emerald-500/20 rounded-xl p-3 mb-3 border border-emerald-500/30 flex-row items-center justify-center active:bg-emerald-500/30"
            >
              <ListOrdered size={16} color="#10b981" />
              <Text className="text-emerald-400 font-medium ml-2">Game Lineup</Text>
            </Pressable>
          )}

          {/* Footer */}
          <View className="flex-row items-center pt-2 border-t border-slate-700/50">
            <View className="flex-row items-center">
              <Users size={14} color="#94a3b8" strokeWidth={2} />
              <View className="flex-row items-center ml-3">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                <Text className="text-slate-400 text-sm">In:</Text>
                <Text className="text-green-400 text-sm font-medium ml-1">{checkedInCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                <Text className="text-slate-400 text-sm">Out:</Text>
                <Text className="text-red-400 text-sm font-medium ml-1">{checkedOutCount}</Text>
              </View>
              <View className="flex-row items-center ml-4">
                <View className="w-2 h-2 rounded-full bg-slate-500 mr-1" />
                <Text className="text-slate-400 text-sm">Pending:</Text>
                <Text className="text-slate-500 text-sm font-medium ml-1">{pendingCount}</Text>
              </View>
            </View>
            {beerDutyPlayer && (
              <View className="flex-row items-center ml-4">
                {is21Plus ? (
                  <Beer size={14} color="#f59e0b" />
                ) : (
                  <JuiceBoxIcon size={14} color="#a855f7" />
                )}
                <Text className={cn(
                  "text-sm ml-1.5 font-medium",
                  is21Plus ? "text-amber-400" : "text-purple-400"
                )}>
                  {getPlayerName(beerDutyPlayer)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );

  if (skipAnimation) {
    return cardContent;
  }

  return (
    <Animated.View entering={FadeInDown.delay(index * 100).springify()}>
      {cardContent}
    </Animated.View>
  );
}
