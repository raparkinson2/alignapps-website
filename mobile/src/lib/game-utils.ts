import { Player, Sport, getPlayerPositions } from '@/lib/store';

export const hexToColorName = (hex: string): string => {
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

  return hex; // Return as-is if not a recognized format
};

// Helper to convert color names to hex (reverse of hexToColorName)
export const colorNameToHex = (name: string): string => {
  const nameMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#1a1a1a',
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
  return nameMap[name.toLowerCase()] || name;
};

// Check if player is a goalie (checks all positions)
export function isGoalie(position: string): boolean {
  return position === 'G' || position === 'GK';
}

// Check if any of the player's positions is a goalie
export function playerIsGoalie(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => isGoalie(p));
}

// Check if player is a pitcher
export function isPitcher(position: string): boolean {
  return position === 'P';
}

// Check if any of the player's positions is a pitcher
export function playerIsPitcher(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.includes('P');
}

// Check if player has non-pitcher positions (for baseball)
export function playerHasNonPitcherPositions(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => p !== 'P');
}

// Check if player has non-goalie positions (for hockey/soccer/lacrosse)
export function playerHasNonGoaliePositions(player: Player): boolean {
  const positions = getPlayerPositions(player);
  return positions.some(p => !isGoalie(p));
}

// Get display position string (e.g., "P/3B" or "LW/C")
export function getDisplayPosition(player: Player): string {
  const positions = getPlayerPositions(player);
  return positions.join('/');
}

