'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Cpu, ChevronDown, Check, ExternalLink, Loader2 } from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';

interface Cfg { enabled: boolean; base_url: string; model: string; has_key: boolean; source: string; live_model: string; agency_model: string }

/**
 * AI Staff model picker — shows which model is powering the agents (your own
 * OpenAI/Groq, the agency model, or the built-in MoreTech AI Qwen) and lets an
 * admin switch between their own model and Qwen. Keys are still entered on the
 * Credentials page (linked here).
 */
export default function ModelPicker({ workspaceId }: { workspaceId: string | number }) {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => OrganizationService.agentLLMConfig().then((r) => { if (r?.success) setCfg(r.data); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!cfg) return null;

  const live = cfg.live_model || 'MoreTech AI (Qwen)';
  const setEnabled = async (en: boolean) => {
    setBusy(true);
    try { const r = await OrganizationService.agentLLMSave({ enabled: en, base_url: cfg.base_url, model: cfg.model }); if (r?.success) await load(); }
    finally { setBusy(false); setOpen(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cpu className="h-3.5 w-3.5 text-emerald-300" />}
        <span className="max-w-[160px] truncate">{live}</span>
        <ChevronDown className="h-3 w-3 text-slate-400" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-xl border border-white/10 bg-[#0c1320] p-1.5 shadow-2xl">
          <p className="px-2.5 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Model powering your agents</p>
          {cfg.has_key ? (
            <>
              <button onClick={() => setEnabled(true)} disabled={busy}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-slate-200 hover:bg-white/[0.06]">
                <span className="truncate">Your model · {cfg.model}</span>
                {cfg.source === 'tenant' && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
              </button>
              <button onClick={() => setEnabled(false)} disabled={busy}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12px] text-slate-200 hover:bg-white/[0.06]">
                <span>MoreTech AI (Qwen)</span>
                {cfg.source !== 'tenant' && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" />}
              </button>
            </>
          ) : cfg.source === 'agency' ? (
            <p className="px-2.5 py-1.5 text-[12px] text-slate-300">Using your agency&apos;s model · <b>{cfg.agency_model}</b></p>
          ) : (
            <p className="px-2.5 py-1.5 text-[12px] text-slate-400">Built-in MoreTech AI (Qwen). Connect your own for sharper results.</p>
          )}
          <div className="my-1 border-t border-white/5" />
          <Link href={`/w/${workspaceId}/leads/credentials`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300 hover:bg-white/[0.06]">
            <ExternalLink className="h-3.5 w-3.5" /> {cfg.has_key ? 'Manage models' : 'Connect your own model'}
          </Link>
        </div>
      )}
    </div>
  );
}
