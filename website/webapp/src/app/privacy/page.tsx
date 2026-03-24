import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — ALIGN Sports',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-base text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium mb-10 hover:opacity-80 transition-opacity">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-black tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-6">Last updated: March 2026</p>

        <p className="text-slate-300 text-sm leading-relaxed mb-6">
          ALIGN Sports ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information about you when you use the ALIGN Sports mobile application and website at www.alignapps.com.
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">Information We Collect</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-2">We collect information you provide directly, including:</p>
        <ul className="list-disc list-inside space-y-1 mb-3 text-slate-300 text-sm leading-relaxed">
          <li>Account information (name, email address, password)</li>
          <li>Team and player information you create or upload</li>
          <li>Photos you share within the app</li>
          <li>Messages sent through the in-app chat</li>
          <li>Payment information (processed securely through Stripe; we do not store card numbers)</li>
        </ul>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          We also collect usage data automatically, such as device type, operating system, and app interactions, to improve the app experience.
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-1 mb-4 text-slate-300 text-sm leading-relaxed">
          <li>To provide and operate the Align Sports service</li>
          <li>To send push notifications for game reminders, payments, and team updates</li>
          <li>To process payments through Stripe</li>
          <li>To improve and develop the app</li>
          <li>To communicate with you about support requests</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">Data Sharing</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-2">We do not sell your personal data. We share information only with:</p>
        <ul className="list-disc list-inside space-y-1 mb-4 text-slate-300 text-sm leading-relaxed">
          <li><strong className="text-slate-100">Stripe</strong> — to process in-app payments</li>
          <li><strong className="text-slate-100">Supabase</strong> — for database and real-time sync infrastructure</li>
          <li><strong className="text-slate-100">Apple</strong> — for push notification delivery</li>
        </ul>

        <h2 className="text-lg font-bold mt-6 mb-2">Team Data Privacy</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          Your team's data — including schedules, rosters, chat messages, and photos — is private and accessible only to members of your team. We do not access or share your team's content with other users or third parties.
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">Data Retention</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          We retain your data for as long as your account is active. You may delete your account at any time from within the app. Upon deletion, your personal data is removed within 30 days.
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">Children's Privacy</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-4">
          ALIGN Sports is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us with personal information, please contact us.
        </p>

        <h2 className="text-lg font-bold mt-6 mb-2">Contact Us</h2>
        <p className="text-slate-300 text-sm leading-relaxed">
          If you have questions about this Privacy Policy, please contact us at{' '}
          <a href="mailto:rob@alignapps.com" className="text-cyan-400 hover:opacity-80 transition-opacity">
            rob@alignapps.com
          </a>.
        </p>
      </div>
    </div>
  );
}
