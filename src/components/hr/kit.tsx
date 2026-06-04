'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Re-export the shared accounting UI kit so HR pages use the same components.
export * from '@/components/accounting/kit';

const TABS: Array<{ label: string; seg: string }> = [
  { label: 'Employees', seg: 'employees' },
  { label: 'Departments', seg: 'departments' },
  { label: 'Attendance', seg: 'attendance' },
  { label: 'Leave', seg: 'leave' },
];

export function HRTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const baseHref = `/w/${wsId}/hr`;
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {TABS.map((t) => {
        const href = `${baseHref}/${t.seg}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={t.label}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
