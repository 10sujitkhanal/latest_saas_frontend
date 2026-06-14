'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { BlogService, type APIKeyRow } from '@/services/blog.service';
import { Plus, Trash2, Copy, Check, KeyRound } from 'lucide-react';

export default function APIKeysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="content" required="blog.edit" workspaceId={wsId} skeleton="list">
      <Inner wsId={wsId} />
    </PermissionGuard>
  );
}

function Inner({ wsId }: { wsId: string }) {
  const [keys, setKeys] = useState<APIKeyRow[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>(['blog:read']);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await BlogService.apiKeys.list(wsId);
      if (r.success) { setKeys(r.data.keys); setScopes(r.data.available_scopes); }
    } finally { setLoading(false); }
  }, [wsId]);
  useEffect(() => { reload(); }, [reload]);

  const create = async () => {
    setErr(null);
    if (!name.trim()) { setErr('Give the key a name.'); return; }
    if (picked.length === 0) { setErr('Pick at least one scope.'); return; }
    const r = await BlogService.apiKeys.create(wsId, name.trim(), picked);
    if (!r.success) { setErr(r.message || 'Could not create key.'); return; }
    setCreated(r.data.key || null);
    setOpen(false); setName(''); setPicked(['blog:read']);
    reload();
  };

  const revoke = async (k: APIKeyRow) => {
    if (!confirm(`Revoke "${k.name}"? Apps using it will stop working.`)) return;
    await BlogService.apiKeys.revoke(wsId, k.id); reload();
  };

  if (loading) return <PageSkeleton kind="list" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-slate-900">API Keys</h1><p className="text-sm text-slate-500">External access to this workspace&apos;s blog &amp; SEO data.</p></div>
        <button onClick={() => { setOpen(true); setCreated(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> New key</button>
      </div>

      {created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">Copy your key now — it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2 text-[13px] text-slate-800">{created}</code>
            <button onClick={() => { navigator.clipboard.writeText(created); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 font-semibold text-slate-900">Create API key</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Headless site)" className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          <p className="mb-1 text-xs font-medium text-slate-500">Scopes</p>
          <div className="mb-3 flex flex-wrap gap-3">
            {scopes.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" checked={picked.includes(s)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, s] : p.filter((x) => x !== s))} className="h-4 w-4 accent-emerald-500" /> <code className="text-[12px]">{s}</code>
              </label>
            ))}
          </div>
          {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={create} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">Create</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Key</th><th className="px-4 py-2">Scopes</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">{k.name}</td>
                <td className="px-4 py-2"><code className="text-[12px] text-slate-500">{k.prefix}…</code></td>
                <td className="px-4 py-2 text-[12px] text-slate-500">{k.scopes.join(', ')}</td>
                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${k.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{k.is_active ? 'active' : 'revoked'}</span></td>
                <td className="px-4 py-2 text-right">{k.is_active && <button onClick={() => revoke(k)} className="text-red-400 hover:text-red-600"><Trash2 className="inline h-3.5 w-3.5" /></button>}</td>
              </tr>
            ))}
            {keys.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400"><KeyRound className="mx-auto mb-2 h-6 w-6 text-slate-300" />No API keys yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
