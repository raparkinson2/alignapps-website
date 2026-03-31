import { View, Text, ScrollView, Pressable, Alert, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';

export interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (password: string) => void;
}

export function ChangePasswordModal({ visible, onClose, onSave }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const validatePassword = (password: string): string[] => {
    const errorList: string[] = [];
    if (password.length < 8) {
      errorList.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errorList.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errorList.push('At least one lowercase letter');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errorList.push('At least one special symbol');
    }
    return errorList;
  };

  const handleSave = () => {
    const validationErrors = validatePassword(newPassword);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    onSave(newPassword);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewPassword('');
    setConfirmPassword('');
    setErrors([]);
    onClose();
    Alert.alert('Success', 'Your password has been updated');
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setErrors([]);
    onClose();
  };

  const currentErrors = newPassword.length > 0 ? validatePassword(newPassword) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl">
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Change Password</Text>
              <Pressable
                onPress={handleClose}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {/* New Password */}
              <View className="mb-4">
                <Text className="text-slate-400 text-sm mb-2">New Password</Text>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
              </View>

              {/* Password Requirements */}
              <View className="mb-4 bg-slate-800/50 rounded-xl p-3">
                <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                  Password Requirements
                </Text>
                <View className="flex-row items-center mb-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${newPassword.length >= 8 ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${newPassword.length >= 8 ? 'text-green-400' : 'text-slate-400'}`}>
                    At least 8 characters
                  </Text>
                </View>
                <View className="flex-row items-center mb-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${/[A-Z]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${/[A-Z]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                    At least one uppercase letter
                  </Text>
                </View>
                <View className="flex-row items-center mb-1">
                  <View className={`w-2 h-2 rounded-full mr-2 ${/[a-z]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${/[a-z]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                    At least one lowercase letter
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <View className={`w-2 h-2 rounded-full mr-2 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <Text className={`text-sm ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-green-400' : 'text-slate-400'}`}>
                    At least one special symbol
                  </Text>
                </View>
              </View>

              {/* Confirm Password */}
              <View className="mb-6">
                <Text className="text-slate-400 text-sm mb-2">Confirm Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor="#64748b"
                  secureTextEntry
                  autoCapitalize="none"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-base"
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <Text className="text-red-400 text-sm mt-1">Passwords do not match</Text>
                )}
                {confirmPassword.length > 0 && newPassword === confirmPassword && (
                  <Text className="text-green-400 text-sm mt-1">Passwords match</Text>
                )}
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                className="bg-cyan-500 rounded-xl py-4 items-center mb-8 active:bg-cyan-600"
              >
                <Text className="text-white font-semibold text-base">Update Password</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
