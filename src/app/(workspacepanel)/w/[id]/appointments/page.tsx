'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Calendar, CalendarDays, CalendarClock, CalendarCheck, List as ListIcon,
  Plus, Video, Phone, MapPin, Mail, Trash2, X, Save,
  CheckCircle2, AlertTriangle, ExternalLink, Sparkles, Clock,
  User as UserIcon, Globe2, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import QuotaBadge from '@/components/QuotaBadge';
import { OrganizationService } from '@/services/organization.service';
import { resolveApiV1Base } from '@/lib/apiBase';

/**
 * Appointments service — list / calendar / create flow with Google Meet
 * link generation.
 *
 * Scope tabs (also wired to ``?scope=`` so sidebar deep-links work):
 *   - upcoming  (default)
 *   - today
 *   - week
 *   - past
 *   - all
 *
 * Each row shows a one-click "Generate Meet link" if Google Calendar is
 * connected (or "Open Meet" if a link already exists). A "Connect Google
 * Meet" banner at the top deep-links to the Credentials page when the
 * tenant hasn't set up OAuth yet.
 */

type Scope = 'upcoming' | 'today' | 'week' | 'past' | 'all';

interface FormattedTime {
  iso: string;
  date: string;
  time: string;
  timezone: string;
}

interface Appointment {
  id: number;
  lead: number | null;
  lead_name: string | null;
  lead_assigned_to: number | null;
  lead_assigned_to_email: string | null;
  lead_assigned_to_name: string | null;
  contact: number | null;
  contact_email: string | null;
  contact_phone: string | null;
  title: string;
  starts_at: string;
  duration_minutes: number;
  location: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  is_upcoming: boolean;
  meet_link: string | null;
  created_by_email: string | null;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  client_timezone?: string;
  host_timezone?: string;
  client_time?: FormattedTime | null;
  staff_time?: FormattedTime | null;
}

interface AppointmentPayload {
  appointments: Appointment[];
  counts: { today: number; upcoming: number; week: number; past: number };
  google_meet_connected: boolean;
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending:   { color: '#f59e0b', label: 'Pending' },
  confirmed: { color: '#10b981', label: 'Confirmed' },
  completed: { color: '#06b6d4', label: 'Completed' },
  cancelled: { color: '#ef4444', label: 'Cancelled' },
  no_show:   { color: '#a855f7', label: 'No-show' },
};

export default function AppointmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="list">
      <AppointmentsInner wsId={wsId} />
    </PermissionGuard>
  );
}

