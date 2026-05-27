'use client';

import { useCallback, useEffect, useMemo, useRef, useState, use as reactUse } from 'react';
import {
  Calendar as CalendarIcon, Clock, Globe, MapPin, ChevronLeft, ChevronRight,
  CheckCircle2, Video, ArrowLeft, AlertTriangle, User as UserIcon,
  Search, Check, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Public booking page — what a prospect sees when they click the
 * "Copy link" URL from an event type. No auth required.
 *
 * Layout:
 *   ┌──────────────┬────────────────┬──────────────────┐
 *   │  Event type  │  Calendar      │  Time slots      │
 *   │  card        │  (month grid)  │  (scrollable)    │
 *   └──────────────┴────────────────┴──────────────────┘
 *
 * After picking a date+slot, a confirmation form appears (name + email
 * + optional phone + notes). On submit a Lead + Contact + Appointment
 * are created server-side and we render a success screen.
 */

interface Host {
  id: number;
  name: string;
  email: string;
}

interface EventType {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  duration_minutes: number;
  location_kind: string;
  location_value: string;
  location_label: string;
  host_name: string;
  hosts: Host[];
  assignment_mode: 'single' | 'round_robin' | 'collective';
  timezone: string;
  workspace_name: string;
}

type View = 'loading' | 'pick' | 'confirm' | 'success' | 'error';

// Plain fetch -- no auth header needed, and we don't want the shared
// axios client's 401-redirect interceptor running on this public page.
//
// API base resolution goes through the shared per-tenant resolver so
// the public booking URL ``sujit.morefungi.com/book/<ws>/<slug>``
// calls ``sujit.api.morefungi.com`` (per-tenant API host) instead of
// the old hard-coded ``<hostname>:8000`` which only worked in dev.
import { resolveApiV1Base } from '@/lib/apiBase';

async function publicFetch(path: string, init?: RequestInit) {
  const base = resolveApiV1Base();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, ...data } as { status: number; ok: boolean; success?: boolean; data?: unknown; message?: string };
}

