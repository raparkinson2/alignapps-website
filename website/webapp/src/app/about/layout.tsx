import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'About ALIGN Sports — Team Management App for Recreational Sports' },
  description: 'Learn about ALIGN Sports — the all-in-one team management app built for coaches, captains, and recreational sports organizers. Schedules, rosters, payments, chat, and stats.',
  alternates: {
    canonical: 'https://alignapps.com/about',
  },
  openGraph: {
    title: 'About ALIGN Sports — Team Management App for Recreational Sports',
    description: 'The all-in-one team management app built for coaches, captains, and recreational sports organizers.',
    url: 'https://alignapps.com/about',
    type: 'website',
    siteName: 'ALIGN Sports',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ALIGNSportsApp',
    title: 'About ALIGN Sports — Team Management App for Recreational Sports',
    description: 'The all-in-one team management app built for coaches, captains, and recreational sports organizers.',
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://alignapps.com' },
            { '@type': 'ListItem', position: 2, name: 'About', item: 'https://alignapps.com/about' },
          ],
        }) }}
      />
      {children}
    </>
  );
}
