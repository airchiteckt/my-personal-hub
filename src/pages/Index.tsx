import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, addDays, differenceInMinutes } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Check, Clock, ArrowRight, Calendar, CalendarClock, Bell, Repeat, Zap, ListChecks, BookOpen, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TOTAL_SLOTS, MOBILE_SLOT_HEIGHT, DESKTOP_SLOT_HEIGHT, SLOT_MINUTES,
  slotToTime, timeToSlot, getTaskPosition, formatMinutes,
  computeOverlapLayout, TaskTimeInfo,
} from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot } from '@/lib/priority-engine';
import { getRitualCalendarColor, getRitualCategoryLabel, getRitualIcon, type RitualData } from '@/lib/ritual-utils';
import type { RitualCompletion } from '@/lib/ritual-utils';
import { getMoonPhase } from '@/lib/moon-utils';
import { TaskFollowUpDialog } from '@/components/TaskFollowUpDialog';
import { CalendarCreateChoice } from '@/components/calendar/CalendarCreateChoice';
import { CalendarCreateTaskDialog } from '@/components/calendar/CalendarCreateTaskDialog';
import { CreateAppointmentDialog } from '@/components/CreateAppointmentDialog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { EditReminderDialog } from '@/components/EditReminderDialog';
import { RitualQuickDialog } from '@/components/calendar/RitualQuickDialog';
import { JournalDialog } from '@/components/calendar/JournalDialog';
import { MoonDetailDialog } from '@/components/calendar/MoonDetailDialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import type { Task, Appointment, Reminder } from '@/types/prp';

