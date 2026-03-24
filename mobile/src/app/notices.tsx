import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, FileText, ChevronDown, ChevronUp, Shield, Users, UserCheck, Eye, ScrollText } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';

export default function NoticesScreen() {
  const router = useRouter();
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [isPermissionsExpanded, setIsPermissionsExpanded] = useState(false);
  const [isTermsExpanded, setIsTermsExpanded] = useState(false);

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
            <Text className="text-slate-400 text-sm font-medium">Settings</Text>
            <Text className="text-white text-2xl font-bold">Notices</Text>
          </View>
        </Animated.View>

        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* Permissions Breakdown */}
          <Animated.View entering={FadeInDown.delay(100).springify()} className="mb-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsPermissionsExpanded(!isPermissionsExpanded);
              }}
              className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center mr-3">
                    <Shield size={20} color="#a78bfa" />
                  </View>
                  <Text className="text-white font-semibold">Permissions Breakdown</Text>
                </View>
                {isPermissionsExpanded ? (
                  <ChevronUp size={20} color="#64748b" />
                ) : (
                  <ChevronDown size={20} color="#64748b" />
                )}
              </View>

              {isPermissionsExpanded && (
                <View className="mt-4 pt-4 border-t border-slate-700/50">
                  <Text className="text-purple-400 font-bold text-lg mb-3">Role Permissions</Text>

                  {/* Admin Section */}
                  <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                      <View className="w-6 h-6 rounded-full bg-purple-500/30 items-center justify-center mr-2">
                        <Shield size={14} color="#a78bfa" />
                      </View>
                      <Text className="text-purple-400 font-semibold">Admin Only</Text>
                    </View>
                    <View className="bg-slate-700/30 rounded-lg p-3">
                      <Text className="text-slate-300 text-sm leading-6">
                        {'\u2022'} Access Admin Panel{'\n'}
                        {'\u2022'} Player Management (add, edit, remove){'\n'}
                        {'\u2022'} Payment Methods (add/remove){'\n'}
                        {'\u2022'} Payment Periods (create/manage){'\n'}
                        {'\u2022'} Payment Tracking{'\n'}
                        {'\u2022'} Delete Any Poll
                      </Text>
                    </View>
                  </View>

                  {/* Admin + Coach Section */}
                  <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                      <View className="w-6 h-6 rounded-full bg-blue-500/30 items-center justify-center mr-2">
                        <Users size={14} color="#3b82f6" />
                      </View>
                      <Text className="text-blue-400 font-semibold">Admin + Coach</Text>
                    </View>
                    <View className="bg-slate-700/30 rounded-lg p-3">
                      <Text className="text-slate-300 text-sm leading-6">
                        {'\u2022'} Edit Any Player Profile{'\n'}
                        {'\u2022'} Edit Player Stats
                      </Text>
                    </View>
                  </View>

                  {/* Admin + Captain + Coach Section */}
                  <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                      <View className="w-6 h-6 rounded-full bg-cyan-500/30 items-center justify-center mr-2">
                        <Users size={14} color="#67e8f9" />
                      </View>
                      <Text className="text-cyan-400 font-semibold">Admin + Captain + Coach</Text>
                    </View>
                    <View className="bg-slate-700/30 rounded-lg p-3">
                      <Text className="text-slate-300 text-sm leading-6">
                        {'\u2022'} Create, Edit, Delete Games{'\n'}
                        {'\u2022'} Set Lineups (all formation types){'\n'}
                        {'\u2022'} Check In/Out Any Player{'\n'}
                        {'\u2022'} Edit/Delete Events{'\n'}
                        {'\u2022'} Add Games from Calendar
                      </Text>
                    </View>
                  </View>

                  {/* All Players Section */}
                  <View className="mb-4">
                    <View className="flex-row items-center mb-2">
                      <View className="w-6 h-6 rounded-full bg-green-500/30 items-center justify-center mr-2">
                        <UserCheck size={14} color="#22c55e" />
                      </View>
                      <Text className="text-green-400 font-semibold">All Players</Text>
                    </View>
                    <View className="bg-slate-700/30 rounded-lg p-3">
                      <Text className="text-slate-300 text-sm leading-6">
                        {'\u2022'} Create Polls{'\n'}
                        {'\u2022'} Vote on Polls{'\n'}
                        {'\u2022'} Delete Own Polls{'\n'}
                        {'\u2022'} Check In/Out Self{'\n'}
                        {'\u2022'} Edit Own Profile{'\n'}
                        {'\u2022'} Edit Own Stats (if enabled){'\n'}
                        {'\u2022'} View Schedule, Roster, Chat, Photos, Payments
                      </Text>
                    </View>
                  </View>

                  {/* Parents Section */}
                  <View>
                    <View className="flex-row items-center mb-2">
                      <View className="w-6 h-6 rounded-full bg-amber-500/30 items-center justify-center mr-2">
                        <Eye size={14} color="#f59e0b" />
                      </View>
                      <Text className="text-amber-400 font-semibold">Parents (View Only)</Text>
                    </View>
                    <View className="bg-slate-700/30 rounded-lg p-3">
                      <Text className="text-slate-300 text-sm leading-6">
                        {'\u2022'} View Schedule{'\n'}
                        {'\u2022'} View Roster{'\n'}
                        {'\u2022'} View Payments
                      </Text>
                      <Text className="text-red-400 text-sm leading-6 mt-2">
                        {'\u2022'} No access to Chat{'\n'}
                        {'\u2022'} No access to Photos{'\n'}
                        {'\u2022'} No access to Admin Panel
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Privacy Policy */}
          <Animated.View entering={FadeInDown.delay(150).springify()}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsPrivacyExpanded(!isPrivacyExpanded);
              }}
              className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-cyan-500/20 items-center justify-center mr-3">
                    <FileText size={20} color="#67e8f9" />
                  </View>
                  <Text className="text-white font-semibold">Privacy Policy</Text>
                </View>
                {isPrivacyExpanded ? (
                  <ChevronUp size={20} color="#64748b" />
                ) : (
                  <ChevronDown size={20} color="#64748b" />
                )}
              </View>

              {isPrivacyExpanded && (
                <View className="mt-4 pt-4 border-t border-slate-700/50">
                  <Text className="text-cyan-400 font-bold text-lg mb-1">Privacy Policy</Text>
                  <Text className="text-slate-500 text-xs mb-4">Last Updated: March 2026</Text>

                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    ALIGN Sports ("ALIGN Sports," "we," "our," or "us") respects your privacy and is committed to protecting your personal information. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you use the ALIGN Sports mobile application, related services, and website located at www.alignapps.com (collectively, the "Services").{'\n\n'}By accessing or using the Services, you agree to the collection and use of information in accordance with this Privacy Policy.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">1. Information We Collect</Text>
                  <Text className="text-slate-300 text-sm font-medium mt-2 mb-1">a. Information You Provide to Us</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-2">• Account Information: Name, email address, and password{'\n'}• Profile and Team Information: Team names, rosters, player details, and related content you create or upload{'\n'}• User Content: Photos, messages, and other content shared within the app{'\n'}• Communications: Information you provide when contacting support or communicating with other users</Text>
                  <Text className="text-slate-300 text-sm font-medium mt-2 mb-1">b. Payment Information</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-2">Payments are processed by a third-party payment processor, Stripe. We do not store or have access to your full payment card details.</Text>
                  <Text className="text-slate-300 text-sm font-medium mt-2 mb-1">c. Automatically Collected Information</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">• Device type, operating system, and app version{'\n'}• Usage activity within the Services{'\n'}• Log and diagnostic data{'\n\n'}This information is used to maintain security and improve functionality.</Text>

                  <Text className="text-white font-semibold mt-3 mb-2">2. How We Use Your Information</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    • To provide, operate, and maintain the Services{'\n'}• To facilitate team management features (e.g., rosters, scheduling, messaging){'\n'}• To send notifications (such as game reminders, payment updates, and team communications){'\n'}• To process transactions through third-party providers{'\n'}• To respond to support requests and communicate with you{'\n'}• To monitor, analyze, and improve the performance and functionality of the Services{'\n'}• To enforce our terms, policies, and legal obligations
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">3. How We Share Information</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    We do not sell your personal information.{'\n\n'}Service Providers:{'\n'}• Stripe (payment processing){'\n'}• Supabase (data storage and real-time infrastructure){'\n'}• Apple Inc. (push notification delivery){'\n\n'}We may also share information if required by law, or in connection with a merger, sale, or acquisition.{'\n\n'}All third-party service providers are contractually obligated to safeguard your information.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">4. Team Data and Visibility</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    Content created within a team (including schedules, rosters, messages, and photos) is visible only to members of that team, subject to user roles and permissions.{'\n\n'}We do not use team content for advertising purposes and do not disclose such content to unrelated third parties except as necessary to operate the Services.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">5. Data Retention</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    We retain personal information for as long as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce agreements.{'\n\n'}You may delete your account at any time through the application. Upon account deletion, personal data is permanently removed within 30 days, unless retention is required for legal or operational purposes.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">6. Your Rights and Choices</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    Depending on your location, you may have the right to:{'\n'}• Access the personal information we hold about you{'\n'}• Request correction or deletion of your data{'\n'}• Object to or restrict certain processing{'\n'}• Withdraw consent where applicable{'\n\n'}You may exercise these rights by contacting us at rob@alignapps.com.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">7. Children's Privacy</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    The Services are not directed to children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that such information has been collected, we will take steps to delete it promptly.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">8. Security</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    We implement reasonable administrative, technical, and organizational measures to protect your information. However, no system can be guaranteed to be 100% secure.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">9. Data Use Restrictions</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    ALIGN Sports does not use collected data for:{'\n'}• Third-party advertising{'\n'}• Data brokering{'\n'}• Cross-app or cross-site tracking{'\n\n'}Personal information is used solely for providing and improving the Services as described in this Privacy Policy.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">10. Changes to This Privacy Policy</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    We may update this Privacy Policy from time to time. Changes will be effective when posted, and the "Last Updated" date will be revised accordingly.{'\n\n'}Your continued use of the Services after changes are posted constitutes your acceptance of the updated policy.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">11. Contact Us</Text>
                  <Text className="text-slate-400 text-sm leading-5">
                    Email: rob@alignapps.com
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Terms of Service */}
          <Animated.View entering={FadeInDown.delay(200).springify()} className="mb-3">
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsTermsExpanded(!isTermsExpanded);
              }}
              className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 active:bg-slate-700/80"
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-full bg-emerald-500/20 items-center justify-center mr-3">
                    <ScrollText size={18} color="#34d399" />
                  </View>
                  <Text className="text-white font-semibold">Terms of Service</Text>
                </View>
                {isTermsExpanded ? (
                  <ChevronUp size={20} color="#64748b" />
                ) : (
                  <ChevronDown size={20} color="#64748b" />
                )}
              </View>

              {isTermsExpanded && (
                <View className="mt-4 pt-4 border-t border-slate-700/50">
                  <Text className="text-emerald-400 font-bold text-lg mb-1">Terms of Service</Text>
                  <Text className="text-slate-500 text-xs mb-4">Last Updated: March 2026</Text>

                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    These Terms of Service ("Terms") govern your access to and use of the ALIGN Sports mobile application, website located at www.alignapps.com, and related services (collectively, the "Services").{'\n\n'}By creating an account or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use the Services.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">1. Company Information</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    ALIGN Sports provides a platform for managing sports teams, including scheduling, communication, and payment tracking tools.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">2. Eligibility</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    You must be at least 13 years old to use the Services. If you are under the age of majority in your jurisdiction, you may use the Services only with the involvement of a parent or legal guardian.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">3. Account Registration and Security</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    To access certain features, you must create an account. You agree to:{'\n'}• Provide accurate, current, and complete information{'\n'}• Maintain the confidentiality of your login credentials{'\n'}• Be responsible for all activities under your account{'\n\n'}You must notify us immediately of any unauthorized use of your account.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">4. User Content</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    You retain ownership of your content. By using the Services, you grant ALIGN Sports a limited, non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display your content solely for the purpose of operating and improving the Services.{'\n\n'}You agree that your content will not violate any law, infringe intellectual property or privacy rights, or be harmful, abusive, or inappropriate.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">5. Payments and Financial Features</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    ALIGN Sports provides tools to track and organize payments but does not process payments directly. Payments may be facilitated through third-party providers such as Stripe.{'\n\n'}ALIGN Sports is not responsible for payment disputes, chargebacks, or refunds.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">6. Acceptable Use</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    You agree not to:{'\n'}• Use the Services for unlawful or fraudulent purposes{'\n'}• Harass, threaten, or harm other users{'\n'}• Upload malicious code or attempt to disrupt the Services{'\n'}• Attempt unauthorized access to systems or data
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">7. Intellectual Property</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    All rights, title, and interest in and to the Services (excluding user content) are owned by ALIGN Sports. You may not copy, modify, distribute, reverse engineer, or use ALIGN Sports branding without permission.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">8. Termination</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    We may suspend or terminate your access at any time if you violate these Terms, if required by law, or to protect the Services or other users. You may delete your account at any time through the app.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">9. Disclaimers</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    The Services are provided on an "as is" and "as available" basis. To the fullest extent permitted by law, ALIGN Sports disclaims all warranties, express or implied. We do not guarantee that the Services will be uninterrupted or error-free.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">10. Limitation of Liability</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    To the maximum extent permitted by law, ALIGN Sports shall not be liable for indirect, incidental, special, or consequential damages, loss of data, profits, or disputes between users. Total liability shall not exceed amounts paid in the 12 months preceding any claim.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">11. Governing Law</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    These Terms shall be governed by the laws of the State of Ohio, without regard to conflict of law principles.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">12. Changes to These Terms</Text>
                  <Text className="text-slate-400 text-sm leading-5 mb-3">
                    We may update these Terms from time to time. Changes will be effective when posted. Continued use of the Services constitutes acceptance of the updated Terms.
                  </Text>

                  <Text className="text-white font-semibold mt-3 mb-2">13. Contact Us</Text>
                  <Text className="text-slate-400 text-sm leading-5">
                    Email: rob@alignapps.com
                  </Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
