'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Plus, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';
import AddCardModal from '@/components/billing/AddCardModal';

/**
 * Saved payment cards (Stripe) for the org.
 *
 * Cards are tokenised in the browser by Stripe.js â€” raw card data never
 * hits our backend; we send only the resulting PaymentMethod id, which
 * the backend attaches to the org's Stripe customer and stores
 * (encrypted). The default card is reused everywhere for one-click
 * charges (MoreTech AI, plan invoices).
 *
 * Admin-only â€” the backend enforces it; render this only for admins.
 */

interface Card {
  id: number;
  cardholder_name?: string;
  brand: string;
  last4: string;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

const brandLabel = (b: string) =>
  ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' }[b?.toLowerCase()] ||
    (b ? b[0].toUpperCase() + b.slice(1) : 'Card'));

export default function PaymentMethods() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await OrganizationService.billingListCards();
      if (res?.success) setCards(res.data.cards || []);
    } catch {
      /* surfaced elsewhere */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setDefault = async (id: number) => {
    const res = await OrganizationService.billingSetDefaultCard(id);
    if (res?.success) {
      toast.success('Default card updated.');
      load();
    } else toast.error(res?.message || 'Could not update default card.');
  };

  const remove = async (id: number) => {
    const res = await OrganizationService.billingDeleteCard(id);
    if (res?.success) {
      toast.success('Card removed.');
      load();
    } else toast.error(res?.message || 'Could not remove card.');
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Payment methods</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Your saved card is used for one-click payments â€” MoreTech AI and plan invoices.
          </p>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> Add card
        </button>
      </div>

      {loading ? (
        <div className="h-20 rounded-2xl border border-white/5 bg-white/[0.02] animate-pulse" />
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
          <CreditCard className="w-6 h-6 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No card on file. Add one to enable one-click payments.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-200">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-white font-medium flex items-center gap-2">
                    {brandLabel(c.brand)} â€¢â€¢â€¢â€¢ {c.last4}
                    {c.is_default && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <Star className="w-2.5 h-2.5" /> Default
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {c.cardholder_name ? `${c.cardholder_name} Â· ` : ''}
                    Expires {String(c.exp_month).padStart(2, '0')}/{c.exp_year}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!c.is_default && (
                  <button
                    onClick={() => setDefault(c.id)}
                    className="text-[11px] px-2 py-1 rounded-md border border-white/10 text-slate-300 hover:bg-white/[0.06]"
                  >
                    Make default
                  </button>
                )}
                <button
                  onClick={() => remove(c.id)}
                  className="w-7 h-7 rounded-md border border-white/10 text-slate-400 hover:text-red-300 hover:border-red-500/30 flex items-center justify-center"
                  aria-label="Remove card"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <AddCardModal
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      )}
    </section>
  );
}
