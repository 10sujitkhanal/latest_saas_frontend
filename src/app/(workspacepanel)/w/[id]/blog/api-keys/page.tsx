'use client';

import { useCallback, useEffect, useState, use as reactUse } from 'react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { PageSkeleton } from '@/components/workspace/Skeleton';
import { BlogService, type APIKeyRow } from '@/services/blog.service';
import { resolveApiV1Base } from '@/lib/apiBase';
import { Plus, Trash2, Copy, Check, KeyRound, Code2, Terminal } from 'lucide-react';
import { toast } from 'sonner';

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
  const [err, setErr] = useState<string | null>(null);

  // API base for the developer docs (e.g. https://acme.api.morefungi.com/api/v1)
  const [apiBase, setApiBase] = useState('/api/v1');
  useEffect(() => { try { setApiBase(resolveApiV1Base()); } catch { /* ssr */ } }, []);
  const sampleKey = created || 'mk_your_api_key';

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

  const curl = `curl ${apiBase}/blog/posts/ \\\n  -H "Authorization: Api-Key ${sampleKey}"`;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Blog API &amp; keys</h1>
          <p className="text-sm text-slate-500">Give developers read access to your blog — power a headless site, app, or static build.</p>
        </div>
        <button onClick={() => { setOpen(true); setCreated(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"><Plus className="h-4 w-4" /> New key</button>
      </div>

      {created && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-500/15 p-4">
          <p className="text-sm font-semibold text-emerald-800">Copy your key now — it won&apos;t be shown again.</p>
          <CopyField className="mt-2" value={created} />
        </div>
      )}

      {/* ── Developer integration kit (same idea as the leads Intake API) ── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <p className="flex items-center gap-1.5 font-semibold text-white"><Code2 className="h-4 w-4 text-emerald-500" /> Developer integration</p>
        <p className="mt-0.5 text-sm text-slate-500">Authenticate with <code className="rounded bg-white/[0.06] px-1 text-[12px]">Authorization: Api-Key &lt;key&gt;</code> (or the <code className="rounded bg-white/[0.06] px-1 text-[12px]">X-API-Key</code> header).</p>

        <div className="mt-3 space-y-3">
          <CopyField label="Endpoint — list posts" value={`${apiBase}/blog/posts/`} />
          <CopyField label="Endpoint — single post" value={`${apiBase}/blog/posts/{slug}/`} />
          <CopyField label="curl example" mono icon={<Terminal className="h-3 w-3" />} value={curl} hint="Run it in a terminal to test your key." />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.03]/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Scopes</p>
            <ul className="mt-1 space-y-0.5 text-[12px] text-slate-300">
              <li><code className="text-emerald-600">blog:read</code> — read posts &amp; taxonomy</li>
              <li><code className="text-emerald-600">blog:write</code> — create/update posts</li>
              <li><code className="text-emerald-600">seo:read</code> — read SEO/AEO audit</li>
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03]/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">No-key public read</p>
            <p className="mt-1 text-[12px] text-slate-300">Published posts are also readable without a key for SSR/SEO:</p>
            <code className="mt-1 block break-all text-[11px] text-slate-500">/api/v1/public/blog/&lt;schema&gt;/posts/</code>
          </div>
        </div>
      </section>

      {open && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 font-semibold text-white">Create API key</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. Headless site)" className="mb-3 w-full rounded-lg border border-white/10 px-3 py-2 text-sm outline-none focus:border-emerald-400" />
          <p className="mb-1 text-xs font-medium text-slate-500">Scopes</p>
          <div className="mb-3 flex flex-wrap gap-3">
            {scopes.map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm text-slate-200">
                <input type="checkbox" checked={picked.includes(s)} onChange={(e) => setPicked((p) => e.target.checked ? [...p, s] : p.filter((x) => x !== s))} className="h-4 w-4 accent-emerald-500" /> <code className="text-[12px]">{s}</code>
              </label>
            ))}
          </div>
          {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.03]">Cancel</button>
            <button onClick={create} className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500">Create</button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs text-slate-500"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Key</th><th className="px-4 py-2">Scopes</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Actions</th></tr></thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className="border-t border-white/5">
                <td className="px-4 py-2 font-medium text-white">{k.name}</td>
                <td className="px-4 py-2"><code className="text-[12px] text-slate-500">{k.prefix}…</code></td>
                <td className="px-4 py-2 text-[12px] text-slate-500">{k.scopes.join(', ')}</td>
                <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${k.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-500'}`}>{k.is_active ? 'active' : 'revoked'}</span></td>
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

function CopyField({ label, value, hint, mono, icon, className }: { label?: string; value: string; hint?: string; mono?: boolean; icon?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); toast.success(`${label || 'Value'} copied`); }
    catch { toast.error('Copy failed — select and copy manually.'); }
  };
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{icon}{label}</span>
          <button onClick={copy} type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copy</button>
        </div>
      )}
      <div className="flex items-start gap-2">
        <pre className={`flex-1 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-slate-200 ${mono ? 'font-mono text-[11px] whitespace-pre' : 'text-[13px] break-all'}`}>{value}</pre>
        {!label && <button onClick={copy} type="button" className="shrink-0 rounded-lg border border-emerald-300 px-2.5 py-2 text-emerald-300 hover:bg-emerald-500/15">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>}
      </div>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
