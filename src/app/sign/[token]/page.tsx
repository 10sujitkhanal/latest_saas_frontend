'use client';

import { use as reactUse, useEffect, useRef, useState } from 'react';
import { signingApi } from '@/lib/agreements/api';
import type { Agreement } from '@/lib/agreements/types';
import { FileSignature, CheckCircle2, XCircle, Loader2, PenLine, Type as TypeIcon } from 'lucide-react';

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

  useEffect(() => {
    signingApi.getByToken(token)
      .then((r) => { setAg(r.agreement); setSignerId(r.signerId); })
      .catch((e) => setError(e.message || 'Invalid signing link'))
      .finally(() => setLoading(false));
  }, [token]);

  const me = ag?.signers.find((s) => s.id === signerId);

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
  const up = () => { drawing.current = false; };
  const clearCanvas = () => { const c = canvasRef.current; if (c) c.getContext('2d')!.clearRect(0, 0, c.width, c.height); hasDrawn.current = false; };

  const submit = async () => {
    if (!consent) { setError('Please accept the consent to sign.'); return; }
    let drawnSignature: string | null = null;
    if (mode === 'drawn') {
      if (!hasDrawn.current) { setError('Please draw your signature.'); return; }
      drawnSignature = canvasRef.current!.toDataURL('image/png');
    } else if (!typed.trim()) { setError('Please type your name to sign.'); return; }
    setError(''); setBusy(true);
    try {
      await signingApi.sign(token, { consentAccepted: true, typedSignature: mode === 'typed' ? typed.trim() : '', drawnSignature });
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

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-slate-800">
          <FileSignature className="w-6 h-6 text-emerald-600" />
          <span className="font-bold text-lg">Sign agreement</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
          <h1 className="text-xl font-black text-slate-900">{ag!.title}</h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">{ag!.type} agreement{ag!.expiryDate ? ` · expires ${ag!.expiryDate}` : ''}</p>
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
