import { View, Text, ScrollView, Pressable, Alert, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { X, User, Camera, Trash2, Lock, ChevronRight, UserX } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Player, getPlayerName } from '@/lib/store';
import { formatPhoneInput, formatPhoneNumber, unformatPhone } from '@/lib/phone';

export interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  player: Player;
  onSave: (updates: Partial<Player>) => void;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
}

export function EditProfileModal({ visible, onClose, player, onSave, onChangePassword, onDeleteAccount }: EditProfileModalProps) {
  const [avatar, setAvatar] = useState(player.avatar || '');
  const [number, setNumber] = useState(player.number);
  const [phone, setPhone] = useState(formatPhoneNumber(player.phone));
  const [email, setEmail] = useState(player.email || '');

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to update your profile picture.',
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
    }
  };

  const handleSave = () => {
    if (!number.trim()) {
      Alert.alert('Error', 'Jersey number is required');
      return;
    }
    // Store raw phone digits
    const rawPhone = unformatPhone(phone);
    onSave({
      avatar: avatar || undefined,
      number: number.trim(),
      phone: rawPhone || undefined,
      email: email.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl max-h-[90%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Edit Profile</Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {/* Avatar */}
              <View className="items-center mb-6">
                <Pressable onPress={handlePickImage} className="relative">
                  {avatar ? (
                    <Image
                      source={{ uri: avatar }}
                      style={{ width: 100, height: 100, borderRadius: 50 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="w-24 h-24 rounded-full bg-slate-700 items-center justify-center">
                      <User size={40} color="#94a3b8" />
                    </View>
                  )}
                  <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-cyan-500 items-center justify-center">
                    <Camera size={16} color="white" />
                  </View>
                </Pressable>
                <Text className="text-slate-400 text-sm mt-2">Tap to change photo</Text>
                {avatar && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setAvatar('');
                    }}
                    className="flex-row items-center mt-3 px-4 py-2 bg-red-500/20 rounded-full active:bg-red-500/30"
                  >
                    <Trash2 size={14} color="#f87171" />
                    <Text className="text-red-400 text-sm font-medium ml-2">Remove Photo</Text>
                  </Pressable>
                )}
              </View>

              {/* Player Name (read-only display) */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Name</Text>
                <View className="bg-slate-800/50 rounded-xl px-4 py-3">
                  <Text className="text-slate-300 text-base">{getPlayerName(player)}</Text>
                </View>
                <Text className="text-slate-500 text-xs mt-1">Contact an admin to change your name</Text>
              </View>

              {/* Jersey Number */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Jersey Number</Text>
                <TextInput
                  value={number}
                  onChangeText={setNumber}
                  placeholder="Enter jersey number"
                  placeholderTextColor="#64748b"
                  keyboardType="number-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                  maxLength={3}
                />
              </View>

              {/* Phone */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">Phone Number</Text>
                <TextInput
                  value={phone}
                  onChangeText={(text) => setPhone(formatPhoneInput(text))}
                  placeholder="(555)123-4567"
                  placeholderTextColor="#64748b"
                  keyboardType="phone-pad"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
              </View>

              {/* Email */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter email address"
                  placeholderTextColor="#64748b"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                className="bg-cyan-500 rounded-xl py-4 items-center mb-6 active:bg-cyan-600"
              >
                <Text className="text-white font-semibold text-base">Save Changes</Text>
              </Pressable>

              {/* Account Section */}
              <View className="border-t border-slate-700/50 pt-4 mb-8">
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                  Account
                </Text>

                {/* Change Password */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    onChangePassword();
                  }}
                  className="flex-row items-center py-3 px-4 bg-slate-800/60 rounded-xl mb-2 active:bg-slate-700/80"
                >
                  <Lock size={18} color="#67e8f9" />
                  <Text className="text-white ml-3 flex-1">Change Password</Text>
                  <ChevronRight size={18} color="#64748b" />
                </Pressable>

                {/* Delete My Account */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onClose();
                    onDeleteAccount();
                  }}
                  className="flex-row items-center py-3 px-4 bg-slate-800/60 rounded-xl active:bg-slate-700/80"
                >
                  <UserX size={18} color="#f87171" />
                  <Text className="text-red-400 ml-3 flex-1">Delete My Account</Text>
                  <ChevronRight size={18} color="#64748b" />
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
