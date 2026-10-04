import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  onTitleChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
  titlePlaceholder?: string;
}

/** Single document-like block: plain title (used everywhere) + formatted notes (markdown). */
export function TaskDocumentEditor({ title, onTitleChange, notes, onNotesChange, onSubmit, autoFocus, titlePlaceholder = 'Titolo della task' }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [editingNotes, setEditingNotes] = useState(!notes);

  const autoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 64)}px`;
  };

  const wrap = (before: string, after = before) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = notes.slice(s, e) || 'testo';
    const next = notes.slice(0, s) + before + sel + after + notes.slice(e);
    onNotesChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length); autoGrow(el); });
  };

  const linePrefix = (prefix: string) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const start = notes.lastIndexOf('\n', s - 1) + 1;
    const block = notes.slice(start, e);
    const lines = block.split('\n').map((l, i) => {
      const clean = l.replace(/^(#{1,3} |- \[ \] |- |\d+\. )/, '');
      const p = prefix === '1. ' ? `${i + 1}. ` : prefix;
      return l.startsWith(p) ? clean : p + clean;
    });
    const next = notes.slice(0, start) + lines.join('\n') + notes.slice(e);
    onNotesChange(next);
    requestAnimationFrame(() => { el.focus(); autoGrow(el); });
  };

  const tools = [
    { icon: Bold, label: 'Grassetto', run: () => wrap('**') },
    { icon: Italic, label: 'Corsivo', run: () => wrap('_') },
    { icon: Heading1, label: 'Titolo', run: () => linePrefix('## ') },
    { icon: Heading2, label: 'Sottotitolo', run: () => linePrefix('### ') },
    { icon: List, label: 'Elenco puntato', run: () => linePrefix('- ') },
    { icon: ListOrdered, label: 'Elenco numerato', run: () => linePrefix('1. ') },
    { icon: ListChecks, label: 'Checklist', run: () => linePrefix('- [ ] ') },
  ];

  return (
    <div className="min-w-0 rounded-lg border bg-card focus-within:ring-1 focus-within:ring-ring">
      <input
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onSubmit?.(); } }}
        placeholder={titlePlaceholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent px-3 pt-3 pb-1 text-lg font-semibold outline-none placeholder:text-muted-foreground/60"
      />
      {editingNotes ? (
        <textarea
          ref={el => { (ref as any).current = el; autoGrow(el); }}
          value={notes}
          onChange={e => { onNotesChange(e.target.value); autoGrow(e.target); }}
          onBlur={e => { if (notes.trim() && !e.relatedTarget?.closest('[data-doc-toolbar]')) setEditingNotes(false); }}
          placeholder="Note, dettagli, contesto..."
          className="block w-full resize-none bg-transparent px-3 py-1 text-sm outline-none placeholder:text-muted-foreground/60"
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => { setEditingNotes(true); requestAnimationFrame(() => ref.current?.focus()); }}
          className="prose prose-sm dark:prose-invert max-w-none cursor-text px-3 py-1 text-sm break-words [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1"
        >
          <ReactMarkdown>{notes.replace(/^- \[ \] /gm, '- ☐ ').replace(/^- \[x\] /gim, '- ☑ ')}</ReactMarkdown>
        </div>
      )}
      <div data-doc-toolbar className="flex flex-wrap items-center gap-0.5 border-t px-1.5 py-1">
        {tools.map(t => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            aria-label={t.label}
            onMouseDown={e => e.preventDefault()}
            onClick={() => { if (!editingNotes) setEditingNotes(true); requestAnimationFrame(t.run); }}
            className={cn('rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground')}
          >
            <t.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
}
