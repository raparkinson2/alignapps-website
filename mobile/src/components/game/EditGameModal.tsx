import { View, Text, Modal, Pressable, TextInput, ScrollView, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Send, Bell, BellOff, Beer } from 'lucide-react-native';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTeamStore, InviteReleaseOption } from '@/lib/store';
import { AddressSearch } from '@/components/AddressSearch';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { pushGameToSupabase, pushNotificationToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface EditGameModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
}

export function EditGameModal({ visible, onClose, gameId }: EditGameModalProps) {
  const games = useTeamStore((s) => s.games);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const updateGame = useTeamStore((s) => s.updateGame);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const game = games.find((g) => g.id === gameId);

  // Internal form state
  const [editOpponent, setEditOpponent] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editTime, setEditTime] = useState<Date>(new Date());
  const [editJersey, setEditJersey] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editShowBeerDuty, setEditShowBeerDuty] = useState(true);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
  const [editInviteReleaseOption, setEditInviteReleaseOption] = useState<InviteReleaseOption>('now');
  const [editInviteReleaseDate, setEditInviteReleaseDate] = useState<Date>(new Date());
  const [showEditInviteReleaseDatePicker, setShowEditInviteReleaseDatePicker] = useState(false);

  const updateGameAndSync = (updates: Parameters<typeof updateGame>[1]) => {
    if (!game) return;
    updateGame(game.id, updates);
    if (activeTeamId) {
      const currentGame = useTeamStore.getState().games.find((g) => g.id === gameId);
      if (currentGame) {
        pushGameToSupabase({ ...currentGame, ...updates } as any, activeTeamId).catch(syncError('sync'));
      }
    }
  };

  // Populate form when modal opens
  const handleShow = () => {
    if (!game) return;
    setEditOpponent(game.opponent);
    const combinedLocation = game.address
      ? `${game.location}, ${game.address}`
      : game.location;
    setEditLocation(combinedLocation);
    setEditDate(parseISO(game.date));
    const [time, period] = game.time.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    const timeDate = new Date();
    let hour = hours;
    if (period === 'PM' && hours !== 12) hour += 12;
    if (period === 'AM' && hours === 12) hour = 0;
    timeDate.setHours(hour, minutes, 0, 0);
    setEditTime(timeDate);
    setEditJersey(game.jerseyColor);
    setEditNotes(game.notes || '');
    setEditShowBeerDuty(game.showBeerDuty !== false);
    setEditInviteReleaseOption(game.inviteReleaseOption || 'now');
    setEditInviteReleaseDate(game.inviteReleaseDate ? parseISO(game.inviteReleaseDate) : new Date());
    setShowEditDatePicker(false);
    setShowEditTimePicker(false);
    setShowEditInviteReleaseDatePicker(false);
  };

  const handleSaveEdit = () => {
    if (!editOpponent.trim() || !editLocation.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const timeString = format(editTime, 'h:mm a');

    updateGameAndSync({
      opponent: editOpponent.trim(),
      location: editLocation.trim(),
      address: '',
      date: editDate.toISOString(),
      time: timeString,
      jerseyColor: editJersey,
      notes: editNotes.trim() || undefined,
      showBeerDuty: editShowBeerDuty,
      inviteReleaseOption: editInviteReleaseOption,
      inviteReleaseDate: editInviteReleaseOption === 'scheduled' ? editInviteReleaseDate.toISOString() : undefined,
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  if (!game) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Edit Game</Text>
            <Pressable onPress={handleSaveEdit}>
              <Text className="text-cyan-400 font-semibold">Save</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-5 pt-6">
            {/* Opponent */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Opponent</Text>
              <TextInput
                value={editOpponent}
                onChangeText={setEditOpponent}
                placeholder="e.g., Ice Wolves"
                placeholderTextColor="#64748b"
                autoCapitalize="words"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
              />
            </View>

            {/* Date */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Date</Text>
              <Pressable
                onPress={() => setShowEditDatePicker(!showEditDatePicker)}
                className="bg-slate-800 rounded-xl px-4 py-3"
              >
                <Text className="text-white text-lg">
                  {format(editDate, 'EEEE, MMMM d, yyyy')}
                </Text>
              </Pressable>
              {showEditDatePicker && (
                <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                  <DateTimePicker
                    value={editDate}
                    mode="date"
                    display="inline"
                    onChange={(event, date) => {
                      if (date) setEditDate(date);
                      if (Platform.OS === 'android') setShowEditDatePicker(false);
                    }}
                    themeVariant="dark"
                    accentColor="#67e8f9"
                  />
                </View>
              )}
            </View>

            {/* Time */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Time</Text>
              <Pressable
                onPress={() => setShowEditTimePicker(!showEditTimePicker)}
                className="bg-slate-800 rounded-xl px-4 py-3"
              >
                <Text className="text-white text-lg">
                  {format(editTime, 'h:mm a')}
                </Text>
              </Pressable>
              {showEditTimePicker && (
                <View className="bg-slate-800 rounded-xl mt-2 overflow-hidden items-center">
                  <DateTimePicker
                    value={editTime}
                    mode="time"
                    display="spinner"
                    onChange={(event, time) => {
                      if (time) setEditTime(time);
                      if (Platform.OS === 'android') setShowEditTimePicker(false);
                    }}
                    themeVariant="dark"
                    accentColor="#67e8f9"
                  />
                </View>
              )}
            </View>

            {/* Location */}
            <View className="mb-5" style={{ zIndex: 50 }}>
              <Text className="text-slate-400 text-sm mb-2">Location</Text>
              <AddressSearch
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Search for a venue or address..."
              />
            </View>

            {/* Jersey Color */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Jersey Color</Text>
              <View className="flex-row flex-wrap">
                {teamSettings.jerseyColors.map((color) => (
                  <Pressable
                    key={color.name}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditJersey(color.name);
                    }}
                    className={cn(
                      'flex-row items-center px-4 py-3 rounded-xl mr-2 mb-2 border',
                      editJersey === color.name
                        ? 'bg-cyan-500/20 border-cyan-500/50'
                        : 'bg-slate-800 border-slate-700'
                    )}
                  >
                    <View
                      className="w-5 h-5 rounded-full mr-2 border border-white/30"
                      style={{ backgroundColor: color.color }}
                    />
                    <Text
                      className={cn(
                        'font-medium',
                        editJersey === color.name ? 'text-cyan-400' : 'text-slate-400'
                      )}
                    >
                      {color.name}
                    </Text>
                    {editJersey === color.name && (
                      <Check size={16} color="#67e8f9" style={{ marginLeft: 8 }} />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Notes (Optional)</Text>
              <TextInput
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Any additional info..."
                placeholderTextColor="#64748b"
                autoCapitalize="sentences"
                multiline
                numberOfLines={3}
                className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                style={{ minHeight: 80, textAlignVertical: 'top' }}
              />
            </View>

            {/* Refreshment Duty Toggle */}
            {teamSettings.showRefreshmentDuty !== false && (
              <View className="mb-5">
                <View className="flex-row items-center justify-between bg-slate-800 rounded-xl p-4">
                  <View className="flex-row items-center">
                    {teamSettings.refreshmentDutyIs21Plus !== false ? (
                      <Beer size={20} color="#f59e0b" />
                    ) : (
                      <JuiceBoxIcon size={20} color="#a855f7" />
                    )}
                    <Text className="text-white font-medium ml-3">
                      {teamSettings.sport === 'hockey' && teamSettings.refreshmentDutyIs21Plus !== false
                        ? 'Post Game Beer Duty'
                        : 'Refreshment Duty'}
                    </Text>
                  </View>
                  <Switch
                    value={editShowBeerDuty}
                    onValueChange={setEditShowBeerDuty}
                    trackColor={{ false: '#334155', true: teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b40' : '#a855f740' }}
                    thumbColor={editShowBeerDuty ? (teamSettings.refreshmentDutyIs21Plus !== false ? '#f59e0b' : '#a855f7') : '#64748b'}
                  />
                </View>
              </View>
            )}

            {/* Invite Release Options */}
            <View className="mb-5">
              <Text className="text-slate-400 text-sm mb-2">Invite Release</Text>
              {game.invitesSent ? (
                <View className="bg-green-500/20 rounded-xl p-4 border border-green-500/30">
                  <View className="flex-row items-center">
                    <Check size={20} color="#22c55e" />
                    <Text className="text-green-400 font-medium ml-2">Invites already sent</Text>
                  </View>
                  <Text className="text-slate-400 text-sm mt-1">
                    Players have been notified about this game
                  </Text>
                </View>
              ) : (
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
                        Players will be notified on save
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
                    <View className="mt-2">
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
                            display="inline"
                            onChange={(event, date) => {
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
                        : 'bg-slate-800/50 border-transparent'
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
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
