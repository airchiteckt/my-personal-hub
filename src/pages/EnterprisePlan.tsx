import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Target, Flag, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RadarEmbedded } from '@/components/AiAssistant';
import { CreateFocusPeriodDialog } from '@/components/enterprise/CreateFocusPeriodDialog';
import { CreateObjectiveDialog } from '@/components/enterprise/CreateObjectiveDialog';
import { CreateKeyResultDialog } from '@/components/enterprise/CreateKeyResultDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { PROJECT_TYPE_LABELS } from '@/types/prp';
import type { Project } from '@/types/prp';
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
  const ent = getEnterprise(enterpriseId);
  if (!ent) return <div className="p-6 text-sm text-muted-foreground">Impresa non trovata.</div>;

  const focuses = focusPeriods.filter(f => f.enterpriseId === ent.id && f.status !== 'archived')
    .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1));
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
          {focuses.map(f => (
            <Card key={f.id} className="p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold flex-1 truncate">{f.name}</p>
                {f.status === 'active' && <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Attivo</span>}
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setObjFor(f.id)}><Plus className="h-3 w-3 mr-1" />Obiettivo</Button>
              </div>
              {objectives.filter(o => o.focusPeriodId === f.id).map(o => (
                <div key={o.id} className="ml-3 rounded-md bg-muted/40 p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium flex-1 truncate">{o.title}</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => setKrFor(o.id)}><Plus className="h-3 w-3 mr-1" />Key Result</Button>
                  </div>
                  {keyResults.filter(k => k.objectiveId === o.id).map(kr => {
                    const ps = entProjects.filter(p => p.keyResultId === kr.id);
                    return (
                      <div key={kr.id} className="ml-3 space-y-1">
                        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Flag className="h-3 w-3" />{kr.title}</p>
                        <div className="ml-4 space-y-1">
                          {ps.map(p => <ProjectCard key={p.id} p={p} />)}
                          {ps.length === 0 && <p className="text-[11px] text-muted-foreground italic">Nessun progetto collegato</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </Card>
          ))}
          {others.length > 0 && (
            <Card className="p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">Progetti operativi e di mantenimento</p>
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
