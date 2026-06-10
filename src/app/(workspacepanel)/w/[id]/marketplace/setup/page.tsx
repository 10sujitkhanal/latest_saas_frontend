'use client';

/**
 * Wellness "Set up what you sell" wizard (Layer 2, Slice 2).
 *
 * Category-first, type-to-add: pick suggested wellness categories → add items
 * naturally → review → Save as drafts. Everything stays a local draft in the
 * browser (persisted to localStorage, minus the image Files) until the owner
 * confirms; only then does it hit the idempotent backend endpoint, which creates
 * DRAFT listings / items / inactive membership plans. Nothing is published.
 */

import { useEffect, useMemo, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { businessCurrency } from '@/lib/currency';
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, Tag, CheckCircle2, Lock } from 'lucide-react';
import PermissionGuard from '@/components/workspace/PermissionGuard';
import { Card, Field, TextInput, SelectInput, PrimaryButton, apiError } from '@/components/accounting/kit';
import { ImageDropzone } from '@/components/workspace/ImageDropzone';
import { OrganizationService } from '@/services/organization.service';
import { MarketplaceService } from '@/services/marketplace.service';
import { DealsService } from '@/services/deals.service';
import {
  sellableCategoriesFor, TYPE_FIELDS, WELLNESS_STARTERS, STARTER_CATEGORY_KEYS,
  type SellableCategory, type SellableType,
} from '@/lib/wellnessSellables';
import { Wand2 } from 'lucide-react';

interface StagedItem {
  ref: string;
  categoryKey: string;
  category: string;      // free-text label written to the Listing
  type: SellableType;
  name: string;
  price: string;
  duration?: string;
  description?: string;
  track_stock?: boolean;
  imageFile?: File | null;  // in-memory only (not persisted)
}

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

export default function SellableSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  return (
    <PermissionGuard service="marketplace" required="marketplace.create" workspaceId={wsId} skeleton="form">
      <Wizard wsId={wsId} />
    </PermissionGuard>
  );
}

