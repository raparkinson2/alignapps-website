import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform, Switch, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Shield,
  Settings,
  Users,
  X,
  Check,
  Plus,
  Trash2,
  Palette,
  ChevronRight,
  UserCog,
  Mail,
  Phone,
  ImageIcon,
  Camera,
  MessageSquare,
  Send,
  UserPlus,
  BarChart3,
  DollarSign,
  AlertTriangle,
  Beer,
  Edit3,
  ListOrdered,
  User,
  UserMinus,
  Heart,
  Calendar,
  RefreshCw,
  Trophy,
  Archive,
  Bell,
  CreditCard,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import {
  useTeamStore,
  Player,
  Sport,
  SPORT_NAMES,
  SPORT_POSITIONS,
  SPORT_POSITION_NAMES,
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
import { sendPushToPlayers, registerForPushNotificationsAsync } from '@/lib/notifications';
import { uploadPhotoToStorage } from '@/lib/photo-storage';
import { BACKEND_URL } from '@/lib/config';

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
              <View className="flex-row items-center bg-purple-500/20 rounded-full px-2 py-0.5 mr-2">
                <Shield size={10} color="#a78bfa" />
                <Text className="text-purple-400 text-xs ml-1">Admin</Text>
              </View>
            )}
            {roles.includes('captain') && (
              <View className="flex-row items-center bg-amber-500/20 rounded-full px-2 py-0.5 mr-2">
                <View className="w-3 h-3 rounded-full bg-amber-500/30 items-center justify-center">
                  <Text className="text-amber-500 text-[8px] font-black">C</Text>
                </View>
                <Text className="text-amber-400 text-xs ml-1">Captain</Text>
              </View>
            )}
            <View className={cn(
              'rounded-full px-2 py-0.5',
              player.status === 'active' ? 'bg-green-500/20' : 'bg-slate-600/50'
            )}>
              <Text className={cn(
                'text-xs',
                player.status === 'active' ? 'text-green-400' : 'text-slate-400'
              )}>
                {player.status === 'active' ? 'Active' : 'Reserve'}
              </Text>
            </View>
          </View>
        </View>
        <ChevronRight size={20} color="#64748b" />
      </View>
    </Pressable>
  );
}

interface SwipeablePlayerManageCardProps extends PlayerManageCardProps {
  onDelete: () => void;
  canDelete: boolean;
}

