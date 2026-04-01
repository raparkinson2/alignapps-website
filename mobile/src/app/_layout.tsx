import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform, Linking, Modal, View, Text, Pressable } from 'react-native';
import { Bell } from 'lucide-react-native';
import { AppToast } from '@/components/ui/AppToast';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTeamStore, useStoreHydrated, defaultNotificationPreferences } from '@/lib/store';
import { useTeamColor } from '@/lib/theme';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { clearInvalidSession, getSafeSession, supabase } from '@/lib/supabase';
import { startRealtimeSync, stopRealtimeSync, pushPlayerToSupabase, loadTeamFromSupabase, pushTeamToSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';
import { syncError } from '@/lib/sync-error-handler';
import { getCustomerInfo } from '@/lib/revenuecatClient';

export const unstable_settings = {
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();


function AuthNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const isLoggedIn = useTeamStore((s) => s.isLoggedIn);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const playersLength = useTeamStore((s) => s.players.length);
  const pendingTeamIds = useTeamStore((s) => s.pendingTeamIds);
  const logout = useTeamStore((s) => s.logout);
  const updateNotificationPreferences = useTeamStore((s) => s.updateNotificationPreferences);
  const addNotification = useTeamStore((s) => s.addNotification);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const navigationRef = useNavigationContainerRef();
  const [isReady, setIsReady] = useState(false);
  const isHydrated = useStoreHydrated();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const didFetchAllTeams = useRef(false);
  const pushTokenRegistered = useRef<string | null>(null); // tracks which playerId has registered
  const pendingNotificationData = useRef<Record<string, any> | null>(null); // notification tap data waiting for isReady
  const [showNotifRamp, setShowNotifRamp] = useState(false);
  const notifRampShownRef = useRef(false); // prevent showing more than once per session

  // On startup, ensure all teams the user belongs to are loaded from Supabase.
  // This fixes cases where the race condition caused only 1 team to be persisted locally.
  useEffect(() => {
    if (!isHydrated || !isLoggedIn || didFetchAllTeams.current) return;

    const { userEmail, userPhone } = useTeamStore.getState();
    if (!userEmail && !userPhone) return;

    didFetchAllTeams.current = true;

    const fetchAllUserTeams = async () => {
      try {
        let playerRows: { team_id: string; id: string }[] | null = null;

        if (userEmail) {
          const { data } = await supabase
            .from('players')
            .select('team_id, id')
            .eq('email', userEmail.toLowerCase());
          playerRows = data;
        } else if (userPhone) {
          const normalizedPhone = userPhone.replace(/\D/g, '');
          const { data } = await supabase
            .from('players')
            .select('team_id, id')
            .or(`phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`);
          playerRows = data;
        }

        // The authoritative set of team IDs this user belongs to (from Supabase)
        const validTeamIds = new Set((playerRows || []).map(r => r.team_id));

        const currentState = useTeamStore.getState();

        // Remove any locally cached teams that no longer exist in Supabase
        const purgedTeams = currentState.teams.filter(t => validTeamIds.has(t.id));
        if (purgedTeams.length !== currentState.teams.length) {
          const removedCount = currentState.teams.length - purgedTeams.length;
          console.log('STARTUP: Purging', removedCount, 'deleted team(s) from local store');
          const newActiveTeamId = validTeamIds.has(currentState.activeTeamId || '')
            ? currentState.activeTeamId
            : purgedTeams[0]?.id || null;
          useTeamStore.setState({
            teams: purgedTeams,
            activeTeamId: newActiveTeamId,
            // Clear pendingTeamIds that reference deleted teams
            pendingTeamIds: currentState.pendingTeamIds
              ? currentState.pendingTeamIds.filter(id => validTeamIds.has(id))
              : null,
          });
        }

        if (!playerRows || playerRows.length === 0) return;

        // Load any teams that are missing from local store
        const knownTeamIds = new Set(useTeamStore.getState().teams.map(t => t.id));
        const missingTeams = playerRows.filter(r => !knownTeamIds.has(r.team_id));
        if (missingTeams.length > 0) {
          console.log('STARTUP: Loading', missingTeams.length, 'missing teams from Supabase');
          for (const row of missingTeams) {
            await loadTeamFromSupabase(row.team_id);
          }
        }
      } catch (err) {
        console.error('STARTUP: Failed to fetch all user teams:', err);
      }
    };

    fetchAllUserTeams();
  }, [isHydrated, isLoggedIn]);

  useEffect(() => {
    // Check immediately and on interval until ready
    const checkReady = () => {
      if (navigationRef?.isReady() && !isReady) {
        console.log('Navigation is ready');
        setIsReady(true);
      }
    };

    checkReady();
    const interval = setInterval(checkReady, 100);

    return () => clearInterval(interval);
  }, [navigationRef, isReady]);

  // Validate login state on hydration - ensure logged in user actually exists
  // This prevents stale login state from persisting across builds
  useEffect(() => {
    if (!isHydrated) return;

    // Check for invalid Supabase sessions on startup (non-blocking)
    const checkSupabaseSession = async () => {
      try {
        await getSafeSession();
      } catch (e: any) {
        // Handle any errors gracefully - don't block the app
        console.warn('Session check error on startup:', e?.message || e);
        if (e?.message?.includes('Refresh Token') ||
            e?.message?.includes('refresh_token') ||
            e?.message?.includes('timed out')) {
          await clearInvalidSession();
        }
      }
    };
    // Run in background - don't await to prevent blocking app startup
    checkSupabaseSession();

    // Additional safety: if somehow isLoggedIn is true but no players exist, force logout
    // BUT only if there's no activeTeamId — if there is one, realtime sync will load players shortly
    const { activeTeamId: currentTeamId } = useTeamStore.getState();
    if (isLoggedIn && playersLength === 0 && !currentTeamId) {
      console.log('No players exist, no active team, but isLoggedIn is true, forcing logout');
      stopRealtimeSync();
      logout();
      return;
    }

    if (isLoggedIn && currentPlayerId) {
      // Check if the player still exists in the store
      const playerExists = useTeamStore.getState().players.some((p) => p.id === currentPlayerId);
      if (!playerExists) {
        // Only force logout if there's no active team being loaded
        // (activeTeamId means realtime sync may still be populating players)
        const { activeTeamId } = useTeamStore.getState();
        if (!activeTeamId) {
          console.log('Logged in player not found and no active team, forcing logout');
          logout();
        }
        // else: player will appear once loadTeamFromSupabase completes
      }
    } else if (isLoggedIn && !currentPlayerId) {
      // Logged in but no player ID - only force logout if there's no active team loading
      const { activeTeamId } = useTeamStore.getState();
      if (!activeTeamId) {
        console.log('Invalid login state (no player ID, no team), forcing logout');
        logout();
      }
      // else: currentPlayerId will be set once loadTeamFromSupabase finishes
    }
  }, [isHydrated, isLoggedIn, currentPlayerId, playersLength, logout]);

  // Hide splash screen once hydration is complete
  useEffect(() => {
    if (isHydrated) {
      SplashScreen.hideAsync();
    }
  }, [isHydrated]);

  // Start/stop realtime sync when login state or team changes
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  useEffect(() => {
    if (isLoggedIn && activeTeamId) {
      startRealtimeSync(activeTeamId);
    } else {
      stopRealtimeSync();
    }
    return () => {
      // Don't stop on unmount — keep syncing while logged in
    };
  }, [isLoggedIn, activeTeamId]);

  // When app returns to foreground, force a full data reload.
  // This ensures data is fresh after the app was backgrounded and
  // Supabase Realtime WebSocket connections may have been dropped by iOS.
  useEffect(() => {
    if (!isLoggedIn || !activeTeamId) return;

    const appStateRef = { current: AppState.currentState };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState !== 'active' && nextState === 'active') {
        console.log('APP: Returning to foreground — reconnecting realtime and refreshing data');
        // Force restart realtime subscription to ensure WebSocket is alive after backgrounding.
        // stopRealtimeSync first so startRealtimeSync doesn't skip due to "already subscribed" guard.
        // startRealtimeSync will also call loadTeamFromSupabase to catch any missed changes.
        stopRealtimeSync();
        startRealtimeSync(activeTeamId);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isLoggedIn, activeTeamId]);

  // Reset push token registration ref when logged out so re-login always re-registers
  useEffect(() => {
    if (!isLoggedIn) {
      pushTokenRegistered.current = null;
    }
  }, [isLoggedIn]);

  // Sync premium status for admins/captains and persist to Supabase
  // This ensures all team members inherit the correct isPremium flag
  useEffect(() => {
    if (!isLoggedIn || !currentPlayerId) return;
    const state = useTeamStore.getState();
    const currentPlayer = state.players.find((p) => p.id === currentPlayerId);
    const canManage = currentPlayer?.roles?.includes('admin') || currentPlayer?.roles?.includes('captain');
    if (!canManage) return;

    getCustomerInfo().then((result) => {
      if (!result.ok) return;
      const active = result.data.entitlements.active;
      const rcIsPremium = Boolean(active['premium'] || active['multi_team']);
      const latestState = useTeamStore.getState();
      // Only upgrade to premium via RevenueCat — never downgrade here,
      // as that would override DEV bypasses or team-level premium set by other means.
      if (rcIsPremium && !(latestState.teamSettings?.isPremium ?? false)) {
        setTeamSettings({ isPremium: true });
        if (latestState.activeTeamId) {
          const s = useTeamStore.getState();
          pushTeamToSupabase(latestState.activeTeamId, s.teamName, { ...s.teamSettings, isPremium: true })
            .catch(syncError('sync'));
        }
      }
    });
  }, [isLoggedIn, currentPlayerId, setTeamSettings]);

  // Register for push notifications when logged in
  const doRegisterTokenRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !currentPlayerId) return;
    // Only register once per player session to avoid duplicate APNs calls
    if (pushTokenRegistered.current === currentPlayerId) return;

    // Skip push notification registration for parents if the team is not on a premium plan
    const notifState = useTeamStore.getState();
    const notifPlayer = notifState.players.find((p) => p.id === currentPlayerId);
    if (notifPlayer?.roles?.includes('parent') && !notifState.teamSettings?.isPremium) {
      console.log('Push notifications: skipping registration for parent on non-premium team');
      return;
    }

    const doRegisterToken = async () => {
      const token = await registerForPushNotificationsAsync(currentPlayerId);
      if (token && currentPlayerId) {
        // Mark as registered only after successfully obtaining a token
        pushTokenRegistered.current = currentPlayerId;

        // Save the push token to the player's preferences (local store)
        updateNotificationPreferences(currentPlayerId, { pushToken: token });
        console.log('Push token registered for player:', currentPlayerId, 'token:', token);

        // Save token via backend endpoint — uses service-role key to bypass RLS
        const backendUrl = BACKEND_URL;
        if (backendUrl) {
          try {
            const saveRes = await fetch(`${backendUrl}/api/notifications/save-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ playerId: currentPlayerId, pushToken: token, platform: Platform.OS }),
            });
            const saveData = await saveRes.json() as { success?: boolean; error?: string };
            if (saveData.success) {
              console.log('Push token: saved via backend for player:', currentPlayerId);
            } else {
              console.log('Push token: backend save error:', saveData.error);
            }
          } catch (err: any) {
            console.log('Push token: backend save failed:', err?.message || err);
          }
        } else {
          console.log('Push token: no backend URL configured, token not saved to server');
        }
      } else {
        console.log('Push token: failed to get token (permissions denied or simulator)');
      }
    };

    // Keep a ref so the notification ramp modal can trigger registration
    doRegisterTokenRef.current = doRegisterToken;

    const registerToken = async () => {
      // Post a "started" diagnostic immediately so we know the effect fired
      try {
        await fetch(`${BACKEND_URL}/api/notifications/registration-diagnostic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerId: currentPlayerId,
            permissionStatus: 'starting',
            tokenObtained: false,
            errorMessage: 'Registration started',
            backendUrlSeen: BACKEND_URL,
            platform: Platform.OS,
          }),
        });
      } catch (_) { /* best effort */ }

      // On iOS, check if we already have permission before prompting.
      // If not, show a contextual ramp explaining the value before the OS prompt.
      if (Platform.OS === 'ios' && !notifRampShownRef.current) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          notifRampShownRef.current = true;
          setShowNotifRamp(true);
          return; // ramp "Allow" button calls doRegisterToken directly
        }
      }

      await doRegisterToken();
    };

    // Register immediately
    registerToken();

    // Helper to navigate based on notification data
    const navigateFromNotification = (data: any) => {
      if (data?.type === 'direct_message' && data?.messageId) {
        router.push(`/messages?openMessageId=${data.messageId}`);
      } else if (data?.type === 'poll' && data?.pollGroupId) {
        router.push(`/polls?openPoll=${data.pollGroupId}`);
      } else if (data?.eventId) {
        router.push(`/event/${data.eventId}`);
      } else if (data?.gameId) {
        router.push(`/game/${data.gameId}`);
      }
    };

    // Check for notification that opened the app (when app was completely closed)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log('App opened from notification:', response);
        const data = response.notification.request.content.data;
        if (isReady) {
          navigateFromNotification(data);
        } else {
          // Store for navigation once isReady becomes true
          pendingNotificationData.current = data as Record<string, any>;
        }
      }
    });

    // Listen for incoming notifications while app is open
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      const data = notification.request.content.data;
      const notificationType = data?.type as string;

      // Add to in-app notifications for game-related notifications
      if ((notificationType === 'game_reminder' || notificationType === 'game_invite') && data?.gameId) {
        addNotification({
          id: `notif-${Date.now()}`,
          type: notificationType as 'game_reminder' | 'game_invite',
          title: notification.request.content.title || (notificationType === 'game_invite' ? 'New Game Added!' : 'Game Reminder'),
          message: notification.request.content.body || '',
          gameId: data.gameId as string,
          toPlayerId: currentPlayerId,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
      // Add to in-app notifications for event/practice notifications
      else if ((notificationType === 'event_invite' || notificationType === 'practice_invite') && data?.eventId) {
        addNotification({
          id: `notif-${Date.now()}`,
          type: notificationType as 'event_invite' | 'practice_invite',
          title: notification.request.content.title || (notificationType === 'practice_invite' ? 'Practice Scheduled!' : 'New Event Added!'),
          message: notification.request.content.body || '',
          eventId: data.eventId as string,
          toPlayerId: currentPlayerId,
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    });

    // Listen for notification taps (when app is in background or foreground)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response);
      const data = response.notification.request.content.data;
      setTimeout(() => {
        if (isReady) {
          navigateFromNotification(data);
        } else {
          pendingNotificationData.current = data as Record<string, any>;
        }
      }, 100);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isLoggedIn, currentPlayerId, playersLength]);

  // Fire any pending notification navigation once router becomes ready
  useEffect(() => {
    if (!isReady || !pendingNotificationData.current) return;
    const data = pendingNotificationData.current;
    pendingNotificationData.current = null;
    setTimeout(() => {
      if (data?.type === 'direct_message' && data?.messageId) {
        router.push(`/messages?openMessageId=${data.messageId}`);
      } else if (data?.type === 'poll' && data?.pollGroupId) {
        router.push(`/polls?openPoll=${data.pollGroupId}`);
      } else if (data?.eventId) {
        router.push(`/event/${data.eventId}`);
      } else if (data?.gameId) {
        router.push(`/game/${data.gameId}`);
      }
    }, 200);
  }, [isReady]);

  useEffect(() => {
    // Wait for navigation and hydration before making auth decisions
    if (!isReady || !isHydrated) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'create-team' || segments[0] === 'register';
    const inTeamSelection = segments[0] === 'select-team';
    console.log('AUTH CHECK - isLoggedIn:', isLoggedIn, 'inAuthGroup:', inAuthGroup, 'pendingTeamIds:', pendingTeamIds, 'segments:', segments);

    // If there are pending teams to select from, go to team selection (and stay there).
    // Filter out ghost IDs that don't exist in the local teams array first.
    if (pendingTeamIds && pendingTeamIds.length > 0) {
      const knownTeamIds = new Set(useTeamStore.getState().teams.map(t => t.id));
      const validPendingIds = pendingTeamIds.filter(id => knownTeamIds.has(id));
      if (validPendingIds.length !== pendingTeamIds.length) {
        // Some IDs were ghosts — update store with the cleaned list and re-evaluate
        useTeamStore.setState({ pendingTeamIds: validPendingIds.length > 1 ? validPendingIds : null });
        return;
      }
      if (validPendingIds.length > 1) {
        if (!inTeamSelection) {
          console.log('PENDING TEAM SELECTION - redirecting to select-team');
          router.replace('/select-team');
        }
        return;
      }
    }

    // Always redirect to login if not logged in and not in auth flow
    if (!isLoggedIn) {
      if (!inAuthGroup) {
        console.log('NOT LOGGED IN - redirecting to login');
        router.replace('/login');
      }
    } else if (isLoggedIn && inAuthGroup) {
      console.log('LOGGED IN - redirecting to tabs');
      router.replace('/(tabs)');
    }
  }, [isLoggedIn, pendingTeamIds, segments, isReady, isHydrated, router]);

  // Handle deep links for Stripe Connect callback
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const url = event.url;
      if (url.includes('stripe-connect-success')) {
        // Only trust our domain or custom scheme (custom scheme kept for transition period)
        const isTrusted = url.startsWith('https://alignapps.com/') || url.startsWith('alignsports://');
        if (!isTrusted) {
          console.warn('[deep-link] Rejected untrusted origin for stripe-connect-success');
          return;
        }
        const queryString = url.includes('?') ? url.split('?')[1] : '';
        const params = new URLSearchParams(queryString);
        const accountId = params.get('accountId');
        const teamId = params.get('teamId');
        // Validate Stripe account ID format — all Stripe account IDs start with acct_
        if (accountId && !/^acct_[A-Za-z0-9]+$/.test(accountId)) {
          console.warn('[deep-link] Rejected invalid accountId format');
          return;
        }
        if (accountId) {
          const s = useTeamStore.getState();
          s.setTeamSettings({ stripeAccountId: accountId, stripeOnboardingComplete: true });
          if (teamId) {
            setTimeout(() => {
              const state = useTeamStore.getState();
              pushTeamToSupabase(teamId, state.teamName, state.teamSettings).catch(syncError('sync'));
            }, 50);
          }
        }
        router.replace('/stripe-setup');
      } else if (url.includes('stripe-connect-cancel')) {
        const isTrusted = url.startsWith('https://alignapps.com/') || url.startsWith('alignsports://');
        if (!isTrusted) return;
        router.replace('/stripe-setup');
      }
    };

    // Handle deep link when app is already open
    const subscription = Linking.addEventListener('url', handleUrl);

    // Handle deep link that launched the app from closed state
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <>
      <Stack>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="create-team" options={{ headerShown: false }} />
      <Stack.Screen name="create-new-team" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="select-team" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="game/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="messages"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="feature-request"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="report-bug"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="event/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="polls"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="my-availability"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="attendance"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="push-diagnostics"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="stripe-setup"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="file-storage"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="game-recap/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="season-summary"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="premium-insights"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="opponent-scouting"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="game-momentum"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="player-impact"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="monthly-splits"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="season-wrapped"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />
      <Stack.Screen
        name="payment-analytics"
        options={{ headerShown: false, presentation: 'card' }}
      />
      <Stack.Screen
        name="attendance-heatmap"
        options={{ headerShown: false, presentation: 'card' }}
      />
<Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="upgrade"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="player-profile/[id]"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />
    </Stack>

    {/* Push Notification Contextual Ramp — shown before the iOS system prompt */}
    <Modal
      visible={showNotifRamp}
      transparent
      animationType="slide"
      onRequestClose={() => setShowNotifRamp(false)}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 28, paddingBottom: 44 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Bell color="#fff" size={28} />
            </View>
            <Text style={{ color: '#f8fafc', fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' }}>
              Stay in the Loop
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
              Get instant alerts for game rainouts, schedule changes, payment reminders, and messages from your team.
            </Text>
          </View>

          <Pressable
            onPress={async () => {
              setShowNotifRamp(false);
              await doRegisterTokenRef.current?.();
            }}
            style={{ backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Allow Notifications</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowNotifRamp(false)}
            style={{ paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#64748b', fontSize: 15 }}>Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

function RootLayoutNav() {
  const teamColor = useTeamColor();
  const dynamicTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0f172a',
      card: '#1e293b',
      text: '#ffffff',
      border: '#334155',
      primary: teamColor,
    },
  };
  return (
    <ThemeProvider value={dynamicTheme}>
      <AuthNavigator />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <StatusBar style="light" translucent backgroundColor="transparent" />
              <RootLayoutNav />
              <AppToast />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
