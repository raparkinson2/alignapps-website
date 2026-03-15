import type { Metadata } from 'next';
import './globals.css';
import StoreHydration from './StoreHydration';

export const metadata: Metadata = {
  title: 'ALIGN Sports',
  description: 'Team management for recreational sports',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
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
