import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { X, Check, Plus, Edit3, Trash2 } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface JerseyColorsModalProps {
  visible: boolean;
  onClose: () => void;
}

const COLOR_PRESETS = [
  '#ffffff', '#1a1a1a', '#1e40af', '#dc2626', '#16a34a',
  '#7c3aed', '#ea580c', '#ca8a04', '#0891b2', '#db2777',
];

export function JerseyColorsModal({ visible, onClose }: JerseyColorsModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const games = useTeamStore((s) => s.games);
  const updateGame = useTeamStore((s) => s.updateGame);

  // Jersey color form
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#ffffff');
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('#ffffff');

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

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
      `Are you sure you want to remove "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const newColors = teamSettings.jerseyColors.filter((c) => c.name !== name);
            setTeamSettingsAndSync({ jerseyColors: newColors });
          },
        },
      ]
    );
  };

  const handleEditJerseyColor = (index: number) => {
    const color = teamSettings.jerseyColors[index];
    setEditingColorIndex(index);
    setEditColorName(color.name);
    setEditColorHex(color.color);
  };

  const handleSaveEditJerseyColor = () => {
    if (editingColorIndex === null || !editColorName.trim()) return;

    const oldColorName = teamSettings.jerseyColors[editingColorIndex].name;
    const newColorNameTrimmed = editColorName.trim();

    // Update the jersey color in settings
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors];
    newColors[editingColorIndex] = { name: newColorNameTrimmed, color: editColorHex };
    setTeamSettingsAndSync({ jerseyColors: newColors });

    // Update all games that use the old color name
    if (oldColorName !== newColorNameTrimmed) {
      games.forEach((game) => {
        if (game.jerseyColor === oldColorName) {
          updateGame(game.id, { jerseyColor: newColorNameTrimmed });
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">Jersey Colors</Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
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
                  // Edit mode
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
                        className="bg-red-500/20 rounded-xl py-3 px-4 mr-2"
                      >
                        <Trash2 size={18} color="#ef4444" />
                      </Pressable>
                      <Pressable
                        onPress={handleSaveEditJerseyColor}
                        className="flex-1 bg-cyan-500 rounded-xl py-3"
                      >
                        <Text className="text-white font-semibold text-center">Save</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  // Display mode
                  <View className="flex-row items-center bg-slate-800/80 rounded-xl p-4 mb-2 border border-slate-700/50">
                    <View
                      className="w-10 h-10 rounded-full border-2 border-slate-600"
                      style={{ backgroundColor: color.color }}
                    />
                    <Text className="text-white font-medium ml-3 flex-1">{color.name}</Text>
                    <Pressable
                      onPress={() => handleEditJerseyColor(index)}
                      className="p-2"
                    >
                      <Edit3 size={18} color="#67e8f9" />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}

            {/* Add New Color */}
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 mt-6">
              Add New Color<Text className="text-red-400">*</Text>
            </Text>

            <View className="mb-4">
              <TextInput
                value={newColorName}
                onChangeText={setNewColorName}
                placeholder="Description (e.g. Home)"
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

              <Text className="text-slate-500 text-xs mb-3"><Text className="text-red-400">*</Text> Required</Text>

              <Pressable
                onPress={handleAddJerseyColor}
                className="bg-cyan-500 rounded-xl py-3 flex-row items-center justify-center"
              >
                <Plus size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Save Color</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
