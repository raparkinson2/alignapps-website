import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  X,
  Shield,
  Phone,
  Mail,
  Check,
  UserCog,
  Calendar,
  ChevronDown,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import {
  useTeamStore,
  Player,
  SPORT_POSITIONS,
  PlayerRole,
  PlayerStatus,
  getPlayerPositions,
  getPlayerName,
  StatusDuration,
} from '@/lib/store';
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { cn } from '@/lib/cn';
import { createTeamInvitation } from '@/lib/team-invitations';
import { formatPhoneInput, formatPhoneNumber, unformatPhone } from '@/lib/phone';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import { SendInviteModal } from './SendInviteModal';

interface PlayerEditModalProps {
  visible: boolean;
  onClose: () => void;
  /** null = adding new player, string = editing existing player by id */
  playerId: string | null;
}

export function PlayerEditModal({ visible, onClose, playerId }: PlayerEditModalProps) {
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const userEmail = useTeamStore((s) => s.userEmail);
  const showTeamStats = teamSettings.showTeamStats !== false;

  const positions = SPORT_POSITIONS[teamSettings.sport];

  // Derive the player being edited from the id prop
  const editingPlayer = playerId ? (players.find((p) => p.id === playerId) ?? null) : null;

  // Internal form state
  const [firstName, setFirstName] = useState(() =>
    editingPlayer ? editingPlayer.firstName : ''
  );
  const [lastName, setLastName] = useState(() =>
    editingPlayer ? editingPlayer.lastName : ''
  );
  const [number, setNumber] = useState(() =>
    editingPlayer ? editingPlayer.number : ''
  );
  const [selectedPositions, setSelectedPositions] = useState<string[]>(() => {
    if (!editingPlayer) return [];
    return getPlayerPositions(editingPlayer).filter(p => p && p !== 'Coach' && p !== 'Parent');
  });
  const [phone, setPhone] = useState(() =>
    editingPlayer ? formatPhoneNumber(editingPlayer.phone) : ''
  );
  const [email, setEmail] = useState(() =>
    editingPlayer ? (editingPlayer.email || '') : ''
  );
  const [playerRoles, setPlayerRoles] = useState<PlayerRole[]>(() =>
    editingPlayer ? (editingPlayer.roles || []) : []
  );
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>(() =>
    editingPlayer ? (editingPlayer.status || 'active') : 'active'
  );
  const [memberRole, setMemberRole] = useState<'player' | 'reserve' | 'coach' | 'parent'>(() => {
    if (!editingPlayer) return 'player';
    if (editingPlayer.roles?.includes('coach') || editingPlayer.position === 'Coach') return 'coach';
    if (editingPlayer.roles?.includes('parent') || editingPlayer.position === 'Parent') return 'parent';
    if (editingPlayer.status === 'reserve') return 'reserve';
    return 'player';
  });
  const [isInjured, setIsInjured] = useState(() =>
    editingPlayer ? (editingPlayer.isInjured || false) : false
  );
  const [isSuspended, setIsSuspended] = useState(() =>
    editingPlayer ? (editingPlayer.isSuspended || false) : false
  );
  const [injuryDuration, setInjuryDuration] = useState<StatusDuration | undefined>(() =>
    editingPlayer ? editingPlayer.injuryDuration : undefined
  );
  const [suspensionDuration, setSuspensionDuration] = useState<StatusDuration | undefined>(() =>
    editingPlayer ? editingPlayer.suspensionDuration : undefined
  );
  const [statusEndDate, setStatusEndDate] = useState<string>(() =>
    editingPlayer ? (editingPlayer.statusEndDate || '') : ''
  );
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [associatedPlayerId, setAssociatedPlayerId] = useState<string>(() =>
    editingPlayer ? (editingPlayer.associatedPlayerId || '') : ''
  );
  const [showAssociatedPlayerPicker, setShowAssociatedPlayerPicker] = useState(false);

  // Invite modal state (triggered after new player is saved)
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [newlyCreatedPlayer, setNewlyCreatedPlayer] = useState<Player | null>(null);

  // Reset form to defaults for a new player
  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setNumber('');
    setSelectedPositions([]);
    setPhone('');
    setEmail('');
    setPlayerRoles([]);
    setPlayerStatus('active');
    setMemberRole('player');
    setIsInjured(false);
    setIsSuspended(false);
    setInjuryDuration(undefined);
    setSuspensionDuration(undefined);
    setStatusEndDate('');
    setAssociatedPlayerId('');
  };

  // Sync form state when the modal opens with a different player
  const handleModalOpen = () => {
    if (editingPlayer) {
      setFirstName(editingPlayer.firstName);
      setLastName(editingPlayer.lastName);
      setNumber(editingPlayer.number);
      const playerPositions = getPlayerPositions(editingPlayer).filter(p => p && p !== 'Coach' && p !== 'Parent');
      setSelectedPositions(playerPositions);
      setPhone(formatPhoneNumber(editingPlayer.phone));
      setEmail(editingPlayer.email || '');
      setPlayerRoles(editingPlayer.roles || []);
      setPlayerStatus(editingPlayer.status || 'active');
      setIsInjured(editingPlayer.isInjured || false);
      setIsSuspended(editingPlayer.isSuspended || false);
      setInjuryDuration(editingPlayer.injuryDuration);
      setSuspensionDuration(editingPlayer.suspensionDuration);
      setStatusEndDate(editingPlayer.statusEndDate || '');
      setAssociatedPlayerId(editingPlayer.associatedPlayerId || '');
      // Determine member role from player data (check both roles array and position field for consistency)
      if (editingPlayer.roles?.includes('coach') || editingPlayer.position === 'Coach') {
        setMemberRole('coach');
      } else if (editingPlayer.roles?.includes('parent') || editingPlayer.position === 'Parent') {
        setMemberRole('parent');
      } else if (editingPlayer.status === 'reserve') {
        setMemberRole('reserve');
      } else {
        setMemberRole('player');
      }
    } else {
      resetForm();
    }
  };

  const handleSave = () => {
    const isCoachRole = memberRole === 'coach';
    const isParentRole = memberRole === 'parent';

    // Only require jersey number if not a coach or parent
    if (!firstName.trim() || !lastName.trim() || (!isCoachRole && !isParentRole && !number.trim())) return;

    // Require at least one position if not a coach or parent
    if (!isCoachRole && !isParentRole && selectedPositions.length === 0) {
      Alert.alert('Missing Info', 'Please select at least one position.');
      return;
    }

    // Require phone and email for players (not coaches or parents)
    const rawPhoneCheck = unformatPhone(phone);
    const rawEmailCheck = email.trim();
    if (!isCoachRole && !isParentRole) {
      if (!rawPhoneCheck) {
        Alert.alert('Phone Required', 'Please enter a phone number so the player can log in.');
        return;
      }
      if (!rawEmailCheck) {
        Alert.alert('Email Required', 'Please enter an email address so the player can log in.');
        return;
      }
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Store raw phone digits and email before any state changes
    const rawPhone = rawPhoneCheck;
    const rawEmail = rawEmailCheck;

    // Build roles array based on memberRole
    const roles: PlayerRole[] = playerRoles.filter(r => r !== 'coach' && r !== 'parent');
    if (isCoachRole) {
      roles.push('coach');
    }
    if (isParentRole) {
      roles.push('parent');
    }

    // Determine status based on memberRole
    const effectiveStatus: PlayerStatus = memberRole === 'reserve' ? 'reserve' : 'active';

    if (editingPlayer) {
      // Strip role-specific positions from selectedPositions when not that role
      const cleanPositions = selectedPositions.filter(p => p !== 'Coach' && p !== 'Parent');
      const updates: Partial<Player> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: (isCoachRole || isParentRole) ? '' : number.trim(),
        position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : (cleanPositions[0] || '')),
        positions: isCoachRole ? ['Coach'] : (isParentRole ? ['Parent'] : [...cleanPositions]),
        phone: rawPhone || undefined,
        email: rawEmail || undefined,
        associatedPlayerId: isParentRole ? (associatedPlayerId || undefined) : undefined,
      };

      // Only admins can change roles and status
      if (isAdmin()) {
        updates.roles = roles;
        updates.status = effectiveStatus;
        updates.isInjured = isInjured;
        updates.isSuspended = isSuspended;
        updates.injuryDuration = isInjured ? injuryDuration : undefined;
        updates.suspensionDuration = isSuspended ? suspensionDuration : undefined;
        // Only save end date if injured or suspended
        updates.statusEndDate = (isInjured || isSuspended) ? (statusEndDate || undefined) : undefined;
      }

      updatePlayer(editingPlayer.id, updates);
      // Sync to Supabase so changes appear on all devices
      if (activeTeamId) {
        const storeState = useTeamStore.getState();
        // Find the player in state.players or fallback to the active team's players array
        const basePlayer = storeState.players.find(p => p.id === editingPlayer.id)
          ?? storeState.teams.find(t => t.id === activeTeamId)?.players.find(p => p.id === editingPlayer.id)
          ?? editingPlayer;
        const updated = { ...basePlayer, ...updates };
        pushPlayerToSupabase(updated as Player, activeTeamId).catch(console.error);
      }
      onClose();
      resetForm();
    } else {
      const cleanNewPositions = selectedPositions.filter(p => p !== 'Coach' && p !== 'Parent');
      const newPlayer: Player = {
        id: Date.now().toString(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        number: (isCoachRole || isParentRole) ? '' : number.trim(),
        position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : cleanNewPositions[0]),
        positions: isCoachRole ? ['Coach'] : (isParentRole ? ['Parent'] : cleanNewPositions),
        phone: rawPhone || undefined,
        email: rawEmail || undefined,
        roles: isAdmin() ? roles : [],
        status: isAdmin() ? effectiveStatus : 'active',
        isInjured: isAdmin() ? isInjured : false,
        isSuspended: isAdmin() ? isSuspended : false,
        statusEndDate: isAdmin() && (isInjured || isSuspended) ? (statusEndDate || undefined) : undefined,
        associatedPlayerId: isParentRole ? (associatedPlayerId || undefined) : undefined,
      };
      addPlayer(newPlayer);

      // Persist new player to Supabase immediately
      if (activeTeamId) {
        pushPlayerToSupabase(newPlayer, activeTeamId).catch(console.error);
      }

      // Also create a Supabase invitation for cross-device joining
      if (rawPhone || rawEmail) {
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
            console.log('ROSTER: Using legacy single-team mode');
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
          console.log('ROSTER: Creating invitation for team ID:', teamId, 'with team data:', !!currentTeam);
          try {
            const result = await createTeamInvitation({
              team_id: teamId,
              team_name: teamName,
              email: rawEmail || undefined,
              phone: rawPhone || undefined,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              jersey_number: number.trim() || undefined,
              position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : selectedPositions[0]),
              roles: isAdmin() ? roles : [],
              invited_by_email: userEmail || undefined,
              team_data: currentTeam, // Include full team data
            });
            console.log('ROSTER: Supabase invitation created:', result);
          } catch (err) {
            console.error('ROSTER: Failed to create Supabase invitation:', err);
          }
        }, 100);
      }

      onClose();
      resetForm();

      // Show invite modal if player has phone or email
      console.log('Player created - rawPhone:', rawPhone, 'rawEmail:', rawEmail);
      if (rawPhone || rawEmail) {
        setNewlyCreatedPlayer({ ...newPlayer, phone: rawPhone || undefined, email: rawEmail || undefined });
        setIsInviteModalVisible(true);
      }
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
        onShow={handleModalOpen}
      >
        <View className="flex-1 bg-slate-900">
          <SafeAreaView className="flex-1">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={onClose}>
                <X size={24} color="#64748b" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">
                {editingPlayer ? 'Edit Player' : 'Add Player'}
              </Text>
              <Pressable onPress={handleSave}>
                <Text className="text-cyan-400 font-bold text-base">Save</Text>
              </Pressable>
            </View>

            <ScrollView className="flex-1 px-5 pt-4">
              {/* First Name and Last Name Row */}
              <View className="flex-row mb-3">
                {/* First Name Input */}
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-sm mb-1">First Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
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
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              </View>

              {/* Jersey Number Row - hidden for coaches and parents */}
              {memberRole !== 'coach' && memberRole !== 'parent' && (
              <View className="mb-3">
                <Text className="text-slate-400 text-sm mb-1">Jersey Number<Text className="text-red-400">*</Text></Text>
                <TextInput
                  value={number}
                  onChangeText={setNumber}
                  placeholder="00"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  maxLength={2}
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  style={{ width: 100 }}
                />
              </View>
              )}

              {/* Phone Input - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <View className="flex-row items-center mb-1">
                    <Phone size={14} color="#a78bfa" />
                    <Text className="text-slate-400 text-sm ml-2">Phone{memberRole !== 'coach' && memberRole !== 'parent' && <Text className="text-red-400">*</Text>}</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={(text) => setPhone(formatPhoneInput(text))}
                    placeholder="(555)123-4567"
                    placeholderTextColor="#64748b"
                    keyboardType="phone-pad"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              )}

              {/* Email Input - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <View className="flex-row items-center mb-1">
                    <Mail size={14} color="#a78bfa" />
                    <Text className="text-slate-400 text-sm ml-2">Email{memberRole !== 'coach' && memberRole !== 'parent' && <Text className="text-red-400">*</Text>}</Text>
                  </View>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="player@example.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                  />
                </View>
              )}

              {/* Position Selector - Multiple Selection - Hidden for coaches and parents */}
              {memberRole !== 'coach' && memberRole !== 'parent' && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-0.5">Positions<Text className="text-red-400">*</Text></Text>
                  <Text className="text-slate-500 text-xs mb-1.5">Tap to select multiple positions</Text>
                  {/* Split positions into rows for better layout */}
                  {(() => {
                    const posCount = positions.length;
                    // For 10+ positions, split into two rows
                    const splitAt = posCount <= 6 ? posCount : Math.ceil(posCount / 2);
                    const row1 = positions.slice(0, splitAt);
                    const row2 = positions.slice(splitAt);

                    const renderRow = (rowPositions: string[], isLastRow: boolean) => (
                      <View className={cn("flex-row", !isLastRow && "mb-2")} style={{ gap: 6 }}>
                        {rowPositions.map((pos) => {
                          const isSelected = selectedPositions.includes(pos);
                          return (
                            <Pressable
                              key={pos}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                if (isSelected) {
                                  setSelectedPositions(selectedPositions.filter(p => p !== pos));
                                } else {
                                  setSelectedPositions([...selectedPositions, pos]);
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
                  {selectedPositions.length === 0 && (
                    <Text className="text-red-400 text-xs mt-1">Please select at least one position</Text>
                  )}
                </View>
              )}

              {/* Player Status - Admin Only */}
              {isAdmin() && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1.5">Player Status</Text>
                  <View className="flex-row mb-2">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPlayerStatus('active');
                        setMemberRole('player');
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                        playerStatus === 'active' && memberRole !== 'reserve' ? 'bg-green-500' : 'bg-slate-800'
                      )}
                    >
                      {playerStatus === 'active' && memberRole !== 'reserve' && <Check size={16} color="white" />}
                      <Text
                        className={cn(
                          'font-semibold ml-1',
                          playerStatus === 'active' && memberRole !== 'reserve' ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Active
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPlayerStatus('reserve');
                        setMemberRole('reserve');
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                        memberRole === 'reserve' ? 'bg-slate-600' : 'bg-slate-800'
                      )}
                    >
                      {memberRole === 'reserve' && <Check size={16} color="white" />}
                      <Text
                        className={cn(
                          'font-semibold ml-1',
                          memberRole === 'reserve' ? 'text-white' : 'text-slate-400'
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
                        setIsInjured(!isInjured);
                        if (isInjured) {
                          setInjuryDuration(undefined);
                        }
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                        isInjured ? 'bg-red-500' : 'bg-slate-800'
                      )}
                    >
                      <Text className={cn(
                        'text-lg font-black mr-1',
                        isInjured ? 'text-white' : 'text-red-500'
                      )}>+</Text>
                      <Text
                        className={cn(
                          'font-semibold',
                          isInjured ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Injured
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setIsSuspended(!isSuspended);
                        if (isSuspended) {
                          setSuspensionDuration(undefined);
                        }
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                        isSuspended ? 'bg-red-600' : 'bg-slate-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-bold mr-1',
                          isSuspended ? 'text-white' : 'text-red-500'
                        )}
                        style={{ fontSize: 12 }}
                      >
                        SUS
                      </Text>
                      <Text
                        className={cn(
                          'font-semibold',
                          isSuspended ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Suspended
                      </Text>
                    </Pressable>
                  </View>

                  {/* End Date Picker - shown when injured or suspended */}
                  {(isInjured || isSuspended) && (
                    <View className="mt-3 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                      <Text className="text-amber-400 text-sm font-medium mb-2">
                        End Date (Auto-mark OUT for games)
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setShowEndDatePicker(true);
                        }}
                        className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3"
                      >
                        <Calendar size={18} color="#f59e0b" />
                        <Text className="text-white ml-3 flex-1">
                          {statusEndDate && statusEndDate.length >= 10
                            ? format(parseISO(statusEndDate), 'MMM d, yyyy')
                            : 'Select end date'}
                        </Text>
                        {statusEndDate && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setStatusEndDate('');
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
                      {showEndDatePicker && (
                        <View className="mt-3">
                          <DateTimePicker
                            value={statusEndDate && statusEndDate.length >= 10 ? parseISO(statusEndDate) : new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowEndDatePicker(false);
                              }
                              if (selectedDate) {
                                setStatusEndDate(format(selectedDate, 'yyyy-MM-dd'));
                              }
                            }}
                            minimumDate={new Date()}
                            themeVariant="dark"
                          />
                          {Platform.OS === 'ios' && (
                            <Pressable
                              onPress={() => setShowEndDatePicker(false)}
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
              )}

              {/* Roles - Admin Only */}
              {isAdmin() && (
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
                            if (playerRoles.includes('captain')) {
                              setPlayerRoles(playerRoles.filter((r) => r !== 'captain'));
                            } else {
                              setPlayerRoles([...playerRoles, 'captain']);
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                            playerRoles.includes('captain') ? 'bg-amber-500' : 'bg-slate-800'
                          )}
                        >
                          <View className="w-5 h-5 rounded-full bg-amber-500/30 items-center justify-center mb-1">
                            <Text className={cn(
                              'text-xs font-black',
                              playerRoles.includes('captain') ? 'text-white' : 'text-amber-500'
                            )}>C</Text>
                          </View>
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                            className={cn(
                              'font-semibold text-xs',
                              playerRoles.includes('captain') ? 'text-white' : 'text-slate-400'
                            )}
                          >
                            Captain
                          </Text>
                        </Pressable>
                        {/* Admin */}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (playerRoles.includes('admin')) {
                              setPlayerRoles(playerRoles.filter((r) => r !== 'admin'));
                            } else {
                              setPlayerRoles([...playerRoles, 'admin']);
                            }
                          }}
                          className={cn(
                            'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                            playerRoles.includes('admin') ? 'bg-purple-500' : 'bg-slate-800'
                          )}
                        >
                          <Shield size={16} color={playerRoles.includes('admin') ? 'white' : '#a78bfa'} />
                          <Text
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                            className={cn(
                              'font-semibold text-xs mt-1',
                              playerRoles.includes('admin') ? 'text-white' : 'text-slate-400'
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
                              if (memberRole === 'coach') {
                                setMemberRole('player');
                              } else {
                                setMemberRole('coach');
                              }
                            }}
                            className={cn(
                              'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                              showParent && 'mr-2',
                              memberRole === 'coach' ? 'bg-cyan-500' : 'bg-slate-800'
                            )}
                          >
                            <UserCog size={16} color={memberRole === 'coach' ? 'white' : '#67e8f9'} />
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                              className={cn(
                                'font-semibold text-xs mt-1',
                                memberRole === 'coach' ? 'text-white' : 'text-slate-400'
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
                              if (memberRole === 'parent') {
                                setMemberRole('player');
                              } else {
                                setMemberRole('parent');
                              }
                            }}
                            className={cn(
                              'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                              memberRole === 'parent' ? 'bg-pink-500' : 'bg-slate-800'
                            )}
                          >
                            <ParentChildIcon size={16} color={memberRole === 'parent' ? 'white' : '#ec4899'} />
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.7}
                              className={cn(
                                'font-semibold text-xs mt-1',
                                memberRole === 'parent' ? 'text-white' : 'text-slate-400'
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
                    {memberRole === 'coach' || memberRole === 'parent'
                      ? `${memberRole === 'coach' ? 'Coaches' : 'Parents/Guardians'} don't need jersey numbers or positions`
                      : 'Tap to toggle roles. Members can have multiple roles.'}
                  </Text>
                </View>
              )}

              {/* Associated Player dropdown - for parents only */}
              {memberRole === 'parent' && isAdmin() && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1">Associated Player</Text>
                  <Text className="text-slate-500 text-xs mb-2">Child must be added first</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowAssociatedPlayerPicker(!showAssociatedPlayerPicker);
                    }}
                    className="bg-slate-800 rounded-xl px-4 py-3 border border-slate-700 flex-row items-center justify-between"
                  >
                    <Text className={associatedPlayerId ? 'text-white' : 'text-slate-500'}>
                      {associatedPlayerId
                        ? (() => {
                            const p = players.find((pl) => pl.id === associatedPlayerId && pl.position !== 'Coach' && pl.position !== 'Parent' && !pl.roles?.includes('coach') && !pl.roles?.includes('parent'));
                            return p ? getPlayerName(p) : 'Unknown Player';
                          })()
                        : 'Select associated player (optional)'}
                    </Text>
                    <ChevronDown size={16} color="#64748b" />
                  </Pressable>
                  {showAssociatedPlayerPicker && (
                    <View className="mt-1 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                      <Pressable
                        onPress={() => {
                          setAssociatedPlayerId('');
                          setShowAssociatedPlayerPicker(false);
                        }}
                        className="px-4 py-3 border-b border-slate-700/50"
                      >
                        <Text className="text-slate-400 text-sm">None</Text>
                      </Pressable>
                      {players
                        .filter((p) =>
                          p.position !== 'Coach' &&
                          p.position !== 'Parent' &&
                          !p.roles?.includes('coach') &&
                          !p.roles?.includes('parent') &&
                          p.id !== editingPlayer?.id
                        )
                        .map((p) => (
                          <Pressable
                            key={p.id}
                            onPress={() => {
                              setAssociatedPlayerId(p.id);
                              setShowAssociatedPlayerPicker(false);
                            }}
                            className={cn(
                              'px-4 py-3 border-b border-slate-700/30',
                              associatedPlayerId === p.id && 'bg-pink-500/20'
                            )}
                          >
                            <Text className={cn('text-sm', associatedPlayerId === p.id ? 'text-pink-400 font-semibold' : 'text-white')}>
                              {getPlayerName(p)} {p.number ? `#${p.number}` : ''}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
              )}

              {/* Admin Note for Stats */}
              {editingPlayer && isAdmin() && showTeamStats && (
                <View className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 mt-5 mb-5">
                  <Text className="text-purple-400 text-sm">
                    To update player stats, go to Team Stats in the Admin panel.
                  </Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Send Invite Modal - triggered after a new player is saved */}
      <SendInviteModal
        visible={isInviteModalVisible}
        onClose={() => {
          setIsInviteModalVisible(false);
          setNewlyCreatedPlayer(null);
        }}
        playerName={newlyCreatedPlayer ? getPlayerName(newlyCreatedPlayer) : ''}
        invitePhone={newlyCreatedPlayer?.phone}
        inviteEmail={newlyCreatedPlayer?.email}
        jerseyNumber={newlyCreatedPlayer?.number}
      />
    </>
  );
}
