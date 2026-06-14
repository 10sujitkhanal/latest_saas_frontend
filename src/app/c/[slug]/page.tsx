'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { PublicCampaignsService, type CampaignContent } from '@/services/campaigns.service';

const LABELS: Record<string, string> = { name: 'Your name', email: 'Email', phone: 'Phone', company: 'Company', message: 'Message' };

export default function CampaignLandingPage() {
  const params = useParams();
  const slug = String(params.slug);
  const [content, setContent] = useState<CampaignContent | null>(null);
  const [err, setErr] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    PublicCampaignsService.get(slug)
      .then((r) => { if (r.success) setContent(r.data.content); else setErr(true); })
      .catch(() => setErr(true));
  }, [slug]);

  const accent = content?.theme?.accent || '#10b981';
  const fields = useMemo(() => content?.form_fields?.length ? content.form_fields : ['name', 'email'], [content]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await PublicCampaignsService.submit(slug, form);
      setDone(r.success ? (r.message || "Thanks — we'll be in touch shortly.") : (r.message || 'Something went wrong.'));
    } catch {
      setDone('Could not submit right now. Please try again.');
    } finally { setSubmitting(false); }
  };

  if (err) return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">This page is not available.</div>;
  if (!content) return <div className="min-h-screen grid place-items-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1.5 w-full" style={{ background: accent }} />
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{content.headline}</h1>
        {content.subhead && <p className="mt-3 text-lg text-slate-600">{content.subhead}</p>}
        {content.offer && <p className="mt-5 inline-block rounded-xl px-4 py-2 text-base font-bold text-white" style={{ background: accent }}>{content.offer}</p>}

        {!!content.benefits?.length && (
          <div className="mt-8 grid sm:grid-cols-2 gap-3">
            {content.benefits.map((b, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="font-bold text-slate-800">{b.title}</p>
                {b.desc && <p className="mt-0.5 text-sm text-slate-500">{b.desc}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Lead form */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {done ? (
            <div className="py-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: accent }}>✓</div>
              <p className="mt-3 text-lg font-semibold text-slate-800">{done}</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <p className="text-sm font-bold text-slate-700">Get started</p>
              {fields.map((f) => (
                <input key={f} type={f === 'email' ? 'email' : 'text'} required={f === 'email' || f === 'name'}
                  value={form[f] || ''} onChange={(e) => setForm((v) => ({ ...v, [f]: e.target.value }))}
                  placeholder={LABELS[f] || f}
                  className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2"
                  style={{ ['--tw-ring-color' as string]: accent }} />
              ))}
              <button type="submit" disabled={submitting} className="h-11 w-full rounded-lg text-sm font-bold text-white disabled:opacity-60" style={{ background: accent }}>
                {submitting ? 'Sending…' : (content.cta_label || 'Submit')}
              </button>
            </form>
          )}
        </div>

        {!!content.social_proof?.length && (
          <div className="mt-6 flex flex-wrap gap-2">
            {content.social_proof.map((s, i) => <span key={i} className="rounded-full bg-white border border-slate-200 px-3 py-1 text-xs text-slate-600">“{s}”</span>)}
          </div>
        )}

        {!!content.faq?.length && (
          <div className="mt-8 space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">FAQ</h2>
            {content.faq.map((f, i) => (
              <details key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer font-semibold text-slate-800">{f.q}</summary>
                <p className="mt-1.5 text-sm text-slate-500">{f.a}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