const Index = () => {
  const isMobile = useIsMobile();
  const SLOT_H = isMobile ? MOBILE_SLOT_HEIGHT : DESKTOP_SLOT_HEIGHT;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = new Date();
  const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd');

  const {
    tasks, getEnterprise, getProject, getAppointmentsForDate, getRemindersForDate,
    scheduleTask, completeTask, uncompleteTask, unscheduleTask, updateTask,
    deleteAppointment, prioritySettings, updateReminder,
    getRitualsForDate, isRitualCompleted, rituals, ritualCompletions,
    planRitualOnDate, completeRitualOnDate, skipRitualOnDate, deleteRitualCompletion,
    getJournalForDate, saveJournalEntry, deleteJournalEntry,
  } = usePrp();

  // Split tasks: with time vs without
  const allTodayTasks = useMemo(() =>
    tasks.filter(t => t.scheduledDate === todayStr && (t.status === 'scheduled' || t.status === 'done')),
    [tasks, todayStr]
  );
  const scheduledTasks = useMemo(() => allTodayTasks.filter(t => t.scheduledTime), [allTodayTasks]);
  const unscheduledTasks = useMemo(() => allTodayTasks.filter(t => !t.scheduledTime), [allTodayTasks]);

  const dayAppts = getAppointmentsForDate(todayStr);
  const dayReminders = getRemindersForDate(todayStr);
  const dayRituals = getRitualsForDate(today).filter(r => r.planning_mode === 'fixed');

  const pendingTasks = allTodayTasks.filter(t => t.status !== 'done');
  const doneTasks = allTodayTasks.filter(t => t.status === 'done');
  const totalMinutes = pendingTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [followUpTask, setFollowUpTask] = useState<Task | null>(null);

  // Edit dialogs
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editingRitual, setEditingRitual] = useState<{ ritual: RitualData; date: string; time: string; status: string; compId?: string } | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [moonOpen, setMoonOpen] = useState(false);

  // Creation state
  const [showChoice, setShowChoice] = useState(false);
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createDefaults, setCreateDefaults] = useState<{ date?: string; startTime?: string; endTime?: string }>({});

  // Drag-to-create
  const [dragCreate, setDragCreate] = useState<{ startSlot: number; endSlot: number } | null>(null);
  const isDraggingCreate = useRef(false);

  // Drag & drop
  const [isDraggingItem, setIsDraggingItem] = useState(false);

  // Visible time window
  const { visibleStart, visibleEnd } = useMemo(() => {
    const allSlots: number[] = [];
    const nowS = timeToSlot(format(new Date(), 'HH:mm'));
    allSlots.push(nowS);

    scheduledTasks.forEach(t => {
      const ss = timeToSlot(t.scheduledTime!);
      allSlots.push(ss, ss + Math.ceil(t.estimatedMinutes / 30));
    });
    dayAppts.forEach(a => { allSlots.push(timeToSlot(a.startTime), timeToSlot(a.endTime)); });
    dayRituals.forEach(r => {
      const ss = timeToSlot(r.suggested_time || '07:00');
      allSlots.push(ss, ss + Math.ceil(r.estimated_minutes / 30));
    });
    dayReminders.forEach(r => { allSlots.push(timeToSlot(r.reminderTime || '09:00')); });

    if (allSlots.length === 0) return { visibleStart: timeToSlot('07:00'), visibleEnd: timeToSlot('20:00') };

    const margin = 2;
    const minSlot = Math.max(0, Math.min(...allSlots) - margin);
    const start = minSlot - (minSlot % 2);
    const maxSlot = Math.min(TOTAL_SLOTS, Math.max(...allSlots) + margin);
    const end = Math.min(TOTAL_SLOTS, maxSlot + (maxSlot % 2 === 0 ? 0 : 1));
    return { visibleStart: start, visibleEnd: Math.max(end, start + 8) };
  }, [scheduledTasks, dayAppts, dayRituals, dayReminders]);

  const visibleSlots = visibleEnd - visibleStart;

  // Auto-scroll
  useEffect(() => {
    if (!scrollRef.current) return;
    const nowSlot = timeToSlot(format(new Date(), 'HH:mm'));
    const relativeSlot = Math.max(0, nowSlot - visibleStart - 2);
    scrollRef.current.scrollTop = relativeSlot * SLOT_H;
  }, [SLOT_H, visibleStart]);

  const nowSlot = timeToSlot(format(new Date(), 'HH:mm'));
  const nowRelative = nowSlot - visibleStart;
  const nowTop = nowRelative * SLOT_H;

  const handleComplete = useCallback((task: Task) => {
    setCompletingIds(prev => new Set(prev).add(task.id));
    setTimeout(() => {
      completeTask(task.id);
      setCompletingIds(prev => { const next = new Set(prev); next.delete(task.id); return next; });
      setTimeout(() => setFollowUpTask(task), 300);
    }, 600);
  }, [completeTask]);

  const hasTimelineContent = scheduledTasks.length > 0 || dayAppts.length > 0 || dayRituals.length > 0 || dayReminders.length > 0;
  const hasContent = allTodayTasks.length > 0 || dayAppts.length > 0 || dayRituals.length > 0 || dayReminders.length > 0;
  const moon = getMoonPhase(today);

  // Next event
  const nextEvent = useMemo(() => {
    const nowTime = format(new Date(), 'HH:mm');
    const candidates: { title: string; time: string; type: string; color: string }[] = [];
    scheduledTasks.filter(t => t.status !== 'done' && t.scheduledTime! > nowTime).forEach(t => {
      const ent = getEnterprise(t.enterpriseId);
      candidates.push({ title: t.title, time: t.scheduledTime!, type: 'Task', color: ent?.color || '0 0% 50%' });
    });
    dayAppts.filter(a => a.startTime > nowTime).forEach(a => {
      const ent = a.enterpriseId ? getEnterprise(a.enterpriseId) : null;
      candidates.push({ title: a.title, time: a.startTime, type: 'Appuntamento', color: a.color || ent?.color || '270 60% 55%' });
    });
    dayRituals.filter(r => !isRitualCompleted(r.id, todayStr) && (r.suggested_time || '07:00') > nowTime).forEach(r => {
      candidates.push({ title: r.name, time: r.suggested_time || '07:00', type: 'Rituale', color: getRitualCalendarColor(r.category) });
    });
    candidates.sort((a, b) => a.time.localeCompare(b.time));
    if (candidates.length === 0) return null;
    const next = candidates[0];
    const [h, m] = next.time.split(':').map(Number);
    const eventDate = new Date(); eventDate.setHours(h, m, 0, 0);
    const minsUntil = Math.max(0, differenceInMinutes(eventDate, new Date()));
    return { ...next, minutesUntil: minsUntil };
  }, [scheduledTasks, dayAppts, dayRituals, todayStr]);

  // Overlap layout
  const uLayout = useMemo(() => {
    const allTimeInfos: TaskTimeInfo[] = [];
    scheduledTasks.forEach(t => {
      const ss = timeToSlot(t.scheduledTime!);
      allTimeInfos.push({ id: t.id, startSlot: ss, endSlot: ss + Math.ceil(t.estimatedMinutes / 30) });
    });
    dayAppts.forEach(appt => {
      const ss = timeToSlot(appt.startTime); const ee = timeToSlot(appt.endTime);
      allTimeInfos.push({ id: `appt-${appt.id}`, startSlot: ss, endSlot: Math.max(ss + 1, ee) });
    });
    dayRituals.forEach(ritual => {
      const ss = timeToSlot(ritual.suggested_time || '07:00');
      allTimeInfos.push({ id: `ritual-${ritual.id}`, startSlot: ss, endSlot: ss + Math.ceil(ritual.estimated_minutes / 30) });
    });
    // Flex ritual completions
    const flexComps = ritualCompletions.filter(c => c.completed_date === todayStr && c.completed_time);
    flexComps.forEach(comp => {
      const ritual = rituals.find(r => r.id === comp.ritual_id);
      if (!ritual || ritual.planning_mode === 'fixed') return;
      const ss = timeToSlot(comp.completed_time!);
      allTimeInfos.push({ id: `ritual-comp-${comp.id}`, startSlot: ss, endSlot: ss + Math.ceil(ritual.estimated_minutes / 30) });
    });
    dayReminders.forEach(rem => {
      const ss = timeToSlot(rem.reminderTime || '09:00');
      allTimeInfos.push({ id: `rem-${rem.id}`, startSlot: ss, endSlot: ss + 2 });
    });
    return computeOverlapLayout(allTimeInfos);
  }, [scheduledTasks, dayAppts, dayRituals, dayReminders, ritualCompletions, rituals, todayStr]);

  const getItemStyle = (itemId: string) => {
    const l = uLayout.get(itemId);
    const col = l?.column ?? 0;
    const totalCols = l?.totalColumns ?? 1;
    const wp = 100 / totalCols;
    return { left: `calc(${col * wp}% + 2px)`, width: `calc(${wp}% - 4px)` };
  };

  const getRelativeTop = (absSlot: number) => (absSlot - visibleStart) * SLOT_H;

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', `task:${taskId}`);
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingItem(true);
  };

  const handleReminderDragStart = (e: React.DragEvent, reminderId: string) => {
    e.dataTransfer.setData('text/plain', `reminder:${reminderId}`);
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingItem(true);
  };

  const handleDragEnd = () => setIsDraggingItem(false);

  useEffect(() => {
    const onDragEnd = () => handleDragEnd();
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, []);

  const handleColumnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-accent/30');
    handleDragEnd();

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const slotIndex = Math.max(0, Math.min(Math.floor(relativeY / SLOT_H), visibleSlots - 1));
    const absSlot = visibleStart + slotIndex;
    const time = slotToTime(absSlot);

    const payload = e.dataTransfer.getData('text/plain');
    if (payload.startsWith('ritual:')) {
      const ritualId = payload.slice(7);
      if (ritualId) planRitualOnDate(ritualId, todayStr, time);
      return;
    }
    if (payload.startsWith('reminder:')) {
      const reminderId = payload.slice(9);
      if (reminderId) updateReminder(reminderId, { reminderDate: todayStr, reminderTime: time });
      return;
    }
    if (payload.startsWith('task:')) {
      const taskId = payload.slice(5);
      if (taskId) scheduleTask(taskId, todayStr, time);
      return;
    }
  };

  // Flex ritual completions for today
  const flexRituals = useMemo(() => {
    const flexComps = ritualCompletions.filter(c => c.completed_date === todayStr && c.completed_time);
    return flexComps
      .map(comp => {
        const ritual = rituals.find(r => r.id === comp.ritual_id);
        if (!ritual || ritual.planning_mode === 'fixed') return null;
        return { ritual, comp };
      })
      .filter(Boolean) as { ritual: RitualData; comp: RitualCompletion }[];
  }, [ritualCompletions, rituals, todayStr]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl md:text-2xl font-bold capitalize flex items-center gap-2">
              {format(today, 'EEEE d MMMM', { locale: it })}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-lg cursor-pointer" onClick={() => setMoonOpen(true)}>{moon.emoji}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{moon.nameIt} — clicca per dettagli</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              {pendingTasks.length > 0
                ? `${pendingTasks.length} task · ${formatMinutes(totalMinutes)}`
                : 'Nessuna task in sospeso'}
              {doneTasks.length > 0 && ` · ${doneTasks.length} completat${doneTasks.length === 1 ? 'a' : 'e'}`}
              {dayAppts.length > 0 && ` · ${dayAppts.length} appuntament${dayAppts.length === 1 ? 'o' : 'i'}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setJournalOpen(true)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                      getJournalForDate(todayStr)
                        ? 'text-primary font-medium bg-primary/10 hover:bg-primary/15'
                        : 'text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    {getJournalForDate(todayStr) ? '✍️' : ''}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Journal di oggi</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" asChild>
              <Link to="/calendar" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span className="hidden md:inline text-xs">Calendario</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        {allTodayTasks.length > 0 && (
          <div className="max-w-5xl mx-auto mt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${(doneTasks.length / allTodayTasks.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {doneTasks.length}/{allTodayTasks.length} completate
            </p>
          </div>
        )}
      </div>

      {/* Next event widget */}
      {nextEvent && (
        <div className="px-4 md:px-6 py-2 border-b bg-card/50 shrink-0">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `hsl(${nextEvent.color} / 0.15)` }}>
              <Zap className="h-4 w-4" style={{ color: `hsl(${nextEvent.color})` }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                Prossimo: <span className="text-foreground">{nextEvent.title}</span>
              </p>
              <p className="text-[10px] text-muted-foreground">
                {nextEvent.type} alle {nextEvent.time}
                {nextEvent.minutesUntil > 0
                  ? ` · tra ${nextEvent.minutesUntil >= 60
                    ? `${Math.floor(nextEvent.minutesUntil / 60)}h ${nextEvent.minutesUntil % 60}m`
                    : `${nextEvent.minutesUntil}m`}`
                  : ' · adesso'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="p-8 md:p-12 text-center border-dashed max-w-sm">
            <Calendar className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">Giornata libera!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vai al{' '}
              <Link to="/calendar" className="text-primary underline underline-offset-4">calendario</Link>
              {' '}per pianificare
            </p>
          </Card>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-5xl mx-auto">
            {/* Unscheduled tasks */}
            {unscheduledTasks.length > 0 && (
              <div className="px-4 md:px-6 py-3 border-b">
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Da fare oggi · {unscheduledTasks.filter(t => t.status !== 'done').length} in sospeso
                  </p>
                </div>
                <div className="space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {unscheduledTasks.map(task => {
                      const enterprise = getEnterprise(task.enterpriseId);
                      const project = getProject(task.projectId);
                      const isDone = task.status === 'done';
                      const isCompleting = completingIds.has(task.id);
                      const color = enterprise?.color || '0 0% 50%';

                      return (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={isCompleting
                            ? { opacity: 0.3, x: -30, transition: { duration: 0.4 } }
                            : { opacity: 1, y: 0 }
                          }
                          exit={{ opacity: 0, height: 0, transition: { duration: 0.2 } }}
                          layout
                          draggable={!isDone}
                          onDragStart={e => !isDone && handleDragStart(e as unknown as React.DragEvent, task.id)}
                          className={`flex items-center gap-2.5 p-2 md:p-2.5 rounded-lg transition-colors cursor-pointer ${isDone ? 'opacity-50' : 'hover:bg-accent/50'}`}
                          style={{ borderLeft: `3px solid hsl(${isCompleting ? '142 70% 45%' : color})` }}
                          onClick={() => setEditingTask(task)}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); !isCompleting && !isDone && handleComplete(task); }}
                            disabled={isCompleting || isDone}
                            className={`shrink-0 rounded-full h-5 w-5 border flex items-center justify-center transition-all duration-300 ${
                              isCompleting || isDone
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-border hover:border-primary hover:bg-primary/10'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                              {!isDone && getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings)) + ' '}
                              {task.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {enterprise?.name} · {project?.name} · {formatMinutes(task.estimatedMinutes)}
                            </p>
                          </div>
                          {!isDone && (
                            <Button
                              size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                              onClick={(e) => { e.stopPropagation(); scheduleTask(task.id, tomorrow, undefined); }}
                              title="Sposta a domani"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Timeline */}
            {hasTimelineContent && (
              <div
                className="relative select-none"
                style={{ height: visibleSlots * SLOT_H, marginLeft: isMobile ? 40 : 56 }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-accent/30'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('bg-accent/30'); }}
                onDrop={handleColumnDrop}
                onMouseDown={e => {
                  if (isMobile) return;
                  if (e.button !== 0) return;
                  if ((e.target as HTMLElement).closest('[draggable]')) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relativeY = e.clientY - rect.top;
                  const slot = Math.max(0, Math.min(Math.floor(relativeY / SLOT_H), visibleSlots - 1));
                  isDraggingCreate.current = true;
                  setDragCreate({ startSlot: slot, endSlot: slot + 1 });
                }}
                onMouseMove={e => {
                  if (!isDraggingCreate.current || !dragCreate) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const relativeY = e.clientY - rect.top;
                  const slot = Math.max(0, Math.min(Math.floor(relativeY / SLOT_H) + 1, visibleSlots));
                  if (slot !== dragCreate.endSlot) {
                    setDragCreate(prev => prev ? { ...prev, endSlot: Math.max(prev.startSlot + 1, slot) } : null);
                  }
                }}
                onMouseUp={() => {
                  if (!isDraggingCreate.current || !dragCreate) return;
                  isDraggingCreate.current = false;
                  const startSlot = Math.min(dragCreate.startSlot, dragCreate.endSlot);
                  const endSlot = Math.max(dragCreate.startSlot, dragCreate.endSlot);
                  const absStart = visibleStart + startSlot;
                  const absEnd = visibleStart + endSlot;
                  setCreateDefaults({
                    date: todayStr,
                    startTime: slotToTime(absStart),
                    endTime: slotToTime(absEnd),
                  });
                  setDragCreate(null);
                  setShowChoice(true);
                }}
              >
                {/* Time labels + grid lines */}
                {Array.from({ length: visibleSlots }, (_, i) => {
                  const absSlot = visibleStart + i;
                  const time = slotToTime(absSlot);
                  const isHour = absSlot % 2 === 0;
                  return (
                    <div key={absSlot} className="absolute left-0 right-0" style={{ top: i * SLOT_H }}>
                      <span
                        className="absolute text-[11px] text-muted-foreground tabular-nums select-none"
                        style={{ right: '100%', marginRight: isMobile ? 8 : 12, top: -7 }}
                      >
                        {isHour ? time : ''}
                      </span>
                      <div className={`absolute left-0 right-0 h-px ${isHour ? 'bg-border' : 'bg-border/30'}`} />
                    </div>
                  );
                })}

                {/* Drag-to-create selection */}
                {dragCreate && (
                  <div
                    className="absolute left-1 right-1 rounded-lg bg-primary/20 border-2 border-primary/40 z-30 pointer-events-none flex items-center justify-center"
                    style={{
                      top: Math.min(dragCreate.startSlot, dragCreate.endSlot) * SLOT_H,
                      height: Math.abs(dragCreate.endSlot - dragCreate.startSlot) * SLOT_H,
                    }}
                  >
                    <span className="text-xs font-medium text-primary">
                      {slotToTime(visibleStart + Math.min(dragCreate.startSlot, dragCreate.endSlot))} – {slotToTime(visibleStart + Math.max(dragCreate.startSlot, dragCreate.endSlot))}
                    </span>
                  </div>
                )}

                {/* Current time indicator */}
                {nowRelative >= 0 && nowRelative <= visibleSlots && (
                  <div className="absolute left-0 right-0 flex items-center z-30 pointer-events-none" style={{ top: nowTop }}>
                    <div className="h-3 w-3 rounded-full bg-destructive -ml-1.5" />
                    <div className="flex-1 h-0.5 bg-destructive" />
                  </div>
                )}

                {/* Scheduled Tasks */}
                <AnimatePresence>
                  {scheduledTasks.map(task => {
                    const absStart = timeToSlot(task.scheduledTime!);
                    const top = getRelativeTop(absStart) + 1;
                    const height = Math.ceil(task.estimatedMinutes / SLOT_MINUTES) * SLOT_H;
                    const enterprise = getEnterprise(task.enterpriseId);
                    const sty = getItemStyle(task.id);
                    const isDone = task.status === 'done';
                    const isCompleting = completingIds.has(task.id);
                    const color = enterprise?.color || '0 0% 50%';

                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={isCompleting
                          ? { opacity: 0.4, scale: 0.97, transition: { duration: 0.4 } }
                          : { opacity: 1, scale: 1 }
                        }
                        exit={{ opacity: 0, scale: 0.9 }}
                        draggable={!isDone}
                        onDragStart={e => { e.stopPropagation(); !isDone && handleDragStart(e as unknown as React.DragEvent, task.id); }}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setEditingTask(task); }}
                        className={`absolute rounded-lg overflow-hidden z-10 group cursor-pointer ${isDone ? 'opacity-40' : ''}`}
                        style={{
                          top,
                          height: Math.max(height - 2, SLOT_H - 4),
                          ...sty,
                          backgroundColor: `hsl(${isCompleting ? '142 70% 45%' : color} / ${isDone ? '0.08' : '0.15'})`,
                          borderLeft: `3px solid hsl(${isCompleting ? '142 70% 45%' : color})`,
                        }}
                      >
                        <div className="p-1.5 md:p-2 h-full flex flex-col justify-center">
                          <p className={`font-medium text-xs leading-tight truncate ${isDone ? 'line-through' : ''}`}>
                            {isDone ? '✅ ' : getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings)) + ' '}
                            {task.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {enterprise?.name} · {formatMinutes(task.estimatedMinutes)}
                          </p>
                        </div>
                        {/* Hover actions: +30 / -30 */}
                        {!isDone && !isCompleting && (
                          <div className="absolute bottom-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-card/90 rounded-md border shadow-sm px-1 py-0.5">
                            {task.estimatedMinutes > 30 && (
                              <button onClick={e => { e.stopPropagation(); updateTask(task.id, { estimatedMinutes: task.estimatedMinutes - 30 }); }} className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent">−30</button>
                            )}
                            <button onClick={e => { e.stopPropagation(); updateTask(task.id, { estimatedMinutes: task.estimatedMinutes + 30 }); }} className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent">+30</button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Appointments */}
                {dayAppts.map(appt => {
                  const startSlot = timeToSlot(appt.startTime);
                  const endSlot = timeToSlot(appt.endTime);
                  const slots = Math.max(1, endSlot - startSlot);
                  const top = getRelativeTop(startSlot) + 1;
                  const height = slots * SLOT_H;
                  const ent = appt.enterpriseId ? getEnterprise(appt.enterpriseId) : null;
                  const color = appt.color || ent?.color || '270 60% 55%';
                  const sty = getItemStyle(`appt-${appt.id}`);

                  return (
                    <div
                      key={`appt-${appt.id}`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setEditingAppt(appt); }}
                      className="absolute rounded-lg overflow-hidden z-10 border-2 border-dashed cursor-pointer group"
                      style={{
                        top, height: Math.max(height - 2, SLOT_H - 4), ...sty,
                        backgroundColor: `hsl(${color} / 0.1)`, borderColor: `hsl(${color} / 0.4)`,
                      }}
                    >
                      <div className="p-1.5 md:p-2 h-full flex flex-col justify-center">
                        <p className="font-medium text-xs leading-tight truncate flex items-center gap-1">
                          <CalendarClock className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                          {appt.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {appt.startTime}–{appt.endTime}{ent ? ` · ${ent.name}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteAppointment(appt.id); }}
                        className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded bg-card/90 border shadow-sm text-[10px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >×</button>
                    </div>
                  );
                })}

                {/* Fixed Rituals */}
                {dayRituals.map(ritual => {
                  const time = ritual.suggested_time || '07:00';
                  const startSlot = timeToSlot(time);
                  const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                  const top = getRelativeTop(startSlot) + 1;
                  const height = slotsNeeded * SLOT_H;
                  const color = getRitualCalendarColor(ritual.category);
                  const comp = ritualCompletions.find(c => c.ritual_id === ritual.id && c.completed_date === todayStr);
                  const rstatus = comp?.status || 'pending';
                  const completed = rstatus === 'done';
                  const skipped = rstatus === 'skipped';
                  const CatIcon = getRitualIcon(ritual.category);
                  const sty = getItemStyle(`ritual-${ritual.id}`);

                  return (
                    <div
                      key={`ritual-${ritual.id}`}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setEditingRitual({ ritual, date: todayStr, time, status: rstatus, compId: comp?.id }); }}
                      className={`absolute rounded-lg overflow-hidden z-10 border-2 border-dotted group cursor-pointer ${completed ? 'opacity-60' : skipped ? 'opacity-30' : ''}`}
                      style={{
                        top, height: Math.max(height - 2, SLOT_H - 4), ...sty,
                        backgroundColor: `hsl(${color} / ${completed ? '0.15' : '0.08'})`,
                        borderColor: `hsl(${color} / ${completed ? '0.6' : '0.4'})`,
                      }}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-center">
                        <p className={`font-medium text-xs leading-tight truncate flex items-center gap-1 ${completed ? 'line-through' : ''}`}>
                          <CatIcon className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                          {completed && '✅ '}{skipped && '⏭ '}{ritual.name}
                        </p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(${color} / 0.8)` }}>
                          <Repeat className="h-2.5 w-2.5 inline mr-0.5" />
                          {time} · {getRitualCategoryLabel(ritual.category)}
                        </p>
                      </div>
                      {!completed && !skipped && (
                        <div className="absolute bottom-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-card/95 rounded-md border shadow-sm px-1 py-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); if (!comp) { planRitualOnDate(ritual.id, todayStr, time).then(() => completeRitualOnDate(ritual.id, todayStr)); } else { completeRitualOnDate(ritual.id, todayStr); } }}
                            className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent text-green-600"
                          ><Check className="h-3 w-3" /> Fatto</button>
                          <button
                            onClick={e => { e.stopPropagation(); if (!comp) { planRitualOnDate(ritual.id, todayStr, time).then(() => skipRitualOnDate(ritual.id, todayStr)); } else { skipRitualOnDate(ritual.id, todayStr); } }}
                            className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent text-destructive"
                          >Salta</button>
                        </div>
                      )}
                      {(completed || skipped) && comp && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteRitualCompletion(comp.id); }}
                          className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded bg-card/90 border shadow-sm text-[10px] text-muted-foreground hover:text-destructive"
                        >×</button>
                      )}
                    </div>
                  );
                })}

                {/* Flex ritual completions */}
                {flexRituals.map(({ ritual, comp }) => {
                  const time = comp.completed_time!;
                  const startSlot = timeToSlot(time);
                  const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                  const top = getRelativeTop(startSlot) + 1;
                  const height = slotsNeeded * SLOT_H;
                  const color = getRitualCalendarColor(ritual.category);
                  const CatIcon = getRitualIcon(ritual.category);
                  const isDone = comp.status === 'done';
                  const isSkipped = comp.status === 'skipped';
                  const sty = getItemStyle(`ritual-comp-${comp.id}`);

                  return (
                    <div
                      key={`ritual-comp-${comp.id}`}
                      draggable
                      onDragStart={e => { e.stopPropagation(); deleteRitualCompletion(comp.id); e.dataTransfer.setData('text/plain', `ritual:${ritual.id}`); e.dataTransfer.effectAllowed = 'move'; }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setEditingRitual({ ritual, date: todayStr, time, status: comp.status, compId: comp.id }); }}
                      className={`absolute rounded-lg overflow-hidden z-10 border-2 cursor-pointer group ${isDone ? 'border-solid opacity-60' : isSkipped ? 'border-dashed opacity-30' : 'border-dotted'}`}
                      style={{
                        top, height: Math.max(height - 2, SLOT_H - 4), ...sty,
                        backgroundColor: `hsl(${color} / ${isDone ? '0.15' : '0.08'})`,
                        borderColor: `hsl(${color} / ${isDone ? '0.6' : '0.4'})`,
                      }}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-center">
                        <p className={`font-medium text-xs leading-tight truncate flex items-center gap-1 ${isDone ? 'line-through' : ''}`}>
                          <CatIcon className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                          {isDone && '✅ '}{isSkipped && '⏭ '}{ritual.name}
                        </p>
                        <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(${color} / 0.8)` }}>
                          <Repeat className="h-2.5 w-2.5 inline mr-0.5" />
                          {time} · {getRitualCategoryLabel(ritual.category)}
                        </p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteRitualCompletion(comp.id); }}
                        className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded bg-card/90 border shadow-sm text-[10px] text-muted-foreground hover:text-destructive"
                      >×</button>
                    </div>
                  );
                })}

                {/* Reminders (draggable) */}
                {dayReminders.map(rem => {
                  const time = rem.reminderTime || '09:00';
                  const ss = timeToSlot(time);
                  const top = getRelativeTop(ss) + 1;
                  const ent = rem.enterpriseId ? getEnterprise(rem.enterpriseId) : null;
                  const color = rem.color || ent?.color || '45 90% 50%';
                  const sty = getItemStyle(`rem-${rem.id}`);

                  return (
                    <div
                      key={`rem-${rem.id}`}
                      draggable
                      onDragStart={e => { e.stopPropagation(); handleReminderDragStart(e, rem.id); }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); setEditingReminder(rem); }}
                      className="absolute rounded-lg overflow-hidden z-10 border-2 cursor-grab active:cursor-grabbing group"
                      style={{
                        top, height: Math.max(SLOT_H * 2 - 2, SLOT_H - 4), ...sty,
                        backgroundColor: `hsl(${color} / 0.12)`, borderColor: `hsl(${color} / 0.5)`,
                        borderStyle: 'solid',
                      }}
                    >
                      <div className="p-1.5 h-full flex flex-col justify-center">
                        <p className="font-medium text-xs leading-tight truncate flex items-center gap-1">
                          <Bell className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                          {rem.isFollowUp ? '🔔 ' : ''}{rem.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {time}{ent ? ` · ${ent.name}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* All dialogs */}
      <CalendarCreateChoice
        open={showChoice}
        onOpenChange={setShowChoice}
        timeLabel={`Oggi · ${createDefaults.startTime ?? ''} – ${createDefaults.endTime ?? ''}`}
        onChooseAppointment={() => { setShowChoice(false); setTimeout(() => setShowCreateAppt(true), 150); }}
        onChooseTask={() => { setShowChoice(false); setTimeout(() => setShowCreateTask(true), 150); }}
      />

      <CreateAppointmentDialog
        open={showCreateAppt}
        onOpenChange={setShowCreateAppt}
        defaultDate={createDefaults.date}
        defaultTime={createDefaults.startTime}
        defaultEndTime={createDefaults.endTime}
      />

      <CalendarCreateTaskDialog
        open={showCreateTask}
        onOpenChange={setShowCreateTask}
        defaultDate={createDefaults.date}
        defaultTime={createDefaults.startTime}
        defaultEndTime={createDefaults.endTime}
      />

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
          onCompleted={(t) => setTimeout(() => setFollowUpTask(t), 300)}
        />
      )}

      {editingAppt && (
        <EditAppointmentDialog
          open={!!editingAppt}
          onOpenChange={(open) => !open && setEditingAppt(null)}
          appointment={editingAppt}
        />
      )}

      {editingReminder && (
        <EditReminderDialog
          open={!!editingReminder}
          onOpenChange={(open) => !open && setEditingReminder(null)}
          reminder={editingReminder}
        />
      )}

      {editingRitual && (
        <RitualQuickDialog
          open={!!editingRitual}
          onOpenChange={(open) => !open && setEditingRitual(null)}
          ritual={editingRitual.ritual}
          date={editingRitual.date}
          time={editingRitual.time}
          status={editingRitual.status}
          allCompletions={ritualCompletions as RitualCompletion[]}
          onComplete={() => completeRitualOnDate(editingRitual.ritual.id, editingRitual.date)}
          onSkip={() => skipRitualOnDate(editingRitual.ritual.id, editingRitual.date)}
          onDelete={editingRitual.compId ? () => deleteRitualCompletion(editingRitual.compId!) : undefined}
          onChangeTime={async (newTime) => {
            if (editingRitual.compId) {
              await supabase.from('ritual_completions').update({ completed_time: newTime }).eq('id', editingRitual.compId);
            }
            setEditingRitual(null);
          }}
        />
      )}

      {followUpTask && (
        <TaskFollowUpDialog
          open={!!followUpTask}
          onOpenChange={(open) => !open && setFollowUpTask(null)}
          task={followUpTask}
        />
      )}

      {journalOpen && (
        <JournalDialog
          open={journalOpen}
          onOpenChange={setJournalOpen}
          date={todayStr}
          entry={getJournalForDate(todayStr)}
          onSave={saveJournalEntry}
          onDelete={deleteJournalEntry}
        />
      )}

      {moonOpen && (
        <MoonDetailDialog
          open={moonOpen}
          onOpenChange={setMoonOpen}
          date={today}
        />
      )}
    </div>
  );
};

export default Index;
