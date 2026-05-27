'use client';

import Link from 'next/link';
import { Gauge, AlertTriangle, Infinity as InfinityIcon } from 'lucide-react';
import { useQuota } from '@/hooks/useQuota';

/**
 * Plan-cap badge shown in page headers next to the page title.
 *
 *   <QuotaBadge quota="credentials" label="credentials" />
 *
 * Renders one of three states based on ``useQuota``:
 *   - **Unlimited** → "Unlimited · 5 connected" with an ∞ icon (muted slate).
 *   - **Under cap** → "5 / 10 credentials" with a slim progress bar.
 *                     Color: emerald < 50%, amber 50-80%, red ≥ 80%.
 *   - **At / over cap** → red chip with "Plan cap reached — upgrade" CTA.
 *
 * Stays small (single line, ~280px max) so it fits inline in a page
 * heading without forcing a layout shift.
 */
export default function QuotaBadge({
  quota,
  label,
  className = '',
}: {
  quota: string;
  /** Human label, e.g. "leads". Used in "5 / 10 {label}" text. */
  label: string;
  className?: string;
}) {
  const q = useQuota(quota);

  if (q.loading) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-slate-600 ${className}`}>
        <Gauge className="w-3 h-3 opacity-50" />
        <span className="h-2 w-16 rounded bg-white/[0.06] animate-pulse" />
      </span>
    );
  }

  if (q.unlimited) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] bg-white/[0.03] border border-white/[0.06] text-slate-400 ${className}`}>
        <InfinityIcon className="w-3 h-3" />
        <span><span className="text-slate-300 font-semibold tabular-nums">{q.used.toLocaleString()}</span> {label} · Unlimited</span>
      </span>
    );
  }

  const pct = Math.min(100, q.percent ?? 0);
  const tone =
    q.atCap || q.over ? 'red'
    : pct >= 80      ? 'amber'
    : pct >= 50      ? 'cyan'
    :                  'emerald';
  const colors = {
    emerald: { ring: 'border-emerald-500/30', bg: 'bg-emerald-500/[0.08]', text: 'text-emerald-300', bar: 'bg-emerald-500' },
    cyan:    { ring: 'border-cyan-500/30',    bg: 'bg-cyan-500/[0.08]',    text: 'text-cyan-300',    bar: 'bg-cyan-500' },
    amber:   { ring: 'border-amber-500/30',   bg: 'bg-amber-500/[0.08]',   text: 'text-amber-300',   bar: 'bg-amber-500' },
    red:     { ring: 'border-red-500/30',     bg: 'bg-red-500/[0.08]',     text: 'text-red-300',     bar: 'bg-red-500' },
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[11px] ${colors.bg} border ${colors.ring} ${className}`}>
      {q.atCap || q.over ? (
        <AlertTriangle className={`w-3 h-3 ${colors.text}`} />
      ) : (
        <Gauge className={`w-3 h-3 ${colors.text}`} />
      )}
      <span className="text-slate-300">
        <span className="font-semibold tabular-nums">{q.used.toLocaleString()}</span>
        <span className="text-slate-500"> / </span>
        <span className="font-semibold tabular-nums">{q.cap.toLocaleString()}</span>
        <span className="text-slate-500"> {label}</span>
      </span>
      {/* Inline progress bar */}
      <span className="w-12 h-1 rounded-full bg-white/[0.05] overflow-hidden">
        <span
          className={`block h-full ${colors.bar} transition-all duration-200`}
          style={{ width: `${pct}%` }}
        />
      </span>
      {(q.atCap || q.over) && (
        <Link
          href="/subscription"
          className="text-[10px] uppercase tracking-wider font-bold text-red-200 hover:text-white"
        >
          Upgrade
        </Link>
      )}
    </span>
  );
}
