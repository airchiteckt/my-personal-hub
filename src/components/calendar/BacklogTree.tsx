import { useMemo, useState } from 'react';
import { addDays, differenceInDays, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronDown, ChevronRight, CalendarPlus, Target, Flag, FolderKanban, Search, Plus, Radar, Clock3, Inbox } from 'lucide-react';
import { usePrp } from '@/context/PrpContext';
import type { Task, TaskPriority, Project } from '@/types/prp';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DayPicker } from '@/components/ui/calendar';
import { PRIORITY_ORDER, priorityLimitWarning } from '@/lib/priority-limits';
import { openRadarScope } from '@/components/AiAssistant';
import { toast } from 'sonner';

interface Props {
  date: Date;
  onOpenTask: (t: Task) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: () => void;
  /** 'page' = vista completa per organizzare (progetti aperti, aggiunta rapida, spostamento tra progetti) */
  variant?: 'panel' | 'page';
}

const lbl: Record<TaskPriority, string> = { high: 'P1', medium: 'P2', low: 'P3' };
const nextPrio: Record<TaskPriority, TaskPriority> = { high: 'medium', medium: 'low', low: 'high' };
const badge: Record<TaskPriority, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-primary text-primary-foreground',
  low: 'bg-muted text-muted-foreground',
};
const STALE_DAYS = 30;