function Wizard({ wsId }: { wsId: string }) {
  const router = useRouter();
  const storeKey = `sellableSetup:${wsId}`;
  const categories = sellableCategoriesFor();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set(categories.filter((c) => c.recommended).map((c) => c.key)));
  const [custom, setCustom] = useState<SellableCategory[]>([]);
  const [items, setItems] = useState<StagedItem[]>([]);
  // Persisted with the draft so a retry after a dropped connection reuses the
  // SAME idempotency token — the backend then returns the existing result
  // instead of creating duplicates.
  const [token, setToken] = useState<string>(uid());
  const [hydrated, setHydrated] = useState(false);
  const [resumed, setResumed] = useState(false);

  const [newCat, setNewCat] = useState('');
  const [newCatType, setNewCatType] = useState<SellableType>('product');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ listings: number; memberships: number; categories: number; hasPackage: boolean } | null>(null);

  // Restore local draft (text only — Files can't be serialized).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.token === 'string' && d.token) setToken(d.token);   // reuse token → idempotent retry
        if (Array.isArray(d.selected)) setSelected(new Set(d.selected));
        if (Array.isArray(d.custom)) setCustom(d.custom);
        if (Array.isArray(d.items) && d.items.length > 0) {
          setItems(d.items.map((i: StagedItem) => ({ ...i, imageFile: null })));
          setResumed(true);   // tell the owner their work carried over
        }
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, [storeKey]);

  // Persist on change (strip Files).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storeKey, JSON.stringify({
        token,
        selected: [...selected], custom,
        items: items.map(({ imageFile, ...rest }) => rest),
      }));
    } catch { /* ignore */ }
  }, [token, selected, custom, items, hydrated, storeKey]);

  const allCats = useMemo(() => [...categories, ...custom], [categories, custom]);
  const selectedCats = allCats.filter((c) => selected.has(c.key));

  const toggle = (key: string) => setSelected((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const addCustom = () => {
    const label = newCat.trim();
    if (!label) return;
    const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (!allCats.some((c) => c.key === key)) setCustom((p) => [...p, { key, label, type: newCatType }]);
    setSelected((p) => new Set(p).add(key));
    setNewCat('');
  };

  const addItem = (it: StagedItem) => setItems((p) => [...p, it]);
  const removeItem = (ref: string) => setItems((p) => p.filter((i) => i.ref !== ref));
  const updateItem = (ref: string, patch: Partial<StagedItem>) => setItems((p) => p.map((i) => (i.ref === ref ? { ...i, ...patch } : i)));

  // "Start with wellness suggestions": pre-select common categories + stage a few
  // editable starter rows with BLANK prices (never invented) + neutral copy. The
  // owner reviews/edits/removes everything and must set a price before saving.
  const applySuggestions = () => {
    const byKey = new Map(sellableCategoriesFor().map((c) => [c.key, c]));
    setSelected((prev) => { const n = new Set(prev); STARTER_CATEGORY_KEYS.forEach((k) => n.add(k)); return n; });
    setItems((prev) => {
      const have = new Set(prev.map((i) => `${i.categoryKey}::${i.name.toLowerCase()}`));
      const additions: StagedItem[] = [];
      for (const key of STARTER_CATEGORY_KEYS) {
        const cat = byKey.get(key);
        if (!cat) continue;
        for (const row of (WELLNESS_STARTERS[key] || [])) {
          if (have.has(`${key}::${row.name.toLowerCase()}`)) continue;
          additions.push({
            ref: uid(), categoryKey: key, category: cat.label, type: cat.type,
            name: row.name, price: '', description: row.description,
            duration: '', track_stock: cat.type === 'product', imageFile: null,
          });
        }
      }
      return [...prev, ...additions];
    });
    setStep(2);
  };

  const counts = useMemo(() => {
    const memberships = items.filter((i) => i.type === 'membership').length;
    const listings = items.length - memberships;
    const cats = new Set(items.map((i) => i.category).filter(Boolean));
    return { listings, memberships, categories: cats.size };
  }, [items]);

  const save = async () => {
    // Prices are never invented — require one on every item before saving.
    const noPrice = items.filter((i) => !i.price || Number(i.price) <= 0);
    if (noPrice.length > 0) {
      setError(`Enter a price for every item before saving — ${noPrice.length} still need a price.`);
      setStep(2);
      return;
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        setup_token: token,
        items: items.map((i) => ({
          ref: i.ref, type: i.type, name: i.name, price: i.price || '0',
          category: i.category, description: i.description || '',
          duration: i.duration || '', track_stock: !!i.track_stock,
        })),
      };
      const res = await OrganizationService.applySellableSetup(Number(wsId), payload);
      if (!res?.success) { setError(res?.message || 'Could not save your setup.'); return; }
      // Phase 2: upload each staged image to its new listing (existing path).
      const byRef: Record<string, number> = res.data?.listing_ids_by_ref || {};
      await Promise.all(items.map(async (i) => {
        const listingId = byRef[i.ref];
        if (i.imageFile && listingId) {
          try { await MarketplaceService.uploadHeroImage(wsId, listingId, i.imageFile); } catch { /* non-fatal */ }
        }
      }));
      const hasPackage = items.some((i) => i.type === 'package');
      try { localStorage.removeItem(storeKey); } catch { /* ignore */ }
      setDone({ listings: res.data?.listings ?? counts.listings, memberships: res.data?.memberships ?? counts.memberships, categories: (res.data?.categories?.length) ?? counts.categories, hasPackage });
    } catch (e) { setError(apiError(e, 'Could not save your setup.')); }
    finally { setSaving(false); }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Card>
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 className="h-7 w-7" /></div>
            <h1 className="text-lg font-semibold text-white">Saved as drafts</h1>
            <p className="text-sm text-slate-300">
              Created {done.listings} draft listing{done.listings === 1 ? '' : 's'}
              {done.memberships > 0 && <> and {done.memberships} membership plan{done.memberships === 1 ? '' : 's'}</>}.
              <strong className="text-emerald-200"> Nothing is public yet</strong> — review and publish each when you’re ready.
            </p>
            <div className="mt-2 flex gap-2">
              <Link href={`/w/${wsId}/marketplace`} className="rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500">Review your listings</Link>
              <Link href={`/w/${wsId}`} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10">Back to dashboard</Link>
            </div>
          </div>
        </Card>
        <LaunchOfferStep wsId={wsId} hasPackage={done.hasPackage} hasMembership={done.memberships > 0} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Let’s set up what you sell</h1>
        <p className="text-[13px] text-slate-400">Pick categories, add a few items, review — everything saves as a draft. Nothing goes public until you publish it.</p>
      </div>
      <Stepper step={step} />

      {resumed && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] px-4 py-2.5 text-[12px] text-emerald-100">
          <span>We saved your progress — picking up where you left off. (Re-add any photos.)</span>
          <button type="button" onClick={() => setResumed(false)} className="shrink-0 font-semibold text-emerald-300 hover:text-emerald-200">Dismiss</button>
        </div>
      )}

      {step === 1 && (
        <Card>
          <button type="button" onClick={applySuggestions}
            className="mb-4 flex w-full items-center gap-3 rounded-xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 px-4 py-3 text-left transition hover:from-emerald-500/20">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"><Wand2 className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-white">Start with wellness suggestions</span>
              <span className="block text-[11px] text-slate-300">We’ll pre-fill a few common categories &amp; starter items — you set the prices and edit anything before saving. Nothing is created until you save.</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-emerald-300" />
          </button>
          <h2 className="px-1 pb-1 text-sm font-semibold text-white">What do you sell?</h2>
          <p className="px-1 pb-3 text-[12px] text-slate-400">We’ve recommended a few for wellness — check the ones you want, or use the suggestions above.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allCats.map((c) => {
              const on = selected.has(c.key);
              return (
                <button key={c.key} type="button" onClick={() => toggle(c.key)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/20'}`}>{on && <Check className="h-3.5 w-3.5" />}</span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-white">{c.label}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-slate-500">{c.type}</span>
                  </span>
                  {c.recommended && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">recommended</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-white/10 pt-4">
            <div className="flex-1 min-w-[160px]"><Field label="Add your own category"><TextInput value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Herbal Teas" /></Field></div>
            <div className="w-40"><Field label="Type"><SelectInput value={newCatType} onChange={(e) => setNewCatType(e.target.value as SellableType)}>
              <option value="product">Product</option><option value="service">Service</option><option value="consultation">Consultation</option><option value="package">Package</option><option value="membership">Membership</option>
            </SelectInput></Field></div>
            <button type="button" onClick={addCustom} className="mb-0.5 inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><Plus className="h-3.5 w-3.5" /> Add</button>
          </div>
          <div className="mt-5 flex justify-end">
            <PrimaryButton onClick={() => setStep(2)} disabled={selected.size === 0}>Continue <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></PrimaryButton>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {selectedCats.length === 0 && <Card><p className="p-2 text-sm text-slate-400">No categories selected. <button className="text-pink-300" onClick={() => setStep(1)}>Go back</button>.</p></Card>}
          {selectedCats.map((c) => (
            <CategorySection key={c.key} category={c} items={items.filter((i) => i.categoryKey === c.key)} onAdd={addItem} onRemove={removeItem} onUpdate={updateItem} />
          ))}
          {error && <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">{error}</div>}
          <div className="flex justify-between">
            <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
            <PrimaryButton onClick={() => { setError(null); setStep(3); }} disabled={items.length === 0}>Review ({items.length}) <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></PrimaryButton>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card>
          <h2 className="px-1 pb-3 text-sm font-semibold text-white">Review setup</h2>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-300">
            We will create:
            <ul className="mt-2 space-y-1">
              <li className="flex items-center gap-2"><Tag className="h-3.5 w-3.5 text-pink-300" /> {counts.listings} draft listing{counts.listings === 1 ? '' : 's'}</li>
              <li className="flex items-center gap-2"><Tag className="h-3.5 w-3.5 text-pink-300" /> {counts.categories} categor{counts.categories === 1 ? 'y' : 'ies'}</li>
              {counts.memberships > 0 && <li className="flex items-center gap-2"><Tag className="h-3.5 w-3.5 text-pink-300" /> {counts.memberships} inactive membership plan{counts.memberships === 1 ? '' : 's'}</li>}
              <li className="flex items-center gap-2 text-slate-500"><Tag className="h-3.5 w-3.5" /> 0 published items</li>
            </ul>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-[12px] text-amber-200">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Everything saves as a <strong>draft</strong>. Nothing becomes public until you publish each item and your business is live.</span>
          </div>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          <div className="mt-5 flex justify-between">
            <button type="button" onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
            <PrimaryButton onClick={save} disabled={saving || items.length === 0}>{saving ? 'Saving…' : 'Save as drafts'}</PrimaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ['Categories', 'Items', 'Review'];
  return (
    <div className="flex items-center gap-2">
      {labels.map((l, i) => {
        const n = i + 1; const active = n === step; const past = n < step;
        return (
          <div key={l} className="flex items-center gap-2">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${active ? 'bg-pink-600 text-white' : past ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400'}`}>{past ? <Check className="h-3.5 w-3.5" /> : n}</span>
            <span className={`text-[12px] font-medium ${active ? 'text-white' : 'text-slate-500'}`}>{l}</span>
            {n < 3 && <span className="mx-1 h-px w-6 bg-white/10" />}
          </div>
        );
      })}
    </div>
  );
}

interface OfferPreset { key: string; label: string; code: string; value: string; description: string; firstTimeOnly?: boolean; requires?: 'package' | 'membership' }

// Safe, editable launch-offer presets — all created PAUSED, neutral copy, no
// fake urgency. Shown only when relevant to what the owner just created.
const OFFER_PRESETS: OfferPreset[] = [
  { key: 'firstvisit', label: 'First-visit offer', code: 'FIRSTVISIT', value: '10', description: 'A first-visit discount for new customers.', firstTimeOnly: true },
  { key: 'welcome', label: 'Welcome discount', code: 'WELCOME10', value: '10', description: 'A welcome discount for your customers.' },
  { key: 'package', label: 'Package intro offer', code: 'PACKAGE10', value: '10', description: 'An introductory discount on a package.', requires: 'package' },
  { key: 'membership', label: 'Membership intro offer', code: 'MEMBER10', value: '10', description: 'An introductory discount on a membership.', requires: 'membership' },
];

function isoToday(addDays = 0): string {
  const d = new Date(); d.setDate(d.getDate() + addDays);
  return d.toISOString().slice(0, 10);
}

function LaunchOfferStep({ wsId, hasPackage, hasMembership }: { wsId: string; hasPackage: boolean; hasMembership: boolean }) {
  const offers = OFFER_PRESETS.filter((o) => !o.requires || (o.requires === 'package' && hasPackage) || (o.requires === 'membership' && hasMembership));
  const [skipped, setSkipped] = useState(false);
  const [sel, setSel] = useState<OfferPreset | null>(null);
  const [code, setCode] = useState('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (skipped) return null;

  const choose = (o: OfferPreset) => { setSel(o); setCode(o.code); setValue(o.value); setErr(null); };

  const create = async () => {
    if (!sel) return;
    const v = Number(value);
    if (!value || v <= 0 || v > 100) { setErr('Enter a discount between 1 and 100%.'); return; }
    if (!code.trim()) { setErr('Enter a code customers will type.'); return; }
    setBusy(true); setErr(null);
    try {
      const res = await DealsService.create(Number(wsId), {
        code: code.trim().toUpperCase(), type: 'percent', value: v,
        description: sel.description, status: 'paused', first_time_only: !!sel.firstTimeOnly,
        start_date: isoToday(0), end_date: isoToday(365), applicable_categories: [],
      });
      if (!res.success) { setErr(res.message || 'Could not create the offer.'); return; }
      setCreated(code.trim().toUpperCase()); setSel(null);
    } catch (e) { setErr(apiError(e, 'Could not create the offer.')); }
    finally { setBusy(false); }
  };

  if (created) {
    return (
      <Card>
        <div className="flex items-start gap-3 p-1">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Offer “{created}” created — paused</p>
            <p className="text-[12px] text-slate-400">It won’t run until you review and enable it. <Link href={`/w/${wsId}/deals`} className="font-semibold text-pink-300 hover:text-pink-200">Review in Deals →</Link></p>
            <button type="button" onClick={() => setCreated(null)} className="mt-2 text-[12px] font-semibold text-slate-300 hover:text-white">Create another offer</button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between px-1 pb-1">
        <h2 className="text-sm font-semibold text-white">Want to create a launch offer?</h2>
        <button type="button" onClick={() => setSkipped(true)} className="text-[12px] font-semibold text-slate-400 hover:text-white">Skip for now</button>
      </div>
      <p className="px-1 pb-3 text-[12px] text-slate-400">Optional. Any offer is created <strong>paused</strong> — you set the amount and enable it when you’re ready.</p>
      {!sel ? (
        <div className="flex flex-wrap gap-2">
          {offers.map((o) => (
            <button key={o.key} type="button" onClick={() => choose(o)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.05]">
              <Tag className="h-3.5 w-3.5 text-pink-300" /> {o.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="mb-2 text-[12px] text-slate-300">{sel.description}</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-24"><Field label="Discount %"><TextInput type="number" step="1" value={value} onChange={(e) => setValue(e.target.value)} /></Field></div>
            <div className="w-40"><Field label="Code"><TextInput value={code} onChange={(e) => setCode(e.target.value)} /></Field></div>
            <button type="button" onClick={create} disabled={busy} className="mb-0.5 rounded-lg bg-pink-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-500 disabled:opacity-50">{busy ? 'Creating…' : 'Create offer (paused)'}</button>
            <button type="button" onClick={() => setSel(null)} className="mb-0.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">Cancel</button>
          </div>
          {err && <p className="mt-2 text-xs text-red-300">{err}</p>}
        </div>
      )}
    </Card>
  );
}

function CategorySection({ category, items, onAdd, onRemove, onUpdate }: {
  category: SellableCategory; items: StagedItem[]; onAdd: (it: StagedItem) => void; onRemove: (ref: string) => void; onUpdate: (ref: string, patch: Partial<StagedItem>) => void;
}) {
  const f = TYPE_FIELDS[category.type];
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [trackStock, setTrackStock] = useState(category.type === 'product');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const preview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);

  const add = () => {
    if (!name.trim()) return;
    onAdd({
      ref: uid(), categoryKey: category.key, category: category.label, type: category.type,
      name: name.trim(), price: price || '0',
      duration: f.showDuration ? duration : '', description: f.showDescription ? description : '',
      track_stock: f.showTrackStock ? trackStock : false, imageFile,
    });
    setName(''); setPrice(''); setDuration(''); setDescription(''); setImageFile(null); setTrackStock(category.type === 'product');
  };

  return (
    <Card>
      <h3 className="px-1 pb-3 text-sm font-semibold text-white">{category.label}</h3>
      <div className="grid gap-3 sm:grid-cols-12">
        <div className="sm:col-span-3"><ImageDropzone previewUrl={preview} onFile={setImageFile} height="h-24" hint="Photo" /></div>
        <div className="grid gap-2 sm:col-span-9 sm:grid-cols-2">
          <Field label={f.nameLabel}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={category.type === 'product' ? 'e.g. Vitamin D3' : ''} /></Field>
          <Field label={f.priceLabel}><TextInput type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={businessCurrency()} /></Field>
          {f.showDuration && <Field label="Duration"><TextInput value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 30 minutes" /></Field>}
          {f.showDescription && <Field label="Description"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" /></Field>}
          {f.showTrackStock && (
            <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="h-4 w-4 accent-pink-500" /> Track stock for this product</label>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={add} disabled={!name.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-500 disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Add</button>
      </div>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
          {items.map((i) => {
            const needsPrice = !i.price || Number(i.price) <= 0;
            return (
              <li key={i.ref} className="flex items-center gap-2">
                {i.imageFile ? <img src={URL.createObjectURL(i.imageFile)} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-slate-500"><Tag className="h-3.5 w-3.5" /></span>}
                <input value={i.name} onChange={(e) => onUpdate(i.ref, { name: e.target.value })}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-sm text-white focus:border-pink-400/50 focus:outline-none" />
                <input type="number" step="0.01" value={i.price} onChange={(e) => onUpdate(i.ref, { price: e.target.value })} placeholder={`${businessCurrency()} price`}
                  className={`w-28 shrink-0 rounded-lg border bg-white/[0.02] px-2.5 py-1.5 text-sm text-white focus:outline-none ${needsPrice ? 'border-amber-500/50' : 'border-white/10 focus:border-pink-400/50'}`} />
                <button type="button" onClick={() => onRemove(i.ref)} className="shrink-0 text-slate-500 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
