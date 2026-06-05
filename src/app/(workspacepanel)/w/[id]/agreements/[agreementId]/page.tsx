'use client';

import { use as reactUse, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft, Send, Copy, Check, Loader2, Clock, XCircle, CheckCircle2, Mail,
  FileSignature, ShieldCheck, History,
} from 'lucide-react';
import { agreementsApi } from '@/lib/agreements/api';
import { STATUS_LABEL, type Agreement, type AgreementAuditEvent, type AgreementSigner } from '@/lib/agreements/types';

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
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => copyLink(s)} className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1">
                      {copied === s.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy signing link
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
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><History className="w-4 h-4 text-emerald-400" /> Audit trail</h2>
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
