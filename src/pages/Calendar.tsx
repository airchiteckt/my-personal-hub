import { useState } from 'react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isToday as isTodayFn } from 'date-fns';
import { it } from 'date-fns/locale';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, GripVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const Calendar = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { tasks, getEnterprise, getProject, scheduleTask, unscheduleTask, getBacklogTasks } = usePrp();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const backlogTasks = getBacklogTasks();

  const getTasksForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(t => t.scheduledDate === dateStr && t.status !== 'done');
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) scheduleTask(taskId, format(date, 'yyyy-MM-dd'));
  };

  const handleBacklogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) unscheduleTask(taskId);
  };

  const weekLabel = `${format(weekStart, 'd MMM', { locale: it })} — ${format(addDays(weekStart, 6), 'd MMM yyyy', { locale: it })}`;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)' }}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground mt-1">{weekLabel}</p>
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

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2 flex-1 min-h-0 mb-4">
        {days.map(day => {
          const dayTasks = getTasksForDay(day);
          const totalMins = dayTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
          const isCurrentDay = isTodayFn(day);

          return (
            <div
              key={day.toISOString()}
              className={`flex flex-col rounded-xl border overflow-hidden transition-colors ${
                isCurrentDay ? 'border-primary/50 bg-accent/50' : 'bg-card'
              }`}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-accent'); }}
              onDragLeave={e => { e.currentTarget.classList.remove('bg-accent'); }}
              onDrop={e => { e.currentTarget.classList.remove('bg-accent'); handleDrop(e, day); }}
            >
              <div className="p-3 border-b text-center shrink-0">
                <p className="text-xs text-muted-foreground uppercase font-medium">
                  {format(day, 'EEE', { locale: it })}
                </p>
                <p className={`text-lg font-semibold ${isCurrentDay ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </p>
                {totalMins > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {Math.floor(totalMins / 60)}h {totalMins % 60}m
                  </p>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-1.5 space-y-1.5">
                  {dayTasks.map(task => {
                    const ent = getEnterprise(task.enterpriseId);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={e => handleDragStart(e, task.id)}
                        className="p-2 rounded-md bg-muted/60 cursor-grab active:cursor-grabbing text-xs hover:bg-muted transition-colors"
                        style={{ borderLeft: `3px solid hsl(${ent?.color || '0 0% 50%'})` }}
                      >
                        <p className="font-medium truncate leading-tight">{task.title}</p>
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {task.estimatedMinutes}m
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {/* Backlog */}
      <div
        className="shrink-0 border rounded-xl p-4 bg-card"
        onDragOver={e => e.preventDefault()}
        onDrop={handleBacklogDrop}
      >
        <h3 className="font-semibold text-sm mb-3">
          Backlog
          <span className="ml-2 text-muted-foreground font-normal">({backlogTasks.length})</span>
        </h3>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {backlogTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nessuna task nel backlog — tutte pianificate! 🎉</p>
          ) : (
            backlogTasks.map(task => {
              const ent = getEnterprise(task.enterpriseId);
              const proj = getProject(task.projectId);
              return (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task.id)}
                  className="shrink-0 p-3 rounded-lg border bg-muted/30 cursor-grab active:cursor-grabbing w-52 hover:bg-muted/50 transition-colors"
                  style={{ borderLeft: `3px solid hsl(${ent?.color || '0 0% 50%'})` }}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {ent?.name} · {proj?.name}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {task.estimatedMinutes}m
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
