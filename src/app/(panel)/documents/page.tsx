'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Topbar from '@/components/Topbar';
import { PageSpinner } from '@/components/StateViews';
import { OrganizationService } from '@/services/organization.service';
import {
  FileSignature, FileCheck, Clock, PencilLine, ChevronRight, Download, Lock,
  Users, Plus, X, Trash2, Loader2, UploadCloud,
} from 'lucide-react';

type Tab = 'agreements' | 'staff';

export default function DocumentsPage() {
  const [tab, setTab] = useState<Tab>('agreements');
  return (
    <>
      <Topbar title="Documents" subtitle="Agreements & staff documents across your businesses." />
      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        <div className="flex gap-1 mb-6 border-b border-white/5">
          {([['agreements', 'Agreements', FileSignature], ['staff', 'Staff documents', Users]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === id ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
        {tab === 'agreements' ? <AgreementsTab /> : <StaffDocsTab />}
      </main>
    </>
  );
}

// ── Agreements (cross-business aggregation) ──────────────────────────────────
interface DocItem {
  id: string; title: string; type: string; status: string; workspace_id: number; workspace_name: string;
  signers: number; signed: number; completed_at: string | null; visibility?: string; final_pdf_url: string; link: string;
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
const FILTERS = [{ k: '', label: 'All' }, { k: 'sent', label: 'Awaiting' }, { k: 'partially_signed', label: 'Partial' }, { k: 'completed', label: 'Signed' }, { k: 'draft', label: 'Drafts' }];

function AgreementsTab() {
  const router = useRouter();
  const [items, setItems] = useState<DocItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await OrganizationService.getDocuments(filter || undefined); if (res?.success) { setItems(res.data.items || []); setSummary(res.data.summary || null); } }
    finally { setLoading(false); }
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: 'Total', value: summary?.total ?? 0, Icon: FileSignature, color: 'text-slate-300 bg-white/[0.04]' },
    { label: 'Awaiting signature', value: summary?.pending ?? 0, Icon: Clock, color: 'text-amber-300 bg-amber-500/10' },
    { label: 'Signed', value: summary?.completed ?? 0, Icon: FileCheck, color: 'text-emerald-300 bg-emerald-500/10' },
    { label: 'Drafts', value: summary?.draft ?? 0, Icon: PencilLine, color: 'text-slate-400 bg-white/[0.04]' },
  ];
  if (loading && !summary) return <PageSpinner />;
  return (
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
        {FILTERS.map((f) => <button key={f.k} onClick={() => setFilter(f.k)} className={`px-3 py-1.5 rounded-md text-xs font-semibold ${filter === f.k ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{f.label}</button>)}
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
                <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">{d.title}{d.visibility === 'private' && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}</div>
                <div className="text-[11px] text-slate-500 capitalize mt-0.5">{d.workspace_name} · {d.type} · {d.signed}/{d.signers} signed</div>
              </div>
              {d.status === 'completed' && d.final_pdf_url && (
                <a href={d.final_pdf_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0"><Download className="w-3.5 h-3.5" /> PDF</a>
              )}
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLE[d.status] || STATUS_STYLE.draft}`}>{d.status.replace('_', ' ')}</span>
              <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Staff documents ──────────────────────────────────────────────────────────
interface StaffDoc { id: number; staff_id: number; staff_name: string; title: string; category: string; file_url: string | null; employee_can_view: boolean; created_at: string; }
interface StaffOpt { id: number; name: string; }
const CATEGORIES = [
  { k: 'contract', l: 'Contract' }, { k: 'id', l: 'ID / Verification' }, { k: 'certification', l: 'Certification' },
  { k: 'payslip', l: 'Payslip' }, { k: 'policy', l: 'Policy' }, { k: 'other', l: 'Other' },
];

function StaffDocsTab() {
  const [docs, setDocs] = useState<StaffDoc[]>([]);
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await OrganizationService.getStaffDocuments(); if (res?.success) setDocs(res.data.items || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    OrganizationService.listStaff().then((res: any) => {
      const arr = Array.isArray(res?.data) ? res.data : (res?.data?.items || res?.data?.results || []);
      setStaff(arr.map((s: any) => ({ id: s.id, name: s.full_name || s.name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || `Staff #${s.id}` })));
    }).catch(() => {});
  }, []);

  const remove = async (id: number) => {
    if (!confirm('Delete this document?')) return;
    try { await OrganizationService.deleteStaffDocument(id); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  if (loading) return <PageSpinner />;
  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">HR documents per employee — confidential to owners/HR unless shared with the employee.</p>
        <button onClick={() => setShowUpload(true)} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4" /> Upload</button>
      </div>
      {docs.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
          <Users className="w-9 h-9 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-300">No staff documents yet</p>
          <p className="text-xs text-slate-500 mt-1">Upload contracts, IDs, certifications and payslips against an employee.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 overflow-hidden">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-emerald-300 shrink-0"><FileCheck className="w-4 h-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white truncate flex items-center gap-1.5">{d.title}{!d.employee_can_view && <Lock className="w-3 h-3 text-amber-400 shrink-0" />}</div>
                <div className="text-[11px] text-slate-500 capitalize mt-0.5">{d.staff_name} · {d.category}{d.employee_can_view ? ' · visible to employee' : ''}</div>
              </div>
              {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 shrink-0"><Download className="w-3.5 h-3.5" /> Download</a>}
              <button onClick={() => remove(d.id)} className="w-7 h-7 rounded-lg bg-white/[0.04] text-slate-500 hover:text-rose-400 flex items-center justify-center shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}
      {showUpload && <UploadModal staff={staff} onClose={() => setShowUpload(false)} onDone={load} />}
    </div>
  );
}

function UploadModal({ staff, onClose, onDone }: { staff: StaffOpt[]; onClose: () => void; onDone: () => void }) {
  const [staffId, setStaffId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('contract');
  const [empView, setEmpView] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inp = 'h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 text-sm text-slate-100 focus:outline-none focus:border-emerald-500/50';

  const submit = async () => {
    if (!staffId) { toast.error('Pick an employee'); return; }
    if (!file) { toast.error('Choose a file'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('staff_id', staffId); fd.append('title', title || file.name); fd.append('category', category);
      fd.append('employee_can_view', empView ? 'true' : 'false'); fd.append('file', file);
      const res = await OrganizationService.uploadStaffDocument(fd);
      if (res?.success) { toast.success('Uploaded'); onDone(); onClose(); }
      else toast.error(res?.message || 'Upload failed');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Upload failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a1120] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Upload staff document</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <select className={inp} value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            <option value="" className="bg-slate-900">Select employee…</option>
            {staff.map((s) => <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>)}
          </select>
          <input className={inp} placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={inp} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.k} value={c.k} className="bg-slate-900">{c.l}</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/15 text-sm text-slate-400 cursor-pointer hover:border-emerald-500/40">
            <UploadCloud className="w-4 h-4" /> {file ? file.name : 'Choose file…'}
            <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={empView} onChange={(e) => setEmpView(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-600" />
            <span className="text-xs text-slate-400">Let the employee view their copy (otherwise owner/HR only).</span>
          </label>
        </div>
        <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03]">Cancel</button>
          <button onClick={submit} disabled={busy} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Upload
          </button>
        </div>
      </div>
    </div>
  );
}
