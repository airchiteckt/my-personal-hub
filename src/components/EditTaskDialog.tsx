import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';
import { Archive } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function EditTaskDialog({ open, onOpenChange, task }: Props) {
  const { updateTask, deleteTask, completeTask, unscheduleTask, prioritySettings, getProjectsForEnterprise } = usePrp();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimatedMinutes);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [impact, setImpact] = useState(task.impact || 2);
  const [effort, setEffort] = useState(task.effort || 2);
  const [projectId, setProjectId] = useState(task.projectId);

  const projects = getProjectsForEnterprise(task.enterpriseId);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setEstimatedMinutes(task.estimatedMinutes);
    setPriority(task.priority);
    setDeadline(task.deadline || '');
    setImpact(task.impact || 2);
    setEffort(task.effort || 2);
    setProjectId(task.projectId);
  }, [task]);

  const handleSave = () => {
    if (!title.trim()) return;
    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      estimatedMinutes,
      priority,
      deadline: deadline || undefined,
      projectId,
      ...(prioritySettings.impactEffortEnabled ? { impact, effort } : {}),
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteTask(task.id);
    onOpenChange(false);
  };

  const handleComplete = () => {
    completeTask(task.id);
    onOpenChange(false);
  };

  const handleBacklog = () => {
    unscheduleTask(task.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifica Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Note, dettagli, contesto..." rows={2} className="resize-none" />
          </div>

          {/* Move to different project */}
          <div className="space-y-2">
            <Label>Progetto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Durata (min)</Label>
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

          <div className="space-y-2">
            <Label>Deadline (opzionale)</Label>
            <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>

          {prioritySettings.impactEffortEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Impatto (1-3)</Label>
                <Select value={String(impact)} onValueChange={v => setImpact(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 – Basso</SelectItem>
                    <SelectItem value="2">2 – Medio</SelectItem>
                    <SelectItem value="3">3 – Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sforzo (1-3)</Label>
                <Select value={String(effort)} onValueChange={v => setEffort(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 – Basso</SelectItem>
                    <SelectItem value="2">2 – Medio</SelectItem>
                    <SelectItem value="3">3 – Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!title.trim()}>Salva</Button>
            {task.status !== 'done' && (
              <Button variant="outline" onClick={handleComplete} className="gap-1.5">
                ✅ Completa
              </Button>
            )}
            {task.status === 'scheduled' && (
              <Button variant="outline" onClick={handleBacklog} className="gap-1.5">
                <Archive className="h-3.5 w-3.5" /> Backlog
              </Button>
            )}
          </div>
          <Button variant="destructive" onClick={handleDelete} className="w-full">
            Elimina Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}