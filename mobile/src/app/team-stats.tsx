import { View, Text, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Trophy,
  Users,
  Award,
  X,
  ChevronRight,
  Calendar,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTeamStore, Sport, HockeyStats, HockeyGoalieStats, BaseballStats, BaseballPitcherStats, BasketballStats, SoccerStats, SoccerGoalieStats, LacrosseStats, LacrosseGoalieStats, Player, PlayerStats, getPlayerPositions, GameLogEntry, getPlayerName } from '@/lib/store';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';

// Edit mode type - determines which stats to show/edit
type EditMode = 'batter' | 'pitcher' | 'skater' | 'goalie';

// Check if player is a goalie (checks all positions)
function isGoalie(position: string): boolean {
  return position === 'G' || position === 'GK';
}

// Check if any of the player's positions is a goalie
function playerIsGoalie(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => isGoalie(p));
}

// Check if player is a pitcher
function isPitcher(position: string): boolean {
  return position === 'P';
}

// Check if any of the player's positions is a pitcher
function playerIsPitcher(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.includes('P');
}

// Check if player has non-pitcher positions (for baseball)
function playerHasNonPitcherPositions(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => p !== 'P');
}

// Check if player has non-goalie positions (for hockey/soccer)
function playerHasNonGoaliePositions(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => !isGoalie(p));
}

// Get display position string (e.g., "P/3B")
function getDisplayPosition(player: Player): string {
  const positions = getPlayerPositions(player);
  return positions.join('/');
}

// Format name as "F. LastName"
function formatName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${firstName.charAt(0)}. ${lastName}`;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color: string;
  index: number;
}

function StatCard({ icon, label, value, subtitle, color, index }: StatCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 50).springify()}
      className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50"
    >
      <View className="flex-row items-center mb-2">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${color}20` }}
        >
          {icon}
        </View>
        <Text className="text-slate-400 text-sm flex-1">{label}</Text>
      </View>
      <Text className="text-white text-3xl font-bold">{value}</Text>
      {subtitle && (
        <Text className="text-slate-500 text-sm mt-1">{subtitle}</Text>
      )}
    </Animated.View>
  );
}

// Get stat column headers based on sport
function getStatHeaders(sport: Sport): string[] {
  switch (sport) {
    case 'hockey':
      return ['GP', 'G', 'A', 'P', 'PIM', '+/-'];
    case 'baseball':
    case 'softball':
      return ['AB', 'H', 'BB', 'K', 'RBI', 'R', 'HR'];
    case 'basketball':
      return ['GP', 'PTS', 'PPG', 'REB', 'AST', 'STL', 'BLK'];
    case 'soccer':
      return ['GP', 'G', 'A', 'YC'];
    case 'lacrosse':
      return ['GP', 'G', 'A', 'P', 'GB', 'CT'];
    default:
      return ['GP', 'G', 'A', 'P', 'PIM', '+/-'];
  }
}

// Get pitcher stat headers
function getPitcherHeaders(): string[] {
  return ['GS', 'W-L', 'IP', 'CG', 'SO', 'K', 'BB', 'HR', 'ERA'];
}

// Get stat values based on sport
function getStatValues(sport: Sport, stats: PlayerStats | undefined, position: string): (number | string)[] {
  const playerIsGoalie = isGoalie(position);
  const playerIsPitcher = isPitcher(position);

  if (!stats) {
    if (playerIsGoalie && sport === 'lacrosse') {
      return [0, '0-0', '0.00', 0, 0, '.000', 0];
    }
    if (playerIsGoalie && (sport === 'hockey' || sport === 'soccer')) {
      return [0, '0-0-0', 0, '0.00', 0, 0, '.000'];
    }
    if (playerIsPitcher && (sport === 'baseball' || sport === 'softball')) {
      return [0, '0-0', 0, 0, 0, 0, 0, 0, '0.00'];
    }
    if (sport === 'hockey') return [0, 0, 0, 0, 0, 0];
    if (sport === 'baseball' || sport === 'softball') return [0, 0, 0, 0, 0, 0, 0];
    if (sport === 'basketball') return [0, 0, '0.0', 0, 0, 0, 0];
    if (sport === 'soccer') return [0, 0, 0, 0];
    if (sport === 'lacrosse') return [0, 0, 0, 0, 0, 0];
    return [0, 0, 0];
  }

  // Handle lacrosse goalie stats
  if (playerIsGoalie && sport === 'lacrosse') {
    const s = stats as LacrosseGoalieStats;
    const record = `${s.wins ?? 0}-${s.losses ?? 0}`;
    const savePercentage = s.shotsAgainst > 0
      ? (s.saves / s.shotsAgainst).toFixed(3)
      : '.000';
    const mp = s.minutesPlayed ?? 0;
    const gaa = mp > 0 ? ((s.goalsAgainst ?? 0) / mp * 60).toFixed(2) : '0.00';
    return [s.games ?? 0, record, gaa, s.shotsAgainst ?? 0, s.saves ?? 0, savePercentage, s.groundBalls ?? 0];
  }

  // Handle goalie stats for hockey/soccer
  if (playerIsGoalie && (sport === 'hockey' || sport === 'soccer')) {
    const s = stats as HockeyGoalieStats | SoccerGoalieStats;
    const record = `${s.wins ?? 0}-${s.losses ?? 0}-${s.ties ?? 0}`;
    const savePercentage = s.shotsAgainst > 0
      ? (s.saves / s.shotsAgainst).toFixed(3)
      : '.000';
    const mp = s.minutesPlayed ?? 0;

    // Hockey GAA = (Goals Against x 60) / Minutes Played
    // Soccer GAA = (Goals Against / Minutes Played) x 90
    let gaa: string;
    if (sport === 'hockey') {
      gaa = mp > 0 ? ((s.goalsAgainst ?? 0) * 60 / mp).toFixed(2) : '0.00';
    } else {
      gaa = mp > 0 ? ((s.goalsAgainst ?? 0) / mp * 90).toFixed(2) : '0.00';
    }

    return [s.games ?? 0, record, mp, gaa, s.shotsAgainst ?? 0, s.saves ?? 0, savePercentage];
  }

  // Handle pitcher stats for baseball/softball
  if (playerIsPitcher && (sport === 'baseball' || sport === 'softball')) {
    const s = stats as BaseballPitcherStats;
    const record = `${s.wins ?? 0}-${s.losses ?? 0}`;
    const ip = s.innings ?? 0;
    // ERA = (Earned Runs / Innings Pitched) x 9
    const era = ip > 0 ? ((s.earnedRuns ?? 0) / ip * 9).toFixed(2) : '0.00';
    return [s.starts ?? 0, record, ip, s.completeGames ?? 0, s.shutouts ?? 0, s.strikeouts ?? 0, s.walks ?? 0, s.homeRuns ?? 0, era];
  }

  switch (sport) {
    case 'hockey': {
      const s = stats as HockeyStats;
      const points = (s.goals ?? 0) + (s.assists ?? 0);
      const plusMinus = s.plusMinus ?? 0;
      const plusMinusStr = plusMinus > 0 ? `+${plusMinus}` : `${plusMinus}`;
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, points, s.pim ?? 0, plusMinusStr];
    }
    case 'baseball':
    case 'softball': {
      const s = stats as BaseballStats;
      return [s.atBats ?? 0, s.hits ?? 0, s.walks ?? 0, s.strikeouts ?? 0, s.rbi ?? 0, s.runs ?? 0, s.homeRuns ?? 0];
    }
    case 'basketball': {
      const s = stats as BasketballStats;
      const gp = s.gamesPlayed ?? 0;
      const ppg = gp > 0 ? ((s.points ?? 0) / gp).toFixed(1) : '0.0';
      return [gp, s.points ?? 0, ppg, s.rebounds ?? 0, s.assists ?? 0, s.steals ?? 0, s.blocks ?? 0];
    }
    case 'soccer': {
      const s = stats as SoccerStats;
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, s.yellowCards ?? 0];
    }
    case 'lacrosse': {
      const s = stats as LacrosseStats;
      const points = (s.goals ?? 0) + (s.assists ?? 0);
      return [s.gamesPlayed ?? 0, s.goals ?? 0, s.assists ?? 0, points, s.groundBalls ?? 0, s.causedTurnovers ?? 0];
    }
    default:
      return [0, 0, 0];
  }
}

