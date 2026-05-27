'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  Search, Users, Crown, Mail, Phone, Building2, Plus, X, Save, MapPin,
  MessageSquare, Globe, ArrowRight, ChevronLeft, ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import QuotaChip from '@/components/workspace/QuotaChip';
import QuotaBadge from '@/components/QuotaBadge';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string;
  whatsapp: string;
  location: string;
  company_name: string | null;
  is_vip: boolean;
  is_blocked: boolean;
  tags: string[];
  leads_count: number;
  created_at: string;
  instagram_handle?: string;
  facebook_id?: string;
  linkedin_id?: string;
  tiktok_handle?: string;
}

const PAGE_SIZE = 20;

export default function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="list">
      <ContactsInner wsId={wsId} />
    </PermissionGuard>
  );
}

function ContactsInner({ wsId }: { wsId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [vipCount, setVipCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.listContacts({
        search: search || undefined,
        vip: vipOnly,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (res?.success) {
        setContacts(res.data);
        setTotal(res.meta?.total ?? res.data.length);
        setVipCount(res.meta?.vip_count ?? 0);
      }
    } finally { setLoading(false); }
  }, [search, vipOnly, page]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => { setPage(0); }, [search, vipOnly]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            <Users className="w-7 h-7 text-emerald-300" /> Contacts
            <QuotaBadge quota="contacts" label="contacts" />
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            <strong>{total.toLocaleString()}</strong> unified profile{total === 1 ? '' : 's'} —
            auto-deduped across email, phone &amp; every social handle.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QuotaChip quota="contacts" workspaceId={wsId} />
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            New contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            placeholder="Search by name, email, phone, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.02] p-1 gap-1">
          <button
            onClick={() => setVipOnly(false)}
            className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-colors ${
              !vipOnly ? 'bg-white/[0.08] text-white border border-white/15' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Everyone
            <span className="ml-1 text-[10px] opacity-60">{total.toLocaleString()}</span>
          </button>
          <button
            onClick={() => setVipOnly(true)}
            className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors ${
              vipOnly ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Crown className="w-3 h-3" />
            VIP only
            <span className="ml-1 text-[10px] opacity-60">{vipCount}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <PageSkeleton kind="list" />
      ) : contacts.length === 0 ? (
        total === 0 && !search && !vipOnly
          ? <EmptyContacts onAdd={() => setShowAdd(true)} />
          : <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              No contacts match this filter.
            </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 900 }}>
                <thead className="bg-white/[0.02] border-b border-white/5">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="text-left px-4 py-3">Contact</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Phone</th>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-left px-4 py-3 w-20">Leads</th>
                    <th className="text-left px-4 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <ContactRow key={c.id} contact={c} wsId={wsId} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-4 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                Showing <strong className="text-slate-300">{page * PAGE_SIZE + 1}</strong>–
                <strong className="text-slate-300">{Math.min(total, (page + 1) * PAGE_SIZE)}</strong> of{' '}
                <strong className="text-slate-300">{total.toLocaleString()}</strong>
              </div>
              <div className="inline-flex items-center gap-1">
                <PageButton onClick={() => setPage(0)} disabled={page === 0}>«</PageButton>
                <PageButton onClick={() => setPage(page - 1)} disabled={page === 0}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </PageButton>
                <span className="px-3 py-1.5 text-slate-400">
                  Page <strong className="text-white">{page + 1}</strong> of {totalPages}
                </span>
                <PageButton onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </PageButton>
                <PageButton onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</PageButton>
              </div>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddContactModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Row
// ──────────────────────────────────────────────────────────────────────

function ContactRow({ contact: c, wsId }: { contact: Contact; wsId: string }) {
  const initials = (c.full_name || c.email || '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  const hue = (c.id * 47) % 360;
  void wsId;
  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.025] transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 relative"
            style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 35%), hsl(${(hue + 40) % 360} 55% 25%))` }}
          >
            {initials}
            {c.is_vip && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 border-2 border-[#0a1020] flex items-center justify-center">
                <Crown className="w-2 h-2 text-amber-950" />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">{c.full_name || '—'}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {c.location && (
                <span className="text-[10px] text-slate-500 inline-flex items-center gap-0.5 truncate">
                  <MapPin className="w-2.5 h-2.5" />
                  {c.location}
                </span>
              )}
              <SocialMiniChips contact={c} />
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {c.email ? (
          <a href={`mailto:${c.email}`} className="text-[12.5px] text-slate-300 hover:text-emerald-300 truncate inline-flex items-center gap-1.5 max-w-[220px]">
            <Mail className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{c.email}</span>
          </a>
        ) : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3">
        {c.phone ? (
          <a href={`tel:${c.phone}`} className="text-[12.5px] text-slate-300 hover:text-emerald-300 inline-flex items-center gap-1.5">
            <Phone className="w-3 h-3 text-slate-500" />
            {c.phone}
          </a>
        ) : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3">
        {c.company_name ? (
          <span className="text-[12.5px] text-slate-300 inline-flex items-center gap-1.5">
            <Building2 className="w-3 h-3 text-slate-500" />
            {c.company_name}
          </span>
        ) : <span className="text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
          <Sparkles className="w-2.5 h-2.5" />
          {c.leads_count}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(c.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 text-[10px] rounded bg-white/[0.05] border border-white/10 text-slate-300">{t}</span>
          ))}
          {(c.tags || []).length > 3 && (
            <span className="text-[10px] text-slate-500">+{(c.tags || []).length - 3}</span>
          )}
          {(c.tags || []).length === 0 && <span className="text-slate-600 text-xs">—</span>}
        </div>
      </td>
    </tr>
  );
}

function SocialMiniChips({ contact: c }: { contact: Contact }) {
  const items: { label: string; href: string; color: string }[] = [];
  if (c.instagram_handle) items.push({ label: 'IG', href: `https://instagram.com/${c.instagram_handle.replace(/^@/, '')}`, color: '#e1306c' });
  if (c.facebook_id)      items.push({ label: 'FB', href: `https://facebook.com/${c.facebook_id}`,                          color: '#1877f2' });
  if (c.linkedin_id)      items.push({ label: 'IN', href: `https://linkedin.com/in/${c.linkedin_id}`,                       color: '#0a66c2' });
  if (c.tiktok_handle)    items.push({ label: 'TT', href: `https://tiktok.com/@${c.tiktok_handle.replace(/^@/, '')}`,       color: '#ff0050' });
  if (c.whatsapp)         items.push({ label: 'WA', href: `https://wa.me/${c.whatsapp.replace(/\D/g, '')}`,                 color: '#25d366' });
  if (items.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {items.slice(0, 4).map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
           onClick={(e) => e.stopPropagation()}
           title={s.label}
           className="w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center"
           style={{ backgroundColor: `${s.color}22`, color: s.color, border: `1px solid ${s.color}55` }}>
          {s.label}
        </a>
      ))}
    </span>
  );
}

function PageButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed inline-flex items-center justify-center"
    >
      {children}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Empty state with sources explanation
// ──────────────────────────────────────────────────────────────────────

function EmptyContacts({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 space-y-6">
      <div className="text-center">
        <Users className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <h3 className="text-lg font-bold text-white">No contacts yet</h3>
        <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
          A <strong>Contact</strong> is the deduped person record behind every lead. Three places they come from:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
        <SourceCard icon={MessageSquare} color="#10b981" title="Inbound messages"
          body="When a customer DMs you on Instagram / WhatsApp / Facebook / Email / etc., we match by email/phone/handle and either link to an existing contact or create one." />
        <SourceCard icon={ArrowRight} color="#3b82f6" title="Lead capture"
          body="Every lead you create (kanban form, CSV import, API, public form) automatically links to or creates a contact from its email/phone." />
        <SourceCard icon={Plus} color="#8b5cf6" title="Manual add"
          body="Use the New contact button above to enter a person before they message you — handy for prospecting." />
      </div>

      <div className="flex justify-center">
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Add your first contact
        </button>
      </div>
    </div>
  );
}

function SourceCard({
  icon: Icon, color, title, body,
}: { icon: React.ComponentType<{ className?: string }>; color: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border bg-white/[0.02] p-4" style={{ borderColor: `${color}33` }}>
      <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg"
           style={{ backgroundColor: `${color}1f`, color, border: `1px solid ${color}44` }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-sm font-bold text-white">{title}</div>
      <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  New contact modal
// ──────────────────────────────────────────────────────────────────────

function AddContactModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    whatsapp: '', location: '', is_vip: false,
    instagram_handle: '', facebook_id: '', linkedin_id: '', tiktok_handle: '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.first_name.trim() && !form.last_name.trim() && !form.email.trim() && !form.phone.trim()) {
      toast.error('Add at least a name, email, or phone.');
      return;
    }
    setSaving(true);
    try {
      const res = await OrganizationService.createContact({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim(),
        location: form.location.trim(),
        is_vip: form.is_vip,
        instagram_handle: form.instagram_handle.trim(),
        facebook_id: form.facebook_id.trim(),
        linkedin_id: form.linkedin_id.trim(),
        tiktok_handle: form.tiktok_handle.trim(),
      });
      if (res?.success) {
        toast.success(`${form.first_name || form.email || 'Contact'} added.`);
        onSaved();
      } else {
        toast.error(res?.message || 'Could not create contact');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not create contact');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a1020] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#0a1020] z-10">
          <div>
            <h2 className="text-base font-bold text-white">New contact</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Add a person before they reach out — handy for prospecting.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name"><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={ipt} placeholder="Sarah" /></Field>
            <Field label="Last name"><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={ipt} placeholder="Khan" /></Field>
          </div>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={ipt} placeholder="sarah@acme.com" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={ipt} placeholder="+1 555 0100" /></Field>
            <Field label="WhatsApp (optional)"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className={ipt} placeholder="+1 555 0100" /></Field>
          </div>
          <Field label="Location (optional)"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={ipt} placeholder="Kathmandu, Nepal" /></Field>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2 inline-flex items-center gap-1.5">
              <Globe className="w-3 h-3" />
              Social handles (optional)
            </div>
            <p className="text-[10px] text-slate-500 mb-3">Used to match this person when they message you on these platforms.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Instagram"><input value={form.instagram_handle} onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })} className={ipt} placeholder="@handle" /></Field>
              <Field label="Facebook ID"><input value={form.facebook_id} onChange={(e) => setForm({ ...form, facebook_id: e.target.value })} className={ipt} placeholder="username" /></Field>
              <Field label="LinkedIn"><input value={form.linkedin_id} onChange={(e) => setForm({ ...form, linkedin_id: e.target.value })} className={ipt} placeholder="username" /></Field>
              <Field label="TikTok"><input value={form.tiktok_handle} onChange={(e) => setForm({ ...form, tiktok_handle: e.target.value })} className={ipt} placeholder="@handle" /></Field>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_vip} onChange={(e) => setForm({ ...form, is_vip: e.target.checked })} className="sr-only peer" />
            <span className="w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-amber-500 relative transition-colors">
              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </span>
            <span className="text-xs text-slate-300 inline-flex items-center gap-1"><Crown className="w-3 h-3 text-amber-300" /> VIP contact</span>
          </label>
        </div>

        <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2 sticky bottom-0 bg-[#0a1020]">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.04]">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

const ipt = 'w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}
