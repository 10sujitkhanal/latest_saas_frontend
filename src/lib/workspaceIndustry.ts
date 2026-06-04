/**
 * Industry-aware presentation for the workspace home. Turns the workspace's
 * capabilities (returned by workspaceContext) into a header look + a set of
 * quick actions, so a Restaurant workspace opens into orders/tables and a
 * Wellness one into products/memberships — instead of a generic CRM home.
 */

export interface WsCapabilities {
  industry: string;
  booking_type: string; // table | room | appointment | slot | inquiry | none
  show_cart: boolean;
  order_types: string[];
  membership_enabled: boolean;
  events_enabled: boolean;
  admin_tabs: string[];
}

export interface QuickAction {
  label: string;
  path: string;       // appended to /w/<id>
  icon: string;       // lucide icon name
  code?: string;      // permission code to gate on (omit = always show)
}

export interface IndustryProfile {
  label: string;       // e.g. "Restaurant"
  tagline: string;     // one-liner under the title
  icon: string;        // lucide icon name for the header
  accent: string;      // tailwind gradient classes for the header band
  quickActions: QuickAction[];
  /** When true, the CRM lead pipeline stays the headline; otherwise it's demoted. */
  leadsPrimary: boolean;
}

// Per-industry header dressing. Falls back to a generic look for anything else.
const META: Record<string, { icon: string; tagline: string; accent: string }> = {
  'Restaurant': { icon: 'UtensilsCrossed', tagline: 'Orders, tables & delivery', accent: 'from-orange-500/15 to-amber-500/5' },
  'Fika / Coffee': { icon: 'Coffee', tagline: 'Counter orders & preorders', accent: 'from-amber-500/15 to-orange-500/5' },
  'Craft Beer / Brewery': { icon: 'Beer', tagline: 'Taproom, orders & events', accent: 'from-amber-500/15 to-yellow-500/5' },
  'Hotel': { icon: 'BedDouble', tagline: 'Rooms & reservations', accent: 'from-sky-500/15 to-blue-500/5' },
  'Salon / Spa': { icon: 'Scissors', tagline: 'Appointments & memberships', accent: 'from-pink-500/15 to-rose-500/5' },
  'Trekking / Travel': { icon: 'Mountain', tagline: 'Trips & bookings', accent: 'from-teal-500/15 to-emerald-500/5' },
  'Clothing': { icon: 'Shirt', tagline: 'Catalog, orders & delivery', accent: 'from-violet-500/15 to-purple-500/5' },
  'Grocery': { icon: 'ShoppingBasket', tagline: 'Catalog, orders & delivery', accent: 'from-green-500/15 to-emerald-500/5' },
  'Events': { icon: 'Ticket', tagline: 'Tickets & guest lists', accent: 'from-fuchsia-500/15 to-pink-500/5' },
  'Local Services': { icon: 'Wrench', tagline: 'Service requests & jobs', accent: 'from-cyan-500/15 to-sky-500/5' },
  'Cleaning': { icon: 'Sparkles', tagline: 'Bookings & recurring jobs', accent: 'from-cyan-500/15 to-teal-500/5' },
  'General Retail': { icon: 'Store', tagline: 'Catalog, orders & delivery', accent: 'from-indigo-500/15 to-blue-500/5' },
  'Supplier / Wholesale': { icon: 'Warehouse', tagline: 'Trade orders & catalog', accent: 'from-slate-500/15 to-gray-500/5' },
  'Wellness / Supplements': { icon: 'HeartPulse', tagline: 'Products, orders & memberships', accent: 'from-emerald-500/15 to-green-500/5' },
  'Natural Beauty / Skincare': { icon: 'Flower2', tagline: 'Products, orders & memberships', accent: 'from-rose-500/15 to-pink-500/5' },
};

const DEFAULT_META = { icon: 'Building2', tagline: 'Your workspace', accent: 'from-emerald-500/15 to-cyan-500/5' };

export function industryProfile(caps?: WsCapabilities | null, fallbackIndustry?: string | null): IndustryProfile {
  const industry = caps?.industry || fallbackIndustry || 'Workspace';
  const meta = META[industry] ?? DEFAULT_META;

  const commerce = !!caps && (caps.show_cart || (caps.order_types?.length ?? 0) > 0);
  const bookingType = caps?.booking_type ?? 'none';
  const bookings = bookingType !== 'none';

  const quickActions: QuickAction[] = [];
  if (commerce) {
    quickActions.push({ label: 'New order', path: '/orders', icon: 'ShoppingCart', code: 'orders.create' });
    quickActions.push({ label: 'Products', path: '/inventory', icon: 'Package', code: 'inventory.view' });
  }
  if (bookings) {
    if (bookingType === 'appointment') {
      quickActions.push({ label: 'New appointment', path: '/appointments', icon: 'CalendarCheck', code: 'appointments.add' });
    } else {
      quickActions.push({ label: 'Bookings', path: '/scheduling', icon: 'CalendarCheck', code: 'scheduling.view' });
    }
  }
  if (caps?.membership_enabled) {
    quickActions.push({ label: 'Memberships', path: '/loyalty', icon: 'Sparkles', code: 'loyalty.view' });
  }
  // Every business bills — show invoices (gated on the read code so both
  // accountants and front-desk-with-view see it).
  quickActions.push({ label: 'Invoices', path: '/accounting/invoices', icon: 'FileText', code: 'accounting.view' });

  return {
    label: industry,
    tagline: meta.tagline,
    icon: meta.icon,
    accent: meta.accent,
    quickActions,
    leadsPrimary: !commerce && !bookings, // pure service/CRM verticals keep leads front-and-centre
  };
}