// Calculate team totals based on sport
function calculateTeamTotals(players: Player[], sport: Sport): { label: string; value: number }[] {
  switch (sport) {
    case 'hockey': {
      let totalGoals = 0;
      let totalAssists = 0;
      let totalPim = 0;
      players.forEach((p) => {
        if (p.stats && !isGoalie(p.position)) {
          const s = p.stats as HockeyStats;
          totalGoals += s.goals ?? 0;
          totalAssists += s.assists ?? 0;
          totalPim += s.pim ?? 0;
        }
      });
      const totalPoints = totalGoals + totalAssists;
      return [
        { label: 'Goals', value: totalGoals },
        { label: 'Assists', value: totalAssists },
        { label: 'Points', value: totalPoints },
      ];
    }
    case 'baseball': {
      let totalAB = 0;
      let totalHits = 0;
      let totalHR = 0;
      let totalRBI = 0;
      let totalK = 0;
      players.forEach((p) => {
        if (p.stats) {
          const s = p.stats as BaseballStats;
          totalAB += s.atBats ?? 0;
          totalHits += s.hits ?? 0;
          totalHR += s.homeRuns ?? 0;
          totalRBI += s.rbi ?? 0;
          totalK += s.strikeouts ?? 0;
        }
      });
      return [
        { label: 'Hits', value: totalHits },
        { label: 'HRs', value: totalHR },
        { label: 'RBIs', value: totalRBI },
      ];
    }
    case 'basketball': {
      let totalGP = 0;
      let totalPts = 0;
      let totalReb = 0;
      let totalAst = 0;
      let totalStl = 0;
      let totalBlk = 0;
      players.forEach((p) => {
        if (p.stats) {
          const s = p.stats as BasketballStats;
          totalGP += s.gamesPlayed ?? 0;
          totalPts += s.points ?? 0;
          totalReb += s.rebounds ?? 0;
          totalAst += s.assists ?? 0;
          totalStl += s.steals ?? 0;
          totalBlk += s.blocks ?? 0;
        }
      });
      const ppg = totalGP > 0 ? Math.round((totalPts / totalGP) * 10) / 10 : 0;
      const rpg = totalGP > 0 ? Math.round((totalReb / totalGP) * 10) / 10 : 0;
      const apg = totalGP > 0 ? Math.round((totalAst / totalGP) * 10) / 10 : 0;
      const spg = totalGP > 0 ? Math.round((totalStl / totalGP) * 10) / 10 : 0;
      const bpg = totalGP > 0 ? Math.round((totalBlk / totalGP) * 10) / 10 : 0;
      return [
        { label: 'PPG', value: ppg },
        { label: 'RPG', value: rpg },
        { label: 'APG', value: apg },
        { label: 'SPG', value: spg },
        { label: 'BPG', value: bpg },
      ];
    }
    case 'soccer': {
      let totalGoals = 0;
      let totalAssists = 0;
      let totalYC = 0;
      players.forEach((p) => {
        if (p.stats) {
          const s = p.stats as SoccerStats;
          totalGoals += s.goals ?? 0;
          totalAssists += s.assists ?? 0;
          totalYC += s.yellowCards ?? 0;
        }
      });
      return [
        { label: 'Goals', value: totalGoals },
        { label: 'Assists', value: totalAssists },
        { label: 'Yellow Cards', value: totalYC },
      ];
    }
    case 'lacrosse': {
      let totalGoals = 0;
      let totalAssists = 0;
      let totalGB = 0;
      let totalCT = 0;
      players.forEach((p) => {
        if (p.stats && !isGoalie(p.position)) {
          const s = p.stats as LacrosseStats;
          totalGoals += s.goals ?? 0;
          totalAssists += s.assists ?? 0;
          totalGB += s.groundBalls ?? 0;
          totalCT += s.causedTurnovers ?? 0;
        }
      });
      const totalPoints = totalGoals + totalAssists;
      return [
        { label: 'Goals', value: totalGoals },
        { label: 'Assists', value: totalAssists },
        { label: 'Points', value: totalPoints },
        { label: 'Ground Balls', value: totalGB },
      ];
    }
    default:
      return [];
  }
}

