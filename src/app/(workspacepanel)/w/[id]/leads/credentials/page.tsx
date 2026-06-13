'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import QuotaChip from '@/components/workspace/QuotaChip';
import QuotaBadge from '@/components/QuotaBadge';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import MoreTechAIPromo from '@/components/workspace/MoreTechAIPromo';
import OneClickSubscribeModal from '@/components/billing/OneClickSubscribeModal';
import { OrganizationService } from '@/services/organization.service';
import { useAuthStore } from '@/store/authStore';

/**
 * Credentials page — catalog-driven.
 *
 * Every credential kind defined in ``apps.leads.channel_specs`` shows
 * up as a card, even when the tenant has zero rows for it. Cards are
 * grouped by category (AI providers / Social / Web / Email / SMS / Ads /
 * Offers / Other) so users can scan the catalog quickly.
 *
 * Each card shows one of three states:
 *   - **Connected** — a Channel row exists with valid credentials.
 *   - **Needs setup** — a Channel row exists but credentials are missing.
 *   - **Available** — no Channel row yet. Clicking "Connect" creates it
 *     and opens the credential wizard.
 *
 * Quota note: the plan cap only restricts how many channels can be
 * *connected* at once. The catalog is always shown in full — a Pro
 * tenant on a 10-channel plan still sees all ~23 kinds; they just
 * can't actively connect more than 10.
 */

interface FieldSpec {
  key: string;
  label: string;
  type: 'text' | 'password' | 'email' | 'url' | 'textarea';
  required: boolean;
  placeholder?: string;
  help?: string;
  section?: string;
}

interface ExistingChannel {
  id: number;
  name: string;
  is_active: boolean;
  is_ai_enabled: boolean;
  is_connected: boolean;
  config_keys: string[];
  // Absolute inbound URL the provider should POST to. Built from the
  // current request host so it follows whichever subdomain the tenant
  // lives on.
  webhook_url?: string;
  webhook_secret?: string;
}

interface CatalogKind {
  kind: string;
  kind_label: string;
  category: string;
  fields: FieldSpec[];
  docs: string;
  setup_hint: string;
  auto_connect_if_present: boolean;
  existing: ExistingChannel[];
  connected_count: number;
  // Inbound-receive metadata from the backend (apps/leads/channel_specs.RECEIVE_INFO).
  // Drives the "Receives via …" pill on each card so users know whether
  // customer replies will land in the inbox.
  receive?: {
    available: boolean;
    via: string | null;  // 'imap' | 'webhook' | 'widget' | null
    note: string;
  };
  // Per-provider numbered steps for wiring up the inbound webhook.
  // Tokens {url}, {secret}, {id} get substituted client-side from the
  // selected channel row. Empty for kinds without an inbound stream.
  webhook_recipe?: { title: string; body: string }[];
}

interface CatalogGroup {
  code: string;
  label: string;
  kinds: CatalogKind[];
}

interface CatalogPayload {
  groups: CatalogGroup[];
  quota: { cap: number; used: number; remaining: number | null; unlimited: boolean };
}

const KIND_ICON: Record<string, string> = {
  facebook: 'ThumbsUp', instagram: 'Camera', whatsapp: 'MessageCircle',
  messenger: 'MessageSquare', webchat: 'MessageSquare', webform: 'Globe',
  landing: 'Rocket', google_ads: 'Search', linkedin: 'Briefcase',
  tiktok: 'Video', email: 'Mail',
  sendgrid: 'Send', mailgun: 'Send', postmark: 'Send', aws_ses: 'Cloud',
  sms: 'MessageSquare',
  twilio_sms: 'Phone', messagebird: 'Phone', vonage: 'Phone', plivo: 'Phone',
  moredealsx: 'Tag', qr: 'QrCode', event: 'CalendarDays', manual: 'PenSquare',
};

const KIND_COLOR: Record<string, string> = {
  facebook: '#1877f2', instagram: '#e1306c', whatsapp: '#25d366',
  messenger: '#0084ff', webchat: '#10b981', webform: '#10b981',
  landing: '#06b6d4', google_ads: '#4285f4', linkedin: '#0a66c2',
  tiktok: '#ff0050', email: '#3b82f6',
  sendgrid: '#1A82E2', mailgun: '#F06D31', postmark: '#FFDE57', aws_ses: '#FF9900',
  sms: '#a855f7',
  twilio_sms: '#F22F46', messagebird: '#2481D7', vonage: '#871FFF', plivo: '#1A1A66',
  moredealsx: '#ec4899', qr: '#64748b', event: '#a855f7', manual: '#f59e0b',
};

const CATEGORY_ICON: Record<string, string> = {
  social: 'MessageCircle',
  web: 'Globe',
  email: 'Mail',
  sms: 'Smartphone',
  ads: 'Megaphone',
  offer: 'Tag',
  other: 'Plug',
};

function Icon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[name] ?? Icons.Plug;
  return <C className={className} style={style} />;
}

export default function CredentialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="crm" required="credentials.view" workspaceId={wsId} skeleton="grid">
      <CredentialsInner wsId={wsId} />
    </PermissionGuard>
  );
}

