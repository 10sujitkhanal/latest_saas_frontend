// The agency/partner portal is a SEPARATE app (latest_agency). The org landing
// only LINKS to it — registration, login and the agency dashboard all live there.
// Override per environment; default targets the agency dev host.
export const AGENCY_PORTAL_URL =
  process.env.NEXT_PUBLIC_AGENCY_PORTAL_URL || 'http://agency.localhost:3000';

// Where "Become a partner" sends people — the agency app's own signup. The
// agency app serves this at /auth/signup (NOT /signup), so the fallback must
// match that path. Override with NEXT_PUBLIC_AGENCY_SIGNUP_URL per environment
// (e.g. https://agency.morefungi.com/auth/signup in production).
export const AGENCY_SIGNUP_URL =
  process.env.NEXT_PUBLIC_AGENCY_SIGNUP_URL || `${AGENCY_PORTAL_URL}/auth/signup`;
