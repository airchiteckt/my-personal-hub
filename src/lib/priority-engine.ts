import { Task, TaskPriority, ProjectType, PrioritySettings, UrgencyLevel } from '@/types/prp';
import { differenceInHours } from 'date-fns';

const MANUAL_PRIORITY_SCORE: Record<TaskPriority, number> = {
  high: 6,
  medium: 3,
  low: 0,
};

/**
 * Calculate urgency level based on deadline proximity.
 * Only increases priority, never decreases.
 */
export function getUrgencyLevel(
  deadline: string | undefined,
  settings: PrioritySettings
): UrgencyLevel {
  if (!deadline || !settings.deadlineBoostEnabled) return 'normal';
  
  const now = new Date();
  const dl = new Date(deadline);
  const hoursLeft = differenceInHours(dl, now);
  
  if (hoursLeft < 0) return 'critical'; // Past deadline
  if (hoursLeft < settings.deadlineCriticalHours) return 'critical';
  if (hoursLeft < settings.deadlineHighHours) return 'high';
  if (hoursLeft < settings.deadlineAttentionHours) return 'attention';
  return 'normal';
}

/**
 * Calculate deadline boost score.
 */
export function getDeadlineBoost(
  deadline: string | undefined,
  settings: PrioritySettings
): number {
  if (!settings.deadlineBoostEnabled) return 0;
  const urgency = getUrgencyLevel(deadline, settings);
  switch (urgency) {
    case 'critical': return settings.deadlineCriticalBoost;
    case 'high': return settings.deadlineHighBoost;
    case 'attention': return settings.deadlineAttentionBoost;
    default: return 0;
  }
}

/**
 * Calculate strategic score: (Impact × multiplier) - (Effort × penalty)
 */
export function getStrategicScore(
  impact: number | undefined,
  effort: number | undefined,
  settings: PrioritySettings
): number {
  if (!settings.impactEffortEnabled) return 0;
  const i = impact ?? 2; // default medium
  const e = effort ?? 2;
  return (i * settings.impactMultiplier) - (e * settings.effortPenalty);
}

/**
 * Calculate project type weight.
 */
export function getProjectTypeWeight(
  projectType: ProjectType,
  settings: PrioritySettings
): number {
  if (!settings.strategicWeightEnabled) return 0;
  switch (projectType) {
    case 'strategic': return settings.strategicWeight;
    case 'operational': return settings.operationalWeight;
    case 'maintenance': return settings.maintenanceWeight;
  }
}

/**
 * Calculate the effective priority score (higher = more important).
 */
export function calculateEffectivePriority(
  task: Task,
  projectType: ProjectType,
  settings: PrioritySettings
): number {
  const manual = MANUAL_PRIORITY_SCORE[task.priority];
  const deadlineBoost = getDeadlineBoost(task.deadline, settings);
  const strategic = getStrategicScore(task.impact, task.effort, settings);
  const typeWeight = getProjectTypeWeight(projectType, settings);
  
  return manual + deadlineBoost + strategic + typeWeight;
}

/**
 * Get the display priority (what the user sees) based on effective score.
 * The system can only upgrade, never downgrade from manual priority.
 */
export function getDisplayPriority(
  task: Task,
  projectType: ProjectType,
  settings: PrioritySettings
): TaskPriority {
  const score = calculateEffectivePriority(task, projectType, settings);
  
  // Determine computed level
  let computed: TaskPriority;
  if (score >= 8) computed = 'high';
  else if (score >= 4) computed = 'medium';
  else computed = 'low';
  
  // Only upgrade, never downgrade
  const levels: TaskPriority[] = ['low', 'medium', 'high'];
  const manualIdx = levels.indexOf(task.priority);
  const computedIdx = levels.indexOf(computed);
  
  return levels[Math.max(manualIdx, computedIdx)];
}

/**
 * Sort tasks by effective priority (highest first).
 */
export function sortByEffectivePriority(
  tasks: Task[],
  getProjectType: (projectId: string) => ProjectType,
  settings: PrioritySettings
): Task[] {
  return [...tasks].sort((a, b) => {
    const scoreA = calculateEffectivePriority(a, getProjectType(a.projectId), settings);
    const scoreB = calculateEffectivePriority(b, getProjectType(b.projectId), settings);
    return scoreB - scoreA;
  });
}

/**
 * Get urgency color classes for badges/indicators.
 */
export function getUrgencyColor(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical': return 'bg-destructive text-destructive-foreground';
    case 'high': return 'bg-warning text-warning-foreground';
    case 'attention': return 'bg-accent text-accent-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function getUrgencyDot(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'attention': return '🟡';
    default: return '';
  }
}

export function getPriorityEmoji(priority: TaskPriority): string {
  switch (priority) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '⚪';
  }
}
