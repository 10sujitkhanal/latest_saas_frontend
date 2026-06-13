'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Package, ScanLine, Wand2, Plus, Trash2, Check, Loader2, ArrowRight, ImageOff, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { StoreAgent, type ProductDraft } from '@/services/agents.service';

/**
 * Auto-Store agent — build a catalogue without typing.
 *   • Scan/enter a barcode  → Open Food Facts auto-fills name/category/image.
 *   • "Suggest catalogue"   → Qwen proposes products for the industry.
 *   • "Add manually"        → a blank row.
 * Review the basket (price + name), then create draft Item + Listing for each.
 */

function blank(): ProductDraft {
  return { name: '', category: '', image_url: '', cost_price: 0, selling_price: 0 };
}

export default function StoreAgentCard({ workspaceId, embed }: { workspaceId: string | number; embed?: boolean }) {
  const [barcode, setBarcode] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [looking, setLooking] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [building, setBuilding] = useState(false);
  const [basket, setBasket] = useState<ProductDraft[]>([]);
  const [done, setDone] = useState<number | null>(null);

  const add = (p: ProductDraft) =>
    setBasket((b) => {
      const key = (p.barcode || p.name).toLowerCase();
      if (key && b.some((x) => (x.barcode || x.name).toLowerCase() === key)) {
        toast.message('Already in your basket.');
        return b;
      }
      return [...b, p];
    });

  const lookup = async () => {
    const code = barcode.trim();
    if (!code || looking) return;
    setLooking(true);
    setDone(null);
    try {
      const res = await StoreAgent.lookup(workspaceId, code);
      if (res.success && res.data?.found && res.data.product) {
        add(res.data.product);
        setBarcode('');
      } else {
        toast.message("Not in the database — added a blank row to fill in.");
        add({ ...blank(), barcode: code });
        setBarcode('');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Lookup failed.');
    } finally {
      setLooking(false);
    }
  };

  const suggest = async () => {
    if (suggesting) return;
    setSuggesting(true);
    setDone(null);
    try {
      const res = await StoreAgent.suggest(workspaceId, '');
      if (res.success && res.data?.products?.length) {
        res.data.products.forEach(add);
      } else {
        toast.message(res.message || 'No suggestions — try a barcode or add manually.');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Could not suggest a catalogue.');
    } finally {
      setSuggesting(false);
    }
  };

  const importFromUrl = async () => {
    const url = siteUrl.trim();
    if (!url || importing) return;
    setImporting(true);
    setDone(null);
    try {
      const res = await StoreAgent.importUrl(workspaceId, url);
      if (res.success && res.data?.products?.length) {
        res.data.products.forEach(add);
        toast.success(`Found ${res.data.products.length} product(s) — review prices, then create.`);
        setSiteUrl('');
      } else {
        toast.message(res.message || 'No products found on that page — try a product/shop page link.');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Could not import from that link.');
    } finally {
      setImporting(false);
    }
  };

  const patch = (i: number, k: keyof ProductDraft, v: ProductDraft[keyof ProductDraft]) =>
    setBasket((b) => b.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  const remove = (i: number) => setBasket((b) => b.filter((_, idx) => idx !== i));

  const build = async () => {
    const ready = basket.filter((p) => p.name.trim());
    if (!ready.length || building) return;
    setBuilding(true);
    try {
      const res = await StoreAgent.build(workspaceId, ready);
      if (res.success) {
        setDone(res.data?.count ?? ready.length);
        setBasket([]);
        toast.success(res.message || 'Draft products created.');
      } else {
        toast.error(res.message || 'Could not create products.');
      }
    } catch (e) {
      toast.error(errMsg(e) || 'Could not create products.');
    } finally {
      setBuilding(false);
    }
  };

  const readyCount = basket.filter((p) => p.name.trim()).length;

  return (
    <div className={embed ? '' : 'mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'}>
      {!embed && (
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-sky-600" />
          <h2 className="text-base font-semibold text-slate-900">Store Agent</h2>
          <span className="ml-auto rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
            build catalogue, no typing
          </span>
        </div>
      )}
      <p className={embed ? 'text-sm text-slate-500' : 'mt-1 text-sm text-slate-500'}>
        Scan a barcode and the product — name, category and <strong>image</strong> — fills itself in.
        Or let the agent suggest a starter catalogue. Review prices, then create the products as
        <strong> drafts</strong> ready to publish.
      </p>

      {/* Inputs */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
          <ScanLine className="h-4 w-4 text-slate-400" />
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }}
            placeholder="Scan or type a barcode…"
            inputMode="numeric"
            className="flex-1 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <button type="button" onClick={lookup} disabled={looking || !barcode.trim()}
            className="my-1 inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50">
            {looking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
            Look up
          </button>
        </div>
        <button type="button" onClick={suggest} disabled={suggesting}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:text-sky-700 disabled:opacity-50">
          {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Suggest catalogue
        </button>
        <button type="button" onClick={() => add(blank())}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <Plus className="h-4 w-4" /> Add manually
        </button>
      </div>

      {/* Import from an existing website */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3">
          <Globe className="h-4 w-4 text-slate-400" />
          <input
            value={siteUrl}
            onChange={(e) => setSiteUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); importFromUrl(); } }}
            placeholder="Already have a website? Paste a shop/products page link…"
            className="flex-1 bg-transparent py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <button type="button" onClick={importFromUrl} disabled={importing || !siteUrl.trim()}
            className="my-1 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            {importing ? 'Reading…' : 'Import'}
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">The agent reads the page and drafts products — review before creating. Works best on a products/shop page.</p>

      {/* Done banner */}
      {done !== null && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4" />
          <span>Created <strong>{done}</strong> draft product(s).</span>
          <Link href={`/w/${workspaceId}/marketplace`} className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
            Review &amp; publish <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Basket */}
      {basket.length > 0 && (
        <div className="mt-4 space-y-2">
          {basket.map((p, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                {p.image_url
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-contain" />
                  : <ImageOff className="h-5 w-5 text-slate-300" />}
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                <input value={p.name} onChange={(e) => patch(i, 'name', e.target.value)}
                  placeholder="Product name" className={`${cell} col-span-2 sm:col-span-2 font-medium`} />
                <input value={p.category} onChange={(e) => patch(i, 'category', e.target.value)}
                  placeholder="Category" className={cell} />
                <input type="number" min={0} value={p.selling_price}
                  onChange={(e) => patch(i, 'selling_price', Number(e.target.value))}
                  placeholder="Price" className={cell} />
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-white hover:text-rose-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-end pt-1">
            <button type="button" onClick={build} disabled={building || readyCount === 0}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50">
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {building ? 'Creating…' : `Create ${readyCount} draft product${readyCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const cell = 'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-300';

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
}
