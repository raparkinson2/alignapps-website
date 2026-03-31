import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useState, useRef } from 'react';
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

function isValidHex(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

function normalizeHex(input: string): string {
  let h = input.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  return h;
}

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (hex: string) => void;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollYOffset?: number; // approximate Y position in the scroll view so we can scroll to it
}

function ColorPicker({ selectedColor, onColorChange, scrollRef, scrollYOffset = 0 }: ColorPickerProps) {
  const [customHex, setCustomHex] = useState('');
  const [hexError, setHexError] = useState(false);

  const handlePresetPress = (hex: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onColorChange(hex);
    setCustomHex('');
    setHexError(false);
    Keyboard.dismiss();
  };

  const handleHexChange = (text: string) => {
    setCustomHex(text);
    setHexError(false);
    const normalized = normalizeHex(text);
    if (isValidHex(normalized)) {
      onColorChange(normalized.toUpperCase());
    }
  };

  const handleHexBlur = () => {
    if (customHex.trim() === '') return;
    const normalized = normalizeHex(customHex);
    if (!isValidHex(normalized)) {
      setHexError(true);
    }
  };

  const handleHexFocus = () => {
    // Scroll down so the input isn't hidden by the keyboard
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: scrollYOffset, animated: true });
    }, 100);
  };

  const isPresetSelected = COLOR_PRESETS.includes(selectedColor);

  return (
    <View>
      {/* Preset swatches */}
      <View className="flex-row justify-between mb-4">
        {COLOR_PRESETS.map((hex) => (
          <Pressable
            key={hex}
            onPress={() => handlePresetPress(hex)}
            className={cn(
              'flex-1 aspect-square rounded-full border-2 items-center justify-center mx-0.5',
              selectedColor === hex ? 'border-cyan-400' : 'border-slate-600'
            )}
            style={{ backgroundColor: hex, maxWidth: 32 }}
          >
            {selectedColor === hex && (
              <Check size={14} color={hex === '#ffffff' || hex === '#ca8a04' ? '#000' : '#fff'} />
            )}
          </Pressable>
        ))}
      </View>

      {/* Custom hex row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Live preview swatch */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: isValidHex(selectedColor) ? selectedColor : '#ffffff',
            borderWidth: 2,
            borderColor: !isPresetSelected ? '#67e8f9' : '#334155',
            flexShrink: 0,
          }}
        />
        <View style={{ flex: 1 }}>
          <TextInput
            value={customHex}
            onChangeText={handleHexChange}
            onBlur={handleHexBlur}
            onFocus={handleHexFocus}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder={selectedColor.toUpperCase()}
            placeholderTextColor="#475569"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            maxLength={7}
            style={{
              backgroundColor: hexError ? 'rgba(239,68,68,0.12)' : '#1e293b',
              borderWidth: 1,
              borderColor: hexError ? 'rgba(239,68,68,0.5)' : '#334155',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: '#ffffff',
              fontSize: 15,
              fontWeight: '600',
              letterSpacing: 1,
            }}
          />
        </View>
      </View>
      {hexError && (
        <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 54 }}>
          Enter a valid hex like #FF6B00
        </Text>
      )}
      {!isPresetSelected && isValidHex(selectedColor) && (
        <Text style={{ color: '#67e8f9', fontSize: 12, marginTop: 4, marginLeft: 54 }}>
          Custom color selected
        </Text>
      )}
    </View>
  );
}

