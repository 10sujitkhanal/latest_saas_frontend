import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Hosts we treat as the platform apex (no tenant) — the Merkoll marketing
// landing lives here. Everything <sub>.<apex> is a tenant. Override the apex
// list with NEXT_PUBLIC_APEX_DOMAIN (comma-separated) if needed.
const APEXES = (process.env.NEXT_PUBLIC_APEX_DOMAIN
  ? process.env.NEXT_PUBLIC_APEX_DOMAIN.split(',').map((s) => s.trim()).filter(Boolean)
  : ['localhost', 'morefungi.com']);

function tenantSubdomain(host: string): string {
  const h = host.split(':')[0].toLowerCase(); // strip port
  for (const apex of APEXES) {
    if (h.endsWith(`.${apex}`)) {
      const sub = h.slice(0, -(apex.length + 1));
      // ignore reserved/non-tenant labels
      if (sub && !['www', 'api', 'agency', 'store', 'deals', 'app'].includes(sub)) return sub;
    }
  }
  return '';
}

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  // Block agency portal hosts — organizations must use their tenant subdomain.
  // The agency/partner portal is a SEPARATE app (latest_agency) that serves
  // ``agency.<domain>`` itself; this org panel must never answer for it.
  if (host.startsWith('agency.')) {
    return new NextResponse(
      'Forbidden: This portal is for organizations, not agencies.',
      { status: 403 },
    );
  }

  // A client subdomain's ROOT is the business's own front door — its storefront,
  // NOT the Merkoll marketing landing. Rewrite only the bare "/" so every panel
  // route (/auth/login, /w/*, /dashboard, /sign/*, /store/*) still works.
  const sub = tenantSubdomain(host);
  if (sub && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/store/${sub}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
