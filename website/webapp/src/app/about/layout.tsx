import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'About ALIGN Sports — Team Management App for Recreational Sports' },
  description: 'Learn about ALIGN Sports — the all-in-one team management app built for coaches, captains, and recreational sports organizers. Schedules, rosters, payments, chat, and stats.',
  openGraph: {
    title: 'About ALIGN Sports — Team Management App for Recreational Sports',
    description: 'The all-in-one team management app built for coaches, captains, and recreational sports organizers.',
    url: 'https://alignapps.com/about',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
