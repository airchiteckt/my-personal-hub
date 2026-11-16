import { useEffect, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { it } from 'date-fns/locale';
import { Plus, X, Inbox, CalendarDays, Sun, Sparkles, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePrp } from '@/context/PrpContext';
import type { Task } from '@/types/prp';
import { Button } from '@/components/ui/button';
import { TaskQueue } from './TaskQueue';
import { BacklogTree } from './BacklogTree';
import { PRIORITY_DAILY_LIMITS, PRIORITY_ORDER } from '@/lib/priority-limits';

type Tab = 'today' | 'week' | 'backlog';
const lbl: Record<string, string> = { high: 'P1', medium: 'P2', low: 'P3' };
const badge: Record<string, string> = {
  high: 'bg-destructive text-destructive-foreground',
  medium: 'bg-primary text-primary-foreground',
  low: 'bg-muted text-muted-foreground',
};

interface Props {
  date: Date;
  timer: React.ComponentProps<typeof TaskQueue>['timer'];
  onClose: () => void;
  onOpenTask: (t: Task) => void;
  onAddTask: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: () => void;
}

const taskIdFrom = (e: React.DragEvent) => {
  const d = e.dataTransfer.getData('text/plain');
  return d.startsWith('task:') ? d.slice(5) : null;
};

/** Pannello "Piano" a lato del calendario: Oggi e Settimana (sprint) + Backlog. */
export function PlanPanel({ date, timer, onClose, onOpenTask, onAddTask, onDragStart, onDragEnd }: Props) {
  const { tasks, updateTask } = usePrp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('today');
  const [overTab, setOverTab] = useState<Tab | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const dayStr = format(date, 'yyyy-MM-dd');
  const active = (t: Task) => t.status !== 'done' && t.status !== 'backlog';
  const dayList = tasks.filter(t => t.scheduledDate === dayStr && active(t));
  const backlogCount = tasks.filter(t => t.status === 'backlog' || (t.status !== 'done' && !t.scheduledDate)).length;
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekCount = tasks.filter(t => active(t) && t.scheduledDate && weekDays.some(d => format(d, 'yyyy-MM-dd') === t.scheduledDate)).length;

  // Rituale di pianificazione: la prima apertura del giorno, se oggi è vuoto, invita a scegliere dal Backlog
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const [showRitual, setShowRitual] = useState(false);
  useEffect(() => {
    if (localStorage.getItem('flydeck:plan-ritual') === todayKey) return;
    if (isSameDay(date, new Date()) && dayList.length === 0) setShowRitual(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dismissRitual = () => { localStorage.setItem('flydeck:plan-ritual', todayKey); setShowRitual(false); };

  const moveToDay = (id: string, d: string) => updateTask(id, { status: 'scheduled', scheduledDate: d, scheduledTime: null as unknown as string });
  const moveToBacklog = (id: string) => updateTask(id, { status: 'backlog', scheduledDate: null as unknown as string, scheduledTime: null as unknown as string });

  const tabDrop = (t: Tab) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOverTab(t); },
    onDragLeave: () => setOverTab(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); setOverTab(null); onDragEnd?.();
      const id = taskIdFrom(e); if (!id) return;
      if (t === 'backlog') moveToBacklog(id); else moveToDay(id, dayStr);
    },
  });

  const tabs: { id: Tab; label: string; icon: typeof Sun; n: number }[] = [
    { id: 'today', label: isSameDay(date, new Date()) ? 'Oggi' : format(date, 'EEE d', { locale: it }), icon: Sun, n: dayList.length },
    { id: 'week', label: 'Settimana', icon: CalendarDays, n: weekCount },
    { id: 'backlog', label: 'Backlog', icon: Inbox, n: backlogCount },
  ];

  const counts = (['high', 'medium', 'low'] as const).map(p => ({ p, n: dayList.filter(t => t.priority === p).length, max: PRIORITY_DAILY_LIMITS[p] }));

  return (
    <aside className="w-[300px] shrink-0 border rounded-xl bg-card shadow-sm flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex items-center gap-1 px-2 pt-2">
        <h2 className="text-sm font-semibold px-1">Piano</h2>
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={onAddTask}><Plus className="h-3.5 w-3.5 mr-1" />Task</Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="Chiudi pannello" title="Chiudi pannello"><X className="h-3.5 w-3.5" /></Button>
      </div>
      <div className="shrink-0 grid grid-cols-3 gap-1 p-2" role="tablist">
        {tabs.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            {...(t.id !== 'week' ? tabDrop(t.id) : {})}
            className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors capitalize ${tab === t.id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:text-foreground'} ${overTab === t.id ? 'ring-2 ring-primary/50' : ''}`}
          >
            <t.icon className="h-3 w-3" />{t.label}<span className="opacity-70">{t.n}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3">
        {tab === 'today' && (
          <div className="flex flex-col gap-2">
            {showRitual && (
              <div className="rounded-lg border bg-accent/40 p-2.5 text-xs">
                <p className="flex items-center gap-1 font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" />Pianifica la giornata</p>
                <p className="text-muted-foreground mt-0.5">Scegli dal Backlog le attività di oggi: massimo {PRIORITY_DAILY_LIMITS.high} P1 e {PRIORITY_DAILY_LIMITS.medium} P2.</p>
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => { setTab('backlog'); dismissRitual(); }}>Apri il Backlog</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismissRitual}>Più tardi</Button>
                </div>
              </div>
            )}
            <div className="flex gap-2 text-[10px] text-muted-foreground px-1">
              {counts.map(c => <span key={c.p} className={c.n > c.max ? 'text-destructive font-semibold' : ''}>{lbl[c.p]} {c.n}/{c.max}</span>)}
            </div>
            <TaskQueue vertical hideHeader date={date} timer={timer} onOpenTask={onOpenTask} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          </div>
        )}

        {tab === 'week' && (
          <div className="flex flex-col gap-2">
            {weekDays.map(d => {
              const ds = format(d, 'yyyy-MM-dd');
              const list = tasks.filter(t => t.scheduledDate === ds && active(t))
                .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.scheduledTime || '99').localeCompare(b.scheduledTime || '99'));
              return (
                <div
                  key={ds}
                  onDragOver={e => { e.preventDefault(); setOverDay(ds); }}
                  onDragLeave={() => setOverDay(null)}
                  onDrop={e => { e.preventDefault(); setOverDay(null); onDragEnd?.(); const id = taskIdFrom(e); if (id) moveToDay(id, ds); }}
                  className={`rounded-lg border p-1.5 transition-colors ${overDay === ds ? 'bg-primary/10 ring-2 ring-primary/40' : ''} ${isSameDay(d, new Date()) ? 'border-primary/40' : ''}`}
                >
                  <p className="text-[11px] font-semibold capitalize px-0.5 mb-1">{format(d, 'EEEE d', { locale: it })} <span className="text-muted-foreground font-normal">({list.length})</span></p>
                  {list.length === 0 ? <p className="text-[10px] text-muted-foreground px-0.5">Trascina qui un'attività</p> : (
                    <div className="flex flex-col gap-1">
                      {list.map(t => (
                        <div key={t.id} draggable onDragStart={e => onDragStart(e, t.id)} onDragEnd={onDragEnd} onClick={() => onOpenTask(t)}
                          className={`flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 cursor-grab active:cursor-grabbing hover:bg-accent/50 ${timer.activeTaskId === t.id ? 'animate-working' : ''}`}>
                          <span className={`text-[9px] font-bold px-1 rounded ${badge[t.priority]}`}>{lbl[t.priority]}</span>
                          <span className="text-xs truncate flex-1">{t.title}</span>
                          {t.scheduledTime && <span className="text-[10px] text-muted-foreground">{t.scheduledTime.slice(0, 5)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'backlog' && <button onClick={() => navigate('/backlog')} className="w-full mb-2 flex items-center justify-center gap-1 rounded-md border border-dashed py-1.5 text-[11px] text-muted-foreground hover:text-foreground"><Maximize2 className="h-3 w-3" />Apri Backlog completo</button>}
        {tab === 'backlog' && <BacklogTree date={date} onOpenTask={onOpenTask} onDragStart={onDragStart} onDragEnd={onDragEnd} />}
      </div>
    </aside>
  );
}
