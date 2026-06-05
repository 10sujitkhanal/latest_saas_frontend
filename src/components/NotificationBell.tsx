'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, DollarSign, ShoppingBag, UserPlus, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationsStore } from '@/store/notificationsStore';
import { OrganizationService } from '@/services/organization.service';
import { getAuthToken } from '@/lib/storage';

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  SUCCESS: CheckCircle2,
  PLAN_EXPIRED: AlertTriangle,
  WARNING: AlertTriangle,
};
function iconFor(title: string, type: string) {
  if (ICON[type]) return ICON[type];
  const t = title.toLowerCase();
  if (t.includes('paid') || t.includes('invoice')) return DollarSign;
  if (t.includes('order')) return ShoppingBag;
  if (t.includes('lead')) return UserPlus;
  return Info;
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const items = useNotificationsStore((s) => s.items);
  const unread = useNotificationsStore((s) => s.unread);
  const fetch = useNotificationsStore((s) => s.fetch);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch(); }, [fetch]);

  // Live SSE — toast new events + refresh the list/badge. Bounded server-side,
  // so we reconnect when the stream closes.
  useEffect(() => {
    const token = getAuthToken('access');
    if (!token) return;
    let stopped = false;
    let timer: any;
    const connect = () => {
      if (stopped) return;
      const es = new EventSource(OrganizationService.notificationStreamUrl(token));
      es.addEventListener('notification', (e: MessageEvent) => {
        try {
          const n = JSON.parse(e.data);
          const fn = n.type === 'SUCCESS' ? toast.success : (n.type === 'WARNING' || n.type === 'PLAN_EXPIRED') ? toast.warning : toast;
          (fn as any)(n.title, {
            description: n.message,
            action: n.link ? { label: 'View', onClick: () => router.push(n.link) } : undefined,
          });
          fetch();
        } catch {}
      });
      es.addEventListener('count', () => fetch());
      es.addEventListener('reconnect', () => { es.close(); if (!stopped) timer = setTimeout(connect, 500); });
      es.onerror = () => { es.close(); if (!stopped) timer = setTimeout(connect, 4000); };
    };
    connect();
    return () => { stopped = true; clearTimeout(timer); };
  }, [fetch, router]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = (n: typeof items[number]) => {
    setOpen(false);
    if (!n.is_read) markRead(n.id);
    if (n.link) router.push(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetch(); }}
        title="Notifications"
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#0a1120] shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markAllRead()} className="flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && (
              <div className="px-4 py-12 text-center">
                <Bell className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-400">You're all caught up</p>
                <p className="text-[11px] text-slate-500 mt-1">Business activity will appear here in real time.</p>
              </div>
            )}
            {items.map((n) => {
              const Icon = iconFor(n.title, n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/5 last:border-0 transition-colors ${n.is_read ? 'hover:bg-white/[0.03]' : 'bg-emerald-500/[0.05] hover:bg-emerald-500/[0.08]'}`}
                >
                  <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-emerald-300 shrink-0">
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`text-[13px] truncate ${n.is_read ? 'font-medium text-slate-300' : 'font-semibold text-white'}`}>{n.title}</span>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />}
                    </span>
                    {n.message && <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</span>}
                    <span className="block text-[10px] text-slate-600 mt-1">
                      {n.workspace_name ? `${n.workspace_name} · ` : ''}{timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