// Format name as "F. LastName"
export function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${firstName.charAt(0)}. ${lastName}`;
}

// Get stat column headers for table display based on sport
export function getGameStatHeaders(sport: Sport): string[] {
  switch (sport) {
    case 'hockey':
      return ['G', 'A', 'P', 'PIM', '+/-'];
    case 'baseball':
    case 'softball':
      return ['AB', 'H', 'BB', 'K', 'RBI', 'R', 'HR'];
    case 'basketball':
      return ['PTS', 'REB', 'AST', 'STL', 'BLK'];
    case 'soccer':
      return ['G', 'A', 'YC'];
    case 'lacrosse':
      return ['G', 'A', 'GB', 'CT'];
    default:
      return ['G', 'A', 'P', 'PIM', '+/-'];
  }
}

// Get goalie stat headers for table display (includes calculated stats)
export function getGameGoalieHeaders(sport: Sport): string[] {
  if (sport === 'lacrosse') {
    return ['MP', 'SA', 'SV', 'GA', 'GAA', 'SV%', 'GB'];
  }
  return ['MP', 'SA', 'SV', 'GA', 'GAA', 'SV%'];
}

// Get pitcher stat headers for table display (includes ERA calculated)
export function getGamePitcherHeaders(): string[] {
  return ['IP', 'K', 'BB', 'H', 'HR', 'ER', 'ERA'];
}

// Get stat values for a player for this specific game
export function getGameStatValuesForPlayer(
  sport: Sport,
  player: Player,
  gameId: string,
  isGoalieStats: boolean = false,
  isPitcherStats: boolean = false
): (number | string)[] {
  // Find the game log for this specific game
  const gameLogs = player.gameLogs || [];

  // Determine which stat type to look for
  let statType: string;
  if (isPitcherStats) {
    statType = 'pitcher';
  } else if (isGoalieStats) {
    statType = sport === 'lacrosse' ? 'lacrosse_goalie' : 'goalie';
  } else if (sport === 'baseball' || sport === 'softball') {
    statType = 'batter';
  } else if (sport === 'lacrosse') {
    statType = 'lacrosse';
  } else {
    statType = 'skater';
  }

  // Find by gameId field first, then fall back to id prefix match for backwards compatibility
  const gameLog = gameLogs.find(log =>
    (log.gameId === gameId || log.id.startsWith(gameId)) && log.statType === statType
  );

  if (!gameLog) {
    // Return zeros based on sport/type
    if (isPitcherStats) return [0, 0, 0, 0, 0, 0, '-'];
    if (isGoalieStats && sport === 'lacrosse') return [0, 0, 0, 0, '-', '-', 0];
    if (isGoalieStats) return [0, 0, 0, 0, '-', '-'];
    switch (sport) {
      case 'hockey': return [0, 0, 0, 0, 0];
      case 'baseball':
      case 'softball': return [0, 0, 0, 0, 0, 0, 0];
      case 'basketball': return [0, 0, 0, 0, 0];
      case 'soccer': return [0, 0, 0];
      case 'lacrosse': return [0, 0, 0, 0];
      default: return [0, 0, 0, 0, 0];
    }
  }

  const stats = gameLog.stats as unknown as Record<string, number>;

  // Return values in the correct order for headers
  if (isPitcherStats) {
    const innings = stats.innings ?? 0;
    const earnedRuns = stats.earnedRuns ?? 0;
    // Calculate ERA (Earned Run Average) - earned runs per 9 innings
    const era = innings > 0 ? ((earnedRuns / innings) * 9).toFixed(2) : '-';

    return [
      innings,
      stats.strikeouts ?? 0,
      stats.walks ?? 0,
      stats.hits ?? 0,
      stats.homeRuns ?? 0,
      earnedRuns,
      era
    ];
  }

  if (isGoalieStats) {
    const minutesPlayed = stats.minutesPlayed ?? 0;
    const shotsAgainst = stats.shotsAgainst ?? 0;
    const saves = stats.saves ?? 0;
    const goalsAgainst = stats.goalsAgainst ?? 0;

    // Calculate GAA (Goals Against Average) - goals per 60 minutes
    const gaa = minutesPlayed > 0 ? ((goalsAgainst / minutesPlayed) * 60).toFixed(2) : '0.00';

    // Calculate SV% (Save Percentage)
    const svPct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(0) + '%' : '-';

    if (sport === 'lacrosse') {
      return [
        minutesPlayed,
        shotsAgainst,
        saves,
        goalsAgainst,
        gaa,
        svPct,
        stats.groundBalls ?? 0
      ];
    }
    return [
      minutesPlayed,
      shotsAgainst,
      saves,
      goalsAgainst,
      gaa,
      svPct
    ];
  }

  switch (sport) {
    case 'hockey': {
      const goals = stats.goals ?? 0;
      const assists = stats.assists ?? 0;
      const points = goals + assists;
      const plusMinus = stats.plusMinus ?? 0;
      const plusMinusStr = plusMinus > 0 ? `+${plusMinus}` : `${plusMinus}`;
      return [goals, assists, points, stats.pim ?? 0, plusMinusStr];
    }
    case 'baseball':
    case 'softball':
      return [
        stats.atBats ?? 0,
        stats.hits ?? 0,
        stats.walks ?? 0,
        stats.strikeouts ?? 0,
        stats.rbi ?? 0,
        stats.runs ?? 0,
        stats.homeRuns ?? 0
      ];
    case 'basketball':
      return [
        stats.points ?? 0,
        stats.rebounds ?? 0,
        stats.assists ?? 0,
        stats.steals ?? 0,
        stats.blocks ?? 0
      ];
    case 'soccer':
      return [stats.goals ?? 0, stats.assists ?? 0, stats.yellowCards ?? 0];
    case 'lacrosse':
      return [
        stats.goals ?? 0,
        stats.assists ?? 0,
        stats.groundBalls ?? 0,
        stats.causedTurnovers ?? 0
      ];
    default:
      return [0, 0, 0, 0, 0];
  }
}

// Check if player has stats entered for this game
export function playerHasGameStats(player: Player, gameId: string): boolean {
  const gameLogs = player.gameLogs || [];
  return gameLogs.some(log => log.gameId === gameId || log.id.startsWith(gameId));
}

// Get stat field definitions based on sport and position
export function getGameStatFields(sport: Sport, position: string): { key: string; label: string }[] {
  const playerIsGoaliePos = isGoalie(position);
  const playerIsPitcherPos = isPitcher(position);

  // Goalie stats for hockey/soccer (no games field - each log = 1 GP)
  if (playerIsGoaliePos && (sport === 'hockey' || sport === 'soccer')) {
    if (sport === 'hockey') {
      return [
        { key: 'minutesPlayed', label: 'Minutes Played' },
        { key: 'shotsAgainst', label: 'Shots Against' },
        { key: 'saves', label: 'Saves' },
        { key: 'goalsAgainst', label: 'Goals Against' },
      ];
    }
    return [
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
    ];
  }

  // Lacrosse goalie stats
  if (playerIsGoaliePos && sport === 'lacrosse') {
    return [
      { key: 'minutesPlayed', label: 'Minutes Played' },
      { key: 'shotsAgainst', label: 'Shots Against' },
      { key: 'saves', label: 'Saves' },
      { key: 'goalsAgainst', label: 'Goals Against' },
      { key: 'groundBalls', label: 'Ground Balls' },
    ];
  }

  // Pitcher stats for baseball/softball
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
      ];
    default:
      return [];
  }
}
