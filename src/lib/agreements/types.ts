// Agreement e-signature types (ported from source; tenantId -> workspaceId).
export type AgreementSourceType = "template" | "pdf_upload";
export type AgreementStatus = "draft" | "pending_internal" | "sent" | "partially_signed" | "completed" | "declined" | "cancelled" | "expired";
export type AgreementType = "service" | "sales" | "nda" | "employment" | "partnership" | "custom";
export type AgreementDocumentType = "original" | "uploaded" | "final" | "audit_certificate";
export type AgreementSignerRole = "owner" | "company" | "employee" | "supplier" | "retailer" | "customer" | "partner" | "witness" | "other";
export type AgreementSignerStatus = "pending" | "sent" | "signed" | "declined";
export type AgreementPartySide = "internal" | "external";
export type AgreementAuthMethod = "typed" | "drawn" | "email_otp" | "bankid";
export type AgreementSigningOrder = "parallel" | "sequential";
export type SignatureFieldType = "signature" | "initials" | "date" | "text" | "checkbox";

export interface SignatureField {
  id: string;
  agreementId: string;
  signerId: string | null;
  fieldType: SignatureFieldType;
  page: number;
  x: number; y: number; w: number; h: number;
  required: boolean;
  value: string;
  label: string;
}

export interface AgreementSigner {
  id: string;
  agreementId: string;
  role: AgreementSignerRole;
  partySide: AgreementPartySide;
  orderIndex: number;
  name: string;
  email: string;
  status: AgreementSignerStatus;
  authMethod: AgreementAuthMethod;
  signedAt: string | null;
  declinedAt: string | null;
  declineReason: string;
  typedSignature: string | null;
  drawnSignature: string | null;
  identityName: string;
  identityNumber: string;
  otpVerified: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  signingToken: string;
  fields: SignatureField[];
}

export interface AgreementDocument {
  id: string;
  workspaceId: string;
  agreementId: string;
  documentType: AgreementDocumentType;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
}

export interface AgreementAuditEvent {
  id: string;
  agreementId: string;
  actorName: string;
  action: string;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface Agreement {
  id: string;
  workspaceId: string;
  title: string;
  type: AgreementType;
  status: AgreementStatus;
  signingOrder: AgreementSigningOrder;
  visibility: 'team' | 'private';
  sourceType: AgreementSourceType;
  templateId: string | null;
  originalPdfUrl: string | null;
  uploadedPdfFilename: string | null;
  uploadedPdfSize: number | null;
  uploadedPdfMimeType: string | null;
  finalPdfUrl: string | null;
  bodyText?: string;
  // Commercial terms (agency↔client contracts)
  billingModel?: 'none' | 'retainer' | 'commission' | 'hybrid' | 'performance';
  monthlyFee?: string | null;
  setupFee?: string | null;
  commissionPct?: string | null;
  perLeadFee?: string | null;
  durationMonths?: number | null;
  sla?: string;
  deliverables?: string;
  currency?: string;
  commissionRules?: { id: string; basis: string; rate: string; label?: string }[];
  expiryDate: string;
  createdBy: string;
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  signers: AgreementSigner[];
  fields: SignatureField[];
}

export interface SignerInput {
  role: AgreementSignerRole;
  name: string;
  email: string;
  partySide: AgreementPartySide;
  orderIndex: number;
  authMethod?: AgreementAuthMethod;
}

export const STATUS_LABEL: Record<AgreementStatus, string> = {
  draft: "Draft", pending_internal: "Pending internal", sent: "Sent",
  partially_signed: "Partially signed", completed: "Completed",
  declined: "Declined", cancelled: "Cancelled", expired: "Expired",
};
