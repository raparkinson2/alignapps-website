import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTeamStore, useStoreHydrated, defaultNotificationPreferences } from '@/lib/store';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { clearInvalidSession, getSafeSession, supabase } from '@/lib/supabase';
import { startRealtimeSync, stopRealtimeSync, pushPlayerToSupabase, loadTeamFromSupabase } from '@/lib/realtime-sync';
import { BACKEND_URL } from '@/lib/config';

export const unstable_settings = {
  initialRouteName: 'login',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Custom dark theme for hockey app
const HockeyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0f172a',
    card: '#1e293b',
    text: '#ffffff',
    border: '#334155',
    primary: '#67e8f9',
  },
};

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
  const navigationRef = useNavigationContainerRef();
  const [isReady, setIsReady] = useState(false);
  const isHydrated = useStoreHydrated();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const didFetchAllTeams = useRef(false);
  const pushTokenRegistered = useRef<string | null>(null); // tracks which playerId has registered

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

  // Register for push notifications when logged in
  useEffect(() => {
    if (!isLoggedIn || !currentPlayerId) return;
    // Only register once per player session to avoid duplicate APNs calls
    if (pushTokenRegistered.current === currentPlayerId) return;

    const registerToken = async () => {
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

    // Register immediately
    registerToken();

    // Check for notification that opened the app (when app was completely closed)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log('App opened from notification:', response);
        const data = response.notification.request.content.data;
        if (isReady) {
          if (data?.eventId) {
            router.push(`/event/${data.eventId}`);
          } else if (data?.gameId) {
            router.push(`/game/${data.gameId}`);
          }
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
      // Small delay to ensure navigation is ready
      setTimeout(() => {
        if (isReady) {
          // Navigate to event if it's an event/practice notification
          if (data?.eventId) {
            router.push(`/event/${data.eventId}`);
          }
          // Navigate to game if it's a game notification
          else if (data?.gameId) {
            router.push(`/game/${data.gameId}`);
          }
          // Navigate to polls if it's a poll notification
          else if (data?.type === 'poll' && data?.pollGroupId) {
            router.push(`/polls?openPoll=${data.pollGroupId}`);
          }
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

  return (
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
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={HockeyDarkTheme}>
      <AuthNavigator />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
