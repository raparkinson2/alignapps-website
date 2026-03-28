import { View, Text, Pressable, Modal, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { Send, MessageSquare, Mail } from 'lucide-react-native';
import { useTeamStore, Player, getPlayerName } from '@/lib/store';
import { formatPhoneNumber } from '@/lib/phone';

// Placeholder for App Store URL - will be updated once app is published
const APP_STORE_URL = 'https://apps.apple.com/app/your-app-id';

interface SendInviteModalProps {
  visible: boolean;
  onClose: () => void;
  playerName: string;
  invitePhone?: string;
  inviteEmail?: string;
  player: Player | null;
  isReinviteMode: boolean;
}

export function SendInviteModal({
  visible,
  onClose,
  playerName,
  invitePhone,
  inviteEmail,
  player,
  isReinviteMode,
}: SendInviteModalProps) {
  const teamName = useTeamStore((s) => s.teamName);

  const getInviteMessage = (method: 'sms' | 'email') => {
    const name = player ? getPlayerName(player) : playerName;
    const contactInfo = method === 'sms'
      ? invitePhone
        ? `\n\nLog in with your phone number: ${formatPhoneNumber(invitePhone)}`
        : ''
      : inviteEmail
        ? `\n\nLog in with your email: ${inviteEmail}`
        : '';

    return `Hey ${name}!\n\nYou've been added to ${teamName}! Download the app and log in using your info to view the schedule, check in for games, and stay connected with the team.\n\nDownload here: ${APP_STORE_URL}${contactInfo}\n\nYour jersey number is #${player?.number}\n\nSee you at the next game!`;
  };

  const handleSendTextInvite = () => {
    if (!invitePhone) {
      Alert.alert('No Phone Number', 'This player does not have a phone number.');
      return;
    }

    const message = encodeURIComponent(getInviteMessage('sms'));
    const phoneNumber = invitePhone;

    const smsUrl = Platform.select({
      ios: `sms:${phoneNumber}&body=${message}`,
      android: `sms:${phoneNumber}?body=${message}`,
      default: `sms:${phoneNumber}?body=${message}`,
    });

    Linking.openURL(smsUrl).catch(() => {
      Alert.alert('Error', 'Could not open messaging app');
    });

    onClose();
  };

  const handleSendEmailInvite = async () => {
    if (!inviteEmail) {
      Alert.alert('No Email', 'This player does not have an email address.');
      return;
    }

    try {
      // Call Supabase Edge Function to send invitation email
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-invitation-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            to: inviteEmail,
            teamName: teamName,
            firstName: player?.firstName,
            userEmail: inviteEmail,
            jerseyNumber: player?.number || '00',
            appLink: 'https://apps.apple.com/app/id6740043565',
          }),
        }
      );

      if (response.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Email Sent', `Invite email sent to ${player ? getPlayerName(player) : playerName}!`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send email');
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send email. Please try again later.');
      console.error('Email invite send error:', error);
    }

    onClose();
  };

  const handleSkipInvite = () => {
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleSkipInvite}
    >
      <View className="flex-1 bg-black/60 justify-center items-center px-6">
        <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-slate-700">
          {/* Header */}
          <View className="items-center mb-6">
            <View className={`w-16 h-16 rounded-full ${isReinviteMode ? 'bg-cyan-500/20' : 'bg-green-500/20'} items-center justify-center mb-4`}>
              <Send size={32} color={isReinviteMode ? '#22d3ee' : '#22c55e'} />
            </View>
            <Text className="text-white text-xl font-bold text-center">
              {isReinviteMode ? 'Re-send Invite' : 'Player Added!'}
            </Text>
            <Text className="text-slate-400 text-center mt-2">
              {isReinviteMode
                ? `Send ${player ? getPlayerName(player) : playerName} another invite?`
                : `Send ${player ? getPlayerName(player) : playerName} an invite to register and join the team?`}
            </Text>
          </View>

          {/* Invite Options */}
          <View>
            {invitePhone && (
              <Pressable
                onPress={handleSendTextInvite}
                className="flex-row items-center justify-center bg-cyan-500 rounded-xl py-4 mb-3 active:bg-cyan-600"
              >
                <MessageSquare size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Send Text Message</Text>
              </Pressable>
            )}

            {inviteEmail && (
              <Pressable
                onPress={handleSendEmailInvite}
                className="flex-row items-center justify-center bg-purple-500 rounded-xl py-4 mb-3 active:bg-purple-600"
              >
                <Mail size={20} color="white" />
                <Text className="text-white font-semibold ml-2">Send Email</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSkipInvite}
              className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
            >
              <Text className="text-slate-300 font-semibold">Skip for Now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
