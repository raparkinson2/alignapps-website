import { View, Text, ScrollView, Pressable, Modal, Alert, Platform, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Shield,
  Settings,
  Users,
  X,
  Plus,
  Trash2,
  Palette,
  ChevronRight,
  UserCog,
  Mail,
  ImageIcon,
  MessageSquare,
  Send,
  BarChart3,
  DollarSign,
  AlertTriangle,
  ListOrdered,
  RefreshCw,
  Archive,
  Bell,
  CreditCard,
  Beer,
  Download,
  Crown,
  Check,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import {
  useTeamStore,
  Player,
  Sport,
  SPORT_NAMES,
  getSportName,
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
import { sendPushToPlayers, registerForPushNotificationsAsync } from '@/lib/notifications';
import { uploadPhotoToStorage } from '@/lib/photo-storage';
import { BACKEND_URL } from '@/lib/config';

// Extracted components
import { PlayerEditModal } from '@/components/admin/PlayerEditModal';
import { AddPlayerModal } from '@/components/admin/AddPlayerModal';
import { ManageTeamModal } from '@/components/admin/ManageTeamModal';
import { JerseyColorsModal } from '@/components/admin/JerseyColorsModal';
import { ManageRolesModal } from '@/components/admin/ManageRolesModal';
import { TeamStatsModal } from '@/components/admin/TeamStatsModal';
import { RefreshmentsModal } from '@/components/admin/RefreshmentsModal';
import { SendInviteModal } from '@/components/admin/SendInviteModal';
import { DangerZoneModals } from '@/components/admin/DangerZoneModals';
import { EndSeasonModal } from '@/components/admin/EndSeasonModal';
import { EmailTeamModal } from '@/components/admin/EmailTeamModal';
import { TeamSettingsModal } from '@/components/admin/TeamSettingsModal';
import { ExportStatsModal } from '@/components/admin/ExportStatsModal';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import { syncError } from '@/lib/sync-error-handler';

function AdminScreen() {
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

  // Ownership: if no teamOwnerId set yet, first admin is effectively the owner
  const teamOwnerId = teamSettings.teamOwnerId;
  const adminPlayers = players.filter(
    (p) => p.status !== 'retired' && (p.roles?.includes('admin') || p.roles?.includes('captain') || p.roles?.includes('coach'))
  );
  const isOwner = !teamOwnerId ? isAdmin : teamOwnerId === currentPlayerId;
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
    if (p) pushPlayerToSupabase(p, activeTeamId).catch(syncError('sync'));
  };

  // Wrapper around setTeamSettings that also syncs to Supabase
  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      // Use a small timeout so store has updated before we read it
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  // Wrapper around setTeamName that also syncs to Supabase
  const setTeamNameAndSync = (name: string) => {
    setTeamName(name);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, name, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  const positions = SPORT_POSITIONS[teamSettings.sport];

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [isJerseyModalVisible, setIsJerseyModalVisible] = useState(false);
  const [isRolesModalVisible, setIsRolesModalVisible] = useState(false);
  const [isManagePlayersModalVisible, setIsManagePlayersModalVisible] = useState(false);

  // New player form
  const [isNewPlayerModalVisible, setIsNewPlayerModalVisible] = useState(false);

  // Invite modal state
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isReinviteMode, setIsReinviteMode] = useState(false);

  // Sport change confirmation modal
  const [isSportChangeModalVisible, setIsSportChangeModalVisible] = useState(false);
  const [pendingSport, setPendingSport] = useState<Sport | null>(null);

  // Erase all data confirmation modal
  const [isEraseDataModalVisible, setIsEraseDataModalVisible] = useState(false);
  const [isEraseDataMenuModalVisible, setIsEraseDataMenuModalVisible] = useState(false);

  // Delete team confirmation modal
  const [isDeleteTeamModalVisible, setIsDeleteTeamModalVisible] = useState(false);

  // Transfer ownership modal
  const [isTransferOwnershipModalVisible, setIsTransferOwnershipModalVisible] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [transferConfirmStep, setTransferConfirmStep] = useState(false);

  // Season Management modal
  const [isEndSeasonModalVisible, setIsEndSeasonModalVisible] = useState(false);
  const [isExportStatsModalVisible, setIsExportStatsModalVisible] = useState(false);
  const [isRefreshmentModalVisible, setIsRefreshmentModalVisible] = useState(false);
  const [isTeamStatsModalVisible, setIsTeamStatsModalVisible] = useState(false);

  // Responsive layout for iPad
  const { isTablet, columns, containerPadding } = useResponsive();

  // Email Team modal state
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);

  // Stripe Connect state (loading used on stripe-setup screen via router)
  const [isStripeConnectLoading] = useState(false);
  const _ = isStripeConnectLoading;

  const handleReinvitePlayer = (player: Player) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedPlayer(player);
    setIsReinviteMode(true);
    // Close player modal first, then open invite modal
    setIsPlayerModalVisible(false);
    setTimeout(() => {
      setIsInviteModalVisible(true);
    }, 300);
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

  // Get selected player for reinvite
  const playerForReinvite = isReinviteMode ? selectedPlayer : null;

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
          {/* Premium Status Card */}
          <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginBottom: 20 }}>
            {teamSettings?.isPremium ? (
              <LinearGradient
                colors={['rgba(34,197,94,0.14)', 'rgba(34,197,94,0.05)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 18,
                  padding: 16,
                  borderWidth: 1.5,
                  borderColor: 'rgba(34,197,94,0.3)',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(34,197,94,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                  <Crown size={22} color="#22c55e" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 15 }}>Premium Active</Text>
                  </View>
                  <Text style={{ color: '#64748b', fontSize: 13 }}>All features unlocked for your team</Text>
                </View>
              </LinearGradient>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  router.push('/upgrade');
                }}
              >
                <LinearGradient
                  colors={['rgba(245,158,11,0.18)', 'rgba(245,158,11,0.06)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    borderWidth: 1.5,
                    borderColor: 'rgba(245,158,11,0.35)',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,158,11,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                    <Crown size={22} color="#f59e0b" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 15 }}>Upgrade to Premium</Text>
                    <Text style={{ color: '#78716c', fontSize: 13, marginTop: 1 }}>Stats, records, payments & more</Text>
                  </View>
                  <View style={{ backgroundColor: 'rgba(245,158,11,0.25)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 12 }}>$49.99/yr</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            )}
          </Animated.View>

          {/* Team Identity Section */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
              Team Identity
            </Text>

            <Pressable
              onPress={() => {
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

            {/* Export Stats - premium feature */}
            {teamSettings.showTeamStats !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsExportStatsModalVisible(true);
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-green-500/20 p-2 rounded-full">
                      <Download size={20} color="#22c55e" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Export Stats</Text>
                      <Text className="text-slate-400 text-sm">
                        Download roster stats as CSV — Premium
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

            {/* Transfer Ownership */}
            {isOwner && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setTransferTargetId(null);
                  setTransferConfirmStep(false);
                  setIsTransferOwnershipModalVisible(true);
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', padding: 8, borderRadius: 20 }}>
                      <Crown size={20} color="#fbbf24" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Transfer Ownership</Text>
                      <Text className="text-slate-400 text-sm">
                        Hand over team control to another admin or coach
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#475569" />
                </View>
              </Pressable>
            )}

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
      <PlayerEditModal
        visible={isPlayerModalVisible}
        onClose={() => setIsPlayerModalVisible(false)}
        playerId={selectedPlayerId}
        onReinvite={() => {
          const p = players.find((pl) => pl.id === selectedPlayerId) ?? null;
          handleReinvitePlayer(p!);
        }}
      />

      {/* Team Settings Modal */}
      <TeamSettingsModal
        visible={isSettingsModalVisible}
        onClose={() => setIsSettingsModalVisible(false)}
      />

      {/* Jersey Colors Modal */}
      <JerseyColorsModal
        visible={isJerseyModalVisible}
        onClose={() => setIsJerseyModalVisible(false)}
      />

      {/* Manage Roles Modal */}
      <ManageRolesModal
        visible={isRolesModalVisible}
        onClose={() => setIsRolesModalVisible(false)}
      />

      {/* Team Stats Modal */}
      <TeamStatsModal
        visible={isTeamStatsModalVisible}
        onClose={() => setIsTeamStatsModalVisible(false)}
      />

      {/* Refreshments Modal */}
      <RefreshmentsModal
        visible={isRefreshmentModalVisible}
        onClose={() => setIsRefreshmentModalVisible(false)}
      />

      {/* Add Player Modal */}
      <AddPlayerModal
        visible={isNewPlayerModalVisible}
        onClose={() => setIsNewPlayerModalVisible(false)}
      />

      {/* Manage Team Modal */}
      <ManageTeamModal
        visible={isManagePlayersModalVisible}
        onClose={() => setIsManagePlayersModalVisible(false)}
        onOpenPlayerEdit={(playerId) => {
          setSelectedPlayerId(playerId);
          setIsPlayerModalVisible(true);
        }}
        onOpenAddPlayer={() => setIsNewPlayerModalVisible(true)}
      />

      {/* Send Invite Modal (for re-invite from player edit) */}
      <SendInviteModal
        visible={isInviteModalVisible}
        onClose={() => {
          setIsInviteModalVisible(false);
          setSelectedPlayer(null);
          setIsReinviteMode(false);
        }}
        playerName={selectedPlayer ? getPlayerName(selectedPlayer) : ''}
        invitePhone={selectedPlayer?.phone}
        inviteEmail={selectedPlayer?.email}
        player={selectedPlayer}
        isReinviteMode={isReinviteMode}
      />

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
                Switching to {pendingSport ? getSportName(pendingSport) : ''} will reset all player positions and clear their statistics.
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

      {/* Danger Zone Modals */}
      <DangerZoneModals
        dangerMenuVisible={isEraseDataMenuModalVisible}
        onCloseDangerMenu={() => setIsEraseDataMenuModalVisible(false)}
        eraseDataVisible={isEraseDataModalVisible}
        onCloseEraseData={() => setIsEraseDataModalVisible(false)}
        deleteTeamVisible={isDeleteTeamModalVisible}
        onCloseDeleteTeam={() => setIsDeleteTeamModalVisible(false)}
        onOpenEraseData={() => setIsEraseDataModalVisible(true)}
        onOpenDeleteTeam={() => setIsDeleteTeamModalVisible(true)}
      />

      {/* End Season Modal */}
      <EndSeasonModal
        visible={isEndSeasonModalVisible}
        onClose={() => setIsEndSeasonModalVisible(false)}
      />

      {/* Export Stats Modal */}
      <ExportStatsModal
        visible={isExportStatsModalVisible}
        onClose={() => setIsExportStatsModalVisible(false)}
      />

      {/* Email Team Modal */}
      <EmailTeamModal
        visible={isEmailModalVisible}
        onClose={() => setIsEmailModalVisible(false)}
      />

      {/* Transfer Ownership Modal */}
      <Modal
        visible={isTransferOwnershipModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsTransferOwnershipModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Crown size={20} color="#fbbf24" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 18 }}>Transfer Ownership</Text>
            </View>
            <Pressable onPress={() => setIsTransferOwnershipModalVisible(false)}>
              <Text style={{ color: '#67e8f9', fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {!transferConfirmStep ? (
              <>
                <View style={{ backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', marginBottom: 12 }}>
                  <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>Before you transfer</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 19 }}>
                    The new owner will have full control of the team including the ability to transfer ownership again. You will remain an admin.
                  </Text>
                </View>

                {/* Subscription warning */}
                <View style={{ backgroundColor: 'rgba(248,113,113,0.07)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)', marginBottom: 20 }}>
                  <Text style={{ color: '#f87171', fontWeight: '700', fontSize: 13, marginBottom: 4 }}>⚠️ About your subscription</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 13, lineHeight: 19 }}>
                    Your Premium subscription is tied to <Text style={{ color: '#ffffff', fontWeight: '600' }}>your App Store / Google Play account</Text> and cannot be transferred.{'\n\n'}The team stays Premium until your current billing term ends. After that, the new owner will need to purchase their own subscription to keep Premium active.
                  </Text>
                </View>

                <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                  Select new owner
                </Text>

                {adminPlayers.filter((p) => p.id !== currentPlayerId).length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                    <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                      No eligible players found.{'\n'}Add another admin, captain, or coach first.
                    </Text>
                  </View>
                ) : (
                  adminPlayers.filter((p) => p.id !== currentPlayerId).map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTransferTargetId(p.id); }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        borderRadius: 14,
                        marginBottom: 10,
                        backgroundColor: transferTargetId === p.id ? 'rgba(251,191,36,0.15)' : 'rgba(30,41,59,0.8)',
                        borderWidth: 1,
                        borderColor: transferTargetId === p.id ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 15 }}>
                          {(p.firstName || '?')[0].toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 15 }}>
                          {`${p.firstName} ${p.lastName}`.trim() || 'Unknown'}
                        </Text>
                        <Text style={{ color: '#64748b', fontSize: 12 }}>
                          {p.roles?.join(', ')} · #{p.number}
                        </Text>
                      </View>
                      {transferTargetId === p.id && (
                        <Crown size={18} color="#fbbf24" />
                      )}
                    </Pressable>
                  ))
                )}

                {transferTargetId && (
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setTransferConfirmStep(true); }}
                    style={{ backgroundColor: '#fbbf24', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 10 }}
                  >
                    <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 16 }}>Continue</Text>
                  </Pressable>
                )}
              </>
            ) : (
              <>
                {(() => {
                  const target = players.find((p) => p.id === transferTargetId);
                  const targetName = target ? `${target.firstName ?? ''} ${target.lastName ?? ''}`.trim() || 'Unknown' : 'Unknown';
                  return (
                    <>
                      <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(251,191,36,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                          <Crown size={34} color="#fbbf24" />
                        </View>
                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 20, marginBottom: 8, textAlign: 'center' }}>
                          Transfer to {targetName}?
                        </Text>
                        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', lineHeight: 21 }}>
                          This will make <Text style={{ color: '#fbbf24', fontWeight: '700' }}>{targetName}</Text> the new team owner. You'll remain an admin but lose owner privileges.
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                          setTeamSettingsAndSync({ teamOwnerId: transferTargetId! } as any);
                          setIsTransferOwnershipModalVisible(false);
                          setTransferConfirmStep(false);
                          setTransferTargetId(null);
                        }}
                        style={{ backgroundColor: '#fbbf24', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 12 }}
                      >
                        <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 16 }}>Yes, Transfer Ownership</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => { setTransferConfirmStep(false); }}
                        style={{ backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}
                      >
                        <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 15 }}>Go Back</Text>
                      </Pressable>
                    </>
                  );
                })()}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export default withErrorBoundary(AdminScreen);