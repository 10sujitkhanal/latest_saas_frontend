// Single source of truth for marketing SEO — reused by layout metadata,
// page metadata, JSON-LD structured data, sitemap.ts and robots.ts so the
// signals never drift apart.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://morefungi.com').replace(/\/+$/, '');
export const SITE_NAME = 'Merkoll';
export const SITE_LEGAL_NAME = 'Merkoll';

// Company is Sweden-based, serving Europe & Asia.
export const COMPANY_COUNTRY = 'SE';
export const AREA_SERVED = ['Europe', 'Asia'];

export const SITE_TAGLINE = 'Win customers with AI. Run the business with one OS.';
export const SITE_TITLE = 'Merkoll — AI sales engine + all-in-one business OS';
export const SITE_DESCRIPTION =
  'Merkoll captures, scores and closes your leads automatically with AI — then runs the whole business: accounting, inventory, bookings, B2B and payroll in one workspace. Any industry, any size, across Europe & Asia. Free 14-day trial.';

export const SITE_KEYWORDS = [
  'AI CRM',
  'AI sales automation',
  'AI lead generation',
  'AI lead scoring software',
  'sales pipeline automation',
  'automated lead follow-up',
  'business operating system',
  'all-in-one business software',
  'POS with accounting',
  'restaurant management software',
  'hotel management software',
  'retail inventory and accounting',
  'salon booking and POS',
  'double-entry accounting software',
  'business management platform',
  'multi-location business software',
  'enterprise business operating system',
  'multi-business management',
  'business software Europe',
  'business software Asia',
];

// Public social profiles (sameAs hints for Organization schema + rel="me").
export const SOCIAL_LINKS = {
  x: 'https://x.com/merkoll',
  linkedin: 'https://www.linkedin.com/company/merkoll',
  facebook: 'https://www.facebook.com/merkoll',
};
export const SAME_AS = Object.values(SOCIAL_LINKS);

export const OG_IMAGE = `${SITE_URL}/og`;

// FAQ — reused by the on-page FAQ accordion AND the FAQPage JSON-LD.
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Merkoll?',
    a: 'Merkoll is an AI-native business operating system. Its AI sales engine captures, scores and follows up your leads automatically to win you more customers — and the same workspace then runs the whole business: orders, inventory, bookings, CRM, B2B and real double-entry accounting, configured to your industry.',
  },
  {
    q: 'How does Merkoll’s AI win me more customers?',
    a: 'Merkoll pulls every lead — web forms, your storefront, WhatsApp, email and calls — into one inbox, scores each one on intent and fit, and runs no-code workflows that follow up, remind and nurture 24/7 so nothing slips through. The AI even drafts on-brand replies, and won deals convert straight into orders and invoices.',
  },
  {
    q: 'Which industries does Merkoll support?',
    a: 'Merkoll ships pre-configured for restaurants & cafés, hotels & trekking, retail & wholesale, and salons & wellness — with 15+ shared modules (HR, payroll, expenses, e-signature, loyalty, analytics) you can switch on for any vertical.',
  },
  {
    q: 'Is Merkoll only for small businesses?',
    a: 'No — Merkoll scales from a single outlet to large, multi-location operators and groups. Each business runs as its own workspace, and the owner dashboard is a multi-business command center that rolls up revenue, stock and performance across every location, with role-based access for large teams. You start small and grow on the same platform — no migration when you scale.',
  },
  {
    q: 'Do I need separate accounting software?',
    a: 'No. Merkoll has a real double-entry ledger built in. When you make a sale, the journal entry is posted, stock is drawn down and revenue is recorded automatically — so your books are always tax-ready without exporting to another tool.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes — start a free 14-day Pro trial with no credit card required. You can import your menu, rooms or SKUs and go live the same day.',
  },
  {
    q: 'Can I migrate my existing data?',
    a: 'Yes. You can import your product list, menu, rooms or SKUs during setup, and your contacts and history come along so you start with a working system, not a blank slate.',
  },
  {
    q: 'Is my business data secure?',
    a: 'Each business runs in its own isolated tenant with role-based access, so staff only see what they should and your financials stay private. Confidential documents and HR records are hidden from non-admin staff by default.',
  },
];

// Internal links surfaced in a "Resources" block (also good for crawl depth).
export const RESOURCE_LINKS: { href: string; label: string; desc: string }[] = [
  { href: '/payroll', label: 'Payroll & HR (Meroll)', desc: 'Salaries, attendance and people, done right.' },
  { href: '/signup', label: 'Start a business', desc: 'Create your workspace in minutes.' },
  { href: '/auth/login', label: 'Sign in', desc: 'Access your Merkoll workspace.' },
];
