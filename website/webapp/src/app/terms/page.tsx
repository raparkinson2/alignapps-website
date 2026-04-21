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

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-slate-200 mb-2 mt-3">{children}</p>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-300 leading-relaxed mb-2">{children}</p>;
}

function Callout({ children }: { children: React.ReactNode }) {
  return <p className="text-sm italic text-slate-300 leading-relaxed mb-3">{children}</p>;
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
        <p className="text-slate-400 text-sm mb-8">Last Updated: April 2026</p>

        <P>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the ALIGN Sports mobile application, website located at www.alignapps.com, and related services (collectively, the &quot;Services&quot;) provided by ALIGN Apps, LLC.
        </P>
        <P>By creating an account or using the Services, you agree to be bound by these Terms. If you do not agree, you may not use the Services.</P>

        <Divider />

        <Section number="1" title="Company Information">
          <P>ALIGN Apps, LLC (&quot;ALIGN Apps,&quot; operating as &quot;ALIGN Sports&quot;) is a limited liability company that provides a platform for managing sports teams, including scheduling, communication, and payment tracking tools. References to &quot;ALIGN Sports,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot; in these Terms refer to ALIGN Apps, LLC.</P>
        </Section>

        <Divider />

        <Section number="2" title="Eligibility">
          <P>You must be at least 13 years old (or the minimum legal age in your country to use our Services) to use the Services. If you are under the age of majority in your jurisdiction, you may use the Services only with the involvement and consent of a parent or legal guardian who agrees to be bound by these Terms.</P>
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

        <Section number="4" title="User Content and Copyright (DMCA Policy)">
          <P>You may create, upload, or share content including team rosters, player information, messages, and photos. You retain ownership of your content.</P>
          <P>By using the Services, you grant ALIGN Sports a limited, non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display your content solely for the purpose of operating and improving the Services.</P>
          <P>You agree that your content will not:</P>
          <Ul items={[
            'Violate any law or regulation',
            'Infringe intellectual property or privacy rights',
            'Be harmful, abusive, or inappropriate',
          ]} />
          <SubHeading>Copyright Infringement (DMCA)</SubHeading>
          <P>We respect intellectual property rights. If you believe that your copyright has been infringed by any content on our Services, please submit a notice to our registered copyright agent at the contact information provided below. Your notice must comply with the requirements of the Digital Millennium Copyright Act (17 U.S.C. §512). We reserve the right to remove or restrict content that violates these Terms or infringes on copyrights, and to terminate repeat infringers.</P>
        </Section>

        <Divider />

        <Section number="5" title="Team Administration and User Interactions">
          <P>Team administrators may control:</P>
          <Ul items={[
            'Membership and access',
            'Roles and permissions',
            'Team settings and visibility',
          ]} />
          <P>ALIGN Sports is not responsible for decisions made by team administrators or interactions and disputes between users.</P>
        </Section>

        <Divider />

        <Section number="6" title="Payments, Subscriptions, and Financial Features">
          <P>ALIGN Sports provides tools to track and organize payments and may offer premium subscription plans.</P>
          <Ul items={[
            <><strong className="text-slate-100">Payment Processing:</strong> We do not process payments directly. Payments are facilitated through third-party providers such as Stripe. You acknowledge that we do not store payment credentials and are not a party to financial transactions between users.</>,
            <><strong className="text-slate-100">Subscriptions &amp; Auto-Renewal:</strong> If you purchase a premium subscription, it will automatically renew at the end of the subscription period unless canceled prior to the renewal date. You may cancel your subscription via the platform or app store where it was purchased.</>,
            <><strong className="text-slate-100">Refunds:</strong> All fees and charges are non-refundable, and there are no refunds or credits for partially used periods, except as required by applicable law (such as the EU consumer right of withdrawal, where applicable, which you expressly waive upon immediate use of digital content).</>,
            <><strong className="text-slate-100">Disputes:</strong> We are not responsible for payment disputes, chargebacks, or refunds between users or between you and the payment processor.</>,
          ]} />
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
          <P>You may not:</P>
          <Ul items={[
            'Copy, modify, or distribute the Services',
            'Reverse engineer or attempt to extract source code',
            'Use ALIGN Sports branding without permission',
          ]} />
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

        <Section number="14" title="Dispute Resolution and Arbitration">
          <Callout>Please read this section carefully. It affects your legal rights, including your right to file a lawsuit in court.</Callout>
          <Ul items={[
            <><strong className="text-slate-100">Arbitration Agreement:</strong> Any dispute, claim, or controversy arising out of or relating to these Terms or the breach, termination, enforcement, interpretation, or validity thereof, shall be determined by binding arbitration rather than in court, except that you may assert claims in small claims court if your claims qualify.</>,
            <><strong className="text-slate-100">Class Action Waiver:</strong> You and ALIGN Sports agree that each may bring claims against the other only in your or its individual capacity, and not as a plaintiff or class member in any purported class or representative proceeding.</>,
          ]} />
          <P><em>(Note: If you reside in the European Union or other jurisdictions where this arbitration provision is prohibited by law, this arbitration agreement may not apply to you, and you may bring a claim in the courts of your country of residence.)</em></P>
        </Section>

        <Divider />

        <Section number="15" title="Notice to California Residents">
          <P>Under California Civil Code Section 1789.3, California users of an electronic commercial service are entitled to the following specific consumer rights notice: The Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs may be contacted in writing at 1625 N. Market Blvd., Suite S-202, Sacramento, California 95834, or by telephone at (800) 952-5210.</P>
        </Section>

        <Divider />

        <Section number="16" title="App Store Terms">
          <Ul items={[
            <><strong className="text-slate-100">Apple App Store:</strong> Apple Inc. is not responsible for the Services, has no obligation to provide maintenance or support, and any claims related to the app must be directed to ALIGN Sports. You agree to comply with applicable third-party terms of agreement when using the App.</>,
            <><strong className="text-slate-100">Google Play:</strong> Google is not responsible for the Services and has no obligation to provide maintenance or support.</>,
          ]} />
        </Section>

        <Divider />

        <Section number="17" title="Changes to These Terms">
          <P>We may update these Terms from time to time. Changes will be effective when posted. Continued use of the Services constitutes acceptance of the updated Terms.</P>
        </Section>

        <Divider />

        <Section number="18" title="Governing Law">
          <P>These Terms shall be governed by and construed in accordance with the laws of the State of Ohio, without regard to conflict of law principles.</P>
        </Section>

        <Divider />

        <Section number="19" title="Contact Information">
          <P>If you have questions about these Terms, you may contact us at:</P>
          <p className="text-sm text-slate-300">ALIGN Apps, LLC (operating as ALIGN Sports)</p>
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
