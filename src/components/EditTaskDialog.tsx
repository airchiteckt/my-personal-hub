import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Archive, Bell, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onCompleted?: (task: Task) => void;
}

export function EditTaskDialog({ open, onOpenChange, task, onCompleted }: Props) {
  const { updateTask, deleteTask, completeTask, uncompleteTask, unscheduleTask, prioritySettings, getProjectsForEnterprise, getRemindersForTask, enterprises } = usePrp();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState(task.estimatedMinutes);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [impact, setImpact] = useState(task.impact || 2);
  const [effort, setEffort] = useState(task.effort || 2);
  const [enterpriseId, setEnterpriseId] = useState(task.enterpriseId);
  const [projectId, setProjectId] = useState(task.projectId);
  const [scheduledDate, setScheduledDate] = useState(task.scheduledDate || '');
  const [scheduledTime, setScheduledTime] = useState(task.scheduledTime || '');

  const [saved, setSaved] = useState(false);
  const isInitRef = useRef(true);

  const projects = getProjectsForEnterprise(enterpriseId);
  const taskReminders = getRemindersForTask(task.id);

  useEffect(() => {
    isInitRef.current = true;
    setTitle(task.title);
    setDescription(task.description || '');
    setEstimatedMinutes(task.estimatedMinutes);
    setPriority(task.priority);
    setDeadline(task.deadline || '');
    setImpact(task.impact || 2);
    setEffort(task.effort || 2);
    setEnterpriseId(task.enterpriseId);
    setProjectId(task.projectId);
    setScheduledDate(task.scheduledDate || '');
    setScheduledTime(task.scheduledTime || '');
    // Allow init flag to clear after state settles
    setTimeout(() => { isInitRef.current = false; }, 50);
  }, [task]);

  // Auto-select first project when enterprise changes
  useEffect(() => {
    if (projects.length > 0 && !projects.find(p => p.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [enterpriseId, projects]);

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(() => {
    if (!title.trim()) return;
    const newStatus = scheduledDate ? 'scheduled' as const : 'backlog' as const;
    updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      estimatedMinutes,
      priority,
      deadline: deadline || undefined,
      enterpriseId,
      projectId,
      scheduledDate: scheduledDate || undefined,
      scheduledTime: scheduledTime || undefined,
      status: task.status === 'done' ? task.status : newStatus,
      ...(prioritySettings.impactEffortEnabled ? { impact, effort } : {}),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [title, description, estimatedMinutes, priority, deadline, enterpriseId, projectId, scheduledDate, scheduledTime, impact, effort, task.id, task.status, prioritySettings.impactEffortEnabled, updateTask]);

  useEffect(() => {
    if (isInitRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [title, description, estimatedMinutes, priority, deadline, enterpriseId, projectId, scheduledDate, scheduledTime, impact, effort, doSave]);

  const handleDelete = () => {
    deleteTask(task.id);
    onOpenChange(false);
  };

  const handleComplete = () => {
    completeTask(task.id);
    onOpenChange(false);
    onCompleted?.(task);
  };

  const handleUncomplete = () => {
    uncompleteTask(task.id);
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
            <Input value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Note, dettagli, contesto..." rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Impresa</Label>
              <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {enterprises.filter(e => e.status !== 'paused').map(e => (
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data pianificata</Label>
              <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ora pianificata</Label>
              <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} step={1800} />
            </div>
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

          {taskReminders.length > 0 && (
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Promemoria collegati</Label>
              {taskReminders.map(rem => (
                <div key={rem.id} className="text-xs bg-accent/50 rounded-md p-2 flex items-center gap-2">
                  <span>🔔</span>
                  <span className="font-medium">{rem.title}</span>
                  <span className="text-muted-foreground">{rem.reminderDate}{rem.reminderTime ? ` · ${rem.reminderTime}` : ''}</span>
                </div>
              ))}
            </div>
          )}

          {saved && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground animate-in fade-in">
              <Check className="h-3.5 w-3.5 text-green-500" /> Salvato automaticamente
            </div>
          )}

          <div className="flex gap-2">
            {task.status === 'done' ? (
              <Button variant="outline" onClick={handleUncomplete} className="flex-1 gap-1.5">
                ↩️ Riapri
              </Button>
            ) : (
              <Button variant="outline" onClick={handleComplete} className="flex-1 gap-1.5">
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