// Get stat field definitions based on sport and position
function getStatFields(sport: Sport, position: string): { key: string; label: string }[] {
  const playerIsGoalie = isGoalie(position);
  const playerIsPitcher = isPitcher(position);

  // Goalie stats for hockey/soccer (no games field - each log = 1 GP)
  if (playerIsGoalie && (sport === 'hockey' || sport === 'soccer')) {
    if (sport === 'hockey') {
      return [
        { key: 'wins', label: 'Wins' },
        { key: 'losses', label: 'Losses' },
        { key: 'ties', label: 'Ties' },
        { key: 'minutesPlayed', label: 'Minutes Played' },
        { key: 'shotsAgainst', label: 'Shots Against' },
        { key: 'saves', label: 'Saves' },
        { key: 'goalsAgainst', label: 'Goals Against' },
      ];
    }
    return [
      { key: 'wins', label: 'Wins' },
      { key: 'losses', label: 'Losses' },
      { key: 'ties', label: 'Draws' },
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
    ];
  }

  // Lacrosse goalie stats
  if (playerIsGoalie && sport === 'lacrosse') {
    return [
      { key: 'wins', label: 'Wins' },
      { key: 'losses', label: 'Losses' },
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
      { key: 'groundBalls', label: 'Ground Balls' },
    ];
  }

  // Pitcher stats for baseball/softball (starts field stays since it's different from GP)
  if (playerIsPitcher && (sport === 'baseball' || sport === 'softball')) {
    return [
      { key: 'starts', label: 'Starts' },
      { key: 'wins', label: 'Wins' },
      { key: 'losses', label: 'Losses' },
      { key: 'innings', label: 'Innings' },
      { key: 'completeGames', label: 'Complete Games' },
      { key: 'strikeouts', label: 'Strikeouts (K)' },
      { key: 'walks', label: 'Walks (BB)' },
      { key: 'hits', label: 'Hits' },
      { key: 'homeRuns', label: 'Home Runs' },
      { key: 'shutouts', label: 'Shutouts' },
      { key: 'earnedRuns', label: 'Earned Runs' },
    ];
  }

  // Regular player stats (no gamesPlayed field - each log = 1 GP)
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
        { key: 'shots', label: 'Shots' },
        { key: 'shotsOnGoal', label: 'Shots on Goal' },
      ];
    default:
      return [];
  }
}

// Get default stats for a sport and position
function getDefaultStats(sport: Sport, position: string): PlayerStats {
  const playerIsGoalie = isGoalie(position);
  const playerIsPitcher = isPitcher(position);

  if (playerIsGoalie && (sport === 'hockey' || sport === 'soccer')) {
    if (sport === 'hockey') {
      return { games: 0, wins: 0, losses: 0, ties: 0, minutesPlayed: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0 };
    }
    return { games: 0, wins: 0, losses: 0, ties: 0, minutesPlayed: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0 };
  }

  if (playerIsGoalie && sport === 'lacrosse') {
    return { games: 0, wins: 0, losses: 0, minutesPlayed: 0, shotsAgainst: 0, saves: 0, goalsAgainst: 0, groundBalls: 0 };
  }

  if (playerIsPitcher && (sport === 'baseball' || sport === 'softball')) {
    return { starts: 0, wins: 0, losses: 0, innings: 0, completeGames: 0, strikeouts: 0, walks: 0, hits: 0, homeRuns: 0, shutouts: 0, earnedRuns: 0 };
  }

  switch (sport) {
    case 'hockey':
      return { gamesPlayed: 0, goals: 0, assists: 0, pim: 0, plusMinus: 0 };
    case 'baseball':
    case 'softball':
      return { gamesPlayed: 0, atBats: 0, hits: 0, walks: 0, strikeouts: 0, rbi: 0, runs: 0, homeRuns: 0 };
    case 'basketball':
      return { gamesPlayed: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 };
    case 'soccer':
      return { gamesPlayed: 0, goals: 0, assists: 0, yellowCards: 0 };
    case 'lacrosse':
      return { gamesPlayed: 0, goals: 0, assists: 0, groundBalls: 0, causedTurnovers: 0, shots: 0, shotsOnGoal: 0 };
    default:
      return { gamesPlayed: 0, goals: 0, assists: 0, pim: 0, plusMinus: 0 };
  }
}

// Get goalie stat headers (includes GAA for both hockey and soccer)
function getGoalieHeaders(sport: Sport): string[] {
  if (sport === 'lacrosse') {
    return ['GP', 'W-L', 'GAA', 'SA', 'SV', 'SV%', 'GB'];
  }
  // Soccer uses W-L-D (Draws), hockey uses W-L-T (Ties)
  const recordHeader = sport === 'soccer' ? 'W-L-D' : 'W-L-T';
  return ['GP', recordHeader, 'MP', 'GAA', 'SA', 'SV', 'SV%'];
}

