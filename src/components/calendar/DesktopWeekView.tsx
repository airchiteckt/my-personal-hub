import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from 'react';
import { format, addDays, addMonths, addYears, isToday, subMonths, subYears } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus, CalendarClock, Repeat, Check, X, BookOpen, Bell, Send, ListTodo, Aperture, Radar, Play, Pause } from 'lucide-react';
import { useTaskTimer } from '@/hooks/use-task-timer';
import { TaskQueue } from '@/components/calendar/TaskQueue';
import { QueueFullscreen } from './QueueFullscreen';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Link } from 'react-router-dom';
import { Maximize2 } from 'lucide-react';
import { SlotSelectionDialog, SelectedSlot } from './SlotSelectionMode';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { TaskFollowUpDialog } from '@/components/TaskFollowUpDialog';
import { EditAppointmentDialog } from '@/components/EditAppointmentDialog';
import { EditReminderDialog } from '@/components/EditReminderDialog';
import { CreateReminderDialog } from '@/components/CreateReminderDialog';
import { RitualQuickDialog } from './RitualQuickDialog';
import { MoonDetailDialog } from './MoonDetailDialog';
import type { Task, Appointment, Reminder, ExternalCalendarEvent } from '@/types/prp';
import { ExternalEventDetailDialog } from './ExternalEventDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import type { RitualCompletion } from '@/lib/ritual-utils';
import {
  TOTAL_SLOTS, DESKTOP_SLOT_HEIGHT, slotToTime, timeToSlot, getTaskPosition, formatMinutes,
  computeOverlapLayout, TaskTimeInfo,
} from '@/lib/calendar-utils';
import { getMoonPhase } from '@/lib/moon-utils';
import { getUrgencyLevel, getUrgencyDot, getDisplayPriority, getPriorityEmoji } from '@/lib/priority-engine';
import { SmartBacklog } from './SmartBacklog';
import { CreateAppointmentDialog } from '@/components/CreateAppointmentDialog';
import { CalendarCreateChoice } from './CalendarCreateChoice';
import { CalendarCreateTaskDialog } from './CalendarCreateTaskDialog';
import { getRitualCalendarColor, getRitualCategoryLabel, getRitualIcon, type RitualData } from '@/lib/ritual-utils';
import { CalendarOverview } from './CalendarOverview';
import { Slider } from '@/components/ui/slider';

import { JournalDialog } from './JournalDialog';

interface RitualCalendarCardProps {
  ritual: RitualData;
  status: string;
  top: number;
  height: number;
  color: string;
  CatIcon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  time: string;
  slotH: number;
  onComplete: () => void;
  onSkip: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
  style?: { left: string; width: string };
}

