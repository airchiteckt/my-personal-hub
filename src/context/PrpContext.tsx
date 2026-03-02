import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Enterprise, Project, Task } from '@/types/prp';
import { format } from 'date-fns';

interface PrpContextType {
  enterprises: Enterprise[];
  projects: Project[];
  tasks: Task[];
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
  getProjectsForEnterprise: (enterpriseId: string) => Project[];
  getTasksForProject: (projectId: string) => Task[];
  getTasksForDate: (date: string) => Task[];
  getBacklogTasks: () => Task[];
}

const PrpContext = createContext<PrpContextType | null>(null);

const genId = () => crypto.randomUUID();
const today = format(new Date(), 'yyyy-MM-dd');

const DEMO_ENTERPRISES: Enterprise[] = [
  { id: 'e1', name: 'Ambressa', status: 'active', color: '38 90% 50%', createdAt: new Date().toISOString() },
  { id: 'e2', name: 'Zapper', status: 'development', color: '220 80% 55%', createdAt: new Date().toISOString() },
];

const DEMO_PROJECTS: Project[] = [
  { id: 'p1', enterpriseId: 'e1', name: 'Apertura Locale', type: 'strategic', createdAt: new Date().toISOString() },
  { id: 'p2', enterpriseId: 'e1', name: 'Marketing Lancio', type: 'operational', createdAt: new Date().toISOString() },
  { id: 'p3', enterpriseId: 'e2', name: 'MVP Development', type: 'strategic', createdAt: new Date().toISOString() },
  { id: 'p4', enterpriseId: 'e2', name: 'Amministrazione', type: 'maintenance', createdAt: new Date().toISOString() },
];

const DEMO_TASKS: Task[] = [
  { id: 't1', enterpriseId: 'e1', projectId: 'p1', title: 'Firma contratto affitto', estimatedMinutes: 60, priority: 'high', status: 'backlog', isRecurring: false, createdAt: new Date().toISOString() },
  { id: 't2', enterpriseId: 'e1', projectId: 'p1', title: 'Ordine attrezzature cucina', estimatedMinutes: 120, priority: 'medium', status: 'backlog', isRecurring: false, createdAt: new Date().toISOString() },
  { id: 't3', enterpriseId: 'e1', projectId: 'p2', title: 'Setup social media', estimatedMinutes: 90, priority: 'medium', status: 'scheduled', scheduledDate: today, scheduledTime: '09:00', isRecurring: false, createdAt: new Date().toISOString() },
  { id: 't4', enterpriseId: 'e2', projectId: 'p3', title: 'Design wireframes', estimatedMinutes: 180, priority: 'high', status: 'scheduled', scheduledDate: today, scheduledTime: '11:00', isRecurring: false, createdAt: new Date().toISOString() },
  { id: 't5', enterpriseId: 'e2', projectId: 'p3', title: 'Setup database schema', estimatedMinutes: 120, priority: 'medium', status: 'backlog', isRecurring: false, createdAt: new Date().toISOString() },
  { id: 't6', enterpriseId: 'e2', projectId: 'p4', title: 'Revisione documenti fiscali', estimatedMinutes: 45, priority: 'low', status: 'backlog', isRecurring: false, createdAt: new Date().toISOString() },
];

export function PrpProvider({ children }: { children: ReactNode }) {
  const [enterprises, setEnterprises] = useState<Enterprise[]>(() => {
    const saved = localStorage.getItem('prp-enterprises');
    return saved ? JSON.parse(saved) : DEMO_ENTERPRISES;
  });
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('prp-projects');
    return saved ? JSON.parse(saved) : DEMO_PROJECTS;
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('prp-tasks');
    return saved ? JSON.parse(saved) : DEMO_TASKS;
  });

  useEffect(() => { localStorage.setItem('prp-enterprises', JSON.stringify(enterprises)); }, [enterprises]);
  useEffect(() => { localStorage.setItem('prp-projects', JSON.stringify(projects)); }, [projects]);
  useEffect(() => { localStorage.setItem('prp-tasks', JSON.stringify(tasks)); }, [tasks]);

  const addEnterprise = useCallback((e: Omit<Enterprise, 'id' | 'createdAt'>) => {
    setEnterprises(prev => [...prev, { ...e, id: genId(), createdAt: new Date().toISOString() }]);
  }, []);
  const updateEnterprise = useCallback((id: string, updates: Partial<Enterprise>) => {
    setEnterprises(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);
  const deleteEnterprise = useCallback((id: string) => {
    setEnterprises(prev => prev.filter(e => e.id !== id));
    setProjects(prev => prev.filter(p => p.enterpriseId !== id));
    setTasks(prev => prev.filter(t => t.enterpriseId !== id));
  }, []);
  const addProject = useCallback((p: Omit<Project, 'id' | 'createdAt'>) => {
    setProjects(prev => [...prev, { ...p, id: genId(), createdAt: new Date().toISOString() }]);
  }, []);
  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);
  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.filter(t => t.projectId !== id));
  }, []);
  const addTask = useCallback((t: Omit<Task, 'id' | 'createdAt' | 'status'>) => {
    setTasks(prev => [...prev, { ...t, id: genId(), status: 'backlog', createdAt: new Date().toISOString() }]);
  }, []);
  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);
  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);
  const scheduleTask = useCallback((id: string, date: string, time?: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'scheduled' as const, scheduledDate: date, ...(time !== undefined ? { scheduledTime: time } : {}) } : t));
  }, []);
  const completeTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'done' as const, completedAt: new Date().toISOString() } : t));
  }, []);
  const unscheduleTask = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'backlog' as const, scheduledDate: undefined, scheduledTime: undefined } : t));
  }, []);

  const getEnterprise = useCallback((id: string) => enterprises.find(e => e.id === id), [enterprises]);
  const getProject = useCallback((id: string) => projects.find(p => p.id === id), [projects]);
  const getProjectsForEnterprise = useCallback((eid: string) => projects.filter(p => p.enterpriseId === eid), [projects]);
  const getTasksForProject = useCallback((pid: string) => tasks.filter(t => t.projectId === pid), [tasks]);
  const getTasksForDate = useCallback((date: string) => tasks.filter(t => t.scheduledDate === date && t.status !== 'done'), [tasks]);
  const getBacklogTasks = useCallback(() => tasks.filter(t => t.status === 'backlog'), [tasks]);

  return (
    <PrpContext.Provider value={{
      enterprises, projects, tasks,
      addEnterprise, updateEnterprise, deleteEnterprise,
      addProject, updateProject, deleteProject,
      addTask, updateTask, deleteTask,
      scheduleTask, completeTask, unscheduleTask,
      getEnterprise, getProject, getProjectsForEnterprise, getTasksForProject,
      getTasksForDate, getBacklogTasks,
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
