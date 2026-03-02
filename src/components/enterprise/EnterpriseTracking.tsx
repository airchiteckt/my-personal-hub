import { usePrp, ActivityLog, TimeEntry } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow, parseISO, differenceInDays, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Activity, Clock, AlertTriangle, Timer, TrendingDown } from 'lucide-react';
import type { Task, KeyResult, FocusPeriod } from '@/types/prp';

interface Props {
  enterpriseId: string;
}

const ACTION_ICONS: Record<string, string> = {
  created: '➕',
  updated: '✏️',
  deleted: '🗑️',
  completed: '✅',
  scheduled: '📅',
  unscheduled: '↩️',
  archived: '📦',
};

const ENTITY_LABELS: Record<string, string> = {
  enterprises: 'Impresa',
  projects: 'Progetto',
  tasks: 'Task',
  focus_periods: 'Focus Period',
  objectives: 'Objective',
  key_results: 'Key Result',
  appointments: 'Appuntamento',
  time_entry: 'Sessione',
};

const ACTION_LABELS: Record<string, string> = {
  created: 'Creato',
  updated: 'Modificato',
  deleted: 'Eliminato',
  completed: 'Completato',
  scheduled: 'Pianificato',
  unscheduled: 'Rimosso dal piano',
  archived: 'Archiviato',
};

export function EnterpriseTracking({ enterpriseId }: Props) {
  const {
    getActivityLogsForEnterprise,
    getTimeEntriesForEnterprise,
    getTasksForEnterprise,
    getFocusPeriodsForEnterprise,
    getObjectivesForFocus,
    getKeyResultsForObjective,
  } = usePrp();

  const logs = getActivityLogsForEnterprise(enterpriseId);
  const timeEntries = getTimeEntriesForEnterprise(enterpriseId);
  const tasks = getTasksForEnterprise(enterpriseId);
  const focusPeriods = getFocusPeriodsForEnterprise(enterpriseId);

  // --- Delay Tracker ---
  const now = new Date();

  const overdueTasks = tasks.filter(t => {
    if (t.status === 'done' || !t.deadline) return false;
    return parseISO(t.deadline) < now;
  });

  const overdueKRs: (KeyResult & { objectiveTitle: string })[] = [];
  focusPeriods.filter(fp => fp.status === 'active').forEach(fp => {
    getObjectivesForFocus(fp.id).forEach(obj => {
      getKeyResultsForObjective(obj.id).forEach(kr => {
        if (kr.status !== 'completed' && kr.deadline && parseISO(kr.deadline) < now) {
          overdueKRs.push({ ...kr, objectiveTitle: obj.title });
        }
      });
    });
  });

  const expiredFocus = focusPeriods.filter(fp =>
    fp.status === 'active' && parseISO(fp.endDate) < now
  );

  const totalDelays = overdueTasks.length + overdueKRs.length + expiredFocus.length;

  // --- Time totals ---
  const totalMinutes = timeEntries.reduce((sum, te) => sum + (te.durationMinutes || 0), 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  return (
    <Tabs defaultValue="activity" className="space-y-3">
      <TabsList className="w-full grid grid-cols-3 h-8">
        <TabsTrigger value="activity" className="text-xs gap-1">
          <Activity className="h-3 w-3" /> Log
        </TabsTrigger>
        <TabsTrigger value="delays" className="text-xs gap-1">
          <AlertTriangle className="h-3 w-3" /> Ritardi
          {totalDelays > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1 ml-0.5">{totalDelays}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="time" className="text-xs gap-1">
          <Timer className="h-3 w-3" /> Tempo
        </TabsTrigger>
      </TabsList>

      {/* Activity Log */}
      <TabsContent value="activity">
        {logs.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <Activity className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nessuna attività registrata</p>
            <p className="text-xs text-muted-foreground mt-1">Le azioni verranno tracciate automaticamente</p>
          </Card>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-1">
              {logs.slice(0, 100).map(log => (
                <div key={log.id} className="flex items-start gap-2.5 py-2 px-2 rounded-md hover:bg-muted/50 transition-colors">
                  <span className="text-sm mt-0.5">{ACTION_ICONS[log.action] || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="text-muted-foreground">{ACTION_LABELS[log.action] || log.action}</span>
                      {' '}
                      <span className="font-medium">{log.entityName || '—'}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {ENTITY_LABELS[log.entityType] || log.entityType}
                      {' · '}
                      {formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true, locale: it })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </TabsContent>

      {/* Delay Tracker */}
      <TabsContent value="delays">
        {totalDelays === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <span className="text-2xl">🎯</span>
            <p className="text-sm text-muted-foreground mt-2">Nessun ritardo!</p>
            <p className="text-xs text-muted-foreground">Tutto è in linea con le scadenze</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Task Scadute ({overdueTasks.length})
                </h4>
                {overdueTasks.map(task => {
                  const daysLate = differenceInDays(now, parseISO(task.deadline!));
                  return (
                    <Card key={task.id} className="p-3 border-destructive/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{task.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Scadenza: {format(parseISO(task.deadline!), 'd MMM yyyy', { locale: it })}
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                          {daysLate}g
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Overdue KRs */}
            {overdueKRs.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3" /> Key Results Scaduti ({overdueKRs.length})
                </h4>
                {overdueKRs.map(kr => {
                  const daysLate = differenceInDays(now, parseISO(kr.deadline!));
                  const progress = kr.metricType === 'boolean'
                    ? (kr.currentValue >= 1 ? 100 : 0)
                    : Math.round((kr.currentValue / kr.targetValue) * 100);
                  return (
                    <Card key={kr.id} className="p-3 border-destructive/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{kr.title}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {kr.objectiveTitle} · {progress}% completato
                          </p>
                        </div>
                        <Badge variant="destructive" className="text-[10px] shrink-0">
                          {daysLate}g
                        </Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Expired Focus */}
            {expiredFocus.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  ⏰ Focus Period Scaduti ({expiredFocus.length})
                </h4>
                {expiredFocus.map(fp => {
                  const daysLate = differenceInDays(now, parseISO(fp.endDate));
                  return (
                    <Card key={fp.id} className="p-3 border-destructive/30">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{fp.name}</p>
                        <Badge variant="destructive" className="text-[10px]">{daysLate}g oltre</Badge>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </TabsContent>

      {/* Time Tracking */}
      <TabsContent value="time">
        <div className="space-y-3">
          <Card className="p-4 text-center">
            <Timer className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalHours}h</p>
            <p className="text-xs text-muted-foreground">Tempo totale registrato</p>
          </Card>

          {timeEntries.length === 0 ? (
            <Card className="p-6 text-center border-dashed">
              <p className="text-sm text-muted-foreground">Nessuna sessione di lavoro registrata</p>
              <p className="text-xs text-muted-foreground mt-1">Usa il timer sui task per tracciare il tempo</p>
            </Card>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-1">
                {timeEntries.map(te => (
                  <div key={te.id} className="flex items-center gap-2.5 py-2 px-2 rounded-md hover:bg-muted/50">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{te.description || 'Sessione di lavoro'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(te.startedAt), 'd MMM HH:mm', { locale: it })}
                        {te.durationMinutes && ` · ${te.durationMinutes} min`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}