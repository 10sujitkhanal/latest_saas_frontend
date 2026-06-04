'use client';

/**
 * Inventory module UI kit. Re-uses the generic presentational helpers from the
 * accounting kit (Card/Table/Modal/inputs/hooks — they aren't accounting-specific)
 * and adds the inventory sub-navigation.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export {
  numberValue, money, toneClass, Pill, PageHeader, PrimaryButton, AddButton,
  ErrorBox, Card, TableShell, EmptyRow, Modal, Field, TextInput, SelectInput,
  useList, apiError,
} from '@/components/accounting/kit';

const TABS: Array<{ label: string; seg: string }> = [
  { label: 'Items', seg: '' },
  { label: 'Categories', seg: 'categories' },
  { label: 'Stock Movements', seg: 'movements' },
];

export function InventoryTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const baseHref = `/w/${wsId}/inventory`;
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {TABS.map((t) => {
        const href = t.seg ? `${baseHref}/${t.seg}` : baseHref;
        const active = t.seg ? pathname.startsWith(href) : pathname === baseHref;
        return (
          <Link
            key={t.label}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active ? 'bg-amber-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
