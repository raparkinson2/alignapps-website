import { View, Text, ScrollView, Pressable, Alert, Platform, Modal, TextInput, KeyboardAvoidingView, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  UserX,
  UserCheck,
  HelpCircle,
  TrendingUp,
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
import { pushPlayerToSupabase } from '@/lib/realtime-sync';
import { formatPhoneInput, formatPhoneNumber, unformatPhone } from '@/lib/phone';
import { sendTestNotification, registerForPushNotificationsAsync } from '@/lib/notifications';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { pushTeamLinkToSupabase, deleteTeamLinkFromSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';

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

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  player: Player;
  onSave: (updates: Partial<Player>) => void;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
}

function EditProfileModal({ visible, onClose, player, onSave, onChangePassword, onDeleteAccount }: EditProfileModalProps) {
  const [avatar, setAvatar] = useState(player.avatar || '');
  const [number, setNumber] = useState(player.number);
  const [phone, setPhone] = useState(formatPhoneNumber(player.phone));
  const [email, setEmail] = useState(player.email || '');

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to update your profile picture.',
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
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!number.trim()) {
      Alert.alert('Error', 'Jersey number is required');
      return;
    }
    // Store raw phone digits
    const rawPhone = unformatPhone(phone);
    onSave({
      avatar: avatar || undefined,
      number: number.trim(),
      phone: rawPhone || undefined,
      email: email.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl max-h-[90%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Edit Profile</Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {/* Avatar */}
              <View className="items-center mb-6">
                <Pressable onPress={handlePickImage} className="relative">
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={{ width: 100, height: 100, borderRadius: 50 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="w-24 h-24 rounded-full bg-slate-700 items-center justify-center">
                      <User size={40} color="#94a3b8" />
                    </View>
                  )}
                  <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-cyan-500 items-center justify-center">
                    <Camera size={16} color="white" />
                  </View>
                </Pressable>
                <Text className="text-slate-400 text-sm mt-2">Tap to change photo</Text>
                {avatar && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setAvatar('');
                    }}
                    className="flex-row items-center mt-3 px-4 py-2 bg-red-500/20 rounded-full active:bg-red-500/30"
                  >
                    <Trash2 size={14} color="#f87171" />
                    <Text className="text-red-400 text-sm font-medium ml-2">Remove Photo</Text>
                  </Pressable>
                )}
              </View>

              {/* Player Name (read-only display) */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Name</Text>
                <View className="bg-slate-800/50 rounded-xl px-4 py-3">
                  <Text className="text-slate-300 text-base">{getPlayerName(player)}</Text>
                </View>
                <Text className="text-slate-500 text-xs mt-1">Contact an admin to change your name</Text>
              </View>

              {/* Jersey Number */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Jersey Number</Text>
                <TextInput
                  value={number}
                  onChangeText={setNumber}
                  placeholder="Enter jersey number"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                  maxLength={3}
                />
              </View>

              {/* Phone */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhoneInput(text))}
                  placeholder="(555)123-4567"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
              </View>

              {/* Email */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email address"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                className="bg-cyan-500 rounded-xl py-4 items-center mb-6 active:bg-cyan-600"
              >
                <Text className="text-white font-semibold text-base">Save Changes</Text>
              </Pressable>

              {/* Account Section */}
              <View className="border-t border-slate-700/50 pt-4 mb-8">
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  Account
                </Text>

                {/* Change Password */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    onChangePassword();
                  }}
                  className="flex-row items-center py-3 px-4 bg-slate-800/60 rounded-xl mb-2 active:bg-slate-700/80"
                >
                  <Lock size={18} color="#67e8f9" />
                  <Text className="text-white ml-3 flex-1">Change Password</Text>
                  <ChevronRight size={18} color="#64748b" />
                </Pressable>

                {/* Delete My Account */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    onDeleteAccount();
                  }}
                  className="flex-row items-center py-3 px-4 bg-slate-800/60 rounded-xl active:bg-slate-700/80"
                >
                  <UserX size={18} color="#f87171" />
                  <Text className="text-red-400 ml-3 flex-1">Delete My Account</Text>
                  <ChevronRight size={18} color="#64748b" />
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface NotificationPreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  preferences: NotificationPreferences;
  onSave: (prefs: Partial<NotificationPreferences>) => void;
  currentPlayerId?: string | null;
  backendUrl?: string;
}

interface PreferenceToggleProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}

