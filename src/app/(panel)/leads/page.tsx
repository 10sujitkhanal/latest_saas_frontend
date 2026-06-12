'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Upload, Download, Search, X, Users, Filter, Lock,
} from 'lucide-react';
import Topbar from '@/components/Topbar';
import { PageSpinner, PageError, EmptyState } from '@/components/StateViews';
import { OrganizationService, type Lead, type Workspace } from '@/services/organization.service';
import { useAuthStore, hasPermission } from '@/store/authStore';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
];

const statusClass: Record<string, string> = {
  new: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
  contacted: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
  qualified: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  won: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  lost: 'bg-red-500/10 text-red-300 border-red-500/20',
};

type FormState = {
  id?: number;
  workspace: number | '';
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  status: string;
};

const emptyForm: FormState = {
  workspace: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  status: 'new',
};

export default function LeadsPage() {
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const can = (code: string) => hasPermission(permissionCodes, code);

  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState<number | ''>('');
  const [editing, setEditing] = useState<FormState | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const params: { workspace?: number; status?: string; search?: string } = {};
      if (workspaceFilter) params.workspace = Number(workspaceFilter);
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const [leadsRes, wsRes] = await Promise.all([
        OrganizationService.listLeads(params),
        OrganizationService.listWorkspaces(),
      ]);
      if (!leadsRes.success) throw new Error(leadsRes.message || 'Failed to load leads.');
      setLeads(leadsRes.data ?? []);
      if (wsRes.success) setWorkspaces(wsRes.data ?? []);
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } }; message?: string };
      setError(v.response?.data?.message ?? v.message ?? 'Failed to load leads.');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, workspaceFilter]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const remove = async (lead: Lead) => {
    if (!can('crm.leads_delete')) return toast.error("You don't have permission to delete leads.");
    if (!confirm(`Delete lead "${lead.full_name}"?`)) return;
    setBusy('delete');
    try {
      await OrganizationService.deleteLead(lead.id);
      toast.success('Lead deleted.');
      await load();
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to delete.');
    } finally {
      setBusy(null);
    }
  };

  const exportNow = async () => {
    if (!can('crm.leads_export')) return toast.error("You don't have permission to export.");
    setBusy('export');
    try {
      const params = workspaceFilter ? { workspace: Number(workspaceFilter) } : undefined;
      await OrganizationService.exportLeads(params);
      toast.success('Export started.');
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Failed to export.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Topbar
        title="Leads"
        subtitle="Create, edit, import or export leads across your workspaces."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => (can('crm.leads_export') ? setShowExport(true) : toast.error("You don't have permission to export."))}
              disabled={!can('crm.leads_export') || busy !== null}
              title={can('crm.leads_export') ? 'Export CSV (with filters)' : "You don't have permission to export"}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              onClick={() => can('crm.leads_import') && setShowImport(true)}
              disabled={!can('crm.leads_import')}
              title={can('crm.leads_import') ? 'Bulk CSV import' : "You don't have permission to import"}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-slate-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={() => can('crm.leads_add') && setEditing({ ...emptyForm })}
              disabled={!can('crm.leads_add')}
              title={can('crm.leads_add') ? 'Create new lead' : "You don't have permission to create"}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              New lead
            </button>
          </div>
        }
      />

      <main className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto">
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 mb-4 flex flex-col md:flex-row md:items-center gap-3">
          <form onSubmit={onSearchSubmit} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-white/5 flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, email, phone…"
                className="bg-transparent flex-1 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
              />
              {search && (
                <button type="button" onClick={() => { setSearch(''); load(); }} className="text-slate-500 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button type="submit" className="hidden">Search</button>
          </form>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={workspaceFilter}
              onChange={(e) => setWorkspaceFilter(e.target.value ? Number(e.target.value) : '')}
              className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All workspaces</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-800 border border-white/5 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {leads === null && !error && <PageSpinner />}
        {error && <PageError message={error} onRetry={load} />}
        {leads && leads.length === 0 && !error && (
          <EmptyState
            title="No leads yet"
            description="Create a lead manually or import a CSV to get started."
            action={
              can('crm.leads_add') && (
                <button
                  onClick={() => setEditing({ ...emptyForm })}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                >
                  <Plus className="w-4 h-4" /> Create lead
                </button>
              )
            }
          />
        )}

        {leads && leads.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Workspace</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Contact</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium hidden xl:table-cell">Assignee</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3">
                      <div className="text-white font-medium">{l.full_name || '—'}</div>
                      <div className="text-[11px] text-slate-500">#{l.id}</div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-slate-300">{l.workspace_name}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <div className="text-slate-200 text-sm">{l.email ?? '—'}</div>
                      {l.phone && <div className="text-[11px] text-slate-500">{l.phone}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full border ${statusClass[l.status] ?? 'bg-slate-500/10 text-slate-300 border-slate-500/20'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 hidden xl:table-cell text-slate-400 text-xs">
                      {l.assigned_to_email ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => can('crm.leads_edit') && setEditing({
                          id: l.id,
                          workspace: l.workspace,
                          first_name: l.first_name,
                          last_name: l.last_name,
                          email: l.email ?? '',
                          phone: l.phone ?? '',
                          status: l.status,
                        })}
                        disabled={!can('crm.leads_edit')}
                        title={can('crm.leads_edit') ? 'Edit' : "You don't have permission to edit"}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(l)}
                        disabled={!can('crm.leads_delete') || busy === 'delete'}
                        title={can('crm.leads_delete') ? 'Delete' : "You don't have permission to delete"}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && (
        <LeadModal
          editable={editing}
          workspaces={workspaces}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={async () => {
            setShowImport(false);
            await load();
          }}
        />
      )}

      {showExport && (
        <ExportModal
          initial={{ status: statusFilter, search, workspace: workspaceFilter === '' ? undefined : Number(workspaceFilter) }}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
}

const EXPORT_FIELDS = [
  'id', 'workspace_id', 'workspace_name', 'first_name', 'last_name',
  'email', 'phone', 'status', 'source', 'assigned_to_id', 'assigned_to_email',
  'created_at', 'updated_at',
];

function ExportModal({
  initial, onClose,
}: {
  initial: { status?: string; search?: string; workspace?: number };
  onClose: () => void;
}) {
  const [status, setStatus] = useState(initial.status || '');
  const [search, setSearch] = useState(initial.search || '');
  const [source, setSource] = useState('');
  const [limit, setLimit] = useState<string>('');
  const [page, setPage] = useState<string>('1');
  const [fields, setFields] = useState<string[]>([...EXPORT_FIELDS]);
  const [busy, setBusy] = useState(false);

  const toggle = (f: string) =>
    setFields((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  const run = async () => {
    setBusy(true);
    try {
      const params: Record<string, unknown> = {};
      if (initial.workspace) params.workspace = initial.workspace;
      if (status) params.status = status;
      if (search.trim()) params.search = search.trim();
      if (source.trim()) params.source = source.trim();
      if (limit && Number(limit) > 0) { params.limit = Number(limit); params.page = Math.max(1, Number(page) || 1); }
      if (fields.length && fields.length !== EXPORT_FIELDS.length) params.fields = fields.join(',');
      await OrganizationService.exportLeads(params);
      toast.success('Export downloaded.');
      onClose();
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      toast.error(v.response?.data?.message ?? 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">Export leads to CSV</h2>
            <p className="text-sm text-slate-400 mt-1">Filter, page, and pick exactly the columns you want.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={expInput}>
                <option value="">All</option>
                {['new', 'contacted', 'qualified', 'won', 'lost'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Source (name)</span>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Website" className={expInput} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Rows (latest first)</span>
              <input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="All" className={expInput} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Page</span>
              <input type="number" min={1} value={page} onChange={(e) => setPage(e.target.value)} disabled={!limit} className={expInput} />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Search (name / email / phone)</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)} className={expInput} />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Columns</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {EXPORT_FIELDS.map((f) => (
                <label key={f} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <input type="checkbox" checked={fields.includes(f)} onChange={() => toggle(f)} className="accent-emerald-500" />
                  {f}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-6 border-t border-white/5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="button" onClick={run} disabled={busy || fields.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold disabled:opacity-50">
            <Download className="w-4 h-4" /> {busy ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}

const expInput = 'w-full rounded-lg bg-slate-800 border border-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40';

function LeadModal({
  editable,
  workspaces,
  onClose,
  onSaved,
}: {
  editable: FormState;
  workspaces: Workspace[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(editable);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isEditing = form.id != null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.workspace) return setError('Workspace is required.');
    if (!form.first_name.trim()) return setError('First name is required.');
    setBusy(true);
    try {
      const payload = {
        workspace: Number(form.workspace),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        status: form.status,
      };
      const res = isEditing
        ? await OrganizationService.updateLead(form.id!, payload)
        : await OrganizationService.createLead(payload);
      if (res?.success) {
        toast.success(isEditing ? 'Lead updated.' : 'Lead created.');
        await onSaved();
      } else {
        setError(res?.message || 'Failed to save lead.');
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string } } };
      setError(v.response?.data?.message ?? 'Failed to save lead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit lead' : 'New lead'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {isEditing ? 'Update this lead\'s details.' : 'Capture a new lead in any workspace.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Workspace *</label>
            <select
              value={form.workspace}
              onChange={(e) => setForm({ ...form, workspace: e.target.value ? Number(e.target.value) : '' })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            >
              <option value="">Select a workspace…</option>
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">First name *</label>
              <input
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Last name</label>
              <input
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Phone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
          >
            {busy ? 'Saving…' : isEditing ? 'Save changes' : 'Create lead'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: Array<{row: number; error: string}> } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) return setError('Choose a CSV file first.');
    setBusy(true);
    try {
      const res = await OrganizationService.importLeads(file);
      if (res?.success) {
        toast.success(res.message || 'Imported.');
        setResult(res.data);
        if (!res.data?.skipped) {
          // close on a fully-clean import
          await onImported();
        }
      } else {
        setError(res?.message || 'Import failed.');
        if (res?.data?.errors) setResult(res.data);
      }
    } catch (err) {
      const v = err as { response?: { data?: { message?: string; data?: { errors?: Array<{row: number; error: string}> } } } };
      setError(v.response?.data?.message ?? 'Import failed.');
      const ed = v.response?.data?.data?.errors;
      if (ed) setResult({ imported: 0, skipped: ed.length, errors: ed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div>
            <h2 className="text-lg font-semibold text-white">Import leads from CSV</h2>
            <p className="text-sm text-slate-400 mt-1">
              Required columns: <code className="text-emerald-300 font-mono">workspace_id</code>,{' '}
              <code className="text-emerald-300 font-mono">first_name</code>.
              Optional: last_name, email, phone, status, assigned_to_id.
            </p>
            <button
              type="button"
              onClick={async () => {
                try { await OrganizationService.downloadImportTemplate(); }
                catch { toast.error('Could not download the sample.'); }
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 hover:underline"
            >
              ↓ Download sample CSV (with example rows)
            </button>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label
            htmlFor="lead-csv"
            className="flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed border-white/10 hover:border-emerald-500/40 cursor-pointer transition-colors text-slate-400 hover:text-emerald-300"
          >
            <Upload className="w-6 h-6" />
            <span className="text-sm font-medium">
              {file ? file.name : 'Click to choose a CSV file'}
            </span>
            {file && <span className="text-[11px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>}
            <input
              id="lead-csv"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/[0.06] px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
              <div className="text-sm text-slate-200">
                Imported <span className="text-emerald-300 font-semibold">{result.imported}</span>
                {' · '}
                Skipped <span className="text-amber-300 font-semibold">{result.skipped}</span>
              </div>
              {result.errors.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 text-xs">
                  {result.errors.slice(0, 20).map((e, i) => (
                    <li key={i} className="text-amber-200">Row {e.row}: {e.error}</li>
                  ))}
                  {result.errors.length > 20 && (
                    <li className="text-slate-500">…and {result.errors.length - 20} more</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5">
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="submit"
              disabled={busy || !file}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
            >
              {busy ? 'Uploading…' : 'Import'}
            </button>
          )}
          {result && result.imported > 0 && result.skipped > 0 && (
            <button
              type="button"
              onClick={onImported}
              className="px-4 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              Done
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