function CredentialsInner({ wsId }: { wsId: string }) {
  const [catalog, setCatalog] = useState<CatalogPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<{ kind: CatalogKind; existing?: ExistingChannel } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await OrganizationService.channelCatalog();
      if (res?.success) setCatalog(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !catalog) return <PageSkeleton kind="grid" />;

  // MoreTech AI is NOT a bring-your-own-key credential — it's a paid
  // subscription rendered by the dedicated <MoreTechAICard/> above.
  // Strip it from the catalog so it doesn't also appear as a generic
  // "Connect" card (which would create an empty, keyless channel).
  const groups = catalog.groups
    .map((g) => ({ ...g, kinds: g.kinds.filter((k) => k.kind !== 'moretech_ai') }))
    .filter((g) => g.kinds.length > 0);

  const allKinds = groups.flatMap((g) => g.kinds);
  const connectedKinds = allKinds.filter((k) => k.connected_count > 0).length;
  const totalKinds = allKinds.length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Credentials</h1>
          <p className="text-sm text-slate-400 mt-1">
            Hook up the providers that power your CRM — AI models (ChatGPT, Gemini, Claude, Mistral, Groq, …),
            social messaging (Facebook, Instagram, WhatsApp, LinkedIn, TikTok), email (SendGrid, Mailgun, Postmark, AWS SES, SMTP),
            SMS (Twilio, MessageBird, Vonage, Plivo) and your website. Add the credentials once — every workflow uses them.
          </p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <QuotaChip quota="channels" workspaceId={wsId} />
            <QuotaBadge quota="credentials" label="credentials" />
            <span className="text-[11px] text-slate-500">
              · {connectedKinds} of {totalKinds} kinds connected
            </span>
          </div>
        </div>
      </div>

      {/* MoreTech AI — our managed Qwen LLM. Not a bring-your-own
          credential: tenants subscribe (monthly/yearly) to unlock it.
          Two complementary pieces, only one shows at a time:
            * Not purchased → <MoreTechAIPromo> suggests the upgrade and
              opens the purchase popup (same UX as Documents/Overview).
            * Active        → <MoreTechAICard> shows the live entitlement
              (renewal date + Renew/extend). */}
      <MoreTechAIPromo variant="banner" />
      <MoreTechAICard />

      {/* Plan-quota banner — explains why a Connect button could fail */}
      {!catalog.quota.unlimited && catalog.quota.used >= catalog.quota.cap && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <Icons.AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">
              Plan limit reached — {catalog.quota.used} of {catalog.quota.cap} active connections used
            </h3>
            <p className="text-[12px] text-slate-400 mt-1">
              You can still see every channel in the catalog below, but connecting another one will fail.
              Upgrade your plan to add more, or disconnect one you no longer use.
            </p>
          </div>
        </div>
      )}

      {/* Connected providers — pinned to the top so the credentials the
          tenant is actually using are the first thing visible. Each entry
          is also removed from its native category section below so we
          don't show the same card twice. */}
      {(() => {
        const connectedKindsFlat = groups
          .flatMap((g) => g.kinds)
          .filter((k) => k.connected_count > 0);
        if (connectedKindsFlat.length === 0) return null;
        return (
          <section className="mb-7">
            <div className="mb-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-300">
                <Icons.CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Connected</h2>
              <span className="text-[11px] text-emerald-300">
                · {connectedKindsFlat.length} active provider{connectedKindsFlat.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {connectedKindsFlat.map((k) => (
                <CatalogCard
                  key={`connected-${k.kind}`}
                  kind={k}
                  onConnect={() => setConnecting({ kind: k, existing: k.existing[0] })}
                  onSettings={(ex) => setConnecting({ kind: k, existing: ex })}
                />
              ))}
            </div>
          </section>
        );
      })()}

      {/* Grouped catalog — exclude already-connected kinds so they don't
          appear twice; their card lives in the Connected section above. */}
      {groups.map((group) => {
        const remaining = group.kinds.filter((k) => k.connected_count === 0);
        if (remaining.length === 0) return null;
        return (
          <section key={group.code} className="mb-7">
            <div className="mb-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-slate-300">
                <Icon name={CATEGORY_ICON[group.code] || 'Plug'} className="w-3.5 h-3.5" />
              </div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">{group.label}</h2>
              <span className="text-[11px] text-slate-500">
                · {remaining.length} available
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {remaining.map((k) => (
                <CatalogCard key={k.kind} kind={k} onConnect={() => setConnecting({ kind: k, existing: k.existing[0] })} onSettings={(ex) => setConnecting({ kind: k, existing: ex })} />
              ))}
            </div>
          </section>
        );
      })}

      {connecting && (
        <ConnectWizard
          catalogEntry={connecting.kind}
          existing={connecting.existing}
          onClose={() => setConnecting(null)}
          onSaved={(opts) => {
            // ``keepOpen: true`` -- used by the Google OAuth success
            // path so the modal stays visible and shows the freshly
            // populated form. All other save paths close the modal
            // as before.
            load();
            if (!opts?.keepOpen) setConnecting(null);
          }}
        />
      )}
    </div>
  );
}

interface MoreTechStatus {
  has_access: boolean;
  is_active: boolean;
  included?: boolean;
  billing_cycle: 'monthly' | 'yearly' | 'MONTHLY' | 'YEARLY' | null;
  current_period_end: string | null;
  lifetime_spend?: number;
  last_amount?: number;
  pricing: { monthly: number; yearly: number; currency: string; model: string; offered?: boolean; included?: boolean };
}

/**
 * MoreTech AI subscription card.
 *
 * Unlike the catalog cards (which connect a bring-your-own provider via
 * an API key), MoreTech AI is the platform's OWN hosted Qwen model.
 * There's no key to paste — the tenant SUBSCRIBES (monthly or yearly)
 * and the backend proxies every call with a server-side shared secret.
 *
 * States:
 *   - **Active** — green, shows renewal date + a "Renew / extend" action.
 *   - **Locked** — shows the two price buttons (monthly / yearly).
 *
 * On subscribe the backend issues an Invoice routed to the org's agency
 * (commission) or straight to the platform (direct orgs).
 */
