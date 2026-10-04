import type { Task, TaskPriority } from '@/types/prp';

/** Massimo giornaliero globale (tutte le imprese insieme) per livello di priorità. */
export const PRIORITY_DAILY_LIMITS: Record<TaskPriority, number> = { high: 2, medium: 3, low: 5 };

export const PRIORITY_ORDER: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

export function countPriorityForDay(tasks: Task[], date: string, priority: TaskPriority, excludeId?: string) {
  return tasks.filter(t => t.scheduledDate === date && t.priority === priority && t.status !== 'backlog' && t.id !== excludeId).length;
}

/** Messaggio di avviso morbido se aggiungendo questa task si supera il limite del giorno. */
export function priorityLimitWarning(tasks: Task[], date: string | undefined, priority: TaskPriority, excludeId?: string): string | null {
  if (!date) return null;
  const used = countPriorityForDay(tasks, date, priority, excludeId);
  const max = PRIORITY_DAILY_LIMITS[priority];
  if (used < max) return null;
  const lvl = priority === 'high' ? 'P1' : priority === 'medium' ? 'P2' : 'P3';
  return `Hai già ${used} ${lvl} in questo giorno (massimo ${max}). Valuta di abbassare la priorità o scegliere un altro giorno.`;
}
