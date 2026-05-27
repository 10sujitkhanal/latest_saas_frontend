'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import { Check } from 'lucide-react';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import { useNotificationsStore } from '@/store/notificationsStore';
import { toast } from 'sonner';

const typeBadgeClass: Record<string, string> = {
  INFO: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  SUCCESS: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  WARNING: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  ERROR: 'bg-red-500/10 text-red-300 border-red-500/20',
  PLAN_EXPIRED: 'bg-red-500/10 text-red-300 border-red-500/20',
  PLAN_RENEWED: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  NEW_MEMBER: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
};

const typeDotClass: Record<string, string> = {
  INFO: 'bg-sky-400',
  SUCCESS: 'bg-emerald-400',
  WARNING: 'bg-amber-400',
  ERROR: 'bg-red-400',
  PLAN_EXPIRED: 'bg-red-400',
  PLAN_RENEWED: 'bg-emerald-400',
  NEW_MEMBER: 'bg-sky-400',
};

export default function NotificationsPage() {
  const items = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const loading = useNotificationsStore((s) => s.loading);
  const fetchAll = useNotificationsStore((s) => s.fetch);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll().catch((e) => setError(e?.response?.data?.message ?? 'Failed to load notifications.'));
  }, [fetchAll]);

  const filtered = filter === 'unread' ? items.filter((n) => !n.is_read) : items;

  return (
    <>
      <Topbar
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up.'}
        actions={
          unread > 0 && (
            <button
              onClick={async () => {
                await markAllRead();
                toast.success('All notifications marked as read');
              }}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200 text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Mark all read
            </button>
          )
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        <div className="flex gap-2 mb-6">
          <FilterChip active={filter === 'all'} label="All" count={items.length} onClick={() => setFilter('all')} />
          <FilterChip active={filter === 'unread'} label="Unread" count={unread} onClick={() => setFilter('unread')} />
        </div>

        {loading && items.length === 0 && <PageSpinner />}
        {error && <PageError message={error} onRetry={fetchAll} />}
        {!loading && filtered.length === 0 && !error && (
          <EmptyState
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description="When something happens in your organization, it'll show up here."
          />
        )}

        {filtered.length > 0 && (
          <ul className="space-y-2">
            {filtered.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 flex items-start gap-3 transition-colors ${
                  n.is_read ? 'border-white/5 bg-white/[0.02]' : 'border-emerald-500/20 bg-emerald-500/[0.03]'
                }`}
              >
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${typeDotClass[n.type] ?? 'bg-slate-400'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white">{n.title}</h3>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        typeBadgeClass[n.type] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/20'
                      }`}
                    >
                      {n.type}
                    </span>
                    {!n.is_read && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950">
                        New
                      </span>
                    )}
                  </div>
                  {n.message && <p className="mt-1 text-sm text-slate-300">{n.message}</p>}
                  <div className="mt-2 text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => markRead(n.id)}
                    title="Mark as read"
                    className="p-2 rounded-lg text-slate-500 hover:text-emerald-300 hover:bg-emerald-500/10"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
        active
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
          : 'bg-white/[0.03] text-slate-300 border border-white/5 hover:bg-white/[0.06]'
      }`}
    >
      {label}
      <span
        className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
          active ? 'bg-emerald-500/30 text-white' : 'bg-white/10 text-slate-300'
        }`}
      >
        {count}
      </span>
    </button>
  );
}
