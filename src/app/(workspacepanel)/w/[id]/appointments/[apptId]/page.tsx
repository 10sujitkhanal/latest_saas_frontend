'use client';

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calendar as CalendarIcon, Clock, MapPin, Video, Mail, Phone,
  RefreshCw, Send, Pencil, Trash2, Users, X, Save, AlertTriangle,
  CheckCircle2, Globe, User as UserIcon, MessageSquare, ChevronDown,
  Plus, History, UserPlus, FileEdit,
} from 'lucide-react';
import { toast } from 'sonner';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { OrganizationService } from '@/services/organization.service';

/**
 * Appointment detail page.
 *
 * Shows two side-by-side time chips — one for the **client's** timezone
 * (whatever they picked at booking) and one for the **staff's** timezone
 * (what the event-type was created in). The same starts_at, formatted
 * twice via Intl + `timeZone`.
 *
 * Actions on the page:
 *   • Reschedule   — modal with date+time + optional "email the client"
 *   • Recall reminder — sends a "reminder" email right now
 *   • Edit details — title / location / status / notes
 *   • Reassign staff — pick from workspace members
 *   • Meeting notes — debounced auto-save to ``notes``
 *   • Delete appointment
 */

interface TimeFormatted {
  iso: string;
  date: string;
  time: string;
  timezone: string;
}

interface AppointmentRow {
  id: number;
  title: string;
  starts_at: string;
  ends_at: string | null;
  duration_minutes: number;
  location: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string;
  meet_link: string | null;
  client_timezone: string;
  host_timezone: string;
  client_time: TimeFormatted | null;
  staff_time: TimeFormatted | null;
  guest_emails: string[];
  lead: number | null;
  lead_name: string | null;
  lead_assigned_to: number | null;
  lead_assigned_to_email: string | null;
  lead_assigned_to_name: string | null;
  contact: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  reminder_24h_sent: boolean;
  reminder_2h_sent: boolean;
  created_at: string;
  updated_at: string;
}

interface AppointmentNote {
  id: number;
  body: string;
  author: number | null;
  author_email: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
}

interface AppointmentActivity {
  id: number;
  kind: string;
  message: string;
  meta: Record<string, unknown>;
  actor: number | null;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
}

interface MemberLite { user_id: number; email: string; full_name: string }

const STATUS_META: Record<AppointmentRow['status'], { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#f59e0b' },
  confirmed: { label: 'Confirmed', color: '#10b981' },
  completed: { label: 'Completed', color: '#94a3b8' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  no_show:   { label: 'No show',   color: '#a855f7' },
};

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string; apptId: string }> }) {
  const { id: wsId, apptId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="detail">
      <Inner wsId={wsId} apptId={Number(apptId)} />
    </PermissionGuard>
  );
}