function MoreTechAICard() {
  const [status, setStatus] = useState<MoreTechStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [renewOpen, setRenewOpen] = useState(false);
  // Renew / extend is an admin-only billing action.
  const isAdmin = useAuthStore((s) => s.user?.role) === 'ADMIN';

  const load = useCallback(async () => {
    try {
      const res = await OrganizationService.moretechAIStatus();
      if (res?.success) setStatus(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Show this card when MoreTech AI is live for the org — either bought
  // as a paid add-on (``is_active``) OR bundled with the plan
  // (``included``). The <MoreTechAIPromo> banner handles the "suggest to
  // purchase" state (paid add-on, not yet bought), so the two never
  // overlap. Hidden otherwise.
  if (loading || !status) return null;
  const included = !!status.included;
  if (!status.is_active && !included) return null;

  const cycle = String(status.billing_cycle || '').toLowerCase();
  const renews = status.current_period_end
    ? new Date(status.current_period_end).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  const renewPrice = cycle === 'yearly' ? (status.pricing?.yearly ?? 0) : (status.pricing?.monthly ?? 0);

  return (
    <>
    <section className="mb-7">
      <div className="relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/[0.12] via-fuchsia-500/[0.06] to-transparent p-5">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-400/30 flex items-center justify-center text-violet-200 shrink-0">
              <Icons.Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">MoreTech AI</h2>
                {included ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-200 border border-violet-400/30">
                    <Icons.Gift className="w-2.5 h-2.5" /> Included in your plan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Icons.CheckCircle2 className="w-2.5 h-2.5" /> Active
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-300 mt-1 max-w-md">
                Our managed AI model — private, hosted on our own servers.
                Select <span className="text-violet-200">MoreTech AI</span> as the model on any Knowledge Base.
              </p>
              {!included && renews && (
                <p className="text-[11px] text-emerald-300/80 mt-1.5">
                  {cycle === 'yearly' ? 'Yearly' : 'Monthly'} plan · renews {renews}
                </p>
              )}
              {included && (
                <p className="text-[11px] text-violet-300/80 mt-1.5">
                  Bundled free with your subscription — no extra charge.
                </p>
              )}
            </div>
          </div>

          {!included && isAdmin && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setRenewOpen(true)}
                className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.06] border border-white/15 text-white hover:bg-white/[0.1]"
              >
                Renew / extend
              </button>
            </div>
          )}
        </div>
      </div>
    </section>

      {renewOpen && (
        <OneClickSubscribeModal
          planName="MoreTech AI"
          price={renewPrice}
          cycle={cycle === 'yearly' ? 'YEARLY' : 'MONTHLY'}
          isFree={false}
          title="Renew MoreTech AI"
          confirmLabel={`Pay $${renewPrice.toFixed(2)} & renew`}
          onClose={() => setRenewOpen(false)}
          onConfirm={async () => {
            const res = await OrganizationService.moretechAISubscribe(cycle === 'yearly' ? 'yearly' : 'monthly');
            if (!res?.success) throw new Error(res?.message || 'Renew failed.');
            toast.success(res.message || 'MoreTech AI renewed.');
            setRenewOpen(false);
            await load();
          }}
        />
      )}
    </>
  );
}

function CatalogCard({
  kind, onConnect, onSettings,
}: {
  kind: CatalogKind;
  onConnect: () => void;
  onSettings: (ch: ExistingChannel) => void;
}) {
  const iconName = KIND_ICON[kind.kind] || 'Plug';
  const color = KIND_COLOR[kind.kind] || '#64748b';
  const connected = kind.existing.find((e) => e.is_connected);
  const draft = kind.existing.find((e) => !e.is_connected);
  // Modal toggle for the inbound-setup walkthrough — opens with the
  // first connected channel (the one whose webhook URL we'll show).
  // When nothing is connected yet, we still allow opening so the user
  // can preview the steps before clicking Connect.
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);

  let stateChip: React.ReactNode;
  if (connected) {
    stateChip = (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        <Icons.CheckCircle2 className="w-2.5 h-2.5" /> Connected
      </span>
    );
  } else if (draft) {
    stateChip = (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <Icons.AlertTriangle className="w-2.5 h-2.5" /> Needs setup
      </span>
    );
  } else {
    stateChip = (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10">
        Available
      </span>
    );
  }

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${
        connected
          ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
          : draft
          ? 'border-amber-500/15 bg-white/[0.02]'
          : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${color}26`, color }}
        >
          <Icon name={iconName} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-white truncate">{kind.kind_label}</h3>
            {stateChip}
            <ReceivePill
              receive={kind.receive}
              onClick={kind.receive?.available ? () => setShowWebhookHelp(true) : undefined}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{kind.setup_hint}</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
        {kind.docs ? (
          <a
            href={kind.docs}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] text-slate-400 hover:text-emerald-300 inline-flex items-center gap-1"
          >
            <Icons.BookOpen className="w-3 h-3" /> Setup guide
          </a>
        ) : <span />}
        {connected ? (
          <button
            onClick={() => onSettings(connected)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/10 text-slate-300 hover:bg-white/[0.08] inline-flex items-center gap-1.5"
          >
            <Icons.Settings2 className="w-3.5 h-3.5" /> Settings
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1.5"
          >
            <Icons.Plug className="w-3.5 h-3.5" /> Connect
          </button>
        )}
      </div>
      {showWebhookHelp && (
        <WebhookSetupModal
          kind={kind}
          channel={connected ?? draft ?? null}
          onClose={() => setShowWebhookHelp(false)}
        />
      )}
    </article>
  );
}

// -------------------------------------------------------------------------
// Receive-capability pill — shown on every card so the user knows
// whether customer replies will land in the inbox and via what
// transport (IMAP poll, provider webhook, embedded chat widget, etc.).
// -------------------------------------------------------------------------
function ReceivePill({ receive, onClick }: {
  receive?: CatalogKind['receive'];
  onClick?: () => void;
}) {
  if (!receive) return null;
  if (!receive.available) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 border border-slate-500/20"
        title={receive.note || 'No inbound stream — outbound only.'}
      >
        <Icons.ArrowDownToLine className="w-2.5 h-2.5 opacity-50" /> Send only
      </span>
    );
  }
  const label: Record<string, string> = {
    imap:    'Receives · IMAP',
    webhook: 'Receives · webhook',
    widget:  'Receives · widget',
  };
  const text = label[receive.via || ''] || 'Receives inbound';
  // When ``onClick`` is supplied we render as a button — clicking
  // pops the inbound-setup modal with copy-paste-ready URL + secret +
  // per-provider numbered steps. Without onClick (e.g. on the
  // connected-strip on the dashboard) it renders as a static span.
  const inner = (
    <>
      <Icons.ArrowDownToLine className="w-2.5 h-2.5" /> {text}
      {onClick && <Icons.Info className="w-2.5 h-2.5 opacity-70" />}
    </>
  );
  const cls = 'inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${receive.note}\n\nClick to see the exact webhook URL + setup steps.`}
        className={`${cls} hover:bg-cyan-500/20 cursor-pointer`}
      >
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} title={receive.note}>
      {inner}
    </span>
  );
}


