"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PenLine, Calendar, Type, Hash, CheckSquare, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { SignatureFieldType, SignerInput } from "@/lib/agreements/types";

export interface PlacedField {
  tempId: string;
  signerKey: string;        // which signer (matches SignerInput by index)
  fieldType: SignatureFieldType;
  page: number;
  x: number; y: number; w: number; h: number;   // fractional 0–1
  label?: string;
}

interface SignerLite { key: string; name: string; role: string; color: string }

const TOOLS: { type: SignatureFieldType; label: string; icon: React.ReactNode; w: number; h: number }[] = [
  { type: "signature", label: "Signature", icon: <PenLine className="h-3.5 w-3.5" />, w: 0.22, h: 0.06 },
  { type: "initials",  label: "Initials",  icon: <Hash className="h-3.5 w-3.5" />,    w: 0.10, h: 0.05 },
  { type: "date",      label: "Date",      icon: <Calendar className="h-3.5 w-3.5" />, w: 0.16, h: 0.04 },
  { type: "text",      label: "Text",      icon: <Type className="h-3.5 w-3.5" />,     w: 0.20, h: 0.04 },
  { type: "checkbox",  label: "Checkbox",  icon: <CheckSquare className="h-3.5 w-3.5" />, w: 0.04, h: 0.04 },
];

export const SIGNER_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#db2777", "#0891b2"];

interface Props {
  mode: "template" | "pdf_upload";
  pdfUrl?: string | null;          // object URL for uploaded PDFs (same-origin blob)
  templateText?: string;           // for template agreements
  signers: SignerInput[];          // from the wizard
  fields: PlacedField[];
  onChange: (fields: PlacedField[]) => void;
}