function AppointmentsInner({ wsId }: { wsId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scopeFromUrl = (searchParams?.get('scope') || 'upcoming') as Scope;

  const [data, setData] = useState<AppointmentPayload | null>(null);
  const [scope, setScope] = useState<Scope>(scopeFromUrl);
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState<'' | 'mine' | 'unassigned'>('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { setScope(scopeFromUrl); }, [scopeFromUrl]);
  const pickScope = (s: Scope) => {
    setScope(s);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('scope', s);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.listAppointments({
        scope,
        status: statusFilter || undefined,
        assigned: assignedFilter || undefined,
      });
      if (res?.success) setData(res.data);
    } finally { setLoading(false); }
  }, [scope, statusFilter, assignedFilter]);

  useEffect(() => { load(); }, [load]);

  const generateMeet = async (id: number) => {
    const res = await OrganizationService.appointmentMeetLink(id);
    if (res?.success) {
      toast.success('Google Meet link generated');
      load();
    } else {
      toast.error(res?.message || 'Failed');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this appointment?')) return;
    const res = await OrganizationService.deleteAppointment(id);
    if (res?.success) { toast.success('Deleted'); load(); }
  };

  if (loading || !data) return <PageSkeleton kind="list" />;

  const tabs: { key: Scope; label: string; Icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: 'upcoming', label: 'Upcoming',  Icon: CalendarClock, count: data.counts.upcoming },
    { key: 'today',    label: 'Today',     Icon: CalendarCheck, count: data.counts.today },
    { key: 'week',     label: 'This week', Icon: CalendarDays,  count: data.counts.week },
    { key: 'past',     label: 'Past',      Icon: Calendar,      count: data.counts.past },
    { key: 'all',      label: 'All',       Icon: ListIcon },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white inline-flex items-center gap-3 flex-wrap">
            <CalendarDays className="w-6 h-6 text-purple-300" /> Appointments
            <QuotaBadge quota="appointments" label="appointments" />
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Every meeting booked across the CRM — sales calls, demos, consultations. Generate Google Meet links one-click when Google Calendar is connected.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> New appointment
        </button>
      </div>

      {/* Google Meet connection banner */}
      {!data.google_meet_connected && (
        <div className="mb-5 rounded-2xl border border-purple-500/25 bg-gradient-to-br from-purple-500/[0.06] via-purple-500/[0.02] to-transparent p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
            <Video className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Connect Google Calendar for one-click Meet links</h3>
            <p className="text-[12px] text-slate-400 mt-0.5">
              When connected, every appointment created here (or by an automation workflow) auto-generates a Google Meet link
              and emails the attendee a calendar invite. OAuth setup takes ~5 minutes.
            </p>
          </div>
          <Link
            href={`/w/${wsId}/leads/credentials`}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Connect Google
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => {
          const active = scope === t.key;
          return (
            <button
              key={t.key}
              onClick={() => pickScope(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active ? 'bg-purple-500/10 border-purple-500/30 text-white' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <t.Icon className="w-3.5 h-3.5" />
              {t.label}
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="text-[10px] text-slate-500">{t.count}</span>
              )}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value as '' | 'mine' | 'unassigned')}
            className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-300"
            title="Filter by who the lead is assigned to"
          >
            <option value="">All assignees</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/5 text-xs text-slate-300"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>

      {/* List */}
      {data.appointments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          No appointments in this view. Click <strong className="text-white">New appointment</strong> to create one,
          or let a workflow book one automatically (try the &quot;Booking intent → schedule Google Meet&quot; recipe).
        </div>
      ) : (
        <ul className="space-y-2">
          {data.appointments.map((a) => (
            <AppointmentRow key={a.id} appt={a} wsId={wsId} googleConnected={data.google_meet_connected}
              onGenerateMeet={() => generateMeet(a.id)} onDelete={() => remove(a.id)} />
          ))}
        </ul>
      )}

      {showCreate && (
        <CreateAppointmentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
          googleConnected={data.google_meet_connected}
        />
      )}
    </div>
  );
}

function AppointmentRow({
  appt, wsId, googleConnected, onGenerateMeet, onDelete,
}: {
  appt: Appointment;
  wsId: string;
  googleConnected: boolean;
  onGenerateMeet: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_META[appt.status] || STATUS_META.pending;
  const start = new Date(appt.starts_at);
  const isPast = !appt.is_upcoming;

  return (
    <li className={`rounded-2xl border p-4 ${isPast ? 'border-white/5 bg-white/[0.01] opacity-70' : 'border-white/5 bg-white/[0.02]'}`}>
      <div className="flex items-start gap-4">
        {/* Date column */}
        <div className="text-center shrink-0 w-16">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{start.toLocaleString('en-US', { month: 'short' })}</div>
          <div className="text-2xl font-bold text-white tabular-nums">{start.getDate()}</div>
          <div className="text-[10px] text-slate-500">{start.toLocaleString('en-US', { weekday: 'short' })}</div>
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/w/${wsId}/appointments/${appt.id}`} className="text-sm font-semibold text-white truncate hover:text-emerald-300">
              {appt.title}
            </Link>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                  style={{ color: status.color, borderColor: `${status.color}40`, backgroundColor: `${status.color}1a` }}>
              {status.label}
            </span>
            {appt.meet_link && (
              <a href={appt.meet_link} target="_blank" rel="noreferrer noopener"
                 className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Video className="w-2.5 h-2.5" /> Meet ready
              </a>
            )}
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · {appt.duration_minutes} min
            </span>
            {appt.lead && appt.lead_name && (
              <Link href={`/w/${wsId}/leads/${appt.lead}`} className="inline-flex items-center gap-1 text-emerald-300 hover:underline">
                <Sparkles className="w-2.5 h-2.5" /> {appt.lead_name}
              </Link>
            )}
            {/* Who's running the meeting — derived from the lead's assigned-to. */}
            {appt.lead_assigned_to_email ? (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-200 border border-cyan-500/30"
                title={`Lead assigned to ${appt.lead_assigned_to_name || appt.lead_assigned_to_email}`}
              >
                <UserIcon className="w-2.5 h-2.5" />
                {appt.lead_assigned_to_name || appt.lead_assigned_to_email}
              </span>
            ) : appt.lead && (
              <span className="inline-flex items-center gap-1 text-amber-300/80">
                <UserIcon className="w-2.5 h-2.5" />
                Unassigned
              </span>
            )}
            {appt.contact_email && (
              <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {appt.contact_email}</span>
            )}
            {appt.contact_phone && (
              <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {appt.contact_phone}</span>
            )}
            {appt.location && (
              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {appt.location}</span>
            )}
          </div>
          {(appt.client_time || appt.staff_time) && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {appt.staff_time && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] bg-blue-500/10 border border-blue-500/30 text-blue-200">
                  <Globe2 className="w-2.5 h-2.5" />
                  <span className="font-semibold tracking-wider uppercase">Staff</span>
                  <span className="text-blue-100">{appt.staff_time.time}</span>
                  <span className="text-blue-300/70">{appt.staff_time.timezone}</span>
                </span>
              )}
              {appt.client_time && appt.client_time.timezone !== appt.staff_time?.timezone && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-200">
                  <Globe2 className="w-2.5 h-2.5" />
                  <span className="font-semibold tracking-wider uppercase">Client</span>
                  <span className="text-cyan-100">{appt.client_time.time}</span>
                  <span className="text-cyan-300/70">{appt.client_time.timezone}</span>
                </span>
              )}
            </div>
          )}
          {appt.notes && (
            <p className="text-[12px] text-slate-400 mt-2 line-clamp-2 whitespace-pre-wrap">{appt.notes.replace(/\n\nGoogle Meet:.*/m, '')}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {appt.meet_link ? (
            <a
              href={appt.meet_link}
              target="_blank"
              rel="noreferrer noopener"
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 inline-flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" /> Open Meet
            </a>
          ) : googleConnected ? (
            <button
              onClick={onGenerateMeet}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 inline-flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5" /> Generate Meet
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 px-2">Connect Google to add Meet</span>
          )}
          <Link
            href={`/w/${wsId}/appointments/${appt.id}`}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 inline-flex items-center gap-1.5"
            title="Open appointment detail"
          >
            View <ArrowRight className="w-3 h-3" />
          </Link>
          <button onClick={onDelete} className="p-1.5 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10" title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Create-appointment modal — guided like the public booking flow.
//
//  Sections (in order):
//    1. Event type    → drives duration / location / host pool / availability
//    2. Slot picker   → mini calendar + slot list (uses public slots API)
//    3. Contact info  → name + email/phone (auto-creates Contact + Lead)
//    4. Extras        → staff (round-robin only), client timezone,
//                       guest emails, optional notes
//
//  Hits the new POST /leads/appointments/book/ endpoint, which mirrors
//  the public booking flow under auth.
// ──────────────────────────────────────────────────────────────────────

interface ModalEventType {
  id: number;
  name: string;
  slug: string;
  duration_minutes: number;
  location_kind: string;
  location_value: string;
  location_label: string;
  assignment_mode: 'single' | 'round_robin' | 'collective';
  hosts_detail?: { id: number; full_name: string; email: string }[];
  availability?: { timezone?: string; weekly?: Record<string, { start: string; end: string }[]> };
  booking_path?: string;
  is_active: boolean;
}

function CreateAppointmentModal({
  onClose, onCreated, googleConnected,
}: {
  onClose: () => void;
  onCreated: () => void;
  googleConnected: boolean;
}) {
  const [events, setEvents] = useState<ModalEventType[]>([]);
  const [eventId, setEventId] = useState<number | ''>('');
  const event = events.find((e) => e.id === eventId) || null;

  // Calendar + slots state.
  const today0 = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const [month, setMonth] = useState<Date>(new Date(today0.getFullYear(), today0.getMonth(), 1));
  const [date, setDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);

  // Booker details + extras.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hostId, setHostId] = useState<'' | number>('');
  const [tz, setTz] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { return 'UTC'; }
  });
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [notes, setNotes] = useState('');

  const [busy, setBusy] = useState(false);

  // 1. Load event types once.
  useEffect(() => {
    OrganizationService.listEventTypes().then((r) => {
      if (r?.success) {
        const active = (r.data as ModalEventType[]).filter((e) => e.is_active);
        setEvents(active);
      }
    }).catch(() => {});
  }, []);

  // 2. When date or event type changes, fetch slots from the public API
  //    (it's path-based and works without auth — no need for a new
  //    private endpoint).
  useEffect(() => {
    if (!event || !date) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlot(null);
    // Use the per-tenant API resolver so prod (``<sub>.api.morefungi.com``)
    // and dev (``localhost:8000``) both work without per-deploy code
    // changes. See ``lib/apiBase.ts`` for the routing rules.
    const base = resolveApiV1Base();
    const path = event.booking_path || '';
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    fetch(`${base}/organization/public${path}/slots/?date=${iso}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) setSlots(j.data?.slots || []);
        else setSlots([]);
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [event, date]);

  const addGuest = () => {
    const g = guestInput.trim();
    if (!g || !/.+@.+\..+/.test(g)) { toast.error('Enter a valid email'); return; }
    if (guests.includes(g)) { toast.error('Already added'); return; }
    setGuests([...guests, g]);
    setGuestInput('');
  };
  const removeGuest = (g: string) => setGuests(guests.filter((x) => x !== g));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) { toast.error('Pick an event type'); return; }
    if (!slot) { toast.error('Pick a time slot'); return; }
    if (!name.trim()) { toast.error('Name is required'); return; }
    if (!email.trim() && !phone.trim()) { toast.error('Email or phone is required'); return; }
    setBusy(true);
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
        onCreated();
      } else {
        toast.error(res?.message || 'Could not book');
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };

  // Mini calendar grid.
  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const firstWeekday = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0c1424] border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New appointment</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        {googleConnected ? (
          <p className="text-[11px] text-emerald-300 mb-4 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" /> Google Calendar connected — Meet link will be created automatically.
          </p>
        ) : (
          <p className="text-[11px] text-amber-300 mb-4 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" /> Google Calendar not connected — appointment will be created without a Meet link.
          </p>
        )}

        {/* Step 1: Event type */}
        <Section label="1. Event type">
          <select
            value={eventId}
            onChange={(e) => { setEventId(e.target.value ? Number(e.target.value) : ''); setSlot(null); setDate(null); setHostId(''); }}
            className={inputCls}
          >
            <option value="" className="bg-[#0a1020]">Pick a bookable event type…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id} className="bg-[#0a1020]">
                {e.name} · {e.duration_minutes}m · {e.location_label || e.location_kind}
              </option>
            ))}
          </select>
          {events.length === 0 && (
            <p className="text-[11px] text-slate-500 mt-1">
              No event types yet. Create one under Scheduling first.
            </p>
          )}
        </Section>

        {/* Step 2: Slot — only after picking event type */}
        {event && (
          <Section label="2. Pick a time">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Calendar */}
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
              {/* Slots */}
              <div>
                <div className="text-[11px] text-slate-400 mb-2 font-semibold">
                  {date
                    ? date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                    : 'Pick a date first'}
                </div>
                {!date ? (
                  <div className="text-[11px] text-slate-500 italic py-4">
                    Available slots appear here after you pick a day.
                  </div>
                ) : slotsLoading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-white/[0.04] animate-pulse" />)}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-[11px] text-slate-500 italic py-4">No slots available on this day.</div>
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
          </Section>
        )}

        {/* Step 3: Contact info */}
        {event && slot && (
          <Section label="3. Who is this with?">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className={inputCls} placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <input className={`${inputCls} mt-2`} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Section>
        )}

        {/* Step 4: Extras */}
        {event && slot && (
          <Section label="4. Extras">
            {event.assignment_mode === 'round_robin' && event.hosts_detail && event.hosts_detail.length > 0 && (
              <label className="block mb-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Staff member</span>
                <select
                  value={hostId === '' ? '' : String(hostId)}
                  onChange={(e) => setHostId(e.target.value ? Number(e.target.value) : '')}
                  className={`mt-1 ${inputCls}`}
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
              <select value={tz} onChange={(e) => setTz(e.target.value)} className={`mt-1 ${inputCls}`}>
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
                      <span className="inline-flex items-center gap-1.5 text-slate-200">
                        <Mail className="w-3 h-3 text-slate-500" />{g}
                      </span>
                      <button type="button" onClick={() => removeGuest(g)} className="p-0.5 rounded text-slate-500 hover:text-red-300">
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  className={inputCls}
                  placeholder="guest@example.com"
                  value={guestInput}
                  onChange={(e) => setGuestInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
                />
                <button type="button" onClick={addGuest} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold">
                  Add
                </button>
              </div>
            </div>

            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Notes (optional)</span>
              <textarea
                rows={3}
                className={`mt-1 ${inputCls}`}
                placeholder="Agenda, context, what to prepare…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </Section>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="submit" disabled={busy || !event || !slot} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5">
            <Save className="w-3.5 h-3.5" /> {busy ? 'Booking…' : 'Book appointment'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 pb-4 border-b border-white/5 last:border-0 last:pb-0">
      <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mb-2">{label}</div>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';
