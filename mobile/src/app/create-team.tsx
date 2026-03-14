import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState, useEffect } from 'react';
import { ChevronLeft, User, Mail, Lock, Users, Check, Palette, X, Camera, ImageIcon, Phone, Hash, Edit3, UserCog, UserMinus } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTeamStore, Sport, SPORT_NAMES, Player, PlayerRole, PlayerStatus, SPORT_POSITIONS, useCreateTeamFormStore, useCreateTeamFormValid } from '@/lib/store';
import { cn } from '@/lib/cn';
import { formatPhoneInput, unformatPhone } from '@/lib/phone';
import Svg, { Path, Circle as SvgCircle, Line, Ellipse } from 'react-native-svg';
import { signUpWithEmail, checkEmailExists, checkPhoneExists } from '@/lib/supabase-auth';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import { hashPassword } from '@/lib/crypto';
import { pushTeamToSupabase, pushPlayerToSupabase } from '@/lib/realtime-sync';

// Preset jersey colors for quick selection
const PRESET_COLORS = [
  { name: 'White', color: '#ffffff' },
  { name: 'Black', color: '#1a1a1a' },
  { name: 'Red', color: '#dc2626' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Navy', color: '#1e3a5f' },
  { name: 'Green', color: '#16a34a' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Maroon', color: '#7f1d1d' },
  { name: 'Gold', color: '#ca8a04' },
];

// Sport Icons
function HockeyIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 3L4 17L8 21L12 21L12 17" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M4 17L12 17" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Ellipse cx="18" cy="19" rx="4" ry="2" stroke={color} strokeWidth={2} fill="none" />
    </Svg>
  );
}

function BaseballIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M7 5C8 7 8 9 7 12C6 15 6 17 7 19" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <Path d="M17 5C16 7 16 9 17 12C18 15 18 17 17 19" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function BasketballIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Line x1="12" y1="3" x2="12" y2="21" stroke={color} strokeWidth={1.5} />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={1.5} />
      <Path d="M8 3.5C6 6 5 9 5 12C5 15 6 18 8 20.5" stroke={color} strokeWidth={1.5} fill="none" />
      <Path d="M16 3.5C18 6 19 9 19 12C19 15 18 18 16 20.5" stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

function SoccerIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M12 8L15 10.5L13.5 14.5H10.5L9 10.5L12 8Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" fill={color} />
      <Line x1="12" y1="8" x2="12" y2="3.5" stroke={color} strokeWidth={1.5} />
      <Line x1="15" y1="10.5" x2="20" y2="9" stroke={color} strokeWidth={1.5} />
      <Line x1="13.5" y1="14.5" x2="17" y2="19" stroke={color} strokeWidth={1.5} />
      <Line x1="10.5" y1="14.5" x2="7" y2="19" stroke={color} strokeWidth={1.5} />
      <Line x1="9" y1="10.5" x2="4" y2="9" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

function LacrosseIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lacrosse stick handle */}
      <Line x1="4" y1="20" x2="14" y2="6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Lacrosse head (net area) */}
      <Path d="M14 6C14 6 16 3 19 3C21 3 22 5 22 7C22 9 20 11 18 11C16 11 14 9 14 6Z" stroke={color} strokeWidth={2} fill="none" />
      {/* Net strings */}
      <Path d="M16 5C16 5 17 7 18 7" stroke={color} strokeWidth={1} strokeLinecap="round" />
      <Path d="M18 5C18 5 18.5 7 19.5 7.5" stroke={color} strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

function SoftballIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgCircle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} fill="none" />
      <Path d="M7 5C8 7 8 9 7 12C6 15 6 17 7 19" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
      <Path d="M17 5C16 7 16 9 17 12C18 15 18 17 17 19" stroke={color} strokeWidth={1.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function SportIcon({ sport, color, size = 24 }: { sport: Sport; color: string; size?: number }) {
  switch (sport) {
    case 'baseball': return <BaseballIcon color={color} size={size} />;
    case 'basketball': return <BasketballIcon color={color} size={size} />;
    case 'hockey': return <HockeyIcon color={color} size={size} />;
    case 'lacrosse': return <LacrosseIcon color={color} size={size} />;
    case 'soccer': return <SoccerIcon color={color} size={size} />;
    case 'softball': return <SoftballIcon color={color} size={size} />;
  }
}

export default function CreateTeamScreen() {
  const router = useRouter();
  const createNewTeam = useTeamStore((s) => s.createNewTeam);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const teams = useTeamStore((s) => s.teams);

  // Persisted form store
  const formStore = useCreateTeamFormStore();
  const isFormValid = useCreateTeamFormValid();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition] = useState('');
  const [memberRole, setMemberRole] = useState<'player' | 'reserve' | 'coach' | 'parent'>('player');
  const isCoach = memberRole === 'coach';
  const isParent = memberRole === 'parent';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teamNameInput, setTeamNameInput] = useState('');
  const [sport, setSport] = useState<Sport | null>(null);
  const [jerseyColors, setJerseyColors] = useState<{ name: string; color: string }[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [editingColorName, setEditingColorName] = useState('');
  const [hasRestoredForm, setHasRestoredForm] = useState(false);

  // Real-time validation states
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);

  // Restore form state on mount if valid (within 10 minutes)
  useEffect(() => {
    if (isFormValid && !hasRestoredForm) {
      console.log('Restoring create-team form state from storage');
      setStep(formStore.step);
      setName(formStore.name);
      setEmail(formStore.email);
      setPhone(formStore.phone);
      setJerseyNumber(formStore.jerseyNumber);
      setMemberRole(formStore.memberRole);
      setPassword(formStore.password);
      setConfirmPassword(formStore.confirmPassword);
      setTeamNameInput(formStore.teamNameInput);
      setSport(formStore.sport);
      if (formStore.sport && formStore.memberRole !== 'coach' && formStore.memberRole !== 'parent') {
        setPosition(SPORT_POSITIONS[formStore.sport][0]);
      }
      setJerseyColors(formStore.jerseyColors);
      setAvatar(formStore.avatar);
      setTeamLogo(formStore.teamLogo);
      setHasRestoredForm(true);
    }
  }, [isFormValid, hasRestoredForm]);

  // Save form state whenever it changes
  useEffect(() => {
    if (hasRestoredForm || step > 1 || name || email) {
      formStore.setFormData({
        step,
        name,
        email,
        phone,
        jerseyNumber,
        memberRole,
        password,
        confirmPassword,
        teamNameInput,
        sport,
        jerseyColors,
        avatar,
        teamLogo,
      });
    }
  }, [step, name, email, phone, jerseyNumber, memberRole, password, confirmPassword, teamNameInput, sport, jerseyColors, avatar, teamLogo]);

  // Image picker functions
  const handlePickImage = async () => {
    // First check current permission status
    const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (currentStatus === 'denied') {
      // Permission was previously denied - need to go to Settings
      Alert.alert(
        'Photo Access Required',
        'Please enable photo access in Settings to upload a profile picture.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    // Request permission if not granted
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Access Required',
        'Please enable photo access in Settings to upload a profile picture.',
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTakePhoto = async () => {
    // First check current permission status
    const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();

    if (currentStatus === 'denied') {
      Alert.alert(
        'Camera Access Required',
        'Please enable camera access in Settings to take a photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please enable camera access in Settings to take a photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
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

  // Team logo picker functions
  const handlePickTeamLogo = async () => {
    // First check current permission status
    const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (currentStatus === 'denied') {
      Alert.alert(
        'Photo Access Required',
        'Please enable photo access in Settings to upload a team logo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photo Access Required',
        'Please enable photo access in Settings to upload a team logo.',
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
      setTeamLogo(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleTakeTeamLogoPhoto = async () => {
    // First check current permission status
    const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();

    if (currentStatus === 'denied') {
      Alert.alert(
        'Camera Access Required',
        'Please enable camera access in Settings to take a photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera Access Required',
        'Please enable camera access in Settings to take a photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() }
        ]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setTeamLogo(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  // Real-time email validation
  const validateEmail = async (emailValue: string) => {
    const trimmedEmail = emailValue.trim();

    // Clear error if empty
    if (!trimmedEmail) {
      setEmailError('');
      return;
    }

    // Basic format check first
    if (!trimmedEmail.includes('@')) {
      setEmailError('Please enter a valid email');
      return;
    }

    // Check locally first (across teams in local store)
    const emailExistsLocally = teams.some(team =>
      team.players.some(p => p.email?.toLowerCase() === trimmedEmail.toLowerCase())
    );
    if (emailExistsLocally) {
      setEmailError('This email is already in use. Please sign in instead.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check with Supabase
    setIsValidatingEmail(true);
    try {
      const result = await checkEmailExists(trimmedEmail);
      if (result.exists) {
        setEmailError('This email is already registered. Please sign in instead.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        setEmailError('');
      }
    } catch {
      // On error, allow to proceed (will be caught at submit)
      setEmailError('');
    }
    setIsValidatingEmail(false);
  };

  // Real-time phone validation
  const validatePhone = async (phoneValue: string) => {
    const trimmedPhone = phoneValue.trim();

    // Clear error if empty (phone is optional)
    if (!trimmedPhone) {
      setPhoneError('');
      return;
    }

    // Basic format check - should have at least 10 digits
    const digitsOnly = trimmedPhone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      setPhoneError('Please enter a valid phone number');
      return;
    }

    // Check locally first (across teams in local store)
    const phoneExistsLocally = teams.some(team =>
      team.players.some(p => {
        const playerPhone = p.phone?.replace(/\D/g, '') || '';
        return playerPhone === digitsOnly;
      })
    );
    if (phoneExistsLocally) {
      setPhoneError('This phone number is already in use.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    // Check with Supabase
    setIsValidatingPhone(true);
    try {
      const result = await checkPhoneExists(digitsOnly);
      if (result.exists) {
        setPhoneError('This phone number is already registered.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        setPhoneError('');
      }
    } catch {
      // On error, allow to proceed (will be caught at submit)
      setPhoneError('');
    }
    setIsValidatingPhone(false);
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

  const handleNext = () => {
    setError('');

    if (step === 1) {
      // Require sport for player/reserve
      if ((memberRole === 'player' || memberRole === 'reserve') && !sport) {
        setError('Please select a sport');
        return;
      }
      if (!name.trim()) {
        setError('Please enter your name');
        return;
      }
      if (!email.trim()) {
        setError('Please enter your email');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email');
        return;
      }
      if (!phone.trim()) {
        setError('Please enter your phone number');
        return;
      }
      const phoneDigits = phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        setError('Please enter a valid phone number');
        return;
      }
      // Check if there are real-time validation errors
      if (emailError) {
        setError(emailError);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      if (phoneError) {
        setError(phoneError);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      // Check if still validating
      if (isValidatingEmail || isValidatingPhone) {
        setError('Please wait while we verify your information');
        return;
      }
      // Require jersey number for player/reserve
      if ((memberRole === 'player' || memberRole === 'reserve') && !jerseyNumber.trim()) {
        setError('Please enter your jersey number');
        return;
      }
      // Require position for player/reserve
      if ((memberRole === 'player' || memberRole === 'reserve') && !position) {
        setError('Please select your position');
        return;
      }
      // Check if email is already in use across all teams (local check)
      const emailExists = teams.some(team =>
        team.players.some(p => p.email?.toLowerCase() === email.trim().toLowerCase())
      );
      if (emailExists) {
        setError('An account with this email already exists. Please sign in instead.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(2);
    } else if (step === 2) {
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(3);
    } else if (step === 3) {
      if (!teamNameInput.trim()) {
        setError('Please enter a team name');
        return;
      }
      if (!teamLogo) {
        setError('Please upload a team logo');
        return;
      }
      if (!sport) {
        setError('Please select a sport');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(4);
    } else if (step === 4) {
      if (jerseyColors.length < 1) {
        setError('Please add at least one jersey color');
        return;
      }
      handleCreateTeam();
    }
  };

  const handleAddJerseyColor = (preset: { name: string; color: string }) => {
    // Check if already added
    if (jerseyColors.some(c => c.name === preset.name)) {
      // Remove it
      setJerseyColors(jerseyColors.filter(c => c.name !== preset.name));
    } else {
      // Add it
      setJerseyColors([...jerseyColors, preset]);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRemoveJerseyColor = (index: number) => {
    setJerseyColors(jerseyColors.filter((_, i) => i !== index));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Reset editing state if we're removing the one being edited
    if (editingColorIndex === index) {
      setEditingColorIndex(null);
      setEditingColorName('');
    } else if (editingColorIndex !== null && editingColorIndex > index) {
      // Adjust editing index if removing an item before it
      setEditingColorIndex(editingColorIndex - 1);
    }
  };

  const handleCreateTeam = async () => {
    if (!sport) {
      setError('Please select a sport');
      return;
    }

    setIsLoading(true);

    try {
      // First, create the user in Supabase
      const supabaseResult = await signUpWithEmail(email.trim(), password);

      if (!supabaseResult.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(supabaseResult.error || 'Failed to create account');

        // If already registered, go back to step 1 so user can change email
        if (supabaseResult.alreadyRegistered) {
          setStep(1);
          setEmailError(supabaseResult.error || 'This email is already registered');
        }

        setIsLoading(false);
        return;
      }

      // Split name into firstName and lastName
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const roles: PlayerRole[] = ['admin'];
      if (isCoach) roles.push('coach');
      if (isParent) roles.push('parent');

      // Hash the password before storing
      const hashedPassword = await hashPassword(password);

      // Create the admin player object with hashed password
      const adminPlayer: Player = {
        id: Date.now().toString(),
        firstName,
        lastName,
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        phone: phone ? unformatPhone(phone) : undefined,
        number: isCoach ? '' : (jerseyNumber.trim() || '1'),
        position: isCoach ? 'Coach' : isParent ? 'Parent' : (position || (sport ? SPORT_POSITIONS[sport][0] : 'P')),
        roles,
        status: memberRole === 'reserve' ? 'reserve' : 'active',
        ...(avatar && { avatar }),
      };

      // Create the new team with the admin player
      createNewTeam(teamNameInput.trim(), sport, adminPlayer);

      // Update team settings with jersey colors and logo
      const currentState = useTeamStore.getState();
      const finalSettings = {
        ...currentState.teamSettings,
        jerseyColors,
        teamLogo: teamLogo ?? undefined,
      };
      useTeamStore.setState({ teamSettings: finalSettings });

      // Write team + admin player to Supabase (source of truth)
      const newTeamId = currentState.activeTeamId;
      if (newTeamId) {
        await pushTeamToSupabase(newTeamId, teamNameInput.trim(), finalSettings);
        await pushPlayerToSupabase({ ...adminPlayer, password: undefined }, newTeamId);
      }

      // Clear the persisted form data on success
      formStore.clearFormData();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (err) {
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
                if (step > 1) {
                  setStep(step - 1);
                  setError('');
                } else {
                  // Clear form data when leaving the create-team flow entirely
                  formStore.clearFormData();
                  router.back();
                }
              }}
              className="flex-row items-center"
            >
              <ChevronLeft size={24} color="#67e8f9" />
              <Text className="text-cyan-400 text-base ml-1">Back</Text>
            </Pressable>
          </Animated.View>

          {/* Progress Indicator */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            className="px-6 mb-4"
          >
            <View className="flex-row items-center justify-center">
              {[1, 2, 3, 4].map((s) => (
                <View key={s} className="flex-row items-center">
                  <View
                    className={cn(
                      'w-8 h-8 rounded-full items-center justify-center',
                      step >= s ? 'bg-cyan-500' : 'bg-slate-700/80'
                    )}
                    style={step >= s ? {
                      shadowColor: '#22d3ee',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.4,
                      shadowRadius: 4,
                      elevation: 3,
                    } : undefined}
                  >
                    {step > s ? (
                      <Check size={16} color="white" strokeWidth={3} />
                    ) : (
                      <Text className={cn('font-bold text-base', step >= s ? 'text-white' : 'text-slate-500')}>
                        {s}
                      </Text>
                    )}
                  </View>
                  {s < 4 && (
                    <View
                      className={cn(
                        'w-10 h-1.5 mx-1 rounded-full',
                        step > s ? 'bg-cyan-500' : 'bg-slate-700/80'
                      )}
                    />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
            {/* Step 1: Personal Info */}
            {step === 1 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-6">
                  {/* Tappable Avatar */}
                  <Pressable
                    onPress={handlePickImage}
                    className="relative mb-4"
                  >
                    {avatar ? (
                      <View className="relative">
                        <Image
                          source={{ uri: avatar }}
                          style={{ width: 80, height: 80, borderRadius: 40 }}
                          contentFit="cover"
                        />
                        <Pressable
                          onPress={() => setAvatar(null)}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 items-center justify-center"
                        >
                          <X size={12} color="white" />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="w-20 h-20 rounded-full bg-cyan-500/20 items-center justify-center border-2 border-cyan-500/50">
                        <User size={32} color="#67e8f9" />
                        <View className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-cyan-500 items-center justify-center border-2 border-slate-900">
                          <Camera size={14} color="white" />
                        </View>
                      </View>
                    )}
                  </Pressable>
                  <Text className="text-white text-2xl font-bold">Your Info</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Tell us about yourself
                  </Text>
                  {!avatar && (
                    <Text className="text-cyan-400 text-sm mt-1">Tap photo to add</Text>
                  )}
                </View>

                {/* Sport Selection - Required for player/reserve */}
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">
                    Sport {(memberRole === 'player' || memberRole === 'reserve') && <Text className="text-red-400">*</Text>}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {(Object.keys(SPORT_NAMES) as Sport[]).sort((a, b) => SPORT_NAMES[a].localeCompare(SPORT_NAMES[b])).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSport(s);
                          // Reset position when sport changes
                          setPosition(SPORT_POSITIONS[s][0]);
                        }}
                        className={cn(
                          'py-2 px-4 rounded-xl border',
                          sport === s
                            ? 'bg-cyan-500/20 border-cyan-400'
                            : 'bg-slate-800/50 border-slate-700/40'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-sm font-medium',
                            sport === s ? 'text-cyan-300' : 'text-slate-400'
                          )}
                        >
                          {SPORT_NAMES[s]}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View className="mb-3">
                  <Text className="text-slate-400 text-xs mb-1.5">Your Name <Text className="text-red-400">*</Text></Text>
                  <View className="flex-row items-center bg-slate-800/60 rounded-lg border border-slate-700/40 px-3">
                    <User size={16} color="#64748b" />
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Full name"
                      placeholderTextColor="#64748b"
                      autoCapitalize="words"
                      className="flex-1 py-3 px-2.5 text-white text-sm"
                    />
                  </View>
                </View>

                <View className="mb-3">
                  <Text className="text-slate-400 text-xs mb-1.5">Email Address <Text className="text-red-400">*</Text></Text>
                  <View className={cn(
                    "flex-row items-center bg-slate-800/60 rounded-lg border px-3",
                    emailError ? "border-red-500/70" : "border-slate-700/40"
                  )}>
                    <Mail size={16} color={emailError ? "#ef4444" : "#64748b"} />
                    <TextInput
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (emailError) setEmailError('');
                      }}
                      onBlur={() => validateEmail(email)}
                      placeholder="your@email.com"
                      placeholderTextColor="#64748b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 py-3 px-2.5 text-white text-sm"
                    />
                    {isValidatingEmail && (
                      <Text className="text-cyan-400 text-xs">Checking...</Text>
                    )}
                  </View>
                  {emailError ? (
                    <Text className="text-red-400 text-xs mt-1">{emailError}</Text>
                  ) : null}
                </View>

                <View className="mb-3">
                  <Text className="text-slate-400 text-xs mb-1.5">Phone Number <Text className="text-red-400">*</Text></Text>
                  <View className={cn(
                    "flex-row items-center bg-slate-800/60 rounded-lg border px-3",
                    phoneError ? "border-red-500/70" : "border-slate-700/40"
                  )}>
                    <Phone size={16} color={phoneError ? "#ef4444" : "#64748b"} />
                    <TextInput
                      value={phone}
                      onChangeText={(text) => {
                        setPhone(formatPhoneInput(text));
                        if (phoneError) setPhoneError('');
                      }}
                      onBlur={() => validatePhone(phone)}
                      placeholder="(555) 123-4567"
                      placeholderTextColor="#64748b"
                      keyboardType="phone-pad"
                      className="flex-1 py-3 px-2.5 text-white text-sm"
                    />
                    {isValidatingPhone && (
                      <Text className="text-cyan-400 text-xs">Checking...</Text>
                    )}
                  </View>
                  {phoneError ? (
                    <Text className="text-red-400 text-xs mt-1">{phoneError}</Text>
                  ) : null}
                </View>

                {/* Role Selector - Single horizontal row */}
                <View className="mb-3">
                  <Text className="text-slate-400 text-xs mb-1.5">Your Role</Text>
                  <View className="flex-row">
                    {/* Player */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMemberRole('player');
                      }}
                      className={cn(
                        'flex-1 py-2 px-1 rounded-lg mr-1 items-center justify-center border',
                        memberRole === 'player' ? 'bg-green-500/20 border-green-400/60' : 'bg-slate-800/50 border-slate-700/40'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium text-xs',
                          memberRole === 'player' ? 'text-green-300' : 'text-slate-500'
                        )}
                      >
                        Player
                      </Text>
                    </Pressable>
                    {/* Reserve */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMemberRole('reserve');
                      }}
                      className={cn(
                        'flex-1 py-2 px-1 rounded-lg mr-1 items-center justify-center border',
                        memberRole === 'reserve' ? 'bg-slate-600/40 border-slate-500/60' : 'bg-slate-800/50 border-slate-700/40'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium text-xs',
                          memberRole === 'reserve' ? 'text-slate-200' : 'text-slate-500'
                        )}
                      >
                        Reserve
                      </Text>
                    </Pressable>
                    {/* Coach */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMemberRole('coach');
                      }}
                      className={cn(
                        'flex-1 py-2 px-1 rounded-lg mr-1 items-center justify-center border',
                        memberRole === 'coach' ? 'bg-cyan-500/20 border-cyan-400/60' : 'bg-slate-800/50 border-slate-700/40'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium text-xs',
                          memberRole === 'coach' ? 'text-cyan-300' : 'text-slate-500'
                        )}
                      >
                        Coach
                      </Text>
                    </Pressable>
                    {/* Parent */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMemberRole('parent');
                      }}
                      className={cn(
                        'flex-1 py-2 px-1 rounded-lg items-center justify-center border',
                        memberRole === 'parent' ? 'bg-pink-500/20 border-pink-400/60' : 'bg-slate-800/50 border-slate-700/40'
                      )}
                    >
                      <Text
                        className={cn(
                          'font-medium text-xs',
                          memberRole === 'parent' ? 'text-pink-300' : 'text-slate-500'
                        )}
                      >
                        Parent
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Jersey Number - Only shown for players/reserves */}
                {(memberRole === 'player' || memberRole === 'reserve') && (
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1.5">Jersey Number <Text className="text-red-400">*</Text></Text>
                    <View className="flex-row items-center bg-slate-800/60 rounded-lg border border-slate-700/40 px-3">
                      <Hash size={16} color="#64748b" />
                      <TextInput
                        value={jerseyNumber}
                        onChangeText={setJerseyNumber}
                        placeholder="e.g., 10"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        maxLength={3}
                        className="flex-1 py-3 px-2.5 text-white text-sm"
                      />
                    </View>
                  </View>
                )}

                {/* Position - Only shown for players/reserves after sport is selected */}
                {(memberRole === 'player' || memberRole === 'reserve') && sport && (
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1.5">Position <Text className="text-red-400">*</Text></Text>
                    <View className="flex-row flex-wrap">
                      {SPORT_POSITIONS[sport].map((pos) => (
                        <Pressable
                          key={pos}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPosition(pos);
                          }}
                          className={cn(
                            'py-1.5 px-3 rounded-lg mr-2 mb-2 border',
                            position === pos
                              ? 'bg-cyan-500/20 border-cyan-400/60'
                              : 'bg-slate-800/50 border-slate-700/40'
                          )}
                        >
                          <Text
                            className={cn(
                              'text-sm font-medium',
                              position === pos ? 'text-cyan-300' : 'text-slate-400'
                            )}
                          >
                            {pos}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}
              </Animated.View>
            )}

            {/* Step 2: Password */}
            {step === 2 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-8">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Lock size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Create Password</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Secure your account
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

                <View className="mb-4">
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
              </Animated.View>
            )}

            {/* Step 3: Team Info */}
            {step === 3 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-6">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Users size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Team Details</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Set up your team
                  </Text>
                </View>

                <View className="mb-6">
                  <Text className="text-slate-300 text-sm mb-2">Team Name <Text className="text-red-400 font-bold">*</Text></Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-600/60 px-4">
                    <Users size={20} color="#94a3b8" />
                    <TextInput
                      value={teamNameInput}
                      onChangeText={setTeamNameInput}
                      placeholder="Enter team name"
                      placeholderTextColor="#94a3b8"
                      autoCapitalize="words"
                      className="flex-1 py-4 px-3 text-white text-base"
                      style={{ minHeight: 52 }}
                    />
                  </View>
                </View>

                {/* Team Logo */}
                <View className="mb-6">
                  <Text className="text-slate-300 text-sm mb-2">Team Logo <Text className="text-red-400 font-bold">*</Text></Text>
                  <Pressable
                    onPress={handlePickTeamLogo}
                    className="items-center"
                  >
                    {teamLogo ? (
                      <View className="relative">
                        <Image
                          source={{ uri: teamLogo }}
                          style={{ width: 100, height: 100, borderRadius: 16 }}
                          contentFit="cover"
                        />
                        <Pressable
                          onPress={() => setTeamLogo(null)}
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500 items-center justify-center"
                        >
                          <X size={14} color="white" />
                        </Pressable>
                      </View>
                    ) : (
                      <View className="w-24 h-24 rounded-2xl bg-slate-800/60 border-2 border-dashed border-slate-500 items-center justify-center">
                        <ImageIcon size={32} color="#94a3b8" />
                        <Text className="text-slate-400 text-xs mt-2 font-medium">Add Logo</Text>
                      </View>
                    )}
                  </Pressable>
                  {!teamLogo && (
                    <Text className="text-cyan-400 text-sm text-center mt-2 font-medium">Tap to upload your team logo</Text>
                  )}
                </View>

                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-3">Sport</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {(Object.keys(SPORT_NAMES) as Sport[]).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSport(s);
                        }}
                        className={cn(
                          'w-[48%] items-center py-4 rounded-xl mb-4 border-2',
                          sport === s
                            ? 'bg-cyan-500/25 border-cyan-400'
                            : 'bg-slate-800/60 border-slate-700/50'
                        )}
                        style={sport === s ? {
                          shadowColor: '#22d3ee',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 3,
                        } : undefined}
                      >
                        <Text
                          className={cn(
                            'text-lg font-semibold',
                            sport === s ? 'text-cyan-300' : 'text-slate-500'
                          )}
                        >
                          {SPORT_NAMES[s]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Step 4: Jersey Colors */}
            {step === 4 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-6">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Palette size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">Jersey Colors</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Select your team's jersey colors
                  </Text>
                </View>

                {/* Selected Colors */}
                {jerseyColors.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2">Selected Colors (tap name to edit)</Text>
                    {jerseyColors.map((color, index) => (
                      <View
                        key={`${color.color}-${index}`}
                        className="flex-row items-center bg-slate-800/80 rounded-xl px-4 py-3 mb-2 border border-slate-700/50"
                      >
                        <View
                          className="w-8 h-8 rounded-full mr-3"
                          style={{
                            backgroundColor: color.color,
                            borderWidth: color.color === '#ffffff' ? 2 : 0,
                            borderColor: '#64748b',
                          }}
                        />
                        {editingColorIndex === index ? (
                          <TextInput
                            value={editingColorName}
                            onChangeText={setEditingColorName}
                            onBlur={() => {
                              if (editingColorName.trim()) {
                                const updated = [...jerseyColors];
                                updated[index] = { ...updated[index], name: editingColorName.trim() };
                                setJerseyColors(updated);
                              }
                              setEditingColorIndex(null);
                              setEditingColorName('');
                            }}
                            onSubmitEditing={() => {
                              if (editingColorName.trim()) {
                                const updated = [...jerseyColors];
                                updated[index] = { ...updated[index], name: editingColorName.trim() };
                                setJerseyColors(updated);
                              }
                              setEditingColorIndex(null);
                              setEditingColorName('');
                            }}
                            autoFocus
                            selectTextOnFocus
                            className="flex-1 text-white text-base bg-slate-700 rounded-lg px-3 py-2"
                            placeholderTextColor="#64748b"
                            placeholder="Enter name"
                          />
                        ) : (
                          <Pressable
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setEditingColorIndex(index);
                              setEditingColorName(color.name);
                            }}
                            className="flex-1 flex-row items-center"
                          >
                            <Text className="text-white text-base flex-1">{color.name}</Text>
                            <Edit3 size={16} color="#67e8f9" />
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => handleRemoveJerseyColor(index)}
                          className="ml-3 p-2"
                        >
                          <X size={18} color="#ef4444" />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                {/* Available Colors */}
                <View className="mb-4">
                  <Text className="text-slate-400 text-sm mb-3">Tap to add colors</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {PRESET_COLORS.map((preset) => {
                      const isSelected = jerseyColors.some(c => c.name === preset.name);
                      return (
                        <Pressable
                          key={preset.name}
                          onPress={() => handleAddJerseyColor(preset)}
                          className={cn(
                            'w-[31%] items-center py-3 rounded-xl mb-3 border',
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500/50'
                              : 'bg-slate-800/80 border-slate-700/50'
                          )}
                        >
                          <View
                            className="w-10 h-10 rounded-full mb-2"
                            style={{
                              backgroundColor: preset.color,
                              borderWidth: preset.color === '#ffffff' ? 2 : 0,
                              borderColor: '#64748b',
                            }}
                          />
                          <Text
                            className={cn(
                              'text-xs font-medium',
                              isSelected ? 'text-cyan-400' : 'text-slate-400'
                            )}
                          >
                            {preset.name}
                          </Text>
                          {isSelected && (
                            <View className="absolute top-1 right-1">
                              <Check size={14} color="#67e8f9" />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Error Message */}
            {error ? (
              <Animated.View entering={FadeInDown.springify()}>
                <Text className="text-red-400 text-center mb-4">{error}</Text>
              </Animated.View>
            ) : null}

            {/* Continue Button */}
            <Pressable
              onPress={handleNext}
              disabled={isLoading}
              className="bg-cyan-500 rounded-xl py-4 flex-row items-center justify-center active:bg-cyan-600 disabled:opacity-50 mb-8"
              style={{
                shadowColor: '#22d3ee',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Text className="text-white font-bold text-lg">
                {isLoading ? 'Creating Team...' : step === 4 ? 'Create Team' : 'Continue'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
