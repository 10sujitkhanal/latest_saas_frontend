'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Send, LayoutTemplate, FileUp, ArrowRight, ArrowLeft, MapPin, CheckCircle2, FileSignature } from 'lucide-react';
import { agreementsApi, type FieldInput } from '@/lib/agreements/api';
import type { SignerInput } from '@/lib/agreements/types';
import { AGREEMENT_TEMPLATES, renderTemplateBody } from '@/lib/agreements/templates';
import { FieldPlacer, type PlacedField } from '@/components/agreements/FieldPlacer';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';

const inp = 'h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50';

/**
 * The single create-agreement form, reused by the workspace Agreements modal
 * and the owner Documents "Create & send" tab.
 *
 * Step 1 — pick a professional template (or upload a PDF) + details + signers.
 * Step 2 — place signature fields on the document.
 * On success we show a confirmation (NO surprise redirect) with an explicit
 * "Open agreement" action.
 */
export default function AgreementCreateForm({
  workspaceId: fixedWs, pickWorkspace = false, onCreated, onCancel,
}: {
  workspaceId?: string;
  pickWorkspace?: boolean;
  onCreated?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const businessName = useAuthStore((s) => (s as any).business?.name) || '';
  const [step, setStep] = useState<1 | 2>(1);
  const [workspaces, setWorkspaces] = useState<{ id: number; name: string }[]>([]);
  const [workspaceId, setWorkspaceId] = useState(fixedWs || '');
  const [source, setSource] = useState<'template' | 'pdf_upload'>('template');
  const [templateId, setTemplateId] = useState('tmpl-service-standard');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('service');
  const [body, setBody] = useState('');
  const [signingOrder, setSigningOrder] = useState<'parallel' | 'sequential'>('parallel');
  const [expiry, setExpiry] = useState('');
  const [confidential, setConfidential] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [signers, setSigners] = useState<SignerInput[]>([{ role: 'customer', name: '', email: '', partySide: 'external', orderIndex: 0, authMethod: 'typed' }]);
  const [placed, setPlaced] = useState<PlacedField[]>([]);
  const [busy, setBusy] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Seed the first template's body on mount.
  useEffect(() => {
    const t = AGREEMENT_TEMPLATES.find((x) => x.id === templateId) || AGREEMENT_TEMPLATES[0];
    if (!title) setTitle(t.label);
    setType(t.type);
    setBody(renderTemplateBody(t.body, businessName));
    setConfidential(!!t.defaultPrivate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pickWorkspace) return;
    OrganizationService.listWorkspaces().then((res: any) => {
      const arr = Array.isArray(res?.data) ? res.data : (res?.data?.items || res?.data?.results || []);
      const ws = arr.map((w: any) => ({ id: w.id, name: w.name }));
      setWorkspaces(ws);
      setWorkspaceId((cur) => cur || (ws[0] ? String(ws[0].id) : ''));
    }).catch(() => {});
  }, [pickWorkspace]);

  useEffect(() => {
    if (source === 'pdf_upload' && file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setFileUrl(null);
  }, [file, source]);

  const pickTemplate = (id: string) => {
    const t = AGREEMENT_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setTemplateId(id);
    setType(t.type);
    setBody(renderTemplateBody(t.body, businessName));
    setConfidential(!!t.defaultPrivate);
    if (!title || AGREEMENT_TEMPLATES.some((x) => x.label === title)) setTitle(t.label);
  };

  const validSigners = useMemo(
    () => signers.filter((s) => s.email.trim()).map((s, i) => ({ ...s, name: s.name.trim() || s.email.trim(), orderIndex: i })),
    [signers],
  );

  const upRow = (i: number, p: Partial<SignerInput>) => setSigners((prev) => prev.map((s, idx) => idx === i ? { ...s, ...p } : s));
  const addRow = () => setSigners((p) => [...p, { role: 'customer', name: '', email: '', partySide: 'external', orderIndex: p.length, authMethod: 'typed' }]);
  const rmRow = (i: number) => setSigners((p) => p.filter((_, idx) => idx !== i));

  const validateStep1 = (): boolean => {
    if (!workspaceId) { toast.error('Pick a business'); return false; }
    if (!title.trim()) { toast.error('Add a title'); return false; }
    if (validSigners.length === 0) { toast.error('Each signer needs an email address (that’s where the signing link goes).'); return false; }
    if (source === 'pdf_upload' && !file) { toast.error('Choose a PDF'); return false; }
    if (source === 'template' && !body.trim()) { toast.error('The document body is empty'); return false; }
    return true;
  };

  const goPlaceFields = () => { if (validateStep1()) setStep(2); };

  const submit = async (send: boolean) => {
    if (!validateStep1()) return;
    setBusy(true);
    try {
      const common = { title: title.trim(), type, signingOrder, expiryDate: expiry, visibility: confidential ? 'private' : 'team', signers: validSigners };
      const ag = source === 'template'
        ? await agreementsApi.createTemplate(workspaceId, { ...common, templateId, bodyText: body })
        : await agreementsApi.uploadPdf(workspaceId, { ...common, fileName: file!.name, fileSize: file!.size, mimeType: file!.type || 'application/pdf' });
      if (source === 'pdf_upload' && file) {
        try { await agreementsApi.uploadFile(workspaceId, ag.id, file); } catch { /* metadata saved; file optional */ }
      }
      if (placed.length) {
        const ordered = [...(ag.signers || [])].sort((a, b) => a.orderIndex - b.orderIndex);
        const fields: FieldInput[] = placed.map((f) => ({
          signerId: ordered[Number(f.signerKey)]?.id ?? null,
          fieldType: f.fieldType, page: f.page, x: f.x, y: f.y, w: f.w, h: f.h,
          required: true, label: f.label || '',
        }));
        try { await agreementsApi.saveFields(workspaceId, ag.id, fields); } catch { /* fields optional */ }
      }
      if (send) { await agreementsApi.send(workspaceId, ag.id); toast.success('Created & sent for signature'); }
      else toast.success('Draft saved');
      onCreated?.();
      setCreatedId(ag.id);   // show the success panel instead of yanking the page
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Failed to create');
    } finally { setBusy(false); }
  };

  // ── Success panel (no surprise redirect) ─────────────────────────────────
  if (createdId) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><CheckCircle2 className="h-6 w-6" /></div>
        <h3 className="text-lg font-bold text-white">Agreement ready</h3>
        <p className="mt-1 text-sm text-slate-400">It’s saved{confidential ? ' (confidential)' : ''}. Internal parties sign first, then it opens to the others — track or sign it from the agreement.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" onClick={() => onCancel?.()} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03]">Done</button>
          <button type="button" onClick={() => router.push(`/w/${workspaceId}/agreements/${createdId}`)} className="h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2">
            <FileSignature className="h-4 w-4" /> Open agreement
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: field placement ──────────────────────────────────────────────
  if (step === 2) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-400" /> Place signature fields</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Pick a signer + field, then click the document. Drag to move, drag a corner to resize. Each signer sees only their own fields.</p>
          </div>
          <span className="text-[11px] text-slate-500">Step 2 of 2</span>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 max-h-[60vh] overflow-y-auto">
          <FieldPlacer mode={source} pdfUrl={fileUrl} templateText={body} signers={validSigners} fields={placed} onChange={setPlaced} />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="button" onClick={() => setStep(1)} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03] flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</button>
          <button type="button" onClick={() => submit(false)} disabled={busy} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03] disabled:opacity-50">Save draft</button>
          <button type="button" onClick={() => submit(true)} disabled={busy} className="h-10 flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Create & send
          </button>
        </div>
      </div>
    );
  }

  // ── Step 1: details + signers ────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {pickWorkspace && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Business</label>
            <select className={`${inp} mt-1.5`} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
              <option value="" className="bg-slate-900">Select business…</option>
              {workspaces.map((w) => <option key={w.id} value={w.id} className="bg-slate-900">{w.name}</option>)}
            </select>
          </div>
        )}
        <div className={pickWorkspace ? '' : 'col-span-2'}>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Document source</label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {([['template', 'Professional template', LayoutTemplate], ['pdf_upload', 'Upload PDF', FileUp]] as const).map(([v, label, Icon]) => (
              <button key={v} type="button" onClick={() => setSource(v)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium ${source === v ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' : 'border-white/10 text-slate-300 hover:bg-white/[0.03]'}`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {source === 'template' ? (
        <>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Letter type</label>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGREEMENT_TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => pickTemplate(t.id)} title={t.blurb}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${templateId === t.id ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200' : 'border-white/10 text-slate-300 hover:bg-white/[0.03]'}`}>
                  <div className="font-semibold">{t.label}</div>
                  <div className="mt-0.5 text-[10px] text-slate-500 line-clamp-2">{t.blurb}</div>
                </button>
              ))}
            </div>
          </div>
          <input className={inp} placeholder="Agreement title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Document text (editable)</label>
            <textarea className="mt-1.5 w-full h-44 rounded-lg bg-white/[0.03] border border-white/10 p-3 text-[13px] leading-relaxed text-slate-100 focus:outline-none focus:border-emerald-500/50 font-mono" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <input className={inp} placeholder="Agreement title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-white/15 text-sm text-slate-400 cursor-pointer hover:border-emerald-500/40">
            <FileUp className="w-4 h-4" /> {file ? file.name : 'Choose PDF…'}
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <select className={inp} value={signingOrder} onChange={(e) => setSigningOrder(e.target.value as any)}>
          <option value="parallel" className="bg-slate-900">Parallel (any order)</option>
          <option value="sequential" className="bg-slate-900">Sequential (in order)</option>
        </select>
        <input className={inp} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Signers</span>
          <button type="button" onClick={addRow} className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add signer</button>
        </div>
        <div className="space-y-2">
          {signers.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
              <input className={inp} placeholder="Full name" value={s.name} onChange={(e) => upRow(i, { name: e.target.value })} />
              <input className={inp} placeholder="Email (required)" value={s.email} onChange={(e) => upRow(i, { email: e.target.value })} />
              <select className={`${inp} w-28`} value={s.partySide} onChange={(e) => upRow(i, { partySide: e.target.value as any })}>
                <option value="external" className="bg-slate-900">External</option>
                <option value="internal" className="bg-slate-900">Internal</option>
              </select>
              <button type="button" onClick={() => rmRow(i)} disabled={signers.length === 1} className="w-9 h-9 rounded-lg bg-white/[0.03] text-slate-500 hover:text-rose-400 flex items-center justify-center disabled:opacity-30 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5">Each signer gets a unique signing link by email. Mark yourself <b>Internal</b> to counter-sign first; external parties sign after.</p>
      </div>

      <label className="flex items-start gap-2 cursor-pointer select-none rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-600" />
        <span className="text-xs text-slate-300">Confidential — only owners/admins (and signers) can see this. Staff won’t see it. <span className="text-slate-500">(Auto-on for NDAs &amp; employment.)</span></span>
      </label>

      <div className="flex items-center gap-3 pt-1">
        {onCancel && <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03]">Cancel</button>}
        <button type="button" onClick={() => submit(false)} disabled={busy} className="h-10 px-4 rounded-lg border border-white/10 text-slate-300 text-sm hover:bg-white/[0.03] disabled:opacity-50">Save draft</button>
        <button type="button" onClick={goPlaceFields} disabled={busy} className="h-10 flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          Next: place fields <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