function SwipeablePlayerManageCard({
  onDelete,
  canDelete,
  ...cardProps
}: SwipeablePlayerManageCardProps) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const handleDelete = () => {
    translateX.value = withSpring(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  };

  const panGesture = Gesture.Pan()
    .enabled(canDelete)
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
        {/* Delete button behind */}
        <Animated.View
          style={[deleteButtonStyle]}
          className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 items-center justify-center rounded-r-xl"
        >
          <Pressable
            onPress={handleDelete}
            className="flex-1 w-full items-center justify-center"
          >
            <Trash2 size={24} color="white" />
            <Text className="text-white text-xs font-medium mt-1">Delete</Text>
          </Pressable>
        </Animated.View>

        {/* Swipeable row */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            <PlayerManageCard {...cardProps} />
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const setTeamName = useTeamStore((s) => s.setTeamName);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const isAdmin = useTeamStore((s) => s.isAdmin);
  const resetAllData = useTeamStore((s) => s.resetAllData);
  const deleteCurrentTeam = useTeamStore((s) => s.deleteCurrentTeam);
  const games = useTeamStore((s) => s.games);
  const updateGame = useTeamStore((s) => s.updateGame);
  const archiveAndStartNewSeason = useTeamStore((s) => s.archiveAndStartNewSeason);
  const setCurrentSeasonName = useTeamStore((s) => s.setCurrentSeasonName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const userEmail = useTeamStore((s) => s.userEmail);

  // Helper to sync a player to Supabase after any local update
  const syncPlayerToCloud = (playerId: string) => {
    if (!activeTeamId) return;
    const state = useTeamStore.getState();
    const p = state.players.find((pl) => pl.id === playerId)
      ?? state.teams.find(t => t.id === activeTeamId)?.players.find((pl) => pl.id === playerId);
    if (p) pushPlayerToSupabase(p, activeTeamId).catch(console.error);
  };

  // Wrapper around setTeamSettings that also syncs to Supabase
  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      // Use a small timeout so store has updated before we read it
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
      }, 50);
    }
  };

  // Wrapper around setTeamName that also syncs to Supabase
  const setTeamNameAndSync = (name: string) => {
    setTeamName(name);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, name, s.teamSettings).catch(console.error);
      }, 50);
    }
  };

  const positions = SPORT_POSITIONS[teamSettings.sport];

  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
  const [showSelectedPlayerEndDatePicker, setShowSelectedPlayerEndDatePicker] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isJerseyModalVisible, setIsJerseyModalVisible] = useState(false);
  const [isRolesModalVisible, setIsRolesModalVisible] = useState(false);
  const [isManagePlayersModalVisible, setIsManagePlayersModalVisible] = useState(false);

  // Player edit form
  const [editPlayerFirstName, setEditPlayerFirstName] = useState('');
  const [editPlayerLastName, setEditPlayerLastName] = useState('');
  const [editPlayerNumber, setEditPlayerNumber] = useState('');
  const [editPlayerPhone, setEditPlayerPhone] = useState('');
  const [editPlayerEmail, setEditPlayerEmail] = useState('');
  const [editPlayerPositions, setEditPlayerPositions] = useState<string[]>([]);
  const [editPlayerIsCoach, setEditPlayerIsCoach] = useState(false);
  const [editPlayerIsParent, setEditPlayerIsParent] = useState(false);

  // New player form
  const [isNewPlayerModalVisible, setIsNewPlayerModalVisible] = useState(false);
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
  const [isReinviteMode, setIsReinviteMode] = useState(false);

  // Sport change confirmation modal
  const [isSportChangeModalVisible, setIsSportChangeModalVisible] = useState(false);
  const [pendingSport, setPendingSport] = useState<Sport | null>(null);

  // Erase all data confirmation modal
  const [isEraseDataModalVisible, setIsEraseDataModalVisible] = useState(false);
  const [isEraseDataMenuModalVisible, setIsEraseDataMenuModalVisible] = useState(false);

  // Delete team confirmation modal
  const [isDeleteTeamModalVisible, setIsDeleteTeamModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Season Management modal
  const [isEndSeasonModalVisible, setIsEndSeasonModalVisible] = useState(false);
  const [isRefreshmentModalVisible, setIsRefreshmentModalVisible] = useState(false);
  const [isTeamStatsModalVisible, setIsTeamStatsModalVisible] = useState(false);
  const [endSeasonName, setEndSeasonName] = useState(teamSettings.currentSeasonName || '');
  const [endSeasonStep, setEndSeasonStep] = useState<'name' | 'confirm'>('name');

  // Responsive layout for iPad
  const { isTablet, columns, containerPadding } = useResponsive();

  // Jersey color form
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#ffffff');
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('#ffffff');

  // Team name form
  const [editTeamName, setEditTeamName] = useState(teamName);

  // Email Team modal state
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Stripe Connect state (loading used on stripe-setup screen via router)
  const [isStripeConnectLoading] = useState(false);
  const _ = isStripeConnectLoading;

  if (!isAdmin()) {
    return (
      <View className="flex-1 bg-slate-900 items-center justify-center px-8">
        <Shield size={64} color="#64748b" />
        <Text className="text-white text-xl font-bold mt-4 text-center">
          Admin Access Required
        </Text>
        <Text className="text-slate-400 text-center mt-2">
          You need admin privileges to access this panel.
        </Text>
      </View>
    );
  }

  const openPlayerModal = (player: Player) => {
    setSelectedPlayer(player);
    setEditPlayerFirstName(player.firstName);
    setEditPlayerLastName(player.lastName);
    setEditPlayerNumber(player.number);
    setEditPlayerPhone(formatPhoneNumber(player.phone));
    setEditPlayerEmail(player.email || '');
    // Set positions from player data (keep empty if none - user must select)
    const playerPositions = player.positions || [player.position];
    setEditPlayerPositions(playerPositions.filter(p => p && p !== 'Coach' && p !== 'Parent'));
    // Set coach/parent status
    setEditPlayerIsCoach(player.roles?.includes('coach') || player.position === 'Coach' || false);
    setEditPlayerIsParent(player.roles?.includes('parent') || player.position === 'Parent' || false);
    // Reset date picker state
    setShowSelectedPlayerEndDatePicker(false);
    // Close manage players modal first, then open player edit modal
    setIsManagePlayersModalVisible(false);
    setTimeout(() => {
      setIsPlayerModalVisible(true);
    }, 300);
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
      setSelectedPlayer({
        ...selectedPlayer,
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
      setSelectedPlayer({
        ...selectedPlayer,
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
      setSelectedPlayer({
        ...selectedPlayer,
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
      setSelectedPlayer({
        ...selectedPlayer,
        roles: newRoles,
        position: '',
        positions: []
      });
      setEditPlayerPositions([]);
    }
    syncPlayerToCloud(selectedPlayer.id);
  };

  // New Player Functions
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
    setIsNewPlayerModalVisible(false);
    resetNewPlayerForm();

    // Show invite modal since player has phone and email (both required now)
    setNewlyCreatedPlayer({ ...newPlayer });
    setIsInviteModalVisible(true);
  };

  // Placeholder for App Store URL - will be updated once app is published
  const APP_STORE_URL = 'https://apps.apple.com/app/your-app-id';

  // Get the player to invite (either newly created or selected for re-invite)
  const playerToInvite = isReinviteMode ? selectedPlayer : newlyCreatedPlayer;

  const getInviteMessage = (method: 'sms' | 'email') => {
    const playerName = playerToInvite ? getPlayerName(playerToInvite) : '';
    const contactInfo = method === 'sms'
      ? playerToInvite?.phone
        ? `\n\nLog in with your phone number: ${formatPhoneNumber(playerToInvite.phone)}`
        : ''
      : playerToInvite?.email
        ? `\n\nLog in with your email: ${playerToInvite.email}`
        : '';

    return `Hey ${playerName}!\n\nYou've been added to ${teamName}! Download the app and log in using your info to view the schedule, check in for games, and stay connected with the team.\n\nDownload here: ${APP_STORE_URL}${contactInfo}\n\nYour jersey number is #${playerToInvite?.number}\n\nSee you at the next game!`;
  };

  const handleSendTextInvite = () => {
    if (!playerToInvite?.phone) {
      Alert.alert('No Phone Number', 'This player does not have a phone number.');
      return;
    }

    const message = encodeURIComponent(getInviteMessage('sms'));
    const phoneNumber = playerToInvite.phone;

    const smsUrl = Platform.select({
      ios: `sms:${phoneNumber}&body=${message}`,
      android: `sms:${phoneNumber}?body=${message}`,
      default: `sms:${phoneNumber}?body=${message}`,
    });

    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Could not open messaging app');
    });

    setIsInviteModalVisible(false);
    setNewlyCreatedPlayer(null);
    setIsReinviteMode(false);
  };

  const handleSendEmailInvite = async () => {
    if (!playerToInvite?.email) {
      Alert.alert('No Email', 'This player does not have an email address.');
      return;
    }

    try {
      // Call Supabase Edge Function to send invitation email
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-invitation-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: playerToInvite.email,
            teamName: teamName,
            firstName: playerToInvite.firstName,
            userEmail: playerToInvite.email,
            jerseyNumber: playerToInvite.number || '00',
            appLink: 'https://apps.apple.com/app/id6740043565',
          }),
        }
      );

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Email Sent', `Invite email sent to ${playerToInvite ? getPlayerName(playerToInvite) : 'player'}!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send email');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send email. Please try again later.');
      console.error('Email invite send error:', error);
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
    // Close player modal first, then open invite modal
    setIsPlayerModalVisible(false);
    setTimeout(() => {
      setIsInviteModalVisible(true);
    }, 300);
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
                setSelectedPlayer({ ...selectedPlayer, roles: newRoles });
              },
            },
          ]
        );
        return;
      }

      // Remove non-admin role
      const newRoles = currentRoles.filter((r) => r !== role);
      updatePlayer(selectedPlayer.id, { roles: newRoles });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles });
    } else {
      // Add the role
      const newRoles = [...currentRoles, role];
      updatePlayer(selectedPlayer.id, { roles: newRoles });
      setSelectedPlayer({ ...selectedPlayer, roles: newRoles });
    }
  };

  const handleUpdateStatus = (status: PlayerStatus) => {
    if (!selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updatePlayer(selectedPlayer.id, { status });
    setSelectedPlayer({ ...selectedPlayer, status });
  };

  const handleChangeSport = (sport: Sport) => {
    if (sport === teamSettings.sport) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingSport(sport);
    setIsSportChangeModalVisible(true);
  };

  const confirmChangeSport = () => {
    if (!pendingSport) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTeamSettingsAndSync({ sport: pendingSport });
    setIsSportChangeModalVisible(false);
    setPendingSport(null);
  };

  const cancelChangeSport = () => {
    setIsSportChangeModalVisible(false);
    setPendingSport(null);
  };

  const handleEraseAllData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsEraseDataModalVisible(true);
  };

  const confirmEraseAllData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetAllData();
    setIsEraseDataModalVisible(false);
  };

  const cancelEraseAllData = () => {
    setIsEraseDataModalVisible(false);
  };

  const handleAddJerseyColor = () => {
    if (!newColorName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors, { name: newColorName.trim(), color: newColorHex }];
    setTeamSettingsAndSync({ jerseyColors: newColors });
    setNewColorName('');
    setNewColorHex('#ffffff');
  };

  const handleRemoveJerseyColor = (name: string) => {
    Alert.alert(
      'Remove Jersey Color',
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const newColors = teamSettings.jerseyColors.filter((c) => c.name !== name);
            setTeamSettingsAndSync({ jerseyColors: newColors });
          },
        },
      ]
    );
  };

  const handleEditJerseyColor = (index: number) => {
    const color = teamSettings.jerseyColors[index];
    setEditingColorIndex(index);
    setEditColorName(color.name);
    setEditColorHex(color.color);
  };

  const handleSaveEditJerseyColor = () => {
    if (editingColorIndex === null || !editColorName.trim()) return;

    const oldColorName = teamSettings.jerseyColors[editingColorIndex].name;
    const newColorName = editColorName.trim();

    // Update the jersey color in settings
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors];
    newColors[editingColorIndex] = { name: newColorName, color: editColorHex };
    setTeamSettingsAndSync({ jerseyColors: newColors });

    // Update all games that use the old color name
    if (oldColorName !== newColorName) {
      games.forEach((game) => {
        if (game.jerseyColor === oldColorName) {
          updateGame(game.id, { jerseyColor: newColorName });
        }
      });
    }

    setEditingColorIndex(null);
    setEditColorName('');
    setEditColorHex('#ffffff');
  };

  const handleCancelEditJerseyColor = () => {
    setEditingColorIndex(null);
    setEditColorName('');
    setEditColorHex('#ffffff');
  };

  const handleDeleteEditingColor = () => {
    if (editingColorIndex === null) return;
    const colorName = teamSettings.jerseyColors[editingColorIndex].name;
    Alert.alert(
      'Remove Jersey Color',
      `Are you sure you want to remove "${colorName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const newColors = teamSettings.jerseyColors.filter((_, i) => i !== editingColorIndex);
            setTeamSettingsAndSync({ jerseyColors: newColors });
            setEditingColorIndex(null);
            setEditColorName('');
            setEditColorHex('#ffffff');
          },
        },
      ]
    );
  };

  const handleSaveTeamName = () => {
    if (!editTeamName.trim()) return;
    setTeamNameAndSync(editTeamName.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSettingsModalVisible(false);
  };

  const handlePickLogo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to update the team logo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (!activeTeamId) return;
      // Upload to Supabase Storage — required so all devices can load the logo
      const uploadResult = await uploadPhotoToStorage(result.assets[0].uri, activeTeamId, 'team-logo');
      if (uploadResult.success && uploadResult.url) {
        setTeamSettingsAndSync({ teamLogo: uploadResult.url });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Upload Failed', 'Could not upload team logo. Please check your connection and try again.');
      }
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert(
      'Remove Team Logo',
      'Are you sure you want to remove the team logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setTeamSettingsAndSync({ teamLogo: undefined });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const COLOR_PRESETS = [
    '#ffffff', '#1a1a1a', '#1e40af', '#dc2626', '#16a34a',
    '#7c3aed', '#ea580c', '#ca8a04', '#0891b2', '#db2777',
  ];

  const selectedRoles = selectedPlayer?.roles ?? [];

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="px-5 pt-2 pb-4"
        >
          <View className="flex-row items-center">
            <Shield size={20} color="#a78bfa" />
            <Text className="text-purple-400 text-sm font-medium ml-2">Admin</Text>
          </View>
          <Text
            className="text-white text-3xl font-bold"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >Control Panel</Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          {/* Type Selection */}
          <Animated.View entering={FadeInDown.delay(50).springify()} className="mb-6">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
              Sport
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(Object.keys(SPORT_NAMES) as Sport[]).sort((a, b) => SPORT_NAMES[a].localeCompare(SPORT_NAMES[b])).map((sport) => (
                <Pressable
                  key={sport}
                  onPress={() => handleChangeSport(sport)}
                  className={cn(
                    'items-center justify-center px-4 py-2 rounded-2xl border',
                    teamSettings.sport === sport
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-slate-800/80 border-slate-700/50'
                  )}
                >
                  <Text
                    className={cn(
                      'text-sm font-medium',
                      teamSettings.sport === sport ? 'text-cyan-400' : 'text-slate-400'
                    )}
                  >
                    {SPORT_NAMES[sport]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Team Identity Section */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
              Team Identity
            </Text>

            <Pressable
              onPress={() => {
                setEditTeamName(teamName);
                setIsSettingsModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <Settings size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Team Name</Text>
                    <Text className="text-slate-400 text-sm">{teamName}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            {/* Team Logo */}
            <Pressable
              onPress={handlePickLogo}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <ImageIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Team Logo</Text>
                    <Text className="text-slate-400 text-sm">
                      {teamSettings.teamLogo ? 'Tap to change' : 'Tap to add logo'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  {teamSettings.teamLogo ? (
                    <>
                      <Image
                        source={{ uri: teamSettings.teamLogo }}
                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 8 }}
                        contentFit="cover"
                      />
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveLogo();
                        }}
                        className="p-2"
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </Pressable>
                    </>
                  ) : (
                    <Plus size={20} color="#64748b" />
                  )}
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setIsJerseyModalVisible(true)}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <Palette size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Jersey Colors</Text>
                    <Text className="text-slate-400 text-sm">
                      {teamSettings.jerseyColors.length} colors configured
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  {teamSettings.jerseyColors.slice(0, 3).map((c, index) => (
                    <View
                      key={`preview-${index}`}
                      className="w-6 h-6 rounded-full border-2 border-slate-700 -ml-2"
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                  <ChevronRight size={20} color="#64748b" className="ml-2" />
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Team Structure Section */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Team Structure
            </Text>

            {/* Manage Team Menu Item */}
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

            {/* Manage Roles Menu Item */}
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

            {/* Softball Mode Toggle - Only for Softball */}
            {teamSettings.sport === 'softball' && teamSettings.showLineups !== false && (
              <View className="bg-slate-800/60 rounded-2xl p-4 mb-3 border border-slate-700/30 ml-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-amber-500/20 p-2 rounded-full">
                      <Users size={20} color="#f59e0b" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Softball Mode</Text>
                      <Text className="text-slate-400 text-sm">
                        Enable 10th fielder (Short Fielder)
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={teamSettings.isSoftball === true}
                    onValueChange={(value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTeamSettingsAndSync({ isSoftball: value });
                    }}
                    trackColor={{ false: '#334155', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>
            )}
          </Animated.View>

          {/* Communication Section */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Communication
            </Text>

            {/* Team Chat Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <MessageSquare size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Team Chat</Text>
                    <Text className="text-slate-400 text-sm">
                      Enable in-app team messaging
                    </Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showTeamChat !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showTeamChat: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Email Team Button - commented out, keeping code for future use
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const playersWithEmail = players.filter(p => p.email && p.email.trim());
                if (playersWithEmail.length === 0) {
                  Alert.alert('No Emails', 'No players have email addresses. Add emails to your roster to use this feature.');
                  return;
                }
                setSelectedRecipients(playersWithEmail.map(p => p.id));
                setEmailSubject('');
                setEmailBody('');
                setIsEmailModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-blue-500/20 p-2 rounded-full">
                    <Send size={20} color="#3b82f6" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Email Team</Text>
                    <Text className="text-slate-400 text-sm">Send an email to all players</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
            */}

            {/* Text Team Button - commented out, keeping code for future use
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const otherPlayers = players.filter(p => p.id !== currentPlayerId);
                const playersWithPhone = otherPlayers.filter(p => p.phone && p.phone.trim());
                if (playersWithPhone.length === 0) {
                  const totalOthers = otherPlayers.length;
                  Alert.alert(
                    'No Phone Numbers',
                    totalOthers === 0
                      ? 'There are no other team members to text.'
                      : `None of the ${totalOthers} other team member${totalOthers !== 1 ? 's' : ''} have phone numbers set. Add phone numbers in the Manage Team section.`
                  );
                  return;
                }
                const phoneNumbers = playersWithPhone.map(p => p.phone!);
                const phoneList = phoneNumbers.join(', ');
                Alert.alert(
                  'Text Team',
                  `Tap "Copy & Open Messages" then paste into the "To:" field.\n\n${playersWithPhone.length} team member${playersWithPhone.length !== 1 ? 's' : ''}:\n${phoneList}`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Copy & Open Messages',
                      onPress: async () => {
                        await Clipboard.setStringAsync(phoneNumbers.join(', '));
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Linking.openURL('sms:').catch(() => {
                          Alert.alert('Copied!', 'Phone numbers copied to clipboard. Paste them in your Messages app to create a group text.');
                        });
                      },
                    },
                  ]
                );
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-green-500/20 p-2 rounded-full">
                    <MessageSquare size={20} color="#22c55e" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Text Team</Text>
                    <Text className="text-slate-400 text-sm">Send a group text to all players</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
            */}

            {/* Send Test Push Notification Button - commented out, APNs confirmed working
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const otherPlayers = players.filter((p) => p.id !== currentPlayerId);
                if (otherPlayers.length === 0) {
                  Alert.alert('No Other Players', 'There are no other team members to send a test notification to.');
                  return;
                }
                const playersWithToken = otherPlayers.filter(
                  (p) => p.notificationPreferences?.pushToken
                );
                Alert.alert(
                  'Send Test Push Notification',
                  `This will send a test notification to all ${otherPlayers.length} team member${otherPlayers.length !== 1 ? 's' : ''} (${playersWithToken.length} have registered devices).\n\nIf players aren't receiving notifications, ask them to open the app first to register their device.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Send Test',
                      onPress: async () => {
                        try {
                          await sendPushToPlayers(
                            otherPlayers.map((p) => p.id),
                            'Test Notification',
                            `Push notifications are working! Sent by your team admin.`,
                            { type: 'test' }
                          );
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert(
                            'Test Sent',
                            `Notification sent to ${otherPlayers.length} player${otherPlayers.length !== 1 ? 's' : ''}. Players must have opened the app at least once to receive it.`
                          );
                        } catch (err) {
                          Alert.alert('Error', 'Failed to send test notification.');
                        }
                      },
                    },
                  ]
                );
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-amber-500/20 p-2 rounded-full">
                    <Bell size={20} color="#fbbf24" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Test Push Notifications</Text>
                    <Text className="text-slate-400 text-sm">Send a test alert to all players</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
            */}
          </Animated.View>

          {/* Team Features Section */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Team Features
            </Text>

            {/* Media Subsection Label */}
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2 ml-1">
              Media
            </Text>

            {/* Photos Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <ImageIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Photos</Text>
                    <Text className="text-slate-400 text-sm">
                      Share team photos and memories
                    </Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showPhotos !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showPhotos: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Financial Subsection Label */}
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2 ml-1">
              Financial
            </Text>

            {/* Payments Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <DollarSign size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Payments</Text>
                    <Text className="text-slate-400 text-sm">
                      Track team dues and payments
                    </Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showPayments !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showPayments: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Stripe Payments Setup - indented sub-row under Payments */}
            {teamSettings.showPayments !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/stripe-setup');
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View style={{ backgroundColor: '#635BFF20', borderRadius: 8, padding: 8 }}>
                      <CreditCard size={20} color="#635BFF" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Setup Stripe Payments</Text>
                      <Text className="text-slate-400 text-sm">
                        {teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete
                          ? 'Connected · tap to manage'
                          : 'Let players pay dues in-app'}
                      </Text>
                    </View>
                  </View>
                  {teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete ? (
                    <View className="w-2.5 h-2.5 rounded-full bg-green-400 mr-3" />
                  ) : null}
                  <ChevronRight size={20} color="#64748b" />
                </View>
              </Pressable>
            )}

            {/* Performance Subsection Label */}
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2 ml-1">
              Performance
            </Text>

            {/* Team Stats Nav Item */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsTeamStatsModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <BarChart3 size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Team Stats</Text>
                    <Text className="text-slate-400 text-sm">
                      Track player and team statistics
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            {/* Team Stats Link - only show when enabled */}
            {teamSettings.showTeamStats !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/team-stats');
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full">
                      <BarChart3 size={20} color="#67e8f9" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">View Team Stats</Text>
                      <Text className="text-slate-400 text-sm">
                        View and edit player statistics
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#64748b" />
                </View>
              </Pressable>
            )}

            {/* Season Management - only show when Team Stats is enabled */}
            {teamSettings.showTeamStats !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEndSeasonName(teamSettings.currentSeasonName || '');
                  setEndSeasonStep('name');
                  setIsEndSeasonModalVisible(true);
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full">
                      <Archive size={20} color="#67e8f9" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">End Season</Text>
                      <Text className="text-slate-400 text-sm">
                        {teamSettings.currentSeasonName
                          ? `Archive ${teamSettings.currentSeasonName} and reset stats`
                          : 'Archive current stats and start fresh'}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#64748b" />
                </View>
              </Pressable>
            )}

            {/* Culture Subsection Label */}
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-2 ml-1">
              Culture
            </Text>

            {/* Refreshments Nav Item */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsRefreshmentModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <JuiceBoxIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Refreshments</Text>
                    <Text className="text-slate-400 text-sm">
                      Assign players to bring refreshments
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
          </Animated.View>

          {/* Data Management Section */}
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Data Management
            </Text>

            {/* Erase Data Nav Item */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setIsEraseDataMenuModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <AlertTriangle size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Danger Zone</Text>
                    <Text className="text-slate-400 text-sm">
                      Erase or delete team data
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Player Edit Modal */}
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
                        selectedPlayer.status === 'active' ? 'bg-green-500' : 'bg-slate-800'
                      )}
                    >
                      {selectedPlayer.status === 'active' && <Check size={16} color="white" />}
                      <Text
                        className={cn(
                          'font-semibold ml-1',
                          selectedPlayer.status === 'active' ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Active
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleUpdateStatus('reserve')}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                        selectedPlayer.status === 'reserve' ? 'bg-slate-600' : 'bg-slate-800'
                      )}
                    >
                      {selectedPlayer.status === 'reserve' && <Check size={16} color="white" />}
                      <Text
                        className={cn(
                          'font-semibold ml-1',
                          selectedPlayer.status === 'reserve' ? 'text-white' : 'text-slate-400'
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
                        const newValue = !selectedPlayer.isInjured;
                        updatePlayer(selectedPlayer.id, { isInjured: newValue });
                        setSelectedPlayer({ ...selectedPlayer, isInjured: newValue });
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl mr-2 flex-row items-center justify-center',
                        selectedPlayer.isInjured ? 'bg-red-500' : 'bg-slate-800'
                      )}
                    >
                      <Text className={cn(
                        'text-lg font-black mr-1',
                        selectedPlayer.isInjured ? 'text-white' : 'text-red-500'
                      )}>+</Text>
                      <Text
                        className={cn(
                          'font-semibold',
                          selectedPlayer.isInjured ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Injured
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const newValue = !selectedPlayer.isSuspended;
                        updatePlayer(selectedPlayer.id, { isSuspended: newValue });
                        setSelectedPlayer({ ...selectedPlayer, isSuspended: newValue });
                      }}
                      className={cn(
                        'flex-1 py-3 px-4 rounded-xl flex-row items-center justify-center',
                        selectedPlayer.isSuspended ? 'bg-red-600' : 'bg-slate-800'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-bold mr-1',
                          selectedPlayer.isSuspended ? 'text-white' : 'text-red-500'
                        )}
                        style={{ fontSize: 12 }}
                      >
                        SUS
                      </Text>
                      <Text
                        className={cn(
                          'font-semibold',
                          selectedPlayer.isSuspended ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Suspended
                      </Text>
                    </Pressable>
                  </View>

                  {/* End Date Picker - shown when injured or suspended */}
                  {(selectedPlayer.isInjured || selectedPlayer.isSuspended) && (
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
                            value={selectedPlayer.statusEndDate && selectedPlayer.statusEndDate.length >= 10 ? parseISO(selectedPlayer.statusEndDate) : new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'inline' : 'default'}
                            onChange={(event, selectedDate) => {
                              if (Platform.OS === 'android') {
                                setShowSelectedPlayerEndDatePicker(false);
                              }
                              if (selectedDate) {
                                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                                updatePlayer(selectedPlayer.id, { statusEndDate: dateStr });
                                setSelectedPlayer({ ...selectedPlayer, statusEndDate: dateStr });
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
                    const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                    const showCoach = enabledRoles.includes('coach');
                    const showParent = enabledRoles.includes('parent');

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

      {/* Team Settings Modal */}
      <Modal
        visible={isSettingsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Team Settings</Text>
              <View className="flex-row items-center">
                <Pressable onPress={handleSaveTeamName} className="mr-3">
                  <Text className="text-cyan-400 font-semibold">Save</Text>
                </Pressable>
                <Pressable onPress={() => setIsSettingsModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Team Name</Text>
                <TextInput
                  value={editTeamName}
                  onChangeText={setEditTeamName}
                  placeholder="Enter team name"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Jersey Colors Modal */}
      <Modal
        visible={isJerseyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsJerseyModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Jersey Colors</Text>
              <Pressable onPress={() => setIsJerseyModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Current Colors */}
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Current Colors
              </Text>

              {teamSettings.jerseyColors.map((color, index) => (
                <View key={`color-${index}`}>
                  {editingColorIndex === index ? (
                    // Edit mode
                    <View className="bg-slate-800/80 rounded-xl p-4 mb-2 border border-cyan-500/50">
                      <TextInput
                        value={editColorName}
                        onChangeText={setEditColorName}
                        placeholder="Description (e.g. Home)"
                        placeholderTextColor="#64748b"
                        autoCapitalize="words"
                        className="bg-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                      />
                      <Text className="text-slate-400 text-sm mb-2">Select Color</Text>
                      <View className="flex-row justify-between mb-3">
                        {COLOR_PRESETS.map((hex) => (
                          <Pressable
                            key={hex}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setEditColorHex(hex);
                            }}
                            className={cn(
                              'flex-1 aspect-square rounded-full border-2 items-center justify-center mx-0.5',
                              editColorHex === hex ? 'border-cyan-400' : 'border-slate-600'
                            )}
                            style={{ backgroundColor: hex, maxWidth: 32 }}
                          >
                            {editColorHex === hex && (
                              <Check size={14} color={hex === '#ffffff' || hex === '#ca8a04' ? '#000' : '#fff'} />
                            )}
                          </Pressable>
                        ))}
                      </View>
                      <View className="flex-row">
                        <Pressable
                          onPress={handleCancelEditJerseyColor}
                          className="flex-1 bg-slate-700 rounded-xl py-3 mr-2"
                        >
                          <Text className="text-slate-300 font-semibold text-center">Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleDeleteEditingColor}
                          className="bg-red-500/20 rounded-xl py-3 px-4 mr-2"
                        >
                          <Trash2 size={18} color="#ef4444" />
                        </Pressable>
                        <Pressable
                          onPress={handleSaveEditJerseyColor}
                          className="flex-1 bg-cyan-500 rounded-xl py-3"
                        >
                          <Text className="text-white font-semibold text-center">Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    // Display mode
                    <View className="flex-row items-center bg-slate-800/80 rounded-xl p-4 mb-2 border border-slate-700/50">
                      <View
                        className="w-10 h-10 rounded-full border-2 border-slate-600"
                        style={{ backgroundColor: color.color }}
                      />
                      <Text className="text-white font-medium ml-3 flex-1">{color.name}</Text>
                      <Pressable
                        onPress={() => handleEditJerseyColor(index)}
                        className="p-2"
                      >
                        <Edit3 size={18} color="#67e8f9" />
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}

              {/* Add New Color */}
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
                Add New Color<Text className="text-red-400">*</Text>
              </Text>

              <View className="mb-4">
                <TextInput
                  value={newColorName}
                  onChangeText={setNewColorName}
                  placeholder="Description (e.g. Home)"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white mb-3"
                />

                <Text className="text-slate-400 text-sm mb-2">Select Color</Text>
                <View className="flex-row justify-between mb-4">
                  {COLOR_PRESETS.map((hex) => (
                    <Pressable
                      key={hex}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setNewColorHex(hex);
                      }}
                      className={cn(
                        'flex-1 aspect-square rounded-full border-2 items-center justify-center mx-0.5',
                        newColorHex === hex ? 'border-cyan-400' : 'border-slate-600'
                      )}
                      style={{ backgroundColor: hex, maxWidth: 32 }}
                    >
                      {newColorHex === hex && (
                        <Check size={14} color={hex === '#ffffff' || hex === '#ca8a04' ? '#000' : '#fff'} />
                      )}
                    </Pressable>
                  ))}
                </View>

                <Text className="text-slate-500 text-xs mb-3"><Text className="text-red-400">*</Text> Required</Text>

                <Pressable
                  onPress={handleAddJerseyColor}
                  className="bg-cyan-500 rounded-xl py-3 flex-row items-center justify-center"
                >
                  <Plus size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Save Color</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manage Roles Modal */}
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

              {/* Role Options */}
              {[
                { id: 'player' as const, label: 'Player', description: 'Active team member', icon: <User size={20} color="#22c55e" />, bgColor: 'bg-green-500', iconBg: 'bg-green-500/20' },
                { id: 'reserve' as const, label: 'Reserve', description: 'Backup/substitute player', icon: <UserMinus size={20} color="#94a3b8" />, bgColor: 'bg-slate-600', iconBg: 'bg-slate-600/20' },
                { id: 'coach' as const, label: 'Coach', description: 'Team coach (no jersey number needed)', icon: <UserCog size={20} color="#67e8f9" />, bgColor: 'bg-cyan-500', iconBg: 'bg-cyan-500/20' },
                { id: 'parent' as const, label: 'Parent/Guardian', description: 'Parent/guardian of a player', icon: <ParentChildIcon size={20} color="#ec4899" />, bgColor: 'bg-pink-500', iconBg: 'bg-pink-500/20' },
              ].map((role) => {
                const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                const isEnabled = enabledRoles.includes(role.id);
                // Player must always be enabled
                const isRequired = role.id === 'player';

                return (
                  <Pressable
                    key={role.id}
                    onPress={() => {
                      if (isRequired) return; // Can't disable Player
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const currentRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach', 'parent'];
                      if (isEnabled) {
                        setTeamSettingsAndSync({ enabledRoles: currentRoles.filter(r => r !== role.id) });
                      } else {
                        setTeamSettingsAndSync({ enabledRoles: [...currentRoles, role.id] });
                      }
                    }}
                    className={cn(
                      'flex-row items-center p-4 rounded-xl mb-3 border',
                      isEnabled ? `${role.iconBg} border-slate-600` : 'bg-slate-800/50 border-slate-700/50'
                    )}
                  >
                    <View className={cn('p-2 rounded-full', role.iconBg)}>
                      {role.icon}
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className={cn('font-semibold', isEnabled ? 'text-white' : 'text-slate-500')}>
                        {role.label}
                        {isRequired && <Text className="text-slate-500 font-normal"> (Required)</Text>}
                      </Text>
                      <Text className={cn('text-sm', isEnabled ? 'text-slate-400' : 'text-slate-600')}>
                        {role.description}
                      </Text>
                    </View>
                    <View className={cn(
                      'w-6 h-6 rounded-full border-2 items-center justify-center',
                      isEnabled ? `${role.bgColor} border-transparent` : 'border-slate-600'
                    )}>
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

      {/* Team Stats Modal */}
      <Modal
        visible={isTeamStatsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsTeamStatsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Team Stats</Text>
              <Pressable onPress={() => setIsTeamStatsModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">
                Configure team and player statistics tracking.
              </Text>

              {/* Use Team Stats */}
              <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full">
                      <BarChart3 size={20} color="#67e8f9" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Use Team Stats</Text>
                      <Text className="text-slate-400 text-sm">
                        Track player and team statistics
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={teamSettings.showTeamStats !== false}
                    onValueChange={(value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTeamSettingsAndSync({ showTeamStats: value });
                    }}
                    trackColor={{ false: '#334155', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              {/* Sub-options - only show when Use Team Stats is ON */}
              {teamSettings.showTeamStats !== false && (
                <>
                  {/* Team Records */}
                  <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-amber-500/10 p-2 rounded-full">
                          <Trophy size={18} color="#f59e0b" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="text-white font-semibold">Team Records</Text>
                          <Text className="text-slate-400 text-sm">
                            Show all-time team records and leaders
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={teamSettings.showTeamRecords === true}
                        onValueChange={(value) => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTeamSettingsAndSync({ showTeamRecords: value });
                        }}
                        trackColor={{ false: '#334155', true: '#22c55e' }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  </View>

                  {/* Allow Players */}
                  <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-emerald-500/10 p-2 rounded-full">
                          <Edit3 size={18} color="#059669" />
                        </View>
                        <View className="ml-3 flex-1">
                          <Text className="text-white font-semibold">Allow Players to Manage Own Stats</Text>
                          <Text className="text-slate-400 text-sm">
                            Players can update their game stats
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={teamSettings.allowPlayerSelfStats === true}
                        onValueChange={(value) => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTeamSettingsAndSync({ allowPlayerSelfStats: value });
                        }}
                        trackColor={{ false: '#334155', true: '#22c55e' }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Refreshments Modal */}
      <Modal
        visible={isRefreshmentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsRefreshmentModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Refreshments</Text>
              <Pressable onPress={() => setIsRefreshmentModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">
                Configure refreshment duty assignments for your team.
              </Text>

              {/* Enable Refreshments */}
              <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full">
                      <JuiceBoxIcon size={20} color="#67e8f9" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Enable Refreshment Duty</Text>
                      <Text className="text-slate-400 text-sm">
                        Assign players to bring refreshments
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={teamSettings.showRefreshmentDuty !== false}
                    onValueChange={(value) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setTeamSettingsAndSync({ showRefreshmentDuty: value });
                    }}
                    trackColor={{ false: '#334155', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              {/* 21+ Beverages - only show when refreshments is enabled */}
              {teamSettings.showRefreshmentDuty !== false && (
                <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="bg-amber-500/10 p-2 rounded-full">
                        <Beer size={18} color="#d97706" />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-white font-semibold">21+ Beverages</Text>
                        <Text className="text-slate-400 text-sm">
                          Show beer mug icon instead
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={teamSettings.refreshmentDutyIs21Plus === true}
                      onValueChange={(value) => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTeamSettingsAndSync({ refreshmentDutyIs21Plus: value });
                      }}
                      trackColor={{ false: '#334155', true: '#22c55e' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* New Player Modal */}
      <Modal
        visible={isNewPlayerModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIsNewPlayerModalVisible(false);
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
                  setIsNewPlayerModalVisible(false);
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

      {/* Send Invite Modal */}
      <Modal
        visible={isInviteModalVisible}
        animationType="fade"
        transparent
        onRequestClose={handleSkipInvite}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            {/* Header */}
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

            {/* Invite Options */}
            <View>
              {playerToInvite?.phone && (
                <Pressable
                  onPress={handleSendTextInvite}
                  className="flex-row items-center justify-center bg-cyan-500 rounded-xl py-4 mb-3 active:bg-cyan-600"
                >
                  <MessageSquare size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Text Message</Text>
                </Pressable>
              )}

              {playerToInvite?.email && (
                <Pressable
                  onPress={handleSendEmailInvite}
                  className="flex-row items-center justify-center bg-purple-500 rounded-xl py-4 mb-3 active:bg-purple-600"
                >
                  <Mail size={20} color="white" />
                  <Text className="text-white font-semibold ml-2">Send Email</Text>
                </Pressable>
              )}

              <Pressable
                onPress={handleSkipInvite}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Skip for Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sport Change Confirmation Modal */}
      <Modal
        visible={isSportChangeModalVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelChangeSport}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-amber-500/20 items-center justify-center mb-4">
                <RefreshCw size={32} color="#f59e0b" />
              </View>
              <Text className="text-white text-xl font-bold text-center">
                Change Type?
              </Text>
              <Text className="text-slate-400 text-center mt-2">
                Switching to {pendingSport ? SPORT_NAMES[pendingSport] : ''} will reset all player positions and clear their statistics.
              </Text>
              <Text className="text-amber-400 text-center mt-3 font-medium">
                This action cannot be undone.
              </Text>
            </View>

            {/* Buttons */}
            <View>
              <Pressable
                onPress={confirmChangeSport}
                className="flex-row items-center justify-center bg-amber-500 rounded-xl py-4 mb-3 active:bg-amber-600"
              >
                <Text className="text-white font-semibold">Proceed</Text>
              </Pressable>

              <Pressable
                onPress={cancelChangeSport}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Return</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Danger Zone Menu Modal */}
      <Modal
        visible={isEraseDataMenuModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEraseDataMenuModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Danger Zone</Text>
              <Pressable onPress={() => setIsEraseDataMenuModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">
                Permanently remove team data. These actions cannot be undone.
              </Text>

              {/* Erase All Data */}
              <Pressable
                onPress={() => {
                  setIsEraseDataMenuModalVisible(false);
                  handleEraseAllData();
                }}
                className="bg-orange-500/10 rounded-2xl p-4 mb-3 border border-orange-500/30 active:bg-orange-500/20"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-orange-500/20 p-2 rounded-full">
                      <Trash2 size={20} color="#f97316" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-orange-400 font-semibold">Erase All Data</Text>
                      <Text className="text-slate-400 text-sm">
                        Delete all team data and start fresh
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#f97316" />
                </View>
              </Pressable>

              {/* Delete Team */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  setIsEraseDataMenuModalVisible(false);
                  setDeleteConfirmText('');
                  setIsDeleteTeamModalVisible(true);
                }}
                className="bg-red-900/30 rounded-2xl p-4 mb-3 border border-red-700/50 active:bg-red-900/50"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-red-700/30 p-2 rounded-full">
                      <AlertTriangle size={20} color="#dc2626" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-red-500 font-semibold">Delete Team</Text>
                      <Text className="text-slate-400 text-sm">
                        Permanently delete team and all accounts
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#dc2626" />
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Erase All Data Confirmation Modal */}
      <Modal
        visible={isEraseDataModalVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelEraseAllData}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-red-500/30">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-red-500/20 items-center justify-center mb-4">
                <AlertTriangle size={32} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold text-center">
                Erase All Data?
              </Text>
              <Text className="text-slate-400 text-center mt-2">
                This will permanently delete all players, games, statistics, photos, chat messages, and payment records.
              </Text>
              <Text className="text-red-400 text-center mt-3 font-medium">
                This action cannot be undone.
              </Text>
            </View>

            {/* Buttons */}
            <View>
              <Pressable
                onPress={confirmEraseAllData}
                className="flex-row items-center justify-center bg-red-500 rounded-xl py-4 mb-3 active:bg-red-600"
              >
                <Trash2 size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Erase Everything</Text>
              </Pressable>

              <Pressable
                onPress={cancelEraseAllData}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Team Modal */}
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
                    // Close manage players modal first, then open new player modal
                    setIsManagePlayersModalVisible(false);
                    setTimeout(() => {
                      setIsNewPlayerModalVisible(true);
                    }, 300);
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
                            deletePlayerFromSupabase(player.id).catch(console.error);
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

      {/* Delete Team Confirmation Modal */}
      <Modal
        visible={isDeleteTeamModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsDeleteTeamModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-red-700/50">
            {/* Header */}
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-red-900/50 items-center justify-center mb-4">
                <AlertTriangle size={40} color="#dc2626" />
              </View>
              <Text className="text-red-500 text-2xl font-bold text-center">
                Delete Team?
              </Text>
              <Text className="text-slate-300 text-center mt-3">
                This is a permanent, irreversible action that will delete:
              </Text>
              <View className="mt-3 w-full">
                <Text className="text-slate-400 text-sm">• All player accounts and profiles</Text>
                <Text className="text-slate-400 text-sm">• All admin accounts</Text>
                <Text className="text-slate-400 text-sm">• All games and schedules</Text>
                <Text className="text-slate-400 text-sm">• All photos and memories</Text>
                <Text className="text-slate-400 text-sm">• All chat messages</Text>
                <Text className="text-slate-400 text-sm">• All payment records</Text>
                <Text className="text-slate-400 text-sm">• All team settings</Text>
              </View>
              <Text className="text-red-400 text-center mt-4 font-semibold">
                This action CANNOT be undone.
              </Text>
            </View>

            {/* Confirmation Input */}
            <View className="mb-4">
              <Text className="text-slate-300 text-center mb-2">
                Type <Text className="text-red-500 font-bold">DELETE</Text> to confirm:
              </Text>
              <TextInput
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="Type DELETE"
                placeholderTextColor="#64748b"
                className="bg-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-semibold"
                autoCapitalize="characters"
              />
            </View>

            {/* Buttons */}
            <View>
              <Pressable
                onPress={() => {
                  if (deleteConfirmText === 'DELETE') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    // Use deleteCurrentTeam to only delete this team, not all teams
                    deleteCurrentTeam();
                    setIsDeleteTeamModalVisible(false);
                    setDeleteConfirmText('');
                    // Navigate to login screen after deleting team
                    router.replace('/login');
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE'}
                className={cn(
                  'flex-row items-center justify-center rounded-xl py-4 mb-3',
                  deleteConfirmText === 'DELETE'
                    ? 'bg-red-600 active:bg-red-700'
                    : 'bg-slate-600 opacity-50'
                )}
              >
                <Trash2 size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Delete Everything Forever</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsDeleteTeamModalVisible(false);
                  setDeleteConfirmText('');
                }}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Season Modal */}
      <Modal
        visible={isEndSeasonModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setIsEndSeasonModalVisible(false);
          setEndSeasonStep('name');
        }}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">End Season</Text>
              <Pressable
                onPress={() => {
                  if (endSeasonStep === 'confirm') {
                    setEndSeasonStep('name');
                  } else {
                    setIsEndSeasonModalVisible(false);
                  }
                }}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {endSeasonStep === 'name' ? (
              // Step 1: Enter season name
              <View className="px-5 pt-6">
                <View className="bg-purple-500/10 p-4 rounded-xl mb-6 border border-purple-500/20">
                  <View className="flex-row items-center mb-2">
                    <Archive size={20} color="#a78bfa" />
                    <Text className="text-purple-300 font-semibold ml-2">Archive Season</Text>
                  </View>
                  <Text className="text-slate-400 text-sm">
                    This will save all current player stats and team records to history, then reset everything for a new season.
                  </Text>
                </View>

                <Text className="text-slate-400 text-sm mb-2">Season Name</Text>
                <TextInput
                  value={endSeasonName}
                  onChangeText={setEndSeasonName}
                  placeholder="e.g., 2024-2025"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg mb-6"
                  autoFocus
                />

                <Pressable
                  onPress={() => {
                    if (endSeasonName.trim()) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEndSeasonStep('confirm');
                    }
                  }}
                  disabled={!endSeasonName.trim()}
                  className={`rounded-xl py-4 items-center ${
                    endSeasonName.trim() ? 'bg-purple-600 active:bg-purple-700' : 'bg-slate-700'
                  }`}
                >
                  <Text className={`font-semibold ${endSeasonName.trim() ? 'text-white' : 'text-slate-500'}`}>
                    Continue
                  </Text>
                </Pressable>
              </View>
            ) : (
              // Step 2: Confirm and archive
              <View className="px-5 pt-6">
                <View className="bg-amber-500/10 p-4 rounded-xl mb-4 border border-amber-500/20">
                  <View className="flex-row items-center mb-2">
                    <AlertTriangle size={20} color="#f59e0b" />
                    <Text className="text-amber-300 font-semibold ml-2">Confirm Archive</Text>
                  </View>
                  <Text className="text-slate-400 text-sm">
                    You are about to archive season "{endSeasonName}" and reset all stats.
                  </Text>
                </View>

                <View className="bg-slate-800/60 rounded-xl p-4 mb-4">
                  <Text className="text-slate-300 font-medium mb-3">What will happen:</Text>

                  <View className="flex-row items-start mb-2">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">
                      Current team record ({teamSettings.record?.wins ?? 0}-{teamSettings.record?.losses ?? 0}{teamSettings.record?.ties ? `-${teamSettings.record.ties}` : ''}) will be saved
                    </Text>
                  </View>

                  <View className="flex-row items-start mb-2">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">
                      All player stats will be archived to history
                    </Text>
                  </View>

                  <View className="flex-row items-start mb-2">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">
                      Best season record will be updated if this is better
                    </Text>
                  </View>

                  <View className="flex-row items-start">
                    <RefreshCw size={16} color="#67e8f9" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">
                      All stats will be reset to zero for new season
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    const result = archiveAndStartNewSeason(endSeasonName.trim());
                    setIsEndSeasonModalVisible(false);
                    setEndSeasonStep('name');

                    // Show success message
                    Alert.alert(
                      'Season Archived',
                      result.newBestRecord
                        ? `${endSeasonName} has been archived! This season set a new best record.`
                        : `${endSeasonName} has been archived. All stats have been reset for the new season.`,
                      [{ text: 'OK' }]
                    );
                  }}
                  className="bg-purple-600 rounded-xl py-4 items-center mb-3 active:bg-purple-700"
                >
                  <Text className="text-white font-semibold">Archive Season & Reset Stats</Text>
                </Pressable>

                <Pressable
                  onPress={() => setEndSeasonStep('name')}
                  className="bg-slate-700 rounded-xl py-4 items-center active:bg-slate-600"
                >
                  <Text className="text-slate-300 font-semibold">Go Back</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Email Team Modal */}
      <Modal
        visible={isEmailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEmailModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Email Team</Text>
              <View className="flex-row items-center">
                <Pressable
                  onPress={async () => {
                    if (!emailSubject.trim()) {
                      Alert.alert('Subject Required', 'Please enter a subject for your email.');
                      return;
                    }
                    if (!emailBody.trim()) {
                      Alert.alert('Message Required', 'Please enter a message for your email.');
                      return;
                    }
                    if (selectedRecipients.length === 0) {
                      Alert.alert('No Recipients', 'Please select at least one recipient.');
                      return;
                    }

                    setIsSendingEmail(true);

                    try {
                      // Get selected player emails
                      const recipientEmails = players
                        .filter(p => selectedRecipients.includes(p.id) && p.email)
                        .map(p => p.email as string);

                      // Call Supabase Edge Function to send email
                      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
                      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;
                      const response = await fetch(
                        `${supabaseUrl}/functions/v1/send-team-email`,
                        {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${supabaseAnonKey}`,
                          },
                          body: JSON.stringify({
                            to: recipientEmails,
                            subject: emailSubject.trim(),
                            body: emailBody.trim(),
                            teamName: teamName,
                          }),
                        }
                      );

                      if (response.ok) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Email Sent', `Your email has been sent to ${recipientEmails.length} team member${recipientEmails.length === 1 ? '' : 's'}.`);
                        setIsEmailModalVisible(false);
                        setEmailSubject('');
                        setEmailBody('');
                        setSelectedRecipients([]);
                      } else {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || 'Failed to send email');
                      }
                    } catch (err) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      Alert.alert('Error', 'Failed to send email. Please try again later.');
                      console.error('Email send error:', err);
                    }

                    setIsSendingEmail(false);
                  }}
                  disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim() || selectedRecipients.length === 0}
                  className="px-3 py-2 mr-1"
                >
                  <Text className={`font-semibold ${isSendingEmail || !emailSubject.trim() || !emailBody.trim() || selectedRecipients.length === 0 ? 'text-slate-600' : 'text-cyan-400'}`}>
                    {isSendingEmail ? 'Sending...' : 'Send'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setIsEmailModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>
            </View>

            <ScrollView className="px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Subject */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Subject</Text>
                <TextInput
                  value={emailSubject}
                  onChangeText={setEmailSubject}
                  placeholder="Enter email subject"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800/80 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50"
                />
              </View>

              {/* Body */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Message</Text>
                <TextInput
                  value={emailBody}
                  onChangeText={setEmailBody}
                  placeholder="Type your message here..."
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  className="bg-slate-800/80 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50 min-h-[150px]"
                />
              </View>

              {/* Recipients */}
              <View className="mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-slate-400 text-sm">Recipients</Text>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const playersWithEmail = players.filter(p => p.email && p.email.trim()).map(p => p.id);
                      if (selectedRecipients.length === playersWithEmail.length) {
                        setSelectedRecipients([]);
                      } else {
                        setSelectedRecipients(playersWithEmail);
                      }
                    }}
                  >
                    <Text className="text-cyan-400 text-sm font-medium">
                      {selectedRecipients.length === players.filter(p => p.email && p.email.trim()).length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                </View>

                <View className="bg-slate-800/80 rounded-xl border border-slate-700/50 overflow-hidden">
                  {players.filter(p => p.email && p.email.trim()).map((player, index, arr) => (
                    <Pressable
                      key={player.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (selectedRecipients.includes(player.id)) {
                          setSelectedRecipients(selectedRecipients.filter(id => id !== player.id));
                        } else {
                          setSelectedRecipients([...selectedRecipients, player.id]);
                        }
                      }}
                      className={`flex-row items-center px-4 py-3 ${index < arr.length - 1 ? 'border-b border-slate-700/50' : ''}`}
                    >
                      <View className={`w-5 h-5 rounded-md mr-3 items-center justify-center ${selectedRecipients.includes(player.id) ? 'bg-cyan-500' : 'bg-slate-700 border border-slate-600'}`}>
                        {selectedRecipients.includes(player.id) && <Check size={14} color="white" />}
                      </View>
                      <PlayerAvatar player={player} size={36} />
                      <View className="ml-3 flex-1">
                        <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                        <Text className="text-slate-400 text-xs">{player.email}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-slate-500 text-xs mt-2">
                  {selectedRecipients.length} of {players.filter(p => p.email && p.email.trim()).length} recipients selected
                </Text>
              </View>

              {/* Info notice */}
              <View className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 mb-6">
                <Text className="text-blue-400 text-sm">
                  Emails will be sent from noreply@alignapps.com
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
