// Agreements API — talks to the ported backend at /api/v1/agreements/.
// Admin calls are workspace-scoped (workspace_id) and JWT-authed via apiClient.
// Public signing calls (by token) use a bare fetch so they work for anonymous
// external signers on the tenant host.
import { apiClient, resolveApiBase } from '@/lib/axios';
import type { Agreement, AgreementSigner, AgreementAuditEvent, SignerInput } from './types';

const BASE = '/agreements';

export const agreementsApi = {
  list: async (workspaceId: string | number, params?: { status?: string; type?: string }): Promise<Agreement[]> => {
    const { data } = await apiClient.get(`${BASE}/`, { params: { workspace_id: workspaceId, ...params } });
    return data;
  },
  get: async (workspaceId: string | number, id: string): Promise<Agreement> => {
    const { data } = await apiClient.get(`${BASE}/${id}/`, { params: { workspace_id: workspaceId } });
    return data;
  },
  createTemplate: async (workspaceId: string | number, payload: {
    title: string; type: string; signingOrder?: string; templateId?: string;
    expiryDate?: string; createdBy?: string; visibility?: string; signers?: SignerInput[];
  }): Promise<Agreement> => {
    const { data } = await apiClient.post(`${BASE}/template/`, { workspace_id: workspaceId, ...payload });
    return data;
  },
  uploadPdf: async (workspaceId: string | number, payload: {
    title: string; type: string; signingOrder?: string; fileName: string; fileSize: number;
    mimeType: string; expiryDate?: string; uploadedBy?: string; visibility?: string; signers?: SignerInput[];
  }): Promise<Agreement> => {
    const { data } = await apiClient.post(`${BASE}/upload/`, { workspace_id: workspaceId, ...payload });
    return data;
  },
  send: async (workspaceId: string | number, id: string): Promise<Agreement> => {
    const { data } = await apiClient.post(`${BASE}/${id}/send/`, { workspace_id: workspaceId });
    return data;
  },
  addSigner: async (workspaceId: string | number, id: string, signer: Partial<SignerInput>): Promise<AgreementSigner> => {
    const { data } = await apiClient.post(`${BASE}/${id}/signers/`, { workspace_id: workspaceId, ...signer });
    return data;
  },
  updateSigner: async (workspaceId: string | number, id: string, signerId: string, patch: Partial<SignerInput>): Promise<AgreementSigner> => {
    const { data } = await apiClient.patch(`${BASE}/${id}/signers/${signerId}/`, { workspace_id: workspaceId, ...patch });
    return data;
  },
  deleteSigner: async (workspaceId: string | number, id: string, signerId: string): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}/signers/${signerId}/`, { params: { workspace_id: workspaceId } });
  },
  audit: async (workspaceId: string | number, id: string): Promise<AgreementAuditEvent[]> => {
    const { data } = await apiClient.get(`${BASE}/${id}/audit/`, { params: { workspace_id: workspaceId } });
    return data;
  },
};

// ── Public signing (anonymous external signer, by token) ──────────────────────
function publicBase() {
  // resolveApiBase() returns the bare origin; agreements live under /api/v1.
  const origin = (resolveApiBase?.() || '').replace(/\/+$/, '');
  return `${origin}/api/v1/agreements`;
}

export const signingApi = {
  getByToken: async (token: string): Promise<{ agreement: Agreement; signerId: string }> => {
    const res = await fetch(`${publicBase()}/sign/${token}/`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Invalid signing link');
    return res.json();
  },
  sign: async (token: string, payload: {
    consentAccepted: boolean; typedSignature?: string; drawnSignature?: string | null;
    fieldValues?: { id: string; value: string }[];
  }): Promise<Agreement> => {
    const res = await fetch(`${publicBase()}/sign/${token}/submit/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Could not sign');
    return data;
  },
  decline: async (token: string, reason: string): Promise<Agreement> => {
    const res = await fetch(`${publicBase()}/sign/${token}/decline/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Could not decline');
    return data;
  },
};
