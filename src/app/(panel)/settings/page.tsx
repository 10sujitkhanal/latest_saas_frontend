'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Building2, Shield, Activity, Upload, CheckCircle2, Loader2, KeyRound,
  LogIn, UserCog, Palette, Clock,
} from 'lucide-react';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';

type Tab = 'profile' | 'security' | 'activity';

interface ProfileData {
  name: string; contact_email: string; phone: string; address: string;
  brand_color: string; typography: string; industry: string; country: string;
  description: string; support_email: string; support_url: string;
  terms_url: string; privacy_url: string; timezone: string;
  logo: string | null; favicon: string | null;
}

interface ActivityItem {
  id: number; action: string; category: string; description: string;
  actor_email: string; actor_name: string; ip: string | null; created_at: string;
}

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: 'profile', label: 'Profile & Branding', Icon: Building2 },
  { id: 'security', label: 'Security', Icon: Shield },
  { id: 'activity', label: 'Activity', Icon: Activity },
];

const inputCls =
  'h-10 w-full rounded-lg bg-white/[0.03] border border-white/10 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors';
const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500';

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function OrgSettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');

  return (
    <div className="px-6 lg:px-10 py-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Manage your organization profile, branding, security and activity.</p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/5">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? 'border-emerald-500 text-emerald-300' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'activity' && <ActivityTab />}
    </div>
  );
}

