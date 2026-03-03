import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, X, Clock, TrendingUp, Target, Repeat, CalendarDays } from 'lucide-react';
import { RitualData, RitualCompletion, getRitualCategoryLabel, getRitualCalendarColor, getRitualIcon, getWeeklyTarget } from '@/lib/ritual-utils';
import { formatMinutes } from '@/lib/calendar-utils';
import { format, startOfWeek, addDays, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';

interface RitualQuickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ritual: RitualData;
  date: string;
  time: string;
  status: string; // 'planned' | 'pending' | 'done' | 'skipped'
  allCompletions: RitualCompletion[];
  onComplete: () => void;
  onSkip: () => void;
  onDelete?: () => void;
  onChangeTime: (newTime: string) => void;
}

export function RitualQuickDialog({
  open, onOpenChange, ritual, date, time, status,
  allCompletions, onComplete, onSkip, onDelete, onChangeTime,
}: RitualQuickDialogProps) {
  const [editTime, setEditTime] = useState(time);
  const isDone = status === 'done';
  const isSkipped = status === 'skipped';
  const isPlanned = status === 'planned' || status === 'pending';
  const color = getRitualCalendarColor(ritual.category);
  const CatIcon = getRitualIcon(ritual.category);
  const weeklyTarget = getWeeklyTarget(ritual);

  // KPIs: this week completions
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekDays = Array.from({ length: 7 }, (_, i) => format(addDays(thisWeekStart, i), 'yyyy-MM-dd'));

  const ritualCompletions = useMemo(
    () => allCompletions.filter(c => c.ritual_id === ritual.id),
    [allCompletions, ritual.id]
  );

  const thisWeekDone = useMemo(
    () => ritualCompletions.filter(c => thisWeekDays.includes(c.completed_date) && c.status === 'done').length,
    [ritualCompletions, thisWeekDays]
  );

  const thisWeekSkipped = useMemo(
    () => ritualCompletions.filter(c => thisWeekDays.includes(c.completed_date) && c.status === 'skipped').length,
    [ritualCompletions, thisWeekDays]
  );

  // Last 4 weeks streak
  const last4WeeksRate = useMemo(() => {
    let totalDone = 0;
    let totalTarget = 0;
    for (let w = 0; w < 4; w++) {
      const wStart = subWeeks(thisWeekStart, w);
      const wDays = Array.from({ length: 7 }, (_, i) => format(addDays(wStart, i), 'yyyy-MM-dd'));
      const done = ritualCompletions.filter(c => wDays.includes(c.completed_date) && c.status === 'done').length;
      totalDone += done;
      totalTarget += weeklyTarget;
    }
    return totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0;
  }, [ritualCompletions, thisWeekStart, weeklyTarget]);

  // Current streak (consecutive weeks meeting target)
  const streak = useMemo(() => {
    let s = 0;
    for (let w = 0; w < 12; w++) {
      const wStart = subWeeks(thisWeekStart, w);
      const wDays = Array.from({ length: 7 }, (_, i) => format(addDays(wStart, i), 'yyyy-MM-dd'));
      const done = ritualCompletions.filter(c => wDays.includes(c.completed_date) && c.status === 'done').length;
      if (done >= weeklyTarget) s++;
      else break;
    }
    return s;
  }, [ritualCompletions, thisWeekStart, weeklyTarget]);

  const handleTimeChange = () => {
    if (editTime !== time) {
      onChangeTime(editTime);
    }
  };

  const dateFormatted = (() => {
    try { return format(new Date(date), "EEEE d MMMM", { locale: it }); } catch { return date; }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CatIcon className="h-5 w-5" style={{ color: `hsl(${color})` }} />
            {ritual.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground capitalize">{dateFormatted}</p>
        </DialogHeader>

        {/* Description */}
        {ritual.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{ritual.description}</p>
        )}

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <Badge
            variant={isDone ? 'default' : isSkipped ? 'secondary' : 'outline'}
            className={isDone ? 'bg-green-600' : ''}
          >
            {isDone ? '✅ Completato' : isSkipped ? '⏭ Saltato' : '📋 Pianificato'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {getRitualCategoryLabel(ritual.category)} · {formatMinutes(ritual.estimated_minutes)}
          </span>
        </div>

        {/* Time editor */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> Orario
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="w-32 h-9"
            />
            {editTime !== time && (
              <Button size="sm" variant="outline" onClick={handleTimeChange} className="h-9">
                Aggiorna
              </Button>
            )}
          </div>
        </div>

        {/* KPI Section */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border p-2.5 text-center space-y-0.5">
            <div className="flex items-center justify-center gap-1">
              <Target className="h-3.5 w-3.5 text-primary" />
              <span className="text-lg font-bold">{thisWeekDone}/{weeklyTarget}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Questa settimana</p>
          </div>
          <div className="rounded-lg border p-2.5 text-center space-y-0.5">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-lg font-bold">{last4WeeksRate}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Tasso 4 sett.</p>
          </div>
          <div className="rounded-lg border p-2.5 text-center space-y-0.5">
            <div className="flex items-center justify-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-primary" />
              <span className="text-lg font-bold">{streak}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Streak sett.</p>
          </div>
        </div>

        {/* This week visual */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Settimana corrente</p>
          <div className="flex gap-1">
            {thisWeekDays.map((d, i) => {
              const comp = ritualCompletions.find(c => c.completed_date === d);
              const dayLabel = ['L', 'M', 'M', 'G', 'V', 'S', 'D'][i];
              const isToday = d === format(new Date(), 'yyyy-MM-dd');
              return (
                <div
                  key={d}
                  className={`flex-1 rounded-md border text-center py-1.5 text-[10px] font-medium ${
                    comp?.status === 'done'
                      ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400'
                      : comp?.status === 'skipped'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500'
                      : isToday
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <span className="block">{dayLabel}</span>
                  <span className="block text-[9px]">
                    {comp?.status === 'done' ? '✅' : comp?.status === 'skipped' ? '⏭' : '·'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {isPlanned && (
            <>
              <Button
                onClick={() => { onComplete(); onOpenChange(false); }}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="sm"
              >
                <Check className="h-4 w-4 mr-1" /> Fatto
              </Button>
              <Button
                onClick={() => { onSkip(); onOpenChange(false); }}
                variant="outline"
                className="flex-1 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                size="sm"
              >
                <X className="h-4 w-4 mr-1" /> Salta
              </Button>
            </>
          )}
          {(isDone || isSkipped) && onDelete && (
            <Button
              onClick={() => { onDelete(); onOpenChange(false); }}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Repeat className="h-4 w-4 mr-1" /> Resetta
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
