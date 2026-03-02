import { useState, useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, CalendarClock, Repeat, Check, X } from 'lucide-react';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import type { Task, Appointment } from '@/types/prp';
import {
  TOTAL_SLOTS, DESKTOP_SLOT_HEIGHT, slotToTime, timeToSlot, getTaskPosition, formatMinutes,
  computeOverlapLayout, TaskTimeInfo,
} from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot, getDisplayPriority, getPriorityEmoji } from '@/lib/priority-engine';
import { SmartBacklog } from './SmartBacklog';
import { CreateAppointmentDialog } from '@/components/CreateAppointmentDialog';
import { CalendarCreateChoice } from './CalendarCreateChoice';
import { CalendarCreateTaskDialog } from './CalendarCreateTaskDialog';
import { getRitualCalendarColor, getRitualCategoryLabel, getRitualIcon, type RitualData } from '@/lib/ritual-utils';
import { DESKTOP_SLOT_HEIGHT as SH } from '@/lib/calendar-utils';

interface RitualCalendarCardProps {
  ritual: RitualData;
  status: string;
  top: number;
  height: number;
  color: string;
  CatIcon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  time: string;
  onComplete: () => void;
  onSkip: () => void;
  onDelete?: () => void;
}

function RitualCalendarCard({ ritual, status, top, height, color, CatIcon, time, onComplete, onSkip, onDelete }: RitualCalendarCardProps) {
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  const isPlanned = status === 'planned' || status === 'pending';

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      className={`absolute rounded-lg overflow-hidden z-10 cursor-default border-2 group ${isDone ? 'border-solid opacity-60' : isSkipped ? 'border-dashed opacity-30' : 'border-dotted'}`}
      style={{
        top: top + 1,
        height: Math.max(height - 2, DESKTOP_SLOT_HEIGHT - 4),
        right: 2,
        width: '45%',
        backgroundColor: `hsl(${color} / ${isDone ? '0.15' : isSkipped ? '0.05' : '0.08'})`,
        borderColor: `hsl(${color} / ${isDone ? '0.6' : '0.4'})`,
      }}
      title={`${ritual.name} [${isDone ? 'Completato' : isSkipped ? 'Saltato' : 'Pianificato'}]`}
    >
      <div className="p-1.5 h-full flex flex-col">
        <p className={`font-medium text-xs leading-tight truncate flex items-center gap-1 ${isDone ? 'line-through' : ''}`}>
          <CatIcon className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
          {isDone && '✅ '}
          {isSkipped && '⏭ '}
          {ritual.name}
        </p>
        <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(${color} / 0.8)` }}>
          <Repeat className="h-2.5 w-2.5 inline mr-0.5" />
          {time} · {getRitualCategoryLabel(ritual.category)}
        </p>
      </div>

      {/* Action buttons */}
      {isPlanned && (
        <div className="absolute bottom-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-card/95 rounded-md border shadow-sm px-1 py-0.5">
          <button
            onClick={e => { e.stopPropagation(); onComplete(); }}
            className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"
            title="Segna completato"
          >
            <Check className="h-3 w-3" /> Fatto
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSkip(); }}
            className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
            title="Salta"
          >
            <X className="h-3 w-3" /> Salta
          </button>
        </div>
      )}

      {/* Delete/reset for done/skipped */}
      {(isDone || isSkipped) && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded bg-card/90 border shadow-sm text-[10px] text-muted-foreground hover:text-destructive"
          title="Rimuovi"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function DesktopWeekView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { tasks, appointments, getEnterprise, getProject, getProjectType, getAppointmentsForDate, scheduleTask, unscheduleTask, updateTask, deleteAppointment, prioritySettings, getRitualsForDate, isRitualCompleted, rituals, ritualCompletions, planRitualOnDate, completeRitualOnDate, skipRitualOnDate, deleteRitualCompletion } = usePrp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [apptDefaults, setApptDefaults] = useState<{ date?: string; startTime?: string; endTime?: string }>({});
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  // Drag-to-create state
  const [dragCreate, setDragCreate] = useState<{ dayDate: string; startSlot: number; endSlot: number } | null>(null);
  const isDraggingCreate = useRef(false);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} — ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: it })}`;

  // All active rituals for the drag widget
  const activeRituals = rituals.filter(r => r.is_active);
  const getWeeklyCount = (ritualId: string) => {
    return ritualCompletions.filter(c => c.ritual_id === ritualId && c.status === 'done' && days.some(d => format(d, 'yyyy-MM-dd') === c.completed_date)).length;
  };
  const getWeeklyTarget = (ritual: typeof activeRituals[0]) => {
    if (ritual.planning_mode === 'flexible') return ritual.weekly_times_per_week || 2;
    if (ritual.frequency === 'daily') return 7;
    if (ritual.weekly_specific_days?.length) return ritual.weekly_specific_days.length;
    return 1;
  };

  // Auto-scroll to ~8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = timeToSlot('08:00') * DESKTOP_SLOT_HEIGHT;
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.clearData('ritualId');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRitualDragStart = (e: React.DragEvent, ritualId: string) => {
    e.dataTransfer.setData('ritualId', ritualId);
    e.dataTransfer.clearData('taskId');
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleColumnDrop = (e: React.DragEvent, dayDate: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-accent/30');
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    const slotIndex = Math.max(0, Math.min(Math.floor(relativeY / DESKTOP_SLOT_HEIGHT), TOTAL_SLOTS - 1));
    const time = slotToTime(slotIndex);

    const ritualId = e.dataTransfer.getData('ritualId');
    if (ritualId) {
      planRitualOnDate(ritualId, dayDate, time);
      return;
    }

    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;
    scheduleTask(taskId, dayDate, time);
  };

  const handleBacklogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) unscheduleTask(taskId);
  };

  // Current time
  const nowSlot = timeToSlot(format(new Date(), 'HH:mm'));

  return (
    <div className="flex flex-col h-full">
      {/* Week nav */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setApptDefaults({}); setShowCreateTask(true); }}>
            <Clock className="h-4 w-4 mr-1" />
            Task
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setApptDefaults({}); setShowCreateAppt(true); }}>
            <CalendarClock className="h-4 w-4 mr-1" />
            Appuntamento
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(s => subWeeks(s, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Oggi
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(s => addWeeks(s, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {/* Rituals drag widget */}
      {activeRituals.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1 overflow-x-auto shrink-0">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0">
            <Repeat className="h-3 w-3 inline mr-1" />Rituali
          </span>
          {activeRituals.map(r => {
            const count = getWeeklyCount(r.id);
            const target = getWeeklyTarget(r);
            const color = getRitualCalendarColor(r.category);
            const CatIcon = getRitualIcon(r.category);
            const done = count >= target;
            return (
              <div
                key={r.id}
                draggable={!done}
                onDragStart={e => handleRitualDragStart(e, r.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-all ${done ? 'opacity-40 cursor-default' : 'cursor-grab active:cursor-grabbing hover:shadow-sm hover:scale-[1.02]'}`}
                style={{ borderColor: `hsl(${color} / 0.3)`, backgroundColor: `hsl(${color} / 0.06)` }}
                title={done ? 'Completato questa settimana' : 'Trascina sul calendario per segnare completato'}
              >
                <CatIcon className="h-3 w-3" style={{ color: `hsl(${color})` }} />
                <span className="font-medium">{r.name}</span>
                <span className="font-bold" style={{ color: `hsl(${color})` }}>{count}/{target}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-1 min-h-0 gap-3">
        {/* Main grid */}
        <div className="flex-1 border rounded-xl bg-card overflow-hidden flex flex-col">
          {/* Day headers - sticky */}
          <div
            className="grid border-b shrink-0 bg-card"
            style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}
          >
            <div className="p-2" />
            {days.map(day => {
              const dayDate = format(day, 'yyyy-MM-dd');
              const dayTasks = tasks.filter(t => t.scheduledDate === dayDate && (t.status === 'scheduled' || t.status === 'done'));
              const totalMins = dayTasks.filter(t => t.status !== 'done').reduce((s, t) => s + t.estimatedMinutes, 0);
              return (
                <div key={day.toISOString()} className="p-2 text-center border-l">
                  <p className="text-xs text-muted-foreground uppercase font-medium">
                    {format(day, 'EEE', { locale: it })}
                  </p>
                  <p className={`text-lg font-semibold ${isToday(day) ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </p>
                  {totalMins > 0 && (
                    <p className="text-[10px] text-muted-foreground">{formatMinutes(totalMins)}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div ref={scrollRef} className="flex-1 overflow-auto">
            <div
              className="grid"
              style={{ gridTemplateColumns: '52px repeat(7, 1fr)', height: TOTAL_SLOTS * DESKTOP_SLOT_HEIGHT }}
            >
              {/* Time column */}
              <div className="relative">
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
                  if (i % 2 !== 0) return null;
                  return (
                    <div
                      key={i}
                      className="absolute right-2 text-[11px] text-muted-foreground tabular-nums"
                      style={{ top: i * DESKTOP_SLOT_HEIGHT - 7 }}
                    >
                      {slotToTime(i)}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {days.map(day => {
                const dayDate = format(day, 'yyyy-MM-dd');
                const dayTasks = tasks.filter(t => t.scheduledDate === dayDate && (t.status === 'scheduled' || t.status === 'done'));
                const dayAppts = getAppointmentsForDate(dayDate);
                const isCurrent = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`relative border-l transition-colors select-none ${isCurrent ? 'bg-accent/20' : ''}`}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-accent/30'); }}
                    onDragLeave={e => { e.currentTarget.classList.remove('bg-accent/30'); }}
                    onDrop={e => handleColumnDrop(e, dayDate)}
                    onMouseDown={e => {
                      if (e.button !== 0) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
                      const slot = Math.max(0, Math.min(Math.floor(relativeY / DESKTOP_SLOT_HEIGHT), TOTAL_SLOTS - 1));
                      isDraggingCreate.current = true;
                      setDragCreate({ dayDate, startSlot: slot, endSlot: slot + 1 });
                    }}
                    onMouseMove={e => {
                      if (!isDraggingCreate.current || !dragCreate || dragCreate.dayDate !== dayDate) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
                      const slot = Math.max(0, Math.min(Math.floor(relativeY / DESKTOP_SLOT_HEIGHT) + 1, TOTAL_SLOTS));
                      if (slot !== dragCreate.endSlot) {
                        setDragCreate(prev => prev ? { ...prev, endSlot: Math.max(prev.startSlot + 1, slot) } : null);
                      }
                    }}
                    onMouseUp={() => {
                      if (!isDraggingCreate.current || !dragCreate) return;
                      isDraggingCreate.current = false;
                      const startSlot = Math.min(dragCreate.startSlot, dragCreate.endSlot);
                      const endSlot = Math.max(dragCreate.startSlot, dragCreate.endSlot);
                      setApptDefaults({
                        date: dragCreate.dayDate,
                        startTime: slotToTime(startSlot),
                        endTime: slotToTime(Math.max(startSlot + 1, endSlot)),
                      });
                      setDragCreate(null);
                      setShowChoice(true);
                    }}
                    onMouseLeave={() => {
                      if (isDraggingCreate.current) {
                        // Keep selection visible but stop extending
                      }
                    }}
                  >
                    {/* Grid lines */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 h-px ${i % 2 === 0 ? 'bg-border/60' : 'bg-border/25'}`}
                        style={{ top: i * DESKTOP_SLOT_HEIGHT }}
                      />
                    ))}

                    {/* Drag-to-create selection */}
                    {dragCreate && dragCreate.dayDate === dayDate && (
                      <div
                        className="absolute left-1 right-1 rounded-lg bg-primary/20 border-2 border-primary/40 z-30 pointer-events-none flex items-center justify-center"
                        style={{
                          top: Math.min(dragCreate.startSlot, dragCreate.endSlot) * DESKTOP_SLOT_HEIGHT,
                          height: Math.abs(dragCreate.endSlot - dragCreate.startSlot) * DESKTOP_SLOT_HEIGHT,
                        }}
                      >
                        <span className="text-xs font-medium text-primary">
                          {slotToTime(Math.min(dragCreate.startSlot, dragCreate.endSlot))} – {slotToTime(Math.max(dragCreate.startSlot, dragCreate.endSlot))}
                        </span>
                      </div>
                    )}

                    {/* Current time line */}
                    {isCurrent && (
                      <div
                        className="absolute left-0 right-0 flex items-center z-20 pointer-events-none"
                        style={{ top: nowSlot * DESKTOP_SLOT_HEIGHT }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-destructive -ml-1" />
                        <div className="flex-1 h-0.5 bg-destructive" />
                      </div>
                    )}

                    {/* Task blocks */}
                    {(() => {
                      const taskTimeInfos: TaskTimeInfo[] = dayTasks.map(t => {
                        const time = t.scheduledTime || '09:00';
                        const startSlot = timeToSlot(time);
                        return { id: t.id, startSlot, endSlot: startSlot + Math.ceil(t.estimatedMinutes / 30) };
                      });
                      const layout = computeOverlapLayout(taskTimeInfos);

                      return dayTasks.map(task => {
                        const time = task.scheduledTime || '09:00';
                        const { top, height } = getTaskPosition(time, task.estimatedMinutes, DESKTOP_SLOT_HEIGHT);
                        const ent = getEnterprise(task.enterpriseId);
                        const taskLayout = layout.get(task.id);
                        const col = taskLayout?.column ?? 0;
                        const totalCols = taskLayout?.totalColumns ?? 1;
                        const widthPercent = 100 / totalCols;
                        const leftPercent = col * widthPercent;

                          const isDone = task.status === 'done';
                          return (
                          <div
                            key={task.id}
                            draggable={!isDone}
                            onDragStart={e => !isDone && handleDragStart(e, task.id)}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); setEditingTask(task); }}
                            className={`absolute rounded-lg overflow-hidden cursor-pointer group z-10 ${isDone ? 'opacity-40' : ''}`}
                            style={{
                              top: top + 1,
                              height: Math.max(height - 2, DESKTOP_SLOT_HEIGHT - 4),
                              left: `calc(${leftPercent}% + 2px)`,
                              width: `calc(${widthPercent}% - 4px)`,
                              backgroundColor: `hsl(${ent?.color || '0 0% 50%'} / 0.15)`,
                              borderLeft: `3px solid hsl(${ent?.color || '0 0% 50%'})`,
                            }}
                          >
                            <div className="p-1.5 h-full flex flex-col">
                              <p className={`font-medium text-xs leading-tight truncate ${isDone ? 'line-through' : ''}`}>
                                {isDone ? '✅ ' : getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings)) + ' '}
                                {task.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {ent?.name} · {formatMinutes(task.estimatedMinutes)}
                              </p>
                            </div>

                            {/* Resize controls on hover (not for done tasks) */}
                            {!isDone && (
                            <div className="absolute bottom-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-card/90 rounded-md border shadow-sm px-1 py-0.5">
                              {task.estimatedMinutes > 30 && (
                                <button
                                  onClick={e => { e.stopPropagation(); updateTask(task.id, { estimatedMinutes: task.estimatedMinutes - 30 }); }}
                                  className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent"
                                >
                                  −30
                                </button>
                              )}
                              <button
                                onClick={e => { e.stopPropagation(); updateTask(task.id, { estimatedMinutes: task.estimatedMinutes + 30 }); }}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent"
                              >
                                +30
                              </button>
                            </div>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {/* Appointment blocks */}
                    {dayAppts.map(appt => {
                      const startSlot = timeToSlot(appt.startTime);
                      const endSlot = timeToSlot(appt.endTime);
                      const slots = Math.max(1, endSlot - startSlot);
                      const top = startSlot * DESKTOP_SLOT_HEIGHT;
                      const height = slots * DESKTOP_SLOT_HEIGHT;
                      const ent = appt.enterpriseId ? getEnterprise(appt.enterpriseId) : null;
                      const color = appt.color || ent?.color || '270 60% 55%';

                      return (
                        <div
                          key={appt.id}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => { e.stopPropagation(); setEditingAppt(appt); }}
                          className="absolute rounded-lg overflow-hidden z-10 border-2 border-dashed cursor-pointer group"
                          style={{
                            top: top + 1,
                            height: Math.max(height - 2, DESKTOP_SLOT_HEIGHT - 4),
                            left: 2,
                            right: 2,
                            backgroundColor: `hsl(${color} / 0.1)`,
                            borderColor: `hsl(${color} / 0.4)`,
                          }}
                          title={`${appt.title}\n${appt.startTime}–${appt.endTime}`}
                        >
                          <div className="p-1.5 h-full flex flex-col">
                            <p className="font-medium text-xs leading-tight truncate flex items-center gap-1">
                              <CalendarClock className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                              {appt.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {appt.startTime}–{appt.endTime}
                              {ent ? ` · ${ent.name}` : ''}
                            </p>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); deleteAppointment(appt.id); }}
                            className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded bg-card/90 border shadow-sm text-[10px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}

                    {/* Ritual blocks (fixed - from schedule) */}
                    {(() => {
                      const dayRituals = getRitualsForDate(day).filter(r => r.planning_mode === 'fixed');
                      return dayRituals.map(ritual => {
                        const time = ritual.suggested_time || '07:00';
                        const startSlot = timeToSlot(time);
                        const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                        const topPos = startSlot * DESKTOP_SLOT_HEIGHT;
                        const heightVal = slotsNeeded * DESKTOP_SLOT_HEIGHT;
                        const color = getRitualCalendarColor(ritual.category);
                        const comp = ritualCompletions.find(c => c.ritual_id === ritual.id && c.completed_date === dayDate);
                        const status = comp?.status || 'pending';
                        const CatIcon = getRitualIcon(ritual.category);

                        return (
                          <RitualCalendarCard
                            key={`ritual-${ritual.id}-${dayDate}`}
                            ritual={ritual}
                            status={status}
                            top={topPos}
                            height={heightVal}
                            color={color}
                            CatIcon={CatIcon}
                            time={time}
                            onComplete={() => {
                              if (!comp) {
                                // Plan then complete
                                planRitualOnDate(ritual.id, dayDate, time).then(() => completeRitualOnDate(ritual.id, dayDate));
                              } else {
                                completeRitualOnDate(ritual.id, dayDate);
                              }
                            }}
                            onSkip={() => {
                              if (!comp) {
                                planRitualOnDate(ritual.id, dayDate, time).then(() => skipRitualOnDate(ritual.id, dayDate));
                              } else {
                                skipRitualOnDate(ritual.id, dayDate);
                              }
                            }}
                            onDelete={comp ? () => deleteRitualCompletion(comp.id) : undefined}
                          />
                        );
                      });
                    })()}

                    {/* Flexible ritual blocks (from drag & drop) */}
                    {(() => {
                      const dayCompletions = ritualCompletions.filter(c => c.completed_date === dayDate && c.completed_time);
                      return dayCompletions.map(comp => {
                        const ritual = rituals.find(r => r.id === comp.ritual_id);
                        if (!ritual || ritual.planning_mode === 'fixed') return null;
                        const time = comp.completed_time!;
                        const startSlot = timeToSlot(time);
                        const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                        const topPos = startSlot * DESKTOP_SLOT_HEIGHT;
                        const heightVal = slotsNeeded * DESKTOP_SLOT_HEIGHT;
                        const color = getRitualCalendarColor(ritual.category);
                        const CatIcon = getRitualIcon(ritual.category);

                        return (
                          <RitualCalendarCard
                            key={`ritual-comp-${comp.id}`}
                            ritual={ritual}
                            status={comp.status}
                            top={topPos}
                            height={heightVal}
                            color={color}
                            CatIcon={CatIcon}
                            time={time}
                            onComplete={() => completeRitualOnDate(ritual.id, dayDate)}
                            onSkip={() => skipRitualOnDate(ritual.id, dayDate)}
                            onDelete={() => deleteRitualCompletion(comp.id)}
                          />
                        );
                      });
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <SmartBacklog
          onDragStart={handleDragStart}
          onDrop={handleBacklogDrop}
        />
      </div>

      <CalendarCreateChoice
        open={showChoice}
        onOpenChange={setShowChoice}
        timeLabel={`${apptDefaults.date ?? ''} · ${apptDefaults.startTime ?? ''} – ${apptDefaults.endTime ?? ''}`}
        onChooseAppointment={() => { setShowChoice(false); setShowCreateAppt(true); }}
        onChooseTask={() => { setShowChoice(false); setShowCreateTask(true); }}
      />

      <CreateAppointmentDialog
        open={showCreateAppt}
        onOpenChange={setShowCreateAppt}
        defaultDate={apptDefaults.date}
        defaultTime={apptDefaults.startTime}
        defaultEndTime={apptDefaults.endTime}
      />

      <CalendarCreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        defaultDate={apptDefaults.date}
        defaultTime={apptDefaults.startTime}
        defaultEndTime={apptDefaults.endTime}
      />

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
        />
      )}

      <EditAppointmentDialog
        open={!!editingAppt}
        onOpenChange={(open) => !open && setEditingAppt(null)}
        appointment={editingAppt}
      />
    </div>
  );
}
