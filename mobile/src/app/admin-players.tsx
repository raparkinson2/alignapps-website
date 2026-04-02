import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform, Switch, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Users,
  X,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserCog,
  Mail,
  Phone,
  MessageSquare,
  Send,
  UserPlus,
  Shield,
  ListOrdered,
  User,
  UserMinus,
  Heart,
  Calendar,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import {
  useTeamStore,
  Player,
  SPORT_POSITIONS,
  PlayerRole,
  PlayerStatus,
  getPlayerName,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { formatPhoneNumber, formatPhoneInput, unformatPhone } from '@/lib/phone';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { createTeamInvitation } from '@/lib/team-invitations';
import { pushPlayerToSupabase, pushTeamToSupabase, deletePlayerFromSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

// ─── Helper Components ───────────────────────────────────────────────────────

interface PlayerManageCardProps {
  player: Player;
  index: number;
  onPress: () => void;
  isCurrentUser: boolean;
}

function PlayerManageCard({ player, index, onPress, isCurrentUser }: PlayerManageCardProps) {
  const roles = player.roles ?? [];
  return (
    <Pressable
      onPress={onPress}
      className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 active:bg-slate-700/80"
    >
      <View className="flex-row items-center">
        <PlayerAvatar player={player} size={44} />
        <View className="flex-1 ml-3">
          <View className="flex-row items-center">
            <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
            {isCurrentUser && (
              <View className="ml-2 bg-cyan-500/20 rounded-full px-2 py-0.5">
                <Text className="text-cyan-400 text-xs">You</Text>
              </View>
            )}
          </View>
          <View className="flex-row items-center mt-1 flex-wrap">
            {roles.includes('admin') && (
              <View className="bg-purple-500/20 rounded-full px-2 py-0.5 mr-1">
                <Text className="text-purple-400 text-xs">Admin</Text>
              </View>
            )}
            {roles.includes('captain') && (
              <View className="bg-amber-500/20 rounded-full px-2 py-0.5 mr-1">
                <Text className="text-amber-400 text-xs">C</Text>
              </View>
            )}
            {roles.includes('coach') && (
              <View className="bg-cyan-500/20 rounded-full px-2 py-0.5 mr-1">
                <Text className="text-cyan-400 text-xs">Coach</Text>
              </View>
            )}
            {roles.includes('parent') && (
              <View className="bg-pink-500/20 rounded-full px-2 py-0.5 mr-1">
                <Text className="text-pink-400 text-xs">Parent</Text>
              </View>
            )}
            {player.status === 'reserve' && (
              <View className="bg-slate-600/40 rounded-full px-2 py-0.5 mr-1">
                <Text className="text-slate-400 text-xs">Reserve</Text>
              </View>
            )}
            {player.status === 'retired' && (
              <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, marginRight: 4 }}>
                <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '600' }}>🏅 Retired</Text>
              </View>
            )}
            {!roles.includes('coach') && !roles.includes('parent') && player.number && (
              <Text className="text-slate-400 text-sm">#{player.number}</Text>
            )}
          </View>
        </View>
        <ChevronRight size={18} color="#64748b" />
      </View>
    </Pressable>
  );
}

interface SwipeablePlayerManageCardProps extends PlayerManageCardProps {
  canDelete: boolean;
  onDelete: () => void;
}

