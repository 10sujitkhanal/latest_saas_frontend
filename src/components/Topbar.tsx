'use client';

import NotificationBell from '@/components/NotificationBell';

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-[#030712]/70 border-b border-white/5">
      <div className="px-6 lg:px-10 h-16 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>

        <NotificationBell />

        {actions}
      </div>
    </header>
  );
}
