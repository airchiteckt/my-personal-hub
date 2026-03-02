import { useParams, useNavigate } from 'react-router-dom';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, ArrowLeft, Trash2, Check, Clock, ChevronDown, Target, TrendingUp, Layers, BarChart3, Calendar, Edit2 } from 'lucide-react';
import { useState } from 'react';
import { EditEnterpriseDialog } from '@/components/EditEnterpriseDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { PROJECT_TYPE_LABELS, TASK_STATUS_LABELS, PRIORITY_LABELS, FOCUS_STATUS_LABELS, KR_STATUS_LABELS, METRIC_TYPE_LABELS } from '@/types/prp';
import type { FocusPeriod, Objective, KeyResult } from '@/types/prp';
import { formatMinutes } from '@/lib/calendar-utils';
import { getDisplayPriority, getPriorityEmoji, getUrgencyLevel, getUrgencyDot } from '@/lib/priority-engine';
import { CreateFocusPeriodDialog } from '@/components/enterprise/CreateFocusPeriodDialog';
import { CreateObjectiveDialog } from '@/components/enterprise/CreateObjectiveDialog';
import { CreateKeyResultDialog } from '@/components/enterprise/CreateKeyResultDialog';
import { format as fnsFormat, differenceInDays, parseISO } from 'date-fns';
import { OkrWizard } from '@/components/enterprise/OkrWizard';
import { it } from 'date-fns/locale';

const typeStyles: Record<string, string> = {
  strategic: 'bg-strategic-light text-strategic',
  operational: 'bg-operational-light text-operational',
  maintenance: 'bg-maintenance-light text-maintenance',
};

const EnterpriseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    getEnterprise, getProjectsForEnterprise, getTasksForProject, deleteEnterprise,
    completeTask, deleteTask, getProjectType, prioritySettings,
    getFocusPeriodsForEnterprise, getObjectivesForFocus, getKeyResultsForObjective,
    getProjectsForKeyResult, getTasksForEnterprise,
    deleteFocusPeriod, deleteObjective, deleteKeyResult, updateKeyResult,
  } = usePrp();
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createTaskForProject, setCreateTaskForProject] = useState<string | null>(null);
  const [showCreateFocus, setShowCreateFocus] = useState(false);
  const [createObjForFocus, setCreateObjForFocus] = useState<string | null>(null);
  const [createKRForObjective, setCreateKRForObjective] = useState<string | null>(null);
  const [showEditEnterprise, setShowEditEnterprise] = useState(false);

  const enterprise = getEnterprise(id!);
  if (!enterprise) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Impresa non trovata</p>
        <Button variant="ghost" onClick={() => navigate('/enterprises')} className="mt-4">
          Torna alle imprese
        </Button>
      </div>
    );
  }

  const enterpriseProjects = getProjectsForEnterprise(id!);
  const enterpriseTasks = getTasksForEnterprise(id!);
  const focusPeriods = getFocusPeriodsForEnterprise(id!);
  const activeFocus = focusPeriods.find(f => f.status === 'active');

  // Compute overview stats
  const totalTasks = enterpriseTasks.length;
  const doneTasks = enterpriseTasks.filter(t => t.status === 'done').length;
  const scheduledTasks = enterpriseTasks.filter(t => t.status === 'scheduled').length;
  const backlogTasks = enterpriseTasks.filter(t => t.status === 'backlog').length;
  const taskCompletionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  // KR progress for active focus
  const getObjectiveProgress = (objectiveId: string) => {
    const krs = getKeyResultsForObjective(objectiveId);
    if (krs.length === 0) return 0;
    const total = krs.reduce((sum, kr) => {
      if (kr.metricType === 'boolean') return sum + (kr.currentValue >= 1 ? 100 : 0);
      return sum + Math.min(100, (kr.currentValue / kr.targetValue) * 100);
    }, 0);
    return Math.round(total / krs.length);
  };

  return (
    <div className="max-w-4xl mx-auto pb-8">
      {/* Back + Header */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/enterprises')} className="mb-3 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" />
        Indietro
      </Button>

      <div className="flex items-start gap-3 md:gap-4 mb-6">
        <div
          className="h-10 w-10 md:h-12 md:w-12 rounded-xl flex items-center justify-center text-lg md:text-xl font-bold shrink-0"
          style={{ backgroundColor: `hsl(${enterprise.color} / 0.12)`, color: `hsl(${enterprise.color})` }}
        >
          {enterprise.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-3xl font-bold truncate">{enterprise.name}</h1>
          <p className="text-muted-foreground text-xs md:text-sm">
            {enterpriseProjects.length} progetti · {totalTasks} task
          </p>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9 shrink-0" onClick={() => setShowEditEnterprise(true)}>
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 md:h-9 md:w-9 shrink-0" onClick={() => { deleteEnterprise(id!); navigate('/enterprises'); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* OKR Wizard AI - always visible */}
      <div className="mb-4">
        <OkrWizard enterprise={enterprise} activeFocusId={activeFocus?.id} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full grid grid-cols-4 h-9">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="focus" className="text-xs">Focus</TabsTrigger>
          <TabsTrigger value="strategy" className="text-xs">Strategy</TabsTrigger>
          <TabsTrigger value="execution" className="text-xs">Execution</TabsTrigger>
        </TabsList>

        {/* ===== OVERVIEW ===== */}
        <TabsContent value="overview" className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3 md:p-4 text-center">
              <p className="text-2xl font-bold">{taskCompletionPct}%</p>
              <p className="text-xs text-muted-foreground">Completamento</p>
            </Card>
            <Card className="p-3 md:p-4 text-center">
              <p className="text-2xl font-bold">{backlogTasks}</p>
              <p className="text-xs text-muted-foreground">Backlog</p>
            </Card>
            <Card className="p-3 md:p-4 text-center">
              <p className="text-2xl font-bold">{scheduledTasks}</p>
              <p className="text-xs text-muted-foreground">Pianificate</p>
            </Card>
            <Card className="p-3 md:p-4 text-center">
              <p className="text-2xl font-bold">{doneTasks}</p>
              <p className="text-xs text-muted-foreground">Completate</p>
            </Card>
          </div>

          {/* Active Focus summary */}
          {activeFocus ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Focus Attivo: {activeFocus.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {fnsFormat(parseISO(activeFocus.startDate), 'd MMM', { locale: it })} – {fnsFormat(parseISO(activeFocus.endDate), 'd MMM yyyy', { locale: it })}
                {' · '}
                {differenceInDays(parseISO(activeFocus.endDate), new Date())} giorni rimanenti
              </p>
              {getObjectivesForFocus(activeFocus.id).map(obj => {
                const progress = getObjectiveProgress(obj.id);
                return (
                  <div key={obj.id} className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{obj.title}</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                );
              })}
              {getObjectivesForFocus(activeFocus.id).length === 0 && (
                <p className="text-xs text-muted-foreground">Nessun objective definito</p>
              )}
            </Card>
          ) : (
            <Card className="p-4 border-dashed text-center">
              <p className="text-sm text-muted-foreground mb-2">Nessun Focus Period attivo</p>
              <Button size="sm" variant="outline" onClick={() => setShowCreateFocus(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Crea Focus Period
              </Button>
            </Card>
          )}

          {/* KR critici */}
          {(() => {
            const allKRs = focusPeriods.flatMap(fp =>
              getObjectivesForFocus(fp.id).flatMap(o => getKeyResultsForObjective(o.id))
            );
            const atRisk = allKRs.filter(kr => kr.status === 'at_risk' || (kr.deadline && differenceInDays(parseISO(kr.deadline), new Date()) < 7 && kr.status !== 'completed'));
            if (atRisk.length === 0) return null;
            return (
              <Card className="p-4 border-destructive/30">
                <h3 className="font-semibold text-sm text-destructive mb-2">⚠️ KR Critici</h3>
                {atRisk.map(kr => (
                  <div key={kr.id} className="flex justify-between text-xs py-1">
                    <span>{kr.title}</span>
                    <span className="text-muted-foreground">
                      {kr.currentValue}/{kr.targetValue} {kr.metricType === 'percentage' ? '%' : ''}
                    </span>
                  </div>
                ))}
              </Card>
            );
          })()}

        </TabsContent>

        {/* ===== FOCUS PERIOD ===== */}
        <TabsContent value="focus" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" /> Focus Period
            </h2>
            <Button size="sm" onClick={() => setShowCreateFocus(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Nuovo
            </Button>
          </div>

          {focusPeriods.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground text-sm">Nessun Focus Period. Definisci il tuo primo ciclo!</p>
            </Card>
          ) : (
            <>
              {/* Active Focus */}
              {(() => {
                const active = focusPeriods.filter(fp => fp.status === 'active');
                if (active.length === 0) return (
                  <Card className="p-4 border-dashed text-center">
                    <p className="text-sm text-muted-foreground">Nessun Focus Period attivo</p>
                  </Card>
                );
                return active.map(fp => {
                  const objs = getObjectivesForFocus(fp.id);
                  const totalProgress = objs.length > 0
                    ? Math.round(objs.reduce((s, o) => s + getObjectiveProgress(o.id), 0) / objs.length)
                    : 0;
                  return (
                    <Card key={fp.id} className="p-4 ring-2 ring-primary/30 bg-primary/[0.02]">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <h3 className="font-semibold">{fp.name}</h3>
                          <Badge variant="default" className="text-[10px]">Attivo</Badge>
                        </div>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFocusPeriod(fp.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {fnsFormat(parseISO(fp.startDate), 'd MMM yyyy', { locale: it })} – {fnsFormat(parseISO(fp.endDate), 'd MMM yyyy', { locale: it })}
                      </p>
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Progresso temporale</span>
                          <span>{differenceInDays(parseISO(fp.endDate), new Date())} giorni rimanenti</span>
                        </div>
                        <Progress value={Math.max(0, Math.min(100, Math.round(
                          (differenceInDays(new Date(), parseISO(fp.startDate)) / differenceInDays(parseISO(fp.endDate), parseISO(fp.startDate))) * 100
                        )))} className="h-1.5" />
                      </div>
                      {objs.length > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>{objs.length} Objective</span>
                            <span>OKR {totalProgress}%</span>
                          </div>
                          <Progress value={totalProgress} className="h-1.5" />
                        </div>
                      )}
                    </Card>
                  );
                });
              })()}

              {/* Future Focus */}
              {(() => {
                const future = focusPeriods.filter(fp => fp.status === 'future').sort((a, b) => a.startDate.localeCompare(b.startDate));
                if (future.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Pianificati ({future.length})
                    </h3>
                    {future.map(fp => {
                      const objs = getObjectivesForFocus(fp.id);
                      return (
                        <Card key={fp.id} className="p-3 border-dashed bg-muted/30">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full bg-blue-400" />
                              <h4 className="font-medium text-sm">{fp.name}</h4>
                              <Badge variant="outline" className="text-[10px]">🔵 Futuro</Badge>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFocusPeriod(fp.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 ml-4">
                            {fnsFormat(parseISO(fp.startDate), 'd MMM yyyy', { locale: it })} – {fnsFormat(parseISO(fp.endDate), 'd MMM yyyy', { locale: it })}
                            {objs.length > 0 && ` · ${objs.length} Objective`}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Archived Focus */}
              {(() => {
                const archived = focusPeriods.filter(fp => fp.status === 'archived');
                if (archived.length === 0) return null;
                return (
                  <Collapsible>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown className="h-3 w-3" />
                      Archiviati ({archived.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {archived.map(fp => (
                        <Card key={fp.id} className="p-3 opacity-60">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-sm">{fp.name}</h4>
                              <Badge variant="outline" className="text-[10px]">📦 Archiviato</Badge>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFocusPeriod(fp.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {fnsFormat(parseISO(fp.startDate), 'd MMM yyyy', { locale: it })} – {fnsFormat(parseISO(fp.endDate), 'd MMM yyyy', { locale: it })}
                          </p>
                        </Card>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })()}
            </>
          )}
        </TabsContent>

        {/* ===== STRATEGY (Objectives + KRs) ===== */}
        <TabsContent value="strategy" className="space-y-4">
          {!activeFocus ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground text-sm">Crea prima un Focus Period attivo per definire la strategia.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowCreateFocus(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Crea Focus Period
              </Button>
            </Card>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" /> Objectives – {activeFocus.name}
                </h2>
                <Button size="sm" onClick={() => setCreateObjForFocus(activeFocus.id)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Objective
                </Button>
              </div>

              {getObjectivesForFocus(activeFocus.id).length === 0 ? (
                <Card className="p-6 text-center border-dashed">
                  <p className="text-muted-foreground text-sm">Nessun Objective. Definisci 1-3 obiettivi qualitativi!</p>
                </Card>
              ) : (
                getObjectivesForFocus(activeFocus.id).map(obj => {
                  const progress = getObjectiveProgress(obj.id);
                  const krs = getKeyResultsForObjective(obj.id);
                  return (
                    <Collapsible key={obj.id} defaultOpen>
                      <Card className="p-4">
                        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm truncate">{obj.title}</h3>
                              <Badge variant={obj.status === 'completed' ? 'default' : 'outline'} className="text-[10px]">
                                {obj.status === 'completed' ? '✅ Completato' : `${progress}%`}
                              </Badge>
                            </div>
                            {obj.description && <p className="text-xs text-muted-foreground mt-0.5">{obj.description}</p>}
                            <Progress value={progress} className="h-1.5 mt-2" />
                          </div>
                          <ChevronDown className="h-4 w-4 ml-2 shrink-0 text-muted-foreground transition-transform duration-200" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-2">
                          {/* Key Results */}
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <BarChart3 className="h-3 w-3" /> Key Results
                            </p>
                            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setCreateKRForObjective(obj.id)}>
                              <Plus className="h-3 w-3 mr-0.5" /> KR
                            </Button>
                          </div>
                          {krs.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-1">Nessun Key Result definito</p>
                          ) : (
                            krs.map(kr => {
                              const krPct = kr.metricType === 'boolean'
                                ? (kr.currentValue >= 1 ? 100 : 0)
                                : Math.min(100, Math.round((kr.currentValue / kr.targetValue) * 100));
                              return (
                                <div key={kr.id} className="p-2.5 rounded-lg bg-muted/50">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium truncate flex-1">{kr.title}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <Badge variant="outline" className="text-[10px]">{KR_STATUS_LABELS[kr.status]}</Badge>
                                      <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => deleteKeyResult(kr.id)}>
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Progress value={krPct} className="h-1.5 flex-1" />
                                    <span className="text-[10px] text-muted-foreground w-16 text-right">
                                      {kr.metricType === 'boolean' ? (kr.currentValue >= 1 ? '✅' : '⬜') :
                                        kr.metricType === 'percentage' ? `${kr.currentValue}%` :
                                        `${kr.currentValue}/${kr.targetValue}`}
                                    </span>
                                  </div>
                                  {kr.deadline && (
                                    <p className="text-[10px] text-muted-foreground mt-1">
                                      Scadenza: {fnsFormat(parseISO(kr.deadline), 'd MMM yyyy', { locale: it })}
                                    </p>
                                  )}
                                  {/* Quick value update */}
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <input
                                      type="number"
                                      className="w-16 h-6 text-xs rounded border border-input bg-background px-1.5"
                                      defaultValue={kr.currentValue}
                                      onBlur={(e) => {
                                        const val = Number(e.target.value);
                                        if (!isNaN(val) && val !== kr.currentValue) {
                                          const newStatus = kr.metricType === 'boolean'
                                            ? (val >= 1 ? 'completed' : 'active')
                                            : (val >= kr.targetValue ? 'completed' : kr.status);
                                          updateKeyResult(kr.id, { currentValue: val, status: newStatus as any });
                                        }
                                      }}
                                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                    />
                                    <span className="text-[10px] text-muted-foreground">
                                      {kr.metricType === 'percentage' ? '%' : kr.metricType === 'boolean' ? '(0/1)' : `/ ${kr.targetValue}`}
                                    </span>
                                  </div>
                                  {/* Linked projects */}
                                  {(() => {
                                    const linked = getProjectsForKeyResult(kr.id);
                                    if (linked.length === 0) return null;
                                    return (
                                      <div className="mt-1.5">
                                        <p className="text-[10px] text-muted-foreground mb-0.5">Progetti collegati:</p>
                                        {linked.map(p => (
                                          <Badge key={p.id} variant="outline" className="text-[10px] mr-1">{p.name}</Badge>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })
                          )}

                          <div className="flex justify-end pt-1">
                            <Button size="sm" variant="ghost" className="h-6 text-xs text-destructive" onClick={() => deleteObjective(obj.id)}>
                              <Trash2 className="h-3 w-3 mr-1" /> Elimina Objective
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </>
          )}
        </TabsContent>

        {/* ===== EXECUTION (Projects + Tasks) ===== */}
        <TabsContent value="execution" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Layers className="h-5 w-5" /> Progetti & Task
            </h2>
            <Button size="sm" onClick={() => setShowCreateProject(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Progetto
            </Button>
          </div>

          {enterpriseProjects.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-muted-foreground text-sm">Nessun progetto. Creane uno per iniziare!</p>
            </Card>
          ) : (
            enterpriseProjects.map(project => {
              const projectTasks = getTasksForProject(project.id);
              const donePT = projectTasks.filter(t => t.status === 'done').length;
              const pctPT = projectTasks.length > 0 ? Math.round((donePT / projectTasks.length) * 100) : 0;
              return (
                <Card key={project.id} className="p-4">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                      <Badge className={`${typeStyles[project.type]} shrink-0 text-[10px]`}>
                        {PROJECT_TYPE_LABELS[project.type]}
                      </Badge>
                      {pctPT > 0 && (
                        <span className="text-[10px] text-muted-foreground">{pctPT}%</span>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs" onClick={() => setCreateTaskForProject(project.id)}>
                      <Plus className="h-3 w-3 mr-1" /> Task
                    </Button>
                  </div>
                  {projectTasks.length > 0 && <Progress value={pctPT} className="h-1 mb-2" />}

                  {projectTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">Nessuna task</p>
                  ) : (
                    <div className="space-y-1">
                      {projectTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                        >
                          {task.status !== 'done' ? (
                            <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 rounded-full border border-border" onClick={() => completeTask(task.id)}>
                              <Check className="h-2.5 w-2.5" />
                            </Button>
                          ) : (
                            <div className="h-5 w-5 shrink-0 rounded-full bg-primary flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          )}
                          <span className={`flex-1 text-xs min-w-0 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                            {getUrgencyDot(getUrgencyLevel(task.deadline, prioritySettings))}{' '}
                            {task.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {formatMinutes(task.estimatedMinutes)}
                          </span>
                          <Badge variant="outline" className="text-[10px] hidden md:inline-flex">
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task.id)}>
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateProjectDialog open={showCreateProject} onOpenChange={setShowCreateProject} enterpriseId={id!} />
      <CreateTaskDialog
        open={!!createTaskForProject}
        onOpenChange={(open) => !open && setCreateTaskForProject(null)}
        enterpriseId={id!}
        projectId={createTaskForProject || ''}
      />
      <CreateFocusPeriodDialog open={showCreateFocus} onOpenChange={setShowCreateFocus} enterpriseId={id!} />
      <CreateObjectiveDialog
        open={!!createObjForFocus}
        onOpenChange={(open) => !open && setCreateObjForFocus(null)}
        enterpriseId={id!}
        focusPeriodId={createObjForFocus || ''}
      />
      <CreateKeyResultDialog
        open={!!createKRForObjective}
        onOpenChange={(open) => !open && setCreateKRForObjective(null)}
        enterpriseId={id!}
        objectiveId={createKRForObjective || ''}
      />
      <EditEnterpriseDialog
        open={showEditEnterprise}
        onOpenChange={setShowEditEnterprise}
        enterprise={enterprise}
      />
    </div>
  );
};

export default EnterpriseDetail;
