'use client';

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Search, Flame, Clock, MessageSquare, ShieldAlert, Crown, AlertTriangle,
  Calendar, Sparkles, Send, UserCheck, CheckCircle2, Inbox as InboxIcon,
  Mail, MessageCircle, Phone, Video, Camera, Briefcase, ThumbsUp,
  Globe, Plug, Search as SearchIcon, Rocket, Tag, QrCode, CalendarDays,
  ChevronDown, Paperclip, FileText, X as XIcon, RefreshCw,
} from 'lucide-react';
// (toast import intentionally removed — inbox page is now toast-free per user UX request)
import { PageSkeleton } from '@/components/workspace/Skeleton';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { OrganizationService } from '@/services/organization.service';

/**
 * Mission Control inbox.
 *
 * Left rail: filter chips (Hot / Unanswered / Needs approval / VIP / Booking
 * / Complaint). Center: conversation list with AI summary + recommendation
 * chips. Right pane: opened conversation with full message thread + reply.
 *
 * Auto-refreshes every 25s so new inbound messages surface without a click.
 */

type Filter = '' | 'hot' | 'unanswered' | 'waiting_customer' | 'ai_handled' | 'needs_approval' | 'vip' | 'complaint' | 'booking';

interface ConversationCard {
  id: number;
  status: string;
  channel_kind: string;
  channel_name: string;
  contact: number;
  contact_name: string;
  lead: number | null;
  lead_score: number;
  lead_temperature: string;
  lead_intent: string;
  pipeline_name: string;
  ai_handled: boolean;
  needs_approval: boolean;
  is_unread: boolean;
  last_message_at: string | null;
  last_message_preview: string;
  ai_summary: string;
  ai_recommended_action: string;
  // When grouping by lead is on (default), the surfaced card shows
  // "+N channels" so the rep knows the lead has multiple open
  // threads. Click into the card and the lead-channel tabs above
  // the message thread let them switch between channels.
  other_channels_count?: number;
}

interface MessageAttachment {
  url: string;
  name: string;
  mime: string;
  size: number;
}

interface ConversationDetail extends ConversationCard {
  messages: {
    id: number;
    direction: 'in' | 'out';
    author: 'customer' | 'ai' | 'staff' | 'system';
    body: string;
    detected_intent: string;
    intent_confidence: number;
    created_at: string;
    attachments?: MessageAttachment[];
    channel_account?: string | null;
    channel_kind?: string | null;
    delivery_status?: 'queued' | 'sent' | 'failed' | null;
    delivery_meta?: { error?: string; [k: string]: unknown } | null;
  }[];
  // Cursor pagination on the message thread. ``messages_has_more``
  // means there's an older page; the frontend's "load older" sentinel
  // uses ``messages_oldest_id`` as the ``before`` cursor.
  messages_has_more?: boolean;
  messages_oldest_id?: number | null;
  // Other open conversations for the SAME lead — rendered as tabs
  // above the thread so the rep can switch between Email / SMS /
  // WhatsApp threads for one person without leaving the inbox.
  lead_conversations?: {
    id: number;
    channel_id: number | null;
    channel_kind: string | null;
    channel_name: string | null;
    channel_account: string | null;
    family: string | null;
    status: string;
    is_unread: boolean;
    last_message_at: string | null;
    last_message_preview: string;
    is_current: boolean;
  }[];
}

const FILTER_CHIPS: { value: Filter; label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }[] = [
  { value: '',                  label: 'All',              Icon: InboxIcon,    color: '#94a3b8' },
  { value: 'hot',               label: 'Hot leads',        Icon: Flame,        color: '#ef4444' },
  { value: 'unanswered',        label: 'Unanswered',       Icon: Clock,        color: '#f59e0b' },
  { value: 'waiting_customer',  label: 'Waiting customer', Icon: MessageSquare,color: '#06b6d4' },
  { value: 'ai_handled',        label: 'AI-handled',       Icon: Sparkles,     color: '#10b981' },
  { value: 'needs_approval',    label: 'Needs approval',   Icon: ShieldAlert,  color: '#a855f7' },
  { value: 'vip',               label: 'VIP customer',     Icon: Crown,        color: '#fbbf24' },
  { value: 'booking',           label: 'Booking',          Icon: Calendar,     color: '#3b82f6' },
  { value: 'complaint',         label: 'Complaint',        Icon: AlertTriangle,color: '#ef4444' },
];

