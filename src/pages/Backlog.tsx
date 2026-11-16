import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BacklogTree } from '@/components/calendar/BacklogTree';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { CalendarCreateTaskDialog } from '@/components/calendar/CalendarCreateTaskDialog';
import type { Task } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';

/** Pagina Backlog: qui si organizzano le attività (aggiunta rapida, priorità, spostamento tra progetti, messa in piano). */
export default function Backlog() {
  const navigate = useNavigate();
  const { tasks } = usePrp();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const live = editingTask ? tasks.find(t => t.id === editingTask.id) ?? editingTask : null;

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', `task:${taskId}`);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/calendar')} aria-label="Torna al calendario">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">Piano</h1>
          <p className="text-xs text-muted-foreground">Organizza le attività per progetto; apri un progetto con la freccia per pianificarlo insieme a Radar. Tocca P1/P2/P3 per cambiare priorità, trascina un'attività su un altro progetto per spostarla, usa il calendario accanto a ogni attività per metterla in piano.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5 mr-1" />Task</Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pb-24">
        <BacklogTree variant="page" date={new Date()} onOpenTask={setEditingTask} onDragStart={handleDragStart} />
      </div>
      {live && <EditTaskDialog open onOpenChange={o => !o && setEditingTask(null)} task={live} />}
      <CalendarCreateTaskDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
