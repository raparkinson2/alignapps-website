// ─── Sport Types ──────────────────────────────────────────────────────────────

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
  baseball: { P: 'Pitcher', C: 'Catcher', '1B': 'First Base', '2B': 'Second Base', '3B': 'Third Base', SS: 'Shortstop', LF: 'Left Field', CF: 'Center Field', RF: 'Right Field', DH: 'Designated Hitter' },
  basketball: { PG: 'Point Guard', SG: 'Shooting Guard', SF: 'Small Forward', PF: 'Power Forward', C: 'Center' },
  hockey: { C: 'Center', LW: 'Left Wing', RW: 'Right Wing', LD: 'Left Defense', RD: 'Right Defense', G: 'Goalie' },
  lacrosse: { G: 'Goalie', A: 'Attacker', M: 'Midfielder', D: 'Defender' },
  soccer: { GK: 'Goalkeeper', DEF: 'Defender', MID: 'Midfielder', FWD: 'Forward' },
  softball: { P: 'Pitcher', C: 'Catcher', '1B': 'First Base', '2B': 'Second Base', '3B': 'Third Base', SS: 'Shortstop', LF: 'Left Field', CF: 'Center Field', RF: 'Right Field', DH: 'Designated Hitter', SF: 'Short Fielder' },
};

export const SPORT_NAMES: Record<Sport, string> = {
  baseball: 'Baseball',
  basketball: 'Basketball',
  hockey: 'Hockey',
  lacrosse: 'Lacrosse',
  soccer: 'Soccer',
  softball: 'Softball',
};

export const SPORT_EMOJI: Record<Sport, string> = {
  hockey: '🏒',
  baseball: '⚾',
  basketball: '🏀',
  soccer: '⚽',
  lacrosse: '🥍',
  softball: '🥎',
};

// ─── Role / Status Types ──────────────────────────────────────────────────────

export type PlayerRole = 'admin' | 'captain' | 'coach' | 'parent';
export type PlayerStatus = 'active' | 'reserve';
export type DurationUnit = 'days' | 'weeks' | 'games' | 'remainder_of_season';

export interface StatusDuration {
  value?: number;
  unit: DurationUnit;
}

export interface NotificationPreferences {
  gameInvites: boolean;
  gameReminderDayBefore: boolean;
  gameReminderHoursBefore: boolean;
  chatMessages: boolean;
  chatMentions: boolean;
  paymentReminders: boolean;
  pushToken?: string;
}

// ─── Stats Types ──────────────────────────────────────────────────────────────

export interface HockeyStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  pim: number;
  plusMinus: number;
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

export interface LacrosseStats {
  gamesPlayed: number;
  goals: number;
  assists: number;
  groundBalls: number;
  causedTurnovers: number;
  shots: number;
  shotsOnGoal: number;
  faceOffWins?: number;
  faceOffAttempts?: number;
  drawControls?: number;
  drawAttempts?: number;
}

export interface LacrosseGoalieStats {
  games: number;
  wins: number;
  losses: number;
  minutesPlayed: number;
  shotsAgainst: number;
  saves: number;
  goalsAgainst: number;
  groundBalls: number;
}

export type PlayerStats = HockeyStats | HockeyGoalieStats | BaseballStats | BaseballPitcherStats | BasketballStats | SoccerStats | SoccerGoalieStats | LacrosseStats | LacrosseGoalieStats;

export interface GameLogEntry {
  id: string;
  gameId?: string;
  date: string;
  stats: PlayerStats;
  statType: 'skater' | 'goalie' | 'batter' | 'pitcher' | 'lacrosse' | 'lacrosse_goalie';
}

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  phone?: string;
  number: string;
  position: string;
  positions?: string[];
  avatar?: string;
  roles: PlayerRole[];
  status: PlayerStatus;
  isInjured?: boolean;
  isSuspended?: boolean;
  injuryDuration?: StatusDuration;
  suspensionDuration?: StatusDuration;
  statusEndDate?: string;
  notificationPreferences?: NotificationPreferences;
  stats?: PlayerStats;
  pitcherStats?: BaseballPitcherStats;
  goalieStats?: HockeyGoalieStats | SoccerGoalieStats | LacrosseGoalieStats;
  gameLogs?: GameLogEntry[];
  unavailableDates?: string[];
  associatedPlayerId?: string;
}