function ProfileTab() {
  const setBusiness = useAuthStore((s) => s.setBusiness);
  const [p, setP] = useState<ProfileData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const logoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    OrganizationService.getOrgProfile().then((res) => {
      if (res?.success) {
        setP(res.data);
        setLogoPreview(res.data.logo || '');
        setFaviconPreview(res.data.favicon || '');
      }
    });
  }, []);

  const set = (k: keyof ProfileData, v: string) => setP((prev) => (prev ? { ...prev, [k]: v } : prev));

  const save = async () => {
    if (!p) return;
    setSaving(true);
    try {
      const fd = new FormData();
      (['name', 'contact_email', 'phone', 'address', 'brand_color', 'industry', 'country',
        'description', 'support_email', 'support_url', 'terms_url', 'privacy_url', 'timezone'] as const)
        .forEach((k) => fd.append(k, (p as any)[k] ?? ''));
      if (logoFile) fd.append('logo', logoFile);
      if (faviconFile) fd.append('favicon', faviconFile);
      const res = await OrganizationService.updateOrgProfile(fd);
      if (res?.success) {
        setP(res.data);
        setLogoPreview(res.data.logo || '');
        setFaviconPreview(res.data.favicon || '');
        setBusiness({ name: res.data.name, logo: res.data.logo });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!p) return <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Branding */}
      <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
        <div className="flex items-center gap-2 mb-5"><Palette className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-white">Branding</h3></div>
        <div className="flex flex-wrap gap-6">
          {/* Logo */}
          <div>
            <span className={labelCls}>Logo</span>
            <input ref={logoRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); } }} />
            <button onClick={() => logoRef.current?.click()}
              className="mt-2 w-28 h-28 rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 bg-white/[0.02] flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden">
              {logoPreview ? <img src={logoPreview} alt="logo" className="w-full h-full object-contain" /> : <><Upload className="w-5 h-5 text-slate-600" /><span className="text-[10px] text-slate-500 uppercase">Upload</span></>}
            </button>
          </div>
          {/* Favicon */}
          <div>
            <span className={labelCls}>Favicon</span>
            <input ref={faviconRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFaviconFile(f); setFaviconPreview(URL.createObjectURL(f)); } }} />
            <button onClick={() => faviconRef.current?.click()}
              className="mt-2 w-28 h-28 rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 bg-white/[0.02] flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden">
              {faviconPreview ? <img src={faviconPreview} alt="favicon" className="w-12 h-12 object-contain" /> : <><Upload className="w-5 h-5 text-slate-600" /><span className="text-[10px] text-slate-500 uppercase">32px</span></>}
            </button>
          </div>
          {/* Brand color */}
          <div className="flex-1 min-w-[200px]">
            <span className={labelCls}>Brand color</span>
            <div className="mt-2 flex items-center gap-3">
              <input type="color" value={p.brand_color} onChange={(e) => set('brand_color', e.target.value)}
                className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
              <input value={p.brand_color} onChange={(e) => set('brand_color', e.target.value)} className={`${inputCls} font-mono w-32`} />
            </div>
          </div>
        </div>
      </section>

      {/* Identity */}
      <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
        <div className="flex items-center gap-2 mb-5"><Building2 className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-white">Business identity</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><span className={labelCls}>Business name</span><input className={`${inputCls} mt-1.5`} value={p.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div><span className={labelCls}>Industry</span><input className={`${inputCls} mt-1.5`} value={p.industry} onChange={(e) => set('industry', e.target.value)} /></div>
          <div><span className={labelCls}>Contact email</span><input className={`${inputCls} mt-1.5`} value={p.contact_email} onChange={(e) => set('contact_email', e.target.value)} /></div>
          <div><span className={labelCls}>Phone</span><input className={`${inputCls} mt-1.5`} value={p.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><span className={labelCls}>Country</span><input className={`${inputCls} mt-1.5`} value={p.country} onChange={(e) => set('country', e.target.value)} /></div>
          <div><span className={labelCls}>Timezone</span><input className={`${inputCls} mt-1.5`} value={p.timezone} onChange={(e) => set('timezone', e.target.value)} /></div>
          <div className="md:col-span-2"><span className={labelCls}>Address</span><textarea className={`${inputCls} mt-1.5 h-20 py-2 resize-none`} value={p.address} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="md:col-span-2"><span className={labelCls}>Description</span><textarea className={`${inputCls} mt-1.5 h-16 py-2 resize-none`} value={p.description} onChange={(e) => set('description', e.target.value)} /></div>
        </div>
      </section>

      {/* Support & legal */}
      <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
        <div className="flex items-center gap-2 mb-5"><Shield className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-white">Support & legal</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><span className={labelCls}>Support email</span><input className={`${inputCls} mt-1.5`} value={p.support_email} onChange={(e) => set('support_email', e.target.value)} /></div>
          <div><span className={labelCls}>Support URL</span><input className={`${inputCls} mt-1.5`} value={p.support_url} onChange={(e) => set('support_url', e.target.value)} /></div>
          <div><span className={labelCls}>Terms URL</span><input className={`${inputCls} mt-1.5`} value={p.terms_url} onChange={(e) => set('terms_url', e.target.value)} /></div>
          <div><span className={labelCls}>Privacy URL</span><input className={`${inputCls} mt-1.5`} value={p.privacy_url} onChange={(e) => set('privacy_url', e.target.value)} /></div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="px-5 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
          {saved ? 'Saved' : 'Save changes'}
        </button>
        <span className="text-xs text-slate-500">Branding changes appear in the sidebar & browser tab after refresh.</span>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async () => {
    setMsg(null);
    if (next !== confirm) { setMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    if (next.length < 8) { setMsg({ ok: false, text: 'New password must be at least 8 characters.' }); return; }
    setBusy(true);
    try {
      const res = await OrganizationService.changePassword(current, next);
      if (res?.success) {
        setMsg({ ok: true, text: 'Password changed successfully.' });
        setCurrent(''); setNext(''); setConfirm('');
      } else {
        setMsg({ ok: false, text: res?.message || 'Failed to change password.' });
      }
    } catch (e: any) {
      setMsg({ ok: false, text: e?.response?.data?.message || 'Failed to change password.' });
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md">
      <section className="rounded-2xl bg-white/[0.02] border border-white/5 p-6">
        <div className="flex items-center gap-2 mb-5"><KeyRound className="w-4 h-4 text-emerald-400" /><h3 className="text-sm font-semibold text-white">Change password</h3></div>
        <div className="space-y-4">
          <div><span className={labelCls}>Current password</span><input type="password" className={`${inputCls} mt-1.5`} value={current} onChange={(e) => setCurrent(e.target.value)} /></div>
          <div><span className={labelCls}>New password</span><input type="password" className={`${inputCls} mt-1.5`} value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div><span className={labelCls}>Confirm new password</span><input type="password" className={`${inputCls} mt-1.5`} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          {msg && (
            <div className={`text-xs font-medium px-3 py-2 rounded-lg ${msg.ok ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-red-500/10 text-red-300 border border-red-500/20'}`}>{msg.text}</div>
          )}
          <button onClick={submit} disabled={busy || !current || !next}
            className="px-5 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Update password
          </button>
        </div>
      </section>
    </div>
  );
}

const ACTIVITY_ICON: Record<string, any> = {
  'auth.login': LogIn,
  'password.changed': KeyRound,
  'profile.updated': UserCog,
};

function ActivityTab() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);

  useEffect(() => {
    OrganizationService.getActivity(100).then((res) => {
      if (res?.success) setItems(res.data.items || []);
      else setItems([]);
    }).catch(() => setItems([]));
  }, []);

  if (!items) return <div className="flex items-center gap-2 text-slate-500 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-12 text-center">
        <Activity className="w-8 h-8 text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-300">No activity yet</p>
        <p className="text-xs text-slate-500 mt-1">Sign-ins, profile and security changes will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 divide-y divide-white/5 overflow-hidden">
      {items.map((a) => {
        const Icon = ACTIVITY_ICON[a.action] || Clock;
        return (
          <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
            <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-slate-400 shrink-0">
              <Icon className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200">{a.description || a.action}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {a.actor_email || 'system'}{a.ip ? ` · ${a.ip}` : ''} · <span className="capitalize">{a.category}</span>
              </div>
            </div>
            <span className="text-[11px] text-slate-500 shrink-0">{timeAgo(a.created_at)}</span>
          </div>
        );
      })}
    </div>
  );
}
