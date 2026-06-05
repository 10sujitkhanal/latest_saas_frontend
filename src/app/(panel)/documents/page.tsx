'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { PageSpinner } from '@/components/StateViews';
import { OrganizationService } from '@/services/organization.service';
import { FileSignature, FileCheck, Clock, PencilLine, ChevronRight, Download } from 'lucide-react';

interface DocItem {
  id: string; title: string; type: string; status: string;
  workspace_id: number; workspace_name: string; signers: number; signed: number;
  created_at: string; completed_at: string | null; expiry_date: string;
  final_pdf_url: string; link: string;
}
interface Summary { total: number; draft: number; pending: number; completed: number; }

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  pending_internal: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  sent: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  partially_signed: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  declined: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  expired: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
};
const FILTERS = [
  { k: '', label: 'All' }, { k: 'sent', label: 'Awaiting' },
  { k: 'partially_signed', label: 'Partial' }, { k: 'completed', label: 'Signed' }, { k: 'draft', label: 'Drafts' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [items, setItems] = useState<DocItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.getDocuments(filter || undefined);
      if (res?.success) { setItems(res.data.items || []); setSummary(res.data.summary || null); }
    } finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Total', value: summary?.total ?? 0, Icon: FileSignature, color: 'text-slate-300 bg-white/[0.04]' },
    { label: 'Awaiting signature', value: summary?.pending ?? 0, Icon: Clock, color: 'text-amber-300 bg-amber-500/10' },
    { label: 'Signed', value: summary?.completed ?? 0, Icon: FileCheck, color: 'text-emerald-300 bg-emerald-500/10' },
    { label: 'Drafts', value: summary?.draft ?? 0, Icon: PencilLine, color: 'text-slate-400 bg-white/[0.04]' },
  ];

  return (
    <>
      <Topbar title="Documents" subtitle="Every agreement across your businesses — at a glance." />
      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {loading && !summary ? <PageSpinner /> : (
          <div className="space-y-6 max-w-5xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((c) => (
                <div key={c.label} className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{c.label}</span>
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.color}`}><c.Icon className="w-4 h-4" /></span>
                  </div>
                  <div className="text-2xl font-bold text-white mt-2">{c.value}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-lg p-0.5 w-fit">
              {FILTERS.map((f) => (
                <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${filter === f.k ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{f.label}</button>
              ))}
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
                <FileSignature className="w-9 h-9 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-300">No documents{filter ? ' in this view' : ' yet'}</p>
                <p className="text-xs text-slate-500 mt-1">Create agreements inside a workspace; they roll up here.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 overflow-hidden">
                {items.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={() => router.push(d.link)}>
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-emerald-300 shrink-0"><FileSignature className="w-4 h-4" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate">{d.title}</div>
                      <div className="text-[11px] text-slate-500 capitalize mt-0.5">{d.workspace_name} · {d.type} · {d.signed}/{d.signers} signed</div>
                    </div>
                    {d.status === 'completed' && d.final_pdf_url && (
                      <a href={d.final_pdf_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0"><Download className="w-3.5 h-3.5" /> PDF</a>
                    )}
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLE[d.status] || STATUS_STYLE.draft}`}>{d.status.replace('_', ' ')}</span>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-300 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
