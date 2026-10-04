import { EffortPicker, EFFORT_SIZES, snapEffort } from '@/components/EffortPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TaskDocumentEditor } from '@/components/TaskDocumentEditor';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Task, TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { priorityLimitWarning } from '@/lib/priority-limits';
import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, ChevronDown, Inbox, Pencil, Trash2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TaskAttachments } from '@/components/TaskAttachments';
import { useTaskTimer } from '@/hooks/use-task-timer';
import { Play, Pause } from 'lucide-react';

function OptionalSection({ label, hasValue, children }: { label: string; hasValue: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-1">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
          {label}
          {!open && hasValue && <span className="ml-auto text-xs text-primary">•</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-1 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  onCompleted?: (task: Task) => void;
}

export function EditTaskDialog({ open, onOpenChange, task, onCompleted }: Props) {
  const { tasks, updateTask, deleteTask, completeTask, uncompleteTask, unscheduleTask, prioritySettings, getProjectsForEnterprise, getRemindersForTask, enterprises, getTimeEntriesForTask } = usePrp();
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
  const [editing, setEditing] = useState(false);

  const projects = getProjectsForEnterprise(enterpriseId);
  const taskReminders = getRemindersForTask(task.id);

  useEffect(() => {
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
  }, [task]);

  // Auto-select first project when enterprise changes
  useEffect(() => {
    if (projects.length > 0 && !projects.find(p => p.id === projectId)) {
      setProjectId(projects[0].id);
    }
  }, [enterpriseId, projects]);

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
      scheduledTime: scheduledTime || (null as unknown as string),
      status: task.status === 'done' ? task.status : newStatus,
      ...(prioritySettings.impactEffortEnabled ? { impact, effort } : {}),
    });
  }, [title, description, estimatedMinutes, priority, deadline, enterpriseId, projectId, scheduledDate, scheduledTime, impact, effort, task.id, task.status, prioritySettings.impactEffortEnabled, updateTask]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      doSave();
    }
    onOpenChange(isOpen);
  };

  const handleDelete = () => {
    if (!window.confirm('Eliminare definitivamente questa task? L\'azione non si può annullare.')) return;
    deleteTask(task.id);
    onOpenChange(false);
  };

  const handleComplete = () => {
    doSave();
    completeTask(task.id);
    onOpenChange(false);
    onCompleted?.(task);
  };

  const handleUncomplete = () => {
    uncompleteTask(task.id);
    onOpenChange(false);
  };

  const handleBacklog = () => {
    if (!window.confirm('Rimandare questa task al Serbatoio? Verrà tolta dal giorno pianificato.')) return;
    doSave();
    unscheduleTask(task.id);
    onOpenChange(false);
  };

  const isDone = task.status === 'done';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={isDone ? handleUncomplete : handleComplete}
              aria-label={isDone ? 'Riapri task' : 'Segna come completata'}
              title={isDone ? 'Riapri task' : 'Segna come completata'}
              className={`group flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isDone ? 'border-success bg-success text-success-foreground' : 'border-muted-foreground/50 hover:border-success hover:bg-success/10'}`}
            >
              <Check className={`h-3.5 w-3.5 transition-opacity ${isDone ? 'opacity-100' : 'text-success opacity-0 group-hover:opacity-100'}`} strokeWidth={3} />
            </button>
            {isDone ? 'Task completata' : 'Modifica Task'}
          </DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 pt-2">
          <TaskDocumentEditor title={title} onTitleChange={setTitle} notes={description} onNotesChange={setDescription} />

          {!editing ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-accent/30 px-2.5 py-2">
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${priority === 'high' ? 'bg-destructive/15 text-destructive' : priority === 'medium' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {priority === 'high' ? 'P1' : priority === 'medium' ? 'P2' : 'P3'}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                {EFFORT_SIZES.find(s => s.minutes === snapEffort(estimatedMinutes))?.label}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${enterprises.find(e => e.id === enterpriseId)?.color})` }} />
                {enterprises.find(e => e.id === enterpriseId)?.name}
                {projects.find(p => p.id === projectId) && ` · ${projects.find(p => p.id === projectId)?.name}`}
              </span>
              {scheduledDate && (
                <span className="text-[11px] text-muted-foreground">
                  📅 {new Date(scheduledDate + 'T00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}{scheduledTime ? ` · ${scheduledTime.slice(0, 5)}` : ''}
                </span>
              )}
              {deadline && (
                <span className="text-[11px] text-muted-foreground">
                  ⏳ {new Date(deadline).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                </span>
              )}
              <button type="button" onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10">
                <Pencil className="h-3 w-3" /> Modifica
              </button>
            </div>
          ) : (
            <div className="space-y-4 rounded-md border p-3">
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

              <div className="space-y-2">
                <Label>Priorità</Label>
                <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🔴 P1 · Urgente</SelectItem>
                    <SelectItem value="medium">🟠 P2 · Importante</SelectItem>
                    <SelectItem value="low">⚪ P3 · Normale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Impegno</Label>
                <EffortPicker value={estimatedMinutes} onChange={setEstimatedMinutes} />
              </div>

              {priorityLimitWarning(tasks, scheduledDate, priority, task.id) && (
                <p className="text-[11px] text-destructive">{priorityLimitWarning(tasks, scheduledDate, priority, task.id)}</p>
              )}

              <OptionalSection label="Deadline" hasValue={!!deadline}>
                <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </OptionalSection>

              <OptionalSection label="Pianificazione" hasValue={!!scheduledDate || !!scheduledTime}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ora</Label>
                    <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} step={1800} />
                  </div>
                </div>
              </OptionalSection>

              <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => { doSave(); setEditing(false); }}>
                Fatto
              </Button>
            </div>
          )}


          <TaskAttachments taskId={task.id} />

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

          {(() => {
            const entries = getTimeEntriesForTask(task.id)
              .slice()
              .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
            if (entries.length === 0) return null;
            const now = Date.now();
            const minutesOf = (te: typeof entries[0]) =>
              te.endedAt
                ? (te.durationMinutes || 0)
                : Math.max(1, Math.round((now - new Date(te.startedAt).getTime()) / 60000));
            const totalMinutes = entries.reduce((sum, te) => sum + minutesOf(te), 0);
            const fmtDur = (mins: number) => {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
            };
            const fmtDay = (iso: string) =>
              new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
            const fmtTime = (iso: string) =>
              `${String(new Date(iso).getHours()).padStart(2, '0')}:${String(new Date(iso).getMinutes()).padStart(2, '0')}`;
            return (
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5">
                  ⏱ Tempo lavorato
                  <span className="ml-auto text-xs font-semibold text-primary">Totale: {fmtDur(totalMinutes)}</span>
                </Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {entries.map(te => (
                    <div key={te.id} className="text-xs bg-accent/50 rounded-md p-2 flex items-center gap-2">
                      <span className="font-medium capitalize">{fmtDay(te.startedAt)}</span>
                      <span className="text-muted-foreground">
                        {fmtTime(te.startedAt)} → {te.endedAt ? fmtTime(te.endedAt) : 'in corso'}
                      </span>
                      <span className="ml-auto font-medium">{fmtDur(minutesOf(te))}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="flex items-center justify-between border-t pt-3">
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Elimina task" title="Elimina task" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
            {task.status === 'scheduled' && (
              <Button variant="outline" size="sm" onClick={handleBacklog} className="gap-1.5">
                <Inbox className="h-3.5 w-3.5" /> Rimanda al Serbatoio
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
