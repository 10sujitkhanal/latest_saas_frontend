import { apiClient } from '@/lib/axios';

/**
 * Wraps every /api/v1/organization/* endpoint. Each backend response is shaped
 * as { success, message, data, errors, meta } (PrepareResponse). We return the
 * full envelope so callers can read `.success` and `.data` consistently.
 */
export const OrganizationService = {
  // Auth
  login: async (email: string, password: string) => {
    const { data } = await apiClient.post('/organization/auth/login/', { email, password });
    return data;
  },
  refreshToken: async (refresh: string) => {
    const { data } = await apiClient.post('/organization/auth/refresh/', { refresh });
    return data;
  },
  test: async () => {
    const { data } = await apiClient.get('/organization/test/');
    return data;
  },
  me: async () => {
    const { data } = await apiClient.get('/organization/me/');
    return data;
  },

  // Plans + subscription
  listPlans: async () => {
    const { data } = await apiClient.get('/organization/plans/');
    return data;
  },
  currentSubscription: async (page = 1, pageSize = 5) => {
    const { data } = await apiClient.get('/organization/plans/current/', {
      params: { page, page_size: pageSize },
    });
    return data;
  },
  subscribe: async (planId: number, billingCycle: 'MONTHLY' | 'YEARLY') => {
    const { data } = await apiClient.post('/organization/plans/subscribe/', {
      plan_id: planId,
      billing_cycle: billingCycle,
    });
    return data;
  },
  renew: async () => {
    const { data } = await apiClient.post('/organization/plans/renew/');
    return data;
  },
  createPaymentIntent: async (planId: number, billingCycle: 'MONTHLY' | 'YEARLY') => {
    const { data } = await apiClient.post('/organization/plans/intent/', {
      plan_id: planId,
      billing_cycle: billingCycle,
    });
    return data;
  },

  // Workspaces
  listWorkspaces: async () => {
    const { data } = await apiClient.get('/organization/workspaces/');
    return data;
  },
  createWorkspace: async (name: string) => {
    const { data } = await apiClient.post('/organization/workspaces/', { name });
    return data;
  },
  getWorkspace: async (id: number) => {
    const { data } = await apiClient.get(`/organization/workspaces/${id}/`);
    return data;
  },
  updateWorkspace: async (id: number, payload: { name?: string }) => {
    const { data } = await apiClient.patch(`/organization/workspaces/${id}/`, payload);
    return data;
  },
  deleteWorkspace: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/workspaces/${id}/`);
    return data;
  },
  listWorkspaceMembers: async (id: number) => {
    const { data } = await apiClient.get(`/organization/workspaces/${id}/members/`);
    return data;
  },
  assignWorkspaceMember: async (id: number, userId: number, role: string) => {
    const { data } = await apiClient.post(`/organization/workspaces/${id}/members/`, {
      user_id: userId, role,
    });
    return data;
  },
  updateWorkspaceMemberRole: async (id: number, userId: number, role: string) => {
    const { data } = await apiClient.patch(`/organization/workspaces/${id}/members/${userId}/`, { role });
    return data;
  },
  removeWorkspaceMember: async (id: number, userId: number) => {
    const { data } = await apiClient.delete(`/organization/workspaces/${id}/members/${userId}/`);
    return data;
  },
  listAssignableStaff: async (workspaceId: number) => {
    const { data } = await apiClient.get(`/organization/workspaces/${workspaceId}/assignable/`);
    return data;
  },

  // ── Workspace Panel (member-accessible) ────────────────────────────
  myWorkspaces: async () => {
    const { data } = await apiClient.get('/organization/my-workspaces/');
    return data;
  },
  workspaceContext: async (id: number) => {
    const { data } = await apiClient.get(`/organization/workspaces/${id}/context/`);
    return data;
  },
  workspaceLeadsList: async (
    id: number,
    params?: {
      search?: string; status?: string;
      assigned_to?: number | 'unassigned';
      stage?: number;
      source?: number | 'none';
      limit?: number; offset?: number;
    },
  ) => {
    const { data } = await apiClient.get(`/organization/workspaces/${id}/leads/`, { params });
    return data;
  },
  workspaceLeadsCreate: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.post(`/organization/workspaces/${id}/leads/`, payload);
    return data;
  },

  // Notifications
  listNotifications: async (workspaceId?: number) => {
    const { data } = await apiClient.get('/organization/notifications/', {
      params: workspaceId ? { workspace_id: workspaceId } : undefined,
    });
    return data;
  },
  markNotificationRead: async (id: number) => {
    const { data } = await apiClient.post(`/organization/notifications/read/${id}/`);
    return data;
  },
  markAllNotificationsRead: async () => {
    const { data } = await apiClient.post('/organization/notifications/read/');
    return data;
  },

  // RBAC — roles, permissions, menus
  listPermissions: async () => {
    const { data } = await apiClient.get('/organization/permissions/');
    return data;
  },
  listMenus: async () => {
    const { data } = await apiClient.get('/organization/menus/');
    return data;
  },
  listRoles: async () => {
    const { data } = await apiClient.get('/organization/roles/');
    return data;
  },
  createRole: async (payload: {
    code: string;
    name: string;
    description?: string;
    permission_codes: string[];
    is_default?: boolean;
  }) => {
    const { data } = await apiClient.post('/organization/roles/', payload);
    return data;
  },
  updateRole: async (
    id: number,
    payload: Partial<{
      code: string;
      name: string;
      description: string;
      permission_codes: string[];
      is_default: boolean;
    }>,
  ) => {
    const { data } = await apiClient.patch(`/organization/roles/${id}/`, payload);
    return data;
  },
  deleteRole: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/roles/${id}/`);
    return data;
  },

  // Leads
  // Unified analytics — one call returns counts/trends for leads,
  // inbox, tasks, appointments, knowledge, credentials, workflows,
  // automation, and live quota usage. Sections the tenant lacks
  // service ownership for are omitted.
  analyticsOverview: async () => {
    const { data } = await apiClient.get('/organization/leads/analytics/overview/');
    return data;
  },
  listLeads: async (params?: { workspace?: number; status?: string; search?: string; assigned?: string }) => {
    const { data } = await apiClient.get('/organization/leads/', { params });
    return data;
  },
  createLead: async (payload: {
    workspace: number;
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    status?: string;
    assigned_to?: number | null;
  }) => {
    const { data } = await apiClient.post('/organization/leads/', payload);
    return data;
  },
  getLead: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/${id}/`);
    return data;
  },
  updateLead: async (id: number, payload: Record<string, unknown>) => {
    // Open-shaped so callers can send any Lead field including new
    // Growth-Engine fields (value, notes, expected_close_date, lifecycle, …).
    // The server validates via DRF serializer.
    const { data } = await apiClient.patch(`/organization/leads/${id}/`, payload);
    return data;
  },
  deleteLead: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/${id}/`);
    return data;
  },
  // Upload a profile picture for the lead (multipart). The response
  // payload includes the updated ``avatar_url`` so the page can swap
  // the image without a follow-up GET.
  uploadLeadAvatar: async (id: number, file: File) => {
    const fd = new FormData();
    fd.append('avatar', file);
    const { data } = await apiClient.post(`/organization/leads/${id}/avatar/`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  deleteLeadAvatar: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/${id}/avatar/`);
    return data;
  },
  importLeads: async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await apiClient.post('/organization/leads/import/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  /** Triggers a CSV download in the browser. Returns the blob URL after click. */
  // ─── Staff ──────────────────────────────────────────────
  listStaff: async (params?: { search?: string; status?: string; employment_type?: string; workspace?: number; department?: string }) => {
    const { data } = await apiClient.get('/organization/staff/', { params });
    return data;
  },
  createStaff: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/staff/', payload);
    return data;
  },
  getStaff: async (id: number) => {
    const { data } = await apiClient.get(`/organization/staff/${id}/`);
    return data;
  },
  updateStaff: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/staff/${id}/`, payload);
    return data;
  },
  deleteStaff: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/staff/${id}/`);
    return data;
  },
  listStaffWorkspaces: async (id: number) => {
    const { data } = await apiClient.get(`/organization/staff/${id}/workspaces/`);
    return data;
  },
  assignStaffWorkspace: async (id: number, workspaceId: number, role: string) => {
    const { data } = await apiClient.post(`/organization/staff/${id}/workspaces/`, {
      workspace_id: workspaceId, role,
    });
    return data;
  },
  updateStaffWorkspaceRole: async (id: number, workspaceId: number, role: string) => {
    const { data } = await apiClient.patch(`/organization/staff/${id}/workspaces/${workspaceId}/`, { role });
    return data;
  },
  removeStaffWorkspace: async (id: number, workspaceId: number) => {
    const { data } = await apiClient.delete(`/organization/staff/${id}/workspaces/${workspaceId}/`);
    return data;
  },

  // Payroll
  listPayroll: async (params?: { user?: number; status?: string; from?: string; to?: string }) => {
    const { data } = await apiClient.get('/organization/staff/payroll/', { params });
    return data;
  },
  createPayroll: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/staff/payroll/', payload);
    return data;
  },
  updatePayroll: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/staff/payroll/${id}/`, payload);
    return data;
  },
  deletePayroll: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/staff/payroll/${id}/`);
    return data;
  },

  // Attendance
  listAttendance: async (params?: { user?: number; date?: string; from?: string; to?: string; status?: string }) => {
    const { data } = await apiClient.get('/organization/staff/attendance/', { params });
    return data;
  },
  upsertAttendance: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/staff/attendance/', payload);
    return data;
  },
  updateAttendance: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/staff/attendance/${id}/`, payload);
    return data;
  },
  deleteAttendance: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/staff/attendance/${id}/`);
    return data;
  },

  // ---------- Menu tree ----------
  menuTree: async () => {
    const { data } = await apiClient.get('/organization/menu/tree/');
    return data;
  },

  // ---------- Lead pipeline / automation ----------
  leadKanban: async (workspace?: number) => {
    const { data } = await apiClient.get('/organization/leads/kanban/', {
      params: workspace ? { workspace } : undefined,
    });
    return data;
  },
  moveLeadStage: async (leadId: number, stageId: number | null, lostReasonId?: number) => {
    const payload: Record<string, unknown> = { stage: stageId };
    if (lostReasonId) payload.lost_reason = lostReasonId;
    const { data } = await apiClient.post(`/organization/leads/${leadId}/move/`, payload);
    return data;
  },
  leadTimeline: async (leadId: number) => {
    const { data } = await apiClient.get(`/organization/leads/${leadId}/timeline/`);
    return data;
  },
  listLostReasons: async () => {
    const { data } = await apiClient.get('/organization/leads/lost-reasons/');
    return data;
  },
  createLostReason: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/lost-reasons/', payload);
    return data;
  },
  listScoringRules: async () => {
    const { data } = await apiClient.get('/organization/leads/scoring-rules/');
    return data;
  },
  createScoringRule: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/scoring-rules/', payload);
    return data;
  },
  updateScoringRule: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/scoring-rules/${id}/`, payload);
    return data;
  },
  deleteScoringRule: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/scoring-rules/${id}/`);
    return data;
  },

  // ---------- Prompt-driven workflows ----------
  parseWorkflowPrompt: async (prompt: string, name?: string) => {
    const { data } = await apiClient.post('/organization/leads/workflows/parse/', { prompt, name });
    return data;
  },
  workflowPalette: async () => {
    const { data } = await apiClient.get('/organization/leads/workflows/palette/');
    return data;
  },
  workflowRuns: async (workflowId: number, opts?: { lead?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (opts?.lead) qs.set('lead', String(opts.lead));
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    const { data } = await apiClient.get(`/organization/leads/workflows/${workflowId}/runs/${tail}`);
    return data;
  },
  workflowRunDetail: async (runId: number) => {
    const { data } = await apiClient.get(`/organization/leads/workflows/runs/${runId}/`);
    return data;
  },
  workflowDryRun: async (workflowId: number, leadId: number) => {
    const { data } = await apiClient.get(
      `/organization/leads/workflows/${workflowId}/dry-run/?lead=${leadId}`,
    );
    return data;
  },

  // ---------- Scheduling (Calendly-style Event Types) ----------
  listEventTypes: async () => {
    const { data } = await apiClient.get('/organization/leads/event-types/');
    return data;
  },
  createEventType: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/event-types/', payload);
    return data;
  },
  getEventType: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/event-types/${id}/`);
    return data;
  },
  updateEventType: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/event-types/${id}/`, payload);
    return data;
  },
  deleteEventType: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/event-types/${id}/`);
    return data;
  },
  toggleEventType: async (id: number) => {
    const { data } = await apiClient.post(`/organization/leads/event-types/${id}/toggle/`);
    return data;
  },

  // ---------- Google OAuth (Calendar / Meet) ----------
  googleOAuthStatus: async () => {
    const { data } = await apiClient.get('/organization/leads/oauth/google/status/');
    return data;
  },
  googleOAuthGetConfig: async () => {
    const { data } = await apiClient.get('/organization/leads/oauth/google/config/');
    return data;
  },
  googleOAuthSaveConfig: async (payload: { client_id?: string; client_secret?: string; client_secret_clear?: boolean }) => {
    const { data } = await apiClient.put('/organization/leads/oauth/google/config/', payload);
    return data;
  },

  // ---------- Knowledge Base (RAG) ----------
  kbStatus: async () => {
    const { data } = await apiClient.get('/organization/leads/knowledge/status/');
    return data;
  },
  kbListDocuments: async () => {
    const { data } = await apiClient.get('/organization/leads/knowledge/documents/');
    return data;
  },
  kbCreateDocument: async (payload: {
    kind: 'text' | 'url' | 'file';
    title?: string;
    content?: string;
    url?: string;
    // ``kb_id`` pins the new document to a specific KnowledgeBase --
    // used by "Add more data" from a doc detail page so the new
    // training joins the same bucket. Omit to use the workspace's
    // default KB.
    kb_id?: number;
  }) => {
    const { data } = await apiClient.post('/organization/leads/knowledge/documents/', payload);
    return data;
  },
  /**
   * Bulk-create Q&A training pairs.
   * Posts to the bulk endpoint so one round-trip persists many pairs
   * at once. Each pair carries a list of equivalent question phrasings
   * + a single answer + match mode.
   */
  kbCreateQAPairs: async (pairs: Array<{
    questions: string[];
    answer: string;
    match_mode?: 'contains' | 'exact' | 'regex' | 'semantic';
    priority?: number;
  }>, kbId?: number) => {
    // ``kbId`` is optional -- when omitted the backend falls back to
    // the workspace's default KB (auto-created on first save).
    const path = kbId
      ? `/organization/leads/knowledge/bases/${kbId}/qa/bulk/`
      : '/organization/leads/knowledge/qa/bulk/';
    const { data } = await apiClient.post(path, { pairs });
    return data;
  },
  // List all Q&A pairs scoped to one KB. Returns rows ordered by
  // priority desc, id asc -- same order the chat engine matches in.
  // Used by the doc detail page to show what's already trained as
  // direct replies for THIS data.
  kbListQAPairs: async (kbId: number) => {
    const { data } = await apiClient.get(
      `/organization/leads/knowledge/bases/${kbId}/qa/`,
    );
    return data;
  },
  // List every KnowledgeBase in this workspace -- one card per KB on
  // the main /knowledge page so Q&A collections show up alongside
  // trained documents.
  kbListBases: async () => {
    const { data } = await apiClient.get(
      '/organization/leads/knowledge/bases/',
    );
    return data;
  },
  // Fetch a single KnowledgeBase row -- used by the doc detail page
  // to read the currently-selected ``model`` so the LLM picker can
  // highlight it as the active choice.
  kbGetBase: async (kbId: number) => {
    const { data } = await apiClient.get(
      `/organization/leads/knowledge/bases/${kbId}/`,
    );
    return data;
  },
  // Patch a KnowledgeBase row (mainly ``model`` swaps from the detail
  // page's LLM picker). Backend accepts any subset of the KB fields.
  kbUpdateBase: async (kbId: number, patch: {
    name?: string;
    description?: string;
    system_prompt?: string;
    model?: string;
    color?: string;
    is_active?: boolean;
  }) => {
    const { data } = await apiClient.patch(
      `/organization/leads/knowledge/bases/${kbId}/`,
      patch,
    );
    return data;
  },
  /**
   * Upload a PDF / DOCX / TXT / MD file for the chunker + embedder to
   * process. Must be multipart -- explicitly clear the JSON default
   * Content-Type header so axios lets the browser stamp the right
   * ``multipart/form-data; boundary=…`` value (same fix we applied to
   * the inbox attachments path).
   */
  kbUploadFile: async ({ file, title, kbId }: { file: File; title?: string; kbId?: number }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (title) fd.append('title', title);
    // KB scoping -- the backend reads ``kb_id`` from the multipart
    // body and attaches the new document to that KB. Without it,
    // the workspace's default KB gets used (auto-created).
    if (kbId) fd.append('kb_id', String(kbId));
    const { data } = await apiClient.post(
      '/organization/leads/knowledge/documents/upload/',
      fd,
      { headers: { 'Content-Type': undefined } },
    );
    return data;
  },
  // Delete one Q&A pair by id. Used by the per-doc detail page's
  // Q&A list -- removes the rule + its hit-count telemetry. Doesn't
  // affect any other Q&A pairs or trained documents.
  kbDeleteQA: async (qaId: number) => {
    const { data } = await apiClient.delete(
      `/organization/leads/knowledge/qa/${qaId}/`,
    );
    return data;
  },
  kbGetDocument: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/knowledge/documents/${id}/`);
    return data;
  },
  kbDeleteDocument: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/knowledge/documents/${id}/`);
    return data;
  },
  kbRetrainDocument: async (id: number) => {
    const { data } = await apiClient.post(`/organization/leads/knowledge/documents/${id}/retrain/`);
    return data;
  },
  kbSearch: async (query: string, top_k = 5) => {
    const { data } = await apiClient.post('/organization/leads/knowledge/search/', { query, top_k });
    return data;
  },
  kbChat: async (payload: {
    query: string;
    use_kb?: boolean;
    provider?: string;
    history?: { role: string; content: string }[];
    // ``document_ids`` scopes retrieval to a specific set of trained
    // documents -- used by the per-doc detail page so answers only
    // come from that one PDF / text / URL.
    document_ids?: number[];
    // ``kb_id`` scopes to one KnowledgeBase container.
    kb_id?: number;
  }) => {
    const { data } = await apiClient.post('/organization/leads/knowledge/chat/', payload);
    return data;
  },
  googleOAuthStart: async (params?: { channel_id?: number; workspace_id?: number | string }) => {
    const qs = new URLSearchParams();
    if (params?.channel_id) qs.set('channel_id', String(params.channel_id));
    if (params?.workspace_id) qs.set('workspace_id', String(params.workspace_id));
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    const { data } = await apiClient.get(`/organization/leads/oauth/google/start/${tail}`);
    return data;
  },
  listWorkflows: async () => {
    const { data } = await apiClient.get('/organization/leads/workflows/');
    return data;
  },
  createWorkflow: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/workflows/', payload);
    return data;
  },
  getWorkflow: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/workflows/${id}/`);
    return data;
  },
  updateWorkflow: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/workflows/${id}/`, payload);
    return data;
  },
  deleteWorkflow: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/workflows/${id}/`);
    return data;
  },
  runWorkflow: async (id: number, leadId: number) => {
    const { data } = await apiClient.post(`/organization/leads/workflows/${id}/run/`, { lead: leadId });
    return data;
  },

  // ---------- Growth Engine: Inbox, Contacts, Pipelines, Channels, Recipes, Funnel ----------
  /**
   * Paginated inbox list. ``cursor`` / ``cursor_id`` come from the
   * previous response's ``next_cursor`` / ``next_cursor_id``; pass
   * both unchanged to fetch the next page. ``channel_id`` scopes to
   * a single connected Channel row (per-credential filter).
   */
  inboxList: async (opts?: {
    filter?: string; search?: string;
    channel?: string; channel_id?: number;
    cursor?: string; cursor_id?: number; limit?: number;
  }) => {
    const { data } = await apiClient.get('/organization/leads/inbox/', {
      params: {
        filter: opts?.filter || undefined,
        search: opts?.search || undefined,
        channel: opts?.channel || undefined,
        channel_id: opts?.channel_id || undefined,
        cursor: opts?.cursor || undefined,
        cursor_id: opts?.cursor_id || undefined,
        limit: opts?.limit || undefined,
      },
    });
    return data;
  },
  /**
   * Page of OLDER messages on a conversation — used by the thread's
   * "load older" infinite scroll. Returns messages with id < ``before``
   * in chronological order.
   */
  inboxMessagesPage: async (id: number, before: number, limit = 50) => {
    const { data } = await apiClient.get(`/organization/leads/inbox/${id}/messages/`, {
      params: { before, limit },
    });
    return data;
  },
  inboxDetail: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/inbox/${id}/`);
    return data;
  },
  inboxReply: async (id: number, body: string, attachments?: File[]) => {
    // Use multipart when files are attached, JSON otherwise — keeps
    // the legacy text-only path on its narrow content-type so any
    // middleware that inspects request bodies sees the same shape.
    if (attachments && attachments.length > 0) {
      const fd = new FormData();
      fd.append('body', body);
      for (const f of attachments) fd.append('attachments', f);
      // The shared ``apiClient`` is created with a default
      // ``Content-Type: application/json`` header. With that default in
      // place, axios will NOT auto-generate the
      // ``multipart/form-data; boundary=...`` header needed for file
      // uploads -- it just stamps the JSON default and Django's
      // MultiPartParser can't parse the body. Explicitly setting
      // ``Content-Type: undefined`` here removes the default so
      // axios/the browser pick the right multipart header (with
      // boundary) from the FormData body itself.
      const { data } = await apiClient.post(
        `/organization/leads/inbox/${id}/reply/`,
        fd,
        { headers: { 'Content-Type': undefined } },
      );
      return data;
    }
    const { data } = await apiClient.post(`/organization/leads/inbox/${id}/reply/`, { body });
    return data;
  },
  // Long-poll cursor for realtime inbox updates. Returns ``messages``
  // newer than the ``after`` cursor + an updated ``cursor`` to use on
  // the next call. Cheaper than refetching the full detail every few
  // seconds.
  inboxSince: async (id: number, after: number) => {
    const { data } = await apiClient.get(`/organization/leads/inbox/${id}/since/`, {
      params: { after },
    });
    return data;
  },
  inboxHandover: async (id: number) => {
    const { data } = await apiClient.post(`/organization/leads/inbox/${id}/handover/`);
    return data;
  },
  inboxApprove: async (id: number, decision: 'approved' | 'rejected') => {
    const { data } = await apiClient.post(`/organization/leads/inbox/${id}/approve/`, { decision });
    return data;
  },
  // Permanent delete of a conversation + all its messages. Does NOT
  // delete the Contact; they may have other leads or message us again.
  inboxDeleteConversation: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/inbox/${id}/delete/`);
    return data;
  },
  // Per-bubble delete. Local-only -- doesn't recall the message from
  // Facebook / Twilio / etc. (no provider supports that anyway).
  deleteMessage: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/messages/${id}/delete/`);
    return data;
  },
  listContacts: async (opts?: { search?: string; vip?: boolean; limit?: number; offset?: number }) => {
    const { data } = await apiClient.get('/organization/leads/contacts/', {
      params: {
        search: opts?.search,
        vip: opts?.vip ? 1 : undefined,
        limit: opts?.limit,
        offset: opts?.offset,
      },
    });
    return data;
  },
  createContact: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/contacts/', payload);
    return data;
  },
  updateContact: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/contacts/${id}/`, payload);
    return data;
  },
  deleteContact: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/contacts/${id}/`);
    return data;
  },
  listPipelines: async () => {
    const { data } = await apiClient.get('/organization/leads/pipelines/');
    return data;
  },
  getPipeline: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/pipelines/${id}/`);
    return data;
  },
  createPipeline: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/pipelines/', payload);
    return data;
  },
  updatePipeline: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/pipelines/${id}/`, payload);
    return data;
  },
  deletePipeline: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/pipelines/${id}/`);
    return data;
  },
  installPipelineTemplates: async () => {
    const { data } = await apiClient.post('/organization/leads/pipelines/install-templates/');
    return data;
  },
  setDefaultPipeline: async (id: number) => {
    const { data } = await apiClient.post(`/organization/leads/pipelines/${id}/set-default/`);
    return data;
  },
  listChannels: async () => {
    const { data } = await apiClient.get('/organization/leads/channels/');
    return data;
  },
  channelCatalog: async () => {
    const { data } = await apiClient.get('/organization/leads/channels/catalog/');
    return data;
  },
  verifyChannel: async (id: number, config: Record<string, string>) => {
    // The wizard calls this BEFORE saving so we never store a credential
    // that doesn't actually authenticate against the provider.
    const { data } = await apiClient.post(`/organization/leads/channels/${id}/verify/`, { config });
    return data;
  },
  createChannel: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/channels/', payload);
    return data;
  },
  updateChannel: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/channels/${id}/`, payload);
    return data;
  },
  listRecipes: async () => {
    const { data } = await apiClient.get('/organization/leads/recipes/');
    return data;
  },
  installRecipe: async (slug: string) => {
    const { data } = await apiClient.post(`/organization/leads/recipes/${slug}/install/`);
    return data;
  },
  funnelAnalytics: async (days = 30) => {
    const { data } = await apiClient.get('/organization/leads/funnel/', { params: { days } });
    return data;
  },
  auditLog: async (event?: string) => {
    const { data } = await apiClient.get('/organization/leads/audit/', { params: { event } });
    return data;
  },
  quotaStatus: async () => {
    const { data } = await apiClient.get('/organization/leads/quotas/');
    return data;
  },
  setupStatus: async () => {
    const { data } = await apiClient.get('/organization/leads/setup/status/');
    return data;
  },

  // ---------- Appointments ----------
  listAppointments: async (opts?: {
    scope?: string;
    status?: string;
    assigned?: 'mine' | 'unassigned' | number;
  }) => {
    const { data } = await apiClient.get('/organization/leads/appointments/', { params: opts });
    return data;
  },
  createAppointment: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/appointments/', payload);
    return data;
  },
  // Guided "book like a client" flow — takes an event_type id + contact
  // info + chosen slot, auto-creates Contact / Lead / Appointment with
  // round-robin host assignment, Meet link, and confirmation emails.
  bookAppointment: async (payload: {
    event_type: number;
    starts_at: string;
    name: string;
    email?: string;
    phone?: string;
    timezone?: string;
    host_id?: number;
    guests?: string[];
    notes?: string;
  }) => {
    const { data } = await apiClient.post('/organization/leads/appointments/book/', payload);
    return data;
  },
  updateAppointment: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/appointments/${id}/`, payload);
    return data;
  },
  deleteAppointment: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/appointments/${id}/`);
    return data;
  },
  appointmentMeetLink: async (id: number, provider?: 'google_meet' | 'zoom') => {
    const { data } = await apiClient.post(
      `/organization/leads/appointments/${id}/meet/`,
      provider ? { provider } : {},
    );
    return data;
  },
  getAppointment: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/appointments/${id}/`);
    return data;
  },
  rescheduleAppointment: async (id: number, payload: { starts_at: string; duration_minutes?: number; send_email?: boolean; note?: string }) => {
    const { data } = await apiClient.post(`/organization/leads/appointments/${id}/reschedule/`, payload);
    return data;
  },
  remindAppointment: async (id: number, note?: string) => {
    const { data } = await apiClient.post(`/organization/leads/appointments/${id}/remind/`, { note });
    return data;
  },
  reassignAppointment: async (id: number, user_id: number) => {
    const { data } = await apiClient.post(`/organization/leads/appointments/${id}/reassign/`, { user_id });
    return data;
  },
  // Threaded notes on an appointment (multiple, ordered newest first).
  listAppointmentNotes: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/appointments/${id}/notes/`);
    return data;
  },
  createAppointmentNote: async (id: number, body: string) => {
    const { data } = await apiClient.post(`/organization/leads/appointments/${id}/notes/`, { body });
    return data;
  },
  updateAppointmentNote: async (apptId: number, noteId: number, body: string) => {
    const { data } = await apiClient.patch(`/organization/leads/appointments/${apptId}/notes/${noteId}/`, { body });
    return data;
  },
  deleteAppointmentNote: async (apptId: number, noteId: number) => {
    const { data } = await apiClient.delete(`/organization/leads/appointments/${apptId}/notes/${noteId}/`);
    return data;
  },
  // Activity timeline (created / rescheduled / reassigned / reminder_sent / etc).
  listAppointmentActivity: async (id: number) => {
    const { data } = await apiClient.get(`/organization/leads/appointments/${id}/activity/`);
    return data;
  },

  // ---------- Lead detail page ----------
  // ---------- Lead detail mutations (notes / attachments / replies / invite) ----------
  leadNotes: async (leadId: number) => {
    const { data } = await apiClient.get(`/organization/leads/${leadId}/notes/`);
    return data;
  },
  createLeadNote: async (leadId: number, body: string, pinned = false) => {
    const { data } = await apiClient.post(`/organization/leads/${leadId}/notes/`, { body, pinned });
    return data;
  },
  updateLeadNote: async (noteId: number, patch: { body?: string; pinned?: boolean }) => {
    const { data } = await apiClient.patch(`/organization/leads/notes/${noteId}/`, patch);
    return data;
  },
  deleteLeadNote: async (noteId: number) => {
    const { data } = await apiClient.delete(`/organization/leads/notes/${noteId}/`);
    return data;
  },
  leadAttachments: async (leadId: number) => {
    const { data } = await apiClient.get(`/organization/leads/${leadId}/attachments/`);
    return data;
  },
  uploadLeadAttachment: async (leadId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await apiClient.post(`/organization/leads/${leadId}/attachments/`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
  deleteLeadAttachment: async (attachmentId: number) => {
    const { data } = await apiClient.delete(`/organization/leads/attachments/${attachmentId}/`);
    return data;
  },
  conversationMessages: async (conversationId: number) => {
    const { data } = await apiClient.get(`/organization/leads/conversations/${conversationId}/messages/`);
    return data;
  },
  conversationReply: async (conversationId: number, body: string) => {
    const { data } = await apiClient.post(`/organization/leads/conversations/${conversationId}/messages/`, { body });
    return data;
  },
  /**
   * Re-dispatch a single outbound message that previously failed.
   * Used by the "Retry" button under each red bubble. Returns the
   * updated message with the new ``delivery_status``.
   */
  retryMessage: async (messageId: number) => {
    const { data } = await apiClient.post(`/organization/leads/messages/${messageId}/retry/`);
    return data;
  },
  /**
   * List the channels (email, SMS, WA, FB, IG, etc.) that the
   * lead-detail composer can send a *new* message through. The
   * channel-picker dropdown is built from this — each entry carries
   * the friendly ``account`` label so the user can tell two
   * connected Gmail accounts apart.
   */
  leadSendableChannels: async (leadId: number) => {
    const { data } = await apiClient.get(`/organization/leads/${leadId}/sendable-channels/`);
    return data;
  },
  /**
   * Start a new conversation from the lead-detail page. Reuses an
   * existing open conversation on the same channel when possible so
   * we don't fragment threads.
   */
  startLeadConversation: async (
    leadId: number,
    payload: { channel_id: number; body: string; attachments?: File[] },
  ) => {
    if (payload.attachments && payload.attachments.length > 0) {
      const form = new FormData();
      form.append('channel_id', String(payload.channel_id));
      form.append('body', payload.body);
      payload.attachments.forEach((f) => form.append('attachments', f));
      const { data } = await apiClient.post(
        `/organization/leads/${leadId}/conversations/start/`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return data;
    }
    const { data } = await apiClient.post(
      `/organization/leads/${leadId}/conversations/start/`,
      { channel_id: payload.channel_id, body: payload.body },
    );
    return data;
  },
  inviteLeadMeeting: async (leadId: number, payload: { title: string; starts_at: string; duration_minutes?: number; location?: string }) => {
    const { data } = await apiClient.post(`/organization/leads/${leadId}/appointments/invite/`, payload);
    return data;
  },

  leadFull: async (leadId: number) => {
    const { data } = await apiClient.get(`/organization/leads/${leadId}/full/`);
    return data;
  },

  // ---------- Pipeline kanban (now per-pipeline) ----------
  leadKanbanPipeline: async (
    pipelineId?: number,
    workspace?: number,
    extra?: { source?: number | 'none'; search?: string; skip_tick?: number | boolean },
  ) => {
    const { data } = await apiClient.get('/organization/leads/kanban/', {
      params: { pipeline: pipelineId, workspace, ...extra },
    });
    return data;
  },
  /**
   * Paginate a single kanban column. Used by the "Load more" button —
   * the main kanban GET caps each column at 100 leads, so this fetches
   * subsequent pages of the same ordering.
   */
  leadKanbanColumn: async (params: {
    stage: number | 'none';
    workspace?: number;
    pipeline?: number;
    source?: number | 'none';
    search?: string;
    page?: number;
    page_size?: number;
  }) => {
    const { data } = await apiClient.get('/organization/leads/kanban/column/', { params });
    return data;
  },
  reorderStages: async (orderedIds: number[]) => {
    const { data } = await apiClient.post('/organization/leads/stages/reorder/', { order: orderedIds });
    return data;
  },
  listStagesByPipeline: async (pipelineId: number) => {
    const { data } = await apiClient.get('/organization/leads/stages/', { params: { pipeline: pipelineId } });
    return data;
  },

  // ---------- Tasks service ----------
  listTasks: async (opts?: { scope?: string; status?: string; kind?: string; lead?: number }) => {
    const { data } = await apiClient.get('/organization/tasks/', { params: opts });
    return data;
  },
  taskStats: async () => {
    const { data } = await apiClient.get('/organization/tasks/stats/');
    return data;
  },
  createTask: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/tasks/', payload);
    return data;
  },
  getTask: async (id: number) => {
    const { data } = await apiClient.get(`/organization/tasks/${id}/`);
    return data;
  },
  updateTask: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/tasks/${id}/`, payload);
    return data;
  },
  deleteTask: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/tasks/${id}/`);
    return data;
  },
  completeTask: async (id: number) => {
    const { data } = await apiClient.post(`/organization/tasks/${id}/complete/`);
    return data;
  },
  assignTask: async (id: number, userId: number) => {
    const { data } = await apiClient.post(`/organization/tasks/${id}/assign/`, { user: userId });
    return data;
  },
  automationTick: async () => {
    const { data } = await apiClient.post('/organization/leads/automation/tick/');
    return data;
  },
  automationStatus: async () => {
    const { data } = await apiClient.get('/organization/leads/automation/status/');
    return data;
  },

  listLeadSources: async () => {
    const { data } = await apiClient.get('/organization/leads/sources/');
    return data;
  },
  createLeadSource: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/sources/', payload);
    return data;
  },
  updateLeadSource: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/sources/${id}/`, payload);
    return data;
  },
  deleteLeadSource: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/sources/${id}/`);
    return data;
  },
  /**
   * Rotate a source's intake api_key. The old key stops working
   * immediately; the new key + a fresh intake_url are returned in the
   * response so the UI can re-render the copy boxes.
   */
  rotateLeadSourceKey: async (id: number) => {
    const { data } = await apiClient.post(`/organization/leads/sources/${id}/rotate-key/`);
    return data;
  },

  // Optional ``pipeline`` filter — pass the pipeline id when you want
  // only that pipeline's stages back. The kanban + edit drawers use
  // this so a "Restaurant" pipeline doesn't show "Hotel" stages in
  // its dropdown.
  listLeadStages: async (params?: { pipeline?: number | string }) => {
    const { data } = await apiClient.get('/organization/leads/stages/', {
      params: params?.pipeline ? { pipeline: params.pipeline } : undefined,
    });
    return data;
  },
  createLeadStage: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post('/organization/leads/stages/', payload);
    return data;
  },
  updateLeadStage: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/stages/${id}/`, payload);
    return data;
  },
  deleteLeadStage: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/stages/${id}/`);
    return data;
  },

  listSourceRules: async (sourceId: number) => {
    const { data } = await apiClient.get(`/organization/leads/sources/${sourceId}/rules/`);
    return data;
  },
  createSourceRule: async (sourceId: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.post(`/organization/leads/sources/${sourceId}/rules/`, payload);
    return data;
  },
  updateRule: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/rules/${id}/`, payload);
    return data;
  },
  deleteRule: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/rules/${id}/`);
    return data;
  },

  listLeadFollowUps: async (leadId: number) => {
    const { data } = await apiClient.get(`/organization/leads/${leadId}/followups/`);
    return data;
  },
  createLeadFollowUp: async (leadId: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.post(`/organization/leads/${leadId}/followups/`, payload);
    return data;
  },
  updateFollowUp: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.patch(`/organization/leads/followups/${id}/`, payload);
    return data;
  },
  deleteFollowUp: async (id: number) => {
    const { data } = await apiClient.delete(`/organization/leads/followups/${id}/`);
    return data;
  },

  exportLeads: async (params?: { workspace?: number }) => {
    const response = await apiClient.get('/organization/leads/export/', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  },
};

