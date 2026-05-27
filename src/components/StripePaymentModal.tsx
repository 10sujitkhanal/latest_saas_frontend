'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadStripe, type Stripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { X } from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';
import { useBranding } from '@/lib/branding';

interface Props {
  /** Render-state plan info — used to show the user what they're paying for. */
  plan: { id: number; name: string };
  billingCycle: 'MONTHLY' | 'YEARLY';
  /** Stripe publishable key for this tenant (returned by `/plans/`). */
  publishableKey: string | null;
  /** Free plans skip Stripe entirely — pass true to bypass the form. */
  isFree?: boolean;
  onClose: () => void;
  /** After payment succeeds (or immediately for free plans), this fires to
   * complete the subscription server-side. */
  onConfirm: () => Promise<void>;
}

export default function StripePaymentModal({
  plan,
  billingCycle,
  publishableKey,
  isFree,
  onClose,
  onConfirm,
}: Props) {
  const branding = useBranding();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    if (isFree) return;
    if (!publishableKey) {
      setError('Stripe is not configured for this organization.');
      return;
    }
    let cancelled = false;
    setStripePromise(loadStripe(publishableKey));
    OrganizationService.createPaymentIntent(plan.id, billingCycle)
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data?.client_secret) {
          setClientSecret(res.data.client_secret);
          setAmount(res.data.amount ?? null);
        } else {
          setError(res.message || 'Failed to start payment.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.response?.data?.message ?? 'Failed to start payment.');
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id, billingCycle, publishableKey, isFree]);

  useEffect(() => {
    if (isFree && !confirming) {
      setConfirming(true);
      onConfirm().catch((err) => {
        setError(err?.response?.data?.message ?? 'Failed to apply the plan change.');
        setConfirming(false);
      });
    }
  }, [isFree, confirming, onConfirm]);

  const options = useMemo<StripeElementsOptions | null>(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: {
        theme: 'night',
        variables: {
          colorPrimary: '#10b981',
          colorBackground: '#0f172a',
          colorText: '#f8fafc',
          colorDanger: '#f87171',
          borderRadius: '8px',
          fontFamily: 'system-ui, sans-serif',
        },
      },
    };
  }, [clientSecret]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/10 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Confirm subscription</h2>
            <p className="text-sm text-slate-400 mt-1">
              {isFree
                ? `Switching to ${plan.name} — no payment required.`
                : amount != null
                ? `You'll be charged $${amount.toFixed(2)} for ${plan.name} (${billingCycle.toLowerCase()}).`
                : 'Setting up secure payment…'}
            </p>
            {!isFree && branding.is_agency && branding.agency_name && (
              <p className="text-[11px] text-emerald-300/80 mt-1">
                Payment processed by <span className="font-semibold">{branding.agency_name}</span> via Stripe.
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {!isFree && !clientSecret && !error && <Loader text="Talking to Stripe…" />}

        {!isFree && stripePromise && clientSecret && options && (
          <Elements stripe={stripePromise} options={options}>
            <PaymentForm
              busy={confirming}
              setBusy={setConfirming}
              setError={setError}
              onConfirm={onConfirm}
            />
          </Elements>
        )}

        {isFree && confirming && <Loader text="Applying plan change…" />}
      </div>
    </div>
  );
}

function PaymentForm({
  busy,
  setBusy,
  setError,
  onConfirm,
}: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setError: (msg: string | null) => void;
  onConfirm: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || busy) return;
    setError(null);
    setBusy(true);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message ?? 'Payment failed.');
      setBusy(false);
      return;
    }
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      setError(`Payment status: ${paymentIntent?.status ?? 'unknown'}.`);
      setBusy(false);
      return;
    }

    try {
      await onConfirm();
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Subscription update failed after payment.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5 space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || !elements || busy}
        className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50"
      >
        {busy ? 'Processing…' : 'Pay & confirm'}
      </button>
      <p className="text-[11px] text-slate-500 text-center">
        Secured by Stripe · Use card <span className="text-slate-300 font-mono">4242 4242 4242 4242</span> in test mode.
      </p>
    </form>
  );
}

function Loader({ text }: { text: string }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-3 py-4">
      <div className="w-7 h-7 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
