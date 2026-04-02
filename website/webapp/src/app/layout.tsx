import type { Metadata } from 'next';
import './globals.css';
import StoreHydration from './StoreHydration';

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
    title: 'ALIGN Sports — Team Management App',
    description: 'Schedules, rosters, lineups, stats, payments, and chat — everything your team needs in one app.',
    url: 'https://alignapps.com',
    images: [{ url: '/align-logo.png', width: 512, height: 512, alt: 'ALIGN Sports' }],
  },
  twitter: {
    card: 'summary',
    title: 'ALIGN Sports — Team Management App',
    description: 'Schedules, rosters, lineups, stats, payments, and chat — everything your team needs in one app.',
    images: ['/align-logo.png'],
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
            url: 'https://alignapps.com',
            logo: 'https://alignapps.com/align-logo.png',
            email: 'rob@alignapps.com',
            description: 'ALIGN Sports builds free team management software for recreational and youth sports coaches, captains, and organizers.',
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
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: 'Schedule management, RSVP tracking, Roster management, Team chat with GIF support, Stats tracking, Payment tracking, Sport-specific lineups, Team photo gallery, Push notifications, Multiple team support',
          }) }}
        />
      </head>
      <body className="bg-bg-base text-slate-100 min-h-screen antialiased" suppressHydrationWarning>
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
