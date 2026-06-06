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
import { businessCurrency } from '@/lib/currency';

const inp = 'h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50';

// Commission bases: money bases use a % rate; count bases use a per-unit amount.
const COMMISSION_BASES: { key: string; label: string; money: boolean }[] = [
  { key: 'total_sales', label: 'Total sales (%)', money: true },
  { key: 'online_sales', label: 'Online/order sales (%)', money: true },
  { key: 'leads', label: 'Per lead', money: false },
  { key: 'new_customers', label: 'Per new customer', money: false },
  { key: 'bookings', label: 'Per booking', money: false },
];
const COMMISSION_PRESETS: { label: string; rules: { basis: string; rate: string }[] }[] = [
  { label: '10% of sales', rules: [{ basis: 'total_sales', rate: '10' }] },
  { label: '5% + 50/lead', rules: [{ basis: 'total_sales', rate: '5' }, { basis: 'leads', rate: '50' }] },
  { label: 'Per booking 30', rules: [{ basis: 'bookings', rate: '30' }] },
  { label: '8% online sales', rules: [{ basis: 'online_sales', rate: '8' }] },
];
const isMoneyBasis = (b: string) => COMMISSION_BASES.find((x) => x.key === b)?.money ?? true;

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
  // Commercial terms (agency↔client contracts)
  const [billingModel, setBillingModel] = useState<'none' | 'retainer' | 'commission' | 'hybrid' | 'performance'>('none');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [setupFee, setSetupFee] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  // Multiple commission rules per contract (basis × rate). Money bases may use
  // progressive tiers instead of a flat rate.
  const [rules, setRules] = useState<{ basis: string; rate: string; tiers?: { up_to: string; rate: string }[] }[]>([]);
  const [sla, setSla] = useState('');
  const [deliverables, setDeliverables] = useState('');

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
      const terms = billingModel !== 'none' ? {
        billingModel, monthlyFee, setupFee, durationMonths, sla, deliverables,
        currency: businessCurrency(),
        commissionRules: rules
          .map((r) => {
            const tiers = isMoneyBasis(r.basis)
              ? (r.tiers || []).filter((t) => t.rate && Number(t.rate) > 0).map((t) => ({ up_to: t.up_to === '' ? null : Number(t.up_to), rate: Number(t.rate) }))
              : [];
            return { basis: r.basis, rate: r.rate || '0', tiers };
          })
          .filter((r) => (r.rate && Number(r.rate) > 0) || r.tiers.length > 0),
      } : {};
      const ag = source === 'template'
        ? await agreementsApi.createTemplate(workspaceId, { ...common, templateId, bodyText: body, ...terms })
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

      {/* Commercial terms — for agency↔client contracts (drives the commission engine) */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Commercial terms</span>
          <select className={`${inp} w-auto h-8 text-xs`} value={billingModel} onChange={(e) => setBillingModel(e.target.value as any)}>
            <option value="none" className="bg-slate-900">No money terms</option>
            <option value="retainer" className="bg-slate-900">Fixed retainer</option>
            <option value="commission" className="bg-slate-900">Commission (% of sales)</option>
            <option value="hybrid" className="bg-slate-900">Hybrid (retainer + %)</option>
            <option value="performance" className="bg-slate-900">Performance (per lead)</option>
          </select>
        </div>
        {billingModel !== 'none' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(billingModel === 'retainer' || billingModel === 'hybrid') && (
                <label className="text-[11px] text-slate-400">Monthly fee ({businessCurrency()})
                  <input className={`${inp} mt-1`} type="number" min="0" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} placeholder="500" />
                </label>
              )}
              <label className="text-[11px] text-slate-400">Setup fee ({businessCurrency()})
                <input className={`${inp} mt-1`} type="number" min="0" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} placeholder="0" />
              </label>
              <label className="text-[11px] text-slate-400">Duration (months)
                <input className={`${inp} mt-1`} type="number" min="0" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} placeholder="12" />
              </label>
            </div>

            {/* Commission rules — multiple bases per contract */}
            {billingModel !== 'retainer' && (
              <div className="rounded-lg border border-white/10 bg-white/[0.015] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-400">Commission rules</span>
                  <button type="button" onClick={() => setRules((p) => [...p, { basis: 'total_sales', rate: '' }])} className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Add rule</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COMMISSION_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => setRules(p.rules.map((r) => ({ ...r })))} className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20">{p.label}</button>
                  ))}
                </div>
                {rules.length === 0 && <p className="text-[10px] text-slate-500">Add a rule or pick a preset. Commission accrues from the client’s on-platform activity and auto-invoices.</p>}
                {rules.map((r, i) => {
                  const money = isMoneyBasis(r.basis);
                  const tiered = !!r.tiers && r.tiers.length > 0;
                  const setRule = (patch: any) => setRules((p) => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));
                  return (
                  <div key={i} className="rounded-lg border border-white/5 bg-white/[0.015] p-2 space-y-1.5">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                      <select className={`${inp} h-9`} value={r.basis} onChange={(e) => setRule({ basis: e.target.value, tiers: [] })}>
                        {COMMISSION_BASES.map((b) => <option key={b.key} value={b.key} className="bg-slate-900">{b.label}</option>)}
                      </select>
                      <div className="relative">
                        <input className={`${inp} h-9 w-28 pr-7 disabled:opacity-40`} type="number" min="0" disabled={tiered} value={r.rate} placeholder={money ? '10' : '50'} onChange={(e) => setRule({ rate: e.target.value })} />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{money ? '%' : businessCurrency()}</span>
                      </div>
                      <button type="button" onClick={() => setRules((p) => p.filter((_, idx) => idx !== i))} className="w-8 h-8 rounded-lg bg-white/[0.03] text-slate-500 hover:text-rose-400 flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    {money && (
                      <div className="pl-0.5">
                        <button type="button" onClick={() => setRule({ tiers: tiered ? [] : [{ up_to: '', rate: r.rate || '' }] })} className="text-[10px] font-semibold text-emerald-300/80 hover:text-emerald-200">{tiered ? '− Use flat rate' : '+ Use tiered rates'}</button>
                        {tiered && (
                          <div className="mt-1.5 space-y-1.5">
                            <p className="text-[10px] text-slate-500">Progressive bands — each rate applies to the portion of sales within that band. Leave the last band’s “up to” empty for “and above”.</p>
                            {(r.tiers || []).map((t, ti) => {
                              const setTier = (patch: any) => setRule({ tiers: (r.tiers || []).map((x, k) => k === ti ? { ...x, ...patch } : x) });
                              const last = ti === (r.tiers!.length - 1);
                              return (
                                <div key={ti} className="grid grid-cols-[auto_1fr_auto_auto] gap-1.5 items-center text-[11px]">
                                  <span className="text-slate-500">up to</span>
                                  <input className={`${inp} h-8`} type="number" min="0" value={t.up_to} placeholder={last ? '∞ (and above)' : '100000'} onChange={(e) => setTier({ up_to: e.target.value })} />
                                  <div className="relative">
                                    <input className={`${inp} h-8 w-20 pr-6`} type="number" min="0" value={t.rate} placeholder="10" onChange={(e) => setTier({ rate: e.target.value })} />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">%</span>
                                  </div>
                                  <button type="button" onClick={() => setRule({ tiers: (r.tiers || []).filter((_, k) => k !== ti) })} className="w-7 h-7 rounded-lg bg-white/[0.03] text-slate-500 hover:text-rose-400 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              );
                            })}
                            <button type="button" onClick={() => setRule({ tiers: [...(r.tiers || []), { up_to: '', rate: '' }] })} className="text-[10px] font-semibold text-emerald-300/80 hover:text-emerald-200 flex items-center gap-1"><Plus className="w-3 h-3" /> Add band</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            <input className={inp} placeholder="Deliverables (e.g. 4 blog posts/mo, monthly report)" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} />
            <input className={inp} placeholder="SLA (e.g. 24h response, 99% uptime)" value={sla} onChange={(e) => setSla(e.target.value)} />
          </>
        )}
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
