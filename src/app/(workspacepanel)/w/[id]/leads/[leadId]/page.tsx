'use client';

import { useCallback, useEffect, useMemo, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Mail, Phone, Building2, Calendar, Tag, Sparkles, MapPin,
  Activity, CheckSquare, Pencil, Trash2, Save, X, Bot, MessageSquare,
  DollarSign, User as UserIcon, ArrowRight, AlertTriangle, RefreshCw,
  CheckCircle2, Send, Paperclip, Pin, PinOff, Plus, Download, FileText,
  Image as ImageIcon, Calendar as CalendarIcon, CalendarClock, Clock, Video,
  PlayCircle, PauseCircle, Globe, MoreHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { useIsAdmin } from '@/hooks/usePermission';
import { OrganizationService } from '@/services/organization.service';
import LeadAiAssist from '@/components/leads/LeadAiAssist';
import { resolveApiV1Base } from '@/lib/apiBase';

/**
 * Lead detail page — redesigned with side rail of tabs + main panel.
 *
 * Tabs: Overview · Conversations (unread badge) · Appointments (upcoming chip) ·
 *       Notes (count) · Files (count) · Activity · Edit
 *
 * Everything lives on /w/<wsId>/leads/<leadId>. Tab selection drives the
 * URL hash so a refresh stays on the same tab and links to a specific
 * tab (e.g. ".../leads/6#conversations") work.
 */

type TabKey = 'overview' | 'conversations' | 'appointments' | 'notes' | 'files' | 'activity' | 'edit';

interface LeadDetail {
  id: number; first_name: string; last_name: string; full_name: string;
  email: string | null; phone: string | null; company: string;
  value: number | string; notes: string; status: string;
  intent?: string; urgency?: string; temperature?: string;
  ai_summary?: string; ai_recommendation?: string;
  score: number; score_band?: 'hot' | 'warm' | 'cold' | 'spam';
  lifecycle_stage: string; expected_close_date: string | null;
  last_activity_at: string | null;
  source: number | null; source_name: string | null; source_color: string | null;
  stage: number | null; stage_name: string | null; stage_color: string | null;
  stage_probability: number | null; pipeline: number | null;
  assigned_to: number | null; assigned_to_email: string | null;
  created_at: string; tags?: string[];
  avatar_url?: string | null;
}

interface TimelineEntry {
  id: string; kind: string; activity_type: string; description?: string;
  status?: string; due_at?: string | null; at: string; actor_email?: string | null;
}

interface NoteRow {
  id: number; body: string; pinned: boolean;
  author_email: string | null; created_at: string; updated_at: string;
}

interface AttachmentRow {
  id: number; filename: string; mime_type: string; size_bytes: number;
  url: string; uploaded_by_email: string | null; created_at: string;
}

interface ConvRow {
  id: number; channel_kind: string; channel_name: string;
  status: string; is_unread: boolean; unread_count: number; ai_handled: boolean;
  last_message_at: string | null; last_message_preview: string;
}

interface AppointmentRow {
  id: number; title: string; starts_at: string | null;
  duration_minutes: number; location: string;
  status: string;
  time_state: 'upcoming' | 'today' | 'past' | 'completed' | 'cancelled';
  meet_link: string | null; notes: string;
}

interface ContactRow {
  id: number; first_name: string; last_name: string;
  email: string | null; phone: string; whatsapp: string; location: string;
  is_vip: boolean; tags: string[];
  instagram_handle: string; facebook_id: string;
  linkedin_id: string; tiktok_handle: string;
}

interface PipelineStage { id: number; name: string; slug: string; color: string; order: number; probability: number; is_won: boolean; is_lost: boolean; }

interface FullPayload {
  lead: LeadDetail;
  timeline: TimelineEntry[];
  tasks: { id: number; kind: string; title: string; status: string; priority: string; due_at: string | null; assigned_to_email: string | null; is_overdue: boolean }[];
  conversations: ConvRow[];
  contact: ContactRow | null;
  notes: NoteRow[];
  attachments: AttachmentRow[];
  appointments: AppointmentRow[];
  pipeline_stages: PipelineStage[];
}

const TEMP_BADGE: Record<string, string> = {
  hot:  'bg-red-500/15 text-red-300 border-red-500/30',
  warm: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cold: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  spam: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const APPT_STATE_META: Record<AppointmentRow['time_state'], { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  upcoming:  { label: 'Upcoming',  color: '#3b82f6', Icon: CalendarClock },
  today:     { label: 'Today',     color: '#10b981', Icon: PlayCircle },
  past:      { label: 'Expired',   color: '#ef4444', Icon: PauseCircle },
  completed: { label: 'Completed', color: '#94a3b8', Icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: '#94a3b8', Icon: X },
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string; leadId: string }> }) {
  const { id: wsId, leadId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="detail">
      <LeadDetailInner wsId={wsId} leadId={Number(leadId)} />
    </PermissionGuard>
  );
}