function SwipeablePlayerManageCard({ canDelete, onDelete, ...cardProps }: SwipeablePlayerManageCardProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -60;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((event) => {
      if (event.translationX < DELETE_THRESHOLD) {
        translateX.value = withSpring(-80);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteButtonStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 40),
  }));

  if (!canDelete) {
    return (
      <Animated.View entering={FadeInDown.delay(cardProps.index * 50).springify()} className="mb-2">
        <PlayerManageCard {...cardProps} />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(cardProps.index * 50).springify()}>
      <View className="relative mb-2 overflow-hidden rounded-xl">
        <Animated.View
          style={[deleteButtonStyle]}
          className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 items-center justify-center rounded-r-xl"
        >
          <Pressable onPress={onDelete} className="flex-1 w-full items-center justify-center">
            <Trash2 size={24} color="white" />
            <Text className="text-white text-xs font-medium mt-1">Delete</Text>
          </Pressable>
        </Animated.View>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <PlayerManageCard {...cardProps} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminPlayersScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const userEmail = useTeamStore((s) => s.userEmail);
  const { isTablet, containerPadding } = useResponsive();

  const positions = SPORT_POSITIONS[teamSettings.sport];

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  const syncPlayerToCloud = (playerId: string) => {
    if (!activeTeamId) return;
    const state = useTeamStore.getState();
    const p = state.players.find((pl) => pl.id === playerId)
      ?? state.teams.find(t => t.id === activeTeamId)?.players.find((pl) => pl.id === playerId);
    if (p) pushPlayerToSupabase(p, activeTeamId).catch(syncError('sync'));
  };

  // Modal visibility
  const [isManagePlayersModalVisible, setIsManagePlayersModalVisible] = useState(false);
  const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
  const [isNewPlayerModalVisible, setIsNewPlayerModalVisible] = useState(false);
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [isRolesModalVisible, setIsRolesModalVisible] = useState(false);

  // Selected player edit state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showSelectedPlayerEndDatePicker, setShowSelectedPlayerEndDatePicker] = useState(false);
  const [editPlayerFirstName, setEditPlayerFirstName] = useState('');
  const [editPlayerLastName, setEditPlayerLastName] = useState('');
  const [editPlayerNumber, setEditPlayerNumber] = useState('');
  const [editPlayerPhone, setEditPlayerPhone] = useState('');
  const [editPlayerEmail, setEditPlayerEmail] = useState('');
  const [editPlayerPositions, setEditPlayerPositions] = useState<string[]>([]);
  const [editPlayerIsCoach, setEditPlayerIsCoach] = useState(false);
  const [editPlayerIsParent, setEditPlayerIsParent] = useState(false);

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
  const [newPlayerStatusEndDate, setNewPlayerStatusEndDate] = useState<string>('');
  const [showNewPlayerEndDatePicker, setShowNewPlayerEndDatePicker] = useState(false);
  const [newPlayerMemberRole, setNewPlayerMemberRole] = useState<'player' | 'reserve' | 'coach' | 'parent'>('player');

  // Invite modal state
  const [newlyCreatedPlayer, setNewlyCreatedPlayer] = useState<Player | null>(null);
  const [isReinviteMode, setIsReinviteMode] = useState(false);

  const selectedRoles = selectedPlayer?.roles ?? [];
  const playerToInvite = isReinviteMode ? selectedPlayer : newlyCreatedPlayer;

  // ─── Player Edit Handlers ───────────────────────────────────────────────────

  const openPlayerModal = (player: Player) => {
    setSelectedPlayer(player);
    setEditPlayerFirstName(player.firstName);
    setEditPlayerLastName(player.lastName);
    setEditPlayerNumber(player.number);
    setEditPlayerPhone(formatPhoneNumber(player.phone));
    setEditPlayerEmail(player.email || '');
    const playerPositions = player.positions || [player.position];
    setEditPlayerPositions(playerPositions.filter(p => p && p !== 'Coach' && p !== 'Parent'));
    setEditPlayerIsCoach(player.roles?.includes('coach') || player.position === 'Coach' || false);
    setEditPlayerIsParent(player.roles?.includes('parent') || player.position === 'Parent' || false);
    setShowSelectedPlayerEndDatePicker(false);
    setIsManagePlayersModalVisible(false);
    setTimeout(() => { setIsPlayerModalVisible(true); }, 300);
  };

  const handleSavePlayerName = () => {
    if (!selectedPlayer || !editPlayerFirstName?.trim() || !editPlayerLastName?.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const firstName = editPlayerFirstName.trim();
    const lastName = editPlayerLastName.trim();
    updatePlayer(selectedPlayer.id, { firstName, lastName });
    setSelectedPlayer({ ...selectedPlayer, firstName, lastName });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerNumber = () => {
    if (!selectedPlayer || !editPlayerNumber.trim()) return;
    const newNumber = editPlayerNumber.trim();
    const isCoachOrParent = selectedPlayer.roles?.includes('coach') || selectedPlayer.roles?.includes('parent');
    if (!isCoachOrParent) {
      const conflict = players.find((p) => p.id !== selectedPlayer.id && p.number === newNumber && !p.roles?.includes('coach') && !p.roles?.includes('parent'));
      if (conflict) {
        Alert.alert('Jersey # Taken', `#${newNumber} is already worn by ${conflict.firstName} ${conflict.lastName}.`);
        return;
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePlayer(selectedPlayer.id, { number: newNumber });
    setSelectedPlayer({ ...selectedPlayer, number: newNumber });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerPhone = () => {
    if (!selectedPlayer) return;
    const rawPhone = unformatPhone(editPlayerPhone);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePlayer(selectedPlayer.id, { phone: rawPhone || undefined });
    setSelectedPlayer({ ...selectedPlayer, phone: rawPhone || undefined });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerEmail = () => {
    if (!selectedPlayer) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updatePlayer(selectedPlayer.id, { email: editPlayerEmail.trim() || undefined });
    setSelectedPlayer({ ...selectedPlayer, email: editPlayerEmail.trim() || undefined });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleSavePlayerPositions = (newPositions: string[]) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePlayer(selectedPlayer.id, { position: newPositions[0], positions: newPositions });
    setSelectedPlayer({ ...selectedPlayer, position: newPositions[0], positions: newPositions });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleToggleEditCoach = () => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIsCoach = !editPlayerIsCoach;
    setEditPlayerIsCoach(newIsCoach);
    if (newIsCoach) setEditPlayerIsParent(false);
    const currentRoles = selectedPlayer.roles ?? [];
    let newRoles: PlayerRole[];
    if (newIsCoach) {
      newRoles = currentRoles.filter((r) => r !== 'parent');
      newRoles = newRoles.includes('coach') ? newRoles : [...newRoles, 'coach'];
      updatePlayer(selectedPlayer.id, { roles: newRoles, position: 'Coach', positions: ['Coach'], number: '' });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles, position: 'Coach', positions: ['Coach'], number: '' });
      setEditPlayerNumber('');
      setEditPlayerPositions(['Coach']);
    } else {
      newRoles = currentRoles.filter((r) => r !== 'coach');
      updatePlayer(selectedPlayer.id, { roles: newRoles, position: '', positions: [] });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles, position: '', positions: [] });
      setEditPlayerPositions([]);
    }
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleToggleEditParent = () => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newIsParent = !editPlayerIsParent;
    setEditPlayerIsParent(newIsParent);
    if (newIsParent) setEditPlayerIsCoach(false);
    const currentRoles = selectedPlayer.roles ?? [];
    let newRoles: PlayerRole[];
    if (newIsParent) {
      newRoles = currentRoles.filter((r) => r !== 'coach');
      newRoles = newRoles.includes('parent') ? newRoles : [...newRoles, 'parent'];
      updatePlayer(selectedPlayer.id, { roles: newRoles, position: 'Parent', positions: ['Parent'], number: '' });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles, position: 'Parent', positions: ['Parent'], number: '' });
      setEditPlayerNumber('');
      setEditPlayerPositions(['Parent']);
    } else {
      newRoles = currentRoles.filter((r) => r !== 'parent');
      updatePlayer(selectedPlayer.id, { roles: newRoles, position: '', positions: [] });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles, position: '', positions: [] });
      setEditPlayerPositions([]);
    }
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleUpdateStatus = (status: PlayerStatus) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePlayer(selectedPlayer.id, { status });
    setSelectedPlayer({ ...selectedPlayer, status });
    syncPlayerToCloud(selectedPlayer.id);
  };

  const handleToggleRole = (role: PlayerRole) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentRoles = selectedPlayer.roles ?? [];
    if (currentRoles.includes(role)) {
      if (role === 'admin') {
        const currentAdminCount = players.filter((p) => p.roles?.includes('admin')).length;
        const playerIsCurrentlyAdmin = selectedPlayer.roles?.includes('admin') ?? false;
        const wouldLeaveNoAdmins = currentAdminCount <= 1 && playerIsCurrentlyAdmin;
        if (wouldLeaveNoAdmins) {
          Alert.alert('Cannot Remove Admin', 'This is the only admin on the team. You must make another team member an admin before removing this admin role.', [{ text: 'OK' }]);
          return;
        }
        Alert.alert(
          'Remove Admin Role?',
          `Are you sure you want to remove admin privileges from ${getPlayerName(selectedPlayer)}?\n\nThey will no longer be able to:\n• Manage players and roles\n• Edit team settings\n• Create payment periods\n• Access the Admin panel`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove Admin',
              style: 'destructive',
              onPress: () => {
                const newRoles = currentRoles.filter((r) => r !== role);
                updatePlayer(selectedPlayer.id, { roles: newRoles });
                setSelectedPlayer({ ...selectedPlayer, roles: newRoles });
                syncPlayerToCloud(selectedPlayer.id);
              },
            },
          ]
        );
        return;
      }
      const newRoles = currentRoles.filter((r) => r !== role);
      updatePlayer(selectedPlayer.id, { roles: newRoles });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles });
    } else {
      const newRoles = [...currentRoles, role];
      updatePlayer(selectedPlayer.id, { roles: newRoles });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles });
    }
    syncPlayerToCloud(selectedPlayer.id);
  };

  // ─── New Player Handlers ────────────────────────────────────────────────────

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

    if (!newPlayerFirstName.trim()) { Alert.alert('Missing Info', 'Please enter a first name.'); return; }
    if (!newPlayerLastName.trim()) { Alert.alert('Missing Info', 'Please enter a last name.'); return; }
    if (!isCoachRole && !isParentRole && !newPlayerNumber.trim()) { Alert.alert('Missing Info', 'Please enter a jersey number.'); return; }
    if (!isCoachRole && !isParentRole && !rawPhone) { Alert.alert('Missing Info', 'Please enter a phone number.'); return; }
    if (!isCoachRole && !isParentRole && !newPlayerEmail.trim()) { Alert.alert('Missing Info', 'Please enter an email address.'); return; }
    if (!isCoachRole && !isParentRole && newPlayerPositions.length === 0) { Alert.alert('Missing Info', 'Please select at least one position.'); return; }

    if (rawPhone) {
      const phoneConflict = players.find((p) => p.phone?.replace(/\D/g, '') === rawPhone.replace(/\D/g, ''));
      if (phoneConflict) { Alert.alert('Already on Team', `${phoneConflict.firstName} ${phoneConflict.lastName} already has this phone number on this team.`); return; }
    }
    if (newPlayerEmail.trim()) {
      const emailConflict = players.find((p) => p.email?.toLowerCase() === newPlayerEmail.trim().toLowerCase());
      if (emailConflict) { Alert.alert('Already on Team', `${emailConflict.firstName} ${emailConflict.lastName} already has this email address on this team.`); return; }
    }
    if (!isCoachRole && !isParentRole && newPlayerNumber.trim()) {
      const jerseyConflict = players.find((p) => p.number === newPlayerNumber.trim() && !p.roles?.includes('coach') && !p.roles?.includes('parent'));
      if (jerseyConflict) { Alert.alert('Jersey # Taken', `#${newPlayerNumber.trim()} is already worn by ${jerseyConflict.firstName} ${jerseyConflict.lastName}. Please choose a different number.`); return; }
    }

    const roles: PlayerRole[] = newPlayerRoles.filter(r => r !== 'coach' && r !== 'parent');
    if (isCoachRole) roles.push('coach');
    if (isParentRole) roles.push('parent');
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
      roles,
      status: effectiveStatus,
      isInjured: newPlayerIsInjured,
      isSuspended: newPlayerIsSuspended,
      statusEndDate: (newPlayerIsInjured || newPlayerIsSuspended) ? (newPlayerStatusEndDate || undefined) : undefined,
    };

    addPlayer(newPlayer);

    if (activeTeamId) {
      pushPlayerToSupabase(newPlayer, activeTeamId).catch(syncError('sync'));
    }

    const teamId = activeTeamId || `team-${Date.now()}`;
    setTimeout(async () => {
      const state = useTeamStore.getState();
      let currentTeam = state.teams.find(t => t.id === activeTeamId);
      if (!currentTeam && state.teamName) {
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
      try {
        await createTeamInvitation({
          team_id: teamId,
          team_name: teamName,
          email: newPlayerEmail.trim() || undefined,
          phone: rawPhone || undefined,
          first_name: newPlayerFirstName.trim(),
          last_name: newPlayerLastName.trim(),
          jersey_number: (isCoachRole || isParentRole) ? undefined : newPlayerNumber.trim(),
          position: isCoachRole ? 'Coach' : (isParentRole ? 'Parent' : newPlayerPositions[0]),
          roles,
          invited_by_email: userEmail || undefined,
          team_data: currentTeam,
        });
      } catch (err) {
        console.error('ADMIN: Failed to create Supabase invitation:', err);
      }
    }, 100);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsNewPlayerModalVisible(false);
    resetNewPlayerForm();
    setNewlyCreatedPlayer({ ...newPlayer });
    setIsInviteModalVisible(true);
  };

  // ─── Invite Handlers ────────────────────────────────────────────────────────

  const APP_STORE_URL = 'https://apps.apple.com/app/your-app-id';

  const getInviteMessage = (method: 'sms' | 'email') => {
    const playerName = playerToInvite ? getPlayerName(playerToInvite) : '';
    const contactInfo = method === 'sms'
      ? playerToInvite?.phone ? `\n\nLog in with your phone number: ${formatPhoneNumber(playerToInvite.phone)}` : ''
      : playerToInvite?.email ? `\n\nLog in with your email: ${playerToInvite.email}` : '';
    return `Hey ${playerName}!\n\nYou've been added to ${teamName}! Download the app and log in using your info to view the schedule, check in for games, and stay connected with the team.\n\nDownload here: ${APP_STORE_URL}${contactInfo}\n\nYour jersey number is #${playerToInvite?.number}\n\nSee you at the next game!`;
  };

  const handleSendTextInvite = () => {
    if (!playerToInvite?.phone) { Alert.alert('No Phone Number', 'This player does not have a phone number.'); return; }
    const message = encodeURIComponent(getInviteMessage('sms'));
    const smsUrl = Platform.select({
      ios: `sms:${playerToInvite.phone}&body=${message}`,
      android: `sms:${playerToInvite.phone}?body=${message}`,
      default: `sms:${playerToInvite.phone}?body=${message}`,
    });
    Linking.openURL(smsUrl!).catch(() => Alert.alert('Error', 'Could not open messaging app'));
    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
    setIsReinviteMode(false);
  };

  const handleSendEmailInvite = async () => {
    if (!playerToInvite?.email) { Alert.alert('No Email', 'This player does not have an email address.'); return; }
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;
      const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseAnonKey}` },
        body: JSON.stringify({
          to: playerToInvite.email,
          teamName,
          firstName: playerToInvite.firstName,
          userEmail: playerToInvite.email,
          jerseyNumber: playerToInvite.number || '00',
          appLink: 'https://apps.apple.com/app/id6740043565',
        }),
      });
      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Email Sent', `Invite email sent to ${playerToInvite ? getPlayerName(playerToInvite) : 'player'}!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).error || 'Failed to send email');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send email. Please try again later.');
    }
    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
    setIsReinviteMode(false);
  };

  const handleSkipInvite = () => {
    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
    setIsReinviteMode(false);
  };

  const handleReinvitePlayer = () => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsReinviteMode(true);
    setIsPlayerModalVisible(false);
    setTimeout(() => { setIsInviteModalVisible(true); }, 300);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-2 pb-4 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-slate-800/80 items-center justify-center">
            <ChevronLeft size={22} color="#94a3b8" />
          </Pressable>
          <Text className="text-white text-2xl font-bold flex-1">Roster & Roles</Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          {/* Team Structure Section */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
              Roster
            </Text>

            {/* Manage Team */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsManagePlayersModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <Users size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Manage Team</Text>
                    <Text className="text-slate-400 text-sm">{players.length} members on roster</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            {/* Add Player */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNewPlayerPositions([]);
                setIsNewPlayerModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-green-500/20 p-2 rounded-full">
                    <UserPlus size={20} color="#22c55e" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Add Player</Text>
                    <Text className="text-slate-400 text-sm">Add a new member to the roster</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
          </Animated.View>

          {/* Roles Section */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Roles & Settings
            </Text>

            {/* Manage Roles */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsRolesModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <UserCog size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Manage Roles</Text>
                    <Text className="text-slate-400 text-sm">
                      {(teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent']).length} roles enabled
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            {/* Lineup Management Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <ListOrdered size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Lineup Management</Text>
                    <Text className="text-slate-400 text-sm">
                      {teamSettings.sport === 'hockey'
                        ? 'Set forward, defense, and goalie lines'
                        : teamSettings.sport === 'basketball'
                          ? 'Set starting five and rotations'
                          : teamSettings.sport === 'baseball'
                            ? 'Set batting order and field positions'
                            : 'Set formation and starting lineup'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showLineups !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showLineups: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Softball Lineup note */}
            {teamSettings.sport === 'softball' && teamSettings.showLineups !== false && (
              <View className="bg-slate-700/30 rounded-xl p-3 mb-3">
                <Text className="text-slate-400 text-xs">
                  Softball lineup includes batting order and field positions.
                </Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* ─── Manage Team Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={isManagePlayersModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsManagePlayersModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Manage Team</Text>
              <View className="flex-row items-center">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setNewPlayerPositions([]);
                    setIsManagePlayersModalVisible(false);
                    setTimeout(() => { setIsNewPlayerModalVisible(true); }, 300);
                  }}
                  className="mr-3"
                >
                  <UserPlus size={22} color="#22c55e" />
                </Pressable>
                <Pressable onPress={() => setIsManagePlayersModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>
            </View>
            <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {players.map((player, index) => (
                <SwipeablePlayerManageCard
                  key={player.id}
                  player={player}
                  index={index}
                  onPress={() => openPlayerModal(player)}
                  isCurrentUser={player.id === currentPlayerId}
                  canDelete={player.id !== currentPlayerId}
                  onDelete={() => {
                    Alert.alert(
                      'Delete Player',
                      `Are you sure you want to remove ${getPlayerName(player)} from the roster? This cannot be undone.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: () => {
                            removePlayer(player.id);
                            deletePlayerFromSupabase(player.id).catch(syncError('sync'));
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          },
                        },
                      ]
                    );
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Player Edit Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={isPlayerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsPlayerModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Edit Player</Text>
              <Pressable onPress={() => setIsPlayerModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {selectedPlayer && (
              <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Name Row */}
                <View className="flex-row mb-3">
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

                {/* Jersey Number */}
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

                {/* Positions */}
                {!editPlayerIsCoach && !editPlayerIsParent && (
                  <View className="mb-3">
                    <Text className="text-slate-400 text-sm mb-0.5">Positions<Text className="text-red-400">*</Text></Text>
                    <Text className="text-slate-500 text-xs mb-1.5">Tap to select multiple positions</Text>
                    {(() => {
                      const posCount = positions.length;
                      const splitAt = posCount <= 6 ? posCount : Math.ceil(posCount / 2);
                      const row1 = positions.slice(0, splitAt);
                      const row2 = positions.slice(splitAt);
                      const renderRow = (rowPositions: string[], isLastRow: boolean) => (
                        <View className={cn('flex-row', !isLastRow && 'mb-2')} style={{ gap: 6 }}>
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
                                    if (newPositions.length > 0) handleSavePlayerPositions(newPositions);
                                  } else {
                                    const newPositions = [...editPlayerPositions, pos];
                                    setEditPlayerPositions(newPositions);
                                    handleSavePlayerPositions(newPositions);
                                  }
                                }}
                                className={cn('flex-1 py-3 rounded-xl items-center border', isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-800 border-slate-700')}
                              >
                                <Text className={cn('font-semibold', isSelected ? 'text-white' : 'text-slate-400')}>{pos}</Text>
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
                      className={cn('flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center', selectedPlayer.status === 'active' ? 'bg-green-500' : 'bg-slate-800')}
                    >
                      {selectedPlayer.status === 'active' && <Check size={16} color="white" />}
                      <Text className={cn('font-semibold ml-1', selectedPlayer.status === 'active' ? 'text-white' : 'text-slate-400')}>Active</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleUpdateStatus('reserve')}
                      className={cn('flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center', selectedPlayer.status === 'reserve' ? 'bg-slate-600' : 'bg-slate-800')}
                    >
                      {selectedPlayer.status === 'reserve' && <Check size={16} color="white" />}
                      <Text className={cn('font-semibold ml-1', selectedPlayer.status === 'reserve' ? 'text-white' : 'text-slate-400')}>Reserve</Text>
                    </Pressable>
                  </View>
                  {/* Retire row */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      const next = selectedPlayer.status === 'retired' ? 'active' : 'retired';
                      handleUpdateStatus(next);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 12,
                      borderRadius: 12,
                      marginBottom: 8,
                      backgroundColor: selectedPlayer.status === 'retired' ? 'rgba(251,191,36,0.2)' : 'rgba(30,41,59,1)',
                      borderWidth: 1,
                      borderColor: selectedPlayer.status === 'retired' ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <Text style={{ fontSize: 14, marginRight: 6 }}>🏅</Text>
                    <Text style={{ fontWeight: '600', color: selectedPlayer.status === 'retired' ? '#fbbf24' : '#64748b', fontSize: 14 }}>
                      {selectedPlayer.status === 'retired' ? 'Retired — Tap to Reactivate' : 'Retire Player'}
                    </Text>
                  </Pressable>
                  {selectedPlayer.status === 'retired' && (
                    <View style={{ backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                      <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 17 }}>
                        Retired players are hidden from rosters and game invites. Their stats and season history are preserved permanently.
                      </Text>
                    </View>
                  )}
                  <View className="flex-row">
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const newValue = !selectedPlayer.isInjured;
                        updatePlayer(selectedPlayer.id, { isInjured: newValue });
                        setSelectedPlayer({ ...selectedPlayer, isInjured: newValue });
                        syncPlayerToCloud(selectedPlayer.id);
                      }}
                      className={cn('flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center', selectedPlayer.isInjured ? 'bg-red-500' : 'bg-slate-800')}
                    >
                      <Text className={cn('text-lg font-black mr-1', selectedPlayer.isInjured ? 'text-white' : 'text-red-500')}>+</Text>
                      <Text className={cn('font-semibold', selectedPlayer.isInjured ? 'text-white' : 'text-slate-400')}>Injured</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const newValue = !selectedPlayer.isSuspended;
                        updatePlayer(selectedPlayer.id, { isSuspended: newValue });
                        setSelectedPlayer({ ...selectedPlayer, isSuspended: newValue });
                        syncPlayerToCloud(selectedPlayer.id);
                      }}
                      className={cn('flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center', selectedPlayer.isSuspended ? 'bg-red-600' : 'bg-slate-800')}
                    >
                      <Text className={cn('font-bold mr-1', selectedPlayer.isSuspended ? 'text-white' : 'text-red-500')} style={{ fontSize: 12 }}>SUS</Text>
                      <Text className={cn('font-semibold', selectedPlayer.isSuspended ? 'text-white' : 'text-slate-400')}>Suspended</Text>
                    </Pressable>
                  </View>

                  {(selectedPlayer.isInjured || selectedPlayer.isSuspended) && (
                    <View className="mt-3 bg-amber-500/10 rounded-xl p-3 border border-amber-500/20">
                      <Text className="text-amber-400 text-sm font-medium mb-2">End Date (Auto-mark OUT for games)</Text>
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowSelectedPlayerEndDatePicker(true); }}
                        className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3"
                      >
                        <Calendar size={18} color="#f59e0b" />
                        <Text className="text-white ml-3 flex-1">
                          {selectedPlayer.statusEndDate && selectedPlayer.statusEndDate.length >= 10
                            ? format(parseISO(selectedPlayer.statusEndDate), 'MMM d, yyyy')
                            : 'Select end date'}
                        </Text>
                        {selectedPlayer.statusEndDate && (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              updatePlayer(selectedPlayer.id, { statusEndDate: undefined });
                              setSelectedPlayer({ ...selectedPlayer, statusEndDate: undefined });
                              syncPlayerToCloud(selectedPlayer.id);
                            }}
                            hitSlop={8}
                          >
                            <X size={16} color="#94a3b8" />
                          </Pressable>
                        )}
                      </Pressable>
                      <Text className="text-slate-500 text-xs mt-2">Games on or before this date will have this player auto-marked as OUT</Text>
                      {showSelectedPlayerEndDatePicker && (
                        <View className="mt-3">
                          <DateTimePicker
                            value={selectedPlayer.statusEndDate && selectedPlayer.statusEndDate.length >= 10 ? parseISO(selectedPlayer.statusEndDate) : new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') setShowSelectedPlayerEndDatePicker(false);
                              if (selectedDate) {
                                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                                updatePlayer(selectedPlayer.id, { statusEndDate: dateStr });
                                setSelectedPlayer({ ...selectedPlayer, statusEndDate: dateStr });
                                syncPlayerToCloud(selectedPlayer.id);
                              }
                            }}
                            minimumDate={new Date()}
                            themeVariant="dark"
                          />
                          {Platform.OS === 'ios' && (
                            <Pressable onPress={() => setShowSelectedPlayerEndDatePicker(false)} className="mt-2 bg-cyan-500 rounded-xl py-2">
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
                        <Pressable
                          onPress={() => handleToggleRole('captain')}
                          className={cn('flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center', selectedRoles.includes('captain') ? 'bg-amber-500' : 'bg-slate-800')}
                        >
                          <View className="w-5 h-5 rounded-full bg-amber-500/30 items-center justify-center mb-1">
                            <Text className={cn('text-xs font-black', selectedRoles.includes('captain') ? 'text-white' : 'text-amber-500')}>C</Text>
                          </View>
                          <Text className={cn('font-semibold text-sm', selectedRoles.includes('captain') ? 'text-white' : 'text-slate-400')}>Captain</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleToggleRole('admin')}
                          className={cn('flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center', selectedRoles.includes('admin') ? 'bg-purple-500' : 'bg-slate-800')}
                        >
                          <Shield size={16} color={selectedRoles.includes('admin') ? 'white' : '#a78bfa'} />
                          <Text className={cn('font-semibold text-sm mt-1', selectedRoles.includes('admin') ? 'text-white' : 'text-slate-400')}>Admin</Text>
                        </Pressable>
                        {showCoach && (
                          <Pressable
                            onPress={handleToggleEditCoach}
                            className={cn('flex-1 py-3 px-2 rounded-xl items-center justify-center', showParent && 'mr-2', editPlayerIsCoach ? 'bg-cyan-500' : 'bg-slate-800')}
                          >
                            <UserCog size={16} color={editPlayerIsCoach ? 'white' : '#67e8f9'} />
                            <Text className={cn('font-semibold text-sm mt-1', editPlayerIsCoach ? 'text-white' : 'text-slate-400')}>Coach</Text>
                          </Pressable>
                        )}
                        {showParent && (
                          <Pressable
                            onPress={handleToggleEditParent}
                            className={cn('flex-1 py-3 px-2 rounded-xl items-center justify-center', editPlayerIsParent ? 'bg-pink-500' : 'bg-slate-800')}
                          >
                            <ParentChildIcon size={16} color={editPlayerIsParent ? 'white' : '#ec4899'} />
                            <Text className={cn('font-semibold text-sm mt-1', editPlayerIsParent ? 'text-white' : 'text-slate-400')}>Parent/Guardian</Text>
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

                {/* Re-send Invite */}
                {(selectedPlayer?.phone || selectedPlayer?.email) && (
                  <View className="mb-6 mt-3">
                    <Pressable
                      onPress={handleReinvitePlayer}
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

      {/* ─── Add Player Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={isNewPlayerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setIsNewPlayerModalVisible(false); resetNewPlayerForm(); }}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Add Player</Text>
              <View className="flex-row items-center">
                <Pressable onPress={handleCreatePlayer} className="mr-3">
                  <Text className="text-cyan-400 font-semibold">Create</Text>
                </Pressable>
                <Pressable onPress={() => { setIsNewPlayerModalVisible(false); resetNewPlayerForm(); }} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>
            </View>

            <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Name Row */}
              <View className="flex-row mb-3">
                <View className="flex-1 mr-2">
                  <Text className="text-slate-400 text-sm mb-1">First Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={newPlayerFirstName}
                    onChangeText={setNewPlayerFirstName}
                    placeholder="First"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    returnKeyType="next"
                  />
                </View>
                <View className="flex-1 ml-2">
                  <Text className="text-slate-400 text-sm mb-1">Last Name<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={newPlayerLastName}
                    onChangeText={setNewPlayerLastName}
                    placeholder="Last"
                    placeholderTextColor="#64748b"
                    autoCapitalize="words"
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Member Type */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Member Type<Text className="text-red-400">*</Text></Text>
                {(() => {
                  const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                  const showReserve = enabledRoles.includes('reserve');
                  const showCoach = enabledRoles.includes('coach');
                  const showParent = enabledRoles.includes('parent');
                  return (
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                      <Pressable
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewPlayerMemberRole('player'); }}
                        className={cn('flex-1 py-3 px-2 rounded-xl items-center min-w-16', newPlayerMemberRole === 'player' ? 'bg-green-500' : 'bg-slate-800')}
                      >
                        <User size={16} color={newPlayerMemberRole === 'player' ? 'white' : '#22c55e'} />
                        <Text className={cn('font-semibold text-sm mt-1', newPlayerMemberRole === 'player' ? 'text-white' : 'text-slate-400')}>Player</Text>
                      </Pressable>
                      {showReserve && (
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewPlayerMemberRole('reserve'); }}
                          className={cn('flex-1 py-3 px-2 rounded-xl items-center min-w-16', newPlayerMemberRole === 'reserve' ? 'bg-slate-600' : 'bg-slate-800')}
                        >
                          <UserMinus size={16} color={newPlayerMemberRole === 'reserve' ? 'white' : '#94a3b8'} />
                          <Text className={cn('font-semibold text-sm mt-1', newPlayerMemberRole === 'reserve' ? 'text-white' : 'text-slate-400')}>Reserve</Text>
                        </Pressable>
                      )}
                      {showCoach && (
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewPlayerMemberRole('coach'); }}
                          className={cn('flex-1 py-3 px-2 rounded-xl items-center min-w-16', newPlayerMemberRole === 'coach' ? 'bg-cyan-500' : 'bg-slate-800')}
                        >
                          <UserCog size={16} color={newPlayerMemberRole === 'coach' ? 'white' : '#67e8f9'} />
                          <Text className={cn('font-semibold text-sm mt-1', newPlayerMemberRole === 'coach' ? 'text-white' : 'text-slate-400')}>Coach</Text>
                        </Pressable>
                      )}
                      {showParent && (
                        <Pressable
                          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNewPlayerMemberRole('parent'); }}
                          className={cn('flex-1 py-3 px-2 rounded-xl items-center min-w-16', newPlayerMemberRole === 'parent' ? 'bg-pink-500' : 'bg-slate-800')}
                        >
                          <ParentChildIcon size={16} color={newPlayerMemberRole === 'parent' ? 'white' : '#ec4899'} />
                          <Text className={cn('font-semibold text-sm mt-1', newPlayerMemberRole === 'parent' ? 'text-white' : 'text-slate-400')}>Parent</Text>
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

              {/* Jersey Number (players only) */}
              {newPlayerMemberRole !== 'coach' && newPlayerMemberRole !== 'parent' && (
                <View className="mb-3">
                  <Text className="text-slate-400 text-sm mb-1">Jersey Number<Text className="text-red-400">*</Text></Text>
                  <TextInput
                    value={newPlayerNumber}
                    onChangeText={setNewPlayerNumber}
                    placeholder="00"
                    placeholderTextColor="#64748b"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg border border-slate-700"
                    style={{ width: 100 }}
                  />
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

              {/* Positions (players only) */}
              {newPlayerMemberRole !== 'coach' && newPlayerMemberRole !== 'parent' && (
                <View className="mb-4">
                  <Text className="text-slate-400 text-sm mb-0.5">Positions<Text className="text-red-400">*</Text></Text>
                  <Text className="text-slate-500 text-xs mb-2">Tap to select multiple positions</Text>
                  {(() => {
                    const posCount = positions.length;
                    const splitAt = posCount <= 6 ? posCount : Math.ceil(posCount / 2);
                    const row1 = positions.slice(0, splitAt);
                    const row2 = positions.slice(splitAt);
                    const renderRow = (rowPositions: string[], isLastRow: boolean) => (
                      <View className={cn('flex-row', !isLastRow && 'mb-2')} style={{ gap: 6 }}>
                        {rowPositions.map((pos) => {
                          const isSelected = newPlayerPositions.includes(pos);
                          return (
                            <Pressable
                              key={pos}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setNewPlayerPositions(isSelected ? newPlayerPositions.filter(p => p !== pos) : [...newPlayerPositions, pos]);
                              }}
                              className={cn('flex-1 py-3 rounded-xl items-center border', isSelected ? 'bg-cyan-500 border-cyan-400' : 'bg-slate-800 border-slate-700')}
                            >
                              <Text className={cn('font-semibold', isSelected ? 'text-white' : 'text-slate-400')}>{pos}</Text>
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
              )}

              <Text className="text-slate-500 text-xs mb-6"><Text className="text-red-400">*</Text> Required</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Send Invite Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={isInviteModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleSkipInvite}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            <View className="items-center mb-6">
              <View className={`w-16 h-16 rounded-full ${isReinviteMode ? 'bg-cyan-500/20' : 'bg-green-500/20'} items-center justify-center mb-4`}>
                <Send size={32} color={isReinviteMode ? '#22d3ee' : '#22c55e'} />
              </View>
              <Text className="text-white text-xl font-bold text-center">
                {isReinviteMode ? 'Re-send Invite' : 'Player Added!'}
              </Text>
              <Text className="text-slate-400 text-center mt-2">
                {isReinviteMode
                  ? `Send ${playerToInvite ? getPlayerName(playerToInvite) : ''} another invite?`
                  : `Send ${playerToInvite ? getPlayerName(playerToInvite) : ''} an invite to register and join the team?`}
              </Text>
            </View>
            <View>
              {playerToInvite?.phone && (
                <Pressable onPress={handleSendTextInvite} className="flex-row items-center justify-center bg-cyan-500 rounded-xl py-4 mb-3 active:bg-cyan-600">
                  <MessageSquare size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Text Message</Text>
                </Pressable>
              )}
              {playerToInvite?.email && (
                <Pressable onPress={handleSendEmailInvite} className="flex-row items-center justify-center bg-purple-500 rounded-xl py-4 mb-3 active:bg-purple-600">
                  <Mail size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Email</Text>
                </Pressable>
              )}
              <Pressable onPress={handleSkipInvite} className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600">
                <Text className="text-slate-300 font-semibold">Skip for Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Manage Roles Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={isRolesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsRolesModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Manage Roles</Text>
              <Pressable onPress={() => setIsRolesModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-4">
                Select which roles are available when adding or editing players. Disabled roles will be hidden from selection.
              </Text>
              {[
                { id: 'player' as const, label: 'Player', description: 'Active team member', icon: <User size={20} color="#22c55e" />, bgColor: 'bg-green-500', iconBg: 'bg-green-500/20' },
                { id: 'reserve' as const, label: 'Reserve', description: 'Backup/substitute player', icon: <UserMinus size={20} color="#94a3b8" />, bgColor: 'bg-slate-600', iconBg: 'bg-slate-600/20' },
                { id: 'coach' as const, label: 'Coach', description: 'Team coach (no jersey number needed)', icon: <UserCog size={20} color="#67e8f9" />, bgColor: 'bg-cyan-500', iconBg: 'bg-cyan-500/20' },
                { id: 'parent' as const, label: 'Parent/Guardian', description: 'Parent/guardian of a player', icon: <ParentChildIcon size={20} color="#ec4899" />, bgColor: 'bg-pink-500', iconBg: 'bg-pink-500/20' },
              ].map((role) => {
                const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                const isEnabled = enabledRoles.includes(role.id);
                const isRequired = role.id === 'player';
                return (
                  <Pressable
                    key={role.id}
                    onPress={() => {
                      if (isRequired) return;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const currentRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                      if (isEnabled) {
                        setTeamSettingsAndSync({ enabledRoles: currentRoles.filter(r => r !== role.id) });
                      } else {
                        setTeamSettingsAndSync({ enabledRoles: [...currentRoles, role.id] });
                      }
                    }}
                    className={cn('flex-row items-center p-4 rounded-xl mb-3 border', isEnabled ? `${role.iconBg} border-slate-600` : 'bg-slate-800/50 border-slate-700/50')}
                  >
                    <View className={cn('p-2 rounded-full', role.iconBg)}>{role.icon}</View>
                    <View className="flex-1 ml-3">
                      <Text className={cn('font-semibold', isEnabled ? 'text-white' : 'text-slate-500')}>
                        {role.label}{isRequired && <Text className="text-slate-500 font-normal"> (Required)</Text>}
                      </Text>
                      <Text className={cn('text-sm', isEnabled ? 'text-slate-400' : 'text-slate-600')}>{role.description}</Text>
                    </View>
                    <View className={cn('w-6 h-6 rounded-full border-2 items-center justify-center', isEnabled ? `${role.bgColor} border-transparent` : 'border-slate-600')}>
                      {isEnabled && <Check size={14} color="white" />}
                    </View>
                  </Pressable>
                );
              })}
              <View className="bg-slate-800/50 rounded-xl p-4 mt-4">
                <Text className="text-slate-400 text-sm">
                  <Text className="text-purple-400 font-semibold">Tip:</Text> Disable roles your team doesn't use to simplify player management. The "Player" role is always required.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
