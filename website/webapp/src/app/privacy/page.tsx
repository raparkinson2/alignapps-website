import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy — ALIGN Sports Team Management App' },
  description: 'Read the ALIGN Sports privacy policy to understand how we collect, use, and protect your team data.',
};

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-slate-100 mb-3">{number}. {title}</h2>
      {children}
    </div>
  );
}

function SubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-sm font-semibold text-slate-200 mb-1">{label}</p>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-300 leading-relaxed mb-2">{children}</p>;
}

function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 mb-2">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-slate-300 leading-relaxed">{item}</li>
      ))}
    </ul>
  );
}

function Divider() {
  return <div className="border-t border-white/10 my-8" />;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-base text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium mb-10 hover:opacity-80 transition-opacity">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-black tracking-tight mb-1">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: March 2026</p>

        <P>
          ALIGN Apps, LLC, operating as ALIGN Sports (&quot;ALIGN Sports,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), respects your privacy and is committed to protecting your personal information. This Privacy Policy describes how we collect, use, disclose, and safeguard information when you use the ALIGN Sports mobile application, related services, and website located at www.alignapps.com (collectively, the &quot;Services&quot;).
        </P>
        <P>By accessing or using the Services, you agree to the collection and use of information in accordance with this Privacy Policy.</P>

        <Divider />

        <Section number="1" title="Information We Collect">
          <P>We may collect the following categories of information:</P>
          <SubSection label="a. Information You Provide to Us">
            <Ul items={[
              <><strong className="text-slate-100">Account Information:</strong> Name, email address, and password</>,
              <><strong className="text-slate-100">Profile and Team Information:</strong> Team names, rosters, player details, and related content you create or upload</>,
              <><strong className="text-slate-100">User Content:</strong> Photos, messages, and other content shared within the app</>,
              <><strong className="text-slate-100">Communications:</strong> Information you provide when contacting support or communicating with other users</>,
            ]} />
          </SubSection>
          <SubSection label="b. Payment Information">
            <P>Payments are processed by a third-party payment processor, Stripe. We do not store or have access to your full payment card details.</P>
          </SubSection>
          <SubSection label="c. Automatically Collected Information">
            <P>We automatically collect certain technical and usage data, including:</P>
            <Ul items={[
              'Device type, operating system, and app version',
              'Usage activity within the Services',
              'Log and diagnostic data',
            ]} />
            <P>This information is used to maintain security and improve functionality.</P>
          </SubSection>
        </Section>

        <Divider />

        <Section number="2" title="How We Use Your Information">
          <P>We use your information for the following purposes:</P>
          <Ul items={[
            'To provide, operate, and maintain the Services',
            'To facilitate team management features (e.g., rosters, scheduling, messaging)',
            'To send notifications (such as game reminders, payment updates, and team communications)',
            'To process transactions through third-party providers',
            'To respond to support requests and communicate with you',
            'To monitor, analyze, and improve the performance and functionality of the Services',
            'To enforce our terms, policies, and legal obligations',
          ]} />
        </Section>

        <Divider />

        <Section number="3" title="How We Share Information">
          <P>We do not sell your personal information.</P>
          <P>We may share information in the following limited circumstances:</P>
          <div className="space-y-2 mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">Service Providers:</p>
              <Ul items={[
                <><strong className="text-slate-100">Stripe</strong> (payment processing)</>,
                <><strong className="text-slate-100">Supabase</strong> (data storage and real-time infrastructure)</>,
                <><strong className="text-slate-100">Apple Inc.</strong> (push notification delivery)</>,
              ]} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Legal Requirements:</p>
              <P>If required to do so by law, regulation, or valid legal process</P>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">Business Transfers:</p>
              <P>In connection with a merger, sale, financing, or acquisition of all or part of our business</P>
            </div>
          </div>
          <P>All third-party service providers are contractually obligated to safeguard your information.</P>
        </Section>

        <Divider />

        <Section number="4" title="Team Data and Visibility">
          <P>Content created within a team (including schedules, rosters, messages, and photos) is visible only to members of that team, subject to user roles and permissions.</P>
          <P>We do not use team content for advertising purposes and do not disclose such content to unrelated third parties except as necessary to operate the Services.</P>
        </Section>

        <Divider />

        <Section number="5" title="Data Retention">
          <P>We retain personal information for as long as necessary to:</P>
          <Ul items={[
            'Provide the Services',
            'Comply with legal obligations',
            'Resolve disputes and enforce agreements',
          ]} />
          <P>You may delete your account at any time through the application. Upon account deletion:</P>
          <Ul items={[
            'Personal data is scheduled for deletion',
            'Data is permanently removed within a reasonable timeframe, generally within 30 days, unless retention is required for legal or operational purposes',
          ]} />
        </Section>

        <Divider />

        <Section number="6" title="Your Rights and Choices">
          <P>Depending on your location, you may have the right to:</P>
          <Ul items={[
            'Access the personal information we hold about you',
            'Request correction or deletion of your data',
            'Object to or restrict certain processing',
            'Withdraw consent where applicable',
          ]} />
          <P>You may exercise these rights by contacting us using the information below.</P>
        </Section>

        <Divider />

        <Section number="7" title="Children's Privacy">
          <P>The Services are not directed to children under the age of 13. We do not knowingly collect personal information from children under 13.</P>
          <P>If we become aware that such information has been collected, we will take steps to delete it promptly.</P>
        </Section>

        <Divider />

        <Section number="8" title="Security">
          <P>We implement reasonable administrative, technical, and organizational measures to protect your information. However, no system can be guaranteed to be 100% secure.</P>
        </Section>

        <Divider />

        <Section number="9" title="Data Use Restrictions">
          <P>ALIGN Sports does not use collected data for:</P>
          <Ul items={[
            'Third-party advertising',
            'Data brokering',
            'Cross-app or cross-site tracking',
          ]} />
          <P>Personal information is used solely for providing and improving the Services as described in this Privacy Policy.</P>
        </Section>

        <Divider />

        <Section number="10" title="Platform-Specific Disclosures (Apple & Google)">
          <SubSection label="Apple App Store Requirements">
            <P>In accordance with the Apple Inc. App Store Review Guidelines, we disclose that:</P>
            <Ul items={[
              'We collect and use personal data only as described in this Privacy Policy',
              'Data collected is limited to what is necessary to provide the Services',
              'Data used for notifications is limited to app functionality (e.g., game reminders, team updates, and payment tracking notifications)',
              'We do not use personal data for tracking across third-party apps or websites for advertising purposes',
            ]} />
            <P>Where required, we will obtain user permission before collecting or using data.</P>
          </SubSection>
          <SubSection label="Google Play Requirements">
            <P>In accordance with the Google Play User Data Policy, we confirm that:</P>
            <Ul items={[
              'Our data collection, use, and sharing practices are accurately disclosed in this Privacy Policy and in the Google Play "Data Safety" section',
              'We only collect data that is necessary for the functionality of the Services',
              'We do not sell personal data',
              'Users may request deletion of their data as described in this Privacy Policy',
            ]} />
          </SubSection>
          <SubSection label="Third-Party Services and SDKs">
            <P>The Services may rely on third-party providers (such as Stripe, Supabase, and platform providers like Apple and Google) to enable core functionality. These providers may process data solely on our behalf and in accordance with their own privacy policies and applicable law.</P>
          </SubSection>
        </Section>

        <Divider />

        <Section number="11" title="Changes to This Privacy Policy">
          <P>We may update this Privacy Policy from time to time. Changes will be effective when posted, and the &quot;Last Updated&quot; date will be revised accordingly.</P>
          <P>Your continued use of the Services after changes are posted constitutes your acceptance of the updated policy.</P>
        </Section>

        <Divider />

        <Section number="12" title="Contact Us">
          <P>If you have questions about this Privacy Policy or our data practices, you may contact us at:</P>
          <p className="text-sm text-slate-300">
            ALIGN Apps, LLC (operating as ALIGN Sports)
          </p>
          <p className="text-sm text-slate-300 mt-1">
            Email:{' '}
            <a href="mailto:info@alignapps.com" className="text-cyan-400 hover:opacity-80 transition-opacity">
              info@alignapps.com
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}
