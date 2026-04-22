import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://alignapps.com'),
  title: {
    default: 'ALIGN Sports — Free Sports Team Management App for Coaches & Captains',
    template: '%s | ALIGN Sports',
  },
  description: 'Free team management app for recreational and youth sports — schedules, rosters, lineups, stats, payments, and team chat in one place. Supports hockey, baseball, softball, basketball, soccer, and lacrosse.',
  keywords: [
    'sports team management app',
    'free team management app',
    'team management software',
    'youth sports app',
    'recreational sports app',
    'recreational league app',
    'hockey team app',
    'youth hockey app',
    'soccer team app',
    'basketball team app',
    'baseball team app',
    'softball team app',
    'lacrosse team app',
    'team schedule app',
    'roster management app',
    'team payment tracking',
    'sports organizer app',
    'coach app',
    'team captain app',
    'team chat app',
    'team stats tracker',
  ],
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'ALIGN Sports',
    title: 'ALIGN Sports — Team Management App for Coaches & Captains',
    description: 'The free all-in-one team management app for recreational and youth sports. Schedules, rosters, lineups, payments, chat, and stats — in one place.',
    url: 'https://alignapps.com',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ALIGNSportsApp',
    creator: '@ALIGNSportsApp',
    title: 'ALIGN Sports — Team Management App for Coaches & Captains',
    description: 'The free all-in-one team management app for recreational and youth sports. Schedules, rosters, lineups, payments, chat, and stats — in one place.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'ALIGN Sports',
            legalName: 'ALIGN Apps, LLC',
            alternateName: ['ALIGN', 'ALIGN Apps', 'Align Sports'],
            url: 'https://alignapps.com',
            logo: 'https://alignapps.com/align-logo.png',
            email: 'info@alignapps.com',
            description: 'ALIGN Sports builds free team management software for recreational and youth sports coaches, captains, and organizers.',
            sameAs: [
              'https://apps.apple.com/us/app/align-sports/id6743450598',
              'https://www.instagram.com/alignsports.app/',
              'https://x.com/ALIGNSportsApp',
            ],
          }) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'MobileApplication',
            name: 'ALIGN Sports',
            operatingSystem: 'iOS, Android',
            applicationCategory: 'SportsApplication',
            description: 'Free team management app for recreational and youth sports. Manage schedules, rosters, lineups, stats, payments, and team chat in one place.',
            url: 'https://alignapps.com',
            downloadUrl: 'https://apps.apple.com/us/app/align-sports/id6743450598',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: 'Schedule management, RSVP tracking, Roster management, Team chat with GIF support, Stats tracking, Payment tracking, Sport-specific lineups, Team photo gallery, Push notifications, Multiple team support',
          }) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'ALIGN Sports',
            url: 'https://alignapps.com',
          }) }}
        />
      </head>
      <body className="bg-bg-base text-slate-100 min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
