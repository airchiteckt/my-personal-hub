import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Target, Flag, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { differenceInDays, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { RadarEmbedded } from '@/components/AiAssistant';
import { CreateFocusPeriodDialog } from '@/components/enterprise/CreateFocusPeriodDialog';
import { CreateObjectiveDialog } from '@/components/enterprise/CreateObjectiveDialog';
import { CreateKeyResultDialog } from '@/components/enterprise/CreateKeyResultDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { PROJECT_TYPE_LABELS } from '@/types/prp';
import type { Project, KeyResult } from '@/types/prp';

const krPct = (kr: KeyResult) => kr.metricType === 'boolean' ? (kr.currentValue >= 1 ? 100 : 0) : kr.targetValue > 0 ? Math.min(100, Math.round(kr.currentValue / kr.targetValue * 100)) : 0;
const avg = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0;
import { usePrp } from '@/context/PrpContext';

/** Pagina impresa nel Piano: Focus → Obiettivi → Key Result → Progetti, con Radar dedicato all'impresa. */
export default function EnterprisePlan() {
  const { enterpriseId = '' } = useParams();
  const navigate = useNavigate();
  const { getEnterprise, focusPeriods, objectives, keyResults, projects, tasks } = usePrp();
  const [newFocus, setNewFocus] = useState(false);
  const [objFor, setObjFor] = useState<string | null>(null);
  const [krFor, setKrFor] = useState<string | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [selFocus, setSelFocus] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ent = getEnterprise(enterpriseId);
  if (!ent) return <div className="p-6 text-sm text-muted-foreground">Impresa non trovata.</div>;

  const focuses = focusPeriods.filter(f => f.enterpriseId === ent.id && f.status !== 'archived')
    .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));
  const current = focuses.find(f => f.id === selFocus) ?? focuses[0];
  const entProjects = projects.filter(p => p.enterpriseId === ent.id);
  const others = entProjects.filter(p => !p.keyResultId);

  const ProjectCard = ({ p }: { p: Project }) => {
    const open = tasks.filter(t => t.projectId === p.id && t.status !== 'done').length;
    return (
      <button onClick={() => navigate(`/planner/progetto/${p.id}`)} className="w-full flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-left hover:border-primary/50 transition-colors">
        <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate flex-1">{p.name}</span>
        <span className="text-[11px] text-muted-foreground shrink-0">{open} attività</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>
    );
  };

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] w-full max-w-7xl mx-auto p-4 gap-3">
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/planner')} aria-label="Torna al Piano"><ChevronLeft className="h-4 w-4" /></Button>
        <span className="h-3 w-3 rounded-full" style={{ background: `hsl(${ent.color})` }} />
        <h1 className="text-lg font-bold flex-1 truncate">{ent.name}</h1>
        <Button size="sm" variant="outline" onClick={() => setNewFocus(true)}><Plus className="h-3.5 w-3.5 mr-1" />Focus</Button>
        <Button size="sm" variant="outline" onClick={() => setNewProject(true)}><Plus className="h-3.5 w-3.5 mr-1" />Progetto</Button>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-3">
        <div className="min-h-0 overflow-y-auto space-y-3 pb-6">
          {focuses.length === 0 && (
            <Card className="p-4 text-sm text-muted-foreground">Nessun Focus ancora. Creane uno con "+ Focus" oppure chiedi a Radar di aiutarti a definirlo.</Card>
          )}
          {focuses.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              {focuses.map(f => (
                <Button key={f.id} size="sm" variant={current?.id === f.id ? 'default' : 'outline'} className="h-7 text-xs shrink-0" onClick={() => setSelFocus(f.id)}>
                  {f.name}{f.status === 'future' ? ' · futuro' : ''}
                </Button>
              ))}
            </div>
          )}
          {current && (() => {
            const objs = objectives.filter(o => o.focusPeriodId === current.id);
            const allKrs = keyResults.filter(k => objs.some(o => o.id === k.objectiveId));
            const fProg = avg(allKrs.map(krPct));
            const left = differenceInDays(new Date(current.endDate), new Date());
            return (
              <>
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Focus {current.status === 'active' ? 'attivo' : 'futuro'}</p>
                      <p className="text-base font-semibold truncate">{current.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular-nums">{fProg}%</p>
                      <p className="text-[11px] text-muted-foreground">{left >= 0 ? `${left} giorni rimasti` : 'Concluso'}</p>
                    </div>
                  </div>
                  <Progress value={fProg} className="h-2" />
                  <div className="flex items-center text-[11px] text-muted-foreground">
                    <span>{format(new Date(current.startDate), 'd MMM', { locale: it })} – {format(new Date(current.endDate), 'd MMM yyyy', { locale: it })}</span>
                    <span className="ml-auto">{objs.length} obiettivi · {allKrs.length} Key Result</span>
                  </div>
                  {current.description && <p className="text-xs text-muted-foreground">{current.description}</p>}
                </Card>

                {objs.map((o, i) => {
                  const krs = keyResults.filter(k => k.objectiveId === o.id);
                  const oProg = avg(krs.map(krPct));
                  const closed = collapsed[o.id];
                  return (
                    <Card key={o.id} className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCollapsed(c => ({ ...c, [o.id]: !c[o.id] }))} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                          {closed ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                          <span className="h-6 w-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">O{i + 1}</span>
                          <span className="text-sm font-semibold truncate">{o.title}</span>
                        </button>
                        <span className={`text-xs font-semibold tabular-nums ${oProg >= 70 ? 'text-primary' : 'text-muted-foreground'}`}>{oProg}%</span>
                      </div>
                      <Progress value={oProg} className="h-1.5" />
                      {!closed && (
                        <div className="space-y-2 pt-1">
                          {krs.map(kr => {
                            const ps = entProjects.filter(p => p.keyResultId === kr.id);
                            const pct = krPct(kr);
                            return (
                              <div key={kr.id} className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Flag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="text-xs font-medium flex-1 min-w-0 truncate">{kr.title}</span>
                                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                    {kr.metricType === 'boolean' ? (kr.currentValue >= 1 ? 'Fatto' : 'Da fare') : `${kr.currentValue} / ${kr.targetValue}${kr.metricType === 'percentage' ? '%' : ''}`}
                                  </span>
                                </div>
                                <Progress value={pct} className="h-1" />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                  {ps.map(p => <ProjectCard key={p.id} p={p} />)}
                                  <button onClick={() => setNewProject(true)} className="flex items-center justify-center gap-1 rounded-md border border-dashed px-2.5 py-2 text-[11px] text-muted-foreground hover:text-foreground">
                                    <Plus className="h-3 w-3" />Progetto
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setKrFor(o.id)}><Plus className="h-3 w-3 mr-1" />Key Result</Button>
                        </div>
                      )}
                    </Card>
                  );
                })}
                <Button variant="outline" className="w-full border-dashed" onClick={() => setObjFor(current.id)}><Plus className="h-4 w-4 mr-1" />Aggiungi obiettivo</Button>
              </>
            );
          })()}
          {others.length > 0 && (
            <Card className="p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Progetti operativi e di manutenzione</p>
              {others.map(p => (
                <div key={p.id} className="relative">
                  <ProjectCard p={p} />
                  <span className="sr-only">{PROJECT_TYPE_LABELS[p.type]}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
        <div className="min-h-[480px] lg:min-h-0">
          <RadarEmbedded
            scope={{ type: 'enterprise', id: ent.id, label: ent.name }}
            intro="Ti aiuto a costruire il piano di questa impresa: Focus, obiettivi, Key Result e progetti. Ogni creazione passa dalla tua approvazione."
            starters={['Aiutami a definire il Focus dei prossimi 90 giorni', 'Proponi obiettivi e Key Result per il Focus attivo', 'Quali progetti servono per raggiungere i Key Result?']}
          />
        </div>
      </div>
      <CreateFocusPeriodDialog open={newFocus} onOpenChange={setNewFocus} enterpriseId={ent.id} />
      <CreateObjectiveDialog open={!!objFor} onOpenChange={o => !o && setObjFor(null)} enterpriseId={ent.id} focusPeriodId={objFor || ''} />
      <CreateKeyResultDialog open={!!krFor} onOpenChange={o => !o && setKrFor(null)} enterpriseId={ent.id} objectiveId={krFor || ''} />
      <CreateProjectDialog open={newProject} onOpenChange={setNewProject} enterpriseId={ent.id} />
    </div>
  );
}
