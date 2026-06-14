'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { SeoService, type BusinessProfile, type BusinessHour } from '@/services/seo.service';
import { Save, MapPin, CheckCircle2, Clock } from 'lucide-react';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function emptyHours(): BusinessHour[] {
  return DAYS.map((_, i) => ({ day: i, open: '09:00', close: '17:00', closed: i >= 5 }));
}

export default function BusinessProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="content" required="seo.audit.run" workspaceId={wsId} skeleton="form">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const [p, setP] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await SeoService.profile.get(wsId);
      if (r.success) { const d = r.data; if (!d.hours || d.hours.length === 0) d.hours = emptyHours(); setP(d); }
    } finally { setLoading(false); }
  }, [wsId]);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof BusinessProfile, v: unknown) => setP((cur) => (cur ? { ...cur, [k]: v } : cur));
  const setHour = (i: number, patch: Partial<BusinessHour>) =>
    setP((cur) => (cur ? { ...cur, hours: cur.hours.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) } : cur));

  const save = async () => {
    if (!p) return;
    setSaving(true);
    try {
      const r = await SeoService.profile.save(wsId, {
        name: p.name, description: p.description, primary_category: p.primary_category,
        secondary_categories: p.secondary_categories, phone: p.phone, website: p.website,
        street: p.street, city: p.city, region: p.region, postal_code: p.postal_code, country: p.country,
        hours: p.hours, attributes: p.attributes,
      });
      if (r.success) { flash(true, 'Business profile saved.'); setP(r.data.hours?.length ? r.data : { ...r.data, hours: p.hours }); }
      else flash(false, r.message || 'Could not save.');
    } finally { setSaving(false); }
  };

  if (loading || !p) return <PageSkeleton kind="form" />;

  const input = 'w-full rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-teal-400';
  const lbl = 'mb-1 block text-xs font-medium text-slate-300';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white"><MapPin className="h-5 w-5 text-teal-500" /> Business Profile</h1>
          <p className="text-sm text-slate-500">Your name, address, phone, categories &amp; hours — what powers Google, Maps &amp; local search.</p>
        </div>
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {p.is_connected ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Connected to Google Business Profile — synced automatically.</div>
      ) : (
        <div className="rounded-lg bg-amber-500/15 px-4 py-2.5 text-sm text-amber-300">Manual mode — enter your details now. When Google Business Profile is connected, these sync automatically.</div>
      )}

      {toast && <div className={`rounded-lg px-4 py-2.5 text-sm font-medium ${toast.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>{toast.msg}</div>}

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="font-semibold text-white">Basics</p>
        <div><label className={lbl}>Business name</label><input className={input} value={p.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div><label className={lbl}>Description</label><textarea rows={3} className={input} value={p.description} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Primary category</label><input className={input} value={p.primary_category} onChange={(e) => set('primary_category', e.target.value)} placeholder="e.g. Wellness center" /></div>
          <div><label className={lbl}>Phone</label><input className={input} value={p.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        </div>
        <div><label className={lbl}>Website</label><input className={input} value={p.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></div>
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="font-semibold text-white">Address (NAP)</p>
        <div><label className={lbl}>Street</label><input className={input} value={p.street} onChange={(e) => set('street', e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={lbl}>City</label><input className={input} value={p.city} onChange={(e) => set('city', e.target.value)} /></div>
          <div><label className={lbl}>Region / State</label><input className={input} value={p.region} onChange={(e) => set('region', e.target.value)} /></div>
          <div><label className={lbl}>Postal code</label><input className={input} value={p.postal_code} onChange={(e) => set('postal_code', e.target.value)} /></div>
          <div><label className={lbl}>Country</label><input className={input} value={p.country} onChange={(e) => set('country', e.target.value)} /></div>
        </div>
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="flex items-center gap-1.5 font-semibold text-white"><Clock className="h-4 w-4 text-teal-500" /> Opening hours</p>
        {p.hours.map((h, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-10 font-medium text-slate-300">{DAYS[h.day] ?? DAYS[i]}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" className="h-4 w-4 accent-teal-500" checked={!h.closed} onChange={(e) => setHour(i, { closed: !e.target.checked })} /> Open</label>
            {!h.closed && (
              <>
                <input type="time" className="rounded-lg border border-white/10 px-2 py-1 text-sm" value={h.open} onChange={(e) => setHour(i, { open: e.target.value })} />
                <span className="text-slate-400">–</span>
                <input type="time" className="rounded-lg border border-white/10 px-2 py-1 text-sm" value={h.close} onChange={(e) => setHour(i, { close: e.target.value })} />
              </>
            )}
            {h.closed && <span className="text-xs text-slate-400">Closed</span>}
          </div>
        ))}
      </section>
    </div>
  );
}
