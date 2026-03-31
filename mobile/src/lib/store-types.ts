// Sport Types and Positions
export type Sport = 'baseball' | 'basketball' | 'hockey' | 'lacrosse' | 'soccer' | 'softball';

export const SPORT_POSITIONS: Record<Sport, string[]> = {
  baseball: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'],
  basketball: ['PG', 'SG', 'SF', 'PF', 'C'],
  hockey: ['C', 'LW', 'RW', 'LD', 'RD', 'G'],
  lacrosse: ['G', 'A', 'M', 'D'],
  soccer: ['GK', 'DEF', 'MID', 'FWD'],
  softball: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SF'],
};

export const SPORT_POSITION_NAMES: Record<Sport, Record<string, string>> = {
  baseball: {
    P: 'Pitcher',
    C: 'Catcher',
    '1B': 'First Base',
    '2B': 'Second Base',
    '3B': 'Third Base',
    SS: 'Shortstop',
    LF: 'Left Field',
    CF: 'Center Field',
    RF: 'Right Field',
    DH: 'Designated Hitter',
  },
  basketball: {
    PG: 'Point Guard',
    SG: 'Shooting Guard',
    SF: 'Small Forward',
    PF: 'Power Forward',
    C: 'Center',
  },
  hockey: {
    C: 'Center',
    LW: 'Left Wing',
    RW: 'Right Wing',
    LD: 'Left Defense',
    RD: 'Right Defense',
    G: 'Goalie',
  },
  lacrosse: {
    G: 'Goalie',
    A: 'Attacker',
    M: 'Midfielder',
    D: 'Defender',
  },
  soccer: {
    GK: 'Goalkeeper',
    DEF: 'Defender',
    MID: 'Midfielder',
    FWD: 'Forward',
  },
  softball: {
    P: 'Pitcher',
    C: 'Catcher',
    '1B': 'First Base',
    '2B': 'Second Base',
    '3B': 'Third Base',
    SS: 'Shortstop',
    LF: 'Left Field',
    CF: 'Center Field',
    RF: 'Right Field',
    DH: 'Designated Hitter',
    SF: 'Short Fielder',
  },
};

