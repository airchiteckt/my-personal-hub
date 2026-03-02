import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
}

export function CalendarCreateTaskDialog({ open, onOpenChange, defaultDate, defaultTime, defaultEndTime }: Props) {
  const { enterprises, projects, addTask, scheduleTask } = usePrp();
  const [title, setTitle] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);

  const activeEnterprises = enterprises.filter(e => e.status !== 'paused');
  const availableProjects = projects.filter(p => p.enterpriseId === enterpriseId);

  // Auto-calculate duration from time range on open
  useEffect(() => {
    if (open && defaultTime && defaultEndTime) {
      const [sh, sm] = defaultTime.split(':').map(Number);
      const [eh, em] = defaultEndTime.split(':').map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins <= 0) mins += 24 * 60; // handle overnight
      if (mins > 0) setEstimatedMinutes(mins);
    } else if (open && !defaultTime) {
      setEstimatedMinutes(30);
    }
  }, [open, defaultTime, defaultEndTime]);

  // Auto-select first enterprise/project
  useEffect(() => {
    if (open && !enterpriseId && activeEnterprises.length > 0) {
      setEnterpriseId(activeEnterprises[0].id);
    }
  }, [open, activeEnterprises]);

  useEffect(() => {
    if (enterpriseId && availableProjects.length > 0 && !availableProjects.find(p => p.id === projectId)) {
      setProjectId(availableProjects[0].id);
    }
  }, [enterpriseId, availableProjects]);

  const handleSubmit = () => {
    if (!title.trim() || !enterpriseId || !projectId) return;
    addTask({
      title: title.trim(),
      estimatedMinutes,
      priority,
      enterpriseId,
      projectId,
      isRecurring: false,
    });

    // Schedule the task after creation - we need to get the task ID
    // Since addTask doesn't return the ID, we schedule via the context after a tick
    // Better approach: use scheduleTask after finding the newly created task
    setTimeout(() => {
      // The task was just added, find it by title match (last added)
      const allTasks = document.querySelectorAll('[data-task-id]');
      // Actually, let's just rely on the addTask + immediate schedule pattern
    }, 0);

    setTitle('');
    setEstimatedMinutes(30);
    setPriority('medium');
    onOpenChange(false);
  };

  // Modified: addTask and schedule in one go
  const handleCreateAndSchedule = () => {
    if (!title.trim() || !enterpriseId || !projectId) return;

    addTask({
      title: title.trim(),
      estimatedMinutes,
      priority,
      enterpriseId,
      projectId,
      isRecurring: false,
      scheduledDate: defaultDate,
      scheduledTime: defaultTime,
    });

    setTitle('');
    setEstimatedMinutes(30);
    setPriority('medium');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova Task</DialogTitle>
          {defaultDate && defaultTime && (
            <p className="text-xs text-muted-foreground">
              {defaultDate} · {defaultTime}{defaultEndTime ? ` – ${defaultEndTime}` : ''}
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Descrivi la task"
              onKeyDown={e => e.key === 'Enter' && handleCreateAndSchedule()}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Impresa</Label>
              <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {activeEnterprises.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${e.color})` }} />
                        {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progetto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {availableProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Durata (minuti)</Label>
              <Input type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(Number(e.target.value))} min={5} step={5} />
            </div>
            <div className="space-y-2">
              <Label>Priorità</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 Alta</SelectItem>
                  <SelectItem value="medium">🟡 Media</SelectItem>
                  <SelectItem value="low">⚪ Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCreateAndSchedule} className="w-full" disabled={!title.trim() || !enterpriseId || !projectId}>
            Crea e Pianifica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