export function FieldPlacer({ mode, pdfUrl, templateText, signers, fields, onChange }: Props) {
  const signerLites: SignerLite[] = signers.map((s, i) => ({
    key: `${i}`, name: s.name || `Signer ${i + 1}`, role: s.role, color: SIGNER_COLORS[i % SIGNER_COLORS.length],
  }));

  const [activeTool, setActiveTool] = useState<SignatureFieldType>("signature");
  const [activeSigner, setActiveSigner] = useState<string>(signerLites[0]?.key ?? "0");
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [rendering, setRendering] = useState(mode === "pdf_upload");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  // Keep activeSigner valid if the signer list shrinks.
  useEffect(() => {
    if (!signerLites.some((s) => s.key === activeSigner)) setActiveSigner(signerLites[0]?.key ?? "0");
  }, [signers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render PDF page via pdf.js (uploaded mode) ──
  useEffect(() => {
    if (mode !== "pdf_upload" || !pdfUrl) { setRendering(false); return; }
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfworker/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);
        const pg = await pdf.getPage(Math.min(page, pdf.numPages));
        const viewport = pg.getViewport({ scale: 1.4 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pg.render({ canvasContext: ctx, viewport }).promise;
      } catch {
        // If render fails, fall back to a blank page surface
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, pdfUrl, page]);

  const placeField = useCallback((e: React.MouseEvent) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const tool = TOOLS.find(t => t.type === activeTool)!;
    const x = (e.clientX - rect.left) / rect.width - tool.w / 2;
    const y = (e.clientY - rect.top) / rect.height - tool.h / 2;
    const nf: PlacedField = {
      tempId: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      signerKey: activeSigner, fieldType: activeTool, page,
      x: Math.max(0, Math.min(x, 1 - tool.w)), y: Math.max(0, Math.min(y, 1 - tool.h)),
      w: tool.w, h: tool.h,
    };
    onChange([...fields, nf]);
  }, [activeTool, activeSigner, page, fields, onChange]);

  const removeField = (tempId: string) => onChange(fields.filter(f => f.tempId !== tempId));

  const pageFields = fields.filter(f => f.page === page);
  const signerColor = (key: string) => signerLites.find(s => s.key === key)?.color ?? "#2563eb";
  const signerName = (key: string) => signerLites.find(s => s.key === key)?.name ?? "Signer";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      {/* Toolbar */}
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Assign to signer</p>
          <div className="mt-2 space-y-1.5">
            {signerLites.map(s => (
              <button type="button" key={s.key} onClick={() => setActiveSigner(s.key)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors ${activeSigner === s.key ? "border-slate-300 bg-slate-50" : "border-transparent hover:bg-slate-50"}`}>
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{s.name}</span>
                <span className="text-[10px] capitalize text-slate-400">{s.role}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Field to place</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {TOOLS.map(t => (
              <button type="button" key={t.type} onClick={() => setActiveTool(t.type)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${activeTool === t.type ? "border-blue-400 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-400">Click the document to drop a {activeTool} field for <span className="font-medium" style={{ color: signerColor(activeSigner) }}>{signerName(activeSigner)}</span>.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Placed fields ({fields.length})</p>
          {fields.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-400">No fields yet. Drop at least one signature field per signer so they know where to sign.</p>
          ) : (
            <div className="mt-2 space-y-1 max-h-44 overflow-y-auto">
              {fields.map(f => (
                <div key={f.tempId} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-slate-50">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: signerColor(f.signerKey) }} />
                  <span className="flex-1 capitalize text-slate-600">{f.fieldType} · p{f.page}</span>
                  <button type="button" onClick={() => removeField(f.tempId)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Document surface */}
      <div className="rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
        {numPages > 1 && (
          <div className="mb-2 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-xs text-slate-500">Page {page} / {numPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page === numPages} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}

        <div ref={surfaceRef} onClick={placeField}
          className="relative mx-auto max-w-[680px] cursor-crosshair overflow-hidden rounded bg-white shadow"
          style={{ minHeight: mode === "template" ? 760 : undefined }}>
          {/* Background: PDF canvas or template text */}
          {mode === "pdf_upload" ? (
            <>
              {rendering && <div className="flex h-[760px] items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
              <canvas ref={canvasRef} className="block w-full" />
            </>
          ) : (
            <div className="p-10 text-sm leading-7 text-slate-700">
              <h3 className="mb-4 text-lg font-bold text-slate-900">{templateText || "Agreement"}</h3>
              <p>This agreement is made between the parties listed below. By placing your signature you agree to the terms set out herein.</p>
              <p className="mt-3">The services, deliverables, payment terms and obligations of each party are as described in the schedule attached to this agreement. This document is executed electronically and the electronic signatures applied carry the same legal weight as handwritten signatures.</p>
              <p className="mt-3">Each signer confirms they have the authority to enter into this agreement on behalf of the party they represent. The effective date is the date of the final signature.</p>
              <p className="mt-8 text-slate-400">— Signature section —</p>
              <div className="mt-2 h-40" />
            </div>
          )}

          {/* Placed field overlays for this page */}
          {pageFields.map(f => (
            <div key={f.tempId}
              onClick={(e) => { e.stopPropagation(); removeField(f.tempId); }}
              title={`${signerName(f.signerKey)} · ${f.fieldType} (click to remove)`}
              className="group absolute flex items-center justify-center rounded border-2 text-[10px] font-semibold"
              style={{
                left: `${f.x * 100}%`, top: `${f.y * 100}%`,
                width: `${f.w * 100}%`, height: `${f.h * 100}%`,
                borderColor: signerColor(f.signerKey),
                backgroundColor: `${signerColor(f.signerKey)}1a`,
                color: signerColor(f.signerKey),
              }}>
              <span className="pointer-events-none flex items-center gap-1 capitalize">{f.fieldType}</span>
              <Trash2 className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-white p-0.5 text-red-500 opacity-0 shadow group-hover:opacity-100" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Click the document to place the selected field. Click a placed field to remove it.</p>
      </div>
    </div>
  );
}
