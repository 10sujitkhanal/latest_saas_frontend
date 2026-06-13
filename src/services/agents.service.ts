import { apiClient } from '@/lib/axios';
import type { ApiEnvelope } from './deals.service';

/** A storefront-offer proposal drafted by the Offers Agent. */
export interface OfferProposal {
  title: string;
  code: string;
  description: string;
  marketing_copy: string;
  type: 'percent' | 'flat' | 'free_delivery';
  value: number;
  min_order_amount: number;
  applicable_categories: string[];
  duration_days: number;
  currency: string;
}

export type AgentTaskStatus = 'proposed' | 'executed' | 'rejected' | 'failed';

/** A unit of work an agent proposed — the approval-queue + audit record. */
export interface AgentTask {
  id: number;
  kind: string;
  title: string;
  goal: string;
  status: AgentTaskStatus;
  proposal: OfferProposal;
  result: { coupon_id?: number; code?: string };
  error: string;
  created_by_email: string;
  reviewed_by_email: string;
  created_at: string;
  updated_at: string;
  executed_at: string | null;
}

type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/agents/workspaces/${workspaceId}`;
}

/** A draft product in the Auto-Store basket (from barcode / AI / manual). */
export interface ProductDraft {
  name: string;
  brand?: string;
  category: string;
  barcode?: string;
  image_url: string;
  description?: string;
  cost_price: number;
  selling_price: number;
  currency?: string;
}

export interface StoreBuildResult {
  count: number;
  created: { item_id: number; listing_id: number | null; name: string; sku: string }[];
  errors: { name: string; error: string }[];
}

export const StoreAgent = {
  /** Barcode → product draft (Open Food Facts). found:false when unknown. */
  lookup: (workspaceId: Id, barcode: string) =>
    apiClient
      .get<ApiEnvelope<{ found: boolean; product: ProductDraft | null }>>(
        `${base(workspaceId)}/store/lookup/`,
        { params: { barcode } },
      )
      .then((r) => r.data),

  /** Qwen-suggested starter catalogue for the business industry. */
  suggest: (workspaceId: Id, hint = '') =>
    apiClient
      .post<ApiEnvelope<{ products: ProductDraft[] }>>(`${base(workspaceId)}/store/suggest/`, { hint })
      .then((r) => r.data),

  /** Crawl a shop website URL → extracted product-catalogue draft (reviewable). */
  importUrl: (workspaceId: Id, url: string) =>
    apiClient
      .post<ApiEnvelope<{ products: ProductDraft[]; source_url?: string }>>(`${base(workspaceId)}/store/import-url/`, { url })
      .then((r) => r.data),

  /** Create draft Item + Listing for each product (no publish). */
  build: (workspaceId: Id, products: ProductDraft[]) =>
    apiClient
      .post<ApiEnvelope<StoreBuildResult>>(`${base(workspaceId)}/store/build/`, { products })
      .then((r) => r.data),
};

/** One lead's Advisor analysis (score + next-best-action + profile). */
export interface LeadAnalysis {
  lead_id: number;
  name: string;
  score: number | null;
  temperature: '' | 'hot' | 'warm' | 'cold';
  reason: string;
  next_action: string;
  profile: string;
}

export interface OutreachChannel { id: number; kind: string }
export interface OutreachDraftResponse {
  draft: { channel_kind: string; body: string };
  available_channels: OutreachChannel[];
  lead: { id: number; name: string; email: string; phone: string };
}

/** A business found via OpenStreetMap lead-finding. */
export interface FoundBusiness {
  name: string;
  phone: string;
  website: string;
  email: string;
  address: string;
  category: string;
}

export interface FinanceKpis {
  currency: string;
  outstanding: string;
  overdue: string;
  overdue_count: number;
  paid_this_month: string;
  open_count: number;
  top_overdue: { customer: string; amount: string }[];
}

export interface OverdueInvoice {
  id: number; invoice_no: string; customer: string; email: string;
  amount_due: string; currency: string; days_overdue: number;
}

export const FinanceAgent = {
  /** Read the books → receivables KPIs + an AI advisor note (read-only). */
  summary: (workspaceId: Id) =>
    apiClient
      .post<ApiEnvelope<{ kpis: FinanceKpis; insights: string }>>(`${base(workspaceId)}/finance/summary/`, {})
      .then((r) => r.data),
  /** Overdue invoices to chase (send reminders via AccountingService.remindInvoice). */
  overdue: (workspaceId: Id) =>
    apiClient
      .get<ApiEnvelope<{ invoices: OverdueInvoice[] }>>(`${base(workspaceId)}/finance/overdue/`)
      .then((r) => r.data),
};

export const CrmAgent = {
  /** Find B2B businesses by category + country/city/area (OSM, preview only). */
  findLeads: (
    workspaceId: Id,
    params: { category: string; city: string; area?: string; country?: string },
  ) =>
    apiClient
      .post<ApiEnvelope<{ businesses: FoundBusiness[]; categories: string[] }>>(
        `${base(workspaceId)}/crm/find-leads/`,
        params,
      )
      .then((r) => r.data),

  /** Fill in missing emails from the businesses' websites (preview only). */
  enrichLeads: (workspaceId: Id, businesses: FoundBusiness[]) =>
    apiClient
      .post<ApiEnvelope<{ businesses: FoundBusiness[]; enriched: number }>>(
        `${base(workspaceId)}/crm/enrich-leads/`,
        { businesses },
      )
      .then((r) => r.data),

  /** Add found businesses to the pipeline as leads (deduped). Scoped to a pipeline. */
  importLeads: (workspaceId: Id, businesses: FoundBusiness[], pipeline?: number | null) =>
    apiClient
      .post<ApiEnvelope<{ created: number; skipped: number }>>(`${base(workspaceId)}/crm/import-leads/`, {
        leads: businesses, pipeline: pipeline ?? undefined,
      })
      .then((r) => r.data),

  /** Score the newest leads + suggest the next move (writes signals + a note).
   *  Scoped to ``pipeline`` when the agent is assigned one. */
  analyzeRecent: (workspaceId: Id, limit = 5, pipeline?: number | null) =>
    apiClient
      .post<ApiEnvelope<{ results: LeadAnalysis[]; empty?: boolean }>>(
        `${base(workspaceId)}/crm/analyze-recent/`,
        { limit, pipeline: pipeline ?? undefined },
      )
      .then((r) => r.data),

  /** Advise ONE lead (inline, for Sales): score + temperature + next move.
   *  Persists the signals + the lead's AI summary card. */
  adviseLead: (workspaceId: Id, leadId: number) =>
    apiClient
      .post<ApiEnvelope<{ analysis: LeadAnalysis }>>(`${base(workspaceId)}/crm/advise-lead/`, {
        lead_id: leadId,
      })
      .then((r) => r.data),

  /** Draft a first-touch message + list the connected channels (no send). */
  draftOutreach: (workspaceId: Id, leadId: number, channelKind?: string) =>
    apiClient
      .post<ApiEnvelope<OutreachDraftResponse>>(`${base(workspaceId)}/crm/draft-outreach/`, {
        lead_id: leadId,
        channel_kind: channelKind,
      })
      .then((r) => r.data),

  /** Send the approved message via the SAME path the inbox uses. */
  sendOutreach: (leadId: number, channelId: number, body: string) =>
    apiClient
      .post<ApiEnvelope<{ conversation_id: number }>>(`/organization/leads/${leadId}/conversations/start/`, {
        channel_id: channelId,
        body,
      })
      .then((r) => r.data),

  /** Classify a lead's reply + draft the response (returns channels to send). */
  handleReply: (workspaceId: Id, leadId: number, replyText: string) =>
    apiClient
      .post<ApiEnvelope<{
        analysis: { intent: string; interest: string; sentiment: string; summary: string };
        draft: { body: string };
        available_channels: OutreachChannel[];
      }>>(`${base(workspaceId)}/crm/handle-reply/`, { lead_id: leadId, reply_text: replyText })
      .then((r) => r.data),

  /** Move the lead to 'contacted' + log the touch (after a successful send). */
  markContacted: (workspaceId: Id, leadId: number, channel: string) =>
    apiClient
      .post<ApiEnvelope<{ status: string }>>(`${base(workspaceId)}/crm/mark-contacted/`, {
        lead_id: leadId,
        channel,
      })
      .then((r) => r.data),
};

export const AgentsService = {
  /** Copilot: draft membership perks for a plan (the agent fills the blank field). */
  suggestPerks: (workspaceId: Id, ctx: { name?: string; price?: string; interval?: string }) =>
    apiClient
      .post<ApiEnvelope<{ perks: string[] }>>(`${base(workspaceId)}/suggest/membership-perks/`, ctx)
      .then((r) => r.data),

  /** Copilot: draft a short product description from the name + category. */
  suggestProductDescription: (workspaceId: Id, ctx: { name: string; category?: string }) =>
    apiClient
      .post<ApiEnvelope<{ text: string }>>(`${base(workspaceId)}/suggest/product-description/`, ctx)
      .then((r) => r.data),

  /** Copilot: draft a short promotional line for an offer (deal = "20% off"). */
  suggestOfferCopy: (workspaceId: Id, ctx: { deal: string; code?: string }) =>
    apiClient
      .post<ApiEnvelope<{ text: string }>>(`${base(workspaceId)}/suggest/offer-copy/`, ctx)
      .then((r) => r.data),

  /** Copilot: draft a short storefront tagline. */
  suggestStoreTagline: (workspaceId: Id, ctx: { title?: string }) =>
    apiClient
      .post<ApiEnvelope<{ text: string }>>(`${base(workspaceId)}/suggest/store-tagline/`, ctx)
      .then((r) => r.data),

  /** Copilot: draft a shopper blurb for the gift-card section. */
  suggestGiftCardBlurb: (workspaceId: Id) =>
    apiClient
      .post<ApiEnvelope<{ text: string }>>(`${base(workspaceId)}/suggest/gift-card-blurb/`, {})
      .then((r) => r.data),

  /** Copilot: draft a description for a loyalty reward (reward = "10% off"). */
  suggestRewardDescription: (workspaceId: Id, ctx: { name: string; reward?: string }) =>
    apiClient
      .post<ApiEnvelope<{ text: string }>>(`${base(workspaceId)}/suggest/reward-description/`, ctx)
      .then((r) => r.data),

  /** Ask the Offers Agent to draft an offer → saved as a proposed task. */
  draftOffer: (workspaceId: Id, goal: string) =>
    apiClient
      .post<ApiEnvelope<{ task: AgentTask }>>(`${base(workspaceId)}/offers/draft/`, { goal })
      .then((r) => r.data),

  /** The agent task queue (most recent first). */
  listTasks: (workspaceId: Id) =>
    apiClient.get<ApiEnvelope<AgentTask[]>>(`${base(workspaceId)}/tasks/`).then((r) => r.data),

  /** Approve a task with the (possibly edited) proposal → executes the action. */
  approveTask: (workspaceId: Id, taskId: Id, proposal: OfferProposal) =>
    apiClient
      .post<ApiEnvelope<{ task: AgentTask; coupon: { code: string } }>>(
        `${base(workspaceId)}/tasks/${taskId}/approve/`,
        { proposal },
      )
      .then((r) => r.data),

  /** Reject a proposed task (no action taken). */
  rejectTask: (workspaceId: Id, taskId: Id) =>
    apiClient
      .post<ApiEnvelope<{ task: AgentTask }>>(`${base(workspaceId)}/tasks/${taskId}/reject/`)
      .then((r) => r.data),

  // ── Trainable agent profiles (Phase C) ──
  listProfiles: (workspaceId: Id, agentType?: string) =>
    apiClient.get<ApiEnvelope<AgentProfile[]>>(`${base(workspaceId)}/profiles/`, { params: agentType ? { agent_type: agentType } : {} }).then((r) => r.data),
  createProfile: (workspaceId: Id, payload: Partial<AgentProfile>) =>
    apiClient.post<ApiEnvelope<AgentProfile>>(`${base(workspaceId)}/profiles/`, payload).then((r) => r.data),
  updateProfile: (workspaceId: Id, id: number, payload: Partial<AgentProfile>) =>
    apiClient.patch<ApiEnvelope<AgentProfile>>(`${base(workspaceId)}/profiles/${id}/`, payload).then((r) => r.data),
  deleteProfile: (workspaceId: Id, id: number) =>
    apiClient.delete<ApiEnvelope<unknown>>(`${base(workspaceId)}/profiles/${id}/`).then((r) => r.data),
  cloneProfile: (workspaceId: Id, id: number, payload?: { name?: string; pipeline?: number | null }) =>
    apiClient.post<ApiEnvelope<AgentProfile>>(`${base(workspaceId)}/profiles/${id}/clone/`, payload || {}).then((r) => r.data),
};

export interface AgentProfile {
  id: number;
  agent_type: string;
  name: string;
  pipeline: number | null;
  pipeline_name: string | null;
  instructions: string;
  is_active: boolean;
  is_default: boolean;
}
