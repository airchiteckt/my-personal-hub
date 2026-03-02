export type EnterpriseStatus = 'active' | 'development' | 'paused';
export type ProjectType = 'strategic' | 'operational' | 'maintenance';
export type TaskStatus = 'backlog' | 'scheduled' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type UrgencyLevel = 'normal' | 'attention' | 'high' | 'critical';

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

export const URGENCY_LABELS: Record<UrgencyLevel, string> = {
  normal: 'Normale',
  attention: 'Attenzione',
  high: 'Alta',
  critical: 'Critica',
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
  scheduledTime?: string;
  deadline?: string;
  impact?: number; // 1-3
  effort?: number; // 1-3
  isRecurring: boolean;
  recurringFrequency?: string;
  completedAt?: string;
  createdAt: string;
}

export interface PrioritySettings {
  deadlineBoostEnabled: boolean;
  strategicWeightEnabled: boolean;
  impactEffortEnabled: boolean;
  // Deadline boost values
  deadlineCriticalHours: number; // default 24
  deadlineHighHours: number; // default 48
  deadlineAttentionHours: number; // default 72
  deadlineCriticalBoost: number; // default 3
  deadlineHighBoost: number; // default 2
  deadlineAttentionBoost: number; // default 1
  // Project type weights
  strategicWeight: number; // default 2
  operationalWeight: number; // default 0
  maintenanceWeight: number; // default -1
  // Impact/effort
  impactMultiplier: number; // default 2
  effortPenalty: number; // default 1
}

export const DEFAULT_PRIORITY_SETTINGS: PrioritySettings = {
  deadlineBoostEnabled: true,
  strategicWeightEnabled: true,
  impactEffortEnabled: true,
  deadlineCriticalHours: 24,
  deadlineHighHours: 48,
  deadlineAttentionHours: 72,
  deadlineCriticalBoost: 3,
  deadlineHighBoost: 2,
  deadlineAttentionBoost: 1,
  strategicWeight: 2,
  operationalWeight: 0,
  maintenanceWeight: -1,
  impactMultiplier: 2,
  effortPenalty: 1,
};
