import { useMemo, useState } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Target, ChevronRight, ChevronDown, Plus, X, CalendarDays,
  ChevronLeft, ChevronRight as ChevronRightIcon, Layers, Flag,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePrp } from '@/context/PrpContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { formatMinutes, slotToTime, timeToSlot, SLOT_MINUTES } from '@/lib/calendar-utils';
import { findSlotsForTasks, computeFreeTime } from '@/lib/scheduling-utils';
import { calculateEffectivePriority } from '@/lib/priority-engine';
import { PROJECT_TYPE_LABELS } from '@/types/prp';
import type { Task, Project, KeyResult } from '@/types/prp';

function krProgress(kr: KeyResult): number {
  if (kr.metricType === 'boolean') return kr.currentValue >= 1 ? 100 : 0;
  if (kr.targetValue <= 0) return 0;
  return Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
}

export default function Planner() {
  const {
    enterprises, focusPeriods, keyResults, objectives, projects, tasks, prioritySettings,
    getObjectivesForFocus, getKeyResultsForObjective, getProjectsForKeyResult,
    getTasksForProject, getTasksForDate, getAppointmentsForDate,
    getEnterprise, getProjectType, scheduleTask, unscheduleTask,
  } = usePrp();
  const navigate = useNavigate();

  const [enterpriseFilter, setEnterpriseFilter] = useState<string>('all');
  const [date, setDate] = useState<Date>(new Date());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const dateStr = format(date, 'yyyy-MM-dd');
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const activeFocus = useMemo(
    () => focusPeriods
      .filter(f => f.status === 'active')
      .filter(f => enterpriseFilter === 'all' || f.enterpriseId === enterpriseFilter),
    [focusPeriods, enterpriseFilter],
  );

  const dayTasks = getTasksForDate(dateStr);
  const dayAppointments = getAppointmentsForDate(dateStr);

  const workStartSlot = timeToSlot(prioritySettings.workStartTime || '09:00');
  const workEndSlot = timeToSlot(prioritySettings.workEndTime || '19:00');

  const occupancy = useMemo(() => {
    const busy = [
      ...dayTasks,
      ...dayAppointments.map(a => ({
        id: a.id,
        scheduledTime: a.startTime,
        estimatedMinutes: Math.max(
          SLOT_MINUTES,
          (timeToSlot(a.endTime) - timeToSlot(a.startTime)) * SLOT_MINUTES,
        ),
      })),
    ] as Task[];
    return computeFreeTime(busy, workStartSlot, workEndSlot);
  }, [dayTasks, dayAppointments, workStartSlot, workEndSlot]);

  const plannedMinutes = dayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);

  // Tasks not yet scheduled, grouped by project id
  const backlogByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.status !== 'backlog') continue;
      const arr = map.get(t.projectId) || [];
      arr.push(t);
      map.set(t.projectId, arr);
    }
    for (const [k, arr] of map) {
      map.set(k, arr.sort((a, b) =>
        calculateEffectivePriority(b, getProjectType(b.projectId), prioritySettings) -
        calculateEffectivePriority(a, getProjectType(a.projectId), prioritySettings),
      ));
    }
    return map;
  }, [tasks, getProjectType, prioritySettings]);

  const scheduleOnDay = (task: Task) => {
    const busy = [
      ...dayTasks,
      ...dayAppointments.map(a => ({
        id: a.id,
        scheduledTime: a.startTime,
        estimatedMinutes: Math.max(
          SLOT_MINUTES,
          (timeToSlot(a.endTime) - timeToSlot(a.startTime)) * SLOT_MINUTES,
        ),
      })),
    ] as Task[];
    const slots = findSlotsForTasks([task], busy, workStartSlot, workEndSlot);
    const slot = slots.get(task.id);
    if (slot === undefined) {
      toast.error('Nessuno slot libero in questa giornata', {
        description: 'Prova un altro giorno o libera spazio nell\'agenda.',
      });
      return;
    }
    const time = slotToTime(slot);
    scheduleTask(task.id, dateStr, time);
    toast.success(`"${task.title}" pianificata alle ${time}`);
  };

  const renderTaskRow = (task: Task, showEnterprise = false) => {
    const ent = showEnterprise ? getEnterprise(task.enterpriseId) : null;
    return (
      <div
        key={task.id}
        className="flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5 hover:border-primary/40 transition-colors"
        draggable
        onDragStart={e => {
          e.dataTransfer.setData('text/plain', `task:${task.id}`);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        {ent && (
          <span
            className="h-2 w-2 rounded-full shrink-0"
            title={ent.name}
            style={{ backgroundColor: `hsl(${ent.color})` }}
          />
        )}
        <span className="text-sm truncate flex-1">{task.title}</span>
        {ent && (
          <span className="text-[10px] text-muted-foreground shrink-0 max-w-[80px] truncate" title={ent.name}>
            {ent.name}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground shrink-0">{formatMinutes(task.estimatedMinutes)}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          title="Pianifica in questa giornata"
          onClick={() => scheduleOnDay(task)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const renderProject = (project: Project, showEnterprise = false) => {
    const projTasks = (backlogByProject.get(project.id) || []);
    const ent = showEnterprise ? getEnterprise(project.enterpriseId) : null;
    const key = `p-${project.id}`;
    const open = expanded[key] ?? true;
    return (
      <div key={project.id} className="pl-3 border-l border-border/60">
        <button
          className="flex items-center gap-1.5 w-full text-left py-1"
          onClick={() => toggle(key)}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {ent && (
            <span
              className="h-2 w-2 rounded-full shrink-0"
              title={ent.name}
              style={{ backgroundColor: `hsl(${ent.color})` }}
            />
          )}
          <span className="text-sm font-medium truncate">{project.name}</span>
          {ent && (
            <span className="text-[10px] text-muted-foreground shrink-0 max-w-[100px] truncate" title={ent.name}>
              {ent.name}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            {PROJECT_TYPE_LABELS[project.type]}
          </Badge>
          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{projTasks.length}</span>
        </button>
        {open && (
          <div className="space-y-1 pb-2 pl-5">
            {projTasks.length === 0
              ? <p className="text-[11px] text-muted-foreground italic py-1">Nessuna task da pianificare</p>
              : projTasks.map(t => renderTaskRow(t, enterpriseFilter === 'all'))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Piano</h1>
          <p className="text-sm text-muted-foreground">
            Scegli un'impresa per lavorare su Focus, obiettivi e progetti insieme a Radar.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Imprese */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start min-w-0">
          {enterprises.map(ent => {
            const entProjects = projects.filter(p => p.enterpriseId === ent.id);
            const focus = focusPeriods.find(f => f.enterpriseId === ent.id && f.status === 'active');
            const objs = focus ? objectives.filter(o => o.focusPeriodId === focus.id) : [];
            const krs = keyResults.filter(k => objs.some(o => o.id === k.objectiveId));
            const prog = krs.length ? Math.round(krs.reduce((a, k) => a + krProgress(k), 0) / krs.length) : 0;
            const backlog = tasks.filter(t => t.enterpriseId === ent.id && t.status === 'backlog').length;
            const planned = tasks.filter(t => t.enterpriseId === ent.id && t.status === 'scheduled').length;
            return (
              <Card key={ent.id} onClick={() => navigate(`/planner/impresa/${ent.id}`)} className="p-4 flex flex-col gap-3 cursor-pointer hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: `hsl(${ent.color})` }} />
                  <p className="text-base font-semibold truncate flex-1">{ent.name}</p>
                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                {focus ? (
                  <div className="space-y-1">
                    <p className="flex items-center gap-1.5 text-xs"><Target className="h-3.5 w-3.5 text-primary" /><span className="font-medium truncate">{focus.name}</span><span className="ml-auto text-muted-foreground">{prog}%</span></p>
                    <Progress value={prog} className="h-1.5" />
                    <p className="text-[11px] text-muted-foreground">{objs.length} obiettivi · {krs.length} Key Result · fino al {format(new Date(focus.endDate), 'd MMM', { locale: it })}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nessun Focus attivo. Entra per definirlo con Radar.</p>
                )}
                <div className="flex gap-4 text-[11px] text-muted-foreground border-t pt-2">
                  <span><strong className="text-foreground">{entProjects.length}</strong> progetti</span>
                  <span><strong className="text-foreground">{backlog}</strong> nel backlog</span>
                  <span><strong className="text-foreground">{planned}</strong> pianificate</span>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Day panel */}
        <Card
          className="p-3 flex flex-col min-h-[420px]"
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            const data = e.dataTransfer.getData('text/plain');
            if (!data.startsWith('task:')) return;
            const t = tasks.find(x => x.id === data.slice(5));
            if (t) scheduleOnDay(t);
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold flex-1">
              {isToday(date) ? 'Oggi' : format(date, 'EEEE d MMMM', { locale: it })}
            </h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDate(d => addDays(d, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setDate(new Date())}>Oggi</Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDate(d => addDays(d, 1))}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-2">
            <span>Pianificato: <strong className="text-foreground">{formatMinutes(plannedMinutes)}</strong></span>
            <span>Libero: <strong className="text-foreground">{formatMinutes(occupancy.freeMinutes)}</strong></span>
            <span>Blocco max: <strong className="text-foreground">{formatMinutes(occupancy.maxConsecutiveFreeMinutes)}</strong></span>
          </div>
          <Separator className="mb-2" />

          <ScrollArea className="flex-1 max-h-[calc(100dvh-320px)] pr-2">
            <div className="space-y-1.5">
              {dayAppointments.map(a => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 bg-muted/30">
                  <span className="text-[11px] tabular-nums text-muted-foreground w-11 shrink-0">{a.startTime}</span>
                  <span className="text-sm truncate flex-1">{a.title}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Appuntamento</Badge>
                </div>
              ))}
              {[...dayTasks]
                .sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''))
                .map(t => {
                  const ent = getEnterprise(t.enterpriseId);
                  return (
                    <div key={t.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                      <span className="text-[11px] tabular-nums text-muted-foreground w-11 shrink-0">{t.scheduledTime || '--:--'}</span>
                      {ent && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(${ent.color})` }} />}
                      <span className="text-sm truncate flex-1">{t.title}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{formatMinutes(t.estimatedMinutes)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        title="Rimuovi dalla giornata"
                        onClick={() => unscheduleTask(t.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              {dayTasks.length === 0 && dayAppointments.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Giornata vuota. Aggiungi task dall'albero strategico con “+” o trascinandole qui.
                </p>
              )}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