/** Backlog gerarchico: Focus → Obiettivi → Key Result → Progetti → attività, più progetti operativi/manutenzione. */
export function BacklogTree({ date, onOpenTask, onDragStart, onDragEnd, variant = 'panel' }: Props) {
  const { tasks, enterprises, projects, focusPeriods, objectives, keyResults, updateTask, addTask } = usePrp();
  const page = variant === 'page';
  const [entFilter, setEntFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [onlyP1, setOnlyP1] = useState(false);
  const [showPlanned, setShowPlanned] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [overProject, setOverProject] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const filtering = !!q || onlyP1;

  const isPlanned = (t: Task) => t.status === 'scheduled' && !!t.scheduledDate;
  const openTasks = useMemo(() => tasks.filter(t => t.status !== 'done'
    && (showPlanned || !isPlanned(t))
    && (!onlyP1 || t.priority === 'high')
    && (!q || t.title.toLowerCase().includes(q))), [tasks, showPlanned, onlyP1, q]);
  const tasksOf = (projectId: string) => openTasks
    .filter(t => t.projectId === projectId)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt));
  const isOpen = (k: string) => open[k] ?? (page || filtering);
  const toggle = (k: string) => setOpen(c => ({ ...c, [k]: !isOpen(k) }));
  const visibleEnts = enterprises.filter(e => entFilter === 'all' || e.id === entFilter);

  const planOn = (t: Task, d: Date) => {
    const ds = format(d, 'yyyy-MM-dd');
    const w = priorityLimitWarning(tasks, ds, t.priority, t.id);
    updateTask(t.id, { status: 'scheduled', scheduledDate: ds, scheduledTime: null as unknown as string });
    if (w) toast.warning(w); else toast.success(`Pianificata per ${format(d, 'EEE d MMM', { locale: it })}`);
  };
  const unplan = (t: Task) => updateTask(t.id, { status: 'backlog', scheduledDate: null as unknown as string, scheduledTime: null as unknown as string });

  const submitDraft = (p: Project) => {
    const title = draft.trim();
    if (!title) { setAdding(null); return; }
    addTask({ enterpriseId: p.enterpriseId, projectId: p.id, title, estimatedMinutes: 30, priority: 'medium', isRecurring: false });
    setDraft('');
  };

  const PlanMenu = ({ t }: { t: Task }) => {
    const [o, setO] = useState(false);
    const [pick, setPick] = useState(false);
    return (
      <Popover open={o} onOpenChange={v => { setO(v); if (!v) setPick(false); }}>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Metti in piano" aria-label="Metti in piano" onClick={e => e.stopPropagation()}>
            <CalendarPlus className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-1" onClick={e => e.stopPropagation()}>
          {pick ? (
            <DayPicker className="pointer-events-auto" mode="single" locale={it} weekStartsOn={1} selected={t.scheduledDate ? new Date(t.scheduledDate + 'T00:00') : undefined} onSelect={d => { if (d) { planOn(t, d); setO(false); } }} />
          ) : (
            <div className="flex flex-col min-w-[150px]">
              {!isSameDayStr(t, date) && <MenuBtn onClick={() => { planOn(t, date); setO(false); }}>{isTodayDate(date) ? 'Oggi' : format(date, 'EEE d MMM', { locale: it })}</MenuBtn>}
              {isTodayDate(date) && <MenuBtn onClick={() => { planOn(t, addDays(new Date(), 1)); setO(false); }}>Domani</MenuBtn>}
              <MenuBtn onClick={() => setPick(true)}>Scegli giorno…</MenuBtn>
              {isPlanned(t) && <MenuBtn onClick={() => { unplan(t); setO(false); }}><Inbox className="h-3 w-3 mr-1.5" />Rimetti nel Backlog</MenuBtn>}
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const TaskRow = ({ t }: { t: Task }) => {
    const planned = isPlanned(t);
    const stale = !planned && differenceInDays(new Date(), new Date(t.createdAt)) >= STALE_DAYS;
    return (
      <div
        draggable
        onDragStart={e => { e.dataTransfer.setData('application/x-flydeck-project-move', t.id); onDragStart(e, t.id); }}
        onDragEnd={onDragEnd}
        onClick={() => onOpenTask(t)}
        className={`group flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-accent/50 ${planned ? 'opacity-50' : ''}`}
      >
        <button
          type="button"
          title="Cambia priorità"
          onClick={e => { e.stopPropagation(); updateTask(t.id, { priority: nextPrio[t.priority] }); }}
          className={`text-[9px] font-bold px-1 rounded ${badge[t.priority]}`}
        >{lbl[t.priority]}</button>
        <span className="text-xs font-medium truncate flex-1">{t.title}</span>
        {stale && <span title={`In backlog da più di ${STALE_DAYS} giorni`}><Clock3 className="h-3 w-3 text-muted-foreground shrink-0" /></span>}
        {planned && <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(t.scheduledDate + 'T00:00'), 'd MMM', { locale: it })}</span>}
        <PlanMenu t={t} />
      </div>
    );
  };

  const ProjectBlock = ({ p }: { p: Project }) => {
    const list = tasksOf(p.id);
    if (list.length === 0 && !page) return null;
    if (list.length === 0 && filtering) return null;
    const k = `p:${p.id}`;
    return (
      <div
        className={`ml-1 rounded-md ${overProject === p.id ? 'bg-primary/10 ring-1 ring-primary/40' : ''}`}
        onDragOver={e => { if (page && e.dataTransfer.types.includes('application/x-flydeck-project-move')) { e.preventDefault(); setOverProject(p.id); } }}
        onDragLeave={() => setOverProject(null)}
        onDrop={e => {
          const id = e.dataTransfer.getData('application/x-flydeck-project-move');
          setOverProject(null);
          if (!page || !id) return;
          e.preventDefault(); e.stopPropagation(); onDragEnd?.();
          const t = tasks.find(x => x.id === id);
          if (t && t.projectId !== p.id) { updateTask(id, { projectId: p.id, enterpriseId: p.enterpriseId }); toast.success(`Spostata in ${p.name}`); }
        }}
      >
        <div className="group flex items-center gap-1.5 py-1">
          <button onClick={() => toggle(k)} className="flex items-center gap-1.5 text-xs font-medium flex-1 min-w-0 text-left">
            {isOpen(k) ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
            <FolderKanban className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{p.name}</span>
            <span className="text-muted-foreground font-normal">({list.length})</span>
          </button>
          <button title="Parla con Radar di questo progetto" onClick={() => openRadarScope({ type: 'project', id: p.id, label: p.name })} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-accent">
            <Radar className="h-3.5 w-3.5" />
          </button>
        </div>
        {isOpen(k) && (
          <div className="ml-3 space-y-1 pb-1">
            {list.map(t => <TaskRow key={t.id} t={t} />)}
            {adding === p.id ? (
              <Input
                autoFocus
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitDraft(p); if (e.key === 'Escape') { setAdding(null); setDraft(''); } }}
                onBlur={() => { if (draft.trim()) submitDraft(p); setAdding(null); }}
                placeholder="Nuova attività, Invio per salvare"
                className="h-7 text-xs"
              />
            ) : (
              <button onClick={() => { setAdding(p.id); setDraft(''); }} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-1 py-0.5">
                <Plus className="h-3 w-3" />Aggiungi attività
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const sections = visibleEnts.map(ent => {
    const entProjects = projects.filter(p => p.enterpriseId === ent.id);
    const hasTasks = (p: Project) => tasksOf(p.id).length > 0 || (page && !filtering);
    const focus = focusPeriods.find(f => f.enterpriseId === ent.id && f.status === 'active');
    const objs = focus ? objectives.filter(o => o.focusPeriodId === focus.id) : [];
    const linkedIds = new Set<string>();
    const krBlocks = objs.map(o => ({
      o,
      krs: keyResults.filter(kr => kr.objectiveId === o.id).map(kr => {
        const ps = entProjects.filter(p => p.keyResultId === kr.id && hasTasks(p));
        ps.forEach(p => linkedIds.add(p.id));
        return { kr, ps };
      }).filter(({ ps }) => ps.length > 0),
    })).filter(({ krs }) => krs.length > 0);
    const others = entProjects.filter(p => !linkedIds.has(p.id) && hasTasks(p));
    const count = openTasks.filter(t => t.enterpriseId === ent.id).length;
    if (count === 0 && !(page && !filtering && entProjects.length > 0)) return null;
    return (
      <section key={ent.id} className={`rounded-lg border bg-background p-2 ${page ? 'break-inside-avoid mb-3' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${ent.color})` }} />
          <h3 className="text-xs font-semibold flex-1">{ent.name} <span className="text-[11px] text-muted-foreground font-normal">({count})</span></h3>
          <button title="Parla con Radar di questa impresa" onClick={() => openRadarScope({ type: 'enterprise', id: ent.id, label: ent.name })} className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-accent">
            <Radar className="h-3.5 w-3.5" />
          </button>
        </div>
        {focus && krBlocks.length > 0 && (
          <div className="mb-1">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">
              <Target className="h-3 w-3" /><span className="flex-1">Focus · {focus.name}</span>
              <button title="Parla con Radar di questo Focus" onClick={() => openRadarScope({ type: 'focus', id: focus.id, label: focus.name })} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary normal-case"><Radar className="h-3 w-3" /></button>
            </p>
            {krBlocks.map(({ o, krs }) => (
              <div key={o.id} className="ml-1 mb-1">
                <p className="text-[11px] font-semibold flex items-center gap-1"><span className="flex-1">{o.title}</span>
                  <button title="Parla con Radar di questo obiettivo" onClick={() => openRadarScope({ type: 'objective', id: o.id, label: o.title })} className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-primary"><Radar className="h-3 w-3" /></button>
                </p>
                {krs.map(({ kr, ps }) => (
                  <div key={kr.id} className="ml-1">
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground py-0.5"><Flag className="h-3 w-3" /><span className="flex-1">{kr.title}</span>
                      <button title="Parla con Radar di questo Key Result" onClick={() => openRadarScope({ type: 'key_result', id: kr.id, label: kr.title })} className="h-5 w-5 flex items-center justify-center rounded hover:text-primary"><Radar className="h-3 w-3" /></button>
                    </p>
                    {ps.map(p => <ProjectBlock key={p.id} p={p} />)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        {others.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{page ? 'Altri progetti' : 'Operativi e manutenzione'}</p>
            {others.map(p => <ProjectBlock key={p.id} p={p} />)}
          </div>
        )}
      </section>
    );
  }).filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca nel backlog" className="h-8 pl-7 text-xs" />
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <Button size="sm" variant={onlyP1 ? 'default' : 'outline'} className="h-6 px-2 text-[11px]" onClick={() => setOnlyP1(v => !v)}>Solo P1</Button>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-auto cursor-pointer">
          <Switch checked={showPlanned} onCheckedChange={setShowPlanned} className="scale-75" />Mostra pianificate
        </label>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
        {[{ id: 'all', name: 'Tutte' }, ...enterprises].map(e => (
          <Button key={e.id} size="sm" variant={entFilter === e.id ? 'default' : 'outline'} className="h-6 px-2 text-[11px] shrink-0" onClick={() => setEntFilter(e.id)}>
            {e.name}
          </Button>
        ))}
      </div>
      <div className={page ? 'columns-1 md:columns-2 xl:columns-3 gap-3' : 'flex flex-col gap-2'}>{sections}</div>
      {sections.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">{filtering ? 'Nessuna attività trovata.' : 'Nessuna attività aperta nel backlog.'}</p>
      )}
    </div>
  );
}

const isTodayDate = (d: Date) => format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
const isSameDayStr = (t: Task, d: Date) => t.status === 'scheduled' && t.scheduledDate === format(d, 'yyyy-MM-dd');
function MenuBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center text-left text-xs px-2 py-1.5 rounded hover:bg-accent capitalize">{children}</button>;
}
