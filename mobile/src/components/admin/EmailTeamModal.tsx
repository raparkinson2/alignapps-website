import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { X, Check } from 'lucide-react-native';
import { useTeamStore, getPlayerName } from '@/lib/store';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface EmailTeamModalProps {
  visible: boolean;
  onClose: () => void;
}

export function EmailTeamModal({ visible, onClose }: EmailTeamModalProps) {
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">Email Team</Text>
            <View className="flex-row items-center">
              <Pressable
                onPress={async () => {
                  if (!emailSubject.trim()) {
                    Alert.alert('Subject Required', 'Please enter a subject for your email.');
                    return;
                  }
                  if (!emailBody.trim()) {
                    Alert.alert('Message Required', 'Please enter a message for your email.');
                    return;
                  }
                  if (selectedRecipients.length === 0) {
                    Alert.alert('No Recipients', 'Please select at least one recipient.');
                    return;
                  }

                  setIsSendingEmail(true);

                  try {
                    // Get selected player emails
                    const recipientEmails = players
                      .filter(p => selectedRecipients.includes(p.id) && p.email)
                      .map(p => p.email as string);

                    // Call Supabase Edge Function to send email
                    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
                    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;
                    const response = await fetch(
                      `${supabaseUrl}/functions/v1/send-team-email`,
                      {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${supabaseAnonKey}`,
                        },
                        body: JSON.stringify({
                          to: recipientEmails,
                          subject: emailSubject.trim(),
                          body: emailBody.trim(),
                          teamName: teamName,
                        }),
                      }
                    );

                    if (response.ok) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      Alert.alert('Email Sent', `Your email has been sent to ${recipientEmails.length} team member${recipientEmails.length === 1 ? '' : 's'}.`);
                      onClose();
                      setEmailSubject('');
                      setEmailBody('');
                      setSelectedRecipients([]);
                    } else {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(errorData.error || 'Failed to send email');
                    }
                  } catch (err) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    Alert.alert('Error', 'Failed to send email. Please try again later.');
                    console.error('Email send error:', err);
                  }

                  setIsSendingEmail(false);
                }}
                disabled={isSendingEmail || !emailSubject.trim() || !emailBody.trim() || selectedRecipients.length === 0}
                className="px-3 py-2 mr-1"
              >
                <Text className={`font-semibold ${isSendingEmail || !emailSubject.trim() || !emailBody.trim() || selectedRecipients.length === 0 ? 'text-slate-600' : 'text-cyan-400'}`}>
                  {isSendingEmail ? 'Sending...' : 'Send'}
                </Text>
              </Pressable>
              <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
          </View>

          <ScrollView className="px-5 py-4" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Subject */}
            <View className="mb-4">
              <Text className="text-slate-400 text-sm mb-2">Subject</Text>
              <TextInput
                value={emailSubject}
                onChangeText={setEmailSubject}
                placeholder="Enter email subject"
                placeholderTextColor="#64748b"
                className="bg-slate-800/80 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50"
              />
            </View>

            {/* Body */}
            <View className="mb-4">
              <Text className="text-slate-400 text-sm mb-2">Message</Text>
              <TextInput
                value={emailBody}
                onChangeText={setEmailBody}
                placeholder="Type your message here..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                className="bg-slate-800/80 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50 min-h-[150px]"
              />
            </View>

            {/* Recipients */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-slate-400 text-sm">Recipients</Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const playersWithEmail = players.filter(p => p.email && p.email.trim()).map(p => p.id);
                    if (selectedRecipients.length === playersWithEmail.length) {
                      setSelectedRecipients([]);
                    } else {
                      setSelectedRecipients(playersWithEmail);
                    }
                  }}
                >
                  <Text className="text-cyan-400 text-sm font-medium">
                    {selectedRecipients.length === players.filter(p => p.email && p.email.trim()).length ? 'Deselect All' : 'Select All'}
                  </Text>
                </Pressable>
              </View>

              <View className="bg-slate-800/80 rounded-xl border border-slate-700/50 overflow-hidden">
                {players.filter(p => p.email && p.email.trim()).map((player, index, arr) => (
                  <Pressable
                    key={player.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (selectedRecipients.includes(player.id)) {
                        setSelectedRecipients(selectedRecipients.filter(id => id !== player.id));
                      } else {
                        setSelectedRecipients([...selectedRecipients, player.id]);
                      }
                    }}
                    className={`flex-row items-center px-4 py-3 ${index < arr.length - 1 ? 'border-b border-slate-700/50' : ''}`}
                  >
                    <View className={`w-5 h-5 rounded-md mr-3 items-center justify-center ${selectedRecipients.includes(player.id) ? 'bg-cyan-500' : 'bg-slate-700 border border-slate-600'}`}>
                      {selectedRecipients.includes(player.id) && <Check size={14} color="white" />}
                    </View>
                    <PlayerAvatar player={player} size={36} />
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                      <Text className="text-slate-400 text-xs">{player.email}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text className="text-slate-500 text-xs mt-2">
                {selectedRecipients.length} of {players.filter(p => p.email && p.email.trim()).length} recipients selected
              </Text>
            </View>

            {/* Info notice */}
            <View className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 mb-6">
              <Text className="text-blue-400 text-sm">
                Emails will be sent from noreply@alignapps.com
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
