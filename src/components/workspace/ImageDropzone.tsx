'use client';

/**
 * Reusable image upload dropzone — drag-and-drop OR click, with a large preview
 * and replace/remove. Used by the listing form and (next) the sellable-setup
 * wizard, so owners get the same obvious "add a photo" affordance everywhere.
 *
 * It only STAGES a File (via onFile) + shows a preview; the caller uploads it
 * after the row exists (hero_image needs a listing id). Backend still validates
 * type/size — the client check here is just for a friendlier reject.
 */

import { useRef, useState } from 'react';
import { ImagePlus, RefreshCw, X } from 'lucide-react';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export function ImageDropzone({ previewUrl, onFile, hint, height = 'h-44', className }: {
  /** Existing/staged preview URL (or null/empty for the empty state). */
  previewUrl?: string | null;
  /** Called with the picked File, or null when removed. */
  onFile: (file: File | null) => void;
  hint?: string;
  /** Tailwind height class for the box (default h-44; smaller for grids). */
  height?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return;  // friendly client guard; backend re-validates
    onFile(file);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
      {previewUrl ? (
        <div className={`group relative w-full overflow-hidden rounded-xl border border-white/10 ${height}`}>
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition group-hover:bg-black/50 group-hover:opacity-100">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-white">
              <RefreshCw className="h-3.5 w-3.5" /> Replace
            </button>
            <button type="button" onClick={() => onFile(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black">
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0]); }}
          className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed transition ${height} ${
            dragOver ? 'border-pink-400 bg-pink-500/10' : 'border-white/15 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <ImagePlus className="h-7 w-7 text-pink-300" />
          <span className="text-sm font-semibold text-white">Add a photo</span>
          <span className="px-3 text-center text-[11px] text-slate-400">{hint || 'Drag & drop or click — PNG, JPG, WEBP'}</span>
        </button>
      )}
    </div>
  );
}
