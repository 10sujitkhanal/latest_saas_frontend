import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
