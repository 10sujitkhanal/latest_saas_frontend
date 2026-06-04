'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, Loader2, X, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';
import AddCardModal from '@/components/billing/AddCardModal';

/**
 * One-click plan checkout.
 *
 * No card-entry form — the org's saved default card (Stripe customer id)
 * is charged server-side. If there's no saved card, we point the admin
 * to the Payment Methods page to add one first. Free plans confirm with
 * no charge.
 */

interface Card {
  id: number;
  cardholder_name?: string;
  brand: string;
  last4: string;
  is_default: boolean;
}

const brandLabel = (b: string) =>
  ({ visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' }[b?.toLowerCase()] ||
    (b ? b[0].toUpperCase() + b.slice(1) : 'Card'));

export default function OneClickSubscribeModal({
  planName,
  price,
  cycle,
  isFree,
  onClose,
  onConfirm,
  title = 'Confirm subscription',
  confirmLabel,
}: {
  planName: string;
  price: number;
  cycle: 'MONTHLY' | 'YEARLY';
  isFree: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  confirmLabel?: string;
}) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      const res = await OrganizationService.billingListCards();
      setCards(res?.success ? res.data.cards || [] : []);
    } catch {
      setCards([]);
    }
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const defaultCard = cards?.find((c) => c.is_default) || cards?.[0] || null;
  const needsCard = !isFree && cards !== null && !defaultCard;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch (e) {
      toast.error((e as Error)?.message || 'Payment failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f1a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-[13px] text-slate-300 mt-1">
          {isFree ? (
            <>Switch to <span className="font-semibold text-white">{planName}</span> — no charge.</>
          ) : (
            <>You&apos;ll be charged <span className="font-semibold text-white">${price.toFixed(2)}</span> for{' '}
            <span className="font-semibold text-white">{planName}</span> ({cycle.toLowerCase()}).</>
          )}
        </p>

        <div className="mt-5">
          {cards === null ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading payment method…
            </div>
          ) : isFree ? null : needsCard ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 text-amber-200 text-sm font-semibold">
                <Wallet className="w-4 h-4" /> No saved card
              </div>
              <p className="text-[12px] text-slate-300 mt-1">
                Add a payment card once, then subscribe in one click.
              </p>
              <button
                onClick={() => setAddOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold"
              >
                <CreditCard className="w-3.5 h-3.5" /> Add a card
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-200">
                <CreditCard className="w-4.5 h-4.5" />
              </div>
              <div className="text-sm text-white">
                {brandLabel(defaultCard!.brand)} •••• {defaultCard!.last4}
                <div className="text-[11px] text-slate-500">Charged instantly · one-click</div>
              </div>
            </div>
          )}
        </div>

        {!needsCard && (
          <button
            onClick={confirm}
            disabled={busy || cards === null}
            className="mt-5 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Processing…' : isFree ? `Switch to ${planName}` : (confirmLabel || `Pay $${price.toFixed(2)} & subscribe`)}
          </button>
        )}

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          Secure — charged to your saved card via Stripe. No card details entered here.
        </p>

        {addOpen && (
          <AddCardModal
            onClose={() => setAddOpen(false)}
            onSaved={() => {
              setAddOpen(false);
              loadCards();
            }}
          />
        )}
      </div>
    </div>
  );
}
