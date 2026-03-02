import { Task, ProjectType, PrioritySettings } from '@/types/prp';
import { calculateEffectivePriority, getUrgencyLevel } from '@/lib/priority-engine';
import { TOTAL_SLOTS, timeToSlot, SLOT_MINUTES } from '@/lib/calendar-utils';

/**
 * Compute free slots for a given day's tasks.
 * Returns total free minutes and max consecutive free minutes.
 */
export function computeFreeTime(
  dayTasks: Task[],
  workStartSlot: number = timeToSlot('08:00'),
  workEndSlot: number = timeToSlot('19:00')
): { freeMinutes: number; maxConsecutiveFreeMinutes: number; freeSlots: boolean[] } {
  const totalWorkSlots = workEndSlot - workStartSlot;
  const occupied = new Array(TOTAL_SLOTS).fill(false);

  for (const task of dayTasks) {
    const time = task.scheduledTime || '09:00';
    const start = timeToSlot(time);
    const end = start + Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
    for (let i = start; i < Math.min(end, TOTAL_SLOTS); i++) {
      occupied[i] = true;
    }
  }

  const freeSlots = occupied.map((o, i) => !o && i >= workStartSlot && i < workEndSlot);
  let freeCount = 0;
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (let i = workStartSlot; i < workEndSlot; i++) {
    if (!occupied[i]) {
      freeCount++;
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  return {
    freeMinutes: freeCount * SLOT_MINUTES,
    maxConsecutiveFreeMinutes: maxConsecutive * SLOT_MINUTES,
    freeSlots,
  };
}

/**
 * Determine fit status for a task given available time.
 */
export type FitStatus = 'easy' | 'tight' | 'no-fit';

export function getTaskFitStatus(
  taskMinutes: number,
  freeMinutes: number,
  maxConsecutiveFreeMinutes: number
): FitStatus {
  if (taskMinutes <= maxConsecutiveFreeMinutes && freeMinutes >= taskMinutes * 2) return 'easy';
  if (taskMinutes <= maxConsecutiveFreeMinutes) return 'tight';
  return 'no-fit';
}

export function getFitEmoji(fit: FitStatus): string {
  switch (fit) {
    case 'easy': return '✅';
    case 'tight': return '⚠️';
    case 'no-fit': return '❌';
  }
}

export function getFitLabel(fit: FitStatus, taskMinutes: number): string {
  const h = Math.floor(taskMinutes / 60);
  const m = taskMinutes % 60;
  const dur = h > 0 ? (m > 0 ? `${h}h${m}` : `${h}h`) : `${m}m`;
  switch (fit) {
    case 'easy': return `${dur} – Fit facile`;
    case 'tight': return `${dur} – Fit stretto`;
    case 'no-fit': return `${dur} – Non entra`;
  }
}

/**
 * Categorize backlog tasks into smart sections.
 */
export interface BacklogSections {
  planToday: Task[];
  highStrategic: Task[];
  rest: Task[];
}

export function categorizeBacklog(
  sortedTasks: Task[],
  getProjectType: (projectId: string) => ProjectType,
  settings: PrioritySettings
): BacklogSections {
  const planToday: Task[] = [];
  const highStrategic: Task[] = [];
  const rest: Task[] = [];

  for (const task of sortedTasks) {
    const score = calculateEffectivePriority(task, getProjectType(task.projectId), settings);
    const urgency = getUrgencyLevel(task.deadline, settings);
    const isUrgent = urgency === 'critical' || urgency === 'high';
    const isHighScore = score >= 8;
    const isHighImpact = (task.impact ?? 2) >= 3;
    const isStrategic = getProjectType(task.projectId) === 'strategic';

    if (isUrgent || isHighScore) {
      planToday.push(task);
    } else if ((isHighImpact && isStrategic) || (isHighImpact && score >= 5)) {
      highStrategic.push(task);
    } else {
      rest.push(task);
    }
  }

  return { planToday, highStrategic, rest };
}

/**
 * Find first available slots for top N tasks.
 */
export function findSlotsForTasks(
  topTasks: Task[],
  dayTasks: Task[],
  workStartSlot: number = timeToSlot('08:00'),
  workEndSlot: number = timeToSlot('19:00')
): Map<string, number> {
  const occupied = new Array(TOTAL_SLOTS).fill(false);

  for (const task of dayTasks) {
    const time = task.scheduledTime || '09:00';
    const start = timeToSlot(time);
    const end = start + Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
    for (let i = start; i < Math.min(end, TOTAL_SLOTS); i++) {
      occupied[i] = true;
    }
  }

  const result = new Map<string, number>();

  for (const task of topTasks) {
    const slotsNeeded = Math.ceil(task.estimatedMinutes / SLOT_MINUTES);
    // Find first consecutive free block
    for (let start = workStartSlot; start <= workEndSlot - slotsNeeded; start++) {
      let fits = true;
      for (let j = start; j < start + slotsNeeded; j++) {
        if (occupied[j]) { fits = false; break; }
      }
      if (fits) {
        result.set(task.id, start);
        // Mark these slots as occupied for the next task
        for (let j = start; j < start + slotsNeeded; j++) {
          occupied[j] = true;
        }
        break;
      }
    }
  }

  return result;
}