export default function PublicBookingPage({ params }: { params: Promise<{ wsKey: string; slug: string }> }) {
  const { wsKey, slug } = reactUse(params);
  const [view, setView] = useState<View>('loading');
  const [event, setEvent] = useState<EventType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Calendar state — current month and selected date.
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  // The booker's chosen display timezone. Defaults to the browser's
  // detected IANA zone. Independent of the host/event timezone — when
  // these differ, the booking page renders slots in the booker's zone
  // but the slot ISO is still absolute UTC, so the host sees the same
  // moment in their own zone in the dashboard.
  const [viewerTz, setViewerTz] = useState<string>(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch { return 'UTC'; }
  });

  // Form state.
  const [form, setForm] = useState({
    name: '', email: '', phone: '', notes: '',
    hostId: '' as '' | number, guests: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<{
    starts_at: string; duration_minutes: number; location: string;
    meet_link: string | null; host_name: string;
  } | null>(null);

  // 1. Load the event type once.
  useEffect(() => {
    publicFetch(`/organization/public/book/${encodeURIComponent(wsKey)}/${encodeURIComponent(slug)}/`)
      .then((r) => {
        if (r.ok && r.success && r.data) {
          setEvent(r.data as EventType);
          setView('pick');
        } else {
          setError(r.message || 'Booking link not found.');
          setView('error');
        }
      })
      .catch(() => { setError('Network error.'); setView('error'); });
  }, [wsKey, slug]);

  // 2. When month changes, fetch which dates have any slots.
  useEffect(() => {
    if (!event) return;
    const first = new Date(month);
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const from = isoDate(first);
    const to = isoDate(last);
    publicFetch(
      `/organization/public/book/${encodeURIComponent(wsKey)}/${encodeURIComponent(slug)}/slots/?from=${from}&to=${to}`,
    ).then((r) => {
      if (r.ok && r.success && r.data) {
        const dates = (r.data as { available_dates: string[] }).available_dates || [];
        setAvailableDates(new Set(dates));
      }
    });
  }, [event, month, wsKey, slug]);

  // 3. When a date is selected, fetch the day's slots.
  useEffect(() => {
    if (!event || !selectedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    setSelectedSlot(null);
    publicFetch(
      `/organization/public/book/${encodeURIComponent(wsKey)}/${encodeURIComponent(slug)}/slots/?date=${isoDate(selectedDate)}`,
    ).then((r) => {
      if (r.ok && r.success && r.data) {
        setSlots(((r.data as { slots: string[] }).slots) || []);
      } else {
        setSlots([]);
      }
    }).finally(() => setLoadingSlots(false));
  }, [event, selectedDate, wsKey, slug]);

  const submit = useCallback(async () => {
    if (!event || !selectedSlot) return;
    if (!form.name.trim()) { toast.error('Please enter your name.'); return; }
    if (!form.email.trim()) { toast.error('Please enter your email.'); return; }
    const cleanGuests = form.guests
      .map((g) => g.trim())
      .filter((g) => g.length > 0 && /.+@.+\..+/.test(g));
    setSubmitting(true);
    try {
      const r = await publicFetch(
        `/organization/public/book/${encodeURIComponent(wsKey)}/${encodeURIComponent(slug)}/create/`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim() || undefined,
            phone: form.phone.trim() || undefined,
            notes: form.notes.trim() || undefined,
            host_id: form.hostId || undefined,
            guests: cleanGuests.length ? cleanGuests : undefined,
            starts_at: selectedSlot,
            timezone: viewerTz,
          }),
        },
      );
      if (r.ok && r.success && r.data) {
        const d = r.data as {
          starts_at: string; duration_minutes: number; location: string;
          meet_link: string | null; host_name: string;
        };
        setBooking(d);
        setView('success');
      } else {
        toast.error(r.message || 'Could not book that slot.');
        // If it was a 409 (slot taken), refresh slots so the UI updates.
        if (r.status === 409 && selectedDate) {
          publicFetch(`/organization/public/book/${encodeURIComponent(wsKey)}/${encodeURIComponent(slug)}/slots/?date=${isoDate(selectedDate)}`)
            .then((rr) => {
              if (rr.ok && rr.success && rr.data) setSlots((rr.data as { slots: string[] }).slots || []);
            });
        }
      }
    } finally { setSubmitting(false); }
  }, [event, selectedSlot, form, wsKey, slug, selectedDate]);

  // ── Render ─────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
          <span className="text-sm text-slate-500">Loading…</span>
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-red-300" />
          <h1 className="text-lg font-bold text-white">Booking link not available</h1>
          <p className="text-sm text-slate-400 mt-1">{error || 'This event type might be inactive or the link is wrong.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-slate-200 px-4 py-12 overflow-hidden">
      {/* Page background — deep charcoal with a soft emerald aura
          behind the card so the design feels lifted, not flat. */}
      <div className="absolute inset-0 bg-[#06090f]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.07),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.04),transparent_60%)]" />

      <div className="relative max-w-6xl mx-auto">
        {view === 'success' && booking && event ? (
          <SuccessCard booking={booking} event={event} />
        ) : (
          <div
            className="
              relative rounded-[28px] overflow-hidden
              border border-white/[0.06]
              bg-[linear-gradient(135deg,#101a2e_0%,#0b1322_55%,#0a0f1c_100%)]
              shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.02)_inset]
              grid grid-cols-1 sm:grid-cols-[280px_1fr] lg:grid-cols-[320px_1fr]
            "
          >
            {/* Hairline emerald accent on top edge — premium touch. */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
            <EventSidebar event={event!} viewerTz={viewerTz} />
            <div className="relative border-t sm:border-t-0 sm:border-l border-white/[0.06] p-6 sm:p-8 lg:p-10">
              {view === 'pick' && event && (
                <PickPanel
                  event={event}
                  month={month}
                  onChangeMonth={setMonth}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  availableDates={availableDates}
                  slots={slots}
                  loadingSlots={loadingSlots}
                  selectedSlot={selectedSlot}
                  onSelectSlot={(s) => { setSelectedSlot(s); setView('confirm'); }}
                  viewerTz={viewerTz}
                  onChangeViewerTz={setViewerTz}
                />
              )}
              {view === 'confirm' && event && selectedSlot && (
                <ConfirmPanel
                  event={event}
                  startsAt={selectedSlot}
                  viewerTz={viewerTz}
                  form={form}
                  setForm={setForm}
                  submitting={submitting}
                  onBack={() => setView('pick')}
                  onSubmit={submit}
                />
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-[10px] text-slate-600">
          Powered by Merkoll Scheduling
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Sidebar — event-type info
// ──────────────────────────────────────────────────────────────────────

function EventSidebar({ event, viewerTz }: { event: EventType; viewerTz: string }) {
  return (
    <aside className="relative p-8 md:p-10 overflow-hidden">
      {/* Faint emerald glow tucked behind the icon — gives the card
          depth without competing with the content. */}
      <div className="pointer-events-none absolute -top-16 -left-10 w-48 h-48 rounded-full bg-emerald-500/[0.07] blur-3xl" />

      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 border border-emerald-400/30 flex items-center justify-center mb-7 text-emerald-300 shadow-lg shadow-emerald-900/40">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <h1 className="text-[28px] leading-tight font-bold text-white tracking-tight">{event.name || 'Appointment'}</h1>
        <div className="text-[13px] text-slate-500 mt-2">
          with <span className="text-slate-300 font-medium">{event.host_name || event.workspace_name || ''}</span>
        </div>
      </div>
      {/* Metadata stack — plain divs (not <li>) so they always stack
          predictably. Each row gets its own subtle icon pill so the
          eye lands on the icon first, then the label. */}
      <div className="relative mt-9 space-y-3 text-[13.5px]">
        <MetaRow icon={<Clock className="w-4 h-4" />} label={`${event.duration_minutes} Minutes`} />
        <MetaRow icon={<Globe className="w-4 h-4" />} label={viewerTz} />
        {event.location_label && (
          <MetaRow icon={<MapPin className="w-4 h-4" />} label={event.location_label} />
        )}
      </div>
      {event.description && (
        <p className="relative mt-8 pt-6 border-t border-white/[0.05] text-[12.5px] text-slate-400 leading-relaxed whitespace-pre-wrap">
          {event.description}
        </p>
      )}
    </aside>
  );
}

// Reusable metadata row used in the booking-page sidebar — small icon
// pill on the left, label on the right. Mirrors the spacing used in
// reference designs like Calendly and HubSpot's booking link.
function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-emerald-300 shrink-0">
        {icon}
      </span>
      <span className="text-slate-200 leading-snug">{label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Pick panel — calendar + slots
// ──────────────────────────────────────────────────────────────────────

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function PickPanel({
  event, month, onChangeMonth, selectedDate, onSelectDate,
  availableDates, slots, loadingSlots, selectedSlot, onSelectSlot,
  viewerTz, onChangeViewerTz,
}: {
  event: EventType;
  month: Date;
  onChangeMonth: (d: Date) => void;
  selectedDate: Date | null;
  onSelectDate: (d: Date | null) => void;
  availableDates: Set<string>;
  slots: string[];
  loadingSlots: boolean;
  selectedSlot: string | null;
  onSelectSlot: (s: string) => void;
  viewerTz: string;
  onChangeViewerTz: (tz: string) => void;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayIso = isoDate(today);
  const monthName = month.toLocaleString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();

  // Build the calendar grid for the current month.
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = firstOfMonth.getDay();  // 0 = Sun
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonth = () => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  return (
    <div>
      <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
        <h2 className="text-[22px] leading-tight font-bold text-white tracking-tight">Select Date &amp; Time</h2>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-1">
          <button onClick={prevMonth} aria-label="Previous month"
            className="w-7 h-7 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[12px] uppercase tracking-[0.18em] font-bold text-emerald-300 min-w-[110px] text-center">{monthName}</span>
          <button onClick={nextMonth} aria-label="Next month"
            className="w-7 h-7 rounded-full text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6 lg:gap-8">
        {/* Calendar */}
        <div>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium tracking-wider text-slate-600 mb-3">
            {WEEKDAY_HEADERS.map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((c, i) => {
              if (c === null) return <div key={i} />;
              const cIso = isoDate(c);
              const isPast = c < today;
              // Hint from the month-availability API. Past days are
              // always blocked; future days are always clickable so the
              // user can probe and see "no slots" if there are none. The
              // hint just lowers the visual weight of likely-empty days.
              const hasHint = availableDates.has(cIso);
              const isClickable = !isPast;
              const isSelected = selectedDate && isoDate(selectedDate) === cIso;
              const isToday = cIso === todayIso;
              return (
                <div key={i} className="flex items-center justify-center">
                  <button
                    onClick={() => isClickable && onSelectDate(c)}
                    disabled={!isClickable}
                    className={`relative w-11 h-11 rounded-full text-[15px] font-bold transition-colors ${
                      isSelected
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                        : isPast
                        ? 'text-slate-700 cursor-not-allowed'
                        : hasHint
                        ? 'text-white hover:bg-emerald-500/10'
                        : 'text-slate-500 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {c.getDate()}
                    {isToday && !isSelected && (
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-[3px] w-1 h-1 rounded-full bg-emerald-400" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.05]">
            <div className="text-[10.5px] uppercase tracking-[0.2em] font-semibold text-slate-500 mb-2.5">Timezone</div>
            <TimezoneSelect value={viewerTz} onChange={onChangeViewerTz} />
          </div>
        </div>

        {/* Slot list */}
        <div>
          <div className="text-[13px] font-semibold text-white mb-4 inline-flex items-center gap-2">
            {selectedDate ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
                  .replace(/(\d+)$/, (n) => `${n}${ordinalSuffix(parseInt(n, 10))}`)}
              </>
            ) : (
              <span className="text-slate-500 font-normal">Pick a date first</span>
            )}
          </div>
          {!selectedDate ? (
            <div className="text-[12px] text-slate-600 italic text-center py-12">
              Choose an available day to see open time slots.
            </div>
          ) : loadingSlots ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-[12px] text-slate-600 italic text-center py-8">
              No slots left on this day. Try another date.
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2 custom-scroll">
              {slots.map((iso) => (
                <button
                  key={iso}
                  onClick={() => onSelectSlot(iso)}
                  className={`group/slot relative w-full text-center px-4 py-3.5 rounded-xl border text-[15px] font-semibold transition-all duration-150 ${
                    selectedSlot === iso
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-white shadow-lg shadow-emerald-900/40 scale-[1.01]'
                      : 'border-white/[0.05] bg-gradient-to-br from-[#0e1626] to-[#0a111f] hover:border-emerald-400/40 hover:from-[#11192c] hover:to-[#0c1322] hover:-translate-y-px text-slate-200'
                  }`}
                >
                  {formatTime(iso, viewerTz)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Searchable timezone combobox — replaces the native <select> because
// the IANA list has 400+ entries and is unusable without a filter. Pops
// open on click, types-to-filter, keyboard nav (↑/↓/Enter/Esc), click
// outside to close.
function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const zones = useMemo<string[]>(() => {
    try {
      const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
      if (typeof intl.supportedValuesOf === 'function') {
        return intl.supportedValuesOf('timeZone');
      }
    } catch { /* ignore */ }
    return [
      'UTC', 'Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Singapore',
      'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
      'Europe/Amsterdam', 'America/New_York', 'America/Chicago',
      'America/Denver', 'America/Los_Angeles', 'Australia/Sydney',
    ];
  }, []);
  // Always include the current value so an unusual zone still appears
  // in the list when it's the selected one.
  const allZones = useMemo(() => {
    if (!value || zones.includes(value)) return zones;
    return [value, ...zones];
  }, [zones, value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Case-insensitive substring filter. Cheap enough for 400 entries.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allZones;
    return allZones.filter((z) => z.toLowerCase().includes(q));
  }, [allZones, query]);

  // Keep the active index in range whenever the filtered list changes.
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Click outside closes the popover. Mousedown (not click) so it fires
  // before any onBlur side effects on the input.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Auto-focus the search input + scroll the current value into view
  // when the popover opens. Slight delay so the DOM is mounted first.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      const idx = filtered.indexOf(value);
      if (idx >= 0) {
        setActiveIdx(idx);
        listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    }, 10);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (tz: string) => {
    onChange(tz);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const tz = filtered[activeIdx];
      if (tz) pick(tz);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Trigger — looks identical to the old <select> so the layout
          doesn't shift, but it's a button now. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-xl bg-[#0c1424] border border-white/[0.08] pl-10 pr-9 py-3 text-[14px] text-white focus:outline-none focus:border-emerald-400/60 text-left relative"
      >
        <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <span className="truncate">{value || 'Pick a timezone'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 left-0 right-0 mt-2 rounded-xl border border-white/[0.08] bg-[#0a111f] shadow-2xl shadow-black/60 overflow-hidden">
          {/* Search input */}
          <div className="relative border-b border-white/[0.06]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search timezones…"
              className="w-full bg-transparent pl-10 pr-3 py-2.5 text-[13.5px] text-white placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          {/* Result list */}
          <div ref={listRef} className="max-h-[260px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-slate-500 italic">
                No timezones match &ldquo;{query}&rdquo;.
              </div>
            ) : (
              filtered.map((tz, i) => {
                const isActive = i === activeIdx;
                const isSelected = tz === value;
                return (
                  <button
                    key={tz}
                    data-idx={i}
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => pick(tz)}
                    className={`w-full text-left px-4 py-2 text-[13.5px] flex items-center justify-between gap-2 ${
                      isActive ? 'bg-emerald-500/[0.08] text-white' : 'text-slate-300'
                    }`}
                  >
                    <span className="truncate">{tz}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-300 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ──────────────────────────────────────────────────────────────────────
//  Confirm panel — booking form
// ──────────────────────────────────────────────────────────────────────

type FormState = {
  name: string; email: string; phone: string; notes: string;
  hostId: '' | number; guests: string[];
};

function ConfirmPanel({
  event, startsAt, viewerTz, form, setForm, submitting, onBack, onSubmit,
}: {
  event: EventType;
  startsAt: string;
  viewerTz: string;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  // Show a staff-member dropdown for round-robin (booker picks) and as
  // a single read-only entry for single-host events so the UI is
  // consistent. Collective shows all hosts as a comma-joined label.
  const hosts = event.hosts || [];
  const showStaffPicker = hosts.length > 0;
  const isRoundRobin = event.assignment_mode === 'round_robin';
  const [guestsOpen, setGuestsOpen] = useState(form.guests.length > 0);

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-slate-400 hover:text-white mb-6">
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
      <h2 className="text-2xl font-bold text-white">Enter Details</h2>

      <div className="mt-3 text-[12px] text-slate-500 inline-flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{formatFull(startsAt, viewerTz)}</span>
        <span className="text-slate-700">·</span>
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{event.duration_minutes} min</span>
        <span className="text-slate-700">·</span>
        <span className="inline-flex items-center gap-1"><Globe className="w-3 h-3" />{viewerTz}</span>
      </div>

      <div className="mt-7 space-y-5 max-w-xl">
        <Field label="Name" required>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputXL}
            autoFocus
          />
        </Field>
        <Field label="Email" required>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputXL}
          />
        </Field>

        {showStaffPicker && (
          <Field label="Staff Member" required>
            <div className="relative">
              <select
                value={form.hostId === '' ? '' : String(form.hostId)}
                onChange={(e) => setForm({ ...form, hostId: e.target.value ? Number(e.target.value) : '' })}
                disabled={!isRoundRobin}
                className={`${inputXL} appearance-none pr-10 ${!isRoundRobin ? 'opacity-100 cursor-default' : ''}`}
              >
                {!isRoundRobin && hosts.length > 0 && (
                  <option value={hosts[0].id}>{hosts[0].name}</option>
                )}
                {isRoundRobin && (
                  <>
                    <option value="">Auto-assign (round robin)</option>
                    {hosts.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </>
                )}
              </select>
              <ChevronRight className="w-4 h-4 text-slate-500 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </Field>
        )}

        {!guestsOpen ? (
          <button
            type="button"
            onClick={() => { setGuestsOpen(true); setForm({ ...form, guests: form.guests.length ? form.guests : [''] }); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-emerald-400/60 text-emerald-300 hover:bg-emerald-500/[0.08] text-sm font-semibold"
          >
            <span className="text-lg leading-none">+</span> Add Guests
          </button>
        ) : (
          <Field label="Guest emails">
            <div className="space-y-2">
              {form.guests.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={g}
                    onChange={(e) => {
                      const next = [...form.guests]; next[i] = e.target.value;
                      setForm({ ...form, guests: next });
                    }}
                    placeholder="guest@example.com"
                    className={inputXL}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.guests.filter((_, j) => j !== i);
                      setForm({ ...form, guests: next });
                      if (next.length === 0) setGuestsOpen(false);
                    }}
                    className="text-slate-500 hover:text-red-300 p-2"
                    aria-label="Remove guest"
                  >
                    <ArrowLeft className="w-4 h-4 rotate-45" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, guests: [...form.guests, ''] })}
                className="text-[12px] text-emerald-300 hover:text-emerald-200 font-semibold"
              >
                + Add another guest
              </button>
            </div>
          </Field>
        )}

        <Field label="Please share anything that will help prepare for our meeting.">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            className={`${inputXL} resize-none`}
          />
        </Field>
      </div>

      <p className="mt-6 text-[12px] text-slate-500 max-w-xl">
        By proceeding, you confirm that you have read and agree to{' '}
        <a href="#" className="text-emerald-400 hover:text-emerald-300 font-semibold">Terms of Use</a> and{' '}
        <a href="#" className="text-emerald-400 hover:text-emerald-300 font-semibold">Privacy Notice</a>.
      </p>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="mt-6 inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold disabled:opacity-50"
      >
        {submitting ? 'Booking…' : 'Confirm booking'}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Success
// ──────────────────────────────────────────────────────────────────────

function SuccessCard({
  booking, event,
}: {
  booking: { starts_at: string; duration_minutes: number; location: string; meet_link: string | null; host_name: string };
  event: EventType;
}) {
  return (
    <div className="max-w-lg mx-auto rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-8 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 flex items-center justify-center mb-4">
        <CheckCircle2 className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-bold text-white">You&apos;re booked!</h1>
      <p className="text-sm text-slate-300 mt-1">
        <strong>{event.name}</strong> with <strong>{booking.host_name || event.host_name}</strong>
      </p>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left space-y-2 text-[13px]">
        <Row icon={CalendarIcon} label="When" value={formatFull(booking.starts_at, event.timezone)} />
        <Row icon={Clock} label="Duration" value={`${booking.duration_minutes} minutes`} />
        <Row icon={Globe} label="Timezone" value={event.timezone} />
        {booking.location && <Row icon={MapPin} label="Where" value={booking.location} />}
        {booking.host_name && <Row icon={UserIcon} label="Host" value={booking.host_name} />}
      </div>

      {booking.meet_link && (
        <a
          href={booking.meet_link}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold"
        >
          <Video className="w-4 h-4" />
          Open Google Meet
        </a>
      )}

      <p className="mt-5 text-[11px] text-slate-500">
        A confirmation has been recorded on the host&apos;s calendar. You&apos;ll receive a reminder before the meeting.
      </p>
    </div>
  );
}

function Row({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-emerald-300 mt-0.5 shrink-0" />
      <div className="text-[10px] uppercase tracking-wider text-slate-500 w-20 shrink-0 mt-0.5">{label}</div>
      <div className="text-slate-200 font-semibold flex-1">{value}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────────────────────

const ipt = 'w-full rounded-xl bg-[#0c1424] border border-white/[0.08] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-400/60';

// Larger, screenshot-matching input style — taller, rounded-xl, darker
// background, no placeholder by default (the label sits above).
const inputXL = 'w-full rounded-xl bg-[#0a1020] border border-white/[0.06] px-4 py-3.5 text-[15px] text-white placeholder:text-slate-700 focus:outline-none focus:border-emerald-400/60';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[13px] font-bold text-white mb-2">
        {label}{required && <span className="text-emerald-400 ml-1">*</span>}
      </div>
      {children}
    </div>
  );
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  } catch {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

function formatFull(iso: string, tz: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: tz,
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}
