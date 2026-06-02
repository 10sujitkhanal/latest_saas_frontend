'use client';

/**
 * Full-page training experience -- the redesign of the old popup modal.
 *
 * Why a page, not a modal:
 *   1. The training form needs ROOM. Q&A pairs alone are 3-5 rows tall
 *      each; with samples + LLM picker + footer, the modal pushed past
 *      the viewport on laptops.
 *   2. Direct-linkable URL. Reps can bookmark ``.../knowledge/train``
 *      and ops can send "click here to train the AI" links in onboarding.
 *   3. Sidebar samples can live alongside the form so the user has the
 *      examples + the input together -- no scrolling between them.
 *
 * Layout: two columns -- form on the left (modes + inputs), live SAMPLES
 * on the right that change with the selected mode. Tells users EXACTLY
 * what to paste / upload for each shape of data.
 */

import { useCallback, useEffect, useRef, useState, use as reactUse } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Plus, FileUp, Type as TypeIcon, Globe, Sparkles, Save,
  CheckCircle2, FileText, Lightbulb, Upload, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { OrganizationService } from '@/services/organization.service';

type TrainMode = 'qa' | 'text' | 'file' | 'url';

type QAPair = { questions: string; answer: string };

// Each entry binds a model ID to the Channel ``kind`` that has to be
// connected for that model to actually work. The picker filters down
// to only the rows whose provider the tenant has wired up, so users
// can't pick "Claude Sonnet" without an Anthropic key on file.
const LLM_OPTIONS: Array<{
  id: string; name: string; hint: string; provider: string;
}> = [
  { id: 'gpt-4o-mini',             name: 'GPT-4o mini',        hint: 'Fast + cheap (recommended)', provider: 'openai' },
  { id: 'gpt-4o',                  name: 'GPT-4o',             hint: 'Best quality, slower',       provider: 'openai' },
  { id: 'claude-3-5-sonnet',       name: 'Claude Sonnet',      hint: 'Nuanced, long context',      provider: 'anthropic' },
  { id: 'gemini-1.5-flash',        name: 'Gemini Flash',       hint: 'Fast, free tier',            provider: 'gemini' },
  { id: 'llama3.2',                name: 'Llama 3.2 (Ollama)', hint: 'Self-hosted, free',          provider: 'ollama' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 70B (Groq)',   hint: 'Sub-200ms inference',        provider: 'groq' },
  { id: 'mistral-large-latest',    name: 'Mistral Large',      hint: 'Strong European model',      provider: 'mistral' },
  { id: 'command-r-plus',          name: 'Cohere Command R+',  hint: 'Strong on RAG retrieval',    provider: 'cohere' },
  { id: 'openrouter/auto',         name: 'OpenRouter (auto)',  hint: 'One key, every model',       provider: 'openrouter' },
  { id: 'meta-llama/Llama-3-70b',  name: 'Llama 3 70B',        hint: 'Hosted via Together AI',     provider: 'together_ai' },
];

export default function KBTrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: wsId } = reactUse(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  // KB id passed in via ``?kb=<id>`` from the doc detail page's
  // "Add more data" button. When present, Q&A pairs + documents
  // created here are pinned to THAT specific KB so they show up in
  // the right doc's chat playground (not the workspace default).
  const kbIdParam = searchParams.get('kb');
  const presetKbId = kbIdParam ? Number(kbIdParam) : null;
  // Mode also accepts a ``?mode=qa`` deeplink so "Add Q&A" jumps
  // straight to the right tab without an extra click.
  const modeParam = searchParams.get('mode') as TrainMode | null;
  const initialMode: TrainMode =
    (modeParam && ['qa', 'text', 'file', 'url'].includes(modeParam)) ? modeParam : 'qa';

  const [mode, setMode] = useState<TrainMode>(initialMode);
  // Connected AI provider kinds (e.g. ``['openai', 'ollama']``).
  // The LLM picker filters its options to entries whose ``provider``
  // is in this set so users can only pick models they can actually
  // run. Loaded once on mount; channel changes are rare during a
  // single train session so we don't refresh.
  const [connectedProviders, setConnectedProviders] = useState<string[]>([]);

  useEffect(() => {
    OrganizationService.listChannels().then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        const kinds = new Set<string>();
        for (const ch of res.data as Array<{ kind: string; is_active: boolean; is_connected: boolean }>) {
          if (ch.is_active !== false && ch.is_connected !== false) {
            kinds.add(ch.kind);
          }
        }
        setConnectedProviders(Array.from(kinds));
      }
    }).catch(() => { /* offline -- picker falls back to defaults */ });
  }, []);

  // Models that actually work (their provider Channel is connected).
  // When NOTHING is connected we still show OpenAI + Ollama so the
  // user can pick one + go connect it -- gentler than an empty list.
  const availableModels = connectedProviders.length === 0
    ? LLM_OPTIONS.filter((m) => m.provider === 'openai' || m.provider === 'ollama')
    : LLM_OPTIONS.filter((m) => connectedProviders.includes(m.provider));
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [qaPairs, setQaPairs] = useState<QAPair[]>([{ questions: '', answer: '' }]);
  const [llmModel, setLlmModel] = useState('gpt-4o-mini');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addQA = () => setQaPairs((rs) => [...rs, { questions: '', answer: '' }]);
  const updateQA = (i: number, patch: Partial<QAPair>) =>
    setQaPairs((rs) => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeQA = (i: number) =>
    setQaPairs((rs) => rs.length === 1 ? [{ questions: '', answer: '' }] : rs.filter((_, idx) => idx !== i));

  const loadSampleQA = useCallback(() => {
    setQaPairs([
      {
        questions: 'hello\nhi\nhey\ngood morning\ngood evening\nnamaste',
        answer: 'Hi there! 👋 How can I help you today?',
      },
      {
        questions: 'what are your hours\nwhen are you open\ntiming\noperating hours',
        answer: "We're open Monday–Friday, 9am to 6pm IST. Closed Saturday and Sunday.",
      },
      {
        questions: 'pricing\nhow much\nprice\nplans\ncost',
        answer: 'Our plans start at $100/month (Starter, 5 users). Growth is $200/month (20 users). Enterprise is $300/month (unlimited).',
      },
    ]);
    toast.success('Sample Q&A pairs loaded -- edit to fit your business.');
  }, []);

  const loadSampleText = useCallback(() => {
    setTitle('Refund Policy');
    setContent(`Refund Policy
─────────────
We accept returns within 30 days of purchase. Items must be in
original condition with packaging and proof of purchase.

To request a refund:
1. Email support@acme.com with your order number
2. Include the reason for return
3. Wait for our team to send a prepaid shipping label
4. Ship the item back within 7 days of receiving the label
5. Refund is credited within 5 business days of us receiving the item

Exceptions
──────────
Personalised items, intimate apparel, and clearance items are
final sale and not eligible for return.`);
    toast.success('Sample policy text loaded -- edit to fit your business.');
  }, []);

  const submit = async () => {
    if (mode === 'qa') {
      const valid = qaPairs.filter((r) => r.questions.trim() && r.answer.trim());
      if (valid.length === 0) {
        toast.error('Add at least one Q&A pair with a question AND an answer.');
        return;
      }
    }
    if (mode === 'text' && !content.trim()) { toast.error('Paste some content first.'); return; }
    if (mode === 'url' && !url.trim())       { toast.error('Enter a URL.'); return; }
    if (mode === 'file' && !file)            { toast.error('Pick a file to upload.'); return; }

    setSaving(true);
    try {
      let res;
      if (mode === 'qa') {
        const pairs = qaPairs
          .filter((r) => r.questions.trim() && r.answer.trim())
          .map((r) => ({
            questions: r.questions.split('\n').map((q) => q.trim()).filter(Boolean),
            answer:    r.answer.trim(),
            match_mode: 'contains' as const,
          }));
        // Pin Q&A pairs to the KB referenced in the URL when the user
        // came from a specific doc's "Add more data" button -- so the
        // pairs show up in THAT doc's chat playground, not the
        // workspace default.
        res = await OrganizationService.kbCreateQAPairs(pairs, presetKbId || undefined);
      } else if (mode === 'file' && file) {
        // Same scoping for file uploads -- the new PDF / DOCX / TXT
        // joins the same KB the user is already managing, so its
        // chunks become searchable in that KB's chat playground.
        res = await OrganizationService.kbUploadFile({
          file,
          title: title.trim() || undefined,
          kbId: presetKbId || undefined,
        });
      } else {
        // text / url -- same scoping path.
        res = await OrganizationService.kbCreateDocument({
          kind: mode,
          title: title.trim() || undefined,
          content: mode === 'text' ? content : undefined,
          url:     mode === 'url'  ? url     : undefined,
          kb_id:   presetKbId || undefined,
        });
      }
      if (res?.success) {
        toast.success(res.message || 'Trained.');
        // ``?return_to=`` lets the calling page tell us where to go
        // after save (e.g. back to the doc detail page that opened
        // this train flow). Default to /knowledge if not provided.
        const returnTo = searchParams.get('return_to');
        router.push(returnTo || `/w/${wsId}/knowledge`);
      } else {
        toast.error(res?.message || 'Training failed');
      }
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Training failed');
    } finally { setSaving(false); }
  };

  // Mode list. Q&A is intentionally HIDDEN when ``presetKbId`` is
  // set (the "Add more data" flow from a doc detail page):
  //   * Q&A pairs are workspace-wide, not per-KB. Letting users pick
  //     "Q&A" from inside a specific KB's add-more flow implies the
  //     pair would be scoped to that KB -- which would be misleading.
  //   * Q&A pairs are managed on the dedicated /knowledge/qa page;
  //     this flow is for adding documents into the selected KB.
  const allModes: { id: TrainMode; label: string; tagline: string; icon: typeof TypeIcon }[] = [
    { id: 'qa',   label: 'Q&A pairs',  tagline: 'Greetings, FAQs, fixed replies',   icon: Sparkles },
    { id: 'text', label: 'Paste text', tagline: 'Handbook, policies, brand voice',  icon: TypeIcon },
    { id: 'file', label: 'Upload file', tagline: 'PDF, DOCX, TXT, Markdown',        icon: FileUp },
    { id: 'url',  label: 'Crawl URL',  tagline: 'Public page or knowledge article', icon: Globe },
  ];
  const modes = presetKbId
    ? allModes.filter((m) => m.id !== 'qa')
    : allModes;
  // When Q&A is hidden but the user landed in QA mode (initial state
  // defaults to 'qa'), bump them to 'text' so the form actually
  // renders something useful.
  useEffect(() => {
    if (presetKbId && mode === 'qa') setMode('text');
  }, [presetKbId, mode]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Link
        href={`/w/${wsId}/knowledge`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to all training data
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-cyan-200" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">Train your AI</h1>
            {/* Scope badge -- when the user reached this page via
                "Add more data" from a doc, show which KB the new
                training will land in. Stops the "where did my Q&A
                pair go?" question before it gets asked. */}
            {presetKbId && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Adding to KB #{presetKbId}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {presetKbId
              ? 'New training data will be scoped to this knowledge base only.'
              : 'Pick the shape of your data — samples on the right show exactly how each mode should look.'}
          </p>
        </div>
      </div>

      {/* Mode picker -- 3 columns when Q&A is hidden (add-more flow),
          4 columns otherwise. Keeps cards equal width regardless. */}
      <div className={`grid grid-cols-2 ${presetKbId ? 'md:grid-cols-3' : 'md:grid-cols-4'} gap-3 mb-6`}>
        {modes.map((m) => {
          const active = mode === m.id;
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`relative rounded-2xl border p-4 text-left transition-all ${
                active
                  ? 'border-cyan-500/70 bg-cyan-500/[0.10] shadow-[0_0_0_3px_rgba(34,211,238,0.10)]'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/25'
              }`}
            >
              <Icon className={`w-6 h-6 mb-2 ${active ? 'text-cyan-300' : 'text-slate-400'}`} />
              <div className="text-sm font-semibold text-white">{m.label}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{m.tagline}</div>
              {m.id === 'qa' && !active && (
                <span className="absolute top-2 right-2 text-[9px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                  MOST ACCURATE
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Two-column body: form on the left, samples on the right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">

        {/* ── LEFT: form ───────────────────────────────────────── */}
        <div className="space-y-4">
          {mode === 'qa' && (
            <>
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2 text-[12px] text-emerald-100/90 flex-1 mr-3">
                  <strong className="text-emerald-300">Tip:</strong> Multiple question phrasings → one answer.
                  ANY match fires the answer instantly.
                </div>
                <button
                  onClick={loadSampleQA}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 hover:border-cyan-500/50 text-[12px] text-slate-300 hover:text-cyan-300 shrink-0"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Load sample
                </button>
              </div>
              {qaPairs.map((pair, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                      Pair {i + 1}
                    </span>
                    {qaPairs.length > 1 && (
                      <button onClick={() => removeQA(i)} className="text-[11px] text-rose-300 hover:text-rose-200">
                        Remove
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
                      Questions (one per line)
                    </label>
                    <textarea
                      value={pair.questions}
                      onChange={(e) => updateQA(i, { questions: e.target.value })}
                      rows={4}
                      placeholder={'hello\nhi\nhey\ngood morning'}
                      className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
                      Answer
                    </label>
                    <textarea
                      value={pair.answer}
                      onChange={(e) => updateQA(i, { answer: e.target.value })}
                      rows={3}
                      placeholder="Hi there! 👋 How can I help you today?"
                      className="w-full rounded-lg bg-[#080e1c] border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={addQA}
                className="w-full rounded-xl border border-dashed border-white/15 hover:border-cyan-500/40 py-3 text-[12.5px] text-slate-400 hover:text-cyan-300 inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add another Q&A pair
              </button>
            </>
          )}

          {mode === 'text' && (
            <>
              <div className="flex items-center justify-end">
                <button
                  onClick={loadSampleText}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 hover:border-cyan-500/50 text-[12px] text-slate-300 hover:text-cyan-300"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  Load sample
                </button>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 block">
                  Title <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Return policy, Q1 product launch FAQ"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 block">
                  Content
                </label>
                <textarea
                  value={content} onChange={(e) => setContent(e.target.value)}
                  rows={16}
                  placeholder="Paste your handbook, policy, FAQ, or any document text here..."
                  className="w-full rounded-xl bg-[#080e1c] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-mono leading-relaxed"
                />
                <div className="mt-1 text-[10.5px] text-slate-500">
                  {content.length.toLocaleString()} characters · we&apos;ll split into ~500-char chunks with overlap
                </div>
              </div>
            </>
          )}

          {mode === 'file' && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 block">
                  Title <span className="text-slate-500">(optional — defaults to filename)</span>
                </label>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 2026 Pricing Sheet"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <input
                ref={fileInputRef} type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-white/15 hover:border-cyan-500/50 bg-white/[0.01] py-14 text-center transition-colors"
              >
                <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                {file ? (
                  <>
                    <div className="text-base font-semibold text-white">{file.name}</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {(file.size / 1024).toFixed(1)} KB · click to change
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-base font-semibold text-white">Click to upload a file</div>
                    <div className="text-[11px] text-slate-400 mt-1">PDF · DOCX · TXT · MD · max 10 MB</div>
                  </>
                )}
              </button>
            </>
          )}

          {mode === 'url' && (
            <>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 block">
                  Title <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. ACME Help Center"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1 block">
                  URL
                </label>
                <input
                  value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://acme.com/faq"
                  className="w-full rounded-xl bg-white/[0.02] border border-white/10 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
                />
                <div className="mt-1 text-[10.5px] text-slate-500">
                  We fetch the page, strip HTML, and embed the extracted text. Max 2 MB per page.
                </div>
              </div>
            </>
          )}

          {/* ── LLM picker ───────────────────────────────────────
              Two conditions for visibility:
                1. Mode is NOT Q&A -- Q&A is direct-match, no LLM call.
                2. ``presetKbId`` is NOT set -- when the user came from
                   "Add more data" on an existing KB's doc, the LLM was
                   already chosen at KB-creation time. Showing the
                   picker again would imply the choice applies only to
                   this NEW data, which would be confusing (the KB has
                   one model that serves all its docs).
              Filtered to providers the tenant has connected so users
              can't pick a model they can't run. */}
          {mode !== 'qa' && !presetKbId && (
            <LLMSearchSelect
              value={llmModel}
              onChange={setLlmModel}
              options={availableModels}
              connectedCount={connectedProviders.length}
            />
          )}

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-slate-500">
              {mode === 'qa'
                ? 'Direct match — instant reply, zero LLM tokens.'
                : <>Chunked + embedded into the vector index · model: <span className="text-slate-300">{llmModel}</span></>}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/w/${wsId}/knowledge`)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50 inline-flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {mode === 'qa' ? 'Saving…' : 'Embedding…'}</>
                ) : (
                  <><Save className="w-4 h-4" /> {mode === 'qa' ? 'Save pairs' : 'Train'}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: live samples that change with the picked mode ── */}
        <aside className="lg:sticky lg:top-6 self-start">
          <SampleCard mode={mode} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Sample panel -- shows exactly what the user should type / upload
 * for the currently-selected training mode. Updated per-mode so the
 * example matches what they're about to do.
 */
function SampleCard({ mode }: { mode: TrainMode }) {
  if (mode === 'qa') {
    return (
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] overflow-hidden">
        <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-300" />
          <h3 className="text-sm font-bold text-cyan-100">Sample: Q&A pairs</h3>
        </div>
        <div className="p-4 space-y-4 text-[12.5px]">
          <SamplePair
            qs={['hello', 'hi', 'hey', 'good morning', 'namaste']}
            a="Hi there! 👋 How can I help you today?"
          />
          <SamplePair
            qs={['what are your hours', 'when are you open', 'timing']}
            a="We're open Mon–Fri 9am–6pm IST."
          />
          <SamplePair
            qs={['pricing', 'how much', 'cost', 'plans']}
            a="Starter $100/mo · Growth $200/mo · Enterprise $300/mo."
          />
          <SamplePair
            qs={['refund', 'return', 'money back']}
            a="30 days from purchase, unopened items, original packaging."
          />
          <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-cyan-200 block mb-1">Why this works</strong>
            When the user types <em>&quot;how much does it cost?&quot;</em> the word
            <em> &quot;cost&quot;</em> matches Pair 3 → the pricing answer fires INSTANTLY.
            No AI call. No hallucination. No latency.
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'text') {
    return (
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] overflow-hidden">
        <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-300" />
          <h3 className="text-sm font-bold text-cyan-100">Sample: Paste text</h3>
        </div>
        <div className="p-4 space-y-3 text-[12px]">
          <p className="text-slate-300">
            Paste any prose your AI should know about. Use for longer content
            where users will ask varied questions.
          </p>
          <pre className="rounded-lg bg-[#080e1c] border border-white/10 p-3 text-[11px] text-slate-300 whitespace-pre-wrap overflow-x-auto leading-relaxed font-mono">
{`Refund Policy
─────────────
We accept returns within 30 days of purchase.
Items must be in original condition with packaging.

To request a refund:
1. Email support@acme.com with your order number
2. Include the reason for return
3. Wait for our team to send a prepaid label
4. Ship within 7 days of receiving the label
5. Refund credited within 5 business days

Exceptions
──────────
Personalised items and clearance sales are final.`}
          </pre>
          <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-cyan-200 block mb-1">What works best</strong>
            • Plain text or markdown (not HTML)<br />
            • Section headings help retrieval find the right chunk<br />
            • 100–10,000 words per document (split larger docs)<br />
            • No tables or ASCII art that depends on alignment
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'file') {
    return (
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] overflow-hidden">
        <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-cyan-300" />
          <h3 className="text-sm font-bold text-cyan-100">Sample: Upload file</h3>
        </div>
        <div className="p-4 space-y-3 text-[12px]">
          <div className="grid grid-cols-2 gap-2">
            <FileTypeCard ext="PDF" label="Best for" desc="Existing docs you don't want to retype" tick />
            <FileTypeCard ext="DOCX" label="Best for" desc="Word docs from your team" tick />
            <FileTypeCard ext="TXT" label="Best for" desc="Notes, exported chats, logs" tick />
            <FileTypeCard ext="MD" label="Best for" desc="GitHub wikis, KB articles" tick />
          </div>
          <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/30 p-3 text-[11px] text-emerald-100 leading-relaxed">
            <strong className="text-emerald-300 block mb-1">✅ Good PDF</strong>
            Exported from Word / Google Docs. Text is selectable + searchable.
            Tables in narrative form (e.g. &quot;Starter Plan: $100/mo, 5 users&quot;).
          </div>
          <div className="rounded-lg bg-rose-500/[0.06] border border-rose-500/30 p-3 text-[11px] text-rose-100 leading-relaxed">
            <strong className="text-rose-300 block mb-1">❌ Bad PDF</strong>
            Scanned images of printed pages (no text layer = no training).
            Heavy use of multi-column layouts where text wraps across columns.
            Forms / charts where data is encoded as glyphs.
          </div>
          <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 text-[11px] text-slate-300 leading-relaxed">
            <strong className="text-cyan-200 block mb-1">Verify your PDF works</strong>
            Open it in your browser → try to <strong>select &amp; copy</strong> text.
            If you can copy the words out, the AI can read them too.
          </div>
        </div>
      </div>
    );
  }

  // URL mode
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/[0.04] overflow-hidden">
      <div className="px-4 py-3 border-b border-cyan-500/20 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-cyan-300" />
        <h3 className="text-sm font-bold text-cyan-100">Sample: Crawl URL</h3>
      </div>
      <div className="p-4 space-y-3 text-[12px]">
        <p className="text-slate-300">
          Paste a public URL — we fetch the page, strip HTML / scripts, and
          embed the visible text.
        </p>
        <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/30 p-3 text-[11px] text-emerald-100 leading-relaxed">
          <strong className="text-emerald-300 block mb-1">✅ Good URLs</strong>
          <code className="block">https://acme.com/help/refunds</code>
          <code className="block">https://your-blog.com/post-name</code>
          <code className="block">https://docs.example.com/getting-started</code>
          <span className="block mt-2 text-emerald-100/80">
            Static HTML, knowledge-base articles, blog posts, marketing pages.
          </span>
        </div>
        <div className="rounded-lg bg-rose-500/[0.06] border border-rose-500/30 p-3 text-[11px] text-rose-100 leading-relaxed">
          <strong className="text-rose-300 block mb-1">❌ Bad URLs</strong>
          • Pages behind a login (we&apos;re anonymous)<br />
          • Single-page apps that render with JavaScript (we don&apos;t run JS)<br />
          • PDFs at a URL — use Upload file instead<br />
          • YouTube videos — extract the transcript and Paste text
        </div>
        <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 text-[11px] text-slate-300 leading-relaxed">
          <strong className="text-cyan-200 block mb-1">Quick test</strong>
          Open the URL in private/incognito mode. If you can see the content
          without logging in, our crawler can too.
        </div>
      </div>
    </div>
  );
}

function SamplePair({ qs, a }: { qs: string[]; a: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
        Questions
      </div>
      <div className="space-y-0.5 mb-2">
        {qs.map((q, i) => (
          <div key={i} className="text-slate-300 font-mono text-[12px]">{q}</div>
        ))}
      </div>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
        Answer
      </div>
      <div className="rounded-md bg-emerald-500/[0.10] border border-emerald-500/30 px-2.5 py-1.5 text-emerald-100">
        {a}
      </div>
    </div>
  );
}

/**
 * Searchable LLM model dropdown.
 *
 * Replaces the previous grid-of-buttons picker because:
 *   1. The list grows as providers are added -- a grid wraps badly
 *      past ~6 options.
 *   2. Users typing "claude" / "llama" should be able to type-ahead
 *      without scanning all cards.
 *   3. Filtering to connected providers shrinks the list, and an empty
 *      list state needs a clear "go connect a provider" CTA -- easier
 *      in a dropdown shell than a grid.
 *
 * Behaviour:
 *   - Click button → dropdown opens with search input focused.
 *   - Type → fuzzy contains-match on name + hint + provider.
 *   - Pick → closes + fires ``onChange``.
 *   - Click outside → closes without committing.
 */
function LLMSearchSelect({
  value, onChange, options, connectedCount,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; name: string; hint: string; provider: string }>;
  connectedCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) =>
        o.name.toLowerCase().includes(q)
        || o.hint.toLowerCase().includes(q)
        || o.provider.toLowerCase().includes(q),
      )
    : options;

  return (
    <div ref={ref} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
            AI model that will answer questions about this data
          </div>
          <div className="text-[10.5px] text-slate-500 mt-0.5">
            {connectedCount === 0
              ? 'No AI provider connected yet — connect one in Credentials to enable more models.'
              : `Filtered to ${options.length} model(s) from your ${connectedCount} connected provider(s).`}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left rounded-lg border border-white/10 bg-[#080e1c] px-3 py-2.5 flex items-center justify-between hover:border-emerald-500/40"
      >
        <div className="min-w-0">
          {selected ? (
            <>
              <div className="text-[13px] font-semibold text-white truncate">{selected.name}</div>
              <div className="text-[10.5px] text-slate-400 truncate">{selected.hint}</div>
            </>
          ) : (
            <div className="text-[13px] text-slate-500">Select a model…</div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-white/15 bg-[#080e1c] shadow-2xl shadow-black/50 overflow-hidden">
          <div className="p-2 border-b border-white/5">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models…"
              className="w-full bg-transparent text-[12.5px] text-white placeholder:text-slate-600 px-2 py-1.5 focus:outline-none"
            />
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-slate-500">
                {q ? `No models match "${q}".` : 'No connected providers yet.'}
              </div>
            ) : (
              filtered.map((m) => {
                const active = m.id === value;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { onChange(m.id); setOpen(false); setSearch(''); }}
                    className={`w-full text-left px-3 py-2 hover:bg-white/[0.05] flex items-start justify-between gap-3 ${
                      active ? 'bg-emerald-500/[0.08]' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={`text-[12.5px] font-semibold truncate ${active ? 'text-emerald-200' : 'text-white'}`}>
                        {m.name}
                      </div>
                      <div className="text-[10.5px] text-slate-400 truncate">{m.hint}</div>
                    </div>
                    <span className="text-[9.5px] font-mono text-slate-500 shrink-0 mt-0.5">
                      {m.provider}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function FileTypeCard({ ext, label, desc, tick }: { ext: string; label: string; desc: string; tick?: boolean }) {
  return (
    <div className="rounded-lg bg-white/[0.04] border border-white/10 p-2.5">
      <div className="flex items-center gap-1.5 mb-0.5">
        <FileText className="w-3.5 h-3.5 text-cyan-300" />
        <span className="text-[12px] font-bold text-white">{ext}</span>
        {tick && <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-auto" />}
      </div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="text-[10.5px] text-slate-300 mt-0.5">{desc}</div>
    </div>
  );
}
