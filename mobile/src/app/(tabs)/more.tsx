import { View, Text, ScrollView, Pressable, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { withErrorBoundary } from '@/components/ui/ErrorBoundary';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Mail,
  Send,
  LogOut,
  User,
  ChevronRight,
  Users,
  MessageSquare,
  Bell,
  X,
  Camera,
  Pencil,
  BellRing,
  BellOff,
  Play,
  Lightbulb,
  Bug,
  BarChart3,
  Lock,
  Trash2,
  Check,
  ArrowLeftRight,
  Plus,
  Link,
  ExternalLink,
  CalendarOff,
  FileText,
  FolderOpen,
  UserX,
  UserCheck,
  HelpCircle,
  TrendingUp,
  Inbox,
  Trophy,
  Zap,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Clipboard from 'expo-clipboard';
import { useState, useEffect } from 'react';
import { useTeamStore, Player, NotificationPreferences, defaultNotificationPreferences, getPlayerName, getPlayerInitials, TeamLink } from '@/lib/store';
import { useShallow } from 'zustand/react/shallow';
import { pushPlayerToSupabase, pushNotificationPreferencesToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';
import { toast } from '@/lib/toast';
import { secureResetPassword } from '@/lib/secure-auth';
import { supabase } from '@/lib/supabase';
import { formatPhoneInput, formatPhoneNumber, unformatPhone } from '@/lib/phone';
import { sendTestNotification, registerForPushNotificationsAsync } from '@/lib/notifications';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { pushTeamLinkToSupabase, deleteTeamLinkFromSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';
import { EditProfileModal } from '@/components/more/EditProfileModal';
import { NotificationPreferencesModal } from '@/components/more/NotificationPreferencesModal';
import { ChangePasswordModal } from '@/components/more/ChangePasswordModal';
import { TeamLinksModal } from '@/components/more/TeamLinksModal';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  index: number;
  variant?: 'default' | 'danger';
}

function MenuItem({ icon, title, subtitle, onPress, index, variant = 'default' }: MenuItemProps) {
  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 50).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
      >
        <View className={`w-10 h-10 rounded-full items-center justify-center ${
          variant === 'danger' ? 'bg-red-500/20' : 'bg-cyan-500/20'
        }`}>
          {icon}
        </View>
        <View className="flex-1 ml-3">
          <Text className={`font-semibold ${
            variant === 'danger' ? 'text-red-400' : 'text-white'
          }`}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-slate-400 text-sm">{subtitle}</Text>
          )}
        </View>
        <ChevronRight size={20} color={variant === 'danger' ? '#f87171' : '#64748b'} />
      </Pressable>
    </Animated.View>
  );
}

