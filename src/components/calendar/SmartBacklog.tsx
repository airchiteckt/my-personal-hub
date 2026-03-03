import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { usePrp } from '@/context/PrpContext';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/prp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Clock, GripVertical, Zap, Target, Pin, Sparkles, AlertTriangle, Bot, Loader2 } from 'lucide-react';
import { formatMinutes, slotToTime, timeToSlot } from '@/lib/calendar-utils';
import { getUrgencyLevel, getUrgencyDot, getDisplayPriority, getPriorityEmoji, calculateEffectivePriority } from '@/lib/priority-engine';
import {
  computeFreeTime, getTaskFitStatus, getFitEmoji, getFitLabel,
  categorizeBacklog, findSlotsForTasks,
} from '@/lib/scheduling-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDrop: (e: React.DragEvent) => void;
  onTaskClick?: (task: Task) => void;
}

export function SmartBacklog({ onDragStart, onDrop, onTaskClick }: Props) {
  const { session } = useAuth();
  const {
    tasks, enterprises, projects, getEnterprise, getProject, getProjectType,
    getSortedBacklogTasks, prioritySettings, scheduleTask,
  } = usePrp();
  const [autoOrder, setAutoOrder] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = useMemo(
    () => tasks.filter(t => t.scheduledDate === todayStr && t.status !== 'done'),
    [tasks, todayStr]
  );

  const backlogTasks = getSortedBacklogTasks();

  // Free time analysis
  const { freeMinutes, maxConsecutiveFreeMinutes } = useMemo(
    () => computeFreeTime(todayTasks),
    [todayTasks]
  );

  // Categorize into sections
  const sections = useMemo(
    () => categorizeBacklog(backlogTasks, getProjectType, prioritySettings),
    [backlogTasks, getProjectType, prioritySettings]
  );

  // Schedule Top 3 preview
  const top3 = useMemo(() => backlogTasks.slice(0, 3), [backlogTasks]);
  const top3Slots = useMemo(
    () => findSlotsForTasks(top3, todayTasks),
    [top3, todayTasks]
  );

  const handleScheduleTop3 = () => {
    for (const task of top3) {
      const slot = top3Slots.get(task.id);
      if (slot !== undefined) {
        scheduleTask(task.id, todayStr, slotToTime(slot));
      }
    }
    setShowPreview(false);
  };

  // High impact suggestion count
  const highImpactCount = sections.planToday.length + sections.highStrategic.length;
  const suggestedCount = Math.min(highImpactCount, Math.floor(freeMinutes / 60));

  const fetchAiInsight = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const context = {
        freeMinutes,
        todayDate: todayStr,
        enterprises: enterprises.map(e => ({ name: e.name, status: e.status })),
        projects: projects.map(p => ({ name: p.name, type: p.type })),
        backlogTasks: backlogTasks.slice(0, 10).map(t => ({
          title: t.title, priority: t.priority, estimatedMinutes: t.estimatedMinutes,
          deadline: t.deadline, scheduledDate: t.scheduledDate,
        })),
        scheduledToday: todayTasks.map(t => ({
          title: t.title, scheduledTime: t.scheduledTime, estimatedMinutes: t.estimatedMinutes,
        })),
      };

      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          type: 'reminder',
          messages: [{ role: 'user', content: 'Analizza il mio backlog e la giornata di oggi. Dammi un feedback operativo breve: cosa dovrei prioritizzare, rischi di scadenza, e un consiglio pratico. Max 3-4 frasi.' }],
          context,
        }),
      });

      if (!resp.ok) throw new Error('Errore AI');
      if (!resp.body) throw new Error('No stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let result = '';

      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) { result += c; setAiInsight(result); }
          } catch { textBuffer = line + '\n' + textBuffer; break; }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || 'Errore AI');
    }
    setAiLoading(false);
  };

  return (
    <div
      className="w-72 shrink-0 border rounded-xl bg-card flex flex-col overflow-hidden"
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="p-3 border-b shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            Backlog
            <span className="ml-1.5 text-muted-foreground font-normal">({backlogTasks.length})</span>
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Auto</span>
            <Switch
              checked={autoOrder}
              onCheckedChange={setAutoOrder}
              className="scale-75"
            />
          </div>
        </div>

        {/* Scheduling Assist */}
        {freeMinutes > 0 && backlogTasks.length > 0 && (
          <div className="rounded-lg bg-accent/50 p-2.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Hai {formatMinutes(freeMinutes)} libere oggi</span>
            </div>
            {suggestedCount > 0 && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Suggerimento: pianifica {suggestedCount} task ad alto impatto
              </p>
            )}
          </div>
        )}

        {freeMinutes === 0 && backlogTasks.length > 0 && (
          <div className="rounded-lg bg-destructive/10 p-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Giornata piena</span>
            </div>
          </div>
        )}

        {/* AI Insight */}
        {backlogTasks.length > 0 && (
          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-[11px] gap-1.5"
              onClick={fetchAiInsight}
              disabled={aiLoading}
            >
              {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
              {aiLoading ? 'Analisi...' : 'Feedback AI'}
            </Button>
            {aiInsight && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-2.5">
                <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-wrap">{aiInsight}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {backlogTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Tutto pianificato! 🎉</p>
        ) : (
          <>
            {/* Section: Da Pianificare Oggi */}
            {sections.planToday.length > 0 && (
              <BacklogSection
                icon={<Zap className="h-3 w-3" />}
                label="Da Pianificare Oggi"
                tasks={sections.planToday}
                onDragStart={onDragStart}
                onTaskClick={onTaskClick}
                freeMinutes={freeMinutes}
                maxConsecutive={maxConsecutiveFreeMinutes}
                accentClass="text-destructive"
              />
            )}

            {/* Section: Alta Priorità Strategica */}
            {sections.highStrategic.length > 0 && (
              <BacklogSection
                icon={<Target className="h-3 w-3" />}
                label="Alta Priorità Strategica"
                tasks={sections.highStrategic}
                onDragStart={onDragStart}
                onTaskClick={onTaskClick}
                freeMinutes={freeMinutes}
                maxConsecutive={maxConsecutiveFreeMinutes}
                accentClass="text-primary"
              />
            )}

            {/* Section: Resto */}
            {sections.rest.length > 0 && (
              <BacklogSection
                icon={<Pin className="h-3 w-3" />}
                label="Resto del Backlog"
                tasks={sections.rest}
                onDragStart={onDragStart}
                onTaskClick={onTaskClick}
                freeMinutes={freeMinutes}
                maxConsecutive={maxConsecutiveFreeMinutes}
                accentClass="text-muted-foreground"
              />
            )}
          </>
        )}
      </div>

      {/* Schedule Top 3 */}
      {backlogTasks.length >= 1 && (
        <div className="p-2 border-t shrink-0 space-y-2">
          {showPreview ? (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Preview Top {Math.min(3, top3.length)}
              </p>
              {top3.map(task => {
                const slot = top3Slots.get(task.id);
                return (
                  <div key={task.id} className="flex items-center gap-1.5 text-[11px] rounded-md bg-muted/50 px-2 py-1.5">
                    <span className="font-medium truncate flex-1">{task.title}</span>
                    {slot !== undefined ? (
                      <span className="text-primary font-mono shrink-0">{slotToTime(slot)}</span>
                    ) : (
                      <span className="text-destructive shrink-0">❌</span>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-1.5">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleScheduleTop3}>
                  Conferma
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowPreview(false)}>
                  Annulla
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs"
              onClick={() => setShowPreview(true)}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Schedule Top {Math.min(3, backlogTasks.length)}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- BacklogSection sub-component ---

interface BacklogSectionProps {
  icon: React.ReactNode;
  label: string;
  tasks: Task[];
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onTaskClick?: (task: Task) => void;
  freeMinutes: number;
  maxConsecutive: number;
  accentClass: string;
}

function BacklogSection({ icon, label, tasks, onDragStart, onTaskClick, freeMinutes, maxConsecutive, accentClass }: BacklogSectionProps) {
  const { getEnterprise, getProjectType, prioritySettings } = usePrp();

  return (
    <div className="mb-2">
      <div className={`flex items-center gap-1.5 px-1 py-1 text-[10px] font-semibold uppercase tracking-wider ${accentClass}`}>
        {icon}
        <span>{label}</span>
        <span className="text-muted-foreground font-normal">({tasks.length})</span>
      </div>
      <div className="space-y-1">
        {tasks.map(task => {
          const ent = getEnterprise(task.enterpriseId);
          const projectType = getProjectType(task.projectId);
          const displayPriority = getDisplayPriority(task, projectType, prioritySettings);
          const urgency = getUrgencyLevel(task.deadline, prioritySettings);
          const fit = getTaskFitStatus(task.estimatedMinutes, freeMinutes, maxConsecutive);
          const urgencyDot = getUrgencyDot(urgency);
          const impact = task.impact ?? 2;

          return (
            <div
              key={task.id}
              draggable
              onDragStart={e => onDragStart(e, task.id)}
              onClick={() => onTaskClick?.(task)}
              className="p-2.5 rounded-xl border bg-card cursor-pointer hover:shadow-sm hover:border-primary/20 transition-all group"
              style={{ borderLeft: `3px solid hsl(${ent?.color || '0 0% 50%'})` }}
            >
              {/* Title + duration */}
              <div className="flex items-start gap-1.5">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <p className="text-[12px] font-medium leading-snug flex-1 line-clamp-2">
                  {task.title}
                </p>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-1.5 mt-2 ml-5">
                {/* Enterprise name */}
                {ent && (
                  <span
                    className="text-[10px] font-medium truncate max-w-[80px]"
                    style={{ color: `hsl(${ent.color})` }}
                  >
                    {ent.name}
                  </span>
                )}

                <span className="text-border">·</span>

                {/* Project type badge */}
                <span className="text-[10px]">
                  {projectType === 'strategic' ? '🔵' : projectType === 'operational' ? '🟡' : '⚪'}
                </span>

                {/* Urgency dot */}
                {urgencyDot && <span className="text-[10px]">{urgencyDot}</span>}

                {/* Impact dots */}
                <span className="flex items-center gap-[2px]">
                  {[1, 2, 3].map(i => (
                    <span
                      key={i}
                      className={`inline-block h-[5px] w-[5px] rounded-full ${i <= impact ? 'bg-primary' : 'bg-border'}`}
                    />
                  ))}
                </span>

                {/* Spacer + Duration + Fit */}
                <span className="ml-auto flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {formatMinutes(task.estimatedMinutes)}
                  </span>
                  <span className="text-[11px]">{getFitEmoji(fit)}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
