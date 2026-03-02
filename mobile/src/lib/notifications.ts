import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { BACKEND_URL } from './config';

// Configure how notifications are displayed when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Report push registration outcome to backend so we can debug TestFlight
 * without needing Xcode or device logs.
 */
async function reportDiagnostic(data: {
  playerId?: string;
  permissionStatus: string;
  tokenObtained: boolean;
  tokenPrefix?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await fetch(`${BACKEND_URL}/api/notifications/registration-diagnostic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        platform: Platform.OS,
        osVersion: `${Device.osName} ${Device.osVersion}`,
        appVersion: Application.nativeApplicationVersion || 'unknown',
        backendUrlSeen: BACKEND_URL,
      }),
    });
  } catch (e) {
    // Diagnostic reporting is best-effort — never block the main flow
  }
}

/**
 * Register for push notifications and return an Expo push token.
 *
 * Uses getExpoPushTokenAsync which returns an ExponentPushToken[...] string.
 * The backend routes these via Expo's push service (sendViaExpoPushService) or
 * directly via node-apn for raw hex tokens. getExpoPushTokenAsync is confirmed
 * working in TestFlight builds.
 */
export async function registerForPushNotificationsAsync(playerId?: string): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push token: skipped — not a physical device');
    return null;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Step 1: Check/request permissions
  let existing: Notifications.NotificationPermissionsStatus;
  try {
    existing = await Notifications.getPermissionsAsync();
  } catch (permErr: any) {
    const errMsg = `getPermissionsAsync failed: ${permErr?.message || permErr}`;
    console.log('Push token:', errMsg);
    await reportDiagnostic({ playerId, permissionStatus: 'error', tokenObtained: false, errorMessage: errMsg });
    return null;
  }

  let status = existing.status;
  console.log('Push token: permission status:', status);

  if (status !== 'granted') {
    try {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
      console.log('Push token: requested permission, new status:', status);
    } catch (reqErr: any) {
      const errMsg = `requestPermissionsAsync failed: ${reqErr?.message || reqErr}`;
      console.log('Push token:', errMsg);
      await reportDiagnostic({ playerId, permissionStatus: 'error', tokenObtained: false, errorMessage: errMsg });
      return null;
    }
  }

  if (status !== 'granted') {
    console.log('Push token: permission denied — user must enable in Settings');
    await reportDiagnostic({ playerId, permissionStatus: status, tokenObtained: false, errorMessage: 'Permission denied' });
    return null;
  }

  console.log('Push token: permissions granted, fetching Expo push token...');

  try {
    const result = await Notifications.getExpoPushTokenAsync({
      projectId: '727371d5-f124-42e2-af0e-40f420477bce',
    });
    const expoToken = result.data;
    console.log(`Push token: SUCCESS — ${expoToken.substring(0, 36)}...`);
    await reportDiagnostic({ playerId, permissionStatus: status, tokenObtained: true, tokenPrefix: expoToken.substring(0, 36) });
    return expoToken;
  } catch (error: any) {
    const errMsg = `getExpoPushTokenAsync: ${error?.code || ''} ${error?.message || error}`.trim();
    console.log('Push token: failed —', errMsg);
    await reportDiagnostic({ playerId, permissionStatus: status, tokenObtained: false, errorMessage: errMsg });
    return null;
  }
}

/**
 * Schedule a local notification for a game reminder
 */
export async function scheduleGameReminder(
  gameId: string,
  title: string,
  body: string,
  triggerDate: Date
): Promise<string | null> {
  // Don't schedule if the date is in the past
  if (triggerDate <= new Date()) {
    console.log('Cannot schedule notification in the past');
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { gameId, type: 'game_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    console.log('Scheduled notification:', identifier);
    return identifier;
  } catch (error) {
    console.log('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Schedule a reminder 2 hours before a game
 */
export async function scheduleGameReminderHoursBefore(
  gameId: string,
  opponent: string,
  gameDate: Date,
  gameTime: string
): Promise<string | null> {
  const reminderDate = new Date(gameDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before

  return scheduleGameReminder(
    gameId,
    'Game in 2 Hours!',
    `Get ready! You're playing vs ${opponent} at ${gameTime}. Make sure to check in or out in the app.`,
    reminderDate
  );
}

/**
 * Schedule a reminder 1 day before a game
 */
export async function scheduleGameReminderDayBefore(
  gameId: string,
  opponent: string,
  gameDate: Date,
  gameTime: string
): Promise<string | null> {
  const reminderDate = new Date(gameDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before

  return scheduleGameReminder(
    gameId,
    'Game Tomorrow',
    `Reminder: You have a game vs ${opponent} tomorrow at ${gameTime}. Make sure to check in or out in the app.`,
    reminderDate
  );
}

/**
 * Cancel a scheduled notification by identifier
 */
export async function cancelScheduledNotification(identifier: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

/**
 * Send a push notification to specific devices via Expo Push API directly.
 * pushTokens: array of Expo push tokens for the recipient devices.
 */
export async function sendPushToTokens(
  pushTokens: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const validTokens = pushTokens.filter(
    (t) => t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['))
  );
  console.log('sendPushToTokens: input tokens:', pushTokens.length, 'valid:', validTokens.length);
  if (validTokens.length === 0) {
    console.log('sendPushToTokens: no valid tokens, raw tokens:', JSON.stringify(pushTokens));
    return;
  }

  try {
    const messages = validTokens.map((token) => ({
      to: token,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const resText = await res.text();
    console.log('sendPushToTokens: Expo response status:', res.status, 'body:', resText);
  } catch (err) {
    console.log('sendPushToTokens error:', err);
  }
}

/**
 * Send a push notification to a list of player IDs.
 * Routes through the backend /api/notifications/send-to-players which uses the
 * service-role key to bypass Supabase RLS when reading push tokens.
 */
export async function sendPushToPlayers(
  playerIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  if (playerIds.length === 0) return;

  const backendUrl = BACKEND_URL;
  if (!backendUrl) {
    console.log('sendPushToPlayers: no backend URL configured');
    return;
  }

  try {
    console.log(`sendPushToPlayers: sending to ${playerIds.length} players via backend`);
    const res = await fetch(`${backendUrl}/api/notifications/send-to-players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, title, body, data: data || {} }),
    });
    const resData = await res.json() as { success?: boolean; sent?: number; message?: string; error?: string };
    console.log(`sendPushToPlayers: backend response - sent=${resData.sent}, msg=${resData.message || resData.error || ''}`);
  } catch (err) {
    console.log('sendPushToPlayers error:', err);
  }
}


export async function sendGameInviteNotification(
  gameId: string,
  opponent: string,
  gameDate: string,
  gameTime: string
): Promise<void> {
  try {
    // Cancel any existing scheduled notification for this game first
    // to prevent duplicate/stale notifications
    await cancelGameInviteNotification(gameId);

    await Notifications.scheduleNotificationAsync({
      identifier: `game-invite-${gameId}`, // Stable ID prevents duplicates
      content: {
        title: 'New Game Added!',
        body: `You've been invited to play vs ${opponent} on ${gameDate} at ${gameTime}. Make sure to check in or out in the app.`,
        data: { gameId, type: 'game_invite' },
        sound: true,
      },
      trigger: null, // Sends immediately
    });
  } catch (error) {
    console.log('Error sending game invite notification:', error);
  }
}

/**
 * Cancel any pending OS notification for a specific game invite
 */
export async function cancelGameInviteNotification(gameId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`game-invite-${gameId}`);
  } catch {
    // Ignore - notification may not exist
  }
}

/**
 * Schedule a game invite notification for a future date
 */
export async function scheduleGameInviteNotification(
  gameId: string,
  opponent: string,
  gameDate: string,
  gameTime: string,
  releaseDate: Date
): Promise<string | null> {
  // Cancel any existing scheduled notification for this game first
  await cancelGameInviteNotification(gameId);

  // Don't schedule if the date is in the past
  if (releaseDate <= new Date()) {
    console.log('Release date is in the past, sending notification immediately');
    await sendGameInviteNotification(gameId, opponent, gameDate, gameTime);
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      identifier: `game-invite-${gameId}`, // Stable ID prevents duplicates
      content: {
        title: 'New Game Added!',
        body: `You've been invited to play vs ${opponent} on ${gameDate} at ${gameTime}. Make sure to check in or out in the app.`,
        data: { gameId, type: 'game_invite' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: releaseDate,
      },
    });

    console.log('Scheduled game invite notification:', identifier);
    return identifier;
  } catch (error) {
    console.log('Error scheduling game invite notification:', error);
    return null;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Get all pending scheduled notifications
 */
export async function getPendingNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Send an immediate local notification (useful for testing)
 */
export async function sendTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'Push notifications are working!',
      data: { type: 'test' },
    },
    trigger: null, // Sends immediately
  });
}

