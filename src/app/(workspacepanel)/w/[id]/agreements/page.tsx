'use client';

import { use as reactUse, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  FileSignature, Plus, X, Trash2, Loader2, FileUp, LayoutTemplate, ChevronRight, Lock,
} from 'lucide-react';
import { agreementsApi } from '@/lib/agreements/api';
import { STATUS_LABEL, type Agreement, type SignerInput } from '@/lib/agreements/types';

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
const TYPES = ['service', 'sales', 'nda', 'employment', 'partnership', 'custom'];

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
  const [source, setSource] = useState<'template' | 'pdf_upload'>('template');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('service');
  const [signingOrder, setSigningOrder] = useState<'parallel' | 'sequential'>('parallel');
  const [expiry, setExpiry] = useState('');
  const [confidential, setConfidential] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<SignerInput[]>([
    { role: 'customer', name: '', email: '', partySide: 'external', orderIndex: 0, authMethod: 'typed' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => setSigners((p) => [...p, { role: 'customer', name: '', email: '', partySide: 'external', orderIndex: p.length, authMethod: 'typed' }]);
  const upRow = (i: number, patch: Partial<SignerInput>) => setSigners((p) => p.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const rmRow = (i: number) => setSigners((p) => p.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title.trim()) { toast.error('Add a title'); return; }
    const valid = signers.filter((s) => s.name && s.email);
    if (valid.length === 0) { toast.error('Add at least one signer with name + email'); return; }
    if (source === 'pdf_upload' && !file) { toast.error('Choose a PDF'); return; }
    setSubmitting(true);
    try {
      const common = { title: title.trim(), type, signingOrder, expiryDate: expiry, visibility: confidential ? 'private' : 'team', signers: valid.map((s, i) => ({ ...s, orderIndex: i })) };
      const ag = source === 'template'
        ? await agreementsApi.createTemplate(workspaceId, common)
        : await agreementsApi.uploadPdf(workspaceId, { ...common, fileName: file!.name, fileSize: file!.size, mimeType: file!.type || 'application/pdf' });
      toast.success('Agreement created');
      onCreated();
      onClose();
      // soft navigate
      window.location.href = `/w/${workspaceId}/agreements/${ag.id}`;
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create');
    } finally { setSubmitting(false); }
  };

  const inp = 'h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] px-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0a1120] shadow-2xl max-h-[88vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">New agreement</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            {([['template', 'From template', LayoutTemplate], ['pdf_upload', 'Upload PDF', FileUp]] as const).map(([v, label, Icon]) => (
              <button key={v} onClick={() => setSource(v)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${source === v ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-slate-300 hover:bg-white/[0.03]'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <input className={inp} placeholder="Agreement title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <select className={inp} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t} className="bg-slate-900 capitalize">{t}</option>)}
            </select>
            <select className={inp} value={signingOrder} onChange={(e) => setSigningOrder(e.target.value as any)}>
              <option value="parallel" className="bg-slate-900">Parallel (any order)</option>
              <option value="sequential" className="bg-slate-900">Sequential (in order)</option>
            </select>
          </div>
          {source === 'pdf_upload' && (
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/15 text-sm text-slate-400 cursor-pointer hover:border-emerald-500/40">
              <FileUp className="w-4 h-4" /> {file ? file.name : 'Choose PDF…'}
              <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Signers</span>
              <button onClick={addRow} className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
            <div className="space-y-2">
              {signers.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={`${inp} flex-1`} placeholder="Name" value={s.name} onChange={(e) => upRow(i, { name: e.target.value })} />
                  <input className={`${inp} flex-1`} placeholder="Email" value={s.email} onChange={(e) => upRow(i, { email: e.target.value })} />
                  <select className={`${inp} w-28`} value={s.partySide} onChange={(e) => upRow(i, { partySide: e.target.value as any })}>
                    <option value="external" className="bg-slate-900">External</option>
                    <option value="internal" className="bg-slate-900">Internal</option>
                  </select>
                  <button onClick={() => rmRow(i)} disabled={signers.length === 1} className="w-9 h-9 rounded-lg bg-white/[0.03] text-slate-500 hover:text-rose-400 flex items-center justify-center disabled:opacity-30 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">Internal parties counter-sign first; external parties sign after.</p>
          </div>
          <input className={inp} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <label className="flex items-start gap-2 cursor-pointer select-none rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-600" />
            <span className="text-xs text-slate-300">Confidential — only owners/admins (and signers) can see this. Staff won't see it in their Documents.</span>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03]">Cancel</button>
          <button onClick={submit} disabled={submitting} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}
