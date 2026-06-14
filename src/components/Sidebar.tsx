'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Folders, Bell, CreditCard, Sparkles, ShieldCheck, Boxes, UserCog, LogOut, Lock, Wallet, Settings, CalendarDays, FileSignature, Bot, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useSubscriptionStatusStore } from '@/store/subscriptionStatusStore';
import { useBranding } from '@/lib/branding';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { href: '/ai-staff', label: 'AI Staff', Icon: Bot },
  { href: '/workspaces', label: 'Workspaces', Icon: Folders },
  { href: '/leads', label: 'Leads', Icon: Users },
  { href: '/calendar', label: 'Calendar', Icon: CalendarDays },
  { href: '/documents', label: 'Documents', Icon: FileSignature },
  { href: '/w', label: 'Workspace panel', Icon: Folders },
  { href: '/staff', label: 'Staff', Icon: UserCog },
  { href: '/roles', label: 'Roles', Icon: ShieldCheck },
  { href: '/services', label: 'Services', Icon: Boxes },
  { href: '/notifications', label: 'Notifications', Icon: Bell, badgeKey: 'unread' as const },
  { href: '/billing', label: 'Billing', Icon: CreditCard },
  { href: '/payment-methods', label: 'Payment Methods', Icon: Wallet },
  { href: '/subscription', label: 'Subscription', Icon: Sparkles },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const unread = useNotificationsStore((s) => s.unread);
  const fetchNotifications = useNotificationsStore((s) => s.fetch);
  const branding = useBranding();
  const business = useAuthStore((s) => s.business);
  const subscriptionActive = useSubscriptionStatusStore((s) => s.active);

  // The sidebar shows the ORG's OWN identity (business profile) at the top, not
  // the white-label platform brand. The footer credits the platform provider:
  // `branding.name` already encodes the white-label rule — it's the agency's
  // brand when the agency has a white-label plan, else "Merkoll". So a non-
  // white-label agency (e.g. Moretech on Starter) correctly shows "Merkoll".
  const orgName = business?.name || branding.tenant_name || 'Organization';
  const orgLogo = business?.logo || null;
  const providerLine = `Powered by ${branding.name || 'Merkoll'}`;

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(t);
  }, [fetchNotifications]);

  const handleLogout = () => {
    logout();
    router.replace('/auth/login');
  };

  const initial = (user?.email ?? 'U')[0].toUpperCase();

  return (
    <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-white/5 bg-[#080e1c] h-screen sticky top-0">
      <div className="px-6 py-6 flex items-center gap-3 border-b border-white/5">
        {orgLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={orgLogo}
            alt={orgName}
            className="w-9 h-9 rounded-lg object-cover border border-white/10 shadow-lg shadow-black/20"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20"
            style={{
              backgroundImage: branding.brand_color
                ? `linear-gradient(135deg, ${branding.brand_color}, ${branding.brand_color}aa)`
                : 'linear-gradient(135deg, #10b981, #0ea5e9)',
            }}
          >
            {(orgName || 'M')[0].toUpperCase()}
          </div>
        )}
        <div className="leading-tight min-w-0">
          <div className="text-sm font-semibold text-white truncate" title={orgName}>
            {orgName}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 truncate" title={providerLine}>
            {providerLine}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, Icon, badgeKey }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          const badgeValue = badgeKey === 'unread' ? unread : 0;
          // When the subscription is inactive, only /subscription is reachable.
          const locked = !subscriptionActive && href !== '/subscription';

          if (locked) {
            return (
              <div
                key={href}
                title="Renew your subscription to access this section."
                className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 border border-transparent cursor-not-allowed select-none"
              >
                <Icon className="w-5 h-5 text-slate-600" />
                <span className="flex-1">{label}</span>
                <Lock className="w-3.5 h-3.5 text-slate-600" />
              </div>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-200'}`} />
              <span className="flex-1">{label}</span>
              {badgeValue > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold rounded-full bg-emerald-500 text-slate-950">
                  {badgeValue > 99 ? '99+' : badgeValue}
                </span>
              )}
            </Link>
          );
        })}

      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-sm font-semibold text-emerald-300 border border-white/10">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user?.email ?? 'Member'}</div>
            <div className="text-[11px] text-emerald-300/80 uppercase tracking-wider truncate">{user?.role ?? 'member'}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-2 rounded-md text-slate-500 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
