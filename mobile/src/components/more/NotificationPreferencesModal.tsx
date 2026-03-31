import { View, Text, ScrollView, Pressable, Alert, Platform, Modal } from 'react-native';
import { X, Check, Bell, Play } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useState, useEffect } from 'react';
import { NotificationPreferences } from '@/lib/store';
import { sendTestNotification, registerForPushNotificationsAsync } from '@/lib/notifications';
import { PreferenceToggle } from './PreferenceToggle';

export interface NotificationPreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  preferences: NotificationPreferences;
  onSave: (prefs: Partial<NotificationPreferences>) => void;
  currentPlayerId?: string | null;
  backendUrl?: string;
}

export function NotificationPreferencesModal({ visible, onClose, preferences, onSave, currentPlayerId, backendUrl }: NotificationPreferencesModalProps) {
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

            {/* Refreshment Duty Section */}
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mt-6 mb-2">
              Refreshment Duty
            </Text>

            <PreferenceToggle
              label="Beer / Refreshment Duty"
              description="Get notified when assigned duty, and reminded 24h & 2h before the game"
              value={prefs.refreshmentDutyReminders ?? true}
              onToggle={(v) => handleToggle('refreshmentDutyReminders', v)}
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