// Channel chips — same colors as the Channels page so the user gets a
// consistent visual identity for Facebook/Instagram/WhatsApp/etc. across
// the app. The ``value`` is the ``Channel.kind`` slug from the backend.
//
// Per-provider SMS chips (Twilio / MessageBird / Vonage / Plivo) live
// alongside the family ``sms`` chip so the user can either filter
// broadly ("all SMS") or down to a specific provider account. The
// backend's ``?channel=sms`` filter expands to every SMS kind via
// ``_expand_kind_family``; the per-kind values filter to one provider.
const CHANNEL_CHIPS: { value: string; label: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }[] = [
  { value: '',            label: 'All channels',    Icon: InboxIcon,      color: '#94a3b8' },
  { value: 'facebook',    label: 'Facebook',        Icon: ThumbsUp,       color: '#1877f2' },
  { value: 'instagram',   label: 'Instagram',       Icon: Camera,         color: '#e1306c' },
  { value: 'whatsapp',    label: 'WhatsApp',        Icon: MessageCircle,  color: '#25d366' },
  { value: 'messenger',   label: 'Messenger',       Icon: MessageSquare,  color: '#0084ff' },
  { value: 'linkedin',    label: 'LinkedIn',        Icon: Briefcase,      color: '#0a66c2' },
  // Email family -- platform supports SMTP/IMAP + SendGrid only.
  // Mailgun / Postmark / AWS SES were removed from the catalog; if
  // any legacy Channel row exists on those kinds, filtering by
  // ``email`` still catches them via the kind-family expansion.
  { value: 'email',       label: 'Email (SMTP/IMAP)', Icon: Mail,         color: '#3b82f6' },
  { value: 'sendgrid',    label: 'SendGrid (email)', Icon: Mail,          color: '#1a82e2' },
  { value: 'webchat',     label: 'Website chat',    Icon: MessageSquare,  color: '#10b981' },
  { value: 'webform',     label: 'Website form',    Icon: Globe,          color: '#10b981' },
  { value: 'tiktok',      label: 'TikTok',          Icon: Video,          color: '#ff0050' },
  { value: 'google_ads',  label: 'Google Ads',      Icon: SearchIcon,     color: '#4285f4' },
  // SMS family — chips for each provider variant the dispatcher knows.
  { value: 'sms',         label: 'SMS (generic)',   Icon: MessageSquare,  color: '#a855f7' },
  { value: 'twilio_sms',  label: 'Twilio (SMS)',    Icon: MessageSquare,  color: '#f22f46' },
  { value: 'messagebird', label: 'MessageBird (SMS)', Icon: MessageSquare, color: '#2481d7' },
  { value: 'vonage',      label: 'Vonage (SMS)',    Icon: MessageSquare,  color: '#871fff' },
  { value: 'plivo',       label: 'Plivo (SMS)',     Icon: MessageSquare,  color: '#39c'    },
  { value: 'manual',      label: 'Phone / manual',  Icon: Phone,          color: '#f59e0b' },
  { value: 'moredealsx',  label: 'MoreDealsX',      Icon: Tag,            color: '#ec4899' },
  { value: 'qr',          label: 'QR code',         Icon: QrCode,         color: '#64748b' },
  { value: 'event',       label: 'Event',           Icon: CalendarDays,   color: '#a855f7' },
];

// Lookup for the small badge that renders on each conversation card.
const CHANNEL_META: Record<string, { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }> = Object.fromEntries(
  CHANNEL_CHIPS.filter((c) => c.value).map((c) => [c.value, { Icon: c.Icon, color: c.color, label: c.label }]),
);
CHANNEL_META.landing = { Icon: Rocket, color: '#06b6d4', label: 'Landing page' };
CHANNEL_META.unknown = { Icon: Plug, color: '#64748b', label: 'Other' };

const TEMP_BADGE: Record<string, string> = {
  hot:  'bg-red-500/15 text-red-300 border-red-500/30',
  warm: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  cold: 'bg-slate-500/15 text-slate-300 border-slate-500/20',
  spam: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

export default function InboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard required="crm.leads_view" workspaceId={wsId} skeleton="inbox">
      <InboxInner />
    </PermissionGuard>
  );
}

function InboxInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Channel filter syncs to ``?ch=`` so the sidebar deep-links from
  // /leads/inbox?ch=facebook, /leads/inbox?ch=whatsapp, etc. work without
  // a page reload.
  const channelFromUrl = searchParams?.get('ch') || '';

  const [filter, setFilter] = useState<Filter>('');
  const [channel, setChannel] = useState<string>(channelFromUrl);
  // Specific connected account (Channel.id) — used when a workspace
  // has multiple accounts on the same platform, e.g. sales@ AND
  // support@ both connected as ``email`` channels. ``null`` = "show
  // every account of the picked kind".
  const accountFromUrl = (() => {
    const a = searchParams?.get('account');
    return a && /^\d+$/.test(a) ? Number(a) : null;
  })();
  const [accountId, setAccountId] = useState<number | null>(accountFromUrl);
  const [accounts, setAccounts] = useState<Array<{
    id: number; kind: string; label: string; provider_label?: string;
    family?: string; count: number; is_active: boolean;
  }>>([]);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<ConversationCard[]>([]);
  // Cursor-pagination state for the conversation list. ``hasMore``
  // drives the infinite-scroll loader at the bottom of the sidebar;
  // ``cursor`` / ``cursorId`` are what the backend returned on the
  // last page and are echoed back on the next request.
  const [listHasMore, setListHasMore] = useState(false);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [listCursorId, setListCursorId] = useState<number | null>(null);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const LIST_PAGE_SIZE = 25;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [channelCounts, setChannelCounts] = useState<Record<string, number>>({});
  // Which channel kinds the workspace actually has connected — drives
  // the chip row so we don't show 16 platforms when only WhatsApp is wired up.
  const [connectedKinds, setConnectedKinds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  // Pending attachments for the composer — held as ``File`` objects so
  // the user can keep them across keystrokes. Cleared after a
  // successful send. Caps mirror the backend (4 files × 25MB).
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const MAX_FILES = 4;
  const MAX_BYTES = 25 * 1024 * 1024;
  // Older-messages infinite scroll for the open thread. ``oldestId``
  // is the ``before`` cursor we send to the backend; updated after
  // each successful load. ``loadingOlder`` throttles re-fires while
  // the request is in flight (the IntersectionObserver can rapidly
  // re-trigger if the user keeps scrolling).
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesScrollRef = useRef<HTMLDivElement | null>(null);
  const loadOlder = useCallback(async () => {
    if (!detail?.id || !detail?.messages_oldest_id || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const res = await OrganizationService.inboxMessagesPage(
        detail.id, detail.messages_oldest_id, 50,
      );
      if (res?.success) {
        const olderMsgs = (res.data.messages || []) as ConversationDetail['messages'];
        if (olderMsgs.length === 0) return;
        setDetail((d) => {
          if (!d) return d;
          // Dedupe against what's already in state (poll + older-scroll
          // can briefly overlap).
          const seen = new Set(d.messages.map((m) => m.id));
          const prepend = olderMsgs.filter((m) => !seen.has(m.id));
          return {
            ...d,
            messages: [...prepend, ...d.messages],
            messages_has_more: !!res.data.has_more,
            messages_oldest_id: res.data.oldest_id ?? d.messages_oldest_id,
          };
        });
      }
    } finally { setLoadingOlder(false); }
  }, [detail?.id, detail?.messages_oldest_id, loadingOlder]);

  // When the URL changes (sidebar click), re-sync local state.
  useEffect(() => {
    setChannel(channelFromUrl);
  }, [channelFromUrl]);

  // Push the local channel choice back to the URL so refreshes / shares work.
  const pickChannel = (next: string) => {
    setChannel(next);
    // Switching to a different platform invalidates the previously
    // picked account (a Twilio account id makes no sense after the
    // user clicks "Email"). Clear the URL param too.
    setAccountId(null);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next) params.set('ch', next);
    else params.delete('ch');
    params.delete('account');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname || '/');
  };

  // Pick a specific connected account (e.g. one of several email
  // addresses). ``null`` resets to "all accounts of this kind".
  const pickAccount = (id: number | null) => {
    setAccountId(id);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (id) params.set('account', String(id));
    else params.delete('account');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname || '/');
  };

  // Click-outside / Escape closes the account dropdown. Mounted only
  // while it's open so we don't burn listeners.
  useEffect(() => {
    if (!accountMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!accountMenuRef.current?.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountMenuOpen]);

  // Two flavours of list fetch:
  //   - ``load()``         → user-triggered, shows the skeleton.
  //   - ``loadSilent()``   → background refresh (polling / after-reply),
  //                          updates state without flipping ``loading``
  //                          so the page never flashes the skeleton.
  // The skeleton flash on every refresh tick is what made the inbox
  // feel like it was constantly reloading. Polling now stays invisible
  // until there's actually something new to show.
  // Fetch the FIRST page (filters changed → reset). Replaces the list
  // and clears pagination state.
  const fetchList = useCallback(async () => {
    const res = await OrganizationService.inboxList({
      filter: filter || undefined,
      search: search || undefined,
      channel: channel || undefined,
      channel_id: accountId || undefined,
      limit: LIST_PAGE_SIZE,
    });
    if (res?.success) {
      setConversations(res.data.conversations);
      setCounts(res.data.counts);
      setChannelCounts(res.data.channel_counts || {});
      if (Array.isArray(res.data.accounts)) setAccounts(res.data.accounts);
      setListHasMore(!!res.data.has_more);
      setListCursor(res.data.next_cursor ?? null);
      setListCursorId(res.data.next_cursor_id ?? null);
    }
  }, [filter, search, channel, accountId]);

  // Infinite-scroll page fetcher. Appends to the existing list,
  // dedupes by id (poll tick + scroll-load can race), advances the
  // cursor. Returns silently on the very last page.
  const fetchListMore = useCallback(async () => {
    if (listLoadingMore || !listHasMore) return;
    setListLoadingMore(true);
    try {
      const res = await OrganizationService.inboxList({
        filter: filter || undefined,
        search: search || undefined,
        channel: channel || undefined,
        channel_id: accountId || undefined,
        cursor: listCursor || undefined,
        cursor_id: listCursorId || undefined,
        limit: LIST_PAGE_SIZE,
      });
      if (res?.success) {
        const incoming = (res.data.conversations || []) as ConversationCard[];
        setConversations((curr) => {
          const seen = new Set(curr.map((c) => c.id));
          return [...curr, ...incoming.filter((c) => !seen.has(c.id))];
        });
        setListHasMore(!!res.data.has_more);
        setListCursor(res.data.next_cursor ?? null);
        setListCursorId(res.data.next_cursor_id ?? null);
      }
    } finally { setListLoadingMore(false); }
  }, [filter, search, channel, accountId, listCursor, listCursorId, listHasMore, listLoadingMore]);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchList(); } finally { setLoading(false); }
  }, [fetchList]);

  // Run the initial load whenever the filter context changes.
  useEffect(() => { load(); }, [load]);

  // Background refresh every 15s — silent, no skeleton.
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchList();
    }, 15_000);
    return () => clearInterval(t);
  }, [fetchList]);

  // ── Realtime poll for the currently-open conversation ────────────
  // Uses a ref for the cursor so the interval doesn't recreate every
  // time we splice a new message in (the old code had ``detail`` in
  // the dep array, so each poll that returned data tore down + rebuilt
  // the interval — pointless churn). The cursor ref is updated when a
  // poll lands new messages; the effect runs once per open-conv id.
  const cursorRef = useRef(0);
  useEffect(() => {
    if (!openId) { cursorRef.current = 0; return; }
    // Reset cursor to the latest message we already have when this
    // effect first fires for a newly opened conversation.
    cursorRef.current = detail?.messages?.length
      ? Math.max(...detail.messages.map((m) => m.id))
      : 0;

    let stopped = false;
    const tick = async () => {
      if (stopped || !openId) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await OrganizationService.inboxSince(openId, cursorRef.current);
        if (res?.success && Array.isArray(res.data?.messages) && res.data.messages.length) {
          const incoming = res.data.messages as ConversationDetail['messages'];
          cursorRef.current = Math.max(cursorRef.current, ...incoming.map((m) => m.id));
          // Dedupe by id when merging. Two ways the same id can arrive
          // twice: (a) the cursor effect runs before ``detail`` is set
          // so the first tick fetches messages we already have, (b) the
          // user retries a message and the poll picks up its new
          // updated_at. Either way, prefer the incoming row (fresher
          // delivery_status) and drop the old one.
          setDetail((d) => {
            if (!d) return d;
            const seen = new Set(incoming.map((m) => m.id));
            const kept = d.messages.filter((m) => !seen.has(m.id));
            return { ...d, messages: [...kept, ...incoming] };
          });
          // Silently refresh the list so the conversation card preview
          // updates. ``fetchList()`` does NOT flip ``loading`` → no
          // skeleton flash.
          fetchList();
        }
      } catch { /* network blip — try again next tick */ }
    };
    const t = setInterval(tick, 4_000);
    return () => { stopped = true; clearInterval(t); };
    // Only re-bind when the open conversation changes, NOT when
    // ``detail`` is mutated by a successful poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, fetchList]);

  // Pull the connected-channel list once on mount so the chip row only
  // shows what's actually wired up. Cached for the lifetime of the page
  // (connecting a new channel is a separate Channels-page flow).
  useEffect(() => {
    OrganizationService.listChannels().then((res) => {
      if (!res?.success) return;
      const live = new Set<string>();
      for (const c of res.data as { kind: string; is_connected: boolean }[]) {
        if (c.is_connected) live.add(c.kind);
      }
      setConnectedKinds(live);
    });
  }, []);

  const openConv = async (id: number) => {
    setOpenId(id);
    setDetail(null);
    const res = await OrganizationService.inboxDetail(id);
    if (res?.success) setDetail(res.data);
  };

  // Per-message retry — fires when the user clicks the small ↻ button
  // under a failed bubble. The backend re-dispatches via the same
  // synchronous path the inbox reply uses; on success the bubble
  // flips green ("sent"), on failure it stays red with whatever new
  // error the provider returned.
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const retryMessage = async (messageId: number) => {
    if (retryingId) return;  // throttle double-clicks
    setRetryingId(messageId);
    try {
      const res = await OrganizationService.retryMessage(messageId);
      // Splice the updated message back into ``detail.messages`` so
      // the bubble re-renders without a full thread reload.
      if (res?.data) {
        setDetail((d) => d
          ? { ...d, messages: d.messages.map((m) => m.id === messageId ? { ...m, ...res.data } : m) }
          : d);
      }
      // No toast — success / failure both surface visually on the
      // bubble (green sent / red failed pill). User wanted the inbox
      // free of toast clutter.
    } catch {
      // ignore — bubble's delivery_status surfaces the failure
    } finally {
      setRetryingId(null);
    }
  };

  const sendReply = async () => {
    // Either text OR at least one attachment is required — the
    // backend enforces the same rule.
    if (!openId) return;
    const hasText = !!reply.trim();
    const hasFiles = attachments.length > 0;
    if (!hasText && !hasFiles) return;
    setBusy(true);
    try {
      const res = await OrganizationService.inboxReply(openId, reply, hasFiles ? attachments : undefined);
      if (res?.success && res.data) {
        // Optimistic append — splice the freshly-returned message into
        // ``detail.messages`` and update the cursor so the next poll
        // tick won't refetch it. NO toast, NO refetch — the previous
        // ``openConv(openId)`` rebuilt the whole detail and the
        // ``load()`` reset the entire list, which the user saw as a
        // "page refresh." Dedupe by id in case the polling race fired
        // first.
        const next = res.data as ConversationDetail['messages'][number];
        setDetail((d) => {
          if (!d) return d;
          const idx = d.messages.findIndex((m) => m.id === next.id);
          const messages = idx >= 0
            ? d.messages.map((m, i) => i === idx ? { ...m, ...next } : m)
            : [...d.messages, next];
          return { ...d, messages };
        });
        if (next.id > cursorRef.current) cursorRef.current = next.id;
        setReply('');
        setAttachments([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch {
      // Silent — the user wanted no toast in the inbox. Failures will
      // still surface on the bubble via ``delivery_status === 'failed'``
      // once the message lands in state (network errors keep the input
      // contents so the user can re-try).
    } finally { setBusy(false); }
  };

  // File-picker handlers — open the hidden ``<input type=file>`` and
  // append picked files to the pending list (deduped by name+size so a
  // double-click never adds the same file twice). Bad files surface a
  // toast and are dropped silently.
  const onPickFiles = () => fileInputRef.current?.click();
  const onFilesPicked = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const fresh: File[] = [];
    for (const f of Array.from(list)) {
      // Silently skip oversize / duplicate files — the user asked for
      // a toast-free inbox. The composer's pending-attachment strip
      // is the source of truth: anything that lands there made it.
      if (f.size > MAX_BYTES) continue;
      if (attachments.some((a) => a.name === f.name && a.size === f.size)) continue;
      fresh.push(f);
    }
    const merged = [...attachments, ...fresh].slice(0, MAX_FILES);
    setAttachments(merged);
  };
  const removeAttachment = (idx: number) => {
    setAttachments((curr) => curr.filter((_, i) => i !== idx));
  };

  // Handover / approve — flip the relevant flag in ``detail`` directly
  // instead of refetching. No toast — the UI shows the new state via
  // the AI/handover badge on the conversation header.
  const handover = async () => {
    if (!openId) return;
    const res = await OrganizationService.inboxHandover(openId);
    if (res?.success) {
      setDetail((d) => d ? { ...d, ai_handled: false } : d);
    }
  };

  const approve = async (decision: 'approved' | 'rejected') => {
    if (!openId) return;
    const res = await OrganizationService.inboxApprove(openId, decision);
    if (res?.success) {
      setDetail((d) => d ? { ...d, needs_approval: false, status: 'open' } : d);
    }
  };

  // Filter chips visible inside the left rail. Trimmed to the most-used
  // four so the rail stays scannable — the rest are reachable via the
  // overflow menu (TODO).
  const QUICK_FILTERS = FILTER_CHIPS.filter(
    (f) => ['', 'unanswered', 'hot', 'needs_approval'].includes(f.value),
  );

  return (
    // Messenger-style two-pane layout that fills the viewport. No
    // outer page header — the chrome lives inside each pane so the
    // chat area can use the full available height, just like fb.com.
    <div className="h-[calc(100vh-100px)] rounded-2xl border border-white/5 bg-[#0a1020] overflow-hidden grid grid-cols-1 md:grid-cols-[340px_1fr] lg:grid-cols-[380px_1fr]">

      {/* ── LEFT: conversation list ─────────────────────────────────── */}
      <aside className="flex flex-col border-r border-white/5 bg-[#0c1424] min-h-0">
        {/* Header — title + connect link */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Chats</h1>
          <Link
            href="../credentials"
            title="Connect a new channel"
            className="w-8 h-8 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 inline-flex items-center justify-center"
          >
            <Plug className="w-4 h-4" />
          </Link>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              placeholder="Search Messenger"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-full bg-white/[0.05] border border-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40 focus:bg-white/[0.07]"
            />
          </div>
        </div>

        {/* Channel chips (horizontal scroll, no wrap) */}
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
          {CHANNEL_CHIPS
            .filter((c) =>
              c.value === '' ||
              channel === c.value ||
              connectedKinds.has(c.value) ||
              (channelCounts[c.value] ?? 0) > 0,
            )
            .map((c) => {
              const active = channel === c.value;
              const n = c.value === '' ? (counts.total ?? 0) : (channelCounts[c.value] ?? 0);
              return (
                <button
                  key={c.value || 'all'}
                  onClick={() => pickChannel(c.value)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    active ? 'border-white/20 text-white' : 'border-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  style={active ? { backgroundColor: `${c.color}1f`, borderColor: `${c.color}55` } : undefined}
                >
                  <c.Icon className="w-3 h-3" style={{ color: c.color }} />
                  {c.label}
                  {n > 0 && <span className="text-[9px] text-slate-500">{n}</span>}
                </button>
              );
            })}
        </div>

        {/* Account picker dropdown — shown when a channel kind is
            selected and the workspace has at least one connected
            account in that family. Picks render as
            "sales@acme.com  [Gmail]" so the user can distinguish
            multiple SMTP-style addresses by provider at a glance. */}
        {(() => {
          // Backend tags every account with the family it belongs to
          // (``email`` covers SMTP / Gmail / SendGrid / Mailgun / SES …).
          // Falls back to a kind-exact match for kinds without a family
          // declared on the backend.
          const familyAccounts = channel
            ? accounts.filter((a) => (a.family || a.kind) === channel)
            : [];
          if (!channel || familyAccounts.length === 0) return null;

          const totalCount = familyAccounts.reduce((s, a) => s + a.count, 0);
          const selected = accountId ? familyAccounts.find((a) => a.id === accountId) : null;
          const channelMeta = CHANNEL_META[channel] || CHANNEL_META.unknown;

          return (
            <div ref={accountMenuRef} className="mx-4 mb-3 relative">
              <button
                onClick={() => setAccountMenuOpen((o) => !o)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-colors ${
                  accountMenuOpen
                    ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
                    : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'
                }`}
                aria-haspopup="listbox"
                aria-expanded={accountMenuOpen}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${channelMeta.color}22` }}
                >
                  <channelMeta.Icon className="w-3.5 h-3.5" style={{ color: channelMeta.color }} />
                </span>
                <span className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    {channelMeta.label} account
                  </div>
                  <div className="text-[13px] text-white truncate font-semibold">
                    {selected ? selected.label : 'All accounts'}
                  </div>
                </span>
                {selected?.provider_label && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 font-bold shrink-0">
                    {selected.provider_label}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {accountMenuOpen && (
                <ul
                  role="listbox"
                  className="absolute left-0 right-0 mt-1 z-20 rounded-xl border border-white/[0.08] bg-[#0a1020] shadow-2xl shadow-black/40 max-h-72 overflow-y-auto py-1"
                >
                  <li>
                    <button
                      onClick={() => { pickAccount(null); setAccountMenuOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center justify-between gap-2 transition-colors ${
                        accountId === null
                          ? 'bg-emerald-500/[0.10] text-white'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        All accounts
                      </span>
                      <span className="text-[10px] text-slate-500">{totalCount}</span>
                    </button>
                  </li>
                  <li className="my-1 mx-2 border-t border-white/[0.05]" />
                  {familyAccounts.map((a) => {
                    const active = accountId === a.id;
                    return (
                      <li key={a.id}>
                        <button
                          onClick={() => { pickAccount(a.id); setAccountMenuOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 transition-colors ${
                            active
                              ? 'bg-emerald-500/[0.10] text-white font-semibold'
                              : 'text-slate-300 hover:bg-white/[0.04]'
                          }`}
                          title={a.label}
                        >
                          <span className="flex-1 truncate">{a.label}</span>
                          {a.provider_label && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 font-bold shrink-0">
                              {a.provider_label}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 shrink-0 tabular-nums w-6 text-right">
                            {a.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })()}

        {/* Quick-filter pills */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_FILTERS.map((c) => {
            const active = filter === c.value;
            const n = c.value === '' ? Object.values(counts).reduce((a, b) => a + (b || 0), 0)
                    : c.value === 'unanswered' ? (counts.waiting_staff || 0)
                    : (counts[c.value as string] || 0);
            return (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  active ? 'bg-white/[0.08] text-white' : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <c.Icon className="w-3 h-3" style={{ color: c.color }} />
                {c.label}
                {n > 0 && <span className="text-[9px] text-slate-500">{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Conversation list — scrolling region */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-3"><PageSkeleton kind="inbox" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No conversations match this filter.</div>
          ) : (
            <ul>
              {conversations.map((c) => {
                const meta = CHANNEL_META[c.channel_kind] || CHANNEL_META.unknown;
                const ChIcon = meta.Icon;
                const active = openId === c.id;
                const initial = (c.contact_name || '?')[0].toUpperCase();
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => openConv(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-emerald-500/[0.10]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-base font-semibold">
                          {initial}
                        </div>
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0c1424]"
                          style={{ backgroundColor: meta.color }}
                          title={meta.label}
                        >
                          <ChIcon className="w-2.5 h-2.5 text-white" />
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className={`text-[14px] truncate ${c.is_unread ? 'font-bold text-white' : 'font-semibold text-slate-200'}`}>
                            {c.contact_name || 'Unknown'}
                            {/* "+N channels" pill — only shown when
                                this card represents a lead that has
                                additional threads on other channels.
                                The lead-channel tabs at the top of
                                the conversation pane expose them. */}
                            {!!c.other_channels_count && c.other_channels_count > 0 && (
                              <span
                                className="ml-1.5 align-middle inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                title={`This lead has ${c.other_channels_count} other open ${c.other_channels_count === 1 ? 'channel' : 'channels'}. Open the conversation to see the tabs.`}
                              >
                                +{c.other_channels_count}
                              </span>
                            )}
                          </h3>
                          {c.last_message_at && (
                            <span className={`text-[10px] shrink-0 ${c.is_unread ? 'text-emerald-300 font-semibold' : 'text-slate-500'}`}>
                              {formatRelTime(c.last_message_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className={`text-[12px] truncate flex-1 ${c.is_unread ? 'text-white font-medium' : 'text-slate-400'}`}>
                            {c.last_message_preview || '—'}
                          </p>
                          {c.is_unread && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                          {c.needs_approval && <ShieldAlert className="w-3 h-3 text-amber-300 shrink-0" />}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {/* Infinite-scroll sentinel — when this div enters the
              viewport we fetch the next page. Rendered only when the
              backend says there's more, so it cleans itself up on the
              last page. */}
          {!loading && listHasMore && (
            <ListInfiniteSentinel
              onVisible={fetchListMore}
              loading={listLoadingMore}
            />
          )}
        </div>
      </aside>

      {/* ── RIGHT: open conversation ────────────────────────────────── */}
      <section className="flex flex-col min-h-0 bg-[#0a1020]">
        {!detail ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <MessageSquare className="w-9 h-9 text-emerald-300" />
            </div>
            <h2 className="text-base font-semibold text-white">Your messages</h2>
            <p className="text-[13px] mt-1 max-w-xs">
              {openId ? 'Loading conversation…' : 'Pick a chat on the left to open it. New messages arrive in real time.'}
            </p>
          </div>
        ) : (
          <>
            {/* Header — avatar + name + channel + actions */}
            <header className="px-5 py-3 border-b border-white/5 flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center text-white text-base font-semibold">
                  {(detail.contact_name || '?')[0].toUpperCase()}
                </div>
                {(() => {
                  const meta = CHANNEL_META[detail.channel_kind] || CHANNEL_META.unknown;
                  const ChIcon = meta.Icon;
                  return (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#0a1020]"
                      style={{ backgroundColor: meta.color }}
                    >
                      <ChIcon className="w-2.5 h-2.5 text-white" />
                    </span>
                  );
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-bold text-white truncate">{detail.contact_name}</h2>
                <p className="text-[11px] text-slate-500 truncate">
                  Active on {detail.channel_name}
                  {detail.lead_temperature && (
                    <> · <span className="capitalize">{detail.lead_temperature}</span> lead</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {detail.needs_approval && (
                  <>
                    <button onClick={() => approve('approved')} className="px-2.5 py-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => approve('rejected')} className="px-2.5 py-1.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 text-[11px] font-semibold">
                      Reject
                    </button>
                  </>
                )}
                {detail.ai_handled && (
                  <button onClick={handover} className="px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1">
                    <UserCheck className="w-3 h-3" /> Take over
                  </button>
                )}
              </div>
            </header>

            {/* AI summary pinned banner — only when present */}
            {detail.ai_summary && (
              <div className="mx-5 mt-3 p-3 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/15">
                <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold mb-1 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Sales assistant
                </div>
                <p className="text-[12px] text-slate-200">{detail.ai_summary}</p>
                {detail.ai_recommended_action && (
                  <p className="text-[11px] text-emerald-300/90 mt-1">{detail.ai_recommended_action}</p>
                )}
              </div>
            )}

            {/* Lead-channel tabs — when the same lead has reached out
                across multiple platforms (Email + WhatsApp + SMS), one
                tab per other conversation so the rep can switch
                without leaving the inbox. Hidden when only the open
                conversation exists for this lead. */}
            {detail.lead_conversations && detail.lead_conversations.length > 1 && (
              <LeadChannelTabs
                tabs={detail.lead_conversations}
                onPick={(convId) => { if (convId !== detail.id) openConv(convId); }}
              />
            )}

            {/* Messages — Messenger-style bubble stack, scrolls within
                its own region so the header + composer stay pinned.
                ``messagesScrollRef`` is what the older-sentinel reads
                to preserve scroll position when prepending older msgs. */}
            <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1.5 min-h-0">
              <ThreadOlderSentinel
                containerRef={messagesScrollRef}
                onLoadOlder={loadOlder}
                loading={loadingOlder}
                hasMore={!!detail.messages_has_more}
              />
              {detail.messages.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-12">No messages yet — send the first reply below.</p>
              ) : (
                detail.messages.map((m, i) => {
                  const out = m.direction === 'out';
                  const prev = detail.messages[i - 1];
                  const next = detail.messages[i + 1];
                  // "Stacking" effect — tighter rounded corners when
                  // the same side is sending several in a row, just
                  // like Messenger bubbles.
                  const samePrev = prev && prev.direction === m.direction;
                  const sameNext = next && next.direction === m.direction;
                  const corner = out
                    ? `rounded-2xl ${samePrev ? 'rounded-tr-md' : ''} ${sameNext ? 'rounded-br-md' : ''}`
                    : `rounded-2xl ${samePrev ? 'rounded-tl-md' : ''} ${sameNext ? 'rounded-bl-md' : ''}`;
                  const atts = (m.attachments || []) as MessageAttachment[];
                  return (
                    <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'} ${samePrev ? 'mt-0.5' : 'mt-2'}`}>
                      <div
                        className={`max-w-[70%] px-3.5 py-2 text-[14px] leading-snug ${corner} ${
                          out
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/[0.06] text-slate-100'
                        }`}
                        title={new Date(m.created_at).toLocaleString()}
                      >
                        {m.body && (
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        )}
                        {atts.length > 0 && (
                          <div className={`${m.body ? 'mt-2' : ''} flex flex-col gap-2`}>
                            {atts.map((a, i) => <AttachmentBubble key={i} att={a} outbound={out} />)}
                          </div>
                        )}
                        {/* Sender-credential footer on outbound bubbles
                            — "via you@gmail.com" so the user can tell
                            two mailboxes apart at a glance. Hidden
                            when there's no channel context (older
                            messages from before this was tracked). */}
                        {out && (m.channel_account || m.delivery_status === 'failed' || m.delivery_status === 'queued') && (
                          <div className="mt-1 text-[10px] text-white/70 flex items-center gap-1.5 flex-wrap">
                            {m.channel_account && (
                              <span title="Sent from this credential">via {m.channel_account}</span>
                            )}
                            {m.delivery_status === 'failed' && (
                              <>
                                <span
                                  className="text-red-200"
                                  title={m.delivery_meta?.error || 'Delivery failed.'}
                                >
                                  · failed
                                </span>
                                {/* Retry button — re-fires the dispatcher
                                    on this single message. Disabled
                                    while another retry is in flight to
                                    avoid double-sends on rapid clicks. */}
                                <button
                                  type="button"
                                  onClick={() => retryMessage(m.id)}
                                  disabled={retryingId === m.id}
                                  title={m.delivery_meta?.error
                                    ? `Retry — last error: ${m.delivery_meta.error}`
                                    : 'Retry send'}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold disabled:opacity-60 disabled:cursor-wait"
                                >
                                  <RefreshCw className={`w-3 h-3 ${retryingId === m.id ? 'animate-spin' : ''}`} />
                                  {retryingId === m.id ? 'Retrying…' : 'Retry'}
                                </button>
                              </>
                            )}
                            {m.delivery_status === 'queued' && (
                              <>
                                <span className="text-amber-200">· queued</span>
                                <button
                                  type="button"
                                  onClick={() => retryMessage(m.id)}
                                  disabled={retryingId === m.id}
                                  title="Force a send attempt now"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold disabled:opacity-60 disabled:cursor-wait"
                                >
                                  <RefreshCw className={`w-3 h-3 ${retryingId === m.id ? 'animate-spin' : ''}`} />
                                  {retryingId === m.id ? 'Sending…' : 'Send now'}
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer — paperclip + pending strip + rounded input +
                circular send button. Send disables when there's
                neither text nor a pending attachment. */}
            <div className="border-t border-white/5 px-3 py-3 space-y-2">
              {/* Pending attachments preview — thumbnail for images,
                  paperclip tile for everything else. Click the ×
                  to drop the file before sending. */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                  {attachments.map((f, i) => (
                    <PendingAttachment key={`${f.name}-${i}`} file={f} onRemove={() => removeAttachment(i)} />
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                  onChange={(e) => onFilesPicked(e.target.files)}
                />
                <button
                  type="button"
                  onClick={onPickFiles}
                  aria-label="Attach files"
                  title="Attach photo, video, or PDF"
                  disabled={busy || attachments.length >= MAX_FILES}
                  className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.10] text-slate-300 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!busy && (reply.trim() || attachments.length > 0)) sendReply();
                    }
                  }}
                  placeholder="Aa"
                  rows={1}
                  className="flex-1 px-4 py-2.5 rounded-3xl bg-white/[0.05] border border-transparent text-[14px] text-white placeholder:text-slate-500 resize-none max-h-32 focus:outline-none focus:bg-white/[0.07] focus:border-emerald-500/30"
                />
                <button
                  onClick={sendReply}
                  disabled={busy || (!reply.trim() && attachments.length === 0)}
                  aria-label="Send message"
                  className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// One attachment rendered inside a chat bubble. Images get an inline
// thumbnail that opens full-size on click; videos render with native
// controls; everything else (PDF, etc.) shows a tappable file pill.
function AttachmentBubble({ att, outbound }: { att: MessageAttachment; outbound: boolean }) {
  const mime = (att.mime || '').toLowerCase();
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const pillBg = outbound ? 'bg-white/15 hover:bg-white/25' : 'bg-black/30 hover:bg-black/40';
  if (isImage) {
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noreferrer noopener"
        className="block rounded-xl overflow-hidden bg-black/20 max-w-[260px]"
        title={att.name}
      >
        {/* Plain <img> — Next/Image needs domain config and we want
            zero-config rendering for tenant-uploaded media. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={att.url}
          alt={att.name}
          className="block w-full h-auto max-h-[260px] object-cover"
        />
      </a>
    );
  }
  if (isVideo) {
    return (
      <video
        src={att.url}
        controls
        className="block rounded-xl max-w-[280px] max-h-[260px] bg-black/40"
      />
    );
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${pillBg} text-[12.5px] max-w-[280px]`}
      title={att.name}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate">{att.name || 'Attachment'}</span>
    </a>
  );
}

// Pending-attachment preview tile shown in the composer before send.
// Image files get a local-blob thumbnail (no upload yet); the rest
// fall back to the same file pill the bubble uses post-send.
function PendingAttachment({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string>('');
  useEffect(() => {
    // ``createObjectURL`` returns a blob: URL — revoke on unmount so
    // the browser can GC the file bytes.
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const isImage = file.type.startsWith('image/');
  return (
    <div className="relative group">
      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/[0.06] border border-white/10 flex items-center justify-center">
        {isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-center px-1">
            <FileText className="w-5 h-5 text-slate-300 mx-auto" />
            <div className="text-[8px] text-slate-400 mt-0.5 truncate max-w-[60px]">{file.name}</div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 text-white flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <XIcon className="w-3 h-3" />
      </button>
    </div>
  );
}


// Friendly relative-time label used in the conversation list. Matches
// what Messenger / WhatsApp show next to the last-message line.
function formatRelTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}


// IntersectionObserver-based "load more" sentinel. Sits at the bottom
// of the conversation list and fires ``onVisible`` whenever it scrolls
// into view. Uses a 200px rootMargin so we kick off the next fetch
// just before the user actually reaches the bottom — feels seamless
// instead of pausing at the edge waiting for new rows.
function ListInfiniteSentinel({ onVisible, loading }: { onVisible: () => void; loading: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onVisible]);
  return (
    <div ref={ref} className="py-3 flex items-center justify-center text-[11px] text-slate-500">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-slate-700 border-t-emerald-400 animate-spin" />
          Loading more…
        </span>
      ) : (
        <span className="opacity-60">Scroll for more</span>
      )}
    </div>
  );
}


// IntersectionObserver-based "load older messages" sentinel. Same
// idea as ``ListInfiniteSentinel`` but flipped: lives at the TOP of
// the message thread, fires when the user scrolls near the top, and
// fetches OLDER messages (id < oldest currently loaded). We snapshot
// scrollHeight before the prepend and restore the offset after so the
// user's reading position doesn't jump.
function ThreadOlderSentinel({
  containerRef, onLoadOlder, loading, hasMore,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onLoadOlder: () => Promise<void>;
  loading: boolean;
  hasMore: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        const before = container.scrollHeight;
        await onLoadOlder();
        // Restore visual position — after prepending older messages
        // we want the user to STAY on the message they were reading,
        // not get teleported up to the top.
        requestAnimationFrame(() => {
          const after = container.scrollHeight;
          container.scrollTop += (after - before);
        });
      },
      { root: container, rootMargin: '100px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [containerRef, onLoadOlder, hasMore]);
  if (!hasMore) return null;
  return (
    <div ref={ref} className="py-2 flex items-center justify-center text-[11px] text-slate-500">
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="w-3 h-3 rounded-full border-2 border-slate-700 border-t-emerald-400 animate-spin" />
          Loading older messages…
        </span>
      ) : (
        <span className="opacity-60">Scroll up to load older</span>
      )}
    </div>
  );
}


// Tabs above the message thread when the same lead has chatted on
// multiple channels (e.g. someone who emailed AND WhatsApped). One
// tab per other conversation — click to switch the open conversation
// to that channel without leaving the inbox. Highlights the active
// tab, marks unread tabs with a dot, and shows the credential label
// underneath the family icon so the rep can tell "support@" from
// "sales@" for the same lead.
function LeadChannelTabs({
  tabs, onPick,
}: {
  tabs: NonNullable<ConversationDetail['lead_conversations']>;
  onPick: (convId: number) => void;
}) {
  // Order tabs by family then by recency. Family icon map matches the
  // CHANNEL_META keys above.
  return (
    <div className="px-4 pt-2 pb-1.5 border-b border-white/5 flex items-center gap-1 overflow-x-auto">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-2 shrink-0">
        This lead’s channels:
      </span>
      {tabs.map((t) => {
        const meta = CHANNEL_META[t.channel_kind || 'unknown'] || CHANNEL_META.unknown;
        const Icon = meta.Icon;
        const active = t.is_current;
        return (
          <button
            key={t.id}
            type="button"
            disabled={active}
            onClick={() => onPick(t.id)}
            title={t.channel_account
              ? `${meta.label} · ${t.channel_account}`
              : meta.label}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border whitespace-nowrap shrink-0 transition-colors ${
              active
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-100 cursor-default'
                : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05] hover:text-white'
            }`}
            style={!active ? { borderColor: `${meta.color}40` } : undefined}
          >
            <Icon className="w-3 h-3" style={{ color: meta.color }} />
            <span>{meta.label}</span>
            {t.channel_account && (
              <span className="text-[10px] font-normal opacity-70 max-w-[120px] truncate">
                · {t.channel_account}
              </span>
            )}
            {t.is_unread && !active && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
