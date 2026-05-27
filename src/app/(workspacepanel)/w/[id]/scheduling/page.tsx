'use client';

import { useCallback, useEffect, useMemo, useState, use as reactUse } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Search, Copy, ExternalLink, MoreHorizontal, Trash2, Pencil,
  Calendar as CalendarIcon, Clock, Video, Shield, X,
  PlusCircle, Settings, Bell, ChevronDown, AlertTriangle, Plug,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import QuotaBadge from '@/components/QuotaBadge';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';

/**
 * Scheduling — Calendly-style Event Type management.
 *
 * Each "Event Type" is a bookable meeting template with its own slug,
 * duration, location, host(s), assignment mode (single / round-robin /
 * collective), weekly availability, and per-scenario email notifications.
 *
 * Right-side modal has four tabs:
 *   1. Basic Details  — name, slug, description, duration, location
 *   2. Availability   — per-weekday hour ranges + timezone
 *   3. Advanced       — assignment mode, buffers, daily cap, min-notice
 *   4. Notifications  — email subject/body per scenario with placeholders
 */

const WEEKDAYS: { key: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'; label: string }[] = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

const LOCATIONS: { value: string; label: string }[] = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom',        label: 'Zoom' },
  { value: 'phone',       label: 'Phone call' },
  { value: 'in_person',   label: 'In-person' },
  { value: 'custom',      label: 'Custom link' },
];

const ASSIGNMENT_MODES: { value: string; label: string; help: string }[] = [
  { value: 'single',       label: 'Single host',     help: 'One specific person hosts every meeting.' },
  { value: 'round_robin',  label: 'Round robin',     help: 'Distributes bookings evenly across hosts.' },
  { value: 'collective',   label: 'Collective',      help: 'All hosts attend together — only show overlapping availability.' },
];

const DURATIONS = [15, 30, 45, 60, 90, 120];

type HourRange = { start: string; end: string };
type Weekly = Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', HourRange[]>;
type Availability = { timezone: string; weekly: Weekly };

type NotificationScenario = { enabled: boolean; subject: string; body: string };
type Notifications = {
  enabled: boolean;
  confirmation: NotificationScenario;
  reschedule:   NotificationScenario;
  reminder_24h: NotificationScenario;
  cancellation: NotificationScenario;
  follow_up:    NotificationScenario;
};

interface EventType {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  daily_cap: number;
  location_kind: string;
  location_value: string;
  location_label: string;
  assignment_mode: string;
  hosts: number[];
  hosts_detail: { id: number; email: string; full_name: string }[];
  availability: Availability;
  notifications: Notifications;
  is_active: boolean;
  booking_path: string;
  created_at: string;
  updated_at: string;
}

const blankNotif = (subject: string, body: string): NotificationScenario => ({ enabled: true, subject, body });

const blankAvailability = (): Availability => ({
  timezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' : 'UTC',
  weekly: {
    mon: [{ start: '09:00', end: '17:00' }],
    tue: [{ start: '09:00', end: '17:00' }],
    wed: [{ start: '09:00', end: '17:00' }],
    thu: [{ start: '09:00', end: '17:00' }],
    fri: [{ start: '09:00', end: '17:00' }],
    sat: [],
    sun: [],
  },
});

const blankEventType = (): Partial<EventType> => ({
  name: '',
  slug: '',
  description: '',
  color: '#10b981',
  duration_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 60,
  daily_cap: 0,
  location_kind: 'google_meet',
  location_value: '',
  assignment_mode: 'single',
  hosts: [],
  availability: blankAvailability(),
  notifications: {
    enabled: true,
    confirmation: blankNotif('Booking confirmed: {title}',
      '<p>Hi {name},</p><p>Your booking for <strong>{title}</strong> is confirmed for <strong>{time}</strong>.</p><p>Location: {location}</p>'),
    reschedule:   blankNotif('Rescheduled: {title}',
      '<p>Hi {name},</p><p>Your booking for {title} has been moved to {time}.</p>'),
    reminder_24h: blankNotif('Reminder: {title} tomorrow',
      '<p>Hi {name},</p><p>Just a reminder for {title} on {time}.</p>'),
    cancellation: blankNotif('Cancelled: {title}',
      '<p>Hi {name},</p><p>Your booking for {title} on {time} has been cancelled.</p>'),
    follow_up:    { enabled: false, subject: 'Thanks for meeting!',
      body: '<p>Hi {name},</p><p>Thanks for taking the time to meet — looking forward to next steps.</p>' },
  },
  is_active: true,
});

