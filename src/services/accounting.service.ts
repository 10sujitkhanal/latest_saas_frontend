import { apiClient } from '@/lib/axios';

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface AccountRow {
  id: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  subtype?: string;
  parent?: number | null;
  parent_code?: string;
  description?: string;
  opening_balance: string;
  currency: string;
  is_system?: boolean;
  is_active: boolean;
}

export interface CustomerRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  tax_id: string;
  currency: string;
  payment_terms: string;
  credit_limit?: string | null;
  opening_balance?: string;
  is_active: boolean;
}

export interface VendorRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  address?: string;
  tax_id: string;
  currency: string;
  payment_terms: string;
  opening_balance?: string;
  is_active: boolean;
}

export interface BankAccountRow {
  id: number;
  name: string;
  bank_name: string;
  account_number: string;
  account_type: 'checking' | 'savings' | 'cash' | 'credit_card' | 'other';
  currency: string;
  opening_balance: string;
  current_balance: string;
  is_active: boolean;
}
export interface BankTransactionRow {
  id: number;
  bank_account: number;
  bank_account_name: string;
  date: string;
  description: string;
  direction: 'in' | 'out';
  amount: string;
  balance_after: string;
  reference: string;
  is_reconciled: boolean;
}

export interface RecurringRow {
  id: number;
  doc_type: 'invoice' | 'bill';
  customer?: number | null;
  customer_name: string;
  vendor?: number | null;
  vendor_name: string;
  description: string;
  amount: string;
  currency: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  next_run_date: string;
  last_run_date?: string | null;
  generated_count: number;
  is_active: boolean;
}

export interface FixedAssetRow {
  id: number;
  name: string;
  category: string;
  purchase_date: string;
  purchase_cost: string;
  salvage_value: string;
  useful_life_years: string;
  accumulated_depreciation: string;
  book_value: string;
  annual_depreciation: string;
  monthly_depreciation: string;
  status: 'active' | 'fully_depreciated' | 'disposed';
  disposal_date?: string | null;
  disposal_amount?: string | null;
  currency: string;
}

export interface CreditNoteRow {
  id: number;
  note_no: string;
  customer: number;
  customer_name: string;
  invoice?: number | null;
  invoice_no?: string;
  issue_date: string;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  reason: string;
  amount: string;
  currency: string;
}
export interface DebitNoteRow {
  id: number;
  note_no: string;
  vendor: number;
  vendor_name: string;
  bill?: number | null;
  bill_no?: string;
  issue_date: string;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  reason: string;
  amount: string;
  currency: string;
}

export interface TaxRateRow {
  id: number;
  name: string;
  rate: string;
  tax_type: 'vat' | 'gst' | 'sales' | 'withholding' | 'other';
  is_default: boolean;
  is_active: boolean;
  description?: string;
}

export interface FiscalYearRow {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'future' | 'active' | 'closed';
  closed_at?: string | null;
}

export interface PeriodRow {
  id: number;
  fiscal_year: number;
  fiscal_year_name: string;
  name: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  locked_at?: string | null;
  locked_by_email?: string;
}

export interface JournalEntryLineRow {
  id?: number;
  account: number;
  account_code?: string;
  account_name?: string;
  description?: string;
  debit: string | number;
  credit: string | number;
}

export interface JournalEntryRow {
  id: number;
  entry_no: string;
  date: string;
  reference?: string;
  description: string;
  status: 'draft' | 'posted' | 'void';
  total_debit: string;
  total_credit: string;
  posted_at?: string | null;
}

export interface JournalEntryDetail extends JournalEntryRow {
  lines: JournalEntryLineRow[];
}

export interface InvoiceLineRow {
  id?: number;
  account?: number | null;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  discount_amount?: string | number;
  tax_amount?: string | number;
  total?: string;
}

export interface InvoiceRow {
  id: number;
  invoice_no: string;
  customer: number;
  customer_name: string;
  issue_date: string;
  due_date: string;
  status: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  currency: string;
}

export interface InvoiceDetail extends InvoiceRow {
  subtotal: string;
  discount_total: string;
  tax_total: string;
  terms?: string;
  notes?: string;
  posted_journal?: number | null;
  posted_journal_no?: string;
  lines: InvoiceLineRow[];
}

export interface BillRow {
  id: number;
  bill_no: string;
  vendor: number;
  vendor_name: string;
  bill_date: string;
  due_date: string;
  status: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  currency: string;
}

export interface BillDetail extends BillRow {
  vendor_reference?: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  notes?: string;
  posted_journal?: number | null;
  posted_journal_no?: string;
  lines: InvoiceLineRow[];
}

export interface PaymentRow {
  id: number;
  payment_no: string;
  type: 'received' | 'made';
  customer?: number | null;
  vendor?: number | null;
  invoice?: number | null;
  bill?: number | null;
  date: string;
  amount: string;
  currency: string;
  method: string;
  reference?: string;
  status: string;
  customer_name?: string;
  vendor_name?: string;
  invoice_no?: string;
  bill_no?: string;
}

