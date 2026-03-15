import { View, Text, ScrollView, Pressable, Alert, Modal, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Circle,
  Navigation,
  Calendar,
  X,
  Check,
  Trash2,
  Send,
  UserPlus,
  Bell,
  BellOff,
  StickyNote,
  FileText,
  Eye,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTeamStore, Player, getPlayerName, AppNotification, InviteReleaseOption } from '@/lib/store';
import { pushEventToSupabase, pushEventResponseToSupabase, pushEventViewedToSupabase, pushNotificationToSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/cn';
import { AddressSearch } from '@/components/AddressSearch';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { sendPushToPlayers, scheduleEventReminderDayBefore, scheduleEventReminderHourBefore } from '@/lib/notifications';

interface PlayerRowProps {
  player: Player;
  status: 'confirmed' | 'declined' | 'none';
  onToggle: () => void;
  index: number;
  canToggle: boolean;
  isSelf: boolean;
  hasViewed?: boolean;
  showViewedBadge?: boolean;
}

function PlayerRow({ player, status, onToggle, index, canToggle, isSelf, hasViewed, showViewedBadge }: PlayerRowProps) {
  const handlePress = () => {
    if (!canToggle) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).springify()}>
      <Pressable
        onPress={handlePress}
        disabled={!canToggle}
        className={cn(
          'flex-row items-center p-3 rounded-xl mb-2',
          status === 'confirmed' ? 'bg-green-500/20' : status === 'declined' ? 'bg-red-500/20' : 'bg-slate-800/60',
          !canToggle && 'opacity-60'
        )}
      >
        <View className="relative">
          <PlayerAvatar player={player} size={44} />
          {status === 'confirmed' && (
            <View className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-0.5">
              <CheckCircle2 size={14} color="white" />
            </View>
          )}
          {status === 'declined' && (
            <View className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-0.5">
              <XCircle size={14} color="white" />
            </View>
          )}
          {isSelf && (
            <View className="absolute -top-1 -right-1 bg-cyan-500 rounded-full px-1.5 py-0.5">
              <Text className="text-white text-[8px] font-bold">YOU</Text>
            </View>
          )}
        </View>

        <View className="flex-1 ml-3">
          <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
          <Text className="text-slate-400 text-xs">
            #{player.number}{player.position ? ` · ${player.position}` : ''}
          </Text>
          {showViewedBadge && hasViewed && status === 'none' && (
            <View className="flex-row items-center mt-0.5">
              <Eye size={10} color="#22d3ee" />
              <Text className="text-cyan-400 text-[10px] ml-0.5">Viewed</Text>
            </View>
          )}
        </View>

        {status === 'confirmed' ? (
          <CheckCircle2 size={24} color="#22c55e" />
        ) : status === 'declined' ? (
          <XCircle size={24} color="#ef4444" />
        ) : (
          <Circle size={24} color={canToggle ? '#475569' : '#334155'} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const events = useTeamStore((s) => s.events);
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);
  const updateEvent = useTeamStore((s) => s.updateEvent);
  const removeEvent = useTeamStore((s) => s.removeEvent);
  const addNotification = useTeamStore((s) => s.addNotification);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  // Wrapper: updates local store AND pushes to Supabase
  const updateEventAndSync = (eventId: string, updates: Parameters<typeof updateEvent>[1]) => {
    updateEvent(eventId, updates);
    if (activeTeamId) {
      const currentEvent = useTeamStore.getState().events.find((e) => e.id === eventId);
      if (currentEvent) {
        pushEventToSupabase({ ...currentEvent, ...updates } as any, activeTeamId).catch(console.error);
      }
    }
  };
  const canManageTeam = useTeamStore((s) => s.canManageTeam);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const markEventViewed = useTeamStore((s) => s.markEventViewed);

  const event = events.find((e) => e.id === id);

  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isReleaseInvitesModalVisible, setIsReleaseInvitesModalVisible] = useState(false);
  // Inline edit modal states
  const [isEditTitleModalVisible, setIsEditTitleModalVisible] = useState(false);
  const [isEditDateModalVisible, setIsEditDateModalVisible] = useState(false);
  const [isEditTimeModalVisible, setIsEditTimeModalVisible] = useState(false);
  const [isEditLocationModalVisible, setIsEditLocationModalVisible] = useState(false);
  const [isEditNotesModalVisible, setIsEditNotesModalVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState(new Date());
  const [editTime, setEditTime] = useState(new Date());
  const [editNotes, setEditNotes] = useState('');
  // Invite release edit state
  const [editInviteReleaseOption, setEditInviteReleaseOption] = useState<InviteReleaseOption>('now');
  const [editInviteReleaseDate, setEditInviteReleaseDate] = useState(new Date());
  const [showEditInviteReleaseDatePicker, setShowEditInviteReleaseDatePicker] = useState(false);

  // Helper: parents/guardians cannot be invited to or check in to any event
  const isParent = (p: { roles?: string[]; position?: string }) =>
    p.roles?.includes('parent') || p.position === 'Parent';

  // Auto-purge parents from invitedPlayers if previously added
  useEffect(() => {
    if (!event?.invitedPlayers?.length) return;
    const parentIds = new Set(players.filter(isParent).map((p) => p.id));
    const hasParent = event.invitedPlayers.some((id) => parentIds.has(id));
    if (hasParent) {
      updateEventAndSync(event.id, {
        invitedPlayers: event.invitedPlayers.filter((id) => !parentIds.has(id)),
      });
    }
  }, [event?.id]);

  // Track that this player has viewed the event
  useEffect(() => {
    if (!event || !currentPlayerId) return;
    const alreadyViewed = event.viewedBy?.includes(currentPlayerId);
    if (alreadyViewed) return;
    markEventViewed(event.id, currentPlayerId);
    pushEventViewedToSupabase(event.id, currentPlayerId).catch(console.error);
  }, [event?.id, currentPlayerId]);

  if (!event) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center">
        <Text className="text-white text-lg">Event not found</Text>
        <Pressable onPress={() => router.back()} className="mt-4">
          <Text className="text-cyan-400">Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const eventDate = parseISO(event.date);
  const formattedDate = format(eventDate, 'EEEE, MMMM d, yyyy');

  // Get invited players
  const invitedPlayers = players.filter((p) => event.invitedPlayers?.includes(p.id));

  // Get uninvited players for the invite modal — parents cannot be invited
  const uninvitedPlayers = players.filter((p) => !event.invitedPlayers?.includes(p.id) && !isParent(p));
  const uninvitedActive = uninvitedPlayers.filter((p) => p.status === 'active');
  const uninvitedReserve = uninvitedPlayers.filter((p) => p.status === 'reserve');

  // Get confirmed and declined players
  const confirmedPlayers = event.confirmedPlayers || [];
  const declinedPlayers = event.declinedPlayers || [];

  // Sort invited players: confirmed first, then pending, then declined
  const sortedInvitedPlayers = [...invitedPlayers].sort((a, b) => {
    const statusOrder = { confirmed: 0, none: 1, declined: 2 };
    const aStatus = confirmedPlayers.includes(a.id) ? 'confirmed' : declinedPlayers.includes(a.id) ? 'declined' : 'none';
    const bStatus = confirmedPlayers.includes(b.id) ? 'confirmed' : declinedPlayers.includes(b.id) ? 'declined' : 'none';
    return statusOrder[aStatus] - statusOrder[bStatus];
  });

  // If the current player isn't invited yet, show their row first so they can self-RSVP
  const currentPlayerInEventList = sortedInvitedPlayers.some((p) => p.id === currentPlayerId);
  const currentPlayerEventObj = !currentPlayerInEventList && currentPlayerId ? players.find((p) => p.id === currentPlayerId) : null;
  const playersToDisplay = currentPlayerEventObj ? [currentPlayerEventObj, ...sortedInvitedPlayers] : sortedInvitedPlayers;

  const getPlayerStatus = (playerId: string): 'confirmed' | 'declined' | 'none' => {
    if (confirmedPlayers.includes(playerId)) return 'confirmed';
    if (declinedPlayers.includes(playerId)) return 'declined';
    return 'none';
  };

  const togglePlayerStatus = (playerId: string) => {
    const currentStatus = getPlayerStatus(playerId);
    const isInvited = event.invitedPlayers?.includes(playerId);
    let newConfirmed = [...confirmedPlayers];
    let newDeclined = [...declinedPlayers];
    let newResponse: 'confirmed' | 'declined' | 'invited' | null = null;

    // If the player isn't invited yet (self-RSVP), add them to the invite list first
    if (!isInvited && activeTeamId) {
      updateEventAndSync(event.id, {
        invitedPlayers: [...(event.invitedPlayers ?? []), playerId],
      });
      pushEventResponseToSupabase(event.id, playerId, 'invited').catch(console.error);
    }

    if (currentStatus === 'none') {
      // No response -> Confirmed
      newConfirmed.push(playerId);
      newResponse = 'confirmed';

      // Schedule local reminders on this device if the current player is confirming themselves
      if (playerId === currentPlayerId) {
        const notificationPrefs = players.find((p) => p.id === currentPlayerId)?.notificationPreferences;
        const timeMatch = event.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1], 10);
          const minutes = parseInt(timeMatch[2], 10);
          const isPM = timeMatch[3].toUpperCase() === 'PM';
          const eventDateTime = new Date(eventDate);
          eventDateTime.setHours(isPM && hours !== 12 ? hours + 12 : !isPM && hours === 12 ? 0 : hours, minutes, 0, 0);
          if (notificationPrefs?.gameReminderDayBefore !== false) {
            scheduleEventReminderDayBefore(event.id, event.title, eventDateTime, event.time);
          }
          if (notificationPrefs?.gameReminderHoursBefore !== false) {
            scheduleEventReminderHourBefore(event.id, event.title, eventDateTime, event.time);
          }
        }
      }
    } else if (currentStatus === 'confirmed') {
      // Confirmed -> Declined - cancel any scheduled reminders on this device
      newConfirmed = newConfirmed.filter((id) => id !== playerId);
      newDeclined.push(playerId);
      newResponse = 'declined';
      if (playerId === currentPlayerId) {
        Notifications.cancelAllScheduledNotificationsAsync().catch(console.error);
      }
    } else {
      // Declined -> No response (back to invited)
      newDeclined = newDeclined.filter((id) => id !== playerId);
      newResponse = 'invited';
    }

    updateEvent(event.id, {
      confirmedPlayers: newConfirmed,
      declinedPlayers: newDeclined,
    });

    // Push the response to Supabase so all other users see the change in real time
    if (activeTeamId && newResponse) {
      pushEventResponseToSupabase(event.id, playerId, newResponse).catch(console.error);
    }
  };

  const openInMaps = () => {
    const address = event.address || event.location;
    const url = `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  // Inline edit handlers
  const openEditTitleModal = () => {
    setEditTitle(event.title);
    setIsEditTitleModalVisible(true);
  };

  const handleSaveTitle = () => {
    if (!editTitle.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    updateEventAndSync(event.id, { title: editTitle.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditTitleModalVisible(false);
  };

  const openEditDateModal = () => {
    setEditDate(eventDate);
    setIsEditDateModalVisible(true);
  };

  const handleSaveDate = () => {
    updateEventAndSync(event.id, { date: editDate.toISOString() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditDateModalVisible(false);
  };

  const openEditTimeModal = () => {
    const timeParts = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    const timeDate = new Date();
    if (timeParts) {
      let hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const period = timeParts[3].toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      timeDate.setHours(hours, minutes, 0, 0);
    }
    setEditTime(timeDate);
    setIsEditTimeModalVisible(true);
  };

  const handleSaveTime = () => {
    const timeString = format(editTime, 'h:mm a');
    updateEventAndSync(event.id, { time: timeString });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditTimeModalVisible(false);
  };

  const openEditLocationModal = () => {
    setEditLocation(event.location);
    setIsEditLocationModalVisible(true);
  };

  const handleSaveLocation = () => {
    if (!editLocation.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    updateEventAndSync(event.id, { location: editLocation.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditLocationModalVisible(false);
  };

  const openEditNotesModal = () => {
    setEditNotes(event.notes || '');
    setIsEditNotesModalVisible(true);
  };

  const handleSaveNotes = () => {
    updateEventAndSync(event.id, { notes: editNotes.trim() || undefined });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsEditNotesModalVisible(false);
  };

  const handleSaveReleaseInvites = () => {
    updateEventAndSync(event.id, {
      inviteReleaseOption: editInviteReleaseOption,
      inviteReleaseDate: editInviteReleaseOption === 'scheduled' ? editInviteReleaseDate.toISOString() : undefined,
      invitesSent: editInviteReleaseOption === 'now' ? true : event.invitesSent,
    });

    // If releasing now, send notifications
    if (editInviteReleaseOption === 'now' && !event.invitesSent) {
      const dateStr = format(eventDate, 'EEE, MMM d');
      invitedPlayers.forEach((player) => {
        const notification: AppNotification = {
          id: `event-invite-${event.id}-${player.id}-${Date.now()}`,
          type: 'game_invite',
          title: event.type === 'practice' ? 'Practice Scheduled!' : 'Event Invite!',
          message: event.type === 'practice'
            ? `Practice on ${dateStr} at ${event.time}`
            : `You're invited to "${event.title}" on ${dateStr} at ${event.time}`,
          eventId: event.id,
          toPlayerId: player.id,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
        if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsReleaseInvitesModalVisible(false);
  };

  const deleteEvent = () => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            removeEvent(event.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  };

  const handleInvitePlayer = (playerId: string) => {
    const currentInvited = event.invitedPlayers ?? [];
    if (currentInvited.includes(playerId)) return;

    updateEventAndSync(event.id, {
      invitedPlayers: [...currentInvited, playerId],
    });

    // Record the invite in event_responses so realtime sync triggers for all clients
    if (activeTeamId) {
      pushEventResponseToSupabase(event.id, playerId, 'invited').catch(console.error);
    }

    // Create in-app notification
    const formattedDateShort = format(eventDate, 'EEE, MMM d');
    const notification: AppNotification = {
      id: `event-invite-${event.id}-${playerId}-${Date.now()}`,
      type: 'game_invite',
      title: 'Event Invite',
      message: `You're invited to "${event.title}" on ${formattedDateShort} at ${event.time}`,
      eventId: event.id,
      fromPlayerId: currentPlayerId ?? undefined,
      toPlayerId: playerId,
      read: false,
      createdAt: new Date().toISOString(),
    };
    addNotification(notification);
    if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);

    // Send real push notification to the invited player's device
    sendPushToPlayers(
      [playerId],
      'Event Invite',
      `You're invited to "${event.title}" on ${formattedDateShort} at ${event.time}`,
      { eventId: event.id, type: 'event_invite' }
    ).catch(console.error);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleInviteMultiplePlayers = (playerIds: string[]) => {
    const currentInvited = event.invitedPlayers ?? [];
    const newInvites = playerIds.filter((id) => !currentInvited.includes(id));
    if (newInvites.length === 0) return;

    updateEventAndSync(event.id, {
      invitedPlayers: [...currentInvited, ...newInvites],
    });

    const formattedDateShort = format(eventDate, 'EEE, MMM d');

    // Create in-app notifications for each player and record event_responses
    newInvites.forEach((playerId) => {
      // Record invite in event_responses so realtime sync triggers
      if (activeTeamId) {
        pushEventResponseToSupabase(event.id, playerId, 'invited').catch(console.error);
      }

      const notification: AppNotification = {
        id: `event-invite-${event.id}-${playerId}-${Date.now()}`,
        type: 'game_invite',
        title: 'Event Invite',
        message: `You're invited to "${event.title}" on ${formattedDateShort} at ${event.time}`,
        eventId: event.id,
        fromPlayerId: currentPlayerId ?? undefined,
        toPlayerId: playerId,
        read: false,
        createdAt: new Date().toISOString(),
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);

      // Collect player IDs for batch push notification (token fetched fresh in sendPushToPlayers)
    });

    // Send real push notifications to all invited players at once using fresh tokens
    sendPushToPlayers(
      newInvites,
      'Event Invite',
      `You're invited to "${event.title}" on ${formattedDateShort} at ${event.time}`,
      { eventId: event.id, type: 'event_invite' }
    ).catch(console.error);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Invites Sent', `${newInvites.length} player${newInvites.length !== 1 ? 's' : ''} invited!`);
    setIsInviteModalVisible(false);
  };

  const sendInviteReminder = () => {
    const formattedDateShort = format(eventDate, 'EEE, MMM d');

    // Create in-app notifications for players who haven't responded
    const pendingPlayers = invitedPlayers.filter(
      (p) => !confirmedPlayers.includes(p.id) && !declinedPlayers.includes(p.id)
    );

    pendingPlayers.forEach((player) => {
      const notification: AppNotification = {
        id: `event-reminder-${event.id}-${player.id}-${Date.now()}`,
        type: 'game_invite',
        title: 'Event Reminder',
        message: `Please RSVP for "${event.title}" on ${formattedDateShort} at ${event.time}`,
        eventId: event.id,
        toPlayerId: player.id,
        read: false,
        createdAt: new Date().toISOString(),
      };
      addNotification(notification);
      if (activeTeamId) pushNotificationToSupabase(notification, activeTeamId).catch(console.error);
    });

    // Push to all pending players' devices
    if (pendingPlayers.length > 0) {
      sendPushToPlayers(
        pendingPlayers.map((p) => p.id),
        'Event Reminder',
        `Please RSVP for "${event.title}" on ${formattedDateShort} at ${event.time}`,
        { eventId: event.id, type: 'event_reminder' }
      ).catch(console.error);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Reminder Sent', `Reminder sent to ${pendingPlayers.length} player(s) who haven't responded.`);
  };

  const confirmedCount = confirmedPlayers.length;
  const declinedCount = declinedPlayers.length;
  const pendingCount = invitedPlayers.length - confirmedCount - declinedCount;

  return (
    <View className="flex-1 bg-slate-900">
      <SafeAreaView className="flex-1">
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-2 pb-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => router.back()}
              className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
            >
              <ChevronLeft size={24} color="white" />
            </Pressable>

            {canManageTeam() && (
              <Pressable
                onPress={deleteEvent}
                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center"
              >
                <Trash2 size={20} color="#ef4444" />
              </Pressable>
            )}
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Event Info */}
          <View className="px-5">
            <Animated.View entering={FadeInDown.delay(100).springify()}>
              <Pressable
                onPress={canManageTeam() ? openEditTitleModal : undefined}
                disabled={!canManageTeam()}
                className="active:opacity-70"
              >
                <View className="flex-row items-center mb-2">
                  <View className={`px-3 py-1 rounded-full ${event.type === 'practice' ? 'bg-orange-500/30' : 'bg-blue-500/30'}`}>
                    <Text className={`text-xs font-semibold ${event.type === 'practice' ? 'text-orange-300' : 'text-blue-300'}`}>
                      {event.type === 'practice' ? 'PRACTICE' : 'EVENT'}
                    </Text>
                  </View>
                </View>
                <Text className="text-white text-3xl font-bold mb-2">{event.title}</Text>
                <Text className="text-slate-400 text-base">{teamName}</Text>
              </Pressable>
            </Animated.View>

            {/* Quick Stats */}
            <Animated.View entering={FadeInDown.delay(200).springify()} className="mt-4">
              <View className="flex-row">
                <Pressable
                  onPress={canManageTeam() ? openEditDateModal : undefined}
                  disabled={!canManageTeam()}
                  className="flex-[2] bg-slate-800/80 rounded-2xl p-4 mr-2 active:bg-slate-700/80"
                >
                  <View className="flex-row items-center mb-1">
                    <Text className="text-slate-400 text-xs">Date</Text>
                  </View>
                  <Text className="text-white font-semibold">{formattedDate}</Text>
                </Pressable>
                <Pressable
                  onPress={canManageTeam() ? openEditTimeModal : undefined}
                  disabled={!canManageTeam()}
                  className="bg-slate-800/80 rounded-2xl p-4 active:bg-slate-700/80"
                >
                  <View className="flex-row items-center mb-1">
                    <Text className="text-slate-400 text-xs">Time</Text>
                  </View>
                  <Text className="text-white font-semibold">{event.time}</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Location */}
            <Animated.View entering={FadeInDown.delay(300).springify()} className="mt-3">
              <Pressable
                onPress={canManageTeam() ? openEditLocationModal : openInMaps}
                className="bg-slate-800/80 rounded-2xl p-4 flex-row items-center justify-between active:bg-slate-700/80"
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center">
                    <MapPin size={20} color="#60a5fa" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-slate-400 text-xs">Location</Text>
                    <Text className="text-white font-semibold">{event.location}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={openInMaps}
                  className="bg-blue-500/20 rounded-full p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Navigation size={18} color="#60a5fa" />
                </Pressable>
              </Pressable>
            </Animated.View>

            {/* Notes */}
            <Animated.View entering={FadeInDown.delay(350).springify()} className="mt-3">
              <Pressable
                onPress={canManageTeam() ? openEditNotesModal : undefined}
                disabled={!canManageTeam()}
                className="bg-slate-800/80 rounded-xl py-2.5 px-3 active:bg-slate-700/80"
              >
                <View className="flex-row items-center">
                  <FileText size={18} color="#ffffff" />
                  <View className="flex-1 ml-2.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white font-medium text-sm">Notes</Text>
                      <Text className="text-slate-500 text-[10px]">{(event.notes || '').length}/30</Text>
                    </View>
                    <Text className="text-slate-400 text-xs">
                      {event.notes || (canManageTeam() ? 'Tap to add notes' : 'No notes')}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* Divider */}
            <View className="mt-4 mb-4">
              <View className="h-px bg-slate-700/50" />
            </View>

            {/* Release Invites Status - Visible to admins/captains */}
            {canManageTeam() && (() => {
              // Check if invites are considered sent (either explicitly or scheduled time passed)
              const scheduledTimePassed = event.inviteReleaseOption === 'scheduled' &&
                event.inviteReleaseDate &&
                new Date() >= parseISO(event.inviteReleaseDate);
              const invitesAreSent = Boolean(event.invitesSent || scheduledTimePassed);

              return (
                <Animated.View entering={FadeInDown.delay(350).springify()} className="mb-1">
                  <Pressable
                    onPress={() => {
                      if (!invitesAreSent) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Initialize edit state with current values
                        setEditInviteReleaseOption(event.inviteReleaseOption || 'now');
                        setEditInviteReleaseDate(event.inviteReleaseDate ? parseISO(event.inviteReleaseDate) : new Date());
                        setShowEditInviteReleaseDatePicker(false);
                        setIsReleaseInvitesModalVisible(true);
                      }
                    }}
                    disabled={invitesAreSent}
                    className="flex-row items-center justify-center py-2.5 px-3 bg-slate-800/40 rounded-xl active:bg-slate-700/40"
                  >
                    <Calendar size={14} color="#67e8f9" />
                    <Text className="text-cyan-400 text-sm ml-1.5">Release Invites:</Text>
                    {invitesAreSent ? (
                      <View className="flex-row items-center ml-1.5">
                        <Check size={14} color="#22c55e" />
                        <Text className="text-green-400 text-sm ml-1">Invites sent</Text>
                      </View>
                    ) : event.inviteReleaseOption === 'scheduled' && event.inviteReleaseDate ? (
                      <Text className="text-amber-400 text-sm ml-1.5">
                        Scheduled {format(parseISO(event.inviteReleaseDate), 'MMM d, h:mm a')}
                      </Text>
                    ) : event.inviteReleaseOption === 'none' ? (
                      <Text className="text-slate-400 text-sm ml-1.5">Not scheduled</Text>
                    ) : (
                      <Text className="text-green-400 text-sm ml-1.5">Ready to send</Text>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })()}

            {/* RSVP / Check In Summary */}
            <Animated.View entering={FadeInDown.delay(400).springify()} className="mt-4">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center">
                  {event.type === 'practice' && (
                    <CheckCircle2 size={18} color="#22c55e" />
                  )}
                  <Text className={`text-lg font-semibold ${event.type === 'practice' ? 'text-green-400 ml-2' : 'text-white'}`}>
                    {event.type === 'practice' ? 'Check In' : 'RSVPs'}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  {canManageTeam() && (
                    <Pressable
                      onPress={() => setIsInviteModalVisible(true)}
                      className="flex-row items-center bg-cyan-500/20 rounded-full px-3 py-1.5 mr-2"
                    >
                      <UserPlus size={14} color="#67e8f9" />
                      <Text className="text-cyan-400 text-sm font-medium ml-1.5">Invite More</Text>
                    </Pressable>
                  )}
                  {canManageTeam() && (
                    <Pressable
                      onPress={sendInviteReminder}
                      className="flex-row items-center bg-green-500/20 rounded-full px-3 py-1.5"
                    >
                      <Send size={14} color="#22c55e" />
                      <Text className="text-green-400 text-sm font-medium ml-1.5">Send Reminder</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* RSVP Stats */}
              <View className="flex-row mb-3">
                <View className="flex-1 bg-green-500/20 rounded-xl p-3 mr-2 items-center">
                  <Text className="text-green-400 text-2xl font-bold">{confirmedCount}</Text>
                  <Text className="text-green-400/70 text-xs">Confirmed</Text>
                </View>
                <View className="flex-1 bg-slate-700/50 rounded-xl p-3 mx-1 items-center">
                  <Text className="text-slate-300 text-2xl font-bold">{pendingCount}</Text>
                  <Text className="text-slate-400 text-xs">Pending</Text>
                </View>
                <View className="flex-1 bg-red-500/20 rounded-xl p-3 ml-2 items-center">
                  <Text className="text-red-400 text-2xl font-bold">{declinedCount}</Text>
                  <Text className="text-red-400/70 text-xs">Declined</Text>
                </View>
              </View>

              {/* Instruction note */}
              <View className="bg-slate-700/30 rounded-xl px-3 py-2.5 mb-3 border border-slate-600/30">
                <Text className="text-slate-400 text-xs text-center">
                  Tap to cycle: <Text className="text-green-400 font-medium">IN</Text> → <Text className="text-red-400 font-medium">OUT</Text> → <Text className="text-slate-500 font-medium">No Response</Text>
                </Text>
              </View>

              {/* Player List */}
              <View className="bg-slate-800/50 rounded-2xl p-4">
                {playersToDisplay.length === 0 ? (
                  <Text className="text-slate-400 text-center py-4">No players invited</Text>
                ) : (
                  playersToDisplay.map((player, index) => {
                    const status = getPlayerStatus(player.id);
                    const isSelf = player.id === currentPlayerId;
                    // Players can toggle their own status, admins can toggle anyone
                    const canToggle = isSelf || isAdmin();
                    const hasViewed = (event.viewedBy || []).includes(player.id);

                    return (
                      <PlayerRow
                        key={player.id}
                        player={player}
                        status={status}
                        onToggle={() => togglePlayerStatus(player.id)}
                        index={index}
                        canToggle={canToggle}
                        isSelf={isSelf}
                        hasViewed={hasViewed}
                        showViewedBadge={canManageTeam()}
                      />
                    );
                  })
                )}
              </View>
            </Animated.View>

            <View className="h-8" />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Inline Edit Title Modal */}
      <Modal
        visible={isEditTitleModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditTitleModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditTitleModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Title</Text>
              <Pressable onPress={handleSaveTitle}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6">
              <Text className="text-slate-400 text-sm mb-2">Event Name</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Event name"
                placeholderTextColor="#64748b"
                autoCapitalize="words"
                autoFocus
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Date Modal */}
      <Modal
        visible={isEditDateModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditDateModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditDateModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Date</Text>
              <Pressable onPress={handleSaveDate}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6 items-center">
              <DateTimePicker
                value={editDate}
                mode="date"
                display="inline"
                onChange={(event, date) => {
                  if (date) setEditDate(date);
                }}
                themeVariant="dark"
                accentColor="#67e8f9"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Time Modal */}
      <Modal
        visible={isEditTimeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditTimeModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditTimeModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Time</Text>
              <Pressable onPress={handleSaveTime}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6 items-center">
              <DateTimePicker
                value={editTime}
                mode="time"
                display="spinner"
                onChange={(event, time) => {
                  if (time) setEditTime(time);
                }}
                themeVariant="dark"
                accentColor="#67e8f9"
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Location Modal */}
      <Modal
        visible={isEditLocationModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditLocationModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditLocationModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Location</Text>
              <Pressable onPress={handleSaveLocation}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6" style={{ zIndex: 50 }}>
              <Text className="text-slate-400 text-sm mb-2">Venue or Address</Text>
              <AddressSearch
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Search for a venue or address..."
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Inline Edit Notes Modal */}
      <Modal
        visible={isEditNotesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsEditNotesModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsEditNotesModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Edit Notes</Text>
              <Pressable onPress={handleSaveNotes}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>
            <View className="flex-1 px-5 pt-6">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-slate-400 text-sm">Notes</Text>
                <Text className={cn(
                  "text-sm",
                  editNotes.length > 30 ? "text-red-500" : "text-slate-500"
                )}>{editNotes.length}/30</Text>
              </View>
              <TextInput
                value={editNotes}
                onChangeText={(text) => {
                  if (text.length <= 30) {
                    setEditNotes(text);
                  }
                }}
                placeholder="Add a short note..."
                placeholderTextColor="#64748b"
                maxLength={30}
                className="bg-slate-800 rounded-xl p-4 text-white text-base"
                autoFocus
              />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Release Invites Modal */}
      <Modal
        visible={isReleaseInvitesModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsReleaseInvitesModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsReleaseInvitesModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Release Invites</Text>
              <Pressable onPress={handleSaveReleaseInvites}>
                <Check size={24} color="#22c55e" />
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              <View className="bg-slate-800/50 rounded-xl p-3">
                {/* Release Now Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditInviteReleaseOption('now');
                    setShowEditInviteReleaseDatePicker(false);
                  }}
                  className={cn(
                    'flex-row items-center p-3 rounded-xl mb-2 border',
                    editInviteReleaseOption === 'now'
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'bg-slate-700/50 border-slate-600'
                  )}
                >
                  <Send size={18} color={editInviteReleaseOption === 'now' ? '#22c55e' : '#64748b'} />
                  <View className="ml-3 flex-1">
                    <Text className={cn(
                      'font-medium',
                      editInviteReleaseOption === 'now' ? 'text-green-400' : 'text-slate-400'
                    )}>
                      Release invites now
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Players will be notified immediately
                    </Text>
                  </View>
                  {editInviteReleaseOption === 'now' && <Check size={18} color="#22c55e" />}
                </Pressable>

                {/* Schedule Release Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditInviteReleaseOption('scheduled');
                    setShowEditInviteReleaseDatePicker(true);
                  }}
                  className={cn(
                    'flex-row items-center p-3 rounded-xl mb-2 border',
                    editInviteReleaseOption === 'scheduled'
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-slate-700/50 border-slate-600'
                  )}
                >
                  <Bell size={18} color={editInviteReleaseOption === 'scheduled' ? '#22d3ee' : '#64748b'} />
                  <View className="ml-3 flex-1">
                    <Text className={cn(
                      'font-medium',
                      editInviteReleaseOption === 'scheduled' ? 'text-cyan-400' : 'text-slate-400'
                    )}>
                      Schedule release
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Choose when to notify players
                    </Text>
                  </View>
                  {editInviteReleaseOption === 'scheduled' && <Check size={18} color="#22d3ee" />}
                </Pressable>

                {/* Schedule Date/Time Picker */}
                {editInviteReleaseOption === 'scheduled' && (
                  <View className="mt-2 mb-2">
                    <Pressable
                      onPress={() => setShowEditInviteReleaseDatePicker(!showEditInviteReleaseDatePicker)}
                      className="bg-slate-700/80 rounded-xl px-4 py-3"
                    >
                      <Text className="text-cyan-400 text-base">
                        {format(editInviteReleaseDate, 'EEE, MMM d, yyyy h:mm a')}
                      </Text>
                    </Pressable>
                    {showEditInviteReleaseDatePicker && (
                      <View className="bg-slate-700/80 rounded-xl mt-2 overflow-hidden items-center">
                        <DateTimePicker
                          value={editInviteReleaseDate}
                          mode="datetime"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={(evt, date) => {
                            if (date) setEditInviteReleaseDate(date);
                            if (Platform.OS === 'android') setShowEditInviteReleaseDatePicker(false);
                          }}
                          minimumDate={new Date()}
                          themeVariant="dark"
                          accentColor="#22d3ee"
                        />
                      </View>
                    )}
                  </View>
                )}

                {/* Don't Send Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setEditInviteReleaseOption('none');
                    setShowEditInviteReleaseDatePicker(false);
                  }}
                  className={cn(
                    'flex-row items-center p-3 rounded-xl border',
                    editInviteReleaseOption === 'none'
                      ? 'bg-slate-600/50 border-slate-500'
                      : 'bg-slate-700/50 border-slate-600'
                  )}
                >
                  <BellOff size={18} color={editInviteReleaseOption === 'none' ? '#94a3b8' : '#64748b'} />
                  <View className="ml-3 flex-1">
                    <Text className={cn(
                      'font-medium',
                      editInviteReleaseOption === 'none' ? 'text-slate-300' : 'text-slate-400'
                    )}>
                      Don't send invites
                    </Text>
                    <Text className="text-slate-500 text-xs mt-0.5">
                      Send manually later
                    </Text>
                  </View>
                  {editInviteReleaseOption === 'none' && <Check size={18} color="#94a3b8" />}
                </Pressable>
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Invite More Players Modal */}
      <Modal
        visible={isInviteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsInviteModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setIsInviteModalVisible(false)}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Invite Players</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView className="flex-1 px-5 pt-6">
              {uninvitedPlayers.length === 0 ? (
                <View className="items-center py-8">
                  <Users size={48} color="#64748b" />
                  <Text className="text-slate-400 text-center mt-4">
                    All players have been invited
                  </Text>
                </View>
              ) : (
                <>
                  {/* Quick Actions */}
                  <View className="flex-row mb-4">
                    {uninvitedActive.length > 0 && (
                      <Pressable
                        onPress={() => handleInviteMultiplePlayers(uninvitedActive.map((p) => p.id))}
                        className="flex-1 py-3 rounded-xl mr-2 bg-green-500/20 border border-green-500/50 items-center"
                      >
                        <Text className="text-green-400 font-medium">
                          Invite All Active ({uninvitedActive.length})
                        </Text>
                      </Pressable>
                    )}
                    {uninvitedReserve.length > 0 && (
                      <Pressable
                        onPress={() => handleInviteMultiplePlayers(uninvitedReserve.map((p) => p.id))}
                        className="flex-1 py-3 rounded-xl bg-amber-500/20 border border-amber-500/50 items-center"
                      >
                        <Text className="text-amber-400 font-medium">
                          Invite All Reserve ({uninvitedReserve.length})
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Uninvited Active Players */}
                  {uninvitedActive.length > 0 && (
                    <>
                      <Text className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">
                        Active Players
                      </Text>
                      {uninvitedActive.map((player) => (
                        <Pressable
                          key={player.id}
                          onPress={() => handleInvitePlayer(player.id)}
                          className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
                        >
                          <PlayerAvatar player={player} size={44} />
                          <View className="flex-1 ml-3">
                            <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                            <Text className="text-slate-400 text-sm">#{player.number}</Text>
                          </View>
                          <View className="bg-cyan-500 rounded-lg px-3 py-1.5">
                            <Text className="text-white font-medium text-sm">Invite</Text>
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}

                  {/* Uninvited Reserve Players */}
                  {uninvitedReserve.length > 0 && (
                    <>
                      <Text className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-4">
                        Reserve Players
                      </Text>
                      {uninvitedReserve.map((player) => (
                        <Pressable
                          key={player.id}
                          onPress={() => handleInvitePlayer(player.id)}
                          className="flex-row items-center bg-slate-800/60 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
                        >
                          <PlayerAvatar player={player} size={44} />
                          <View className="flex-1 ml-3">
                            <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                            <Text className="text-slate-400 text-sm">#{player.number}</Text>
                          </View>
                          <View className="bg-cyan-500 rounded-lg px-3 py-1.5">
                            <Text className="text-white font-medium text-sm">Invite</Text>
                          </View>
                        </Pressable>
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
