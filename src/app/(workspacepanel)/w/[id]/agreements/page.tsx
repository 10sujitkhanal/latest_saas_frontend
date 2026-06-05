'use client';

import { use as reactUse, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { FileSignature, Plus, X, ChevronRight, Lock, Loader2 } from 'lucide-react';
import { agreementsApi } from '@/lib/agreements/api';
import { STATUS_LABEL, type Agreement } from '@/lib/agreements/types';
import AgreementCreateForm from '@/components/agreements/AgreementCreateForm';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  pending_internal: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  sent: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  partially_signed: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  declined: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  expired: 'bg-rose-500/10 text-rose-300 border-rose-500/20',
};

function StatusBadge({ s }: { s: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLE[s] || STATUS_STYLE.draft}`}>{STATUS_LABEL[s as keyof typeof STATUS_LABEL] || s}</span>;
}

export default function AgreementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = reactUse(params);
  const [items, setItems] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await agreementsApi.list(workspaceId)); }
    catch { toast.error('Failed to load agreements'); }
    finally { setLoading(false); }
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileSignature className="w-6 h-6 text-emerald-400" /> Agreements</h1>
          <p className="text-sm text-slate-400 mt-1">Send documents for legally-binding e-signature.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> New agreement
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 text-sm py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
          <FileSignature className="w-9 h-9 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-300">No agreements yet</p>
          <p className="text-xs text-slate-500 mt-1">Create one from a template or upload a PDF to get it signed.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 overflow-hidden">
          {items.map((a) => {
            const signed = a.signers.filter((s) => s.status === 'signed').length;
            return (
              <Link key={a.id} href={`/w/${workspaceId}/agreements/${a.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.03] transition-colors group">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-emerald-300 shrink-0">
                  <FileSignature className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                    {a.title}
                    {a.visibility === 'private' && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-slate-500 capitalize mt-0.5">{a.type} · {a.signers.length} signer(s) · {signed}/{a.signers.length} signed</div>
                </div>
                <StatusBadge s={a.status} />
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-300 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {showCreate && <CreateModal workspaceId={workspaceId} onClose={() => setShowCreate(false)} onCreated={load} />}
    </div>
  );
}

function CreateModal({ workspaceId, onClose, onCreated }: { workspaceId: string; onClose: () => void; onCreated: () => void }) {
  // Reuses the shared AgreementCreateForm (single source of truth for the form).
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] px-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a1120] shadow-2xl max-h-[88vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">New agreement</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 overflow-y-auto">
          <AgreementCreateForm workspaceId={workspaceId} onCreated={() => { onCreated(); onClose(); }} onCancel={onClose} />
        </div>
      </div>
    </div>
  );
}