function MoreScreen() {
  const router = useRouter();
  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const teamName = useTeamStore((s) => s.teamName);
  const logout = useTeamStore((s) => s.logout);
  const deleteAccount = useTeamStore((s) => s.deleteAccount);
  const games = useTeamStore((s) => s.games);
  const notifications = useTeamStore((s) => s.notifications);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const updateNotificationPreferences = useTeamStore((s) => s.updateNotificationPreferences);
  const getNotificationPreferences = useTeamStore((s) => s.getNotificationPreferences);
  const showTeamStats = useTeamStore((s) => s.teamSettings.showTeamStats !== false);

  // Team Links
  const teamLinks = useTeamStore((s) => s.teamLinks);
  const addTeamLink = useTeamStore((s) => s.addTeamLink);
  const updateTeamLink = useTeamStore((s) => s.updateTeamLink);
  const removeTeamLink = useTeamStore((s) => s.removeTeamLink);

  // Multi-team support
  const teams = useTeamStore(useShallow((s) => s.teams));
  const userEmail = useTeamStore((s) => s.userEmail);
  const userPhone = useTeamStore((s) => s.userPhone);
  const setPendingTeamSelection = useTeamStore((s) => s.setPendingTeamSelection);

  // Fallback: if currentPlayerId is null but there are players, use the first player
  const effectivePlayerId = currentPlayerId || (players.length > 0 ? players[0].id : null);
  const currentPlayer = players.find((p) => p.id === effectivePlayerId);
  const canManageTeam = currentPlayer?.roles?.includes('admin') || currentPlayer?.roles?.includes('captain');
  const canEditPlayers = currentPlayer?.roles?.includes('admin') || currentPlayer?.roles?.includes('coach');

  // Check how many teams the user belongs to.
  // Use email/phone matching when players are loaded, but fall back to the teams array
  // length alone — if 2+ teams are persisted, the user must belong to all of them.
  const userTeams = teams.filter((team) =>
    team.players.length === 0 // players not yet loaded from Supabase — trust the teams array
      ? true
      : team.players.some(
          (p) =>
            (userEmail && p.email?.toLowerCase() === userEmail.toLowerCase()) ||
            (userPhone && p.phone?.replace(/\D/g, '') === userPhone?.replace(/\D/g, ''))
        )
  );
  const hasMultipleTeams = userTeams.length > 1;

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState<Player | null>(null);
  const [notifPrefsVisible, setNotifPrefsVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [linksModalVisible, setLinksModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Email Team modal state
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleEditProfile = (player: Player) => {
    // Can edit own profile, or any profile if admin/coach
    const canEdit = player.id === effectivePlayerId || canEditPlayers;
    if (canEdit) {
      setPlayerToEdit(player);
      setEditModalVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSaveProfile = (updates: Partial<Player>) => {
    if (playerToEdit) {
      updatePlayer(playerToEdit.id, updates);
      // Sync to Supabase so changes appear on all devices
      if (activeTeamId) {
        const updated = { ...useTeamStore.getState().players.find(p => p.id === playerToEdit.id), ...updates };
        pushPlayerToSupabase(updated as Player, activeTeamId).catch((err) => {
          console.error(err);
          toast.error('Sync failed. Changes saved locally.');
        });
      }
    }
  };

  const handleSaveNotificationPrefs = (prefs: Partial<NotificationPreferences>) => {
    if (effectivePlayerId) {
      updateNotificationPreferences(effectivePlayerId, prefs);
      if (activeTeamId) {
        const updatedPlayer = useTeamStore.getState().players.find(p => p.id === effectivePlayerId);
        const fullPrefs = updatedPlayer?.notificationPreferences;
        if (fullPrefs) {
          pushNotificationPreferencesToSupabase(effectivePlayerId, fullPrefs, activeTeamId)
            .catch(syncError('pushNotificationPreferencesToSupabase'));
        }
      }
    }
  };

  const unreadCount = notifications.filter((n) => n.toPlayerId === effectivePlayerId && !n.read).length;
  const getUnreadDirectMessageCount = useTeamStore((s) => s.getUnreadDirectMessageCount);
  const unreadMessagesCount = effectivePlayerId ? getUnreadDirectMessageCount(effectivePlayerId) : 0;

  const handleEmailTeam = () => {
    const playersWithEmail = players.filter(p => p.email && p.email.trim());

    if (playersWithEmail.length === 0) {
      Alert.alert('No Emails', 'No team members have email addresses set.');
      return;
    }

    setSelectedRecipients(playersWithEmail.map(p => p.id));
    setEmailSubject('');
    setEmailBody('');
    setIsEmailModalVisible(true);
  };

  const handleTextTeam = () => {
    // Exclude current user - you're sending TO the team
    const otherPlayers = players.filter(p => p.id !== currentPlayerId);
    const playersWithPhone = otherPlayers.filter(p => p.phone && p.phone.trim());

    if (playersWithPhone.length === 0) {
      const totalOthers = otherPlayers.length;
      Alert.alert(
        'No Phone Numbers',
        totalOthers === 0
          ? 'There are no other team members to text.'
          : `None of the ${totalOthers} other team member${totalOthers !== 1 ? 's' : ''} have phone numbers set. Add phone numbers in the Roster tab.`
      );
      return;
    }

    // Get all phone numbers
    const phoneNumbers = playersWithPhone.map(p => p.phone!);
    const phoneList = phoneNumbers.join(', ');

    // Show confirmation with phone numbers and instructions
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
  };

  const handleSendGeneralInvite = () => {
    // Find the next upcoming game
    const sortedGames = [...games].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const nextGame = sortedGames.find(
      (g) => new Date(g.date) >= new Date(new Date().setHours(0, 0, 0, 0))
    );

    let message = `Hey! You're invited to play with ${teamName}!\n\n`;

    if (nextGame) {
      const gameDate = new Date(nextGame.date);
      message += `Our next game:\n`;
      message += `vs ${nextGame.opponent}\n`;
      message += `${gameDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} at ${nextGame.time}\n`;
      message += `${nextGame.location}\n`;
      message += `${nextGame.address}\n\n`;
    }

    message += `Let me know if you can make it!`;

    const smsUrl = Platform.select({
      ios: `sms:&body=${encodeURIComponent(message)}`,
      android: `sms:?body=${encodeURIComponent(message)}`,
      default: `sms:?body=${encodeURIComponent(message)}`,
    });

    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Could not open messaging app');
    });
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            logout();
            // AuthNavigator in _layout.tsx handles redirect to /login when isLoggedIn becomes false
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    setDeleteAccountModalVisible(true);
    setDeleteConfirmText('');
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm');
      return;
    }
    setIsDeletingAccount(true);
    const success = await deleteAccount();
    setIsDeletingAccount(false);
    if (!success) {
      Alert.alert('Error', 'Could not delete your account. Please check your connection and try again.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDeleteAccountModalVisible(false);
    // AuthNavigator in _layout.tsx handles redirect to /login when isLoggedIn becomes false
  };

  const handleSwitchTeam = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Set up pending selection with all user's teams, stay logged in
    setPendingTeamSelection(userTeams.map((t) => t.id));
    router.replace('/select-team');
  };

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
          <Text className="text-white text-3xl font-bold">My Settings</Text>
        </Animated.View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* Profile Card */}
          {currentPlayer && (
            <Animated.View
              entering={FadeInDown.delay(50).springify()}
            >
              <Pressable
                onPress={() => handleEditProfile(currentPlayer)}
                className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50 active:bg-slate-700/80"
                style={{ marginBottom: 8 }}
              >
                <View className="flex-row items-center">
                  <View className="relative">
                    <PlayerAvatar player={currentPlayer} size={60} />
                    <View className="absolute -bottom-1 -right-1 bg-cyan-500 rounded-full px-2 py-0.5">
                      <Text className="text-white text-xs font-bold">#{currentPlayer.number}</Text>
                    </View>
                  </View>
                  <View className="flex-1 ml-4">
                    <Text className="text-white text-xl font-bold">{getPlayerName(currentPlayer)}</Text>
                    <Text className="text-cyan-400 text-sm">{currentPlayer.position} · {teamName}</Text>
                  </View>
                  <View className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center">
                    <Pencil size={16} color="#94a3b8" />
                  </View>
                </View>
              </Pressable>

              {/* View My Card button */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/player-profile/${currentPlayer.id}`);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 9,
                  marginBottom: 16,
                  backgroundColor: 'rgba(103,232,249,0.07)',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(103,232,249,0.15)',
                }}
              >
                <Trophy size={14} color="#67e8f9" />
                <Text style={{ color: '#67e8f9', fontSize: 13, fontWeight: '600' }}>View My Player Card</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* MY TEAM Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-2">
            My Team
          </Text>

          <MenuItem
            icon={<ArrowLeftRight size={20} color="#67e8f9" />}
            title="Switch Team"
            subtitle={hasMultipleTeams ? `You're on ${userTeams.length} teams` : 'Switch or join another team'}
            onPress={handleSwitchTeam}
            index={0}
          />

          <MenuItem
            icon={<CalendarOff size={20} color="#67e8f9" />}
            title="My Availability"
            subtitle="Set dates you're unavailable"
            onPress={() => router.push('/my-availability')}
            index={1}
          />

          <MenuItem
            icon={<BarChart3 size={20} color="#67e8f9" />}
            title="Team Polls"
            subtitle="Create and vote on polls"
            onPress={() => router.push('/polls')}
            index={2}
          />

          <MenuItem
            icon={<Link size={20} color="#67e8f9" />}
            title="Team Links"
            subtitle={teamLinks.length > 0 ? `${teamLinks.length} link${teamLinks.length !== 1 ? 's' : ''}` : 'Add useful links for your team'}
            onPress={() => setLinksModalVisible(true)}
            index={3}
          />

          <MenuItem
            icon={<Plus size={20} color="#67e8f9" />}
            title="Create New Team"
            subtitle="Start a new team"
            onPress={() => router.push('/create-new-team')}
            index={4}
          />

          {/* Stats Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
            Stats
          </Text>

          <MenuItem
            icon={<BarChart3 size={20} color="#67e8f9" />}
            title="Stats"
            subtitle="View and edit player statistics"
            onPress={() => router.push('/team-stats')}
            index={3}
          />

          <MenuItem
            icon={<TrendingUp size={20} color="#67e8f9" />}
            title="Analytics"
            subtitle="Attendance and team statistics"
            onPress={() => router.push('/stats-analytics')}
            index={4}
          />

          <MenuItem
            icon={<Trophy size={20} color="#67e8f9" />}
            title="Season Summary"
            subtitle="Record, results, and highlights"
            onPress={() => router.push('/season-summary')}
            index={5}
          />

          {/* Alerts Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
            Alerts
          </Text>

          {/* Notifications with badge */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/notifications');
              }}
              className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
            >
              <View className="w-10 h-10 rounded-full items-center justify-center bg-cyan-500/20 relative">
                <Bell size={20} color="#67e8f9" />
                {unreadCount > 0 && (
                  <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-5 h-5 items-center justify-center px-1">
                    <Text className="text-white text-xs font-bold leading-5">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-semibold text-white">Notifications</Text>
                <Text className="text-slate-400 text-sm">
                  {unreadCount > 0 ? `${unreadCount} unread` : 'Game invites & reminders'}
                </Text>
              </View>
              <ChevronRight size={20} color="#64748b" />
            </Pressable>
          </Animated.View>

          {/* Notification Settings */}
          <Animated.View entering={FadeInDown.delay(112).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNotifPrefsVisible(true);
              }}
              className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
            >
              <View className="w-10 h-10 rounded-full items-center justify-center bg-cyan-500/20">
                <BellRing size={20} color="#67e8f9" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-semibold text-white">Notification Settings</Text>
                <Text className="text-slate-400 text-sm">Manage push notification preferences</Text>
              </View>
              <ChevronRight size={20} color="#64748b" />
            </Pressable>
          </Animated.View>

          {/* Messages */}
          <Animated.View entering={FadeInDown.delay(124).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/messages');
              }}
              className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
            >
              <View className="w-10 h-10 rounded-full items-center justify-center bg-cyan-500/20 relative">
                <Inbox size={20} color="#67e8f9" />
                {unreadMessagesCount > 0 && (
                  <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-5 h-5 items-center justify-center px-1">
                    <Text className="text-white text-xs font-bold leading-5">{unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}</Text>
                  </View>
                )}
              </View>
              <View className="flex-1 ml-3">
                <Text className="font-semibold text-white">Messages</Text>
                <Text className="text-slate-400 text-sm">
                  {unreadMessagesCount > 0 ? `${unreadMessagesCount} unread` : 'Direct messages from your team'}
                </Text>
              </View>
              <ChevronRight size={20} color="#64748b" />
            </Pressable>
          </Animated.View>

          {/* App Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
            App
          </Text>

          <MenuItem
            icon={<FolderOpen size={20} color="#67e8f9" />}
            title="File Storage"
            subtitle="Upload and share team documents"
            onPress={() => router.push('/file-storage')}
            index={6}
          />

          <MenuItem
            icon={<HelpCircle size={20} color="#67e8f9" />}
            title="Support"
            subtitle="FAQs, feature requests & bug reports"
            onPress={() => router.push('/support')}
            index={8}
          />

          <MenuItem
            icon={<FileText size={20} color="#67e8f9" />}
            title="Notices"
            subtitle="Policies and additional information"
            onPress={() => router.push('/notices')}
            index={9}
          />

          {/* Log Out */}
          <Pressable
            onPress={handleLogout}
            className="flex-row items-center justify-center py-4 px-4 rounded-xl mb-8 -mt-1 active:opacity-70"
          >
            <LogOut size={20} color="#ef4444" />
            <Text className="text-red-400 font-semibold text-base ml-2">Log Out</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Profile Modal */}
      {playerToEdit && (
        <EditProfileModal
          visible={editModalVisible}
          onClose={() => {
            setEditModalVisible(false);
            setPlayerToEdit(null);
          }}
          player={playerToEdit}
          onSave={handleSaveProfile}
          onChangePassword={() => setPasswordModalVisible(true)}
          onDeleteAccount={handleDeleteAccount}
        />
      )}

      {/* Notification Preferences Modal */}
      <NotificationPreferencesModal
        visible={notifPrefsVisible && !!effectivePlayerId}
        onClose={() => setNotifPrefsVisible(false)}
        preferences={effectivePlayerId ? getNotificationPreferences(effectivePlayerId) : defaultNotificationPreferences}
        onSave={handleSaveNotificationPrefs}
        currentPlayerId={currentPlayerId}
        backendUrl={BACKEND_URL}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={passwordModalVisible}
        onClose={() => setPasswordModalVisible(false)}
        onSave={async (newPassword) => {
          if (!currentPlayerId) return;
          // Hash and save to local store
          await secureResetPassword(currentPlayerId, newPassword);
          // Immediately sync to Supabase so the new password is available on all devices
          if (activeTeamId) {
            const updatedPlayer = useTeamStore.getState().players.find(p => p.id === currentPlayerId)
              ?? useTeamStore.getState().teams.find(t => t.id === activeTeamId)?.players.find(p => p.id === currentPlayerId);
            if (updatedPlayer) {
              await pushPlayerToSupabase(updatedPlayer, activeTeamId).catch((err) => {
                console.error(err);
                toast.error('Sync failed. Changes saved locally.');
              });
            }
          }
          // Also update Supabase auth password if the user has a session
          await supabase.auth.updateUser({ password: newPassword }).catch(() => {});
          console.log('Password updated and synced');
        }}
      />

      {/* Team Links Modal */}
      <TeamLinksModal
        visible={linksModalVisible}
        onClose={() => setLinksModalVisible(false)}
        links={teamLinks}
        onAdd={(link) => {
          addTeamLink(link);
          const teamId = useTeamStore.getState().activeTeamId;
          if (teamId) pushTeamLinkToSupabase(link, teamId).catch((err) => {
            console.error(err);
            toast.error('Sync failed. Changes saved locally.');
          });
        }}
        onUpdate={(id, updates) => {
          updateTeamLink(id, updates);
          const s = useTeamStore.getState();
          if (s.activeTeamId) {
            const updated = s.teamLinks.find(l => l.id === id);
            if (updated) pushTeamLinkToSupabase({ ...updated, ...updates }, s.activeTeamId).catch((err) => {
              console.error(err);
              toast.error('Sync failed. Changes saved locally.');
            });
          }
        }}
        onRemove={(id) => {
          removeTeamLink(id);
          deleteTeamLinkFromSupabase(id).catch((err) => {
            console.error(err);
            toast.error('Sync failed. Changes saved locally.');
          });
        }}
        canManage={canManageTeam || false}
        currentPlayerId={effectivePlayerId}
      />

      {/* Email Team Modal */}
      <Modal
        visible={isEmailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEmailModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end">
            <SafeAreaView className="bg-slate-900 rounded-t-3xl max-h-[90%]" edges={['bottom']}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <Pressable onPress={() => setIsEmailModalVisible(false)}>
                  <X size={24} color="#94a3b8" />
                </Pressable>
                <Text className="text-white text-lg font-bold">Email Team</Text>
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
                      const recipientEmails = players
                        .filter(p => selectedRecipients.includes(p.id) && p.email)
                        .map(p => p.email as string);

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
                    }

                    setIsSendingEmail(false);
                  }}
                  disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim() || selectedRecipients.length === 0}
                  className="px-4 py-2"
                >
                  <Text className={`font-semibold ${isSendingEmail || !emailSubject.trim() || !emailBody.trim() || selectedRecipients.length === 0 ? 'text-slate-600' : 'text-cyan-400'}`}>
                    {isSendingEmail ? 'Sending...' : 'Send'}
                  </Text>
                </Pressable>
              </View>

              <ScrollView className="px-5 pt-4" showsVerticalScrollIndicator={false}>
                {/* Subject */}
                <TextInput
                  value={emailSubject}
                  onChangeText={setEmailSubject}
                  placeholder="Enter email subject"
                  placeholderTextColor="#64748b"
                  autoCapitalize="sentences"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base mb-4"
                />

                {/* Body */}
                <TextInput
                  value={emailBody}
                  onChangeText={setEmailBody}
                  placeholder="Write your message..."
                  placeholderTextColor="#64748b"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  autoCapitalize="sentences"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base mb-4 min-h-[120px]"
                />

                {/* Recipients */}
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-slate-400 text-sm font-semibold">Recipients</Text>
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
                    <Text className="text-cyan-400 text-sm">
                      {selectedRecipients.length === players.filter(p => p.email && p.email.trim()).length ? 'Deselect All' : 'Select All'}
                    </Text>
                  </Pressable>
                </View>

                <View className="bg-slate-800/50 rounded-xl mb-4">
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
                      className={`flex-row items-center p-3 ${index !== arr.length - 1 ? 'border-b border-slate-700/50' : ''}`}
                    >
                      <View className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                        selectedRecipients.includes(player.id) ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600'
                      }`}>
                        {selectedRecipients.includes(player.id) && (
                          <Check size={14} color="white" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                        <Text className="text-slate-400 text-xs">{player.email}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>

                <Text className="text-slate-500 text-xs text-center mb-2">
                  {selectedRecipients.length} of {players.filter(p => p.email && p.email.trim()).length} recipients selected
                </Text>

                {/* Info notice */}
                <View className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 mb-6">
                  <Text className="text-blue-400 text-sm">
                    Emails will be sent from noreply@alignapps.com
                  </Text>
                </View>
              </ScrollView>
            </SafeAreaView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDeleteAccountModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-slate-900 rounded-t-3xl">
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <Pressable onPress={() => setDeleteAccountModalVisible(false)}>
                  <X size={24} color="#94a3b8" />
                </Pressable>
                <Text className="text-white text-lg font-bold">Delete Account</Text>
                <View style={{ width: 24 }} />
              </View>

              <View className="px-5 py-6">
                {/* Warning */}
                <View className="bg-red-500/10 rounded-xl p-4 border border-red-500/30 mb-6">
                  <View className="flex-row items-center mb-2">
                    <UserX size={20} color="#f87171" />
                    <Text className="text-red-400 font-bold text-base ml-2">Warning</Text>
                  </View>
                  <Text className="text-red-300 text-sm leading-5">
                    This action is permanent and cannot be undone. All your data will be deleted, including:
                  </Text>
                  <View className="mt-3">
                    <Text className="text-red-300 text-sm">• Your profile and account</Text>
                    <Text className="text-red-300 text-sm">• Your membership from all teams</Text>
                    <Text className="text-red-300 text-sm">• Your chat messages and notifications</Text>
                    <Text className="text-red-300 text-sm">• Your game attendance history</Text>
                  </View>
                </View>

                {/* Confirmation Input */}
                <Text className="text-slate-400 text-sm mb-2">
                  Type <Text className="text-red-400 font-bold">DELETE</Text> to confirm
                </Text>
                <TextInput
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder="Type DELETE here"
                  placeholderTextColor="#64748b"
                  autoCapitalize="characters"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base mb-6 border border-slate-700"
                />

                {/* Delete Button */}
                <Pressable
                  onPress={confirmDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || isDeletingAccount}
                  className={`rounded-xl py-4 items-center ${
                    deleteConfirmText === 'DELETE' && !isDeletingAccount
                      ? 'bg-red-500 active:bg-red-600'
                      : 'bg-slate-700'
                  }`}
                >
                  <Text className={`font-semibold text-base ${
                    deleteConfirmText === 'DELETE' && !isDeletingAccount ? 'text-white' : 'text-slate-500'
                  }`}>
                    {isDeletingAccount ? 'Deleting...' : 'Delete My Account'}
                  </Text>
                </Pressable>

                {/* Cancel Button */}
                <Pressable
                  onPress={() => setDeleteAccountModalVisible(false)}
                  className="py-4 items-center mt-2"
                >
                  <Text className="text-slate-400 font-medium">Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export default withErrorBoundary(MoreScreen);
