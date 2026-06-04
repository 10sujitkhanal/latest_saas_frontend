'use client';

import { useCallback, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { MarketplaceService, type StorefrontBookingRow } from '@/services/marketplace.service';
import { PageHeader, Card, ErrorBox, TableShell, EmptyRow, Pill, money, useList, apiError } from '@/components/accounting/kit';

function MarketplaceTabs({ wsId }: { wsId: string }) {
  const pathname = usePathname();
  const base = `/w/${wsId}/marketplace`;
  const tabs = [{ label: 'Listings', seg: '' }, { label: 'Storefront setup', seg: 'storefront' }, { label: 'Bookings', seg: 'bookings' }];
  return (
    <nav className="flex flex-wrap gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1">
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return <Link key={t.label} href={href} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-pink-600 text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'}`}>{t.label}</Link>;
      })}
    </nav>
  );
}

export default function BookingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.view" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const fetcher = useCallback(() => MarketplaceService.bookings(wsId), [wsId]);
  const { rows, loading, error, reload } = useList<StorefrontBookingRow>(fetcher);
  const [busyId, setBusyId] = useState<number | null>(null);

  const setStatus = async (b: StorefrontBookingRow, status: string) => {
    setBusyId(b.id);
    try { const r = await MarketplaceService.bookingStatus(wsId, b.id, status); if (!r.success) alert(r.message || 'Failed.'); reload(); }
    catch (e) { alert(apiError(e, 'Failed.')); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Bookings" subtitle="Appointments, reservations & enquiries from your storefront." />
      <MarketplaceTabs wsId={wsId} />
      {loading ? <PageSkeleton kind="list" /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <Card>
          <TableShell head={<tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Service</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">When</th><th className="px-3 py-2 text-center">Party</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-center">Status</th><th className="px-3 py-2 text-right">Actions</th></tr>}>
            {rows.map((b) => (
              <tr key={b.id} className="text-slate-300">
                <td className="px-3 py-2 text-slate-400">{b.booking_no}</td>
                <td className="px-3 py-2 font-medium text-white">{b.service_name || b.booking_type}</td>
                <td className="px-3 py-2">{b.customer_name || b.contact_name || '—'}<div className="text-[10px] text-slate-500">{b.contact_email || b.contact_phone}</div></td>
                <td className="px-3 py-2">{b.date}{b.end_date ? ` → ${b.end_date}` : ''}{b.start_time ? ` ${b.start_time}` : ''}</td>
                <td className="px-3 py-2 text-center">{b.party_size}</td>
                <td className="px-3 py-2 text-right">{parseFloat(b.amount) > 0 ? money(b.amount, b.currency) : '—'}{b.invoice_no && <div className="text-[10px] text-emerald-300">{b.invoice_no}</div>}</td>
                <td className="px-3 py-2 text-center"><Pill>{b.status}</Pill></td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {['pending', 'confirmed'].includes(b.status) ? (
                    <>
                      {b.status === 'pending' && <button disabled={busyId === b.id} onClick={() => setStatus(b, 'confirmed')} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50">Confirm</button>}
                      <button disabled={busyId === b.id} onClick={() => setStatus(b, 'completed')} className="ml-3 text-xs font-medium text-cyan-300 hover:text-cyan-200 disabled:opacity-50">Complete</button>
                      <button disabled={busyId === b.id} onClick={() => setStatus(b, 'cancelled')} className="ml-3 text-xs font-medium text-red-300 hover:text-red-200 disabled:opacity-50">Cancel</button>
                    </>
                  ) : <span className="text-slate-600">—</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={8} label="No bookings yet." />}
          </TableShell>
        </Card>
      )}
    </div>
  );
}
