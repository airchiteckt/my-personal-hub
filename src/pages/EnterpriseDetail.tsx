import { useParams, useNavigate } from 'react-router-dom';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Trash2, Check, Clock, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { PROJECT_TYPE_LABELS, TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/types/prp';
import { formatMinutes } from '@/lib/calendar-utils';
import { getDisplayPriority, getPriorityEmoji, getUrgencyLevel, getUrgencyDot } from '@/lib/priority-engine';

const typeStyles: Record<string, string> = {
  strategic: 'bg-strategic-light text-strategic',
  operational: 'bg-operational-light text-operational',
  maintenance: 'bg-maintenance-light text-maintenance',
};

const EnterpriseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEnterprise, getProjectsForEnterprise, getTasksForProject, deleteEnterprise, completeTask, deleteTask, getProjectType, prioritySettings } = usePrp();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createTaskForProject, setCreateTaskForProject] = useState<string | null>(null);

  const enterprise = getEnterprise(id!);
  if (!enterprise) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Impresa non trovata</p>
        <Button variant="ghost" onClick={() => navigate('/enterprises')} className="mt-4">
          Torna alle imprese
        </Button>
      </div>
    );
  }

  const enterpriseProjects = getProjectsForEnterprise(id!);

  return (
    <div className="max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/enterprises')} className="mb-3 md:mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Indietro
      </Button>

      {/* Header */}
      <div className="flex items-start gap-3 md:gap-4 mb-6 md:mb-8">
        <div
          className="h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center text-lg md:text-xl font-bold shrink-0"
          style={{ backgroundColor: `hsl(${enterprise.color} / 0.12)`, color: `hsl(${enterprise.color})` }}
        >
          {enterprise.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-3xl font-bold truncate">{enterprise.name}</h1>
          <p className="text-muted-foreground text-xs md:text-sm">{enterpriseProjects.length} progetti</p>
        </div>
        <div className="flex gap-1.5 md:gap-2 shrink-0">
          <Button size="sm" onClick={() => setShowCreateProject(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            <span className="hidden md:inline">Progetto</span>
            <span className="md:hidden">+</span>
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9" onClick={() => { deleteEnterprise(id!); navigate('/enterprises'); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {enterpriseProjects.length === 0 ? (
        <Card className="p-8 md:p-12 text-center border-dashed">
          <p className="text-muted-foreground">Nessun progetto. Creane uno per iniziare!</p>
        </Card>
      ) : (
        <div className="space-y-4 md:space-y-6">
          {enterpriseProjects.map(project => {
            const projectTasks = getTasksForProject(project.id);
            return (
              <Card key={project.id} className="p-4 md:p-5">
                <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <h3 className="font-semibold text-base md:text-lg truncate">{project.name}</h3>
                    <Badge className={`${typeStyles[project.type]} shrink-0 text-[10px] md:text-xs`}>
                      {PROJECT_TYPE_LABELS[project.type]}
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 h-7 md:h-8 text-xs" onClick={() => setCreateTaskForProject(project.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Task
                  </Button>
                </div>

                {projectTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nessuna task</p>
                ) : (
                  <div className="space-y-1.5 md:space-y-2">
                    {projectTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg bg-muted/50"
                      >
                        {task.status !== 'done' ? (
                          <Button size="icon" variant="ghost" className="h-6 w-6 md:h-7 md:w-7 shrink-0 rounded-full border border-border" onClick={() => completeTask(task.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        ) : (
                          <div className="h-6 w-6 md:h-7 md:w-7 shrink-0 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <span className={`flex-1 text-xs md:text-sm min-w-0 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                          {getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings))}{' '}
                          {task.title}
                        </span>
                        <span className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-0.5 shrink-0">
                          <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                          {formatMinutes(task.estimatedMinutes)}
                        </span>
                        <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
                          {getPriorityEmoji(getDisplayPriority(task, getProjectType(task.projectId), prioritySettings))}{' '}
                          {PRIORITY_LABELS[getDisplayPriority(task, getProjectType(task.projectId), prioritySettings)]}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-6 w-6 md:h-7 md:w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <CreateProjectDialog open={showCreateProject} onOpenChange={setShowCreateProject} enterpriseId={id!} />
      <CreateTaskDialog
        open={!!createTaskForProject}
        onOpenChange={(open) => !open && setCreateTaskForProject(null)}
        enterpriseId={id!}
        projectId={createTaskForProject || ''}
      />
    </div>
  );
};

export default EnterpriseDetail;
