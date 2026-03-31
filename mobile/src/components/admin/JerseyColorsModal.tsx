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
  PanResponder,
} from 'react-native';
import { useState, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import { X, Plus, Edit3, Trash2, ChevronDown, ChevronUp, Hash } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeamStore } from '@/lib/store';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';

interface JerseyColorsModalProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Color math ───────────────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { h: 0, s: 0, v: 100 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(max === 0 ? 0 : (d / max) * 100),
    v: Math.round(max * 100),
  };
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

// ─── Draggable color strip ─────────────────────────────────────────────────────

interface StripProps {
  gradientColors: string[];
  value: number; // 0–1 normalized
  onChange: (v: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  indicatorColor: string;
}

function ColorStrip({ gradientColors, value, onChange, onDragStart, onDragEnd, indicatorColor }: StripProps) {
  const widthRef = useRef(0);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onDragStart();
        const x = e.nativeEvent.locationX;
        onChange(clamp(x / widthRef.current));
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        onChange(clamp(x / widthRef.current));
      },
      onPanResponderRelease: () => onDragEnd(),
      onPanResponderTerminate: () => onDragEnd(),
    })
  ).current;

  const INDICATOR_SIZE = 28;
  const indicatorLeft = value * Math.max(0, widthRef.current - INDICATOR_SIZE);

  return (
    <View
      onLayout={(e) => { widthRef.current = e.nativeEvent.layout.width; }}
      style={{ height: 44, justifyContent: 'center' }}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={gradientColors as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ height: 36, borderRadius: 18 }}
      />
      {/* Indicator thumb */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: indicatorLeft,
          width: INDICATOR_SIZE,
          height: INDICATOR_SIZE,
          borderRadius: INDICATOR_SIZE / 2,
          backgroundColor: indicatorColor,
          borderWidth: 3,
          borderColor: '#ffffff',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.4,
          shadowRadius: 4,
          elevation: 6,
        }}
      />
    </View>
  );
}

// ─── Full custom color picker (expands inline) ─────────────────────────────────

interface CustomPickerProps {
  color: string;
  onChange: (hex: string) => void;
  setScrollEnabled: (v: boolean) => void;
}

function CustomColorPicker({ color, onChange, setScrollEnabled }: CustomPickerProps) {
  const hsv = hexToHsv(isValidHex(color) ? color : '#FF0000');
  const [hue, setHue] = useState(hsv.h);
  const [brightness, setBrightness] = useState(Math.max(hsv.v, 40)); // at least 40% so it's visible
  const [showHex, setShowHex] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [hexError, setHexError] = useState(false);

  const pureHueColor = hsvToHex(hue, 100, 100);
  const currentColor = hsvToHex(hue, 100, brightness);

  const handleHueChange = (v: number) => {
    const newHue = Math.round(v * 360);
    setHue(newHue);
    onChange(hsvToHex(newHue, 100, brightness));
  };

  const handleBrightnessChange = (v: number) => {
    // v=0 → black, v=1 → full hue color
    const newBrightness = Math.round(v * 100);
    setBrightness(newBrightness);
    onChange(hsvToHex(hue, 100, newBrightness));
  };

  const handleHexInput = (text: string) => {
    setHexInput(text);
    setHexError(false);
    const normalized = text.startsWith('#') ? text : `#${text}`;
    if (isValidHex(normalized)) {
      const parsed = hexToHsv(normalized);
      setHue(parsed.h);
      setBrightness(Math.max(parsed.v, 40));
      onChange(normalized.toUpperCase());
    }
  };

  const handleHexBlur = () => {
    if (!hexInput.trim()) return;
    const normalized = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
    if (!isValidHex(normalized)) setHexError(true);
  };

  return (
    <View style={{ gap: 16 }}>
      {/* Preview + info row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: currentColor,
            borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.15)',
            flexShrink: 0,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 2 }}>Selected Color</Text>
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800', letterSpacing: 1 }}>
            {currentColor}
          </Text>
        </View>
        {/* Hex input toggle */}
        <Pressable
          onPress={() => { setShowHex((v) => !v); setHexInput(''); setHexError(false); }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: showHex ? 'rgba(103,232,249,0.15)' : 'rgba(255,255,255,0.06)',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 7,
            borderWidth: 1,
            borderColor: showHex ? 'rgba(103,232,249,0.3)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <Hash size={13} color={showHex ? '#67e8f9' : '#64748b'} />
          <Text style={{ color: showHex ? '#67e8f9' : '#64748b', fontSize: 12, fontWeight: '600' }}>Hex</Text>
        </Pressable>
      </View>

      {/* Hex input (collapsible) */}
      {showHex && (
        <View>
          <TextInput
            value={hexInput}
            onChangeText={handleHexInput}
            onBlur={handleHexBlur}
            onSubmitEditing={() => Keyboard.dismiss()}
            placeholder={currentColor}
            placeholderTextColor="#475569"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            maxLength={7}
            style={{
              backgroundColor: hexError ? 'rgba(239,68,68,0.1)' : '#0f172a',
              borderWidth: 1,
              borderColor: hexError ? 'rgba(239,68,68,0.5)' : 'rgba(103,232,249,0.2)',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 11,
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '700',
              letterSpacing: 2,
            }}
          />
          {hexError && (
            <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 4 }}>
              Enter a valid 6-digit hex like #FF6B00
            </Text>
          )}
        </View>
      )}

      {/* Hue strip */}
      <View>
        <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Color
        </Text>
        <ColorStrip
          gradientColors={['#FF0000','#FFFF00','#00FF00','#00FFFF','#0000FF','#FF00FF','#FF0000']}
          value={hue / 360}
          onChange={handleHueChange}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
          indicatorColor={pureHueColor}
        />
      </View>

      {/* Brightness strip */}
      <View>
        <Text style={{ color: '#475569', fontSize: 11, fontWeight: '600', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Brightness
        </Text>
        <ColorStrip
          gradientColors={['#000000', pureHueColor]}
          value={brightness / 100}
          onChange={handleBrightnessChange}
          onDragStart={() => setScrollEnabled(false)}
          onDragEnd={() => setScrollEnabled(true)}
          indicatorColor={currentColor}
        />
      </View>
    </View>
  );
}

// ─── Color picker wrapper: presets + expandable custom ────────────────────────

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (hex: string) => void;
  setScrollEnabled: (v: boolean) => void;
  scrollRef: React.RefObject<ScrollView | null>;
  scrollToY?: number;
}