export default function TeamStatsScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const addGameLog = useTeamStore((s) => s.addGameLog);
  const removeGameLog = useTeamStore((s) => s.removeGameLog);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  const sport = teamSettings.sport || 'hockey';

  // Get current player and check their roles
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isAdmin = currentPlayer?.roles?.includes('admin') ?? false;
  const isCoach = currentPlayer?.roles?.includes('coach') ?? false;

  // Check if user can edit a specific player's stats
  const canEditPlayer = (playerId: string): boolean => {
    // Admins and coaches can edit anyone's stats
    if (isAdmin || isCoach) return true;
    // If allowPlayerSelfStats is enabled, players can edit their own stats
    if (teamSettings.allowPlayerSelfStats && playerId === currentPlayerId) return true;
    return false;
  };

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editStats, setEditStats] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState<EditMode>('skater'); // Track whether editing pitcher/batter or goalie/skater stats
  const [gameDate, setGameDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Get record from team settings
  const wins = teamSettings.record?.wins ?? 0;
  const losses = teamSettings.record?.losses ?? 0;
  const ties = teamSettings.record?.ties ?? 0;
  const otLosses = teamSettings.record?.otLosses ?? 0;

  // Games played is the sum of wins + losses + ties + OTL (for hockey)
  const gamesPlayed = sport === 'hockey'
    ? wins + losses + ties + otLosses
    : wins + losses + ties;

  // Win percentage calculation - format as .XXX (three decimal places)
  const winPercentage = gamesPlayed > 0
    ? (wins / gamesPlayed).toFixed(3)
    : '.000';

  // Active players count
  const activePlayers = players.filter((p) => p.status === 'active').length;

  // Calculate team totals
  const teamTotals = calculateTeamTotals(players, sport);

  // Open edit modal for a player with specific mode (pitcher/batter, goalie/skater)
  const openEditModal = (player: Player, mode: EditMode) => {
    // Check if user has permission to edit this player's stats
    if (!canEditPlayer(player.id)) {
      return; // Silently return if user doesn't have permission
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayer(player);
    setEditMode(mode);
    setGameDate(new Date()); // Reset to today's date

    // Determine which position to use for getting stat fields based on mode
    let positionForStats: string;
    if (mode === 'pitcher') {
      positionForStats = 'P';
    } else if (mode === 'goalie') {
      positionForStats = (sport === 'hockey' || sport === 'lacrosse') ? 'G' : 'GK';
    } else {
      // For batter/skater, use a non-pitcher/non-goalie position
      positionForStats = 'batter';
    }

    const playerStatFields = getStatFields(sport, positionForStats);

    // Start with empty stats (zeros) for entering a new game's stats
    const statsObj: Record<string, string> = {};
    playerStatFields.forEach((field) => {
      statsObj[field.key] = '0';
    });
    setEditStats(statsObj);
    setEditModalVisible(true);
  };

  // Save stats as a game log entry
  const saveStats = () => {
    if (!selectedPlayer) return;

    // Check if date is in the future
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    if (gameDate > today) {
      Alert.alert('Invalid Date', 'Cannot add stats for future dates.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss(); // Dismiss keyboard on save

    // Determine which position to use for getting stat fields based on edit mode
    let positionForStats: string;
    let statType: 'skater' | 'goalie' | 'batter' | 'pitcher';
    if (editMode === 'pitcher') {
      positionForStats = 'P';
      statType = 'pitcher';
    } else if (editMode === 'goalie') {
      positionForStats = (sport === 'hockey' || sport === 'lacrosse') ? 'G' : 'GK';
      statType = 'goalie';
    } else if (editMode === 'batter') {
      positionForStats = 'batter';
      statType = 'batter';
    } else {
      positionForStats = 'batter';
      statType = 'skater';
    }

    const playerStatFields = getStatFields(sport, positionForStats);
    const newStats: Record<string, number> = {};
    playerStatFields.forEach((field) => {
      newStats[field.key] = parseInt(editStats[field.key] || '0', 10) || 0;
    });

    // Create game log entry
    const gameLogEntry: GameLogEntry = {
      id: Date.now().toString(),
      date: gameDate.toISOString(),
      stats: newStats as unknown as PlayerStats,
      statType,
    };

    // Add game log
    addGameLog(selectedPlayer.id, gameLogEntry);

    // Recalculate cumulative stats from all game logs of this type
    const updatedPlayer = players.find(p => p.id === selectedPlayer.id);
    const allLogs = [...(updatedPlayer?.gameLogs || []), gameLogEntry].filter(log => log.statType === statType);

    const cumulativeStats: Record<string, number> = {};
    allLogs.forEach(log => {
      const logStats = log.stats as unknown as Record<string, number>;
      Object.keys(logStats).forEach(key => {
        cumulativeStats[key] = (cumulativeStats[key] || 0) + (logStats[key] || 0);
      });
    });

    // Add games played count (each log = 1 game)
    if (editMode === 'goalie') {
      cumulativeStats.games = allLogs.length;
    } else {
      cumulativeStats.gamesPlayed = allLogs.length;
    }

    // Save cumulative stats to the appropriate stats field based on edit mode
    if (editMode === 'pitcher') {
      updatePlayer(selectedPlayer.id, { pitcherStats: cumulativeStats as unknown as BaseballPitcherStats });
    } else if (editMode === 'goalie') {
      updatePlayer(selectedPlayer.id, { goalieStats: cumulativeStats as unknown as HockeyGoalieStats });
    } else {
      updatePlayer(selectedPlayer.id, { stats: cumulativeStats as unknown as PlayerStats });
    }

    // Sync updated stats to Supabase
    if (activeTeamId) {
      const updated = useTeamStore.getState().players.find(p => p.id === selectedPlayer.id);
      if (updated) pushPlayerToSupabase(updated, activeTeamId).catch(console.error);
    }

    // Reset form for next entry
    const emptyStats: Record<string, string> = {};
    playerStatFields.forEach((field) => {
      emptyStats[field.key] = '0';
    });
    setEditStats(emptyStats);
    setGameDate(new Date());

    // Show success message
    Alert.alert('Stats Saved', 'Game stats have been saved successfully.');
  };

  // Delete a game log entry and recalculate cumulative stats
  const handleDeleteGameLog = (gameLogId: string, logStatType: 'skater' | 'goalie' | 'batter' | 'pitcher') => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    removeGameLog(selectedPlayer.id, gameLogId);

    // Get updated player after removal
    const updatedPlayer = players.find(p => p.id === selectedPlayer.id);
    const remainingLogs = (updatedPlayer?.gameLogs || []).filter(log => log.id !== gameLogId && log.statType === logStatType);

    // Recalculate cumulative stats
    const cumulativeStats: Record<string, number> = {};
    remainingLogs.forEach(log => {
      const logStats = log.stats as unknown as Record<string, number>;
      Object.keys(logStats).forEach(key => {
        cumulativeStats[key] = (cumulativeStats[key] || 0) + (logStats[key] || 0);
      });
    });

    // Add games played count (each log = 1 game)
    if (remainingLogs.length > 0) {
      if (logStatType === 'goalie') {
        cumulativeStats.games = remainingLogs.length;
      } else {
        cumulativeStats.gamesPlayed = remainingLogs.length;
      }
    }

    // Update appropriate stats field
    if (logStatType === 'pitcher') {
      updatePlayer(selectedPlayer.id, { pitcherStats: remainingLogs.length > 0 ? cumulativeStats as unknown as BaseballPitcherStats : undefined });
    } else if (logStatType === 'goalie') {
      updatePlayer(selectedPlayer.id, { goalieStats: remainingLogs.length > 0 ? cumulativeStats as unknown as HockeyGoalieStats : undefined });
    } else {
      updatePlayer(selectedPlayer.id, { stats: remainingLogs.length > 0 ? cumulativeStats as unknown as PlayerStats : undefined });
    }
  };

  // Get stat fields for the currently selected player (for edit modal) based on edit mode
  const currentStatFields = selectedPlayer ? (() => {
    let positionForStats: string;
    if (editMode === 'pitcher') {
      positionForStats = 'P';
    } else if (editMode === 'goalie') {
      positionForStats = (sport === 'hockey' || sport === 'lacrosse') ? 'G' : 'GK';
    } else {
      positionForStats = 'batter';
    }
    return getStatFields(sport, positionForStats);
  })() : [];

  // Sort players by points — exclude coaches and parents (no stats)
  const sortedPlayers = [...players].filter(
    (p) => p.position !== 'Coach' && p.position !== 'Parent' && !p.roles?.includes('coach') && !p.roles?.includes('parent')
  ).sort((a, b) => {
    const aStats = a.stats;
    const bStats = b.stats;

    if (!aStats && !bStats) return 0;
    if (!aStats) return 1;
    if (!bStats) return -1;

    switch (sport) {
      case 'hockey': {
        const aTotal = (aStats as HockeyStats).goals + (aStats as HockeyStats).assists;
        const bTotal = (bStats as HockeyStats).goals + (bStats as HockeyStats).assists;
        return bTotal - aTotal;
      }
      case 'baseball':
      case 'softball': {
        return (bStats as BaseballStats).hits - (aStats as BaseballStats).hits;
      }
      case 'basketball': {
        return (bStats as BasketballStats).points - (aStats as BasketballStats).points;
      }
      case 'soccer': {
        const aTotal = (aStats as SoccerStats).goals + (aStats as SoccerStats).assists;
        const bTotal = (bStats as SoccerStats).goals + (bStats as SoccerStats).assists;
        return bTotal - aTotal;
      }
      case 'lacrosse': {
        const aTotal = (aStats as LacrosseStats).goals + (aStats as LacrosseStats).assists;
        const bTotal = (bStats as LacrosseStats).goals + (bStats as LacrosseStats).assists;
        return bTotal - aTotal;
      }
      default:
        return 0;
    }
  });

  const statHeaders = getStatHeaders(sport);

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="flex-row items-center px-5 pt-2 pb-4"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="flex-row items-center"
          >
            <ChevronLeft size={24} color="#67e8f9" />
            <Text className="text-cyan-400 text-base ml-1">Back</Text>
          </Pressable>
        </Animated.View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Title */}
          <Animated.View entering={FadeInDown.delay(50).springify()} className="mb-6">
            <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{teamName}</Text>
            <Text className="text-slate-400 text-base mt-1">Team Statistics</Text>
          </Animated.View>

          {/* Record Card */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            className="bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-2xl p-5 mb-6 border border-cyan-500/30"
          >
            <View className="flex-row items-center mb-3">
              <Trophy size={24} color="#67e8f9" />
              <Text className="text-cyan-400 text-lg font-semibold ml-2">Season Record</Text>
            </View>
            <View className="flex-row justify-around">
              <View className="items-center">
                <Text className="text-green-400 text-4xl font-bold">{wins}</Text>
                <Text className="text-slate-400 text-sm">Wins</Text>
              </View>
              <View className="items-center">
                <Text className="text-red-400 text-4xl font-bold">{losses}</Text>
                <Text className="text-slate-400 text-sm">Losses</Text>
              </View>
              <View className="items-center">
                <Text className="text-amber-400 text-4xl font-bold">{ties}</Text>
                <Text className="text-slate-400 text-sm">{sport === 'soccer' ? 'Draws' : 'Ties'}</Text>
              </View>
              {sport === 'hockey' && (
                <View className="items-center">
                  <Text className="text-purple-400 text-4xl font-bold">{otLosses}</Text>
                  <Text className="text-slate-400 text-sm">OTL</Text>
                </View>
              )}
            </View>
            <View className="mt-4 pt-4 border-t border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <Text className="text-slate-400">Win Percentage</Text>
                <Text className="text-white text-xl font-bold">{winPercentage}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Stats Grid */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Season Statistics
          </Text>

          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 mb-6"
          >
            <View className="flex-row items-center justify-around">
              <View className="items-center">
                <Text className="text-white text-2xl font-bold">{gamesPlayed}</Text>
                <Text className="text-slate-500 text-xs">GP</Text>
              </View>
              {teamTotals.map((total) => (
                <View key={total.label} className="items-center">
                  <Text className="text-white text-2xl font-bold">{total.value}</Text>
                  <Text className="text-slate-500 text-xs">{total.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Roster Stats */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Roster
          </Text>

          <View className="flex-row flex-wrap justify-between mb-6">
            <View className="w-[48%] mb-3">
              <StatCard
                icon={<Users size={20} color="#22c55e" />}
                label="Active Players"
                value={activePlayers}
                subtitle="On roster"
                color="#22c55e"
                index={1}
              />
            </View>
            <View className="w-[48%] mb-3">
              <StatCard
                icon={<Award size={20} color="#a78bfa" />}
                label="Total Roster"
                value={players.length}
                subtitle="Including reserves"
                color="#a78bfa"
                index={2}
              />
            </View>
          </View>

          {/* Player Stats Table */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
            Player Statistics
          </Text>

          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            className="bg-slate-800/60 rounded-2xl border border-slate-700/50 overflow-hidden"
          >
            {/* Table Header for Skaters */}
            <View className="flex-row items-center px-3 py-3 bg-slate-700/50 border-b border-slate-700">
              <Text className="text-slate-300 font-semibold" style={{ flex: 1 }}>Player</Text>
              <Text className="text-slate-300 font-semibold text-center text-xs" style={{ width: 40 }}>Pos</Text>
              <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                {statHeaders.map((header) => (
                  <Text key={header} className="text-slate-300 font-semibold text-center text-xs" style={{ width: 36 }}>
                    {header}
                  </Text>
                ))}
              </View>
              <View style={{ width: 16 }} />
            </View>

            {/* Table Rows - Non-Goalies/Non-Pitchers (includes players with multiple positions that have batting positions) */}
            {sortedPlayers.filter(p => {
              // For hockey/soccer/lacrosse: show if player has any non-goalie position
              if (sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') {
                return playerHasNonGoaliePositions(p);
              }
              // For baseball/softball: show if player has any non-pitcher position
              if (sport === 'baseball' || sport === 'softball') {
                return playerHasNonPitcherPositions(p);
              }
              return true;
            }).map((player, index, arr) => {
              // For batting stats, always use non-pitcher position stats
              const statValues = getStatValues(sport, player.stats, 'batter');
              const showBorder = index !== arr.length - 1 ||
                (sport === 'hockey' || sport === 'soccer') ||
                (sport === 'baseball' && sortedPlayers.some(p => playerIsPitcher(p)));
              const canEdit = canEditPlayer(player.id);
              return (
                <Pressable
                  key={player.id}
                  onPress={() => openEditModal(player, sport === 'baseball' ? 'batter' : 'skater')}
                  disabled={!canEdit}
                  className={`flex-row items-center px-3 py-3 ${canEdit ? 'active:bg-slate-700/50' : ''} ${
                    showBorder ? 'border-b border-slate-700/50' : ''
                  }`}
                >
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                    <Text className="text-cyan-400 font-medium text-xs mr-1" style={{ flexShrink: 0 }}>#{player.number}</Text>
                    <Text className="text-white text-sm" style={{ flexShrink: 1, flexGrow: 1 }} numberOfLines={1}>{formatName(getPlayerName(player))}</Text>
                  </View>
                  <Text className="text-slate-400 text-center text-xs" style={{ width: 40, flexShrink: 0 }}>{getDisplayPosition(player)}</Text>
                  <View style={{ flexDirection: 'row', marginLeft: 8, flexShrink: 0 }}>
                    {statValues.map((value, i) => (
                      <Text key={i} className="text-slate-300 text-center text-sm" style={{ width: 36 }}>
                        {value}
                      </Text>
                    ))}
                  </View>
                  <View style={{ width: 16, alignItems: 'center', flexShrink: 0 }}>
                    {canEdit && <ChevronRight size={14} color="#64748b" />}
                  </View>
                </Pressable>
              );
            })}

            {/* Pitcher Section for Baseball */}
            {sport === 'baseball' && sortedPlayers.some(p => playerIsPitcher(p)) && (
              <>
                {/* Pitcher Header */}
                <View className="flex-row items-center px-2 py-3 bg-slate-700/50 border-b border-slate-700">
                  <Text className="text-slate-300 font-semibold text-xs" style={{ width: 76 }}>Pitchers</Text>
                  <View className="flex-row flex-1 justify-between">
                    {getPitcherHeaders().map((header) => (
                      <Text key={header} className="text-slate-300 font-semibold text-center text-[10px]" style={{ width: 28 }}>
                        {header}
                      </Text>
                    ))}
                  </View>
                  <View className="w-3" />
                </View>

                {/* Pitcher Rows */}
                {sortedPlayers.filter(p => playerIsPitcher(p)).map((player, index, arr) => {
                  const statValues = getStatValues(sport, player.pitcherStats, 'P');
                  const canEdit = canEditPlayer(player.id);
                  return (
                    <Pressable
                      key={`pitcher-${player.id}`}
                      onPress={() => openEditModal(player, 'pitcher')}
                      disabled={!canEdit}
                      className={`flex-row items-center px-2 py-3 ${canEdit ? 'active:bg-slate-700/50' : ''} ${
                        index !== arr.length - 1 ? 'border-b border-slate-700/50' : ''
                      }`}
                    >
                      <View className="flex-row items-center" style={{ width: 76 }}>
                        <Text className="text-cyan-400 font-medium text-[10px] mr-0.5">#{player.number}</Text>
                        <Text className="text-white text-xs" numberOfLines={1}>{formatName(getPlayerName(player))}</Text>
                      </View>
                      <View className="flex-row flex-1 justify-between">
                        {statValues.map((value, i) => (
                          <Text key={i} className="text-slate-300 text-center text-xs" style={{ width: 28 }}>
                            {value}
                          </Text>
                        ))}
                      </View>
                      <View className="w-3 items-center">
                        {canEdit && <ChevronRight size={12} color="#64748b" />}
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}

            {/* Goalie Section for Hockey/Soccer/Lacrosse */}
            {(sport === 'hockey' || sport === 'soccer' || sport === 'lacrosse') && sortedPlayers.some(p => playerIsGoalie(p)) && (
              <>
                {/* Goalie Header */}
                <View className="flex-row items-center px-3 py-3 bg-slate-700/50 border-b border-slate-700">
                  <Text className="text-slate-300 font-semibold flex-1">Goalies</Text>
                  <View className="flex-row ml-2">
                    {getGoalieHeaders(sport).map((header) => (
                      <Text key={header} className="text-slate-300 font-semibold w-11 text-center text-xs">
                        {header}
                      </Text>
                    ))}
                  </View>
                  <View className="w-4" />
                </View>

                {/* Goalie Rows */}
                {sortedPlayers.filter(p => playerIsGoalie(p)).map((player, index, arr) => {
                  const statValues = getStatValues(sport, player.goalieStats, (sport === 'hockey' || sport === 'lacrosse') ? 'G' : 'GK');
                  const canEdit = canEditPlayer(player.id);
                  return (
                    <Pressable
                      key={`goalie-${player.id}`}
                      onPress={() => openEditModal(player, 'goalie')}
                      disabled={!canEdit}
                      className={`flex-row items-center px-3 py-3 ${canEdit ? 'active:bg-slate-700/50' : ''} ${
                        index !== arr.length - 1 ? 'border-b border-slate-700/50' : ''
                      }`}
                    >
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
                        <Text className="text-cyan-400 font-medium text-xs mr-1" style={{ flexShrink: 0 }}>#{player.number}</Text>
                        <Text className="text-white text-sm" style={{ flexShrink: 1, flexGrow: 1 }} numberOfLines={1}>{formatName(getPlayerName(player))}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', marginLeft: 8, flexShrink: 0 }}>
                        {statValues.map((value, i) => (
                          <Text key={i} className="text-slate-300 text-center text-sm" style={{ width: 44 }}>
                            {value}
                          </Text>
                        ))}
                      </View>
                      <View style={{ width: 16, alignItems: 'center', flexShrink: 0 }}>
                        {canEdit && <ChevronRight size={14} color="#64748b" />}
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Stats Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-slate-900">
            <LinearGradient
              colors={['#0f172a', '#1e293b', '#0f172a']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />

            <SafeAreaView className="flex-1" edges={['top']}>
              {/* Modal Header */}
              <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b border-slate-700/50">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditModalVisible(false);
                  }}
                  className="p-2 -ml-2"
                >
                  <X size={24} color="#94a3b8" />
                </Pressable>
                <Text className="text-white text-lg font-semibold">
                  Add {editMode === 'pitcher' ? 'Pitching' : editMode === 'goalie' ? 'Goalie' : editMode === 'batter' ? 'Batting' : 'Player'} Stats
                </Text>
                <Pressable
                  onPress={saveStats}
                  className="px-4 py-2 bg-cyan-500 rounded-lg"
                >
                  <Text className="text-white font-semibold">Save</Text>
                </Pressable>
              </View>

              <ScrollView className="flex-1 px-5 pt-3" keyboardShouldPersistTaps="handled">
                {/* Player Info */}
                {selectedPlayer && (
                  <View className="mb-3">
                    <Text className="text-cyan-400 text-sm">#{selectedPlayer.number}</Text>
                    <Text className="text-white text-xl font-bold">{selectedPlayer.firstName} {selectedPlayer.lastName}</Text>
                  </View>
                )}

                {/* Date Picker */}
                <View className="mb-4">
                  <Text className="text-slate-400 text-xs mb-1">Game Date</Text>
                  <Pressable
                    onPress={() => setShowDatePicker(!showDatePicker)}
                    className="bg-slate-800 rounded-lg px-3 py-2.5 border border-slate-700 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center">
                      <Calendar size={18} color="#67e8f9" />
                      <Text className="text-white text-base ml-2">
                        {gameDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#64748b" />
                  </Pressable>
                  {showDatePicker && (
                    <View className="bg-slate-800 rounded-lg mt-2 overflow-hidden items-center">
                      <DateTimePicker
                        value={gameDate}
                        mode="date"
                        display="inline"
                        onChange={(event, date) => {
                          if (date) setGameDate(date);
                          if (Platform.OS === 'android') setShowDatePicker(false);
                        }}
                        themeVariant="dark"
                        accentColor="#67e8f9"
                      />
                    </View>
                  )}
                </View>

                {/* Stat Fields */}
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Game Stats
                </Text>
                {currentStatFields.map((field) => (
                  <View key={field.key} className="mb-2.5">
                    <Text className="text-slate-400 text-xs mb-1">{field.label}</Text>
                    {field.key === 'plusMinus' ? (
                      // Special +/- control with increment/decrement buttons
                      <View className="flex-row items-center">
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const current = parseInt(editStats[field.key] || '0', 10) || 0;
                            setEditStats({ ...editStats, [field.key]: String(current - 1) });
                          }}
                          className="bg-red-500/20 border border-red-500/50 rounded-lg w-14 h-11 items-center justify-center active:bg-red-500/40"
                        >
                          <Text className="text-red-400 text-xl font-bold">−</Text>
                        </Pressable>
                        <View className="flex-1 mx-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 items-center">
                          <Text className="text-white text-lg font-semibold">
                            {(() => {
                              const val = parseInt(editStats[field.key] || '0', 10) || 0;
                              return val > 0 ? `+${val}` : String(val);
                            })()}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            const current = parseInt(editStats[field.key] || '0', 10) || 0;
                            setEditStats({ ...editStats, [field.key]: String(current + 1) });
                          }}
                          className="bg-green-500/20 border border-green-500/50 rounded-lg w-14 h-11 items-center justify-center active:bg-green-500/40"
                        >
                          <Text className="text-green-400 text-xl font-bold">+</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <TextInput
                        className="bg-slate-800 rounded-lg px-3 py-2.5 text-white text-base border border-slate-700"
                        value={editStats[field.key] === '0' ? '' : editStats[field.key]}
                        onChangeText={(text) => setEditStats({ ...editStats, [field.key]: text.replace(/[^0-9]/g, '') || '0' })}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor="#64748b"
                      />
                    )}
                  </View>
                ))}

                {/* Game Log History */}
                {selectedPlayer && (() => {
                  const currentStatType = editMode === 'pitcher' ? 'pitcher' : editMode === 'goalie' ? 'goalie' : editMode === 'batter' ? 'batter' : 'skater';
                  // Get fresh player data from store to reflect updates
                  const currentPlayer = players.find(p => p.id === selectedPlayer.id);
                  const playerLogs = (currentPlayer?.gameLogs || [])
                    .filter(log => log.statType === currentStatType)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .reverse();

                  if (playerLogs.length === 0) return null;

                  // Get headers based on sport/mode
                  let logHeaders: string[] = [];
                  if (editMode === 'pitcher') {
                    logHeaders = ['IP', 'K', 'BB', 'H', 'ER'];
                  } else if (editMode === 'goalie') {
                    if (sport === 'lacrosse') {
                      logHeaders = ['MP', 'SA', 'SV', 'GA', 'GB'];
                    } else {
                      logHeaders = ['MP', 'SA', 'SV', 'GA'];
                    }
                  } else if (sport === 'hockey') {
                    logHeaders = ['G', 'A', 'PIM', '+/-'];
                  } else if (sport === 'baseball' || sport === 'softball') {
                    logHeaders = ['AB', 'H', 'HR', 'RBI', 'K'];
                  } else if (sport === 'basketball') {
                    logHeaders = ['PTS', 'REB', 'AST', 'STL', 'BLK'];
                  } else if (sport === 'soccer') {
                    logHeaders = ['G', 'A', 'YC'];
                  } else if (sport === 'lacrosse') {
                    logHeaders = ['G', 'A', 'GB', 'CT'];
                  }

                  // Map headers to stat keys
                  const getStatKey = (header: string): string => {
                    const keyMap: Record<string, string> = {
                      'G': 'goals', 'A': 'assists', 'PIM': 'pim', '+/-': 'plusMinus',
                      'AB': 'atBats', 'H': 'hits', 'HR': 'homeRuns', 'RBI': 'rbi', 'K': 'strikeouts', 'BB': 'walks', 'R': 'runs',
                      'PTS': 'points', 'REB': 'rebounds', 'AST': 'assists', 'STL': 'steals', 'BLK': 'blocks',
                      'YC': 'yellowCards',
                      'IP': 'innings', 'ER': 'earnedRuns',
                      'MP': 'minutesPlayed', 'SA': 'shotsAgainst', 'SV': 'saves', 'GA': 'goalsAgainst',
                      'GB': 'groundBalls', 'CT': 'causedTurnovers',
                    };
                    return keyMap[header] || header.toLowerCase();
                  };

                  return (
                    <View className="mt-4 mb-6">
                      <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        Game Log ({playerLogs.length})
                      </Text>
                      <View className="bg-slate-800/60 rounded-xl border border-slate-700/50 overflow-hidden">
                        {/* Header Row */}
                        <View className="flex-row items-center px-3 py-1.5 bg-slate-700/50 border-b border-slate-700">
                          <Text className="text-slate-400 text-[10px] font-semibold w-12">Date</Text>
                          <View className="flex-row flex-1 justify-around">
                            {logHeaders.map((header) => (
                              <Text key={header} className="text-slate-400 text-[10px] font-semibold w-8 text-center">
                                {header}
                              </Text>
                            ))}
                          </View>
                          <View className="w-6" />
                        </View>
                        {/* Data Rows */}
                        {playerLogs.map((log, index) => {
                          const logStats = log.stats as unknown as Record<string, number>;
                          const dateStr = new Date(log.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                          return (
                            <View
                              key={log.id}
                              className={`flex-row items-center px-3 py-2 ${index !== playerLogs.length - 1 ? 'border-b border-slate-700/50' : ''}`}
                            >
                              <Text className="text-cyan-400 text-xs font-medium w-12">{dateStr}</Text>
                              <View className="flex-row flex-1 justify-around">
                                {logHeaders.map((header) => {
                                  const key = getStatKey(header);
                                  const value = logStats[key] ?? 0;
                                  // Format +/- with sign
                                  const displayValue = header === '+/-' && value > 0 ? `+${value}` : String(value);
                                  return (
                                    <Text key={header} className="text-white text-xs w-8 text-center">
                                      {displayValue}
                                    </Text>
                                  );
                                })}
                              </View>
                              <Pressable
                                onPress={() => handleDeleteGameLog(log.id, currentStatType)}
                                className="w-6 items-center"
                              >
                                <Trash2 size={14} color="#ef4444" />
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })()}
              </ScrollView>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