// -------------------------------------------------------------------------
// Webhook setup modal — opens from the "Receives · webhook" pill.
// Shows the absolute inbound URL, the X-Webhook-Secret, and a numbered
// provider-specific walk-through (Twilio "A message comes in" → URL,
// Meta "Callback URL + Verify Token", Mailgun Routes filter, etc.).
// -------------------------------------------------------------------------
function WebhookSetupModal({
  kind, channel, onClose,
}: {
  kind: CatalogKind;
  channel: ExistingChannel | null;
  onClose: () => void;
}) {
  const [showSecret, setShowSecret] = useState(false);
  const url = channel?.webhook_url || '(connect this channel first — the URL is generated on save)';
  const secret = channel?.webhook_secret || '(generate one when you save the channel)';
  const recipe = kind.webhook_recipe || [];

  // Token substitution — replace {url}/{secret}/{id} in each step's
  // body so the user reads concrete copy-paste-ready values.
  const swap = (s: string) => s
    .replace(/\{url\}/g, url)
    .replace(/\{secret\}/g, secret)
    .replace(/\{id\}/g, String(channel?.id ?? ''));

  const copy = async (value: string, label: string) => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Copy failed — select and copy manually.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-[#0c1424] border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300">
              <Icons.ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {kind.kind_label} — inbound setup
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {kind.receive?.note}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white shrink-0">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {/* Copy-paste-ready fields. Without a connected channel they
            render as placeholders so the user can still preview the
            layout — actual values appear after they hit Connect. */}
        <div className="space-y-3 mb-5">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Webhook URL</span>
              <button
                onClick={() => copy(url, 'Webhook URL')}
                disabled={!channel}
                className="text-[11px] inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
              >
                <Icons.Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <div className="mt-1 rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 font-mono text-[11px] text-slate-200 break-all">
              {url}
            </div>
          </div>

          {kind.receive?.via === 'webhook' && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-500">
                  X-Webhook-Secret <span className="text-slate-600 normal-case font-sans">/ Verify token</span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowSecret((v) => !v)}
                    className="text-[11px] inline-flex items-center gap-1 text-slate-400 hover:text-white"
                  >
                    {showSecret
                      ? <><Icons.EyeOff className="w-3 h-3" /> Hide</>
                      : <><Icons.Eye className="w-3 h-3" /> Show</>}
                  </button>
                  <button
                    onClick={() => copy(secret, 'Secret')}
                    disabled={!channel?.webhook_secret}
                    className="text-[11px] inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"
                  >
                    <Icons.Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
              </div>
              <div className="mt-1 rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 font-mono text-[11px] text-slate-200 break-all">
                {showSecret
                  ? secret
                  : (channel?.webhook_secret
                      ? '••••••••••••••••' + secret.slice(-4)
                      : secret)}
              </div>
              <p className="mt-1 text-[10px] text-slate-500">
                Most providers call this the "Verify token" (Meta/WhatsApp/Messenger/Instagram) or expect it as the <code className="text-slate-400">X-Webhook-Secret</code> header on every POST. Inbound requests without it are rejected with HTTP 403.
              </p>
            </div>
          )}

          {channel && (
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Channel ID</span>
              <div className="mt-1 rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 font-mono text-[11px] text-slate-200 break-all">
                {channel.id}
              </div>
            </div>
          )}
        </div>

        {/* Numbered provider-specific steps. The body strings have
            already had ``{url}/{secret}/{id}`` interpolated by ``swap``. */}
        {recipe.length > 0 ? (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Setup steps</div>
            <ol className="space-y-3">
              {recipe.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-6 h-6 shrink-0 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[11px] font-bold text-cyan-300">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">{step.title}</div>
                    <div className="text-[12px] text-slate-300 mt-0.5 whitespace-pre-wrap leading-snug">
                      {swap(step.body)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="text-[11px] text-slate-500 italic">
            No provider-specific steps available yet — paste the URL above into your provider's inbound webhook setting.
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-3">
          {kind.docs ? (
            <a
              href={kind.docs}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] text-slate-400 hover:text-emerald-300 inline-flex items-center gap-1"
            >
              <Icons.BookOpen className="w-3 h-3" /> Provider docs
            </a>
          ) : <span />}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


// -------------------------------------------------------------------------
// Connect wizard — works for both new + existing channels.
// -------------------------------------------------------------------------

interface VerifyResult { ok: boolean; detail: string; code?: string; extra?: Record<string, unknown>; }

function ConnectWizard({
  catalogEntry, existing, onClose, onSaved,  // onSaved supports an
                                              // optional ``{keepOpen}``
                                              // arg (see Google OAuth)
}: {
  catalogEntry: CatalogKind;
  existing?: ExistingChannel;
  onClose: () => void;
  onSaved: (opts?: { keepOpen?: boolean }) => void;
}) {
  // ``existing`` is set when there's already a Channel row (Settings flow).
  // Otherwise the first save creates a row, then we verify against it.
  const [form, setForm] = useState<Record<string, string>>({});
  const [name, setName] = useState(existing?.name || catalogEntry.kind_label);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  // OAuth popup state — google_calendar kicks off Google's consent screen
  // in a popup and listens for the result via window.postMessage.
  const [oauthBusy, setOauthBusy] = useState(false);
  // Tracks the channel id returned by the callback so we can show a
  // "Connected" pill + refetch the saved config WITHOUT closing the
  // modal. ``oauthAccount`` holds the connected Google account email
  // so the UI can render "Linked to alex@example.com" inline.
  const [oauthConnectedChannelId, setOauthConnectedChannelId] = useState<number | null>(existing?.id ?? null);
  const [oauthAccount, setOauthAccount] = useState<string>('');
  const [oauthStatus, setOauthStatus] = useState<{
    configured: boolean;
    missing_env_var: string | null;
    redirect_uri: string;
    js_origin: string;
    auth_scopes: string[];
    source: '' | 'env' | 'db';
    client_id_preview: string;
    can_edit: boolean;
  } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTab, setGuideTab] = useState<'admin' | 'tenant'>('tenant');
  const isGoogleOAuth = catalogEntry.kind === 'google_calendar';

  const iconName = KIND_ICON[catalogEntry.kind] || 'Plug';
  const color = KIND_COLOR[catalogEntry.kind] || '#64748b';

  // If the channel already exists, fetch its current config when we open.
  useEffect(() => {
    if (!existing) return;
    OrganizationService.listChannels().then((res) => {
      if (!res?.success) return;
      const found = (res.data as Array<{ id: number; config: Record<string, string> }>).find((c) => c.id === existing.id);
      if (found) setForm({ ...(found.config || {}) });
    });
  }, [existing]);

  // Any edit to the form invalidates the last verify result so the user
  // is forced to re-test before saving.
  useEffect(() => {
    setVerifyResult(null);
  }, [form, name]);

  // Fetch the server's OAuth status so we can render the Setup Guide
  // accurately and short-circuit the Connect button when the platform
  // admin hasn't configured GOOGLE_CLIENT_ID/SECRET yet. If the user
  // lacks creds entirely it falls back to the tenant guide and surfaces
  // an unconfigured warning — both audiences always see useful info.
  useEffect(() => {
    if (!isGoogleOAuth) return;
    OrganizationService.googleOAuthStatus().then((res) => {
      if (res?.success) {
        setOauthStatus(res.data);
        // Auto-open the setup guide when the server isn't configured
        // so the tenant sees the "If the button is greyed out" hint
        // without having to click the toggle. The System admin tab
        // was removed -- a misconfigured server now surfaces in the
        // Connect Now button's disabled state + the inline warning.
        if (!res.data.configured) {
          setGuideOpen(true);
        }
      }
    }).catch(() => {});
  }, [isGoogleOAuth]);

  // Listen for the postMessage the OAuth callback popup sends back.
  // On success we close the wizard, refresh the catalog, and surface a
  // success toast. The popup self-closes ~1.2s after posting.
  useEffect(() => {
    if (!isGoogleOAuth) return;
    function onMessage(ev: MessageEvent) {
      const data = ev?.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'google-oauth-success') {
        setOauthBusy(false);
        toast.success(data.message || 'Google connected.');
        // ``channel_id`` is the row the callback just wrote -- store
        // it so the form's auto-fill effect (below) refetches the
        // saved config (client_id, refresh_token, account_email, …)
        // and populates every input the user can see. ``account_email``
        // surfaces as "Linked to alex@example.com" next to the pill.
        if (typeof data.channel_id === 'number') {
          setOauthConnectedChannelId(data.channel_id);
        }
        if (typeof data.account_email === 'string') {
          setOauthAccount(data.account_email);
        }
        // Notify the parent (catalog page) so its "Connected" status
        // updates too, but DO NOT close the modal -- the user wants
        // to see the freshly-populated form fields right there.
        onSaved({ keepOpen: true });
      } else if (data.type === 'google-oauth-error') {
        setOauthBusy(false);
        toast.error(data.message || 'Google connection failed.');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [isGoogleOAuth, onSaved]);

  // After a successful OAuth round-trip, refetch the channel row so
  // the form inputs reflect what the backend just stored (client_id,
  // refresh_token, account_email, calendar_id). Runs once per
  // ``oauthConnectedChannelId`` change so re-opening the modal on an
  // already-connected channel ALSO auto-fills.
  useEffect(() => {
    if (!isGoogleOAuth) return;
    if (!oauthConnectedChannelId) return;
    OrganizationService.listChannels().then((res) => {
      if (!res?.success) return;
      const found = (res.data as Array<{ id: number; name?: string; config: Record<string, string> }>)
        .find((c) => c.id === oauthConnectedChannelId);
      if (found) {
        setForm({ ...(found.config || {}) });
        if (found.config?.account_email) setOauthAccount(found.config.account_email);
        if (found.name) setName(found.name);
      }
    });
  }, [isGoogleOAuth, oauthConnectedChannelId]);

  const startGoogleOAuth = async () => {
    setOauthBusy(true);
    try {
      const res = await OrganizationService.googleOAuthStart({
        channel_id: existing?.id,
      });
      if (!res?.success || !res.data?.auth_url) {
        toast.error(res?.message || 'Could not start Google OAuth');
        setOauthBusy(false);
        return;
      }
      // Centre the popup over the parent window.
      const w = 520, h = 640;
      const left = Math.max(0, (window.screen.width - w) / 2);
      const top = Math.max(0, (window.screen.height - h) / 2);
      const popup = window.open(
        res.data.auth_url,
        'google-oauth',
        `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
      );
      if (!popup) {
        toast.error('Popup blocked — allow popups for this site and try again.');
        setOauthBusy(false);
        return;
      }
      // Watchdog: if the user closes the popup without completing, drop
      // the spinner so they can retry.
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setOauthBusy(false);
        }
      }, 500);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Could not start Google OAuth');
      setOauthBusy(false);
    }
  };

  function missingRequired(): string | null {
    for (const f of catalogEntry.fields) {
      if (f.required && !(form[f.key] || '').trim()) return f.label;
    }
    return null;
  }

  // Ensures a Channel row exists, returning its id. Used by both
  // "Test connection" and Save flows — verification needs a row to
  // attach the config to before calling the upstream API.
  async function ensureChannelRow(): Promise<number | null> {
    if (existing) return existing.id;
    // Create as inactive so a half-set-up draft isn't picked up by the
    // automation engine until verification passes and Save flips it on.
    const created = await OrganizationService.createChannel({
      kind: catalogEntry.kind,
      name,
      config: form,
      is_active: false,
      is_ai_enabled: false,
    });
    if (!created?.success) {
      toast.error(created?.message || 'Could not create channel');
      return null;
    }
    return created.data.id as number;
  }

  // "Test connection" — runs the verifier without persisting as active.
  const test = async () => {
    const missing = missingRequired();
    if (missing) { toast.error(`${missing} is required before testing.`); return; }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const id = await ensureChannelRow();
      if (!id) return;
      const res = await OrganizationService.verifyChannel(id, form);
      if (res?.success && res.data) {
        setVerifyResult(res.data as VerifyResult);
        if (res.data.ok) toast.success('Credentials look good — click Save to activate.');
        else toast.error(res.data.detail || 'Verification failed');
      } else {
        toast.error(res?.message || 'Verifier unreachable');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally { setVerifying(false); }
  };

  // "Send test message" — sends a REAL message through the stored creds so the
  // user sees it arrive (email → to the from-address). The "it works!" moment.
  const sendTest = async () => {
    const missing = missingRequired();
    if (missing) { toast.error(`${missing} is required before sending a test.`); return; }
    setSendingTest(true);
    try {
      const id = await ensureChannelRow();
      if (!id) return;
      // Make sure the latest typed config is saved before we send through it.
      await OrganizationService.updateChannel(id, { config: form });
      const res = await OrganizationService.sendTestChannel(id);
      if (res?.success) toast.success(res.message || 'Test sent — check your inbox.');
      else toast.error(res?.message || res?.data?.detail || 'Test send failed.');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Test send failed.');
    } finally { setSendingTest(false); }
  };

  // Save = verify first, then PATCH name+config and flip is_active=true.
  // We never persist a credential that didn't pass verification.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing = missingRequired();
    if (missing) { toast.error(`${missing} is required.`); return; }
    setBusy(true);
    try {
      const id = await ensureChannelRow();
      if (!id) return;

      // Always re-verify on Save — the form state may have changed since
      // the user clicked Test.
      setVerifying(true);
      const verifyRes = await OrganizationService.verifyChannel(id, form);
      setVerifying(false);
      const v = verifyRes?.data as VerifyResult | undefined;
      setVerifyResult(v || null);
      if (!verifyRes?.success || !v?.ok) {
        toast.error(v?.detail || 'Verification failed — credentials not saved as active.');
        return;
      }

      // Persist + activate.
      const upd = await OrganizationService.updateChannel(id, {
        name,
        config: form,
        is_active: true,
        is_ai_enabled: true,
      });
      if (upd?.success) {
        toast.success(`${catalogEntry.kind_label} connected — credentials verified.`);
        onSaved();
      } else toast.error(upd?.message || 'Failed to save');
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-[#0c1424] border border-white/10 p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}26`, color }}
          >
            <Icon name={iconName} className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white">
              {existing ? `Settings — ${catalogEntry.kind_label}` : `Connect ${catalogEntry.kind_label}`}
            </h2>
            <p className="text-[12px] text-slate-400 mt-0.5">{catalogEntry.setup_hint}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-500 hover:text-white">
            <Icons.X className="w-4 h-4" />
          </button>
        </div>

        {catalogEntry.docs && (
          <a
            href={catalogEntry.docs}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1.5 rounded-md bg-white/[0.04] border border-white/10 text-[11px] text-emerald-300 hover:bg-white/[0.08]"
          >
            <Icons.BookOpen className="w-3 h-3" /> Setup guide for {catalogEntry.kind_label}
            <Icons.ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        )}

        {/* One-click Google OAuth — opens Google's consent screen in a
            popup, exchanges the code server-side, and writes the tokens
            into this Channel row automatically. The manual fields below
            stay as a fallback for advanced users. */}
        {isGoogleOAuth && (
          <>
            {/* Connection card -- swaps between the "not connected"
                blue Connect Now button and a green "Connected" card
                once the OAuth round-trip has filled in the refresh
                token. ``form.refresh_token`` is the most reliable
                signal: the callback always writes it, manual entry
                requires it, so its presence = the channel is wired up. */}
            {(() => {
              const isConnected = Boolean(form.refresh_token && oauthConnectedChannelId);
              const linkedAccount = oauthAccount || form.account_email || '';
              if (isConnected) {
                return (
                  <div className="mb-3 rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.10] to-cyan-500/[0.05] p-4 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <Icons.CheckCircle2 className="w-6 h-6 text-emerald-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 inline-flex items-center gap-1.5">
                        Connected
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[9px] text-emerald-200">OAuth</span>
                      </div>
                      <div className="text-xs text-slate-200 mt-0.5 truncate">
                        {linkedAccount
                          ? <>Linked to <span className="font-semibold text-emerald-200">{linkedAccount}</span></>
                          : <>Google tokens saved -- Meet links will auto-attach to new appointments.</>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={startGoogleOAuth}
                      disabled={oauthBusy}
                      className="px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-[11px] font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 disabled:opacity-50"
                      title="Re-run the OAuth flow to refresh tokens or swap accounts."
                    >
                      {oauthBusy
                        ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Reconnecting…</>)
                        : (<><Icons.RefreshCw className="w-3 h-3" /> Reconnect</>)}
                    </button>
                  </div>
                );
              }
              return (
                <div className="mb-3 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.08] to-indigo-500/[0.05] p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <span className="text-blue-300 font-bold text-lg" aria-hidden>G</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider font-bold text-blue-300">OAuth Connection</div>
                    <div className="text-xs text-slate-300 mt-0.5">Fetch tokens automatically from Google.</div>
                  </div>
                  <button
                    type="button"
                    onClick={startGoogleOAuth}
                    disabled={oauthBusy || (oauthStatus !== null && !oauthStatus.configured)}
                    title={oauthStatus && !oauthStatus.configured
                      ? `Platform admin must set ${oauthStatus.missing_env_var} first.`
                      : undefined}
                    className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wider uppercase inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                  >
                    {oauthBusy
                      ? (<><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Connecting…</>)
                      : (<><Icons.Zap className="w-3.5 h-3.5" /> Connect Now</>)}
                  </button>
                </div>
              );
            })()}

            {/* Inline status strip — green when ready, amber when the
                platform admin still needs to configure OAuth env vars. */}
            {oauthStatus && (
              oauthStatus.configured ? (
                <div className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-emerald-300">
                  <Icons.CheckCircle2 className="w-3.5 h-3.5" />
                  Server is configured for Google OAuth.
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] p-3 text-[12px] text-amber-100">
                  <div className="font-semibold inline-flex items-center gap-1.5">
                    <Icons.AlertTriangle className="w-3.5 h-3.5" />
                    OAuth not configured on the server
                  </div>
                  <div className="mt-1 text-slate-300">
                    Your platform admin needs to set <code className="px-1 rounded bg-black/40">{oauthStatus.missing_env_var}</code> before
                    one-click connect works. See the <strong>System admin</strong> tab in the Setup guide below — or use the
                    manual fields underneath as a fallback.
                  </div>
                </div>
              )
            )}

            {/* Setup guide — collapsible, two tabs (Tenant user vs Admin). */}
            <SetupGuide
              open={guideOpen}
              setOpen={setGuideOpen}
              tab={guideTab}
              setTab={setGuideTab}
              status={oauthStatus}
              onConfigChanged={() => {
                // Re-fetch the status so the green/amber strip + Connect
                // Now button reflect the just-saved credentials.
                OrganizationService.googleOAuthStatus().then((res) => {
                  if (res?.success) setOauthStatus(res.data);
                });
              }}
            />
          </>
        )}

        <div className="space-y-3">
          <Field label="Display name" required>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main store WhatsApp" />
          </Field>

          {catalogEntry.fields.length === 0 ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-[12px] text-slate-300">
              <Icons.CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 inline mr-1" />
              No credentials needed for this channel — just give it a name and save.
            </div>
          ) : (
            renderFieldsGroupedBySection(catalogEntry.fields, form, setForm)
          )}
        </div>

        {/* Live verification result — shows after the user clicks Test
            connection (or after Save runs verify internally). Green for
            pass, red for fail. Cleared when the user edits any field. */}
        {(verifyResult || verifying) && (
          <div
            className={`mt-4 rounded-lg border p-3 flex items-start gap-2.5 text-[12px] ${
              verifying
                ? 'border-cyan-500/30 bg-cyan-500/5 text-slate-200'
                : verifyResult?.ok
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-100'
                : 'border-red-500/30 bg-red-500/5 text-red-100'
            }`}
          >
            {verifying ? (
              <>
                <div className="w-3.5 h-3.5 mt-0.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Testing credentials against the provider…</span>
              </>
            ) : verifyResult?.ok ? (
              <>
                <Icons.CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-300 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-white">Credentials verified</div>
                  <div className="text-slate-300 mt-0.5">{verifyResult.detail}</div>
                </div>
              </>
            ) : (
              <>
                <Icons.AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-300 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-white">Verification failed</div>
                  <div className="text-slate-300 mt-0.5">{verifyResult?.detail}</div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Fix the value above and click <strong>Test connection</strong> again.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500">
            {catalogEntry.fields.length === 0
              ? 'No verification needed for this channel.'
              : verifyResult?.ok
              ? '✓ Verified — click Save to activate.'
              : 'Click Test connection to verify before saving.'}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">
              Cancel
            </button>
            {catalogEntry.fields.length > 0 && (
              <button
                type="button"
                onClick={test}
                disabled={verifying || busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-cyan-200 border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {verifying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                    Testing…
                  </>
                ) : (
                  <>
                    <Icons.Zap className="w-3.5 h-3.5" /> Test connection
                  </>
                )}
              </button>
            )}
            {catalogEntry.kind === 'email' && (
              <button
                type="button"
                onClick={sendTest}
                disabled={sendingTest || verifying || busy}
                className="px-4 py-2 rounded-lg text-sm font-medium text-violet-200 border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/15 disabled:opacity-50 inline-flex items-center gap-1.5"
                title="Send a real test email to your from-address"
              >
                {sendingTest ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-violet-300 border-t-transparent rounded-full animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Icons.Send className="w-3.5 h-3.5" /> Send test
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || verifying}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Icons.Plug className="w-3.5 h-3.5" />
              {busy ? (verifying ? 'Verifying…' : 'Saving…') : existing ? 'Save changes' : 'Connect'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-[#080e1c] border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50';

function Field({
  label, required, help, children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-slate-500">
        {label} {required && <span className="text-amber-300">*</span>}
      </span>
      <div className="mt-1">{children}</div>
      {help && <p className="text-[10px] text-slate-500 mt-1">{help}</p>}
    </label>
  );
}

/** Group form fields by their optional ``section`` (used by email to split
 * Send/SMTP from Receive/IMAP). */
function renderFieldsGroupedBySection(
  fields: FieldSpec[],
  form: Record<string, string>,
  setForm: (next: Record<string, string>) => void,
) {
  const sectionOrder: string[] = [];
  const groups = new Map<string, FieldSpec[]>();
  for (const f of fields) {
    const key = f.section || '';
    if (!groups.has(key)) { groups.set(key, []); sectionOrder.push(key); }
    groups.get(key)!.push(f);
  }

  const renderInput = (f: FieldSpec) =>
    f.type === 'textarea' ? (
      <textarea
        rows={3}
        className={inputCls}
        value={form[f.key] || ''}
        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
        placeholder={f.placeholder}
      />
    ) : (
      <input
        type={f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text'}
        className={inputCls}
        value={form[f.key] || ''}
        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
        placeholder={f.placeholder}
        autoComplete={f.type === 'password' ? 'new-password' : 'off'}
      />
    );

  return (
    <>
      {sectionOrder.map((section) => (
        <div key={section || '__default'} className="space-y-3">
          {section && (
            <div className="pt-2 first:pt-0">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/10">
                {/^send/i.test(section) ? (
                  <Icons.Send className="w-3 h-3 text-emerald-300" />
                ) : /^receive/i.test(section) ? (
                  <Icons.Inbox className="w-3 h-3 text-cyan-300" />
                ) : (
                  <Icons.Settings2 className="w-3 h-3 text-slate-400" />
                )}
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-300">{section}</span>
              </div>
            </div>
          )}
          {groups.get(section)!.map((f) => (
            <Field key={f.key} label={f.label} required={f.required} help={f.help}>
              {renderInput(f)}
            </Field>
          ))}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Setup guide — two-tab explainer rendered inside the Google Calendar wizard.
// Audience split is intentional: the System admin tab walks the *platform*
// operator through the one-time Google Cloud Console + env-var setup; the
// Tenant user tab tells the *workspace* user what they do once it's wired.
// ---------------------------------------------------------------------------

function SetupGuide({
  open, setOpen, tab, setTab, status, onConfigChanged,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  tab: 'admin' | 'tenant';
  setTab: (t: 'admin' | 'tenant') => void;
  status: {
    configured: boolean; missing_env_var: string | null;
    redirect_uri: string; js_origin: string; auth_scopes: string[];
    source: '' | 'env' | 'db';
    client_id_preview: string;
    can_edit: boolean;
  } | null;
  onConfigChanged?: () => void;
}) {
  const copyValue = async (v: string | undefined, label: string) => {
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast.success(`${label} copied`);
    } catch { toast.error('Could not copy'); }
  };

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02]"
      >
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
          <Icons.BookOpen className="w-4 h-4 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">Setup guide — Google Calendar / Meet</div>
          <div className="text-[11px] text-slate-400">Who does what to turn on one-click Connect.</div>
        </div>
        <Icons.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-white/5">
          {/* System admin tab removed -- platform admins register a
              single redirect URI in Google Console once at deploy
              time (see backend/.env.production
              ``GOOGLE_OAUTH_REDIRECT_URI``) and never touch it again.
              Tenant users do nothing but click Connect Now. */}

          {/* Single panel -- tenant-user content only. The conditional
              was kept here as ``{true && (...)}`` so the surrounding
              JSX shape (the outer ``{open && (...)}`` block and the
              closing ``)`` further down) stays identical to the
              previous ternary version. */}
          {true && (
            <div className="p-4 space-y-3 text-[12.5px] text-slate-300">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-300 mb-1.5 inline-flex items-center gap-1.5">
                  <Icons.CheckCircle2 className="w-3.5 h-3.5" />
                  What you don&apos;t need
                </div>
                <ul className="ml-4 list-disc space-y-0.5 text-[11.5px] text-slate-300 marker:text-slate-500">
                  <li>No <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> — those live on the server and the platform admin sets them once for everyone.</li>
                  <li>No Google Cloud Console account.</li>
                  <li>No <code>.env</code> file, no terminal, no developer setup.</li>
                </ul>
              </div>
              <p className="text-slate-200">
                Just follow the four steps below — the credential is saved into <em>your workspace only</em>, never shared with other tenants.
              </p>
              <GuideStep n={1} title="Click Connect Now (the blue button above)">
                A small Google popup opens.
              </GuideStep>
              <GuideStep n={2} title="Pick the Google account that owns your calendar">
                Use the work account whose calendar should host the bookings. You can pick a different one later by reconnecting.
              </GuideStep>
              <GuideStep n={3} title="Approve the requested permissions">
                We ask for <strong>Calendar (read + write)</strong> and your <strong>email address</strong>. We never read your messages.
              </GuideStep>
              <GuideStep n={4} title="Wait for the green ✓ — the popup closes itself">
                The credential card will flip to <em className="text-emerald-300 not-italic font-semibold">Connected</em> automatically.
                Every booked appointment from now on gets a Google Meet link attached.
              </GuideStep>
              <div className="rounded-lg border border-slate-500/20 bg-white/[0.02] p-3 text-[11px] text-slate-400">
                <strong className="text-slate-200">If the button is greyed out</strong>, contact your platform admin --
                Google OAuth client credentials still need to be configured on the server side (one-time, for the whole
                platform). Tenants don't have to do anything else themselves.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GuideTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-semibold inline-flex items-center gap-1.5 border-b-2 transition-colors ${
        active
          ? 'border-violet-500 text-white bg-white/[0.02]'
          : 'border-transparent text-slate-400 hover:text-white hover:bg-white/[0.02]'
      }`}
    >
      {children}
    </button>
  );
}

/** In-browser form for the platform-level Google OAuth credentials.
 *  Saves to the public-schema PlatformConfig row, no env vars needed.
 *  Only renders the input fields when the current user is a platform
 *  admin — otherwise shows a read-only hint explaining who can edit. */
function PlatformOAuthForm({
  status, onSaved,
}: {
  status: { source: string; can_edit: boolean } | null;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<{
    source: string;
    env_client_id: string;
    env_has_secret: boolean;
    db_client_id: string;
    db_has_secret: boolean;
    updated_at: string | null;
    updated_by_email: string;
  } | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const canEdit = !!status?.can_edit;

  // Lazy-load the rich config (which includes the existing db_client_id)
  // only when the form is rendered for a platform admin.
  useEffect(() => {
    if (!canEdit) return;
    setLoading(true);
    OrganizationService.googleOAuthGetConfig().then((res) => {
      if (res?.success) {
        setInfo(res.data);
        setClientId(res.data.db_client_id || '');
      }
    }).finally(() => setLoading(false));
  }, [canEdit]);

  if (!canEdit) {
    return (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 text-[11.5px] text-amber-100">
        <strong>You need platform-admin rights to edit OAuth credentials.</strong> Ask a superuser to fill the
        form here, or set the env vars directly.
      </div>
    );
  }

  const save = async () => {
    if (!clientId.trim() && !clientSecret.trim()) {
      toast.error('Enter at least client_id or client_secret.');
      return;
    }
    setSaving(true);
    try {
      const res = await OrganizationService.googleOAuthSaveConfig({
        client_id: clientId.trim() || undefined,
        client_secret: clientSecret.trim() || undefined,
      });
      if (res?.success) {
        toast.success('Saved — Connect Now is ready.');
        setClientSecret('');
        // Re-fetch local + parent status.
        const refresh = await OrganizationService.googleOAuthGetConfig();
        if (refresh?.success) setInfo(refresh.data);
        if (onSaved) onSaved();
      } else {
        toast.error(res?.message || 'Save failed');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const clearSecret = async () => {
    if (!confirm('Clear the stored client_secret? OAuth will fall back to the env var (if set).')) return;
    setSaving(true);
    try {
      const res = await OrganizationService.googleOAuthSaveConfig({ client_secret_clear: true });
      if (res?.success) {
        toast.success('Cleared');
        const refresh = await OrganizationService.googleOAuthGetConfig();
        if (refresh?.success) setInfo(refresh.data);
        if (onSaved) onSaved();
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-3 space-y-3">
      <div className="flex items-start gap-2">
        <Icons.Settings2 className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-white">In-browser configuration</div>
          <div className="text-[10.5px] text-slate-400 mt-0.5">
            Saved to the public-schema <code>PlatformConfig</code> row. Takes precedence over any
            <code className="mx-1">GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> env vars.
            {info?.updated_at && (
              <> Last updated by <strong>{info.updated_by_email || 'someone'}</strong> on {new Date(info.updated_at).toLocaleString()}.</>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-[11px] text-slate-500 italic">Loading current values…</div>
      ) : (
        <>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1">
              OAuth client ID
            </div>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="XXXX-yyyy.apps.googleusercontent.com"
              className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-[12px] text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 flex items-center justify-between">
              <span>OAuth client secret</span>
              {info?.db_has_secret && (
                <button
                  type="button"
                  onClick={clearSecret}
                  className="text-[10px] text-rose-300 hover:text-rose-200"
                >
                  Clear stored secret
                </button>
              )}
            </div>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={info?.db_has_secret ? '•••••• (leave blank to keep existing)' : 'GOCSPX-...'}
              className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-[12px] text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              autoComplete="new-password"
            />
            {info?.env_has_secret && !info?.db_has_secret && (
              <div className="mt-1 text-[10.5px] text-slate-500">
                An env var is currently in use. Saving here will override it for all future OAuth flows.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-[10.5px] text-slate-500">
              {info?.source === 'db' && '✓ Using in-browser values'}
              {info?.source === 'env' && '✓ Using env-var values (override by saving below)'}
              {info?.source === '' && '✗ Nothing configured yet'}
            </div>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving
                ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>)
                : (<><Icons.Save className="w-3.5 h-3.5" /> Save credentials</>)}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Trouble({ title, causes }: { title: string; causes: React.ReactNode[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-rose-500/15 bg-rose-500/[0.04]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-rose-200 hover:bg-rose-500/[0.06] rounded-lg"
      >
        <Icons.AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 min-w-0">{title}</span>
        <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ol className="px-4 pb-3 pt-1 list-decimal ml-3 space-y-2 text-[12px] text-slate-300 marker:text-rose-300">
          {causes.map((c, i) => <li key={i}>{c}</li>)}
        </ol>
      )}
    </div>
  );
}

function GuideStep({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-semibold">{title}</div>
        {children && <div className="text-[11.5px] text-slate-400 mt-0.5">{children}</div>}
      </div>
    </div>
  );
}