/**
 * Set the badge count on the app icon
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Clear the badge count
 */
export async function clearBadgeCount(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Send an event invite notification immediately
 */
export async function sendEventInviteNotification(
  eventId: string,
  eventTitle: string,
  eventDate: string,
  eventTime: string
): Promise<void> {
  try {
    // Cancel any existing notification for this event first to prevent duplicates
    try {
      await Notifications.cancelScheduledNotificationAsync(`event-invite-${eventId}`);
    } catch {
      // Ignore - notification may not exist
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `event-invite-${eventId}`, // Stable ID prevents duplicates
      content: {
        title: 'New Event Added!',
        body: `You've been invited to "${eventTitle}" on ${eventDate} at ${eventTime}. Tap to RSVP.`,
        data: { eventId, type: 'event_invite' },
        sound: true,
      },
      trigger: null, // Sends immediately
    });
  } catch (error) {
    console.log('Error sending event invite notification:', error);
  }
}

/**
 * Schedule an event reminder notification
 */
export async function scheduleEventReminder(
  eventId: string,
  title: string,
  body: string,
  triggerDate: Date
): Promise<string | null> {
  // Don't schedule if the date is in the past
  if (triggerDate <= new Date()) {
    console.log('Cannot schedule notification in the past');
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { eventId, type: 'event_reminder' },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    console.log('Scheduled event reminder notification:', identifier);
    return identifier;
  } catch (error) {
    console.log('Error scheduling event reminder notification:', error);
    return null;
  }
}

