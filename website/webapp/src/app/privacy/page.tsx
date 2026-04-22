import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy — ALIGN Sports Team Management App' },
  description: 'Read the ALIGN Sports privacy policy to understand how we collect, use, and protect your team data.',
  alternates: {
    canonical: 'https://alignapps.com/privacy',
  },
  openGraph: {
    title: 'Privacy Policy — ALIGN Sports',
    description: 'How ALIGN Sports collects, uses, and protects your team data.',
    url: 'https://alignapps.com/privacy',
    type: 'website',
    siteName: 'ALIGN Sports',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ALIGNSportsApp',
    title: 'Privacy Policy — ALIGN Sports',
    description: 'How ALIGN Sports collects, uses, and protects your team data.',
  },
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold text-slate-200 mb-2 mt-3">{children}</p>;
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alignapps.com' },
            { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: 'https://alignapps.com/privacy' },
          ],
        }) }}
      />
      <div className="max-w-2xl mx-auto px-6 py-20">
        <Link href="/" className="inline-flex items-center gap-2 text-cyan-400 text-sm font-medium mb-10 hover:opacity-80 transition-opacity">
          ← Back to home
        </Link>

        <h1 className="text-4xl font-black tracking-tight mb-1">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-8">Last Updated: April 2026</p>

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
          <SubHeading>Legal Basis for Processing (Applicable under GDPR)</SubHeading>
          <P>If you are located in the European Economic Area (EEA) or the United Kingdom (UK), our legal basis for collecting and using the personal data described above will depend on the personal data concerned and the specific context in which we collect it. We typically collect personal information under the following bases:</P>
          <Ul items={[
            <><strong className="text-slate-100">Consent:</strong> We may rely on your consent to process your personal data (e.g., for sending certain optional communications).</>,
            <><strong className="text-slate-100">Contractual Necessity:</strong> Processing is necessary to perform our contract with you (e.g., providing the core Services and managing your account).</>,
            <><strong className="text-slate-100">Legitimate Interests:</strong> Processing is necessary for our legitimate business interests, provided they do not override your fundamental rights (e.g., securing, improving, and analyzing our Services).</>,
            <><strong className="text-slate-100">Legal Obligation:</strong> We may process your data to comply with legal requirements.</>,
          ]} />
        </Section>

        <Divider />

        <Section number="3" title="How We Share Information">
          <P>We do not sell your personal information.</P>
          <P>We may share information in the following limited circumstances:</P>
          <Ul items={[
            <><strong className="text-slate-100">Service Providers:</strong> Stripe (payment processing), Supabase (data storage and real-time infrastructure), Apple Inc. (push notification delivery).</>,
            <><strong className="text-slate-100">Legal Requirements:</strong> If required to do so by law, regulation, or valid legal process.</>,
            <><strong className="text-slate-100">Business Transfers:</strong> In connection with a merger, sale, financing, or acquisition of all or part of our business.</>,
          ]} />
          <P>All third-party service providers are contractually obligated to safeguard your information and process data solely on our behalf.</P>
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
            'Data is permanently removed within a reasonable timeframe, generally within 30 days, unless retention is required for legal or operational purposes.',
          ]} />
        </Section>

        <Divider />

        <Section number="6" title="Your Rights and Choices">
          <P>Depending on your location, you may have the right to request access, correction, deletion, or restriction of your data. You may exercise these rights by contacting us using the information in Section 12.</P>
          <SubHeading>European Economic Area (EEA) and UK Rights (GDPR)</SubHeading>
          <P>If you reside in the EEA or UK, you possess the following rights regarding your personal data:</P>
          <Ul items={[
            <><strong className="text-slate-100">Right of Access:</strong> Request access to the data we hold about you.</>,
            <><strong className="text-slate-100">Right of Rectification:</strong> Request correction of inaccurate or incomplete data.</>,
            <><strong className="text-slate-100">Right to Erasure (Right to be Forgotten):</strong> Request deletion of your personal data under certain conditions.</>,
            <><strong className="text-slate-100">Right to Restrict Processing:</strong> Request restrictions on how we process your data.</>,
            <><strong className="text-slate-100">Right to Data Portability:</strong> Request a structured, commonly used electronic copy of your data for transfer to another controller.</>,
            <><strong className="text-slate-100">Right to Object:</strong> Object to our processing of your data, especially for direct marketing or when relying on legitimate interests.</>,
            <><strong className="text-slate-100">Right to Withdraw Consent:</strong> Withdraw previously granted consent at any time without affecting the lawfulness of processing based on consent prior to withdrawal.</>,
            <><strong className="text-slate-100">Right to Make a Complaint:</strong> You have the right to lodge a complaint with a supervisory authority regarding our data processing activities.</>,
          ]} />
          <P><strong className="text-slate-100">International Data Transfers:</strong> Your information may be transferred to, and maintained on, computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ (e.g., to the United States). By consenting to this Privacy Policy, you agree to such transfers. We ensure appropriate safeguards are implemented for such transfers.</P>
          <SubHeading>California Resident Privacy Rights (CCPA, CPRA, CalOPPA)</SubHeading>
          <P>If you are a California resident, the California Consumer Privacy Act (CCPA), as amended by the California Privacy Rights Act (CPRA), and the California Online Privacy Protection Act (CalOPPA) provide you with specific rights regarding your personal information:</P>
          <Ul items={[
            <><strong className="text-slate-100">Right to Know and Access:</strong> You may request details on the categories and specific pieces of personal information we have collected over the past 12 months, the sources of that information, the business purpose for collecting it, and the categories of third parties with whom we share it.</>,
            <><strong className="text-slate-100">Right to Delete:</strong> You have the right to request the deletion of your personal information, subject to certain legal exceptions.</>,
            <><strong className="text-slate-100">Right to Correct:</strong> You may request the correction of any inaccurate personal information we maintain.</>,
            <><strong className="text-slate-100">Right to Opt-Out of Sale/Sharing:</strong> We do not sell or &quot;share&quot; (as defined by the CCPA/CPRA for cross-context behavioral advertising) your personal information.</>,
            <><strong className="text-slate-100">Right to Limit Use of Sensitive Personal Information:</strong> We only collect and use sensitive information (e.g., account logins) as strictly necessary to perform our core Services.</>,
            <><strong className="text-slate-100">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</>,
            <><strong className="text-slate-100">CalOPPA &quot;Do Not Track&quot; Signals:</strong> Currently, our Services do not respond to &quot;Do Not Track&quot; (DNT) signals. Our website and app do not track users across time and third-party websites to provide targeted advertising.</>,
          ]} />
          <P>
            To exercise your rights under GDPR, CCPA/CPRA, or CalOPPA, please email us at{' '}
            <a href="mailto:info@alignapps.com" className="text-cyan-400 hover:opacity-80 transition-opacity">
              info@alignapps.com
            </a>{' '}
            with the subject line &quot;Privacy Request.&quot; We will verify your identity before processing your request.
          </P>
        </Section>

        <Divider />

        <Section number="7" title="Children's Privacy">
          <P>The Services are not directed to children under the age of 13 (or under 16 in the EEA/UK where applicable law so requires). We do not knowingly collect personal information from children under 13 (or 16).</P>
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
              'We collect and use personal data only as described in this Privacy Policy.',
              'Data collected is limited to what is necessary to provide the Services.',
              'Data used for notifications is limited to app functionality (e.g., game reminders, team updates, and payment tracking notifications).',
              'We do not use personal data for tracking across third-party apps or websites for advertising purposes.',
              'Where required, we will obtain user permission before collecting or using data.',
            ]} />
          </SubSection>
          <SubSection label="Google Play Requirements">
            <P>In accordance with the Google Play User Data Policy, we confirm that:</P>
            <Ul items={[
              'Our data collection, use, and sharing practices are accurately disclosed in this Privacy Policy and in the Google Play "Data Safety" section.',
              'We only collect data that is necessary for the functionality of the Services.',
              'We do not sell personal data.',
              'Users may request deletion of their data as described in this Privacy Policy.',
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
