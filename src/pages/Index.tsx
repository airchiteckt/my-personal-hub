import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Check, Clock, ArrowRight, Calendar, CalendarClock, Bell, Repeat, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  TOTAL_SLOTS, MOBILE_SLOT_HEIGHT, DESKTOP_SLOT_HEIGHT,
  slotToTime, timeToSlot, getTaskPosition, formatMinutes,
  computeOverlapLayout, TaskTimeInfo,
} from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot } from '@/lib/priority-engine';
import { getRitualCalendarColor, getRitualCategoryLabel, getRitualIcon } from '@/lib/ritual-utils';
import { getMoonPhase } from '@/lib/moon-utils';
import { TaskFollowUpDialog } from '@/components/TaskFollowUpDialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { Task } from '@/types/prp';

const Index = () => {
  const isMobile = useIsMobile();
  const SLOT_H = isMobile ? MOBILE_SLOT_HEIGHT : DESKTOP_SLOT_HEIGHT;
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = new Date();
  const tomorrow = format(addDays(today, 1), 'yyyy-MM-dd');

  const {
    tasks, getEnterprise, getProject, getAppointmentsForDate, getRemindersForDate,
    scheduleTask, completeTask, uncompleteTask, prioritySettings,
    getRitualsForDate, isRitualCompleted, completeRitualOnDate, skipRitualOnDate,
  } = usePrp();

  const todayTasks = useMemo(() =>
    tasks.filter(t => t.scheduledDate === todayStr && (t.status === 'scheduled' || t.status === 'done')),
    [tasks, todayStr]
  );
  const dayAppts = getAppointmentsForDate(todayStr);
  const dayReminders = getRemindersForDate(todayStr);
  const dayRituals = getRitualsForDate(today).filter(r => r.planning_mode === 'fixed');

  const pendingTasks = todayTasks.filter(t => t.status !== 'done');
  const doneTasks = todayTasks.filter(t => t.status === 'done');
  const totalMinutes = pendingTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [followUpTask, setFollowUpTask] = useState<Task | null>(null);

  // Auto-scroll to current time
  useEffect(() => {
    if (!scrollRef.current) return;
    const nowSlot = Math.max(0, timeToSlot(format(new Date(), 'HH:mm')) - 2);
    scrollRef.current.scrollTop = nowSlot * SLOT_H;
  }, [SLOT_H]);

  // Current time position
  const nowSlot = timeToSlot(format(new Date(), 'HH:mm'));
  const nowTop = nowSlot * SLOT_H;

  const handleComplete = useCallback((task: Task) => {
    setCompletingIds(prev => new Set(prev).add(task.id));
    setTimeout(() => {
      completeTask(task.id);
      setCompletingIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setTimeout(() => setFollowUpTask(task), 300);
    }, 600);
  }, [completeTask]);

  const hasContent = todayTasks.length > 0 || dayAppts.length > 0 || dayRituals.length > 0 || dayReminders.length > 0;
  const moon = getMoonPhase(today);

  // Compute unified overlap layout
  const uLayout = useMemo(() => {
    const allTimeInfos: TaskTimeInfo[] = [];
    todayTasks.forEach(t => {
      const time = t.scheduledTime || '09:00';
      const ss = timeToSlot(time);
      allTimeInfos.push({ id: t.id, startSlot: ss, endSlot: ss + Math.ceil(t.estimatedMinutes / 30) });
    });
    dayAppts.forEach(appt => {
      const ss = timeToSlot(appt.startTime);
      const ee = timeToSlot(appt.endTime);
      allTimeInfos.push({ id: `appt-${appt.id}`, startSlot: ss, endSlot: Math.max(ss + 1, ee) });
    });
    dayRituals.forEach(ritual => {
      const ss = timeToSlot(ritual.suggested_time || '07:00');
      allTimeInfos.push({ id: `ritual-${ritual.id}`, startSlot: ss, endSlot: ss + Math.ceil(ritual.estimated_minutes / 30) });
    });
    dayReminders.forEach(rem => {
      const ss = timeToSlot(rem.reminderTime || '09:00');
      allTimeInfos.push({ id: `rem-${rem.id}`, startSlot: ss, endSlot: ss + 1 });
    });
    return computeOverlapLayout(allTimeInfos);
  }, [todayTasks, dayAppts, dayRituals, dayReminders]);

  const getItemStyle = (itemId: string) => {
    const l = uLayout.get(itemId);
    const col = l?.column ?? 0;
    const totalCols = l?.totalColumns ?? 1;
    const wp = 100 / totalCols;
    return { left: `calc(${col * wp}% + 2px)`, width: `calc(${wp}% - 4px)` };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 md:px-6 py-3 md:py-4 border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl md:text-2xl font-bold capitalize flex items-center gap-2">
              {format(today, 'EEEE d MMMM', { locale: it })}
              <span className="text-lg" title={moon.nameIt}>{moon.emoji}</span>
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              {pendingTasks.length > 0
                ? `${pendingTasks.length} task · ${formatMinutes(totalMinutes)}`
                : 'Nessuna task in sospeso'}
              {doneTasks.length > 0 && ` · ${doneTasks.length} completat${doneTasks.length === 1 ? 'a' : 'e'}`}
              {dayAppts.length > 0 && ` · ${dayAppts.length} appuntament${dayAppts.length === 1 ? 'o' : 'i'}`}
              {dayRituals.length > 0 && ` · ${dayRituals.length} ritual${dayRituals.length === 1 ? 'e' : 'i'}`}
            </p>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/calendar" className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="hidden md:inline text-xs">Calendario</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Apri il calendario completo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Progress bar */}
        {todayTasks.length > 0 && (
          <div className="max-w-5xl mx-auto mt-2">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${todayTasks.length > 0 ? (doneTasks.length / todayTasks.length) * 100 : 0}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {doneTasks.length}/{todayTasks.length} completate
            </p>
          </div>
        )}
      </div>

      {/* Timeline or empty state */}
      {!hasContent ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <Card className="p-8 md:p-12 text-center border-dashed max-w-sm">
            <Calendar className="h-10 w-10 md:h-12 md:w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground font-medium">Giornata libera!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Vai al{' '}
              <Link to="/calendar" className="text-primary underline underline-offset-4">
                calendario
              </Link>{' '}
              per pianificare
            </p>
          </Card>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-5xl mx-auto">
            <div className="relative" style={{ height: TOTAL_SLOTS * SLOT_H, marginLeft: isMobile ? 40 : 56 }}>
              {/* Time labels + grid lines */}
              {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
                const time = slotToTime(i);
                const isHour = i % 2 === 0;
                return (
                  <div key={i} className="absolute left-0 right-0" style={{ top: i * SLOT_H }}>
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

              {/* Current time indicator */}
              {nowSlot >= 0 && nowSlot <= TOTAL_SLOTS && (
                <div className="absolute left-0 right-0 flex items-center z-30 pointer-events-none" style={{ top: nowTop }}>
                  <div className="h-3 w-3 rounded-full bg-destructive -ml-1.5" />
                  <div className="flex-1 h-0.5 bg-destructive" />
                </div>
              )}

              {/* Task blocks */}
              <AnimatePresence>
                {todayTasks.map(task => {
                  const time = task.scheduledTime || '09:00';
                  const { top, height } = getTaskPosition(time, task.estimatedMinutes, SLOT_H);
                  const enterprise = getEnterprise(task.enterpriseId);
                  const project = getProject(task.projectId);
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
                      className={`absolute rounded-lg overflow-hidden z-10 group cursor-pointer ${isDone ? 'opacity-50' : ''}`}
                      style={{
                        top: top + 1,
                        height: Math.max(height - 2, SLOT_H - 4),
                        ...sty,
                        backgroundColor: `hsl(${isCompleting ? '142 70% 45%' : color} / ${isDone ? '0.08' : '0.12'})`,
                        borderLeft: `4px solid hsl(${isCompleting ? '142 70% 45%' : color})`,
                      }}
                    >
                      <div className="p-2 md:p-2.5 h-full flex flex-col justify-center">
                        <div className="flex items-center gap-1.5">
                          {/* Complete button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); !isCompleting && !isDone && handleComplete(task); }}
                            disabled={isCompleting || isDone}
                            className={`shrink-0 rounded-full h-5 w-5 md:h-6 md:w-6 border flex items-center justify-center transition-all duration-300 ${
                              isCompleting || isDone
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-border hover:border-primary hover:bg-primary/10'
                            }`}
                          >
                            <Check className="h-3 w-3" />
                          </button>
                          <p className={`font-medium text-xs md:text-sm leading-tight truncate flex-1 ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                            {!isDone && getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings)) + ' '}
                            {task.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 ml-6 md:ml-7">
                          <span className="text-[10px] md:text-xs text-muted-foreground truncate">
                            {enterprise?.name} · {project?.name}
                          </span>
                          <span className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
                            <Clock className="h-2.5 w-2.5" />{formatMinutes(task.estimatedMinutes)}
                          </span>
                        </div>
                      </div>

                      {/* Hover actions */}
                      {!isDone && !isCompleting && (
                        <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5 bg-card/95 rounded-md border shadow-sm px-1 py-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); scheduleTask(task.id, tomorrow, task.scheduledTime); }}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent flex items-center gap-0.5"
                            title="Sposta a domani"
                          >
                            <ArrowRight className="h-3 w-3" /> Domani
                          </button>
                        </div>
                      )}
                      {isDone && (
                        <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5 bg-card/95 rounded-md border shadow-sm px-1 py-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); uncompleteTask(task.id); }}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent"
                            title="Segna come non completata"
                          >
                            ↩ Riapri
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Appointment blocks */}
              {dayAppts.map(appt => {
                const startSlot = timeToSlot(appt.startTime);
                const endSlot = timeToSlot(appt.endTime);
                const slots = Math.max(1, endSlot - startSlot);
                const top = startSlot * SLOT_H;
                const height = slots * SLOT_H;
                const ent = appt.enterpriseId ? getEnterprise(appt.enterpriseId) : null;
                const color = appt.color || ent?.color || '270 60% 55%';
                const sty = getItemStyle(`appt-${appt.id}`);

                return (
                  <div
                    key={`appt-${appt.id}`}
                    className="absolute rounded-lg overflow-hidden z-10 border-2 border-dashed"
                    style={{
                      top: top + 1,
                      height: Math.max(height - 2, SLOT_H - 4),
                      ...sty,
                      backgroundColor: `hsl(${color} / 0.1)`,
                      borderColor: `hsl(${color} / 0.4)`,
                    }}
                  >
                    <div className="p-2 md:p-2.5 h-full flex flex-col justify-center">
                      <p className="font-medium text-xs md:text-sm leading-tight truncate flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" style={{ color: `hsl(${color})` }} />
                        {appt.title}
                      </p>
                      <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                        {appt.startTime}–{appt.endTime}
                        {ent ? ` · ${ent.name}` : ''}
                        {appt.description ? ` · ${appt.description}` : ''}
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
                const top = startSlot * SLOT_H;
                const height = slotsNeeded * SLOT_H;
                const color = getRitualCalendarColor(ritual.category);
                const completed = isRitualCompleted(ritual.id, todayStr);
                const CatIcon = getRitualIcon(ritual.category);
                const sty = getItemStyle(`ritual-${ritual.id}`);

                return (
                  <div
                    key={`ritual-${ritual.id}`}
                    className={`absolute rounded-lg overflow-hidden z-10 border-2 border-dotted group ${completed ? 'opacity-50' : ''}`}
                    style={{
                      top: top + 1,
                      height: Math.max(height - 2, SLOT_H - 4),
                      ...sty,
                      backgroundColor: `hsl(${color} / 0.1)`,
                      borderColor: `hsl(${color} / 0.4)`,
                    }}
                  >
                    <div className="p-2 h-full flex flex-col justify-center">
                      <p className={`font-medium text-xs leading-tight truncate flex items-center gap-1 ${completed ? 'line-through' : ''}`}>
                        <CatIcon className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                        {completed && '✅ '}{ritual.name}
                      </p>
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(${color} / 0.8)` }}>
                        <Repeat className="h-2.5 w-2.5 inline mr-0.5" />
                        {time} · {getRitualCategoryLabel(ritual.category)}
                      </p>
                    </div>
                    {/* Quick actions on hover */}
                    {!completed && (
                      <div className="absolute bottom-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-card/95 rounded-md border shadow-sm px-1 py-0.5">
                        <button
                          onClick={() => completeRitualOnDate(ritual.id, todayStr)}
                          className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent text-green-600"
                        >
                          <Check className="h-3 w-3" /> Fatto
                        </button>
                        <button
                          onClick={() => skipRitualOnDate(ritual.id, todayStr)}
                          className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent text-destructive"
                        >
                          Salta
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Reminder blocks */}
              {dayReminders.map(rem => {
                const time = rem.reminderTime || '09:00';
                const ss = timeToSlot(time);
                const top = ss * SLOT_H;
                const ent = rem.enterpriseId ? getEnterprise(rem.enterpriseId) : null;
                const color = rem.color || ent?.color || '45 90% 50%';
                const sty = getItemStyle(`rem-${rem.id}`);

                return (
                  <div
                    key={`rem-${rem.id}`}
                    className="absolute rounded-lg overflow-hidden z-10 border-2"
                    style={{
                      top: top + 1,
                      height: SLOT_H - 4,
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
            </div>
          </div>
        </div>
      )}

      {followUpTask && (
        <TaskFollowUpDialog
          open={!!followUpTask}
          onOpenChange={(open) => !open && setFollowUpTask(null)}
          task={followUpTask}
        />
      )}
    </div>
  );
};

export default Index;