export default function SchedulingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="scheduling" required="scheduling.view" workspaceId={wsId} skeleton="grid">
      <SchedulingInner wsId={wsId} />
    </PermissionGuard>
  );
}

interface WorkspaceMemberLite {
  user_id: number;
  email: string;
  full_name: string;
  role?: string;
}

function SchedulingInner({ wsId }: { wsId: string }) {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<EventType[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; data: Partial<EventType> } | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.listEventTypes();
      if (res?.success) setEvents(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pull the workspace member roster once so the host picker has real
  // names to show. Fails silently — the picker degrades to a numeric-id
  // entry hint if the call is blocked.
  useEffect(() => {
    const wid = Number(wsId);
    if (!wid || Number.isNaN(wid)) return;
    OrganizationService.listWorkspaceMembers(wid).then((res) => {
      if (res?.success) setMembers(res.data as WorkspaceMemberLite[]);
    }).catch(() => {});
  }, [wsId]);

  // Auto-open create modal when arriving via `?new=1` (sidebar Create link)
  useEffect(() => {
    if (searchParams?.get('new') === '1') {
      setModal({ mode: 'create', data: blankEventType() });
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.slug.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q)
    );
  }, [events, search]);

  const copyLink = async (e: EventType) => {
    const url = typeof window !== 'undefined' ? window.location.origin + e.booking_path : e.booking_path;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Booking link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const openBooking = (e: EventType) => {
    if (typeof window !== 'undefined') {
      window.open(window.location.origin + e.booking_path, '_blank');
    }
  };

  const toggle = async (e: EventType) => {
    const res = await OrganizationService.toggleEventType(e.id);
    if (res?.success) {
      setEvents((curr) => curr.map((x) => x.id === e.id ? { ...x, is_active: res.data.is_active } : x));
    }
  };

  const remove = async (e: EventType) => {
    if (!confirm(`Delete event type "${e.name}"?`)) return;
    const res = await OrganizationService.deleteEventType(e.id);
    if (res?.success) {
      toast.success('Deleted');
      setEvents((curr) => curr.filter((x) => x.id !== e.id));
    }
  };

  void wsId; // referenced to silence unused-var lint when guard wraps inner

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            Scheduling
            <QuotaBadge quota="event_types" label="event types" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">Create and manage your meeting types and availability.</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create', data: blankEventType() })}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Create New Meeting
        </button>
      </div>

      <div className="mb-6 border-b border-white/10">
        <div className="inline-flex items-center gap-1 px-1 pb-2 border-b-2 border-emerald-500 text-sm font-semibold text-white">
          Event types
        </div>
      </div>

      <div className="mb-6 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          placeholder="Search event types"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      {loading ? (
        <PageSkeleton kind="grid" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center">
          <CalendarIcon className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-sm text-slate-400">
            {search ? 'No matching event types.' : 'No event types yet. Click "Create New Meeting" to make your first one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              menuOpen={menuOpenId === e.id}
              onOpenMenu={() => setMenuOpenId(menuOpenId === e.id ? null : e.id)}
              onCloseMenu={() => setMenuOpenId(null)}
              onCopy={() => copyLink(e)}
              onOpen={() => openBooking(e)}
              onToggle={() => toggle(e)}
              onEdit={() => setModal({ mode: 'edit', data: e })}
              onDelete={() => remove(e)}
            />
          ))}
        </div>
      )}

      {modal && (
        <EventTypeModal
          mode={modal.mode}
          initial={modal.data}
          members={members}
          wsId={wsId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

function EventCard({
  event, menuOpen, onOpenMenu, onCloseMenu,
  onCopy, onOpen, onToggle, onEdit, onDelete,
}: {
  event: EventType;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="relative rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: event.color }} />

      <div className="p-5 pl-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white truncate">{event.name}</h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {event.duration_minutes} min
              </span>
              <span className="uppercase tracking-wider">{(event.location_label || event.location_kind).replace(/_/g, ' ')}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onToggle}
              title={event.is_active ? 'Active' : 'Inactive'}
              className={`px-2 py-1 rounded-full ${event.is_active ? 'text-emerald-300' : 'text-slate-500'}`}
            >
              <span className={`inline-block w-9 h-5 rounded-full relative transition-colors ${event.is_active ? 'bg-emerald-500/30 border border-emerald-400/60' : 'bg-slate-700/60'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${event.is_active ? 'translate-x-4 bg-emerald-300' : 'bg-slate-400'}`} />
              </span>
            </button>
            <div className="relative">
              <button
                onClick={onOpenMenu}
                className="p-1.5 rounded text-slate-500 hover:text-white hover:bg-white/[0.06]"
                aria-label="More"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
                  <div className="absolute right-0 top-8 z-20 w-40 rounded-lg border border-white/10 bg-[#0a1020] shadow-xl py-1">
                    <button onClick={() => { onCloseMenu(); onEdit(); }} className="w-full text-left px-3 py-1.5 text-xs text-slate-200 hover:bg-white/[0.04] inline-flex items-center gap-2">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => { onCloseMenu(); onDelete(); }} className="w-full text-left px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/[0.08] inline-flex items-center gap-2">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {event.description && (
          <p className="mt-3 text-xs text-slate-400 line-clamp-2">{event.description}</p>
        )}

        <div className="mt-5 flex items-center gap-2">
          <button
            onClick={onCopy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-sm font-semibold text-white"
          >
            <Copy className="w-4 h-4" />
            Copy link
          </button>
          <button
            onClick={onOpen}
            title="Open booking page"
            className="px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

type TabKey = 'basic' | 'availability' | 'advanced' | 'notifications';

function EventTypeModal({
  mode, initial, members, wsId, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  initial: Partial<EventType>;
  members: WorkspaceMemberLite[];
  wsId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<TabKey>('basic');
  const [form, setForm] = useState<Partial<EventType>>(initial);
  const [saving, setSaving] = useState(false);
  // Per-location credential gating. Right now Google Meet is the one
  // that needs a server-side credential to actually generate links; we
  // probe the channel list once on mount and re-check after Connect Now.
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);
  const [oauthBusy, setOauthBusy] = useState(false);

  const probeCredentials = useCallback(async () => {
    try {
      const res = await OrganizationService.listChannels();
      if (res?.success) {
        const rows = res.data as Array<{ kind: string; is_connected: boolean }>;
        setGoogleConnected(rows.some((r) => r.kind === 'google_calendar' && r.is_connected));
        setZoomConnected(rows.some((r) => r.kind === 'zoom' && r.is_connected));
      } else {
        setGoogleConnected(false);
        setZoomConnected(false);
      }
    } catch {
      setGoogleConnected(false);
      setZoomConnected(false);
    }
  }, []);
  useEffect(() => { probeCredentials(); }, [probeCredentials]);

  // Listen for the OAuth callback popup so a successful Connect Now
  // re-probes the credentials without making the user reload the modal.
  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const d = ev?.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === 'google-oauth-success') {
        setOauthBusy(false);
        toast.success(d.message || 'Google connected — Meet links will be auto-attached.');
        probeCredentials();
      } else if (d.type === 'google-oauth-error') {
        setOauthBusy(false);
        toast.error(d.message || 'Google connection failed.');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [probeCredentials]);

  const startGoogleConnect = async () => {
    setOauthBusy(true);
    try {
      const res = await OrganizationService.googleOAuthStart({ workspace_id: wsId });
      if (!res?.success || !res.data?.auth_url) {
        toast.error(res?.message || 'OAuth not configured — see the credentials page.');
        setOauthBusy(false);
        return;
      }
      const w = 520, h = 640;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      const popup = window.open(res.data.auth_url, 'google-oauth',
        `width=${w},height=${h},left=${left},top=${top}`);
      if (!popup) {
        toast.error('Popup blocked — allow popups and retry.');
        setOauthBusy(false);
        return;
      }
      const t = setInterval(() => {
        if (popup.closed) { clearInterval(t); setOauthBusy(false); }
      }, 500);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not start Google OAuth');
      setOauthBusy(false);
    }
  };

  // The current location's credential state. Drives the in-form banner
  // and disables Save when a hard requirement is missing.
  const needsGoogle = form.location_kind === 'google_meet' && googleConnected === false;
  const needsZoom   = form.location_kind === 'zoom'        && zoomConnected   === false;
  const credentialBlocked = needsGoogle || needsZoom;

  const update = (patch: Partial<EventType>) => setForm((f) => ({ ...f, ...patch }));

  // Auto-derive slug from name in create mode unless user edited it.
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  useEffect(() => {
    if (slugTouched) return;
    const name = form.name || '';
    const slug = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    setForm((f) => ({ ...f, slug }));
  }, [form.name, slugTouched]);

  const save = async () => {
    if (!form.name?.trim()) { toast.error('Please enter an event name'); setTab('basic'); return; }
    if (credentialBlocked) {
      toast.error(needsGoogle
        ? 'Connect Google Calendar before saving — Meet links can\'t be generated without it.'
        : 'Connect Zoom before saving — meeting links can\'t be generated without it.');
      setTab('basic');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      const res = mode === 'create'
        ? await OrganizationService.createEventType(payload as Record<string, unknown>)
        : await OrganizationService.updateEventType(form.id as number, payload as Record<string, unknown>);
      if (res?.success) {
        toast.success(mode === 'create' ? 'Event type created' : 'Saved');
        onSaved();
      } else {
        toast.error(res?.message || 'Failed to save');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="ml-auto w-full max-w-5xl h-full bg-[#0a1020] border-l border-white/10 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">{mode === 'create' ? 'New Event' : 'Edit Event'}</h2>
            <p className="text-xs text-slate-400 mt-1">Configure how people book with you</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex">
          {/* Tab sidebar */}
          <nav className="w-56 shrink-0 border-r border-white/5 p-3 space-y-1">
            <TabButton active={tab === 'basic'}        onClick={() => setTab('basic')}        icon={<PlusCircle className="w-4 h-4" />}>Basic Details</TabButton>
            <TabButton active={tab === 'availability'} onClick={() => setTab('availability')} icon={<Clock className="w-4 h-4" />}>Availability</TabButton>
            <TabButton active={tab === 'advanced'}     onClick={() => setTab('advanced')}     icon={<Settings className="w-4 h-4" />}>Advanced Settings</TabButton>
            <TabButton active={tab === 'notifications'} onClick={() => setTab('notifications')} icon={<Bell className="w-4 h-4" />}>Notifications</TabButton>
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {tab === 'basic' && (
              <TabBasic
                form={form}
                setSlugTouched={setSlugTouched}
                update={update}
                googleConnected={googleConnected}
                zoomConnected={zoomConnected}
                onConnectGoogle={startGoogleConnect}
                oauthBusy={oauthBusy}
                wsId={wsId}
              />
            )}
            {tab === 'availability' && <TabAvailability form={form} update={update} />}
            {tab === 'advanced' && <TabAdvanced form={form} members={members} update={update} />}
            {tab === 'notifications' && <TabNotifications form={form} update={update} />}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/5">
          {/* Block reason — explains why Save is disabled so it doesn't
              feel like a silent failure when the user clicks. */}
          <div className="text-[11px] text-slate-500 min-w-0 flex-1">
            {credentialBlocked && (
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                {needsGoogle
                  ? 'Connect Google Calendar to enable Save.'
                  : 'Connect Zoom to enable Save.'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.04]">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || credentialBlocked}
              title={credentialBlocked
                ? (needsGoogle ? 'Connect Google Calendar first.' : 'Connect Zoom first.')
                : undefined}
              className="px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Create Event' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active, onClick, icon, children,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-full inline-flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-white/[0.04]'
      }`}
    >
      {icon}
      <span className="text-left flex-1">{children}</span>
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-2">{children}</div>;
}

function TextInput({ value, onChange, placeholder, prefix }: {
  value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string;
}) {
  return (
    <div className={`flex items-center rounded-xl border border-white/10 bg-white/[0.02] focus-within:border-emerald-500/50 ${prefix ? 'pl-3' : ''}`}>
      {prefix && <span className="text-slate-500 text-sm pr-1">{prefix}</span>}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
      />
    </div>
  );
}

function TabBasic({
  form, setSlugTouched, update,
  googleConnected, zoomConnected, onConnectGoogle, oauthBusy, wsId,
}: {
  form: Partial<EventType>;
  setSlugTouched: (b: boolean) => void;
  update: (p: Partial<EventType>) => void;
  googleConnected: boolean | null;
  zoomConnected: boolean | null;
  onConnectGoogle: () => void;
  oauthBusy: boolean;
  wsId: string;
}) {
  return (
    <div className="space-y-5 max-w-3xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <FieldLabel>Event name</FieldLabel>
          <TextInput value={form.name || ''} onChange={(v) => update({ name: v })} placeholder="e.g. 30 Minute Meeting" />
        </div>
        <div>
          <FieldLabel>URL slug</FieldLabel>
          <TextInput value={form.slug || ''} onChange={(v) => { setSlugTouched(true); update({ slug: v }); }} placeholder="30-min-mtg" prefix="/" />
        </div>
      </div>

      <div>
        <FieldLabel>Description</FieldLabel>
        <textarea
          value={form.description || ''}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Introduce your meeting to bookers…"
          rows={5}
          className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <FieldLabel>Duration</FieldLabel>
          <SelectInput
            value={String(form.duration_minutes ?? 30)}
            onChange={(v) => update({ duration_minutes: Number(v) })}
            options={DURATIONS.map((d) => ({ value: String(d), label: `${d} Minutes` }))}
          />
        </div>
        <div>
          <FieldLabel>Location</FieldLabel>
          <SelectInput
            value={form.location_kind || 'google_meet'}
            onChange={(v) => update({ location_kind: v })}
            options={LOCATIONS}
          />
        </div>
      </div>

      {(form.location_kind === 'phone' || form.location_kind === 'in_person' || form.location_kind === 'custom') && (
        <div>
          <FieldLabel>
            {form.location_kind === 'phone' ? 'Phone number' :
             form.location_kind === 'in_person' ? 'Address' : 'Custom link / details'}
          </FieldLabel>
          <TextInput value={form.location_value || ''} onChange={(v) => update({ location_value: v })} placeholder="…" />
        </div>
      )}

      <MeetingCredentialCard
        locationKind={form.location_kind || 'google_meet'}
        googleConnected={googleConnected}
        zoomConnected={zoomConnected}
        oauthBusy={oauthBusy}
        onConnectGoogle={onConnectGoogle}
        wsId={wsId}
      />
    </div>
  );
}

/** Adaptive card that sits right under Duration / Location. Three states:
 *
 *  1. Location doesn't need a server credential (phone / in-person / custom)
 *     → neutral info card.
 *  2. Location needs a credential and it's connected
 *     → emerald success card with the connected account.
 *  3. Location needs a credential and it's missing
 *     → amber warning card with an inline Connect Now button + fallback
 *       link to the full credentials page. Save is disabled until this
 *       turns green.
 */
function MeetingCredentialCard({
  locationKind, googleConnected, zoomConnected, oauthBusy, onConnectGoogle, wsId,
}: {
  locationKind: string;
  googleConnected: boolean | null;
  zoomConnected: boolean | null;
  oauthBusy: boolean;
  onConnectGoogle: () => void;
  wsId: string;
}) {
  // Locations that don't require any server-side credential.
  if (locationKind === 'phone' || locationKind === 'in_person' || locationKind === 'custom') {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3">
        <Video className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">No meeting credential needed</div>
          <p className="text-xs text-slate-400 mt-1">
            The location you entered is shared with the attendee on the booking confirmation email.
          </p>
        </div>
      </div>
    );
  }

  const needsGoogle = locationKind === 'google_meet';
  const needsZoom   = locationKind === 'zoom';
  const connected = needsGoogle ? googleConnected : needsZoom ? zoomConnected : null;
  const probeStillLoading = connected === null;

  // Connected — green card.
  if (connected === true) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-cyan-500/[0.04] to-transparent p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
          <Video className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white inline-flex items-center gap-2">
            {needsGoogle ? 'Google Calendar connected' : 'Zoom connected'}
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-500/30 text-emerald-200 uppercase">Ready</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {needsGoogle
              ? 'Every booking on this event type gets a Google Meet link attached automatically.'
              : 'Every booking on this event type gets a Zoom meeting created automatically.'}
          </p>
        </div>
      </div>
    );
  }

  // Probing — neutral placeholder so we don't flash the amber warning.
  if (probeStillLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-500 italic">
        Checking credential status…
      </div>
    );
  }

  // Not connected — amber card with action buttons.
  return (
    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] via-amber-500/[0.04] to-transparent p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">
            {needsGoogle ? 'Google Calendar isn’t connected' : 'Zoom isn’t connected'}
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {needsGoogle
              ? 'You can\'t save this event type yet — without Google Calendar we have no way to generate Meet links for bookings.'
              : 'You can\'t save this event type yet — without Zoom we have no way to create meeting links for bookings.'}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {needsGoogle && (
              <button
                type="button"
                onClick={onConnectGoogle}
                disabled={oauthBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {oauthBusy
                  ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connecting…</>)
                  : (<><Plug className="w-3.5 h-3.5" /> Connect Google Meet</>)}
              </button>
            )}
            <Link
              href={`/w/${wsId}/leads/credentials`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-slate-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open credentials page
            </Link>
            {!needsGoogle && needsZoom && (
              <span className="text-[11px] text-slate-400">
                Use the Credentials page to add a Zoom credential.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-emerald-500/50"
      >
        {options.map((o) => <option key={o.value} value={o.value} className="bg-[#0a1020]">{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
    </div>
  );
}

function TabAvailability({ form, update }: { form: Partial<EventType>; update: (p: Partial<EventType>) => void }) {
  const avail = form.availability || blankAvailability();
  const setWeekly = (day: keyof Weekly, ranges: HourRange[]) => {
    update({ availability: { ...avail, weekly: { ...avail.weekly, [day]: ranges } } });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="text-xl font-bold text-white">Weekly Hours</h3>
          <p className="text-sm text-slate-400 mt-1">Set your available hours for this meeting type.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">{avail.timezone}</div>
        </div>
      </div>

      <div className="space-y-3">
        {WEEKDAYS.map((d) => {
          const ranges = avail.weekly[d.key] || [];
          return (
            <div key={d.key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-4">
              <div className="w-12 pt-2 font-semibold text-white">{d.label}</div>
              <div className="flex-1 space-y-2">
                {ranges.length === 0 && (
                  <div className="text-sm italic text-slate-500 pt-2">Unavailable</div>
                )}
                {ranges.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TimeInput value={r.start} onChange={(v) => setWeekly(d.key, ranges.map((x, j) => j === i ? { ...x, start: v } : x))} />
                    <span className="text-slate-500">—</span>
                    <TimeInput value={r.end} onChange={(v) => setWeekly(d.key, ranges.map((x, j) => j === i ? { ...x, end: v } : x))} />
                    <button
                      onClick={() => setWeekly(d.key, ranges.filter((_, j) => j !== i))}
                      className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/[0.08]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setWeekly(d.key, [...ranges, { start: '09:00', end: '17:00' }])}
                  className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {ranges.length === 0 ? 'Add Hours' : 'Add more hours'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50"
    />
  );
}

function TabAdvanced({
  form, members, update,
}: { form: Partial<EventType>; members: WorkspaceMemberLite[]; update: (p: Partial<EventType>) => void }) {
  const mode = form.assignment_mode || 'single';
  const isMulti = mode === 'round_robin' || mode === 'collective';
  const hosts = form.hosts || [];

  // Method-specific copy that matches the screenshot ("Bookings are cycled…").
  const methodCopy: Record<string, { label: string; sub: string }> = {
    single:      { label: 'Single Host',                sub: 'One specific person hosts every meeting on this event type.' },
    round_robin: { label: 'Round Robin (Auto-distribute)', sub: 'Bookings are cycled through available members automatically.' },
    collective:  { label: 'Collective (All hosts attend)',  sub: 'Only show slots when every selected host is free — they all attend.' },
  };

  const setHosts = (next: number[]) => update({ hosts: next });
  const addHost = (uid: number) => {
    if (!uid) return;
    if (isMulti) {
      if (!hosts.includes(uid)) setHosts([...hosts, uid]);
    } else {
      setHosts([uid]);  // single mode replaces any prior selection
    }
  };
  const removeHost = (uid: number) => setHosts(hosts.filter((x) => x !== uid));

  // Build a quick lookup for the avatar/name on each chip.
  const byId = useMemo(() => {
    const m: Record<number, WorkspaceMemberLite> = {};
    members.forEach((u) => { m[u.user_id] = u; });
    return m;
  }, [members]);

  const availableMembers = members.filter((u) => !hosts.includes(u.user_id));

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Scheduling method — single dropdown (matches the reference screenshot) */}
      <div>
        <FieldLabel>Scheduling method</FieldLabel>
        <SelectInput
          value={mode}
          onChange={(v) => {
            update({ assignment_mode: v });
            // Switching to single while multiple hosts are picked — keep the first only.
            if (v === 'single' && hosts.length > 1) setHosts([hosts[0]]);
          }}
          options={[
            { value: 'single',      label: 'Single Host' },
            { value: 'round_robin', label: 'Round Robin (Auto-distribute)' },
            { value: 'collective',  label: 'Collective (All hosts attend)' },
          ]}
        />
        <p className="text-xs text-slate-500 mt-2">{methodCopy[mode]?.sub}</p>
      </div>

      {/* Team members — single picker for `single`, multi-chip for the rest */}
      <div>
        <FieldLabel>
          {mode === 'single' ? 'Host' : 'Team members'}{' '}
          <span className="text-red-400">*</span>
        </FieldLabel>

        <HostPicker
          members={availableMembers}
          placeholder={mode === 'single'
            ? (hosts.length ? 'Change host…' : 'Pick a host…')
            : 'Add a team member…'}
          onPick={addHost}
        />

        {/* Selected hosts */}
        <div className="mt-3 space-y-2">
          {hosts.length === 0 && (
            <div className="text-xs italic text-slate-500 pt-1">
              {mode === 'single' ? 'No host selected yet.' : 'No team members added yet.'}
            </div>
          )}
          {hosts.map((uid) => {
            const u = byId[uid];
            const name = u?.full_name || u?.email || `User #${uid}`;
            const initial = (name[0] || '?').toUpperCase();
            return (
              <div
                key={uid}
                className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white text-sm font-bold inline-flex items-center justify-center">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{name}</div>
                  {u?.email && u.email !== name && (
                    <div className="text-[11px] text-slate-400 truncate">{u.email}</div>
                  )}
                </div>
                <button
                  onClick={() => removeHost(uid)}
                  className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/[0.08]"
                  title="Remove host"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {members.length === 0 && (
          <div className="mt-2 text-[11px] text-amber-300">
            No workspace members loaded. Add staff on the Members page to make them available here.
          </div>
        )}
      </div>

      {/* Buffers + caps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <NumberField label="Buffer before (minutes)" value={form.buffer_before_minutes ?? 0} onChange={(n) => update({ buffer_before_minutes: n })} />
        <NumberField label="Buffer after (minutes)"  value={form.buffer_after_minutes ?? 0}  onChange={(n) => update({ buffer_after_minutes: n })} />
        <NumberField label="Minimum notice (minutes)" value={form.min_notice_minutes ?? 60} onChange={(n) => update({ min_notice_minutes: n })} />
        <NumberField label="Daily cap (0 = unlimited)" value={form.daily_cap ?? 0} onChange={(n) => update({ daily_cap: n })} />
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300">
          <strong className="text-white">Round-robin</strong> distributes incoming bookings evenly between selected hosts.{' '}
          <strong className="text-white">Collective</strong> requires every host to be free for the proposed slot.{' '}
          <strong className="text-white">Single host</strong> pins the meeting to one person.
        </div>
      </div>
    </div>
  );
}

/** Searchable host dropdown — Calendly-style "Add a team member…" picker.
 *  Closes on outside click; filters by name/email as the user types. */
function HostPicker({
  members, placeholder, onPick,
}: {
  members: WorkspaceMemberLite[];
  placeholder: string;
  onPick: (uid: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = members.filter((u) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(needle) ||
           (u.email || '').toLowerCase().includes(needle);
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full inline-flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left transition-colors ${
          open
            ? 'border-emerald-500/60 bg-emerald-500/[0.06]'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20'
        }`}
      >
        <span className={members.length === 0 ? 'text-slate-500' : 'text-white font-semibold'}>
          {members.length === 0 ? 'No more members available' : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setQ(''); }} />
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-white/10 bg-[#0a1020] shadow-xl overflow-hidden">
            <div className="p-2 border-b border-white/5">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 italic text-center">
                  {members.length === 0 ? 'All members already added.' : 'No matches.'}
                </div>
              ) : (
                filtered.map((u) => {
                  const name = u.full_name || u.email;
                  const initial = (name[0] || '?').toUpperCase();
                  return (
                    <button
                      key={u.user_id}
                      onClick={() => { onPick(u.user_id); setOpen(false); setQ(''); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/[0.04]"
                    >
                      <div className="w-7 h-7 rounded-md bg-emerald-500 text-white text-xs font-bold inline-flex items-center justify-center shrink-0">
                        {initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white font-semibold truncate">{name}</div>
                        {u.email && u.email !== name && (
                          <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                        )}
                      </div>
                      {u.role && (
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 ml-2">{u.role}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/50"
      />
    </div>
  );
}

const NOTIF_SCENARIOS: { key: keyof Omit<Notifications, 'enabled'>; title: string; desc: string }[] = [
  { key: 'confirmation', title: 'Booking Confirmation', desc: 'Sent immediately after a successful booking.' },
  { key: 'reschedule',   title: 'Appointment Rescheduled', desc: 'Sent when the date or time of an appointment is changed.' },
  { key: 'reminder_24h', title: 'Reminder (24 hours before)', desc: 'Sent 24 hours before the appointment.' },
  { key: 'cancellation', title: 'Cancellation', desc: 'Sent when a booking is cancelled.' },
  { key: 'follow_up',    title: 'Follow-up', desc: 'Sent after the meeting ends. Disabled by default.' },
];

function TabNotifications({ form, update }: { form: Partial<EventType>; update: (p: Partial<EventType>) => void }) {
  const n = form.notifications as Notifications;

  const setScenario = (key: keyof Omit<Notifications, 'enabled'>, patch: Partial<NotificationScenario>) => {
    update({ notifications: { ...n, [key]: { ...n[key], ...patch } } });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] via-cyan-500/[0.04] to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-emerald-300" />
          <h3 className="text-base font-bold text-white">Email Notifications</h3>
        </div>
        <p className="text-xs text-slate-300 mb-4">
          Configure custom email templates for various appointment scenarios. Leave blank to use the default professional system emails.
        </p>

        <label className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.04] border border-white/5 p-3">
          <div>
            <div className="text-sm font-semibold text-white">Enable Notifications</div>
            <div className="text-[11px] text-slate-400">Global toggle for this meeting type</div>
          </div>
          <input
            type="checkbox"
            checked={n.enabled}
            onChange={(e) => update({ notifications: { ...n, enabled: e.target.checked } })}
            className="sr-only peer"
          />
          <span className="relative w-10 h-5 rounded-full bg-slate-700 peer-checked:bg-emerald-500 transition-colors">
            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" style={{ transform: n.enabled ? 'translateX(20px)' : 'translateX(0)' }} />
          </span>
        </label>
      </div>

      {NOTIF_SCENARIOS.map((s) => {
        const sc = n[s.key];
        return (
          <div key={s.key} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h4 className="text-base font-bold text-white">{s.title}</h4>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{s.desc}</div>
              </div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={sc.enabled}
                  onChange={(e) => setScenario(s.key, { enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <span className="relative w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-emerald-500 transition-colors">
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                </span>
              </label>
            </div>

            <FieldLabel>Subject line</FieldLabel>
            <TextInput value={sc.subject} onChange={(v) => setScenario(s.key, { subject: v })} placeholder="e.g. Booking Confirmed: {title}" />

            <div className="mt-4 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Email content</div>
              <div className="flex flex-wrap gap-1.5">
                {['{title}', '{name}', '{time}', '{location}'].map((tok) => (
                  <button
                    key={tok}
                    onClick={() => setScenario(s.key, { body: (sc.body || '') + ' ' + tok })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/15"
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              value={sc.body || ''}
              onChange={(e) => setScenario(s.key, { body: e.target.value })}
              placeholder="Compose your email message…"
              rows={6}
              className="mt-2 w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none font-mono"
            />
          </div>
        );
      })}
    </div>
  );
}
