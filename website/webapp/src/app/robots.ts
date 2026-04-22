import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/app/', '/login', '/no-account', '/join/'],
      },
    ],
    sitemap: 'https://alignapps.com/sitemap.xml',
  };
}
