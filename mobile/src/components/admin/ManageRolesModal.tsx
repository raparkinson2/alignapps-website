import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { X, Check, User, UserMinus, UserCog, Crown } from 'lucide-react-native';
import { useTeamStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { ParentChildIcon } from '@/components/ParentChildIcon';
import { pushTeamToSupabase } from '@/lib/realtime-sync';
import { syncError } from '@/lib/sync-error-handler';
import { useRouter } from 'expo-router';

interface ManageRolesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ManageRolesModal({ visible, onClose }: ManageRolesModalProps) {
  const router = useRouter();
  const teamSettings = useTeamStore((s) => s.teamSettings);
  const setTeamSettings = useTeamStore((s) => s.setTeamSettings);
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const isPremium = teamSettings?.isPremium ?? false;

  const setTeamSettingsAndSync = (updates: Parameters<typeof setTeamSettings>[0]) => {
    setTeamSettings(updates);
    if (activeTeamId) {
      setTimeout(() => {
        const s = useTeamStore.getState();
        pushTeamToSupabase(activeTeamId, s.teamName, s.teamSettings).catch(syncError('sync'));
      }, 50);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-slate-900 rounded-t-3xl" style={{ maxHeight: '90%', minHeight: 300 }}>
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-slate-800">
            <Text className="text-white text-lg font-bold">Manage Roles</Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
              <X size={18} color="#94a3b8" />
            </Pressable>
          </View>

          <ScrollView className="px-5 pt-6" contentContainerStyle={{ paddingBottom: 40 }}>
            <Text className="text-slate-400 text-sm mb-4">
              Select which roles are available when adding or editing players. Disabled roles will be hidden from selection.
            </Text>

            {/* Role Options */}
            {[
              { id: 'player' as const, label: 'Player', description: 'Active team member', icon: <User size={20} color="#22c55e" />, bgColor: 'bg-green-500', iconBg: 'bg-green-500/20', premiumRequired: false },
              { id: 'reserve' as const, label: 'Reserve', description: 'Backup/substitute player', icon: <UserMinus size={20} color="#94a3b8" />, bgColor: 'bg-slate-600', iconBg: 'bg-slate-600/20', premiumRequired: false },
              { id: 'coach' as const, label: 'Coach', description: 'Team coach (no jersey number needed)', icon: <UserCog size={20} color="#67e8f9" />, bgColor: 'bg-cyan-500', iconBg: 'bg-cyan-500/20', premiumRequired: false },
              { id: 'parent' as const, label: 'Parent/Guardian', description: isPremium ? 'Linked parent account — chat, check-in & more' : 'Requires a Premium subscription', icon: <ParentChildIcon size={20} color={isPremium ? "#ec4899" : "#475569"} />, bgColor: 'bg-pink-500', iconBg: isPremium ? 'bg-pink-500/20' : 'bg-slate-700/30', premiumRequired: true },
            ].map((role) => {
              const enabledRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach'];
              const isEnabled = enabledRoles.includes(role.id);
              // Player must always be enabled
              const isRequired = role.id === 'player';
              // Parent requires premium
              const isLocked = role.premiumRequired && !isPremium;

              return (
                <Pressable
                  key={role.id}
                  onPress={() => {
                    if (isRequired) return;
                    if (isLocked) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onClose();
                      router.push('/upgrade');
                      return;
                    }
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const currentRoles = teamSettings.enabledRoles ?? ['player', 'reserve', 'coach'];
                    if (isEnabled) {
                      setTeamSettingsAndSync({ enabledRoles: currentRoles.filter(r => r !== role.id) });
                    } else {
                      setTeamSettingsAndSync({ enabledRoles: [...currentRoles, role.id] });
                    }
                  }}
                  className={cn(
                    'flex-row items-center p-4 rounded-xl mb-3 border',
                    isLocked
                      ? 'bg-slate-800/30 border-slate-700/30'
                      : isEnabled ? `${role.iconBg} border-slate-600` : 'bg-slate-800/50 border-slate-700/50'
                  )}
                >
                  <View className={cn('p-2 rounded-full', role.iconBg)}>
                    {role.icon}
                  </View>
                  <View className="flex-1 ml-3">
                    <View className="flex-row items-center gap-2">
                      <Text className={cn('font-semibold', isLocked ? 'text-slate-600' : isEnabled ? 'text-white' : 'text-slate-500')}>
                        {role.label}
                        {isRequired && <Text className="text-slate-500 font-normal"> (Required)</Text>}
                      </Text>
                      {isLocked && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, gap: 3, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' }}>
                          <Crown size={9} color="#f59e0b" />
                          <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: '700' }}>PREMIUM</Text>
                        </View>
                      )}
                    </View>
                    <Text className={cn('text-sm', isLocked ? 'text-slate-600' : isEnabled ? 'text-slate-400' : 'text-slate-600')}>
                      {role.description}
                    </Text>
                  </View>
                  {isLocked ? (
                    <Crown size={18} color="#f59e0b" style={{ opacity: 0.5 }} />
                  ) : (
                    <View className={cn(
                      'w-6 h-6 rounded-full border-2 items-center justify-center',
                      isEnabled ? `${role.bgColor} border-transparent` : 'border-slate-600'
                    )}>
                      {isEnabled && <Check size={14} color="white" />}
                    </View>
                  )}
                </Pressable>
              );
            })}

            <View className="bg-slate-800/50 rounded-xl p-4 mt-4">
              <Text className="text-slate-400 text-sm">
                <Text className="text-purple-400 font-semibold">Tip:</Text> Disable roles your team doesn't use to simplify player management. Parent/Guardian requires a Premium subscription.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