const COLOR_PRESETS = [
  '#FFFFFF', '#1A1A1A', '#1E40AF', '#DC2626', '#16A34A',
  '#7C3AED', '#EA580C', '#CA8A04', '#0891B2', '#DB2777',
];

function ColorPicker({ selectedColor, onColorChange, setScrollEnabled, scrollRef, scrollToY = 400 }: ColorPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const isPreset = COLOR_PRESETS.map((c) => c.toUpperCase()).includes(selectedColor.toUpperCase());

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      setTimeout(() => scrollRef.current?.scrollTo({ y: scrollToY, animated: true }), 120);
    }
  };

  return (
    <View>
      {/* Preset swatches row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {COLOR_PRESETS.map((hex) => {
          const isSelected = selectedColor.toUpperCase() === hex.toUpperCase();
          return (
            <Pressable
              key={hex}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onColorChange(hex);
                setExpanded(false);
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: hex,
                borderWidth: isSelected ? 3 : 2,
                borderColor: isSelected ? '#67e8f9' : '#334155',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isSelected && (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: hex === '#FFFFFF' || hex === '#CA8A04' ? '#000' : '#fff',
                  }}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Custom color toggle button */}
      <Pressable
        onPress={handleToggle}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: expanded ? 'rgba(103,232,249,0.08)' : 'rgba(255,255,255,0.04)',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: expanded ? 'rgba(103,232,249,0.25)' : 'rgba(255,255,255,0.07)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {/* Current custom color preview */}
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: selectedColor,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.2)',
            }}
          />
          <Text style={{ color: !isPreset && !expanded ? '#67e8f9' : '#94a3b8', fontSize: 14, fontWeight: '600' }}>
            {!isPreset ? 'Custom color' : 'Custom color...'}
          </Text>
        </View>
        {expanded
          ? <ChevronUp size={16} color="#67e8f9" />
          : <ChevronDown size={16} color="#64748b" />
        }
      </Pressable>

      {/* Expanded custom picker */}
      {expanded && (
        <View
          style={{
            marginTop: 12,
            backgroundColor: 'rgba(15,23,42,0.8)',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(103,232,249,0.15)',
          }}
        >
          <CustomColorPicker
            color={selectedColor}
            onChange={onColorChange}
            setScrollEnabled={setScrollEnabled}
          />
        </View>
      )}
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function JerseyColorsModal({ visible, onClose }: JerseyColorsModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const games = useTeamStore((s) => s.games);
  const updateGame = useTeamStore((s) => s.updateGame);

  const scrollRef = useRef<ScrollView | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#1E40AF');
  const [editingColorIndex, setEditingColorIndex] = useState<number | null>(null);
  const [editColorName, setEditColorName] = useState('');
  const [editColorHex, setEditColorHex] = useState('#ffffff');

  const sync = useCallback((updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  }, [activeTeamId, setTeamSettings]);

  const handleAdd = () => {
    if (!newColorName.trim()) return;
    Keyboard.dismiss();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sync({ jerseyColors: [...teamSettings.jerseyColors, { name: newColorName.trim(), color: newColorHex }] });
    setNewColorName('');
    setNewColorHex('#1E40AF');
  };

  const handleEditOpen = (index: number) => {
    const c = teamSettings.jerseyColors[index];
    setEditingColorIndex(index);
    setEditColorName(c.name);
    setEditColorHex(c.color);
    setTimeout(() => scrollRef.current?.scrollTo({ y: index * 76, animated: true }), 150);
  };

  const handleSaveEdit = () => {
    if (editingColorIndex === null || !editColorName.trim()) return;
    Keyboard.dismiss();
    const oldName = teamSettings.jerseyColors[editingColorIndex].name;
    const newName = editColorName.trim();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = [...teamSettings.jerseyColors];
    updated[editingColorIndex] = { name: newName, color: editColorHex };
    sync({ jerseyColors: updated });
    if (oldName !== newName) {
      games.forEach((g) => { if (g.jerseyColor === oldName) updateGame(g.id, { jerseyColor: newName }); });
    }
    setEditingColorIndex(null);
  };

  const handleCancelEdit = () => {
    Keyboard.dismiss();
    setEditingColorIndex(null);
  };

  const handleDelete = (index: number, name: string) => {
    Alert.alert('Remove Jersey Color', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sync({ jerseyColors: teamSettings.jerseyColors.filter((_, i) => i !== index) });
          setEditingColorIndex(null);
        },
      },
    ]);
  };

  const numColors = teamSettings.jerseyColors.length;
  const addSectionY = numColors * 80 + 180;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { Keyboard.dismiss(); onClose(); }}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
        onPress={() => Keyboard.dismiss()}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1e293b' }}>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Jersey Colors</Text>
                <Pressable onPress={() => { Keyboard.dismiss(); onClose(); }} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} color="#94a3b8" />
                </Pressable>
              </View>

              <ScrollView
                ref={scrollRef}
                scrollEnabled={scrollEnabled}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
              >
                {/* ── Current colors ── */}
                <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 }}>
                  Current Colors
                </Text>

                {teamSettings.jerseyColors.map((color, index) => (
                  <View key={`color-${index}`}>
                    {editingColorIndex === index ? (
                      <View style={{ backgroundColor: '#1e293b', borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: 'rgba(103,232,249,0.35)' }}>
                        <TextInput
                          value={editColorName}
                          onChangeText={setEditColorName}
                          onSubmitEditing={() => Keyboard.dismiss()}
                          returnKeyType="done"
                          placeholder="Name (e.g. Home)"
                          placeholderTextColor="#475569"
                          autoCapitalize="words"
                          style={{ backgroundColor: '#0f172a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#ffffff', fontSize: 15, marginBottom: 14 }}
                        />
                        <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Pick Color</Text>
                        <ColorPicker
                          selectedColor={editColorHex}
                          onColorChange={setEditColorHex}
                          setScrollEnabled={setScrollEnabled}
                          scrollRef={scrollRef}
                          scrollToY={index * 80 + 100}
                        />
                        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
                          <Pressable onPress={handleCancelEdit} style={{ flex: 1, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' }}>
                            <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Cancel</Text>
                          </Pressable>
                          <Pressable onPress={() => handleDelete(index, color.name)} style={{ backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)' }}>
                            <Trash2 size={18} color="#ef4444" />
                          </Pressable>
                          <Pressable onPress={handleSaveEdit} style={{ flex: 1, backgroundColor: '#67e8f9', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}>
                            <Text style={{ color: '#000', fontWeight: '700' }}>Save</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => handleEditOpen(index)}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 14, padding: 14, marginBottom: 8 }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color.color, borderWidth: 2, borderColor: '#334155' }} />
                        <Text style={{ color: '#ffffff', fontWeight: '600', marginLeft: 12, flex: 1, fontSize: 15 }}>{color.name}</Text>
                        <Text style={{ color: '#334155', fontSize: 11, fontWeight: '600', marginRight: 8 }}>{color.color.toUpperCase()}</Text>
                        <Edit3 size={15} color="#67e8f9" />
                      </Pressable>
                    )}
                  </View>
                ))}

                {/* ── Add new color ── */}
                <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12, marginTop: 20 }}>
                  Add New Color
                </Text>

                <View style={{ backgroundColor: '#1e293b', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#334155' }}>
                  <TextInput
                    value={newColorName}
                    onChangeText={setNewColorName}
                    onSubmitEditing={() => Keyboard.dismiss()}
                    returnKeyType="done"
                    placeholder="Name (e.g. Home, Away, Black)"
                    placeholderTextColor="#475569"
                    autoCapitalize="words"
                    style={{ backgroundColor: '#0f172a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#ffffff', fontSize: 15, marginBottom: 14 }}
                  />
                  <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Pick Color</Text>
                  <ColorPicker
                    selectedColor={newColorHex}
                    onColorChange={setNewColorHex}
                    setScrollEnabled={setScrollEnabled}
                    scrollRef={scrollRef}
                    scrollToY={addSectionY}
                  />
                  <Pressable
                    onPress={handleAdd}
                    style={{ marginTop: 16, backgroundColor: newColorName.trim() ? '#67e8f9' : '#1e3a4a', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Plus size={18} color={newColorName.trim() ? '#000' : '#334155'} />
                    <Text style={{ color: newColorName.trim() ? '#000' : '#334155', fontWeight: '700', fontSize: 15 }}>Add Color</Text>
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
