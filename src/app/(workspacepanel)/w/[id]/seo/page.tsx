'use client';

import { use as reactUse } from 'react';
import Link from 'next/link';
import { MapPin, MessageSquare, ArrowRight } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageHeader } from '@/components/accounting/kit';
import SeoAgentCard from '@/components/agents/SeoAgentCard';

/**
 * SEO & AI Visibility — a real page (no longer a redirect to AI Staff). It
 * surfaces the SEO agent's audit + AEO composer right here, plus quick links to
 * the Business Profile and Reviews sub-pages.
 */
export default function SeoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = reactUse(params);
  return (
    <PermissionGuard service="content" required="seo.audit.run" workspaceId={id} skeleton="list">
      <div className="space-y-5">
        <PageHeader title="SEO & AI Visibility" subtitle="Audit your site, fix what hurts ranking + AI answer-engine visibility, and draft optimized content." />

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href={`/w/${id}/seo/business-profile`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04]">
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15"><MapPin className="h-4 w-4 text-emerald-300" /></span>
              <span><span className="block text-sm font-semibold text-white">Business Profile</span><span className="block text-xs text-slate-400">Name, address, hours, categories — the AI-visibility basics.</span></span>
            </span>
            <ArrowRight className="h-4 w-4 text-slate-500" />
          </Link>
          <Link href={`/w/${id}/seo/reviews`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.04]">
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/15"><MessageSquare className="h-4 w-4 text-emerald-300" /></span>
              <span><span className="block text-sm font-semibold text-white">Reviews</span><span className="block text-xs text-slate-400">Monitor reviews and let the agent draft replies.</span></span>
            </span>
            <ArrowRight className="h-4 w-4 text-slate-500" />
          </Link>
        </div>

        {/* The SEO agent's audit + AEO composer, inline */}
        <SeoAgentCard workspaceId={id} />
      </div>
    </PermissionGuard>
  );
}
