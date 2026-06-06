import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo';

// Stable social card at /og — referenced explicitly by OG, Twitter and JSON-LD.
export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px',
          background:
            'radial-gradient(900px 520px at 70% -10%, rgba(16,185,129,0.22), transparent 60%), #0B1120',
          color: '#e2e8f0',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(52,211,153,0.4)',
              color: '#6ee7b7', fontSize: 30, fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: '#ffffff' }}>{SITE_NAME}</div>
          <div style={{ marginLeft: 18, fontSize: 20, color: '#6ee7b7' }}>AI sales engine + business OS</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Win customers with AI.
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, color: '#34d399', letterSpacing: '-0.02em' }}>
            Run the business with one OS.
          </div>
          <div style={{ fontSize: 27, color: '#94a3b8', maxWidth: 960, marginTop: 8 }}>
            AI captures, scores & closes your leads — then runs accounting, inventory, bookings & payroll.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 22, color: '#64748b' }}>
          <div>{SITE_TAGLINE}</div>
          <div>Free 14-day trial · Built in Sweden</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
