import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Check, Clock, ChevronDown, Target, Layers, Edit2, PackagePlus, AlertTriangle } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import { PROJECT_TYPE_LABELS, TASK_STATUS_LABELS, ENTERPRISE_TEMPLATES } from '@/types/prp';
import type { Project, Task, ProjectType, EnterpriseTemplateType } from '@/types/prp';
import { formatMinutes } from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot } from '@/lib/priority-engine';
import { toast } from 'sonner';

interface Props {
  enterpriseId: string;
  enterpriseType: EnterpriseTemplateType;
  hasActiveFocus?: boolean;
  onCreateProject: () => void;
  onCreateTask: (projectId: string) => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
}

type FilterType = 'all' | ProjectType;

const typeStyles: Record<string, string> = {
  strategic: 'bg-strategic-light text-strategic',
  operational: 'bg-operational-light text-operational',
  maintenance: 'bg-maintenance-light text-maintenance',
};

export function ProjectsTasksSection({ enterpriseId, enterpriseType, hasActiveFocus, onCreateProject, onCreateTask, onEditProject, onEditTask }: Props) {
  const { getProjectsForEnterprise, getTasksForProject, completeTask, deleteTask, prioritySettings, addProject } = usePrp();
  const [filter, setFilter] = useState<FilterType>('all');

  const allProjects = getProjectsForEnterprise(enterpriseId);
  const template = ENTERPRISE_TEMPLATES[enterpriseType];
  const total = allProjects.length;

  const counts: Record<ProjectType, number> = {
    strategic: allProjects.filter(p => p.type === 'strategic').length,
    operational: allProjects.filter(p => p.type === 'operational').length,
    maintenance: allProjects.filter(p => p.type === 'maintenance').length,
  };

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  // Missing templates
  const existingNames = new Set(allProjects.map(p => p.name.toLowerCase()));
  const missingTemplates = template?.projects.filter(tp => !existingNames.has(tp.name.toLowerCase())) ?? [];

  const handleLoadTemplates = () => {
    let count = 0;
    for (const tp of missingTemplates) {
      addProject({ name: tp.name, type: tp.type, enterpriseId, isStrategicLever: false });
      count++;
    }
    toast.success(`${count} progetti template aggiunti`);
  };

  // Filtered projects
  const filtered = filter === 'all' ? allProjects : allProjects.filter(p => p.type === filter);

  // Smart alerts
  const showStrategicAlert = hasActiveFocus && counts.strategic === 0;

  const filterButtons: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'Tutti', count: total },
    { key: 'strategic', label: '🔵 Strategic', count: counts.strategic },
    { key: 'operational', label: '🟡 Operational', count: counts.operational },
    { key: 'maintenance', label: '⚪ Maintenance', count: counts.maintenance },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" /> Progetti & Task
        </h2>
        <div className="flex items-center gap-2">
          {missingTemplates.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleLoadTemplates}>
              <PackagePlus className="h-3.5 w-3.5 mr-1" /> Template ({missingTemplates.length})
            </Button>
          )}
          <Button size="sm" onClick={onCreateProject}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Progetto
          </Button>
        </div>
      </div>

      {/* Filter tabs with stats */}
      <div className="grid grid-cols-4 gap-1.5">
        {filterButtons.map(fb => {
          const isActive = filter === fb.key;
          const percentage = fb.key === 'all' ? null : pct(fb.count);
          return (
            <button
              key={fb.key}
              onClick={() => setFilter(fb.key)}
              className={`rounded-lg p-2.5 text-center transition-all border ${
                isActive
                  ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20'
                  : 'bg-card border-border hover:bg-muted/60'
              }`}
            >
              <p className={`text-lg font-bold ${isActive ? 'text-primary' : ''}`}>{fb.count}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{fb.label}</p>
              {percentage !== null && (
                <p className={`text-[10px] mt-0.5 font-medium ${
                  fb.key === 'strategic' && fb.count === 0 && hasActiveFocus
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}>
                  {percentage}%
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Smart alert: no strategic projects with active focus */}
      {showStrategicAlert && (
        <Card className="p-3 border-destructive/30 bg-destructive/5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-destructive">Nessun progetto strategico collegato al Focus</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Hai un Focus Period attivo ma nessun progetto Strategic. Crea un progetto strategico e collegalo a un Key Result.
            </p>
          </div>
        </Card>
      )}

      {/* Projects list */}
      {allProjects.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground text-sm mb-3">Nessun progetto. Inizia dai template o creane uno!</p>
          {missingTemplates.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleLoadTemplates}>
              <PackagePlus className="h-3.5 w-3.5 mr-1" /> Carica Template ({template?.label})
            </Button>
          )}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center border-dashed">
          <p className="text-muted-foreground text-sm">Nessun progetto {filter !== 'all' ? PROJECT_TYPE_LABELS[filter] : ''}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onCreateTask={onCreateTask}
              onEditProject={onEditProject}
              onEditTask={onEditTask}
              completeTask={completeTask}
              deleteTask={deleteTask}
              getTasksForProject={getTasksForProject}
              prioritySettings={prioritySettings}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Project Card ---
function ProjectCard({ project, onCreateTask, onEditProject, onEditTask, completeTask, deleteTask, getTasksForProject, prioritySettings }: {
  project: Project;
  onCreateTask: (projectId: string) => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  getTasksForProject: (id: string) => Task[];
  prioritySettings: any;
}) {
  const projectTasks = getTasksForProject(project.id);
  const donePT = projectTasks.filter(t => t.status === 'done').length;
  const pctPT = projectTasks.length > 0 ? Math.round((donePT / projectTasks.length) * 100) : 0;
  const activeTasks = projectTasks.filter(t => t.status !== 'done');
  const completedTasks = projectTasks.filter(t => t.status === 'done');

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate">{project.name}</h3>
          <Badge className={`${typeStyles[project.type]} shrink-0 text-[10px]`}>
            {PROJECT_TYPE_LABELS[project.type]}
          </Badge>
          {project.keyResultId && (
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <Target className="h-2.5 w-2.5" /> KR
            </Badge>
          )}
          {projectTasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground">{pctPT}%</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditProject(project)}>
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCreateTask(project.id)}>
            <Plus className="h-3 w-3 mr-1" /> Task
          </Button>
        </div>
      </div>

      {projectTasks.length > 0 && <Progress value={pctPT} className="h-1 mb-2" />}

      {projectTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">Nessuna task</p>
      ) : (
        <div className="space-y-1">
          {activeTasks.map(task => (
            <TaskRow key={task.id} task={task} onEdit={onEditTask} onComplete={completeTask} onDelete={deleteTask} prioritySettings={prioritySettings} />
          ))}
          {completedTasks.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 pt-1">
                <ChevronDown className="h-3 w-3" />
                {completedTasks.length} completat{completedTasks.length === 1 ? 'a' : 'e'}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {completedTasks.map(task => (
                  <TaskRow key={task.id} task={task} onEdit={onEditTask} onComplete={completeTask} onDelete={deleteTask} prioritySettings={prioritySettings} />
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </Card>
  );
}

// --- Task Row ---
function TaskRow({ task, onEdit, onComplete, onDelete, prioritySettings }: {
  task: Task;
  onEdit: (t: Task) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  prioritySettings: any;
}) {
  return (
    <div
      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 group cursor-pointer hover:bg-muted/80 transition-colors"
      onClick={() => onEdit(task)}
    >
      {task.status !== 'done' ? (
        <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 rounded-full border border-border" onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}>
          <Check className="h-2.5 w-2.5" />
        </Button>
      ) : (
        <div className="h-5 w-5 shrink-0 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      )}
      <span className={`flex-1 text-xs min-w-0 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
        {getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings))}{' '}
        {task.title}
      </span>
      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
        <Clock className="h-2.5 w-2.5" />
        {formatMinutes(task.estimatedMinutes)}
      </span>
      <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
        {TASK_STATUS_LABELS[task.status]}
      </Badge>
      <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>
        <Trash2 className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
