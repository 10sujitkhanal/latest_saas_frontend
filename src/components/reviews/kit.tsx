'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export * from '@/components/accounting/kit';

const TABS: Array<{ label: string; seg: string }> = [
  { label: 'Reviews', seg: '' },
  { label: 'Feedback', seg: 'feedback' },
];

export function ReviewsTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const baseHref = `/w/${wsId}/reviews`;
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {TABS.map((t) => {
        const href = t.seg ? `${baseHref}/${t.seg}` : baseHref;
        const active = t.seg ? pathname.startsWith(href) : pathname === baseHref;
        return (
          <Link key={t.label} href={href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            }`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
