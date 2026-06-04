// The agency/partner portal is a SEPARATE app (latest_agency). The org landing
// only LINKS to it — registration, login and the agency dashboard all live there.
// Override per environment; default targets the agency dev host.
export const AGENCY_PORTAL_URL =
  process.env.NEXT_PUBLIC_AGENCY_PORTAL_URL || 'http://agency.localhost:3000';

// Where "Become a partner" sends people — the agency app's own signup.
export const AGENCY_SIGNUP_URL =
  process.env.NEXT_PUBLIC_AGENCY_SIGNUP_URL || `${AGENCY_PORTAL_URL}/signup`;
