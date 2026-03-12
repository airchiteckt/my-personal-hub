import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { usePrp } from '@/context/PrpContext';
import { Task } from '@/types/prp';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import {
  Clock, GripVertical, Sparkles, ChevronDown, ChevronRight, Inbox, Building2,
} from 'lucide-react';
import { formatMinutes } from '@/lib/calendar-utils';
import {
  getUrgencyLevel, getUrgencyDot, getDisplayPriority, calculateEffectivePriority,
} from '@/lib/priority-engine';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onTaskClick?: (task: Task) => void;
  onScheduleTask?: (taskId: string, date: string, time?: string) => void;
}

export function TodayBacklog({ open, onOpenChange, onDragStart, onTaskClick, onScheduleTask }: Props) {
  const {
    tasks, enterprises, getEnterprise, getProject, getProjectType,
    getSortedBacklogTasks, prioritySettings, scheduleTask,
  } = usePrp();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const backlogTasks = getSortedBacklogTasks();

  // Top 5 priority
  const top5 = useMemo(() => backlogTasks.slice(0, 5), [backlogTasks]);
  const restTasks = useMemo(() => backlogTasks.slice(5), [backlogTasks]);

  // Group rest by enterprise
  const enterpriseGroups = useMemo(() => {
    const groups = new Map<string, { name: string; color: string; tasks: Task[] }>();
    for (const task of restTasks) {
      const ent = getEnterprise(task.enterpriseId);
      const key = task.enterpriseId;
      if (!groups.has(key)) {
        groups.set(key, {
          name: ent?.name || 'Senza impresa',
          color: ent?.color || '0 0% 50%',
          tasks: [],
        });
      }
      groups.get(key)!.tasks.push(task);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].tasks.length - a[1].tasks.length);
  }, [restTasks, getEnterprise]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleQuickSchedule = (taskId: string) => {
    scheduleTask(taskId, todayStr);
    // Will appear in "Da fare oggi" section without time
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" />
            Backlog
            <Badge variant="secondary" className="text-[10px] font-normal">
              {backlogTasks.length}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            {backlogTasks.length === 0 ? (
              <div className="py-12 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Tutto pianificato! 🎉</p>
              </div>
            ) : (
              <>
                {/* Top 5 suggestions */}
                <div>
                  <div className="flex items-center gap-1.5 px-1 mb-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">
                      Suggerite per te
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      (top {top5.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {top5.map(task => (
                      <BacklogTaskCard
                        key={task.id}
                        task={task}
                        onDragStart={onDragStart}
                        onClick={() => onTaskClick?.(task)}
                        onQuickSchedule={() => handleQuickSchedule(task.id)}
                        highlighted
                      />
                    ))}
                  </div>
                </div>

                {/* Enterprise groups */}
                {enterpriseGroups.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-1 mb-2">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        Per impresa
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({restTasks.length})
                      </span>
                    </div>
                    <div className="space-y-1">
                      {enterpriseGroups.map(([entId, group]) => (
                        <Collapsible
                          key={entId}
                          open={openGroups.has(entId)}
                          onOpenChange={() => toggleGroup(entId)}
                        >
                          <CollapsibleTrigger className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-accent/50 transition-colors">
                            <div
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: `hsl(${group.color})` }}
                            />
                            <span className="text-xs font-medium flex-1 text-left truncate">
                              {group.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                              {group.tasks.length}
                            </Badge>
                            {openGroups.has(entId) ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="space-y-1 pt-1 pl-1">
                              {group.tasks.map(task => (
                                <BacklogTaskCard
                                  key={task.id}
                                  task={task}
                                  onDragStart={onDragStart}
                                  onClick={() => onTaskClick?.(task)}
                                  onQuickSchedule={() => handleQuickSchedule(task.id)}
                                />
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// --- Task card ---
function BacklogTaskCard({
  task,
  onDragStart,
  onClick,
  onQuickSchedule,
  highlighted,
}: {
  task: Task;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onClick: () => void;
  onQuickSchedule: () => void;
  highlighted?: boolean;
}) {
  const { getEnterprise, getProject, getProjectType, prioritySettings } = usePrp();
  const ent = getEnterprise(task.enterpriseId);
  const project = getProject(task.projectId);
  const projectType = getProjectType(task.projectId);
  const urgency = getUrgencyLevel(task.deadline, prioritySettings);
  const urgencyDot = getUrgencyDot(urgency);
  const color = ent?.color || '0 0% 50%';

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      onClick={onClick}
      className={`p-2.5 rounded-xl border bg-card cursor-pointer hover:shadow-sm hover:border-primary/20 transition-all group ${
        highlighted ? 'ring-1 ring-primary/20' : ''
      }`}
      style={{ borderLeft: `3px solid hsl(${color})` }}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-[12px] font-medium leading-snug flex-1 line-clamp-2">
          {urgencyDot && <span>{urgencyDot} </span>}
          {task.title}
        </p>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 ml-5">
        {ent && (
          <span className="text-[10px] font-medium truncate max-w-[80px]" style={{ color: `hsl(${color})` }}>
            {ent.name}
          </span>
        )}
        <span className="text-border">·</span>
        <span className="text-[10px]">
          {projectType === 'strategic' ? '🔵' : projectType === 'operational' ? '🟡' : '⚪'}
        </span>
        {project && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
            {project.name}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 shrink-0">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">
            {formatMinutes(task.estimatedMinutes)}
          </span>
        </span>
      </div>
      {/* Quick schedule button */}
      <div className="mt-1.5 ml-5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-[10px] gap-1"
          onClick={e => { e.stopPropagation(); onQuickSchedule(); }}
        >
          <Sparkles className="h-3 w-3" />
          Pianifica oggi
        </Button>
      </div>
    </div>
  );
}
