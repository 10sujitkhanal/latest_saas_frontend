'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';

export type CustomFieldType =
  | 'text' | 'number' | 'date' | 'time' | 'datetime' | 'dropdown' | 'radio' | 'checkbox';

export interface CustomFieldDef {
  id: number;
  name: string;
  key: string;
  field_type: CustomFieldType;
  options: string[];
  required: boolean;
  is_active: boolean;
  sort_order: number;
}

const TYPES: [CustomFieldType, string][] = [
  ['text', 'Text'], ['number', 'Number'], ['date', 'Date'], ['time', 'Time'],
  ['datetime', 'Date & time'], ['dropdown', 'Dropdown'], ['radio', 'Radio'], ['checkbox', 'Checkbox'],
];
const HAS_OPTIONS = new Set<CustomFieldType>(['dropdown', 'radio', 'checkbox']);
const dk = 'w-full rounded-lg bg-slate-800 border border-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40';

// ── Manager: define / list / delete custom fields ────────────────────────
export function CustomFieldsManager({ onClose, onChanged }: { onClose: () => void; onChanged?: () => void }) {
  const [fields, setFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await OrganizationService.listCustomFields();
      if (r.success) setFields(r.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: name.trim(), field_type: type, required };
      if (HAS_OPTIONS.has(type)) payload.options = options.split(',').map((s) => s.trim()).filter(Boolean);
      const r = await OrganizationService.createCustomField(payload);
      if (r.success) {
        toast.success('Field added.');
        setName(''); setOptions(''); setRequired(false); setType('text');
        await load(); onChanged?.();
      } else toast.error(r.message || 'Could not add the field.');
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not add the field.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try { await OrganizationService.deleteCustomField(id); await load(); onChanged?.(); }
    catch { toast.error('Could not remove the field.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-white/10 shadow-2xl">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-white/5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white"><Settings2 className="w-5 h-5 text-emerald-400" /> Lead custom fields</h2>
            <p className="text-sm text-slate-400 mt-1">Add your own fields — they appear on every lead and flow through import/export.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-500 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Add form */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Field name e.g. Interested" className={dk} />
              <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)} className={dk}>
                {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {HAS_OPTIONS.has(type) && (
              <input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, comma-separated e.g. Yes, No, Maybe" className={dk} />
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-emerald-500" /> Required
              </label>
              <button type="button" onClick={add} disabled={saving || !name.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add field
              </button>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="py-6 text-center text-slate-500 text-sm">Loading…</div>
          ) : fields.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No custom fields yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto">
              {fields.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                  <span className="font-medium text-slate-200">{f.name}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{f.field_type}</span>
                  {f.required && <span className="text-[10px] text-amber-300">required</span>}
                  {f.options?.length > 0 && <span className="truncate text-[10px] text-slate-500">{f.options.join(', ')}</span>}
                  <button type="button" onClick={() => remove(f.id)} className="ml-auto rounded p-1 text-slate-500 hover:text-rose-400 hover:bg-white/5"><Trash2 className="w-4 h-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex justify-end p-6 border-t border-white/5">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold">Done</button>
        </div>
      </div>
    </div>
  );
}

// ── Inputs: render the custom fields on a lead form ──────────────────────
export function CustomFieldInputs({
  fields, values, onChange,
}: {
  fields: CustomFieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (!fields.length) return null;
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.id}>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {f.name}{f.required && <span className="text-amber-300"> *</span>}
          </label>
          <FieldInput field={f} value={values[f.key]} set={(v) => onChange(f.key, v)} />
        </div>
      ))}
    </div>
  );
}

function FieldInput({ field, value, set }: { field: CustomFieldDef; value: unknown; set: (v: unknown) => void }) {
  const t = field.field_type;
  if (t === 'number') return <input type="number" value={(value as number) ?? ''} onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))} className={dk} />;
  if (t === 'date') return <input type="date" value={(value as string) || ''} onChange={(e) => set(e.target.value)} className={dk} />;
  if (t === 'time') return <input type="time" value={(value as string) || ''} onChange={(e) => set(e.target.value)} className={dk} />;
  if (t === 'datetime') return <input type="datetime-local" value={(value as string) || ''} onChange={(e) => set(e.target.value)} className={dk} />;
  if (t === 'dropdown') return (
    <select value={(value as string) || ''} onChange={(e) => set(e.target.value)} className={dk}>
      <option value="">—</option>
      {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  if (t === 'radio') return (
    <div className="flex flex-wrap gap-3">
      {field.options.map((o) => (
        <label key={o} className="flex items-center gap-1.5 text-sm text-slate-300">
          <input type="radio" name={`cf-${field.id}`} checked={value === o} onChange={() => set(o)} className="accent-emerald-500" /> {o}
        </label>
      ))}
    </div>
  );
  if (t === 'checkbox') {
    if (field.options.length > 0) {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (o: string) => set(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
      return (
        <div className="flex flex-wrap gap-3">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-slate-300">
              <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} className="accent-emerald-500" /> {o}
            </label>
          ))}
        </div>
      );
    }
    return (
      <label className="flex items-center gap-1.5 text-sm text-slate-300">
        <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} className="accent-emerald-500" /> Yes
      </label>
    );
  }
  return <input type="text" value={(value as string) || ''} onChange={(e) => set(e.target.value)} className={dk} />;
}
