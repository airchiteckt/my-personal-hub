import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Enterprise, Project, Task, Appointment, PrioritySettings, DEFAULT_PRIORITY_SETTINGS, ProjectType, FocusPeriod, Objective, KeyResult } from '@/types/prp';
import { format } from 'date-fns';
import { sortByEffectivePriority } from '@/lib/priority-engine';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  entityName?: string;
  changes?: Record<string, { old: any; new: any }>;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface TimeEntry {
  id: string;
  taskId?: string;
  projectId: string;
  enterpriseId: string;
  description?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
  createdAt: string;
}

interface PrpContextType {
  enterprises: Enterprise[];
  projects: Project[];
  tasks: Task[];
  appointments: Appointment[];
  focusPeriods: FocusPeriod[];
  objectives: Objective[];
  keyResults: KeyResult[];
  prioritySettings: PrioritySettings;
  loading: boolean;
  setPrioritySettings: (s: PrioritySettings) => void;
  addEnterprise: (e: Omit<Enterprise, 'id' | 'createdAt'>) => Promise<string | undefined>;
  updateEnterprise: (id: string, updates: Partial<Enterprise>) => void;
  deleteEnterprise: (id: string) => void;
  addProject: (p: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'status'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  scheduleTask: (id: string, date: string, time?: string) => void;
  completeTask: (id: string) => void;
  unscheduleTask: (id: string) => void;
  addAppointment: (a: Omit<Appointment, 'id' | 'createdAt'>) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;
  addFocusPeriod: (f: Omit<FocusPeriod, 'id' | 'createdAt'>) => void;
  updateFocusPeriod: (id: string, updates: Partial<FocusPeriod>) => void;
  deleteFocusPeriod: (id: string) => void;
  addObjective: (o: Omit<Objective, 'id' | 'createdAt'>) => void;
  updateObjective: (id: string, updates: Partial<Objective>) => void;
  deleteObjective: (id: string) => void;
  addKeyResult: (kr: Omit<KeyResult, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateKeyResult: (id: string, updates: Partial<KeyResult>) => void;
  deleteKeyResult: (id: string) => void;
  getEnterprise: (id: string) => Enterprise | undefined;
  getProject: (id: string) => Project | undefined;
  getProjectType: (projectId: string) => ProjectType;
  getProjectsForEnterprise: (enterpriseId: string) => Project[];
  getTasksForProject: (projectId: string) => Task[];
  getTasksForDate: (date: string) => Task[];
  getAppointmentsForDate: (date: string) => Appointment[];
  getBacklogTasks: () => Task[];
  getSortedBacklogTasks: () => Task[];
  getFocusPeriodsForEnterprise: (enterpriseId: string) => FocusPeriod[];
  getObjectivesForFocus: (focusPeriodId: string) => Objective[];
  getKeyResultsForObjective: (objectiveId: string) => KeyResult[];
  getProjectsForKeyResult: (keyResultId: string) => Project[];
  getTasksForEnterprise: (enterpriseId: string) => Task[];
  activityLogs: ActivityLog[];
  timeEntries: TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt'>) => void;
  updateTimeEntry: (id: string, updates: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  getActivityLogsForEnterprise: (enterpriseId: string) => ActivityLog[];
  getTimeEntriesForTask: (taskId: string) => TimeEntry[];
  getTimeEntriesForProject: (projectId: string) => TimeEntry[];
  getTimeEntriesForEnterprise: (enterpriseId: string) => TimeEntry[];
}

const PrpContext = createContext<PrpContextType | null>(null);

// --- DB row <-> Frontend type mappers ---
function dbToEnterprise(row: any): Enterprise {
  return {
    id: row.id, name: row.name, status: row.status, color: row.color,
    strategicImportance: row.strategic_importance ?? 3,
    growthPotential: row.growth_potential ?? 3,
    phase: row.phase ?? 'setup',
    businessCategory: row.business_category ?? 'scale_opportunity',
    timeHorizon: row.time_horizon ?? 'medium',
    enterpriseType: row.enterprise_type ?? 'digital_services',
    priorityUntil: row.priority_until ?? undefined,
    createdAt: row.created_at,
  };
}
function dbToProject(row: any): Project {
  return { id: row.id, enterpriseId: row.enterprise_id, name: row.name, type: row.type, createdAt: row.created_at, keyResultId: row.key_result_id ?? undefined, isStrategicLever: row.is_strategic_lever ?? false };
}
function dbToTask(row: any): Task {
  return {
    id: row.id, enterpriseId: row.enterprise_id, projectId: row.project_id,
    title: row.title, estimatedMinutes: row.estimated_minutes, priority: row.priority,
    status: row.status, scheduledDate: row.scheduled_date ?? undefined,
    scheduledTime: row.scheduled_time ?? undefined, deadline: row.deadline ?? undefined,
    impact: row.impact ?? undefined, effort: row.effort ?? undefined,
    isRecurring: row.is_recurring, recurringFrequency: row.recurring_frequency ?? undefined,
    completedAt: row.completed_at ?? undefined, createdAt: row.created_at,
  };
}
function dbToAppointment(row: any): Appointment {
  return {
    id: row.id, enterpriseId: row.enterprise_id ?? undefined,
    title: row.title, description: row.description ?? undefined,
    date: row.date, startTime: row.start_time, endTime: row.end_time,
    color: row.color ?? undefined, createdAt: row.created_at,
  };
}
function dbToFocusPeriod(row: any): FocusPeriod {
  return {
    id: row.id, enterpriseId: row.enterprise_id, name: row.name,
    startDate: row.start_date, endDate: row.end_date, status: row.status,
    createdAt: row.created_at,
  };
}
function dbToObjective(row: any): Objective {
  return {
    id: row.id, focusPeriodId: row.focus_period_id, enterpriseId: row.enterprise_id,
    title: row.title, description: row.description ?? undefined, weight: row.weight ?? 1,
    status: row.status, createdAt: row.created_at,
  };
}
function dbToKeyResult(row: any): KeyResult {
  return {
    id: row.id, objectiveId: row.objective_id, enterpriseId: row.enterprise_id,
    title: row.title, targetValue: Number(row.target_value), currentValue: Number(row.current_value),
    metricType: row.metric_type, deadline: row.deadline ?? undefined,
    status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
function dbToActivityLog(row: any): ActivityLog {
  return {
    id: row.id, entityType: row.entity_type, entityId: row.entity_id,
    action: row.action, entityName: row.entity_name ?? undefined,
    changes: row.changes ?? undefined, metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
  };
}
function dbToTimeEntry(row: any): TimeEntry {
  return {
    id: row.id, taskId: row.task_id ?? undefined, projectId: row.project_id,
    enterpriseId: row.enterprise_id, description: row.description ?? undefined,
    startedAt: row.started_at, endedAt: row.ended_at ?? undefined,
    durationMinutes: row.duration_minutes ?? undefined, createdAt: row.created_at,
  };
}
function dbToSettings(row: any): PrioritySettings {
  return {
    deadlineBoostEnabled: row.deadline_boost_enabled,
    strategicWeightEnabled: row.strategic_weight_enabled,
    impactEffortEnabled: row.impact_effort_enabled,
    deadlineCriticalHours: row.deadline_critical_hours,
    deadlineHighHours: row.deadline_high_hours,
    deadlineAttentionHours: row.deadline_attention_hours,
    deadlineCriticalBoost: row.deadline_critical_boost,
    deadlineHighBoost: row.deadline_high_boost,
    deadlineAttentionBoost: row.deadline_attention_boost,
    strategicWeight: row.strategic_weight,
    operationalWeight: row.operational_weight,
    maintenanceWeight: row.maintenance_weight,
    impactMultiplier: row.impact_multiplier,
    effortPenalty: row.effort_penalty,
  };
}

export function PrpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [focusPeriods, setFocusPeriods] = useState<FocusPeriod[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [prioritySettings, setPrioritySettingsState] = useState<PrioritySettings>(DEFAULT_PRIORITY_SETTINGS);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  const userId = user?.id;

  // --- Initial fetch ---
  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [eRes, pRes, tRes, sRes, aRes, fpRes, oRes, krRes, alRes, teRes] = await Promise.all([
        supabase.from('enterprises').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('tasks').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('priority_settings').select('*').eq('user_id', userId).limit(1).maybeSingle(),
        supabase.from('appointments').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('focus_periods').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('objectives').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('key_results').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200),
        supabase.from('time_entries').select('*').eq('user_id', userId).order('started_at', { ascending: false }),
      ]);
      if (eRes.data) setEnterprises(eRes.data.map(dbToEnterprise));
      if (pRes.data) setProjects(pRes.data.map(dbToProject));
      if (tRes.data) setTasks(tRes.data.map(dbToTask));
      if (aRes.data) setAppointments(aRes.data.map(dbToAppointment));
      if (fpRes.data) setFocusPeriods(fpRes.data.map(dbToFocusPeriod));
      if (oRes.data) setObjectives(oRes.data.map(dbToObjective));
      if (krRes.data) setKeyResults(krRes.data.map(dbToKeyResult));
      if (alRes.data) setActivityLogs(alRes.data.map(dbToActivityLog));
      if (teRes.data) setTimeEntries(teRes.data.map(dbToTimeEntry));

      if (sRes.data) {
        setPrioritySettingsState(dbToSettings(sRes.data));
        setSettingsId(sRes.data.id);
      } else {
        const { data: newSettings } = await supabase
          .from('priority_settings')
          .insert({ user_id: userId })
          .select()
          .single();
        if (newSettings) {
          setPrioritySettingsState(dbToSettings(newSettings));
          setSettingsId(newSettings.id);
        }
      }
      setLoading(false);
    }
    load();
  }, [userId]);

  // --- Realtime subscriptions ---
  useEffect(() => {
    if (!userId) return;
    const channels = [
      supabase.channel('enterprises-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'enterprises', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('enterprises').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setEnterprises(data.map(dbToEnterprise)); });
      }).subscribe(),
      supabase.channel('projects-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setProjects(data.map(dbToProject)); });
      }).subscribe(),
      supabase.channel('tasks-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('tasks').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setTasks(data.map(dbToTask)); });
      }).subscribe(),
      supabase.channel('appointments-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('appointments').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setAppointments(data.map(dbToAppointment)); });
      }).subscribe(),
      supabase.channel('focus-periods-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'focus_periods', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('focus_periods').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setFocusPeriods(data.map(dbToFocusPeriod)); });
      }).subscribe(),
      supabase.channel('objectives-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'objectives', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('objectives').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setObjectives(data.map(dbToObjective)); });
      }).subscribe(),
      supabase.channel('key-results-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'key_results', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('key_results').select('*').eq('user_id', userId).order('created_at').then(({ data }) => { if (data) setKeyResults(data.map(dbToKeyResult)); });
      }).subscribe(),
      supabase.channel('activity-logs-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200).then(({ data }) => { if (data) setActivityLogs(data.map(dbToActivityLog)); });
      }).subscribe(),
      supabase.channel('time-entries-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'time_entries', filter: `user_id=eq.${userId}` }, () => {
        supabase.from('time_entries').select('*').eq('user_id', userId).order('started_at', { ascending: false }).then(({ data }) => { if (data) setTimeEntries(data.map(dbToTimeEntry)); });
      }).subscribe(),
    ];
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [userId]);

  // --- Mutations (all include user_id) ---

  const setPrioritySettings = useCallback(async (s: PrioritySettings) => {
    setPrioritySettingsState(s);
    if (!settingsId) return;
    await supabase.from('priority_settings').update({
      deadline_boost_enabled: s.deadlineBoostEnabled,
      strategic_weight_enabled: s.strategicWeightEnabled,
      impact_effort_enabled: s.impactEffortEnabled,
      deadline_critical_hours: s.deadlineCriticalHours,
      deadline_high_hours: s.deadlineHighHours,
      deadline_attention_hours: s.deadlineAttentionHours,
      deadline_critical_boost: s.deadlineCriticalBoost,
      deadline_high_boost: s.deadlineHighBoost,
      deadline_attention_boost: s.deadlineAttentionBoost,
      strategic_weight: s.strategicWeight,
      operational_weight: s.operationalWeight,
      maintenance_weight: s.maintenanceWeight,
      impact_multiplier: s.impactMultiplier,
      effort_penalty: s.effortPenalty,
    }).eq('id', settingsId);
  }, [settingsId]);

  const addEnterprise = useCallback(async (e: Omit<Enterprise, 'id' | 'createdAt'>): Promise<string | undefined> => {
    if (!userId) return undefined;
    const { data, error } = await supabase.from('enterprises').insert({
      name: e.name, status: e.status, color: e.color, user_id: userId,
      strategic_importance: e.strategicImportance,
      growth_potential: e.growthPotential,
      phase: e.phase,
      business_category: e.businessCategory,
      time_horizon: e.timeHorizon,
      enterprise_type: e.enterpriseType,
      priority_until: e.priorityUntil ?? null,
    }).select().single();
    if (error) { toast.error('Errore creazione impresa'); return undefined; }
    setEnterprises(prev => [...prev, dbToEnterprise(data)]);
    return data.id;
  }, [userId]);

  const updateEnterprise = useCallback(async (id: string, updates: Partial<Enterprise>) => {
    setEnterprises(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.strategicImportance !== undefined) dbUpdates.strategic_importance = updates.strategicImportance;
    if (updates.growthPotential !== undefined) dbUpdates.growth_potential = updates.growthPotential;
    if (updates.phase !== undefined) dbUpdates.phase = updates.phase;
    if (updates.businessCategory !== undefined) dbUpdates.business_category = updates.businessCategory;
    if (updates.timeHorizon !== undefined) dbUpdates.time_horizon = updates.timeHorizon;
    if (updates.enterpriseType !== undefined) dbUpdates.enterprise_type = updates.enterpriseType;
    if (updates.priorityUntil !== undefined) dbUpdates.priority_until = updates.priorityUntil ?? null;
    await supabase.from('enterprises').update(dbUpdates).eq('id', id);
  }, []);

  const deleteEnterprise = useCallback(async (id: string) => {
    setEnterprises(prev => prev.filter(e => e.id !== id));
    setProjects(prev => prev.filter(p => p.enterpriseId !== id));
    setTasks(prev => prev.filter(t => t.enterpriseId !== id));
    await supabase.from('enterprises').delete().eq('id', id);
  }, []);

  const addProject = useCallback(async (p: Omit<Project, 'id' | 'createdAt'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('projects').insert({
      enterprise_id: p.enterpriseId, name: p.name, type: p.type, user_id: userId,
      key_result_id: p.keyResultId ?? null,
      is_strategic_lever: p.isStrategicLever ?? false,
    }).select().single();
    if (error) { toast.error('Errore creazione progetto'); return; }
    setProjects(prev => [...prev, dbToProject(data)]);
  }, [userId]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.keyResultId !== undefined) dbUpdates.key_result_id = updates.keyResultId ?? null;
    if (updates.isStrategicLever !== undefined) dbUpdates.is_strategic_lever = updates.isStrategicLever;
    await supabase.from('projects').update(dbUpdates).eq('id', id);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.filter(t => t.projectId !== id));
    await supabase.from('projects').delete().eq('id', id);
  }, []);

  const addTask = useCallback(async (t: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    if (!userId) return;
    const isScheduled = !!(t.scheduledDate);
    const { data, error } = await supabase.from('tasks').insert({
      enterprise_id: t.enterpriseId, project_id: t.projectId, title: t.title,
      estimated_minutes: t.estimatedMinutes, priority: t.priority,
      is_recurring: t.isRecurring, impact: t.impact ?? null, effort: t.effort ?? null,
      deadline: t.deadline ?? null, user_id: userId,
      scheduled_date: t.scheduledDate ?? null, scheduled_time: t.scheduledTime ?? null,
      status: isScheduled ? 'scheduled' : 'backlog',
    }).select().single();
    if (error) { toast.error('Errore creazione task'); return; }
    setTasks(prev => [...prev, dbToTask(data)]);
  }, [userId]);

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.estimatedMinutes !== undefined) dbUpdates.estimated_minutes = updates.estimatedMinutes;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.scheduledDate !== undefined) dbUpdates.scheduled_date = updates.scheduledDate ?? null;
    if (updates.scheduledTime !== undefined) dbUpdates.scheduled_time = updates.scheduledTime ?? null;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ?? null;
    if (updates.impact !== undefined) dbUpdates.impact = updates.impact ?? null;
    if (updates.effort !== undefined) dbUpdates.effort = updates.effort ?? null;
    if (updates.isRecurring !== undefined) dbUpdates.is_recurring = updates.isRecurring;
    if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt ?? null;
    await supabase.from('tasks').update(dbUpdates).eq('id', id);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  }, []);

  const scheduleTask = useCallback(async (id: string, date: string, time?: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'scheduled' as const, scheduledDate: date, ...(time !== undefined ? { scheduledTime: time } : {}) } : t));
    const dbUpdates: any = { status: 'scheduled', scheduled_date: date };
    if (time !== undefined) dbUpdates.scheduled_time = time;
    await supabase.from('tasks').update(dbUpdates).eq('id', id);
  }, []);

  const completeTask = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' as const, completedAt: now } : t));
    await supabase.from('tasks').update({ status: 'done', completed_at: now }).eq('id', id);
  }, []);

  const unscheduleTask = useCallback(async (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'backlog' as const, scheduledDate: undefined, scheduledTime: undefined } : t));
    await supabase.from('tasks').update({ status: 'backlog', scheduled_date: null, scheduled_time: null }).eq('id', id);
  }, []);

  // --- Appointments CRUD ---
  const addAppointment = useCallback(async (a: Omit<Appointment, 'id' | 'createdAt'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('appointments').insert({
      title: a.title, description: a.description ?? null,
      date: a.date, start_time: a.startTime, end_time: a.endTime,
      enterprise_id: a.enterpriseId ?? null, color: a.color ?? null,
      user_id: userId,
    }).select().single();
    if (error) { toast.error('Errore creazione appuntamento'); return; }
    setAppointments(prev => [...prev, dbToAppointment(data)]);
  }, [userId]);

  const updateAppointment = useCallback(async (id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description ?? null;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.enterpriseId !== undefined) dbUpdates.enterprise_id = updates.enterpriseId ?? null;
    if (updates.color !== undefined) dbUpdates.color = updates.color ?? null;
    await supabase.from('appointments').update(dbUpdates).eq('id', id);
  }, []);

  const deleteAppointment = useCallback(async (id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
    await supabase.from('appointments').delete().eq('id', id);
  }, []);

  // --- Focus Periods CRUD ---
  const addFocusPeriod = useCallback(async (f: Omit<FocusPeriod, 'id' | 'createdAt'>) => {
    if (!userId) return;
    // If the new focus period is active, archive any existing active ones for the same enterprise
    if (f.status === 'active') {
      const existingActive = focusPeriods.filter(fp => fp.enterpriseId === f.enterpriseId && fp.status === 'active');
      for (const fp of existingActive) {
        await supabase.from('focus_periods').update({ status: 'archived' }).eq('id', fp.id);
      }
      setFocusPeriods(prev => prev.map(fp => 
        fp.enterpriseId === f.enterpriseId && fp.status === 'active' ? { ...fp, status: 'archived' } : fp
      ));
    }
    const { data, error } = await supabase.from('focus_periods').insert({
      enterprise_id: f.enterpriseId, name: f.name, start_date: f.startDate,
      end_date: f.endDate, status: f.status, user_id: userId,
    }).select().single();
    if (error) { toast.error('Errore creazione focus period'); return; }
    setFocusPeriods(prev => [...prev, dbToFocusPeriod(data)]);
  }, [userId, focusPeriods]);

  const updateFocusPeriod = useCallback(async (id: string, updates: Partial<FocusPeriod>) => {
    setFocusPeriods(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    await supabase.from('focus_periods').update(dbUpdates).eq('id', id);
  }, []);

  const deleteFocusPeriod = useCallback(async (id: string) => {
    setFocusPeriods(prev => prev.filter(f => f.id !== id));
    setObjectives(prev => prev.filter(o => o.focusPeriodId !== id));
    await supabase.from('focus_periods').delete().eq('id', id);
  }, []);

  // --- Objectives CRUD ---
  const addObjective = useCallback(async (o: Omit<Objective, 'id' | 'createdAt'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('objectives').insert({
      focus_period_id: o.focusPeriodId, enterprise_id: o.enterpriseId,
      title: o.title, description: o.description ?? null, weight: o.weight,
      status: o.status, user_id: userId,
    }).select().single();
    if (error) { toast.error('Errore creazione objective'); return; }
    setObjectives(prev => [...prev, dbToObjective(data)]);
  }, [userId]);

  const updateObjective = useCallback(async (id: string, updates: Partial<Objective>) => {
    setObjectives(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description ?? null;
    if (updates.weight !== undefined) dbUpdates.weight = updates.weight;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    await supabase.from('objectives').update(dbUpdates).eq('id', id);
  }, []);

  const deleteObjective = useCallback(async (id: string) => {
    setObjectives(prev => prev.filter(o => o.id !== id));
    setKeyResults(prev => prev.filter(kr => kr.objectiveId !== id));
    await supabase.from('objectives').delete().eq('id', id);
  }, []);

  // --- Key Results CRUD ---
  const addKeyResult = useCallback(async (kr: Omit<KeyResult, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('key_results').insert({
      objective_id: kr.objectiveId, enterprise_id: kr.enterpriseId,
      title: kr.title, target_value: kr.targetValue, current_value: kr.currentValue,
      metric_type: kr.metricType, deadline: kr.deadline ?? null, status: kr.status,
      user_id: userId,
    }).select().single();
    if (error) { toast.error('Errore creazione key result'); return; }
    setKeyResults(prev => [...prev, dbToKeyResult(data)]);
  }, [userId]);

  const updateKeyResult = useCallback(async (id: string, updates: Partial<KeyResult>) => {
    setKeyResults(prev => prev.map(kr => kr.id === id ? { ...kr, ...updates } : kr));
    const dbUpdates: any = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.targetValue !== undefined) dbUpdates.target_value = updates.targetValue;
    if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
    if (updates.metricType !== undefined) dbUpdates.metric_type = updates.metricType;
    if (updates.deadline !== undefined) dbUpdates.deadline = updates.deadline ?? null;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    await supabase.from('key_results').update(dbUpdates).eq('id', id);
  }, []);

  const deleteKeyResult = useCallback(async (id: string) => {
    setKeyResults(prev => prev.filter(kr => kr.id !== id));
    // Unlink projects
    setProjects(prev => prev.map(p => p.keyResultId === id ? { ...p, keyResultId: undefined } : p));
    await supabase.from('key_results').delete().eq('id', id);
  }, []);

  const getEnterprise = useCallback((id: string) => enterprises.find(e => e.id === id), [enterprises]);
  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getProjectType = useCallback((projectId: string): ProjectType => {
    const p = projects.find(p => p.id === projectId);
    return p?.type ?? 'operational';
  }, [projects]);
  const getProjectsForEnterprise = useCallback((eid: string) => projects.filter(p => p.enterpriseId === eid), [projects]);
  const getTasksForProject = useCallback((pid: string) => tasks.filter(t => t.projectId === pid), [tasks]);
  const getTasksForDate = useCallback((date: string) => tasks.filter(t => t.scheduledDate === date && t.status !== 'done'), [tasks]);
  const getAppointmentsForDate = useCallback((date: string) => appointments.filter(a => a.date === date), [appointments]);
  const getBacklogTasks = useCallback(() => tasks.filter(t => t.status === 'backlog'), [tasks]);
  const getSortedBacklogTasks = useCallback(() => {
    const backlog = tasks.filter(t => t.status === 'backlog');
    return sortByEffectivePriority(backlog, getProjectType, prioritySettings);
  }, [tasks, getProjectType, prioritySettings]);
  const getFocusPeriodsForEnterprise = useCallback((eid: string) => focusPeriods.filter(f => f.enterpriseId === eid), [focusPeriods]);
  const getObjectivesForFocus = useCallback((fpId: string) => objectives.filter(o => o.focusPeriodId === fpId), [objectives]);
  const getKeyResultsForObjective = useCallback((oId: string) => keyResults.filter(kr => kr.objectiveId === oId), [keyResults]);
  const getProjectsForKeyResult = useCallback((krId: string) => projects.filter(p => p.keyResultId === krId), [projects]);
  const getTasksForEnterprise = useCallback((eid: string) => tasks.filter(t => t.enterpriseId === eid), [tasks]);

  // --- Activity Log helper ---
  const logActivity = useCallback(async (params: {
    entityType: string; entityId: string; action: string;
    entityName?: string; changes?: Record<string, { old: any; new: any }>;
    metadata?: Record<string, any>;
  }) => {
    if (!userId) return;
    const { data } = await supabase.from('activity_logs').insert({
      user_id: userId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      entity_name: params.entityName,
      changes: params.changes ?? null,
      metadata: params.metadata ?? null,
    }).select().single();
    if (data) setActivityLogs(prev => [dbToActivityLog(data), ...prev]);
  }, [userId]);

  const getActivityLogsForEnterprise = useCallback((eid: string) => {
    return activityLogs.filter(l =>
      l.metadata?.enterprise_id === eid || (l.entityType === 'enterprise' && l.entityId === eid)
    );
  }, [activityLogs]);

  // --- Time Entries CRUD ---
  const addTimeEntry = useCallback(async (entry: Omit<TimeEntry, 'id' | 'createdAt'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('time_entries').insert({
      user_id: userId, task_id: entry.taskId ?? null, project_id: entry.projectId,
      enterprise_id: entry.enterpriseId, description: entry.description ?? null,
      started_at: entry.startedAt, ended_at: entry.endedAt ?? null,
      duration_minutes: entry.durationMinutes ?? null,
    }).select().single();
    if (error) { toast.error('Errore registrazione tempo'); return; }
    setTimeEntries(prev => [dbToTimeEntry(data), ...prev]);
    logActivity({ entityType: 'time_entry', entityId: data.id, action: 'created', entityName: entry.description || 'Sessione di lavoro', metadata: { enterprise_id: entry.enterpriseId, project_id: entry.projectId, task_id: entry.taskId } });
  }, [userId, logActivity]);

  const updateTimeEntry = useCallback(async (id: string, updates: Partial<TimeEntry>) => {
    setTimeEntries(prev => prev.map(te => te.id === id ? { ...te, ...updates } : te));
    const dbUpdates: any = {};
    if (updates.endedAt !== undefined) dbUpdates.ended_at = updates.endedAt;
    if (updates.durationMinutes !== undefined) dbUpdates.duration_minutes = updates.durationMinutes;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    await supabase.from('time_entries').update(dbUpdates).eq('id', id);
  }, []);

  const deleteTimeEntry = useCallback(async (id: string) => {
    setTimeEntries(prev => prev.filter(te => te.id !== id));
    await supabase.from('time_entries').delete().eq('id', id);
  }, []);

  const getTimeEntriesForTask = useCallback((tid: string) => timeEntries.filter(te => te.taskId === tid), [timeEntries]);
  const getTimeEntriesForProject = useCallback((pid: string) => timeEntries.filter(te => te.projectId === pid), [timeEntries]);
  const getTimeEntriesForEnterprise = useCallback((eid: string) => timeEntries.filter(te => te.enterpriseId === eid), [timeEntries]);

  return (
    <PrpContext.Provider value={{
      enterprises, projects, tasks, appointments, focusPeriods, objectives, keyResults,
      prioritySettings, loading, setPrioritySettings,
      addEnterprise, updateEnterprise, deleteEnterprise,
      addProject, updateProject, deleteProject,
      addTask, updateTask, deleteTask,
      scheduleTask, completeTask, unscheduleTask,
      addAppointment, updateAppointment, deleteAppointment,
      addFocusPeriod, updateFocusPeriod, deleteFocusPeriod,
      addObjective, updateObjective, deleteObjective,
      addKeyResult, updateKeyResult, deleteKeyResult,
      getEnterprise, getProject, getProjectType, getProjectsForEnterprise, getTasksForProject,
      getTasksForDate, getAppointmentsForDate, getBacklogTasks, getSortedBacklogTasks,
      getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective,
      getProjectsForKeyResult, getTasksForEnterprise,
      activityLogs, timeEntries,
      addTimeEntry, updateTimeEntry, deleteTimeEntry,
      getActivityLogsForEnterprise, getTimeEntriesForTask, getTimeEntriesForProject, getTimeEntriesForEnterprise,
    }}>
      {children}
    </PrpContext.Provider>
  );
}

export function usePrp() {
  const ctx = useContext(PrpContext);
  if (!ctx) throw new Error('usePrp must be used within PrpProvider');
  return ctx;
}
