import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Enterprise, Project, Task, PrioritySettings, DEFAULT_PRIORITY_SETTINGS, ProjectType } from '@/types/prp';
import { format } from 'date-fns';
import { sortByEffectivePriority } from '@/lib/priority-engine';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface PrpContextType {
  enterprises: Enterprise[];
  projects: Project[];
  tasks: Task[];
  prioritySettings: PrioritySettings;
  loading: boolean;
  setPrioritySettings: (s: PrioritySettings) => void;
  addEnterprise: (e: Omit<Enterprise, 'id' | 'createdAt'>) => void;
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
  getEnterprise: (id: string) => Enterprise | undefined;
  getProject: (id: string) => Project | undefined;
  getProjectType: (projectId: string) => ProjectType;
  getProjectsForEnterprise: (enterpriseId: string) => Project[];
  getTasksForProject: (projectId: string) => Task[];
  getTasksForDate: (date: string) => Task[];
  getBacklogTasks: () => Task[];
  getSortedBacklogTasks: () => Task[];
}

const PrpContext = createContext<PrpContextType | null>(null);

// --- DB row <-> Frontend type mappers ---
function dbToEnterprise(row: any): Enterprise {
  return { id: row.id, name: row.name, status: row.status, color: row.color, createdAt: row.created_at };
}
function dbToProject(row: any): Project {
  return { id: row.id, enterpriseId: row.enterprise_id, name: row.name, type: row.type, createdAt: row.created_at };
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
  const [prioritySettings, setPrioritySettingsState] = useState<PrioritySettings>(DEFAULT_PRIORITY_SETTINGS);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = user?.id;

  // --- Initial fetch ---
  useEffect(() => {
    if (!userId) return;

    async function load() {
      const [eRes, pRes, tRes, sRes] = await Promise.all([
        supabase.from('enterprises').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('projects').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('tasks').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('priority_settings').select('*').eq('user_id', userId).limit(1).maybeSingle(),
      ]);
      if (eRes.data) setEnterprises(eRes.data.map(dbToEnterprise));
      if (pRes.data) setProjects(pRes.data.map(dbToProject));
      if (tRes.data) setTasks(tRes.data.map(dbToTask));

      if (sRes.data) {
        setPrioritySettingsState(dbToSettings(sRes.data));
        setSettingsId(sRes.data.id);
      } else {
        // Create default settings for new user
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

  const addEnterprise = useCallback(async (e: Omit<Enterprise, 'id' | 'createdAt'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('enterprises').insert({ name: e.name, status: e.status, color: e.color, user_id: userId }).select().single();
    if (error) { toast.error('Errore creazione impresa'); return; }
    setEnterprises(prev => [...prev, dbToEnterprise(data)]);
  }, [userId]);

  const updateEnterprise = useCallback(async (id: string, updates: Partial<Enterprise>) => {
    setEnterprises(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
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
    }).select().single();
    if (error) { toast.error('Errore creazione progetto'); return; }
    setProjects(prev => [...prev, dbToProject(data)]);
  }, [userId]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    await supabase.from('projects').update(dbUpdates).eq('id', id);
  }, []);

  const deleteProject = useCallback(async (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.filter(t => t.projectId !== id));
    await supabase.from('projects').delete().eq('id', id);
  }, []);

  const addTask = useCallback(async (t: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    if (!userId) return;
    const { data, error } = await supabase.from('tasks').insert({
      enterprise_id: t.enterpriseId, project_id: t.projectId, title: t.title,
      estimated_minutes: t.estimatedMinutes, priority: t.priority,
      is_recurring: t.isRecurring, impact: t.impact ?? null, effort: t.effort ?? null,
      deadline: t.deadline ?? null, user_id: userId,
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

  const getEnterprise = useCallback((id: string) => enterprises.find(e => e.id === id), [enterprises]);
  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getProjectType = useCallback((projectId: string): ProjectType => {
    const p = projects.find(p => p.id === projectId);
    return p?.type ?? 'operational';
  }, [projects]);
  const getProjectsForEnterprise = useCallback((eid: string) => projects.filter(p => p.enterpriseId === eid), [projects]);
  const getTasksForProject = useCallback((pid: string) => tasks.filter(t => t.projectId === pid), [tasks]);
  const getTasksForDate = useCallback((date: string) => tasks.filter(t => t.scheduledDate === date && t.status !== 'done'), [tasks]);
  const getBacklogTasks = useCallback(() => tasks.filter(t => t.status === 'backlog'), [tasks]);
  const getSortedBacklogTasks = useCallback(() => {
    const backlog = tasks.filter(t => t.status === 'backlog');
    return sortByEffectivePriority(backlog, getProjectType, prioritySettings);
  }, [tasks, getProjectType, prioritySettings]);

  return (
    <PrpContext.Provider value={{
      enterprises, projects, tasks, prioritySettings, loading, setPrioritySettings,
      addEnterprise, updateEnterprise, deleteEnterprise,
      addProject, updateProject, deleteProject,
      addTask, updateTask, deleteTask,
      scheduleTask, completeTask, unscheduleTask,
      getEnterprise, getProject, getProjectType, getProjectsForEnterprise, getTasksForProject,
      getTasksForDate, getBacklogTasks, getSortedBacklogTasks,
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