function LeadDetailInner({ wsId, leadId }: { wsId: string; leadId: number }) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<FullPayload | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Plan-cap lockout — when the backend returns HTTP 402 with
  // ``reason='quota_exceeded'`` we show a tailored "Upgrade to view"
  // screen instead of a generic "Couldn't load" panel.
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLocked(false);
    try {
      const res = await OrganizationService.leadFull(leadId);
      if (res?.success) setData(res.data);
      else setError(res?.message || 'Lead not found.');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string; data?: { reason?: string } }; status?: number } };
      const code = err.response?.status;
      const reason = err.response?.data?.data?.reason;
      if (code === 402 && reason === 'quota_exceeded') {
        setLocked(true);
        setError(err.response?.data?.message || 'This lead is locked by your plan cap.');
      } else {
        setError(
          err.response?.data?.message
          || (code === 404 ? `Lead #${leadId} doesn't exist or you don't have access.`
              : code === 403 ? 'You don\'t have permission to view this lead.'
              : `Could not load lead${code ? ` (HTTP ${code})` : ''}.`),
        );
      }
    } finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  // Hash → tab sync.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = (window.location.hash || '#overview').replace('#', '') as TabKey;
    if (['overview', 'conversations', 'appointments', 'notes', 'files', 'activity', 'edit'].includes(hash)) {
      setTab(hash);
    }
    const onHash = () => {
      const h = (window.location.hash || '#overview').replace('#', '') as TabKey;
      setTab(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const pickTab = (t: TabKey) => {
    setTab(t);
    if (typeof window !== 'undefined') window.location.hash = t;
  };

  if (loading) return <PageSkeleton kind="detail" />;
  if (locked) {
    // Plan-cap lockout. Admins see the Upgrade CTA; plain members see
    // a "Contact your admin" message because they can't action it
    // themselves — billing is workspace-wide, not per-user.
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Lead locked by plan cap</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          {error || (isAdmin
            ? 'This lead is beyond your plan\'s allowed total. We keep the oldest leads accessible — upgrade to unlock the most recent ones.'
            : 'This lead is beyond your organization\'s plan cap. Ask your admin to upgrade so the most recent leads unlock.')}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link href={`/w/${wsId}/leads/list`}
            className="px-4 py-2.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to all leads
          </Link>
          {isAdmin ? (
            <Link href="/subscription"
              className="px-4 py-2.5 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-bold">
              Upgrade plan
            </Link>
          ) : (
            <span className="px-4 py-2.5 rounded-full border border-white/15 text-slate-300 text-xs font-semibold">
              Contact your admin
            </span>
          )}
        </div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Couldn&apos;t load this lead</h2>
        <p className="text-sm text-slate-400">{error || 'No data returned from the server.'}</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={load} className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200">Retry</button>
          <Link href={`/w/${wsId}/leads/list`} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back to all leads</Link>
        </div>
      </div>
    );
  }

  const { lead, timeline, tasks, conversations, contact, notes, attachments, appointments, pipeline_stages } = data;
  const initial = (lead.first_name || lead.last_name || lead.email || '?')[0]?.toUpperCase() || '?';
  const unreadConv = conversations.reduce((a, c) => a + (c.is_unread ? 1 : 0), 0);
  const upcomingAppt = appointments.filter((a) => a.time_state === 'upcoming' || a.time_state === 'today').length;

  const remove = async () => {
    if (!confirm(`Delete ${lead.full_name}? This cannot be undone.`)) return;
    const res = await OrganizationService.deleteLead(lead.id);
    if (res?.success) {
      toast.success('Lead deleted');
      router.push(`/w/${wsId}/leads/list`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <Link href={`/w/${wsId}/leads/list`} className="text-[11px] text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-3 h-3" /> All leads
        </Link>
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.04] via-cyan-500/[0.02] to-transparent p-5 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <LeadAvatar lead={lead} initial={initial} onChanged={load} />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white truncate">{lead.full_name || 'Untitled lead'}</h1>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {lead.temperature && (
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold ${TEMP_BADGE[lead.temperature] || TEMP_BADGE.cold}`}>
                    {lead.temperature} · {lead.score}
                  </span>
                )}
                {!lead.temperature && typeof lead.score === 'number' && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-bold bg-slate-500/10 text-slate-300 border-slate-500/20">
                    Score {lead.score}
                  </span>
                )}
                {lead.source_name && (
                  <span className="text-[11px] px-2 py-0.5 rounded border" style={{ color: lead.source_color || '#64748b', borderColor: `${lead.source_color || '#64748b'}55`, backgroundColor: `${lead.source_color || '#64748b'}1a` }}>
                    {lead.source_name}
                  </span>
                )}
                {lead.stage_name && (
                  <span className="text-[11px] px-2 py-0.5 rounded border" style={{ color: lead.stage_color || '#64748b', borderColor: `${lead.stage_color || '#64748b'}55`, backgroundColor: `${lead.stage_color || '#64748b'}1a` }}>
                    {lead.stage_name}{lead.stage_probability ? ` · ${lead.stage_probability}%` : ''}
                  </span>
                )}
                {contact && <SocialChips contact={contact} />}
              </div>
              <div className="mt-2 text-[12px] text-slate-400 flex items-center gap-3 flex-wrap">
                {lead.email && (<a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1 hover:text-emerald-300"><Mail className="w-3 h-3" /> {lead.email}</a>)}
                {lead.phone && (<a href={`tel:${lead.phone}`} className="inline-flex items-center gap-1 hover:text-emerald-300"><Phone className="w-3 h-3" /> {lead.phone}</a>)}
                {lead.company && (<span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {lead.company}</span>)}
                {lead.assigned_to_email && (<span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" /> {lead.assigned_to_email}</span>)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={load} className="p-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300" title="Refresh"><RefreshCw className="w-3.5 h-3.5" /></button>
            <button onClick={() => pickTab('edit')} className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" /> Edit</button>
            <button onClick={remove} className="px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/[0.05] hover:bg-red-500/[0.1] text-red-300 text-xs font-semibold inline-flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
          </div>
        </div>
      </div>

      {/* Horizontal tab bar — scrollable on narrow screens. */}
      <div className="mb-5 border-b border-white/10 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-fit">
          <TabPill active={tab === 'overview'} onClick={() => pickTab('overview')} icon={<Activity className="w-3.5 h-3.5" />}>Overview</TabPill>
          <TabPill active={tab === 'conversations'} onClick={() => pickTab('conversations')} icon={<MessageSquare className="w-3.5 h-3.5" />} badge={unreadConv}>Conversations</TabPill>
          <TabPill active={tab === 'appointments'} onClick={() => pickTab('appointments')} icon={<Calendar className="w-3.5 h-3.5" />} badge={upcomingAppt}>Appointments</TabPill>
          <TabPill active={tab === 'notes'} onClick={() => pickTab('notes')} icon={<FileText className="w-3.5 h-3.5" />} badge={notes.length}>Notes</TabPill>
          <TabPill active={tab === 'files'} onClick={() => pickTab('files')} icon={<Paperclip className="w-3.5 h-3.5" />} badge={attachments.length}>Files</TabPill>
          <TabPill active={tab === 'activity'} onClick={() => pickTab('activity')} icon={<Sparkles className="w-3.5 h-3.5" />} badge={timeline.length}>Activity</TabPill>
          <TabPill active={tab === 'edit'} onClick={() => pickTab('edit')} icon={<Pencil className="w-3.5 h-3.5" />}>Edit</TabPill>
        </div>
      </div>

      <div>
        {tab === 'overview' && (
          <OverviewTab
            lead={lead}
            contact={contact}
            stages={pipeline_stages}
            tasks={tasks}
            notes={notes}
            attachments={attachments}
            timeline={timeline}
            conversations={conversations}
            appointments={appointments}
            wsId={wsId}
            onChange={load}
            onJumpTab={pickTab}
          />
        )}
        {tab === 'conversations' && (
          <ConversationsTab conversations={conversations} wsId={wsId} leadId={lead.id} onChange={load} />
        )}
        {tab === 'appointments' && (
          <AppointmentsTab appointments={appointments} lead={lead} leadId={lead.id} onChange={load} />
        )}
        {tab === 'notes' && (
          <NotesTab leadId={lead.id} notes={notes} onChange={load} />
        )}
        {tab === 'files' && (
          <FilesTab leadId={lead.id} attachments={attachments} onChange={load} />
        )}
        {tab === 'activity' && (
          <ActivityTab timeline={timeline} />
        )}
        {tab === 'edit' && (
          <EditTab lead={lead} onSaved={load} onCancel={() => pickTab('overview')} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Horizontal tab pill
// ──────────────────────────────────────────────────────────────────────

// Lead profile picture with hover-to-upload. Click anywhere on the tile
// to open a file picker; when an image is already present, a small "X"
// in the top-right removes it. Falls back to the gradient-initial tile
// when there's no avatar.
function LeadAvatar({
  lead, initial, onChanged,
}: { lead: LeadDetail; initial: string; onChanged: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const openPicker = () => { if (!uploading) fileRef.current?.click(); };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await OrganizationService.uploadLeadAvatar(lead.id, file);
      if (res?.success) {
        toast.success('Photo updated');
        onChanged();
      } else {
        toast.error(res?.message || 'Could not upload');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Remove this lead\'s photo?')) return;
    setUploading(true);
    try {
      const res = await OrganizationService.deleteLeadAvatar(lead.id);
      if (res?.success) {
        toast.success('Photo removed');
        onChanged();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group shrink-0">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={uploading}
        aria-label="Change lead photo"
        className={`w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold relative transition-opacity ${
          lead.avatar_url
            ? 'bg-slate-900'
            : 'bg-gradient-to-br from-emerald-500 to-cyan-600'
        } ${uploading ? 'opacity-60' : 'hover:ring-2 hover:ring-emerald-500/50'}`}
      >
        {lead.avatar_url ? (
          // Plain <img> is fine here — the URL is workspace-scoped and
          // Next/Image is overkill for a 64px square avatar.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={lead.avatar_url} alt={lead.full_name || 'Lead'} className="w-full h-full object-cover" />
        ) : (
          initial
        )}
        {/* Overlay only when hovered + no upload in flight. */}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] uppercase tracking-wider font-bold pointer-events-none">
          {uploading ? 'Uploading…' : 'Change'}
        </span>
      </button>
      {lead.avatar_url && !uploading && (
        <button
          type="button"
          onClick={remove}
          aria-label="Remove photo"
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function TabPill({
  active, onClick, icon, badge, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; badge?: number; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold transition-colors whitespace-nowrap border-b-2 ${
        active
          ? 'text-emerald-300 border-emerald-500'
          : 'text-slate-400 hover:text-white border-transparent hover:border-white/10'
      }`}
    >
      {icon}
      {children}
      {badge != null && badge > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/[0.08] text-slate-300'}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Social chips
// ──────────────────────────────────────────────────────────────────────

function SocialChips({ contact }: { contact: ContactRow }) {
  const items: { kind: string; value: string; href: string; color: string }[] = [];
  if (contact.instagram_handle) items.push({ kind: 'Instagram', value: contact.instagram_handle, href: `https://instagram.com/${contact.instagram_handle.replace(/^@/, '')}`, color: '#e1306c' });
  if (contact.facebook_id)      items.push({ kind: 'Facebook',  value: contact.facebook_id,      href: `https://facebook.com/${contact.facebook_id}`,                  color: '#1877f2' });
  if (contact.linkedin_id)      items.push({ kind: 'LinkedIn',  value: contact.linkedin_id,      href: `https://linkedin.com/in/${contact.linkedin_id}`,               color: '#0a66c2' });
  if (contact.tiktok_handle)    items.push({ kind: 'TikTok',    value: contact.tiktok_handle,    href: `https://tiktok.com/@${contact.tiktok_handle.replace(/^@/, '')}`, color: '#ff0050' });
  if (contact.whatsapp)         items.push({ kind: 'WhatsApp',  value: contact.whatsapp,         href: `https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`,         color: '#25d366' });
  if (items.length === 0) return null;
  return (
    <>
      {items.map((s) => (
        <a key={s.kind} href={s.href} target="_blank" rel="noopener noreferrer" className="text-[10px] px-1.5 py-0.5 rounded border font-semibold inline-flex items-center gap-1 hover:bg-white/[0.04]"
           style={{ color: s.color, borderColor: `${s.color}55`, backgroundColor: `${s.color}1a` }}
           title={`${s.kind}: ${s.value}`}>
          <Globe className="w-2.5 h-2.5" />
          {s.kind}
        </a>
      ))}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  OVERVIEW
// ──────────────────────────────────────────────────────────────────────

function OverviewTab({
  lead, contact, stages, tasks, notes, attachments, timeline, conversations, appointments, onChange, onJumpTab, wsId,
}: {
  lead: LeadDetail;
  contact: ContactRow | null;
  stages: PipelineStage[];
  tasks: FullPayload['tasks'];
  notes: NoteRow[];
  attachments: AttachmentRow[];
  timeline: TimelineEntry[];
  conversations: ConvRow[];
  appointments: AppointmentRow[];
  onChange: () => void;
  wsId: string;
  onJumpTab: (t: TabKey) => void;
}) {
  const moveStage = async (stageId: number) => {
    const res = await OrganizationService.moveLeadStage(lead.id, stageId);
    if (res?.success) { toast.success('Stage updated'); onChange(); }
  };
  const upcoming = appointments.filter((a) => a.time_state === 'upcoming' || a.time_state === 'today').slice(0, 3);
  const recentConvs = conversations.slice(0, 3);
  const recentNotes = notes.slice(0, 3);
  const recentFiles = attachments.slice(0, 4);
  const recentActivity = timeline.slice(0, 6);
  const weighted = lead.stage_probability && Number(lead.value) > 0
    ? Math.round(Number(lead.value) * (lead.stage_probability / 100))
    : 0;

  return (
    <div className="space-y-5">
      {/* Top metric row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Deal value"  value={Number(lead.value) > 0 ? `$${Number(lead.value).toLocaleString()}` : '—'} accent="#10b981" Icon={DollarSign} />
        <Stat label="Weighted"    value={weighted > 0 ? `$${weighted.toLocaleString()}` : '—'} accent="#06b6d4" Icon={Activity} />
        <Stat label="Score"       value={String(lead.score ?? 0)} accent="#f97316" Icon={Sparkles} sub={lead.temperature || lead.score_band || undefined} />
        <Stat label="Probability" value={lead.stage_probability != null ? `${lead.stage_probability}%` : '—'} accent="#a855f7" Icon={CalendarCheckIcon} />
      </div>

      {/* Inline AI for Sales: read this lead + draft a message, right here. */}
      <LeadAiAssist workspaceId={wsId} leadId={lead.id} canContact={!!(lead.email || lead.phone)} onUpdated={onChange} />

      {lead.ai_summary && (
        <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] via-cyan-500/[0.04] to-transparent p-5">
          <h3 className="text-sm font-bold text-white mb-2 inline-flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-300" /> AI summary
          </h3>
          <p className="text-sm text-slate-200">{lead.ai_summary}</p>
          {lead.ai_recommendation && (
            <p className="mt-2 text-[12px] text-slate-300">
              <strong className="text-emerald-200">Suggested next step:</strong> {lead.ai_recommendation}
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* LEFT (wide) — Move stage, Contact, Conversations, Notes preview */}
        <div className="xl:col-span-2 space-y-4">
          <Card title="Move stage" icon={<ArrowRight className="w-4 h-4 text-emerald-300" />}>
            {stages.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No pipeline stages configured.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stages.map((s) => {
                  const active = s.id === lead.stage;
                  return (
                    <button key={s.id} onClick={() => !active && moveStage(s.id)} disabled={active}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:cursor-default"
                      style={active
                        ? { backgroundColor: `${s.color}33`, borderColor: `${s.color}88`, color: '#fff' }
                        : { backgroundColor: `${s.color}11`, borderColor: `${s.color}33`, color: s.color }}>
                      {s.name} · {s.probability}%
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card
            title="Contact details"
            icon={<UserIcon className="w-4 h-4 text-emerald-300" />}
            action={
              <button onClick={() => onJumpTab('edit')} className="text-[10px] text-emerald-300 hover:underline inline-flex items-center gap-1">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field2 icon={Mail} label="Email" value={lead.email || (contact?.email || '—')} link={lead.email ? `mailto:${lead.email}` : undefined} />
              <Field2 icon={Phone} label="Phone" value={lead.phone || (contact?.phone || '—')} link={lead.phone ? `tel:${lead.phone}` : undefined} />
              <Field2 icon={Building2} label="Company" value={lead.company || '—'} />
              <Field2 icon={MapPin} label="Location" value={contact?.location || '—'} />
              {contact?.whatsapp && <Field2 icon={MessageSquare} label="WhatsApp" value={contact.whatsapp} link={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`} />}
              <Field2 icon={UserIcon} label="Owner" value={lead.assigned_to_email || 'Unassigned'} />
              {lead.source_name && <Field2 icon={Tag} label="Source" value={lead.source_name} />}
              <Field2 icon={Calendar} label="Created" value={new Date(lead.created_at).toLocaleString()} />
              {lead.last_activity_at && <Field2 icon={Activity} label="Last activity" value={new Date(lead.last_activity_at).toLocaleString()} />}
              {lead.expected_close_date && <Field2 icon={CalendarClock} label="Expected close" value={new Date(lead.expected_close_date).toLocaleDateString()} />}
            </div>
            {contact && (
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Social</span>
                <SocialChips contact={contact} />
                {!contact.instagram_handle && !contact.facebook_id && !contact.linkedin_id && !contact.tiktok_handle && !contact.whatsapp && (
                  <span className="text-[10px] text-slate-500 italic">No social handles linked.</span>
                )}
              </div>
            )}
          </Card>

          <Card
            title="Recent conversations"
            icon={<MessageSquare className="w-4 h-4 text-emerald-300" />}
            action={conversations.length > 0 ? <JumpButton onClick={() => onJumpTab('conversations')} count={conversations.length} /> : undefined}
          >
            {recentConvs.length === 0 ? (
              <EmptyInline icon={MessageSquare} text="No conversations yet — when this lead messages you on any connected channel, threads appear here." />
            ) : (
              <ul className="space-y-2">
                {recentConvs.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer" onClick={() => onJumpTab('conversations')}>
                    <div className="w-7 h-7 rounded-md bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 truncate flex-1">{c.channel_name || c.channel_kind}</span>
                        {c.is_unread && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200">NEW</span>}
                      </div>
                      <div className="text-[12px] text-slate-300 line-clamp-1 mt-0.5">{c.last_message_preview || '(no preview)'}</div>
                      {c.last_message_at && (<div className="text-[10px] text-slate-500 mt-0.5">{new Date(c.last_message_at).toLocaleString()}</div>)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Pinned & recent notes"
            icon={<FileText className="w-4 h-4 text-emerald-300" />}
            action={<JumpButton onClick={() => onJumpTab('notes')} count={notes.length} label="Open notes" />}
          >
            {recentNotes.length === 0 ? (
              <EmptyInline icon={FileText} text="No notes yet — capture call summaries, blockers, next steps." />
            ) : (
              <ul className="space-y-2">
                {recentNotes.map((n) => (
                  <li key={n.id} className={`rounded-lg border p-2.5 ${n.pinned ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/5 bg-white/[0.02]'}`}>
                    <div className="text-[12.5px] text-slate-200 whitespace-pre-wrap line-clamp-3">{n.body}</div>
                    <div className="mt-1 text-[10px] text-slate-500 inline-flex items-center gap-2 flex-wrap">
                      {n.pinned && <span className="text-amber-300 inline-flex items-center gap-1"><Pin className="w-2.5 h-2.5" /> Pinned</span>}
                      {n.author_email && <span>by {n.author_email}</span>}
                      <span>·</span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* RIGHT (narrow) — Deal, Tags, Meetings, Tasks, Files, Activity */}
        <div className="space-y-4">
          <Card title="Deal economics" icon={<DollarSign className="w-4 h-4 text-emerald-300" />}>
            <dl className="text-xs space-y-2">
              <Row label="Value" value={Number(lead.value) > 0 ? `$${Number(lead.value).toLocaleString()}` : '—'} />
              <Row label="Stage" value={lead.stage_name || '—'} />
              <Row label="Probability" value={lead.stage_probability != null ? `${lead.stage_probability}%` : '—'} />
              <Row label="Weighted" value={weighted > 0 ? `$${weighted.toLocaleString()}` : '—'} />
              <Row label="Score" value={String(lead.score ?? 0)} />
              <Row label="Lifecycle" value={lead.lifecycle_stage || '—'} />
              <Row label="Expected close" value={lead.expected_close_date ? new Date(lead.expected_close_date).toLocaleDateString() : '—'} />
            </dl>
          </Card>

          <Card
            title="Upcoming meetings"
            icon={<CalendarClock className="w-4 h-4 text-emerald-300" />}
            action={<JumpButton onClick={() => onJumpTab('appointments')} count={appointments.length} label="Open" />}
          >
            {upcoming.length === 0 ? (
              <EmptyInline icon={CalendarIcon} text="No upcoming meetings. Open the Appointments tab to invite this lead." />
            ) : (
              <ul className="space-y-2">{upcoming.map((a) => <ApptCard key={a.id} appt={a} />)}</ul>
            )}
          </Card>

          {tasks.length > 0 && (
            <Card title="Tasks" icon={<CheckSquare className="w-4 h-4 text-emerald-300" />}>
              <ul className="space-y-1.5">
                {tasks.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-[12.5px] text-slate-200">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : t.is_overdue ? 'bg-red-400' : 'bg-cyan-400'}`} />
                    <span className={`flex-1 truncate ${t.status === 'done' ? 'line-through text-slate-500' : ''}`}>{t.title}</span>
                    {t.due_at && <span className="text-[10px] text-slate-500">{new Date(t.due_at).toLocaleDateString()}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {recentFiles.length > 0 && (
            <Card
              title="Files"
              icon={<Paperclip className="w-4 h-4 text-emerald-300" />}
              action={<JumpButton onClick={() => onJumpTab('files')} count={attachments.length} label="Open" />}
            >
              <ul className="space-y-1.5">
                {recentFiles.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs">
                    {a.mime_type.startsWith('image/')
                      ? <ImageIcon className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                      : <FileText className="w-3.5 h-3.5 text-cyan-300 shrink-0" />}
                    <a href={a.url} download className="flex-1 truncate text-slate-300 hover:text-emerald-300">{a.filename}</a>
                    <span className="text-[10px] text-slate-500">{formatBytes(a.size_bytes)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Tags" icon={<Tag className="w-4 h-4 text-emerald-300" />}>
            {(lead.tags || []).length === 0 ? (
              <div className="text-xs text-slate-500 italic">No tags</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(lead.tags || []).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/10 text-slate-300">{t}</span>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Recent activity"
            icon={<Sparkles className="w-4 h-4 text-emerald-300" />}
            action={<JumpButton onClick={() => onJumpTab('activity')} count={timeline.length} label="Full timeline" />}
          >
            {recentActivity.length === 0 ? (
              <EmptyInline icon={Sparkles} text="Nothing yet." />
            ) : (
              <ul className="space-y-1.5">
                {recentActivity.map((e) => (
                  <li key={e.id} className="flex items-start gap-2 text-[11.5px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 line-clamp-2">{e.description || e.activity_type}</div>
                      <div className="text-[10px] text-slate-500">{e.at && new Date(e.at).toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Overview helpers ──────────────────────────────────────────────────

function Card({
  title, icon, action, children,
}: { title: string; icon?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white inline-flex items-center gap-2">
          {icon}
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function JumpButton({ onClick, count, label = 'See all' }: { onClick: () => void; count?: number; label?: string }) {
  return (
    <button onClick={onClick} className="text-[10px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 font-semibold">
      {label}{count != null ? ` (${count})` : ''}
      <ArrowRight className="w-3 h-3" />
    </button>
  );
}

function Stat({
  label, value, sub, accent, Icon,
}: { label: string; value: string; sub?: string; accent: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
           style={{ backgroundColor: `${accent}1a`, color: accent, border: `1px solid ${accent}33` }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-lg font-bold text-white">{value}</div>
        {sub && <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: accent }}>{sub}</div>}
      </div>
    </div>
  );
}

function Field2({
  icon: Icon, label, value, link,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; link?: string }) {
  const v = (
    <span className="text-slate-200 truncate">
      {value}
    </span>
  );
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-[12px] font-semibold truncate">
          {link ? <a href={link} className="text-emerald-300 hover:underline" target={link.startsWith('http') ? '_blank' : undefined} rel="noopener">{value}</a> : v}
        </div>
      </div>
    </div>
  );
}

function EmptyInline({
  icon: Icon, text,
}: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <div className="text-center py-4 text-[11.5px] text-slate-500 italic flex flex-col items-center gap-1.5">
      <Icon className="w-5 h-5 opacity-50" />
      <div className="max-w-xs">{text}</div>
    </div>
  );
}

// Calendar-check alias since lucide ships it as CalendarCheck
const CalendarCheckIcon = CheckCircle2;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 font-semibold">{value}</dd>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  CONVERSATIONS
// ──────────────────────────────────────────────────────────────────────

interface ThreadMessage {
  id: number;
  direction: 'in' | 'out';
  author: string;
  body: string;
  created_at: string;
  sent_by_email: string | null;
  channel_id?: number | null;
  channel_kind?: string | null;
  channel_name?: string | null;
  // Friendly account label — "you@gmail.com", "+15551234567" — so we
  // can render "via <account>" under outbound bubbles.
  channel_account?: string | null;
  delivery_status?: 'queued' | 'sent' | 'failed' | null;
  delivery_meta?: { error?: string; [k: string]: unknown } | null;
}

interface SendableChannel {
  id: number;
  kind: string;
  // Provider-friendly label from the backend — "Twilio (SMS)",
  // "SendGrid (email)", "WhatsApp Business" — so chips can show the
  // specific provider instead of the family bucket.
  kind_label: string;
  name: string;
  account: string;
  // Family bucket — email / sms / whatsapp / facebook / instagram —
  // used only to pick which icon to render on the chip.
  family: string;
}

// localStorage key for the "remember last credential" feature. Scoped
// per-workspace so two workspaces don't fight over the same slot.
const LAST_CHANNEL_KEY = (wsId: string) => `merkoll:lead-compose:last-channel:${wsId}`;
// Same idea but for the family chip — remembers "you usually use SMS"
// so the dropdown lands on a familiar bucket even on workspaces with
// new credentials the user hasn't picked yet.
const LAST_FAMILY_KEY = (wsId: string) => `merkoll:lead-compose:last-family:${wsId}`;

// Fixed list of channel families the composer offers. Order matters —
// shown left to right as chips, with Email + SMS first because those
// are the "outreach" defaults when no inbound conversation exists.
type Family = 'email' | 'sms' | 'whatsapp' | 'facebook' | 'instagram';
// The ``sms`` chip is the family bucket — it covers every SMS provider
// the backend dispatcher knows about (Twilio, MessageBird, Vonage,
// Plivo, the generic ``sms`` kind). The user picks the specific
// account in the credential dropdown below the chip.
const FAMILY_META: { family: Family; label: string }[] = [
  { family: 'email',     label: 'Email' },
  { family: 'sms',       label: 'SMS' },
  { family: 'whatsapp',  label: 'WhatsApp' },
  { family: 'facebook',  label: 'Facebook' },
  { family: 'instagram', label: 'Instagram' },
];

// Map a Channel.kind slug to its family bucket. Used to figure out
// which chip to highlight when the lead's most recent conversation
// came in on (say) ``twilio_sms`` or ``messagebird``.
function familyForKind(kind: string | null | undefined): Family | null {
  const k = (kind || '').toLowerCase();
  if (['email', 'sendgrid', 'mailgun', 'postmark', 'aws_ses'].includes(k)) return 'email';
  if (['sms', 'twilio_sms', 'messagebird', 'vonage', 'plivo'].includes(k)) return 'sms';
  if (k === 'whatsapp') return 'whatsapp';
  if (k === 'facebook' || k === 'messenger') return 'facebook';
  if (k === 'instagram') return 'instagram';
  return null;
}

function ConversationsTab({
  conversations, wsId, leadId, onChange,
}: { conversations: ConvRow[]; wsId: string; leadId: number; onChange: () => void }) {
  const [openId, setOpenId] = useState<number | null>(conversations[0]?.id ?? null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  // Channel picker state. Used by both the empty-state composer AND
  // the "+ New" button on existing threads. Picks family (chip) first,
  // then a specific credential (dropdown) inside that family. Both
  // fall back to localStorage so repeat sends remember the last pick.
  const [channels, setChannels] = useState<SendableChannel[]>([]);
  const [pickedFamily, setPickedFamily] = useState<Family | null>(null);
  const [pickedChannelId, setPickedChannelId] = useState<number | null>(null);
  // Composing a NEW conversation (vs replying to existing one).
  const [composeOpen, setComposeOpen] = useState(false);

  // Family the lead's most recent conversation came in on. If the
  // lead first contacted us via Instagram, the chip starts on
  // Instagram — that's almost always the channel the user wants to
  // reply on. Recomputed if conversations[] changes.
  const inboundFamily = useMemo<Family | null>(() => {
    // ``conversations`` is pre-sorted by ``-last_message_at`` on the
    // backend, so the first row is the most recent.
    for (const c of conversations) {
      const fam = familyForKind(c.channel_kind);
      if (fam) return fam;
    }
    return null;
  }, [conversations]);

  const loadChannels = useCallback(async () => {
    try {
      const res = await OrganizationService.leadSendableChannels(leadId);
      if (res?.success) {
        const list = (res.data.channels || []) as SendableChannel[];
        setChannels(list);
      }
    } catch {
      // non-fatal — the composer will just say "no channels connected".
    }
  }, [leadId]);

  // Whenever channels OR the inbound family changes, re-derive the
  // default selection. Priority:
  //   1) the family the lead actually came in on (if connected)
  //   2) the family the user last picked manually (localStorage)
  //   3) the user's last specific credential (localStorage)
  //   4) first connected family in chip order (email → sms → ...)
  useEffect(() => {
    if (channels.length === 0) {
      setPickedFamily(null);
      setPickedChannelId(null);
      return;
    }
    const familiesAvailable = new Set(channels.map((c) => c.family as Family));
    const rememberedFam = (localStorage.getItem(LAST_FAMILY_KEY(wsId)) || '') as Family | '';
    const rememberedChannelId = Number(localStorage.getItem(LAST_CHANNEL_KEY(wsId)) || 0);

    let nextFam: Family | null = null;
    if (inboundFamily && familiesAvailable.has(inboundFamily)) {
      nextFam = inboundFamily;
    } else if (rememberedFam && familiesAvailable.has(rememberedFam)) {
      nextFam = rememberedFam;
    } else {
      // Walk the fixed chip order picking the first family that has a
      // connected channel — keeps Email / SMS in front when nothing
      // else is set.
      for (const m of FAMILY_META) {
        if (familiesAvailable.has(m.family)) { nextFam = m.family; break; }
      }
    }
    setPickedFamily(nextFam);

    if (nextFam) {
      const inFam = channels.filter((c) => c.family === nextFam);
      // Prefer the exact remembered credential if it's in this family.
      const exact = inFam.find((c) => c.id === rememberedChannelId);
      setPickedChannelId(exact ? exact.id : inFam[0].id);
    }
  }, [channels, inboundFamily, wsId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  // Polling cursor — tracks the highest message id we've seen so the
  // 4-second realtime tick only fetches deltas (saves bandwidth + the
  // backend's existing ``inboxSince`` endpoint already implements this).
  const cursorRef = useRef(0);
  // Tracks the conversation id we've successfully fetched messages for.
  // Used to skip the auto-load when ``sendNew`` already populated the
  // thread optimistically — without this, every send caused a brief
  // "Loading…" flash that looked like a page refresh.
  const loadedConvIdRef = useRef<number | null>(null);

  // Centralised merger — single source of truth for "add these
  // messages to the thread, dedupe by id, latest version wins". Used
  // by the full-load, optimistic-send, realtime-poll, and retry paths
  // so duplicates can't sneak in regardless of which code path
  // produces them.
  const mergeMessages = useCallback((incoming: ThreadMessage[]) => {
    if (!incoming.length) return;
    setThread((curr) => {
      const byId = new Map<number, ThreadMessage>();
      // Insertion order from curr → keeps existing positions stable;
      // incoming overwrites in place so retried/updated messages
      // pick up the latest delivery_status without shifting position.
      curr.forEach((m) => byId.set(m.id, m));
      incoming.forEach((m) => {
        const prev = byId.get(m.id);
        byId.set(m.id, prev ? { ...prev, ...m } : m);
      });
      return Array.from(byId.values()).sort((a, b) => a.id - b.id);
    });
    const maxId = Math.max(...incoming.map((m) => m.id));
    if (maxId > cursorRef.current) cursorRef.current = maxId;
  }, []);

  const load = useCallback(async (id: number, opts?: { silent?: boolean }) => {
    // Only flip the visible loading state when the caller asked for a
    // user-facing fetch (first time opening this conversation). Silent
    // loads (post-send, polling) refresh the data without the
    // "Loading…" placeholder so the user doesn't perceive a refresh.
    if (!opts?.silent) setLoading(true);
    try {
      const res = await OrganizationService.conversationMessages(id);
      if (res?.success) {
        const fresh = (res.data.messages || []) as ThreadMessage[];
        cursorRef.current = fresh.length ? Math.max(...fresh.map((m) => m.id)) : 0;
        setThread(fresh);
        loadedConvIdRef.current = id;
      }
    } finally { if (!opts?.silent) setLoading(false); }
  }, []);

  // Auto-fetch messages when ``openId`` changes — UNLESS we already
  // optimistically populated the thread for this conv (e.g. after
  // ``sendNew``). The ref check is what kills the loading flash.
  useEffect(() => {
    if (!openId) return;
    if (loadedConvIdRef.current === openId) return;
    load(openId);
  }, [openId, load]);

  // Realtime polling — every 4s, fetch any messages with id > cursor
  // on the currently-open conversation. Skipped when the tab is
  // hidden so we don't burn API calls on background tabs.
  useEffect(() => {
    if (!openId) return;
    let stopped = false;
    const tick = async () => {
      if (stopped || !openId) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await OrganizationService.inboxSince(openId, cursorRef.current);
        if (res?.success && Array.isArray(res.data?.messages) && res.data.messages.length) {
          mergeMessages(res.data.messages as ThreadMessage[]);
        }
      } catch {
        // network blip — wait for next tick
      }
    };
    const t = setInterval(tick, 4_000);
    return () => { stopped = true; clearInterval(t); };
  }, [openId, mergeMessages]);

  // Per-message retry — fires when the user clicks the small ↻ button
  // under a failed bubble in the thread. Splices the updated message
  // back into ``thread`` so the bubble re-renders without a reload.
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const retryMessage = async (messageId: number) => {
    if (retryingId) return;
    setRetryingId(messageId);
    try {
      const res = await OrganizationService.retryMessage(messageId);
      if (res?.data) {
        // ``mergeMessages`` updates the existing row in place — it
        // looks up by id and merges the new ``delivery_status`` /
        // ``delivery_meta`` onto the bubble without changing its
        // position in the thread.
        mergeMessages([res.data as ThreadMessage]);
      }
      if (res?.success) toast.success('Message sent.');
      else toast.error(res?.message || 'Retry failed.');
    } catch {
      toast.error('Retry failed.');
    } finally {
      setRetryingId(null);
    }
  };

  // Reply on the currently-open conversation (no channel switch).
  // Optimistic: the new message is added via ``mergeMessages`` so the
  // bubble appears instantly without a full lead refetch. We don't
  // call ``onChange()`` here — that triggered the parent to re-fetch
  // the whole lead and was causing the "page refreshes when I send"
  // jank. The unread badge / conversation list updates on the next
  // poll tick anyway (~4s) which is good enough.
  const sendReply = async () => {
    if (!openId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await OrganizationService.conversationReply(openId, reply);
      if (res?.success && res.data) {
        mergeMessages([res.data as ThreadMessage]);
        setReply('');
        toast.success('Reply sent');
      } else if (!res?.success) {
        toast.error(res?.message || 'Failed');
      }
    } finally { setSending(false); }
  };

  // Start (or continue) a conversation on a specific channel.
  const sendNew = async () => {
    if (!pickedChannelId || !reply.trim()) return;
    setSending(true);
    try {
      const res = await OrganizationService.startLeadConversation(leadId, {
        channel_id: pickedChannelId,
        body: reply,
      });
      if (res?.success) {
        if (pickedFamily) localStorage.setItem(LAST_FAMILY_KEY(wsId), pickedFamily);
        localStorage.setItem(LAST_CHANNEL_KEY(wsId), String(pickedChannelId));
        toast.success('Message sent');
        setReply('');
        setComposeOpen(false);
        const newConvId = res.data?.conversation_id as number | undefined;
        const newMsg = res.data?.message as ThreadMessage | undefined;
        if (newConvId) {
          // Seed the thread with the message the backend just created —
          // no fetch needed, so no "Loading…" placeholder, no perceived
          // refresh. The auto-load useEffect sees ``loadedConvIdRef``
          // already points at this conv and skips the redundant call.
          if (newMsg) {
            cursorRef.current = Math.max(cursorRef.current, newMsg.id);
            setThread([newMsg]);
          } else {
            // No message in the response (shouldn't happen, but
            // defensive) — fall back to a silent fetch so we at
            // least show the conversation.
            await load(newConvId, { silent: true });
          }
          loadedConvIdRef.current = newConvId;
          setOpenId(newConvId);
        }
      } else {
        toast.error(res?.message || 'Failed to send');
      }
    } catch {
      toast.error('Network error');
    } finally { setSending(false); }
  };

  const pickedChannel = channels.find((c) => c.id === pickedChannelId) || null;

  // Belt-and-braces render-time dedupe. Even with ``mergeMessages``
  // controlling every write, a stray duplicate in state would render
  // the bubble twice — this drops repeats by id before the map().
  const visibleThread = useMemo(() => {
    const seen = new Set<number>();
    const out: ThreadMessage[] = [];
    for (const m of thread) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      out.push(m);
    }
    return out;
  }, [thread]);

  // Empty state — show the channel-picker composer directly so the
  // user can start their first conversation without leaving the page.
  if (conversations.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-300">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Start a conversation</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Pick which connected channel to send from — email, SMS, WhatsApp, Messenger, or Instagram.
            </p>
          </div>
        </div>
        {channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">
            No outbound channels are connected yet.{' '}
            <Link href={`/w/${wsId}/leads/channels`} className="text-emerald-400 hover:underline">
              Connect one →
            </Link>
          </div>
        ) : (
          <Composer
            wsId={wsId}
            channels={channels}
            pickedFamily={pickedFamily}
            pickedChannelId={pickedChannelId}
            onPickFamily={(fam) => {
              setPickedFamily(fam);
              // When switching family, snap the dropdown to the first
              // credential of that family (or null when none connected).
              const inFam = channels.filter((c) => c.family === fam);
              setPickedChannelId(inFam[0]?.id ?? null);
            }}
            onPickChannel={setPickedChannelId}
            value={reply}
            onChange={setReply}
            onSend={sendNew}
            sending={sending}
            placeholder={pickedChannel
              ? `Write a message — sending from ${pickedChannel.account}`
              : 'Pick a credential above…'}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-4 min-h-[420px]">
      <aside className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col">
        <div className="p-2 border-b border-white/5">
          <button
            onClick={() => setComposeOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            New conversation
          </button>
        </div>
        <ul className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
          {conversations.map((c) => {
            const active = openId === c.id && !composeOpen;
            return (
              <li key={c.id}>
                <button onClick={() => { setComposeOpen(false); setOpenId(c.id); }} className={`w-full text-left p-3 hover:bg-white/[0.03] ${active ? 'bg-emerald-500/[0.06]' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 truncate flex-1">{c.channel_name || c.channel_kind || 'channel'}</span>
                    {c.is_unread && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                    {c.ai_handled && <Bot className="w-3 h-3 text-cyan-300" />}
                  </div>
                  <div className="text-[11.5px] text-slate-300 line-clamp-2">{c.last_message_preview || '(no preview)'}</div>
                  {c.last_message_at && (
                    <div className="text-[10px] text-slate-500 mt-1">{new Date(c.last_message_at).toLocaleString()}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col min-h-[420px]">
        {composeOpen ? (
          // New-conversation composer (channel-picker + body).
          <div className="flex-1 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white inline-flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-300" />
                New conversation
              </div>
              <button onClick={() => setComposeOpen(false)} className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
            {channels.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No outbound channels connected.</div>
            ) : (
              <Composer
                wsId={wsId}
                channels={channels}
                pickedFamily={pickedFamily}
                pickedChannelId={pickedChannelId}
                onPickFamily={(fam) => {
                  setPickedFamily(fam);
                  const inFam = channels.filter((c) => c.family === fam);
                  setPickedChannelId(inFam[0]?.id ?? null);
                }}
                onPickChannel={setPickedChannelId}
                value={reply}
                onChange={setReply}
                onSend={sendNew}
                sending={sending}
                placeholder={pickedChannel
                  ? `Write a message — sending from ${pickedChannel.account}`
                  : 'Pick a credential above…'}
              />
            )}
          </div>
        ) : openId == null ? (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 italic">Pick a conversation to view the thread.</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="text-xs text-slate-500 italic">Loading…</div>
              ) : visibleThread.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No messages yet.</div>
              ) : (
                visibleThread.map((m, i) => {
                  // Day-separator chip when this bubble is on a different
                  // calendar day than the previous one — messenger-style.
                  const dt = new Date(m.created_at);
                  const prev = visibleThread[i - 1];
                  const prevDt = prev ? new Date(prev.created_at) : null;
                  const isNewDay = !prevDt || prevDt.toDateString() !== dt.toDateString();
                  const dayLabel = (() => {
                    const today = new Date();
                    const yest = new Date(today); yest.setDate(today.getDate() - 1);
                    if (dt.toDateString() === today.toDateString()) return 'Today';
                    if (dt.toDateString() === yest.toDateString()) return 'Yesterday';
                    return dt.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                  })();
                  const timeStr = dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                  return (
                  <div key={m.id}>
                    {isNewDay && (
                      <div className="flex items-center justify-center my-3 text-[10px] uppercase tracking-wider text-slate-500">
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/5">{dayLabel}</span>
                      </div>
                    )}
                    <div className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] whitespace-pre-wrap ${
                      m.direction === 'out'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-white rounded-br-md'
                        : 'bg-white/[0.04] border border-white/10 text-white rounded-bl-md'
                    }`}>
                      {m.body}
                      <div className="mt-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wider opacity-70">
                        <span>{m.author}</span>
                        <span>·</span>
                        <span title={dt.toLocaleString()}>{timeStr}</span>
                        {m.direction === 'out' && m.channel_account && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-200 normal-case tracking-normal" title="Sent from this credential">
                              via {m.channel_account}
                            </span>
                          </>
                        )}
                        {m.delivery_status === 'failed' && (
                          <>
                            <span className="text-red-300 normal-case tracking-normal" title={m.delivery_meta?.error || ''}>
                              · failed
                            </span>
                            <button
                              type="button"
                              onClick={() => retryMessage(m.id)}
                              disabled={retryingId === m.id}
                              title={m.delivery_meta?.error
                                ? `Retry — last error: ${m.delivery_meta.error}`
                                : 'Retry send'}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white normal-case tracking-normal text-[9px] font-semibold disabled:opacity-60 disabled:cursor-wait"
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${retryingId === m.id ? 'animate-spin' : ''}`} />
                              {retryingId === m.id ? 'Retrying…' : 'Retry'}
                            </button>
                          </>
                        )}
                        {m.delivery_status === 'queued' && (
                          <>
                            <span className="text-amber-300 normal-case tracking-normal">· queued</span>
                            <button
                              type="button"
                              onClick={() => retryMessage(m.id)}
                              disabled={retryingId === m.id}
                              title="Force a send attempt now"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-white normal-case tracking-normal text-[9px] font-semibold disabled:opacity-60 disabled:cursor-wait"
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${retryingId === m.id ? 'animate-spin' : ''}`} />
                              {retryingId === m.id ? 'Sending…' : 'Send now'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-white/5 p-3 flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                rows={2}
                placeholder="Reply…"
                className="flex-1 rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// Shared composer used by both the empty state and the "+ New
// conversation" view. Two-step pick:
//
//   1) Family chip row — fixed Email / Twilio (SMS) / WhatsApp /
//      Facebook / Instagram. Always rendered, even when a family
//      isn't connected (chip greys out and links to /channels so the
//      user discovers the missing setup).
//   2) Account dropdown — lists ONLY the credentials inside the
//      picked family. Lets a tenant with multiple Gmails or two
//      Twilio numbers pick the exact account.
//
// The defaults (which chip + which account) are driven by the parent
// (see ``pickedFamily`` / ``pickedChannelId`` in ``ConversationsTab``)
// so the same composer renders consistently from both the empty state
// and the "+ New" view.
function Composer({
  wsId, channels, pickedFamily, pickedChannelId,
  onPickFamily, onPickChannel,
  value, onChange, onSend, sending, placeholder,
}: {
  wsId: string;
  channels: SendableChannel[];
  pickedFamily: Family | null;
  pickedChannelId: number | null;
  onPickFamily: (fam: Family) => void;
  onPickChannel: (id: number) => void;
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
}) {
  // Channels filtered to the currently-picked family — drives the
  // account dropdown. Stable per render.
  const inFamily = useMemo(
    () => channels.filter((c) => c.family === pickedFamily),
    [channels, pickedFamily],
  );

  // Per-family connection summary so we can grey out chips with no
  // credentials AND show the count next to the label.
  const familyCount = useMemo(() => {
    const m: Partial<Record<Family, number>> = {};
    channels.forEach((c) => {
      const fam = c.family as Family;
      m[fam] = (m[fam] || 0) + 1;
    });
    return m;
  }, [channels]);

  const familyIcon = (family: Family) => {
    if (family === 'email') return <Mail className="w-3.5 h-3.5" />;
    if (family === 'sms') return <Phone className="w-3.5 h-3.5" />;
    return <MessageSquare className="w-3.5 h-3.5" />;
  };

  return (
    <div className="space-y-3">
      {/* Step 1 — family chip row. Greyed when no credentials are
          connected for that family; the disabled chip still acts as
          a hint that the integration exists and where to set it up. */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Channel</div>
        <div className="flex flex-wrap gap-1.5">
          {FAMILY_META.map(({ family, label }) => {
            const count = familyCount[family] || 0;
            const connected = count > 0;
            const active = pickedFamily === family;
            return (
              <button
                key={family}
                type="button"
                disabled={!connected}
                onClick={() => onPickFamily(family)}
                title={connected
                  ? `${count} ${count === 1 ? 'credential' : 'credentials'} connected`
                  : 'No credentials connected — open Channels to set this up.'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100'
                    : connected
                      ? 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05] hover:text-white'
                      : 'bg-white/[0.01] border-white/5 text-slate-600 cursor-not-allowed'
                }`}
              >
                {familyIcon(family)}
                {label}
                {connected && count > 1 && <span className="opacity-60 font-normal">({count})</span>}
                {!connected && (
                  <Link
                    href={`/w/${wsId}/leads/channels`}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-1 text-[10px] text-slate-500 hover:text-emerald-300 underline underline-offset-2"
                  >
                    connect
                  </Link>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 — credential dropdown. Only shows accounts inside the
          picked family. When the tenant has only one credential for
          the family, render it as a read-only label instead of an
          obvious dropdown (less visual noise). */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Credential</div>
        {inFamily.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-xs text-slate-500 italic">
            {pickedFamily
              ? `No ${FAMILY_META.find((m) => m.family === pickedFamily)?.label} credentials connected for this workspace.`
              : 'Pick a channel above to see available credentials.'}
          </div>
        ) : inFamily.length === 1 ? (
          <div className="rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white">
            <span className="text-emerald-300 font-semibold">{inFamily[0].account}</span>
            <span className="text-slate-500"> · {inFamily[0].kind_label} · {inFamily[0].name}</span>
          </div>
        ) : (
          <select
            value={pickedChannelId ?? ''}
            onChange={(e) => onPickChannel(Number(e.target.value))}
            className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
          >
            {inFamily.map((c) => (
              <option key={c.id} value={c.id}>
                {c.account} — {c.kind_label} ({c.name})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          rows={3}
          placeholder={placeholder}
          className="flex-1 rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
        <button
          onClick={onSend}
          disabled={sending || !value.trim() || !pickedChannelId}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 inline-flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  APPOINTMENTS
// ──────────────────────────────────────────────────────────────────────

function AppointmentsTab({
  appointments, lead, leadId, onChange,
}: { appointments: AppointmentRow[]; lead: LeadDetail; leadId: number; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const grouped = useMemo(() => ({
    upcoming: appointments.filter((a) => a.time_state === 'upcoming' || a.time_state === 'today'),
    past:     appointments.filter((a) => a.time_state === 'past' || a.time_state === 'completed' || a.time_state === 'cancelled'),
  }), [appointments]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Meetings & invites</h2>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />
          Invite to meeting
        </button>
      </div>

      {appointments.length === 0 ? (
        <EmptySection icon={CalendarIcon} title="No meetings yet" subtitle="Schedule a meeting and we'll attach a Google Meet link automatically (if connected)." />
      ) : (
        <>
          {grouped.upcoming.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mb-2">Upcoming</div>
              <ul className="space-y-2">{grouped.upcoming.map((a) => <ApptCard key={a.id} appt={a} />)}</ul>
            </section>
          )}
          {grouped.past.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">Past</div>
              <ul className="space-y-2">{grouped.past.map((a) => <ApptCard key={a.id} appt={a} />)}</ul>
            </section>
          )}
        </>
      )}

      {open && (
        <InviteMeetingModal lead={lead} leadId={leadId} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChange(); }} />
      )}
    </div>
  );
}

function ApptCard({ appt }: { appt: AppointmentRow }) {
  const meta = APPT_STATE_META[appt.time_state];
  const StateIcon = meta.Icon;
  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        <div className="text-center shrink-0 w-12">
          {appt.starts_at ? (
            <>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{new Date(appt.starts_at).toLocaleString('en-US', { month: 'short' })}</div>
              <div className="text-lg font-bold text-white tabular-nums">{new Date(appt.starts_at).getDate()}</div>
              <div className="text-[9px] text-slate-500">{new Date(appt.starts_at).toLocaleString('en-US', { weekday: 'short' })}</div>
            </>
          ) : <div className="text-slate-500 text-xs">TBD</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white truncate">{appt.title}</span>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border"
                  style={{ color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}1a` }}>
              <StateIcon className="w-2.5 h-2.5" />
              {meta.label}
            </span>
            {appt.meet_link && (
              <a href={appt.meet_link} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                <Video className="w-2.5 h-2.5" />
                Open Meet
              </a>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
            {appt.starts_at && (
              <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(appt.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {appt.duration_minutes} min</span>
            )}
            {appt.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{appt.location}</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

// Event type the modal needs for the guided flow. Keep the shape narrow
// — we only need fields the picker + slot fetch touch.
interface ModalEventType {
  id: number;
  name: string;
  duration_minutes: number;
  location_kind: string;
  location_value: string;
  location_label: string;
  assignment_mode: 'single' | 'round_robin' | 'collective';
  hosts_detail?: { id: number; full_name: string; email: string }[];
  booking_path?: string;
  is_active: boolean;
}

// Two flows:
//   1. ``existing`` — pick an already-created appointment and attach
//      this lead's email as a guest on it.
//   2. ``create``  — book a brand-new appointment using an event type
//      (the guided slot-picker flow).
type InviteMode = 'existing' | 'create';

interface ExistingAppt {
  id: number;
  title: string;
  starts_at: string;
  duration_minutes: number;
  status: string;
  meet_link: string | null;
  guest_emails?: string[];
  contact_email?: string | null;
}

function InviteMeetingModal({
  lead, leadId, onClose, onSaved,
}: { lead: LeadDetail; leadId: number; onClose: () => void; onSaved: () => void }) {
  // Two modes — "existing" picks an already-created appointment and
  // attaches the lead as a guest; "create" runs the guided event-type
  // booking flow that creates a brand-new appointment.
  const [mode, setMode] = useState<InviteMode>('existing');

  // Existing-appointment picker state.
  const [allAppts, setAllAppts] = useState<ExistingAppt[]>([]);
  const [pickedApptId, setPickedApptId] = useState<number | ''>('');
  const [extraGuestInput, setExtraGuestInput] = useState('');
  const [extraGuests, setExtraGuests] = useState<string[]>([]);

  // Shared lead-driven defaults so the booker box pre-fills.
  const leadName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
                 || lead.full_name || lead.email || `Lead #${lead.id}`;
  const [name, setName] = useState(leadName);
  const [email, setEmail] = useState(lead.email || '');
  const [phone, setPhone] = useState(lead.phone || '');
  const [tz, setTz] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { return 'UTC'; }
  });
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // ───── Event-type mode state ──────────────────────────────────────
  const [events, setEvents] = useState<ModalEventType[]>([]);
  const [eventId, setEventId] = useState<number | ''>('');
  const event = events.find((e) => e.id === eventId) || null;
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const [month, setMonth] = useState<Date>(new Date(today0.getFullYear(), today0.getMonth(), 1));
  const [date, setDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);
  const [hostId, setHostId] = useState<'' | number>('');


  // Load event types once (used by the "create new" flow).
  useEffect(() => {
    OrganizationService.listEventTypes().then((r) => {
      if (r?.success) {
        const active = (r.data as ModalEventType[]).filter((e) => e.is_active);
        setEvents(active);
      }
    }).catch(() => {});
  }, []);

  // Load every appointment in the workspace (any scope, any assignee)
  // so the user can attach the lead to one they already created.
  useEffect(() => {
    if (mode !== 'existing') return;
    OrganizationService.listAppointments({ scope: 'all' }).then((r) => {
      if (r?.success) {
        // The list endpoint returns ``{ appointments, counts, ... }``.
        const list: ExistingAppt[] = r.data?.appointments || [];
        // Sort upcoming first, then most recent. Don't bother with past ones.
        list.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
        setAllAppts(list);
      }
    }).catch(() => {});
  }, [mode]);

  const addExtraGuest = () => {
    const g = extraGuestInput.trim();
    if (!g || !/.+@.+\..+/.test(g)) { toast.error('Enter a valid email'); return; }
    if (extraGuests.includes(g)) { toast.error('Already added'); return; }
    setExtraGuests([...extraGuests, g]);
    setExtraGuestInput('');
  };
  const removeExtraGuest = (g: string) => setExtraGuests(extraGuests.filter((x) => x !== g));

  const saveExistingMode = async () => {
    if (!pickedApptId) { toast.error('Pick an appointment'); return; }
    const target = allAppts.find((a) => a.id === pickedApptId);
    if (!target) return;
    // Build the new guest list: existing guests + lead's email (if any) + any
    // extras the user typed. We never duplicate addresses.
    const seen = new Set<string>((target.guest_emails || []).map((g) => g.toLowerCase()));
    const next: string[] = [...(target.guest_emails || [])];
    const addOne = (g: string) => {
      const norm = g.trim();
      if (!norm) return;
      if (seen.has(norm.toLowerCase())) return;
      seen.add(norm.toLowerCase());
      next.push(norm);
    };
    if (email.trim()) addOne(email.trim());
    extraGuests.forEach(addOne);
    if (next.length === (target.guest_emails || []).length) {
      toast.error('Nothing to add — those guests are already on the meeting.');
      return;
    }
    setSaving(true);
    try {
      const res = await OrganizationService.updateAppointment(target.id, { guest_emails: next });
      if (res?.success) {
        toast.success(`Added to "${target.title}"`);
        onSaved();
      } else toast.error(res?.message || 'Could not update');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not update');
    } finally { setSaving(false); }
  };

  // Fetch slots when (event_type, date) changes — same public slots
  // endpoint the booking page uses, no auth header needed.
  useEffect(() => {
    if (mode !== 'create') return;
    if (!event || !date) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlot(null);
    // Per-tenant API base -- prod uses ``<sub>.api.morefungi.com``,
    // dev falls back to ``localhost:8000``. See lib/apiBase.ts.
    const base = resolveApiV1Base();
    const path = event.booking_path || '';
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    fetch(`${base}/organization/public${path}/slots/?date=${iso}`)
      .then((r) => r.json())
      .then((j) => { if (j?.success) setSlots(j.data?.slots || []); else setSlots([]); })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [mode, event, date]);

  const addGuest = () => {
    const g = guestInput.trim();
    if (!g || !/.+@.+\..+/.test(g)) { toast.error('Enter a valid email'); return; }
    if (guests.includes(g)) { toast.error('Already added'); return; }
    setGuests([...guests, g]);
    setGuestInput('');
  };
  const removeGuest = (g: string) => setGuests(guests.filter((x) => x !== g));

  const saveEventTypeMode = async () => {
    if (!eventId) { toast.error('Pick an event type'); return; }
    if (!slot) { toast.error('Pick a time slot'); return; }
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!email.trim() && !phone.trim()) { toast.error('Email or phone is required'); return; }
    setSaving(true);
    try {
      const res = await OrganizationService.bookAppointment({
        event_type: Number(eventId),
        starts_at: slot,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone: tz,
        host_id: hostId ? Number(hostId) : undefined,
        guests: guests.length ? guests : undefined,
        notes: notes.trim() || undefined,
      });
      if (res?.success) {
        toast.success('Appointment booked');
        onSaved();
      } else toast.error(res?.message || 'Could not book');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not book');
    } finally { setSaving(false); }
  };

  // Mini calendar grid for event-type mode.
  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a1020]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h2 className="text-base font-bold text-white">Invite to meeting</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Attach this lead to an existing appointment as a guest, or book a new one.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Mode tabs */}
        <div className="px-5 pt-4 flex gap-1.5">
          <button
            onClick={() => setMode('existing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              mode === 'existing'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : 'border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Add to existing appointment
          </button>
          <button
            onClick={() => setMode('create')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              mode === 'create'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : 'border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            Create new
          </button>
        </div>

        {mode === 'create' ? (
          <div className="p-5 space-y-4">
            {events.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4 text-[12px] text-amber-200">
                No event types yet. Create one under Scheduling first.
              </div>
            ) : (
              <>
                <Field label="1. Event type">
                  <select
                    value={eventId}
                    onChange={(e) => { setEventId(e.target.value ? Number(e.target.value) : ''); setSlot(null); setDate(null); setHostId(''); }}
                    className={ipt}
                  >
                    <option value="" className="bg-[#0a1020]">Pick an event type…</option>
                    {events.map((e) => (
                      <option key={e.id} value={e.id} className="bg-[#0a1020]">
                        {e.name} · {e.duration_minutes}m · {e.location_label || e.location_kind}
                      </option>
                    ))}
                  </select>
                </Field>

                {event && (
                  <Field label="2. Pick a time">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <button type="button"
                            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                            className="p-1 rounded text-slate-500 hover:text-white">‹</button>
                          <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-300">{monthLabel}</span>
                          <button type="button"
                            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                            className="p-1 rounded text-slate-500 hover:text-white">›</button>
                        </div>
                        <div className="grid grid-cols-7 text-center text-[10px] text-slate-500 mb-1">
                          {['S','M','T','W','T','F','S'].map((d, i) => <div key={i}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-y-1">
                          {cells.map((c, i) => {
                            if (!c) return <div key={i} />;
                            const isPast = c < today0;
                            const selected = date && c.toDateString() === date.toDateString();
                            return (
                              <div key={i} className="flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => !isPast && setDate(c)}
                                  disabled={isPast}
                                  className={`w-8 h-8 rounded-full text-[12px] font-semibold transition-colors ${
                                    selected
                                      ? 'bg-emerald-600 text-white'
                                      : isPast
                                      ? 'text-slate-700 cursor-not-allowed'
                                      : 'text-white hover:bg-white/[0.06]'
                                  }`}
                                >
                                  {c.getDate()}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-400 mb-2 font-semibold">
                          {date
                            ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                            : 'Pick a date first'}
                        </div>
                        {!date ? (
                          <div className="text-[11px] text-slate-500 italic py-4">Available slots appear here.</div>
                        ) : slotsLoading ? (
                          <div className="space-y-1.5">
                            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />)}
                          </div>
                        ) : slots.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-4">No slots on this day.</div>
                        ) : (
                          <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                            {slots.map((iso) => (
                              <button
                                type="button"
                                key={iso}
                                onClick={() => setSlot(iso)}
                                className={`w-full text-center px-3 py-2 rounded-lg text-[12.5px] font-semibold border ${
                                  slot === iso
                                    ? 'border-emerald-500/60 bg-emerald-500/15 text-white'
                                    : 'border-white/5 bg-white/[0.02] hover:border-emerald-500/40 text-slate-200'
                                }`}
                              >
                                {new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Field>
                )}

                {event && slot && (
                  <>
                    <Field label="3. Confirm contact details">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input className={ipt} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                        <input className={ipt} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                      <input className={`${ipt} mt-2`} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </Field>

                    <Field label="4. Extras">
                      {event.assignment_mode === 'round_robin' && event.hosts_detail && event.hosts_detail.length > 0 && (
                        <label className="block mb-2">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500">Staff member</span>
                          <select
                            value={hostId === '' ? '' : String(hostId)}
                            onChange={(e) => setHostId(e.target.value ? Number(e.target.value) : '')}
                            className={`mt-1 ${ipt}`}
                          >
                            <option value="" className="bg-[#0a1020]">Auto-assign (round robin)</option>
                            {event.hosts_detail.map((h) => (
                              <option key={h.id} value={h.id} className="bg-[#0a1020]">{h.full_name || h.email}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="block mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Client timezone</span>
                        <select value={tz} onChange={(e) => setTz(e.target.value)} className={`mt-1 ${ipt}`}>
                          {(() => {
                            try {
                              const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
                              const zones = typeof intl.supportedValuesOf === 'function' ? intl.supportedValuesOf('timeZone') : [];
                              const list = zones.includes(tz) ? zones : [tz, ...zones];
                              return list.map((z) => <option key={z} value={z} className="bg-[#0a1020]">{z}</option>);
                            } catch {
                              return <option value={tz}>{tz}</option>;
                            }
                          })()}
                        </select>
                      </label>
                      <div className="mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Guest emails</span>
                        {guests.length > 0 && (
                          <ul className="mt-1 space-y-1">
                            {guests.map((g) => (
                              <li key={g} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/[0.02] text-[12px]">
                                <span className="text-slate-200 truncate">{g}</span>
                                <button type="button" onClick={() => removeGuest(g)} className="p-0.5 rounded text-slate-500 hover:text-red-300">
                                  <X className="w-3 h-3" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <input
                            className={ipt}
                            placeholder="guest@example.com"
                            value={guestInput}
                            onChange={(e) => setGuestInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
                          />
                          <button type="button" onClick={addGuest} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">Add</button>
                        </div>
                      </div>
                      <label className="block">
                        <span className="text-[10px] uppercase tracking-wider text-slate-500">Notes (optional)</span>
                        <textarea
                          rows={3}
                          className={`mt-1 ${ipt}`}
                          placeholder="Agenda, context, what to prepare…"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </label>
                    </Field>
                  </>
                )}
              </>
            )}
          </div>
        ) : (
          /* ── "Add to existing appointment" ──
             Pick a meeting already in the calendar and attach this
             lead's email (plus any extras the user types) onto its
             guest list. The lead doesn't have to be the "main" contact
             on the appointment — they can be on any meeting in the
             workspace. */
          <div className="p-5 space-y-4">
            <Field label="1. Pick the appointment">
              {allAppts.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[12px] text-slate-400">
                  No appointments yet. Switch to <button onClick={() => setMode('create')} className="underline text-white">Create new</button> to book one.
                </div>
              ) : (
                <select
                  value={pickedApptId}
                  onChange={(e) => setPickedApptId(e.target.value ? Number(e.target.value) : '')}
                  className={ipt}
                >
                  <option value="" className="bg-[#0a1020]">Choose an appointment…</option>
                  {allAppts.map((a) => {
                    const when = new Date(a.starts_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    });
                    return (
                      <option key={a.id} value={a.id} className="bg-[#0a1020]">
                        {a.title} · {when} · {a.status}
                      </option>
                    );
                  })}
                </select>
              )}
            </Field>

            {pickedApptId !== '' && (() => {
              const target = allAppts.find((a) => a.id === pickedApptId);
              if (!target) return null;
              const existing = target.guest_emails || [];
              return (
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="text-[11px] text-slate-400 mb-1">
                    <strong className="text-white">{target.title}</strong>
                    <span className="mx-1.5 text-slate-600">·</span>
                    {new Date(target.starts_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    <span className="mx-1.5 text-slate-600">·</span>
                    {target.duration_minutes}m
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Current guests: {existing.length === 0 ? 'none' : existing.join(', ')}
                  </div>
                </div>
              );
            })()}

            <Field label="2. Lead being added">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[12px]">
                <div className="text-white font-semibold">{leadName}</div>
                <div className="text-slate-400 mt-0.5">
                  {email || <span className="italic text-amber-300">No email on this lead — add an extra guest below.</span>}
                </div>
              </div>
            </Field>

            <Field label="3. Extra guests (optional)">
              {extraGuests.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {extraGuests.map((g) => (
                    <li key={g} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/[0.02] text-[12px]">
                      <span className="text-slate-200 truncate">{g}</span>
                      <button type="button" onClick={() => removeExtraGuest(g)} className="p-0.5 rounded text-slate-500 hover:text-red-300">
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-1.5">
                <input
                  className={ipt}
                  placeholder="guest@example.com"
                  value={extraGuestInput}
                  onChange={(e) => setExtraGuestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExtraGuest(); } }}
                />
                <button type="button" onClick={addExtraGuest} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
                  Add
                </button>
              </div>
            </Field>
          </div>
        )}

        <div className="px-5 py-3 border-t border-white/5 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.04]">Cancel</button>
          <button
            onClick={mode === 'create' ? saveEventTypeMode : saveExistingMode}
            disabled={
              saving
              || (mode === 'create'   && (!event || !slot))
              || (mode === 'existing' && !pickedApptId)
            }
            className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {saving
              ? (mode === 'create' ? 'Booking…' : 'Adding…')
              : (mode === 'create' ? 'Book appointment' : 'Add to appointment')}
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

// ──────────────────────────────────────────────────────────────────────
//  NOTES
// ──────────────────────────────────────────────────────────────────────

function NotesTab({ leadId, notes, onChange }: { leadId: number; notes: NoteRow[]; onChange: () => void }) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await OrganizationService.createLeadNote(leadId, body.trim());
      if (res?.success) { setBody(''); onChange(); toast.success('Note added'); }
      else toast.error(res?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const togglePin = async (n: NoteRow) => {
    await OrganizationService.updateLeadNote(n.id, { pinned: !n.pinned });
    onChange();
  };
  const remove = async (n: NoteRow) => {
    if (!confirm('Delete this note?')) return;
    const res = await OrganizationService.deleteLeadNote(n.id);
    if (res?.success) onChange();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Write a note about this lead — call summary, next step, blocker…"
          className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
        <div className="mt-2 flex justify-end">
          <button onClick={add} disabled={saving || !body.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40">
            <Plus className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </section>

      {notes.length === 0 ? (
        <EmptySection icon={FileText} title="No notes yet" subtitle="Notes appear here. Pin the most important ones to keep them at the top." />
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-2xl border p-4 ${n.pinned ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white whitespace-pre-wrap break-words">{n.body}</div>
                  <div className="mt-2 text-[10px] text-slate-500 inline-flex items-center gap-2 flex-wrap">
                    {n.author_email && <span>by {n.author_email}</span>}
                    <span>·</span>
                    <span>{new Date(n.created_at).toLocaleString()}</span>
                    {n.pinned && <span className="text-amber-300 inline-flex items-center gap-1"><Pin className="w-2.5 h-2.5" /> Pinned</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => togglePin(n)} className="p-1.5 rounded text-slate-400 hover:text-amber-300 hover:bg-amber-500/[0.08]" title={n.pinned ? 'Unpin' : 'Pin'}>
                    {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => remove(n)} className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/[0.08]" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  FILES
// ──────────────────────────────────────────────────────────────────────

function FilesTab({ leadId, attachments, onChange }: { leadId: number; attachments: AttachmentRow[]; onChange: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const onSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const res = await OrganizationService.uploadLeadAttachment(leadId, f);
        if (!res?.success) toast.error(res?.message || `${f.name} failed`);
      }
      onChange();
      toast.success(`${files.length} file${files.length === 1 ? '' : 's'} uploaded`);
    } finally { setUploading(false); }
  };
  const remove = async (a: AttachmentRow) => {
    if (!confirm(`Delete ${a.filename}?`)) return;
    const res = await OrganizationService.deleteLeadAttachment(a.id);
    if (res?.success) onChange();
  };
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    onSelect(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Attachments</h2>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50">
          <Paperclip className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Upload files'}
        </button>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onSelect(e.target.files)} />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="rounded-2xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 bg-white/[0.02] p-6 text-center text-slate-400 text-xs cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        Drag &amp; drop files here, or click to pick.
      </div>

      {attachments.length === 0 ? (
        <EmptySection icon={Paperclip} title="No attachments yet" subtitle="Upload contracts, screenshots, IDs — anything related to this lead." />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {attachments.map((a) => {
            const isImg = a.mime_type.startsWith('image/');
            return (
              <li key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/[0.05] border border-white/10 text-slate-300 flex items-center justify-center shrink-0">
                  {isImg ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{a.filename}</div>
                  <div className="text-[10px] text-slate-500">
                    {formatBytes(a.size_bytes)} · {new Date(a.created_at).toLocaleDateString()}
                    {a.uploaded_by_email && ` · ${a.uploaded_by_email}`}
                  </div>
                </div>
                {a.url && (
                  <a href={a.url} download className="p-1.5 rounded text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/[0.08]" title="Download">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => remove(a)} className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/[0.08]" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ──────────────────────────────────────────────────────────────────────
//  ACTIVITY (timeline)
// ──────────────────────────────────────────────────────────────────────

function ActivityTab({ timeline }: { timeline: TimelineEntry[] }) {
  if (timeline.length === 0) {
    return <EmptySection icon={Sparkles} title="No activity yet" subtitle="Stage changes, scoring, AI moves and tasks will appear here as they happen." />;
  }
  return (
    <ul className="space-y-2">
      {timeline.map((e) => (
        <li key={e.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white">{e.description || e.activity_type}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {e.actor_email && <>by {e.actor_email} · </>}
              {e.at && new Date(e.at).toLocaleString()}
            </div>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">{e.activity_type}</span>
        </li>
      ))}
    </ul>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  EDIT
// ──────────────────────────────────────────────────────────────────────

interface PipelineLite { id: number; name: string; industry?: string; is_default?: boolean }
interface StageLite { id: number; name: string; color: string; probability: number; pipeline?: number | null }

function EditTab({ lead, onSaved, onCancel }: { lead: LeadDetail; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    email: lead.email || '',
    phone: lead.phone || '',
    company: lead.company || '',
    value: String(lead.value || ''),
    status: lead.status || 'new',
    expected_close_date: lead.expected_close_date || '',
    pipeline: lead.pipeline ?? null as number | null,
    stage: lead.stage ?? null as number | null,
  });
  const [pipelines, setPipelines] = useState<PipelineLite[]>([]);
  const [stages, setStages] = useState<StageLite[]>([]);
  const [saving, setSaving] = useState(false);

  // Load every pipeline once for the dropdown.
  useEffect(() => {
    OrganizationService.listPipelines().then((r) => {
      if (r?.success) setPipelines(r.data as PipelineLite[]);
    });
  }, []);

  // Re-fetch the stage list every time the chosen pipeline changes —
  // a "Restaurant" pipeline should never show "Hotel" stages in its
  // dropdown. Falls back to all stages when no pipeline is set yet.
  useEffect(() => {
    OrganizationService
      .listLeadStages(form.pipeline ? { pipeline: form.pipeline } : undefined)
      .then((r) => {
        if (!r?.success) return;
        const list = r.data as StageLite[];
        setStages(list);
        // Stage value pruning: if the lead's previous stage doesn't
        // belong to the newly chosen pipeline, clear it so we never
        // POST an inconsistent (pipeline_id, stage_id) pair.
        if (form.stage && !list.some((s) => s.id === form.stage)) {
          setForm((f) => ({ ...f, stage: null }));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pipeline]);

  const save = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast.error('Name is required'); return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      if (form.value) payload.value = Number(form.value);
      if (!form.expected_close_date) payload.expected_close_date = null;
      const res = await OrganizationService.updateLead(lead.id, payload);
      if (res?.success) {
        toast.success('Saved');
        onSaved();
      } else toast.error(res?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name"><input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={ipt} /></Field>
        <Field label="Last name"><input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={ipt} /></Field>
      </div>
      <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={ipt} /></Field>
      <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={ipt} /></Field>
      <Field label="Company"><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={ipt} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Deal value (USD)"><input type="number" min={0} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={ipt} /></Field>
        <Field label="Expected close"><input type="date" value={form.expected_close_date || ''} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} className={ipt} /></Field>
      </div>

      {/* Pipeline → Stage cascade. Switching pipeline auto-clears the
          stage when it doesn't belong to the newly chosen pipeline. */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pipeline">
          <select
            value={form.pipeline ?? ''}
            onChange={(e) => setForm({ ...form, pipeline: e.target.value ? Number(e.target.value) : null })}
            className={ipt}
          >
            <option value="" className="bg-[#0a1020]">— No pipeline —</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#0a1020]">
                {p.name}{p.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Stage">
          <select
            value={form.stage ?? ''}
            onChange={(e) => setForm({ ...form, stage: e.target.value ? Number(e.target.value) : null })}
            className={ipt}
            disabled={stages.length === 0}
          >
            <option value="" className="bg-[#0a1020]">
              {stages.length ? '— Pick a stage —' : 'No stages in this pipeline'}
            </option>
            {stages.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#0a1020]">
                {s.name} · {s.probability}%
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Status">
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={ipt}>
          <option value="new" className="bg-[#0a1020]">New</option>
          <option value="contacted" className="bg-[#0a1020]">Contacted</option>
          <option value="qualified" className="bg-[#0a1020]">Qualified</option>
          <option value="won" className="bg-[#0a1020]">Won</option>
          <option value="lost" className="bg-[#0a1020]">Lost</option>
        </select>
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.04]">Cancel</button>
        <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Shared empty-state
// ──────────────────────────────────────────────────────────────────────

function EmptySection({
  icon: Icon, title, subtitle,
}: { icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
      <Icon className="w-8 h-8 mx-auto mb-3 text-slate-600" />
      <div className="text-sm font-bold text-white">{title}</div>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  );
}
