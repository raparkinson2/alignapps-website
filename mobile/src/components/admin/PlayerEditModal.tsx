import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform, Switch } from 'react-native';
import { useState } from 'react';
import {
  X,
  Check,
  Phone,
  Mail,
  Send,
  Shield,
  Calendar,
  UserCog,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import {
  useTeamStore,
  Player,
  PlayerRole,
  PlayerStatus,
  getPlayerName,
  SPORT_POSITIONS,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { formatPhoneNumber, formatPhoneInput, unformatPhone } from '@/lib/phone';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface PlayerEditModalProps {
  visible: boolean;
  onClose: () => void;
  playerId: string | null;
  onReinvite: () => void;
}

export function PlayerEditModal({ visible, onClose, playerId, onReinvite }: PlayerEditModalProps) {
  const players = useTeamStore((s) => s.players);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const positions = SPORT_POSITIONS[teamSettings.sport];

  const selectedPlayer = players.find((p) => p.id === playerId) ?? null;

  // Form state
  const [editPlayerFirstName, setEditPlayerFirstName] = useState('');
  const [editPlayerLastName, setEditPlayerLastName] = useState('');
  const [editPlayerNumber, setEditPlayerNumber] = useState('');
  const [editPlayerPhone, setEditPlayerPhone] = useState('');
  const [editPlayerEmail, setEditPlayerEmail] = useState('');
  const [editPlayerPositions, setEditPlayerPositions] = useState<string[]>([]);
  const [editPlayerIsCoach, setEditPlayerIsCoach] = useState(false);
  const [editPlayerIsParent, setEditPlayerIsParent] = useState(false);
  const [showSelectedPlayerEndDatePicker, setShowSelectedPlayerEndDatePicker] = useState(false);

  // Sync form state when modal opens / player changes
  // We use a local ref pattern: when visible changes to true, reinitialize from store
  const [lastOpenedPlayerId, setLastOpenedPlayerId] = useState<string | null>(null);

  if (visible && playerId && playerId !== lastOpenedPlayerId) {
    const p = players.find((pl) => pl.id === playerId);
    if (p) {
      setLastOpenedPlayerId(playerId);
      setEditPlayerFirstName(p.firstName);
      setEditPlayerLastName(p.lastName);
      setEditPlayerNumber(p.number);
      setEditPlayerPhone(formatPhoneNumber(p.phone));
      setEditPlayerEmail(p.email || '');
      const playerPositions = p.positions || [p.position];
      setEditPlayerPositions(playerPositions.filter((pos) => pos && pos !== 'Coach' && pos !== 'Parent'));
      setEditPlayerIsCoach(p.roles?.includes('coach') || p.position === 'Coach' || false);
      setEditPlayerIsParent(p.roles?.includes('parent') || p.position === 'Parent' || false);
      setShowSelectedPlayerEndDatePicker(false);
    }
  }

  if (!visible && lastOpenedPlayerId !== null) {
    setLastOpenedPlayerId(null);
  }

  const syncPlayerToCloud = (id: string) => {
    if (!activeTeamId) return;
    const state = useTeamStore.getState();
    const p = state.players.find((pl) => pl.id === id)
      ?? state.teams.find((t) => t.id === activeTeamId)?.players.find((pl) => pl.id === id);
    if (p) pushPlayerToSupabase(p, activeTeamId).catch(syncError('sync'));
  };

  const handleSavePlayerName = () => {
    if (!selectedPlayer || !editPlayerFirstName?.trim() || !editPlayerLastName?.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const firstName = editPlayerFirstName.trim();
    const lastName = editPlayerLastName.trim();
    updatePlayer(selectedPlayer.id, { firstName, lastName });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerNumber = () => {
    if (!selectedPlayer || !editPlayerNumber.trim()) return;
    const newNumber = editPlayerNumber.trim();
    const isCoachOrParent = selectedPlayer.roles?.includes('coach') || selectedPlayer.roles?.includes('parent');
    if (!isCoachOrParent) {
      const conflict = players.find(
        (p) => p.id !== selectedPlayer.id && p.number === newNumber && !p.roles?.includes('coach') && !p.roles?.includes('parent')
      );
      if (conflict) {
        Alert.alert('Jersey # Taken', `#${newNumber} is already worn by ${conflict.firstName} ${conflict.lastName}.`);
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePlayer(selectedPlayer.id, { number: newNumber });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerPhone = () => {
    if (!selectedPlayer) return;
    const rawPhone = unformatPhone(editPlayerPhone);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePlayer(selectedPlayer.id, { phone: rawPhone || undefined });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerEmail = () => {
    if (!selectedPlayer) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePlayer(selectedPlayer.id, { email: editPlayerEmail.trim() || undefined });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerPositions = (newPositions: string[]) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePlayer(selectedPlayer.id, { position: newPositions[0], positions: newPositions });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleToggleEditCoach = () => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIsCoach = !editPlayerIsCoach;
    setEditPlayerIsCoach(newIsCoach);
    if (newIsCoach) setEditPlayerIsParent(false); // Mutually exclusive

    // Update roles
    const currentRoles = selectedPlayer.roles ?? [];
    let newRoles: PlayerRole[];

    if (newIsCoach) {
      // Add coach role, remove parent
      newRoles = currentRoles.filter((r) => r !== 'parent');
      newRoles = newRoles.includes('coach') ? newRoles : [...newRoles, 'coach'];
      // Update position to Coach
      updatePlayer(selectedPlayer.id, {
        roles: newRoles,
        position: 'Coach',
        positions: ['Coach'],
        number: ''
      });
      setEditPlayerNumber('');
      setEditPlayerPositions(['Coach']);
    } else {
      // Remove coach role
      newRoles = currentRoles.filter((r) => r !== 'coach');
      // Reset to empty positions - user must select
      updatePlayer(selectedPlayer.id, {
        roles: newRoles,
        position: '',
        positions: []
      });
      setEditPlayerPositions([]);
    }
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleToggleEditParent = () => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIsParent = !editPlayerIsParent;
    setEditPlayerIsParent(newIsParent);
    if (newIsParent) setEditPlayerIsCoach(false); // Mutually exclusive

    // Update roles
    const currentRoles = selectedPlayer.roles ?? [];
    let newRoles: PlayerRole[];

    if (newIsParent) {
      // Add parent role, remove coach
      newRoles = currentRoles.filter((r) => r !== 'coach');
      newRoles = newRoles.includes('parent') ? newRoles : [...newRoles, 'parent'];
      // Update position to Parent
      updatePlayer(selectedPlayer.id, {
        roles: newRoles,
        position: 'Parent',
        positions: ['Parent'],
        number: ''
      });
      setEditPlayerNumber('');
      setEditPlayerPositions(['Parent']);
    } else {
      // Remove parent role
      newRoles = currentRoles.filter((r) => r !== 'parent');
      // Reset to empty positions - user must select
      updatePlayer(selectedPlayer.id, {
        roles: newRoles,
        position: '',
        positions: []
      });
      setEditPlayerPositions([]);
    }
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleToggleRole = (role: PlayerRole) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const currentRoles = selectedPlayer.roles ?? [];

    if (currentRoles.includes(role)) {
      // Trying to REMOVE a role
      if (role === 'admin') {
        // Check if this would leave zero admins
        const currentAdminCount = players.filter((p) => p.roles?.includes('admin')).length;
        const playerIsCurrentlyAdmin = selectedPlayer.roles?.includes('admin') ?? false;
        const wouldLeaveNoAdmins = currentAdminCount <= 1 && playerIsCurrentlyAdmin;

        if (wouldLeaveNoAdmins) {
          Alert.alert(
            'Cannot Remove Admin',
            'This is the only admin on the team. You must make another team member an admin before removing this admin role.',
            [{ text: 'OK' }]
          );
          return;
        }

        // Show confirmation for removing admin
        Alert.alert(
          'Remove Admin Role?',
          `Are you sure you want to remove admin privileges from ${getPlayerName(selectedPlayer)}?\n\nThey will no longer be able to:\n• Manage players and roles\n• Edit team settings\n• Create payment periods\n• Access the Admin panel`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove Admin',
              style: 'destructive',
              onPress: () => {
                const newRoles = currentRoles.filter((r) => r !== 'admin');
                updatePlayer(selectedPlayer.id, { roles: newRoles });
              },
            },
          ]
        );
        return;
      }

      // Remove non-admin role
      const newRoles = currentRoles.filter((r) => r !== role);
      updatePlayer(selectedPlayer.id, { roles: newRoles });
    } else {
      // Add the role
      const newRoles = [...currentRoles, role];
      updatePlayer(selectedPlayer.id, { roles: newRoles });
    }
  };

  const handleUpdateStatus = (status: PlayerStatus) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePlayer(selectedPlayer.id, { status });
  };

  // Read the current player fresh from store for rendering (so toggling roles shows immediately)
  const currentPlayer = players.find((p) => p.id === playerId) ?? null;
  const selectedRoles = currentPlayer?.roles ?? [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">Edit Player</Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          {currentPlayer && (
            <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* First Name and Last Name Row */}
              <View className="flex-row mb-3">
                {/* First Name Input */}
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-sm mb-1">First Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={editPlayerFirstName}
                    onChangeText={setEditPlayerFirstName}
                    placeholder="First"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    onBlur={handleSavePlayerName}
                    onSubmitEditing={handleSavePlayerName}
                    returnKeyType="done"
                  />
                </View>

                {/* Last Name Input */}
                <View className="flex-1 ml-2">
                  <Text className="text-slate-400 text-sm mb-1">Last Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={editPlayerLastName}
                    onChangeText={setEditPlayerLastName}
                    placeholder="Last"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    onBlur={handleSavePlayerName}
                    onSubmitEditing={handleSavePlayerName}
                    returnKeyType="done"
                  />
                </View>
              </View>

              {/* Jersey Number Row - Hidden for coaches and parents */}
              {!editPlayerIsCoach && !editPlayerIsParent && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1">Jersey Number<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={editPlayerNumber}
                    onChangeText={setEditPlayerNumber}
                    placeholder="00"
                    placeholderTextColor="#64748b"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    style={{ width: 100 }}
                    onBlur={handleSavePlayerNumber}
                    onSubmitEditing={handleSavePlayerNumber}
                    returnKeyType="done"
                  />
                </View>
              )}

              {/* Phone */}
              <View className="mb-3">
                <View className="flex-row items-center mb-1">
                  <Phone size={14} color="#a78bfa" />
                  <Text className="text-slate-400 text-sm ml-2">Phone<Text className="text-red-400">*</Text></Text>
                </View>
                <TextInput
                  value={editPlayerPhone}
                  onChangeText={(text) => setEditPlayerPhone(formatPhoneInput(text))}
                  placeholder="(555)123-4567"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  onBlur={handleSavePlayerPhone}
                  onSubmitEditing={handleSavePlayerPhone}
                  returnKeyType="done"
                />
              </View>

              {/* Email */}
              <View className="mb-3">
                <View className="flex-row items-center mb-1">
                  <Mail size={14} color="#a78bfa" />
                  <Text className="text-slate-400 text-sm ml-2">Email<Text className="text-red-400">*</Text></Text>
                </View>
                <TextInput
                  value={editPlayerEmail}
                  onChangeText={setEditPlayerEmail}
                  placeholder="player@example.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  onBlur={handleSavePlayerEmail}
                  onSubmitEditing={handleSavePlayerEmail}
                  returnKeyType="done"
                />
              </View>

              {/* Position Selector - Hidden for coaches and parents */}
              {!editPlayerIsCoach && !editPlayerIsParent && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-0.5">Positions<Text className="text-red-400">*</Text></Text>
                  <Text className="text-slate-500 text-xs mb-1.5">Tap to select multiple positions</Text>
                  {/* Split positions into rows for better layout */}
                  {(() => {
                    const posCount = positions.length;
                    const splitAt = posCount <= 6 ? posCount : Math.ceil(posCount / 2);
                    const row1 = positions.slice(0, splitAt);
                    const row2 = positions.slice(splitAt);

                    const renderRow = (rowPositions: string[], isLastRow: boolean) => (
                      <View className={cn("flex-row", !isLastRow && "mb-2")} style={{ gap: 6 }}>
                        {rowPositions.map((pos) => {
                          const isSelected = editPlayerPositions.includes(pos);
                          return (
                            <Pressable
                              key={pos}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (isSelected) {
                                  const newPositions = editPlayerPositions.filter(p => p !== pos);
                                  setEditPlayerPositions(newPositions);
                                  if (newPositions.length > 0) {
                                    handleSavePlayerPositions(newPositions);
                                  }
                                } else {
                                  const newPositions = [...editPlayerPositions, pos];
                                  setEditPlayerPositions(newPositions);
                                  handleSavePlayerPositions(newPositions);
                                }
                              }}
                              className={cn(
                                'flex-1 py-3 rounded-xl items-center border',
                                isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-800 border-slate-700'
                              )}
                            >
                              <Text
                                className={cn(
                                  'font-semibold',
                                  isSelected ? 'text-white' : 'text-slate-400'
                                )}
                              >
                                {pos}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    );

                    return (
                      <>
                        {renderRow(row1, row2.length === 0)}
                        {row2.length > 0 && renderRow(row2, true)}
                      </>
                    );
                  })()}
                  {editPlayerPositions.length === 0 && (
                    <Text className="text-red-400 text-xs mt-1">Please select at least one position</Text>
                  )}
                </View>
              )}

              <Text className="text-slate-500 text-xs mb-4"><Text className="text-red-400">*</Text> Required</Text>

              {/* Player Status */}
              <View className="mb-3">
                <Text className="text-slate-400 text-sm mb-1.5">Player Status</Text>
                <View className="flex-row mb-2">
                  <Pressable
                    onPress={() => handleUpdateStatus('active')}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                      currentPlayer.status === 'active' ? 'bg-green-500' : 'bg-slate-800'
                    )}
                  >
                    {currentPlayer.status === 'active' && <Check size={16} color="white" />}
                    <Text
                      className={cn(
                        'font-semibold ml-1',
                        currentPlayer.status === 'active' ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Active
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleUpdateStatus('reserve')}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                      currentPlayer.status === 'reserve' ? 'bg-slate-600' : 'bg-slate-800'
                    )}
                  >
                    {currentPlayer.status === 'reserve' && <Check size={16} color="white" />}
                    <Text
                      className={cn(
                        'font-semibold ml-1',
                        currentPlayer.status === 'reserve' ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Reserve
                    </Text>
                  </Pressable>
                </View>
                <View className="flex-row">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const newValue = !currentPlayer.isInjured;
                      updatePlayer(currentPlayer.id, { isInjured: newValue });
                    }}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                      currentPlayer.isInjured ? 'bg-red-500' : 'bg-slate-800'
                    )}
                  >
                    <Text className={cn(
                      'text-lg font-black mr-1',
                      currentPlayer.isInjured ? 'text-white' : 'text-red-500'
                    )}>+</Text>
                    <Text
                      className={cn(
                        'font-semibold',
                        currentPlayer.isInjured ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Injured
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const newValue = !currentPlayer.isSuspended;
                      updatePlayer(currentPlayer.id, { isSuspended: newValue });
                    }}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                      currentPlayer.isSuspended ? 'bg-red-600' : 'bg-slate-800'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold mr-1',
                        currentPlayer.isSuspended ? 'text-white' : 'text-red-500'
                      )}
                      style={{ fontSize: 12 }}
                    >
                      SUS
                    </Text>
                    <Text
                      className={cn(
                        'font-semibold',
                        currentPlayer.isSuspended ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Suspended
                    </Text>
                  </Pressable>
                </View>

                {/* End Date Picker - shown when injured or suspended */}
                {(currentPlayer.isInjured || currentPlayer.isSuspended) && (
                  <View className="mt-3 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                    <Text className="text-amber-400 text-sm font-medium mb-2">
                      End Date (Auto-mark OUT for games)
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowSelectedPlayerEndDatePicker(true);
                      }}
                      className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3"
                    >
                      <Calendar size={18} color="#f59e0b" />
                      <Text className="text-white ml-3 flex-1">
                        {currentPlayer.statusEndDate && currentPlayer.statusEndDate.length >= 10
                          ? format(parseISO(currentPlayer.statusEndDate), 'MMM d, yyyy')
                          : 'Select end date'}
                      </Text>
                      {currentPlayer.statusEndDate && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            updatePlayer(currentPlayer.id, { statusEndDate: undefined });
                          }}
                          hitSlop={8}
                        >
                          <X size={16} color="#94a3b8" />
                        </Pressable>
                      )}
                    </Pressable>
                    <Text className="text-slate-500 text-xs mt-2">
                      Games on or before this date will have this player auto-marked as OUT
                    </Text>
                    {showSelectedPlayerEndDatePicker && (
                      <View className="mt-3">
                        <DateTimePicker
                          value={currentPlayer.statusEndDate && currentPlayer.statusEndDate.length >= 10 ? parseISO(currentPlayer.statusEndDate) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') {
                              setShowSelectedPlayerEndDatePicker(false);
                            }
                            if (selectedDate) {
                              const dateStr = format(selectedDate, 'yyyy-MM-dd');
                              updatePlayer(currentPlayer.id, { statusEndDate: dateStr });
                            }
                          }}
                          minimumDate={new Date()}
                          themeVariant="dark"
                        />
                        {Platform.OS === 'ios' && (
                          <Pressable
                            onPress={() => setShowSelectedPlayerEndDatePicker(false)}
                            className="mt-2 bg-cyan-500 rounded-xl py-2"
                          >
                            <Text className="text-white text-center font-semibold">Done</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Roles */}
              <View className="mb-3">
                <Text className="text-slate-400 text-sm mb-1.5">Roles</Text>
                {(() => {
                  const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach'];
                  const showCoach = enabledRoles.includes('coach');
                  const showParent = enabledRoles.includes('parent') && (teamSettings?.isPremium ?? false);

                  return (
                    <View className="flex-row flex-wrap">
                      {/* Captain */}
                      <Pressable
                        onPress={() => handleToggleRole('captain')}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                          selectedRoles.includes('captain') ? 'bg-amber-500' : 'bg-slate-800'
                        )}
                      >
                        <View className="w-5 h-5 rounded-full bg-amber-500/30 items-center justify-center mb-1">
                          <Text className={cn(
                            'text-xs font-black',
                            selectedRoles.includes('captain') ? 'text-white' : 'text-amber-500'
                          )}>C</Text>
                        </View>
                        <Text
                          className={cn(
                            'font-semibold text-sm',
                            selectedRoles.includes('captain') ? 'text-white' : 'text-slate-400'
                          )}
                        >
                          Captain
                        </Text>
                      </Pressable>
                      {/* Admin */}
                      <Pressable
                        onPress={() => handleToggleRole('admin')}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                          selectedRoles.includes('admin') ? 'bg-purple-500' : 'bg-slate-800'
                        )}
                      >
                        <Shield size={16} color={selectedRoles.includes('admin') ? 'white' : '#a78bfa'} />
                        <Text
                          className={cn(
                            'font-semibold text-sm mt-1',
                            selectedRoles.includes('admin') ? 'text-white' : 'text-slate-400'
                          )}
                        >
                          Admin
                        </Text>
                      </Pressable>
                      {/* Coach */}
                      {showCoach && (
                        <Pressable
                          onPress={handleToggleEditCoach}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                            showParent && 'mr-2',
                            editPlayerIsCoach ? 'bg-cyan-500' : 'bg-slate-800'
                          )}
                        >
                          <UserCog size={16} color={editPlayerIsCoach ? 'white' : '#67e8f9'} />
                          <Text
                            className={cn(
                              'font-semibold text-sm mt-1',
                              editPlayerIsCoach ? 'text-white' : 'text-slate-400'
                            )}
                          >
                            Coach
                          </Text>
                        </Pressable>
                      )}
                      {/* Parent */}
                      {showParent && (
                        <Pressable
                          onPress={handleToggleEditParent}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                            editPlayerIsParent ? 'bg-pink-500' : 'bg-slate-800'
                          )}
                        >
                          <ParentChildIcon size={16} color={editPlayerIsParent ? 'white' : '#ec4899'} />
                          <Text
                            className={cn(
                              'font-semibold text-sm mt-1',
                              editPlayerIsParent ? 'text-white' : 'text-slate-400'
                            )}
                          >
                            Parent/Guardian
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })()}
                <Text className="text-slate-500 text-xs mt-2">
                  {editPlayerIsCoach || editPlayerIsParent
                    ? `${editPlayerIsCoach ? 'Coaches' : 'Parents/Guardians'} don't need jersey numbers or positions`
                    : 'Tap to toggle roles. Members can have multiple roles.'}
                </Text>
              </View>

              {/* Re-send Invite Button */}
              {(currentPlayer?.phone || currentPlayer?.email) && (
                <View className="mb-6 mt-3">
                  <Pressable
                    onPress={onReinvite}
                    className="flex-row items-center justify-center bg-cyan-500/20 border border-cyan-500/40 rounded-xl py-4 active:bg-cyan-500/30"
                  >
                    <Send size={18} color="#22d3ee" />
                    <Text className="text-cyan-400 font-semibold ml-2">Re-send Invite</Text>
                  </Pressable>
                  <Text className="text-slate-500 text-xs mt-2 text-center">
                    Send another invite if the player didn't receive the first one
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
