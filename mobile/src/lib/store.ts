import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';
import { cancelGameInviteNotification } from './notifications';
import { BACKEND_URL } from './config';

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
  pushToken?: string; // For future push notification implementation
}

export const defaultNotificationPreferences: NotificationPreferences = {
  gameInvites: true,
  gameReminderDayBefore: true,
  gameReminderHoursBefore: true,
  chatMessages: true,
  chatMentions: true,
  paymentReminders: true,
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

interface TeamStore {
  teamName: string;
  setTeamName: (name: string) => void;

  teamSettings: TeamSettings;
  setTeamSettings: (settings: Partial<TeamSettings>) => void;

  players: Player[];
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  removePlayer: (id: string) => void;
  addUnavailableDate: (playerId: string, date: string) => void; // Also marks OUT for matching games/events
  removeUnavailableDate: (playerId: string, date: string) => void;

  games: Game[];
  addGame: (game: Game) => void;
  updateGame: (id: string, updates: Partial<Game>) => void;
  removeGame: (id: string) => void;
  checkInToGame: (gameId: string, playerId: string) => void;
  checkOutFromGame: (gameId: string, playerId: string, note?: string) => void;
  clearPlayerResponse: (gameId: string, playerId: string) => void;
  invitePlayersToGame: (gameId: string, playerIds: string[]) => void;
  releaseScheduledGameInvites: () => Game[]; // Returns games that were released

  events: Event[];
  addEvent: (event: Event) => void;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  removeEvent: (id: string) => void;
  confirmEventAttendance: (eventId: string, playerId: string) => void;
  declineEventAttendance: (eventId: string, playerId: string, note?: string) => void;
  markEventViewed: (eventId: string, playerId: string) => void;
  invitePlayersToEvent: (eventId: string, playerIds: string[]) => void;

  photos: Photo[];
  setPhotos: (photos: Photo[]) => void;
  addPhoto: (photo: Photo) => void;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
  removePhoto: (id: string) => void;

  // Notifications
  notifications: AppNotification[];
  addNotification: (notification: AppNotification) => void;
  markNotificationRead: (id: string) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  getUnreadCount: () => number;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteChatMessage: (messageId: string) => void;

  // Chat read tracking
  chatLastReadAt: Record<string, string>; // playerId -> ISO timestamp
  markChatAsRead: (playerId: string) => void;
  getUnreadChatCount: (playerId: string) => number;

  // Local event view tracking (persisted so it survives sync resets)
  localViewedEventIds: string[];
  markEventViewedLocally: (eventId: string) => void;

  // Direct Messages
  directMessages: DirectMessage[];
  addDirectMessage: (message: DirectMessage) => void;
  markDirectMessageRead: (messageId: string, playerId: string) => void;
  removeDirectMessage: (messageId: string) => void;
  getUnreadDirectMessageCount: (playerId: string) => number;

  // Payments
  paymentPeriods: PaymentPeriod[];
  addPaymentPeriod: (period: PaymentPeriod) => void;
  updatePaymentPeriod: (id: string, updates: Partial<PaymentPeriod>) => void;
  removePaymentPeriod: (id: string) => void;
  reorderPaymentPeriods: (periods: PaymentPeriod[]) => void;
  updatePlayerPayment: (periodId: string, playerId: string, status: 'unpaid' | 'paid' | 'partial', amount?: number, notes?: string) => void;
  addPaymentEntry: (periodId: string, playerId: string, entry: PaymentEntry) => void;
  removePaymentEntry: (periodId: string, playerId: string, entryId: string) => void;

  // Polls
  polls: Poll[];
  addPoll: (poll: Poll) => void;
  updatePoll: (id: string, updates: Partial<Poll>) => void;
  removePoll: (id: string) => void;
  votePoll: (pollId: string, optionId: string, playerId: string) => void;
  unvotePoll: (pollId: string, optionId: string, playerId: string) => void;

  // Team Links
  teamLinks: TeamLink[];
  addTeamLink: (link: TeamLink) => void;
  updateTeamLink: (id: string, updates: Partial<TeamLink>) => void;
  removeTeamLink: (id: string) => void;

  // Championships
  addChampionship: (championship: Championship) => void;
  removeChampionship: (id: string) => void;

  // Season Management
  setCurrentSeasonName: (name: string) => void;
  archiveAndStartNewSeason: (seasonName: string) => { success: boolean; newBestRecord: boolean };
  unarchiveSeason: (seasonId: string, forceRestore?: boolean) => { success: boolean; message: string; hasConflict?: boolean };

  currentPlayerId: string | null;
  setCurrentPlayerId: (id: string | null) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (loggedIn: boolean) => void;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  logout: () => void;
  deleteAccount: () => void;

  // Authentication
  loginWithEmail: (email: string, password: string) => { success: boolean; error?: string; playerId?: string; multipleTeams?: boolean; teamCount?: number };
  loginWithPhone: (phone: string, password: string) => { success: boolean; error?: string; playerId?: string; multipleTeams?: boolean; teamCount?: number };
  // Verified login functions - skip password check (for use after secure-auth has verified)
  loginWithEmailVerified: (email: string) => { success: boolean; error?: string; playerId?: string; multipleTeams?: boolean; teamCount?: number };
  loginWithPhoneVerified: (phone: string) => { success: boolean; error?: string; playerId?: string; multipleTeams?: boolean; teamCount?: number };
  registerAdmin: (name: string, email: string, password: string, teamName: string, options?: { phone?: string; jerseyNumber?: string; isCoach?: boolean }) => { success: boolean; error?: string };
  registerInvitedPlayer: (email: string, password: string) => { success: boolean; error?: string; playerId?: string };
  registerInvitedPlayerByPhone: (phone: string, password: string) => { success: boolean; error?: string; playerId?: string };
  findPlayerByEmail: (email: string) => Player | undefined;
  findPlayerByPhone: (phone: string) => Player | undefined;

  // Helper to check if current user has admin/captain privileges
  canManageTeam: () => boolean;
  canEditPlayers: () => boolean;
  isAdmin: () => boolean;

  // Notification Preferences
  updateNotificationPreferences: (playerId: string, prefs: Partial<NotificationPreferences>) => void;
  getNotificationPreferences: (playerId: string) => NotificationPreferences;

  // Game Logs
  addGameLog: (playerId: string, gameLog: GameLogEntry) => void;
  updateGameLog: (playerId: string, gameLogId: string, updates: Partial<GameLogEntry>) => void;
  removeGameLog: (playerId: string, gameLogId: string) => void;

  // Reset all data
  resetAllData: () => void;
  // Delete only the current team (preserves other teams)
  deleteCurrentTeam: () => void;

  // Multi-team support
  teams: Team[];
  activeTeamId: string | null;
  userEmail: string | null; // User's email for cross-team identity
  userPhone: string | null; // User's phone for cross-team identity
  pendingTeamIds: string[] | null; // Teams to choose from after login (null = no pending selection)

  // Multi-team methods
  addTeam: (team: Team) => void;
  switchTeam: (teamId: string) => void;
  getTeamsForUser: () => Team[];
  getUserTeamCount: () => number;
  setPendingTeamSelection: (teamIds: string[]) => void;
  clearPendingTeamSelection: () => void;
  createNewTeam: (teamName: string, sport: Sport, adminPlayer: Player) => string; // Returns new team ID
}

// Empty initial data for fresh start
const initialPlayers: Player[] = [];
const initialGames: Game[] = [];

const defaultTeamSettings: TeamSettings = {
  sport: 'hockey',
  jerseyColors: [
    { name: 'White', color: '#ffffff' },
    { name: 'Black', color: '#1a1a1a' },
  ],
  paymentMethods: [],
  showTeamStats: true,
  showPayments: true,
  showTeamChat: true,
  showPhotos: true,
  showRefreshmentDuty: true,
  refreshmentDutyIs21Plus: true,
  showLineups: true,
};

export const useTeamStore = create<TeamStore>()(
  persist(
    (set, get) => ({
      teamName: 'My Team',
      setTeamName: (name) => set({ teamName: name }),

      teamSettings: defaultTeamSettings,
      setTeamSettings: (settings) => set((state) => {
        const newSettings = { ...state.teamSettings, ...settings };

        // If sport is changing, remap all player positions and clear old sport data
        if (settings.sport && settings.sport !== state.teamSettings.sport) {
          const fromSport = state.teamSettings.sport;
          const toSport = settings.sport;
          const updatedPlayers = state.players.map((player) => {
            // Map only the primary position to the new sport
            const newPosition = mapPosition(player.position, fromSport, toSport);
            return {
              ...player,
              position: newPosition,
              positions: [newPosition], // Reset to single position for new sport
              stats: undefined, // Clear stats when switching sports
            };
          });
          // Also update in teams array if activeTeamId exists
          let updatedTeams = state.teams;
          if (state.activeTeamId) {
            updatedTeams = state.teams.map((team) =>
              team.id === state.activeTeamId
                ? { ...team, teamSettings: newSettings, players: updatedPlayers }
                : team
            );
          }
          return {
            teamSettings: newSettings,
            players: updatedPlayers,
            teams: updatedTeams,
          };
        }

        // Also update in teams array if activeTeamId exists
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, teamSettings: newSettings }
              : team
          );
        }
        return { teamSettings: newSettings, teams: updatedTeams };
      }),

      players: initialPlayers,
      addPlayer: (player) => set((state) => {
        // Prevent duplicates - if a player with this id already exists, update instead of add
        if (state.players.some((p) => p.id === player.id)) {
          return { players: state.players.map((p) => p.id === player.id ? { ...p, ...player } : p) };
        }
        return { players: [...state.players, player] };
      }),
      updatePlayer: (id, updates) => set((state) => {
        // Get the updated player data - check both state.players and active team
        let currentPlayer = state.players.find((p) => p.id === id);

        // Also check in active team if not found in state.players
        if (!currentPlayer && state.activeTeamId) {
          const activeTeam = state.teams.find(t => t.id === state.activeTeamId);
          currentPlayer = activeTeam?.players.find((p) => p.id === id);
        }

        if (!currentPlayer) {
          return { players: state.players };
        }

        const updatedPlayer = { ...currentPlayer, ...updates };

        // Check if injury/suspension status changed - need to update games and events
        const statusChanged =
          updates.isInjured !== undefined ||
          updates.isSuspended !== undefined ||
          updates.statusEndDate !== undefined;

        // Update player in state.players
        const updatedPlayers = state.players.map((p) => (p.id === id ? updatedPlayer : p));

        // Also update player in teams array if they exist there
        const updatedTeams = state.teams.map((team) => ({
          ...team,
          players: team.players.map((p) => (p.id === id ? updatedPlayer : p)),
        }));

        if (!statusChanged) {
          // No status change, just update player in both places
          return {
            players: updatedPlayers,
            teams: updatedTeams,
          };
        }

        // Status changed - update existing games to mark player OUT if within end date
        const updatedGames = state.games.map((game) => {
          // Only process games where player is invited
          if (!game.invitedPlayers.includes(id)) return game;

          const gameDate = game.date.split('T')[0]; // Get YYYY-MM-DD
          const result = isPlayerUnavailableForDate(updatedPlayer, gameDate);

          if (result.unavailable) {
            // Player should be marked OUT for this game
            const isAlreadyOut = (game.checkedOutPlayers || []).includes(id);
            if (isAlreadyOut) return game; // Already OUT, no change needed

            return {
              ...game,
              checkedInPlayers: (game.checkedInPlayers || []).filter((pid) => pid !== id),
              checkedOutPlayers: [...(game.checkedOutPlayers || []), id],
              checkoutNotes: {
                ...(game.checkoutNotes || {}),
                [id]: result.reason || 'Unavailable',
              },
            };
          }

          // Player is no longer unavailable due to injury/suspension
          // Only clear their OUT status if the reason was Injured or Suspended
          const currentNote = game.checkoutNotes?.[id];
          if (currentNote === 'Injured' || currentNote === 'Suspended') {
            const newCheckoutNotes = { ...(game.checkoutNotes || {}) };
            delete newCheckoutNotes[id];
            return {
              ...game,
              checkedOutPlayers: (game.checkedOutPlayers || []).filter((pid) => pid !== id),
              checkoutNotes: newCheckoutNotes,
            };
          }

          return game;
        });

        // Status changed - update existing events/practices to mark player OUT if injured
        // Note: Suspensions do NOT affect events/practices - only games
        const updatedEvents = state.events.map((event) => {
          // Only process events where player is invited
          if (!event.invitedPlayers.includes(id)) return event;

          const eventDate = event.date.split('T')[0]; // Get YYYY-MM-DD

          // Check if player is injured (suspensions don't apply to events/practices)
          const isInjuredForEvent = updatedPlayer.isInjured &&
            updatedPlayer.statusEndDate &&
            eventDate <= updatedPlayer.statusEndDate;

          if (isInjuredForEvent) {
            // Player should be marked as declined for this event due to injury
            const isAlreadyDeclined = (event.declinedPlayers || []).includes(id);
            if (isAlreadyDeclined) return event; // Already declined, no change needed

            return {
              ...event,
              confirmedPlayers: event.confirmedPlayers.filter((pid) => pid !== id),
              declinedPlayers: [...(event.declinedPlayers || []), id],
              declinedNotes: {
                ...(event.declinedNotes || {}),
                [id]: 'Injured',
              },
            };
          }

          // Player is no longer injured - only clear their declined status if reason was Injured
          // (Don't clear if they manually declined or marked unavailable for other reasons)
          const currentNote = event.declinedNotes?.[id];
          if (currentNote === 'Injured') {
            const newDeclinedNotes = { ...(event.declinedNotes || {}) };
            delete newDeclinedNotes[id];
            return {
              ...event,
              declinedPlayers: (event.declinedPlayers || []).filter((pid) => pid !== id),
              declinedNotes: newDeclinedNotes,
            };
          }

          return event;
        });

        return {
          players: updatedPlayers,
          teams: updatedTeams,
          games: updatedGames,
          events: updatedEvents,
        };
      }),
      removePlayer: (id) => set((state) => ({ players: state.players.filter((p) => p.id !== id) })),
      addUnavailableDate: (playerId, date) => set((state) => {
        // Add date to player's unavailable dates
        const updatedPlayers = state.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                unavailableDates: (p.unavailableDates || []).includes(date)
                  ? p.unavailableDates
                  : [...(p.unavailableDates || []), date],
              }
            : p
        );

        // Mark player OUT for any games on that date
        const updatedGames = state.games.map((g) => {
          const gameDate = g.date.split('T')[0]; // Get YYYY-MM-DD
          if (gameDate === date && g.invitedPlayers.includes(playerId)) {
            return {
              ...g,
              checkedInPlayers: (g.checkedInPlayers || []).filter((id) => id !== playerId),
              checkedOutPlayers: (g.checkedOutPlayers || []).includes(playerId)
                ? g.checkedOutPlayers
                : [...(g.checkedOutPlayers || []), playerId],
              checkoutNotes: { ...(g.checkoutNotes || {}), [playerId]: 'Unavailable' },
            };
          }
          return g;
        });

        // Mark player as declined for any events on that date
        const updatedEvents = state.events.map((e) => {
          const eventDate = e.date.split('T')[0]; // Get YYYY-MM-DD
          if (eventDate === date && e.invitedPlayers.includes(playerId)) {
            return {
              ...e,
              confirmedPlayers: e.confirmedPlayers.filter((id) => id !== playerId),
              declinedPlayers: (e.declinedPlayers || []).includes(playerId)
                ? e.declinedPlayers
                : [...(e.declinedPlayers || []), playerId],
              declinedNotes: { ...(e.declinedNotes || {}), [playerId]: 'Unavailable' },
            };
          }
          return e;
        });

        return { players: updatedPlayers, games: updatedGames, events: updatedEvents };
      }),
      removeUnavailableDate: (playerId, date) => set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                unavailableDates: (p.unavailableDates || []).filter((d) => d !== date),
              }
            : p
        ),
      })),

      games: initialGames,
      addGame: (game) => set((state) => {
        // Check if any invited players are unavailable on this date
        const gameDate = game.date.split('T')[0]; // Get YYYY-MM-DD

        // Players unavailable due to their availability calendar
        const unavailablePlayers = state.players.filter((p) =>
          game.invitedPlayers.includes(p.id) &&
          (p.unavailableDates || []).includes(gameDate)
        );

        // Players unavailable due to injury/suspension with end date
        const injuredSuspendedPlayers = state.players.filter((p) => {
          if (!game.invitedPlayers.includes(p.id)) return false;
          const result = isPlayerUnavailableForDate(p, gameDate);
          return result.unavailable && result.reason !== 'Unavailable'; // Already handled above
        });

        // Combine all unavailable players
        const allUnavailablePlayers = [...unavailablePlayers, ...injuredSuspendedPlayers];

        // Auto-mark unavailable players as OUT
        const checkedOutPlayers = [
          ...(game.checkedOutPlayers || []),
          ...allUnavailablePlayers.map((p) => p.id).filter((id) => !(game.checkedOutPlayers || []).includes(id)),
        ];
        const checkoutNotes = { ...(game.checkoutNotes || {}) };
        allUnavailablePlayers.forEach((p) => {
          if (!checkoutNotes[p.id]) {
            // Set appropriate reason
            if (p.isInjured && p.statusEndDate && gameDate <= p.statusEndDate) {
              checkoutNotes[p.id] = 'Injured';
            } else if (p.isSuspended && p.statusEndDate && gameDate <= p.statusEndDate) {
              checkoutNotes[p.id] = 'Suspended';
            } else {
              checkoutNotes[p.id] = 'Unavailable';
            }
          }
        });

        return {
          games: [
            ...state.games,
            {
              ...game,
              checkedOutPlayers,
              checkoutNotes,
            },
          ],
        };
      }),
      updateGame: (id, updates) => set((state) => ({
        games: state.games.map((g) => {
          if (g.id !== id) return g;
          const merged = { ...g, ...updates };
          // Deduplicate player ID arrays to prevent double-renders
          if (merged.invitedPlayers) merged.invitedPlayers = [...new Set(merged.invitedPlayers)];
          if (merged.checkedInPlayers) merged.checkedInPlayers = [...new Set(merged.checkedInPlayers)];
          if (merged.checkedOutPlayers) merged.checkedOutPlayers = [...new Set(merged.checkedOutPlayers)];
          return merged;
        }),
      })),
      removeGame: (id) => set((state) => ({ games: state.games.filter((g) => g.id !== id) })),

      checkInToGame: (gameId, playerId) => set((state) => ({
        games: state.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                checkedInPlayers: (g.checkedInPlayers || []).includes(playerId)
                  ? g.checkedInPlayers
                  : [...(g.checkedInPlayers || []), playerId],
                checkedOutPlayers: (g.checkedOutPlayers || []).filter((id) => id !== playerId)
              }
            : g
        ),
      })),
      checkOutFromGame: (gameId, playerId, note) => set((state) => ({
        games: state.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                checkedInPlayers: (g.checkedInPlayers || []).filter((id) => id !== playerId),
                checkedOutPlayers: (g.checkedOutPlayers || []).includes(playerId)
                  ? g.checkedOutPlayers
                  : [...(g.checkedOutPlayers || []), playerId],
                checkoutNotes: note
                  ? { ...(g.checkoutNotes || {}), [playerId]: note }
                  : g.checkoutNotes
              }
            : g
        ),
      })),
      clearPlayerResponse: (gameId: string, playerId: string) => set((state) => ({
        games: state.games.map((g) =>
          g.id === gameId
            ? {
                ...g,
                checkedInPlayers: (g.checkedInPlayers || []).filter((id) => id !== playerId),
                checkedOutPlayers: (g.checkedOutPlayers || []).filter((id) => id !== playerId)
              }
            : g
        ),
      })),
      invitePlayersToGame: (gameId, playerIds) => set((state) => ({
        games: state.games.map((g) =>
          g.id === gameId ? { ...g, invitedPlayers: playerIds } : g
        ),
      })),
      releaseScheduledGameInvites: () => {
        const state = get();
        const now = new Date();
        const gamesToRelease: Game[] = [];

        // Find games with scheduled invites that are past due
        state.games.forEach((game) => {
          if (
            game.inviteReleaseOption === 'scheduled' &&
            game.inviteReleaseDate &&
            !game.invitesSent
          ) {
            const releaseDate = new Date(game.inviteReleaseDate);
            if (releaseDate <= now) {
              gamesToRelease.push(game);
            }
          }
        });

        if (gamesToRelease.length > 0) {
          // Update the games to mark invites as sent
          set((state) => ({
            games: state.games.map((g) => {
              const shouldRelease = gamesToRelease.some((gr) => gr.id === g.id);
              if (shouldRelease) {
                return { ...g, invitesSent: true };
              }
              return g;
            }),
          }));

          // Cancel any pending OS notifications for these games to prevent duplicates
          gamesToRelease.forEach((game) => {
            cancelGameInviteNotification(game.id).catch(() => {});
          });

          // Create in-app notifications for each game
          gamesToRelease.forEach((game) => {
            const gameDate = new Date(game.date);
            const formattedDate = gameDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });

            // Create notification for each invited player
            game.invitedPlayers?.forEach((playerId) => {
              const notification: AppNotification = {
                id: `game-invite-${game.id}-${playerId}-${Date.now()}`,
                type: 'game_invite',
                title: 'New Game Added!',
                message: `You've been invited to play vs ${game.opponent} on ${formattedDate} at ${game.time}`,
                gameId: game.id,
                toPlayerId: playerId,
                read: false,
                createdAt: new Date().toISOString(),
              };
              get().addNotification(notification);
            });
          });
        }

        return gamesToRelease;
      },

      events: [],
      addEvent: (event) => set((state) => {
        // Check if any invited players are unavailable on this date
        const eventDate = event.date.split('T')[0]; // Get YYYY-MM-DD

        // Players unavailable due to their availability calendar
        const unavailablePlayers = state.players.filter((p) =>
          event.invitedPlayers.includes(p.id) &&
          (p.unavailableDates || []).includes(eventDate)
        );

        // Players unavailable due to injury (applies to all events including practices)
        // Note: Suspended players are NOT auto-declined for practices/events - only games
        const injuredPlayers = state.players.filter((p) => {
          if (!event.invitedPlayers.includes(p.id)) return false;
          if (!p.isInjured || !p.statusEndDate) return false;
          // Check if event date is on or before the injury end date
          return eventDate <= p.statusEndDate;
        });

        // Combine all unavailable players (deduped)
        const allUnavailableIds = new Set([
          ...unavailablePlayers.map((p) => p.id),
          ...injuredPlayers.map((p) => p.id),
        ]);

        // Auto-mark unavailable players as declined
        const declinedPlayers = [
          ...(event.declinedPlayers || []),
          ...Array.from(allUnavailableIds).filter((id) => !(event.declinedPlayers || []).includes(id)),
        ];
        const declinedNotes = { ...(event.declinedNotes || {}) };

        // Set notes for unavailable players
        unavailablePlayers.forEach((p) => {
          if (!declinedNotes[p.id]) {
            declinedNotes[p.id] = 'Unavailable';
          }
        });

        // Set notes for injured players
        injuredPlayers.forEach((p) => {
          if (!declinedNotes[p.id]) {
            declinedNotes[p.id] = 'Injured';
          }
        });

        return {
          events: [
            ...state.events,
            {
              ...event,
              declinedPlayers,
              declinedNotes,
            },
          ],
        };
      }),
      updateEvent: (id, updates) => set((state) => ({
        events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      })),
      removeEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
      confirmEventAttendance: (eventId, playerId) => set((state) => ({
        events: state.events.map((e) =>
          e.id === eventId && !e.confirmedPlayers.includes(playerId)
            ? { ...e, confirmedPlayers: [...e.confirmedPlayers, playerId] }
            : e
        ),
      })),
      declineEventAttendance: (eventId, playerId, note) => set((state) => ({
        events: state.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                confirmedPlayers: e.confirmedPlayers.filter((id) => id !== playerId),
                declinedPlayers: (e.declinedPlayers || []).includes(playerId)
                  ? e.declinedPlayers
                  : [...(e.declinedPlayers || []), playerId],
                declinedNotes: note
                  ? { ...(e.declinedNotes || {}), [playerId]: note }
                  : e.declinedNotes
              }
            : e
        ),
      })),
      invitePlayersToEvent: (eventId, playerIds) => set((state) => ({
        events: state.events.map((e) =>
          e.id === eventId ? { ...e, invitedPlayers: playerIds } : e
        ),
      })),
      markEventViewed: (eventId, playerId) => set((state) => ({
        events: state.events.map((e) =>
          e.id === eventId && !(e.viewedBy || []).includes(playerId)
            ? { ...e, viewedBy: [...(e.viewedBy || []), playerId] }
            : e
        ),
      })),

      photos: [],
      addPhoto: (photo) => set((state) => {
        const newPhotos = [...state.photos, photo];
        // Also update in teams array if activeTeamId exists
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, photos: newPhotos }
              : team
          );
        }
        return {
          photos: newPhotos,
          teams: updatedTeams,
        };
      }),
      updatePhoto: (id, updates) => set((state) => {
        const newPhotos = state.photos.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        );
        // Also update in teams array if activeTeamId exists
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, photos: newPhotos }
              : team
          );
        }
        return {
          photos: newPhotos,
          teams: updatedTeams,
        };
      }),
      removePhoto: (id) => set((state) => {
        const newPhotos = state.photos.filter((p) => p.id !== id);
        // Also update in teams array if activeTeamId exists
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, photos: newPhotos }
              : team
          );
        }
        return {
          photos: newPhotos,
          teams: updatedTeams,
        };
      }),

      setPhotos: (photos) => set((state) => {
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, photos }
              : team
          );
        }
        return { photos, teams: updatedTeams };
      }),

      // Notifications - start empty
      notifications: [],
      addNotification: (notification) => set((state) => ({
        notifications: [notification, ...state.notifications]
      })),
      markNotificationRead: (id) => set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),
      removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
      clearNotifications: () => set({ notifications: [] }),
      getUnreadCount: () => {
        const state = get();
        const currentPlayerId = state.currentPlayerId;
        return state.notifications.filter(
          (n) => n.toPlayerId === currentPlayerId && !n.read
        ).length;
      },

      // Chat - start empty
      chatMessages: [],
      addChatMessage: (message) => set((state) => {
        const newChatMessages = [...state.chatMessages, message];
        // Also update in teams array if activeTeamId exists
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, chatMessages: newChatMessages }
              : team
          );
        }
        return {
          chatMessages: newChatMessages,
          teams: updatedTeams,
        };
      }),
      deleteChatMessage: (messageId) => set((state) => {
        const newChatMessages = state.chatMessages.filter((m) => m.id !== messageId);
        // Also update in teams array if activeTeamId exists
        let updatedTeams = state.teams;
        if (state.activeTeamId) {
          updatedTeams = state.teams.map((team) =>
            team.id === state.activeTeamId
              ? { ...team, chatMessages: newChatMessages }
              : team
          );
        }
        return {
          chatMessages: newChatMessages,
          teams: updatedTeams,
        };
      }),
      updateChatMessage: (id, updates) => set((state) => {
        const newChatMessages = state.chatMessages.map((m) => m.id === id ? { ...m, ...updates } : m);
        return { chatMessages: newChatMessages };
      }),

      // Chat read tracking
      chatLastReadAt: {},
      markChatAsRead: (playerId) => set((state) => ({
        chatLastReadAt: {
          ...state.chatLastReadAt,
          [playerId]: new Date().toISOString(),
        },
      })),
      getUnreadChatCount: (playerId) => {
        const state = get();
        const lastReadAt = state.chatLastReadAt[playerId];
        if (!lastReadAt) {
          return 0;
        }
        return state.chatMessages.filter(
          (m) => m.senderId !== playerId && new Date(m.createdAt) > new Date(lastReadAt)
        ).length;
      },

      // Local event view tracking
      localViewedEventIds: [],
      markEventViewedLocally: (eventId) => set((state) => ({
        localViewedEventIds: state.localViewedEventIds.includes(eventId)
          ? state.localViewedEventIds
          : [...state.localViewedEventIds, eventId],
      })),

      // Direct Messages
      directMessages: [],
      addDirectMessage: (message) => set((state) => ({
        directMessages: [message, ...state.directMessages],
      })),
      markDirectMessageRead: (messageId, playerId) => set((state) => ({
        directMessages: state.directMessages.map((m) =>
          m.id === messageId && !m.readBy.includes(playerId)
            ? { ...m, readBy: [...m.readBy, playerId] }
            : m
        ),
      })),
      removeDirectMessage: (messageId) => set((state) => ({
        directMessages: state.directMessages.filter((m) => m.id !== messageId),
      })),
      getUnreadDirectMessageCount: (playerId) => {
        const state = get();
        return state.directMessages.filter(
          (m) => m.recipientIds.includes(playerId) && !m.readBy.includes(playerId)
        ).length;
      },

      // Payments
      paymentPeriods: [],
      addPaymentPeriod: (period) => set((state) => ({
        paymentPeriods: [...state.paymentPeriods, period],
      })),
      updatePaymentPeriod: (id, updates) => set((state) => ({
        paymentPeriods: state.paymentPeriods.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
      removePaymentPeriod: (id) => set((state) => ({
        paymentPeriods: state.paymentPeriods.filter((p) => p.id !== id),
      })),
      reorderPaymentPeriods: (periods) => set(() => ({
        paymentPeriods: periods,
      })),
      updatePlayerPayment: (periodId, playerId, status, amount, notes) => set((state) => ({
        paymentPeriods: state.paymentPeriods.map((period) => {
          if (period.id !== periodId) return period;
          const existingPayment = period.playerPayments.find((pp) => pp.playerId === playerId);
          if (existingPayment) {
            return {
              ...period,
              playerPayments: period.playerPayments.map((pp) =>
                pp.playerId === playerId
                  ? { ...pp, status, amount, notes, paidAt: status === 'paid' ? new Date().toISOString() : undefined }
                  : pp
              ),
            };
          } else {
            return {
              ...period,
              playerPayments: [
                ...period.playerPayments,
                { playerId, status, amount, notes, entries: [], paidAt: status === 'paid' ? new Date().toISOString() : undefined },
              ],
            };
          }
        }),
      })),

      addPaymentEntry: (periodId, playerId, entry) => set((state) => ({
        paymentPeriods: state.paymentPeriods.map((period) => {
          if (period.id !== periodId) return period;
          const existingPayment = period.playerPayments.find((pp) => pp.playerId === playerId);
          if (existingPayment) {
            const newEntries = [...(existingPayment.entries || []), entry];
            const totalPaid = newEntries.reduce((sum, e) => sum + e.amount, 0);
            const status = totalPaid >= period.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
            return {
              ...period,
              playerPayments: period.playerPayments.map((pp) =>
                pp.playerId === playerId
                  ? { ...pp, entries: newEntries, amount: totalPaid, status, paidAt: status === 'paid' ? new Date().toISOString() : undefined }
                  : pp
              ),
            };
          } else {
            const totalPaid = entry.amount;
            const status = totalPaid >= period.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
            return {
              ...period,
              playerPayments: [
                ...period.playerPayments,
                { playerId, status, amount: totalPaid, entries: [entry], paidAt: status === 'paid' ? new Date().toISOString() : undefined },
              ],
            };
          }
        }),
      })),

      removePaymentEntry: (periodId, playerId, entryId) => set((state) => ({
        paymentPeriods: state.paymentPeriods.map((period) => {
          if (period.id !== periodId) return period;
          const existingPayment = period.playerPayments.find((pp) => pp.playerId === playerId);
          if (!existingPayment) return period;
          const newEntries = (existingPayment.entries || []).filter((e) => e.id !== entryId);
          const totalPaid = newEntries.reduce((sum, e) => sum + e.amount, 0);
          const status = totalPaid >= period.amount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
          return {
            ...period,
            playerPayments: period.playerPayments.map((pp) =>
              pp.playerId === playerId
                ? { ...pp, entries: newEntries, amount: totalPaid, status, paidAt: status === 'paid' ? new Date().toISOString() : undefined }
                : pp
            ),
          };
        }),
      })),

      // Polls
      polls: [],
      addPoll: (poll) => set((state) => ({
        polls: [...state.polls, poll],
      })),
      updatePoll: (id, updates) => set((state) => ({
        polls: state.polls.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      })),
      removePoll: (id) => set((state) => ({
        polls: state.polls.filter((p) => p.id !== id),
      })),
      votePoll: (pollId, optionId, playerId) => set((state) => ({
        polls: state.polls.map((poll) => {
          if (poll.id !== pollId) return poll;
          return {
            ...poll,
            options: poll.options.map((option) => {
              if (option.id !== optionId) {
                // If not allowing multiple votes, remove player from other options
                if (!poll.allowMultipleVotes) {
                  return {
                    ...option,
                    votes: option.votes.filter((v) => v !== playerId),
                  };
                }
                return option;
              }
              // Add vote if not already voted
              if (option.votes.includes(playerId)) return option;
              return {
                ...option,
                votes: [...option.votes, playerId],
              };
            }),
          };
        }),
      })),
      unvotePoll: (pollId, optionId, playerId) => set((state) => ({
        polls: state.polls.map((poll) => {
          if (poll.id !== pollId) return poll;
          return {
            ...poll,
            options: poll.options.map((option) => {
              if (option.id !== optionId) return option;
              return {
                ...option,
                votes: option.votes.filter((v) => v !== playerId),
              };
            }),
          };
        }),
      })),

      // Team Links
      teamLinks: [],
      addTeamLink: (link) => set((state) => ({
        teamLinks: [...state.teamLinks, link],
      })),
      updateTeamLink: (id, updates) => set((state) => ({
        teamLinks: state.teamLinks.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      })),
      removeTeamLink: (id) => set((state) => ({
        teamLinks: state.teamLinks.filter((l) => l.id !== id),
      })),

      // Championships
      addChampionship: (championship) => set((state) => ({
        teamSettings: {
          ...state.teamSettings,
          championships: [...(state.teamSettings.championships || []), championship],
        },
      })),
      removeChampionship: (id) => set((state) => ({
        teamSettings: {
          ...state.teamSettings,
          championships: (state.teamSettings.championships || []).filter((c) => c.id !== id),
        },
      })),

      // Season Management
      setCurrentSeasonName: (name) => set((state) => ({
        teamSettings: {
          ...state.teamSettings,
          currentSeasonName: name,
        },
      })),

      archiveAndStartNewSeason: (seasonName) => {
        const state = get();
        const currentRecord = state.teamSettings.record;
        const players = state.players;
        const games = state.games;
        const sport = state.teamSettings.sport;

        // Calculate attendance for each player from games
        const playerAttendance = new Map<string, { invited: number; attended: number; declined: number }>();
        players.forEach(player => {
          playerAttendance.set(player.id, { invited: 0, attended: 0, declined: 0 });
        });

        games.forEach(game => {
          game.invitedPlayers?.forEach(playerId => {
            const stats = playerAttendance.get(playerId);
            if (stats) {
              stats.invited++;
              if (game.checkedInPlayers?.includes(playerId)) {
                stats.attended++;
              } else if (game.checkedOutPlayers?.includes(playerId)) {
                stats.declined++;
              }
            }
          });
        });

        // 1. Create archived player stats for ALL players (so we can show full roster)
        const archivedPlayerStats: ArchivedPlayerStats[] = players
          .map(player => {
            const attendance = playerAttendance.get(player.id);
            return {
              playerId: player.id,
              playerName: getPlayerName(player),
              jerseyNumber: player.number,
              position: player.position,
              positions: player.positions || [player.position],
              stats: player.stats,
              goalieStats: player.goalieStats,
              pitcherStats: player.pitcherStats,
              gamesInvited: attendance?.invited ?? 0,
              gamesAttended: attendance?.attended ?? 0,
              gamesDeclined: attendance?.declined ?? 0,
            };
          });

        // 2. Create archived team record
        const archivedTeamRecord: TeamRecord = {
          wins: currentRecord?.wins ?? 0,
          losses: currentRecord?.losses ?? 0,
          ties: currentRecord?.ties,
          otLosses: currentRecord?.otLosses,
          longestWinStreak: currentRecord?.longestWinStreak,
          longestLosingStreak: currentRecord?.longestLosingStreak,
          teamGoals: currentRecord?.teamGoals,
        };

        // 3. Create archived season
        const archivedSeason: ArchivedSeason = {
          id: Date.now().toString(),
          seasonName,
          sport,
          archivedAt: new Date().toISOString(),
          teamRecord: archivedTeamRecord,
          playerStats: archivedPlayerStats,
        };

        // 4. Check if this is a new best record (by win percentage)
        const existingHistory = state.teamSettings.seasonHistory || [];
        const currentWins = currentRecord?.wins ?? 0;
        const currentLosses = currentRecord?.losses ?? 0;
        const currentTies = currentRecord?.ties ?? 0;
        const currentTotal = currentWins + currentLosses + currentTies;
        const currentWinPct = currentTotal > 0 ? currentWins / currentTotal : 0;

        let newBestRecord = false;
        if (existingHistory.length === 0) {
          // First season archived is automatically best
          newBestRecord = currentTotal > 0;
        } else {
          // Compare against all previous seasons
          const bestPrevious = existingHistory.reduce((best, season) => {
            const w = season.teamRecord.wins;
            const l = season.teamRecord.losses;
            const t = season.teamRecord.ties ?? 0;
            const total = w + l + t;
            const pct = total > 0 ? w / total : 0;
            return pct > best.pct ? { pct, season } : best;
          }, { pct: 0, season: null as ArchivedSeason | null });

          newBestRecord = currentWinPct > bestPrevious.pct;
        }

        // 5. Add to season history
        const seasonHistory = [...existingHistory, archivedSeason];

        // 6. Zero out player stats
        const updatedPlayers = players.map(player => ({
          ...player,
          stats: undefined,
          goalieStats: undefined,
          pitcherStats: undefined,
          gameLogs: [], // Clear game logs for new season
        }));

        // 7. Zero out team record
        const newRecord: TeamRecord = {
          wins: 0,
          losses: 0,
          ties: (sport === 'hockey' || sport === 'soccer') ? 0 : undefined,
          otLosses: sport === 'hockey' ? 0 : undefined,
          longestWinStreak: 0,
          longestLosingStreak: 0,
        };

        // 8. Update state
        set({
          teamSettings: {
            ...state.teamSettings,
            seasonHistory,
            record: newRecord,
            currentSeasonName: undefined, // Clear until new season is named
          },
          players: updatedPlayers,
          games: [], // Clear games for new season (resets attendance)
        });

        return { success: true, newBestRecord };
      },

      unarchiveSeason: (seasonId, forceRestore = false) => {
        const state = get();
        const seasonHistory = state.teamSettings.seasonHistory || [];

        // Find the season to unarchive
        const seasonToRestore = seasonHistory.find(s => s.id === seasonId);
        if (!seasonToRestore) {
          return { success: false, message: 'Season not found' };
        }

        // Check if current season has any data (games played, stats recorded)
        const currentRecord = state.teamSettings.record;
        const hasCurrentSeasonData = (currentRecord?.wins ?? 0) > 0 ||
                                     (currentRecord?.losses ?? 0) > 0 ||
                                     (currentRecord?.ties ?? 0) > 0 ||
                                     state.games.length > 0;

        if (hasCurrentSeasonData && !forceRestore) {
          return {
            success: false,
            message: 'Current season has data. Restoring will discard current season games and stats. Use "Force Restore" if you want to proceed.',
            hasConflict: true
          };
        }

        // Remove the season from history
        const updatedHistory = seasonHistory.filter(s => s.id !== seasonId);

        // Restore player stats from the archived season
        const updatedPlayers = state.players.map(player => {
          const archivedStats = seasonToRestore.playerStats.find(ps => ps.playerId === player.id);
          if (archivedStats) {
            return {
              ...player,
              stats: archivedStats.stats,
              goalieStats: archivedStats.goalieStats as HockeyGoalieStats | SoccerGoalieStats | undefined,
              pitcherStats: archivedStats.pitcherStats,
            };
          }
          return player;
        });

        // Restore team record
        const restoredRecord: TeamRecord = {
          wins: seasonToRestore.teamRecord.wins,
          losses: seasonToRestore.teamRecord.losses,
          ties: seasonToRestore.teamRecord.ties,
          otLosses: seasonToRestore.teamRecord.otLosses,
          longestWinStreak: seasonToRestore.teamRecord.longestWinStreak,
          longestLosingStreak: seasonToRestore.teamRecord.longestLosingStreak,
          teamGoals: seasonToRestore.teamRecord.teamGoals,
        };

        // Update state - also clear games since we're restoring a previous season
        set({
          teamSettings: {
            ...state.teamSettings,
            seasonHistory: updatedHistory,
            record: restoredRecord,
            currentSeasonName: seasonToRestore.seasonName,
          },
          players: updatedPlayers,
          games: [], // Clear current games when restoring archived season
        });

        return { success: true, message: `Season "${seasonToRestore.seasonName}" has been restored.` };
      },

      currentPlayerId: null, // No default player
      setCurrentPlayerId: (id) => set({ currentPlayerId: id }),

      isLoggedIn: false,
      setIsLoggedIn: (loggedIn) => set({ isLoggedIn: loggedIn }),
      isSyncing: false,
      setIsSyncing: (syncing) => set({ isSyncing: syncing }),
      logout: () => {
        // Clear all in-memory team data — it will be loaded fresh from Supabase on next login.
        // Only session fields persist to AsyncStorage (via partialize).
        // IMPORTANT: activeTeamId must be cleared here so the _layout.tsx safety check
        // (isLoggedIn && players.length === 0 && !activeTeamId) doesn't fire a force-logout
        // mid-login when isLoggedIn briefly becomes true before players are repopulated.
        set({
          isLoggedIn: false,
          currentPlayerId: null,
          userEmail: null,
          userPhone: null,
          pendingTeamIds: null,
          activeTeamId: null,
          // Clear all in-memory team data
          players: [],
          games: [],
          events: [],
          photos: [],
          notifications: [],
          chatMessages: [],
          paymentPeriods: [],
          polls: [],
          teamLinks: [],
          teamName: 'My Team',
        });
      },

      deleteAccount: () => {
        const state = get();
        const { userEmail, userPhone, currentPlayerId } = state;

        // Fire-and-forget: backend handles deleting the player row + auth account from Supabase
        const backendUrl = BACKEND_URL;
        if (backendUrl && (currentPlayerId || userEmail)) {
          fetch(`${backendUrl}/api/auth/delete-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: currentPlayerId, email: userEmail }),
          }).catch(err => console.error('deleteAccount backend call failed:', err));
        }

        // Remove the current player from all teams they belong to
        const updatedTeams = state.teams.map((team) => {
          const playerInTeam = team.players.find(
            (p) =>
              (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userPhone && p.phone?.replace(/\D/g, '') === userPhone?.replace(/\D/g, '')) ||
              p.id === currentPlayerId
          );

          if (playerInTeam) {
            return {
              ...team,
              players: team.players.filter((p) => p.id !== playerInTeam.id),
              // Remove player from checked in/out lists in games
              games: team.games.map((g) => ({
                ...g,
                checkedInPlayers: g.checkedInPlayers.filter((id) => id !== playerInTeam.id),
                checkedOutPlayers: g.checkedOutPlayers.filter((id) => id !== playerInTeam.id),
                invitedPlayers: g.invitedPlayers.filter((id) => id !== playerInTeam.id),
              })),
              notifications: team.notifications.filter(
                (n) => n.toPlayerId !== playerInTeam.id && n.fromPlayerId !== playerInTeam.id
              ),
              chatMessages: team.chatMessages.filter((m) => m.senderId !== playerInTeam.id),
            };
          }
          return team;
        });

        // Also update current active team's players if loaded
        const updatedPlayers = state.players.filter(
          (p) =>
            !(
              (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userPhone && p.phone?.replace(/\D/g, '') === userPhone?.replace(/\D/g, '')) ||
              p.id === currentPlayerId
            )
        );

        // Clear all user data and log out
        set({
          teams: updatedTeams,
          players: updatedPlayers,
          isLoggedIn: false,
          currentPlayerId: null,
          userEmail: null,
          userPhone: null,
          pendingTeamIds: null,
          activeTeamId: null,
        });
      },

      // Authentication
      loginWithEmail: (email, password) => {
        const state = get();

        // First, find ALL teams where this email exists (regardless of password)
        const teamsWithEmail: { team: Team; player: Player }[] = [];
        let hasValidPassword = false;

        state.teams.forEach((team) => {
          const player = team.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
          if (player) {
            teamsWithEmail.push({ team, player });
            if (player.password === password) {
              hasValidPassword = true;
            }
          }
        });

        // If no teams found with this email, check fallback
        if (teamsWithEmail.length === 0) {
          const player = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
          if (!player) {
            return { success: false, error: 'No account found with this email' };
          }
          if (!player.password) {
            return { success: false, error: 'Please create an account first' };
          }
          if (player.password !== password) {
            return { success: false, error: 'Incorrect password' };
          }
          set({ currentPlayerId: player.id, isLoggedIn: true, userEmail: email.toLowerCase() });
          return { success: true, playerId: player.id };
        }

        // Verify password matches in at least one team
        if (!hasValidPassword) {
          // Check legacy data for password
          const legacyPlayer = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
          if (legacyPlayer?.password === password) {
            hasValidPassword = true;
          }
        }

        if (!hasValidPassword) {
          return { success: false, error: 'Incorrect password' };
        }

        // Password is valid - check if user exists in MULTIPLE teams
        if (teamsWithEmail.length > 1) {
          set({
            userEmail: email.toLowerCase(),
            pendingTeamIds: teamsWithEmail.map((t) => t.team.id),
          });
          return { success: true, multipleTeams: true, teamCount: teamsWithEmail.length };
        }

        // User exists in exactly one team
        const { team, player } = teamsWithEmail[0];
        set({
          activeTeamId: team.id,
          teamName: team.teamName,
          teamSettings: team.teamSettings,
          players: team.players,
          games: team.games,
          events: team.events,
          photos: team.photos,
          notifications: team.notifications,
          chatMessages: team.chatMessages,
          chatLastReadAt: team.chatLastReadAt,
          paymentPeriods: team.paymentPeriods,
          currentPlayerId: player.id,
          isLoggedIn: true,
          userEmail: email.toLowerCase(),
          pendingTeamIds: null,
        });
        return { success: true, playerId: player.id };
      },

      loginWithPhone: (phone, password) => {
        const state = get();
        const normalizedPhone = phone.replace(/\D/g, '');

        console.log('LOGIN PHONE: Checking teams array, length:', state.teams.length);
        console.log('LOGIN PHONE: Looking for phone:', normalizedPhone);

        // First, find ALL teams where this phone number exists (regardless of password)
        const teamsWithPhone: { team: Team; player: Player }[] = [];
        let hasValidPassword = false;

        state.teams.forEach((team) => {
          const player = team.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
          console.log('LOGIN PHONE: Team', team.teamName, '- found player:', player ? 'yes' : 'no', player?.password ? 'has password' : 'no password');
          if (player) {
            teamsWithPhone.push({ team, player });
            if (player.password === password) {
              hasValidPassword = true;
            }
          }
        });

        console.log('LOGIN PHONE: Teams with this phone:', teamsWithPhone.length, 'has valid password in any:', hasValidPassword);

        // If no teams found with this phone, check fallback
        if (teamsWithPhone.length === 0) {
          console.log('LOGIN PHONE: No teams found, checking legacy state.players');
          const player = state.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
          if (!player) {
            return { success: false, error: 'No account found with this phone number' };
          }
          if (!player.password) {
            return { success: false, error: 'Please create an account first' };
          }
          if (player.password !== password) {
            return { success: false, error: 'Incorrect password' };
          }
          set({ currentPlayerId: player.id, isLoggedIn: true, userPhone: normalizedPhone });
          return { success: true, playerId: player.id };
        }

        // Verify password matches in at least one team
        if (!hasValidPassword) {
          // Check legacy data for password
          const legacyPlayer = state.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
          if (legacyPlayer?.password === password) {
            hasValidPassword = true;
          }
        }

        if (!hasValidPassword) {
          return { success: false, error: 'Incorrect password' };
        }

        // Password is valid - check if user exists in MULTIPLE teams
        if (teamsWithPhone.length > 1) {
          console.log('LOGIN PHONE: User exists in multiple teams, showing team selection');
          set({
            userPhone: normalizedPhone,
            pendingTeamIds: teamsWithPhone.map((t) => t.team.id),
          });
          return { success: true, multipleTeams: true, teamCount: teamsWithPhone.length };
        }

        // User exists in exactly one team
        const { team, player } = teamsWithPhone[0];
        set({
          activeTeamId: team.id,
          teamName: team.teamName,
          teamSettings: team.teamSettings,
          players: team.players,
          games: team.games,
          events: team.events,
          photos: team.photos,
          notifications: team.notifications,
          chatMessages: team.chatMessages,
          chatLastReadAt: team.chatLastReadAt,
          paymentPeriods: team.paymentPeriods,
          currentPlayerId: player.id,
          isLoggedIn: true,
          userPhone: normalizedPhone,
          pendingTeamIds: null,
        });
        return { success: true, playerId: player.id };
      },

      // Verified login - skips password comparison (for use after secure-auth has verified password)
      loginWithEmailVerified: (email) => {
        const state = get();

        // Find ALL teams where this email exists
        const teamsWithEmail: { team: Team; player: Player }[] = [];

        state.teams.forEach((team) => {
          const player = team.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
          if (player) {
            teamsWithEmail.push({ team, player });
          }
        });

        // If no teams found with this email, check fallback
        if (teamsWithEmail.length === 0) {
          const player = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
          if (!player) {
            return { success: false, error: 'No account found with this email' };
          }
          set({ currentPlayerId: player.id, isLoggedIn: true, userEmail: email.toLowerCase() });
          return { success: true, playerId: player.id };
        }

        // Check if user exists in MULTIPLE teams
        if (teamsWithEmail.length > 1) {
          set({
            userEmail: email.toLowerCase(),
            pendingTeamIds: teamsWithEmail.map((t) => t.team.id),
          });
          return { success: true, multipleTeams: true, teamCount: teamsWithEmail.length };
        }

        // User exists in exactly one team
        const { team, player } = teamsWithEmail[0];
        set({
          activeTeamId: team.id,
          teamName: team.teamName,
          teamSettings: team.teamSettings,
          players: team.players,
          games: team.games,
          events: team.events,
          photos: team.photos,
          notifications: team.notifications,
          chatMessages: team.chatMessages,
          chatLastReadAt: team.chatLastReadAt,
          paymentPeriods: team.paymentPeriods,
          currentPlayerId: player.id,
          isLoggedIn: true,
          userEmail: email.toLowerCase(),
          pendingTeamIds: null,
        });
        return { success: true, playerId: player.id };
      },

      // Verified login by phone - skips password comparison
      loginWithPhoneVerified: (phone) => {
        const state = get();
        const normalizedPhone = phone.replace(/\D/g, '');

        // Find ALL teams where this phone number exists
        const teamsWithPhone: { team: Team; player: Player }[] = [];

        state.teams.forEach((team) => {
          const player = team.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
          if (player) {
            teamsWithPhone.push({ team, player });
          }
        });

        // If no teams found with this phone, check fallback
        if (teamsWithPhone.length === 0) {
          const player = state.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
          if (!player) {
            return { success: false, error: 'No account found with this phone number' };
          }
          set({ currentPlayerId: player.id, isLoggedIn: true, userPhone: normalizedPhone });
          return { success: true, playerId: player.id };
        }

        // Check if user exists in MULTIPLE teams
        if (teamsWithPhone.length > 1) {
          set({
            userPhone: normalizedPhone,
            pendingTeamIds: teamsWithPhone.map((t) => t.team.id),
          });
          return { success: true, multipleTeams: true, teamCount: teamsWithPhone.length };
        }

        // User exists in exactly one team
        const { team, player } = teamsWithPhone[0];
        set({
          activeTeamId: team.id,
          teamName: team.teamName,
          teamSettings: team.teamSettings,
          players: team.players,
          games: team.games,
          events: team.events,
          photos: team.photos,
          notifications: team.notifications,
          chatMessages: team.chatMessages,
          chatLastReadAt: team.chatLastReadAt,
          paymentPeriods: team.paymentPeriods,
          currentPlayerId: player.id,
          isLoggedIn: true,
          userPhone: normalizedPhone,
          pendingTeamIds: null,
        });
        return { success: true, playerId: player.id };
      },

      registerAdmin: (name, email, password, teamName, options) => {
        const state = get();
        // Check if email already exists
        const existingPlayer = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
        if (existingPlayer?.password) {
          return { success: false, error: 'An account with this email already exists' };
        }

        // Split name into firstName and lastName
        const nameParts = name.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const isCoach = options?.isCoach ?? false;
        const roles: PlayerRole[] = isCoach ? ['admin', 'coach'] : ['admin'];

        const newPlayer: Player = {
          id: Date.now().toString(),
          firstName,
          lastName,
          email: email.toLowerCase(),
          password,
          phone: options?.phone,
          number: isCoach ? '' : (options?.jerseyNumber || '1'),
          position: isCoach ? 'Coach' : SPORT_POSITIONS[state.teamSettings.sport][0],
          roles,
          status: 'active',
        };

        set({
          teamName,
          players: [newPlayer],
          currentPlayerId: newPlayer.id,
          isLoggedIn: true,
        });

        return { success: true };
      },

      registerInvitedPlayer: (email, password) => {
        const state = get();
        const player = state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
        if (!player) {
          return { success: false, error: 'No invitation found for this email. Ask your team admin to add you.' };
        }
        if (player.password) {
          return { success: false, error: 'Account already exists. Please log in instead.' };
        }

        // Update player with password
        const updatedPlayers = state.players.map((p) =>
          p.id === player.id ? { ...p, password } : p
        );

        set({
          players: updatedPlayers,
          currentPlayerId: player.id,
          isLoggedIn: true,
        });

        return { success: true, playerId: player.id };
      },

      registerInvitedPlayerByPhone: (phone, password) => {
        const state = get();
        // Normalize phone to just digits for comparison
        const normalizedPhone = phone.replace(/\D/g, '');
        const player = state.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
        if (!player) {
          return { success: false, error: 'No invitation found for this phone number. Ask your team admin to add you.' };
        }
        if (player.password) {
          return { success: false, error: 'Account already exists. Please log in instead.' };
        }

        // Update player with password
        const updatedPlayers = state.players.map((p) =>
          p.id === player.id ? { ...p, password } : p
        );

        set({
          players: updatedPlayers,
          currentPlayerId: player.id,
          isLoggedIn: true,
        });

        return { success: true, playerId: player.id };
      },

      findPlayerByEmail: (email) => {
        const state = get();
        return state.players.find((p) => p.email?.toLowerCase() === email.toLowerCase());
      },

      findPlayerByPhone: (phone) => {
        const state = get();
        const normalizedPhone = phone.replace(/\D/g, '');
        return state.players.find((p) => p.phone?.replace(/\D/g, '') === normalizedPhone);
      },

      canManageTeam: () => {
        const state = get();
        const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
        return currentPlayer?.roles?.includes('admin') || currentPlayer?.roles?.includes('captain') || currentPlayer?.roles?.includes('coach') || false;
      },
      canEditPlayers: () => {
        const state = get();
        const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
        return currentPlayer?.roles?.includes('admin') || currentPlayer?.roles?.includes('coach') || false;
      },
      isAdmin: () => {
        const state = get();
        const currentPlayer = state.players.find((p) => p.id === state.currentPlayerId);
        return currentPlayer?.roles?.includes('admin') || false;
      },

      // Notification Preferences
      updateNotificationPreferences: (playerId, prefs) => set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId
            ? {
                ...p,
                notificationPreferences: {
                  ...(p.notificationPreferences || defaultNotificationPreferences),
                  ...prefs,
                },
              }
            : p
        ),
      })),
      getNotificationPreferences: (playerId) => {
        const state = get();
        const player = state.players.find((p) => p.id === playerId);
        return player?.notificationPreferences || defaultNotificationPreferences;
      },

      // Game Logs
      addGameLog: (playerId, gameLog) => set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, gameLogs: [...(p.gameLogs || []), gameLog] }
            : p
        ),
      })),
      updateGameLog: (playerId, gameLogId, updates) => set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, gameLogs: (p.gameLogs || []).map((g) => g.id === gameLogId ? { ...g, ...updates } : g) }
            : p
        ),
      })),
      removeGameLog: (playerId, gameLogId) => set((state) => ({
        players: state.players.map((p) =>
          p.id === playerId
            ? { ...p, gameLogs: (p.gameLogs || []).filter((g) => g.id !== gameLogId) }
            : p
        ),
      })),

      // Reset all data to defaults - wipes team content but keeps player accounts
      resetAllData: () => {
        const state = get();
        const { activeTeamId } = state;

        // Fire-and-forget: backend wipes all team content from Supabase, leaves players/auth intact
        const backendUrl = BACKEND_URL;
        if (backendUrl && activeTeamId) {
          fetch(`${backendUrl}/api/auth/erase-team-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId: activeTeamId }),
          }).catch(err => console.error('resetAllData backend call failed:', err));
        }

        // Clear AsyncStorage completely to ensure no data remains
        AsyncStorage.clear().catch((err) => console.log('Error clearing AsyncStorage:', err));

        set({
          teamName: 'My Team',
          teamSettings: {
            sport: 'hockey',
            jerseyColors: [
              { name: 'White', color: '#ffffff' },
              { name: 'Black', color: '#1a1a1a' },
            ],
            paymentMethods: [],
            teamLogo: undefined,
            record: undefined,
            showTeamStats: true,
            showPayments: true,
            showTeamChat: true,
            showPhotos: true,
            showRefreshmentDuty: true,
            refreshmentDutyIs21Plus: true,
            showLineups: true,
          },
          games: [],
          events: [],
          photos: [],
          notifications: [],
          chatMessages: [],
          chatLastReadAt: {},
          paymentPeriods: [],
          polls: [],
          teamLinks: [],
          // Keep players in local state so they can still log back in
          // Keep teams array but clear active team content
          teams: [],
          activeTeamId: null,
          // Sign everyone out — they need to log back in
          currentPlayerId: null,
          isLoggedIn: false,
          userEmail: null,
          userPhone: null,
          pendingTeamIds: null,
        });
      },

      // Delete only the current team, preserve other teams user belongs to
      deleteCurrentTeam: () => {
        const state = get();
        const { activeTeamId, teams, userEmail, userPhone } = state;

        if (!activeTeamId) return;

        // Fire-and-forget: backend handles everything server-side from Supabase —
        // checks which players are exclusive to this team, deletes their auth accounts,
        // then deletes the team row (CASCADE removes all content).
        const backendUrl = BACKEND_URL;
        if (backendUrl) {
          fetch(`${backendUrl}/api/auth/delete-team`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teamId: activeTeamId }),
          }).catch(err => console.error('deleteCurrentTeam backend call failed:', err));
        }

        // Remove the current team from the teams array
        const remainingTeams = teams.filter(t => t.id !== activeTeamId);

        // Find other teams this user belongs to
        const userTeams = remainingTeams.filter(team =>
          team.players.some(p =>
            (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
            (userPhone && p.phone?.replace(/\D/g, '') === userPhone.replace(/\D/g, ''))
          )
        );

        if (userTeams.length > 0) {
          // User has other teams - switch to the first one
          const newActiveTeam = userTeams[0];
          set({
            teams: remainingTeams,
            activeTeamId: newActiveTeam.id,
            teamName: newActiveTeam.teamName,
            teamSettings: newActiveTeam.teamSettings,
            players: newActiveTeam.players,
            games: newActiveTeam.games || [],
            events: newActiveTeam.events || [],
            photos: newActiveTeam.photos || [],
            notifications: newActiveTeam.notifications || [],
            chatMessages: newActiveTeam.chatMessages || [],
            chatLastReadAt: newActiveTeam.chatLastReadAt || {},
            paymentPeriods: newActiveTeam.paymentPeriods || [],
            polls: newActiveTeam.polls || [],
            teamLinks: newActiveTeam.teamLinks || [],
            isLoggedIn: true,
            currentPlayerId: newActiveTeam.players.find(p =>
              (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
              (userPhone && p.phone?.replace(/\D/g, '') === userPhone.replace(/\D/g, ''))
            )?.id || null,
            pendingTeamIds: userTeams.length > 1 ? userTeams.map(t => t.id) : null,
          });
        } else {
          // User has no other teams - log them out completely
          set({
            teams: remainingTeams,
            activeTeamId: null,
            teamName: 'My Team',
            teamSettings: {
              sport: 'hockey',
              jerseyColors: [
                { name: 'White', color: '#ffffff' },
                { name: 'Black', color: '#1a1a1a' },
              ],
              paymentMethods: [],
              teamLogo: undefined,
              record: undefined,
              showTeamStats: true,
              showPayments: true,
              showTeamChat: true,
              showPhotos: true,
              showRefreshmentDuty: true,
              refreshmentDutyIs21Plus: true,
              showLineups: true,
            },
            players: [],
            games: [],
            events: [],
            photos: [],
            notifications: [],
            chatMessages: [],
            chatLastReadAt: {},
            paymentPeriods: [],
            polls: [],
            teamLinks: [],
            currentPlayerId: null,
            isLoggedIn: false,
            pendingTeamIds: null,
          });
        }
      },

      // Multi-team support
      teams: [],
      activeTeamId: null,
      userEmail: null,
      userPhone: null,
      pendingTeamIds: null,

      addTeam: (team) => set((state) => ({
        teams: [...state.teams, team],
      })),

      switchTeam: (teamId) => {
        const state = get();
        const team = state.teams.find((t) => t.id === teamId);
        if (!team) return;

        // First, sync current active team data back to teams array
        let updatedTeams = state.teams;
        if (state.activeTeamId && state.activeTeamId !== teamId) {
          updatedTeams = state.teams.map((t) =>
            t.id === state.activeTeamId
              ? {
                  ...t,
                  teamName: state.teamName,
                  teamSettings: state.teamSettings,
                  players: state.players,
                  games: state.games,
                  events: state.events,
                  photos: state.photos,
                  notifications: state.notifications,
                  chatMessages: state.chatMessages,
                  chatLastReadAt: state.chatLastReadAt,
                  paymentPeriods: state.paymentPeriods,
                  polls: state.polls,
                  teamLinks: state.teamLinks,
                }
              : t
          );
        }

        // Get the team data from the updated teams array (in case it was the one we just synced)
        const targetTeam = updatedTeams.find((t) => t.id === teamId) || team;

        // Find the current user in the new team
        const userInTeam = targetTeam.players.find(
          (p) => (state.userEmail && p.email?.toLowerCase() === state.userEmail.toLowerCase()) ||
                 (state.userPhone && p.phone?.replace(/\D/g, '') === state.userPhone.replace(/\D/g, ''))
        );

        set({
          teams: updatedTeams,
          activeTeamId: teamId,
          // Load team data into the "active" slots for backward compatibility
          teamName: targetTeam.teamName,
          teamSettings: targetTeam.teamSettings,
          players: targetTeam.players,
          games: targetTeam.games,
          events: targetTeam.events,
          photos: targetTeam.photos,
          notifications: targetTeam.notifications,
          chatMessages: targetTeam.chatMessages,
          chatLastReadAt: targetTeam.chatLastReadAt,
          paymentPeriods: targetTeam.paymentPeriods,
          polls: targetTeam.polls || [],
          teamLinks: targetTeam.teamLinks || [],
          currentPlayerId: userInTeam?.id || null,
          pendingTeamIds: null,
        });
      },

      getTeamsForUser: () => {
        const state = get();
        if (!state.userEmail && !state.userPhone) return [];

        return state.teams.filter((team) =>
          team.players.length === 0 // players not yet loaded — trust the teams array
            ? true
            : team.players.some(
                (p) => (state.userEmail && p.email?.toLowerCase() === state.userEmail!.toLowerCase()) ||
                       (state.userPhone && p.phone?.replace(/\D/g, '') === state.userPhone!.replace(/\D/g, ''))
              )
        );
      },

      getUserTeamCount: () => {
        return get().getTeamsForUser().length;
      },

      setPendingTeamSelection: (teamIds) => set({ pendingTeamIds: teamIds }),

      clearPendingTeamSelection: () => set({ pendingTeamIds: null }),

      createNewTeam: (teamName, sport, adminPlayer) => {
        const teamId = `team-${Date.now()}`;
        const newTeam: Team = {
          id: teamId,
          teamName,
          teamSettings: {
            sport,
            jerseyColors: [
              { name: 'White', color: '#ffffff' },
              { name: 'Black', color: '#1a1a1a' },
            ],
            paymentMethods: [],
            showTeamStats: true,
            showPayments: true,
            showTeamChat: true,
            showPhotos: true,
            showRefreshmentDuty: true,
            refreshmentDutyIs21Plus: true,
            showLineups: true,
          },
          players: [adminPlayer],
          games: [],
          events: [],
          photos: [],
          notifications: [],
          chatMessages: [],
          chatLastReadAt: {},
          paymentPeriods: [],
          polls: [],
          teamLinks: [],
        };

        set((state) => {
          // Sync the current active team's live data back into the teams array before adding new team
          const syncedTeams = state.activeTeamId
            ? state.teams.map((t) =>
                t.id === state.activeTeamId
                  ? {
                      ...t,
                      teamName: state.teamName,
                      teamSettings: state.teamSettings,
                      players: state.players,
                      games: state.games,
                      events: state.events,
                      photos: state.photos,
                      notifications: state.notifications,
                      chatMessages: state.chatMessages,
                      chatLastReadAt: state.chatLastReadAt,
                      paymentPeriods: state.paymentPeriods,
                      polls: state.polls || [],
                      teamLinks: state.teamLinks || [],
                    }
                  : t
              )
            : state.teams;

          return {
            teams: [...syncedTeams, newTeam],
            activeTeamId: teamId,
            teamName: newTeam.teamName,
            teamSettings: newTeam.teamSettings,
            players: newTeam.players,
            games: newTeam.games,
            events: newTeam.events,
            photos: newTeam.photos,
            notifications: newTeam.notifications,
            chatMessages: newTeam.chatMessages,
            chatLastReadAt: newTeam.chatLastReadAt,
            paymentPeriods: newTeam.paymentPeriods,
            currentPlayerId: adminPlayer.id,
            isLoggedIn: true,
            userEmail: adminPlayer.email || null,
            userPhone: adminPlayer.phone || null,
          };
        });

        return teamId;
      },
    }),
    {
      name: 'team-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 14,
      // Migration: preserve only session fields, discard old local team data
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;

        // Always preserve existing data - just add any new fields with defaults
        // This ensures users never lose their data during updates
        console.log(`Migrating store from version ${version} to version 14`);

        // v14: If activeTeamId points to a team with no players in the local store,
        // switch to the first team that has players (so users don't get stuck on an empty team)
        if (version < 14) {
          const teams = state.teams as Array<{ id: string; players: unknown[] }> | undefined;
          const activeTeamId = state.activeTeamId as string | null;
          if (teams && activeTeamId) {
            const activeTeam = teams.find(t => t.id === activeTeamId);
            if (!activeTeam || (activeTeam.players?.length ?? 0) === 0) {
              const teamWithPlayers = teams.find(t => (t.players?.length ?? 0) > 0);
              if (teamWithPlayers) {
                console.log(`Migration v14: switching activeTeamId from ${activeTeamId} to ${teamWithPlayers.id}`);
                state.activeTeamId = teamWithPlayers.id;
                state.pendingTeamIds = null;
              }
            }
          }
        }

        // Always ensure teamSettings has jerseyColors (may be missing from old persisted state)
        const ts = state.teamSettings as Record<string, unknown> | undefined;
        if (ts && !ts.jerseyColors) {
          ts.jerseyColors = [{ name: 'White', color: '#ffffff' }, { name: 'Black', color: '#1a1a1a' }];
        }
        // Also fix per-team teamSettings
        const teamsArr = state.teams as Array<{ teamSettings?: Record<string, unknown> }> | undefined;
        if (Array.isArray(teamsArr)) {
          teamsArr.forEach(t => {
            if (t.teamSettings && !t.teamSettings.jerseyColors) {
              t.teamSettings.jerseyColors = [{ name: 'White', color: '#ffffff' }, { name: 'Black', color: '#1a1a1a' }];
            }
          });
        }

        // Fix payment statuses - recalculate based on actual amounts paid
        if (version < 12) {
          // Fix paymentPeriods in root state
          const paymentPeriods = state.paymentPeriods as Array<{
            id: string;
            amount: number;
            playerPayments: Array<{
              playerId: string;
              status: string;
              amount?: number;
              entries?: Array<{ amount: number }>;
            }>;
          }> | undefined;

          if (paymentPeriods && Array.isArray(paymentPeriods)) {
            state.paymentPeriods = paymentPeriods.map((period) => ({
              ...period,
              playerPayments: Array.isArray(period?.playerPayments)
                ? period.playerPayments.map((pp) => {
                    const totalPaid = pp?.entries?.reduce((sum, e) => sum + (e?.amount ?? 0), 0) ?? pp?.amount ?? 0;
                    const periodAmount = period?.amount ?? 0;
                    const correctStatus = totalPaid >= periodAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
                    return { ...pp, status: correctStatus, amount: totalPaid };
                  })
                : [],
            }));
          }

          // Also fix paymentPeriods in teams array
          const teams = state.teams as Array<{
            id: string;
            paymentPeriods?: Array<{
              id: string;
              amount: number;
              playerPayments: Array<{
                playerId: string;
                status: string;
                amount?: number;
                entries?: Array<{ amount: number }>;
              }>;
            }>;
          }> | undefined;

          if (teams && Array.isArray(teams)) {
            state.teams = teams.map((team) => ({
              ...team,
              paymentPeriods: Array.isArray(team?.paymentPeriods)
                ? team.paymentPeriods.map((period) => ({
                    ...period,
                    playerPayments: Array.isArray(period?.playerPayments)
                      ? period.playerPayments.map((pp) => {
                          const totalPaid = pp?.entries?.reduce((sum, e) => sum + (e?.amount ?? 0), 0) ?? pp?.amount ?? 0;
                          const periodAmount = period?.amount ?? 0;
                          const correctStatus = totalPaid >= periodAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
                          return { ...pp, status: correctStatus, amount: totalPaid };
                        })
                      : [],
                  }))
                : undefined,
            }));
          }
        }

        // Return the existing state - Zustand will merge with defaults
        // Any new fields not in persisted state will use initial values
        return state;
      },
      // Only persist session/identity fields.
      // ALL team data (games, events, chat, payments, etc.) is loaded
      // fresh from Supabase on every login — the local store is just a cache.
      partialize: (state) => ({
        currentPlayerId: state.currentPlayerId,
        isLoggedIn: state.isLoggedIn,
        activeTeamId: state.activeTeamId,
        userEmail: state.userEmail,
        userPhone: state.userPhone,
        pendingTeamIds: null, // Never persist pendingTeamIds — always start fresh
        chatLastReadAt: state.chatLastReadAt,
        localViewedEventIds: state.localViewedEventIds,
        teamName: state.teamName,
        teamSettings: state.teamSettings, // Persist full settings so jerseyColors etc are available instantly
        teams: state.teams.map((t) => ({
          id: t.id,
          teamName: t.teamName,
          teamSettings: t.teamSettings, // Persist full settings per-team too
          players: t.players.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            phone: p.phone,
            roles: p.roles,
            number: p.number,
            position: p.position,
            status: p.status,
          })) as any[],
          games: [],
          events: [],
          photos: [],
          notifications: [],
          chatMessages: [],
          chatLastReadAt: {},
          paymentPeriods: [],
          polls: [],
          teamLinks: [],
        })),
      }),
    }
  )
);

