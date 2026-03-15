import { useEffect, useRef } from 'react';
import { format, addDays } from 'date-fns';
import { usePrp } from '@/context/PrpContext';
import { timeToSlot, SLOT_MINUTES, TOTAL_SLOTS } from '@/lib/calendar-utils';
import { toast } from 'sonner';

/**
 * Auto-reschedules incomplete tasks from past days
 * to the first available slots of the next work day, within work hours.
 * Skips non-work days (e.g. weekends). Runs once per session.
 */
export function useAutoReschedule() {
  const ran = useRef(false);
  const {
    tasks, appointments, prioritySettings, loading,
    updateTask,
  } = usePrp();

  useEffect(() => {
    if (loading || ran.current) return;
    ran.current = true;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const workDays = prioritySettings.workDays ?? [1, 2, 3, 4, 5];

    // Find the next work day starting from today
    const findNextWorkDay = (): string => {
      let date = new Date();
      for (let i = 0; i < 14; i++) {
        const d = i === 0 ? date : addDays(date, i);
        if (workDays.includes(d.getDay())) {
          return format(d, 'yyyy-MM-dd');
        }
      }
      return todayStr; // fallback
    };

    const targetDay = findNextWorkDay();

    // Find past incomplete scheduled tasks
    const pastIncompleteTasks = tasks.filter(t =>
      t.status === 'scheduled' &&
      t.scheduledDate &&
      t.scheduledDate < targetDay
    );

    if (pastIncompleteTasks.length === 0) return;

    const workStart = timeToSlot(prioritySettings.workStartTime || '09:00');
    const workEnd = timeToSlot(prioritySettings.workEndTime || '19:00');

    // Get target day's existing tasks and appointments
    const dayTasks = tasks.filter(t =>
      t.scheduledDate === targetDay &&
      t.scheduledTime &&
      t.status !== 'backlog'
    );
    const dayAppts = appointments.filter(a => a.date === targetDay);

    // Build occupied slots
    const occupied = new Array(TOTAL_SLOTS).fill(false);

    for (const task of dayTasks) {
      const start = timeToSlot(task.scheduledTime!);
      const end = start + Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
      for (let i = start; i < Math.min(end, TOTAL_SLOTS); i++) occupied[i] = true;
    }
    for (const appt of dayAppts) {
      const start = timeToSlot(appt.startTime);
      const end = timeToSlot(appt.endTime);
      for (let i = start; i < Math.min(end, TOTAL_SLOTS); i++) occupied[i] = true;
    }

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...pastIncompleteTasks].sort((a, b) =>
      (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    );

    let rescheduledCount = 0;

    for (const task of sorted) {
      const slotsNeeded = Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
      let foundSlot = -1;

      for (let start = workStart; start <= workEnd - slotsNeeded; start++) {
        let fits = true;
        for (let j = start; j < start + slotsNeeded; j++) {
          if (occupied[j]) { fits = false; break; }
        }
        if (fits) {
          foundSlot = start;
          for (let j = start; j < start + slotsNeeded; j++) occupied[j] = true;
          break;
        }
      }

      if (foundSlot >= 0) {
        const totalMinutes = 6 * 60 + foundSlot * SLOT_MINUTES;
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        updateTask(task.id, { scheduledDate: targetDay, scheduledTime: time, status: 'scheduled' });
      } else {
        updateTask(task.id, { scheduledDate: targetDay, scheduledTime: undefined, status: 'scheduled' });
      }
      rescheduledCount++;
    }

    if (rescheduledCount > 0) {
      toast.info(
        `🔁 ${rescheduledCount} task ripianificat${rescheduledCount === 1 ? 'a' : 'e'} per ${targetDay === todayStr ? 'oggi' : targetDay}`,
        { duration: 5000 }
      );
    }
  }, [loading, tasks, appointments, prioritySettings, updateTask]);
}