/**
 * Schedule a reminder 2 hours before an event
 */
export async function scheduleEventReminderHourBefore(
  eventId: string,
  eventTitle: string,
  eventDate: Date,
  eventTime: string
): Promise<string | null> {
  const reminderDate = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before

  return scheduleEventReminder(
    eventId,
    'Event in 2 Hours!',
    `Get ready! "${eventTitle}" starts at ${eventTime}.`,
    reminderDate
  );
}

/**
 * Schedule a reminder 1 day before an event
 */
export async function scheduleEventReminderDayBefore(
  eventId: string,
  eventTitle: string,
  eventDate: Date,
  eventTime: string
): Promise<string | null> {
  const reminderDate = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000); // 1 day before

  return scheduleEventReminder(
    eventId,
    'Event Tomorrow',
    `Reminder: "${eventTitle}" is tomorrow at ${eventTime}.`,
    reminderDate
  );
}

/**
 * Send a chat mention notification immediately
 */
export async function sendChatMentionNotification(
  senderName: string,
  messagePreview: string,
  mentionType: 'all' | 'specific'
): Promise<void> {
  try {
    const title = mentionType === 'all'
      ? `${senderName} mentioned everyone`
      : `${senderName} mentioned you`;

    const body = messagePreview.length > 100
      ? messagePreview.substring(0, 100) + '...'
      : messagePreview;

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type: 'chat_mention' },
        sound: true,
      },
      trigger: null, // Sends immediately
    });
  } catch (error) {
    console.log('Error sending chat mention notification:', error);
  }
}

/**
 * Send a chat message notification immediately (for general chat messages)
 */
export async function sendChatMessageNotification(
  senderName: string,
  messagePreview: string
): Promise<void> {
  try {
    const body = messagePreview.length > 100
      ? messagePreview.substring(0, 100) + '...'
      : messagePreview;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `New message from ${senderName}`,
        body: body || 'Sent an image',
        data: { type: 'chat_message' },
        sound: true,
      },
      trigger: null, // Sends immediately
    });
  } catch (error) {
    console.log('Error sending chat message notification:', error);
  }
}
