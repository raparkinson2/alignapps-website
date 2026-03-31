import { View, Text, ScrollView, Pressable, Alert, Platform, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { X, Plus, Link, ExternalLink, Pencil, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { TeamLink } from '@/lib/store';

export interface TeamLinksModalProps {
  visible: boolean;
  onClose: () => void;
  links: TeamLink[];
  onAdd: (link: TeamLink) => void;
  onUpdate: (id: string, updates: Partial<TeamLink>) => void;
  onRemove: (id: string) => void;
  canManage: boolean;
  currentPlayerId: string | null;
}

export function TeamLinksModal({ visible, onClose, links, onAdd, onUpdate, onRemove, canManage, currentPlayerId }: TeamLinksModalProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    if (!title.trim() || !url.trim()) {
      Alert.alert('Error', 'Please enter both a title and URL');
      return;
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    const newLink: TeamLink = {
      id: `link-${Date.now()}`,
      title: title.trim(),
      url: formattedUrl,
      createdBy: currentPlayerId || '',
      createdAt: new Date().toISOString(),
    };

    onAdd(newLink);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTitle('');
    setUrl('');
    setIsAdding(false);
  };

  const handleUpdate = () => {
    if (!editingId || !title.trim() || !url.trim()) {
      Alert.alert('Error', 'Please enter both a title and URL');
      return;
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = 'https://' + formattedUrl;
    }

    onUpdate(editingId, { title: title.trim(), url: formattedUrl });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTitle('');
    setUrl('');
    setEditingId(null);
  };

  const handleEdit = (link: TeamLink) => {
    setTitle(link.title);
    setUrl(link.url);
    setEditingId(link.id);
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Link',
      'Are you sure you want to delete this link?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onRemove(id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleOpenLink = (linkUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(linkUrl).catch(() => {
      Alert.alert('Error', 'Could not open this link');
    });
  };

  const handleClose = () => {
    setTitle('');
    setUrl('');
    setIsAdding(false);
    setEditingId(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl max-h-[85%]">
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Pressable onPress={handleClose}>
                <X size={24} color="#94a3b8" />
              </Pressable>
              <Text className="text-white text-lg font-bold">Team Links</Text>
              {canManage && !isAdding && !editingId && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsAdding(true);
                  }}
                >
                  <Plus size={24} color="#67e8f9" />
                </Pressable>
              )}
              {(isAdding || editingId) && (
                <Pressable onPress={editingId ? handleUpdate : handleAdd}>
                  <Text className="text-cyan-400 font-semibold">Save</Text>
                </Pressable>
              )}
            </View>

            <ScrollView className="px-5 py-4" showsVerticalScrollIndicator={false}>
              {(isAdding || editingId) && (
                <View className="mb-4 bg-slate-800/60 rounded-xl p-4 border border-cyan-500/30">
                  <Text className="text-cyan-400 text-sm font-semibold mb-3">
                    {editingId ? 'Edit Link' : 'Add New Link'}
                  </Text>
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide">Display Name</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g., Team Schedule, League Website"
                      placeholderTextColor="#64748b"
                      className="bg-slate-900/60 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50"
                    />
                  </View>
                  <View className="mb-3">
                    <Text className="text-slate-400 text-xs mb-1.5 uppercase tracking-wide">URL</Text>
                    <TextInput
                      value={url}
                      onChangeText={setUrl}
                      placeholder="https://example.com"
                      placeholderTextColor="#64748b"
                      autoCapitalize="none"
                      keyboardType="url"
                      className="bg-slate-900/60 rounded-xl px-4 py-3 text-white text-base border border-slate-700/50"
                    />
                  </View>
                  <Pressable
                    onPress={() => {
                      setTitle('');
                      setUrl('');
                      setIsAdding(false);
                      setEditingId(null);
                    }}
                    className="py-2"
                  >
                    <Text className="text-slate-400 text-center">Cancel</Text>
                  </Pressable>
                </View>
              )}

              {links.length === 0 && !isAdding ? (
                <View className="items-center justify-center py-12">
                  <View className="w-16 h-16 rounded-full bg-slate-800/50 items-center justify-center mb-4">
                    <Link size={32} color="#64748b" />
                  </View>
                  <Text className="text-slate-400 text-lg font-medium mb-1">No Links Yet</Text>
                  <Text className="text-slate-500 text-center px-8">
                    {canManage
                      ? 'Add useful links for your team like schedules, league websites, or resources.'
                      : 'No team links have been added yet.'}
                  </Text>
                </View>
              ) : (
                links.map((link) => (
                  <Pressable
                    key={link.id}
                    onPress={() => handleOpenLink(link.url)}
                    className="flex-row items-center py-4 px-4 bg-slate-800/60 rounded-xl mb-3 active:bg-slate-700/80"
                  >
                    <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center">
                      <Link size={20} color="#67e8f9" />
                    </View>
                    <View className="flex-1 ml-3">
                      <Text className="text-white font-semibold">{link.title}</Text>
                      <Text className="text-slate-400 text-xs" numberOfLines={1}>
                        {link.url.replace(/^https?:\/\//, '')}
                      </Text>
                    </View>
                    {canManage ? (
                      <View className="flex-row items-center">
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            handleEdit(link);
                          }}
                          className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center mr-2"
                        >
                          <Pencil size={14} color="#94a3b8" />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            handleDelete(link.id);
                          }}
                          className="w-8 h-8 rounded-full bg-red-500/20 items-center justify-center"
                        >
                          <Trash2 size={14} color="#f87171" />
                        </Pressable>
                      </View>
                    ) : (
                      <ExternalLink size={18} color="#64748b" />
                    )}
                  </Pressable>
                ))
              )}

              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
