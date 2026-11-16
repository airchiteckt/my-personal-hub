import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Target, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BacklogTree } from '@/components/calendar/BacklogTree';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { RadarEmbedded } from '@/components/AiAssistant';
import type { Task } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';

/** Pagina dedicata di un progetto: backlog del progetto + Radar con conversazione dedicata per costruire il piano. */
export default function ProjectPlan() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { tasks, projects, enterprises, keyResults, objectives, focusPeriods } = usePrp();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const live = editingTask ? tasks.find(t => t.id === editingTask.id) ?? editingTask : null;
  const project = projects.find(p => p.id === projectId);
  if (!project) return <div className="p-6 text-sm text-muted-foreground">Progetto non trovato.</div>;
  const ent = enterprises.find(e => e.id === project.enterpriseId);
  const kr = keyResults.find(k => k.id === project.keyResultId);
  const obj = kr ? objectives.find(o => o.id === kr.objectiveId) : undefined;
  const focus = obj ? focusPeriods.find(f => f.id === obj.focusPeriodId) : undefined;
  const open = tasks.filter(t => t.projectId === project.id && t.status !== 'done');
  const done = tasks.filter(t => t.projectId === project.id && t.status === 'done').length;

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', `task:${taskId}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] w-full max-w-7xl mx-auto p-4 gap-3">
      <div className="flex items-start gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/planner')} aria-label="Torna al Piano"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            {ent && <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${ent.color})` }} />}{ent?.name}
          </p>
          <h1 className="text-lg font-bold leading-tight truncate">{project.name}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
            {focus && <span className="flex items-center gap-1"><Target className="h-3 w-3" />{focus.name}</span>}
            {obj && <span>{obj.title}</span>}
            {kr && <span className="flex items-center gap-1"><Flag className="h-3 w-3" />{kr.title}</span>}
            <span>{open.length} aperte · {done} completate</span>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-3">
        <div className="min-h-0 overflow-y-auto">
          <BacklogTree variant="page" projectId={project.id} date={new Date()} onOpenTask={setEditingTask} onDragStart={handleDragStart} />
        </div>
        <div className="min-h-[420px] lg:min-h-0">
          <RadarEmbedded scope={{ type: 'project', id: project.id, label: project.name }} />
        </div>
      </div>
      {live && <EditTaskDialog open onOpenChange={o => !o && setEditingTask(null)} task={live} />}
    </div>
  );
}
