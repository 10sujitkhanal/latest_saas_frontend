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
