import { useEffect, useRef } from 'react';
import { format, addDays, parseISO, differenceInHours } from 'date-fns';
import { usePrp } from '@/context/PrpContext';
import { useAuth } from '@/context/AuthContext';
import { timeToSlot, slotToTime, SLOT_MINUTES, TOTAL_SLOTS } from '@/lib/calendar-utils';
import { calculateEffectivePriority } from '@/lib/priority-engine';
import { toast } from 'sonner';

const CAPACITY_RATIO = 0.85;
const MAX_AUTO_POSTPONES = 3;

/**
 * Auto-reschedules incomplete tasks from past days onto the next work day,
 * respecting the real capacity of that day:
 *  - only what actually fits (85% of free time) gets a time slot
 *  - everything else goes back to Backlog instead of being stacked
 *  - tasks due within 48h always get a slot
 *  - tasks postponed 3+ times are never force-scheduled again
 * Runs once per user per day.
 */
export function useAutoReschedule() {
  const ran = useRef(false);
  const { user } = useAuth();
  const {
    tasks, appointments, projects, prioritySettings, loading,
    updateTask, reminders, updateReminder,
    getExternalCalendarEventsForDate, getRitualsForDate,
  } = usePrp();

  useEffect(() => {
    if (loading || ran.current || !user) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const guardKey = `flydeck:autoresched:${user.id}:${todayStr}`;
    if (localStorage.getItem(guardKey)) { ran.current = true; return; }
    ran.current = true;

    const workDays = prioritySettings.workDays ?? [1, 2, 3, 4, 5];

    const findNextWorkDay = (): string => {
      const base = new Date();
      for (let i = 0; i < 14; i++) {
        const d = i === 0 ? base : addDays(base, i);
        if (workDays.includes(d.getDay())) return format(d, 'yyyy-MM-dd');
      }
      return todayStr;
    };

    const targetDay = findNextWorkDay();
    const targetIsToday = targetDay === todayStr;

    // ---------- Reminders: move to target day, spaced to avoid collisions ----------
    const pastReminders = (reminders ?? []).filter(r =>
      !r.isDismissed && r.reminderDate && r.reminderDate < targetDay
    );
    if (pastReminders.length > 0) {
      const usedTimes = new Set(
        (reminders ?? [])
          .filter(r => r.reminderDate === targetDay && r.reminderTime)
          .map(r => r.reminderTime as string)
      );
      const nextFreeTime = (time?: string): string | undefined => {
        if (!time) return undefined;
        const [h, m] = time.split(':').map(Number);
        let total = h * 60 + m;
        for (let i = 0; i < 48; i++) {
          const hh = Math.floor(total / 60) % 24;
          const mm = total % 60;
          const candidate = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
          if (!usedTimes.has(candidate)) { usedTimes.add(candidate); return candidate; }
          total += 15;
        }
        return time;
      };
      for (const r of pastReminders) {
        updateReminder(r.id, { reminderDate: targetDay, reminderTime: nextFreeTime(r.reminderTime) });
      }
    }

    // ---------- Tasks ----------
    const pastIncompleteTasks = tasks.filter(t =>
      t.status === 'scheduled' && t.scheduledDate && t.scheduledDate < targetDay
    );

    if (pastIncompleteTasks.length === 0) {
      localStorage.setItem(guardKey, '1');
      if (pastReminders.length > 0) {
        toast.info(`🔔 ${pastReminders.length} promemoria spostat${pastReminders.length === 1 ? 'o' : 'i'} a ${targetIsToday ? 'oggi' : targetDay}`, { duration: 5000 });
      }
      return;
    }

    const workStart = timeToSlot(prioritySettings.workStartTime || '09:00');
    const workEnd = timeToSlot(prioritySettings.workEndTime || '19:00');

    // Never schedule in the past: if target is today, start from the next half hour
    let startSlot = workStart;
    if (targetIsToday) {
      const now = new Date();
      const nowSlot = Math.ceil(
        (now.getHours() * 60 + now.getMinutes() - 6 * 60) / SLOT_MINUTES
      );
      startSlot = Math.max(workStart, nowSlot);
    }

    // ---------- Occupancy of the target day ----------
    const occupied = new Array(TOTAL_SLOTS).fill(false);
    const block = (from: number, to: number) => {
      for (let i = Math.max(0, from); i < Math.min(to, TOTAL_SLOTS); i++) occupied[i] = true;
    };

    for (const t of tasks) {
      if (t.scheduledDate === targetDay && t.scheduledTime && t.status !== 'backlog') {
        const s = timeToSlot(t.scheduledTime);
        block(s, s + Math.ceil(t.estimatedMinutes / SLOT_MINUTES));
      }
    }
    for (const a of appointments.filter(a => a.date === targetDay)) {
      block(timeToSlot(a.startTime), timeToSlot(a.endTime));
    }
    for (const e of getExternalCalendarEventsForDate(targetDay)) {
      if (e.allDay) continue;
      block(timeToSlot(e.startTime), timeToSlot(e.endTime));
    }
    try {
      for (const r of getRitualsForDate(parseISO(targetDay))) {
        if (!r.suggested_time) continue;
        const s = timeToSlot(r.suggested_time);
        block(s, s + Math.ceil((r.estimated_minutes || 30) / SLOT_MINUTES));
      }
    } catch { /* rituals are optional for capacity */ }

    // ---------- Capacity budget ----------
    let freeSlotsCount = 0;
    for (let i = startSlot; i < workEnd; i++) if (!occupied[i]) freeSlotsCount++;
    let budgetMinutes = Math.floor(freeSlotsCount * SLOT_MINUTES * CAPACITY_RATIO);

    // ---------- Ordering ----------
    const projectType = (projectId: string) =>
      projects.find(p => p.id === projectId)?.type ?? 'operational';

    const isUrgent = (t: typeof pastIncompleteTasks[number]) => {
      if (!t.deadline) return false;
      const h = differenceInHours(new Date(t.deadline), new Date());
      return h <= 48;
    };

    const sorted = [...pastIncompleteTasks].sort((a, b) => {
      if (isUrgent(a) !== isUrgent(b)) return isUrgent(a) ? -1 : 1;
      return (
        calculateEffectivePriority(b, projectType(b.projectId), prioritySettings) -
        calculateEffectivePriority(a, projectType(a.projectId), prioritySettings)
      );
    });

    let scheduled = 0;
    let movedToBacklog = 0;
    let tooManyPostpones = 0;

    for (const task of sorted) {
      const postponeCount = (task.postponeCount ?? 0) + 1;
      const urgent = isUrgent(task);
      const slotsNeeded = Math.ceil(task.estimatedMinutes / SLOT_MINUTES);

      const stale = postponeCount > MAX_AUTO_POSTPONES && !urgent;
      const overBudget = !urgent && task.estimatedMinutes > budgetMinutes;

      let placedSlot = -1;
      if (!stale && !overBudget) {
        for (let s = startSlot; s <= workEnd - slotsNeeded; s++) {
          let fits = true;
          for (let j = s; j < s + slotsNeeded; j++) if (occupied[j]) { fits = false; break; }
          if (fits) { placedSlot = s; break; }
        }
      }

      if (placedSlot >= 0) {
        for (let j = placedSlot; j < placedSlot + slotsNeeded; j++) occupied[j] = true;
        if (!urgent) budgetMinutes -= task.estimatedMinutes;
        updateTask(task.id, {
          scheduledDate: targetDay,
          scheduledTime: slotToTime(placedSlot),
          status: 'scheduled',
          postponeCount,
        });
        scheduled++;
      } else {
        updateTask(task.id, {
          status: 'backlog',
          scheduledDate: undefined,
          scheduledTime: undefined,
          postponeCount,
        });
        movedToBacklog++;
        if (stale) tooManyPostpones++;
      }
    }

    localStorage.setItem(guardKey, '1');

    const parts: string[] = [];
    if (scheduled > 0) parts.push(`${scheduled} ripianificat${scheduled === 1 ? 'a' : 'e'} per ${targetIsToday ? 'oggi' : targetDay}`);
    if (movedToBacklog > 0) parts.push(`${movedToBacklog} nel Backlog (giornata piena${tooManyPostpones > 0 ? `, ${tooManyPostpones} da rivedere` : ''})`);
    if (pastReminders.length > 0) parts.push(`${pastReminders.length} promemoria spostat${pastReminders.length === 1 ? 'o' : 'i'}`);
    if (parts.length > 0) toast.info(`🔁 ${parts.join(' · ')}`, { duration: 7000 });
  }, [
    loading, user, tasks, appointments, projects, reminders, prioritySettings,
    updateTask, updateReminder, getExternalCalendarEventsForDate, getRitualsForDate,
  ]);
}
