import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Served at /sitemap.xml. Public marketing surfaces only — app internals
// (dashboard, workspace, org panels) are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  });

  return [
    page('/', 1.0, 'weekly'),
    page('/payroll', 0.8, 'weekly'),
    page('/signup', 0.8, 'monthly'),
    // Placeholders for future growth — keep in the sitemap so they index fast
    // once the pages ship.
    page('/features', 0.6, 'monthly'),
    page('/pricing', 0.6, 'monthly'),
    page('/blog', 0.5, 'weekly'),
    page('/contact', 0.4, 'monthly'),
    page('/privacy', 0.3, 'yearly'),
    page('/terms', 0.3, 'yearly'),
  ];
}
