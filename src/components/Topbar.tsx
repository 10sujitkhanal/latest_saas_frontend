'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useNotificationsStore } from '@/store/notificationsStore';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  const unread = useNotificationsStore((s) => s.unread);
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#030712]/70 border-b border-white/5">
      <div className="px-6 lg:px-10 h-16 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>

        <Link
          href="/notifications"
          title="Notifications"
          className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>

        {actions}
      </div>
    </header>
  );
}
