import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';
import { useAiInline } from '@/hooks/use-ai-inline';
import { OkrValidationFeedback } from '@/components/OkrValidationFeedback';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
}

interface EffortEstimate {
  estimated_minutes: number;
  priority: TaskPriority;
  impact: number;
  effort: number;
  reason: string;
}

export function CalendarCreateTaskDialog({ open, onOpenChange, defaultDate, defaultTime, defaultEndTime }: Props) {
  const { enterprises, projects, addTask, prioritySettings, getEnterprise, getProject, getTasksForProject } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [schedDate, setSchedDate] = useState(defaultDate || '');
  const [schedTime, setSchedTime] = useState(defaultTime || '');
  const [aiApplied, setAiApplied] = useState(false);

  const activeEnterprises = enterprises.filter(e => e.status !== 'paused');
  const availableProjects = projects.filter(p => p.enterpriseId === enterpriseId);

  const enterprise = getEnterprise(enterpriseId);
  const project = getProject(projectId);
  const existingTasks = projectId ? getTasksForProject(projectId) : [];

  // Effort estimation AI
  const { data: effortData, loading: effortLoading, debouncedFetch: fetchEffort, clear: clearEffort } = useAiInline<EffortEstimate>({
    type: 'effort_inline',
    debounceMs: 1000,
  });

  // Task quality validation AI
  const { data: taskValidation, loading: taskValidating, debouncedFetch: fetchTaskValidation, clear: clearTaskValidation } = useAiInline<any>({
    type: 'validate_task',
    debounceMs: 1200,
  });

  // Trigger AI when title changes
  useEffect(() => {
    if (title.trim().length >= 5 && enterprise && project) {
      setAiApplied(false);
      fetchEffort(
        {
          enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory, phase: enterprise.phase },
          project: { name: project.name, type: project.type },
          existingTasks: existingTasks.filter(t => t.status !== 'done').map(t => t.title).slice(0, 10),
        },
        `Stima effort per la task: "${title.trim()}"`
      );
      fetchTaskValidation(
        {
          enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory },
          project: { name: project.name, type: project.type },
        },
        `Valida questa task del progetto "${project.name}": "${title.trim()}"`
      );
    } else {
      clearEffort();
      clearTaskValidation();
    }
  }, [title, enterpriseId, projectId]);

  // Auto-apply AI effort suggestion
  useEffect(() => {
    if (effortData && !aiApplied) {
      setEstimatedMinutes(effortData.estimated_minutes);
      setPriority(effortData.priority);
      setAiApplied(true);
    }
  }, [effortData, aiApplied]);

  // Sync defaults when dialog opens
  useEffect(() => {
    if (open) {
      setSchedDate(defaultDate || new Date().toISOString().split('T')[0]);
      setSchedTime(defaultTime || '09:00');
      if (defaultTime && defaultEndTime) {
        const [sh, sm] = defaultTime.split(':').map(Number);
        const [eh, em] = defaultEndTime.split(':').map(Number);
        let mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins <= 0) mins += 24 * 60;
        if (mins > 0) setEstimatedMinutes(mins);
      } else {
        setEstimatedMinutes(30);
      }
      setAiApplied(false);
      clearEffort();
      clearTaskValidation();
    }
  }, [open, defaultDate, defaultTime, defaultEndTime]);

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

  const handleCreateAndSchedule = () => {
    if (!title.trim() || !enterpriseId || !projectId) return;

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      estimatedMinutes,
      priority,
      enterpriseId,
      projectId,
      isRecurring: false,
      scheduledDate: schedDate || undefined,
      scheduledTime: schedTime || undefined,
    });

    setTitle('');
    setDescription('');
    setEstimatedMinutes(30);
    setPriority('medium');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Nuova Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 overflow-y-auto flex-1 min-h-0 pr-1">
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

          {/* AI Validation Feedback */}
          <OkrValidationFeedback
            data={taskValidation}
            loading={taskValidating}
            type="task"
            onApplySuggestion={(improved) => setTitle(improved)}
          />

          {/* AI Effort Estimate */}
          {effortLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Stima AI in corso...
            </div>
          )}
          {effortData && !effortLoading && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              AI: {effortData.estimated_minutes}min, {effortData.priority} priority, impatto {effortData.impact}/sforzo {effortData.effort}
            </div>
          )}

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Note, dettagli, contesto..." rows={2} className="resize-none" />
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
              <Label>Data</Label>
              <Input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ora inizio</Label>
              <Input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
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
        </div>

        <div className="pt-3 border-t border-border shrink-0">
          <Button onClick={handleCreateAndSchedule} className="w-full" disabled={!title.trim() || !enterpriseId || !projectId}>
            Crea e Pianifica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
