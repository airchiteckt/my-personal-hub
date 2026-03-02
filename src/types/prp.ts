export type EnterpriseStatus = 'active' | 'development' | 'paused';
export type ProjectType = 'strategic' | 'operational' | 'maintenance';
export type TaskStatus = 'backlog' | 'scheduled' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';

export const ENTERPRISE_COLORS = [
  { name: 'Blu', value: '220 80% 55%' },
  { name: 'Indaco', value: '245 65% 55%' },
  { name: 'Rosa', value: '350 75% 55%' },
  { name: 'Ambra', value: '38 90% 50%' },
  { name: 'Smeraldo', value: '160 70% 40%' },
  { name: 'Teal', value: '175 70% 40%' },
  { name: 'Arancio', value: '25 90% 55%' },
  { name: 'Rosso', value: '0 75% 50%' },
] as const;

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  strategic: '🔵 Strategic',
  operational: '🟡 Operational',
  maintenance: '⚪ Maintenance',
};

export const ENTERPRISE_STATUS_LABELS: Record<EnterpriseStatus, string> = {
  active: 'Attiva',
  development: 'In sviluppo',
  paused: 'In pausa',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Bassa',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  scheduled: 'Pianificata',
  done: 'Completata',
};

export interface Enterprise {
  id: string;
  name: string;
  status: EnterpriseStatus;
  color: string;
  createdAt: string;
}

export interface Project {
  id: string;
  enterpriseId: string;
  name: string;
  type: ProjectType;
  createdAt: string;
}

export interface Task {
  id: string;
  enterpriseId: string;
  projectId: string;
  title: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  scheduledDate?: string;
  deadline?: string;
  isRecurring: boolean;
  recurringFrequency?: string;
  completedAt?: string;
  createdAt: string;
}
