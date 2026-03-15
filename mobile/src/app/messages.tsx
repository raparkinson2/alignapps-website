import {
  View, Text, Pressable, TextInput, ScrollView, Modal,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Send, Plus, X, Check, CheckCheck, Inbox, Mail, Trash2 } from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeamStore, DirectMessage, getPlayerName } from '@/lib/store';
import { sendDirectMessage, fetchDirectMessages, fetchSentDirectMessages, markMessageReadInSupabase, subscribeToDirectMessages } from '@/lib/messages-sync';
import { sendPushToPlayers } from '@/lib/notifications';
import { cn } from '@/lib/cn';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { format, isToday, isYesterday } from 'date-fns';

function formatMessageDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
}

function SwipeableMessageRow({
  children,
  onDelete,
  index,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  index: number;
}) {
  const translateX = useSharedValue(0);
  const DELETE_THRESHOLD = -80;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = Math.max(event.translationX, -100);
      } else {
        translateX.value = withSpring(0);
      }
    })
    .onEnd((event) => {
      if (event.translationX < DELETE_THRESHOLD) {
        translateX.value = withSpring(-80);
      } else {
        translateX.value = withSpring(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteOpacityStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / 40),
  }));

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).springify()} className="mb-3">
      <View style={{ overflow: 'hidden', borderRadius: 16 }}>
        {/* Delete button behind */}
        <Animated.View
          style={[deleteOpacityStyle, { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }]}
        >
          <Pressable
            onPress={() => { translateX.value = withSpring(0); onDelete(); }}
            style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            <Trash2 size={22} color="white" />
            <Text style={{ color: 'white', fontSize: 11, fontWeight: '600', marginTop: 2 }}>Delete</Text>
          </Pressable>
        </Animated.View>
        {/* Swipeable row */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={animatedStyle}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ openMessageId?: string }>();

  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const teamName = useTeamStore((s) => s.teamName);
  const directMessages = useTeamStore((s) => s.directMessages);
  const addDirectMessage = useTeamStore((s) => s.addDirectMessage);
  const markDirectMessageRead = useTeamStore((s) => s.markDirectMessageRead);
  const removeDirectMessage = useTeamStore((s) => s.removeDirectMessage);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isAdmin = currentPlayer?.roles?.includes('admin') ?? false;

  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox');
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Compose modal
  const [composeVisible, setComposeVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Detail modal
  const [selectedMessage, setSelectedMessage] = useState<DirectMessage | null>(null);

  // Player selector search
  const [playerSearch, setPlayerSearch] = useState('');

  const activePlayers = players.filter((p) => p.status === 'active' || p.status === 'reserve');
  const filteredPlayers = activePlayers.filter((p) => {
    if (p.id === currentPlayerId) return false;
    const name = getPlayerName(p).toLowerCase();
    return name.includes(playerSearch.toLowerCase());
  });

  // Load messages from Supabase
  const loadMessages = useCallback(async () => {
    if (!activeTeamId || !currentPlayerId) return;
    setIsLoading(true);
    try {
      if (tab === 'inbox') {
        const result = await fetchDirectMessages(activeTeamId, currentPlayerId);
        if (result.success && result.messages) {
          result.messages.forEach((m) => {
            if (!directMessages.find((dm) => dm.id === m.id)) {
              addDirectMessage(m);
            }
          });
        }
      } else {
        const result = await fetchSentDirectMessages(activeTeamId, currentPlayerId);
        if (result.success && result.messages) {
          result.messages.forEach((m) => {
            if (!directMessages.find((dm) => dm.id === m.id)) {
              addDirectMessage(m);
            }
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTeamId, currentPlayerId, tab]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!activeTeamId || !currentPlayerId) return;
    const unsub = subscribeToDirectMessages(activeTeamId, currentPlayerId, (msg) => {
      addDirectMessage(msg);
    });
    return unsub;
  }, [activeTeamId, currentPlayerId]);

  // Auto-open message from push notification
  useEffect(() => {
    if (params.openMessageId && directMessages.length > 0) {
      const msg = directMessages.find((m) => m.id === params.openMessageId);
      if (msg) openMessage(msg);
    }
  }, [params.openMessageId, directMessages]);

  const openMessage = (msg: DirectMessage) => {
    setSelectedMessage(msg);
    if (currentPlayerId && !msg.readBy.includes(currentPlayerId)) {
      markDirectMessageRead(msg.id, currentPlayerId);
      markMessageReadInSupabase(msg.id, currentPlayerId);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSend = async () => {
    if (!subject.trim()) { Alert.alert('Missing subject', 'Please enter a subject.'); return; }
    if (!body.trim()) { Alert.alert('Missing message', 'Please enter a message.'); return; }
    if (selectedRecipients.length === 0) { Alert.alert('No recipients', 'Please select at least one recipient.'); return; }
    if (!currentPlayerId || !activeTeamId || !currentPlayer) return;

    setIsSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const message: DirectMessage = {
      id: `dm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      teamId: activeTeamId,
      senderId: currentPlayerId,
      senderName: getPlayerName(currentPlayer),
      recipientIds: selectedRecipients,
      subject: subject.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
      readBy: [currentPlayerId],
    };

    const result = await sendDirectMessage(message);
    if (!result.success) {
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setIsSending(false);
      return;
    }

    addDirectMessage(message);

    // Send push notifications to recipients
    await sendPushToPlayers(
      selectedRecipients,
      `New Team Message in ${teamName}`,
      `View the Message in the App.`,
      { type: 'direct_message', messageId: message.id }
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsSending(false);
    setComposeVisible(false);
    setSubject('');
    setBody('');
    setSelectedRecipients([]);
    setPlayerSearch('');
  };

  const toggleRecipient = (playerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRecipients((prev) =>
      prev.includes(playerId) ? prev.filter((id) => id !== playerId) : [...prev, playerId]
    );
  };

  const selectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const allIds = activePlayers.filter((p) => p.id !== currentPlayerId).map((p) => p.id);
    setSelectedRecipients(allIds);
  };

  const handleDeleteMessage = (msgId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Message', 'Remove this message from your inbox?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          removeDirectMessage(msgId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  // Filter messages for current view
  const inboxMessages = directMessages.filter(
    (m) => m.recipientIds.includes(currentPlayerId ?? '')
  );
  const sentMessages = directMessages.filter((m) => m.senderId === currentPlayerId);
  const displayMessages = tab === 'inbox' ? inboxMessages : sentMessages;

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0c4a6e', '#0f172a', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1">
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(50).springify()} className="flex-row items-center justify-between px-5 pt-2 pb-4">
          <Pressable onPress={() => router.back()} className="flex-row items-center">
            <ChevronLeft size={24} color="#67e8f9" />
            <Text className="text-cyan-400 text-base ml-1">Back</Text>
          </Pressable>
          <Text className="text-white text-lg font-bold">Messages</Text>
          {isAdmin ? (
            <Pressable
              onPress={() => { setComposeVisible(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
              className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 items-center justify-center"
            >
              <Plus size={20} color="#67e8f9" />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </Animated.View>

        {/* Tabs */}
        <Animated.View entering={FadeInDown.delay(80).springify()} className="flex-row mx-5 mb-4 bg-slate-800/60 rounded-xl p-1">
          {(['inbox', 'sent'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              className={cn('flex-1 py-2 rounded-lg items-center', tab === t ? 'bg-cyan-500/20' : '')}
            >
              <Text className={cn('text-sm font-medium', tab === t ? 'text-cyan-300' : 'text-slate-400')}>
                {t === 'inbox' ? 'Inbox' : 'Sent'}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Message List */}
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View className="items-center py-16">
              <ActivityIndicator color="#67e8f9" />
            </View>
          ) : displayMessages.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(100).springify()} className="items-center py-16">
              <View className="w-16 h-16 rounded-full bg-slate-800/60 items-center justify-center mb-4">
                {tab === 'inbox' ? <Inbox size={28} color="#475569" /> : <Mail size={28} color="#475569" />}
              </View>
              <Text className="text-slate-400 text-base font-medium">
                {tab === 'inbox' ? 'No messages yet' : 'No sent messages'}
              </Text>
              <Text className="text-slate-500 text-sm mt-1 text-center px-8">
                {tab === 'inbox'
                  ? 'Messages from your team admin will appear here'
                  : isAdmin ? 'Tap + to compose a new message' : ''}
              </Text>
            </Animated.View>
          ) : (
            displayMessages.map((msg, i) => {
              const isUnread = tab === 'inbox' && currentPlayerId && !msg.readBy.includes(currentPlayerId);
              const recipientCount = msg.recipientIds.length;
              return (
                <SwipeableMessageRow
                  key={msg.id}
                  onDelete={() => handleDeleteMessage(msg.id)}
                  index={i}
                >
                  <Pressable
                    onPress={() => openMessage(msg)}
                    className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40 active:bg-slate-700/60"
                  >
                    <View className="flex-row items-start justify-between mb-1">
                      <View className="flex-row items-center flex-1 mr-2">
                        {isUnread && (
                          <View className="w-2 h-2 rounded-full bg-cyan-400 mr-2 mt-1" />
                        )}
                        <Text className={cn('text-base flex-1', isUnread ? 'text-white font-semibold' : 'text-slate-200 font-medium')} numberOfLines={1}>
                          {msg.subject}
                        </Text>
                      </View>
                      <Text className="text-slate-500 text-xs mt-0.5">{formatMessageDate(msg.createdAt)}</Text>
                    </View>
                    <Text className="text-slate-400 text-sm mb-2" numberOfLines={2}>{msg.body}</Text>
                    <View className="flex-row items-center justify-between">
                      <Text className="text-slate-500 text-xs">
                        {tab === 'inbox' ? `From ${msg.senderName}` : `To ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`}
                      </Text>
                      {tab === 'sent' && (
                        <View className="flex-row items-center">
                          {msg.readBy.filter((id) => id !== currentPlayerId).length > 0 ? (
                            <CheckCheck size={14} color="#22d3ee" />
                          ) : (
                            <Check size={14} color="#475569" />
                          )}
                        </View>
                      )}
                    </View>
                  </Pressable>
                </SwipeableMessageRow>
              );
            })
          )}
          <View className="h-8" />
        </ScrollView>
      </SafeAreaView>

      {/* Message Detail Modal */}
      <Modal visible={!!selectedMessage} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedMessage(null)}>
        <View className="flex-1 bg-slate-900">
          <LinearGradient
            colors={['#0c4a6e', '#0f172a', '#0f172a']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <SafeAreaView className="flex-1">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={() => setSelectedMessage(null)} className="p-1">
                <X size={24} color="#94a3b8" />
              </Pressable>
              <Text className="text-white font-semibold text-base">Message</Text>
              <View style={{ width: 32 }} />
            </View>
            {selectedMessage && (
              <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
                <Text className="text-white text-xl font-bold mb-2">{selectedMessage.subject}</Text>
                <View className="flex-row items-center mb-1">
                  <Text className="text-slate-400 text-sm">From </Text>
                  <Text className="text-cyan-400 text-sm font-medium">{selectedMessage.senderName}</Text>
                </View>
                <Text className="text-slate-500 text-xs mb-6">{format(new Date(selectedMessage.createdAt), 'MMMM d, yyyy · h:mm a')}</Text>
                <View className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
                  <Text className="text-slate-200 text-base leading-6">{selectedMessage.body}</Text>
                </View>
                {selectedMessage.senderId === currentPlayerId && (
                  <View className="mt-6">
                    <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                      Recipients ({selectedMessage.recipientIds.length})
                    </Text>
                    {selectedMessage.recipientIds.map((id) => {
                      const p = players.find((pl) => pl.id === id);
                      const hasRead = selectedMessage.readBy.includes(id);
                      return (
                        <View key={id} className="flex-row items-center mb-2">
                          <PlayerAvatar player={p ?? null} size={32} />
                          <Text className="text-slate-300 text-sm ml-3 flex-1">{p ? getPlayerName(p) : id}</Text>
                          {hasRead ? (
                            <CheckCheck size={16} color="#22d3ee" />
                          ) : (
                            <Check size={16} color="#475569" />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>

      {/* Compose Modal */}
      <Modal visible={composeVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setComposeVisible(false)}>
        <View className="flex-1 bg-slate-900">
          <LinearGradient
            colors={['#0c4a6e', '#0f172a', '#0f172a']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <SafeAreaView className="flex-1">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
              {/* Compose Header */}
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
                <Pressable onPress={() => { setComposeVisible(false); setSubject(''); setBody(''); setSelectedRecipients([]); setPlayerSearch(''); }} className="p-1">
                  <X size={24} color="#94a3b8" />
                </Pressable>
                <Text className="text-white font-semibold text-base">New Message</Text>
                <Pressable
                  onPress={handleSend}
                  disabled={isSending}
                  className="flex-row items-center bg-cyan-500 px-4 py-1.5 rounded-full active:bg-cyan-600 disabled:opacity-50"
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Send size={14} color="white" />
                      <Text className="text-white font-semibold text-sm ml-1.5">Send</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Subject */}
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Subject</Text>
                  <TextInput
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="Message subject"
                    placeholderTextColor="#64748b"
                    className="bg-slate-800/60 rounded-xl border border-slate-700/40 px-4 py-3 text-white text-sm"
                  />
                </View>

                {/* Body */}
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm mb-2">Message</Text>
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder="Write your message..."
                    placeholderTextColor="#64748b"
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    className="bg-slate-800/60 rounded-xl border border-slate-700/40 px-4 py-3 text-white text-sm"
                    style={{ minHeight: 120 }}
                  />
                </View>

                {/* Recipients */}
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-slate-300 text-sm">
                      Recipients
                      {selectedRecipients.length > 0 && (
                        <Text className="text-cyan-400"> ({selectedRecipients.length})</Text>
                      )}
                    </Text>
                    <Pressable onPress={selectAll}>
                      <Text className="text-cyan-400 text-sm">Select All</Text>
                    </Pressable>
                  </View>

                  <TextInput
                    value={playerSearch}
                    onChangeText={setPlayerSearch}
                    placeholder="Search players..."
                    placeholderTextColor="#64748b"
                    className="bg-slate-800/60 rounded-xl border border-slate-700/40 px-4 py-2.5 text-white text-sm mb-3"
                  />

                  {filteredPlayers.map((p) => {
                    const selected = selectedRecipients.includes(p.id);
                    return (
                      <Pressable
                        key={p.id}
                        onPress={() => toggleRecipient(p.id)}
                        className="flex-row items-center py-2.5 border-b border-slate-800/60"
                      >
                        <PlayerAvatar player={p} size={36} />
                        <View className="flex-1 ml-3">
                          <Text className="text-white text-sm font-medium">{getPlayerName(p)}</Text>
                          <Text className="text-slate-500 text-xs">{p.position}{p.number ? ` · #${p.number}` : ''}</Text>
                        </View>
                        <View className={cn(
                          'w-6 h-6 rounded-full border-2 items-center justify-center',
                          selected ? 'bg-cyan-500 border-cyan-500' : 'border-slate-600'
                        )}>
                          {selected && <Check size={12} color="white" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <View className="h-8" />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
