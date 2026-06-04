'use client';

import { useEffect, useState } from 'react';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, CardElement, AddressElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';

/**
 * Reusable "Add a card" modal (Stripe).
 *
 * Collects card + full billing name/address (Stripe's AddressElement →
 * complete country list) and saves the resulting PaymentMethod to the
 * org's Stripe customer. Used from the Payment Methods page AND inline
 * from purchase/renew flows so an admin can add a card without leaving.
 */

const STRIPE_APPEARANCE = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#10b981',
    colorBackground: '#0b0f1a',
    colorText: '#e2e8f0',
    colorTextPlaceholder: '#64748b',
    borderRadius: '10px',
  },
};

export default function AddCardModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await OrganizationService.billingSetupIntent();
        if (!res?.success) {
          setErr(res?.message || 'Could not start card setup.');
          return;
        }
        setClientSecret(res.data.client_secret);
        setStripePromise(loadStripe(res.data.publishable_key));
      } catch (e) {
        setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not start card setup.');
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0f1a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-white mb-1">Add a card</h3>
        <p className="text-[12px] text-slate-400 mb-5">Securely stored by Stripe. We never see your full card number.</p>

        {err ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">{err}</div>
        ) : !stripePromise || !clientSecret ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Preparing secure form…
          </div>
        ) : (
          <Elements stripe={stripePromise} options={{ appearance: STRIPE_APPEARANCE }}>
            <CardForm clientSecret={clientSecret} onSaved={onSaved} />
          </Elements>
        )}
      </div>
    </div>
  );
}

function CardForm({ clientSecret, onSaved }: { clientSecret: string; onSaved: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    const cardEl = elements.getElement(CardElement);
    const addrEl = elements.getElement('address');
    if (!cardEl) return;
    setBusy(true);
    try {
      let billing: { name?: string; address?: Record<string, string | undefined> } = {};
      if (addrEl) {
        const { complete, value } = await addrEl.getValue();
        if (!complete) {
          toast.error('Please complete the billing name and address.');
          setBusy(false);
          return;
        }
        billing = { name: value.name, address: value.address as Record<string, string | undefined> };
      }

      const { error, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl, billing_details: billing },
      });
      if (error) {
        toast.error(error.message || 'Card could not be verified.');
        return;
      }
      const pmId = setupIntent?.payment_method as string | undefined;
      if (!pmId) {
        toast.error('No payment method returned.');
        return;
      }
      const res = await OrganizationService.billingSaveCard(pmId);
      if (res?.success) {
        toast.success('Card saved.');
        onSaved();
      } else {
        toast.error(res?.message || 'Could not save the card.');
      }
    } catch (e) {
      toast.error((e as Error)?.message || 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <div>
        <span className="text-[11px] font-medium text-slate-400">Card details</span>
        <div className="mt-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3">
          <CardElement
            options={{
              style: {
                base: { color: '#e2e8f0', fontSize: '15px', '::placeholder': { color: '#64748b' } },
                invalid: { color: '#f87171' },
              },
            }}
          />
        </div>
      </div>

      {/* Stripe's AddressElement — full country list + name + address. */}
      <div>
        <span className="text-[11px] font-medium text-slate-400">Billing name &amp; address</span>
        <div className="mt-1">
          <AddressElement options={{ mode: 'billing' }} />
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || busy}
        className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
      >
        {busy && <Loader2 className="w-4 h-4 animate-spin" />}
        {busy ? 'Saving…' : 'Save card'}
      </button>
    </form>
  );
}
