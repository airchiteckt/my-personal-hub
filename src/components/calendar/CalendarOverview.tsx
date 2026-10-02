import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarClock, CheckCircle2, CircleAlert, ListTodo } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import { cn } from '@/lib/utils';

interface CalendarOverviewProps {
  mode: 'month' | 'year';
  centerDate: Date;
  onOpenDay: (date: Date) => void;
}

const weekdays = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export function CalendarOverview({ mode, centerDate, onOpenDay }: CalendarOverviewProps) {
  const { tasks, getAppointmentsForDate, getExternalCalendarEventsForDate, getRemindersForDate } = usePrp();

  const daySummary = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    const dayTasks = tasks.filter(task => task.scheduledDate === key && (task.status === 'scheduled' || task.status === 'done'));
    const appointments = getAppointmentsForDate(key).length + getExternalCalendarEventsForDate(key).length;
    const reminders = getRemindersForDate(key).length;
    const total = dayTasks.length + appointments + reminders;
    return { tasks: dayTasks.length, appointments, reminders, total };
  };

  const intensityClass = (total: number) => {
    if (total >= 6) return 'bg-primary text-primary-foreground';
    if (total >= 4) return 'bg-primary/70 text-primary-foreground';
    if (total >= 2) return 'bg-primary/30 text-foreground';
    if (total === 1) return 'bg-primary/10 text-foreground';
    return 'bg-muted/40 text-muted-foreground';
  };

  if (mode === 'year') {
    const months = Array.from({ length: 12 }, (_, month) => new Date(centerDate.getFullYear(), month, 1));
    return (
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-card p-3">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 className="text-lg font-semibold tabular-nums">{centerDate.getFullYear()}</h2>
          <span className="text-xs text-muted-foreground">Il colore indica il carico della giornata</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {months.map(month => {
            const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
            const last = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
            const days = eachDayOfInterval({ start: first, end: last });
            return (
              <section key={month.toISOString()} className="rounded-md border p-2">
                <h3 className="mb-2 text-xs font-semibold capitalize">{format(month, 'MMMM', { locale: it })}</h3>
                <div className="mb-1 grid grid-cols-7 gap-1">
                  {weekdays.map((weekday, index) => <span key={`${weekday}-${index}`} className="text-center text-[9px] text-muted-foreground">{weekday}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {days.map(day => {
                    const summary = daySummary(day);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => onOpenDay(day)}
                        className={cn(
                          'aspect-square min-w-0 rounded-sm text-[9px] tabular-nums transition-colors hover:ring-1 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          isSameMonth(day, month) ? intensityClass(summary.total) : 'text-muted-foreground/30',
                          isToday(day) && 'ring-2 ring-destructive ring-offset-1 ring-offset-card',
                        )}
                        title={`${format(day, 'd MMMM', { locale: it })}: ${summary.total} elementi`}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  const monthStart = startOfMonth(centerDate);
  const monthEnd = endOfMonth(centerDate);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  });

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-lg border bg-card">
      <div className="grid min-w-[700px] grid-cols-7 border-b bg-muted/30">
        {weekdays.map((weekday, index) => <div key={`${weekday}-${index}`} className="border-l px-2 py-2 text-center text-xs font-medium text-muted-foreground first:border-l-0">{weekday}</div>)}
      </div>
      <div className="grid min-w-[700px] grid-cols-7 auto-rows-[minmax(104px,1fr)]">
        {days.map(day => {
          const summary = daySummary(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onOpenDay(day)}
              className={cn(
                'group min-h-[104px] border-b border-l p-2 text-left transition-colors hover:bg-accent/60 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                !isSameMonth(day, centerDate) && 'bg-muted/20 text-muted-foreground opacity-55',
              )}
            >
              <span className={cn('inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums', isToday(day) && 'bg-destructive text-destructive-foreground')}>{format(day, 'd')}</span>
              {summary.total > 0 && (
                <div className="mt-2 space-y-1 text-[10px] text-muted-foreground">
                  {summary.tasks > 0 && <div className="flex items-center gap-1"><ListTodo className="h-3 w-3" />{summary.tasks} task</div>}
                  {summary.appointments > 0 && <div className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{summary.appointments} appuntamenti</div>}
                  {summary.reminders > 0 && <div className="flex items-center gap-1"><CircleAlert className="h-3 w-3" />{summary.reminders} promemoria</div>}
                  <div className="flex items-center gap-1 pt-1"><CheckCircle2 className="h-3 w-3" />{summary.total} elementi</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
