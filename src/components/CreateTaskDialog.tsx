import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';
import { useAiInline } from '@/hooks/use-ai-inline';
import { Sparkles, Loader2, Zap, Plus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  projectId: string;
}

interface EffortEstimate {
  estimated_minutes: number;
  priority: TaskPriority;
  impact: number;
  effort: number;
  reason: string;
}

interface TaskSuggestion {
  title: string;
  priority: TaskPriority;
  estimated_minutes: number;
  impact: number;
  effort: number;
  reason: string;
}

export function CreateTaskDialog({ open, onOpenChange, enterpriseId, projectId }: Props) {
  const { addTask, prioritySettings, getEnterprise, getProject, getTasksForProject } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [deadline, setDeadline] = useState('');
  const [impact, setImpact] = useState(2);
  const [effort, setEffort] = useState(2);
  const [aiApplied, setAiApplied] = useState(false);

  const enterprise = getEnterprise(enterpriseId);
  const project = getProject(projectId);
  const existingTasks = getTasksForProject(projectId);

  // Effort estimation AI
  const { data: effortData, loading: effortLoading, debouncedFetch: fetchEffort, clear: clearEffort } = useAiInline<EffortEstimate>({
    type: 'effort_inline',
    debounceMs: 1000,
  });

  // Task suggestions from KR
  const { data: suggestData, loading: suggestLoading, fetch: fetchSuggestions, clear: clearSuggestions } = useAiInline<{ tasks: TaskSuggestion[] }>({
    type: 'okr_task_suggest',
  });

  // Trigger effort estimation when title changes
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
    } else {
      clearEffort();
    }
  }, [title]);

  // Auto-apply AI suggestion
  useEffect(() => {
    if (effortData && !aiApplied) {
      setEstimatedMinutes(effortData.estimated_minutes);
      setPriority(effortData.priority);
      if (prioritySettings.impactEffortEnabled) {
        setImpact(effortData.impact);
        setEffort(effortData.effort);
      }
      setAiApplied(true);
    }
  }, [effortData, aiApplied, prioritySettings.impactEffortEnabled]);

  const handleSuggestTasks = () => {
    if (!enterprise || !project) return;
    fetchSuggestions(
      {
        enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory, phase: enterprise.phase, timeHorizon: enterprise.timeHorizon },
        project: { name: project.name, type: project.type },
        existingTasks: existingTasks.map(t => ({ title: t.title, status: t.status })),
      },
      `Suggerisci task OKR-aligned per il progetto "${project.name}" dell'impresa "${enterprise.name}".`
    );
  };

  const applyTaskSuggestion = (task: TaskSuggestion) => {
    setTitle(task.title);
    setEstimatedMinutes(task.estimated_minutes);
    setPriority(task.priority);
    setImpact(task.impact);
    setEffort(task.effort);
    setAiApplied(true);
    clearSuggestions();
  };

  const handleSubmit = () => {
    if (!title.trim() || !projectId) return;
    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      estimatedMinutes,
      priority,
      enterpriseId,
      projectId,
      isRecurring: false,
      ...(deadline ? { deadline } : {}),
      ...(prioritySettings.impactEffortEnabled ? { impact, effort } : {}),
    });
    setTitle('');
    setDescription('');
    setEstimatedMinutes(30);
    setDeadline('');
    setImpact(2);
    setEffort(2);
    setAiApplied(false);
    clearEffort();
    clearSuggestions();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuova Task
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              <Sparkles className="h-3 w-3" /> AI Assist
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* AI Task Suggestions Button */}
          {!suggestData && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs border-dashed"
              onClick={handleSuggestTasks}
              disabled={suggestLoading}
            >
              {suggestLoading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generazione suggerimenti...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Suggerisci task da OKR</>
              )}
            </Button>
          )}

          {/* Task Suggestions from KR */}
          {suggestData?.tasks && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Task suggerite dai KR
                </p>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={clearSuggestions}>
                  Chiudi
                </Button>
              </div>
              {suggestData.tasks.map((task, i) => (
                <button
                  key={i}
                  onClick={() => applyTaskSuggestion(task)}
                  className="w-full text-left p-2 rounded-md hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-sm font-medium truncate">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-5">
                    <span className="text-[10px] text-muted-foreground">{task.estimated_minutes}min</span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <span className="text-[10px] text-muted-foreground">{task.priority}</span>
                    <span className="text-[10px] text-muted-foreground">•</span>
                    <span className="text-[10px] text-muted-foreground italic">{task.reason}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Descrivi la task" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Note, dettagli, contesto..." rows={2} className="resize-none" />
          </div>

          {/* AI Effort Estimation Inline */}
          {(effortLoading || (effortData && !aiApplied)) && (
            <div className="rounded-lg border border-accent/50 bg-accent/30 p-2.5 animate-in fade-in duration-300">
              {effortLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Stima AI in corso...
                </div>
              ) : effortData && (
                <div className="flex items-center gap-2 text-xs">
                  <Zap className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-muted-foreground italic">{effortData.reason}</span>
                </div>
              )}
            </div>
          )}

          {/* Applied indicator */}
          {aiApplied && effortData && (
            <div className="flex items-center gap-1.5 text-[11px] text-green-600 dark:text-green-400">
              <Sparkles className="h-3 w-3" />
              AI: {effortData.estimated_minutes}min, {effortData.priority} priority, impatto {effortData.impact}/sforzo {effortData.effort}
            </div>
          )}

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

          <Button onClick={handleSubmit} className="w-full">Crea Task</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
