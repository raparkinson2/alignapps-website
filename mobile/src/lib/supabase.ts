import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Please add SUPABASE_PUBLIC_URL and SUPABASE_PUBLIC_ANON to your environment variables.');
}

// Auth keys are stored in SecureStore (encrypted keychain/keystore).
// All other keys fall back to AsyncStorage.
const isAuthKey = (key: string) =>
  key.includes('auth-token') || key.startsWith('sb-');

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;
    // Migration: check AsyncStorage for existing sessions and move them over
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      try {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
      } catch { /* ignore migration errors */ }
      return legacy;
    }
    return null;
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Value may exceed SecureStore limits — fall back to AsyncStorage
    await AsyncStorage.setItem(key, value);
  }
}

async function secureRemove(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(key).catch(() => {});
  }
  await AsyncStorage.removeItem(key).catch(() => {});
}

/**
 * Custom storage adapter that:
 * - Uses SecureStore (encrypted) for auth token keys on native
 * - Validates session data before returning (prevents stale token refresh loops)
 * - Falls back to AsyncStorage on web or if SecureStore fails
 */
const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const value = isAuthKey(key)
        ? await secureGet(key)
        : await AsyncStorage.getItem(key);

      if (!value) return null;

      // Validate session data before handing it to Supabase
      try {
        const parsed = JSON.parse(value);
        if (key.includes('auth-token') && parsed) {
          const session = parsed.currentSession || parsed;
          const hasRefreshToken = !!session?.refresh_token;
          const expiresAt = session?.expires_at;
          const isExpired = expiresAt ? expiresAt * 1000 < Date.now() : false;

          if (!hasRefreshToken || isExpired) {
            console.log('Supabase: clearing stale/expired session from storage');
            await secureRemove(key);
            return null;
          }
        }
      } catch {
        // JSON parse failed — not a session object, pass through as-is
      }

      return value;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (isAuthKey(key)) {
        await secureSet(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage errors
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (isAuthKey(key)) {
        await secureRemove(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Handle auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    console.log('Auth token refreshed');
  } else if (event === 'SIGNED_OUT') {
    try {
      // Clear from SecureStore (native)
      if (Platform.OS !== 'web') {
        const authKey = `sb-${supabaseUrl.split('//')[1]?.split('.')[0]}-auth-token`;
        await SecureStore.deleteItemAsync(authKey).catch(() => {});
      }
      // Also sweep AsyncStorage for any legacy keys
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter(key => key.startsWith('sb-') || key.startsWith('supabase'));
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
      }
    } catch {
      // Ignore
    }
  }
});

/**
 * Clear invalid auth session when refresh token errors occur
 */
export async function clearInvalidSession(): Promise<void> {
  try {
    await supabase.auth.signOut();
    // Clear from SecureStore (native)
    if (Platform.OS !== 'web') {
      const authKey = `sb-${supabaseUrl.split('//')[1]?.split('.')[0]}-auth-token`;
      await SecureStore.deleteItemAsync(authKey).catch(() => {});
    }
    // Also clear any legacy AsyncStorage keys
    const keys = await AsyncStorage.getAllKeys();
    const supabaseKeys = keys.filter(key => key.startsWith('sb-') || key.startsWith('supabase'));
    if (supabaseKeys.length > 0) {
      await AsyncStorage.multiRemove(supabaseKeys);
    }
  } catch (e) {
    console.warn('Error clearing invalid session:', e);
  }
}

/**
 * Helper to add timeout to promises
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Network request timed out')), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Safe wrapper for getting session that handles refresh token errors and timeouts
 */
export async function getSafeSession() {
  try {
    // Add 10 second timeout to prevent app from hanging on slow networks
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      10000
    );

    if (error) {
      // Check for refresh token errors
      if (error.message?.includes('Refresh Token') ||
          error.message?.includes('refresh_token') ||
          error.message?.includes('Invalid Refresh Token')) {
        console.warn('Invalid refresh token detected, clearing session');
        await clearInvalidSession();
        return { session: null, error: null };
      }
      return { session: null, error };
    }

    return { session: data.session, error: null };
  } catch (e: any) {
    // Handle timeout errors - don't block the app
    if (e?.message?.includes('timed out')) {
      console.warn('Session check timed out, continuing without session');
      return { session: null, error: null };
    }
    // Handle refresh token errors
    if (e?.message?.includes('Refresh Token') ||
        e?.message?.includes('refresh_token')) {
      console.warn('Refresh token error caught, clearing session');
      await clearInvalidSession();
      return { session: null, error: null };
    }
    return { session: null, error: e };
  }
}
