import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { SmartBacklog } from '@/components/calendar/SmartBacklog';
import { EditTaskDialog } from '@/components/EditTaskDialog';
import { useState } from 'react';
import type { Task } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { toast } from 'sonner';

export default function Backlog() {
  const navigate = useNavigate();
  const { scheduleTask } = usePrp();
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', `task:${taskId}`);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDrop = (_e: React.DragEvent) => {
    // unschedule via drop on backlog itself — noop here, calendar handles scheduling
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto p-4 gap-3">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/calendar')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold">Backlog</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <SmartBacklog
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onTaskClick={(t) => setEditingTask(t)}
        />
      </div>
      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(o) => !o && setEditingTask(null)}
          task={editingTask}
        />
      )}
    </div>
  );
}
