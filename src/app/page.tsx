/*
 * Merkoll apex landing (/) — SERVER shell.
 *
 * Analysis (see chat): all-in-one, industry-configured business OS (storefront,
 * POS, bookings, inventory, CRM, B2B, payroll + real double-entry accounting)
 * for SMB owner-operators in Europe & Asia (Sweden-based). #1 benefit: sell
 * once → books/stock/loyalty update automatically. Dark + emerald brand.
 *
 * This server component owns SEO (metadata is inherited from layout.tsx; the
 * JSON-LD graph is rendered here) and delegates the interactive UI to the
 * client island <LandingClient/>. The marketing markup is server-rendered so
 * crawlers and AI agents read the full content without executing JS.
 */
import {
  SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_TAGLINE, SAME_AS,
  COMPANY_COUNTRY, AREA_SERVED, FAQ,
} from '@/lib/seo';
import LandingClient from './LandingClient';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      slogan: SITE_TAGLINE,
      description: SITE_DESCRIPTION,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/opengraph-image` },
      sameAs: SAME_AS,
      address: { '@type': 'PostalAddress', addressCountry: COMPANY_COUNTRY },
      areaServed: AREA_SERVED,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web, iOS, Android',
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      areaServed: AREA_SERVED,
      featureList: [
        'AI lead capture & scoring',
        'Automated sales follow-up workflows',
        'AI-drafted replies & nurture',
        'CRM & sales pipeline',
        'Storefront, POS & bookings',
        'Inventory management',
        'Double-entry accounting',
        'B2B portal',
        'HR & payroll',
        'E-signature',
      ],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        description: 'Free 14-day Pro trial — no credit card required',
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${SITE_URL}/#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE_URL}/#features` },
        { '@type': 'ListItem', position: 3, name: 'FAQ', item: `${SITE_URL}/#faq` },
      ],
    },
  ],
};

export default function RootPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingClient />
    </>
  );
}
