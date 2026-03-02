import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useState } from 'react';
import { ChevronLeft, Users, Check, Palette, X, ImageIcon, Edit3, User, UserMinus, UserCog, Heart } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useTeamStore, Sport, SPORT_NAMES, Player, PlayerRole, SPORT_POSITIONS, getPlayerName } from '@/lib/store';
import { pushTeamToSupabase, pushPlayerToSupabase } from '@/lib/realtime-sync';
import { uploadPhotoToStorage } from '@/lib/photo-storage';
import { cn } from '@/lib/cn';
import { ParentChildIcon } from '@/components/ParentChildIcon';

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
        position: (isCoach || isParent) ? (isCoach ? 'Coach' : 'Parent') : SPORT_POSITIONS[sport][0],
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
                <View className="items-center mb-8">
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

                <View className="mb-6">
                  <Text className="text-slate-400 text-sm mb-2">Team Name <Text className="text-red-400">*</Text></Text>
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                    <Users size={20} color="#64748b" />
                    <TextInput
                      value={teamNameInput}
                      onChangeText={setTeamNameInput}
                      placeholder="Enter team name"
                      placeholderTextColor="#64748b"
                      autoCapitalize="words"
                      className="flex-1 py-4 px-3 text-white text-base"
                    />
                  </View>
                </View>

                {/* Team Logo */}
                <View className="mb-6">
                  <Text className="text-slate-400 text-sm mb-2">Team Logo <Text className="text-red-400">*</Text></Text>
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

                <View className="mb-4">
                  <Text className="text-slate-400 text-sm mb-3">Sport</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {(Object.keys(SPORT_NAMES) as Sport[]).map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSport(s);
                        }}
                        className={cn(
                          'w-[48%] items-center py-4 rounded-xl mb-3 border',
                          sport === s
                            ? 'bg-cyan-500/20 border-cyan-500/50'
                            : 'bg-slate-800/80 border-slate-700/50'
                        )}
                      >
                        <Text
                          className={cn(
                            'text-lg font-semibold',
                            sport === s ? 'text-cyan-400' : 'text-slate-400'
                          )}
                        >
                          {SPORT_NAMES[s]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-slate-400 text-sm mb-2">Your Role on this team</Text>
                  {/* Row 1: Player & Reserve */}
                  <View className="flex-row mb-2">
                    {/* Player (Active) */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMemberRole('player');
                      }}
                      className={cn(
                        'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                        memberRole === 'player' ? 'bg-green-500' : 'bg-slate-800/80'
                      )}
                    >
                      <User size={16} color={memberRole === 'player' ? 'white' : '#22c55e'} />
                      <Text
                        className={cn(
                          'font-semibold text-sm mt-1',
                          memberRole === 'player' ? 'text-white' : 'text-slate-400'
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
                        'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                        memberRole === 'reserve' ? 'bg-slate-600' : 'bg-slate-800/80'
                      )}
                    >
                      <UserMinus size={16} color={memberRole === 'reserve' ? 'white' : '#94a3b8'} />
                      <Text
                        className={cn(
                          'font-semibold text-sm mt-1',
                          memberRole === 'reserve' ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Reserve
                      </Text>
                    </Pressable>
                  </View>
                  {/* Row 2: Coach & Parent */}
                  <View className="flex-row">
                    {/* Coach */}
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setMemberRole('coach');
                      }}
                      className={cn(
                        'flex-1 py-3 px-2 rounded-xl mr-2 items-center justify-center',
                        memberRole === 'coach' ? 'bg-cyan-500' : 'bg-slate-800/80'
                      )}
                    >
                      <UserCog size={16} color={memberRole === 'coach' ? 'white' : '#67e8f9'} />
                      <Text
                        className={cn(
                          'font-semibold text-sm mt-1',
                          memberRole === 'coach' ? 'text-white' : 'text-slate-400'
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
                        'flex-1 py-3 px-2 rounded-xl items-center justify-center',
                        memberRole === 'parent' ? 'bg-pink-500' : 'bg-slate-800/80'
                      )}
                    >
                      <ParentChildIcon size={16} color={memberRole === 'parent' ? 'white' : '#ec4899'} />
                      <Text
                        className={cn(
                          'font-semibold text-sm mt-1',
                          memberRole === 'parent' ? 'text-white' : 'text-slate-400'
                        )}
                      >
                        Parent
                      </Text>
                    </Pressable>
                  </View>
                  <Text className="text-slate-500 text-xs mt-2">
                    {(isCoach || isParent)
                      ? 'Coaches and parents don\'t need jersey numbers'
                      : 'Select your role on the team'}
                  </Text>
                </View>

                {/* Jersey Number - Only shown for players/reserves */}
                {!isCoach && !isParent && (
                  <View className="mb-4">
                    <Text className="text-slate-400 text-sm mb-2">Jersey Number</Text>
                    <View className="flex-row items-center bg-slate-800/80 rounded-xl border border-slate-700/50 px-4">
                      <Text className="text-slate-500 text-lg mr-2">#</Text>
                      <TextInput
                        value={jerseyNumber}
                        onChangeText={setJerseyNumber}
                        placeholder="e.g., 10"
                        placeholderTextColor="#64748b"
                        keyboardType="number-pad"
                        maxLength={3}
                        className="flex-1 py-4 px-1 text-white text-base"
                      />
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
