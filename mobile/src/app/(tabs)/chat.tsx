import { View, Text, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { MessageSquare, Send, ImageIcon, X, Search, Users, RefreshCw } from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn, SlideInDown, FadeOut } from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useTeamStore, ChatMessage, getPlayerName, getPlayerInitials, Player } from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { sendPushToPlayers } from '@/lib/notifications';
import { sendChatMessage, deleteChatMessage as deleteChatMessageFromSupabase } from '@/lib/chat-sync';
import { uploadPhotoToStorageBase64, uploadPhotoToStorage } from '@/lib/photo-storage';

// GIPHY API key
const GIPHY_API_KEY = 'mUSMkXeohjZdAa2fSpTRGq7ljx5h00fI';

interface GiphyGif {
  id: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
    };
    original: {
      url: string;
    };
  };
}

interface MessageBubbleProps {
  message: ChatMessage;
  isOwnMessage: boolean;
  senderName: string;
  senderAvatar?: string;
  index: number;
  onDelete?: () => void;
  players: Player[];
  currentPlayerId: string | null;
}

// Helper to render message text with highlighted @mentions
function renderMessageWithMentions(
  message: ChatMessage,
  players: Player[],
  isOwnMessage: boolean
) {
  const text = message.message;
  if (!text) return null;

  // Check if this message has mentions
  if (message.mentionType === 'all') {
    // Find @everyone in the text and highlight it
    const parts = text.split(/(@everyone)/gi);
    return (
      <Text className={cn('text-base', isOwnMessage ? 'text-white' : 'text-slate-100')}>
        {parts.map((part, idx) => {
          if (part.toLowerCase() === '@everyone') {
            return (
              <Text key={idx} className={cn(isOwnMessage ? 'text-yellow-200' : 'text-cyan-300', 'font-semibold')}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  }

  if (message.mentionType === 'specific' && message.mentionedPlayerIds?.length) {
    // Build a regex to find all @mentions
    const mentionedPlayers = players.filter((p) =>
      message.mentionedPlayerIds?.includes(p.id)
    );
    const mentionNames = mentionedPlayers.map((p) => getPlayerName(p));

    if (mentionNames.length === 0) {
      return (
        <Text className={cn('text-base', isOwnMessage ? 'text-white' : 'text-slate-100')}>
          {text}
        </Text>
      );
    }

    // Create a regex pattern for all mention names
    const escapedNames = mentionNames.map((name) =>
      name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(@(?:${escapedNames.join('|')}))`, 'gi');
    const parts = text.split(pattern);

    return (
      <Text className={cn('text-base', isOwnMessage ? 'text-white' : 'text-slate-100')}>
        {parts.map((part, idx) => {
          const isHighlight = mentionNames.some(
            (name) => part.toLowerCase() === `@${name.toLowerCase()}`
          );
          if (isHighlight) {
            return (
              <Text key={idx} className={cn(isOwnMessage ? 'text-yellow-200' : 'text-cyan-300', 'font-semibold')}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  }

  // No mentions - render plain text
  return (
    <Text className={cn('text-base', isOwnMessage ? 'text-white' : 'text-slate-100')}>
      {text}
    </Text>
  );
}

function MessageBubble({ message, isOwnMessage, senderName, senderAvatar, index, onDelete, players, currentPlayerId }: MessageBubbleProps) {
  const messageDate = parseISO(message.createdAt);
  const timeStr = format(messageDate, 'h:mm a');
  const hasMedia = message.imageUrl || message.gifUrl;

  const handleLongPress = () => {
    if (isOwnMessage && onDelete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Delete Message',
        'Are you sure you want to delete this message?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              onDelete();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.springify()}
      className={cn('mb-3', isOwnMessage ? 'items-end' : 'items-start')}
    >
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={500}
        className={cn('flex-row items-end max-w-[80%]', isOwnMessage && 'flex-row-reverse')}
      >
        {!isOwnMessage && (
          <Image
            source={{ uri: senderAvatar }}
            style={{ width: 28, height: 28, borderRadius: 14, marginRight: 8 }}
            contentFit="cover"
          />
        )}
        <View>
          {!isOwnMessage && (
            <Text className="text-slate-400 text-xs mb-1 ml-1">{senderName}</Text>
          )}
          {/* Media-only message (no background) */}
          {hasMedia && !message.message && (
            <View style={{ maxWidth: 250 }}>
              <View className="rounded-2xl overflow-hidden">
                <Image
                  source={{ uri: message.imageUrl || message.gifUrl }}
                  style={{
                    width: 250,
                    aspectRatio: message.gifWidth && message.gifHeight
                      ? message.gifWidth / message.gifHeight
                      : 1,
                    borderRadius: 16,
                  }}
                  contentFit="cover"
                  autoplay={true}
                />
              </View>
              {message.gifUrl && (
                <View className="flex-row justify-end">
                  <Text className="text-slate-500 text-sm">Powered by <Text className="font-bold">GIPHY</Text></Text>
                </View>
              )}
            </View>
          )}
          {/* Media with text or text-only message */}
          {(message.message || !hasMedia) && (
            <View
              className={cn(
                'rounded-2xl overflow-hidden',
                !hasMedia && 'px-4 py-2.5',
                isOwnMessage
                  ? 'bg-cyan-500 rounded-br-sm'
                  : 'bg-slate-700 rounded-bl-sm'
              )}
              style={hasMedia ? { maxWidth: 250 } : undefined}
            >
              {/* Image or GIF with text */}
              {hasMedia && (
                <Image
                  source={{ uri: message.imageUrl || message.gifUrl }}
                  style={{
                    width: 250,
                    height: 200,
                  }}
                  contentFit="contain"
                  autoplay={true}
                />
              )}
              {/* Text message */}
              {message.message && (
                <View className={hasMedia ? 'px-4 py-2.5' : ''}>
                  {renderMessageWithMentions(message, players, isOwnMessage)}
                </View>
              )}
            </View>
          )}
          <Text className={cn('text-slate-500 text-[10px] mt-1', isOwnMessage ? 'mr-1 text-right' : 'ml-1')}>
            {timeStr}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function DateSeparator({ date }: { date: Date }) {
  let label = format(date, 'EEEE, MMMM d');
  if (isToday(date)) label = 'Today';
  else if (isYesterday(date)) label = 'Yesterday';

  return (
    <View className="flex-row items-center my-4">
      <View className="flex-1 h-px bg-slate-700" />
      <Text className="text-slate-500 text-xs mx-4">{label}</Text>
      <View className="flex-1 h-px bg-slate-700" />
    </View>
  );
}

export default function ChatScreen() {
  const chatMessages = useTeamStore((s) => s.chatMessages);
  const addChatMessage = useTeamStore((s) => s.addChatMessage);
  const updateChatMessage = useTeamStore((s) => s.updateChatMessage);
  const deleteChatMessage = useTeamStore((s) => s.deleteChatMessage);
  const players = useTeamStore((s) => s.players);
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const teamName = useTeamStore((s) => s.teamName);
  const markChatAsRead = useTeamStore((s) => s.markChatAsRead);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);

  const [messageText, setMessageText] = useState('');
  const [isGifModalVisible, setIsGifModalVisible] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const flatListRef = useRef<FlatList<any>>(null);

  // Mention autocomplete state
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  // Responsive layout for iPad
  const { isTablet, containerPadding } = useResponsive();

  const currentPlayer = players.find((p) => p.id === currentPlayerId);

  // Chat messages are loaded by startRealtimeSync in _layout.tsx when user logs in.
  // This effect just plays a haptic when a new message arrives while chat is open.
  useEffect(() => {
    if (!activeTeamId || !currentPlayerId) return;
    // No separate subscription needed — realtime-sync.ts handles all incoming messages
  }, [activeTeamId, currentPlayerId]);

  // Mark chat as read whenever the tab is focused (handles tab switches)
  useFocusEffect(
    useCallback(() => {
      if (currentPlayerId) {
        markChatAsRead(currentPlayerId);
      }
    }, [currentPlayerId, markChatAsRead])
  );

  // Scroll to bottom when new messages arrive while user is viewing
  useEffect(() => {
    if (currentPlayerId) {
      markChatAsRead(currentPlayerId);
    }
    // For inverted FlatList, scrolling to offset 0 scrolls to newest (bottom visually)
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [chatMessages.length, currentPlayerId, markChatAsRead]);

  // Load trending GIFs when modal opens
  useEffect(() => {
    if (isGifModalVisible && gifs.length === 0) {
      loadTrendingGifs();
    }
  }, [isGifModalVisible]);

  const loadTrendingGifs = async () => {
    setIsLoadingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error loading trending GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) {
      loadTrendingGifs();
      return;
    }
    setIsLoadingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isGifModalVisible) {
        searchGifs(gifSearchQuery);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [gifSearchQuery, isGifModalVisible]);

  // Filter players for mention suggestions based on query
  const filteredMentionSuggestions = useMemo(() => {
    if (!showMentionPicker) return [];
    // Include all other players (active or reserve) for @mentions
    const otherPlayers = players.filter((p) => p.id !== currentPlayerId);
    console.log('Mention suggestions - otherPlayers:', otherPlayers.length, 'mentionQuery:', mentionQuery);
    if (!mentionQuery) return otherPlayers;
    const query = mentionQuery.toLowerCase();
    const filtered = otherPlayers.filter((p) => {
      const fullName = getPlayerName(p).toLowerCase();
      const firstName = p.firstName.toLowerCase();
      const lastName = p.lastName.toLowerCase();
      return fullName.includes(query) || firstName.includes(query) || lastName.includes(query);
    });
    console.log('Filtered suggestions:', filtered.length);
    return filtered;
  }, [showMentionPicker, players, currentPlayerId, mentionQuery]);

  // Handle text input change and detect @ mentions
  const handleMessageChange = (text: string) => {
    setMessageText(text);

    // Check if there's an @ at the end that we're actively typing
    const lastAtIndex = text.lastIndexOf('@');

    console.log('Message change:', { text, lastAtIndex });

    if (lastAtIndex !== -1) {
      // Check if this @ is at the start or preceded by a space/newline
      const charBefore = lastAtIndex > 0 ? text[lastAtIndex - 1] : ' ';
      const isValidStart = charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0;

      console.log('@ found:', { charBefore, isValidStart });

      if (isValidStart) {
        // Get the text after this @
        const afterAt = text.substring(lastAtIndex + 1);

        console.log('After @:', { afterAt, hasSpace: afterAt.includes(' ') });

        // Check if the cursor is still in the mention (no space after)
        // If afterAt has no space, we're still typing the mention
        if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
          console.log('Setting showMentionPicker to true');
          setMentionQuery(afterAt);
          setMentionStartIndex(lastAtIndex);
          setShowMentionPicker(true);
          return;
        }
      }
    }

    // No active mention being typed
    setShowMentionPicker(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  // Handle selecting a mention from the dropdown
  const handleSelectMention = (selection: Player | 'everyone') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const mentionText = selection === 'everyone'
      ? '@everyone '
      : `@${getPlayerName(selection)} `;

    // Replace the @query with the full mention
    const before = messageText.substring(0, mentionStartIndex);
    const after = messageText.substring(mentionStartIndex + 1 + mentionQuery.length);

    setMessageText(before + mentionText + after);
    setShowMentionPicker(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !currentPlayerId) return;

    // Parse mentions from message text
    let mentionType: 'all' | 'specific' | undefined;
    let mentionedPlayerIds: string[] | undefined;

    if (messageText.toLowerCase().includes('@everyone')) {
      mentionType = 'all';
      mentionedPlayerIds = players
        .filter((p) => p.id !== currentPlayerId && p.status === 'active')
        .map((p) => p.id);
    } else {
      // Check for individual @mentions
      const mentionPattern = /@([A-Za-z]+ [A-Za-z]+|[A-Za-z]+)/g;
      const matches = messageText.match(mentionPattern);
      if (matches && matches.length > 0) {
        const foundIds: string[] = [];
        matches.forEach((match) => {
          const name = match.substring(1).toLowerCase(); // Remove @ and lowercase
          const player = players.find(
            (p) =>
              p.id !== currentPlayerId &&
              (getPlayerName(p).toLowerCase() === name ||
                p.firstName.toLowerCase() === name)
          );
          if (player && !foundIds.includes(player.id)) {
            foundIds.push(player.id);
          }
        });
        if (foundIds.length > 0) {
          mentionType = 'specific';
          mentionedPlayerIds = foundIds;
        }
      }
    }

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentPlayerId,
      message: messageText.trim(),
      mentionType,
      mentionedPlayerIds,
      createdAt: new Date().toISOString(),
    };

    // Add locally first for instant feedback
    addChatMessage(newMessage);

    // Send to Supabase for real-time sync with other users
    if (activeTeamId && currentPlayer) {
      const senderName = getPlayerName(currentPlayer);
      sendChatMessage(newMessage, activeTeamId, senderName).catch(err => {
        console.error('Failed to sync message to cloud:', err);
      });
    }

    // Send push notifications to relevant players
    if (currentPlayer) {
      const senderName = getPlayerName(currentPlayer);
      const preview = messageText.trim().length > 100 ? messageText.trim().substring(0, 100) + '...' : messageText.trim();

      if (mentionType === 'all') {
        // @everyone — push all active players except sender
        const recipientIds = players
          .filter((p) => p.id !== currentPlayerId && p.status === 'active')
          .map((p) => p.id);
        sendPushToPlayers(recipientIds, `${senderName} mentioned everyone`, preview, { type: 'chat_mention' }).catch(console.error);
      } else if (mentionType === 'specific' && mentionedPlayerIds?.length) {
        // @specific — push only the mentioned players
        sendPushToPlayers(mentionedPlayerIds, `${senderName} mentioned you`, preview, { type: 'chat_mention' }).catch(console.error);
      } else {
        // Regular message — push all team members except sender
        const recipientIds = players
          .filter((p) => p.id !== currentPlayerId)
          .map((p) => p.id);
        console.log(`[chat-push] sender=${currentPlayerId} recipients=${JSON.stringify(recipientIds)}`);
        sendPushToPlayers(recipientIds, `${senderName}`, preview, { type: 'chat_message' }).catch(console.error);
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMessageText('');
    setShowMentionPicker(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  };

  const handlePickImage = async () => {
    if (!currentPlayerId) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true, // Required for real iOS devices (ph:// URIs)
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const photoId = `chat-img-${Date.now()}`;
      const localUri = result.assets[0].uri;
      const base64Data = result.assets[0].base64;

      // Add message immediately with local URI so sender sees it right away
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        senderId: currentPlayerId,
        message: '',
        imageUrl: localUri,
        createdAt: new Date().toISOString(),
      };
      addChatMessage(newMessage);

      // Push notification for image — fire immediately so recipients know
      if (currentPlayer) {
        const senderName = getPlayerName(currentPlayer);
        const recipientIds = players
          .filter((p) => p.id !== currentPlayerId)
          .map((p) => p.id);
        sendPushToPlayers(recipientIds, senderName, 'Sent a photo', { type: 'chat_message' }).catch(console.error);
      }

      // Upload image to Supabase Storage in background, then sync the cloud URL
      if (activeTeamId && currentPlayer) {
        const senderName = getPlayerName(currentPlayer);
        (async () => {
          try {
            let uploadResult;
            if (base64Data) {
              uploadResult = await uploadPhotoToStorageBase64(base64Data, activeTeamId, photoId);
            } else {
              uploadResult = await uploadPhotoToStorage(localUri, activeTeamId, photoId);
            }

            const cloudUrl = uploadResult.success && uploadResult.url ? uploadResult.url : localUri;

            // Update sender's local message with cloud URL so it persists after app restart
            updateChatMessage(newMessage.id, { imageUrl: cloudUrl });

            // Update local message with cloud URL
            const updatedMessage = { ...newMessage, imageUrl: cloudUrl };
            sendChatMessage(updatedMessage, activeTeamId, senderName).catch(err => {
              console.error('Failed to sync image message to cloud:', err);
            });
          } catch (err) {
            console.error('Failed to upload chat image:', err);
            // Still sync even if upload failed (other users won't see it but sender has it)
            sendChatMessage(newMessage, activeTeamId, senderName).catch(() => {});
          }
        })();
      }
    }
  };

  const handleSelectGif = (gif: GiphyGif) => {
    if (!currentPlayerId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: currentPlayerId,
      message: '',
      gifUrl: gif.images.fixed_height.url,
      gifWidth: parseInt(gif.images.fixed_height.width),
      gifHeight: parseInt(gif.images.fixed_height.height),
      createdAt: new Date().toISOString(),
    };
    addChatMessage(newMessage);

    // Send to Supabase for real-time sync
    if (activeTeamId && currentPlayer) {
      const senderName = getPlayerName(currentPlayer);
      sendChatMessage(newMessage, activeTeamId, senderName).catch(err => {
        console.error('Failed to sync GIF message to cloud:', err);
      });

      // Push notification for GIF
      const recipientIds = players
        .filter((p) => p.id !== currentPlayerId)
        .map((p) => p.id);
      sendPushToPlayers(recipientIds, senderName, 'Sent a GIF', { type: 'chat_message' }).catch(console.error);
    }

    setIsGifModalVisible(false);
    setGifSearchQuery('');
  };

  // Group messages by date — memoized so it only recomputes when messages change
  const groupedMessages = useMemo(() => {
    const groups: { date: Date; messages: ChatMessage[] }[] = [];
    let currentDate: string | null = null;

    chatMessages.forEach((msg) => {
      const msgDate = format(parseISO(msg.createdAt), 'yyyy-MM-dd');
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: parseISO(msg.createdAt), messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });
    return groups;
  }, [chatMessages]);

  // Flat list items for FlatList virtualization.
  // We use an inverted FlatList (newest at bottom), so we reverse the data.
  type FlatItem =
    | { type: 'message'; message: ChatMessage; groupIndex: number; msgIndex: number }
    | { type: 'separator'; date: Date };

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    groupedMessages.forEach((group, groupIndex) => {
      // Date separator first (it renders BELOW messages in inverted list)
      items.push({ type: 'separator', date: group.date });
      group.messages.forEach((msg, msgIndex) => {
        items.push({ type: 'message', message: msg, groupIndex, msgIndex });
      });
    });
    // Reverse so newest is at index 0 for the inverted FlatList
    return items.reverse();
  }, [groupedMessages]);

  const renderChatItem = useCallback(({ item }: { item: FlatItem }) => {
    if (item.type === 'separator') {
      return <DateSeparator date={item.date} />;
    }
    const { message } = item;
    const sender = players.find((p) => p.id === message.senderId);
    const isOwnMessage = message.senderId === currentPlayerId;
    const displayName = sender ? getPlayerName(sender) : (message.senderName || 'Unknown');
    return (
      <MessageBubble
        message={message}
        isOwnMessage={isOwnMessage}
        senderName={displayName}
        senderAvatar={sender?.avatar}
        index={0}
        onDelete={isOwnMessage ? () => {
          deleteChatMessage(message.id);
          deleteChatMessageFromSupabase(message.id).catch(err => {
            console.error('Failed to delete message from cloud:', err);
          });
        } : undefined}
        players={players}
        currentPlayerId={currentPlayerId}
      />
    );
  }, [players, currentPlayerId, deleteChatMessage]);

  const keyExtractor = useCallback((item: FlatItem) => {
    if (item.type === 'separator') return `sep-${item.date.toISOString()}`;
    return item.message.id;
  }, []);

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="px-5 pt-2 pb-4 border-b border-slate-800"
        >
          <View className="flex-row items-center">
            <MessageSquare size={20} color="#67e8f9" />
            <Text className="text-cyan-400 text-sm font-medium ml-2">Chat</Text>
          </View>
          <Text className="text-white text-3xl font-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{teamName} Team Chat</Text>
          <Text className="text-slate-400 text-sm">{players.length} members</Text>
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
          keyboardVerticalOffset={0}
        >
          {/* Messages - virtualized inverted FlatList for performance */}
          {chatMessages.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <View className="bg-slate-800/50 rounded-full p-6 mb-4">
                <MessageSquare size={48} color="#475569" />
              </View>
              <Text className="text-slate-400 text-center text-lg font-medium">
                No messages yet
              </Text>
              <Text className="text-slate-500 text-center mt-1">
                Start the conversation with your team!
              </Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={flatItems}
              keyExtractor={keyExtractor}
              renderItem={renderChatItem}
              inverted
              removeClippedSubviews
              maxToRenderPerBatch={15}
              windowSize={10}
              initialNumToRender={20}
              contentContainerStyle={{ paddingVertical: 16, paddingHorizontal: isTablet ? containerPadding : 16, maxWidth: isTablet ? 800 : undefined, alignSelf: isTablet ? 'center' as const : undefined, width: isTablet ? '100%' : undefined }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Input Area */}
          <View className="pb-4 pt-2 border-t border-slate-800 bg-slate-900/95" style={{ zIndex: 10, paddingHorizontal: isTablet ? containerPadding : 16, maxWidth: isTablet ? 800 : undefined, alignSelf: isTablet ? 'center' as const : undefined, width: isTablet ? '100%' : undefined }}>
            {/* Inline Mention Autocomplete */}
            {showMentionPicker && (
              <View
                className="absolute bottom-full left-4 right-4 mb-2"
                style={{ zIndex: 1000 }}
              >
                <View className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl max-h-52">
                  <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {/* @everyone option */}
                    {(mentionQuery === '' || 'everyone'.includes(mentionQuery.toLowerCase())) && (
                      <Pressable
                        onPress={() => handleSelectMention('everyone')}
                        className="flex-row items-center px-4 py-3 border-b border-slate-700/50 active:bg-slate-700/50"
                      >
                        <View className="w-10 h-10 rounded-full bg-cyan-500 items-center justify-center mr-3">
                          <Users size={20} color="#ffffff" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-white font-semibold">@everyone</Text>
                          <Text className="text-slate-400 text-sm">Notify all team members</Text>
                        </View>
                      </Pressable>
                    )}
                    {/* Player list */}
                    {filteredMentionSuggestions.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => handleSelectMention(player)}
                        className="flex-row items-center px-4 py-3 border-b border-slate-700/50 active:bg-slate-700/50"
                      >
                        {player.avatar ? (
                          <Image
                            source={{ uri: player.avatar }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                            contentFit="cover"
                          />
                        ) : (
                          <View className="w-10 h-10 rounded-full bg-slate-600 items-center justify-center">
                            <Text className="text-white font-semibold text-sm">
                              {getPlayerInitials(player)}
                            </Text>
                          </View>
                        )}
                        <View className="flex-1 ml-3">
                          <Text className="text-white font-medium">{getPlayerName(player)}</Text>
                          <Text className="text-slate-400 text-sm">
                            #{player.number} • {player.position}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

            <View className="flex-row items-center">
              {/* Image Picker Button */}
              <Pressable
                onPress={handlePickImage}
                className="w-11 h-11 rounded-full items-center justify-center bg-slate-800 mr-2 active:bg-slate-700"
              >
                <ImageIcon size={20} color="#67e8f9" />
              </Pressable>

              {/* GIF Button */}
              <Pressable
                onPress={() => setIsGifModalVisible(true)}
                className="w-11 h-11 rounded-full items-center justify-center bg-slate-800 mr-2 active:bg-slate-700"
              >
                <Text className="text-cyan-400 font-bold text-xs">GIF</Text>
              </Pressable>

              <View className="flex-1 bg-slate-800 rounded-2xl px-4 mr-2 min-h-[44px] justify-center">
                <TextInput
                  value={messageText}
                  onChangeText={handleMessageChange}
                  placeholder="Type a message..."
                  placeholderTextColor="#64748b"
                  autoCapitalize="sentences"
                  className="text-white text-base py-2.5"
                  multiline
                  maxLength={500}
                  style={{ maxHeight: 100 }}
                />
              </View>
              <Pressable
                onPress={handleSendMessage}
                disabled={!messageText.trim()}
                className="w-11 h-11 rounded-full items-center justify-center bg-green-500 active:bg-green-600"
              >
                <View style={{ marginLeft: -2 }}>
                  <Send size={20} color="white" />
                </View>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* GIF Picker Modal */}
      <Modal
        visible={isGifModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsGifModalVisible(false)}
      >
        <View className="flex-1 bg-slate-900">
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#0f172a']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />

          <SafeAreaView className="flex-1" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b border-slate-700/50">
              <Pressable
                onPress={() => {
                  setIsGifModalVisible(false);
                  setGifSearchQuery('');
                }}
                className="p-2 -ml-2"
              >
                <X size={24} color="#94a3b8" />
              </Pressable>
              <Text className="text-white text-lg font-semibold">Choose a GIF</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Search Bar */}
            <View className="px-5 py-3">
              <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3">
                <Search size={20} color="#64748b" />
                <TextInput
                  value={gifSearchQuery}
                  onChangeText={setGifSearchQuery}
                  placeholder="Search GIFs..."
                  placeholderTextColor="#64748b"
                  className="flex-1 text-white text-base ml-3"
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* GIF Grid */}
            {!GIPHY_API_KEY ? (
              <View className="flex-1 items-center justify-center px-8">
                <Text className="text-slate-400 text-center text-lg font-medium mb-2">
                  GIF Search Not Configured
                </Text>
                <Text className="text-slate-500 text-center text-sm">
                  To enable GIFs, add your GIPHY API key in the ENV tab:{'\n\n'}
                  EXPO_PUBLIC_GIPHY_API_KEY{'\n\n'}
                  Get a free key at developers.giphy.com
                </Text>
              </View>
            ) : isLoadingGifs ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="large" color="#67e8f9" />
              </View>
            ) : (
              <FlatList
                data={gifs}
                numColumns={2}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 10 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelectGif(item)}
                    className="flex-1 m-1 active:opacity-80"
                  >
                    <Image
                      source={{ uri: item.images.fixed_height.url }}
                      style={{
                        width: '100%',
                        aspectRatio: parseInt(item.images.fixed_height.width) / parseInt(item.images.fixed_height.height),
                        borderRadius: 8,
                        minHeight: 100,
                      }}
                      contentFit="cover"
                    />
                  </Pressable>
                )}
                ListEmptyComponent={
                  <View className="flex-1 items-center justify-center py-20">
                    <Text className="text-slate-400">No GIFs found</Text>
                  </View>
                }
              />
            )}

            {/* Powered by GIPHY */}
            <View className="px-5 py-3 border-t border-slate-700/50 items-center">
              <Text className="text-slate-400 text-sm">Powered by <Text className="font-bold">GIPHY</Text></Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
