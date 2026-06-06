'use client';

import { use as reactUse, useEffect, useMemo, useRef, useState } from 'react';
import { signingApi } from '@/lib/agreements/api';
import type { Agreement, SignatureField } from '@/lib/agreements/types';
import { FileSignature, CheckCircle2, XCircle, Loader2, PenLine, Type as TypeIcon } from 'lucide-react';

interface RenderedPage { w: number; h: number; url: string }

export default function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = reactUse(params);
  const [ag, setAg] = useState<Agreement | null>(null);
  const [signerId, setSignerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'signed' | 'declined' | null>(null);

  const [mode, setMode] = useState<'typed' | 'drawn'>('typed');
  const [typed, setTyped] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const [drawnUrl, setDrawnUrl] = useState<string | null>(null);

  // PDF rendering for the field overlay
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    signingApi.getByToken(token)
      .then((r) => { setAg(r.agreement); setSignerId(r.signerId); })
      .catch((e) => setError(e.message || 'Invalid signing link'))
      .finally(() => setLoading(false));
  }, [token]);

  const me = ag?.signers.find((s) => s.id === signerId);

  // This signer's placed fields (prefer top-level fields, fall back to signer.fields).
  const myFields: SignatureField[] = useMemo(() => {
    if (!ag) return [];
    const all = (ag.fields && ag.fields.length) ? ag.fields : ag.signers.flatMap((s) => s.fields || []);
    return all.filter((f) => f.signerId === signerId);
  }, [ag, signerId]);

  // ── Render the PDF to images (for the on-document field overlay) ──
  useEffect(() => {
    const url = ag?.originalPdfUrl;
    if (!url || !myFields.length) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfworker/pdf.worker.min.mjs';
        const pdf = await pdfjs.getDocument(url).promise;
        const out: RenderedPage[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const pg = await pdf.getPage(i);
          const vp = pg.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = vp.width; canvas.height = vp.height;
          await pg.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
          out.push({ w: vp.width, h: vp.height, url: canvas.toDataURL('image/png') });
          if (cancelled) return;
        }
        if (!cancelled) setPages(out);
      } catch {
        if (!cancelled) setPdfFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [ag?.originalPdfUrl, myFields.length]);

  // ── drawn signature canvas ──
  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => { drawing.current = true; const ctx = canvasRef.current!.getContext('2d')!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!; const p = pos(e);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0f172a';
    ctx.lineTo(p.x, p.y); ctx.stroke(); hasDrawn.current = true;
  };
  const up = () => { if (drawing.current && hasDrawn.current) setDrawnUrl(canvasRef.current!.toDataURL('image/png')); drawing.current = false; };
  const clearCanvas = () => { const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); hasDrawn.current = false; setDrawnUrl(null); };

  // The signature the signer has adopted (drives the live on-document preview).
  const adoptedSignature = mode === 'typed' ? typed.trim() : (drawnUrl ? '' : '');
  const hasSignature = mode === 'typed' ? !!typed.trim() : !!drawnUrl;
  const todayStr = new Date().toLocaleDateString();

  // Render a single field's content for the on-document overlay.
  const fieldContent = (f: SignatureField) => {
    switch (f.fieldType) {
      case 'signature':
      case 'initials':
        if (mode === 'drawn' && drawnUrl) return <img src={drawnUrl} alt="signature" className="max-h-full max-w-full object-contain" />;
        if (mode === 'typed' && typed.trim()) return <span className="truncate px-1 text-emerald-800" style={{ fontFamily: 'cursive' }}>{f.fieldType === 'initials' ? typed.trim().split(' ').map((w) => w[0]).join('') : typed.trim()}</span>;
        return <span className="text-[10px] font-semibold text-emerald-700">{f.fieldType === 'initials' ? 'Initials' : 'Sign here'}</span>;
      case 'date':
        return <span className="px-1 text-[11px] text-slate-700">{todayStr}</span>;
      case 'checkbox':
        return (
          <input type="checkbox" checked={fieldValues[f.id] === 'true'} onChange={(e) => setFieldValues((v) => ({ ...v, [f.id]: e.target.checked ? 'true' : 'false' }))} className="h-4 w-4 accent-emerald-600" />
        );
      case 'text':
      default:
        return (
          <input value={fieldValues[f.id] || ''} onChange={(e) => setFieldValues((v) => ({ ...v, [f.id]: e.target.value }))} placeholder="Type…" className="h-full w-full bg-transparent px-1 text-[11px] text-slate-800 outline-none" />
        );
    }
  };

  const buildFieldValues = () => myFields.map((f) => {
    let value = '';
    if (f.fieldType === 'signature') value = mode === 'typed' ? typed.trim() : 'Signed (drawn)';
    else if (f.fieldType === 'initials') value = mode === 'typed' ? typed.trim().split(' ').map((w) => w[0]).join('') : 'Initialled';
    else if (f.fieldType === 'date') value = todayStr;
    else if (f.fieldType === 'checkbox') value = fieldValues[f.id] === 'true' ? 'true' : 'false';
    else value = fieldValues[f.id] || '';
    return { id: f.id, value };
  });

  const submit = async () => {
    if (!consent) { setError('Please accept the consent to sign.'); return; }
    let drawnSignature: string | null = null;
    if (mode === 'drawn') {
      if (!hasDrawn.current && !drawnUrl) { setError('Please draw your signature.'); return; }
      drawnSignature = drawnUrl || canvasRef.current!.toDataURL('image/png');
    } else if (!typed.trim()) { setError('Please type your name to sign.'); return; }
    // Required text fields must be filled.
    const missing = myFields.find((f) => f.fieldType === 'text' && f.required && !(fieldValues[f.id] || '').trim());
    if (missing) { setError('Please fill all required text fields on the document.'); return; }
    setError(''); setBusy(true);
    try {
      await signingApi.sign(token, {
        consentAccepted: true,
        typedSignature: mode === 'typed' ? typed.trim() : '',
        drawnSignature,
        fieldValues: myFields.length ? buildFieldValues() : undefined,
      });
      setDone('signed');
    } catch (e: any) { setError(e.message || 'Could not sign'); }
    finally { setBusy(false); }
  };

  const decline = async () => {
    setBusy(true);
    try { await signingApi.decline(token, reason); setDone('declined'); }
    catch (e: any) { setError(e.message || 'Could not decline'); }
    finally { setBusy(false); }
  };

  if (loading) return <Centered><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></Centered>;
  if (error && !ag) return <Centered><div className="text-center"><XCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" /><p className="text-slate-700 font-semibold">{error}</p></div></Centered>;

  if (done === 'signed') return <Centered><Result icon={<CheckCircle2 className="w-12 h-12 text-emerald-500" />} title="Signed — thank you!" sub="Your signature has been recorded. All parties will be notified when complete." /></Centered>;
  if (done === 'declined') return <Centered><Result icon={<XCircle className="w-12 h-12 text-slate-500" />} title="You declined to sign" sub="The sender has been notified." /></Centered>;

  const alreadyActioned = me && (me.status === 'signed' || me.status === 'declined');
  const showOverlay = !!ag!.originalPdfUrl && myFields.length > 0 && pages.length > 0 && !pdfFailed;

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-slate-800">
          <FileSignature className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-lg">Sign agreement</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <h1 className="text-xl font-black text-slate-900">{ag!.title}</h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">{ag!.type} agreement{ag!.expiryDate ? ` · expires ${ag!.expiryDate}` : ''}</p>

          {ag!.originalPdfUrl && (
            showOverlay ? (
              // Document with the signer's fields overlaid where they must sign.
              <div className="mt-4 space-y-3">
                {myFields.length > 0 && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
                    <PenLine className="w-3.5 h-3.5" /> You have <b>{myFields.length}</b> field{myFields.length > 1 ? 's' : ''} to complete — highlighted below.
                  </div>
                )}
                <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-100 p-2 space-y-3">
                  {pages.map((pg, idx) => {
                    const pageNum = idx + 1;
                    const pf = myFields.filter((f) => f.page === pageNum);
                    return (
                      <div key={idx} className="relative mx-auto bg-white shadow" style={{ maxWidth: 700 }}>
                        <img src={pg.url} alt={`Page ${pageNum}`} className="block w-full" />
                        {pf.map((f) => (
                          <div key={f.id}
                            className="absolute flex items-center justify-center rounded border-2 border-emerald-500 bg-emerald-400/15"
                            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}>
                            {fieldContent(f)}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Fallback: plain document view (pdf.js unavailable / cross-origin).
              <div className="mt-4 rounded-xl overflow-hidden border border-slate-200">
                <iframe src={ag!.originalPdfUrl} className="w-full h-[55vh] bg-white" title="Document to sign" />
              </div>
            )
          )}

          <div className="mt-4 border-t border-slate-100 pt-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Parties</span>
            <div className="mt-2 space-y-1.5">
              {ag!.signers.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span className={s.id === signerId ? 'font-bold text-slate-900' : 'text-slate-600'}>{s.name} <span className="text-xs text-slate-400 capitalize">· {s.role}</span></span>
                  <span className={`text-[11px] font-semibold uppercase ${s.status === 'signed' ? 'text-emerald-600' : s.status === 'declined' ? 'text-rose-600' : 'text-slate-400'}`}>{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {alreadyActioned ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-600">You have already {me!.status} this document.</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <p className="text-sm text-slate-600 mb-4">Signing as <span className="font-bold text-slate-900">{me?.name}</span> ({me?.email})</p>

            {myFields.length > 0 && (
              <p className="text-xs text-slate-500 mb-3">Adopt your signature below — it’s applied to your {myFields.filter((f) => f.fieldType === 'signature' || f.fieldType === 'initials').length || 'highlighted'} field(s) on the document above.</p>
            )}

            <div className="flex gap-1 mb-3 bg-slate-100 rounded-lg p-0.5 w-fit">
              <button onClick={() => setMode('typed')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 ${mode === 'typed' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}><TypeIcon className="w-3.5 h-3.5" /> Type</button>
              <button onClick={() => setMode('drawn')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 ${mode === 'drawn' ? 'bg-white shadow text-emerald-700' : 'text-slate-500'}`}><PenLine className="w-3.5 h-3.5" /> Draw</button>
            </div>

            {mode === 'typed' ? (
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full legal name"
                className="w-full h-14 rounded-xl border border-slate-200 px-4 text-2xl text-slate-900 focus:outline-none focus:border-emerald-500" style={{ fontFamily: 'cursive' }} />
            ) : (
              <div>
                <canvas ref={canvasRef} width={560} height={160} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
                  className="w-full h-40 rounded-xl border border-slate-200 bg-slate-50 touch-none cursor-crosshair" />
                <button onClick={clearCanvas} className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800">Clear</button>
              </div>
            )}

            <label className="flex items-start gap-2 mt-4 cursor-pointer select-none">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-600" />
              <span className="text-xs text-slate-600">I agree this electronic signature is the legal equivalent of my handwritten signature and consent to sign this document electronically.</span>
            </label>

            {error && <div className="mt-3 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</div>}

            <div className="mt-5 flex items-center gap-3">
              <button onClick={submit} disabled={busy} className="h-11 flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Sign document
              </button>
              <button onClick={() => setDeclining((v) => !v)} className="h-11 px-4 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 text-sm font-semibold">Decline</button>
            </div>

            {declining && (
              <div className="mt-3 flex items-center gap-2">
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="flex-1 h-10 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none" />
                <button onClick={decline} disabled={busy} className="h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold disabled:opacity-50">Confirm decline</button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 mt-6">Secured e-signature · {ag!.signingOrder} signing</p>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">{children}</div>;
}
function Result({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center max-w-md">
      <div className="flex justify-center mb-4">{icon}</div>
      <h1 className="text-xl font-black text-slate-900">{title}</h1>
      <p className="text-sm text-slate-500 mt-2">{sub}</p>
    </div>
  );
}