const googleSolidColor = (color?: string) => color?.startsWith('#') ? color : `hsl(${color || '210 80% 50%'})`;
const googleTintColor = (color?: string, alpha = 0.12) => {
  if (!color?.startsWith('#')) return `hsl(${color || '210 80% 50%'} / ${alpha})`;
  const hexAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${color}${hexAlpha}`;
};

const FOCUS_STOPS = [
  { value: 0, label: 'Anno' },
  { value: 20, label: 'Mese' },
  { value: 45, label: 'Settimana' },
  { value: 65, label: '3 giorni' },
  { value: 82, label: 'Giorno' },
  { value: 100, label: 'Momento' },
] as const;

const snapFocus = (value: number) => FOCUS_STOPS.reduce((best, stop) =>
  Math.abs(stop.value - value) < Math.abs(best.value - value) ? stop : best
).value;

const getFocusMode = (value: number): 'year' | 'month' | 'week' | 'threeDays' | 'day' | 'moment' => {
  if (value < 10) return 'year';
  if (value < 33) return 'month';
  if (value < 55) return 'week';
  if (value < 74) return 'threeDays';
  if (value < 91) return 'day';
  return 'moment';
};

function RitualCalendarCard({ ritual, status, top, height, color, CatIcon, time, slotH, onComplete, onSkip, onDelete, onDragStart, onClick, style: posStyle }: RitualCalendarCardProps) {
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  const isPlanned = status === 'planned' || status === 'pending';
  const canDrag = isPlanned;

  return (
    <div
      draggable={canDrag}
      onDragStart={e => { e.stopPropagation(); onDragStart?.(e); }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      className={`absolute rounded-lg overflow-hidden z-10 border-2 cursor-pointer group ${isDone ? 'border-solid opacity-60' : isSkipped ? 'border-dashed opacity-30' : 'border-dotted'}`}
      style={{
        top: top + 1,
        height: Math.max(height - 2, slotH - 4),
        left: posStyle?.left ?? 2,
        width: posStyle?.width,
        right: posStyle ? undefined : 2,
        backgroundColor: `hsl(${color} / ${isDone ? '0.15' : isSkipped ? '0.05' : '0.08'})`,
        borderColor: `hsl(${color} / ${isDone ? '0.6' : '0.4'})`,
      }}
      title={`${ritual.name} [${isDone ? 'Completato' : isSkipped ? 'Saltato' : 'Pianificato'}]`}
    >
      <div className="p-1.5 h-full flex flex-col">
        <p className={`font-medium text-xs leading-tight flex items-start gap-1 ${isDone ? 'line-through' : ''}`}>
          <CatIcon className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
          <span className="min-w-0 break-words line-clamp-2">
            {isDone && '✅ '}
            {isSkipped && '⏭ '}
            {ritual.name}
          </span>
        </p>
        <p className="text-[10px] mt-0.5 truncate" style={{ color: `hsl(${color} / 0.8)` }}>
          <Repeat className="h-2.5 w-2.5 inline mr-0.5" />
          {time} · {getRitualCategoryLabel(ritual.category)}
        </p>
      </div>

      {/* Quick action buttons on hover */}
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

export function DesktopWeekView({ onOpenDay }: { onOpenDay?: (date: Date) => void } = {}) {
  const [centerDate, setCenterDate] = useState(() => new Date());
  const { tasks, appointments, enterprises, getEnterprise, getProject, getProjectType, getAppointmentsForDate, getExternalCalendarEventsForDate, scheduleTask, unscheduleTask, updateTask, deleteAppointment, prioritySettings, getRitualsForDate, isRitualCompleted, rituals, ritualCompletions, planRitualOnDate, completeRitualOnDate, skipRitualOnDate, deleteRitualCompletion, getJournalForDate, saveJournalEntry, deleteJournalEntry, getRemindersForDate, reminders, updateReminder, timeEntries } = usePrp();
  const timer = useTaskTimer({ ripple: true });
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const radarPressRef = useRef<{ timer: number | null; fired: boolean }>({ timer: null, fired: false });
  const focusSurfaceRef = useRef<HTMLDivElement>(null);
  const dayShiftAccumRef = useRef(0);
  const shiftByGestureRef = useRef<((dir: number) => void) | null>(null);
  const focusRef = useRef(45);
  const pinchDistanceRef = useRef<number | null>(null);
  const focusSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCreateAppt, setShowCreateAppt] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateReminder, setShowCreateReminder] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [apptDefaults, setApptDefaults] = useState<{ date?: string; startTime?: string; endTime?: string }>({});
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [editingRitual, setEditingRitual] = useState<{ ritual: RitualData; date: string; time: string; status: string; compId?: string } | null>(null);
  const [journalDate, setJournalDate] = useState<string | null>(null);
  const [followUpTask, setFollowUpTask] = useState<Task | null>(null);
  const [moonDate, setMoonDate] = useState<Date | null>(null);
  const [selectedExternalEvent, setSelectedExternalEvent] = useState<ExternalCalendarEvent | null>(null);
  const [isDraggingItem, setIsDraggingItem] = useState(false);
  const dragNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Slot selection mode
  const [slotSelectMode, setSlotSelectMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [backlogDragging, setBacklogDragging] = useState(false);
  const [focus, setFocus] = useState<number>(() => {
    if (typeof window === 'undefined') return 45;
    const stored = parseFloat(window.localStorage.getItem('calendar-focus') || '45');
    return isNaN(stored) ? 45 : Math.max(0, Math.min(100, stored));
  });
  const focusMode = getFocusMode(focus);
  const isOverview = focusMode === 'month' || focusMode === 'year';
  const dayCount = focusMode === 'week' ? 7 : focusMode === 'threeDays' ? 3 : 1;
  const timelineFocus = Math.max(45, focus);
  const slotH = 24 + ((timelineFocus - 45) / 55) * 40;
  useEffect(() => {
    focusRef.current = focus;
    try { window.localStorage.setItem('calendar-focus', String(focus)); } catch {}
  }, [focus]);

  // Drag-to-create state
  const [dragCreate, setDragCreate] = useState<{ dayDate: string; startSlot: number; endSlot: number } | null>(null);
  const isDraggingCreate = useRef(false);

  const days = Array.from({ length: dayCount }, (_, i) => addDays(centerDate, i - Math.floor(dayCount / 2)));
  // All active rituals for the drag widget
  const activeRituals = rituals.filter(r => r.is_active);
  const getWeeklyCount = (ritualId: string) => {
    return ritualCompletions.filter(c => c.ritual_id === ritualId && c.status === 'done' && days.some(d => format(d, 'yyyy-MM-dd') === c.completed_date)).length;
  };
  const getWeeklyTarget = (ritual: typeof activeRituals[0]) => {
    if (ritual.planning_mode === 'flexible') return ritual.weekly_times_per_week || 2;
    if (ritual.frequency === 'daily') return dayCount;
    if (ritual.weekly_specific_days?.length) return ritual.weekly_specific_days.length;
    return 1;
  };

  // Auto-scroll: keep the current time vertically centered (on mount and when zoom changes)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    const nowY = timeToSlot(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`) * slotH;
    el.scrollTop = Math.max(0, nowY - el.clientHeight / 2);
  }, [slotH]);

  useEffect(() => {
    const surface = focusSurfaceRef.current;
    if (!surface) return;
    const applyDelta = (delta: number) => {
      setFocus(current => Math.max(0, Math.min(100, current + delta)));
      if (focusSnapTimerRef.current) clearTimeout(focusSnapTimerRef.current);
      focusSnapTimerRef.current = setTimeout(() => setFocus(current => snapFocus(current)), 180);
    };
    const onWheel = (event: WheelEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const normalize = (v: number) => v * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
      if (!event.ctrlKey && !event.metaKey && !target?.closest('[role="slider"]')) {
        // Horizontal scroll (trackpad swipe or Shift+wheel): shift days
        const horizontal = event.shiftKey ? event.deltaY : event.deltaX;
        if (Math.abs(horizontal) < 2 || (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))) return;
        event.preventDefault();
        dayShiftAccumRef.current += normalize(horizontal);
        const threshold = 160;
        while (Math.abs(dayShiftAccumRef.current) >= threshold) {
          const dir = dayShiftAccumRef.current > 0 ? 1 : -1;
          dayShiftAccumRef.current -= dir * threshold;
          shiftByGestureRef.current?.(dir);
        }
        return;
      }
      event.preventDefault();
      applyDelta(-normalize(event.deltaY) * 0.035);
    };
    const distance = (touches: TouchList) => Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pinchDistanceRef.current = distance(event.touches);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinchDistanceRef.current === null) return;
      event.preventDefault();
      const nextDistance = distance(event.touches);
      applyDelta((nextDistance - pinchDistanceRef.current) * 0.12);
      pinchDistanceRef.current = nextDistance;
    };
    const onTouchEnd = () => {
      if (pinchDistanceRef.current !== null) setFocus(current => snapFocus(current));
      pinchDistanceRef.current = null;
    };
    surface.addEventListener('wheel', onWheel, { passive: false });
    surface.addEventListener('touchstart', onTouchStart, { passive: true });
    surface.addEventListener('touchmove', onTouchMove, { passive: false });
    surface.addEventListener('touchend', onTouchEnd);
    return () => {
      if (focusSnapTimerRef.current) clearTimeout(focusSnapTimerRef.current);
      surface.removeEventListener('wheel', onWheel);
      surface.removeEventListener('touchstart', onTouchStart);
      surface.removeEventListener('touchmove', onTouchMove);
      surface.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  const shiftPeriod = (direction: -1 | 1) => {
    if (focusMode === 'year') return setCenterDate(date => direction < 0 ? subYears(date, 1) : addYears(date, 1));
    if (focusMode === 'month') return setCenterDate(date => direction < 0 ? subMonths(date, 1) : addMonths(date, 1));
    setCenterDate(date => addDays(date, direction * dayCount));
  };

  // Horizontal scroll gesture: one day at a time in hourly views, one month/year in overviews
  shiftByGestureRef.current = (dir: number) => {
    if (focusMode === 'year') return setCenterDate(date => dir < 0 ? subYears(date, 1) : addYears(date, 1));
    if (focusMode === 'month') return setCenterDate(date => dir < 0 ? subMonths(date, 1) : addMonths(date, 1));
    setCenterDate(date => addDays(date, dir));
  };

  const openOverviewDay = (date: Date) => {
    setCenterDate(date);
    setFocus(82);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', `task:${taskId}`);
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingItem(true);
  };

  const handleRitualDragStart = (e: React.DragEvent, ritualId: string) => {
    e.dataTransfer.setData('text/plain', `ritual:${ritualId}`);
    e.dataTransfer.effectAllowed = 'copy';
    setIsDraggingItem(true);
  };

  const handleReminderDragStart = (e: React.DragEvent, reminderId: string) => {
    e.dataTransfer.setData('text/plain', `reminder:${reminderId}`);
    e.dataTransfer.effectAllowed = 'move';
    setIsDraggingItem(true);
  };

  const handleDragEnd = () => {
    setIsDraggingItem(false);
    if (dragNavTimerRef.current) {
      clearTimeout(dragNavTimerRef.current);
      dragNavTimerRef.current = null;
    }
  };

  // Listen for global dragend to reset state
  useEffect(() => {
    const onDragEnd = () => handleDragEnd();
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  }, []);

  const handleEdgeHover = (direction: 'prev' | 'next') => {
    if (dragNavTimerRef.current) return; // already waiting
    dragNavTimerRef.current = setTimeout(() => {
      setCenterDate(date => addDays(date, direction === 'next' ? dayCount : -dayCount));
      dragNavTimerRef.current = null;
    }, 600);
  };

  const handleEdgeLeave = () => {
    if (dragNavTimerRef.current) {
      clearTimeout(dragNavTimerRef.current);
      dragNavTimerRef.current = null;
    }
  };

  const handleColumnDrop = (e: React.DragEvent, dayDate: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-accent/30');
    handleDragEnd(); // reset drag state on drop
    
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const slotIndex = Math.max(0, Math.min(Math.floor(relativeY / slotH), TOTAL_SLOTS - 1));
    const time = slotToTime(slotIndex);

    const payload = e.dataTransfer.getData('text/plain');
    if (payload.startsWith('ritual:')) {
      const ritualId = payload.slice(7);
      if (ritualId) planRitualOnDate(ritualId, dayDate, time);
      return;
    }
    if (payload.startsWith('reminder:')) {
      const reminderId = payload.slice(9);
      if (reminderId) updateReminder(reminderId, { reminderDate: dayDate, reminderTime: time });
      return;
    }
    if (payload.startsWith('task:')) {
      const taskId = payload.slice(5);
      if (taskId) scheduleTask(taskId, dayDate, time);
      return;
    }
  };

  const handleBacklogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDragEnd(); // reset drag state on drop
    const payload = e.dataTransfer.getData('text/plain');
    if (payload.startsWith('task:')) {
      const taskId = payload.slice(5);
      if (taskId) unscheduleTask(taskId);
    }
  };

  // Current time
  const nowSlot = timeToSlot(format(new Date(), 'HH:mm'));

  return (
    <div ref={focusSurfaceRef} className="flex flex-col h-full">

      {isOverview ? (
        <CalendarOverview mode={focusMode} centerDate={centerDate} onOpenDay={openOverviewDay} />
      ) : <div className="flex flex-1 min-h-0 gap-3">
        {/* Main grid */}
        <div className="flex-1 border rounded-xl bg-card shadow-sm overflow-hidden flex flex-col relative">
          {/* Drag edge zones for week navigation */}
          {isDraggingItem && (
            <>
              <div
                className="absolute left-0 top-0 bottom-0 w-10 z-50 flex items-center justify-center bg-primary/10 border-r-2 border-primary/30 animate-pulse"
                onDragOver={e => { e.preventDefault(); handleEdgeHover('prev'); }}
                onDragLeave={handleEdgeLeave}
                onDrop={e => { e.preventDefault(); handleEdgeLeave(); handleDragEnd(); }}
              >
                <ChevronLeft className="h-6 w-6 text-primary" />
              </div>
              <div
                className="absolute right-0 top-0 bottom-0 w-10 z-50 flex items-center justify-center bg-primary/10 border-l-2 border-primary/30 animate-pulse"
                onDragOver={e => { e.preventDefault(); handleEdgeHover('next'); }}
                onDragLeave={handleEdgeLeave}
                onDrop={e => { e.preventDefault(); handleEdgeLeave(); handleDragEnd(); }}
              >
                <ChevronRight className="h-6 w-6 text-primary" />
              </div>
            </>
          )}
          {/* Day headers - sticky */}
          <div ref={headerScrollRef} className="overflow-hidden border-b shrink-0 bg-card">
            <div
              className={dayCount === 7 ? 'grid min-w-[760px]' : 'grid min-w-full'}
              style={{ gridTemplateColumns: `40px repeat(${dayCount}, minmax(100px, 1fr))` }}
            >
              <div className="p-1" />
              {days.map(day => {
              const dayDate = format(day, 'yyyy-MM-dd');
              const dayTasks = tasks.filter(t => t.scheduledDate === dayDate && (t.status === 'scheduled' || t.status === 'done'));
              const totalMins = dayTasks.filter(t => t.status !== 'done').reduce((s, t) => s + t.estimatedMinutes, 0);
              return (
                <div
                  key={day.toISOString()}
                  className={`px-1 py-2.5 text-center border-l ${onOpenDay ? 'cursor-pointer hover:bg-accent/50 transition-colors' : ''}`}
                  onClick={() => onOpenDay?.(day)}
                  title={onOpenDay ? 'Apri la vista giorno' : undefined}
                >
                  <p className="text-[10px] text-muted-foreground uppercase font-medium leading-none">
                    {format(day, 'EEE', { locale: it })}
                  </p>
                  <div className={`text-sm font-semibold mt-0.5 ${isToday(day) ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="ml-1 text-xs opacity-60 cursor-pointer hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setMoonDate(day); }}
                          >
                            {getMoonPhase(day).emoji}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {getMoonPhase(day).nameIt} — clicca per dettagli
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {totalMins > 0 && (
                    <p className="text-[10px] text-muted-foreground">{formatMinutes(totalMins)}</p>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setJournalDate(dayDate); }}
                    className={`mt-0.5 text-[10px] flex items-center gap-0.5 mx-auto rounded px-1 py-0.5 transition-colors ${
                      getJournalForDate(dayDate)
                        ? 'text-primary font-medium hover:bg-primary/10'
                        : 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent'
                    }`}
                    title="Journal"
                  >
                    <BookOpen className="h-3 w-3" />
                    {getJournalForDate(dayDate) ? 'Journal ✍️' : 'Journal'}
                  </button>
                </div>
              );
              })}
            </div>
          </div>

          {/* Scrollable time grid */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto"
            onScroll={e => {
              if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }}
          >
            <div
              className={dayCount === 7 ? 'grid min-w-[760px]' : 'grid min-w-full'}
              style={{ gridTemplateColumns: `40px repeat(${dayCount}, minmax(100px, 1fr))`, height: TOTAL_SLOTS * slotH }}
            >
              {/* Time column */}
              <div className="relative">
                {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
                  if (i % 2 !== 0) return null;
                  return (
                    <div
                      key={i}
                     className="absolute right-1 text-[10px] text-muted-foreground tabular-nums"
                     style={{ top: i * slotH - 6 }}
                    >
                      {slotToTime(i)}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              {days.map(day => {
                const dayDate = format(day, 'yyyy-MM-dd');
                const dayTasks = tasks.filter(t => t.scheduledDate === dayDate && (t.status === 'scheduled' || t.status === 'done') && !!t.scheduledTime);
                const dayAppts = getAppointmentsForDate(dayDate);
                const dayExternalEvents = getExternalCalendarEventsForDate(dayDate);
                const dayReminders = getRemindersForDate(dayDate);
                const dayTimeEntries = timeEntries.filter(te => {
                  const d = new Date(te.startedAt);
                  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
                  return local === dayDate && (te.durationMinutes || !te.endedAt);
                });
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
                      if ((e.target as HTMLElement).closest('[draggable]')) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const slot = Math.max(0, Math.min(Math.floor(relativeY / slotH), TOTAL_SLOTS - 1));
                      isDraggingCreate.current = true;
                      setDragCreate({ dayDate, startSlot: slot, endSlot: slot + 1 });
                    }}
                    onMouseMove={e => {
                      if (!isDraggingCreate.current || !dragCreate || dragCreate.dayDate !== dayDate) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const slot = Math.max(0, Math.min(Math.floor(relativeY / slotH) + 1, TOTAL_SLOTS));
                      if (slot !== dragCreate.endSlot) {
                        setDragCreate(prev => prev ? { ...prev, endSlot: Math.max(prev.startSlot + 1, slot) } : null);
                      }
                    }}
                    onMouseUp={() => {
                      if (!isDraggingCreate.current || !dragCreate) return;
                      isDraggingCreate.current = false;
                      const startSlot = Math.min(dragCreate.startSlot, dragCreate.endSlot);
                      const endSlot = Math.max(dragCreate.startSlot, dragCreate.endSlot);

                      if (slotSelectMode) {
                        // In slot selection mode: add the slot to the list
                        const newSlot: SelectedSlot = {
                          date: dragCreate.dayDate,
                          startTime: slotToTime(startSlot),
                          endTime: slotToTime(Math.max(startSlot + 1, endSlot)),
                        };
                        setSelectedSlots(prev => [...prev, newSlot]);
                        setDragCreate(null);
                        return;
                      }

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
                        style={{ top: i * slotH }}
                      />
                    ))}

                    {/* Selected slots indicators (slot selection mode) */}
                    {slotSelectMode && selectedSlots.filter(s => s.date === dayDate).map((slot, i) => {
                      const startS = timeToSlot(slot.startTime);
                      const endS = timeToSlot(slot.endTime);
                      return (
                        <div
                          key={`sel-${i}`}
                          className="absolute left-1 right-1 rounded-lg bg-primary/25 border-2 border-primary/50 z-25 pointer-events-none flex items-center justify-center"
                          style={{
                            top: startS * slotH,
                            height: (endS - startS) * slotH,
                          }}
                        >
                          <span className="text-[10px] font-bold text-primary">
                            ✓ {slot.startTime}–{slot.endTime}
                          </span>
                        </div>
                      );
                    })}

                    {/* Drag-to-create selection */}
                    {dragCreate && dragCreate.dayDate === dayDate && (
                      <div
                        className="absolute left-1 right-1 rounded-lg bg-primary/20 border-2 border-primary/40 z-30 pointer-events-none flex items-center justify-center"
                        style={{
                          top: Math.min(dragCreate.startSlot, dragCreate.endSlot) * slotH,
                          height: Math.abs(dragCreate.endSlot - dragCreate.startSlot) * slotH,
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
                        style={{ top: nowSlot * slotH }}
                      >
                        <div className="h-2.5 w-2.5 rounded-full bg-destructive -ml-1" />
                        <div className="flex-1 h-0.5 bg-destructive" />
                      </div>
                    )}

                    {/* Work sessions (logged time) */}
                    {(() => {
                      // Side-by-side layout for overlapping sessions
                      const teLayout = new Map<string, { col: number; cols: number }>();
                      const sorted = [...dayTimeEntries].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
                      const teSpan = (te: typeof sorted[number]) => {
                        const s = new Date(te.startedAt).getTime();
                        const e = te.endedAt ? new Date(te.endedAt).getTime() : s + (te.durationMinutes || 30) * 60000;
                        return [s, Math.max(e, s + 5 * 60000)] as const;
                      };
                      let group: typeof sorted = [];
                      let groupEnd = -1;
                      const flushGroup = () => {
                        if (!group.length) return;
                        const cols: number[] = [];
                        const assigned = group.map(te => {
                          const [s] = teSpan(te);
                          let c = cols.findIndex(end => end <= s);
                          if (c === -1) { c = cols.length; cols.push(0); }
                          cols[c] = teSpan(te)[1];
                          return { id: te.id, col: c };
                        });
                        const total = cols.length;
                        assigned.forEach(a => teLayout.set(a.id, { col: a.col, cols: total }));
                        group = [];
                        groupEnd = -1;
                      };
                      sorted.forEach(te => {
                        const [s, e] = teSpan(te);
                        if (group.length && s >= groupEnd) flushGroup();
                        group.push(te);
                        groupEnd = Math.max(groupEnd, e);
                      });
                      flushGroup();
                      return dayTimeEntries.map(te => {
                      const layout = teLayout.get(te.id) || { col: 0, cols: 1 };
                      const d = new Date(te.startedAt);
                      const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                      const running = !te.endedAt;
                      const mins = running ? Math.max(1, Math.round((timer.now - d.getTime()) / 60000)) : (te.durationMinutes || 0);
                      const { top, height } = getTaskPosition(hhmm, mins || 30, slotH);
                       const ent = getEnterprise(te.enterpriseId);
                      const linkedTask = te.taskId ? tasks.find(t => t.id === te.taskId) : undefined;
                      const taskDone = linkedTask?.status === 'done';
                      return (
                        <div
                          key={`te-${te.id}`}
                          className={`absolute rounded-md border ${running ? 'z-20 border-solid animate-pulse' : 'z-0 border-dashed'} ${linkedTask ? 'cursor-pointer hover:brightness-110' : 'pointer-events-none'}`}
                          style={{
                            top: top + 1,
                            height: Math.max(height - 2, 16),
                            left: `${(layout.col / layout.cols) * 100}%`,
                            width: `calc(${100 / layout.cols}% - 2px)`,
                            backgroundColor: taskDone
                              ? 'hsl(142 70% 45% / 0.12)'
                              : `hsl(${ent?.color || '0 0% 50%'} / ${running ? 0.18 : 0.07})`,
                            borderColor: taskDone
                              ? 'hsl(142 70% 45% / 0.5)'
                              : `hsl(${ent?.color || '0 0% 50%'} / 0.4)`,
                          }}
                          onClick={linkedTask ? (e) => { e.stopPropagation(); setEditingTask(linkedTask); } : undefined}
                          onMouseDown={linkedTask ? (e) => e.stopPropagation() : undefined}
                          onPointerDown={linkedTask ? (e) => e.stopPropagation() : undefined}
                          onTouchStart={linkedTask ? (e) => e.stopPropagation() : undefined}
                          title={linkedTask ? `Apri "${linkedTask.title}"` : undefined}
                        >
                          {linkedTask && (
                            <span className={`absolute top-0.5 left-1 text-[9px] font-medium pointer-events-none truncate max-w-[calc(100%-8px)] ${taskDone ? 'text-green-600 dark:text-green-400 line-through' : 'text-muted-foreground'}`}>
                              {taskDone ? '✓ ' : ''}{linkedTask.title}
                            </span>
                          )}
                          <span className="absolute bottom-0.5 right-1 text-[9px] text-muted-foreground pointer-events-none">
                            {running ? '● In corso ' : taskDone ? '✓ ' : '⏱ '}{formatMinutes(mins)}
                          </span>
                        </div>
                      );
                      });
                    })()}

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
                      dayExternalEvents.forEach(event => {
                        const ss = timeToSlot(event.startTime);
                        const ee = timeToSlot(event.endTime);
                        allTimeInfos.push({ id: `gcal-${event.id}`, startSlot: ss, endSlot: Math.max(ss + 1, ee) });
                      });
                      const dayRituals = getRitualsForDate(day).filter(r => r.planning_mode === 'fixed');
                      dayRituals.forEach(ritual => {
                        const ss = timeToSlot(ritual.suggested_time || '07:00');
                        allTimeInfos.push({ id: `ritual-${ritual.id}`, startSlot: ss, endSlot: ss + Math.ceil(ritual.estimated_minutes / 30) });
                      });
                      const flexCompletions = ritualCompletions.filter(c => c.completed_date === dayDate && c.completed_time);
                      const flexRituals: { ritual: typeof rituals[0]; comp: typeof flexCompletions[0] }[] = [];
                      flexCompletions.forEach(comp => {
                        const ritual = rituals.find(r => r.id === comp.ritual_id);
                        if (!ritual || ritual.planning_mode === 'fixed') return;
                        flexRituals.push({ ritual, comp });
                        const ss = timeToSlot(comp.completed_time!);
                        allTimeInfos.push({ id: `ritual-comp-${comp.id}`, startSlot: ss, endSlot: ss + Math.ceil(ritual.estimated_minutes / 30) });
                      });
                      // Reminders
                       dayReminders.forEach(rem => {
                         const ss = timeToSlot(rem.reminderTime || '09:00');
                         allTimeInfos.push({ id: `rem-${rem.id}`, startSlot: ss, endSlot: ss + 2 });
                      });

                      const uLayout = computeOverlapLayout(allTimeInfos);
                      const uLS = (itemId: string) => {
                        const l = uLayout.get(itemId);
                        const col = l?.column ?? 0;
                        const totalCols = l?.totalColumns ?? 1;
                        const wp = 100 / totalCols;
                        return { left: `calc(${col * wp}% + 2px)`, width: `calc(${wp}% - 4px)` };
                      };

                      return (
                        <>
                          {dayTasks.map(task => {
                            const time = task.scheduledTime || '09:00';
                            const { top, height } = getTaskPosition(time, task.estimatedMinutes, slotH);
                            const ent = getEnterprise(task.enterpriseId);
                            const isDone = task.status === 'done';
                            const sty = uLS(task.id);
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
                                  height: Math.max(height - 2, slotH - 4),
                                  ...sty,
                                  backgroundColor: `hsl(${ent?.color || '0 0% 50%'} / 0.15)`,
                                  borderLeft: `3px solid hsl(${ent?.color || '0 0% 50%'})`,
                                }}
                              >
                                <div className="p-1.5 h-full flex flex-col">
                                  <p className={`font-medium text-xs leading-tight break-words line-clamp-2 ${isDone ? 'line-through' : ''}`} title={task.title}>
                                    {isDone ? '✅ ' : getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings)) + ' '}
                                    {task.title}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {ent?.name} · {formatMinutes(task.estimatedMinutes)}
                                  </p>
                                </div>
                                {!isDone && (
                                  <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5">
                                    {timer.activeTaskId === task.id ? (
                                      <button aria-label="Pausa" title="Pausa" onClick={e => { e.stopPropagation(); timer.pause(); }} className="h-5 w-5 flex items-center justify-center rounded bg-primary text-primary-foreground shadow-sm"><Pause className="h-3 w-3" /></button>
                                    ) : (
                                      <button aria-label="Avvia" title="Avvia" onClick={e => { e.stopPropagation(); timer.start(task); }} className="h-5 w-5 hidden group-hover:flex items-center justify-center rounded bg-card/90 border shadow-sm hover:bg-accent"><Play className="h-3 w-3" /></button>
                                    )}
                                    <button aria-label="Completa" title="Completa" onClick={e => { e.stopPropagation(); timer.complete(task); }} className={`h-5 w-5 items-center justify-center rounded bg-card/90 border shadow-sm hover:bg-accent ${timer.activeTaskId === task.id ? 'flex' : 'hidden group-hover:flex'}`}><Check className="h-3 w-3" /></button>
                                  </div>
                                )}
                                {!isDone && (
                                  <div className="absolute bottom-0.5 right-0.5 hidden group-hover:flex items-center gap-0.5 bg-card/90 rounded-md border shadow-sm px-1 py-0.5">
                                    {task.estimatedMinutes > 30 && (
                                      <button onClick={e => { e.stopPropagation(); updateTask(task.id, { estimatedMinutes: task.estimatedMinutes - 30 }); }} className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent">−30</button>
                                    )}
                                    <button onClick={e => { e.stopPropagation(); updateTask(task.id, { estimatedMinutes: task.estimatedMinutes + 30 }); }} className="text-[10px] font-medium px-1.5 py-0.5 rounded hover:bg-accent">+30</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {dayAppts.map(appt => {
                            const startSlot = timeToSlot(appt.startTime);
                            const endSlot = timeToSlot(appt.endTime);
                            const slots = Math.max(1, endSlot - startSlot);
                            const top = startSlot * slotH;
                            const height = slots * slotH;
                            const ent = appt.enterpriseId ? getEnterprise(appt.enterpriseId) : null;
                            const color = appt.color || ent?.color || '270 60% 55%';
                            const sty = uLS(`appt-${appt.id}`);
                            return (
                              <div
                                key={appt.id}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); setEditingAppt(appt); }}
                                className="absolute rounded-lg overflow-hidden z-10 border-2 border-dashed cursor-pointer group"
                                style={{
                                  top: top + 1,
                                  height: Math.max(height - 2, slotH - 4),
                                  ...sty,
                                  backgroundColor: `hsl(${color} / 0.1)`,
                                  borderColor: `hsl(${color} / 0.4)`,
                                }}
                                title={`${appt.title}\n${appt.startTime}–${appt.endTime}`}
                              >
                                <div className="p-1.5 h-full flex flex-col">
                                  <p className="font-medium text-xs leading-tight flex items-start gap-1">
                                    <CalendarClock className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                                    <span className="min-w-0 break-words line-clamp-2">{appt.title}</span>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {appt.startTime}–{appt.endTime}
                                    {ent ? ` · ${ent.name}` : ''}
                                  </p>
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); deleteAppointment(appt.id); }}
                                  className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center h-5 w-5 rounded bg-card/90 border shadow-sm text-[10px] text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                >×</button>
                              </div>
                            );
                          })}
                          {dayExternalEvents.map((event: ExternalCalendarEvent) => {
                            const startSlot = timeToSlot(event.startTime);
                            const endSlot = timeToSlot(event.endTime);
                            const slots = Math.max(1, endSlot - startSlot);
                            const top = startSlot * slotH;
                            const height = slots * slotH;
                            const ent = event.enterpriseId ? getEnterprise(event.enterpriseId) : null;
                            const color = event.color || ent?.color || '210 80% 50%';
                            const sty = uLS(`gcal-${event.id}`);
                            return (
                              <div
                                key={`gcal-${event.id}`}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); setSelectedExternalEvent(event); }}
                                className="absolute rounded-lg overflow-hidden z-10 border cursor-pointer"
                                style={{
                                  top: top + 1,
                                  height: Math.max(height - 2, slotH - 4),
                                  ...sty,
                                  backgroundColor: googleTintColor(color, 0.12),
                                  borderColor: googleTintColor(color, 0.55),
                                  borderLeft: `3px solid ${googleSolidColor(color)}`,
                                }}
                                title={`${event.title}\n${event.startTime}–${event.endTime}`}
                              >
                                <div className="p-1.5 h-full flex flex-col">
                                  <p className="font-medium text-xs leading-tight flex items-start gap-1">
                                    <CalendarClock className="h-3 w-3 shrink-0" style={{ color: googleSolidColor(color) }} />
                                    <span className="min-w-0 break-words line-clamp-2">{event.title}</span>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {event.allDay ? 'Tutto il giorno' : `${event.startTime}–${event.endTime}`}
                                    {ent ? ` · ${ent.name}` : event.calendarName ? ` · ${event.calendarName}` : ''}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                          {dayRituals.map(ritual => {
                            const time = ritual.suggested_time || '07:00';
                            const startSlot = timeToSlot(time);
                            const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                            const topPos = startSlot * slotH;
                            const heightVal = slotsNeeded * slotH;
                            const color = getRitualCalendarColor(ritual.category);
                            const comp = ritualCompletions.find(c => c.ritual_id === ritual.id && c.completed_date === dayDate);
                            const rstatus = comp?.status || 'pending';
                            const CatIcon = getRitualIcon(ritual.category);
                            return (
                              <RitualCalendarCard
                                key={`ritual-${ritual.id}-${dayDate}`}
                                ritual={ritual} status={rstatus} top={topPos} height={heightVal} color={color} CatIcon={CatIcon} time={time} slotH={slotH}
                                onComplete={() => { if (!comp) { planRitualOnDate(ritual.id, dayDate, time).then(() => completeRitualOnDate(ritual.id, dayDate)); } else { completeRitualOnDate(ritual.id, dayDate); } }}
                                onSkip={() => { if (!comp) { planRitualOnDate(ritual.id, dayDate, time).then(() => skipRitualOnDate(ritual.id, dayDate)); } else { skipRitualOnDate(ritual.id, dayDate); } }}
                                onDelete={comp ? () => deleteRitualCompletion(comp.id) : undefined}
                                onClick={() => setEditingRitual({ ritual, date: dayDate, time, status: rstatus, compId: comp?.id })}
                                style={uLS(`ritual-${ritual.id}`)}
                              />
                            );
                          })}
                          {flexRituals.map(({ ritual, comp }) => {
                            const time = comp.completed_time!;
                            const startSlot = timeToSlot(time);
                            const slotsNeeded = Math.ceil(ritual.estimated_minutes / 30);
                            const topPos = startSlot * slotH;
                            const heightVal = slotsNeeded * slotH;
                            const color = getRitualCalendarColor(ritual.category);
                            const CatIcon = getRitualIcon(ritual.category);
                            return (
                              <RitualCalendarCard
                                key={`ritual-comp-${comp.id}`}
                                ritual={ritual} status={comp.status} top={topPos} height={heightVal} color={color} CatIcon={CatIcon} time={time} slotH={slotH}
                                onComplete={() => completeRitualOnDate(ritual.id, dayDate)}
                                onSkip={() => skipRitualOnDate(ritual.id, dayDate)}
                                onDelete={() => deleteRitualCompletion(comp.id)}
                                onDragStart={e => { deleteRitualCompletion(comp.id); e.dataTransfer.setData('text/plain', `ritual:${ritual.id}`); e.dataTransfer.effectAllowed = 'move'; }}
                                onClick={() => setEditingRitual({ ritual, date: dayDate, time: comp.completed_time!, status: comp.status, compId: comp.id })}
                                style={uLS(`ritual-comp-${comp.id}`)}
                              />
                            );
                          })}
                          {/* Reminder cards */}
                          {dayReminders.map(rem => {
                            const time = rem.reminderTime || '09:00';
                            const ss = timeToSlot(time);
                            const topPos = ss * slotH;
                            const ent = rem.enterpriseId ? getEnterprise(rem.enterpriseId) : null;
                            const color = rem.color || ent?.color || '45 90% 50%';
                            const sty = uLS(`rem-${rem.id}`);
                            return (
                              <div
                                key={`rem-${rem.id}`}
                                draggable
                                onDragStart={e => { e.stopPropagation(); handleReminderDragStart(e, rem.id); }}
                                onMouseDown={e => e.stopPropagation()}
                                onClick={e => { e.stopPropagation(); setEditingReminder(rem); }}
                                className="absolute rounded-lg overflow-hidden z-10 border-2 cursor-grab active:cursor-grabbing group"
                                style={{
                                  top: topPos + 1,
                                  height: Math.max(slotH * 2 - 2, slotH - 4),
                                  ...sty,
                                  backgroundColor: `hsl(${color} / 0.12)`,
                                  borderColor: `hsl(${color} / 0.5)`,
                                  borderStyle: 'solid',
                                }}
                              >
                                <div className="p-1.5 h-full flex flex-col justify-center">
                                  <p className="font-medium text-xs leading-tight flex items-start gap-1" title={rem.title}>
                                    <Bell className="h-3 w-3 shrink-0" style={{ color: `hsl(${color})` }} />
                                    <span className="min-w-0 break-words line-clamp-2">
                                      {rem.isUrgent ? '⭐ ' : rem.isFollowUp ? '🔔 ' : ''}
                                      {rem.title}
                                    </span>
                                  </p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    {time}{ent ? ` · ${ent.name}` : ''}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>}

      {/* Bottom toolbar */}
      <div className="shrink-0 mt-2 rounded-xl border bg-card shadow-sm px-2 py-1.5 flex flex-col gap-1.5">
        <TaskQueue date={centerDate} timer={timer} onOpenTask={setEditingTask} onDragStart={handleDragStart} onDragEnd={() => setIsDraggingItem(false)} />
        {activeRituals.length > 0 && (
          <div className="flex items-center gap-1.5 px-1 overflow-x-auto scrollbar-none">
            <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap shrink-0">
              <Repeat className="h-2.5 w-2.5 inline mr-0.5" />Rituali
            </span>
            {activeRituals.map(r => {
              const count = getWeeklyCount(r.id);
              const target = getWeeklyTarget(r);
              const color = getRitualCalendarColor(r.category);
              const CatIcon = getRitualIcon(r.category);
              const done = count >= target;
              if (done) {
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs whitespace-nowrap opacity-40 cursor-default"
                    style={{ borderColor: `hsl(${color} / 0.3)`, backgroundColor: `hsl(${color} / 0.06)` }}
                  >
                    <CatIcon className="h-3 w-3" style={{ color: `hsl(${color})` }} />
                    <span className="font-medium">{r.name}</span>
                    <span className="font-bold" style={{ color: `hsl(${color})` }}>{count}/{target}</span>
                  </div>
                );
              }
              return (
                <div
                  key={r.id}
                  draggable
                  onDragStart={e => handleRitualDragStart(e, r.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs whitespace-nowrap cursor-grab active:cursor-grabbing hover:shadow-sm hover:scale-[1.02] transition-all"
                  style={{ borderColor: `hsl(${color} / 0.3)`, backgroundColor: `hsl(${color} / 0.06)` }}
                  title="Trascina sul calendario per pianificare"
                >
                  <CatIcon className="h-3 w-3" style={{ color: `hsl(${color})` }} />
                  <span className="font-medium">{r.name}</span>
                  <span className="font-bold" style={{ color: `hsl(${color})` }}>{count}/{target}</span>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-8 text-xs px-2.5" onClick={() => { setApptDefaults({}); setShowChoice(true); }}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Aggiungi
          </Button>
          <Button
            variant={slotSelectMode ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => {
              if (slotSelectMode && selectedSlots.length > 0) {
                setShowSlotDialog(true);
              } else {
                setSlotSelectMode(!slotSelectMode);
                if (!slotSelectMode) setSelectedSlots([]);
              }
            }}
          >
            <Send className="h-3 w-3 mr-1" />
            {slotSelectMode ? (selectedSlots.length > 0 ? `Proponi (${selectedSlots.length})` : 'Esci') : 'Proponi'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2"
            onClick={() => setBacklogOpen(true)}
            title="Apri la coda a tutto schermo"
          >
            <ListTodo className="h-3.5 w-3.5 mr-1" />
            Coda ({tasks.filter(t => t.scheduledDate === format(centerDate, 'yyyy-MM-dd') && t.status === 'scheduled').length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs px-2.5"
            onClick={() => {
              if (radarPressRef.current.fired) { radarPressRef.current.fired = false; return; }
              window.dispatchEvent(new CustomEvent('radar:toggle'));
            }}
            onPointerDown={() => {
              radarPressRef.current.fired = false;
              radarPressRef.current.timer = window.setTimeout(() => {
                radarPressRef.current.fired = true;
                try { navigator.vibrate?.(30); } catch {}
              }, 450);
            }}
            onPointerUp={() => { if (radarPressRef.current.fired) window.dispatchEvent(new CustomEvent('radar:voice')); if (radarPressRef.current.timer) { clearTimeout(radarPressRef.current.timer); radarPressRef.current.timer = null; } }}
            onPointerLeave={() => { if (radarPressRef.current.timer) { clearTimeout(radarPressRef.current.timer); radarPressRef.current.timer = null; } }}
            onContextMenu={(e) => e.preventDefault()}
            title="Apri Radar (tieni premuto per parlare)"
          >
            <Radar className="h-3.5 w-3.5 mr-1 text-primary" />
            Radar
          </Button>
          <div className="flex-1 flex justify-center min-w-0 px-2">
            <div className="flex w-full max-w-[280px] items-center gap-2 rounded-md border bg-background px-2 py-1" title="Messa a fuoco: usa la ghiera, Ctrl + rotellina o il gesto pinch">
              <Aperture className="h-4 w-4 shrink-0 text-primary" />
              <Slider
                value={[focus]}
                min={0}
                max={100}
                step={1}
                onValueChange={value => setFocus(value[0])}
                onValueCommit={value => setFocus(snapFocus(value[0]))}
                className="min-w-0 flex-1"
                aria-label="Messa a fuoco del calendario"
              />
              <span className="w-14 text-right text-[10px] font-medium text-muted-foreground">{FOCUS_STOPS.reduce((best, stop) => Math.abs(stop.value - focus) < Math.abs(best.value - focus) ? stop : best).label}</span>
            </div>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={() => setCenterDate(new Date())}>
            Oggi
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftPeriod(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <QueueFullscreen
        open={backlogOpen}
        onClose={() => setBacklogOpen(false)}
        date={centerDate}
        timer={timer}
        onOpenTask={setEditingTask}
        onAddTask={() => { setApptDefaults({ date: format(centerDate, 'yyyy-MM-dd') }); setShowCreateTask(true); }}
        onDragStart={handleDragStart}
        onDragEnd={() => setIsDraggingItem(false)}
      />

      <CalendarCreateChoice
        open={showChoice}
        onOpenChange={setShowChoice}
        timeLabel={apptDefaults.date ? `${apptDefaults.date} · ${apptDefaults.startTime ?? ''} – ${apptDefaults.endTime ?? ''}` : undefined}
        onChooseAppointment={() => { setShowChoice(false); setTimeout(() => setShowCreateAppt(true), 150); }}
        onChooseTask={() => { setShowChoice(false); setTimeout(() => setShowCreateTask(true), 150); }}
        onChooseReminder={() => { setShowChoice(false); setTimeout(() => setShowCreateReminder(true), 150); }}
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
          onCompleted={(t) => setTimeout(() => setFollowUpTask(t), 300)}
        />
      )}

      {followUpTask && (
        <TaskFollowUpDialog
          open={!!followUpTask}
          onOpenChange={(open) => !open && setFollowUpTask(null)}
          task={followUpTask}
        />
      )}

      <EditAppointmentDialog
        open={!!editingAppt}
        onOpenChange={(open) => !open && setEditingAppt(null)}
        appointment={editingAppt}
      />

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

      {journalDate && (
        <JournalDialog
          open={!!journalDate}
          onOpenChange={(open) => !open && setJournalDate(null)}
          date={journalDate}
          entry={getJournalForDate(journalDate)}
          onSave={saveJournalEntry}
          onDelete={deleteJournalEntry}
        />
      )}

      {showCreateReminder && (
        <CreateReminderDialog
          open={showCreateReminder}
          onOpenChange={setShowCreateReminder}
          defaultDate={apptDefaults.date}
          defaultTime={apptDefaults.startTime}
        />
      )}

      {editingReminder && (
        <EditReminderDialog
          open={!!editingReminder}
          onOpenChange={(open) => !open && setEditingReminder(null)}
          reminder={editingReminder}
        />
      )}

      {moonDate && (
        <MoonDetailDialog
          open={!!moonDate}
          onOpenChange={(open) => !open && setMoonDate(null)}
          date={moonDate}
        />
      )}

      <SlotSelectionDialog
        open={showSlotDialog}
        onClose={() => { setShowSlotDialog(false); setSlotSelectMode(false); }}
        selectedSlots={selectedSlots}
        onRemoveSlot={(i) => setSelectedSlots(prev => prev.filter((_, idx) => idx !== i))}
        onClearSlots={() => setSelectedSlots([])}
        weekDays={days}
      />

      <ExternalEventDetailDialog
        open={!!selectedExternalEvent}
        onOpenChange={(open) => !open && setSelectedExternalEvent(null)}
        event={selectedExternalEvent}
        enterpriseName={selectedExternalEvent?.enterpriseId ? getEnterprise(selectedExternalEvent.enterpriseId)?.name : undefined}
      />
    </div>
  );
}
