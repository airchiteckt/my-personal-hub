export type EnterpriseStatus = 'active' | 'development' | 'paused';
export type EnterprisePhase = 'idea' | 'setup' | 'launch' | 'scaling' | 'stable';
export type BusinessCategory = 'core_growth' | 'scale_opportunity' | 'cash_generator' | 'experimental' | 'support';
export type TimeHorizon = 'short' | 'medium' | 'long';
export type ProjectType = 'strategic' | 'operational' | 'maintenance';
export type EnterpriseTemplateType = 'digital_services' | 'local_physical' | 'production_industry' | 'startup_experimental';

export interface EnterpriseTemplateProject {
  name: string;
  type: ProjectType;
  optional?: boolean;
}

export interface EnterpriseTemplate {
  label: string;
  emoji: string;
  description: string;
  examples: string;
  projects: EnterpriseTemplateProject[];
}

export const ENTERPRISE_TEMPLATES: Record<EnterpriseTemplateType, EnterpriseTemplate> = {
  digital_services: {
    label: 'Digitale / Servizi',
    emoji: '💻',
    description: 'SaaS, consulenza, sviluppo, servizi digitali',
    examples: 'Es: Agenzia, Software House, Consulenza',
    projects: [
      { name: 'Amministrazione & Contabilità', type: 'operational' },
      { name: 'Client Delivery', type: 'operational' },
      { name: 'Supporto Clienti', type: 'operational' },
      { name: 'Marketing Continuativo', type: 'operational' },
      { name: 'Gestione Team', type: 'operational' },
      { name: 'Infrastruttura & IT', type: 'operational' },
      { name: 'Compliance & Legale', type: 'maintenance', optional: true },
      { name: 'Reporting & KPI', type: 'maintenance', optional: true },
    ],
  },
  local_physical: {
    label: 'Locale Fisico / Ristorazione',
    emoji: '🏪',
    description: 'Ristoranti, negozi, locali, attività fisiche',
    examples: 'Es: Ristorante, Bar, Negozio',
    projects: [
      { name: 'Amministrazione & Contabilità', type: 'operational' },
      { name: 'Gestione Fornitori', type: 'operational' },
      { name: 'Gestione Personale', type: 'operational' },
      { name: 'Marketing Continuativo', type: 'operational' },
      { name: 'Operatività Locale', type: 'operational' },
      { name: 'Manutenzione Struttura', type: 'operational' },
      { name: 'Compliance & Sicurezza', type: 'maintenance', optional: true },
      { name: 'Controllo di Gestione', type: 'maintenance', optional: true },
    ],
  },
  production_industry: {
    label: 'Produzione / Industria',
    emoji: '🏭',
    description: 'Manifattura, produzione, industria',
    examples: 'Es: Fabbrica, Artigianato, Produzione alimentare',
    projects: [
      { name: 'Amministrazione & Contabilità', type: 'operational' },
      { name: 'Produzione & Ordini', type: 'operational' },
      { name: 'Logistica & Fornitori', type: 'operational' },
      { name: 'Supporto Clienti', type: 'operational' },
      { name: 'Marketing Continuativo', type: 'operational' },
      { name: 'Gestione Team', type: 'operational' },
      { name: 'Infrastruttura Tecnica', type: 'operational' },
      { name: 'Certificazioni & Normative', type: 'maintenance', optional: true },
      { name: 'Controllo Qualità', type: 'maintenance', optional: true },
    ],
  },
  startup_experimental: {
    label: 'Startup / Experimental',
    emoji: '🧪',
    description: 'MVP, test, validazione idea, early stage',
    examples: 'Es: Side project, MVP, Prototipo',
    projects: [
      { name: 'Amministrazione Light', type: 'operational' },
      { name: 'Sviluppo Prodotto', type: 'operational' },
      { name: 'Marketing Test', type: 'operational' },
      { name: 'Infrastruttura Tecnica', type: 'operational' },
    ],
  },
};
export type TaskStatus = 'backlog' | 'scheduled' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type UrgencyLevel = 'normal' | 'attention' | 'high' | 'critical';

export const ENTERPRISE_PHASE_LABELS: Record<EnterprisePhase, string> = {
  idea: '💡 Idea',
  setup: '🔧 Setup',
  launch: '🚀 Lancio',
  scaling: '📈 Scaling',
  stable: '⚖️ Stabilizzazione',
};

export const BUSINESS_CATEGORY_CONFIG: Record<BusinessCategory, { label: string; emoji: string; description: string; defaultWeight: number }> = {
  core_growth: { label: 'Core Growth', emoji: '🚀', description: 'Business destinato a diventare centrale', defaultWeight: 5 },
  scale_opportunity: { label: 'Scale Opportunity', emoji: '📈', description: 'Potenziale di crescita forte', defaultWeight: 4 },
  cash_generator: { label: 'Cash Generator', emoji: '💰', description: 'Business stabile che genera cassa', defaultWeight: 3 },
  experimental: { label: 'Experimental', emoji: '🧪', description: 'Test / MVP / validazione idea', defaultWeight: 2 },
  support: { label: 'Support Function', emoji: '🧱', description: 'Funzione di supporto ad altre imprese', defaultWeight: 2 },
};

export const TIME_HORIZON_LABELS: Record<TimeHorizon, string> = {
  short: '< 6 mesi',
  medium: '6–18 mesi',
  long: '18+ mesi',
};

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
  strategicImportance: number;
  growthPotential: number;
  phase: EnterprisePhase;
  businessCategory: BusinessCategory;
  timeHorizon: TimeHorizon;
  enterpriseType: EnterpriseTemplateType;
  priorityUntil?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  enterpriseId: string;
  name: string;
  type: ProjectType;
  keyResultId?: string;
  isStrategicLever?: boolean;
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

export interface Appointment {
  id: string;
  enterpriseId?: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  color?: string;
  createdAt: string;
}

export type FocusPeriodStatus = 'active' | 'future' | 'archived';
export type MetricType = 'number' | 'percentage' | 'boolean';
export type KRStatus = 'active' | 'at_risk' | 'completed';

export const FOCUS_STATUS_LABELS: Record<FocusPeriodStatus, string> = {
  active: '🟢 Attivo',
  future: '🔵 Futuro',
  archived: '📦 Archiviato',
};

export const KR_STATUS_LABELS: Record<KRStatus, string> = {
  active: 'Attivo',
  at_risk: 'A rischio',
  completed: 'Completato',
};

export const METRIC_TYPE_LABELS: Record<MetricType, string> = {
  number: 'Numero',
  percentage: 'Percentuale',
  boolean: 'Sì/No',
};

export interface FocusPeriod {
  id: string;
  enterpriseId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: FocusPeriodStatus;
  createdAt: string;
}

export interface Objective {
  id: string;
  focusPeriodId: string;
  enterpriseId: string;
  title: string;
  description?: string;
  weight: number;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  enterpriseId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  metricType: MetricType;
  deadline?: string;
  status: KRStatus;
  createdAt: string;
  updatedAt: string;
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