// Map positions from one sport to another based on role similarity
export const POSITION_MAPPING: Record<Sport, Record<string, Record<Sport, string>>> = {
  baseball: {
    P: { baseball: 'P', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'P' },
    C: { baseball: 'C', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'C' },
    '1B': { baseball: '1B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '1B' },
    '2B': { baseball: '2B', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: '2B' },
    '3B': { baseball: '3B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '3B' },
    SS: { baseball: 'SS', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'SS' },
    LF: { baseball: 'LF', basketball: 'SG', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'LF' },
    CF: { baseball: 'CF', basketball: 'SF', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'CF' },
    RF: { baseball: 'RF', basketball: 'SF', hockey: 'RW', lacrosse: 'A', soccer: 'FWD', softball: 'RF' },
    DH: { baseball: 'DH', basketball: 'PF', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'DH' },
  },
  basketball: {
    PG: { baseball: 'SS', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'SS' },
    SG: { baseball: 'LF', basketball: 'SG', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'LF' },
    SF: { baseball: 'RF', basketball: 'SF', hockey: 'RW', lacrosse: 'A', soccer: 'FWD', softball: 'RF' },
    PF: { baseball: '3B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '3B' },
    C: { baseball: 'C', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'C' },
  },
  hockey: {
    G: { baseball: 'C', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'C' },
    LD: { baseball: '3B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '3B' },
    RD: { baseball: 'SS', basketball: 'C', hockey: 'RD', lacrosse: 'D', soccer: 'DEF', softball: 'SS' },
    C: { baseball: 'SS', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'SS' },
    LW: { baseball: 'LF', basketball: 'SG', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'LF' },
    RW: { baseball: 'RF', basketball: 'SF', hockey: 'RW', lacrosse: 'A', soccer: 'FWD', softball: 'RF' },
  },
  lacrosse: {
    G: { baseball: 'C', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'C' },
    A: { baseball: 'LF', basketball: 'SG', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'LF' },
    M: { baseball: 'SS', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'SS' },
    D: { baseball: '3B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '3B' },
  },
  soccer: {
    GK: { baseball: 'C', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'C' },
    DEF: { baseball: '3B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '3B' },
    MID: { baseball: 'SS', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'SS' },
    FWD: { baseball: 'LF', basketball: 'SG', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'LF' },
  },
  softball: {
    P: { baseball: 'P', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'P' },
    C: { baseball: 'C', basketball: 'C', hockey: 'G', lacrosse: 'G', soccer: 'GK', softball: 'C' },
    '1B': { baseball: '1B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '1B' },
    '2B': { baseball: '2B', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: '2B' },
    '3B': { baseball: '3B', basketball: 'PF', hockey: 'LD', lacrosse: 'D', soccer: 'DEF', softball: '3B' },
    SS: { baseball: 'SS', basketball: 'PG', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'SS' },
    LF: { baseball: 'LF', basketball: 'SG', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'LF' },
    CF: { baseball: 'CF', basketball: 'SF', hockey: 'C', lacrosse: 'M', soccer: 'MID', softball: 'CF' },
    RF: { baseball: 'RF', basketball: 'SF', hockey: 'RW', lacrosse: 'A', soccer: 'FWD', softball: 'RF' },
    DH: { baseball: 'DH', basketball: 'PF', hockey: 'LW', lacrosse: 'A', soccer: 'FWD', softball: 'DH' },
    SF: { baseball: 'CF', basketball: 'SF', hockey: 'RW', lacrosse: 'A', soccer: 'FWD', softball: 'SF' },
  },
};

// Helper to map a position from one sport to another
export const mapPosition = (currentPosition: string, fromSport: Sport, toSport: Sport): string => {
  if (fromSport === toSport) return currentPosition;

  // Check if we have a mapping for this position
  const sportMapping = POSITION_MAPPING[fromSport];
  if (sportMapping && sportMapping[currentPosition]) {
    return sportMapping[currentPosition][toSport];
  }

  // Fallback: return first position of the target sport
  return SPORT_POSITIONS[toSport][0];
};

export const SPORT_NAMES: Record<Sport, string> = {
  baseball: 'Baseball',
  basketball: 'Basketball',
  hockey: 'Hockey',
  lacrosse: 'Lacrosse',
  soccer: 'Soccer',
  softball: 'Softball',
};

// Returns 'Soccer' for US/Canada locales, 'Football' everywhere else
export function getSoccerName(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const isUSOrCA = locale.endsWith('-US') || locale.endsWith('-CA');
    return isUSOrCA ? 'Soccer' : 'Football';
  } catch {
    return 'Soccer';
  }
}

// Locale-aware sport display name
export function getSportName(sport: Sport): string {
  if (sport === 'soccer') return getSoccerName();
  return SPORT_NAMES[sport];
}

// Role Types
export type PlayerRole = 'admin' | 'captain' | 'coach' | 'parent';

// Player Status
export type PlayerStatus = 'active' | 'reserve';

// Duration type for injuries/suspensions
export type DurationUnit = 'days' | 'weeks' | 'games' | 'remainder_of_season';

export interface StatusDuration {
  value?: number; // Not needed for remainder_of_season
  unit: DurationUnit;
}

// Notification Preferences
export interface NotificationPreferences {
  gameInvites: boolean;
  gameReminderDayBefore: boolean;
  gameReminderHoursBefore: boolean;
  chatMessages: boolean;
  chatMentions: boolean; // Get notified when @mentioned in chat
  paymentReminders: boolean;
  refreshmentDutyReminders: boolean; // Beer/refreshment duty assignment + reminders
  pushToken?: string; // For future push notification implementation
}

export const defaultNotificationPreferences: NotificationPreferences = {
  gameInvites: true,
  gameReminderDayBefore: true,
  gameReminderHoursBefore: true,
  chatMessages: true,
  chatMentions: true,
  paymentReminders: true,
  refreshmentDutyReminders: true,
};

// Sport-specific player stats
export interface HockeyStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  pim: number; // Penalty minutes
  plusMinus: number; // +/-
}

export interface HockeyGoalieStats {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  minutesPlayed: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
}

export interface BaseballStats {
  gamesPlayed: number;
  atBats: number;
  hits: number;
  walks: number;
  strikeouts: number;
  rbi: number;
  runs: number;
  homeRuns: number;
}

export interface BaseballPitcherStats {
  starts: number;
  wins: number;
  losses: number;
  innings: number;
  completeGames: number;
  strikeouts: number;
  walks: number;
  hits: number;
  homeRuns: number;
  shutouts: number;
  earnedRuns: number;
}

export interface BasketballStats {
  gamesPlayed: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
}

export interface SoccerStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
}

export interface SoccerGoalieStats {
  games: number;
  wins: number;
  losses: number;
  ties: number;
  minutesPlayed: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
}

// Lacrosse field player stats
export interface LacrosseStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  groundBalls: number; // GB - securing loose balls
  causedTurnovers: number; // CT - forcing turnovers defensively
  shots: number;
  shotsOnGoal: number; // SOG
  faceOffWins?: number; // For face-off specialists (men's)
  faceOffAttempts?: number;
  drawControls?: number; // DC - for women's lacrosse
  drawAttempts?: number;
}

// Lacrosse goalie stats
export interface LacrosseGoalieStats {
  games: number;
  wins: number;
  losses: number;
  minutesPlayed: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  groundBalls: number; // Goalies also track ground balls
}

export type PlayerStats = HockeyStats | HockeyGoalieStats | BaseballStats | BaseballPitcherStats | BasketballStats | SoccerStats | SoccerGoalieStats | LacrosseStats | LacrosseGoalieStats;

// Game log entry for tracking individual game stats
export interface GameLogEntry {
  id: string;
  gameId?: string; // ID of the game this log is for
  date: string; // ISO string
  stats: PlayerStats;
  statType: 'skater' | 'goalie' | 'batter' | 'pitcher' | 'lacrosse' | 'lacrosse_goalie'; // Which type of stats this log is for
}

// Types
// Security Questions for password recovery
export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What is your favorite sports team?",
  "What was the make of your first car?",
  "What street did you grow up on?",
  "What is your favorite movie?",
] as const;

export type SecurityQuestion = typeof SECURITY_QUESTIONS[number];

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string; // For authentication
  securityQuestion?: SecurityQuestion; // For password recovery
  securityAnswer?: string; // Answer to security question (stored lowercase for comparison)
  phone?: string;
  number: string;
  position: string; // Primary position (first in positions array)
  positions?: string[]; // All positions player can play
  avatar?: string;
  roles: PlayerRole[]; // Array of roles - can be admin, captain, or both
  status: PlayerStatus; // active or reserve (this is separate from roles)
  isInjured?: boolean; // Player is injured
  isSuspended?: boolean; // Player is suspended
  injuryDuration?: StatusDuration; // Duration of injury
  suspensionDuration?: StatusDuration; // Duration of suspension
  statusEndDate?: string; // ISO date string (YYYY-MM-DD) when injury/suspension ends
  notificationPreferences?: NotificationPreferences;
  stats?: PlayerStats; // Regular player stats (batter for baseball, skater for hockey/soccer)
  pitcherStats?: BaseballPitcherStats; // Separate stats for pitching (baseball only)
  goalieStats?: HockeyGoalieStats | SoccerGoalieStats; // Separate stats for goalie (hockey/soccer only)
  gameLogs?: GameLogEntry[]; // Individual game stat logs
  unavailableDates?: string[]; // ISO date strings (YYYY-MM-DD) when player is unavailable
  associatedPlayerId?: string; // For parents: the player (child) they are associated with
}

// Helper to get full name from player
export const getPlayerName = (player: Player): string => {
  return `${player.firstName} ${player.lastName}`.trim();
};

// Helper to get initials from player (for avatar fallback)
export const getPlayerInitials = (player: Player): string => {
  const first = player.firstName?.charAt(0)?.toUpperCase() || '';
  const last = player.lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}`;
};

// Helper to get all positions for a player (returns positions array or falls back to single position)
export const getPlayerPositions = (player: Player): string[] => {
  if (player.positions && player.positions.length > 0) {
    return player.positions;
  }
  return [player.position];
};

// Helper to get primary position (first position)
export const getPrimaryPosition = (player: Player): string => {
  if (player.positions && player.positions.length > 0) {
    return player.positions[0];
  }
  return player.position;
};

// Helper to check if a player is unavailable due to injury/suspension on a specific date
export const isPlayerUnavailableForDate = (player: Player, dateStr: string): { unavailable: boolean; reason?: string } => {
  // Check if player is injured or suspended AND has an end date
  if ((player.isInjured || player.isSuspended) && player.statusEndDate) {
    // Parse dates for comparison (compare date strings directly for YYYY-MM-DD format)
    const gameDate = dateStr.split('T')[0]; // Ensure we have just the date part
    const endDate = player.statusEndDate;

    // If game date is on or before the end date, player is unavailable
    if (gameDate <= endDate) {
      const reason = player.isInjured ? 'Injured' : 'Suspended';
      return { unavailable: true, reason };
    }
  }

  // Also check unavailableDates (existing availability system)
  if (player.unavailableDates?.includes(dateStr.split('T')[0])) {
    return { unavailable: true, reason: 'Unavailable' };
  }

  return { unavailable: false };
};

// Hockey Lines Types
export interface HockeyForwardLine {
  lw?: string; // player id
  c?: string;  // player id
  rw?: string; // player id
}

export interface HockeyDefenseLine {
  ld?: string; // player id
  rd?: string; // player id
}

export interface HockeyGoalieLine {
  g?: string; // player id
}

export interface HockeyLineup {
  forwardLines: HockeyForwardLine[]; // 1-4 lines
  defenseLines: HockeyDefenseLine[]; // 1-4 lines
  goalieLines: HockeyGoalieLine[]; // 1-2 lines
  numForwardLines: number; // 1-4
  numDefenseLines: number; // 1-4
  numGoalieLines: number;  // 1-2
}

// Basketball Lineup Types
export interface BasketballStartingFive {
  pg?: string; // Point Guard - max 1
  guards: (string | undefined)[]; // Guards (G) - max 3
  forwards: (string | undefined)[]; // Forwards (F) - max 2
  centers: (string | undefined)[]; // Centers (C) - max 2
}

export interface BasketballLineup {
  starters: BasketballStartingFive;
  bench: (string | undefined)[]; // Bench spots (configurable)
  // Configuration for how many of each position in starting 5
  numGuards: number; // 0-3
  numForwards: number; // 0-2
  numCenters: number; // 0-2
  hasPG: boolean; // 0 or 1
  numBenchSpots: number; // Number of bench spots (default 10, configurable 0-15)
}

// Baseball Lineup Types
export interface BaseballLineup {
  lf?: string;  // Left Field
  cf?: string;  // Center Field
  rf?: string;  // Right Field
  thirdBase?: string; // 3B
  shortstop?: string; // SS
  secondBase?: string; // 2B
  firstBase?: string; // 1B
  pitcher?: string; // P
  catcher?: string; // C
  shortFielder?: string; // SF - 10th fielder for softball
}

// Batting Order Entry (player + position they'll play)
export interface BattingOrderEntry {
  playerId: string;
  position: string; // P, C, 1B, 2B, 3B, SS, LF, CF, RF, SF (softball only), EH (extra hitter)
}

// Batting Order Lineup (for baseball and softball)
export interface BattingOrderLineup {
  battingOrder: (BattingOrderEntry | undefined)[]; // Array of batting order entries
  numHitters: number; // 9 for baseball, 10+ for softball (with extra hitter option)
}

// Soccer Lineup Types (11 starters)
export interface SoccerLineup {
  gk?: string;  // Goalkeeper
  lb?: string;  // Left Back
  cb1?: string; // Center Back 1
  cb2?: string; // Center Back 2
  rb?: string;  // Right Back
  lm?: string;  // Left Midfield
  cm1?: string; // Center Midfield 1
  cm2?: string; // Center Midfield 2
  rm?: string;  // Right Midfield
  st1?: string; // Striker 1
  st2?: string; // Striker 2
}

// Soccer Diamond Midfield Lineup Types (4-1-2-1-2)
export interface SoccerDiamondLineup {
  gk?: string;  // Goalkeeper
  lb?: string;  // Left Back
  cb1?: string; // Center Back 1
  cb2?: string; // Center Back 2
  rb?: string;  // Right Back
  cdm?: string; // Center Defensive Midfielder
  lm?: string;  // Left Midfielder
  rm?: string;  // Right Midfielder
  cam?: string; // Center Attacking Midfielder
  st1?: string; // Striker 1
  st2?: string; // Striker 2
}

// Lacrosse Lineup Types (configurable positions)
export interface LacrosseLineup {
  goalie?: string; // Goalie
  attackers: (string | undefined)[]; // Attackers (configurable: 3 for boys, 4 for girls)
  midfielders: (string | undefined)[]; // Midfielders (configurable: 3)
  defenders: (string | undefined)[]; // Defenders (configurable: 3 for boys, 4 for girls)
  numAttackers: number; // Number of attackers (3-4)
  numMidfielders: number; // Number of midfielders (3)
  numDefenders: number; // Number of defenders (3-4)
}

// Invite release options
export type InviteReleaseOption = 'now' | 'scheduled' | 'none';

export interface Game {
  id: string;
  opponent: string;
  date: string; // ISO string
  time: string;
  location: string;
  address: string;
  jerseyColor: string;
  notes?: string;
  checkedInPlayers: string[]; // player ids marked as IN
  checkedOutPlayers: string[]; // player ids marked as OUT
  checkoutNotes?: Record<string, string>; // playerId -> reason for checkout
  invitedPlayers: string[]; // player ids
  photos: string[];
  showBeerDuty: boolean; // Admin toggle for beer/refreshment duty display
  beerDutyPlayerId?: string; // Player responsible for bringing beverages
  lineup?: HockeyLineup; // Hockey line combinations
  basketballLineup?: BasketballLineup; // Basketball lineup
  baseballLineup?: BaseballLineup; // Baseball lineup (legacy field positions)
  battingOrderLineup?: BattingOrderLineup; // Baseball/Softball batting order lineup
  soccerLineup?: SoccerLineup; // Soccer lineup (4-4-2)
  soccerDiamondLineup?: SoccerDiamondLineup; // Soccer diamond midfield lineup (4-1-2-1-2)
  lacrosseLineup?: LacrosseLineup; // Lacrosse lineup (configurable)
  // Invite release settings
  inviteReleaseOption?: InviteReleaseOption; // 'now' | 'scheduled' | 'none'
  inviteReleaseDate?: string; // ISO string - when to release invites (only if scheduled)
  invitesSent?: boolean; // Whether invites have been sent
  viewedBy?: string[]; // playerIds who have opened the game detail
  // Final score and result
  finalScoreUs?: number; // Our team's final score
  finalScoreThem?: number; // Opponent's final score
  gameResult?: 'win' | 'loss' | 'tie' | 'otLoss'; // Game result for record tracking
  resultRecorded?: boolean; // Whether the result has been added to team record
}

// In-app notification types
export interface AppNotification {
  id: string;
  type: 'game_invite' | 'game_reminder' | 'payment_reminder' | 'chat_message' | 'event_invite' | 'practice_invite' | 'poll';
  title: string;
  message: string;
  gameId?: string;
  eventId?: string; // For practice/event notifications
  fromPlayerId?: string;
  toPlayerId: string;
  createdAt: string;
  read: boolean;
}

// Chat message type
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string; // Cached sender name for cross-device display
  message: string;
  imageUrl?: string; // For images from camera/gallery
  gifUrl?: string; // For GIFs from GIPHY
  gifWidth?: number; // GIF original width
  gifHeight?: number; // GIF original height
  mentionedPlayerIds?: string[]; // Player IDs mentioned with @ (empty array = @all)
  mentionType?: 'all' | 'specific'; // 'all' for @everyone, 'specific' for individual mentions
  createdAt: string;
}

// Direct message type (admin broadcasts to selected players)
export interface DirectMessage {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  recipientIds: string[]; // player IDs who received this
  subject: string;
  body: string;
  createdAt: string;
  readBy: string[]; // player IDs who have read it
}

// Payment tracking types
export type PaymentApp = 'venmo' | 'paypal' | 'zelle' | 'cashapp' | 'applepay';

export interface PaymentMethod {
  app: PaymentApp;
  username: string; // Venmo/PayPal username or Zelle email/phone
  displayName: string; // Display name for the button
}

export interface PaymentEntry {
  id: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

export interface PlayerPayment {
  playerId: string;
  status: 'unpaid' | 'paid' | 'partial';
  amount?: number; // Total paid (computed from entries)
  notes?: string;
  paidAt?: string;
  entries: PaymentEntry[]; // Individual payment entries
}

export type PaymentPeriodType = 'league_dues' | 'substitute' | 'facility_rental' | 'equipment' | 'event' | 'referee' | 'misc';

export interface PaymentPeriod {
  id: string;
  title: string;
  amount: number;
  type: PaymentPeriodType;
  dueDate?: string;
  playerPayments: PlayerPayment[];
  createdAt: string;
  teamTotalOwed?: number; // Optional: Total amount owed by team for this period (admin-only)
}

export interface Event {
  id: string;
  title: string;
  type: 'practice' | 'meeting' | 'social' | 'other';
  date: string;
  time: string;
  location: string;
  address?: string;
  notes?: string;
  invitedPlayers: string[];
  confirmedPlayers: string[];
  declinedPlayers?: string[];
  declinedNotes?: Record<string, string>; // playerId -> reason for declining
  viewedBy?: string[]; // playerIds who have opened the event detail
  // Invite release options
  inviteReleaseOption?: InviteReleaseOption;
  inviteReleaseDate?: string; // ISO date string for scheduled release
  invitesSent?: boolean;
}

export interface Photo {
  id: string;
  gameId: string;
  uri: string;
  uploadedBy: string;
  uploadedAt: string;
}

// Poll types
export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // player ids who voted for this option
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string; // player id
  createdAt: string;
  expiresAt?: string; // optional expiration date
  isActive: boolean;
  allowMultipleVotes: boolean;
  groupId?: string; // groups multiple questions into one poll
  groupName?: string; // the poll name (displayed in list)
  isRequired?: boolean; // whether answering this question is required
}

// Team Link types
export interface TeamLink {
  id: string;
  title: string;
  url: string;
  createdBy: string;
  createdAt: string;
}

// Team Record based on sport
export interface TeamRecord {
  wins: number;
  losses: number;
  ties?: number; // Hockey, Soccer
  otLosses?: number; // Hockey only (Overtime losses)
  longestWinStreak?: number; // Longest consecutive wins
  longestLosingStreak?: number; // Longest consecutive losses
  teamGoals?: number; // Total team goals scored in season (hockey, soccer, lacrosse)
}

// View mode type for upcoming games
export type UpcomingGamesViewMode = 'list' | 'calendar';

export interface TeamSettings {
  sport: Sport;
  jerseyColors: { name: string; color: string }[];
  paymentMethods: PaymentMethod[];
  teamLogo?: string;
  record?: TeamRecord;
  showTeamStats?: boolean; // Toggle to show/hide team stats feature
  allowPlayerSelfStats?: boolean; // Allow players to manage their own game stats
  showPayments?: boolean; // Toggle to show/hide payments tab
  showTeamChat?: boolean; // Toggle to show/hide team chat tab
  showPhotos?: boolean; // Toggle to show/hide photos tab
  showRefreshmentDuty?: boolean; // Toggle to show/hide refreshment duty feature
  refreshmentDutyIs21Plus?: boolean; // If true, use beer icon; if false, use juice box icon
  showLineups?: boolean; // Toggle to show/hide lines/lineups feature
  upcomingGamesViewMode?: UpcomingGamesViewMode; // Persisted view mode preference for upcoming games (list or calendar)
  teamTotalAmountOwed?: number; // Total amount owed by the team (admin-only view)
  enabledRoles?: ('player' | 'reserve' | 'coach' | 'parent')[]; // Which roles are available for this team
  isSoftball?: boolean; // If true, adds 10th fielder (Short Fielder) for softball
  showTeamRecords?: boolean; // Toggle to show/hide team records feature (requires showTeamStats)
  championships?: Championship[]; // List of team championships
  // Season Management
  currentSeasonName?: string; // Current season label (e.g., "2024-2025")
  seasonHistory?: ArchivedSeason[]; // Array of archived seasons
  // Stripe Connect
  stripeAccountId?: string; // Connected Stripe account ID (acct_xxx)
  stripeOnboardingComplete?: boolean; // Whether onboarding is fully complete
  // Premium subscription
  isPremium?: boolean; // True when team admin has an active premium subscription
}

export interface Championship {
  id: string;
  year: string;
  title: string;
}

// Season Management - Archived player stats snapshot
export interface ArchivedPlayerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;
  positions?: string[]; // All positions player can play
  stats?: PlayerStats;
  goalieStats?: HockeyGoalieStats | SoccerGoalieStats | LacrosseGoalieStats;
  pitcherStats?: BaseballPitcherStats;
  // Attendance tracking
  gamesInvited?: number;
  gamesAttended?: number; // Checked in
  gamesDeclined?: number; // Checked out
}

// Season Management - Complete archived season
export interface ArchivedSeason {
  id: string;
  seasonName: string; // e.g., "2024-2025"
  sport: Sport;
  archivedAt: string; // ISO date when archived
  teamRecord: TeamRecord;
  playerStats: ArchivedPlayerStats[];
}

// Multi-team support: A complete team with all its data
export interface Team {
  id: string;
  teamName: string;
  teamSettings: TeamSettings;
  players: Player[];
  games: Game[];
  events: Event[];
  photos: Photo[];
  notifications: AppNotification[];
  chatMessages: ChatMessage[];
  chatLastReadAt: Record<string, string>;
  paymentPeriods: PaymentPeriod[];
  polls: Poll[];
  teamLinks: TeamLink[];
}

