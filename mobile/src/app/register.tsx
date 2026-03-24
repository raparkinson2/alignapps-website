import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { ChevronLeft, Mail, Lock, UserPlus, Check, AlertCircle, Camera, ImageIcon, SkipForward, Phone } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTeamStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { formatPhoneInput, unformatPhone } from '@/lib/phone';
import { signUpWithEmail, getCurrentUser } from '@/lib/supabase-auth';
import { secureRegisterInvitedPlayer, secureRegisterInvitedPlayerByPhone, secureLoginWithEmail, secureLoginWithPhone } from '@/lib/secure-auth';
import { signInWithEmail } from '@/lib/supabase-auth';
import { checkPendingInvitation, acceptTeamInvitation, TeamInvitation } from '@/lib/team-invitations';
import { pushPlayerToSupabase, loadTeamFromSupabase, findPlayerInSupabaseByContact } from '@/lib/realtime-sync';
import { hashPassword } from '@/lib/crypto';

export default function RegisterScreen() {
  const router = useRouter();
  const findPlayerByEmail = useTeamStore((s) => s.findPlayerByEmail);
  const findPlayerByPhone = useTeamStore((s) => s.findPlayerByPhone);
  const registerInvitedPlayer = useTeamStore((s) => s.registerInvitedPlayer);
  const registerInvitedPlayerByPhone = useTeamStore((s) => s.registerInvitedPlayerByPhone);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const teamName = useTeamStore((s) => s.teamName);
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const setCurrentPlayerId = useTeamStore((s) => s.setCurrentPlayerId);
  const setIsLoggedIn = useTeamStore((s) => s.setIsLoggedIn);
  const teamSettings = useTeamStore((s) => s.teamSettings);

  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState(''); // Can be email or phone
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showLoginLink, setShowLoginLink] = useState(false);  const [isLoading, setIsLoading] = useState(false);
  const [foundPlayer, setFoundPlayer] = useState<{ id: string; firstName: string; lastName: string; number: string } | null>(null);
  const [existingPassword, setExistingPassword] = useState(''); // For existing users joining new team
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // State for Supabase-based invitations (cross-device)
  const [supabaseInvitation, setSupabaseInvitation] = useState<TeamInvitation | null>(null);
  const [invitedTeamName, setInvitedTeamName] = useState<string>(''); // Team being joined (may be different from current)

  const hasTeam = players.length > 0;

  // Helper to detect if input is phone or email
  const isPhoneNumber = (value: string): boolean => {
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length >= 7 && !/[@]/.test(value);
  };

  // Format input as user types
  const handleIdentifierChange = (text: string) => {
    setShowLoginLink(false);
    setError('');
    if (text.includes('@')) {
      setIdentifier(text);
      return;
    }
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length > 0 && digitsOnly.length === text.replace(/[\s\-\(\)]/g, '').length) {
      setIdentifier(formatPhoneInput(text));
    } else {
      setIdentifier(text);
    }
  };

  // Password validation
  const validatePassword = (pwd: string): string[] => {
    const errors: string[] = [];
    if (pwd.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(pwd)) errors.push('At least one uppercase letter');
    if (!/[a-z]/.test(pwd)) errors.push('At least one lowercase letter');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) errors.push('At least one special symbol');
    return errors;
  };

  const passwordErrors = password.length > 0 ? validatePassword(password) : [];
  const isPasswordValid = passwordErrors.length === 0 && password.length > 0;

  const handleCheckInvitation = async () => {
    setError('');
    setIsLoading(true);
    console.log('REGISTER: ========== handleCheckInvitation START ==========');

    const trimmedIdentifier = identifier.trim();
    console.log('REGISTER: Checking identifier:', trimmedIdentifier);

    if (!trimmedIdentifier) {
      console.log('REGISTER: Empty identifier');
      setError('Please enter your email or phone number');
      setIsLoading(false);
      return;
    }

    // Validate format first
    if (isPhoneNumber(trimmedIdentifier)) {
      const rawPhone = unformatPhone(trimmedIdentifier);
      console.log('REGISTER: Detected phone number, raw:', rawPhone);
      if (rawPhone.length < 10) {
        setError('Please enter a valid phone number');
        setIsLoading(false);
        return;
      }
    } else if (!trimmedIdentifier.includes('@')) {
      console.log('REGISTER: Invalid email format');
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    } else {
      console.log('REGISTER: Detected email address');
    }

    try {
      // FIRST: Check Supabase for pending invitations (cross-device invitations)
      console.log('REGISTER: Calling checkPendingInvitation...');
      const supabaseResult = await checkPendingInvitation(trimmedIdentifier);
      console.log('REGISTER: Supabase invitation result:', JSON.stringify(supabaseResult));

      if (supabaseResult.success && supabaseResult.invitation) {
        // Found a Supabase invitation - this is an invitation from another device/team
        const invitation = supabaseResult.invitation;
        console.log('REGISTER: Found Supabase invitation for team:', invitation.team_name);
        setSupabaseInvitation(invitation);
        setInvitedTeamName(invitation.team_name);
        setFoundPlayer({
          id: invitation.id,
          firstName: invitation.first_name,
          lastName: invitation.last_name,
          number: invitation.jersey_number || '',
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Check if THIS invited person already has an account — check by their specific
        // email/phone, not whether the current device has any teams at all.
        const isPhone = isPhoneNumber(trimmedIdentifier);
        const currentStoreState = useTeamStore.getState();

        // For phone users: check if they already have a hashed password in the local store
        // (phone users don't have Supabase Auth accounts, so local password hash is the source of truth)
        // For email users: do NOT use local store password as the check — the players table password
        // can be set from partial/failed previous registration attempts and is unreliable.
        const hasExistingPhoneRecord = isPhone
          ? currentStoreState.teams.some(t => t.players.some(p =>
              p.phone?.replace(/\D/g, '') === unformatPhone(trimmedIdentifier).replace(/\D/g, '') && p.password
            )) || currentStoreState.players.some(p =>
              p.phone?.replace(/\D/g, '') === unformatPhone(trimmedIdentifier).replace(/\D/g, '') && p.password
            )
          : false;

        // Check if they're already authenticated in Supabase with this specific email
        // This is the authoritative check for email-based accounts
        const currentUser = await getCurrentUser();
        const isAlreadyLoggedInWithEmail = !isPhone && currentUser?.email?.toLowerCase() === trimmedIdentifier.toLowerCase();

        if (hasExistingPhoneRecord || isAlreadyLoggedInWithEmail) {
          console.log('REGISTER: Existing account detected for this invitee - going to step 4 (sign in flow)');
          setStep(4);
        } else {
          console.log('REGISTER: New user - going to step 2 (create account flow)');
          setStep(2);
        }
        setIsLoading(false);
        return;
      }

      console.log('REGISTER: No Supabase invitation found, checking local store');

      // Check if user already has an account (Supabase auth or local)
      const currentUser = await getCurrentUser();
      if (currentUser?.email?.toLowerCase() === trimmedIdentifier.toLowerCase()) {
        setError('You already have an account with this email.');
        setShowLoginLink(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setIsLoading(false);
        return;
      }

      // FALLBACK: Check local store (for invitations on the same device)
      let player;
      if (isPhoneNumber(trimmedIdentifier)) {
        const rawPhone = unformatPhone(trimmedIdentifier);
        player = findPlayerByPhone(rawPhone);
        console.log('REGISTER: Local phone lookup result:', player ? player.firstName : 'not found');

        if (!player) {
          setError('No invitation found for this phone number. Please ask your team admin to add you first.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsLoading(false);
          return;
        }

        // Set invited team name from local team
        setInvitedTeamName(teamName);

        if (player.password) {
          // Already registered — tell them clearly instead of silently going to step 4
          setError('You already have an account. Please sign in instead.');
          setShowLoginLink(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsLoading(false);
          return;
        }
      } else {
        player = findPlayerByEmail(trimmedIdentifier);
        console.log('REGISTER: Local email lookup result:', player ? player.firstName : 'not found');

        if (!player) {
          setError('No invitation found for this email. Please ask your team admin to add you first.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsLoading(false);
          return;
        }

        // Set invited team name from local team
        setInvitedTeamName(teamName);

        if (player.password) {
          // Already registered — tell them clearly instead of silently going to step 4
          setError('You already have an account. Please sign in instead.');
          setShowLoginLink(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsLoading(false);
          return;
        }
      }

      setFoundPlayer({ id: player.id, firstName: player.firstName, lastName: player.lastName, number: player.number });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('REGISTER: Found local player, going to step 2');
      setStep(2);
      setIsLoading(false);
    } catch (err: any) {
      console.error('REGISTER: handleCheckInvitation error:', err?.message || err);
      setError('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    setError('');

    if (!password.trim()) {
      setError('Please create a password');
      return;
    }
    const errors = validatePassword(password);
    if (errors.length > 0) {
      setError('Password does not meet requirements');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms of Service and Privacy Policy to continue');
      return;
    }
    if (!ageConfirmed) {
      setError('Please confirm you are 13 years of age or older');
      return;
    }

    // Move to photo step
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(3);
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Please allow access to your photos');
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Please allow access to your camera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleCompleteRegistration = async () => {
    setIsLoading(true);

    try {
      const trimmedIdentifier = identifier.trim();
      console.log('REGISTER: handleCompleteRegistration START, identifier:', trimmedIdentifier, 'supabaseInvitation:', !!supabaseInvitation);

      // For email users, also register with Supabase
      if (!isPhoneNumber(trimmedIdentifier)) {
        console.log('REGISTER: Attempting signUpWithEmail...');
        const supabaseResult = await signUpWithEmail(trimmedIdentifier, password);
        console.log('REGISTER: signUpWithEmail result:', JSON.stringify(supabaseResult));
        if (!supabaseResult.success) {
          // Check if user already exists but just needs to sign in
          if (supabaseResult.alreadyRegistered) {
            // User exists, try to sign in instead
            console.log('REGISTER: Already registered, attempting signInWithEmail...');
            const signInResult = await signInWithEmail(trimmedIdentifier, password);
            console.log('REGISTER: signInWithEmail result:', JSON.stringify(signInResult));
            if (!signInResult.success) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              // If they have a pending invitation but sign-in fails, it means they have
              // an existing account with a different password. Tell them to use the login screen.
              if (supabaseInvitation) {
                setError('An account already exists with this email. Please use the login screen to sign in and then accept the invitation.');
              } else {
                setError(signInResult.error || 'Failed to sign in. Please check your password.');
              }
              setIsLoading(false);
              return;
            }
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setError(supabaseResult.error || 'Failed to create account');
            setIsLoading(false);
            return;
          }
        }
      }

      // If this is a Supabase invitation (cross-device), load team fresh from Supabase
      if (supabaseInvitation) {
        console.log('REGISTER: supabaseInvitation path - team:', supabaseInvitation.team_name);
        console.log('REGISTER: Team ID:', supabaseInvitation.team_id);

        const hashedPassword = await hashPassword(password);
        const isPhone = isPhoneNumber(trimmedIdentifier);

        // Load the full team fresh from Supabase — this gives us live data, not stale JSON
        const loaded = await loadTeamFromSupabase(supabaseInvitation.team_id);
        if (!loaded) {
          setError('Failed to load team data. Please check your connection and try again.');
          setIsLoading(false);
          return;
        }

        // Find the existing player row by email or phone (admin already pushed them to Supabase)
        const freshPlayers = useTeamStore.getState().players;
        const existingPlayer = freshPlayers.find(p =>
          isPhone
            ? p.phone?.replace(/\D/g, '') === unformatPhone(trimmedIdentifier).replace(/\D/g, '')
            : p.email?.toLowerCase() === trimmedIdentifier.toLowerCase()
        );

        let playerId: string;

        if (existingPlayer) {
          // Player row already exists — just update with password + avatar
          playerId = existingPlayer.id;
          const updates: any = { password: hashedPassword };
          if (avatar) updates.avatar = avatar;
          useTeamStore.getState().updatePlayer(playerId, updates);
          await pushPlayerToSupabase(
            { ...existingPlayer, ...updates },
            supabaseInvitation.team_id
          );
        } else {
          // Player row doesn't exist in local store — query Supabase directly to avoid creating a duplicate
          const supabasePlayer = await findPlayerInSupabaseByContact(
            supabaseInvitation.team_id,
            !isPhone ? trimmedIdentifier.toLowerCase() : undefined,
            isPhone ? unformatPhone(trimmedIdentifier) : undefined,
          );

          if (supabasePlayer) {
            // Found via direct Supabase query — reuse the existing row
            playerId = supabasePlayer.id;
            const updates: any = { password: hashedPassword };
            if (avatar) updates.avatar = avatar;
            useTeamStore.getState().updatePlayer(playerId, updates);
            await pushPlayerToSupabase(
              { ...supabasePlayer, ...updates },
              supabaseInvitation.team_id,
            );
            // Reload so local store reflects the updated player
            await loadTeamFromSupabase(supabaseInvitation.team_id);
          } else {
            // Truly no existing row — create one (admin push may have failed)
            playerId = `player-${Date.now()}`;
            const newPlayer = {
              id: playerId,
              firstName: supabaseInvitation.first_name,
              lastName: supabaseInvitation.last_name,
              email: !isPhone ? trimmedIdentifier.toLowerCase() : undefined,
              phone: isPhone ? unformatPhone(trimmedIdentifier) : undefined,
              number: supabaseInvitation.jersey_number || '',
              position: supabaseInvitation.position || 'C',
              positions: supabaseInvitation.position ? [supabaseInvitation.position] : ['C'],
              roles: supabaseInvitation.roles || [],
              password: hashedPassword,
              avatar: avatar || undefined,
              status: 'active' as const,
            };
            await pushPlayerToSupabase(newPlayer as any, supabaseInvitation.team_id);
            // Reload so local store has the new player
            await loadTeamFromSupabase(supabaseInvitation.team_id);
          }
        }

        // Mark the invitation as accepted
        await acceptTeamInvitation(supabaseInvitation.id);

        // Set logged-in state with activeTeamId so auth guard and realtime sync work correctly
        useTeamStore.setState({
          activeTeamId: supabaseInvitation.team_id,
          userEmail: !isPhone ? trimmedIdentifier.toLowerCase() : undefined,
          userPhone: isPhone ? unformatPhone(trimmedIdentifier) : undefined,
          currentPlayerId: playerId,
          isLoggedIn: true,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
        setIsLoading(false);
        return;
      }

      // Local invitation flow (same device)
      // Register locally with hashed password
      console.log('REGISTER: Local invitation flow, calling secureRegister...');
      const result = isPhoneNumber(trimmedIdentifier)
        ? await secureRegisterInvitedPlayerByPhone(unformatPhone(trimmedIdentifier), password)
        : await secureRegisterInvitedPlayer(trimmedIdentifier, password);

      console.log('REGISTER: secureRegister result:', JSON.stringify(result));

      if (result.success && result.playerId) {
        // Save optional avatar
        if (avatar) {
          useTeamStore.getState().updatePlayer(result.playerId, { avatar });
        }

        // Push player to Supabase so re-login works after app restart
        try {
          const storeState = useTeamStore.getState();
          const savedPlayer = storeState.players.find(p => p.id === result.playerId);
          if (savedPlayer && storeState.activeTeamId) {
            await pushPlayerToSupabase(savedPlayer, storeState.activeTeamId);
          }
        } catch (pushErr) {
          console.error('REGISTER: Failed to push local player to Supabase:', pushErr);
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Clear login state — send user to login screen to sign in properly
        useTeamStore.setState({ isLoggedIn: false, currentPlayerId: null });
        router.replace({ pathname: '/login', params: { registered: '1' } });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.error || 'Failed to create account');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log('REGISTER: Error completing registration:', msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Something went wrong. Please try again.');
    }

    setIsLoading(false);
  };

  // Handler for existing users signing in to join a new team
  const handleExistingUserLogin = async () => {
    setError('');

    if (!existingPassword.trim()) {
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const trimmedIdentifier = identifier.trim();

      // Verify the password before proceeding
      if (!isPhoneNumber(trimmedIdentifier)) {
        // Email: verify with Supabase Auth
        const supabaseResult = await signInWithEmail(trimmedIdentifier, existingPassword);
        if (!supabaseResult.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(supabaseResult.error || 'Incorrect password');
          setIsLoading(false);
          return;
        }
      } else {
        // Phone: verify against local store (phone accounts use local hashed passwords)
        const phoneVerifyResult = await secureLoginWithPhone(unformatPhone(trimmedIdentifier), existingPassword);
        if (!phoneVerifyResult.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(phoneVerifyResult.error || 'Incorrect password');
          setIsLoading(false);
          return;
        }
      }

      // If this is a Supabase invitation (cross-device), load team fresh from Supabase
      if (supabaseInvitation) {
        console.log('REGISTER: Existing user joining team from Supabase invitation:', supabaseInvitation.team_name);
        console.log('REGISTER: Team ID:', supabaseInvitation.team_id);

        const isPhone = isPhoneNumber(trimmedIdentifier);

        // Load the full team fresh from Supabase
        const loaded = await loadTeamFromSupabase(supabaseInvitation.team_id);
        if (!loaded) {
          setError('Failed to load team data. Please check your connection and try again.');
          setIsLoading(false);
          return;
        }

        // Find the existing player row by email or phone
        const freshPlayers = useTeamStore.getState().players;
        console.log('REGISTER: freshPlayers count:', freshPlayers.length, 'looking for:', trimmedIdentifier);
        const existingPlayer = freshPlayers.find(p =>
          isPhone
            ? p.phone?.replace(/\D/g, '') === unformatPhone(trimmedIdentifier).replace(/\D/g, '')
            : p.email?.toLowerCase() === trimmedIdentifier.toLowerCase()
        );
        console.log('REGISTER: existingPlayer found:', existingPlayer ? existingPlayer.id : 'none');

        let playerId: string;

        if (existingPlayer) {
          playerId = existingPlayer.id;
          console.log('REGISTER: Updating existing player password...');
          const hashedPw = await hashPassword(existingPassword);
          const updates: { password: string } = { password: hashedPw };
          useTeamStore.getState().updatePlayer(playerId, updates);
          console.log('REGISTER: Pushing player to Supabase...');
          await pushPlayerToSupabase({ ...existingPlayer, ...updates }, supabaseInvitation.team_id);
          console.log('REGISTER: Player pushed successfully');
        } else {
          console.log('REGISTER: Player not in local store — querying Supabase directly...');
          const isPhoneLocal = isPhoneNumber(trimmedIdentifier);
          const supabasePlayer = await findPlayerInSupabaseByContact(
            supabaseInvitation.team_id,
            !isPhoneLocal ? trimmedIdentifier.toLowerCase() : undefined,
            isPhoneLocal ? unformatPhone(trimmedIdentifier) : undefined,
          );

          if (supabasePlayer) {
            // Found via direct Supabase query — reuse the existing row
            playerId = supabasePlayer.id;
            console.log('REGISTER: Found existing player in Supabase directly:', playerId);
            const hashedPw = await hashPassword(existingPassword);
            const updates: { password: string } = { password: hashedPw };
            useTeamStore.getState().updatePlayer(playerId, updates);
            await pushPlayerToSupabase({ ...supabasePlayer, ...updates }, supabaseInvitation.team_id);
            await loadTeamFromSupabase(supabaseInvitation.team_id);
          } else {
            console.log('REGISTER: Creating new player row (no existing row found anywhere)...');
            playerId = `player-${Date.now()}`;
            const hashedPw = await hashPassword(existingPassword);
            const newPlayer = {
              id: playerId,
              firstName: supabaseInvitation.first_name,
              lastName: supabaseInvitation.last_name,
              email: !isPhoneLocal ? trimmedIdentifier.toLowerCase() : undefined,
              phone: isPhoneLocal ? unformatPhone(trimmedIdentifier) : undefined,
              number: supabaseInvitation.jersey_number || '',
              position: supabaseInvitation.position || 'C',
              positions: supabaseInvitation.position ? [supabaseInvitation.position] : ['C'],
              roles: supabaseInvitation.roles || [],
              password: hashedPw,
              status: 'active' as const,
            };
            await pushPlayerToSupabase(newPlayer as any, supabaseInvitation.team_id);
            await loadTeamFromSupabase(supabaseInvitation.team_id);
            console.log('REGISTER: New player created and pushed');
          }
        }

        console.log('REGISTER: Accepting invitation...');
        await acceptTeamInvitation(supabaseInvitation.id);
        console.log('REGISTER: Invitation accepted, logging in directly...');

        // Set logged-in state with activeTeamId so auth guard and realtime sync work correctly
        useTeamStore.setState({
          activeTeamId: supabaseInvitation.team_id,
          userEmail: !isPhone ? trimmedIdentifier.toLowerCase() : undefined,
          userPhone: isPhone ? unformatPhone(trimmedIdentifier) : undefined,
          currentPlayerId: playerId,
          isLoggedIn: true,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
        setIsLoading(false);
        return;
      }

      // Local invitation flow - login locally to set up multi-team state
      const result = isPhoneNumber(trimmedIdentifier)
        ? await secureLoginWithPhone(unformatPhone(trimmedIdentifier), existingPassword)
        : await secureLoginWithEmail(trimmedIdentifier, existingPassword);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // If user has multiple teams, go to team selector
        if (result.multipleTeams) {
          router.replace('/select-team');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.error || 'Incorrect password');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.log('REGISTER: Error in existing user login:', msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Something went wrong. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['#0c4a6e', '#0f172a', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          {/* Header */}
          <Animated.View
            entering={FadeInUp.delay(50).springify()}
            className="flex-row items-center px-5 pt-2 pb-4"
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (step === 4) {
                  setStep(1);
                  setError('');
                  setFoundPlayer(null);
                  setExistingPassword('');
                } else if (step === 3) {
                  setStep(2);
                  setError('');
                } else if (step === 2) {
                  setStep(1);
                  setError('');
                  setFoundPlayer(null);
                } else {
                  router.back();
                }
              }}
              className="flex-row items-center"
            >
              <ChevronLeft size={24} color="#67e8f9" />
              <Text className="text-cyan-400 text-base ml-1">Back</Text>
            </Pressable>
          </Animated.View>

          <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
            {/* Step 1: Check Email or Phone */}
            {step === 1 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-8 mt-4">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <UserPlus size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Create Account</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    {hasTeam
                      ? `Join ${teamName}`
                      : 'Enter the email or phone number your team admin used to invite you'}
                  </Text>
                </View>

                {/* Email/Phone Input - Auto-detect */}
                <View className="mb-4">
                  <Text className="text-slate-400 text-sm mb-2">Email or Phone Number</Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                    {isPhoneNumber(identifier) ? (
                      <Phone size={20} color="#64748b" />
                    ) : (
                      <Mail size={20} color="#64748b" />
                    )}
                    <TextInput
                      value={identifier}
                      onChangeText={handleIdentifierChange}
                      placeholder="your@email.com or (555)123-4567"
                      placeholderTextColor="#64748b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 py-4 px-3 text-white text-base"
                    />
                  </View>
                </View>

                {/* Info Box */}
                <View className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700/50">
                  <View className="flex-row items-start">
                    <AlertCircle size={20} color="#67e8f9" />
                    <Text className="text-slate-400 text-sm ml-3 flex-1">
                      Your team admin needs to add you to the team first using this email or phone number. If you haven't been invited yet, ask them to add you.
                    </Text>
                  </View>
                </View>

                {/* Error Message */}
                {error ? (
                  <Animated.View entering={FadeInDown.springify()} className="mb-1">
                    <Text className="text-red-400 text-center mb-3">{error}</Text>
                    {showLoginLink && (
                      <Pressable
                        onPress={() => router.replace('/login')}
                        className="bg-slate-700 rounded-xl py-3 flex-row items-center justify-center active:bg-slate-600"
                      >
                        <Text className="text-cyan-400 font-semibold text-base">Go to Sign In</Text>
                      </Pressable>
                    )}
                  </Animated.View>
                ) : null}

                {/* Continue Button */}
                <Pressable
                  onPress={handleCheckInvitation}
                  disabled={isLoading}
                  className={cn(
                    "bg-cyan-500 rounded-xl py-4 flex-row items-center justify-center mb-4",
                    isLoading ? "opacity-60" : "active:bg-cyan-600"
                  )}
                >
                  <Text className="text-white font-semibold text-lg">
                    {isLoading ? 'Checking...' : 'Check Invitation'}
                  </Text>
                </Pressable>

                {/* Already have account */}
                <Pressable
                  onPress={() => router.back()}
                  className="py-3"
                >
                  <Text className="text-slate-400 text-center">
                    Already have an account? <Text className="text-cyan-400">Sign In</Text>
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Step 2: Create Password */}
            {step === 2 && foundPlayer && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                {/* Found Player Card */}
                <View className="bg-green-500/10 rounded-xl p-4 mb-6 border border-green-500/30">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                      <Check size={20} color="#22c55e" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-green-400 font-semibold">Invitation Found!</Text>
                      <Text className="text-slate-400 text-sm">
                        Welcome, {foundPlayer.firstName} {foundPlayer.lastName} (#{foundPlayer.number})
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="items-center mb-8">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Lock size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Create Password</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Secure your account with a password
                  </Text>
                </View>

                <View className="mb-4">
                  <Text className="text-slate-400 text-sm mb-2">Password</Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                    <Lock size={20} color="#64748b" />
                    <TextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Create a password"
                      placeholderTextColor="#64748b"
                      secureTextEntry
                      className="flex-1 py-4 px-3 text-white text-base"
                    />
                  </View>
                </View>

                {/* Password Requirements */}
                <View className="mb-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                  <Text className="text-slate-400 text-sm mb-2">Password must have:</Text>
                  {[
                    { label: 'At least 8 characters', met: password.length >= 8 },
                    { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
                    { label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
                    { label: 'At least one special symbol', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
                  ].map((req) => (
                    <View key={req.label} className="flex-row items-center mt-1">
                      <View className={cn(
                        'w-4 h-4 rounded-full items-center justify-center mr-2',
                        password.length > 0 && req.met ? 'bg-green-500' : 'bg-slate-600'
                      )}>
                        {password.length > 0 && req.met && <Check size={10} color="white" />}
                      </View>
                      <Text className={cn(
                        'text-sm',
                        password.length > 0 && req.met ? 'text-green-400' : 'text-slate-500'
                      )}>
                        {req.label}
                      </Text>
                    </View>
                  ))}
                </View>

                <View className="mb-6">
                  <Text className="text-slate-400 text-sm mb-2">Confirm Password</Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                    <Lock size={20} color="#64748b" />
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm your password"
                      placeholderTextColor="#64748b"
                      secureTextEntry
                      className="flex-1 py-4 px-3 text-white text-base"
                    />
                  </View>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <Text className="text-red-400 text-sm mt-2">Passwords do not match</Text>
                  )}
                  {confirmPassword.length > 0 && password === confirmPassword && isPasswordValid && (
                    <Text className="text-green-400 text-sm mt-2">Passwords match</Text>
                  )}
                </View>

                {/* Terms Acceptance */}
                <Pressable
                  onPress={() => {
                    setTermsAccepted(v => !v);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="flex-row items-center mb-3 gap-3"
                >
                  <View className={cn(
                    'w-5 h-5 rounded border-2 items-center justify-center',
                    termsAccepted ? 'bg-cyan-500 border-cyan-500' : 'border-slate-500 bg-transparent'
                  )}>
                    {termsAccepted && <Check size={12} color="white" />}
                  </View>
                  <Text className="text-slate-400 text-sm flex-1">
                    By creating an account, I agree to the{' '}
                    <Text className="text-cyan-400" onPress={() => Linking.openURL('https://alignapps.com/privacy')}>Privacy Policy</Text>
                    {' '}and{' '}
                    <Text className="text-cyan-400" onPress={() => Linking.openURL('https://alignapps.com/terms')}>Terms of Service</Text>
                  </Text>
                </Pressable>

                {/* Age Confirmation */}
                <Pressable
                  onPress={() => {
                    setAgeConfirmed(v => !v);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  className="flex-row items-center mb-8 gap-3"
                >
                  <View className={cn(
                    'w-5 h-5 rounded border-2 items-center justify-center',
                    ageConfirmed ? 'bg-cyan-500 border-cyan-500' : 'border-slate-500 bg-transparent'
                  )}>
                    {ageConfirmed && <Check size={12} color="white" />}
                  </View>
                  <Text className="text-slate-400 text-sm flex-1">
                    I confirm that I am 13 years of age or older
                  </Text>
                </Pressable>

                {/* Error Message */}
                {error ? (
                  <Animated.View entering={FadeInDown.springify()}>
                    <Text className="text-red-400 text-center mb-4">{error}</Text>
                  </Animated.View>
                ) : null}

                {/* Create Account Button */}
                <Pressable
                  onPress={handleCreateAccount}
                  disabled={!termsAccepted}
                  className="rounded-xl py-4 flex-row items-center justify-center mb-8"
                  style={{ backgroundColor: termsAccepted ? '#06b6d4' : '#1e3a4a', opacity: termsAccepted ? 1 : 0.5 }}
                >
                  <Text className="text-white font-semibold text-lg">Continue</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Step 3: Profile Photo (Optional) */}
            {step === 3 && foundPlayer && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-8 mt-4">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Camera size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Profile Photo</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Add a photo so your teammates can recognize you
                  </Text>
                </View>

                {/* Photo Preview */}
                <View className="items-center mb-6">
                  {avatar ? (
                    <View className="relative">
                      <Image
                        source={{ uri: avatar }}
                        style={{ width: 120, height: 120, borderRadius: 60 }}
                        contentFit="cover"
                      />
                      <Pressable
                        onPress={() => setAvatar(null)}
                        className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-red-500 items-center justify-center"
                      >
                        <Text className="text-white font-bold">X</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View className="w-32 h-32 rounded-full bg-slate-800 items-center justify-center border-2 border-dashed border-slate-600">
                      <ImageIcon size={40} color="#64748b" />
                    </View>
                  )}
                </View>

                {/* Photo Buttons */}
                <View className="flex-row justify-center mb-6">
                  <Pressable
                    onPress={handleTakePhoto}
                    className="flex-row items-center bg-slate-800/80 rounded-xl px-5 py-3 mr-3 border border-slate-700/50 active:bg-slate-700"
                  >
                    <Camera size={20} color="#67e8f9" />
                    <Text className="text-cyan-400 font-medium ml-2">Camera</Text>
                  </Pressable>

                  <Pressable
                    onPress={handlePickImage}
                    className="flex-row items-center bg-slate-800/80 rounded-xl px-5 py-3 border border-slate-700/50 active:bg-slate-700"
                  >
                    <ImageIcon size={20} color="#67e8f9" />
                    <Text className="text-cyan-400 font-medium ml-2">Gallery</Text>
                  </Pressable>
                </View>

                {/* Error Message */}
                {error ? (
                  <Animated.View entering={FadeInDown.springify()}>
                    <Text className="text-red-400 text-center mb-4">{error}</Text>
                  </Animated.View>
                ) : null}

                {/* Complete Registration Button */}
                <Pressable
                  onPress={handleCompleteRegistration}
                  disabled={isLoading}
                  className="bg-cyan-500 rounded-xl py-4 flex-row items-center justify-center active:bg-cyan-600 disabled:opacity-50 mb-3"
                >
                  <Text className="text-white font-semibold text-lg">
                    {isLoading ? 'Creating Account...' : 'Complete Setup'}
                  </Text>
                </Pressable>

                {/* Skip Button */}
                {!avatar && (
                  <Pressable
                    onPress={handleCompleteRegistration}
                    disabled={isLoading}
                    className="flex-row items-center justify-center py-3 mb-8"
                  >
                    <SkipForward size={18} color="#64748b" />
                    <Text className="text-slate-400 font-medium ml-2">Skip for now</Text>
                  </Pressable>
                )}
              </Animated.View>
            )}

            {/* Step 4: Existing User Sign In to Join New Team */}
            {step === 4 && foundPlayer && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                {/* Found Player Card */}
                <View className="bg-green-500/10 rounded-xl p-4 mb-6 border border-green-500/30">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center">
                      <Check size={20} color="#22c55e" />
                    </View>
                    <View className="ml-3">
                      <Text className="text-green-400 font-semibold">Invitation Found!</Text>
                      <Text className="text-slate-400 text-sm">
                        Welcome back, {foundPlayer.firstName} {foundPlayer.lastName}
                      </Text>
                    </View>
                  </View>
                </View>

                <View className="items-center mb-8">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Lock size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Sign In to Join</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    You already have an account. Enter your password to join {invitedTeamName || 'the new team'}.
                  </Text>
                </View>

                <View className="mb-6">
                  <Text className="text-slate-400 text-sm mb-2">Password</Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                    <Lock size={20} color="#64748b" />
                    <TextInput
                      value={existingPassword}
                      onChangeText={setExistingPassword}
                      placeholder="Enter your password"
                      placeholderTextColor="#64748b"
                      secureTextEntry
                      className="flex-1 py-4 px-3 text-white text-base"
                    />
                  </View>
                </View>

                {/* Error Message */}
                {error ? (
                  <Animated.View entering={FadeInDown.springify()}>
                    <Text className="text-red-400 text-center mb-4">{error}</Text>
                  </Animated.View>
                ) : null}

                {/* Sign In Button */}
                <Pressable
                  onPress={handleExistingUserLogin}
                  disabled={isLoading}
                  className="bg-cyan-500 rounded-xl py-4 flex-row items-center justify-center active:bg-cyan-600 disabled:opacity-50 mb-4"
                >
                  <Text className="text-white font-semibold text-lg">
                    {isLoading ? 'Signing In...' : 'Sign In & Join Team'}
                  </Text>
                </Pressable>

                {/* Forgot Password Link */}
                <Pressable
                  onPress={() => router.push('/login')}
                  className="py-3"
                >
                  <Text className="text-slate-400 text-center">
                    Forgot your password? <Text className="text-cyan-400">Reset it here</Text>
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