export interface AuditEventRow {
  id: number;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  message: string;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface TrialBalanceRow {
  account_id: number;
  code: string;
  name: string;
  type: string;
  debit: string;
  credit: string;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  total_debit: string;
  total_credit: string;
  is_balanced: boolean;
}

export interface GeneralLedgerRow {
  id: number;
  date: string;
  journal_id: number;
  journal_no: string;
  reference: string;
  description: string;
  account_id: number;
  account_code: string;
  account_name: string;
  debit: string;
  credit: string;
}

export interface GeneralLedgerReport {
  rows: GeneralLedgerRow[];
}

export interface ProfitLossReport {
  rows: Array<{ account_id: number; code: string; name: string; type: string; amount: string }>;
  income: string;
  expenses: string;
  net_profit: string;
}

export interface AgingRow {
  id: number;
  number: string;
  party: string;
  due_date: string;
  days_overdue: number;
  amount_due: string;
  bucket: string;
}
export interface AgingReport {
  rows: AgingRow[];
  buckets: { current: string; d1_30: string; d31_60: string; d61_90: string; d90_plus: string };
  total: string;
}

export interface CashFlowReport {
  cash_position: string;
  total_in: string;
  total_out: string;
  net_change: string;
  months: Array<{ month: string; in: string; out: string; net: string }>;
}

export interface OrgBranding {
  name: string;
  logo_url: string;
  brand_color: string;
  address: string;
  contact_email: string;
  phone: string;
}

export interface BalanceSheetLine { account_id: number; code: string; name: string; amount: string }
export interface BalanceSheetReport {
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  net_income: string;
  total_assets: string;
  total_liabilities: string;
  total_equity: string;
  is_balanced: boolean;
}

type Params = Record<string, unknown>;
type Payload = Record<string, unknown>;
type Id = string | number;

function base(workspaceId: Id) {
  return `/organization/accounting/workspaces/${workspaceId}`;
}

async function httpGet<T>(url: string, params?: Params) {
  const { data } = await apiClient.get<ApiEnvelope<T>>(url, { params });
  return data;
}
async function httpPost<T>(url: string, payload: Payload = {}) {
  const { data } = await apiClient.post<ApiEnvelope<T>>(url, payload);
  return data;
}
async function httpPatch<T>(url: string, payload: Payload) {
  const { data } = await apiClient.patch<ApiEnvelope<T>>(url, payload);
  return data;
}
async function httpDelete<T>(url: string) {
  const { data } = await apiClient.delete<ApiEnvelope<T>>(url);
  return data;
}

/**
 * Standard workspace-scoped CRUD for an accounting resource. Returns the raw
 * API envelope ({ success, data, ... }) so callers can surface server messages
 * and field errors directly — no mock fallback.
 */
function crud<TRow, TDetail = TRow>(resource: string) {
  return {
    list: (workspaceId: Id, params?: Params) =>
      httpGet<TRow[]>(`${base(workspaceId)}/${resource}/`, params),
    get: (workspaceId: Id, id: Id) =>
      httpGet<TDetail>(`${base(workspaceId)}/${resource}/${id}/`),
    create: (workspaceId: Id, payload: Payload) =>
      httpPost<TDetail>(`${base(workspaceId)}/${resource}/`, payload),
    update: (workspaceId: Id, id: Id, payload: Payload) =>
      httpPatch<TDetail>(`${base(workspaceId)}/${resource}/${id}/`, payload),
    remove: (workspaceId: Id, id: Id) =>
      httpDelete<null>(`${base(workspaceId)}/${resource}/${id}/`),
  };
}

const accounts = crud<AccountRow>('accounts');
const customers = crud<CustomerRow>('customers');
const vendors = crud<VendorRow>('vendors');
const taxRates = crud<TaxRateRow>('tax-rates');
const creditNotes = crud<CreditNoteRow>('credit-notes');
const debitNotes = crud<DebitNoteRow>('debit-notes');
const bankAccounts = crud<BankAccountRow>('bank-accounts');
const fixedAssets = crud<FixedAssetRow>('fixed-assets');
const recurring = crud<RecurringRow>('recurring');
const fiscalYears = crud<FiscalYearRow>('fiscal-years');
const periods = crud<PeriodRow>('periods');
const journalEntries = crud<JournalEntryRow, JournalEntryDetail>('journal-entries');
const invoices = crud<InvoiceRow, InvoiceDetail>('invoices');
const bills = crud<BillRow, BillDetail>('bills');
const payments = crud<PaymentRow>('payments');

export interface InvoiceSettings {
  invoice_prefix: string;
  invoice_number_format: string;
  invoice_number_pad: number;
  invoice_footer: string;
  invoice_template: string;
  preview: string;
}
const invoiceSettings = {
  get: (workspaceId: Id) => httpGet<InvoiceSettings>(`${base(workspaceId)}/invoice-settings/`),
  save: (workspaceId: Id, payload: Partial<InvoiceSettings>) =>
    apiClient.put<ApiEnvelope<InvoiceSettings>>(`${base(workspaceId)}/invoice-settings/`, payload).then((r) => r.data),
};

export const AccountingService = {
  // Resource CRUD namespaces (list/get/create/update/remove).
  invoiceSettings,
  accounts,
  customers,
  vendors,
  taxRates,
  creditNotes,
  debitNotes,
  bankAccounts,
  fixedAssets,
  recurring,
  fiscalYears,
  periods,
  journalEntries,
  invoices,
  bills,
  payments,

  // Workflow actions.
  postJournalEntry: (workspaceId: Id, id: Id) =>
    httpPost<JournalEntryDetail>(`${base(workspaceId)}/journal-entries/${id}/post/`),
  setPeriodLock: (workspaceId: Id, id: Id, isLocked: boolean) =>
    httpPost<PeriodRow>(`${base(workspaceId)}/periods/${id}/lock/`, { is_locked: isLocked }),
  sendInvoice: (workspaceId: Id, id: Id) =>
    httpPost<InvoiceDetail>(`${base(workspaceId)}/invoices/${id}/send/`),
  remindInvoice: (workspaceId: Id, id: Id) =>
    httpPost<InvoiceDetail>(`${base(workspaceId)}/invoices/${id}/remind/`),
  voidInvoice: (workspaceId: Id, id: Id) =>
    httpPost<InvoiceDetail>(`${base(workspaceId)}/invoices/${id}/void/`),
  voidBill: (workspaceId: Id, id: Id) =>
    httpPost<BillDetail>(`${base(workspaceId)}/bills/${id}/void/`),
  branding: (workspaceId: Id) =>
    httpGet<OrgBranding>(`${base(workspaceId)}/branding/`),
  issueCreditNote: (workspaceId: Id, id: Id) => httpPost<CreditNoteRow>(`${base(workspaceId)}/credit-notes/${id}/issue/`),
  voidCreditNote: (workspaceId: Id, id: Id) => httpPost<CreditNoteRow>(`${base(workspaceId)}/credit-notes/${id}/void/`),
  issueDebitNote: (workspaceId: Id, id: Id) => httpPost<DebitNoteRow>(`${base(workspaceId)}/debit-notes/${id}/issue/`),
  voidDebitNote: (workspaceId: Id, id: Id) => httpPost<DebitNoteRow>(`${base(workspaceId)}/debit-notes/${id}/void/`),
  listBankTransactions: (workspaceId: Id, params?: Params) => httpGet<BankTransactionRow[]>(`${base(workspaceId)}/bank-transactions/`, params),
  createBankTransaction: (workspaceId: Id, payload: Payload) => httpPost<BankTransactionRow>(`${base(workspaceId)}/bank-transactions/`, payload),
  reconcileBankTransaction: (workspaceId: Id, id: Id) => httpPost<BankTransactionRow>(`${base(workspaceId)}/bank-transactions/${id}/reconcile/`),
  depreciateAsset: (workspaceId: Id, id: Id, periods = 1) => httpPost<FixedAssetRow>(`${base(workspaceId)}/fixed-assets/${id}/depreciate/`, { periods }),
  disposeAsset: (workspaceId: Id, id: Id, payload: Payload) => httpPost<FixedAssetRow>(`${base(workspaceId)}/fixed-assets/${id}/dispose/`, payload),
  generateRecurring: (workspaceId: Id, id: Id) => httpPost<RecurringRow>(`${base(workspaceId)}/recurring/${id}/generate/`),

  // Audit + reports.
  listAudit: (workspaceId: Id, params?: Params) =>
    httpGet<AuditEventRow[]>(`${base(workspaceId)}/audit/`, params),
  trialBalance: (workspaceId: Id, params?: Params) =>
    httpGet<TrialBalanceReport>(`${base(workspaceId)}/reports/trial-balance/`, params),
  generalLedger: (workspaceId: Id, params?: Params) =>
    httpGet<GeneralLedgerReport>(`${base(workspaceId)}/reports/general-ledger/`, params),
  profitLoss: (workspaceId: Id, params?: Params) =>
    httpGet<ProfitLossReport>(`${base(workspaceId)}/reports/profit-loss/`, params),
  balanceSheet: (workspaceId: Id, params?: Params) =>
    httpGet<BalanceSheetReport>(`${base(workspaceId)}/reports/balance-sheet/`, params),
  arAging: (workspaceId: Id, params?: Params) =>
    httpGet<AgingReport>(`${base(workspaceId)}/reports/ar-aging/`, params),
  apAging: (workspaceId: Id, params?: Params) =>
    httpGet<AgingReport>(`${base(workspaceId)}/reports/ap-aging/`, params),
  cashFlow: (workspaceId: Id, params?: Params) =>
    httpGet<CashFlowReport>(`${base(workspaceId)}/reports/cash-flow/`, params),

  // ── Backward-compatible flat aliases (used by the existing overview page) ──
  listAccounts: (workspaceId: Id, params?: Params) => accounts.list(workspaceId, params),
  listJournalEntries: (workspaceId: Id, params?: Params) => journalEntries.list(workspaceId, params),
  listInvoices: (workspaceId: Id, params?: Params) => invoices.list(workspaceId, params),
  listBills: (workspaceId: Id, params?: Params) => bills.list(workspaceId, params),
  listPayments: (workspaceId: Id, params?: Params) => payments.list(workspaceId, params),
};
