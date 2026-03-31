import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform, Switch, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Check,
  Beer,
  ChevronDown,
  Bell,
  BellOff,
  Send,
  Users,
  Plus,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  useTeamStore,
  Game,
  Event,
  AppNotification,
  InviteReleaseOption,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { AddressSearch } from '@/components/AddressSearch';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  sendGameInviteNotification,
  scheduleGameInviteNotification,
  sendEventInviteNotification,
  scheduleEventReminderDayBefore,
  scheduleEventReminderHourBefore,
  scheduleGameReminderDayBefore,
  scheduleGameReminderHoursBefore,
  sendPushToPlayers,
  sendRefreshmentDutyAssignedPush,
  scheduleRefreshmentDutyReminders,
} from '@/lib/notifications';
import { pushGameToSupabase, pushEventToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

// Combine a date with a time string (e.g., "7:00 PM") into a single Date object
const combineDateAndTime = (date: Date, timeString: string): Date => {
  const result = new Date(date);

  // Parse time string like "7:00 PM" or "10:30 AM"
  const timeMatch = timeString.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    result.setHours(hours, minutes, 0, 0);
  }

  return result;
};

interface CreateGameEventModalProps {
  visible: boolean;
  onClose: () => void;
  initialDate?: Date;
}

export function CreateGameEventModal({ visible, onClose, initialDate }: CreateGameEventModalProps) {
  const addGame = useTeamStore((s) => s.addGame);
  const addEvent = useTeamStore((s) => s.addEvent);
  const addNotification = useTeamStore((s) => s.addNotification);
  const players = useTeamStore((s) => s.players);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  // Get current player's notification preferences
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const notificationPrefs = currentPlayer?.notificationPreferences;

  const activePlayers = players.filter((p) => p.status === 'active');
  const reservePlayers = players.filter((p) => p.status === 'reserve');

  // Toggle between Game, Practice, and Event creation
  const [recordType, setRecordType] = useState<'game' | 'practice' | 'event'>('game');
  const [eventName, setEventName] = useState('');

  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [gameDate, setGameDate] = useState(initialDate ?? new Date());
  const [gameTimeValue, setGameTimeValue] = useState('7:00');
  const [gameTimePeriod, setGameTimePeriod] = useState<'AM' | 'PM'>('PM');
  const [selectedJersey, setSelectedJersey] = useState(teamSettings?.jerseyColors?.[0]?.name || '');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBeerDuty, setShowBeerDuty] = useState(teamSettings?.showRefreshmentDuty !== false);
  const [selectedBeerDutyPlayer, setSelectedBeerDutyPlayer] = useState<string | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [showPlayerSelection, setShowPlayerSelection] = useState(true);

  // Invite release options
  const [inviteReleaseOption, setInviteReleaseOption] = useState<InviteReleaseOption>('now');
  const [inviteReleaseDate, setInviteReleaseDate] = useState(new Date());
  const [showInviteReleaseDatePicker, setShowInviteReleaseDatePicker] = useState(false);
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time'>('date');

  // Sync initialDate into gameDate when it changes (e.g., tapping an empty calendar date)
  useEffect(() => {
    if (initialDate) {
      setGameDate(initialDate);
    }
  }, [initialDate]);

  const resetForm = () => {
    setRecordType('game');
    setEventName('');
    setOpponent('');
    setLocation('');
    setGameDate(new Date());
    setGameTimeValue('7:00');
    setGameTimePeriod('PM');
    setSelectedJersey(teamSettings.jerseyColors?.[0]?.name || '');
    setNotes('');
    setShowBeerDuty(false);
    setSelectedBeerDutyPlayer(null);
    setSelectedPlayerIds([]);
    setShowPlayerSelection(true);
    setInviteReleaseOption('now');
    setInviteReleaseDate(new Date());
    setShowInviteReleaseDatePicker(false);
  };

  // Player selection helpers
  const togglePlayer = (playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const selectAllActive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const activeIds = activePlayers.map((p) => p.id);
    setSelectedPlayerIds((prev) => {
      const nonActiveSelected = prev.filter((id) => !activePlayers.find((p) => p.id === id));
      return [...nonActiveSelected, ...activeIds];
    });
  };

  const selectAllReserve = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const reserveIds = reservePlayers.map((p) => p.id);
    setSelectedPlayerIds((prev) => {
      const nonReserveSelected = prev.filter((id) => !reservePlayers.find((p) => p.id === id));
      return [...nonReserveSelected, ...reserveIds];
    });
  };

  const deselectAllActive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds((prev) => prev.filter((id) => !activePlayers.find((p) => p.id === id)));
  };

  const deselectAllReserve = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds((prev) => prev.filter((id) => !reservePlayers.find((p) => p.id === id)));
  };

  const selectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPlayerIds(players.map((p) => p.id));
  };

  const deselectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPlayerIds([]);
  };

  const isAllActiveSelected = activePlayers.every((p) => selectedPlayerIds.includes(p.id));
  const isAllReserveSelected = reservePlayers.length > 0 && reservePlayers.every((p) => selectedPlayerIds.includes(p.id));

  const handleCreateGame = () => {
    if (!opponent.trim() || !location.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Use selected players or default to active players if none selected
    const invitedPlayerIds = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : activePlayers.map((p) => p.id);

    // Combine time value and period
    const fullGameTime = `${gameTimeValue.trim() || '7:00'} ${gameTimePeriod}`;

    const newGame: Game = {
      id: Date.now().toString(),
      opponent: opponent.trim(),
      date: gameDate.toISOString(),
      time: fullGameTime,
      location: location.trim(),
      address: '', // Address is now part of location field
      jerseyColor: selectedJersey,
      notes: notes.trim() || undefined,
      checkedInPlayers: [],
      checkedOutPlayers: [],
      invitedPlayers: invitedPlayerIds,
      photos: [],
      showBeerDuty: showBeerDuty,
      beerDutyPlayerId: selectedBeerDutyPlayer || undefined,
      // Invite release settings
      inviteReleaseOption: inviteReleaseOption,
      inviteReleaseDate: inviteReleaseOption === 'scheduled' ? inviteReleaseDate.toISOString() : undefined,
      invitesSent: inviteReleaseOption === 'now', // Only mark as sent if sending now
    };

    addGame(newGame);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushGameToSupabase(newGame, activeTeamId).catch(syncError('sync'));
    }

    // Handle notifications based on invite release option
    const formattedDate = format(gameDate, 'EEE, MMM d');

    if (inviteReleaseOption === 'now') {
      // Send local notification to the admin (current user)
      sendGameInviteNotification(newGame.id, opponent.trim(), formattedDate, fullGameTime);
      // Send push notifications to all OTHER invited players via backend
      const otherPlayerIds = invitedPlayerIds.filter((id) => id !== currentPlayerId);
      if (otherPlayerIds.length > 0) {
        sendPushToPlayers(
          otherPlayerIds,
          'New Game Added!',
          `You've been invited to play vs ${opponent.trim()} on ${formattedDate} at ${fullGameTime}. Make sure to check in or out in the app.`,
          { gameId: newGame.id, type: 'game_invite' }
        ).catch(syncError('sync'));
      }
    } else if (inviteReleaseOption === 'scheduled') {
      // Schedule notifications for later
      scheduleGameInviteNotification(newGame.id, opponent.trim(), formattedDate, fullGameTime, inviteReleaseDate);
    }
    // If 'none', no notifications are sent - user can send manually from game details

    // Schedule game reminders based on user notification preferences
    const gameDateTime = combineDateAndTime(gameDate, fullGameTime);
    if (notificationPrefs?.gameReminderDayBefore !== false) {
      scheduleGameReminderDayBefore(newGame.id, opponent.trim(), gameDateTime, fullGameTime);
    }
    if (notificationPrefs?.gameReminderHoursBefore !== false) {
      scheduleGameReminderHoursBefore(newGame.id, opponent.trim(), gameDateTime, fullGameTime);
    }

    // Beer/refreshment duty notifications
    if (showBeerDuty && selectedBeerDutyPlayer && notificationPrefs?.refreshmentDutyReminders !== false) {
      const is21Plus = teamSettings.refreshmentDutyIs21Plus !== false;
      // Immediate assignment push (goes to the assigned player regardless of who they are)
      sendRefreshmentDutyAssignedPush(
        selectedBeerDutyPlayer,
        opponent.trim(),
        formattedDate,
        fullGameTime,
        is21Plus
      ).catch(syncError('sync'));
      // Schedule 24hr + 2hr reminders via backend
      scheduleRefreshmentDutyReminders(
        selectedBeerDutyPlayer,
        newGame.id,
        opponent.trim(),
        gameDateTime,
        is21Plus
      ).catch(syncError('sync'));
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    resetForm();
  };

  const handleCreateEvent = () => {
    if (!eventName.trim() || !location.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Combine time value and period
    const fullEventTime = `${gameTimeValue.trim() || '7:00'} ${gameTimePeriod}`;

    // Use selected players or default to active players if none selected
    const invitedPlayerIds = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : activePlayers.map((p) => p.id);

    const newEvent: Event = {
      id: Date.now().toString(),
      title: eventName.trim(),
      type: 'other',
      date: gameDate.toISOString(),
      time: fullEventTime,
      location: location.trim(),
      address: '',
      notes: notes.trim() || undefined,
      invitedPlayers: invitedPlayerIds,
      confirmedPlayers: [],
      inviteReleaseOption: inviteReleaseOption,
      inviteReleaseDate: inviteReleaseOption === 'scheduled' ? inviteReleaseDate.toISOString() : undefined,
      invitesSent: inviteReleaseOption === 'now',
    };

    addEvent(newEvent);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushEventToSupabase(newEvent, activeTeamId).catch(syncError('sync'));
    }

    // Send notifications to invited players
    const formattedDate = format(gameDate, 'EEE, MMM d');

    // Only send immediate notification if inviteReleaseOption is 'now'
    if (inviteReleaseOption === 'now') {
      // Send local notification to the admin (current user)
      sendEventInviteNotification(newEvent.id, eventName.trim(), formattedDate, fullEventTime);
      // Send push notifications to all OTHER invited players via backend
      const otherPlayerIds = invitedPlayerIds.filter((id) => id !== currentPlayerId);
      if (otherPlayerIds.length > 0) {
        sendPushToPlayers(
          otherPlayerIds,
          'New Event Added!',
          `You've been invited to "${eventName.trim()}" on ${formattedDate} at ${fullEventTime}. Tap to RSVP.`,
          { eventId: newEvent.id, type: 'event_invite' }
        ).catch(syncError('sync'));
      }

      // Create in-app notifications for each invited player
      invitedPlayerIds.forEach((playerId) => {
        const notification: AppNotification = {
          id: `event-invite-${newEvent.id}-${playerId}-${Date.now()}`,
          type: 'event_invite',
          title: 'New Event Added!',
          message: `You've been invited to "${eventName.trim()}" on ${formattedDate} at ${fullEventTime}`,
          eventId: newEvent.id,
          toPlayerId: playerId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
      });

      // Schedule reminders based on user notification preferences
      const eventDateTime = combineDateAndTime(gameDate, fullEventTime);
      if (notificationPrefs?.gameReminderDayBefore !== false) {
        scheduleEventReminderDayBefore(newEvent.id, eventName.trim(), eventDateTime, fullEventTime);
      }
      if (notificationPrefs?.gameReminderHoursBefore !== false) {
        scheduleEventReminderHourBefore(newEvent.id, eventName.trim(), eventDateTime, fullEventTime);
      }
    } else if (inviteReleaseOption === 'scheduled') {
      console.log('Event invites scheduled for:', inviteReleaseDate.toISOString());
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    resetForm();
  };

  const handleCreatePractice = () => {
    if (!location.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Combine time value and period
    const fullPracticeTime = `${gameTimeValue.trim() || '7:00'} ${gameTimePeriod}`;

    // Use selected players or default to active players if none selected
    const invitedPlayerIds = selectedPlayerIds.length > 0
      ? selectedPlayerIds
      : activePlayers.map((p) => p.id);

    const newPractice: Event = {
      id: Date.now().toString(),
      title: 'Practice',
      type: 'practice',
      date: gameDate.toISOString(),
      time: fullPracticeTime,
      location: location.trim(),
      address: '',
      notes: notes.trim() || undefined,
      invitedPlayers: invitedPlayerIds,
      confirmedPlayers: [],
      inviteReleaseOption: inviteReleaseOption,
      inviteReleaseDate: inviteReleaseOption === 'scheduled' ? inviteReleaseDate.toISOString() : undefined,
      invitesSent: inviteReleaseOption === 'now',
    };

    addEvent(newPractice);

    // Sync to Supabase for other team members
    if (activeTeamId) {
      pushEventToSupabase(newPractice, activeTeamId).catch(syncError('sync'));
    }

    // Send notifications to invited players
    const formattedDate = format(gameDate, 'EEE, MMM d');

    // Only send immediate notification if inviteReleaseOption is 'now'
    if (inviteReleaseOption === 'now') {
      // Send local notification to the admin (current user)
      sendEventInviteNotification(newPractice.id, 'Practice', formattedDate, fullPracticeTime);
      // Send push notifications to all OTHER invited players via backend
      const otherPracticePlayerIds = invitedPlayerIds.filter((id) => id !== currentPlayerId);
      if (otherPracticePlayerIds.length > 0) {
        sendPushToPlayers(
          otherPracticePlayerIds,
          'Practice Scheduled!',
          `Practice on ${formattedDate} at ${fullPracticeTime}. Make sure to check in or out in the app.`,
          { eventId: newPractice.id, type: 'practice_invite' }
        ).catch(syncError('sync'));
      }

      // Create in-app notifications for each invited player
      invitedPlayerIds.forEach((playerId) => {
        const notification: AppNotification = {
          id: `practice-invite-${newPractice.id}-${playerId}-${Date.now()}`,
          type: 'practice_invite',
          title: 'Practice Scheduled!',
          message: `Practice on ${formattedDate} at ${fullPracticeTime}`,
          eventId: newPractice.id,
          toPlayerId: playerId,
          read: false,
          createdAt: new Date().toISOString(),
        };
        addNotification(notification);
      });

      // Schedule reminders based on user notification preferences
      const practiceDateTime = combineDateAndTime(gameDate, fullPracticeTime);
      if (notificationPrefs?.gameReminderDayBefore !== false) {
        scheduleEventReminderDayBefore(newPractice.id, 'Practice', practiceDateTime, fullPracticeTime);
      }
      if (notificationPrefs?.gameReminderHoursBefore !== false) {
        scheduleEventReminderHourBefore(newPractice.id, 'Practice', practiceDateTime, fullPracticeTime);
      }
    } else if (inviteReleaseOption === 'scheduled') {
      console.log('Practice invites scheduled for:', inviteReleaseDate.toISOString());
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    resetForm();
  };

  const handleCreate = () => {
    if (recordType === 'game') {
      handleCreateGame();
    } else if (recordType === 'practice') {
      handleCreatePractice();
    } else {
      handleCreateEvent();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">
              {recordType === 'game' ? 'New Game' : recordType === 'practice' ? 'New Practice' : 'New Event'}
            </Text>
            <Pressable onPress={handleCreate}>
              <Text className="text-cyan-400 font-semibold">Create</Text>
            </Pressable>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
          <ScrollView className="flex-1 px-5 pt-4" keyboardShouldPersistTaps="handled">
            {/* Game/Practice/Event Toggle */}
            <View className="mb-2">
              <View className="flex-row bg-slate-800/80 rounded-xl p-1">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRecordType('game');
                  }}
                  className={cn(
                    'flex-1 h-10 rounded-lg items-center justify-center',
                    recordType === 'game' && 'bg-cyan-500'
                  )}
                >
                  <Text className={cn(
                    'text-sm',
                    recordType === 'game' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                  )}>
                    Game
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRecordType('practice');
                  }}
                  className={cn(
                    'flex-1 h-10 rounded-lg items-center justify-center',
                    recordType === 'practice' && 'bg-orange-500'
                  )}
                >
                  <Text className={cn(
                    'text-sm',
                    recordType === 'practice' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                  )}>
                    Practice
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRecordType('event');
                  }}
                  className={cn(
                    'flex-1 h-10 rounded-lg items-center justify-center',
                    recordType === 'event' && 'bg-blue-500'
                  )}
                >
                  <Text className={cn(
                    'text-sm',
                    recordType === 'event' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                  )}>
                    Event
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Opponent (Game only) */}
            {recordType === 'game' && (
              <View className="mb-2">
                <Text className="text-slate-400 text-sm mb-1">Opponent <Text className="text-red-400">*</Text></Text>
                <TextInput
                  value={opponent}
                  onChangeText={setOpponent}
                  placeholder="e.g., Ice Wolves"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base"
                />
              </View>
            )}

            {/* Event Name (Event only - not for Practice) */}
            {recordType === 'event' && (
              <View className="mb-2">
                <Text className="text-slate-400 text-sm mb-1">Event Name <Text className="text-red-400">*</Text></Text>
                <TextInput
                  value={eventName}
                  onChangeText={setEventName}
                  placeholder="e.g., Team Practice, Team Dinner"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base"
                />
              </View>
            )}

            {/* Date */}
            <View className="mb-2">
              <Text className="text-slate-400 text-sm mb-1">Date <Text className="text-red-400">*</Text></Text>
              <Pressable
                onPress={() => setShowDatePicker(!showDatePicker)}
                className="bg-slate-800 rounded-xl px-4 py-2.5 justify-center"
              >
                <Text className="text-white text-base">
                  {format(gameDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </Pressable>
              {showDatePicker && (
                <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                  <DateTimePicker
                    value={gameDate}
                    mode="date"
                    display="inline"
                    onChange={(event, date) => {
                      if (date) setGameDate(date);
                      if (Platform.OS === 'android') setShowDatePicker(false);
                    }}
                    minimumDate={new Date()}
                    themeVariant="dark"
                    accentColor="#67e8f9"
                  />
                </View>
              )}
            </View>

            {/* Time */}
            <View className="mb-2">
              <Text className="text-slate-400 text-sm mb-1">Time <Text className="text-red-400">*</Text></Text>
              <View className="flex-row items-center">
                <TextInput
                  value={gameTimeValue}
                  onChangeText={setGameTimeValue}
                  placeholder="7:00"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base flex-1"
                  keyboardType="numbers-and-punctuation"
                />
                <View className="flex-row ml-2">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGameTimePeriod('AM');
                    }}
                    className={cn(
                      'px-3 py-2.5 rounded-l-xl',
                      gameTimePeriod === 'AM'
                        ? 'bg-cyan-500'
                        : 'bg-slate-800 border border-slate-700'
                    )}
                  >
                    <Text className={cn(
                      'font-semibold',
                      gameTimePeriod === 'AM' ? 'text-white' : 'text-slate-500'
                    )}>
                      AM
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGameTimePeriod('PM');
                    }}
                    className={cn(
                      'px-3 py-2.5 rounded-r-xl',
                      gameTimePeriod === 'PM'
                        ? 'bg-cyan-500'
                        : 'bg-slate-800 border border-slate-700'
                    )}
                  >
                    <Text className={cn(
                      'font-semibold',
                      gameTimePeriod === 'PM' ? 'text-white' : 'text-slate-500'
                    )}>
                      PM
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Location */}
            <View className="mb-2" style={{ zIndex: 50 }}>
              <Text className="text-slate-400 text-sm mb-1">Location <Text className="text-red-400">*</Text></Text>
              <AddressSearch
                value={location}
                onChangeText={setLocation}
                placeholder="Search for a venue or address..."
              />
            </View>

            {/* Jersey Color (Game only) */}
            {recordType === 'game' && (
              <View className="mb-2">
                <Text className="text-slate-400 text-sm mb-1">Jersey Color</Text>
                <View className="flex-row bg-slate-800/80 rounded-xl p-1">
                  {(teamSettings.jerseyColors ?? []).map((color, index) => (
                    <Pressable
                      key={color.name}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedJersey(color.name);
                      }}
                      className={cn(
                        'flex-1 flex-row items-center justify-center py-2.5 rounded-lg',
                        selectedJersey === color.name
                          ? 'bg-slate-700'
                          : ''
                      )}
                    >
                      <View
                        className={cn(
                          "w-3.5 h-3.5 rounded-full mr-1.5",
                          selectedJersey === color.name ? "border-2 border-white" : "border border-white/30"
                        )}
                        style={{ backgroundColor: color.color }}
                      />
                      <Text
                        className={cn(
                          'text-sm',
                          selectedJersey === color.name ? 'text-white font-bold' : 'text-slate-500 font-medium'
                        )}
                      >
                        {color.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Player Invitations */}
            <View className="mb-2">
              <Text className="text-slate-400 text-sm mb-1">Invite Players</Text>
              <Pressable
                onPress={() => {
                  setShowPlayerSelection(!showPlayerSelection);
                }}
                className="flex-row items-center justify-between bg-slate-800/60 rounded-xl px-3 py-2.5"
              >
                <View className="flex-row items-center">
                  <Users size={16} color="#67e8f9" />
                  <View className="ml-2.5">
                    <Text className="text-white text-sm font-medium">Invite Players</Text>
                    <Text className="text-slate-400 text-xs">
                      {selectedPlayerIds.length === 0
                        ? 'No players selected'
                        : `${selectedPlayerIds.length} player${selectedPlayerIds.length !== 1 ? 's' : ''} selected`}
                    </Text>
                  </View>
                </View>
                <ChevronDown
                  size={16}
                  color="#64748b"
                  style={{ transform: [{ rotate: showPlayerSelection ? '180deg' : '0deg' }] }}
                />
              </Pressable>

              {showPlayerSelection && (
                <View className="mt-2 bg-slate-800/40 rounded-xl p-3">
                  {/* Group Selection Buttons */}
                  <View className="flex-row mb-3">
                    <Pressable
                      onPress={isAllActiveSelected ? deselectAllActive : selectAllActive}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg mr-2 border items-center',
                        isAllActiveSelected
                          ? 'bg-green-500/20 border-green-500/50'
                          : 'bg-slate-700/50 border-slate-600'
                      )}
                    >
                      <Text className={cn(
                        'font-medium text-xs',
                        isAllActiveSelected ? 'text-green-400' : 'text-slate-400'
                      )}>
                        {isAllActiveSelected ? '✓ Active' : 'Active'} ({activePlayers.length})
                      </Text>
                    </Pressable>
                    {reservePlayers.length > 0 && (
                      <Pressable
                        onPress={isAllReserveSelected ? deselectAllReserve : selectAllReserve}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg mr-2 border items-center',
                          isAllReserveSelected
                            ? 'bg-amber-500/20 border-amber-500/50'
                            : 'bg-slate-700/50 border-slate-600'
                        )}
                      >
                        <Text className={cn(
                          'font-medium text-xs',
                          isAllReserveSelected ? 'text-amber-400' : 'text-slate-400'
                        )}>
                          {isAllReserveSelected ? '✓ Reserve' : 'Reserve'} ({reservePlayers.length})
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={selectedPlayerIds.length === players.length ? deselectAll : selectAll}
                      className={cn(
                        'flex-1 py-1.5 rounded-lg border items-center',
                        selectedPlayerIds.length === players.length
                          ? 'bg-cyan-500/20 border-cyan-500/50'
                          : 'bg-slate-700/50 border-slate-600'
                      )}
                    >
                      <Text className={cn(
                        'font-medium text-xs',
                        selectedPlayerIds.length === players.length ? 'text-cyan-400' : 'text-slate-400'
                      )}>
                        {selectedPlayerIds.length === players.length ? '✓ All' : 'All'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Active Players */}
                  <Text className="text-green-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                    Active Players
                  </Text>
                  <View className="mb-3">
                    {Array.from({ length: Math.ceil(activePlayers.length / 4) }, (_, rowIdx) => {
                      const row = activePlayers.slice(rowIdx * 4, rowIdx * 4 + 4);
                      return (
                        <View key={rowIdx} className="flex-row mb-1.5">
                          {row.map((player) => {
                            const isSelected = selectedPlayerIds.includes(player.id);
                            return (
                              <Pressable
                                key={player.id}
                                onPress={() => togglePlayer(player.id)}
                                className={cn(
                                  'flex-1 flex-row items-center justify-center px-1 py-1.5 rounded-lg border mx-0.5',
                                  isSelected
                                    ? 'bg-green-500/20 border-green-500/50'
                                    : 'bg-slate-700/50 border-slate-600'
                                )}
                              >
                                <PlayerAvatar player={player} size={20} />
                                <Text className={cn(
                                  'font-medium ml-1 text-xs',
                                  isSelected ? 'text-green-400' : 'text-slate-400'
                                )} numberOfLines={1}>
                                  {player.firstName}
                                </Text>
                                {isSelected && <Check size={11} color="#22c55e" style={{ marginLeft: 2 }} />}
                              </Pressable>
                            );
                          })}
                          {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, i) => (
                            <View key={`empty-${i}`} className="flex-1 mx-0.5" />
                          ))}
                        </View>
                      );
                    })}
                  </View>

                  {/* Reserve Players */}
                  {reservePlayers.length > 0 && (
                    <>
                      <Text className="text-amber-400 text-[10px] font-semibold uppercase tracking-wider mb-1.5">
                        Reserve Players
                      </Text>
                      <View>
                        {Array.from({ length: Math.ceil(reservePlayers.length / 4) }, (_, rowIdx) => {
                          const row = reservePlayers.slice(rowIdx * 4, rowIdx * 4 + 4);
                          return (
                            <View key={rowIdx} className="flex-row mb-1.5">
                              {row.map((player) => {
                                const isSelected = selectedPlayerIds.includes(player.id);
                                return (
                                  <Pressable
                                    key={player.id}
                                    onPress={() => togglePlayer(player.id)}
                                    className={cn(
                                      'flex-1 flex-row items-center justify-center px-1 py-1.5 rounded-lg border mx-0.5',
                                      isSelected
                                        ? 'bg-amber-500/20 border-amber-500/50'
                                        : 'bg-slate-700/50 border-slate-600'
                                    )}
                                  >
                                    <PlayerAvatar player={player} size={20} />
                                    <Text className={cn(
                                      'font-medium ml-1 text-xs',
                                      isSelected ? 'text-amber-400' : 'text-slate-400'
                                    )} numberOfLines={1}>
                                      {player.firstName}
                                    </Text>
                                    {isSelected && <Check size={11} color="#f59e0b" style={{ marginLeft: 2 }} />}
                                  </Pressable>
                                );
                              })}
                              {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, i) => (
                                <View key={`empty-${i}`} className="flex-1 mx-0.5" />
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Invite Release Options */}
            <View className="mb-2">
              <Text className="text-slate-400 text-sm mb-1">Release Invites</Text>
              <View className="bg-slate-800/40 rounded-xl p-1.5">
                {/* Release Now Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInviteReleaseOption('now');
                    setShowInviteReleaseDatePicker(false);
                  }}
                  className={cn(
                    'flex-row items-center px-2.5 py-2 rounded-lg mb-1 border',
                    inviteReleaseOption === 'now'
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'bg-slate-800/50 border-transparent'
                  )}
                >
                  <Send size={14} color={inviteReleaseOption === 'now' ? '#22c55e' : '#64748b'} />
                  <View className="ml-2 flex-1">
                    <Text className={cn(
                      'text-sm font-medium',
                      inviteReleaseOption === 'now' ? 'text-green-400' : 'text-slate-500'
                    )}>
                      Release invites now
                    </Text>
                    <Text className={cn('text-[10px]', inviteReleaseOption === 'now' ? 'text-slate-400' : 'text-slate-600')}>
                      Players will be notified immediately
                    </Text>
                  </View>
                  {inviteReleaseOption === 'now' && <Check size={14} color="#22c55e" />}
                </Pressable>

                {/* Schedule Release Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInviteReleaseOption('scheduled');
                    setAndroidPickerMode('date');
                    setShowInviteReleaseDatePicker(true);
                  }}
                  className={cn(
                    'flex-row items-center px-2.5 py-2 rounded-lg mb-1 border',
                    inviteReleaseOption === 'scheduled'
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-slate-800/50 border-transparent'
                  )}
                >
                  <Bell size={14} color={inviteReleaseOption === 'scheduled' ? '#22d3ee' : '#64748b'} />
                  <View className="ml-2 flex-1">
                    <Text className={cn(
                      'text-sm font-medium',
                      inviteReleaseOption === 'scheduled' ? 'text-cyan-400' : 'text-slate-500'
                    )}>
                      Schedule release
                    </Text>
                    <Text className={cn('text-[10px]', inviteReleaseOption === 'scheduled' ? 'text-slate-400' : 'text-slate-600')}>
                      Choose when to notify players
                    </Text>
                  </View>
                  {inviteReleaseOption === 'scheduled' && <Check size={14} color="#22d3ee" />}
                </Pressable>

                {/* Schedule Date/Time Picker */}
                {inviteReleaseOption === 'scheduled' && (
                  <View className="mt-1 mb-1">
                    <Pressable
                      onPress={() => {
                        setAndroidPickerMode('date');
                        setShowInviteReleaseDatePicker(!showInviteReleaseDatePicker);
                      }}
                      className="bg-slate-700/80 rounded-lg px-3 py-2"
                    >
                      <Text className="text-cyan-400 text-sm">
                        {format(inviteReleaseDate, 'EEE, MMM d, yyyy h:mm a')}
                      </Text>
                    </Pressable>
                    {showInviteReleaseDatePicker && (
                      <View className="bg-slate-700/80 rounded-xl mt-2 overflow-hidden items-center">
                        {Platform.OS === 'ios' ? (
                          <DateTimePicker
                            value={inviteReleaseDate}
                            mode="datetime"
                            display="inline"
                            onChange={(event, date) => {
                              if (date) setInviteReleaseDate(date);
                            }}
                            minimumDate={new Date()}
                            themeVariant="dark"
                            accentColor="#22d3ee"
                          />
                        ) : (
                          <DateTimePicker
                            value={inviteReleaseDate}
                            mode={androidPickerMode}
                            display="default"
                            onChange={(event, date) => {
                              if (event.type === 'dismissed') {
                                setShowInviteReleaseDatePicker(false);
                                setAndroidPickerMode('date');
                                return;
                              }
                              if (date) {
                                if (androidPickerMode === 'date') {
                                  // Save the date and show time picker
                                  setInviteReleaseDate(date);
                                  setAndroidPickerMode('time');
                                } else {
                                  // Time selected, save and close
                                  setInviteReleaseDate(date);
                                  setShowInviteReleaseDatePicker(false);
                                  setAndroidPickerMode('date');
                                }
                              }
                            }}
                            minimumDate={androidPickerMode === 'date' ? new Date() : undefined}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* Don't Send Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setInviteReleaseOption('none');
                    setShowInviteReleaseDatePicker(false);
                  }}
                  className={cn(
                    'flex-row items-center px-2.5 py-2 rounded-lg border',
                    inviteReleaseOption === 'none'
                      ? 'bg-slate-600/50 border-slate-500/50'
                      : 'bg-slate-800/50 border-transparent'
                  )}
                >
                  <BellOff size={14} color={inviteReleaseOption === 'none' ? '#94a3b8' : '#64748b'} />
                  <View className="ml-2 flex-1">
                    <Text className={cn(
                      'text-sm font-medium',
                      inviteReleaseOption === 'none' ? 'text-slate-300' : 'text-slate-500'
                    )}>
                      Don't send invites
                    </Text>
                    <Text className="text-slate-600 text-[10px]">
                      Send manually later
                    </Text>
                  </View>
                  {inviteReleaseOption === 'none' && <Check size={14} color="#94a3b8" />}
                </Pressable>
              </View>
            </View>

            {/* Refreshment Duty (Game only) */}
            {recordType === 'game' && teamSettings.showRefreshmentDuty !== false && (
            <View className="mb-2">
              <View className="flex-row items-center justify-between bg-slate-800/60 rounded-xl py-2 px-3">
                <View className="flex-row items-center">
                  {teamSettings.refreshmentDutyIs21Plus !== false ? (
                    <Beer size={14} color="#f59e0b" />
                  ) : (
                    <JuiceBoxIcon size={14} color="#a855f7" />
                  )}
                  <Text className="text-white font-medium ml-2 text-sm">
                    {teamSettings.refreshmentDutyIs21Plus !== false ? 'Beer Duty' : 'Refreshment Duty'}
                  </Text>
                </View>
                <Switch
                  value={showBeerDuty}
                  onValueChange={setShowBeerDuty}
                  trackColor={{ false: '#334155', true: teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b40' : '#a855f740' }}
                  thumbColor={showBeerDuty ? (teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b' : '#a855f7') : '#64748b'}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
              </View>

              {showBeerDuty && (
                <View className="mt-1.5">
                  <Text className="text-slate-400 text-sm mb-1.5">Assign Player</Text>
                  {/* Combined grid: None + players, 4 per row */}
                  {Array.from({ length: Math.ceil((activePlayers.length + 1) / 4) }, (_, rowIdx) => {
                    const items = [null, ...activePlayers].slice(rowIdx * 4, rowIdx * 4 + 4);
                    return (
                      <View key={rowIdx} className="flex-row mb-1.5">
                        {items.map((item, i) =>
                          item === null ? (
                            <Pressable
                              key="none"
                              onPress={() => setSelectedBeerDutyPlayer(null)}
                              className={cn(
                                'flex-1 py-1.5 rounded-lg mx-0.5 items-center justify-center border',
                                selectedBeerDutyPlayer === null
                                  ? 'bg-amber-500 border-amber-500'
                                  : 'bg-slate-800 border-slate-700'
                              )}
                            >
                              <Text className={cn(
                                'font-medium text-sm',
                                selectedBeerDutyPlayer === null ? 'text-slate-900' : 'text-slate-400'
                              )}>
                                None
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              key={item.id}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedBeerDutyPlayer(item.id);
                              }}
                              className={cn(
                                'flex-1 flex-row items-center justify-center px-1 py-1.5 rounded-lg mx-0.5 border',
                                selectedBeerDutyPlayer === item.id
                                  ? 'bg-amber-500 border-amber-500'
                                  : 'bg-slate-800 border-slate-700'
                              )}
                            >
                              <PlayerAvatar player={item} size={20} />
                              <Text className={cn(
                                'font-medium ml-1 text-xs',
                                selectedBeerDutyPlayer === item.id ? 'text-slate-900' : 'text-slate-400'
                              )} numberOfLines={1}>
                                {item.firstName}
                              </Text>
                            </Pressable>
                          )
                        )}
                        {items.length < 4 && Array.from({ length: 4 - items.length }).map((_, i) => (
                          <View key={`empty-${i}`} className="flex-1 mx-0.5" />
                        ))}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
            )}

            {/* Notes */}
            <View className="mb-3">
              <Text className="text-slate-400 text-sm mb-1">Notes (Optional)</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional info..."
                placeholderTextColor="#64748b"
                autoCapitalize="sentences"
                multiline
                numberOfLines={3}
                className="bg-slate-800 rounded-xl px-4 py-2.5 text-white text-base"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>
            <View className="h-8" />
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
