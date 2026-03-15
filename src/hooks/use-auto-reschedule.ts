import { useEffect, useRef } from 'react';
import { format, subDays, addDays } from 'date-fns';
import { usePrp } from '@/context/PrpContext';
import { timeToSlot, SLOT_MINUTES, TOTAL_SLOTS } from '@/lib/calendar-utils';
import { toast } from 'sonner';
import type { Task, Appointment } from '@/types/prp';

/**
 * Auto-reschedules incomplete tasks from past days
 * to the first available slots of today, within work hours.
 * Runs once per session.
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

    // Find past incomplete scheduled tasks (not today, not done)
    const pastIncompleteTasks = tasks.filter(t =>
      t.status === 'scheduled' &&
      t.scheduledDate &&
      t.scheduledDate < todayStr
    );

    if (pastIncompleteTasks.length === 0) return;

    // Get work hours from settings
    const workStart = timeToSlot(prioritySettings.workStartTime || '09:00');
    const workEnd = timeToSlot(prioritySettings.workEndTime || '19:00');

    // Get today's existing tasks and appointments to find free slots
    const todayTasks = tasks.filter(t =>
      t.scheduledDate === todayStr &&
      t.scheduledTime &&
      t.status !== 'backlog'
    );
    const todayAppts = appointments.filter(a => a.date === todayStr);

    // Build occupied slots array
    const occupied = new Array(TOTAL_SLOTS).fill(false);

    for (const task of todayTasks) {
      const start = timeToSlot(task.scheduledTime!);
      const end = start + Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
      for (let i = start; i < Math.min(end, TOTAL_SLOTS); i++) {
        occupied[i] = true;
      }
    }

    for (const appt of todayAppts) {
      const start = timeToSlot(appt.startTime);
      const end = timeToSlot(appt.endTime);
      for (let i = start; i < Math.min(end, TOTAL_SLOTS); i++) {
        occupied[i] = true;
      }
    }

    // Sort past tasks by priority (high first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...pastIncompleteTasks].sort((a, b) =>
      (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1)
    );

    let rescheduledCount = 0;

    for (const task of sorted) {
      const slotsNeeded = Math.ceil(task.estimatedMinutes / SLOT_MINUTES);

      // Find first consecutive free block within work hours
      let foundSlot = -1;
      for (let start = workStart; start <= workEnd - slotsNeeded; start++) {
        let fits = true;
        for (let j = start; j < start + slotsNeeded; j++) {
          if (occupied[j]) { fits = false; break; }
        }
        if (fits) {
          foundSlot = start;
          // Mark as occupied
          for (let j = start; j < start + slotsNeeded; j++) {
            occupied[j] = true;
          }
          break;
        }
      }

      if (foundSlot >= 0) {
        // Convert slot back to time
        const totalMinutes = 6 * 60 + foundSlot * SLOT_MINUTES; // START_HOUR = 6
        const h = Math.floor(totalMinutes / 60) % 24;
        const m = totalMinutes % 60;
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        updateTask(task.id, {
          scheduledDate: todayStr,
          scheduledTime: time,
          status: 'scheduled',
        });
        rescheduledCount++;
      } else {
        // No space — schedule for today without specific time
        updateTask(task.id, {
          scheduledDate: todayStr,
          scheduledTime: undefined,
          status: 'scheduled',
        });
        rescheduledCount++;
      }
    }

    if (rescheduledCount > 0) {
      toast.info(
        `🔁 ${rescheduledCount} task non completat${rescheduledCount === 1 ? 'a' : 'e'} ripianificat${rescheduledCount === 1 ? 'a' : 'e'} per oggi`,
        { duration: 5000 }
      );
    }
  }, [loading, tasks, appointments, prioritySettings, updateTask]);
}
