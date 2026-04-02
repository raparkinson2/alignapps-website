import { View, Text, Modal, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, CheckCircle2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTeamStore } from '@/lib/store';
import { AddressSearch } from '@/components/AddressSearch';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';

// --- Edit Opponent Modal ---

interface EditOpponentModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  initialOpponent: string;
  onSave: (opponent: string) => void;
}

export function EditOpponentModal({ visible, onClose, gameId, initialOpponent, onSave }: EditOpponentModalProps) {
  const [editOpponent, setEditOpponent] = useState(initialOpponent);

  // Reset state whenever modal opens
  const handleShow = () => {
    setEditOpponent(initialOpponent);
  };

  const handleSave = () => {
    if (!editOpponent.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    onSave(editOpponent.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Edit Opponent</Text>
            <Pressable onPress={handleSave}>
              <Check size={24} color="#22c55e" />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-6">
            <Text className="text-slate-400 text-sm mb-2">Opponent Name</Text>
            <TextInput
              value={editOpponent}
              onChangeText={setEditOpponent}
              placeholder="e.g., Ice Wolves"
              placeholderTextColor="#64748b"
              autoCapitalize="words"
              autoFocus
              className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg"
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Edit Date Modal ---

interface EditDateModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  initialDate: Date;
  onSave: (date: Date) => void;
}

export function EditDateModal({ visible, onClose, gameId, initialDate, onSave }: EditDateModalProps) {
  const [editDate, setEditDate] = useState<Date>(initialDate);

  const handleShow = () => {
    setEditDate(initialDate);
  };

  const handleSave = () => {
    onSave(editDate);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Edit Date</Text>
            <Pressable onPress={handleSave}>
              <Check size={24} color="#22c55e" />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-6 items-center">
            <DateTimePicker
              value={editDate}
              mode="date"
              display="inline"
              onChange={(event, date) => {
                if (date) setEditDate(date);
              }}
              themeVariant="dark"
              accentColor="#67e8f9"
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Edit Time Modal ---

interface EditTimeModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  initialTime: Date;
  onSave: (time: Date) => void;
}

export function EditTimeModal({ visible, onClose, gameId, initialTime, onSave }: EditTimeModalProps) {
  const [editTime, setEditTime] = useState<Date>(initialTime);

  const handleShow = () => {
    setEditTime(initialTime);
  };

  const handleSave = () => {
    onSave(editTime);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Edit Time</Text>
            <Pressable onPress={handleSave}>
              <Check size={24} color="#22c55e" />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-6 items-center">
            <DateTimePicker
              value={editTime}
              mode="time"
              display="spinner"
              onChange={(event, time) => {
                if (time) setEditTime(time);
              }}
              themeVariant="dark"
              accentColor="#67e8f9"
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Edit Jersey Modal ---

interface EditJerseyModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  currentJerseyColor: string;
  onSave: (color: string) => void;
}

export function EditJerseyModal({ visible, onClose, gameId, currentJerseyColor, onSave }: EditJerseyModalProps) {
  const teamSettings = useTeamStore((s) => s.teamSettings);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Select Jersey</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView className="flex-1 px-5 pt-4">
            {teamSettings.jerseyColors.map((color) => (
              <Pressable
                key={color.name}
                onPress={() => onSave(color.name)}
                className={cn(
                  'flex-row items-center p-4 rounded-xl mb-2 border',
                  currentJerseyColor === color.name
                    ? 'bg-cyan-500/20 border-cyan-500/50'
                    : 'bg-slate-800/60 border-slate-700/50'
                )}
              >
                <View
                  className="w-10 h-10 rounded-full mr-3 border-2 border-white/30"
                  style={{ backgroundColor: color.color }}
                />
                <Text
                  className={cn(
                    'font-semibold flex-1',
                    currentJerseyColor === color.name ? 'text-cyan-400' : 'text-white'
                  )}
                >
                  {color.name}
                </Text>
                {currentJerseyColor === color.name && (
                  <CheckCircle2 size={24} color="#67e8f9" />
                )}
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Edit Location Modal ---

interface EditLocationModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  initialLocation: string;
  onSave: (location: string, address: string) => void;
}

export function EditLocationModal({ visible, onClose, gameId, initialLocation, onSave }: EditLocationModalProps) {
  const [editLocation, setEditLocation] = useState(initialLocation);
  const [editAddress, setEditAddress] = useState('');

  const handleShow = () => {
    setEditLocation(initialLocation);
    setEditAddress('');
  };

  const handleSave = () => {
    if (!editLocation.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    onSave(editLocation.trim(), editAddress.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Edit Location</Text>
            <Pressable onPress={handleSave}>
              <Check size={24} color="#22c55e" />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-6" style={{ zIndex: 50 }}>
            <Text className="text-slate-400 text-sm mb-2">Venue or Address</Text>
            <AddressSearch
              value={editLocation}
              onChangeText={setEditLocation}
              onSelectLocation={(name, address) => {
                setEditLocation(name);
                setEditAddress(address);
              }}
              placeholder="Search for a venue or address..."
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Edit Notes Modal ---

interface EditNotesModalProps {
  visible: boolean;
  onClose: () => void;
  gameId: string;
  initialNotes: string;
  onSave: (notes: string) => void;
}

export function EditNotesModal({ visible, onClose, gameId, initialNotes, onSave }: EditNotesModalProps) {
  const [editNotes, setEditNotes] = useState(initialNotes);

  const handleShow = () => {
    setEditNotes(initialNotes);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleShow}
    >
      <View className="flex-1 bg-slate-900">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Pressable onPress={onClose}>
              <X size={24} color="#64748b" />
            </Pressable>
            <Text className="text-white text-lg font-semibold">Edit Notes</Text>
            <Pressable onPress={() => {
              onSave(editNotes.trim());
            }}>
              <Check size={24} color="#22c55e" />
            </Pressable>
          </View>
          <View className="flex-1 px-5 pt-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-400 text-sm">Notes</Text>
              <Text className={cn(
                "text-sm",
                editNotes.length > 30 ? "text-red-500" : "text-slate-500"
              )}>{editNotes.length}/30</Text>
            </View>
            <TextInput
              value={editNotes}
              onChangeText={(text) => {
                if (text.length <= 30) {
                  setEditNotes(text);
                }
              }}
              placeholder="Add a short note..."
              placeholderTextColor="#64748b"
              maxLength={30}
              className="bg-slate-800 rounded-xl p-4 text-white text-base"
              autoFocus
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// --- Bundle: GameInlineEditModals ---

export interface GameInlineEditModalsProps {
  // Visibility flags
  isEditOpponentModalVisible: boolean;
  isEditDateModalVisible: boolean;
  isEditTimeModalVisible: boolean;
  isEditJerseyModalVisible: boolean;
  isEditLocationModalVisible: boolean;
  isEditNotesModalVisible: boolean;
  // Close callbacks
  onCloseOpponent: () => void;
  onCloseDate: () => void;
  onCloseTime: () => void;
  onCloseJersey: () => void;
  onCloseLocation: () => void;
  onCloseNotes: () => void;
  // Game ID + initial data
  gameId: string;
  initialOpponent: string;
  initialDate: Date;
  initialTime: Date;
  currentJerseyColor: string;
  initialLocation: string;
  initialNotes: string;
  // Save callbacks
  onSaveOpponent: (opponent: string) => void;
  onSaveDate: (date: Date) => void;
  onSaveTime: (time: Date) => void;
  onSaveJersey: (color: string) => void;
  onSaveLocation: (location: string, address: string) => void;
  onSaveNotes: (notes: string) => void;
}

export function GameInlineEditModals({
  isEditOpponentModalVisible,
  isEditDateModalVisible,
  isEditTimeModalVisible,
  isEditJerseyModalVisible,
  isEditLocationModalVisible,
  isEditNotesModalVisible,
  onCloseOpponent,
  onCloseDate,
  onCloseTime,
  onCloseJersey,
  onCloseLocation,
  onCloseNotes,
  gameId,
  initialOpponent,
  initialDate,
  initialTime,
  currentJerseyColor,
  initialLocation,
  initialNotes,
  onSaveOpponent,
  onSaveDate,
  onSaveTime,
  onSaveJersey,
  onSaveLocation,
  onSaveNotes,
}: GameInlineEditModalsProps) {
  return (
    <>
      <EditOpponentModal
        visible={isEditOpponentModalVisible}
        onClose={onCloseOpponent}
        gameId={gameId}
        initialOpponent={initialOpponent}
        onSave={onSaveOpponent}
      />
      <EditDateModal
        visible={isEditDateModalVisible}
        onClose={onCloseDate}
        gameId={gameId}
        initialDate={initialDate}
        onSave={onSaveDate}
      />
      <EditTimeModal
        visible={isEditTimeModalVisible}
        onClose={onCloseTime}
        gameId={gameId}
        initialTime={initialTime}
        onSave={onSaveTime}
      />
      <EditJerseyModal
        visible={isEditJerseyModalVisible}
        onClose={onCloseJersey}
        gameId={gameId}
        currentJerseyColor={currentJerseyColor}
        onSave={onSaveJersey}
      />
      <EditLocationModal
        visible={isEditLocationModalVisible}
        onClose={onCloseLocation}
        gameId={gameId}
        initialLocation={initialLocation}
        onSave={onSaveLocation}
      />
      <EditNotesModal
        visible={isEditNotesModalVisible}
        onClose={onCloseNotes}
        gameId={gameId}
        initialNotes={initialNotes}
        onSave={onSaveNotes}
      />
    </>
  );
}
