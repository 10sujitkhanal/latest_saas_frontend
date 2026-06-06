import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Served at /robots.txt. Index the marketing surfaces; keep app internals and
// per-tenant/authenticated areas out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/w/', '/organization', '/api/', '/auth/', '/sign/', '/documents'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