export function JerseyColorsModal({ visible, onClose }: JerseyColorsModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const games = useTeamStore((s) => s.games);
  const updateGame = useTeamStore((s) => s.updateGame);

  const scrollRef = useRef<ScrollView>(null);

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
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors, { name: newColorName.trim(), color: newColorHex }];
    setTeamSettingsAndSync({ jerseyColors: newColors });
    setNewColorName('');
    setNewColorHex('#ffffff');
  };

  const handleEditJerseyColor = (index: number) => {
    const color = teamSettings.jerseyColors[index];
    setEditingColorIndex(index);
    setEditColorName(color.name);
    setEditColorHex(color.color);
    // Scroll to the editing item
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: index * 72, animated: true });
    }, 150);
  };

  const handleSaveEditJerseyColor = () => {
    if (editingColorIndex === null || !editColorName.trim()) return;
    Keyboard.dismiss();
    const oldColorName = teamSettings.jerseyColors[editingColorIndex].name;
    const newColorNameTrimmed = editColorName.trim();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const newColors = [...teamSettings.jerseyColors];
    newColors[editingColorIndex] = { name: newColorNameTrimmed, color: editColorHex };
    setTeamSettingsAndSync({ jerseyColors: newColors });
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
    Keyboard.dismiss();
    setEditingColorIndex(null);
    setEditColorName('');
    setEditColorHex('#ffffff');
  };

  const handleDeleteEditingColor = () => {
    if (editingColorIndex === null) return;
    const colorName = teamSettings.jerseyColors[editingColorIndex].name;
    Alert.alert('Remove Jersey Color', `Are you sure you want to remove "${colorName}"?`, [
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
    ]);
  };

  const handleRemoveJerseyColor = (name: string) => {
    Alert.alert('Remove Jersey Color', `Are you sure you want to remove "${name}"?`, [
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
    ]);
  };

  const numColors = teamSettings.jerseyColors.length;
  // Rough Y offset for the "Add New Color" hex input in the scroll view
  const addSectionScrollY = numColors * 76 + 160;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => { Keyboard.dismiss(); onClose(); }}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={() => Keyboard.dismiss()}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Stop touch from propagating to the backdrop dismiss */}
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: '#0f172a',
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                maxHeight: '90%',
                minHeight: 300,
              }}
            >
              {/* Header */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: '#1e293b',
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Jersey Colors</Text>
                <Pressable
                  onPress={() => { Keyboard.dismiss(); onClose(); }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#1e293b',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>

              <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
              >
                {/* Current Colors */}
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                  Current Colors
                </Text>

                {teamSettings.jerseyColors.map((color, index) => (
                  <View key={`color-${index}`}>
                    {editingColorIndex === index ? (
                      <View
                        style={{
                          backgroundColor: '#1e293b',
                          borderRadius: 16,
                          padding: 16,
                          marginBottom: 8,
                          borderWidth: 1.5,
                          borderColor: 'rgba(103,232,249,0.4)',
                        }}
                      >
                        <TextInput
                          value={editColorName}
                          onChangeText={setEditColorName}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          returnKeyType="done"
                          placeholder="Name (e.g. Home)"
                          placeholderTextColor="#475569"
                          autoCapitalize="words"
                          style={{
                            backgroundColor: '#0f172a',
                            borderRadius: 12,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            color: '#ffffff',
                            fontSize: 15,
                            marginBottom: 12,
                          }}
                        />
                        <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>Select Color</Text>
                        <ColorPicker
                          selectedColor={editColorHex}
                          onColorChange={setEditColorHex}
                          scrollRef={scrollRef}
                          scrollYOffset={index * 76}
                        />
                        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
                          <Pressable
                            onPress={handleCancelEditJerseyColor}
                            style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}
                          >
                            <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={handleDeleteEditingColor}
                            style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' }}
                          >
                            <Trash2 size={18} color="#ef4444" />
                          </Pressable>
                          <Pressable
                            onPress={handleSaveEditJerseyColor}
                            style={{ flex: 1, backgroundColor: '#67e8f9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                          >
                            <Text style={{ color: '#000000', fontWeight: '700' }}>Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleEditJerseyColor(index)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: '#1e293b',
                          borderRadius: 14,
                          padding: 14,
                          marginBottom: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: color.color,
                            borderWidth: 2,
                            borderColor: '#334155',
                          }}
                        />
                        <Text style={{ color: '#ffffff', fontWeight: '600', marginLeft: 12, flex: 1, fontSize: 15 }}>
                          {color.name}
                        </Text>
                        <Text style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace', marginRight: 8 }}>
                          {color.color.toUpperCase()}
                        </Text>
                        <Edit3 size={16} color="#67e8f9" />
                      </Pressable>
                    )}
                  </View>
                ))}

                {/* Add New Color */}
                <Text style={{ color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 20 }}>
                  Add New Color
                </Text>

                <View
                  style={{
                    backgroundColor: '#1e293b',
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: '#334155',
                  }}
                >
                  <TextInput
                    value={newColorName}
                    onChangeText={setNewColorName}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    returnKeyType="done"
                    placeholder="Name (e.g. Home, Away, Black)"
                    placeholderTextColor="#475569"
                    autoCapitalize="words"
                    style={{
                      backgroundColor: '#0f172a',
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      color: '#ffffff',
                      fontSize: 15,
                      marginBottom: 14,
                    }}
                  />

                  <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 10 }}>Select Color</Text>
                  <ColorPicker
                    selectedColor={newColorHex}
                    onColorChange={setNewColorHex}
                    scrollRef={scrollRef}
                    scrollYOffset={addSectionScrollY}
                  />

                  <Pressable
                    onPress={handleAddJerseyColor}
                    style={{
                      marginTop: 16,
                      backgroundColor: newColorName.trim() ? '#67e8f9' : '#1e3a4a',
                      borderRadius: 12,
                      paddingVertical: 13,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Plus size={18} color={newColorName.trim() ? '#000' : '#334155'} />
                    <Text style={{ color: newColorName.trim() ? '#000000' : '#334155', fontWeight: '700', fontSize: 15 }}>
                      Add Color
                    </Text>
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
