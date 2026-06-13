'use client';

/**
 * Message templates — Phase A.2 of the world-class CRM.
 *
 * Reusable email/SMS/WhatsApp templates with {{placeholders}} (first_name,
 * company, business_name, my_name, …). Two exports:
 *   • MessageTemplatesManager — create / edit / delete templates.
 *   • TemplatePicker — a dropdown that renders a template for a lead and hands
 *     the filled { subject, body } back to the composer.
 */

import { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Pencil, Loader2, FileText, ChevronDown, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';

export interface MessageTemplate {
  id: number;
  name: string;
  channel: 'any' | 'email' | 'sms' | 'whatsapp';
  category: string;
  subject: string;
  body: string;
  is_active: boolean;
}
interface TemplateVariable { key: string; label: string }

const CHANNELS: [MessageTemplate['channel'], string][] = [
  ['any', 'Any channel'], ['email', 'Email'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp'],
];
const dk = 'w-full rounded-lg bg-slate-800 border border-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40';

type FormState = { id?: number; name: string; channel: MessageTemplate['channel']; category: string; subject: string; body: string };
const EMPTY: FormState = { name: '', channel: 'any', category: '', subject: '', body: '' };

// ── Manager: list / create / edit / delete ───────────────────────────────
export function MessageTemplatesManager({ workspaceId, onClose, onChanged }: {
  workspaceId?: number | string; onClose: () => void; onChanged?: () => void;
}) {
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [vars, setVars] = useState<TemplateVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = async () => {
    try {
      const r = await OrganizationService.listMessageTemplates({ workspace: workspaceId });
      if (r.success) { setItems(r.data?.templates || []); setVars(r.data?.variables || []); }
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const insertVar = (key: string) => {
    const token = `{{${key}}}`;
    const ta = bodyRef.current;
    if (ta && document.activeElement === ta) {
      const s = ta.selectionStart ?? form.body.length;
      const e = ta.selectionEnd ?? form.body.length;
      const next = form.body.slice(0, s) + token + form.body.slice(e);
      setForm((f) => ({ ...f, body: next }));
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + token.length; });
    } else {
      setForm((f) => ({ ...f, body: f.body + token }));
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.body.trim() || saving) return;
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), channel: form.channel, category: form.category.trim(), subject: form.subject, body: form.body };
      const r = form.id
        ? await OrganizationService.updateMessageTemplate(form.id, payload)
        : await OrganizationService.createMessageTemplate(payload);
      if (r.success) {
        toast.success(form.id ? 'Template updated.' : 'Template saved.');
        setForm(EMPTY); setEditing(false); await load(); onChanged?.();
      } else toast.error(r.message || 'Could not save the template.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not save the template.');
    } finally { setSaving(false); }
  };

  const edit = (t: MessageTemplate) => {
    setForm({ id: t.id, name: t.name, channel: t.channel, category: t.category, subject: t.subject, body: t.body });
    setEditing(true);
  };
  const remove = async (id: number) => {
    try { await OrganizationService.deleteMessageTemplate(id); await load(); onChanged?.(); }
    catch { toast.error('Could not delete the template.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-white/10 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><FileText className="w-5 h-5 text-emerald-400" /> Message templates</h2>
            <p className="text-sm text-slate-400 mt-1">Reusable email / SMS / WhatsApp messages. Use <code className="text-emerald-300">{'{{first_name}}'}</code> etc. — they fill in per lead.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Add / edit form */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Template name e.g. First outreach" className={dk} />
              <select value={form.channel} onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as MessageTemplate['channel'] }))} className={dk}>
                {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {(form.channel === 'email' || form.channel === 'any') && (
              <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Email subject (optional)" className={dk} />
            )}
            <textarea ref={bodyRef} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={5} placeholder="Write your message… e.g. Hi {{first_name}}, …" className={`${dk} resize-y`} />
            {vars.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[11px] text-slate-500 mr-1 mt-1">Insert:</span>
                {vars.map((v) => (
                  <button key={v.key} type="button" title={v.label} onClick={() => insertVar(v.key)}
                    className="text-[11px] rounded-full bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-slate-300 hover:text-emerald-200 px-2 py-0.5">
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Category (optional)" className="rounded-lg bg-slate-800 border border-white/5 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500/40 w-40" />
              <div className="flex gap-2">
                {editing && <button type="button" onClick={() => { setForm(EMPTY); setEditing(false); }} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white">Cancel</button>}
                <button type="button" onClick={save} disabled={saving || !form.name.trim() || !form.body.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {form.id ? 'Update' : 'Save template'}
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          ) : items.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No templates yet — create your first above.</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((t) => (
                <li key={t.id} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-200">{t.name}</span>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{t.channel}</span>
                      {t.category && <span className="text-[10px] text-slate-500">{t.category}</span>}
                    </div>
                    <p className="text-[12px] text-slate-500 truncate mt-0.5">{t.subject ? `${t.subject} — ` : ''}{t.body}</p>
                  </div>
                  <button type="button" onClick={() => edit(t)} className="rounded p-1 text-slate-500 hover:text-emerald-300 hover:bg-white/5"><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => remove(t.id)} className="rounded p-1 text-slate-500 hover:text-rose-400 hover:bg-white/5"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end p-4 border-t border-white/5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Picker: pick a template → render for the lead → onPick({subject, body}) ──
export function TemplatePicker({ workspaceId, leadId, channel, onPick, compact }: {
  workspaceId?: number | string; leadId?: number; channel?: string;
  onPick: (filled: { subject: string; body: string }) => void; compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await OrganizationService.listMessageTemplates({ workspace: workspaceId, channel, active: true });
      if (r.success) setItems(r.data?.templates || []);
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (open) load(); /* eslint-disable-next-line */
  }, [open, channel]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const pick = async (t: MessageTemplate) => {
    setBusyId(t.id);
    try {
      const r = await OrganizationService.renderMessageTemplate(t.id, leadId);
      if (r.success) { onPick({ subject: r.data?.subject || '', body: r.data?.body || '' }); setOpen(false); }
      else toast.error(r.message || 'Could not load the template.');
    } catch { toast.error('Could not load the template.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button type="button" onClick={() => setOpen((o) => !o)} title="Insert a template"
        className={`inline-flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-semibold ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-2.5 text-xs'}`}>
        <FileText className="w-3.5 h-3.5" /> Templates <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 z-30 w-72 rounded-xl border border-white/10 bg-slate-900 shadow-2xl py-1.5">
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-3 text-xs text-slate-500">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">No templates yet.</div>
            ) : items.map((t) => (
              <button key={t.id} type="button" onClick={() => pick(t)} disabled={busyId === t.id}
                className="w-full flex items-start gap-2 px-3 py-1.5 text-left hover:bg-white/5">
                {busyId === t.id ? <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin text-emerald-300 shrink-0" /> : <FileText className="w-3.5 h-3.5 mt-0.5 text-slate-500 shrink-0" />}
                <span className="min-w-0">
                  <span className="block text-[13px] text-slate-200 truncate">{t.name}</span>
                  <span className="block text-[11px] text-slate-500 truncate">{t.subject || t.body}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-white/5 mt-1 pt-1 px-1.5">
            <button type="button" onClick={() => { setManage(true); setOpen(false); }} className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-slate-400 hover:text-white hover:bg-white/5">
              <Settings2 className="w-3.5 h-3.5" /> Manage templates
            </button>
          </div>
        </div>
      )}
      {manage && <MessageTemplatesManager workspaceId={workspaceId} onClose={() => setManage(false)} />}
    </div>
  );
}
