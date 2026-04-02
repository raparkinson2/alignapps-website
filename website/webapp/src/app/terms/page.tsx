import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Terms of Service — ALIGN Sports Team Management App' },
  description: 'Read the ALIGN Sports terms of service for using our team management platform.',
};

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-slate-100 mb-3">{number}. {title}</h2>
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-base text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium mb-10 hover:opacity-80 transition-opacity">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-black tracking-tight mb-1">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: March 2026</p>

        <P>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the ALIGN Sports mobile application, website located at www.alignapps.com, and related services (collectively, the &quot;Services&quot;).
        </P>
        <P>By creating an account or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use the Services.</P>

        <Divider />

        <Section number="1" title="Company Information">
          <P>ALIGN Sports (&quot;ALIGN Sports,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) provides a platform for managing sports teams, including scheduling, communication, and payment tracking tools.</P>
        </Section>

        <Divider />

        <Section number="2" title="Eligibility">
          <P>You must be at least 13 years old to use the Services.</P>
          <P>If you are under the age of majority in your jurisdiction, you may use the Services only with the involvement of a parent or legal guardian.</P>
        </Section>

        <Divider />

        <Section number="3" title="Account Registration and Security">
          <P>To access certain features, you must create an account. You agree to:</P>
          <Ul items={[
            'Provide accurate, current, and complete information',
            'Maintain the confidentiality of your login credentials',
            'Be responsible for all activities under your account',
          ]} />
          <P>You must notify us immediately of any unauthorized use of your account.</P>
        </Section>

        <Divider />

        <Section number="4" title="User Content">
          <P>You may create, upload, or share content including team rosters, player information, messages, and photos. You retain ownership of your content.</P>
          <P>By using the Services, you grant ALIGN Sports a limited, non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display your content solely for the purpose of operating and improving the Services.</P>
          <P>You agree that your content will not:</P>
          <Ul items={[
            'Violate any law or regulation',
            'Infringe intellectual property or privacy rights',
            'Be harmful, abusive, or inappropriate',
          ]} />
          <P>We reserve the right to remove or restrict content that violates these Terms.</P>
        </Section>

        <Divider />

        <Section number="5" title="Team Administration and User Interactions">
          <P>Team administrators may control membership and access, roles and permissions, and team settings and visibility.</P>
          <P>ALIGN Sports is not responsible for decisions made by team administrators or interactions and disputes between users.</P>
        </Section>

        <Divider />

        <Section number="6" title="Payments and Financial Features">
          <P>ALIGN Sports provides tools to track and organize payments but does not process payments directly. Payments may be facilitated through third-party providers such as Stripe.</P>
          <P>You acknowledge that ALIGN Sports is not a party to any financial transactions between users, does not control or store payment credentials, and is not responsible for payment disputes, chargebacks, or refunds.</P>
        </Section>

        <Divider />

        <Section number="7" title="Acceptable Use">
          <P>You agree not to:</P>
          <Ul items={[
            'Use the Services for unlawful or fraudulent purposes',
            'Harass, threaten, or harm other users',
            'Upload malicious code or attempt to disrupt the Services',
            'Attempt unauthorized access to systems or data',
            'Use the Services for unauthorized commercial purposes',
          ]} />
        </Section>

        <Divider />

        <Section number="8" title="Third-Party Services">
          <P>The Services may rely on or integrate with third-party providers, including Stripe (payment processing), Supabase (data infrastructure), Apple Inc., and Google.</P>
          <P>We are not responsible for the availability, accuracy, or practices of third-party services.</P>
        </Section>

        <Divider />

        <Section number="9" title="Intellectual Property">
          <P>All rights, title, and interest in and to the Services (excluding user content) are owned by ALIGN Sports.</P>
          <P>You may not copy, modify, or distribute the Services; reverse engineer or attempt to extract source code; or use ALIGN Sports branding without permission.</P>
        </Section>

        <Divider />

        <Section number="10" title="Termination">
          <P>We may suspend or terminate your access to the Services at any time, with or without notice, if you violate these Terms, if required by law, or if necessary to protect the Services or other users.</P>
          <P>You may delete your account at any time through the app.</P>
        </Section>

        <Divider />

        <Section number="11" title="Disclaimers">
          <P>The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the fullest extent permitted by law, ALIGN Sports disclaims all warranties, express or implied, including merchantability, fitness for a particular purpose, and non-infringement.</P>
          <P>We do not guarantee that the Services will be uninterrupted, error-free, or that data will be accurate or secure at all times.</P>
        </Section>

        <Divider />

        <Section number="12" title="Limitation of Liability">
          <P>To the maximum extent permitted by law, ALIGN Sports shall not be liable for indirect, incidental, special, or consequential damages, loss of data, profits, or business opportunities, or disputes between users or teams.</P>
          <P>In no event shall ALIGN Sports&apos; total liability exceed the amount you paid (if any) to use the Services in the 12 months preceding the claim.</P>
        </Section>

        <Divider />

        <Section number="13" title="Indemnification">
          <P>You agree to defend, indemnify, and hold harmless ALIGN Sports from any claims, damages, losses, or expenses arising from your use of the Services, your content, or your violation of these Terms.</P>
        </Section>

        <Divider />

        <Section number="14" title="App Store Terms">
          <P><strong className="text-slate-100">Apple App Store:</strong> Apple Inc. is not responsible for the Services, has no obligation to provide maintenance or support, and any claims related to the app must be directed to ALIGN Sports.</P>
          <P><strong className="text-slate-100">Google Play:</strong> Google is not responsible for the Services and has no obligation to provide maintenance or support.</P>
        </Section>

        <Divider />

        <Section number="15" title="Changes to These Terms">
          <P>We may update these Terms from time to time. Changes will be effective when posted. Continued use of the Services constitutes acceptance of the updated Terms.</P>
        </Section>

        <Divider />

        <Section number="16" title="Governing Law">
          <P>These Terms shall be governed by and construed in accordance with the laws of the State of Ohio, without regard to conflict of law principles.</P>
        </Section>

        <Divider />

        <Section number="17" title="Contact Information">
          <P>
            If you have questions about these Terms, you may contact us at:{' '}
            <a href="mailto:info@alignapps.com" className="text-cyan-400 hover:opacity-80 transition-opacity">
              info@alignapps.com
            </a>
          </P>
        </Section>
      </div>
    </div>
  );
}
