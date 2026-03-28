import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Switch, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  X,
  Check,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  BarChart3,
  DollarSign,
  AlertTriangle,
  Edit3,
  ListOrdered,
  RefreshCw,
  Trophy,
  Archive,
  CreditCard,
  ImageIcon,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { JuiceBoxIcon } from '@/components/JuiceBoxIcon';
import { Beer } from 'lucide-react-native';
import {
  useTeamStore,
} from '@/lib/store';
import { cn } from '@/lib/cn';
import { useResponsive } from '@/lib/useResponsive';
import { pushTeamToSupabase } from '@/lib/realtime-sync';

export default function AdminFeaturesScreen() {
  const router = useRouter();
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const teamName = useTeamStore((s) => s.teamName);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const players = useTeamStore((s) => s.players);
  const resetAllData = useTeamStore((s) => s.resetAllData);
  const deleteCurrentTeam = useTeamStore((s) => s.deleteCurrentTeam);
  const archiveAndStartNewSeason = useTeamStore((s) => s.archiveAndStartNewSeason);
  const setCurrentSeasonName = useTeamStore((s) => s.setCurrentSeasonName);
  const { isTablet, containerPadding } = useResponsive();

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(console.error);
      }, 50);
    }
  };

  // Modal visibility
  const [isTeamStatsModalVisible, setIsTeamStatsModalVisible] = useState(false);
  const [isRefreshmentModalVisible, setIsRefreshmentModalVisible] = useState(false);
  const [isEndSeasonModalVisible, setIsEndSeasonModalVisible] = useState(false);
  const [isEraseDataMenuModalVisible, setIsEraseDataMenuModalVisible] = useState(false);
  const [isEraseDataModalVisible, setIsEraseDataModalVisible] = useState(false);
  const [isDeleteTeamModalVisible, setIsDeleteTeamModalVisible] = useState(false);

  // End Season state
  const [endSeasonName, setEndSeasonName] = useState(teamSettings.currentSeasonName || '');
  const [endSeasonStep, setEndSeasonStep] = useState<'name' | 'confirm'>('name');

  // Delete team state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Erase data handlers
  const handleEraseAllData = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsEraseDataModalVisible(true);
  };

  const confirmEraseAllData = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    resetAllData();
    setIsEraseDataModalVisible(false);
  };

  const cancelEraseAllData = () => {
    setIsEraseDataModalVisible(false);
  };

  return (
    <View className="flex-1 bg-slate-900">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View entering={FadeIn.delay(50)} className="px-5 pt-2 pb-4 flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 w-9 h-9 rounded-full bg-slate-800/80 items-center justify-center">
            <ChevronLeft size={22} color="#94a3b8" />
          </Pressable>
          <Text className="text-white text-2xl font-bold flex-1">Features & Tools</Text>
        </Animated.View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: isTablet ? containerPadding : 20 }}
        >
          {/* Communication Section */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4">
              Communication
            </Text>

            {/* Team Chat Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <MessageSquare size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Team Chat</Text>
                    <Text className="text-slate-400 text-sm">Enable in-app team messaging</Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showTeamChat !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showTeamChat: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </Animated.View>

          {/* Media Section */}
          <Animated.View entering={FadeInDown.delay(130).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Media
            </Text>

            {/* Photos Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <ImageIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Photos</Text>
                    <Text className="text-slate-400 text-sm">Share team photos and memories</Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showPhotos !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showPhotos: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </Animated.View>

          {/* Financial Section */}
          <Animated.View entering={FadeInDown.delay(160).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Financial
            </Text>

            {/* Payments Toggle */}
            <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <DollarSign size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Payments</Text>
                    <Text className="text-slate-400 text-sm">Track team dues and payments</Text>
                  </View>
                </View>
                <Switch
                  value={teamSettings.showPayments !== false}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTeamSettingsAndSync({ showPayments: value });
                  }}
                  trackColor={{ false: '#334155', true: '#22c55e' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>

            {/* Stripe Setup - only when Payments enabled */}
            {teamSettings.showPayments !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/stripe-setup');
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View style={{ backgroundColor: '#635BFF20', borderRadius: 8, padding: 8 }}>
                      <CreditCard size={20} color="#635BFF" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Setup Stripe Payments</Text>
                      <Text className="text-slate-400 text-sm">
                        {teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete
                          ? 'Connected · tap to manage'
                          : 'Let players pay dues in-app'}
                      </Text>
                    </View>
                  </View>
                  {teamSettings.stripeAccountId && teamSettings.stripeOnboardingComplete ? (
                    <View className="w-2.5 h-2.5 rounded-full bg-green-400 mr-3" />
                  ) : null}
                  <ChevronRight size={20} color="#64748b" />
                </View>
              </Pressable>
            )}
          </Animated.View>

          {/* Performance Section */}
          <Animated.View entering={FadeInDown.delay(190).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Performance
            </Text>

            {/* Team Stats Settings */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsTeamStatsModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <BarChart3 size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Team Stats</Text>
                    <Text className="text-slate-400 text-sm">Track player and team statistics</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>

            {/* View Team Stats - only when enabled */}
            {teamSettings.showTeamStats !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push('/team-stats');
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full">
                      <BarChart3 size={20} color="#67e8f9" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">View Team Stats</Text>
                      <Text className="text-slate-400 text-sm">View and edit player statistics</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#64748b" />
                </View>
              </Pressable>
            )}

            {/* End Season - only when Team Stats enabled */}
            {teamSettings.showTeamStats !== false && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEndSeasonName(teamSettings.currentSeasonName || '');
                  setEndSeasonStep('name');
                  setIsEndSeasonModalVisible(true);
                }}
                className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full">
                      <Archive size={20} color="#67e8f9" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">End Season</Text>
                      <Text className="text-slate-400 text-sm">
                        {teamSettings.currentSeasonName
                          ? `Archive ${teamSettings.currentSeasonName} and reset stats`
                          : 'Archive current stats and start fresh'}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#64748b" />
                </View>
              </Pressable>
            )}
          </Animated.View>

          {/* Culture Section */}
          <Animated.View entering={FadeInDown.delay(220).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Culture
            </Text>

            {/* Refreshments */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsRefreshmentModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-cyan-500/20 p-2 rounded-full">
                    <JuiceBoxIcon size={20} color="#67e8f9" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Refreshments</Text>
                    <Text className="text-slate-400 text-sm">Assign players to bring refreshments</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
          </Animated.View>

          {/* Data Management Section */}
          <Animated.View entering={FadeInDown.delay(250).springify()}>
            <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-4 mt-2">
              Data Management
            </Text>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                setIsEraseDataMenuModalVisible(true);
              }}
              className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="bg-red-500/20 p-2 rounded-full">
                    <AlertTriangle size={20} color="#ef4444" />
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-white font-semibold">Danger Zone</Text>
                    <Text className="text-slate-400 text-sm">Erase or delete team data</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#64748b" />
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* ─── Team Stats Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={isTeamStatsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsTeamStatsModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Team Stats</Text>
              <Pressable onPress={() => setIsTeamStatsModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">Configure team and player statistics tracking.</Text>

              <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full"><BarChart3 size={20} color="#67e8f9" /></View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Use Team Stats</Text>
                      <Text className="text-slate-400 text-sm">Track player and team statistics</Text>
                    </View>
                  </View>
                  <Switch
                    value={teamSettings.showTeamStats !== false}
                    onValueChange={(value) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTeamSettingsAndSync({ showTeamStats: value }); }}
                    trackColor={{ false: '#334155', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              {teamSettings.showTeamStats !== false && (
                <>
                  <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-amber-500/10 p-2 rounded-full"><Trophy size={18} color="#f59e0b" /></View>
                        <View className="ml-3 flex-1">
                          <Text className="text-white font-semibold">Team Records</Text>
                          <Text className="text-slate-400 text-sm">Show all-time team records and leaders</Text>
                        </View>
                      </View>
                      <Switch
                        value={teamSettings.showTeamRecords === true}
                        onValueChange={(value) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTeamSettingsAndSync({ showTeamRecords: value }); }}
                        trackColor={{ false: '#334155', true: '#22c55e' }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  </View>

                  <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center flex-1">
                        <View className="bg-emerald-500/10 p-2 rounded-full"><Edit3 size={18} color="#059669" /></View>
                        <View className="ml-3 flex-1">
                          <Text className="text-white font-semibold">Allow Players to Manage Own Stats</Text>
                          <Text className="text-slate-400 text-sm">Players can update their game stats</Text>
                        </View>
                      </View>
                      <Switch
                        value={teamSettings.allowPlayerSelfStats === true}
                        onValueChange={(value) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTeamSettingsAndSync({ allowPlayerSelfStats: value }); }}
                        trackColor={{ false: '#334155', true: '#22c55e' }}
                        thumbColor="#ffffff"
                      />
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Refreshments Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={isRefreshmentModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsRefreshmentModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Refreshments</Text>
              <Pressable onPress={() => setIsRefreshmentModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">Configure refreshment duty assignments for your team.</Text>

              <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-cyan-500/20 p-2 rounded-full"><JuiceBoxIcon size={20} color="#67e8f9" /></View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-semibold">Enable Refreshment Duty</Text>
                      <Text className="text-slate-400 text-sm">Assign players to bring refreshments</Text>
                    </View>
                  </View>
                  <Switch
                    value={teamSettings.showRefreshmentDuty !== false}
                    onValueChange={(value) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTeamSettingsAndSync({ showRefreshmentDuty: value }); }}
                    trackColor={{ false: '#334155', true: '#22c55e' }}
                    thumbColor="#ffffff"
                  />
                </View>
              </View>

              {teamSettings.showRefreshmentDuty !== false && (
                <View className="bg-slate-800/80 rounded-2xl p-4 mb-3 border border-slate-700/50">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="bg-amber-500/10 p-2 rounded-full"><Beer size={18} color="#d97706" /></View>
                      <View className="ml-3 flex-1">
                        <Text className="text-white font-semibold">21+ Beverages</Text>
                        <Text className="text-slate-400 text-sm">Show beer mug icon instead</Text>
                      </View>
                    </View>
                    <Switch
                      value={teamSettings.refreshmentDutyIs21Plus === true}
                      onValueChange={(value) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTeamSettingsAndSync({ refreshmentDutyIs21Plus: value }); }}
                      trackColor={{ false: '#334155', true: '#22c55e' }}
                      thumbColor="#ffffff"
                    />
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Danger Zone Menu Modal ─────────────────────────────────────────── */}
      <Modal
        visible={isEraseDataMenuModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEraseDataMenuModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">Danger Zone</Text>
              <Pressable onPress={() => setIsEraseDataMenuModalVisible(false)} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>
            <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text className="text-slate-400 text-sm mb-6">Permanently remove team data. These actions cannot be undone.</Text>

              <Pressable
                onPress={() => { setIsEraseDataMenuModalVisible(false); handleEraseAllData(); }}
                className="bg-orange-500/10 rounded-2xl p-4 mb-3 border border-orange-500/30 active:bg-orange-500/20"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-orange-500/20 p-2 rounded-full"><Trash2 size={20} color="#f97316" /></View>
                    <View className="ml-3 flex-1">
                      <Text className="text-orange-400 font-semibold">Erase All Data</Text>
                      <Text className="text-slate-400 text-sm">Delete all team data and start fresh</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#f97316" />
                </View>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  setIsEraseDataMenuModalVisible(false);
                  setDeleteConfirmText('');
                  setIsDeleteTeamModalVisible(true);
                }}
                className="bg-red-900/30 rounded-2xl p-4 mb-3 border border-red-700/50 active:bg-red-900/50"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <View className="bg-red-700/30 p-2 rounded-full"><AlertTriangle size={20} color="#dc2626" /></View>
                    <View className="ml-3 flex-1">
                      <Text className="text-red-500 font-semibold">Delete Team</Text>
                      <Text className="text-slate-400 text-sm">Permanently delete team and all accounts</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#dc2626" />
                </View>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Erase All Data Confirmation Modal ─────────────────────────────── */}
      <Modal
        visible={isEraseDataModalVisible}
        animationType="fade"
        transparent
        onRequestClose={cancelEraseAllData}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-red-500/30">
            <View className="items-center mb-6">
              <View className="w-16 h-16 rounded-full bg-red-500/20 items-center justify-center mb-4">
                <AlertTriangle size={32} color="#ef4444" />
              </View>
              <Text className="text-white text-xl font-bold text-center">Erase All Data?</Text>
              <Text className="text-slate-400 text-center mt-2">
                This will permanently delete all players, games, statistics, photos, chat messages, and payment records.
              </Text>
            </View>
            <View>
              <Pressable
                onPress={confirmEraseAllData}
                className="flex-row items-center justify-center bg-red-600 rounded-xl py-4 mb-3 active:bg-red-700"
              >
                <Trash2 size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Erase Everything</Text>
              </Pressable>
              <Pressable
                onPress={cancelEraseAllData}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Delete Team Confirmation Modal ────────────────────────────────── */}
      <Modal
        visible={isDeleteTeamModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsDeleteTeamModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
          <View className="bg-slate-800 rounded-2xl p-6 w-full max-w-sm border border-red-700/50">
            <View className="items-center mb-6">
              <View className="w-20 h-20 rounded-full bg-red-900/50 items-center justify-center mb-4">
                <AlertTriangle size={40} color="#dc2626" />
              </View>
              <Text className="text-red-500 text-2xl font-bold text-center">Delete Team?</Text>
              <Text className="text-slate-300 text-center mt-3">This is a permanent, irreversible action that will delete:</Text>
              <View className="mt-3 w-full">
                <Text className="text-slate-400 text-sm">• All player accounts and profiles</Text>
                <Text className="text-slate-400 text-sm">• All admin accounts</Text>
                <Text className="text-slate-400 text-sm">• All games and schedules</Text>
                <Text className="text-slate-400 text-sm">• All photos and memories</Text>
                <Text className="text-slate-400 text-sm">• All chat messages</Text>
                <Text className="text-slate-400 text-sm">• All payment records</Text>
                <Text className="text-slate-400 text-sm">• All team settings</Text>
              </View>
              <Text className="text-red-400 text-center mt-4 font-semibold">This action CANNOT be undone.</Text>
            </View>
            <View className="mb-4">
              <Text className="text-slate-300 text-center mb-2">
                Type <Text className="text-red-500 font-bold">DELETE</Text> to confirm:
              </Text>
              <TextInput
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                placeholder="Type DELETE"
                placeholderTextColor="#64748b"
                className="bg-slate-700 rounded-xl px-4 py-3 text-white text-center text-lg font-semibold"
                autoCapitalize="characters"
              />
            </View>
            <View>
              <Pressable
                onPress={() => {
                  if (deleteConfirmText === 'DELETE') {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    deleteCurrentTeam();
                    setIsDeleteTeamModalVisible(false);
                    setDeleteConfirmText('');
                    router.replace('/login');
                  }
                }}
                disabled={deleteConfirmText !== 'DELETE'}
                className={cn(
                  'flex-row items-center justify-center rounded-xl py-4 mb-3',
                  deleteConfirmText === 'DELETE' ? 'bg-red-600 active:bg-red-700' : 'bg-slate-600 opacity-50'
                )}
              >
                <Trash2 size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Delete Everything Forever</Text>
              </Pressable>
              <Pressable
                onPress={() => { setIsDeleteTeamModalVisible(false); setDeleteConfirmText(''); }}
                className="flex-row items-center justify-center bg-slate-700 rounded-xl py-4 active:bg-slate-600"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── End Season Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={isEndSeasonModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setIsEndSeasonModalVisible(false); setEndSeasonStep('name'); }}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
              <Text className="text-white text-lg font-bold">End Season</Text>
              <Pressable
                onPress={() => {
                  if (endSeasonStep === 'confirm') { setEndSeasonStep('name'); }
                  else { setIsEndSeasonModalVisible(false); }
                }}
                className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center"
              >
                <X size={18} color="#94a3b8" />
              </Pressable>
            </View>

            {endSeasonStep === 'name' ? (
              <View className="px-5 pt-6">
                <View className="bg-purple-500/10 p-4 rounded-xl mb-6 border border-purple-500/20">
                  <View className="flex-row items-center mb-2">
                    <Archive size={20} color="#a78bfa" />
                    <Text className="text-purple-300 font-semibold ml-2">Archive Season</Text>
                  </View>
                  <Text className="text-slate-400 text-sm">
                    This will save all current player stats and team records to history, then reset everything for a new season.
                  </Text>
                </View>
                <Text className="text-slate-400 text-sm mb-2">Season Name</Text>
                <TextInput
                  value={endSeasonName}
                  onChangeText={setEndSeasonName}
                  placeholder="e.g., 2024-2025"
                  placeholderTextColor="#64748b"
                  className="bg-slate-800 rounded-xl px-4 py-3 text-white text-lg mb-6"
                  autoFocus
                />
                <Pressable
                  onPress={() => { if (endSeasonName.trim()) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setEndSeasonStep('confirm'); } }}
                  disabled={!endSeasonName.trim()}
                  className={`rounded-xl py-4 items-center ${endSeasonName.trim() ? 'bg-purple-600 active:bg-purple-700' : 'bg-slate-700'}`}
                >
                  <Text className={`font-semibold ${endSeasonName.trim() ? 'text-white' : 'text-slate-500'}`}>Continue</Text>
                </Pressable>
              </View>
            ) : (
              <View className="px-5 pt-6">
                <View className="bg-amber-500/10 p-4 rounded-xl mb-4 border border-amber-500/20">
                  <View className="flex-row items-center mb-2">
                    <AlertTriangle size={20} color="#f59e0b" />
                    <Text className="text-amber-300 font-semibold ml-2">Confirm Archive</Text>
                  </View>
                  <Text className="text-slate-400 text-sm">You are about to archive season "{endSeasonName}" and reset all stats.</Text>
                </View>

                <View className="bg-slate-800/60 rounded-xl p-4 mb-4">
                  <Text className="text-slate-300 font-medium mb-3">What will happen:</Text>
                  <View className="flex-row items-start mb-2">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">
                      Current team record ({teamSettings.record?.wins ?? 0}-{teamSettings.record?.losses ?? 0}{teamSettings.record?.ties ? `-${teamSettings.record.ties}` : ''}) will be saved
                    </Text>
                  </View>
                  <View className="flex-row items-start mb-2">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">All player stats will be archived to history</Text>
                  </View>
                  <View className="flex-row items-start mb-2">
                    <Check size={16} color="#22c55e" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">Best season record will be updated if this is better</Text>
                  </View>
                  <View className="flex-row items-start">
                    <RefreshCw size={16} color="#67e8f9" />
                    <Text className="text-slate-400 text-sm ml-2 flex-1">All stats will be reset to zero for new season</Text>
                  </View>
                </View>

                <Pressable
                  onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    archiveAndStartNewSeason(endSeasonName.trim());
                    setCurrentSeasonName(endSeasonName.trim());
                    setIsEndSeasonModalVisible(false);
                    setEndSeasonStep('name');
                    setEndSeasonName('');
                  }}
                  className="bg-purple-600 rounded-xl py-4 items-center mb-3 active:bg-purple-700"
                >
                  <Text className="text-white font-semibold">Archive & Start New Season</Text>
                </Pressable>
                <Pressable onPress={() => setEndSeasonStep('name')} className="bg-slate-700 rounded-xl py-4 items-center active:bg-slate-600">
                  <Text className="text-slate-300 font-semibold">Go Back</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