function PreferenceToggle({ label, description, value, onToggle }: PreferenceToggleProps) {
  return (
    <View className="flex-row items-center justify-between py-4 border-b border-slate-800">
      <View className="flex-1 mr-4">
        <Text className="text-white font-medium text-base">{label}</Text>
        <Text className="text-slate-400 text-sm mt-0.5">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(newValue);
        }}
        trackColor={{ false: '#334155', true: '#0891b2' }}
        thumbColor={value ? '#67e8f9' : '#94a3b8'}
      />
    </View>
  );
}

function NotificationPreferencesModal({ visible, onClose, preferences, onSave, currentPlayerId, backendUrl }: NotificationPreferencesModalProps) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(preferences);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  // Check permission status when modal opens
  useEffect(() => {
    if (visible) {
      setPrefs(preferences);
      // Check current permission status
      Notifications.getPermissionsAsync().then(({ status }) => {
        setPermissionStatus(status as 'granted' | 'denied' | 'undetermined');
      });
    }
  }, [visible, preferences]);

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(prefs);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await sendTestNotification();
      Alert.alert('Success', 'Test notification sent! You should see it shortly.');
    } catch (error) {
      Alert.alert('Error', 'Could not send test notification. Make sure you have granted permissions.');
    } finally {
      setIsTestingNotif(false);
    }
  };

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // First check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === 'granted') {
        // Already have permission
        setPermissionStatus('granted');
        Alert.alert('Already Enabled', 'Push notifications are already enabled for this app!');
        setIsRequestingPermission(false);
        return;
      }

      if (existingStatus === 'denied') {
        // Permission was denied before - must go to Settings
        setPermissionStatus('denied');
        Alert.alert(
          'Permission Required',
          'You previously denied notification permissions. Please enable them in Settings to receive game reminders.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            }
          ]
        );
        setIsRequestingPermission(false);
        return;
      }

      // Permission is 'undetermined' - request it (this will show the iOS popup)
      const token = await registerForPushNotificationsAsync();

      // Re-check permission status after request
      const { status: newStatus } = await Notifications.getPermissionsAsync();
      setPermissionStatus(newStatus as 'granted' | 'denied' | 'undetermined');

      if (newStatus === 'granted') {
        // Save token to backend if we have a player ID and backend URL
        if (token && currentPlayerId && backendUrl) {
          try {
            const res = await fetch(`${backendUrl}/api/notifications/save-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId: currentPlayerId, pushToken: token, platform: Platform.OS }),
            });
            const json = await res.json() as { success?: boolean };
            console.log('Push token saved from settings modal:', json.success);
          } catch (err) {
            console.log('Push token save from settings modal failed:', err);
          }
        }
        Alert.alert('Success', 'Push notifications are now enabled!');
      } else {
        // User denied in the popup or something went wrong
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to receive game reminders and updates.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Could not request notification permissions.');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">Notification Settings</Text>
            <Pressable
              onPress={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
            >
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
            {/* Enable Notifications Button */}
            <Pressable
              onPress={handleRequestPermission}
              disabled={isRequestingPermission || permissionStatus === 'granted'}
              className={`rounded-xl p-4 mt-4 mb-2 flex-row items-center ${
                permissionStatus === 'granted'
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-cyan-500/20 border border-cyan-500/30 active:bg-cyan-500/30'
              }`}
            >
              <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                permissionStatus === 'granted' ? 'bg-green-500/30' : 'bg-cyan-500/30'
              }`}>
                {permissionStatus === 'granted' ? (
                  <Check size={20} color="#22c55e" />
                ) : (
                  <Bell size={20} color="#67e8f9" />
                )}
              </View>
              <View className="flex-1">
                <Text className={`font-semibold ${
                  permissionStatus === 'granted' ? 'text-green-400' : 'text-cyan-400'
                }`}>
                  {isRequestingPermission
                    ? 'Requesting...'
                    : permissionStatus === 'granted'
                    ? 'Notifications Enabled'
                    : 'Enable Push Notifications'}
                </Text>
                <Text className="text-slate-400 text-sm">
                  {permissionStatus === 'granted'
                    ? 'You will receive game reminders and updates'
                    : 'Tap to grant notification permissions'}
                </Text>
              </View>
            </Pressable>

            {/* Game Notifications Section */}
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-4 mb-2">
              Game Notifications
            </Text>

            <PreferenceToggle
              label="Game Invites"
              description="Get notified when you're invited to a game"
              value={prefs.gameInvites}
              onToggle={(v) => handleToggle('gameInvites', v)}
            />

            <PreferenceToggle
              label="Day Before Reminder"
              description="Reminder 24 hours before game time"
              value={prefs.gameReminderDayBefore}
              onToggle={(v) => handleToggle('gameReminderDayBefore', v)}
            />

            <PreferenceToggle
              label="Hours Before Reminder"
              description="Reminder 2 hours before game time"
              value={prefs.gameReminderHoursBefore}
              onToggle={(v) => handleToggle('gameReminderHoursBefore', v)}
            />

            {/* Communication Section */}
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-6 mb-2">
              Communication
            </Text>

            <PreferenceToggle
              label="Chat Messages"
              description="Get notified when someone sends a team message"
              value={prefs.chatMessages}
              onToggle={(v) => handleToggle('chatMessages', v)}
            />

            <PreferenceToggle
              label="@Mentions"
              description="Get notified when you're tagged in a message"
              value={prefs.chatMentions}
              onToggle={(v) => handleToggle('chatMentions', v)}
            />

            {/* Payments Section */}
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-6 mb-2">
              Payments
            </Text>

            <PreferenceToggle
              label="Payment Reminders"
              description="Get reminders about outstanding payments"
              value={prefs.paymentReminders}
              onToggle={(v) => handleToggle('paymentReminders', v)}
            />

            {/* Test Notification Button */}
            <Pressable
              onPress={handleTestNotification}
              disabled={isTestingNotif}
              className="bg-slate-800 border border-slate-700 rounded-xl p-4 mt-6 flex-row items-center active:bg-slate-700"
            >
              <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-3">
                <Play size={20} color="#22c55e" />
              </View>
              <View className="flex-1">
                <Text className="text-white font-semibold">
                  {isTestingNotif ? 'Sending...' : 'Send Test Notification'}
                </Text>
                <Text className="text-slate-400 text-sm">Verify notifications are working</Text>
              </View>
            </Pressable>

            {/* Info Note */}
            <View className="bg-slate-800/50 rounded-xl p-4 mt-4 mb-4">
              <Text className="text-cyan-400 font-medium mb-1">About Push Notifications</Text>
              <Text className="text-slate-400 text-sm">
                Push notifications let you know about important team updates even when the app is closed.
                You can enable or disable specific notification types above.
              </Text>
            </View>

            {/* Save Button */}
            <Pressable
              onPress={handleSave}
              className="bg-cyan-500 rounded-xl py-4 items-center mb-8 active:bg-cyan-600"
            >
              <Text className="text-white font-semibold text-base">Save Preferences</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
}

function ChangePasswordModal({ visible, onClose, onSave }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validatePassword = (password: string): string[] => {
    const errorList: string[] = [];
    if (password.length < 8) {
      errorList.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errorList.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errorList.push('At least one lowercase letter');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errorList.push('At least one special symbol');
    }
    return errorList;
  };

  const handleSave = () => {
    const validationErrors = validatePassword(newPassword);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    onSave(newPassword);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewPassword('');
    setConfirmPassword('');
    setErrors([]);
    onClose();
    Alert.alert('Success', 'Your password has been updated');
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setErrors([]);
    onClose();
  };

  const currentErrors = newPassword.length > 0 ? validatePassword(newPassword) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Change Password</Text>
              <Pressable
                onPress={handleClose}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {/* New Password */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">New Password</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
              </View>

              {/* Password Requirements */}
              <View className="mb-4 bg-slate-800/50 rounded-xl p-3">
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Password Requirements
                </Text>
                <View className="flex-row items-center mb-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${newPassword.length >= 8 ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${newPassword.length >= 8 ? 'text-green-400' : 'text-slate-400'}`}>
                    At least 8 characters
                  </Text>
                </View>
                <View className="flex-row items-center mb-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${/[A-Z]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                    At least one uppercase letter
                  </Text>
                </View>
                <View className="flex-row items-center mb-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${/[a-z]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                    At least one lowercase letter
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                    At least one special symbol
                  </Text>
                </View>
              </View>

              {/* Confirm Password */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Confirm Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <Text className="text-red-400 text-sm mt-1">Passwords do not match</Text>
                )}
                {confirmPassword.length > 0 && newPassword === confirmPassword && (
                  <Text className="text-green-400 text-sm mt-1">Passwords match</Text>
                )}
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                className="bg-cyan-500 rounded-xl py-4 items-center mb-8 active:bg-cyan-600"
              >
                <Text className="text-white font-semibold text-base">Update Password</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface TeamLinksModalProps {
  visible: boolean;
  onClose: () => void;
  links: TeamLink[];
  onAdd: (link: TeamLink) => void;
  onUpdate: (id: string, updates: Partial<TeamLink>) => void;
  onRemove: (id: string) => void;
  canManage: boolean;
  currentPlayerId: string | null;
}

function TeamLinksModal({ visible, onClose, links, onAdd, onUpdate, onRemove, canManage, currentPlayerId }: TeamLinksModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    if (!title.trim() || !url.trim()) {
      Alert.alert('Error', 'Please enter both a title and URL');
      return;
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newLink: TeamLink = {
      id: `link-${Date.now()}`,
      title: title.trim(),
      url: formattedUrl,
      createdBy: currentPlayerId || '',
      createdAt: new Date().toISOString(),
    };

    onAdd(newLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTitle('');
    setUrl('');
    setIsAdding(false);
  };

  const handleUpdate = () => {
    if (!editingId || !title.trim() || !url.trim()) {
      Alert.alert('Error', 'Please enter both a title and URL');
      return;
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    onUpdate(editingId, { title: title.trim(), url: formattedUrl });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTitle('');
    setUrl('');
    setEditingId(null);
  };

  const handleEdit = (link: TeamLink) => {
    setTitle(link.title);
    setUrl(link.url);
    setEditingId(link.id);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Link',
      'Are you sure you want to delete this link?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onRemove(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleOpenLink = (linkUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(linkUrl).catch(() => {
      Alert.alert('Error', 'Could not open this link');
    });
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setIsAdding(false);
    setEditingId(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={handleClose}>
                <X size={24} color="#94a3b8" />
              </Pressable>
              <Text className="text-white text-lg font-bold">Team Links</Text>
              {canManage && !isAdding && !editingId && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAdding(true);
                  }}
                >
                  <Plus size={24} color="#67e8f9" />
                </Pressable>
              )}
              {(isAdding || editingId) && (
                <Pressable onPress={editingId ? handleUpdate : handleAdd}>
                  <Text className="text-cyan-400 font-semibold">Save</Text>
                </Pressable>
              )}
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {(isAdding || editingId) && (
                <View className="mb-4 bg-slate-800/60 rounded-xl p-4 border border-cyan-500/30">
                  <Text className="text-cyan-400 text-sm font-semibold mb-3">
                    {editingId ? 'Edit Link' : 'Add New Link'}
                  </Text>
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide">Display Name</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g., Team Schedule, League Website"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900/60 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50"
                    />
                  </View>
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide">URL</Text>
                    <TextInput
                      value={url}
                      onChangeText={setUrl}
                      placeholder="https://example.com"
                      placeholderTextColor="#64748b"
                      autoCapitalize="none"
                      keyboardType="url"
                      className="bg-slate-900/60 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50"
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      setTitle('');
                      setUrl('');
                      setIsAdding(false);
                      setEditingId(null);
                    }}
                    className="py-2"
                  >
                    <Text className="text-slate-400 text-center">Cancel</Text>
                  </Pressable>
                </View>
              )}

              {links.length === 0 && !isAdding ? (
                <View className="items-center justify-center py-12">
                  <View className="w-16 h-16 rounded-full bg-slate-800/50 items-center justify-center mb-4">
                    <Link size={32} color="#64748b" />
                  </View>
                  <Text className="text-slate-400 text-lg font-medium mb-1">No Links Yet</Text>
                  <Text className="text-slate-500 text-center px-8">
                    {canManage
                      ? 'Add useful links for your team like schedules, league websites, or resources.'
                      : 'No team links have been added yet.'}
                  </Text>
                </View>
              ) : (
                links.map((link) => (
                  <Pressable
                    key={link.id}
                    onPress={() => handleOpenLink(link.url)}
                    className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
                  >
                    <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center">
                      <Link size={20} color="#67e8f9" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-semibold">{link.title}</Text>
                      <Text className="text-slate-400 text-xs" numberOfLines={1}>
                        {link.url.replace(/^https?:\/\//, '')}
                      </Text>
                    </View>
                    {canManage ? (
                      <View className="flex-row items-center">
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleEdit(link);
                          }}
                          className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center mr-2"
                        >
                          <Pencil size={14} color="#94a3b8" />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            handleDelete(link.id);
                          }}
                          className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center"
                        >
                          <Trash2 size={14} color="#f87171" />
                        </Pressable>
                      </View>
                    ) : (
                      <ExternalLink size={18} color="#64748b" />
                    )}
                  </Pressable>
                ))
              )}

              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MoreScreen() {
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
  const teams = useTeamStore((s) => s.teams);
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
        pushPlayerToSupabase(updated as Player, activeTeamId).catch(console.error);
      }
    }
  };

  const handleSaveNotificationPrefs = (prefs: Partial<NotificationPreferences>) => {
    if (effectivePlayerId) {
      updateNotificationPreferences(effectivePlayerId, prefs);
    }
  };

  const unreadCount = notifications.filter((n) => n.toPlayerId === effectivePlayerId && !n.read).length;

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

  const confirmDeleteAccount = () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteAccount();
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
                className="bg-slate-800/80 rounded-2xl p-4 mb-4 border border-slate-700/50 active:bg-slate-700/80"
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
            </Animated.View>
          )}

          {/* Teams Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-2">
            Teams
          </Text>

          {/* Switch Team - only show if user belongs to multiple teams */}
          {hasMultipleTeams && (
            <MenuItem
              icon={<ArrowLeftRight size={20} color="#67e8f9" />}
              title="Switch Team"
              subtitle={`You're on ${userTeams.length} teams`}
              onPress={handleSwitchTeam}
              index={0}
            />
          )}

          <MenuItem
            icon={<CalendarOff size={20} color="#67e8f9" />}
            title="My Availability"
            subtitle="Set dates you're unavailable"
            onPress={() => router.push('/my-availability')}
            index={1}
          />

          <MenuItem
            icon={<Link size={20} color="#67e8f9" />}
            title="Team Links"
            subtitle={teamLinks.length > 0 ? `${teamLinks.length} link${teamLinks.length !== 1 ? 's' : ''}` : 'Add useful links for your team'}
            onPress={() => setLinksModalVisible(true)}
            index={2}
          />

          <MenuItem
            icon={<BarChart3 size={20} color="#67e8f9" />}
            title="Team Polls"
            subtitle="Create and vote on polls"
            onPress={() => router.push('/polls')}
            index={3}
          />

          <MenuItem
            icon={<TrendingUp size={20} color="#67e8f9" />}
            title="Stats and Analytics"
            subtitle="Attendance and team statistics"
            onPress={() => router.push('/stats-analytics')}
            index={4}
          />

          <MenuItem
            icon={<Plus size={20} color="#67e8f9" />}
            title="Create New Team"
            subtitle="Start a new team"
            onPress={() => router.push('/create-new-team')}
            index={4}
          />

          {/* Communication & Alerts Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
            Communication & Alerts
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
          <Animated.View entering={FadeInDown.delay(125).springify()}>
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

          <MenuItem
            icon={<Mail size={20} color="#67e8f9" />}
            title="Email Team"
            subtitle="Send an email to all players"
            onPress={handleEmailTeam}
            index={4}
          />

          <MenuItem
            icon={<MessageSquare size={20} color="#67e8f9" />}
            title="Text Team"
            subtitle="Send a group text to all players"
            onPress={handleTextTeam}
            index={5}
          />

          {/* Support Section */}
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
            Support
          </Text>

          <MenuItem
            icon={<HelpCircle size={20} color="#67e8f9" />}
            title="FAQs"
            subtitle="Frequently asked questions"
            onPress={() => router.push('/faqs')}
            index={10}
          />

          <MenuItem
            icon={<Lightbulb size={20} color="#67e8f9" />}
            title="Feature Request"
            subtitle="Suggest a new feature"
            onPress={() => router.push('/feature-request')}
            index={11}
          />

          <MenuItem
            icon={<Bug size={20} color="#f87171" />}
            title="Report Bug"
            subtitle="Let us know about issues"
            onPress={() => router.push('/report-bug')}
            index={12}
            variant="danger"
          />

          <MenuItem
            icon={<FileText size={20} color="#67e8f9" />}
            title="Notices"
            subtitle="Policies and additional information"
            onPress={() => router.push('/notices')}
            index={13}
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
        onSave={(password) => {
          // In a real app, this would call an API to update the password
          console.log('Password updated');
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
          if (teamId) pushTeamLinkToSupabase(link, teamId).catch(console.error);
        }}
        onUpdate={(id, updates) => {
          updateTeamLink(id, updates);
          const s = useTeamStore.getState();
          if (s.activeTeamId) {
            const updated = s.teamLinks.find(l => l.id === id);
            if (updated) pushTeamLinkToSupabase({ ...updated, ...updates }, s.activeTeamId).catch(console.error);
          }
        }}
        onRemove={(id) => {
          removeTeamLink(id);
          deleteTeamLinkFromSupabase(id).catch(console.error);
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
                      console.error('Email send error:', err);
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
                  disabled={deleteConfirmText !== 'DELETE'}
                  className={`rounded-xl py-4 items-center ${
                    deleteConfirmText === 'DELETE'
                      ? 'bg-red-500 active:bg-red-600'
                      : 'bg-slate-700'
                  }`}
                >
                  <Text className={`font-semibold text-base ${
                    deleteConfirmText === 'DELETE' ? 'text-white' : 'text-slate-500'
                  }`}>
                    Delete My Account
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
