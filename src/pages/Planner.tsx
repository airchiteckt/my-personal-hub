import { useMemo, useState } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Target, ChevronRight, ChevronDown, Plus, X, CalendarDays,
  ChevronLeft, ChevronRight as ChevronRightIcon, Layers, Flag,
} from 'lucide-react';
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
    enterprises, focusPeriods, objectives, projects, tasks, prioritySettings,
    getObjectivesForFocus, getKeyResultsForObjective, getProjectsForKeyResult,
    getTasksForProject, getTasksForDate, getAppointmentsForDate,
    getEnterprise, getProjectType, scheduleTask, unscheduleTask,
  } = usePrp();

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
            Dagli obiettivi alla giornata: scegli cosa fare oggi partendo da Focus, Obiettivi e Progetti.
          </p>
        </div>
        <Select value={enterpriseFilter} onValueChange={setEnterpriseFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Tutte le imprese" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le imprese</SelectItem>
            {enterprises.map(e => (
              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Strategy tree */}
        <Card className="p-3 flex flex-col min-h-[420px]">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Focus attivi → Obiettivi → Key Result → Progetti</h2>
          </div>
          <Separator className="mb-2" />
          <ScrollArea className="flex-1 max-h-[calc(100dvh-260px)] pr-2">
            {activeFocus.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nessun Focus attivo. Creane uno dalla scheda impresa per pianificare in modo strategico.
              </p>
            )}
            <div className="space-y-3">
              {activeFocus.map(focus => {
                const ent = getEnterprise(focus.enterpriseId);
                const objs = getObjectivesForFocus(focus.id);
                const fKey = `f-${focus.id}`;
                const fOpen = expanded[fKey] ?? true;
                return (
                  <div key={focus.id} className="rounded-lg border p-2">
                    <button className="flex items-center gap-2 w-full text-left" onClick={() => toggle(fKey)}>
                      {fOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      {ent && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${ent.color})` }} />}
                      <span className="text-sm font-semibold truncate">{focus.name}</span>
                      {ent && enterpriseFilter === 'all' && (
                        <span className="text-[11px] text-muted-foreground shrink-0 max-w-[120px] truncate" title={ent.name}>
                          {ent.name}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                        {format(new Date(focus.endDate), 'd MMM', { locale: it })}
                      </span>
                    </button>

                    {fOpen && (
                      <div className="mt-2 space-y-2 pl-4">
                        {objs.length === 0 && (
                          <p className="text-[11px] text-muted-foreground italic">Nessun obiettivo in questo Focus</p>
                        )}
                        {objs.map(obj => {
                          const krs = getKeyResultsForObjective(obj.id);
                          const oKey = `o-${obj.id}`;
                          const oOpen = expanded[oKey] ?? true;
                          const oProgress = krs.length
                            ? Math.round(krs.reduce((s, k) => s + krProgress(k), 0) / krs.length)
                            : 0;
                          return (
                            <div key={obj.id} className="rounded-md bg-muted/40 p-2">
                              <button className="flex items-center gap-2 w-full text-left" onClick={() => toggle(oKey)}>
                                {oOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                <Flag className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-sm font-medium truncate">{obj.title}</span>
                                <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{oProgress}%</span>
                              </button>
                              <Progress value={oProgress} className="h-1 mt-1.5" />

                              {oOpen && (
                                <div className="mt-2 space-y-2 pl-4">
                                  {krs.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground italic">Nessun Key Result</p>
                                  )}
                                  {krs.map(kr => {
                                    const kProjects = getProjectsForKeyResult(kr.id);
                                    const kKey = `k-${kr.id}`;
                                    const kOpen = expanded[kKey] ?? true;
                                    return (
                                      <div key={kr.id}>
                                        <button className="flex items-center gap-2 w-full text-left" onClick={() => toggle(kKey)}>
                                          {kOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                          <span className="text-[13px] truncate">{kr.title}</span>
                                          <span className="text-[11px] text-muted-foreground ml-auto shrink-0">{krProgress(kr)}%</span>
                                        </button>
                                        {kOpen && (
                                          <div className="mt-1 space-y-1 pl-4">
                                            {kProjects.length === 0
                                              ? <p className="text-[11px] text-muted-foreground italic">Nessun progetto collegato</p>
                                              : kProjects.map(p => renderProject(p, enterpriseFilter === 'all'))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Operational / maintenance projects not linked to KRs */}
              {(() => {
                const others = projects
                  .filter(p => !p.keyResultId)
                  .filter(p => enterpriseFilter === 'all' || p.enterpriseId === enterpriseFilter)
                  .filter(p => (backlogByProject.get(p.id) || []).length > 0);
                if (others.length === 0) return null;
                const key = 'others';
                const open = expanded[key] ?? false;
                return (
                  <div className="rounded-lg border p-2">
                    <button className="flex items-center gap-2 w-full text-left" onClick={() => toggle(key)}>
                      {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Progetti operativi e di mantenimento</span>
                      <span className="text-[11px] text-muted-foreground ml-auto">{others.length}</span>
                    </button>
                    {open && <div className="mt-2 space-y-1 pl-4">{others.map(p => renderProject(p, true))}</div>}
                  </div>
                );
              })()}
            </div>
          </ScrollArea>
        </Card>

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
