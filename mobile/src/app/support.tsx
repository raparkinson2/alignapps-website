import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  HelpCircle,
  Lightbulb,
  Bug,
  Send,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTeamStore, getPlayerName } from '@/lib/store';

const FEEDBACK_EMAIL = 'rob@alignapps.com';

type Tab = 'faq' | 'feature' | 'bug';

// ─── FAQ Section ──────────────────────────────────────────────────────────────

const FAQS = [
  {
    question: 'How do I check in for a game?',
    answer:
      'Go to the Schedule tab, tap on the game you want to check in for, then tap the check-in button next to your name. You can mark yourself as "In" or "Out".',
  },
  {
    question: 'How do I set my unavailable dates?',
    answer:
      'Go to More → My Availability. Here you can select dates when you\'ll be unavailable. The app will automatically check you out for any games or practices that fall on those dates.',
  },
  {
    question: 'How do I create a poll?',
    answer:
      'Go to More → Team Polls and tap the "+" button. You can create single or multiple choice polls, set deadlines, and notify team members.',
  },
  {
    question: "What's the difference between roles?",
    answer:
      'Admins have full access including payments and player management. Coaches can edit player profiles and stats. Captains can manage games and lineups. Parents have view-only access to schedule, roster, and payments.',
  },
  {
    question: 'How do I switch between teams?',
    answer:
      "If you're on multiple teams, go to More → Switch Team. You'll see all teams you belong to and can tap to switch between them.",
  },
  {
    question: 'How do I delete my account?',
    answer:
      'Go to More → scroll to the bottom → Delete My Account. You\'ll need to type "DELETE" to confirm. This action is permanent and cannot be undone.',
  },
];

function FAQItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Animated.View entering={FadeInDown.delay(80 + index * 40).springify()} className="mb-2">
      <Pressable
        onPress={() => {
          setExpanded((e) => !e);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
        className="bg-slate-800/70 rounded-2xl px-4 py-3.5 active:bg-slate-700/70 border border-slate-700/40"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-white font-semibold text-sm flex-1 pr-3">{question}</Text>
          {expanded ? (
            <ChevronDown size={16} color="#67e8f9" />
          ) : (
            <ChevronRight size={16} color="#475569" />
          )}
        </View>
        {expanded && (
          <Text className="text-slate-400 text-sm leading-5 mt-2.5">{answer}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Shared submit helper ─────────────────────────────────────────────────────

async function sendEmail(
  subject: string,
  body: string,
  teamName: string
): Promise<void> {
  const supabaseUrl =
    process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_PUBLIC_URL;
  const supabaseAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLIC_ANON;

  const response = await fetch(`${supabaseUrl}/functions/v1/send-team-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ to: [FEEDBACK_EMAIL], subject, body, teamName }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || 'Request failed');
  }
}

// ─── Feature Request Form ─────────────────────────────────────────────────────

function FeatureForm({
  playerName,
  teamName,
  email,
}: {
  playerName: string;
  teamName: string;
  email: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [contactEmail, setContactEmail] = useState(email);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = title.trim() && description.trim() && reason.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body =
        `Feature Request\n================\n\n` +
        `Title: ${title.trim()}\n\nDescription:\n${description.trim()}\n\n` +
        `Reason:\n${reason.trim()}\n\n---\n` +
        `Submitted by: ${playerName}\nContact: ${contactEmail.trim() || 'Not provided'}\n` +
        `Team: ${teamName}\nDate: ${new Date().toLocaleDateString()}`;
      await sendEmail(`Feature Request: ${title.trim()}`, body, teamName);
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View className="flex-1 items-center justify-center py-16 px-8">
        <Animated.View entering={FadeInUp.delay(50).springify()} className="items-center">
          <View className="w-20 h-20 rounded-full bg-cyan-500/15 items-center justify-center mb-5">
            <CheckCircle size={38} color="#67e8f9" />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">Request Sent!</Text>
          <Text className="text-slate-400 text-sm text-center leading-5 mb-8">
            We'll review your suggestion and consider it for a future update.
          </Text>
          <Pressable
            onPress={() => {
              setTitle(''); setDescription(''); setReason('');
              setContactEmail(email); setSubmitted(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="bg-slate-800 rounded-xl py-3.5 px-8 active:bg-slate-700"
          >
            <Text className="text-cyan-400 font-semibold">Submit Another</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View>
      <Animated.View entering={FadeInDown.delay(80).springify()} className="bg-cyan-500/10 border border-cyan-500/25 rounded-2xl p-4 mb-5">
        <View className="flex-row items-center">
          <Lightbulb size={16} color="#67e8f9" />
          <Text className="text-cyan-300 font-semibold text-sm ml-2">Got an idea?</Text>
        </View>
        <Text className="text-slate-400 text-sm mt-1 leading-5">
          Fill out the form below and we'll review your request.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify()} className="mb-3">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">
          Feature title <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="e.g. Add a team stats dashboard"
          placeholderTextColor="#475569"
          autoCapitalize="sentences"
          maxLength={100}
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).springify()} className="mb-3">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">
          Description <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={description} onChangeText={setDescription}
          placeholder="Describe the feature you'd like to see..."
          placeholderTextColor="#475569"
          autoCapitalize="sentences"
          multiline numberOfLines={4} textAlignVertical="top"
          maxLength={1000}
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
          style={{ minHeight: 100 }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).springify()} className="mb-3">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">
          Why would this help? <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={reason} onChangeText={setReason}
          placeholder="How would this improve the app for your team?"
          placeholderTextColor="#475569"
          autoCapitalize="sentences"
          multiline numberOfLines={3} textAlignVertical="top"
          maxLength={500}
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
          style={{ minHeight: 80 }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(210).springify()} className="mb-5">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">Email (optional)</Text>
        <TextInput
          value={contactEmail} onChangeText={setContactEmail}
          placeholder="email@example.com"
          placeholderTextColor="#475569"
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
        />
        <Text className="text-slate-600 text-xs mt-1">So we can follow up on your request</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).springify()}>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          style={{
            backgroundColor: canSubmit && !isSubmitting ? '#0891b2' : 'rgba(8,145,178,0.3)',
            borderRadius: 14, paddingVertical: 15,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Send size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                Submit Request
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Bug Report Form ──────────────────────────────────────────────────────────

function BugForm({
  playerName,
  teamName,
  email,
}: {
  playerName: string;
  teamName: string;
  email: string;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [contactEmail, setContactEmail] = useState(email);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = title.trim() && description.trim() && steps.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const body =
        `Bug Report\n================\n\n` +
        `Title: ${title.trim()}\n\nWhat happened:\n${description.trim()}\n\n` +
        `Steps to reproduce:\n${steps.trim()}\n\n---\n` +
        `Reported by: ${playerName}\nContact: ${contactEmail.trim() || 'Not provided'}\n` +
        `Team: ${teamName}\nPlatform: ${Platform.OS}\nDate: ${new Date().toLocaleDateString()}`;
      await sendEmail(`Bug Report: ${title.trim()}`, body, teamName);
      setSubmitted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to send. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View className="flex-1 items-center justify-center py-16 px-8">
        <Animated.View entering={FadeInUp.delay(50).springify()} className="items-center">
          <View className="w-20 h-20 rounded-full bg-green-500/15 items-center justify-center mb-5">
            <CheckCircle size={38} color="#22c55e" />
          </View>
          <Text className="text-white text-xl font-bold text-center mb-2">Report Sent!</Text>
          <Text className="text-slate-400 text-sm text-center leading-5 mb-8">
            Thanks for letting us know. We'll look into it and get it fixed.
          </Text>
          <Pressable
            onPress={() => {
              setTitle(''); setDescription(''); setSteps('');
              setContactEmail(email); setSubmitted(false);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="bg-slate-800 rounded-xl py-3.5 px-8 active:bg-slate-700"
          >
            <Text className="text-cyan-400 font-semibold">Report Another</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View>
      <Animated.View entering={FadeInDown.delay(80).springify()} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-5">
        <View className="flex-row items-center">
          <Bug size={16} color="#f87171" />
          <Text className="text-red-400 font-semibold text-sm ml-2">Found a bug?</Text>
        </View>
        <Text className="text-slate-400 text-sm mt-1 leading-5">
          The more detail you provide, the faster we can fix it.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify()} className="mb-3">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">
          Bug title <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={title} onChangeText={setTitle}
          placeholder="e.g. App crashes when opening photos"
          placeholderTextColor="#475569"
          autoCapitalize="sentences"
          maxLength={100}
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).springify()} className="mb-3">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">
          What happened? <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={description} onChangeText={setDescription}
          placeholder="What went wrong? What did you expect to happen?"
          placeholderTextColor="#475569"
          autoCapitalize="sentences"
          multiline numberOfLines={4} textAlignVertical="top"
          maxLength={1000}
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
          style={{ minHeight: 100 }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(180).springify()} className="mb-3">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">
          Steps to reproduce <Text className="text-red-400">*</Text>
        </Text>
        <TextInput
          value={steps} onChangeText={setSteps}
          placeholder={'1. Go to Photos tab\n2. Tap on a photo\n3. App crashes'}
          placeholderTextColor="#475569"
          autoCapitalize="sentences"
          multiline numberOfLines={3} textAlignVertical="top"
          maxLength={500}
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
          style={{ minHeight: 80 }}
        />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(210).springify()} className="mb-5">
        <Text className="text-slate-400 text-xs font-medium mb-1.5">Email (optional)</Text>
        <TextInput
          value={contactEmail} onChangeText={setContactEmail}
          placeholder="email@example.com"
          placeholderTextColor="#475569"
          autoCapitalize="none" keyboardType="email-address" autoComplete="email"
          className="bg-slate-800/80 rounded-xl px-4 py-3.5 text-white text-base border border-slate-700/50"
        />
        <Text className="text-slate-600 text-xs mt-1">So we can follow up if we need more info</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(240).springify()}>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !canSubmit}
          style={{
            backgroundColor: canSubmit && !isSubmitting ? '#dc2626' : 'rgba(220,38,38,0.3)',
            borderRadius: 14, paddingVertical: 15,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Send size={18} color="white" />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
                Submit Report
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof HelpCircle; color: string }[] = [
  { id: 'faq', label: 'FAQs', icon: HelpCircle, color: '#22c55e' },
  { id: 'feature', label: 'Feature', icon: Lightbulb, color: '#67e8f9' },
  { id: 'bug', label: 'Bug', icon: Bug, color: '#f87171' },
];

export default function SupportScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('faq');

  const currentPlayerId = useTeamStore((s) => s.currentPlayerId);
  const players = useTeamStore((s) => s.players);
  const teamName = useTeamStore((s) => s.teamName);

  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const playerName = currentPlayer ? getPlayerName(currentPlayer) : 'Unknown';
  const playerEmail = currentPlayer?.email || '';

  const activeTabConfig = TABS.find((t) => t.id === activeTab)!;

  return (
    <View className="flex-1 bg-slate-900">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          className="flex-row items-center px-5 pt-2 pb-4"
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            className="w-10 h-10 rounded-full bg-slate-800/80 items-center justify-center mr-3"
          >
            <ArrowLeft size={20} color="#67e8f9" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-slate-500 text-xs font-medium">More</Text>
            <Text className="text-white text-2xl font-bold">Support</Text>
          </View>
        </Animated.View>

        {/* Tab Selector */}
        <Animated.View entering={FadeInDown.delay(60).springify()} className="px-5 mb-5">
          <View className="flex-row bg-slate-800/60 rounded-2xl p-1 border border-slate-700/40">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    setActiveTab(tab.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
                  }}
                >
                  <Icon size={14} color={isActive ? tab.color : '#475569'} />
                  <Text
                    style={{
                      marginLeft: 5,
                      fontSize: 13,
                      fontWeight: isActive ? '600' : '400',
                      color: isActive ? tab.color : '#475569',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1"
        >
          <ScrollView
            key={activeTab}
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            {activeTab === 'faq' && (
              <>
                <Animated.View entering={FadeInDown.delay(40).springify()} className="mb-4">
                  <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    Frequently Asked Questions
                  </Text>
                </Animated.View>
                {FAQS.map((faq, i) => (
                  <FAQItem key={i} question={faq.question} answer={faq.answer} index={i} />
                ))}
              </>
            )}

            {activeTab === 'feature' && (
              <FeatureForm
                playerName={playerName}
                teamName={teamName}
                email={playerEmail}
              />
            )}

            {activeTab === 'bug' && (
              <BugForm
                playerName={playerName}
                teamName={teamName}
                email={playerEmail}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