// Export a hook to check if the store has been hydrated from AsyncStorage
export const useStoreHydrated = () => {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const handleHydration = () => {
      // Keep users logged in - don't force logout on hydration
      console.log('HYDRATION COMPLETE - preserving login state');
      const state = useTeamStore.getState();
      console.log('Current login state - isLoggedIn:', state.isLoggedIn, 'currentPlayerId:', state.currentPlayerId);

      // Auto-recovery: If there are no admins at all, make the current player an admin
      const hasAnyAdmin = state.players.some((p) => p.roles?.includes('admin'));
      if (!hasAnyAdmin && state.currentPlayerId && state.isLoggedIn && state.players.length > 0) {
        console.log('AUTO-RECOVERY: No admins found, promoting current player to admin');
        useTeamStore.setState((s) => ({
          players: s.players.map((p) =>
            p.id === s.currentPlayerId
              ? { ...p, roles: [...(p.roles || []), 'admin'] }
              : p
          ),
        }));
      }

      setHydrated(true);
    };

    // Check if already hydrated
    const unsubFinishHydration = useTeamStore.persist.onFinishHydration(handleHydration);

    // Also check if hydration already completed before subscription
    if (useTeamStore.persist.hasHydrated()) {
      handleHydration();
    }

    return () => {
      unsubFinishHydration();
    };
  }, []);

  return hydrated;
};

