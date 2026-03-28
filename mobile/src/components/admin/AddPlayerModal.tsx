import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import { useState } from 'react';
import {
  X,
  Check,
  Phone,
  Mail,
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
  SPORT_POSITIONS,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { formatPhoneInput, unformatPhone } from '@/lib/phone';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import { createTeamInvitation } from '@/lib/team-invitations';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { SendInviteModal } from './SendInviteModal';

interface AddPlayerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddPlayerModal({ visible, onClose }: AddPlayerModalProps) {
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const userEmail = useTeamStore((s) => s.userEmail);

  const positions = SPORT_POSITIONS[teamSettings.sport];

  // New player form
  const [newPlayerFirstName, setNewPlayerFirstName] = useState('');
  const [newPlayerLastName, setNewPlayerLastName] = useState('');
  const [newPlayerNumber, setNewPlayerNumber] = useState('');
  const [newPlayerPositions, setNewPlayerPositions] = useState<string[]>([]);
  const [newPlayerPhone, setNewPlayerPhone] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerRoles, setNewPlayerRoles] = useState<PlayerRole[]>([]);
  const [newPlayerStatus, setNewPlayerStatus] = useState<PlayerStatus>('active');
  const [newPlayerIsInjured, setNewPlayerIsInjured] = useState(false);
  const [newPlayerIsSuspended, setNewPlayerIsSuspended] = useState(false);
  const [newPlayerStatusEndDate, setNewPlayerStatusEndDate] = useState<string>(''); // YYYY-MM-DD format

  const [showNewPlayerEndDatePicker, setShowNewPlayerEndDatePicker] = useState(false);
  const [newPlayerMemberRole, setNewPlayerMemberRole] = useState<'player' | 'reserve' | 'coach' | 'parent'>('player');

  // Invite modal state
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [newlyCreatedPlayer, setNewlyCreatedPlayer] = useState<Player | null>(null);

  const resetNewPlayerForm = () => {
    setNewPlayerFirstName('');
    setNewPlayerLastName('');
    setNewPlayerNumber('');
    setNewPlayerPositions([]);
    setNewPlayerPhone('');
    setNewPlayerEmail('');
    setNewPlayerRoles([]);
    setNewPlayerStatus('active');
    setNewPlayerIsInjured(false);
    setNewPlayerIsSuspended(false);
    setNewPlayerStatusEndDate('');
    setShowNewPlayerEndDatePicker(false);
    setNewPlayerMemberRole('player');
  };

  const handleCreatePlayer = () => {
    const rawPhone = unformatPhone(newPlayerPhone);
    const isCoachRole = newPlayerMemberRole === 'coach';
    const isParentRole = newPlayerMemberRole === 'parent';

    if (!newPlayerFirstName.trim()) {
      Alert.alert('Missing Info', 'Please enter a first name.');
      return;
    }
    if (!newPlayerLastName.trim()) {
      Alert.alert('Missing Info', 'Please enter a last name.');
      return;
    }
    // Only require jersey number if not a coach or parent
    if (!isCoachRole && !isParentRole && !newPlayerNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter a jersey number.');
      return;
    }
    if (!isCoachRole && !isParentRole && !rawPhone) {
      Alert.alert('Missing Info', 'Please enter a phone number.');
      return;
    }
    if (!isCoachRole && !isParentRole && !newPlayerEmail.trim()) {
      Alert.alert('Missing Info', 'Please enter an email address.');
      return;
    }
    // Require at least one position if not a coach or parent
    if (!isCoachRole && !isParentRole && newPlayerPositions.length === 0) {
      Alert.alert('Missing Info', 'Please select at least one position.');
      return;
    }

    // Prevent duplicate phone number on this team
    if (rawPhone) {
      const phoneConflict = players.find((p) => p.phone?.replace(/\D/g, '') === rawPhone.replace(/\D/g, ''));
      if (phoneConflict) {
        Alert.alert('Already on Team', `${phoneConflict.firstName} ${phoneConflict.lastName} already has this phone number on this team.`);
        return;
      }
    }

    // Prevent duplicate email on this team
    if (newPlayerEmail.trim()) {
      const emailConflict = players.find((p) => p.email?.toLowerCase() === newPlayerEmail.trim().toLowerCase());
      if (emailConflict) {
        Alert.alert('Already on Team', `${emailConflict.firstName} ${emailConflict.lastName} already has this email address on this team.`);
        return;
      }
    }

    // Prevent duplicate jersey number (skip for coaches/parents)
    if (!isCoachRole && !isParentRole && newPlayerNumber.trim()) {
      const jerseyConflict = players.find(
        (p) => p.number === newPlayerNumber.trim() && !p.roles?.includes('coach') && !p.roles?.includes('parent')
      );
      if (jerseyConflict) {
        Alert.alert('Jersey # Taken', `#${newPlayerNumber.trim()} is already worn by ${jerseyConflict.firstName} ${jerseyConflict.lastName}. Please choose a different number.`);
        return;
      }
    }

    // Build roles array based on memberRole
    const roles: PlayerRole[] = newPlayerRoles.filter(r => r !== 'coach' && r !== 'parent');
    if (isCoachRole) {
      roles.push('coach');
    }
    if (isParentRole) {
      roles.push('parent');
    }

    // Determine status based on memberRole
    const effectiveStatus: PlayerStatus = newPlayerMemberRole === 'reserve' ? 'reserve' : 'active';

    const newPlayer: Player = {
      id: Date.now().toString(),
      firstName: newPlayerFirstName.trim(),
      lastName: newPlayerLastName.trim(),
      number: (isCoachRole || isParentRole) ? '' : newPlayerNumber.trim(),
      position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : newPlayerPositions[0]),
      positions: isCoachRole ? ['Coach'] : (isParentRole ? ['Parent'] : newPlayerPositions),
      phone: rawPhone,
      email: newPlayerEmail.trim(),
      avatar: undefined,
      roles: roles,
      status: effectiveStatus,
      isInjured: newPlayerIsInjured,
      isSuspended: newPlayerIsSuspended,
      statusEndDate: (newPlayerIsInjured || newPlayerIsSuspended) ? (newPlayerStatusEndDate || undefined) : undefined,
    };

    addPlayer(newPlayer);

    // Push new player to Supabase immediately
    if (activeTeamId) {
      pushPlayerToSupabase(newPlayer, activeTeamId).catch(console.error);
    }

    // Also create a Supabase invitation for cross-device joining
    // Generate a consistent team ID
    const teamId = activeTeamId || `team-${Date.now()}`;

    // Use a small timeout to ensure state is updated with new player
    setTimeout(async () => {
      // Get the current team data to include in the invitation
      const state = useTeamStore.getState();

      // Try to get team from multi-team structure first
      let currentTeam = state.teams.find(t => t.id === activeTeamId);

      // If no team found in teams array, construct team from root state (legacy mode)
      if (!currentTeam && state.teamName) {
        console.log('ADMIN: Using legacy single-team mode');
        currentTeam = {
          id: teamId,
          teamName: state.teamName,
          teamSettings: state.teamSettings,
          players: state.players,
          games: state.games,
          events: state.events,
          photos: state.photos || [],
          notifications: state.notifications || [],
          chatMessages: state.chatMessages || [],
          chatLastReadAt: state.chatLastReadAt || {},
          paymentPeriods: state.paymentPeriods || [],
          polls: state.polls || [],
          teamLinks: state.teamLinks || [],
        };
      }

      // Create the invitation with the team data embedded
      console.log('ADMIN: Creating invitation for team ID:', teamId, 'with team data:', !!currentTeam);
      try {
        const result = await createTeamInvitation({
          team_id: teamId,
          team_name: teamName,
          email: newPlayerEmail.trim() || undefined,
          phone: rawPhone || undefined,
          first_name: newPlayerFirstName.trim(),
          last_name: newPlayerLastName.trim(),
          jersey_number: (isCoachRole || isParentRole) ? undefined : newPlayerNumber.trim(),
          position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : newPlayerPositions[0]),
          roles: roles,
          invited_by_email: userEmail || undefined,
          team_data: currentTeam, // Include full team data
        });
        console.log('ADMIN: Supabase invitation created:', result);
      } catch (err) {
        console.error('ADMIN: Failed to create Supabase invitation:', err);
      }
    }, 100);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
    resetNewPlayerForm();

    // Show invite modal since player has phone and email (both required now)
    setNewlyCreatedPlayer({ ...newPlayer });
    setIsInviteModalVisible(true);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          onClose();
          resetNewPlayerForm();
        }}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Add Player</Text>
              <View className="flex-row items-center">
                <Pressable onPress={handleCreatePlayer} className="mr-3">
                  <Text className="text-cyan-400 font-semibold">Create</Text>
                </Pressable>
                <Pressable onPress={() => {
                  onClose();
                  resetNewPlayerForm();
                }} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>
            </View>

            <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* First Name and Last Name Row */}
              <View className="flex-row mb-3">
                {/* First Name Input */}
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-sm mb-1">First Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={newPlayerFirstName}
                    onChangeText={setNewPlayerFirstName}
                    placeholder="First"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>

                {/* Last Name Input */}
                <View className="flex-1 ml-2">
                  <Text className="text-slate-400 text-sm mb-1">Last Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={newPlayerLastName}
                    onChangeText={setNewPlayerLastName}
                    placeholder="Last"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              </View>

              {/* Jersey Number and Position Row - Hidden for coaches and parents */}
              {newPlayerMemberRole !== 'coach' && newPlayerMemberRole !== 'parent' && (
                <View className="mb-3">
                  {/* Jersey Number */}
                  <View className="mb-3">
                    <Text className="text-slate-400 text-sm mb-1">Number<Text className="text-red-400">*</Text></Text>
                    <TextInput
                      value={newPlayerNumber}
                      onChangeText={setNewPlayerNumber}
                      placeholder="00"
                      placeholderTextColor="#64748b"
                      keyboardType="number-pad"
                      maxLength={2}
                      style={{ width: 100 }}
                      className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    />
                  </View>

                  {/* Position Selection */}
                  <View>
                    <Text className="text-slate-400 text-sm mb-0.5">Position<Text className="text-red-400">*</Text></Text>
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
                            const isSelected = newPlayerPositions.includes(pos);
                            return (
                              <Pressable
                                key={pos}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  if (isSelected) {
                                    setNewPlayerPositions(newPlayerPositions.filter(p => p !== pos));
                                  } else {
                                    setNewPlayerPositions([...newPlayerPositions, pos]);
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
                  </View>
                </View>
              )}

              {/* Phone */}
              <View className="mb-3">
                <View className="flex-row items-center mb-1">
                  <Phone size={14} color="#a78bfa" />
                  <Text className="text-slate-400 text-sm ml-2">Phone{newPlayerMemberRole !== 'coach' && newPlayerMemberRole !== 'parent' && <Text className="text-red-400">*</Text>}</Text>
                </View>
                <TextInput
                  value={newPlayerPhone}
                  onChangeText={(text) => setNewPlayerPhone(formatPhoneInput(text))}
                  placeholder="(555)123-4567"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                />
              </View>

              {/* Email */}
              <View className="mb-3">
                <View className="flex-row items-center mb-1">
                  <Mail size={14} color="#a78bfa" />
                  <Text className="text-slate-400 text-sm ml-2">Email{newPlayerMemberRole !== 'coach' && newPlayerMemberRole !== 'parent' && <Text className="text-red-400">*</Text>}</Text>
                </View>
                <TextInput
                  value={newPlayerEmail}
                  onChangeText={setNewPlayerEmail}
                  placeholder="player@example.com"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                />
              </View>

              {/* Player Status */}
              <View className="mb-3">
                <Text className="text-slate-400 text-sm mb-1.5">Player Status</Text>
                <View className="flex-row mb-2">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewPlayerMemberRole('player');
                    }}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                      newPlayerMemberRole === 'player' ? 'bg-green-500' : 'bg-slate-800'
                    )}
                  >
                    {newPlayerMemberRole === 'player' && <Check size={16} color="white" />}
                    <Text
                      className={cn(
                        'font-semibold ml-1',
                        newPlayerMemberRole === 'player' ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Active
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewPlayerMemberRole('reserve');
                    }}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                      newPlayerMemberRole === 'reserve' ? 'bg-slate-600' : 'bg-slate-800'
                    )}
                  >
                    {newPlayerMemberRole === 'reserve' && <Check size={16} color="white" />}
                    <Text
                      className={cn(
                        'font-semibold ml-1',
                        newPlayerMemberRole === 'reserve' ? 'text-white' : 'text-slate-400'
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
                      setNewPlayerIsInjured(!newPlayerIsInjured);
                    }}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                      newPlayerIsInjured ? 'bg-red-500' : 'bg-slate-800'
                    )}
                  >
                    <Text className={cn(
                      'text-lg font-black mr-1',
                      newPlayerIsInjured ? 'text-white' : 'text-red-500'
                    )}>+</Text>
                    <Text
                      className={cn(
                        'font-semibold',
                        newPlayerIsInjured ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Injured
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewPlayerIsSuspended(!newPlayerIsSuspended);
                    }}
                    className={cn(
                      'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                      newPlayerIsSuspended ? 'bg-red-600' : 'bg-slate-800'
                    )}
                  >
                    <Text
                      className={cn(
                        'font-bold mr-1',
                        newPlayerIsSuspended ? 'text-white' : 'text-red-500'
                      )}
                      style={{ fontSize: 12 }}
                    >
                      SUS
                    </Text>
                    <Text
                      className={cn(
                        'font-semibold',
                        newPlayerIsSuspended ? 'text-white' : 'text-slate-400'
                      )}
                    >
                      Suspended
                    </Text>
                  </Pressable>
                </View>

                {/* End Date Picker - shown when injured or suspended */}
                {(newPlayerIsInjured || newPlayerIsSuspended) && (
                  <View className="mt-3 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                    <Text className="text-amber-400 text-sm font-medium mb-2">
                      End Date (Auto-mark OUT for games)
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowNewPlayerEndDatePicker(true);
                      }}
                      className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3"
                    >
                      <Calendar size={18} color="#f59e0b" />
                      <Text className="text-white ml-3 flex-1">
                        {newPlayerStatusEndDate && newPlayerStatusEndDate.length >= 10
                          ? format(parseISO(newPlayerStatusEndDate), 'MMM d, yyyy')
                          : 'Select end date'}
                      </Text>
                      {newPlayerStatusEndDate && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setNewPlayerStatusEndDate('');
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
                    {showNewPlayerEndDatePicker && (
                      <View className="mt-3">
                        <DateTimePicker
                          value={newPlayerStatusEndDate && newPlayerStatusEndDate.length >= 10 ? parseISO(newPlayerStatusEndDate) : new Date()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={(event, selectedDate) => {
                            if (Platform.OS === 'android') {
                              setShowNewPlayerEndDatePicker(false);
                            }
                            if (selectedDate) {
                              setNewPlayerStatusEndDate(format(selectedDate, 'yyyy-MM-dd'));
                            }
                          }}
                          minimumDate={new Date()}
                          themeVariant="dark"
                        />
                        {Platform.OS === 'ios' && (
                          <Pressable
                            onPress={() => setShowNewPlayerEndDatePicker(false)}
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
                  const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                  const showCoach = enabledRoles.includes('coach');
                  const showParent = enabledRoles.includes('parent');

                  return (
                    <View className="flex-row flex-wrap">
                      {/* Captain */}
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          if (newPlayerRoles.includes('captain')) {
                            setNewPlayerRoles(newPlayerRoles.filter((r) => r !== 'captain'));
                          } else {
                            setNewPlayerRoles([...newPlayerRoles, 'captain']);
                          }
                        }}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                          newPlayerRoles.includes('captain') ? 'bg-amber-500' : 'bg-slate-800'
                        )}
                      >
                        <View className="w-5 h-5 rounded-full bg-amber-500/30 items-center justify-center mb-1">
                          <Text className={cn(
                            'text-xs font-black',
                            newPlayerRoles.includes('captain') ? 'text-white' : 'text-amber-500'
                          )}>C</Text>
                        </View>
                        <Text
                          className={cn(
                            'font-semibold text-sm',
                            newPlayerRoles.includes('captain') ? 'text-white' : 'text-slate-400'
                          )}
                        >
                          Captain
                        </Text>
                      </Pressable>
                      {/* Admin */}
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          if (newPlayerRoles.includes('admin')) {
                            setNewPlayerRoles(newPlayerRoles.filter((r) => r !== 'admin'));
                          } else {
                            setNewPlayerRoles([...newPlayerRoles, 'admin']);
                          }
                        }}
                        className={cn(
                          'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                          newPlayerRoles.includes('admin') ? 'bg-purple-500' : 'bg-slate-800'
                        )}
                      >
                        <Shield size={16} color={newPlayerRoles.includes('admin') ? 'white' : '#a78bfa'} />
                        <Text
                          className={cn(
                            'font-semibold text-sm mt-1',
                            newPlayerRoles.includes('admin') ? 'text-white' : 'text-slate-400'
                          )}
                        >
                          Admin
                        </Text>
                      </Pressable>
                      {/* Coach */}
                      {showCoach && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (newPlayerMemberRole === 'coach') {
                              setNewPlayerMemberRole('player');
                            } else {
                              setNewPlayerMemberRole('coach');
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                            showParent && 'mr-2',
                            newPlayerMemberRole === 'coach' ? 'bg-cyan-500' : 'bg-slate-800'
                          )}
                        >
                          <UserCog size={16} color={newPlayerMemberRole === 'coach' ? 'white' : '#67e8f9'} />
                          <Text
                            className={cn(
                              'font-semibold text-sm mt-1',
                              newPlayerMemberRole === 'coach' ? 'text-white' : 'text-slate-400'
                            )}
                          >
                            Coach
                          </Text>
                        </Pressable>
                      )}
                      {/* Parent */}
                      {showParent && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (newPlayerMemberRole === 'parent') {
                              setNewPlayerMemberRole('player');
                            } else {
                              setNewPlayerMemberRole('parent');
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                            newPlayerMemberRole === 'parent' ? 'bg-pink-500' : 'bg-slate-800'
                          )}
                        >
                          <ParentChildIcon size={16} color={newPlayerMemberRole === 'parent' ? 'white' : '#ec4899'} />
                          <Text
                            className={cn(
                              'font-semibold text-sm mt-1',
                              newPlayerMemberRole === 'parent' ? 'text-white' : 'text-slate-400'
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
                  {newPlayerMemberRole === 'coach' || newPlayerMemberRole === 'parent'
                    ? `${newPlayerMemberRole === 'coach' ? 'Coaches' : 'Parents/Guardians'} don't need jersey numbers or positions`
                    : 'Tap to toggle roles. Members can have multiple roles.'}
                </Text>
              </View>

              <Text className="text-slate-500 text-xs mb-6"><Text className="text-red-400">*</Text> Required</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Send Invite Modal - shown after creating a player */}
      <SendInviteModal
        visible={isInviteModalVisible}
        onClose={() => {
          setIsInviteModalVisible(false);
          setNewlyCreatedPlayer(null);
        }}
        playerName={newlyCreatedPlayer ? `${newlyCreatedPlayer.firstName} ${newlyCreatedPlayer.lastName}` : ''}
        invitePhone={newlyCreatedPlayer?.phone}
        inviteEmail={newlyCreatedPlayer?.email}
        player={newlyCreatedPlayer}
        isReinviteMode={false}
      />
    </>
  );
}
