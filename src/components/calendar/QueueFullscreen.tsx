import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronDown, ChevronRight, ArrowDown, CalendarPlus, Target, Flag, FolderKanban } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import type { Task, TaskPriority, Project } from '@/types/prp';
import { Button } from '@/components/ui/button';
import { TaskQueue } from './TaskQueue';
import { PRIORITY_ORDER, priorityLimitWarning } from '@/lib/priority-limits';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  date: Date;
  timer: React.ComponentProps<typeof TaskQueue>['timer'];
  onOpenTask: (t: Task) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: () => void;
}

const lbl: Record<TaskPriority, string> = { high: 'P1', medium: 'P2', low: 'P3' };
const badge: Record<TaskPriority, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-primary text-primary-foreground',
  low: 'bg-muted text-muted-foreground',
};

/** Coda a tutto schermo: coda del giorno + serbatoio collegato a Focus → Obiettivi → Key Result → Progetti → attività. */
export function QueueFullscreen({ open, onClose, date, timer, onOpenTask, onDragStart, onDragEnd }: Props) {
  const { tasks, enterprises, projects, focusPeriods, objectives, keyResults, updateTask } = usePrp();
  const [entFilter, setEntFilter] = useState<string>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const dayStr = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const openTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const tasksOf = (projectId: string) => openTasks
    .filter(t => t.projectId === projectId)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.scheduledDate || '9').localeCompare(b.scheduledDate || '9'));

  const toggle = (k: string) => setCollapsed(c => ({ ...c, [k]: !c[k] }));
  const visibleEnts = enterprises.filter(e => entFilter === 'all' || e.id === entFilter);

  const addToDay = (t: Task) => {
    const w = priorityLimitWarning(tasks, dayStr, t.priority, t.id);
    updateTask(t.id, { status: 'scheduled', scheduledDate: dayStr, scheduledTime: null as unknown as string });
    if (w) toast.warning(w); else toast.success(`Aggiunta alla coda di ${format(date, 'EEE d MMM', { locale: it })}`);
  };

  const TaskRow = ({ t }: { t: Task }) => {
    const inDay = t.scheduledDate === dayStr && t.status === 'scheduled';
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, t.id)}
        onDragEnd={onDragEnd}
        onClick={() => onOpenTask(t)}
        className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 cursor-pointer hover:bg-accent/50"
      >
        <span className={`text-[9px] font-bold px-1 rounded ${badge[t.priority]}`}>{lbl[t.priority]}</span>
        <span className="text-xs font-medium truncate flex-1">{t.title}</span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {t.status === 'backlog' || !t.scheduledDate ? 'Da pianificare' : format(new Date(t.scheduledDate + 'T00:00'), 'd MMM', { locale: it })}
        </span>
        {!inDay && (
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={e => { e.stopPropagation(); addToDay(t); }}>
            <CalendarPlus className="h-3 w-3 mr-1" />In coda
          </Button>
        )}
      </div>
    );
  };

  const ProjectBlock = ({ p }: { p: Project }) => {
    const list = tasksOf(p.id);
    if (list.length === 0) return null;
    const k = `p:${p.id}`;
    return (
      <div className="ml-4">
        <button onClick={() => toggle(k)} className="flex items-center gap-1.5 py-1 text-xs font-medium w-full text-left">
          {collapsed[k] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <FolderKanban className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{p.name}</span>
          <span className="text-muted-foreground font-normal">({list.length})</span>
        </button>
        {!collapsed[k] && (
          <div className="ml-5 space-y-1 pb-1">
            {list.map(t => <TaskRow key={t.id} t={t} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-background flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div className="shrink-0 flex items-center gap-2 border-b px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <h2 className="text-sm font-semibold">Coda</h2>
        <Button size="sm" variant="outline" className="ml-auto h-8 text-xs" onClick={onClose}>
          <ArrowDown className="h-3.5 w-3.5 mr-1" />Torna al calendario
        </Button>
      </div>

      <div className="shrink-0 border-b px-3 py-2">
        <TaskQueue date={date} timer={timer} onOpenTask={onOpenTask} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </div>

      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Serbatoio</span>
        {[{ id: 'all', name: 'Tutte' }, ...enterprises].map(e => (
          <Button key={e.id} size="sm" variant={entFilter === e.id ? 'default' : 'outline'} className="h-7 text-xs shrink-0" onClick={() => setEntFilter(e.id)}>
            {e.name}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 space-y-4">
        {visibleEnts.map(ent => {
          const entProjects = projects.filter(p => p.enterpriseId === ent.id);
          const focus = focusPeriods.find(f => f.enterpriseId === ent.id && f.status === 'active');
          const objs = focus ? objectives.filter(o => o.focusPeriodId === focus.id) : [];
          const linkedIds = new Set<string>();
          const krBlocks = objs.map(o => ({
            o,
            krs: keyResults.filter(kr => kr.objectiveId === o.id).map(kr => {
              const ps = entProjects.filter(p => p.keyResultId === kr.id);
              ps.forEach(p => linkedIds.add(p.id));
              return { kr, ps };
            }),
          }));
          const others = entProjects.filter(p => !linkedIds.has(p.id));
          const count = openTasks.filter(t => t.enterpriseId === ent.id).length;
          if (entFilter === 'all' && count === 0) return null;
          return (
            <section key={ent.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(${ent.color})` }} />
                <h3 className="text-sm font-semibold">{ent.name}</h3>
                <span className="text-xs text-muted-foreground">({count})</span>
              </div>
              {focus && (
                <div className="mb-2">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary font-semibold mb-1">
                    <Target className="h-3 w-3" />Focus · {focus.name}
                  </p>
                  {krBlocks.map(({ o, krs }) => (
                    <div key={o.id} className="ml-2 mb-1">
                      <p className="text-xs font-semibold">{o.title}</p>
                      {krs.map(({ kr, ps }) => (
                        <div key={kr.id} className="ml-2">
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground py-0.5">
                            <Flag className="h-3 w-3" />{kr.title}
                          </p>
                          {ps.length === 0 ? <p className="ml-4 text-[11px] text-muted-foreground italic">Nessun progetto collegato</p> : ps.map(p => <ProjectBlock key={p.id} p={p} />)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {others.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Operativi e manutenzione</p>
                  {others.map(p => <ProjectBlock key={p.id} p={p} />)}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
