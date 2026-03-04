import { useState, useRef, useEffect } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Task, Appointment, Reminder } from '@/types/prp';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { CalendarCreateTaskDialog } from '@/components/calendar/CalendarCreateTaskDialog';
import { ChevronLeft, ChevronRight, Check, ArrowRight, Clock, Plus, Minus, X, CalendarClock, Repeat, ListChecks, BookOpen, Bell } from 'lucide-react';
import {
  TOTAL_SLOTS, MOBILE_SLOT_HEIGHT, slotToTime, timeToSlot, getTaskPosition, formatMinutes,
  computeOverlapLayout, TaskTimeInfo,
} from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot, getDisplayPriority, getPriorityEmoji } from '@/lib/priority-engine';
import { getMoonPhase } from '@/lib/moon-utils';
import { CreateAppointmentDialog } from '@/components/CreateAppointmentDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { getRitualCalendarColor, getRitualCategoryLabel, getRitualIcon } from '@/lib/ritual-utils';
import { JournalDialog } from './JournalDialog';

export function MobileDayView() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [apptDate, setApptDate] = useState<string>();
  const [apptTime, setApptTime] = useState<string>();
  const [taskDate, setTaskDate] = useState<string>();
  const [taskTime, setTaskTime] = useState<string>();
  const [showJournal, setShowJournal] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const { tasks, getEnterprise, getProject, getProjectType, getAppointmentsForDate, scheduleTask, completeTask, unscheduleTask, updateTask, deleteAppointment, getSortedBacklogTasks, prioritySettings, getRitualsForDate, isRitualCompleted, getJournalForDate, saveJournalEntry, deleteJournalEntry, getRemindersForDate } = usePrp();
  const dayAppts = getAppointmentsForDate(dateStr);
  const dayReminders = getRemindersForDate(dateStr);

  const dayTasks = tasks.filter(t => t.scheduledDate === dateStr && (t.status === 'scheduled' || t.status === 'done'));
  const backlogTasks = getSortedBacklogTasks();
  const totalMinutes = dayTasks.filter(t => t.status !== 'done').reduce((s, t) => s + t.estimatedMinutes, 0);

  const isViewingToday = isToday(selectedDate);

  // Auto-scroll to current time or 8am
  useEffect(() => {
    if (!scrollRef.current) return;
    const targetSlot = isViewingToday
      ? Math.max(0, timeToSlot(format(new Date(), 'HH:mm')) - 2)
      : timeToSlot('08:00');
    scrollRef.current.scrollTop = targetSlot * MOBILE_SLOT_HEIGHT;
  }, [selectedDate, isViewingToday]);

  // Current time position
  const nowSlot = timeToSlot(format(new Date(), 'HH:mm'));
  const nowTop = nowSlot * MOBILE_SLOT_HEIGHT;

  const tomorrow = format(addDays(selectedDate, 1), 'yyyy-MM-dd');

  // Check if a slot is occupied by a task
  const isSlotOccupied = (slotIndex: number) => {
    return dayTasks.some(task => {
      const time = task.scheduledTime || '09:00';
      const taskStart = timeToSlot(time);
      const taskEnd = taskStart + Math.ceil(task.estimatedMinutes / 30);
      return slotIndex >= taskStart && slotIndex < taskEnd;
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Date nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(d => addDays(d, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <button
            className="font-semibold capitalize text-base"
            onClick={() => setSelectedDate(new Date())}
          >
            {isViewingToday ? 'Oggi' : format(selectedDate, 'EEEE d MMM', { locale: it })}
            {' '}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">{getMoonPhase(selectedDate).emoji}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {getMoonPhase(selectedDate).nameIt}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </button>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {dayTasks.length} task · {formatMinutes(totalMinutes)}
            </p>
            <button
              onClick={() => setShowJournal(true)}
              className={`text-xs flex items-center gap-0.5 rounded px-1.5 py-0.5 transition-colors ${
                getJournalForDate(dateStr)
                  ? 'text-primary font-medium bg-primary/10'
                  : 'text-muted-foreground/60 hover:text-muted-foreground'
              }`}
            >
              <BookOpen className="h-3 w-3" />
              {getJournalForDate(dateStr) ? '✍️' : ''}
            </button>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectedDate(d => addDays(d, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="relative" style={{ height: TOTAL_SLOTS * MOBILE_SLOT_HEIGHT, marginLeft: 48 }}>
          {/* Time labels + grid lines */}
          {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
            const time = slotToTime(i);
            const isHour = i % 2 === 0;
            return (
              <div key={i} className="absolute left-0 right-0" style={{ top: i * MOBILE_SLOT_HEIGHT }}>
                {/* Time label */}
                <span
                  className="absolute text-[11px] text-muted-foreground tabular-nums"
                  style={{ right: '100%', marginRight: 8, top: -7 }}
                >
                  {isHour ? time : ''}
                </span>
                {/* Grid line */}
                <div className={`absolute left-0 right-0 h-px ${isHour ? 'bg-border' : 'bg-border/40'}`} />
                {/* Tap target for empty slots */}
                {!isSlotOccupied(i) && (
                  <div
                    className="absolute left-0 right-0 cursor-pointer hover:bg-accent/50 active:bg-accent transition-colors"
                    style={{ height: MOBILE_SLOT_HEIGHT }}
                    onClick={() => setSelectedSlot(i)}
                  />
                )}
              </div>
            );
          })}

          {/* Current time indicator */}
          {isViewingToday && nowSlot >= 0 && nowSlot <= TOTAL_SLOTS && (
            <div className="absolute left-0 right-0 flex items-center z-20 pointer-events-none" style={{ top: nowTop }}>
              <div className="h-3 w-3 rounded-full bg-destructive -ml-1.5" />
              <div className="flex-1 h-0.5 bg-destructive" />
            </div>
          )}

          {/* All items with unified overlap layout */}
          {(() => {
            const allTimeInfos: TaskTimeInfo[] = [];
            dayTasks.forEach(t => {
              const time = t.scheduledTime || '09:00';
              const ss = timeToSlot(time);
              allTimeInfos.push({ id: t.id, startSlot: ss, endSlot: ss + Math.ceil(t.estimatedMinutes / 30) });
            });
            dayAppts.forEach(appt => {
              const ss = timeToSlot(appt.startTime);
              const ee = timeToSlot(appt.endTime);
              allTimeInfos.push({ id: `appt-${appt.id}`, startSlot: ss, endSlot: Math.max(ss + 1, ee) });
            });
            const dayRituals = getRitualsForDate(selectedDate).filter(r => r.planning_mode === 'fixed');
            dayRituals.forEach(ritual => {
              const ss = timeToSlot(ritual.suggested_time || '07:00');
              allTimeInfos.push({ id: `ritual-${ritual.id}`, startSlot: ss, endSlot: ss + Math.ceil(ritual.estimated_minutes / 30) });
            });
            // Reminders
            dayReminders.forEach(rem => {
              const ss = timeToSlot(rem.reminderTime || '09:00');
              allTimeInfos.push({ id: `rem-${rem.id}`, startSlot: ss, endSlot: ss + 1 });
            });

            const uLayout = computeOverlapLayout(allTimeInfos);
            const uLS = (itemId: string) => {
              const l = uLayout.get(itemId);
              const col = l?.column ?? 0;
              const totalCols = l?.totalColumns ?? 1;
              const wp = 100 / totalCols;
              return { left: `calc(${col * wp}% + 4px)`, width: `calc(${wp}% - 8px)` };
            };

            return (
              <>
                {/* Task blocks */}
                {dayTasks.map(task => {
                  const time = task.scheduledTime || '09:00';
                  const { top, height } = getTaskPosition(time, task.estimatedMinutes, MOBILE_SLOT_HEIGHT);
                  const enterprise = getEnterprise(task.enterpriseId);
                  const sty = uLS(task.id);
                  const isDone = task.status === 'done';
                  return (
                    <div
                      key={task.id}
                      className={`absolute rounded-xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform z-10 ${isDone ? 'opacity-40' : ''}`}
                      style={{
                        top,
                        height: Math.max(height, MOBILE_SLOT_HEIGHT - 4),
                        ...sty,
                        backgroundColor: `hsl(${enterprise?.color || '0 0% 50%'} / 0.12)`,
                        borderLeft: `4px solid hsl(${enterprise?.color || '0 0% 50%'})`,
                      }}
                      onClick={() => setSelectedTask(task)}
                    >
                      <div className="p-2.5 h-full flex flex-col justify-center">
                        <p className={`font-medium text-sm leading-tight truncate ${isDone ? 'line-through' : ''}`}>
                          {isDone ? '✅ ' : getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings)) + ' '}
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{enterprise?.name}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />{formatMinutes(task.estimatedMinutes)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Appointment blocks */}
                {dayAppts.map(appt => {
                  const startSlot = timeToSlot(appt.startTime);
                  const endSlot = timeToSlot(appt.endTime);
                  const slots = Math.max(1, endSlot - startSlot);
                  const top = startSlot * MOBILE_SLOT_HEIGHT;
                  const height = slots * MOBILE_SLOT_HEIGHT;
                  const ent = appt.enterpriseId ? getEnterprise(appt.enterpriseId) : null;
                  const color = appt.color || ent?.color || '270 60% 55%';
                  const sty = uLS(`appt-${appt.id}`);

                  return (
                    <div
                      key={appt.id}
                      onClick={() => setEditingAppt(appt)}
                      className="absolute rounded-xl overflow-hidden z-10 border-2 border-dashed cursor-pointer"
                      style={{
                        top,
                        height: Math.max(height, MOBILE_SLOT_HEIGHT - 4),
                        ...sty,
                        backgroundColor: `hsl(${color} / 0.1)`,
                        borderColor: `hsl(${color} / 0.4)`,
                      }}
                    >
                      <div className="p-2.5 h-full flex flex-col justify-center">
                        <p className="font-medium text-sm leading-tight truncate flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${color})` }} />
                          {appt.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {appt.startTime}–{appt.endTime}
                          {ent ? ` · ${ent.name}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Ritual blocks */}
                {dayRituals.map(ritual => {
                  const time = ritual.suggested_time || '07:00';
                  const startSlot = timeToSlot(time);
                  const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                  const top = startSlot * MOBILE_SLOT_HEIGHT;
                  const height = slotsNeeded * MOBILE_SLOT_HEIGHT;
                  const color = getRitualCalendarColor(ritual.category);
                  const completed = isRitualCompleted(ritual.id, dateStr);
                  const CatIcon = getRitualIcon(ritual.category);
                  const sty = uLS(`ritual-${ritual.id}`);

                  return (
                    <div
                      key={`ritual-${ritual.id}`}
                      className={`absolute rounded-xl overflow-hidden z-10 ${completed ? 'opacity-40' : ''}`}
                      style={{
                        top,
                        height: Math.max(height, MOBILE_SLOT_HEIGHT - 4),
                        ...sty,
                        backgroundColor: `hsl(${color} / 0.12)`,
                        borderLeft: `3px solid hsl(${color} / 0.6)`,
                      }}
                    >
                      <div className="p-2 h-full flex flex-col justify-center">
                        <p className={`font-medium text-xs leading-tight truncate flex items-center gap-1 ${completed ? 'line-through' : ''}`}>
                          <CatIcon className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                          {completed && '✅ '}
                          {ritual.name}
                        </p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(${color})` }}>
                          <Repeat className="h-2.5 w-2.5 inline mr-0.5" />
                          Rituale
                        </p>
                      </div>
                    </div>
                  );
                })}
                {/* Reminder blocks */}
                {dayReminders.map(rem => {
                  const time = rem.reminderTime || '09:00';
                  const ss = timeToSlot(time);
                  const top = ss * MOBILE_SLOT_HEIGHT;
                  const ent = rem.enterpriseId ? getEnterprise(rem.enterpriseId) : null;
                  const color = rem.color || ent?.color || '45 90% 50%';
                  const sty = uLS(`rem-${rem.id}`);
                  return (
                    <div
                      key={`rem-${rem.id}`}
                      className="absolute rounded-xl overflow-hidden z-10 border-2 cursor-pointer"
                      style={{
                        top,
                        height: MOBILE_SLOT_HEIGHT - 4,
                        ...sty,
                        backgroundColor: `hsl(${color} / 0.12)`,
                        borderColor: `hsl(${color} / 0.5)`,
                        borderStyle: 'solid',
                      }}
                    >
                      <div className="p-2 h-full flex flex-col justify-center">
                        <p className="font-medium text-xs leading-tight truncate flex items-center gap-1">
                          <Bell className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                          {rem.isFollowUp ? '🔔 ' : ''}{rem.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      {/* Backlog FAB */}
      {backlogTasks.length > 0 && (
        <div className="absolute bottom-4 right-4 z-30">
          <Button
            size="lg"
            className="rounded-full h-14 w-14 shadow-lg"
            onClick={() => setSelectedSlot(Math.round(timeToSlot(format(new Date(), 'HH:mm'))))}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Slot action sheet */}
      <Sheet open={selectedSlot !== null} onOpenChange={() => setSelectedSlot(null)}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>
              {selectedSlot !== null ? slotToTime(selectedSlot) : ''} — Cosa vuoi aggiungere?
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            {/* Create appointment option */}
            <button
              className="w-full p-4 rounded-xl border-2 border-dashed text-left hover:bg-accent active:bg-accent transition-colors flex items-center gap-3"
              onClick={() => {
                const time = slotToTime(selectedSlot!);
                setSelectedSlot(null);
                setApptDate(dateStr);
                setApptTime(time);
                setShowCreateAppt(true);
              }}
            >
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Nuovo appuntamento</p>
                <p className="text-xs text-muted-foreground">Crea un evento con orario</p>
              </div>
            </button>

            {/* Create task option */}
            <button
              className="w-full p-4 rounded-xl border-2 border-dashed text-left hover:bg-accent active:bg-accent transition-colors flex items-center gap-3"
              onClick={() => {
                const time = slotToTime(selectedSlot!);
                setSelectedSlot(null);
                setTaskDate(dateStr);
                setTaskTime(time);
                setShowCreateTask(true);
              }}
            >
              <ListChecks className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Nuova task</p>
                <p className="text-xs text-muted-foreground">Crea e pianifica una task</p>
              </div>
            </button>

            {/* Backlog tasks */}
            {backlogTasks.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground pt-1">Oppure assegna una task dal backlog:</p>
                <div className="space-y-2 overflow-auto max-h-[40vh]">
                  {backlogTasks.map(task => {
                    const ent = getEnterprise(task.enterpriseId);
                    const proj = getProject(task.projectId);
                    return (
                      <button
                        key={task.id}
                        className="w-full p-3 rounded-xl border text-left hover:bg-accent active:bg-accent transition-colors"
                        style={{ borderLeft: `4px solid hsl(${ent?.color || '0 0% 50%'})` }}
                        onClick={() => {
                          scheduleTask(task.id, dateStr, slotToTime(selectedSlot!));
                          setSelectedSlot(null);
                        }}
                      >
                        <p className="font-medium text-sm">
                          {getPriorityEmoji(getDisplayPriority(task, getProjectType(task.projectId), prioritySettings))}{' '}
                          {task.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ent?.name} · {proj?.name} · {formatMinutes(task.estimatedMinutes)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Task action sheet */}
      <Sheet open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <SheetContent side="bottom" className="max-h-[60vh]">
          <SheetHeader>
            <SheetTitle className="text-left">{selectedTask?.title}</SheetTitle>
          </SheetHeader>
          {selectedTask && (
            <div className="space-y-2 mt-4">
              <Button
                className="w-full justify-start"
                onClick={() => { completeTask(selectedTask.id); setSelectedTask(null); }}
              >
                <Check className="mr-2 h-4 w-4" /> Completa
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    updateTask(selectedTask.id, { estimatedMinutes: selectedTask.estimatedMinutes + 30 });
                    setSelectedTask({ ...selectedTask, estimatedMinutes: selectedTask.estimatedMinutes + 30 });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> 30 min
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={selectedTask.estimatedMinutes <= 30}
                  onClick={() => {
                    if (selectedTask.estimatedMinutes > 30) {
                      updateTask(selectedTask.id, { estimatedMinutes: selectedTask.estimatedMinutes - 30 });
                      setSelectedTask({ ...selectedTask, estimatedMinutes: selectedTask.estimatedMinutes - 30 });
                    }
                  }}
                >
                  <Minus className="mr-1 h-4 w-4" /> 30 min
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  scheduleTask(selectedTask.id, tomorrow, selectedTask.scheduledTime);
                  setSelectedTask(null);
                }}
              >
                <ArrowRight className="mr-2 h-4 w-4" /> Sposta a domani
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => { unscheduleTask(selectedTask.id); setSelectedTask(null); }}
              >
                <X className="mr-2 h-4 w-4" /> Rimuovi dal calendario
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CreateAppointmentDialog
        open={showCreateAppt}
        onOpenChange={setShowCreateAppt}
        defaultDate={apptDate || dateStr}
        defaultTime={apptTime}
      />

      <EditAppointmentDialog
        open={!!editingAppt}
        onOpenChange={(open) => !open && setEditingAppt(null)}
        appointment={editingAppt}
      />

      <CalendarCreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        defaultDate={taskDate}
        defaultTime={taskTime}
      />

      <JournalDialog
        open={showJournal}
        onOpenChange={setShowJournal}
        date={dateStr}
        entry={getJournalForDate(dateStr)}
        onSave={saveJournalEntry}
        onDelete={deleteJournalEntry}
      />
    </div>
  );
}
