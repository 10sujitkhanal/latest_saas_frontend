'use client';

import { useEffect, useState } from 'react';
import Topbar from '@/components/Topbar';
import { Check, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { PageSpinner, PageError } from '@/components/StateViews';
import OneClickSubscribeModal from '@/components/billing/OneClickSubscribeModal';
import { useBranding } from '@/lib/branding';
import { useSubscriptionStatusStore } from '@/store/subscriptionStatusStore';
import {
  OrganizationService,
  type Plan,
  type CurrentSubscription,
} from '@/services/organization.service';

type PendingAction =
  | { kind: 'subscribe'; plan: Plan; cycle: 'MONTHLY' | 'YEARLY' }
  | null;

const money = (a: string | number) => `$${(typeof a === 'string' ? parseFloat(a) : a).toFixed(2)}`;

export default function SubscriptionPage() {
  const branding = useBranding();
  const subscriptionActive = useSubscriptionStatusStore((s) => s.active);
  const subscriptionStatus = useSubscriptionStatusStore((s) => s.status);
  const markSubscriptionActive = useSubscriptionStatusStore((s) => s.markActive);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stripeConfigured, setStripeConfigured] = useState(true);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [current, setCurrent] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [pending, setPending] = useState<PendingAction>(null);
  const [renewing, setRenewing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansRes, currentRes] = await Promise.all([
        OrganizationService.listPlans(),
        OrganizationService.currentSubscription(),
      ]);
      if (plansRes.success && plansRes.data) {
        setPlans(plansRes.data.plans ?? []);
        setStripeConfigured(plansRes.data.stripe_configured ?? true);
        setStripeError(plansRes.data.stripe_error ?? null);
      }
      if (currentRes.success && currentRes.data) {
        setCurrent(currentRes.data);
        const c = currentRes.data.subscription.billing_cycle;
        if (c === 'MONTHLY' || c === 'YEARLY') setCycle(c);
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Failed to load subscription.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const refreshGate = async () => {
    try {
      const r = await OrganizationService.me();
      if (r?.success && r.data) {
        if (r.data.subscription_active) markSubscriptionActive();
      }
    } catch {
      // ignore — the next route navigation will rerun the gate anyway
    }
  };

  const subscribeConfirmed = async () => {
    if (!pending || pending.kind !== 'subscribe') return;
    const res = await OrganizationService.subscribe(pending.plan.id, pending.cycle);
    if (res.success) {
      toast.success(res.message || `Switched to ${pending.plan.name}`);
      setPending(null);
      await load();
      await refreshGate();
    } else {
      throw new Error(res.message || 'Failed to subscribe.');
    }
  };

  const renew = async () => {
    setRenewing(true);
    try {
      const res = await OrganizationService.renew();
      if (res.success) {
        toast.success(res.message || 'Subscription renewed.');
        await load();
        await refreshGate();
      } else {
        toast.error(res.message || 'Failed to renew.');
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to renew.');
    } finally {
      setRenewing(false);
    }
  };

  return (
    <>
      <Topbar
        title="Subscription"
        subtitle={
          branding.is_agency
            ? `Plans offered by ${branding.agency_name}. Payments go to ${branding.agency_name}'s Stripe.`
            : 'Direct plans by Merkoll. Switch or renew anytime.'
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {loading && <PageSpinner />}
        {error && <PageError message={error} onRetry={load} />}

        {!loading && !error && (
          <>
            {!subscriptionActive && (
              <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/[0.06] p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-200">Your subscription is inactive</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Status:{' '}
                    <span className="uppercase font-semibold text-red-200">{subscriptionStatus || 'NONE'}</span>
                    . Other panel sections are locked until you renew or pick a plan.
                  </p>
                </div>
              </div>
            )}

            {!stripeConfigured && stripeError && (
              <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-200">Payments are unavailable</h3>
                  <p className="text-sm text-slate-300 mt-1">{stripeError}</p>
                  <p className="text-xs text-slate-400 mt-2">
                    You can still view plans, but switching is blocked until Stripe is connected.
                  </p>
                </div>
              </div>
            )}

            {/* Two mutually-exclusive modes:
                 * Custom subscription → only the Renew card. The
                   switch-plan grid is HIDDEN because a hand-tuned
                   custom deal would lose its overrides on a plan
                   switch (which is the desired "return to standard
                   rails" behaviour, but should be an explicit action,
                   not an accidental click on a plan card).
                 * Standard subscription → only the switch-plan grid.
                   The Renew button is suppressed because the underlying
                   plan auto-renews at its billing cycle and a manual
                   renew would create a phantom invoice. */}
            {current?.subscription?.is_custom_subscription ? (
              <CurrentSubscriptionCard sub={current.subscription} onRenew={renew} renewing={renewing} stripeConfigured={stripeConfigured} />
            ) : (
              <>
                <CurrentSubscriptionCard sub={current?.subscription ?? null} onRenew={() => {}} renewing={false} stripeConfigured={stripeConfigured} hideRenew />

                <div className="mt-10 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {branding.is_agency ? `${branding.agency_name}'s plans` : 'Available plans'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {plans[0]?.type === 'AGENCY'
                        ? `These plans are configured by ${branding.agency_name}.`
                        : 'These are direct Merkoll plans.'}
                    </p>
                  </div>
                  <BillingCycleToggle value={cycle} onChange={setCycle} />
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const isFree =
                      parseFloat(cycle === 'YEARLY' ? plan.yearly_price : plan.monthly_price) <= 0;
                    const blocked = !stripeConfigured && !isFree;
                    return (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        cycle={cycle}
                        current={current?.subscription.plan_name === plan.name}
                        blocked={blocked}
                        onSelect={() => setPending({ kind: 'subscribe', plan, cycle })}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {pending && pending.kind === 'subscribe' && (
        <OneClickSubscribeModal
          planName={pending.plan.name}
          price={parseFloat(pending.cycle === 'YEARLY' ? pending.plan.yearly_price : pending.plan.monthly_price) || 0}
          cycle={pending.cycle}
          isFree={parseFloat(pending.cycle === 'YEARLY' ? pending.plan.yearly_price : pending.plan.monthly_price) <= 0}
          onClose={() => setPending(null)}
          onConfirm={subscribeConfirmed}
        />
      )}
    </>
  );
}

function CurrentSubscriptionCard({
  sub,
  onRenew,
  renewing,
  stripeConfigured,
  hideRenew = false,
}: {
  sub: CurrentSubscription['subscription'] | null;
  onRenew: () => void;
  renewing: boolean;
  stripeConfigured: boolean;
  /** Suppress the Renew button for standard plan subscriptions —
   *  those auto-renew through the plan and a manual Renew would
   *  fabricate an extra invoice. Only custom deals show the button. */
  hideRenew?: boolean;
}) {
  if (!sub) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-6">
        <h3 className="text-lg font-semibold text-white">No active plan</h3>
        <p className="text-sm text-slate-400 mt-1">Pick a plan below to activate your organization.</p>
      </div>
    );
  }

  const isCanceled = ['CANCELLED', 'cancelled', 'EXPIRED', 'expired'].includes(sub.status);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-emerald-500/10 via-sky-500/5 to-transparent border border-white/5 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-emerald-300">Current plan</div>
          <div className="mt-1 text-2xl font-bold text-white">{sub.plan_name}</div>
          <div className="mt-1 text-sm text-slate-400">
            Status:{' '}
            <span
              className={`uppercase tracking-wider font-semibold ${
                isCanceled ? 'text-amber-300' : 'text-emerald-300'
              }`}
            >
              {sub.status}
            </span>
            {sub.current_period_end && (
              <>
                {' · '}
                {isCanceled ? 'Access until' : 'Renews on'}{' '}
                <span className="text-white">{new Date(sub.current_period_end).toLocaleDateString()}</span>
              </>
            )}
            {' · '}
            <span className="text-white uppercase tracking-wider text-xs">{sub.billing_cycle}</span>
          </div>
        </div>
        {hideRenew ? (
          // Standard plan — explain why there's no Renew button so the
          // admin doesn't think it's missing or broken.
          <div className="text-xs text-slate-400 max-w-[220px] text-right">
            Auto-renews with your <span className="text-white">{sub.billing_cycle.toLowerCase()}</span> billing cycle.
            Switch to a different plan below to change it.
          </div>
        ) : (
        <button
          onClick={onRenew}
          disabled={renewing || !stripeConfigured}
          title={!stripeConfigured ? 'Stripe is not configured — renewal disabled.' : 'Renew now'}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
        >
          {renewing ? 'Renewing…' : 'Renew now'}
        </button>
        )}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <LimitChip label="Workspaces" value={sub.effective_max_workspaces} />
        <LimitChip label="Members" value={sub.effective_max_users} />
        <LimitChip label="Leads" value={sub.effective_max_leads} />
      </div>

      {sub.is_agency && sub.agency_fee_percentage && (
        <p className="mt-4 text-xs text-slate-500">
          Agency platform fee:{' '}
          <span className="text-white font-medium">{sub.agency_fee_percentage}%</span>
        </p>
      )}
    </div>
  );
}

function LimitChip({ label, value }: { label: string; value: number }) {
  // ``-1`` and ``0`` are both the "unlimited" sentinels coming back
  // from the backend. Render them as a friendly label rather than the
  // raw number so the UI never shows "WORKSPACES -1".
  const unlimited = value == null || value <= 0;
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-base font-semibold text-white">
        {unlimited ? 'Unlimited' : value.toLocaleString()}
      </div>
    </div>
  );
}

function BillingCycleToggle({
  value,
  onChange,
}: {
  value: 'MONTHLY' | 'YEARLY';
  onChange: (v: 'MONTHLY' | 'YEARLY') => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-white/[0.03] border border-white/5 p-1">
      {(['MONTHLY', 'YEARLY'] as const).map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 text-xs uppercase tracking-wider font-semibold rounded-md transition-colors ${
            value === opt ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
          }`}
        >
          {opt === 'YEARLY' ? 'Yearly (2 mo free)' : 'Monthly'}
        </button>
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  cycle,
  current,
  blocked,
  onSelect,
}: {
  plan: Plan;
  cycle: 'MONTHLY' | 'YEARLY';
  current: boolean;
  blocked?: boolean;
  onSelect: () => void;
}) {
  const price = cycle === 'YEARLY' ? parseFloat(plan.yearly_price) : parseFloat(plan.monthly_price);

  return (
    <div
      className={`relative rounded-2xl border p-6 transition-colors ${
        current ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      {current && (
        <span className="absolute -top-2 right-4 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500 text-slate-950 font-bold">
          Current
        </span>
      )}
      <div className="text-sm font-medium text-slate-400">{plan.name}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white">${price.toFixed(0)}</span>
        <span className="text-sm text-slate-500">/ {cycle === 'YEARLY' ? 'yr' : 'mo'}</span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{plan.type}</div>

      {/* Plan content — three sections so high-volume plans don't look
          like a wall of bullet points:
            1. Core capacity (workspaces / users / leads)
            2. Per-service quotas (tasks / appointments / knowledge…)
            3. Bundled services (CRM / Inbox / Scheduling …) + flags */}
      <div className="mt-5 space-y-4 text-sm text-slate-300">
        <PlanSection title="Core capacity">
          <Feature label={`${fmtQuota(plan.max_workspaces)} workspaces`} />
          <Feature label={`${fmtQuota(plan.max_users)} team members`} />
          <Feature label={`${fmtQuota(plan.max_leads)} leads`} />
          {plan.quotas?.contacts != null && (
            <Feature label={`${fmtQuota(plan.quotas.contacts)} contacts`} />
          )}
        </PlanSection>

        {plan.quotas && (
          <PlanSection title="Per-service quotas">
            <Feature label={`${fmtQuota(plan.quotas.tasks)} tasks`} />
            <Feature label={`${fmtQuota(plan.quotas.appointments)} appointments`} />
            <Feature label={`${fmtQuota(plan.quotas.event_types)} event types`} />
            <Feature label={`${fmtQuota(plan.quotas.knowledge)} knowledge docs`} />
            <Feature label={`${fmtQuota(plan.quotas.inbox_msgs)} inbox msgs / mo`} />
            <Feature label={`${fmtQuota(plan.quotas.credentials)} credentials`} />
            <Feature label={`${fmtQuota(plan.quotas.workflows)} workflows`} />
            <Feature label={`${fmtQuota(plan.quotas.channels)} channels`} />
            <Feature label={`${fmtQuota(plan.quotas.pipelines)} pipelines`} />
          </PlanSection>
        )}

        {(plan.services?.length || plan.flags) && (
          <PlanSection title="Included">
            {plan.flags?.bulk_import && <Feature label="Bulk import (CSV)" />}
            {plan.flags?.use_automation && <Feature label="Automations" />}
            {plan.flags?.use_api && <Feature label="API access" />}
            {plan.services?.map((s) => (
              <Feature key={s.code} label={s.name} accent />
            ))}
            {/* Credentials is always-on, surface it explicitly so users
                know they can connect integrations on any plan. */}
            <Feature label="Credentials (universal)" accent />
          </PlanSection>
        )}
      </div>

      <button
        onClick={onSelect}
        disabled={current || blocked}
        title={blocked ? 'Stripe is not configured — switching is disabled.' : undefined}
        className={`mt-6 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          current
            ? 'bg-white/[0.04] border border-white/5 text-slate-400 cursor-default'
            : blocked
            ? 'bg-white/[0.04] border border-white/5 text-slate-400'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
        }`}
      >
        {current ? 'Current plan' : blocked ? 'Stripe not connected' : `Switch to ${plan.name}`}
      </button>
    </div>
  );
}

function Feature({ label, on = true, accent = false }: { label: string; on?: boolean; accent?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {on ? (
        <Check className={`w-4 h-4 shrink-0 ${accent ? 'text-cyan-400' : 'text-emerald-400'}`} />
      ) : (
        <X className="w-4 h-4 text-slate-600 shrink-0" />
      )}
      <span className={on ? '' : 'text-slate-500 line-through'}>{label}</span>
    </li>
  );
}

// Section heading + bullet list. Keeps the plan card scannable when a
// plan exposes a dozen quotas + a handful of bundled services.
function PlanSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-500 mb-1.5">{title}</div>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

// Format a quota value for the plan card. ``-1`` or ``0`` collapse to
// "Unlimited"; everything else renders with thousand-separators so
// "5,000 leads" reads correctly.
function fmtQuota(n: number | null | undefined): string {
  if (n == null || n <= 0) return 'Unlimited';
  return n.toLocaleString();
}
