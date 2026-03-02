import { useState, useRef, useEffect } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  TOTAL_SLOTS, DESKTOP_SLOT_HEIGHT, slotToTime, timeToSlot, getTaskPosition, formatMinutes,
  computeOverlapLayout, TaskTimeInfo,
} from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot, getDisplayPriority, getPriorityEmoji } from '@/lib/priority-engine';
import { SmartBacklog } from './SmartBacklog';

export function DesktopWeekView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { tasks, getEnterprise, getProject, getProjectType, scheduleTask, unscheduleTask, updateTask, prioritySettings } = usePrp();
  const scrollRef = useRef<HTMLDivElement>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} — ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: it })}`;

  // Auto-scroll to ~8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = timeToSlot('08:00') * DESKTOP_SLOT_HEIGHT;
    }
  }, []);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDrop = (e: React.DragEvent, dayDate: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-accent/30');
    const taskId = e.dataTransfer.getData('taskId');
    if (!taskId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);
    // Subtract header height (approx 60px for the sticky header)
    const slotIndex = Math.max(0, Math.min(Math.floor(relativeY / DESKTOP_SLOT_HEIGHT), TOTAL_SLOTS - 1));
    const time = slotToTime(slotIndex);
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
              const dayTasks = tasks.filter(t => t.scheduledDate === dayDate && t.status !== 'done');
              const totalMins = dayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
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
                const dayTasks = tasks.filter(t => t.scheduledDate === dayDate && t.status !== 'done');
                const isCurrent = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`relative border-l transition-colors ${isCurrent ? 'bg-accent/20' : ''}`}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-accent/30'); }}
                    onDragLeave={e => { e.currentTarget.classList.remove('bg-accent/30'); }}
                    onDrop={e => handleColumnDrop(e, dayDate)}
                  >
                    {/* Grid lines */}
                    {Array.from({ length: TOTAL_SLOTS }, (_, i) => (
                      <div
                        key={i}
                        className={`absolute left-0 right-0 h-px ${i % 2 === 0 ? 'bg-border/60' : 'bg-border/25'}`}
                        style={{ top: i * DESKTOP_SLOT_HEIGHT }}
                      />
                    ))}

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

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={e => handleDragStart(e, task.id)}
                            className="absolute rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group z-10"
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
                              <p className="font-medium text-xs leading-tight truncate">
                                {getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings))}{' '}
                                {task.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                {ent?.name} · {formatMinutes(task.estimatedMinutes)}
                              </p>
                            </div>

                            {/* Resize controls on hover */}
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
                          </div>
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
    </div>
  );
}
