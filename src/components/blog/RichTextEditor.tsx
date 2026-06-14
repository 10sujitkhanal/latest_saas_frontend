"use client";

import { useEffect, useRef } from "react";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Link2, Quote, Undo2, Redo2 } from "lucide-react";

/**
 * Dependency-free rich-text editor (contentEditable + toolbar → HTML). Emits the
 * inner HTML on every edit. Uncontrolled internally (we set innerHTML once so the
 * caret isn't clobbered on each keystroke). Swappable for TipTap later without
 * changing the value contract (HTML string).
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your post…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Set initial HTML once on mount.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const run = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    emit();
  };

  const addLink = () => {
    const url = window.prompt("Link URL");
    if (url) run("createLink", url);
  };

  const Btn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="rounded p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 p-1.5">
        <Btn title="Bold" onClick={() => run("bold")}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic" onClick={() => run("italic")}><Italic className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn title="Heading 2" onClick={() => run("formatBlock", "H2")}><Heading2 className="h-4 w-4" /></Btn>
        <Btn title="Heading 3" onClick={() => run("formatBlock", "H3")}><Heading3 className="h-4 w-4" /></Btn>
        <Btn title="Quote" onClick={() => run("formatBlock", "BLOCKQUOTE")}><Quote className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn title="Bulleted list" onClick={() => run("insertUnorderedList")}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" onClick={() => run("insertOrderedList")}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="Link" onClick={addLink}><Link2 className="h-4 w-4" /></Btn>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <Btn title="Undo" onClick={() => run("undo")}><Undo2 className="h-4 w-4" /></Btn>
        <Btn title="Redo" onClick={() => run("redo")}><Redo2 className="h-4 w-4" /></Btn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        className="prose prose-slate min-h-[320px] max-w-none p-4 text-sm outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
