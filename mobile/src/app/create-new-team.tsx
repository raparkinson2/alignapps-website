import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { ChevronLeft, Users, Check, Palette, X, ImageIcon, Edit3, User, UserMinus, UserCog, Hash } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTeamStore, Sport, SPORT_NAMES, SPORT_POSITIONS, Player, PlayerRole, getPlayerName } from '@/lib/store';
import { pushTeamToSupabase, pushPlayerToSupabase } from '@/lib/realtime-sync';
import { uploadPhotoToStorage } from '@/lib/photo-storage';
import { cn } from '@/lib/cn';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import Svg, { Path, Circle as SvgCircle, Line, Ellipse } from 'react-native-svg';

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
      <Line x1="4" y1="20" x2="14" y2="6" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M14 6C14 6 16 3 19 3C21 3 22 5 22 7C22 9 20 11 18 11C16 11 14 9 14 6Z" stroke={color} strokeWidth={2} fill="none" />
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

export default function CreateNewTeamScreen() {
  const router = useRouter();
  const createNewTeam = useTeamStore((s) => s.createNewTeam);
  const setPendingTeamSelection = useTeamStore((s) => s.setPendingTeamSelection);
  const userEmail = useTeamStore((s) => s.userEmail);
  const userPhone = useTeamStore((s) => s.userPhone);
  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);

  // Get current user info
  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  const [step, setStep] = useState(1);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [sport, setSport] = useState<Sport | null>(null);
  const [jerseyColors, setJerseyColors] = useState<{ name: string; color: string }[]>([]);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [editingColorName, setEditingColorName] = useState('');

  // Initialize memberRole based on current player's role
  const getInitialMemberRole = (): 'player' | 'reserve' | 'coach' | 'parent' => {
    if (currentPlayer?.roles?.includes('coach')) return 'coach';
    if (currentPlayer?.roles?.includes('parent')) return 'parent';
    if (currentPlayer?.status === 'reserve') return 'reserve';
    return 'player';
  };
  const [memberRole, setMemberRole] = useState<'player' | 'reserve' | 'coach' | 'parent'>(getInitialMemberRole());
  const isCoach = memberRole === 'coach';
  const isParent = memberRole === 'parent';
  const [jerseyNumber, setJerseyNumber] = useState(currentPlayer?.number || '');
  const [position, setPosition] = useState<string>('');

  // Team logo picker functions
  const handlePickTeamLogo = async () => {
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
      setTeamLogo(result.assets[0].uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleNext = () => {
    setError('');

    if (step === 1) {
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
      if (!isCoach && !isParent && !jerseyNumber.trim()) {
        setError('Please enter your jersey number');
        return;
      }
      if (!isCoach && !isParent && !position) {
        setError('Please select your position');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(2);
    } else if (step === 2) {
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
    if (!currentPlayer) {
      setError('Unable to get current user info');
      return;
    }

    if (!sport) {
      setError('Please select a sport');
      return;
    }

    setIsLoading(true);

    try {
      const roles: PlayerRole[] = ['admin'];
      if (isCoach) roles.push('coach');
      if (isParent) roles.push('parent');

      // Create the admin player object for the new team (copy from current user)
      const adminPlayer: Player = {
        id: Date.now().toString(),
        firstName: currentPlayer.firstName,
        lastName: currentPlayer.lastName,
        email: currentPlayer.email || userEmail || undefined,
        password: currentPlayer.password,
        phone: currentPlayer.phone || userPhone || undefined,
        number: (isCoach || isParent) ? '' : (jerseyNumber.trim() || '1'),
        position: (isCoach || isParent) ? (isCoach ? 'Coach' : 'Parent') : (position || SPORT_POSITIONS[sport][0]),
        roles,
        status: memberRole === 'reserve' ? 'reserve' : 'active',
        avatar: currentPlayer.avatar,
      };

      // Create the new team with the admin player
      createNewTeam(teamNameInput.trim(), sport, adminPlayer);

      // Upload team logo to Supabase Storage so all devices can load it
      const newTeamId = useTeamStore.getState().activeTeamId!;
      let finalLogoUrl: string | undefined = undefined;
      if (teamLogo && !teamLogo.startsWith('http')) {
        const uploadResult = await uploadPhotoToStorage(teamLogo, newTeamId, 'team-logo');
        if (uploadResult.success && uploadResult.url) {
          finalLogoUrl = uploadResult.url;
        }
        // If upload fails, leave logo as undefined — never save a local file:// path
      } else if (teamLogo?.startsWith('http')) {
        finalLogoUrl = teamLogo;
      }

      // Update team settings with jersey colors and logo
      const currentState = useTeamStore.getState();
      const finalSettings = {
        ...currentState.teamSettings,
        jerseyColors,
        teamLogo: finalLogoUrl,
      };
      useTeamStore.setState({
        teamSettings: finalSettings,
      });

      // Push the new team and admin player to Supabase so realtime sync can load it
      await pushTeamToSupabase(newTeamId, teamNameInput.trim(), finalSettings);
      await pushPlayerToSupabase(adminPlayer, newTeamId);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Get all teams the user belongs to (including the newly created one)
      const allTeams = useTeamStore.getState().teams;
      const userTeams = allTeams.filter((team) =>
        team.players.some(
          (p) =>
            (userEmail && p.email?.toLowerCase() === userEmail?.toLowerCase()) ||
            (userPhone && p.phone?.replace(/\D/g, '') === userPhone?.replace(/\D/g, ''))
        )
      );

      if (userTeams.length > 1) {
        // User has multiple teams - show team selector so they can choose which to view
        setPendingTeamSelection(userTeams.map((t) => t.id));
        router.replace('/select-team');
      } else {
        // First team - go straight to app
        router.replace('/(tabs)');
      }
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
            className="px-6 mb-6"
          >
            <View className="flex-row items-center justify-center">
              {[1, 2].map((s) => (
                <View key={s} className="flex-row items-center">
                  <View
                    className={cn(
                      'w-7 h-7 rounded-full items-center justify-center',
                      step >= s ? 'bg-cyan-500' : 'bg-slate-700'
                    )}
                  >
                    {step > s ? (
                      <Check size={14} color="white" />
                    ) : (
                      <Text className={cn('font-bold text-sm', step >= s ? 'text-white' : 'text-slate-400')}>
                        {s}
                      </Text>
                    )}
                  </View>
                  {s < 2 && (
                    <View
                      className={cn(
                        'w-12 h-1 mx-2',
                        step > s ? 'bg-cyan-500' : 'bg-slate-700'
                      )}
                    />
                  )}
                </View>
              ))}
            </View>
          </Animated.View>

          <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
            {/* Step 1: Team Info */}
            {step === 1 && (
              <Animated.View entering={FadeInDown.delay(150).springify()}>
                <View className="items-center mb-6">
                  <View className="w-16 h-16 rounded-full bg-cyan-500/20 items-center justify-center mb-4 border-2 border-cyan-500/50">
                    <Users size={32} color="#67e8f9" />
                  </View>
                  <Text className="text-white text-2xl font-bold">New Team</Text>
                  <Text className="text-slate-400 text-center mt-2">
                    Set up your new team
                  </Text>
                </View>

                {/* Current User Info */}
                {currentPlayer && (
                  <View className="bg-slate-800/60 rounded-xl p-4 mb-6 border border-slate-700/50">
                    <Text className="text-slate-400 text-xs uppercase tracking-wider mb-2">Creating as</Text>
                    <Text className="text-white font-semibold">{getPlayerName(currentPlayer)}</Text>
                    <Text className="text-cyan-400 text-sm">{currentPlayer.email || currentPlayer.phone}</Text>
                  </View>
                )}

                {/* Sport Selection */}
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Sport <Text className="text-red-400">*</Text></Text>
                  <View className="flex-row gap-1.5">
                    {(Object.keys(SPORT_NAMES) as Sport[]).sort((a, b) => SPORT_NAMES[a].localeCompare(SPORT_NAMES[b])).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSport(s);
                          setPosition(SPORT_POSITIONS[s][0]);
                        }}
                        className={cn(
                          'flex-1 items-center py-2 rounded-xl border',
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
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.7}
                        >
                          {SPORT_NAMES[s]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Role */}
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Your Role on this team</Text>
                  <View className="flex-row gap-1.5">
                    {([
                      { role: 'player', label: 'Player' },
                      { role: 'reserve', label: 'Reserve' },
                      { role: 'coach', label: 'Coach' },
                      { role: 'parent', label: 'Parent' },
                    ] as { role: 'player' | 'reserve' | 'coach' | 'parent'; label: string }[]).map(({ role, label }) => (
                      <Pressable
                        key={role}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setMemberRole(role);
                        }}
                        className={cn(
                          'flex-1 items-center py-2 rounded-xl border',
                          memberRole === role ? 'bg-cyan-500/20 border-cyan-400' : 'bg-slate-800/50 border-slate-700/40'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-sm font-medium',
                            memberRole === role ? 'text-cyan-300' : 'text-slate-400'
                          )}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Team Name <Text className="text-red-400">*</Text></Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                    <Users size={20} color="#64748b" />
                    <TextInput
                      value={teamNameInput}
                      onChangeText={setTeamNameInput}
                      placeholder="Enter team name"
                      placeholderTextColor="#64748b"
                      autoCapitalize="words"
                      className="flex-1 py-4 px-3 text-white text-sm"
                    />
                  </View>
                </View>

                {/* Team Logo */}
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Team Logo <Text className="text-red-400">*</Text></Text>
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
                      <View className="w-24 h-24 rounded-2xl bg-slate-800/80 border-2 border-dashed border-slate-600 items-center justify-center">
                        <ImageIcon size={32} color="#64748b" />
                        <Text className="text-slate-500 text-xs mt-2">Add Logo</Text>
                      </View>
                    )}
                  </Pressable>
                  {!teamLogo && (
                    <Text className="text-cyan-400 text-xs text-center mt-2">Tap to upload your team logo</Text>
                  )}
                </View>

                {/* Jersey Number - Only shown for players/reserves */}
                {!isCoach && !isParent && (
                  <View className="mb-4">
                    <Text className="text-slate-300 text-sm mb-2">Jersey Number <Text className="text-red-400">*</Text></Text>
                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                      <Hash size={20} color="#64748b" />
                      <TextInput
                        value={jerseyNumber}
                        onChangeText={setJerseyNumber}
                        placeholder="e.g., 10"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        maxLength={3}
                        className="flex-1 py-4 px-3 text-white text-sm"
                      />
                    </View>
                  </View>
                )}

                {/* Position - Only shown for players/reserves after sport is selected */}
                {!isCoach && !isParent && sport && (
                  <View className="mb-4">
                    <Text className="text-slate-300 text-sm mb-2">Position <Text className="text-red-400">*</Text></Text>
                    <View className="flex-row gap-1.5">
                      {SPORT_POSITIONS[sport].map((pos) => (
                        <Pressable
                          key={pos}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPosition(pos);
                          }}
                          className={cn(
                            'flex-1 items-center py-2 rounded-xl border',
                            position === pos
                              ? 'bg-cyan-500/20 border-cyan-400'
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

            {/* Step 2: Jersey Colors */}
            {step === 2 && (
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
            >
              <Text className="text-white font-semibold text-lg">
                {isLoading ? 'Creating Team...' : step === 2 ? 'Create Team' : 'Continue'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
