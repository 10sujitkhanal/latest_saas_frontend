'use client';

/**
 * Lead hover preview — Phase A.5 of the world-class CRM.
 *
 * Hover a lead in the pipeline/list → a quick read (temperature, last activity,
 * the AI's recommended next move) + quick-compose actions (email / call /
 * WhatsApp / open), WITHOUT opening the lead. Reuses data already on the card +
 * the advisor's ai_recommendation. Purely presentational — the parent owns the
 * hover state + fixed positioning so it escapes the kanban column's overflow.
 */

import Link from 'next/link';
import { Mail, Phone, MessageCircle, ArrowUpRight, Sparkles, Clock } from 'lucide-react';

export interface HoverLead {
  id: number;
  full_name: string;
  company?: string;
  email?: string | null;
  phone?: string | null;
  value?: string | number;
  score?: number;
  score_band?: 'hot' | 'warm' | 'cold' | 'spam' | string;
  temperature?: string;
  stage_name?: string | null;
  ai_recommendation?: string;
  ai_summary?: string;
  last_activity_at?: string | null;
}

const BAND = (b?: string) =>
  b === 'hot' ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  : b === 'warm' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  : 'bg-slate-500/15 text-slate-300 border-slate-500/20';

const ago = (iso?: string | null) => {
  if (!iso) return null;
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

export function LeadHoverCard({
  wsId, lead, style, onMouseEnter, onMouseLeave,
}: {
  wsId: string;
  lead: HoverLead;
  style?: React.CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const band = lead.score_band || lead.temperature;
  const next = lead.ai_recommendation || lead.ai_summary;
  const last = ago(lead.last_activity_at);
  const waNum = (lead.phone || '').replace(/[^\d]/g, '');

  const Action = ({ href, icon: Icon, label, ext }: { href: string; icon: typeof Mail; label: string; ext?: boolean }) => (
    <a href={href} {...(ext ? { target: '_blank', rel: 'noreferrer' } : {})} onClick={(e) => e.stopPropagation()}
      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-emerald-200">
      <Icon className="w-3.5 h-3.5" /> {label}
    </a>
  );

  return (
    <div
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-[60] w-72 rounded-xl border border-white/10 bg-slate-900 shadow-2xl p-3 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{lead.full_name}</div>
          {lead.company && <div className="text-[11px] text-slate-500 truncate">{lead.company}</div>}
        </div>
        {(band) && (
          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${BAND(band)}`}>
            {band}{typeof lead.score === 'number' ? ` · ${lead.score}` : ''}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
        {lead.stage_name && <span className="rounded bg-white/5 px-1.5 py-0.5">{lead.stage_name}</span>}
        {Number(lead.value) > 0 && <span className="text-emerald-300 font-semibold">${Number(lead.value).toLocaleString()}</span>}
        {last && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {last}</span>}
      </div>

      {next && (
        <div className="mt-2 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 px-2.5 py-1.5">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300/80 font-bold"><Sparkles className="w-3 h-3" /> Next move</div>
          <p className="text-[12px] text-slate-200 mt-0.5 line-clamp-3">{next}</p>
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        {lead.email && <Action href={`mailto:${lead.email}`} icon={Mail} label="Email" />}
        {lead.phone && <Action href={`tel:${lead.phone}`} icon={Phone} label="Call" />}
        {waNum && <Action href={`https://wa.me/${waNum}`} icon={MessageCircle} label="WA" ext />}
        <Link href={`/w/${wsId}/leads/${lead.id}`} onClick={(e) => e.stopPropagation()}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2 py-1.5 text-[11px] font-semibold text-white">
          Open <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
