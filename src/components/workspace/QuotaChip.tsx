'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gauge } from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';

/**
 * Inline plan-quota chip.
 *
 * Drop this on any list/create page (Workflows, Contacts, Sources,
 * Channels, Pipelines) to show the current usage vs cap and a deep-link
 * to /leads/quotas when the user wants the full picture.
 *
 * Usage:
 *   <QuotaChip quota="workflows" workspaceId={id} />
 *   <QuotaChip quota="contacts" workspaceId={id} className="ml-2" />
 *
 * The chip is silent (renders nothing) until the data loads — so it never
 * causes a layout flash.
 */

interface QuotaSlot {
  label: string;
  used: number;
  cap: number;
  unlimited: boolean;
  remaining: number | null;
  percent: number;
  over: boolean;
}

interface QuotaStatusPayload extends Record<string, QuotaSlot | unknown> {
  _meta?: { plan_name: string; status: string; audit_log_retention_days: number };
}

export default function QuotaChip({
  quota, workspaceId, className = '',
}: {
  quota: string;
  workspaceId: number | string;
  className?: string;
}) {
  const [slot, setSlot] = useState<QuotaSlot | null>(null);

  useEffect(() => {
    let cancelled = false;
    OrganizationService.quotaStatus().then((res) => {
      if (cancelled || !res?.success) return;
      const data = res.data as QuotaStatusPayload;
      const got = data[quota];
      if (got && typeof got === 'object' && 'cap' in got) {
        setSlot(got as QuotaSlot);
      }
    });
    return () => { cancelled = true; };
  }, [quota]);

  if (!slot) return null;

  const tone = slot.over
    ? 'bg-red-500/15 text-red-300 border-red-500/30'
    : slot.percent >= 80
    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';

  return (
    <Link
      href={`/w/${workspaceId}/leads/quotas`}
      title={slot.over ? 'Quota reached — upgrade your plan' : `Used ${slot.used} of ${slot.cap} ${slot.label}`}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${tone} ${className}`}
    >
      <Gauge className="w-3 h-3" />
      {slot.unlimited
        ? <>Unlimited {slot.label}</>
        : <>{slot.used} / {slot.cap} {slot.label}</>}
    </Link>
  );
}