// ---------- Envelope helpers ----------

export interface ApiEnvelope<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
  meta?: unknown;
}

// ---------- Typed payloads (matches PrepareResponse `data` field) ----------

export interface PlanQuotas {
  workspaces: number;
  users: number;
  leads: number;
  contacts: number;
  tasks: number;
  appointments: number;
  event_types: number;
  knowledge: number;
  inbox_msgs: number;
  credentials: number;
  workflows: number;
  channels: number;
  pipelines: number;
  lead_sources: number;
  followups: number;
}

export interface PlanFlags {
  bulk_import: boolean;
  use_automation: boolean;
  use_api: boolean;
}

export interface PlanService {
  code: string;
  name: string;
  icon: string;
}

export interface Plan {
  id: number;
  type: 'AGENCY' | 'DIRECT';
  name: string;
  monthly_price: string;
  yearly_price: string;
  // Legacy flat fields (kept so older callers keep working).
  max_workspaces: number;
  max_users: number;
  max_leads: number;
  features: string[];
  // Rich per-plan data: every quota, flags, and the list of services
  // bundled into the plan. Drives the expanded subscription card.
  quotas?: PlanQuotas;
  flags?: PlanFlags;
  services?: PlanService[];
}

export interface PlansResponse {
  plans: Plan[];
  stripe_publishable_key: string | null;
  stripe_configured: boolean;
  stripe_error: string | null;
}