export const getPlayerName = (player: Player): string => `${player.firstName} ${player.lastName}`.trim();
export const getPlayerInitials = (player: Player): string => {
  const first = player.firstName?.charAt(0)?.toUpperCase() || '';
  const last = player.lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}`;
};
export const getPlayerPositions = (player: Player): string[] => {
  if (player.positions && player.positions.length > 0) return player.positions;
  return [player.position];
};
export const getPrimaryPosition = (player: Player): string => {
  if (player.positions && player.positions.length > 0) return player.positions[0];
  return player.position;
};

// ─── Lineup Types ─────────────────────────────────────────────────────────────

export interface HockeyForwardLine { lw?: string; c?: string; rw?: string; }
export interface HockeyDefenseLine { ld?: string; rd?: string; }
export interface HockeyGoalieLine { g?: string; }
export interface HockeyLineup {
  forwardLines: HockeyForwardLine[];
  defenseLines: HockeyDefenseLine[];
  goalieLines: HockeyGoalieLine[];
  numForwardLines: number;
  numDefenseLines: number;
  numGoalieLines: number;
}

export interface BasketballStartingFive {
  pg?: string;
  guards: (string | undefined)[];
  forwards: (string | undefined)[];
  centers: (string | undefined)[];
}
export interface BasketballLineup {
  starters: BasketballStartingFive;
  bench: (string | undefined)[];
  numGuards: number;
  numForwards: number;
  numCenters: number;
  hasPG: boolean;
  numBenchSpots: number;
}

export interface BaseballLineup {
  lf?: string; cf?: string; rf?: string; thirdBase?: string; shortstop?: string;
  secondBase?: string; firstBase?: string; pitcher?: string; catcher?: string; shortFielder?: string;
}
export interface BattingOrderEntry { playerId: string; position: string; }
export interface BattingOrderLineup {
  battingOrder: (BattingOrderEntry | undefined)[];
  numHitters: number;
}

export interface SoccerLineup {
  gk?: string; lb?: string; cb1?: string; cb2?: string; rb?: string;
  lm?: string; cm1?: string; cm2?: string; rm?: string; st1?: string; st2?: string;
}
export interface SoccerDiamondLineup {
  gk?: string; lb?: string; cb1?: string; cb2?: string; rb?: string;
  cdm?: string; lm?: string; rm?: string; cam?: string; st1?: string; st2?: string;
}

export interface LacrosseLineup {
  goalie?: string;
  attackers: (string | undefined)[];
  midfielders: (string | undefined)[];
  defenders: (string | undefined)[];
  numAttackers: number;
  numMidfielders: number;
  numDefenders: number;
}

// ─── Game ─────────────────────────────────────────────────────────────────────

export type InviteReleaseOption = 'now' | 'scheduled' | 'none';

export interface Game {
  id: string;
  opponent: string;
  date: string;
  time: string;
  location: string;
  address: string;
  jerseyColor: string;
  notes?: string;
  checkedInPlayers: string[];
  checkedOutPlayers: string[];
  checkoutNotes?: Record<string, string>;
  invitedPlayers: string[];
  photos: string[];
  showBeerDuty: boolean;
  beerDutyPlayerId?: string;
  lineup?: HockeyLineup;
  basketballLineup?: BasketballLineup;
  baseballLineup?: BaseballLineup;
  battingOrderLineup?: BattingOrderLineup;
  soccerLineup?: SoccerLineup;
  soccerDiamondLineup?: SoccerDiamondLineup;
  lacrosseLineup?: LacrosseLineup;
  inviteReleaseOption?: InviteReleaseOption;
  inviteReleaseDate?: string;
  invitesSent?: boolean;
  finalScoreUs?: number;
  finalScoreThem?: number;
  gameResult?: 'win' | 'loss' | 'tie' | 'otLoss';
  resultRecorded?: boolean;
}

// ─── Event ────────────────────────────────────────────────────────────────────

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
  declinedNotes?: Record<string, string>;
  inviteReleaseOption?: InviteReleaseOption;
  inviteReleaseDate?: string;
  invitesSent?: boolean;
}

// ─── Photo ────────────────────────────────────────────────────────────────────

export interface Photo {
  id: string;
  gameId: string;
  uri: string;
  uploadedBy: string;
  uploadedAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  message: string;
  imageUrl?: string;
  gifUrl?: string;
  gifWidth?: number;
  gifHeight?: number;
  mentionedPlayerIds?: string[];
  mentionType?: 'all' | 'specific';
  createdAt: string;
}

// ─── Direct Messages ──────────────────────────────────────────────────────────

export interface DirectMessage {
  id: string;
  teamId: string;
  senderId: string;
  senderName: string;
  recipientIds: string[];
  subject: string;
  body: string;
  createdAt: string;
  readBy: string[];
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: 'game_invite' | 'game_reminder' | 'event_reminder' | 'payment_reminder' | 'chat_message' | 'event_invite' | 'practice_invite' | 'poll';
  title: string;
  message: string;
  gameId?: string;
  eventId?: string;
  fromPlayerId?: string;
  toPlayerId: string;
  createdAt: string;
  read: boolean;
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export type PaymentApp = 'venmo' | 'paypal' | 'zelle' | 'cashapp' | 'applepay';

export interface PaymentMethod {
  app: PaymentApp;
  username: string;
  displayName: string;
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
  amount?: number;
  notes?: string;
  paidAt?: string;
  entries: PaymentEntry[];
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
  teamTotalOwed?: number;
}

// ─── Polls & Links ────────────────────────────────────────────────────────────

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  allowMultipleVotes: boolean;
  groupId?: string;
  groupName?: string;
  isRequired?: boolean;
}

export interface TeamLink {
  id: string;
  title: string;
  url: string;
  createdBy: string;
  createdAt: string;
}

// ─── Team Record & Settings ───────────────────────────────────────────────────

export interface TeamRecord {
  wins: number;
  losses: number;
  ties?: number;
  otLosses?: number;
  longestWinStreak?: number;
  longestLosingStreak?: number;
  teamGoals?: number;
}

export interface Championship {
  id: string;
  year: string;
  title: string;
}

export interface ArchivedPlayerStats {
  playerId: string;
  playerName: string;
  jerseyNumber: string;
  position: string;
  positions?: string[];
  stats?: PlayerStats;
  goalieStats?: HockeyGoalieStats | SoccerGoalieStats | LacrosseGoalieStats;
  pitcherStats?: BaseballPitcherStats;
  gamesInvited?: number;
  gamesAttended?: number;
  gamesDeclined?: number;
}

export interface ArchivedSeason {
  id: string;
  seasonName: string;
  sport: Sport;
  archivedAt: string;
  teamRecord: TeamRecord;
  playerStats: ArchivedPlayerStats[];
}

export interface TeamSettings {
  sport: Sport;
  jerseyColors: { name: string; color: string }[];
  paymentMethods: PaymentMethod[];
  teamLogo?: string;
  record?: TeamRecord;
  showTeamStats?: boolean;
  allowPlayerSelfStats?: boolean;
  showPayments?: boolean;
  showTeamChat?: boolean;
  showPhotos?: boolean;
  showRefreshmentDuty?: boolean;
  refreshmentDutyIs21Plus?: boolean;
  showLineups?: boolean;
  upcomingGamesViewMode?: 'list' | 'calendar';
  teamTotalAmountOwed?: number;
  enabledRoles?: ('player' | 'reserve' | 'coach' | 'parent')[];
  isSoftball?: boolean;
  showTeamRecords?: boolean;
  championships?: Championship[];
  currentSeasonName?: string;
  seasonHistory?: ArchivedSeason[];
  stripeAccountId?: string;
  stripeOnboardingComplete?: boolean;
}

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
