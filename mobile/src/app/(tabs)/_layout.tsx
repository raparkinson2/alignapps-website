import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Calendar, Users, MessageSquare, DollarSign, MoreHorizontal, Shield, ImageIcon } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { useTeamColor } from '@/lib/theme';

export default function TabLayout() {
  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players) ?? [];
  const notifications = useTeamStore((s) => s.notifications) ?? [];
  const chatMessages = useTeamStore((s) => s.chatMessages) ?? [];
  const chatLastReadAt = useTeamStore((s) => s.chatLastReadAt) ?? {};
  const showPayments = useTeamStore((s) => s.teamSettings?.showPayments !== false);
  const showTeamChat = useTeamStore((s) => s.teamSettings?.showTeamChat !== false);
  const showPhotos = useTeamStore((s) => s.teamSettings?.showPhotos !== false);
  const teamIsPremium = useTeamStore((s) => s.teamSettings?.isPremium ?? false);
  const teamColor = useTeamColor();

  // Derive role status from reactive state
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const isAdminUser = currentPlayer?.roles?.includes('admin') ?? false;
  const isParentUser = currentPlayer?.roles?.includes('parent') ?? false;

  // Count unread notifications for current player
  const unreadNotificationCount = notifications.filter(
    (n) => n.toPlayerId === currentPlayerId && !n.read
  ).length;

  // Count unread chat messages reactively
  const unreadChatCount = React.useMemo(() => {
    if (!currentPlayerId) return 0;
    const lastReadAt = chatLastReadAt[currentPlayerId];
    if (!lastReadAt) {
      return 0;
    }
    return chatMessages.filter(
      (m) => m.senderId !== currentPlayerId && new Date(m.createdAt) > new Date(lastReadAt)
    ).length;
  }, [currentPlayerId, chatMessages, chatLastReadAt]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopColor: '#1e293b',
          borderTopWidth: 1,
          height: 64,
          paddingTop: 0,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#67e8f9',
        tabBarInactiveTintColor: '#475569',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="roster"
        options={{
          title: 'Roster',
          tabBarIcon: ({ color }) => <Users size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          href: showTeamChat && (!isParentUser || teamIsPremium) ? undefined : null,
          tabBarIcon: ({ color }) => (
            <View style={{ position: 'relative' }}>
              <MessageSquare size={24} color={color} />
              {unreadChatCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    backgroundColor: '#ef4444',
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', lineHeight: 18 }}>
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: 'Photos',
          href: showPhotos && (!isParentUser || teamIsPremium) ? undefined : null,
          tabBarIcon: ({ color }) => <ImageIcon size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          href: showPayments ? undefined : null,
          tabBarIcon: ({ color }) => <DollarSign size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <View style={{ position: 'relative' }}>
              <MoreHorizontal size={24} color={color} />
              {unreadNotificationCount > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -8,
                    backgroundColor: '#ef4444',
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold', lineHeight: 18 }}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdminUser ? undefined : null,
          tabBarIcon: ({ color }) => <Shield size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
