'use client';

import { use as reactUse, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileCheck, Loader2, ChevronRight, Download, ShieldCheck } from 'lucide-react';
import { agreementsApi } from '@/lib/agreements/api';
import type { Agreement } from '@/lib/agreements/types';

export default function SignedDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = reactUse(params);
  const [items, setItems] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await agreementsApi.list(workspaceId, { status: 'completed' })); }
    catch { toast.error('Failed to load documents'); }
    finally { setLoading(false); }
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileCheck className="w-6 h-6 text-emerald-400" /> Signed documents</h1>
          <p className="text-sm text-slate-400 mt-1">Completed, legally-binding agreements and their audit trail.</p>
        </div>
        <Link href={`/w/${workspaceId}/agreements`} className="text-sm text-emerald-300 hover:text-emerald-200">All agreements →</Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
          <FileCheck className="w-9 h-9 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-300">No signed documents yet</p>
          <p className="text-xs text-slate-500 mt-1">Completed agreements appear here with their final PDF and audit certificate.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 overflow-hidden">
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate">{a.title}</div>
                <div className="text-[11px] text-slate-500 mt-0.5 capitalize">
                  {a.type} · {a.signers.length} signer(s) · completed {a.completedAt ? new Date(a.completedAt).toLocaleDateString() : ''}
                </div>
              </div>
              {a.finalPdfUrl && (
                <a href={a.finalPdfUrl} target="_blank" rel="noreferrer"
                  className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0">
                  <Download className="w-3.5 h-3.5" /> Final PDF
                </a>
              )}
              <Link href={`/w/${workspaceId}/agreements/${a.id}`} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center shrink-0">
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
