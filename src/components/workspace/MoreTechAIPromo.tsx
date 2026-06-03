'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sparkles, Infinity as InfinityIcon, ShieldCheck, Zap, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';

/**
 * MoreTech AI promo + purchase popup.
 *
 * MoreTech AI is the platform's own managed Qwen LLM — sold as a
 * subscription (monthly / yearly), not a bring-your-own-key credential.
 * This component shows a promo banner WHEREVER it's useful (Knowledge
 * Base, workspace overview) but ONLY when the workspace has NOT bought
 * it yet. Once active it renders nothing, so it never nags paying users.
 *
 * Clicking "Unlock" opens a popup that pitches the offer (unlimited
 * tokens, private model, no API key) and lets the user buy monthly or
 * yearly. The backend issues the Invoice (routed to the agency or the
 * platform) and flips the entitlement.
 *
 * Props:
 *   - ``variant`` — "banner" (full-width, for the KB page) or "card"
 *     (compact, for the overview grid).
 *   - ``onPurchased`` — optional callback after a successful purchase
 *     (e.g. to refetch the page so the new model becomes selectable).
 */

interface Pricing { monthly: number; yearly: number; currency: string; model: string }
interface Status {
  has_access: boolean;
  is_active: boolean;
  pricing: Pricing;
}

export default function MoreTechAIPromo({
  variant = 'banner',
  onPurchased,
}: {
  variant?: 'banner' | 'card';
  onPurchased?: () => void;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await OrganizationService.moretechAIStatus();
      if (res?.success) setStatus(res.data);
    } catch {
      // Knowledge service may be unavailable — just hide the promo.
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Hide entirely while loading, on error, or once the workspace owns it.
  if (loading || !status || status.has_access) return null;

  const cur = status.pricing?.currency === 'USD' ? '$' : (status.pricing?.currency || '$');
  const monthly = status.pricing?.monthly ?? 29;
  const yearly = status.pricing?.yearly ?? 290;

  const handlePurchased = async () => {
    await load();
    onPurchased?.();
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="mb-6 relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.13] via-fuchsia-500/[0.06] to-transparent p-5">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-200 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">MoreTech AI</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-200 border border-violet-400/30">
                    <InfinityIcon className="w-2.5 h-2.5" /> Unlimited tokens
                  </span>
                </div>
                <p className="text-[12px] text-slate-300 mt-1 max-w-lg">
                  Our own managed Qwen model — <span className="text-violet-200 font-medium">unlimited tokens</span>,
                  private inference, no API key to manage. Subscribe once and use it as
                  the model on any Knowledge Base.
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold bg-violet-500 text-white hover:bg-violet-400 transition-colors"
            >
              Unlock from {cur}{monthly}/mo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="w-full text-left relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.13] via-fuchsia-500/[0.06] to-transparent p-4 hover:border-violet-400/50 transition-colors"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-200 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">MoreTech AI</h3>
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-200 border border-violet-400/30">
                  <InfinityIcon className="w-2.5 h-2.5" /> Unlimited
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Managed Qwen · unlimited tokens · no API key. Tap to unlock from {cur}{monthly}/mo.
              </p>
            </div>
          </div>
        </button>
      )}

      {open && (
        <PurchaseModal
          monthly={monthly}
          yearly={yearly}
          cur={cur}
          onClose={() => setOpen(false)}
          onPurchased={handlePurchased}
        />
      )}
    </>
  );
}

function PurchaseModal({
  monthly, yearly, cur, onClose, onPurchased,
}: {
  monthly: number;
  yearly: number;
  cur: string;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const [busy, setBusy] = useState<'monthly' | 'yearly' | null>(null);
  const yearlySavingPct = monthly > 0
    ? Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100))
    : 0;

  const buy = async (cycle: 'monthly' | 'yearly') => {
    setBusy(cycle);
    try {
      const res = await OrganizationService.moretechAISubscribe(cycle);
      if (res?.success) {
        toast.success(res.message || `MoreTech AI unlocked (${cycle}).`);
        onClose();
        onPurchased();
      } else {
        toast.error(res?.message || 'Could not complete the purchase.');
      }
    } catch (e) {
      toast.error((e as Error)?.message || 'Purchase failed.');
    } finally { setBusy(null); }
  };

  const FEATURES = [
    { icon: InfinityIcon, text: 'Unlimited tokens — no per-message metering' },
    { icon: ShieldCheck, text: 'Private inference on our own servers' },
    { icon: Zap, text: 'No API key to manage — just pick it as your model' },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-violet-500/30 bg-[#0b0f1a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-200">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Unlock MoreTech AI</h2>
            <p className="text-[12px] text-slate-400">Our managed Qwen model · unlimited tokens</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {FEATURES.map((f) => (
            <li key={f.text} className="flex items-start gap-2.5 text-[13px] text-slate-200">
              <span className="mt-0.5 w-5 h-5 rounded-md bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-200 shrink-0">
                <f.icon className="w-3 h-3" />
              </span>
              {f.text}
            </li>
          ))}
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={() => buy('monthly')}
            disabled={busy !== null}
            className="rounded-xl border border-white/15 bg-white/[0.04] p-4 text-left hover:bg-white/[0.08] disabled:opacity-50 transition-colors"
          >
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Monthly</div>
            <div className="mt-1 text-xl font-bold text-white">{cur}{monthly}<span className="text-[12px] font-normal text-slate-400">/mo</span></div>
            <div className="mt-2 text-[12px] font-semibold text-violet-200">
              {busy === 'monthly' ? 'Processing…' : 'Choose monthly'}
            </div>
          </button>

          <button
            onClick={() => buy('yearly')}
            disabled={busy !== null}
            className="relative rounded-xl border border-violet-400/40 bg-violet-500/10 p-4 text-left hover:bg-violet-500/20 disabled:opacity-50 transition-colors"
          >
            {yearlySavingPct > 0 && (
              <span className="absolute right-2 top-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Save {yearlySavingPct}%
              </span>
            )}
            <div className="text-[11px] uppercase tracking-wider text-slate-400">Yearly</div>
            <div className="mt-1 text-xl font-bold text-white">{cur}{yearly}<span className="text-[12px] font-normal text-slate-400">/yr</span></div>
            <div className="mt-2 text-[12px] font-semibold text-violet-200">
              {busy === 'yearly' ? 'Processing…' : 'Choose yearly'}
            </div>
          </button>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Billed through your account · invoice issued automatically.
        </p>
      </div>
    </div>
  );
}
