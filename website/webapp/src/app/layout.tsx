import type { Metadata } from 'next';
import './globals.css';
import StoreHydration from './StoreHydration';

export const metadata: Metadata = {
  metadataBase: new URL('https://alignapps.com'),
  title: {
    default: 'ALIGN Sports — Team Management App',
    template: '%s | ALIGN Sports',
  },
  description: 'Team management for recreational and youth sports — schedules, rosters, lineups, stats, payments, and chat in one app.',
  keywords: ['sports team management', 'team app', 'youth sports', 'recreational sports', 'hockey team app', 'soccer team app', 'basketball team app', 'team schedule', 'roster management', 'team payments'],
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
      </head>
      <body className="bg-bg-base text-slate-100 min-h-screen antialiased" suppressHydrationWarning>
        <StoreHydration />
        {children}
      </body>
    </html>
  );
}
