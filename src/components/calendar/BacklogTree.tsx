import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronDown, ChevronRight, CalendarPlus, Target, Flag, FolderKanban } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import type { Task, TaskPriority, Project } from '@/types/prp';
import { Button } from '@/components/ui/button';
import { PRIORITY_ORDER, priorityLimitWarning } from '@/lib/priority-limits';
import { toast } from 'sonner';

interface Props {
  date: Date;
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

/** Backlog gerarchico: Focus → Obiettivi → Key Result → Progetti → attività, più progetti operativi/manutenzione. */
export function BacklogTree({ date, onOpenTask, onDragStart, onDragEnd }: Props) {
  const { tasks, enterprises, projects, focusPeriods, objectives, keyResults, updateTask } = usePrp();
  const [entFilter, setEntFilter] = useState<string>('all');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const dayStr = format(date, 'yyyy-MM-dd');

  const openTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const tasksOf = (projectId: string) => openTasks
    .filter(t => t.projectId === projectId)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.scheduledDate || '9').localeCompare(b.scheduledDate || '9'));
  const toggle = (k: string) => setCollapsed(c => ({ ...c, [k]: !c[k] }));
  const visibleEnts = enterprises.filter(e => entFilter === 'all' || e.id === entFilter);

  const addToDay = (t: Task) => {
    const w = priorityLimitWarning(tasks, dayStr, t.priority, t.id);
    updateTask(t.id, { status: 'scheduled', scheduledDate: dayStr, scheduledTime: null as unknown as string });
    if (w) toast.warning(w); else toast.success(`Aggiunta a ${format(date, 'EEE d MMM', { locale: it })}`);
  };

  const TaskRow = ({ t }: { t: Task }) => {
    const planned = t.status === 'scheduled' && !!t.scheduledDate;
    const inDay = planned && t.scheduledDate === dayStr;
    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, t.id)}
        onDragEnd={onDragEnd}
        onClick={() => onOpenTask(t)}
        className={`flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-accent/50 transition-opacity ${planned ? 'opacity-40' : ''}`}
      >
        <span className={`text-[9px] font-bold px-1 rounded ${badge[t.priority]}`}>{lbl[t.priority]}</span>
        <span className="text-xs font-medium truncate flex-1">{t.title}</span>
        {planned ? (
          <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(t.scheduledDate + 'T00:00'), 'd MMM', { locale: it })}</span>
        ) : null}
        {!inDay && (
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Aggiungi al giorno" aria-label="Aggiungi al giorno" onClick={e => { e.stopPropagation(); addToDay(t); }}>
            <CalendarPlus className="h-3.5 w-3.5" />
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
      <div className="ml-1">
        <button onClick={() => toggle(k)} className="flex items-center gap-1.5 py-1 text-xs font-medium w-full text-left">
          {collapsed[k] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <FolderKanban className="h-3 w-3 text-muted-foreground" />
          <span className="truncate">{p.name}</span>
          <span className="text-muted-foreground font-normal">({list.length})</span>
        </button>
        {!collapsed[k] && <div className="ml-3 space-y-1 pb-1">{list.map(t => <TaskRow key={t.id} t={t} />)}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[{ id: 'all', name: 'Tutte' }, ...enterprises].map(e => (
          <Button key={e.id} size="sm" variant={entFilter === e.id ? 'default' : 'outline'} className="h-6 px-2 text-[11px] shrink-0" onClick={() => setEntFilter(e.id)}>
            {e.name}
          </Button>
        ))}
      </div>
      {visibleEnts.map(ent => {
        const entProjects = projects.filter(p => p.enterpriseId === ent.id);
        const focus = focusPeriods.find(f => f.enterpriseId === ent.id && f.status === 'active');
        const objs = focus ? objectives.filter(o => o.focusPeriodId === focus.id) : [];
        const linkedIds = new Set<string>();
        const krBlocks = objs.map(o => ({
          o,
          krs: keyResults.filter(kr => kr.objectiveId === o.id).map(kr => {
            const ps = entProjects.filter(p => p.keyResultId === kr.id && tasksOf(p.id).length > 0);
            ps.forEach(p => linkedIds.add(p.id));
            return { kr, ps };
          }).filter(({ ps }) => ps.length > 0),
        })).filter(({ krs }) => krs.length > 0);
        const others = entProjects.filter(p => !linkedIds.has(p.id) && tasksOf(p.id).length > 0);
        const count = openTasks.filter(t => t.enterpriseId === ent.id).length;
        if (count === 0) return null;
        return (
          <section key={ent.id} className="rounded-lg border bg-background p-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${ent.color})` }} />
              <h3 className="text-xs font-semibold">{ent.name}</h3>
              <span className="text-[11px] text-muted-foreground">({count})</span>
            </div>
            {focus && krBlocks.length > 0 && (
              <div className="mb-1">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
                  <Target className="h-3 w-3" />Focus · {focus.name}
                </p>
                {krBlocks.map(({ o, krs }) => (
                  <div key={o.id} className="ml-1 mb-1">
                    <p className="text-[11px] font-semibold">{o.title}</p>
                    {krs.map(({ kr, ps }) => (
                      <div key={kr.id} className="ml-1">
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground py-0.5"><Flag className="h-3 w-3" />{kr.title}</p>
                        {ps.map(p => <ProjectBlock key={p.id} p={p} />)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {others.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">Operativi e manutenzione</p>
                {others.map(p => <ProjectBlock key={p.id} p={p} />)}
              </div>
            )}
          </section>
        );
      })}
      {visibleEnts.every(ent => openTasks.every(t => t.enterpriseId !== ent.id)) && (
        <p className="text-xs text-muted-foreground text-center py-6">Nessuna attività aperta nel backlog.</p>
      )}
    </div>
  );
}