// ============================================
// Create Team Form Persistence Store
// ============================================
// This store persists form data during team creation so users don't lose progress
// when the app goes to background (e.g., to allow photo permissions)

export interface CreateTeamFormState {
  // Form data
  step: number;
  name: string;
  email: string;
  phone: string;
  jerseyNumber: string;
  memberRole: 'player' | 'reserve' | 'coach' | 'parent';
  password: string;
  confirmPassword: string;
  teamNameInput: string;
  sport: Sport | null;
  jerseyColors: { name: string; color: string }[];
  avatar: string | null;
  teamLogo: string | null;
  // Timestamp to auto-expire old data
  lastUpdated: number;
  // Actions
  setFormData: (data: Partial<Omit<CreateTeamFormState, 'setFormData' | 'clearFormData' | 'lastUpdated'>>) => void;
  clearFormData: () => void;
}

const initialCreateTeamFormState = {
  step: 1,
  name: '',
  email: '',
  phone: '',
  jerseyNumber: '',
  memberRole: 'player' as const,
  password: '',
  confirmPassword: '',
  teamNameInput: '',
  sport: null as Sport | null,
  jerseyColors: [] as { name: string; color: string }[],
  avatar: null as string | null,
  teamLogo: null as string | null,
  lastUpdated: 0,
};

export const useCreateTeamFormStore = create<CreateTeamFormState>()(
  persist(
    (set) => ({
      ...initialCreateTeamFormState,
      setFormData: (data) => set((state) => ({
        ...state,
        ...data,
        lastUpdated: Date.now()
      })),
      clearFormData: () => set({
        ...initialCreateTeamFormState,
        lastUpdated: 0,
      }),
    }),
    {
      name: 'create-team-form-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Migration function to preserve form data during app updates
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        console.log(`Migrating create-team-form from version ${version} to version 1`);
        return state;
      },
    }
  )
);

// Hook to check if form data is still valid (not expired after 10 minutes)
export const useCreateTeamFormValid = () => {
  const lastUpdated = useCreateTeamFormStore((s) => s.lastUpdated);
  const TEN_MINUTES = 10 * 60 * 1000;
  return lastUpdated > 0 && (Date.now() - lastUpdated) < TEN_MINUTES;
};
