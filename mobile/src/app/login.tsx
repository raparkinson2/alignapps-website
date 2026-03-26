import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { Mail, Lock, LogIn, UserPlus, Users, User, ChevronRight, X, KeyRound, ShieldQuestion, Phone, MailCheck, RefreshCw, KeySquare, Eye, EyeOff } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTeamStore, Player, getPlayerName } from '@/lib/store';
import { formatPhoneInput, unformatPhone } from '@/lib/phone';
import { signInWithEmail, sendPasswordResetSMS, resendConfirmationEmail, verifySMSOtpAndResetPassword, signInWithApple } from '@/lib/supabase-auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { secureLoginWithEmail, secureLoginWithPhone, secureResetPassword, verifyPlayerSecurityAnswer } from '@/lib/secure-auth';
import { loadTeamFromSupabase } from '@/lib/realtime-sync';
import { supabase } from '@/lib/supabase';

interface PlayerLoginCardProps {
  player: Player;
  index: number;
  onSelect: () => void;
}

function PlayerLoginCard({ player, index, onSelect }: PlayerLoginCardProps) {
  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 50).springify()}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onSelect();
        }}
        className="bg-slate-800/80 rounded-xl p-3 mb-2 border border-slate-700/50 active:bg-slate-700/80"
      >
        <View className="flex-row items-center">
          {player.avatar ? (
            <Image
              source={{ uri: player.avatar }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-11 h-11 rounded-full bg-cyan-500/20 items-center justify-center">
              <User size={22} color="#67e8f9" />
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-white font-semibold">{getPlayerName(player)}</Text>
            <Text className="text-slate-400 text-sm">#{player.number} - {player.position}</Text>
          </View>
          <ChevronRight size={20} color="#67e8f9" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { registered } = useLocalSearchParams<{ registered?: string }>();
  const loginWithEmail = useTeamStore((s) => s.loginWithEmail);
  const loginWithPhone = useTeamStore((s) => s.loginWithPhone);
  const players = useTeamStore((s) => s.players);
  const setCurrentPlayerId = useTeamStore((s) => s.setCurrentPlayerId);
  const setIsLoggedIn = useTeamStore((s) => s.setIsLoggedIn);
  const findPlayerByEmail = useTeamStore((s) => s.findPlayerByEmail);
  const findPlayerByPhone = useTeamStore((s) => s.findPlayerByPhone);

  const [identifier, setIdentifier] = useState(''); // Can be email or phone
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState<'identifier' | 'otp' | 'security' | 'password'>('identifier');
  const [foundPlayer, setFoundPlayer] = useState<Player | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // On web, Apple OAuth is always available
      setIsAppleAvailable(true);
      return;
    }
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable).catch(() => setIsAppleAvailable(false));
  }, []);

  // On web: listen for SIGNED_IN event after OAuth redirect
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleWebSession = async (user: { id: string; email?: string }) => {
      const email = user.email;
      if (!email) {
        setError('Could not retrieve your email from Apple. Please sign in with email instead.');
        setIsAppleLoading(false);
        return;
      }
      const { data: playerRows } = await supabase
        .from('players')
        .select('team_id, id')
        .eq('email', email.toLowerCase());

      if (playerRows && playerRows.length > 0) {
        for (const row of playerRows) {
          await loadTeamFromSupabase(row.team_id);
        }
        useTeamStore.setState({
          activeTeamId: playerRows[0].team_id,
          userEmail: email.toLowerCase(),
          currentPlayerId: playerRows[0].id,
          isLoggedIn: true,
        });
        if (playerRows.length > 1) {
          useTeamStore.setState({ pendingTeamIds: playerRows.map((r: { team_id: string }) => r.team_id) });
        }
      } else {
        useTeamStore.setState({ userEmail: email.toLowerCase() });
        router.push('/create-team?fromApple=1');
      }
      setIsAppleLoading(false);
    };

    // Check if already signed in (e.g. after OAuth redirect)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleWebSession(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleWebSession(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAppleSignIn = async () => {
    setIsAppleLoading(true);
    setError('');
    try {
      const result = await signInWithApple();
      if (!result.success) {
        if (result.error !== 'cancelled') {
          setError(result.error ?? 'Apple Sign In failed');
        }
        setIsAppleLoading(false);
        return;
      }
      const email = result.email;
      if (!email) {
        setError('Could not retrieve your email from Apple. Please sign in with email instead.');
        setIsAppleLoading(false);
        return;
      }
      // Try to find their player record in Supabase
      const { data: playerRows } = await supabase
        .from('players')
        .select('team_id, id')
        .eq('email', email.toLowerCase());

      if (playerRows && playerRows.length > 0) {
        for (const row of playerRows) {
          await loadTeamFromSupabase(row.team_id);
        }
        useTeamStore.setState({
          activeTeamId: playerRows[0].team_id,
          userEmail: email.toLowerCase(),
          currentPlayerId: playerRows[0].id,
          isLoggedIn: true,
        });
        if (playerRows.length > 1) {
          useTeamStore.setState({ pendingTeamIds: playerRows.map(r => r.team_id) });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        // New user — send them to create/join a team
        useTeamStore.setState({ userEmail: email.toLowerCase() });
        router.push('/create-team?fromApple=1');
      }
    } catch (err) {
      setError('Apple Sign In failed. Please try again.');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleAppleSignInWeb = async () => {
    setIsAppleLoading(true);
    setError('');
    const redirectTo = typeof window !== 'undefined'
      ? window.location.origin + '/login'
      : undefined;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setIsAppleLoading(false);
    }
    // If no error, the browser will redirect to Apple — loading state stays until redirect
  };

  // Helper to detect if input is phone or email
  const isPhoneNumber = (value: string): boolean => {
    const digitsOnly = value.replace(/\D/g, '');
    // If it starts with digits and has mostly digits, treat as phone
    return digitsOnly.length >= 7 && !/[@]/.test(value);
  };

  // Format input as user types (phone formatting if it looks like a phone)
  const handleIdentifierChange = (text: string) => {
    // If it contains @, it's definitely an email - don't format
    if (text.includes('@')) {
      setIdentifier(text);
      return;
    }

    // If it's all digits or phone-like characters, format as phone
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length > 0 && digitsOnly.length === text.replace(/[\s\-\(\)]/g, '').length) {
      setIdentifier(formatPhoneInput(text));
    } else {
      setIdentifier(text);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPassword(true);
    setResetIdentifier('');
    setSecurityAnswer('');
    setNewPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setResetEmail('');
    setResetStep('identifier');
    setFoundPlayer(null);
  };

  const handleFindAccount = async () => {
    const trimmedInput = resetIdentifier.trim();

    if (!trimmedInput) {
      Alert.alert('Phone Number Required', 'Please enter your phone number.');
      return;
    }

    // For phone numbers, send OTP via SMS
    if (isPhoneNumber(trimmedInput)) {
      setIsLoading(true);
      const phone = unformatPhone(trimmedInput);
      // Try to find the user's email from local store to send with request
      const player = findPlayerByPhone(phone);
      const result = await sendPasswordResetSMS(phone, player?.email);
      setIsLoading(false);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetEmail(phone); // Store phone number (reusing resetEmail state)
        setFoundPlayer(player || null);
        setResetStep('otp');
        return;
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', result.error || 'Failed to send reset code. Please try again.');
        return;
      }
    }

    // For email users, try to find their phone number in local store
    let player: Player | undefined;
    player = findPlayerByEmail(trimmedInput);

    if (player && player.phone) {
      // Found player with phone - send SMS to their phone
      setIsLoading(true);
      const result = await sendPasswordResetSMS(player.phone);
      setIsLoading(false);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetEmail(player.phone);
        setFoundPlayer(player);
        setResetStep('otp');
        Alert.alert('Code Sent', `We sent a code to your phone ending in ${player.phone.slice(-4)}`);
        return;
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', result.error || 'Failed to send reset code. Please try again.');
        return;
      }
    } else if (player) {
      // Player found but no phone - use security question if available
      setFoundPlayer(player);
      if (player.securityQuestion && player.securityAnswer) {
        setResetStep('security');
      } else {
        setResetStep('password');
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Account Not Found', 'No account found with this phone number or email. Please check and try again.');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      Alert.alert('Code Required', 'Please enter the 6-digit code from your text message.');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Password Required', 'Please enter your new password.');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Invalid Password', 'Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Please make sure your passwords match.');
      return;
    }

    setIsLoading(true);
    // Pass email if we have it from foundPlayer
    const playerEmail = foundPlayer?.email || findPlayerByPhone(resetEmail)?.email;
    const result = await verifySMSOtpAndResetPassword(resetEmail, otpCode.trim(), newPassword, playerEmail);
    setIsLoading(false);

    if (result.success) {
      // Also update local store password with hashed password
      const player = foundPlayer || findPlayerByPhone(resetEmail);
      if (player) {
        await secureResetPassword(player.id, newPassword);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Password Reset',
        'Your password has been reset successfully. You can now sign in with your new password.',
        [{ text: 'OK', onPress: () => {
          setShowForgotPassword(false);
          // Preserve the identifier they used (phone or email)
          // resetEmail contains the phone number used for SMS OTP
          setIdentifier(foundPlayer?.email || formatPhoneInput(resetEmail) || '');
          setPassword('');
        }}]
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', result.error || 'Failed to reset password. Please try again.');
    }
  };

  const handleVerifySecurityAnswer = async () => {
    if (!securityAnswer.trim()) {
      Alert.alert('Answer Required', 'Please enter your answer to the security question.');
      return;
    }
    if (foundPlayer && foundPlayer.securityAnswer) {
      const isValid = await verifyPlayerSecurityAnswer(foundPlayer.id, securityAnswer.trim());
      if (isValid) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setResetStep('password');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Incorrect Answer', 'The answer you provided does not match. Please try again.');
      }
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Invalid Password', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords Do Not Match', 'Please make sure your passwords match.');
      return;
    }
    if (foundPlayer) {
      await secureResetPassword(foundPlayer.id, newPassword);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password Reset', 'Your password has been reset. You can now sign in with your new password.');
      setShowForgotPassword(false);
      setIdentifier(resetIdentifier);
      setPassword('');
    }
  };

  const handleLogin = async () => {
    console.log('LOGIN: handleLogin called');
    console.log('LOGIN: identifier:', identifier, 'password length:', password.length);
    console.log('LOGIN: isPhoneNumber check:', isPhoneNumber(identifier.trim()));
    setError('');

    if (!identifier.trim()) {
      console.log('LOGIN: No identifier provided');
      setError('Please enter your email or phone number');
      return;
    }
    if (!password.trim()) {
      console.log('LOGIN: No password provided');
      setError('Please enter your password');
      return;
    }

    setIsLoading(true);

    try {
      const trimmedIdentifier = identifier.trim();

      // Try Supabase authentication first (for email)
      if (!isPhoneNumber(trimmedIdentifier)) {
        console.log('LOGIN: Attempting Supabase auth for email:', trimmedIdentifier);
        const supabaseResult = await signInWithEmail(trimmedIdentifier, password);
        console.log('LOGIN: Supabase result:', JSON.stringify(supabaseResult));

        // Check if email confirmation is required
        if (supabaseResult.emailNotConfirmed) {
          console.log('LOGIN: Email not confirmed');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setPendingConfirmEmail(trimmedIdentifier);
          setShowEmailConfirmation(true);
          setIsLoading(false);
          return;
        }

        if (supabaseResult.success) {
          console.log('LOGIN: Supabase auth successful, trying local login');
          // Also update local store for offline capability (using secure hashed comparison)
          const localResult = await secureLoginWithEmail(trimmedIdentifier, password);
          console.log('LOGIN: Local result:', JSON.stringify(localResult));
          if (localResult.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // AuthNavigator will handle redirect when isLoggedIn becomes true
            setIsLoading(false);
            return;
          }
          // Local password check failed (password not stored locally — Supabase is the source of truth).
          // Use loginWithEmailVerified to match the player by email without requiring a local password.
          console.log('LOGIN: Local login failed, using email-verified login');
          const verifiedResult = useTeamStore.getState().loginWithEmailVerified(trimmedIdentifier);
          if (verifiedResult.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // AuthNavigator will handle redirect
            setIsLoading(false);
            return;
          }
          // Player not found in local store yet — try loading their team(s) from Supabase
          console.log('LOGIN: Player not in local store, loading team data from Supabase');
          try {
            // Find ALL teams this user belongs to in Supabase players table
            const { data: playerRows } = await supabase
              .from('players')
              .select('team_id, id')
              .eq('email', trimmedIdentifier.toLowerCase());

            if (playerRows && playerRows.length > 0) {
              console.log('LOGIN: Found player in Supabase on', playerRows.length, 'team(s)');

              // Load teams sequentially to avoid race conditions in the teams[] array
              // (parallel loads all read the same state snapshot and the last write wins)
              for (const row of playerRows) {
                await loadTeamFromSupabase(row.team_id);
              }

              const firstRow = playerRows[0];
              useTeamStore.setState({
                activeTeamId: firstRow.team_id,
                userEmail: trimmedIdentifier.toLowerCase(),
                currentPlayerId: firstRow.id,
                isLoggedIn: true,
              });

              if (playerRows.length > 1) {
                // Multiple teams — let user pick
                useTeamStore.setState({
                  pendingTeamIds: playerRows.map(r => r.team_id),
                });
              }
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // AuthNavigator will handle redirect
              setIsLoading(false);
              return;
            }

            // No player row — check if they have an accepted invitation to recover team_id
            const { data: inviteRows } = await supabase
              .from('team_invitations')
              .select('team_id, team_data, first_name, last_name, jersey_number, position, roles')
              .eq('email', trimmedIdentifier.toLowerCase())
              .not('accepted_at', 'is', null)
              .limit(1);

            if (inviteRows && inviteRows.length > 0) {
              const inv = inviteRows[0];
              console.log('LOGIN: Found accepted invitation, recovering player for team:', inv.team_id);
              // Load the team data first
              await loadTeamFromSupabase(inv.team_id);
              // Create the player row in Supabase so future logins work
              const newPlayerId = `player-${Date.now()}`;
              const { pushPlayerToSupabase: pushPlayer } = await import('@/lib/realtime-sync');
              const { hashPassword } = await import('@/lib/crypto');
              const hashedPw = await hashPassword(password);
              const recoveredPlayer = {
                id: newPlayerId,
                firstName: inv.first_name,
                lastName: inv.last_name,
                email: trimmedIdentifier.toLowerCase(),
                number: inv.jersey_number || '',
                position: inv.position || 'C',
                positions: inv.position ? [inv.position] : ['C'],
                roles: inv.roles || [],
                password: hashedPw,
                status: 'active' as const,
              };
              await pushPlayer(recoveredPlayer as any, inv.team_id);
              // Add to local store
              useTeamStore.setState((s) => ({
                players: [...s.players, recoveredPlayer as any],
                activeTeamId: inv.team_id,
                userEmail: trimmedIdentifier.toLowerCase(),
                currentPlayerId: newPlayerId,
                isLoggedIn: true,
              }));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // AuthNavigator will handle redirect
              setIsLoading(false);
              return;
            }
          } catch (loadErr) {
            console.error('LOGIN: Failed to load team from Supabase:', loadErr);
          }
          // Truly no team data anywhere — show an error rather than getting stuck
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError('Account found but no team data. Please ask your team admin to re-invite you.');
          setIsLoading(false);
          return;
        }

        // If Supabase login failed with an error, show it
        if (supabaseResult.error) {
          console.log('LOGIN: Supabase error:', supabaseResult.error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setError(supabaseResult.error);
          setIsLoading(false);
          return;
        }
      } else {
        console.log('LOGIN: Using phone-based login for:', trimmedIdentifier);
      }

      // Fallback to local authentication (for phone or if Supabase fails)
      console.log('LOGIN: Attempting local auth');
      const result = isPhoneNumber(trimmedIdentifier)
        ? await secureLoginWithPhone(unformatPhone(trimmedIdentifier), password)
        : await secureLoginWithEmail(trimmedIdentifier, password);

      console.log('LOGIN: Local auth result:', JSON.stringify(result));

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // AuthNavigator will handle redirect when isLoggedIn becomes true
      } else if (isPhoneNumber(trimmedIdentifier) && result.error?.includes('No account found')) {
        // Phone user not in local store — try loading from Supabase
        console.log('LOGIN: Phone user not in local store, checking Supabase');
        try {
          const normalizedPhone = unformatPhone(trimmedIdentifier);
          const { data: phonePlayerRows } = await supabase
            .from('players')
            .select('team_id, id, password')
            .or(`phone.eq.${normalizedPhone},phone.eq.+1${normalizedPhone}`)
            .limit(1);

          if (phonePlayerRows && phonePlayerRows.length > 0) {
            const { team_id, id: playerId, password: storedPw } = phonePlayerRows[0];
            // Verify password against stored hash
            const { verifyPassword, isAlreadyHashed } = await import('@/lib/crypto');
            let passwordOk = false;
            if (storedPw) {
              if (isAlreadyHashed(storedPw)) {
                passwordOk = await verifyPassword(password, storedPw);
              } else {
                passwordOk = storedPw === password;
              }
            }
            if (!passwordOk) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              setError('Incorrect password');
              setIsLoading(false);
              return;
            }
            await loadTeamFromSupabase(team_id);
            useTeamStore.setState({
              activeTeamId: team_id,
              userPhone: normalizedPhone,
              currentPlayerId: playerId,
              isLoggedIn: true,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // AuthNavigator will handle redirect
            setIsLoading(false);
            return;
          }
        } catch (phoneLoadErr) {
          console.error('LOGIN: Phone Supabase lookup failed:', phoneLoadErr);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.error || 'Invalid phone number or password');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(result.error || 'Invalid email or password');
      }
    } catch (err: any) {
      console.error('LOGIN: Exception:', err?.message || err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError('Something went wrong. Please try again.');
    }

    setIsLoading(false);
  };

  const handleSelectPlayer = (playerId: string) => {
    setCurrentPlayerId(playerId);
    setIsLoggedIn(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // AuthNavigator handles redirect
  };

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0a0f1e', '#0d1b2e', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          {/* Header */}
          <Animated.View
            entering={FadeInUp.delay(50).springify()}
            className="items-center pt-6 pb-4"
          >
            <Image
              source={require('../../assets/align-sports-logo.png')}
              style={{ width: 240, height: 240 }}
              contentFit="contain"
            />
          </Animated.View>

          {/* Login Form */}
          <Animated.View
            entering={FadeInDown.delay(150).springify()}
            className="flex-1 px-6"
          >
            {/* Email/Phone Input */}
            <View className="mb-4">
              <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                {isPhoneNumber(identifier) ? (
                  <Phone size={20} color="#64748b" />
                ) : (
                  <Mail size={20} color="#64748b" />
                )}
                <TextInput
                  value={identifier}
                  onChangeText={handleIdentifierChange}
                  placeholder="Email or phone number"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 py-4 px-3 text-white text-base"
                />
              </View>
            </View>

            {/* Password Input */}
            <View className="mb-4">
              <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                <Lock size={20} color="#64748b" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPassword}
                  className="flex-1 py-4 px-3 text-white text-base"
                />
                <Pressable onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  {showPassword
                    ? <EyeOff size={20} color="#64748b" />
                    : <Eye size={20} color="#64748b" />
                  }
                </Pressable>
              </View>
            </View>

            {/* Success banner after registration */}
            {registered === '1' && (
              <Animated.View entering={FadeInDown.springify()} className="bg-green-500/20 border border-green-500/40 rounded-xl px-4 py-3 mb-4">
                <Text className="text-green-400 text-center text-sm font-medium">Account created! Sign in to continue.</Text>
              </Animated.View>
            )}

            {/* Error Message */}
            {error ? (
              <Animated.View entering={FadeInDown.springify()}>
                <Text className="text-red-400 text-center mb-4">{error}</Text>
              </Animated.View>
            ) : null}

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              disabled={isLoading}
              className="bg-cyan-500 rounded-xl py-4 flex-row items-center justify-center active:bg-cyan-600 disabled:opacity-50"
            >
              <LogIn size={20} color="white" />
              <Text className="text-white font-semibold text-lg ml-2">
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Text>
            </Pressable>

            {/* Forgot Password Link */}
            <Pressable
              onPress={handleForgotPassword}
              className="py-3 mt-2"
            >
              <Text className="text-cyan-400 text-center text-sm">Forgot Password?</Text>
            </Pressable>

            {/* Sign in with Apple */}
            {isAppleAvailable && (
              <View className="mt-2 mb-2">
                {Platform.OS === 'web' ? (
                  <Pressable
                    onPress={handleAppleSignInWeb}
                    disabled={isAppleLoading}
                    style={{
                      width: '100%',
                      height: 52,
                      backgroundColor: '#000',
                      borderRadius: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isAppleLoading ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
                      {isAppleLoading ? 'Redirecting to Apple...' : ' Sign in with Apple'}
                    </Text>
                  </Pressable>
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={12}
                    style={{ width: '100%', height: 52 }}
                    onPress={handleAppleSignIn}
                  />
                )}
                {isAppleLoading && Platform.OS !== 'web' && (
                  <Text className="text-slate-400 text-center text-sm mt-2">Signing in with Apple...</Text>
                )}
              </View>
            )}

            {/* Divider */}
            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-slate-700" />
              <Text className="text-slate-500 mx-4">or</Text>
              <View className="flex-1 h-px bg-slate-700" />
            </View>

            {/* Create Team Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/create-team');
              }}
              className="bg-slate-800/80 rounded-xl py-4 flex-row items-center justify-center border border-slate-700/50 active:bg-slate-700/80 mb-3"
            >
              <Users size={20} color="#67e8f9" />
              <Text className="text-cyan-400 font-semibold text-base ml-2">
                Create New Team
              </Text>
            </Pressable>

            {/* Join Team Button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/register');
              }}
              className="bg-slate-800/80 rounded-xl py-4 flex-row items-center justify-center border border-slate-700/50 active:bg-slate-700/80"
            >
              <UserPlus size={20} color="#67e8f9" />
              <Text className="text-cyan-400 font-semibold text-base ml-2">
                Join a Team
              </Text>
            </Pressable>
          </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        animationType="slide"
        transparent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <View className="flex-1 bg-black/60 justify-end">
            <View className="bg-slate-900 rounded-t-3xl">
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <Text className="text-white text-lg font-bold">Reset Password</Text>
                <Pressable
                  onPress={() => setShowForgotPassword(false)}
                  className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
                >
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>

              <View className="px-5 py-6">
                {resetStep === 'identifier' ? (
                  <>
                    {/* Identifier Step */}
                    <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center self-center mb-4">
                      <Phone size={32} color="#67e8f9" />
                    </View>
                    <Text className="text-white text-center text-lg font-semibold mb-2">
                      Reset Your Password
                    </Text>
                    <Text className="text-slate-400 text-center mb-6">
                      Enter your phone number and we'll text you a code
                    </Text>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-4">
                      <Phone size={20} color="#64748b" />
                      <TextInput
                        value={resetIdentifier}
                        onChangeText={(text) => {
                          const digitsOnly = text.replace(/\D/g, '');
                          if (digitsOnly.length > 0) {
                            setResetIdentifier(formatPhoneInput(text));
                          } else {
                            setResetIdentifier(text);
                          }
                        }}
                        placeholder="Phone number"
                        placeholderTextColor="#64748b"
                        keyboardType="phone-pad"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 py-4 px-3 text-white text-base"
                      />
                    </View>

                    <Pressable
                      onPress={handleFindAccount}
                      disabled={!resetIdentifier.trim() || isLoading}
                      className="bg-cyan-500 rounded-xl py-4 items-center active:bg-cyan-600 disabled:opacity-50"
                    >
                      <Text className="text-white font-semibold text-base">
                        {isLoading ? 'Sending Code...' : 'Send Code'}
                      </Text>
                    </Pressable>
                  </>
                ) : resetStep === 'security' ? (
                  <>
                    {/* Security Question Step */}
                    <View className="w-16 h-16 rounded-full bg-amber-500/20 items-center justify-center self-center mb-4">
                      <ShieldQuestion size={32} color="#f59e0b" />
                    </View>
                    <Text className="text-white text-center text-lg font-semibold mb-2">
                      Security Question
                    </Text>
                    <Text className="text-slate-400 text-center mb-2">
                      Account found for {getPlayerName(foundPlayer!)}
                    </Text>
                    <Text className="text-slate-300 text-center mb-6 font-medium">
                      {foundPlayer?.securityQuestion}
                    </Text>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-2">
                      <Lock size={20} color="#64748b" />
                      <TextInput
                        value={securityAnswer}
                        onChangeText={setSecurityAnswer}
                        placeholder="Your answer"
                        placeholderTextColor="#64748b"
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 py-4 px-3 text-white text-base"
                      />
                    </View>
                    <Text className="text-slate-500 text-xs mb-4">
                      Answers are not case-sensitive
                    </Text>

                    <Pressable
                      onPress={handleVerifySecurityAnswer}
                      disabled={!securityAnswer.trim()}
                      className="bg-cyan-500 rounded-xl py-4 items-center active:bg-cyan-600 disabled:opacity-50 mb-3"
                    >
                      <Text className="text-white font-semibold text-base">Verify Answer</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setResetStep('identifier');
                        setSecurityAnswer('');
                      }}
                      className="py-3"
                    >
                      <Text className="text-slate-400 text-center">Try a different email or phone</Text>
                    </Pressable>
                  </>
                ) : resetStep === 'otp' ? (
                  <>
                    {/* OTP Verification Step */}
                    <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center self-center mb-4">
                      <Phone size={32} color="#67e8f9" />
                    </View>
                    <Text className="text-white text-center text-lg font-semibold mb-2">
                      Enter Reset Code
                    </Text>
                    <Text className="text-slate-400 text-center mb-2">
                      We sent a 6-digit code via text to:
                    </Text>
                    <Text className="text-cyan-400 text-center font-semibold mb-6">
                      {resetEmail.length > 6 ? `(***) ***-${resetEmail.slice(-4)}` : resetEmail}
                    </Text>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-4">
                      <KeySquare size={20} color="#64748b" />
                      <TextInput
                        value={otpCode}
                        onChangeText={setOtpCode}
                        placeholder="6-digit code"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        maxLength={6}
                        className="flex-1 py-4 px-3 text-white text-base text-center tracking-widest"
                      />
                    </View>

                    <Text className="text-slate-400 text-sm mb-4">
                      Check your text messages
                    </Text>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-4">
                      <Lock size={20} color="#64748b" />
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="New password"
                        placeholderTextColor="#64748b"
                        secureTextEntry
                        className="flex-1 py-4 px-3 text-white text-base"
                      />
                    </View>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-4">
                      <Lock size={20} color="#64748b" />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        placeholderTextColor="#64748b"
                        secureTextEntry
                        className="flex-1 py-4 px-3 text-white text-base"
                      />
                    </View>

                    {newPassword.length > 0 && newPassword.length < 8 && (
                      <Text className="text-amber-400 text-sm mb-4">Password must be at least 8 characters</Text>
                    )}
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <Text className="text-red-400 text-sm mb-4">Passwords do not match</Text>
                    )}

                    <Pressable
                      onPress={handleVerifyOtp}
                      disabled={isLoading || otpCode.length < 6 || newPassword.length < 8 || newPassword !== confirmPassword}
                      className="bg-cyan-500 rounded-xl py-4 items-center active:bg-cyan-600 disabled:opacity-50 mb-3"
                    >
                      <Text className="text-white font-semibold text-base">
                        {isLoading ? 'Resetting...' : 'Reset Password'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={async () => {
                        setIsLoading(true);
                        const result = await sendPasswordResetSMS(resetEmail, foundPlayer?.email);
                        setIsLoading(false);
                        if (result.success) {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert('Code Sent', 'A new code has been sent to your phone.');
                        }
                      }}
                      disabled={isLoading}
                      className="py-3"
                    >
                      <Text className="text-cyan-400 text-center">Resend Code</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setResetStep('identifier');
                        setOtpCode('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      className="py-2"
                    >
                      <Text className="text-slate-400 text-center">Try a different email</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    {/* Password Reset Step */}
                    <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center self-center mb-4">
                      <KeyRound size={32} color="#22c55e" />
                    </View>
                    <Text className="text-white text-center text-lg font-semibold mb-2">
                      Create New Password
                    </Text>
                    <Text className="text-slate-400 text-center mb-6">
                      Account found for {getPlayerName(foundPlayer!)}. Enter your new password below.
                    </Text>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-4">
                      <Lock size={20} color="#64748b" />
                      <TextInput
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="New password"
                        placeholderTextColor="#64748b"
                        secureTextEntry
                        className="flex-1 py-4 px-3 text-white text-base"
                      />
                    </View>

                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4 mb-4">
                      <Lock size={20} color="#64748b" />
                      <TextInput
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Confirm password"
                        placeholderTextColor="#64748b"
                        secureTextEntry
                        className="flex-1 py-4 px-3 text-white text-base"
                      />
                    </View>

                    {newPassword.length > 0 && newPassword.length < 6 && (
                      <Text className="text-amber-400 text-sm mb-4">Password must be at least 6 characters</Text>
                    )}
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <Text className="text-red-400 text-sm mb-4">Passwords do not match</Text>
                    )}

                    <Pressable
                      onPress={handleResetPassword}
                      disabled={newPassword.length < 6 || newPassword !== confirmPassword}
                      className="bg-cyan-500 rounded-xl py-4 items-center active:bg-cyan-600 disabled:opacity-50 mb-3"
                    >
                      <Text className="text-white font-semibold text-base">Reset Password</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setResetStep('identifier')}
                      className="py-3"
                    >
                      <Text className="text-slate-400 text-center">Try a different email or phone</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Email Confirmation Required Modal */}
      <Modal
        visible={showEmailConfirmation}
        animationType="slide"
        transparent
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-900 rounded-2xl w-full max-w-sm">
            {/* Header */}
            <View className="items-center pt-6 pb-4">
              <View className="w-16 h-16 rounded-full bg-amber-500/20 items-center justify-center mb-4">
                <MailCheck size={32} color="#f59e0b" />
              </View>
              <Text className="text-white text-xl font-bold text-center mb-2">
                Confirm Your Email
              </Text>
              <Text className="text-slate-400 text-center px-4">
                We sent a confirmation link to:
              </Text>
              <Text className="text-cyan-400 font-semibold text-center mt-1">
                {pendingConfirmEmail}
              </Text>
            </View>

            <View className="px-5 pb-6">
              <Text className="text-slate-400 text-center text-sm mb-6">
                Please click the link in your email to verify your account before signing in. Check your spam/junk folder if you don't see it.
              </Text>

              {/* Resend Button */}
              <Pressable
                onPress={async () => {
                  setIsResending(true);
                  const result = await resendConfirmationEmail(pendingConfirmEmail);
                  setIsResending(false);
                  if (result.success) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Email Sent', 'A new confirmation email has been sent. Please check your inbox and spam/junk folder.');
                  } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Error', result.error || 'Failed to resend confirmation email.');
                  }
                }}
                disabled={isResending}
                className="bg-slate-800 rounded-xl py-4 flex-row items-center justify-center border border-slate-700/50 active:bg-slate-700 disabled:opacity-50 mb-3"
              >
                <RefreshCw size={18} color="#67e8f9" />
                <Text className="text-cyan-400 font-semibold ml-2">
                  {isResending ? 'Sending...' : 'Resend Confirmation Email'}
                </Text>
              </Pressable>

              {/* Try Again Button */}
              <Pressable
                onPress={() => {
                  setShowEmailConfirmation(false);
                  setPendingConfirmEmail('');
                }}
                className="bg-cyan-500 rounded-xl py-4 items-center active:bg-cyan-600"
              >
                <Text className="text-white font-semibold">Try Signing In Again</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
