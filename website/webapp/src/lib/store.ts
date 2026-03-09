'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Player, Game, Event, Photo, AppNotification, ChatMessage,
  PaymentPeriod, PlayerPayment, PaymentEntry, Poll, TeamLink,
  Team, TeamSettings, Sport, Championship
} from './types';

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
  showTeamRecords: true,
};

interface TeamStore {
  // Core data
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

  // Auth
  isLoggedIn: boolean;
  currentPlayerId: string | null;
  userEmail: string | null;
  userPhone: string | null;
  activeTeamId: string | null;
  pendingTeamIds: string[] | null;

  // Multi-team
  teams: Team[];

  // Setters
  setTeamName: (name: string) => void;
  setTeamSettings: (settings: Partial<TeamSettings>) => void;
  setPlayers: (players: Player[]) => void;
  setGames: (games: Game[]) => void;
  setEvents: (events: Event[]) => void;
  setPhotos: (photos: Photo[]) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  setPaymentPeriods: (periods: PaymentPeriod[]) => void;
  setNotifications: (notifications: AppNotification[]) => void;
  setPolls: (polls: Poll[]) => void;
  setTeamLinks: (links: TeamLink[]) => void;

  // Player mutations
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, updates: Partial<Player>) => void;
  removePlayer: (id: string) => void;

  // Game mutations
  addGame: (game: Game) => void;
  updateGame: (id: string, updates: Partial<Game>) => void;
  removeGame: (id: string) => void;
  checkInToGame: (gameId: string, playerId: string) => void;
  checkOutFromGame: (gameId: string, playerId: string, note?: string) => void;
  clearPlayerResponse: (gameId: string, playerId: string) => void;

  // Event mutations
  addEvent: (event: Event) => void;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  removeEvent: (id: string) => void;
  confirmEventAttendance: (eventId: string, playerId: string) => void;
  declineEventAttendance: (eventId: string, playerId: string, note?: string) => void;

  // Photo mutations
  addPhoto: (photo: Photo) => void;
  removePhoto: (id: string) => void;

  // Chat mutations
  addChatMessage: (message: ChatMessage) => void;
  deleteChatMessage: (id: string) => void;
  markChatAsRead: (playerId: string) => void;
  getUnreadChatCount: (playerId: string) => number;

  // Payment mutations
  addPaymentPeriod: (period: PaymentPeriod) => void;
  updatePaymentPeriod: (id: string, updates: Partial<PaymentPeriod>) => void;
  removePaymentPeriod: (id: string) => void;
  updatePlayerPayment: (periodId: string, playerId: string, status: 'unpaid' | 'paid' | 'partial', amount?: number, notes?: string) => void;
  addPaymentEntry: (periodId: string, playerId: string, entry: PaymentEntry) => void;
  removePaymentEntry: (periodId: string, playerId: string, entryId: string) => void;

  // Notification mutations
  addNotification: (n: AppNotification) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  getUnreadCount: () => number;

  // Championship
  addChampionship: (c: Championship) => void;
  removeChampionship: (id: string) => void;

  // Auth actions
  setIsLoggedIn: (v: boolean) => void;
  setCurrentPlayerId: (id: string | null) => void;
  setActiveTeamId: (id: string | null) => void;
  setUserEmail: (email: string | null) => void;
  setUserPhone: (phone: string | null) => void;
  setPendingTeamSelection: (teamIds: string[]) => void;
  clearPendingTeamSelection: () => void;
  switchTeam: (teamId: string) => void;
  logout: () => void;

  // Permissions
  isAdmin: () => boolean;
  canManageTeam: () => boolean;
  canEditPlayers: () => boolean;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set, get) => ({
      teamName: 'My Team',
      teamSettings: defaultTeamSettings,
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
      isLoggedIn: false,
      currentPlayerId: null,
      userEmail: null,
      userPhone: null,
      activeTeamId: null,
      pendingTeamIds: null,
      teams: [],

      setTeamName: (name) => set({ teamName: name }),
      setTeamSettings: (settings) => set((s) => ({ teamSettings: { ...s.teamSettings, ...settings } })),
      setPlayers: (players) => set({ players }),
      setGames: (games) => set({ games }),
      setEvents: (events) => set({ events }),
      setPhotos: (photos) => set({ photos }),
      setChatMessages: (chatMessages) => set({ chatMessages }),
      setPaymentPeriods: (paymentPeriods) => set({ paymentPeriods }),
      setNotifications: (notifications) => set({ notifications }),
      setPolls: (polls) => set({ polls }),
      setTeamLinks: (teamLinks) => set({ teamLinks }),

      addPlayer: (player) => set((s) => {
        if (s.players.some((p) => p.id === player.id)) {
          return { players: s.players.map((p) => p.id === player.id ? { ...p, ...player } : p) };
        }
        return { players: [...s.players, player] };
      }),
      updatePlayer: (id, updates) => set((s) => ({
        players: s.players.map((p) => p.id === id ? { ...p, ...updates } : p),
      })),
      removePlayer: (id) => set((s) => ({ players: s.players.filter((p) => p.id !== id) })),

      addGame: (game) => set((s) => {
        if (s.games.some((g) => g.id === game.id)) return s;
        return { games: [...s.games, game].sort((a, b) => a.date.localeCompare(b.date)) };
      }),
      updateGame: (id, updates) => set((s) => ({
        games: s.games.map((g) => g.id === id ? { ...g, ...updates } : g),
      })),
      removeGame: (id) => set((s) => ({ games: s.games.filter((g) => g.id !== id) })),
      checkInToGame: (gameId, playerId) => set((s) => ({
        games: s.games.map((g) => {
          if (g.id !== gameId) return g;
          const checkedIn = [...(g.checkedInPlayers || []).filter((id) => id !== playerId), playerId];
          const checkedOut = (g.checkedOutPlayers || []).filter((id) => id !== playerId);
          const invited = (g.invitedPlayers || []).includes(playerId) ? g.invitedPlayers : [...(g.invitedPlayers || []), playerId];
          return { ...g, checkedInPlayers: checkedIn, checkedOutPlayers: checkedOut, invitedPlayers: invited };
        }),
      })),
      checkOutFromGame: (gameId, playerId, note) => set((s) => ({
        games: s.games.map((g) => {
          if (g.id !== gameId) return g;
          const checkedOut = [...(g.checkedOutPlayers || []).filter((id) => id !== playerId), playerId];
          const checkedIn = (g.checkedInPlayers || []).filter((id) => id !== playerId);
          const invited = (g.invitedPlayers || []).includes(playerId) ? g.invitedPlayers : [...(g.invitedPlayers || []), playerId];
          const notes = note ? { ...(g.checkoutNotes || {}), [playerId]: note } : g.checkoutNotes;
          return { ...g, checkedInPlayers: checkedIn, checkedOutPlayers: checkedOut, invitedPlayers: invited, checkoutNotes: notes };
        }),
      })),
      clearPlayerResponse: (gameId, playerId) => set((s) => ({
        games: s.games.map((g) => {
          if (g.id !== gameId) return g;
          return {
            ...g,
            checkedInPlayers: (g.checkedInPlayers || []).filter((id) => id !== playerId),
            checkedOutPlayers: (g.checkedOutPlayers || []).filter((id) => id !== playerId),
          };
        }),
      })),

      addEvent: (event) => set((s) => {
        if (s.events.some((e) => e.id === event.id)) return s;
        return { events: [...s.events, event].sort((a, b) => a.date.localeCompare(b.date)) };
      }),
      updateEvent: (id, updates) => set((s) => ({
        events: s.events.map((e) => e.id === id ? { ...e, ...updates } : e),
      })),
      removeEvent: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      confirmEventAttendance: (eventId, playerId) => set((s) => ({
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          const confirmed = [...(e.confirmedPlayers || []).filter((id) => id !== playerId), playerId];
          const declined = (e.declinedPlayers || []).filter((id) => id !== playerId);
          return { ...e, confirmedPlayers: confirmed, declinedPlayers: declined };
        }),
      })),
      declineEventAttendance: (eventId, playerId, note) => set((s) => ({
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          const declined = [...(e.declinedPlayers || []).filter((id) => id !== playerId), playerId];
          const confirmed = (e.confirmedPlayers || []).filter((id) => id !== playerId);
          const notes = note ? { ...(e.declinedNotes || {}), [playerId]: note } : e.declinedNotes;
          return { ...e, confirmedPlayers: confirmed, declinedPlayers: declined, declinedNotes: notes };
        }),
      })),

      addPhoto: (photo) => set((s) => ({ photos: [photo, ...s.photos] })),
      removePhoto: (id) => set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),

      addChatMessage: (message) => set((s) => {
        if (s.chatMessages.some((m) => m.id === message.id)) return s;
        return { chatMessages: [...s.chatMessages, message] };
      }),
      deleteChatMessage: (id) => set((s) => ({ chatMessages: s.chatMessages.filter((m) => m.id !== id) })),
      markChatAsRead: (playerId) => set((s) => ({
        chatLastReadAt: { ...s.chatLastReadAt, [playerId]: new Date().toISOString() },
      })),
      getUnreadChatCount: (playerId) => {
        const s = get();
        const lastRead = s.chatLastReadAt[playerId];
        if (!lastRead) return s.chatMessages.filter((m) => m.senderId !== playerId).length;
        return s.chatMessages.filter((m) => m.senderId !== playerId && m.createdAt > lastRead).length;
      },

      addPaymentPeriod: (period) => set((s) => ({ paymentPeriods: [...s.paymentPeriods, period] })),
      updatePaymentPeriod: (id, updates) => set((s) => ({
        paymentPeriods: s.paymentPeriods.map((p) => p.id === id ? { ...p, ...updates } : p),
      })),
      removePaymentPeriod: (id) => set((s) => ({ paymentPeriods: s.paymentPeriods.filter((p) => p.id !== id) })),
      updatePlayerPayment: (periodId, playerId, status, amount, notes) => set((s) => ({
        paymentPeriods: s.paymentPeriods.map((period) => {
          if (period.id !== periodId) return period;
          const existing = period.playerPayments.find((pp) => pp.playerId === playerId);
          const updated: PlayerPayment = existing
            ? { ...existing, status, amount: amount ?? existing.amount, notes: notes ?? existing.notes }
            : { playerId, status, amount: amount ?? 0, notes, entries: [] };
          const payments = existing
            ? period.playerPayments.map((pp) => pp.playerId === playerId ? updated : pp)
            : [...period.playerPayments, updated];
          return { ...period, playerPayments: payments };
        }),
      })),
      addPaymentEntry: (periodId, playerId, entry) => set((s) => ({
        paymentPeriods: s.paymentPeriods.map((period) => {
          if (period.id !== periodId) return period;
          return {
            ...period,
            playerPayments: period.playerPayments.map((pp) => {
              if (pp.playerId !== playerId) return pp;
              return { ...pp, entries: [...(pp.entries || []), entry] };
            }),
          };
        }),
      })),
      removePaymentEntry: (periodId, playerId, entryId) => set((s) => ({
        paymentPeriods: s.paymentPeriods.map((period) => {
          if (period.id !== periodId) return period;
          return {
            ...period,
            playerPayments: period.playerPayments.map((pp) => {
              if (pp.playerId !== playerId) return pp;
              return { ...pp, entries: (pp.entries || []).filter((e) => e.id !== entryId) };
            }),
          };
        }),
      })),

      addNotification: (n) => set((s) => {
        if (s.notifications.some((notif) => notif.id === n.id)) return s;
        return { notifications: [n, ...s.notifications] };
      }),
      markNotificationRead: (id) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      })),
      clearNotifications: () => set({ notifications: [] }),
      getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

      addChampionship: (c) => set((s) => ({
        teamSettings: { ...s.teamSettings, championships: [...(s.teamSettings.championships || []), c] },
      })),
      removeChampionship: (id) => set((s) => ({
        teamSettings: { ...s.teamSettings, championships: (s.teamSettings.championships || []).filter((c) => c.id !== id) },
      })),

      setIsLoggedIn: (v) => set({ isLoggedIn: v }),
      setCurrentPlayerId: (id) => set({ currentPlayerId: id }),
      setActiveTeamId: (id) => set({ activeTeamId: id }),
      setUserEmail: (email) => set({ userEmail: email }),
      setUserPhone: (phone) => set({ userPhone: phone }),
      setPendingTeamSelection: (teamIds) => set({ pendingTeamIds: teamIds }),
      clearPendingTeamSelection: () => set({ pendingTeamIds: null }),

      switchTeam: (teamId) => {
        const s = get();
        const team = s.teams.find((t) => t.id === teamId);
        if (!team) return;
        set({
          activeTeamId: teamId,
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
          polls: team.polls,
          teamLinks: team.teamLinks,
        });
      },

      logout: () => set({
        isLoggedIn: false,
        currentPlayerId: null,
        userEmail: null,
        activeTeamId: null,
        pendingTeamIds: null,
        teamName: 'My Team',
        teamSettings: defaultTeamSettings,
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
        teams: [],
      }),

      isAdmin: () => {
        const s = get();
        const player = s.players.find((p) => p.id === s.currentPlayerId);
        return player?.roles?.includes('admin') ?? false;
      },
      canManageTeam: () => {
        const s = get();
        const player = s.players.find((p) => p.id === s.currentPlayerId);
        return player?.roles?.some((r) => r === 'admin' || r === 'captain') ?? false;
      },
      canEditPlayers: () => {
        const s = get();
        const player = s.players.find((p) => p.id === s.currentPlayerId);
        return player?.roles?.some((r) => r === 'admin' || r === 'captain') ?? false;
      },
    }),
    {
      name: 'align-sports-web',
      skipHydration: true,
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        teamName: state.teamName,
        teamSettings: state.teamSettings,
        players: state.players,
        games: state.games,
        events: state.events,
        photos: state.photos,
        chatMessages: state.chatMessages,
        chatLastReadAt: state.chatLastReadAt,
        paymentPeriods: state.paymentPeriods,
        polls: state.polls,
        teamLinks: state.teamLinks,
        isLoggedIn: state.isLoggedIn,
        currentPlayerId: state.currentPlayerId,
        userEmail: state.userEmail,
        activeTeamId: state.activeTeamId,
        teams: state.teams,
      }),
    }
  )
);