export interface CurrentSubscription {
  subscription: {
    plan_name: string;
    status: string;
    current_period_end: string | null;
    billing_cycle: 'MONTHLY' | 'YEARLY' | string;
    effective_max_workspaces: number;
    effective_max_users: number;
    effective_max_leads: number;
    is_agency: boolean;
    agency_fee_percentage: string | null;
    // When true: this is a hand-tuned custom deal — UI shows Renew
    // and HIDES the switch-plan grid. When false: standard plan
    // subscription — UI shows the switch-plan grid and HIDES Renew.
    is_custom_subscription?: boolean;
  };
  usage: { workspaces: number; users: number; leads: number };
  invoices: Array<{
    id: number;
    amount: string;
    platform_fee: string;
    net_amount: string;
    status: string;
    billing_date: string;
    paid_at: string | null;
    period_start: string | null;
    period_end: string | null;
    plan_name: string | null;
  }>;
  pagination: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface Workspace {
  id: number;
  name: string;
  created_at: string;
  role: 'owner' | 'admin' | 'manager' | 'sales' | 'viewer' | null;
  member_count: number;
}

export interface WorkspaceMember {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  designation: string;
  employee_id: string;
  role: 'owner' | 'admin' | 'manager' | 'sales' | 'viewer';
  joined_at: string;
}

export interface AssignableStaffRow {
  id: number;
  email: string;
  full_name: string;
  designation: string;
  department: string;
  employee_id: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  workspace_id: number | null;
  workspace_name: string | null;
  created_at: string;
}

export interface NotificationsPayload {
  notifications: NotificationItem[];
  unread_count: number;
}

export interface PaymentIntentPayload {
  client_secret: string;
  amount: number;
}

export interface PermissionDef {
  id: number;
  code: string;
  label: string;
  description: string;
  module_code: string;
  module_name: string;
  service_id: number | null;
  service_name: string | null;
  is_owned: boolean;
}

export interface MenuDef {
  id: number;
  code: string;
  label: string;
  path: string;
  icon: string;
  sort_order: number;
  module_code: string;
  module_name: string;
  required_permission_code: string | null;
}

export interface Lead {
  id: number;
  workspace: number;
  workspace_name: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'won' | 'lost' | string;
  assigned_to: number | null;
  assigned_to_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffWorkspaceAssignment {
  id: number;
  workspace: { id: number; name: string; created_at: string; member_count: number };
  role: 'owner' | 'admin' | 'manager' | 'sales' | 'viewer';
  joined_at: string;
}

export interface StaffMember {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
  role: 'ADMIN' | 'MEMBER';
  employee_id: string;
  designation: string;
  department: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'probation' | 'on_leave' | 'terminated';
  hire_date: string | null;
  termination_date: string | null;
  salary: string;
  salary_currency: string;
  pay_frequency: 'monthly' | 'biweekly' | 'weekly';
  phone: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  manager_id: number | null;
  manager_email: string | null;
  notes: string;
  workspaces: StaffWorkspaceAssignment[];
  workspace_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PayrollEntry {
  id: number;
  user: number;
  user_email: string;
  user_full_name: string;
  period_start: string;
  period_end: string;
  base_pay: string;
  bonuses: string;
  deductions: string;
  net_pay: string;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  paid_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceEntry {
  id: number;
  user: number;
  user_email: string;
  user_full_name: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'remote' | 'half_day' | 'leave' | 'absent' | 'holiday';
  hours_worked: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface RoleDef {
  id: number;
  code: string;
  name: string;
  description: string;
  permission_codes: string[];
  is_system: boolean;
  is_default: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}
