import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Check, Clock, X, ListOrdered, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import type { Task } from '@/types/prp';
import { PRIORITY_DAILY_LIMITS, PRIORITY_ORDER } from '@/lib/priority-limits';

interface Props {
  date: Date;
  timer: {
    activeTaskId: string | null | undefined;
    now: number;
    start: (t: Task) => void;
    pause: () => void;
    complete: (t: Task) => void;
  };
  onOpenTask: (t: Task) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: () => void;
}

const fmt = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const badge: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-primary text-primary-foreground',
  low: 'bg-muted text-muted-foreground',
};
const lbl: Record<string, string> = { high: 'P1', medium: 'P2', low: 'P3' };

/** Coda Operativa: task del giorno ordinate per priorità, con Avvia/Pausa/Completa. Scorrevole orizzontalmente con frecce. */
export function TaskQueue({ date, timer, onOpenTask, onDragStart, onDragEnd }: Props) {
  const { tasks, timeEntries, updateTask } = usePrp();
  const [over, setOver] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false); onDragEnd?.();
    const data = e.dataTransfer.getData('text/plain');
    if (!data.startsWith('task:')) return;
    const id = data.slice(5);
    updateTask(id, { status: 'scheduled', scheduledDate: format(date, 'yyyy-MM-dd'), scheduledTime: null as unknown as string });
  };
  const dayStr = format(date, 'yyyy-MM-dd');
  const list = tasks
    .filter(t => t.scheduledDate === dayStr && t.status !== 'backlog' && t.status !== 'done')
    .sort((a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.scheduledTime || '99').localeCompare(b.scheduledTime || '99'));

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list.length, updateArrows]);

  const scrollByDir = (dir: number) => {
    scrollerRef.current?.scrollBy({ left: dir * 244, behavior: 'smooth' });
  };

  const worked = (id: string) => timeEntries.filter(te => te.taskId === id).reduce((s, te) => {
    if (te.endedAt) return s + (te.durationMinutes || 0);
    return s + Math.max(0, Math.round((timer.now - new Date(te.startedAt).getTime()) / 60000));
  }, 0);

  const counts = (['high', 'medium', 'low'] as const).map(p => ({
    p, n: list.filter(t => t.priority === p).length, max: PRIORITY_DAILY_LIMITS[p],
  }));

  return (
    <div
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col gap-1 px-1 rounded-lg transition-colors ${over ? 'bg-primary/10 ring-2 ring-primary/40' : ''}`}
    >
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
        <ListOrdered className="h-3 w-3" />
        <span className="font-medium">Coda · {format(date, 'EEE d MMM', { locale: it })}</span>
        <span className="ml-auto flex gap-2 normal-case tracking-normal">
          {counts.map(c => (
            <span key={c.p} className={c.n > c.max ? 'text-destructive font-semibold' : ''}>{lbl[c.p]} {c.n}/{c.max}</span>
          ))}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">Nessuna attività. Premi "Aggiungi" nella barra qui sotto o trascina qui un'attività dal calendario.</p>
      ) : (
        <div className="relative">
          {canLeft && (
            <button
              aria-label="Scorri a sinistra"
              onClick={() => scrollByDir(-1)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-full border bg-card/95 shadow-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <div
            ref={scrollerRef}
            onScroll={updateArrows}
            className="flex gap-1.5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-pl-1 pb-0.5"
          >
            {list.map(t => {
              const running = timer.activeTaskId === t.id;
              const w = worked(t.id);
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={e => onDragStart(e, t.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpenTask(t)}
                  className={`shrink-0 w-[220px] snap-start rounded-lg border px-2 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors ${running ? 'bg-accent/40' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-bold px-1 rounded ${badge[t.priority]}`}>{lbl[t.priority]}</span>
                    <span className="text-xs font-medium truncate flex-1">{t.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`text-[10px] ${w > t.estimatedMinutes ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {fmt(w)} / {fmt(t.estimatedMinutes)}
                    </span>
                    {t.scheduledTime && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />{t.scheduledTime.slice(0, 5)}
                        <button aria-label="Rimuovi orario" title="Rimuovi orario" onClick={e => { e.stopPropagation(); updateTask(t.id, { scheduledTime: null as unknown as string }); }} className="hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    )}
                    <span className="ml-auto flex gap-1">
                      {running ? (
                        <button aria-label="Pausa" onClick={e => { e.stopPropagation(); timer.pause(); }} className="h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground"><Pause className="h-3 w-3" /></button>
                      ) : (
                        <button aria-label="Avvia" onClick={e => { e.stopPropagation(); timer.start(t); }} className="h-5 w-5 flex items-center justify-center rounded border hover:bg-accent"><Play className="h-3 w-3" /></button>
                      )}
                      <button aria-label="Completa" onClick={e => { e.stopPropagation(); timer.complete(t); }} className="h-5 w-5 flex items-center justify-center rounded border hover:bg-accent"><Check className="h-3 w-3" /></button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {canRight && (
            <button
              aria-label="Scorri a destra"
              onClick={() => scrollByDir(1)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-7 w-7 flex items-center justify-center rounded-full border bg-card/95 shadow-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
