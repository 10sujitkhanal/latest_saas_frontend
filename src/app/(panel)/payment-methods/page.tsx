'use client';

import Topbar from '@/components/Topbar';
import { useAuthStore } from '@/store/authStore';
import PaymentMethods from '@/components/billing/PaymentMethods';

/**
 * Payment Methods — dedicated page (sidebar entry).
 *
 * Manage the org's saved cards (Stripe). The default card is reused for
 * one-click payments across MoreTech AI and plan invoices. Admin-only;
 * the backend enforces this too.
 */
export default function PaymentMethodsPage() {
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';

  return (
    <>
      <Topbar
        title="Payment Methods"
        subtitle="Save a card once and pay in one click — MoreTech AI and plan invoices."
      />
      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {isAdmin ? (
          <PaymentMethods />
        ) : (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
            Only organization admins can manage payment methods.
          </div>
        )}
      </main>
    </>
  );
}
