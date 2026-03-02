import { useParams, useNavigate } from 'react-router-dom';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, Trash2, Check, Clock } from 'lucide-react';
import { useState } from 'react';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { PROJECT_TYPE_LABELS, TASK_STATUS_LABELS, PRIORITY_LABELS } from '@/types/prp';

const typeStyles: Record<string, string> = {
  strategic: 'bg-strategic-light text-strategic',
  operational: 'bg-operational-light text-operational',
  maintenance: 'bg-maintenance-light text-maintenance',
};

const EnterpriseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getEnterprise, getProjectsForEnterprise, getTasksForProject, deleteEnterprise, completeTask, deleteTask } = usePrp();
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
      <Button variant="ghost" size="sm" onClick={() => navigate('/enterprises')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Indietro
      </Button>

      <div className="flex items-center gap-4 mb-8">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-xl font-bold"
          style={{ backgroundColor: `hsl(${enterprise.color} / 0.12)`, color: `hsl(${enterprise.color})` }}
        >
          {enterprise.name[0]}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{enterprise.name}</h1>
          <p className="text-muted-foreground text-sm">{enterpriseProjects.length} progetti</p>
        </div>
        <Button onClick={() => setShowCreateProject(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Progetto
        </Button>
        <Button variant="outline" size="icon" onClick={() => { deleteEnterprise(id!); navigate('/enterprises'); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {enterpriseProjects.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <p className="text-muted-foreground">Nessun progetto ancora. Creane uno per iniziare!</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {enterpriseProjects.map(project => {
            const projectTasks = getTasksForProject(project.id);
            return (
              <Card key={project.id} className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{project.name}</h3>
                    <Badge className={typeStyles[project.type]}>
                      {PROJECT_TYPE_LABELS[project.type]}
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setCreateTaskForProject(project.id)}>
                    <Plus className="h-3 w-3 mr-1" />
                    Task
                  </Button>
                </div>

                {projectTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nessuna task</p>
                ) : (
                  <div className="space-y-2">
                    {projectTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                      >
                        {task.status !== 'done' ? (
                          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 rounded-full border border-border" onClick={() => completeTask(task.id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                        ) : (
                          <div className="h-7 w-7 shrink-0 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                        <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                          {task.title}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.estimatedMinutes}m
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {PRIORITY_LABELS[task.priority]}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
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
