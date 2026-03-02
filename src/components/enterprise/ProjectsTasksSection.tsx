import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Check, Clock, ChevronDown, Target, Layers, Edit2, PackagePlus } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import { PROJECT_TYPE_LABELS, TASK_STATUS_LABELS, ENTERPRISE_TEMPLATES } from '@/types/prp';
import type { Project, Task, ProjectType, EnterpriseTemplateType } from '@/types/prp';
import { formatMinutes } from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot } from '@/lib/priority-engine';
import { toast } from 'sonner';

interface Props {
  enterpriseId: string;
  enterpriseType: EnterpriseTemplateType;
  onCreateProject: () => void;
  onCreateTask: (projectId: string) => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
}

const typeConfig: Record<ProjectType, { icon: string; colorClass: string; borderClass: string; bgClass: string }> = {
  strategic: { icon: '🔵', colorClass: 'text-strategic', borderClass: 'border-strategic/30', bgClass: 'bg-strategic/5' },
  operational: { icon: '🟡', colorClass: 'text-operational', borderClass: 'border-operational/30', bgClass: 'bg-operational/5' },
  maintenance: { icon: '⚪', colorClass: 'text-maintenance', borderClass: 'border-maintenance/30', bgClass: 'bg-maintenance/5' },
};

const typeStyles: Record<string, string> = {
  strategic: 'bg-strategic-light text-strategic',
  operational: 'bg-operational-light text-operational',
  maintenance: 'bg-maintenance-light text-maintenance',
};

export function ProjectsTasksSection({ enterpriseId, enterpriseType, onCreateProject, onCreateTask, onEditProject, onEditTask }: Props) {
  const { getProjectsForEnterprise, getTasksForProject, completeTask, deleteTask, deleteProject, prioritySettings, addProject } = usePrp();

  const allProjects = getProjectsForEnterprise(enterpriseId);
  const template = ENTERPRISE_TEMPLATES[enterpriseType];

  // Group by type
  const strategicProjects = allProjects.filter(p => p.type === 'strategic');
  const operationalProjects = allProjects.filter(p => p.type === 'operational');
  const maintenanceProjects = allProjects.filter(p => p.type === 'maintenance');

  // Find missing template projects
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

  const categories: { type: ProjectType; label: string; projects: Project[]; emptyText: string }[] = [
    { type: 'strategic', label: '🔵 Progetti Strategici', projects: strategicProjects, emptyText: 'Nessun progetto strategico. Collegali ai Key Results del Focus attivo.' },
    { type: 'operational', label: '🟡 Progetti Operativi', projects: operationalProjects, emptyText: 'Nessun progetto operativo. Usa i template per iniziare.' },
    { type: 'maintenance', label: '⚪ Manutenzione', projects: maintenanceProjects, emptyText: 'Nessun progetto di manutenzione.' },
  ];

  return (
    <div className="space-y-6">
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

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-2">
        {categories.map(cat => {
          const cfg = typeConfig[cat.type];
          return (
            <Card key={cat.type} className={`p-3 text-center ${cfg.borderClass} border`}>
              <p className="text-xl font-bold">{cat.projects.length}</p>
              <p className="text-[10px] text-muted-foreground">{PROJECT_TYPE_LABELS[cat.type]}</p>
            </Card>
          );
        })}
      </div>

      {allProjects.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <p className="text-muted-foreground text-sm mb-3">Nessun progetto. Inizia dai template o creane uno!</p>
          {missingTemplates.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleLoadTemplates}>
              <PackagePlus className="h-3.5 w-3.5 mr-1" /> Carica Template ({template?.label})
            </Button>
          )}
        </Card>
      ) : (
        categories.map(cat => (
          <CategorySection
            key={cat.type}
            {...cat}
            onCreateTask={onCreateTask}
            onEditProject={onEditProject}
            onEditTask={onEditTask}
            completeTask={completeTask}
            deleteTask={deleteTask}
            deleteProject={deleteProject}
            getTasksForProject={getTasksForProject}
            prioritySettings={prioritySettings}
          />
        ))
      )}
    </div>
  );
}

// --- Category Section ---
interface CategorySectionProps {
  type: ProjectType;
  label: string;
  projects: Project[];
  emptyText: string;
  onCreateTask: (projectId: string) => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  deleteProject: (id: string) => void;
  getTasksForProject: (id: string) => Task[];
  prioritySettings: any;
}

function CategorySection({ type, label, projects, emptyText, onCreateTask, onEditProject, onEditTask, completeTask, deleteTask, deleteProject, getTasksForProject, prioritySettings }: CategorySectionProps) {
  const cfg = typeConfig[type];

  return (
    <Collapsible defaultOpen={projects.length > 0}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left group">
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
        <span className="font-semibold text-sm">{label}</span>
        <Badge variant="outline" className="text-[10px] ml-auto">{projects.length}</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {projects.length === 0 ? (
          <Card className={`p-4 text-center border-dashed ${cfg.bgClass}`}>
            <p className="text-xs text-muted-foreground">{emptyText}</p>
          </Card>
        ) : (
          projects.map(project => (
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
          ))
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

// --- Project Card ---
interface ProjectCardProps {
  project: Project;
  onCreateTask: (projectId: string) => void;
  onEditProject: (project: Project) => void;
  onEditTask: (task: Task) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  getTasksForProject: (id: string) => Task[];
  prioritySettings: any;
}

function ProjectCard({ project, onCreateTask, onEditProject, onEditTask, completeTask, deleteTask, getTasksForProject, prioritySettings }: ProjectCardProps) {
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
          {/* Active tasks first */}
          {activeTasks.map(task => (
            <TaskRow key={task.id} task={task} onEdit={onEditTask} onComplete={completeTask} onDelete={deleteTask} prioritySettings={prioritySettings} />
          ))}
          {/* Completed tasks collapsed */}
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
