'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Topbar from '@/components/Topbar';
import { PageSpinner } from '@/components/StateViews';
import { OrganizationService } from '@/services/organization.service';
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, DollarSign } from 'lucide-react';

interface CalEvent {
  id: string; type: 'appointment' | 'invoice_due'; title: string;
  workspace_id: number; workspace_name: string;
  starts_at: string; ends_at: string | null; status: string;
  location?: string; amount?: number; currency?: string; all_day?: boolean; link: string;
}

const PALETTE = ['#34d399', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#2dd4bf', '#818cf8'];

function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function startOfGrid(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const d = new Date(first);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

export default function CalendarPage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);

  const gridStart = useMemo(() => startOfGrid(month), [month]);
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(d.getDate() + i); return d; }), [gridStart]);

  // Stable color per workspace
  const wsColor = useMemo(() => {
    const ids = Array.from(new Set(events.map((e) => e.workspace_id)));
    const m: Record<number, string> = {};
    ids.forEach((id, i) => { m[id] = PALETTE[i % PALETTE.length]; });
    return m;
  }, [events]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = ymd(gridStart);
      const end = new Date(gridStart); end.setDate(end.getDate() + 41);
      const res = await OrganizationService.getCalendar({ from, to: ymd(end), mine });
      if (res?.success) setEvents(res.data.events || []);
    } finally { setLoading(false); }
  }, [gridStart, mine]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    events.forEach((e) => { const k = ymd(new Date(e.starts_at)); (m[k] ||= []).push(e); });
    return m;
  }, [events]);

  const todayKey = ymd(new Date());
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const upcoming = useMemo(() => events.filter((e) => new Date(e.starts_at) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 12), [events]);

  return (
    <>
      <Topbar
        title="Calendar"
        subtitle="Meetings & due dates across all your businesses."
        actions={
          <label className="flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
            My meetings only
          </label>
        }
      />
      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        {/* Month controls */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/[0.06] flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)); }} className="px-3 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/[0.06] text-xs font-semibold">Today</button>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/10 text-slate-300 hover:bg-white/[0.06] flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        {loading && events.length === 0 ? <PageSpinner /> : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Month grid */}
            <div className="xl:col-span-3 rounded-2xl bg-white/[0.02] border border-white/5 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-white/5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {gridDays.map((d, i) => {
                  const k = ymd(d);
                  const inMonth = d.getMonth() === month.getMonth();
                  const dayEvents = byDay[k] || [];
                  return (
                    <div key={i} className={`min-h-[96px] border-b border-r border-white/5 p-1.5 ${inMonth ? '' : 'bg-black/20'}`}>
                      <div className={`text-[11px] font-semibold mb-1 ${k === todayKey ? 'text-emerald-300' : inMonth ? 'text-slate-400' : 'text-slate-600'}`}>
                        {k === todayKey ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white">{d.getDate()}</span> : d.getDate()}
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 3).map((e) => (
                          <button key={e.id} onClick={() => router.push(e.link)}
                            className="w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate hover:opacity-80"
                            style={{ backgroundColor: `${(e.type === 'invoice_due' ? '#fb7185' : wsColor[e.workspace_id] || '#34d399')}22`, color: e.type === 'invoice_due' ? '#fda4af' : wsColor[e.workspace_id] || '#34d399' }}
                            title={`${e.title} · ${e.workspace_name}`}>
                            {e.type === 'appointment' && !e.all_day ? new Date(e.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' ' : ''}{e.title}
                          </button>
                        ))}
                        {dayEvents.length > 3 && <div className="text-[10px] text-slate-500 px-1.5">+{dayEvents.length - 3} more</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Agenda */}
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-emerald-400" /> Upcoming</h3>
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 max-h-[70vh] overflow-y-auto">
                {upcoming.length === 0 && <div className="p-6 text-center text-xs text-slate-500">Nothing scheduled.</div>}
                {upcoming.map((e) => (
                  <button key={e.id} onClick={() => router.push(e.link)} className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
                    <span className="w-1.5 self-stretch rounded-full shrink-0" style={{ backgroundColor: e.type === 'invoice_due' ? '#fb7185' : wsColor[e.workspace_id] || '#34d399' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-slate-200 truncate">{e.title}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{!e.all_day ? `, ${new Date(e.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
                        {e.location ? <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span> : null}
                        {e.type === 'invoice_due' && e.amount ? <span className="flex items-center gap-0.5 text-rose-300"><DollarSign className="w-3 h-3" />{e.amount.toFixed(0)}</span> : null}
                      </div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{e.workspace_name}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