function Inner({ wsId, apptId }: { wsId: string; apptId: number }) {
  const [appt, setAppt] = useState<AppointmentRow | null>(null);
  const [members, setMembers] = useState<MemberLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showResched, setShowResched] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notes thread + activity timeline. These are independent endpoints
  // so the detail page can show them as their own sections without
  // bloating the main appointment payload.
  const [notesThread, setNotesThread] = useState<AppointmentNote[]>([]);
  const [activities, setActivities] = useState<AppointmentActivity[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [newGuest, setNewGuest] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await OrganizationService.getAppointment(apptId);
      if (r?.success) {
        setAppt(r.data);
        setNotesDraft(r.data.notes || '');
      } else setError(r?.message || 'Appointment not found.');
    } catch (e) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      setError(err.response?.data?.message || (err.response?.status === 404 ? 'Appointment not found.' : 'Could not load.'));
    } finally { setLoading(false); }
  }, [apptId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = Number(wsId);
    if (!id) return;
    OrganizationService.listWorkspaceMembers(id).then((r) => {
      if (r?.success) setMembers(r.data as MemberLite[]);
    }).catch(() => {});
  }, [wsId]);

  // Notes thread + activity timeline. Re-fetched whenever the appointment
  // changes (so adding a note also refreshes the activity feed).
  const loadNotes = useCallback(async () => {
    const r = await OrganizationService.listAppointmentNotes(apptId);
    if (r?.success) setNotesThread(r.data || []);
  }, [apptId]);
  const loadActivity = useCallback(async () => {
    const r = await OrganizationService.listAppointmentActivity(apptId);
    if (r?.success) setActivities(r.data || []);
  }, [apptId]);
  useEffect(() => { loadNotes(); loadActivity(); }, [loadNotes, loadActivity]);

  const addNote = async () => {
    const body = newNote.trim();
    if (!body) return;
    setAddingNote(true);
    try {
      const r = await OrganizationService.createAppointmentNote(apptId, body);
      if (r?.success) {
        setNewNote('');
        await Promise.all([loadNotes(), loadActivity()]);
      } else toast.error(r?.message || 'Could not add note');
    } finally { setAddingNote(false); }
  };

  const deleteNote = async (noteId: number) => {
    if (!confirm('Delete this note?')) return;
    const r = await OrganizationService.deleteAppointmentNote(apptId, noteId);
    if (r?.success) {
      await loadNotes();
      toast.success('Deleted');
    }
  };

  const addGuest = async () => {
    if (!appt) return;
    const g = newGuest.trim();
    if (!g || !/.+@.+\..+/.test(g)) { toast.error('Enter a valid email'); return; }
    if ((appt.guest_emails || []).includes(g)) { toast.error('Already added'); return; }
    const next = [...(appt.guest_emails || []), g];
    const r = await OrganizationService.updateAppointment(apptId, { guest_emails: next });
    if (r?.success) {
      setAppt(r.data);
      setNewGuest('');
      loadActivity();
    } else toast.error(r?.message || 'Could not add guest');
  };

  const removeGuest = async (g: string) => {
    if (!appt) return;
    const next = (appt.guest_emails || []).filter((x) => x !== g);
    const r = await OrganizationService.updateAppointment(apptId, { guest_emails: next });
    if (r?.success) {
      setAppt(r.data);
      loadActivity();
    }
  };

  // Debounced notes auto-save. Fire ~1.2s after the user stops typing.
  useEffect(() => {
    if (!appt) return;
    if (notesDraft === appt.notes) return;
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      const r = await OrganizationService.updateAppointment(apptId, { notes: notesDraft });
      if (r?.success) setAppt((curr) => curr ? { ...curr, notes: notesDraft, updated_at: r.data.updated_at } : curr);
    }, 1200);
    return () => { if (notesTimer.current) clearTimeout(notesTimer.current); };
  }, [notesDraft, apptId, appt]);

  if (loading) return <PageSkeleton kind="detail" />;
  if (error || !appt) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Couldn&apos;t load this appointment</h2>
        <p className="text-sm text-slate-400">{error || 'No data returned.'}</p>
        <Link href={`/w/${wsId}/appointments`} className="mt-5 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to all
        </Link>
      </div>
    );
  }

  const meta = STATUS_META[appt.status] || STATUS_META.pending;
  const isGoogleMeet = !!appt.meet_link;

  const sendReminder = async () => {
    setReminding(true);
    try {
      const r = await OrganizationService.remindAppointment(apptId);
      if (r?.success) toast.success('Reminder sent to the client.');
      else toast.error(r?.message || 'Could not send.');
    } finally { setReminding(false); }
  };

  const remove = async () => {
    if (!confirm('Delete this appointment? This cannot be undone.')) return;
    const r = await OrganizationService.deleteAppointment(appt.id);
    if (r?.success) {
      toast.success('Deleted');
      window.location.href = `/w/${wsId}/appointments`;
    }
  };

  const reassign = async (userId: number) => {
    const r = await OrganizationService.reassignAppointment(appt.id, userId);
    if (r?.success) {
      setAppt(r.data);
      toast.success('Reassigned');
    } else toast.error(r?.message || 'Failed');
  };

  return (
    <div>
      <Link href={`/w/${wsId}/appointments`} className="text-[11px] text-slate-500 hover:text-slate-300 inline-flex items-center gap-1 mb-3">
        <ArrowLeft className="w-3 h-3" /> All appointments
      </Link>

      {/* Hero card */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.04] via-cyan-500/[0.02] to-transparent p-6 flex items-start gap-5 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
          <CalendarIcon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border"
                  style={{ color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}1a` }}>
              {meta.label}
            </span>
            {isGoogleMeet && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Video className="w-2.5 h-2.5" />
                Google Meet
              </span>
            )}
            {appt.reminder_24h_sent && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
                <Send className="w-2.5 h-2.5" />
                Reminder sent
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white uppercase tracking-tight">{appt.title}</h1>
          <div className="mt-2 inline-flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <strong>{appt.staff_time?.date || new Date(appt.starts_at).toLocaleDateString()}</strong>
            </span>
            <span className="text-slate-600">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {appt.staff_time?.time}
              {appt.ends_at && <> – {new Date(appt.ends_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: appt.host_timezone || undefined })}</>}
              {appt.host_timezone && <span className="text-slate-500 ml-1">({appt.host_timezone})</span>}
            </span>
          </div>

          {/* Client + staff time chips */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            <TimeChip kind="client" formatted={appt.client_time} />
            <TimeChip kind="staff"  formatted={appt.staff_time} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={() => setShowResched(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12] text-emerald-200 text-xs font-bold uppercase tracking-wider">
            <RefreshCw className="w-3.5 h-3.5" />
            Reschedule
          </button>
          <button onClick={sendReminder} disabled={reminding}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-xs font-bold uppercase tracking-wider disabled:opacity-50">
            <Send className="w-3.5 h-3.5" />
            {reminding ? 'Sending…' : 'Recall reminder'}
          </button>
          <button onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider">
            <Pencil className="w-3.5 h-3.5" />
            Edit details
          </button>
        </div>
      </section>

      {/* Bottom grid: Meeting management + Participants */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-5">
        {/* Meeting management */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-white inline-flex items-center gap-2 uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-emerald-300" />
              Meeting management
            </h2>
            <StatusDropdown
              value={appt.status}
              onChange={async (s) => {
                const r = await OrganizationService.updateAppointment(appt.id, { status: s });
                if (r?.success) { setAppt(r.data); toast.success(`Marked ${s}`); }
              }}
            />
          </div>

          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={6}
            placeholder="Type meeting notes, progress updates, or internal comments here…"
            className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
          />
          <div className="mt-2 text-[10.5px] text-slate-500 italic flex items-center justify-between">
            <span>Auto-saves to the appointment</span>
            {notesDraft !== appt.notes ? (
              <span className="text-amber-300 inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> unsaved
              </span>
            ) : (
              <span className="text-emerald-300 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> saved
              </span>
            )}
          </div>

          {appt.location && (
            <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <InfoRow icon={MapPin} label="Where">
                {appt.meet_link ? (
                  <a href={appt.meet_link} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">
                    {appt.location}
                  </a>
                ) : appt.location}
              </InfoRow>
              {appt.lead && (
                <InfoRow icon={UserIcon} label="Linked lead">
                  <Link href={`/w/${wsId}/leads/${appt.lead}`} className="text-emerald-300 hover:underline">
                    {appt.lead_name || `Lead #${appt.lead}`}
                  </Link>
                </InfoRow>
              )}
            </div>
          )}
        </section>

        {/* Participants */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-bold text-white inline-flex items-center gap-2 uppercase tracking-wider">
            <Users className="w-4 h-4 text-emerald-300" /> Participants
          </h2>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 mb-2">Primary contact</div>
            <div className="flex items-center gap-3">
              <Avatar name={appt.contact_name || appt.contact_email || '?'} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">{appt.contact_name || '—'}</div>
                <div className="text-[11px] text-slate-400 truncate">
                  {appt.contact_email && <a href={`mailto:${appt.contact_email}`} className="hover:text-emerald-300 inline-flex items-center gap-1"><Mail className="w-2.5 h-2.5" />{appt.contact_email}</a>}
                  {appt.contact_email && appt.contact_phone && <span className="mx-1 text-slate-600">·</span>}
                  {appt.contact_phone && <a href={`tel:${appt.contact_phone}`} className="hover:text-emerald-300 inline-flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{appt.contact_phone}</a>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300">Our team member</div>
              <ReassignPicker
                current={appt.lead_assigned_to}
                members={members}
                onPick={(uid) => reassign(uid)}
              />
            </div>
            {appt.lead_assigned_to_email ? (
              <div className="flex items-center gap-3">
                <Avatar name={appt.lead_assigned_to_name || appt.lead_assigned_to_email} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{appt.lead_assigned_to_name || '—'}</div>
                  <div className="text-[11px] text-slate-400 truncate">{appt.lead_assigned_to_email}</div>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 italic">Unassigned — pick a team member from the menu above.</div>
            )}
          </div>

          {/* Guest emails — multiple, added via "Add Guests" on the
              booking page or here. Each row can be removed. */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300">Guests</div>
              <span className="text-[10px] text-slate-500">{(appt.guest_emails || []).length}</span>
            </div>
            {(appt.guest_emails || []).length === 0 && (
              <div className="text-[11px] text-slate-500 italic mb-2">No additional guests on this meeting.</div>
            )}
            {(appt.guest_emails || []).length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {appt.guest_emails.map((g) => (
                  <li key={g} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-white/[0.02]">
                    <span className="text-[12px] text-slate-200 truncate inline-flex items-center gap-1.5">
                      <Mail className="w-3 h-3 text-slate-500" />{g}
                    </span>
                    <button onClick={() => removeGuest(g)} className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10" aria-label="Remove guest">
                      <X className="w-3 h-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-1.5">
              <input
                value={newGuest}
                onChange={(e) => setNewGuest(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }}
                placeholder="guest@example.com"
                className="flex-1 rounded-lg bg-[#080e1c] border border-white/10 px-2.5 py-1.5 text-[12px] text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
              <button onClick={addGuest} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </div>

          <button
            onClick={remove}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/[0.04] hover:bg-red-500/[0.08] text-red-300 text-xs font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete appointment
          </button>
        </section>
      </div>

      {/* Notes thread + Activity timeline */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Notes thread — many timestamped notes, newest first. */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold text-white inline-flex items-center gap-2 uppercase tracking-wider mb-3">
            <FileEdit className="w-4 h-4 text-emerald-300" /> Notes
            <span className="text-[10px] text-slate-500 normal-case tracking-normal">{notesThread.length}</span>
          </h2>
          <div className="flex items-start gap-2 mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
              placeholder="Add a note — discussion points, decisions, follow-ups…"
              className="flex-1 rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
            <button
              onClick={addNote}
              disabled={addingNote || !newNote.trim()}
              className="px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
          {notesThread.length === 0 ? (
            <div className="text-[12px] text-slate-500 italic text-center py-4">
              No notes yet. The first note will land here.
            </div>
          ) : (
            <ul className="space-y-3">
              {notesThread.map((n) => (
                <li key={n.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                      <Avatar name={n.author_name || n.author_email || '?'} size={5} />
                      <strong className="text-slate-200">{n.author_name || n.author_email || 'Unknown'}</strong>
                      <span className="text-slate-600">·</span>
                      <span>{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <button onClick={() => deleteNote(n.id)} className="p-1 rounded text-slate-500 hover:text-red-300 hover:bg-red-500/10" aria-label="Delete note">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity timeline — created / rescheduled / reassigned / etc. */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold text-white inline-flex items-center gap-2 uppercase tracking-wider mb-3">
            <History className="w-4 h-4 text-emerald-300" /> Activity
            <span className="text-[10px] text-slate-500 normal-case tracking-normal">{activities.length}</span>
          </h2>
          {activities.length === 0 ? (
            <div className="text-[12px] text-slate-500 italic text-center py-4">
              Nothing recorded yet.
            </div>
          ) : (
            <ol className="relative space-y-3 pl-5 border-l border-white/5">
              {activities.map((a) => (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[27px] top-1 w-3 h-3 rounded-full border-2 border-[#080e1c] ${activityDot(a.kind)}`} />
                  <div className="text-[12.5px] text-slate-200">
                    <span className="font-semibold">{activityLabel(a.kind)}</span>
                    {a.message && <span className="text-slate-300"> — {a.message}</span>}
                  </div>
                  <div className="text-[10.5px] text-slate-500 mt-0.5">
                    {a.actor_name || a.actor_email || 'system'} · {new Date(a.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {showResched && (
        <RescheduleModal
          appt={appt}
          onClose={() => setShowResched(false)}
          onSaved={(updated) => { setAppt(updated); setShowResched(false); toast.success('Rescheduled'); }}
        />
      )}
      {showEdit && (
        <EditModal
          appt={appt}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => { setAppt(updated); setShowEdit(false); toast.success('Saved'); }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Time chips — client vs staff
// ──────────────────────────────────────────────────────────────────────

function TimeChip({ kind, formatted }: { kind: 'client' | 'staff'; formatted: TimeFormatted | null }) {
  const label = kind === 'client' ? 'CLIENT TIME' : 'STAFF TIME';
  const accent = kind === 'client' ? '#06b6d4' : '#3b82f6';
  if (!formatted) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-slate-500 inline-flex items-start gap-3">
        <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent }} />
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accent }}>{label}</div>
          <div className="text-slate-500 italic">No timezone recorded.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border bg-white/[0.02] p-3 inline-flex items-start gap-3"
         style={{ borderColor: `${accent}40` }}>
      <Globe className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent }} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: accent }}>{label}</div>
        <div className="text-[13px] font-bold text-white truncate">
          {formatted.date} at {formatted.time}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{formatted.timezone}</div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Status dropdown — opens upward when near the bottom
// ──────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: AppointmentRow['status'][] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

function StatusDropdown({
  value, onChange,
}: { value: AppointmentRow['status']; onChange: (s: AppointmentRow['status']) => void }) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[value];
  return (
    <div className="relative">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">Status</div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider"
        style={{ color: meta.color, borderColor: `${meta.color}55`, backgroundColor: `${meta.color}1a` }}
      >
        {meta.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-white/10 bg-[#0a1020] shadow-xl py-1">
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => { onChange(s); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-2 ${
                  s === value ? 'bg-white/[0.04] text-white' : 'text-slate-200 hover:bg-white/[0.04]'
                }`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Reassign picker
// ──────────────────────────────────────────────────────────────────────

function ReassignPicker({
  current, members, onPick,
}: { current: number | null; members: MemberLite[]; onPick: (uid: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="text-[10px] text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 font-bold uppercase tracking-wider">
        <RefreshCw className="w-3 h-3" />
        Reassign
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-white/10 bg-[#0a1020] shadow-xl py-1 max-h-72 overflow-y-auto">
            {members.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-slate-500 italic">No team members.</div>
            ) : members.map((m) => (
              <button key={m.user_id} onClick={() => { onPick(m.user_id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 ${
                  current === m.user_id ? 'bg-emerald-500/10 text-emerald-200' : 'text-slate-200 hover:bg-white/[0.04]'
                }`}>
                <Avatar name={m.full_name} size={6} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{m.full_name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{m.email}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Reschedule modal
// ──────────────────────────────────────────────────────────────────────

function RescheduleModal({
  appt, onClose, onSaved,
}: { appt: AppointmentRow; onClose: () => void; onSaved: (a: AppointmentRow) => void }) {
  const [startsAt, setStartsAt] = useState(toLocalInput(appt.starts_at));
  const [duration, setDuration] = useState(appt.duration_minutes);
  const [sendEmail, setSendEmail] = useState(true);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!startsAt) { toast.error('Pick a new start time.'); return; }
    setSaving(true);
    try {
      const r = await OrganizationService.rescheduleAppointment(appt.id, {
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: duration,
        send_email: sendEmail,
        note: note.trim() || undefined,
      });
      if (r?.success) onSaved(r.data);
      else toast.error(r?.message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Reschedule appointment" subtitle="Update the time and optionally email the client." onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="New start"><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={ipt} /></Field>
        <Field label="Duration (min)"><input type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} className={ipt} /></Field>
      </div>
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="sr-only peer" />
        <span className="w-9 h-5 rounded-full bg-slate-700 peer-checked:bg-emerald-500 relative transition-colors">
          <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
        </span>
        <span className="text-xs text-slate-300">Email the client about the new time</span>
      </label>
      {sendEmail && (
        <Field label="Custom note (optional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${ipt} resize-none`}
                    placeholder="Leave blank to use the default reschedule message." />
        </Field>
      )}
      <ModalFooter saving={saving} onClose={onClose} onSave={save} saveLabel="Reschedule" />
    </ModalShell>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Edit modal
// ──────────────────────────────────────────────────────────────────────

function EditModal({
  appt, onClose, onSaved,
}: { appt: AppointmentRow; onClose: () => void; onSaved: (a: AppointmentRow) => void }) {
  const [title, setTitle] = useState(appt.title);
  const [location, setLocation] = useState(appt.location);
  const [duration, setDuration] = useState(appt.duration_minutes);
  const [status, setStatus] = useState<AppointmentRow['status']>(appt.status);
  const [clientTz, setClientTz] = useState(appt.client_timezone || '');
  const [hostTz, setHostTz] = useState(appt.host_timezone || '');
  const [notes, setNotes] = useState(appt.notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      const r = await OrganizationService.updateAppointment(appt.id, {
        title: title.trim(),
        location: location.trim(),
        duration_minutes: duration,
        status,
        client_timezone: clientTz.trim(),
        host_timezone: hostTz.trim(),
        notes,
      });
      if (r?.success) onSaved(r.data);
      else toast.error(r?.message || 'Failed');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Edit appointment" subtitle="Title, location, duration, status, timezones, and notes." onClose={onClose}>
      <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} className={ipt} /></Field>
      <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className={ipt} placeholder="e.g. Google Meet, Office, …" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration (min)"><input type="number" min={5} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 30)} className={ipt} /></Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as AppointmentRow['status'])} className={ipt}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-[#0a1020]">{STATUS_META[s].label}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Client timezone"><TimezoneSelect value={clientTz} onChange={setClientTz} /></Field>
        <Field label="Staff timezone"><TimezoneSelect value={hostTz} onChange={setHostTz} /></Field>
      </div>
      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className={`${ipt} resize-none`}
          placeholder="Anything the client / staff should remember for this meeting…"
        />
      </Field>
      <ModalFooter saving={saving} onClose={onClose} onSave={save} saveLabel="Save changes" />
    </ModalShell>
  );
}

// IANA timezone <select> — uses the browser's full list when available,
// falls back to a curated set covering common regions. Used by the Edit
// modal for client + staff timezone pickers.
function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const zones = (() => {
    try {
      const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
      if (typeof intl.supportedValuesOf === 'function') return intl.supportedValuesOf('timeZone');
    } catch { /* ignore */ }
    return [
      'UTC', 'Asia/Kathmandu', 'Asia/Kolkata', 'Asia/Tokyo', 'Asia/Singapore',
      'Asia/Dubai', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
      'Europe/Amsterdam', 'America/New_York', 'America/Chicago',
      'America/Denver', 'America/Los_Angeles', 'Australia/Sydney',
    ];
  })();
  const list = zones.includes(value) || !value ? zones : [value, ...zones];
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={ipt}>
      <option value="" className="bg-[#0a1020]">— Not set —</option>
      {list.map((tz) => (
        <option key={tz} value={tz} className="bg-[#0a1020]">{tz}</option>
      ))}
    </select>
  );
}

// ──────────────────────────────────────────────────────────────────────
//  Shared bits
// ──────────────────────────────────────────────────────────────────────

const ipt = 'w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ModalShell({
  title, subtitle, onClose, children,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a1020]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-white">{title}</h2>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  saving, onClose, onSave, saveLabel,
}: { saving: boolean; onClose: () => void; onSave: () => void; saveLabel: string }) {
  return (
    <div className="pt-2 flex justify-end gap-2">
      <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/[0.04]">Cancel</button>
      <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50">
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}

function InfoRow({
  icon: Icon, label, children,
}: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[12.5px]">
      <Icon className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-slate-200">{children}</div>
      </div>
    </div>
  );
}

function Avatar({ name, size = 9 }: { name: string; size?: number }) {
  const initials = (name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || '?';
  const hue = Array.from(name).reduce((a, c) => (a + c.charCodeAt(0)) % 360, 0);
  const s = `${size * 4}px`;
  return (
    <span
      className="rounded-full inline-flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ width: s, height: s, background: `linear-gradient(135deg, hsl(${hue} 60% 35%), hsl(${(hue + 40) % 360} 55% 25%))` }}
    >
      {initials}
    </span>
  );
}

// Activity timeline rendering — colour + label per ``kind`` so the
// timeline reads like a status chip stream without parsing free text.
function activityDot(kind: string): string {
  switch (kind) {
    case 'created':       return 'bg-emerald-400';
    case 'rescheduled':   return 'bg-amber-400';
    case 'reassigned':    return 'bg-cyan-400';
    case 'status_changed':return 'bg-violet-400';
    case 'reminder_sent': return 'bg-blue-400';
    case 'email_sent':    return 'bg-blue-400';
    case 'meet_created':  return 'bg-emerald-400';
    case 'note_added':    return 'bg-slate-300';
    case 'guest_added':   return 'bg-emerald-300';
    case 'guest_removed': return 'bg-red-400';
    case 'edited':        return 'bg-slate-400';
    default:              return 'bg-slate-500';
  }
}
function activityLabel(kind: string): string {
  switch (kind) {
    case 'created':       return 'Created';
    case 'rescheduled':   return 'Rescheduled';
    case 'reassigned':    return 'Reassigned';
    case 'status_changed':return 'Status changed';
    case 'reminder_sent': return 'Reminder sent';
    case 'email_sent':    return 'Email sent';
    case 'meet_created':  return 'Meet link generated';
    case 'note_added':    return 'Note added';
    case 'guest_added':   return 'Guest added';
    case 'guest_removed': return 'Guest removed';
    case 'edited':        return 'Edited';
    default:              return kind;
  }
}

function toLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
