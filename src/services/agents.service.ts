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

type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/agents/workspaces/${workspaceId}`;
}

export const AgentsService = {
  /** Ask the Offers Agent to draft an offer for a plain-language goal. */
  draftOffer: (workspaceId: Id, goal: string) =>
    apiClient
      .post<ApiEnvelope<{ proposal: OfferProposal }>>(`${base(workspaceId)}/offers/draft/`, { goal })
      .then((r) => r.data),

  /** Approve a (possibly edited) proposal → creates it as a draft/paused coupon. */
  createOffer: (workspaceId: Id, proposal: OfferProposal) =>
    apiClient
      .post<ApiEnvelope<{ id: number; code: string }>>(`${base(workspaceId)}/offers/create/`, { proposal })
      .then((r) => r.data),
};
