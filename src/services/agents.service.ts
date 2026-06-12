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

  /** Add found businesses to the pipeline as leads (deduped). */
  importLeads: (workspaceId: Id, businesses: FoundBusiness[]) =>
    apiClient
      .post<ApiEnvelope<{ created: number; skipped: number }>>(`${base(workspaceId)}/crm/import-leads/`, {
        leads: businesses,
      })
      .then((r) => r.data),

  /** Score the newest leads + suggest the next move (writes signals + a note). */
  analyzeRecent: (workspaceId: Id, limit = 5) =>
    apiClient
      .post<ApiEnvelope<{ results: LeadAnalysis[]; empty?: boolean }>>(
        `${base(workspaceId)}/crm/analyze-recent/`,
        { limit },
      )
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
};
