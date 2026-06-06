"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { PenLine, Calendar, Type, Hash, CheckSquare, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import type { SignatureFieldType, SignerInput } from "@/lib/agreements/types";

export interface PlacedField {
  tempId: string;
  signerKey: string;
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
  pdfUrl?: string | null;
  templateText?: string;           // the document body for template agreements
  signers: SignerInput[];
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
  // Active drag/resize operation (ref so move handlers don't need re-binding).
  const dragRef = useRef<null | { id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; moved: boolean }>(null);
  const fieldsRef = useRef(fields); fieldsRef.current = fields;

  useEffect(() => {
    if (!signerLites.some((s) => s.key === activeSigner)) setActiveSigner(signerLites[0]?.key ?? "0");
  }, [signers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render uploaded PDF page (pdf_upload mode).
  useEffect(() => {
    if (mode !== "pdf_upload" || !pdfUrl) { setRendering(false); return; }
    let cancelled = false;
    (async () => {
      setRendering(true);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdfworker/pdf.worker.min.mjs";
        const pdf = await pdfjs.getDocument(pdfUrl).promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);
        const pg = await pdf.getPage(Math.min(page, pdf.numPages));
        const viewport = pg.getViewport({ scale: 1.4 });
        const canvas = canvasRef.current; if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        canvas.width = viewport.width; canvas.height = viewport.height;
        await pg.render({ canvasContext: ctx, viewport }).promise;
      } catch { /* fall back to blank surface */ } finally { if (!cancelled) setRendering(false); }
    })();
    return () => { cancelled = true; };
  }, [mode, pdfUrl, page]);

  const placeField = useCallback((e: React.MouseEvent) => {
    // Ignore the click that ends a drag.
    if (dragRef.current) return;
    const surface = surfaceRef.current; if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const tool = TOOLS.find(t => t.type === activeTool)!;
    const x = (e.clientX - rect.left) / rect.width - tool.w / 2;
    const y = (e.clientY - rect.top) / rect.height - tool.h / 2;
    onChange([...fields, {
      tempId: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      signerKey: activeSigner, fieldType: activeTool, page,
      x: Math.max(0, Math.min(x, 1 - tool.w)), y: Math.max(0, Math.min(y, 1 - tool.h)),
      w: tool.w, h: tool.h,
    }]);
  }, [activeTool, activeSigner, page, fields, onChange]);

  const removeField = (tempId: string) => onChange(fields.filter(f => f.tempId !== tempId));

  // ── drag / resize ──
  const startDrag = (e: React.PointerEvent, f: PlacedField, opMode: "move" | "resize") => {
    e.stopPropagation(); e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { id: f.tempId, mode: opMode, sx: e.clientX, sy: e.clientY, ox: f.x, oy: f.y, ow: f.w, oh: f.h, moved: false };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const surface = surfaceRef.current; if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / rect.width;
    const dy = (e.clientY - d.sy) / rect.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) d.moved = true;
    onChange(fieldsRef.current.map((x) => {
      if (x.tempId !== d.id) return x;
      if (d.mode === "move") {
        return { ...x, x: clamp(d.ox + dx, 0, 1 - x.w), y: clamp(d.oy + dy, 0, 1 - x.h) };
      }
      return { ...x, w: clamp(d.ow + dx, 0.04, 1 - x.x), h: clamp(d.oh + dy, 0.02, 1 - x.y) };
    }));
  };
  const endDrag = (e: React.PointerEvent) => {
    if (dragRef.current) { try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId); } catch {} }
    // Defer clearing so the surface onClick (place) sees it and skips.
    setTimeout(() => { dragRef.current = null; }, 0);
  };

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
          <p className="mt-3 text-[11px] text-slate-400">Click the document to drop a {activeTool} for <span className="font-medium" style={{ color: signerColor(activeSigner) }}>{signerName(activeSigner)}</span>. Drag to move, drag a corner to resize.</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Placed fields ({fields.length})</p>
          {fields.length === 0 ? (
            <p className="mt-2 text-[11px] text-slate-400">No fields yet. Drop at least one signature per signer so they know where to sign.</p>
          ) : (
            <div className="mt-2 space-y-1 max-h-44 overflow-y-auto">
              {fields.map(f => (
                <div key={f.tempId} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-slate-50">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: signerColor(f.signerKey) }} />
                  <span className="flex-1 capitalize text-slate-600">{f.fieldType} · p{f.page}</span>
                  <button type="button" onClick={() => removeField(f.tempId)} className="text-slate-300 hover:text-red-500"><X className="h-3 w-3" /></button>
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
          style={{ minHeight: mode === "template" ? 820 : undefined }}>
          {mode === "pdf_upload" ? (
            <>
              {rendering && <div className="flex h-[760px] items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>}
              <canvas ref={canvasRef} className="block w-full" />
            </>
          ) : (
            <div className="whitespace-pre-wrap px-10 py-12 text-[12.5px] leading-7 text-slate-800" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {templateText || "Agreement"}
            </div>
          )}

          {/* Placed field overlays */}
          {pageFields.map(f => (
            <div key={f.tempId}
              onPointerDown={(e) => startDrag(e, f, "move")}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              title={`${signerName(f.signerKey)} · ${f.fieldType} — drag to move`}
              className="group absolute flex cursor-move items-center justify-center rounded border-2 text-[10px] font-semibold touch-none select-none"
              style={{
                left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`,
                borderColor: signerColor(f.signerKey), backgroundColor: `${signerColor(f.signerKey)}1a`, color: signerColor(f.signerKey),
              }}>
              <span className="pointer-events-none flex items-center gap-1 capitalize">{f.fieldType}</span>
              {/* delete */}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeField(f.tempId); }} onPointerDown={(e) => e.stopPropagation()}
                className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-white text-red-500 shadow opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <X className="h-3 w-3" />
              </button>
              {/* resize handle */}
              <span onPointerDown={(e) => startDrag(e, f, "resize")} onPointerMove={onDragMove} onPointerUp={endDrag}
                className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-white"
                style={{ backgroundColor: signerColor(f.signerKey) }} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">Click to place · drag to move · drag the corner to resize · × to delete.</p>
      </div>
    </div>
  );
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(v, hi)); }
