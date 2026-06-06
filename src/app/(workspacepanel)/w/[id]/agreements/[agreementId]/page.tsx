'use client';

import { use as reactUse, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Send, Copy, Check, Loader2, Clock, XCircle, CheckCircle2, Mail,
  FileSignature, ShieldCheck, History, DollarSign,
} from 'lucide-react';
import { agreementsApi } from '@/lib/agreements/api';
import { STATUS_LABEL, type Agreement, type AgreementAuditEvent, type AgreementSigner } from '@/lib/agreements/types';
import { formatMoney } from '@/lib/currency';

const BASIS_LABEL: Record<string, string> = {
  total_sales: 'Total sales', online_sales: 'Online sales', leads: 'Leads', new_customers: 'New customers', bookings: 'Bookings',
};
const MONEY_BASIS = new Set(['total_sales', 'online_sales']);

const SIGNER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  signed: CheckCircle2, declined: XCircle, sent: Mail, pending: Clock,
};
const SIGNER_COLOR: Record<string, string> = {
  signed: 'text-emerald-400', declined: 'text-rose-400', sent: 'text-sky-400', pending: 'text-slate-500',
};

export default function AgreementDetailPage({ params }: { params: Promise<{ id: string; agreementId: string }> }) {
  const { id: workspaceId, agreementId } = reactUse(params);
  const [ag, setAg] = useState<Agreement | null>(null);
  const [audit, setAudit] = useState<AgreementAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, ev] = await Promise.all([
        agreementsApi.get(workspaceId, agreementId),
        agreementsApi.audit(workspaceId, agreementId).catch(() => []),
      ]);
      setAg(a); setAudit(ev);
    } catch { toast.error('Failed to load agreement'); }
    finally { setLoading(false); }
  }, [workspaceId, agreementId]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    setSending(true);
    try { await agreementsApi.send(workspaceId, agreementId); toast.success('Sent for signature'); load(); }
    catch (e: any) { toast.error(e?.response?.data?.error || 'Could not send'); }
    finally { setSending(false); }
  };

  const copyLink = (s: AgreementSigner) => {
    const url = `${window.location.origin}/sign/${s.signingToken}`;
    navigator.clipboard.writeText(url);
    setCopied(s.id); setTimeout(() => setCopied(null), 1500);
    toast.success('Signing link copied');
  };

  if (loading) return <div className="flex items-center gap-2 text-slate-500 text-sm py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  if (!ag) return <div className="text-slate-400 text-sm">Agreement not found.</div>;

  const canSend = ag.status === 'draft' || ag.status === 'pending_internal';
  const signedCount = ag.signers.filter((s) => s.status === 'signed').length;

  return (
    <div className="max-w-4xl">
      <Link href={`/w/${workspaceId}/agreements`} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white mb-4"><ArrowLeft className="w-4 h-4" /> Agreements</Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><FileSignature className="w-6 h-6 text-emerald-400" /> {ag.title}</h1>
          <p className="text-sm text-slate-400 mt-1 capitalize">{ag.type} · {ag.signingOrder} signing · {signedCount}/{ag.signers.length} signed</p>
        </div>
        {canSend && (
          <button onClick={send} disabled={sending} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50 shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send for signature
          </button>
        )}
      </div>

      {ag.originalPdfUrl ? (
        <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2"><FileSignature className="w-3.5 h-3.5 text-emerald-400" /> Document</span>
            <a href={ag.originalPdfUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200">Open ↗</a>
          </div>
          <iframe src={ag.originalPdfUrl} className="w-full h-[60vh] bg-white" title="Agreement document" />
        </div>
      ) : ag.bodyText ? (
        <div className="mb-6 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
            <FileSignature className="w-3.5 h-3.5 text-emerald-400" /><span className="text-xs font-semibold text-slate-300">Document</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto bg-white">
            <div className="mx-auto max-w-[700px] whitespace-pre-wrap px-8 py-8 text-[12.5px] leading-7 text-slate-800" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>{ag.bodyText}</div>
          </div>
        </div>
      ) : null}

      {ag.billingModel && ag.billingModel !== 'none' && (
        <div className="mb-6 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 p-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-emerald-400" /> Commercial terms <span className="text-[10px] uppercase tracking-wider text-emerald-300/70">{ag.billingModel}</span></h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {ag.monthlyFee && Number(ag.monthlyFee) > 0 && <Term label="Monthly fee" value={formatMoney(ag.monthlyFee, ag.currency)} />}
            {ag.setupFee && Number(ag.setupFee) > 0 && <Term label="Setup fee" value={formatMoney(ag.setupFee, ag.currency)} />}
            {ag.durationMonths ? <Term label="Duration" value={`${ag.durationMonths} months`} /> : null}
            {(ag.commissionRules || []).map((r) => (
              <Term key={r.id} label={`Commission · ${BASIS_LABEL[r.basis] || r.basis}`} value={
                r.tiers && r.tiers.length > 0
                  ? r.tiers.map((t) => `${t.rate}%${t.up_to != null ? ` ≤${formatMoney(String(t.up_to), ag.currency)}` : '+'}`).join(', ')
                  : MONEY_BASIS.has(r.basis) ? `${r.rate}%` : `${formatMoney(r.rate, ag.currency)}/unit`
              } />
            ))}
            {/* legacy single-pct contracts */}
            {(!ag.commissionRules || ag.commissionRules.length === 0) && ag.commissionPct && Number(ag.commissionPct) > 0 && <Term label="Commission" value={`${ag.commissionPct}% of sales`} />}
          </div>
          {ag.deliverables && <p className="mt-3 text-[13px] text-slate-300"><span className="text-slate-500">Deliverables:</span> {ag.deliverables}</p>}
          {ag.sla && <p className="mt-1 text-[13px] text-slate-300"><span className="text-slate-500">SLA:</span> {ag.sla}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Signers */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" /> Signers</h2>
          {ag.signers.sort((a, b) => a.orderIndex - b.orderIndex).map((s) => {
            const Icon = SIGNER_ICON[s.status] || Clock;
            return (
              <div key={s.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 shrink-0 ${SIGNER_COLOR[s.status]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">{s.name || '—'} <span className="text-[10px] uppercase tracking-wider text-slate-500 ml-1">{s.role} · {s.partySide}</span></div>
                    <div className="text-[11px] text-slate-500 truncate">{s.email}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.status}</span>
                </div>
                {s.status !== 'signed' && s.status !== 'declined' && (
                  <div className="mt-3 flex items-center gap-3">
                    <a href={`/sign/${s.signingToken}`} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1">
                      <FileSignature className="w-3.5 h-3.5" /> {s.partySide === 'internal' ? 'Sign your part' : 'Open & sign'}
                    </a>
                    <button onClick={() => copyLink(s)} className="text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1">
                      {copied === s.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy link
                    </button>
                  </div>
                )}
                {s.status === 'signed' && s.signedAt && <div className="mt-2 text-[11px] text-emerald-400/80">Signed {new Date(s.signedAt).toLocaleString()}{s.ipAddress ? ` · ${s.ipAddress}` : ''}</div>}
                {s.status === 'declined' && <div className="mt-2 text-[11px] text-rose-400/80">Declined{s.declineReason ? `: ${s.declineReason}` : ''}</div>}
              </div>
            );
          })}

          {ag.status === 'completed' && (
            <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 p-4 text-sm text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Fully signed. Final document & audit certificate generated.
            </div>
          )}
        </div>

        {/* Audit trail */}
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><History className="w-4 h-4 text-emerald-400" /> Audit trail <span className="text-[10px] uppercase tracking-wider text-slate-500">security log</span></h2>
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 max-h-[60vh] overflow-y-auto">
            {audit.length === 0 && <div className="p-5 text-center text-xs text-slate-500">No events yet.</div>}
            {audit.map((e) => (
              <div key={e.id} className="px-4 py-3">
                <div className="text-[13px] text-slate-200">{e.action}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{e.actorName || 'System'} · {new Date(e.createdAt).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold text-white">{value}</div>
    </div>
  );
}
