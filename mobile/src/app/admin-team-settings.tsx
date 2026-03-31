import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Settings,
  X,
  Check,
  Plus,
  Trash2,
  Palette,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import {
  useTeamStore,
  // Sport,       // Sport selection restricted to create-team flow only
  // SPORT_NAMES, // Sport selection restricted to create-team flow only
  // getSportName,// Sport selection restricted to create-team flow only
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { uploadPhotoToStorage } from '@/lib/photo-storage';
import { syncError } from '@/lib/sync-error-handler';

const COLOR_PRESETS = [
  '#ffffff', '#1a1a1a', '#1e40af', '#dc2626', '#16a34a',
  '#7c3aed', '#ea580c', '#ca8a04', '#0891b2', '#db2777',
];

// Sport selection restricted to create-team flow only — not available in admin
// const ALL_SPORTS: Sport[] = ['hockey', 'basketball', 'baseball', 'softball', 'soccer', 'lacrosse'];

export default function AdminTeamSettingsScreen() {
  const router = useRouter();
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const setTeamName = useTeamStore((s) => s.setTeamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const games = useTeamStore((s) => s.games);
  const updateGame = useTeamStore((s) => s.updateGame);
  const { isTablet, containerPadding } = useResponsive();

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  const setTeamNameAndSync = (name: string) => {
    setTeamName(name);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, name, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  // Team Name modal state
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [editTeamName, setEditTeamName] = useState(teamName);

  // Jersey Colors modal state
  const [isJerseyModalVisible, setIsJerseyModalVisible] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#ffffff');
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('#ffffff');

  // Sport change modal state — commented out; sport selection restricted to create-team flow only
  // const [isSportChangeModalVisible, setIsSportChangeModalVisible] = useState(false);
  // const [pendingSport, setPendingSport] = useState<Sport | null>(null);

  const handleSaveTeamName = () => {
    if (!editTeamName.trim()) return;
    setTeamNameAndSync(editTeamName.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSettingsModalVisible(false);
  };

  const handlePickLogo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to update the team logo.',
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
      if (!activeTeamId) return;
      const uploadResult = await uploadPhotoToStorage(result.assets[0].uri, activeTeamId, 'team-logo');
      if (uploadResult.success && uploadResult.url) {
        setTeamSettingsAndSync({ teamLogo: uploadResult.url });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Upload Failed', 'Could not upload team logo. Please check your connection and try again.');
      }
    }
  };

  const handleRemoveLogo = () => {
    Alert.alert(
      'Remove Team Logo',
      'Are you sure you want to remove the team logo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setTeamSettingsAndSync({ teamLogo: undefined });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  // Sport handlers — commented out; sport selection restricted to create-team flow only
  // const handleChangeSport = (sport: Sport) => {
  //   if (sport === teamSettings.sport) return;
  //   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //   setPendingSport(sport);
  //   setIsSportChangeModalVisible(true);
  // };

  // const confirmChangeSport = () => {
  //   if (!pendingSport) return;
  //   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  //   setTeamSettingsAndSync({ sport: pendingSport });
  //   setIsSportChangeModalVisible(false);
  //   setPendingSport(null);
  // };

  // const cancelChangeSport = () => {
  //   setIsSportChangeModalVisible(false);
  //   setPendingSport(null);
  // };

  const handleAddJerseyColor = () => {
    if (!newColorName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors, { name: newColorName.trim(), color: newColorHex }];
    setTeamSettingsAndSync({ jerseyColors: newColors });
    setNewColorName('');
    setNewColorHex('#ffffff');
  };

  const handleRemoveJerseyColor = (name: string) => {
    Alert.alert(
      'Remove Jersey Color',
      `Remove "${name}" from your jersey colors?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const newColors = teamSettings.jerseyColors.filter((c) => c.name !== name);
            setTeamSettingsAndSync({ jerseyColors: newColors });
            games.forEach((game) => {
              if (game.jerseyColor === name) {
                updateGame(game.id, { jerseyColor: undefined });
              }
            });
          },
        },
      ]
    );
  };

  const handleSaveEditJerseyColor = () => {
    if (editingColorIndex === null || !editColorName.trim()) return;
    const oldColorName = teamSettings.jerseyColors[editingColorIndex].name;
    const updatedColorName = editColorName.trim();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors];
    newColors[editingColorIndex] = { name: updatedColorName, color: editColorHex };
    setTeamSettingsAndSync({ jerseyColors: newColors });
    if (oldColorName !== updatedColorName) {
      games.forEach((game) => {
        if (game.jerseyColor === oldColorName) {
          updateGame(game.id, { jerseyColor: updatedColorName });
        }
      });
    }
    setEditingColorIndex(null);
    setEditColorName('');
    setEditColorHex('#ffffff');
  };

  const handleCancelEditJerseyColor = () => {
    setEditingColorIndex(null);
    setEditColorName('');
    setEditColorHex('#ffffff');
  };

  const handleDeleteEditingColor = () => {
    if (editingColorIndex === null) return;
    const colorName = teamSettings.jerseyColors[editingColorIndex].name;
    Alert.alert(
      'Remove Jersey Color',
      `Are you sure you want to remove "${colorName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const newColors = teamSettings.jerseyColors.filter((_, i) => i !== editingColorIndex);
            setTeamSettingsAndSync({ jerseyColors: newColors });
            setEditingColorIndex(null);
            setEditColorName('');
            setEditColorHex('#ffffff');
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-2 pb-4 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-slate-800/80 items-center justify-center">
            <ChevronLeft size={22} color="#94a3b8" />
          </Pressable>
          <Text className="text-white text-2xl font-bold flex-1">Team Settings</Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          {/* Team Identity Section */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
              Team Identity
            </Text>

            {/* Team Name */}
            <Pressable
              onPress={() => {
                setEditTeamName(teamName);
                setIsSettingsModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <Settings size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Team Name</Text>
                    <Text className="text-slate-400 text-sm">{teamName}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            {/* Team Logo */}
            <Pressable
              onPress={handlePickLogo}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <ImageIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Team Logo</Text>
                    <Text className="text-slate-400 text-sm">
                      {teamSettings.teamLogo ? 'Tap to change' : 'Tap to add logo'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  {teamSettings.teamLogo ? (
                    <>
                      <Image
                        source={{ uri: teamSettings.teamLogo }}
                        style={{ width: 40, height: 40, borderRadius: 20, marginRight: 8 }}
                        contentFit="cover"
                      />
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveLogo();
                        }}
                        className="p-2"
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </Pressable>
                    </>
                  ) : (
                    <Plus size={20} color="#64748b" />
                  )}
                </View>
              </View>
            </Pressable>

            {/* Jersey Colors */}
            <Pressable
              onPress={() => setIsJerseyModalVisible(true)}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <Palette size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3">
                    <Text className="text-white font-semibold">Jersey Colors</Text>
                    <Text className="text-slate-400 text-sm">
                      {teamSettings.jerseyColors.length} colors configured
                    </Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  {teamSettings.jerseyColors.slice(0, 3).map((c, index) => (
                    <View
                      key={`preview-${index}`}
                      className="w-6 h-6 rounded-full border-2 border-slate-700 -ml-2"
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                  <ChevronRight size={20} color="#64748b" className="ml-2" />
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* Sport Type Section — commented out; sport selection restricted to create-team flow only */}
          {/* <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Sport
            </Text>
            <View className="bg-slate-800/80 rounded-2xl border border-slate-700/50 overflow-hidden mb-3">
              {ALL_SPORTS.map((sport, index) => {
                const isSelected = teamSettings.sport === sport;
                return (
                  <Pressable
                    key={sport}
                    onPress={() => handleChangeSport(sport)}
                    className={cn(
                      'flex-row items-center justify-between px-4 py-3.5 active:bg-slate-700/60',
                      index < ALL_SPORTS.length - 1 && 'border-b border-slate-700/40'
                    )}
                  >
                    <Text className={cn('font-medium text-base', isSelected ? 'text-cyan-400' : 'text-slate-300')}>
                      {getSportName(sport)}
                    </Text>
                    {isSelected && <Check size={18} color="#67e8f9" />}
                  </Pressable>
                );
              })}
            </View>
          </Animated.View> */}
        </ScrollView>
      </SafeAreaView>

      {/* Team Name Modal */}
      <Modal
        visible={isSettingsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsSettingsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Team Name</Text>
              <View className="flex-row items-center">
                <Pressable onPress={handleSaveTeamName} className="mr-3">
                  <Text className="text-cyan-400 font-semibold">Save</Text>
                </Pressable>
                <Pressable onPress={() => setIsSettingsModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>
            </View>
            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <View className="mb-5">
                <Text className="text-slate-400 text-sm mb-2">Team Name</Text>
                <TextInput
                  value={editTeamName}
                  onChangeText={setEditTeamName}
                  placeholder="Enter team name"
                  placeholderTextColor="#64748b"
                  autoCapitalize="words"
                  autoFocus
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
                  onSubmitEditing={handleSaveTeamName}
                  returnKeyType="done"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Jersey Colors Modal */}
      <Modal
        visible={isJerseyModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsJerseyModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Jersey Colors</Text>
              <Pressable onPress={() => setIsJerseyModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Current Colors */}
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Current Colors
              </Text>

              {teamSettings.jerseyColors.map((color, index) => (
                <View key={`color-${index}`}>
                  {editingColorIndex === index ? (
                    <View className="bg-slate-800/80 rounded-xl p-4 mb-2 border border-cyan-500/50">
                      <TextInput
                        value={editColorName}
                        onChangeText={setEditColorName}
                        placeholder="Description (e.g. Home)"
                        placeholderTextColor="#64748b"
                        autoCapitalize="words"
                        className="bg-slate-700 rounded-xl px-4 py-3 text-white mb-3"
                      />
                      <Text className="text-slate-400 text-sm mb-2">Select Color</Text>
                      <View className="flex-row justify-between mb-3">
                        {COLOR_PRESETS.map((hex) => (
                          <Pressable
                            key={hex}
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setEditColorHex(hex);
                            }}
                            className={cn(
                              'flex-1 aspect-square rounded-full border-2 items-center justify-center mx-0.5',
                              editColorHex === hex ? 'border-cyan-400' : 'border-slate-600'
                            )}
                            style={{ backgroundColor: hex, maxWidth: 32 }}
                          >
                            {editColorHex === hex && (
                              <Check size={14} color={hex === '#ffffff' || hex === '#ca8a04' ? '#000' : '#fff'} />
                            )}
                          </Pressable>
                        ))}
                      </View>
                      <View className="flex-row">
                        <Pressable
                          onPress={handleCancelEditJerseyColor}
                          className="flex-1 bg-slate-700 rounded-xl py-3 mr-2"
                        >
                          <Text className="text-slate-300 font-semibold text-center">Cancel</Text>
                        </Pressable>
                        <Pressable
                          onPress={handleDeleteEditingColor}
                          className="bg-red-900/40 rounded-xl py-3 px-4 mr-2"
                        >
                          <Trash2 size={18} color="#ef4444" />
                        </Pressable>
                        <Pressable
                          onPress={handleSaveEditJerseyColor}
                          className="flex-1 bg-cyan-600 rounded-xl py-3"
                        >
                          <Text className="text-white font-semibold text-center">Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditingColorIndex(index);
                        setEditColorName(color.name);
                        setEditColorHex(color.color);
                      }}
                      className="bg-slate-800/80 rounded-xl p-4 mb-2 border border-slate-700/50 active:bg-slate-700/60"
                    >
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <View
                            className="w-10 h-10 rounded-full border-2 border-slate-600 mr-3"
                            style={{ backgroundColor: color.color }}
                          />
                          <Text className="text-white font-medium">{color.name}</Text>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveJerseyColor(color.name)}
                          className="p-2"
                        >
                          <Trash2 size={18} color="#64748b" />
                        </Pressable>
                      </View>
                    </Pressable>
                  )}
                </View>
              ))}

              {/* Add New Color */}
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-4">
                Add New Color
              </Text>

              <TextInput
                value={newColorName}
                onChangeText={setNewColorName}
                placeholder="Description (e.g. Home, Away)"
                placeholderTextColor="#64748b"
                autoCapitalize="words"
                className="bg-slate-800 rounded-xl px-4 py-3 text-white mb-3"
              />

              <Text className="text-slate-400 text-sm mb-2">Select Color</Text>
              <View className="flex-row justify-between mb-4">
                {COLOR_PRESETS.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewColorHex(hex);
                    }}
                    className={cn(
                      'flex-1 aspect-square rounded-full border-2 items-center justify-center mx-0.5',
                      newColorHex === hex ? 'border-cyan-400' : 'border-slate-600'
                    )}
                    style={{ backgroundColor: hex, maxWidth: 32 }}
                  >
                    {newColorHex === hex && (
                      <Check size={14} color={hex === '#ffffff' || hex === '#ca8a04' ? '#000' : '#fff'} />
                    )}
                  </Pressable>
                ))}
              </View>

              <Pressable
                onPress={handleAddJerseyColor}
                disabled={!newColorName.trim()}
                className={cn(
                  'rounded-xl py-3 items-center',
                  newColorName.trim() ? 'bg-cyan-600 active:bg-cyan-700' : 'bg-slate-700 opacity-50'
                )}
              >
                <Text className={cn('font-semibold', newColorName.trim() ? 'text-white' : 'text-slate-500')}>
                  Add Color
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}
