import { Enterprise, Task } from '@/types/prp';

export interface EnterpriseScore {
  strategic: number;
  growth: number;
  urgency: number;
  operationalLoad: number;
  total: number;
  badge: 'high' | 'medium' | 'low';
}

export function calculateOperationalLoad(
  tasks: Task[],
  enterpriseId: string
): number {
  const entTasks = tasks.filter(t => t.enterpriseId === enterpriseId && t.status !== 'done');
  const backlogCount = entTasks.filter(t => t.status === 'backlog').length;
  const scheduledMinutes = entTasks
    .filter(t => t.status === 'scheduled')
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const recurringCount = entTasks.filter(t => t.isRecurring).length;

  // Normalize to 1-5 scale
  const rawLoad = (backlogCount * 0.3) + (scheduledMinutes / 120) + (recurringCount * 0.5);
  return Math.max(1, Math.min(5, Math.round(rawLoad)));
}

export function calculateUrgencyIndex(
  tasks: Task[],
  enterpriseId: string
): number {
  const now = new Date();
  const entTasks = tasks.filter(t => t.enterpriseId === enterpriseId && t.status !== 'done');

  let urgencyPoints = 0;
  for (const task of entTasks) {
    if (task.deadline) {
      const hoursLeft = (new Date(task.deadline).getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursLeft < 0) urgencyPoints += 3; // overdue
      else if (hoursLeft < 24) urgencyPoints += 2.5;
      else if (hoursLeft < 48) urgencyPoints += 1.5;
      else if (hoursLeft < 72) urgencyPoints += 0.5;
    }
    if (task.priority === 'high' && task.status === 'backlog') {
      urgencyPoints += 0.5;
    }
  }

  return Math.max(1, Math.min(5, Math.round(urgencyPoints)));
}

export function calculateEnterpriseScore(
  enterprise: Enterprise,
  tasks: Task[],
  strategicWeight: number = 2
): EnterpriseScore {
  const strategic = enterprise.strategicImportance;
  const growth = enterprise.growthPotential;
  const urgency = calculateUrgencyIndex(tasks, enterprise.id);
  const operationalLoad = calculateOperationalLoad(tasks, enterprise.id);

  // Check if priority_until is active
  const priorityBoost = enterprise.priorityUntil && new Date(enterprise.priorityUntil) >= new Date() ? 2 : 0;

  const total = (strategic * strategicWeight) + growth + urgency + operationalLoad + priorityBoost;

  const badge: 'high' | 'medium' | 'low' =
    total >= 15 ? 'high' : total >= 10 ? 'medium' : 'low';

  return { strategic, growth, urgency, operationalLoad, total, badge };
}

export function getScoreBadge(badge: 'high' | 'medium' | 'low') {
  switch (badge) {
    case 'high': return { label: 'Alta Priorità', emoji: '🔴', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    case 'medium': return { label: 'Media', emoji: '🟡', className: 'bg-warning/10 text-warning-foreground border-warning/20' };
    case 'low': return { label: 'Bassa', emoji: '⚪', className: 'bg-muted text-muted-foreground border-border' };
  }
}

export function detectAllocationMismatch(
  enterprises: Enterprise[],
  tasks: Task[]
): { enterpriseId: string; name: string; score: number; scheduledMinutes: number; message: string }[] {
  const alerts: { enterpriseId: string; name: string; score: number; scheduledMinutes: number; message: string }[] = [];
  
  const scored = enterprises.map(e => ({
    enterprise: e,
    score: calculateEnterpriseScore(e, tasks),
    scheduledMinutes: tasks
      .filter(t => t.enterpriseId === e.id && t.status === 'scheduled')
      .reduce((sum, t) => sum + t.estimatedMinutes, 0),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score.total - a.score.total);

  if (scored.length >= 2) {
    const top = scored[0];
    const rest = scored.slice(1);
    
    for (const other of rest) {
      if (top.score.total > other.score.total + 3 && top.scheduledMinutes < other.scheduledMinutes) {
        alerts.push({
          enterpriseId: top.enterprise.id,
          name: top.enterprise.name,
          score: top.score.total,
          scheduledMinutes: top.scheduledMinutes,
          message: `"${top.enterprise.name}" ha score ${top.score.total} ma meno tempo pianificato di "${other.enterprise.name}" (score ${other.score.total})`,
        });
        break;
      }
    }
  }

  return alerts;
}
