import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Brain, Shield, Cog, Plus, Repeat, Clock, Building2, Check,
  MoreHorizontal, Trash2, Pencil, CalendarDays, Pin, Shuffle, BookOpen,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { CreateRitualDialog } from '@/components/rituals/CreateRitualDialog';
import { EditRitualDialog } from '@/components/rituals/EditRitualDialog';
import { JournalDialog, type JournalEntry } from '@/components/calendar/JournalDialog';

interface Ritual {
  id: string;
  user_id: string;
  name: string;
  category: string;
  frequency: string;
  custom_frequency_days: number[] | null;
  estimated_minutes: number;
  enterprise_id: string | null;
  suggested_day: number | null;
  suggested_time: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  weekly_specific_days: number[] | null;
  weekly_times_per_week: number | null;
  planning_mode: string;
}

interface RitualCompletion {
  id: string;
  ritual_id: string;
  completed_date: string;
  status: string;
}

const CATEGORY_META: Record<string, { label: string; icon: typeof Brain; color: string }> = {
  performance: { label: 'Performance Personale', icon: Brain, color: 'text-violet-500' },
  governance: { label: 'Governance Aziendale', icon: Shield, color: 'text-amber-500' },
  operational: { label: 'Operativo Ricorrente', icon: Cog, color: 'text-blue-500' },
};

const FREQ_LABELS: Record<string, string> = {
  daily: 'Giornaliero',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  custom: 'Personalizzato',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function shouldCompleteOnDate(ritual: Ritual, date: Date): boolean {
  const dow = date.getDay();
  switch (ritual.frequency) {
    case 'daily': return true;
    case 'weekly': {
      // Specific days mode
      if (ritual.weekly_specific_days && ritual.weekly_specific_days.length > 0) {
        return ritual.weekly_specific_days.includes(dow);
      }
      // Flexible mode (N times per week) - show all weekdays as available
      if (ritual.weekly_times_per_week) {
        return dow >= 1 && dow <= 5; // show Mon-Fri as potential
      }
      // Legacy: suggested_day
      if (ritual.suggested_day != null) return dow === ritual.suggested_day;
      return dow >= 1 && dow <= 5;
    }
    case 'monthly': return date.getDate() === 1;
    case 'custom': return ritual.custom_frequency_days?.includes(dow) ?? false;
    default: return false;
  }
}

export default function Rituals() {
  const { user } = useAuth();
  const { enterprises, journalEntries, getJournalForDate, saveJournalEntry, deleteJournalEntry } = usePrp();
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [completions, setCompletions] = useState<RitualCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRitual, setEditingRitual] = useState<Ritual | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [journalDate, setJournalDate] = useState<string | null>(null);
  const [showAllJournals, setShowAllJournals] = useState(false);

  const today = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekEnd = useMemo(() => endOfWeek(today, { weekStartsOn: 1 }), [today]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const fetchData = async () => {
    if (!user) return;
    const [ritualsRes, completionsRes] = await Promise.all([
      supabase.from('rituals').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('ritual_completions').select('id, ritual_id, completed_date, status').eq('user_id', user.id)
        .gte('completed_date', format(subDays(today, 30), 'yyyy-MM-dd')),
    ]);
    setRituals((ritualsRes.data as Ritual[]) ?? []);
    setCompletions((completionsRes.data as RitualCompletion[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleCreate = async (data: any) => {
    if (!user) return;
    const { error } = await supabase.from('rituals').insert({
      user_id: user.id,
      name: data.name,
      category: data.category,
      frequency: data.frequency,
      planning_mode: data.planningMode || 'fixed',
      custom_frequency_days: data.customFrequencyDays,
      estimated_minutes: data.estimatedMinutes,
      enterprise_id: data.enterpriseId === 'none' ? null : data.enterpriseId,
      suggested_day: data.suggestedDay,
      suggested_time: data.suggestedTime,
      description: data.description,
      weekly_specific_days: data.weeklySpecificDays,
      weekly_times_per_week: data.weeklyTimesPerWeek,
    });
    if (error) toast.error('Errore nella creazione');
    else { toast.success('Rituale creato!'); fetchData(); }
  };

  const handleEdit = async (id: string, data: any) => {
    const { error } = await supabase.from('rituals').update({
      name: data.name,
      category: data.category,
      frequency: data.frequency,
      planning_mode: data.planningMode || 'fixed',
      custom_frequency_days: data.customFrequencyDays,
      estimated_minutes: data.estimatedMinutes,
      enterprise_id: data.enterpriseId === 'none' ? null : data.enterpriseId,
      suggested_time: data.suggestedTime,
      description: data.description,
      weekly_specific_days: data.weeklySpecificDays,
      weekly_times_per_week: data.weeklyTimesPerWeek,
    }).eq('id', id);
    if (error) toast.error('Errore nella modifica');
    else { toast.success('Rituale aggiornato!'); fetchData(); }
  };

  const toggleCompletion = async (ritualId: string, date: Date) => {
    if (!user) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = completions.find(c => c.ritual_id === ritualId && c.completed_date === dateStr);
    if (existing && existing.status === 'done') {
      await supabase.from('ritual_completions').delete().eq('id', existing.id);
      setCompletions(prev => prev.filter(c => c.id !== existing.id));
    } else if (existing) {
      await supabase.from('ritual_completions').update({ status: 'done' }).eq('id', existing.id);
      setCompletions(prev => prev.map(c => c.id === existing.id ? { ...c, status: 'done' } : c));
    } else {
      const { data, error } = await supabase.from('ritual_completions').insert({
        ritual_id: ritualId,
        user_id: user.id,
        completed_date: dateStr,
        status: 'done',
      }).select('id, ritual_id, completed_date, status').single();
      if (!error && data) setCompletions(prev => [...prev, data as RitualCompletion]);
    }
  };

  const deleteRitual = async (id: string) => {
    await supabase.from('rituals').delete().eq('id', id);
    setRituals(prev => prev.filter(r => r.id !== id));
    toast.success('Rituale eliminato');
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('rituals').update({ is_active: active }).eq('id', id);
    setRituals(prev => prev.map(r => r.id === id ? { ...r, is_active: active } : r));
  };

  const isCompleted = (ritualId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return completions.some(c => c.ritual_id === ritualId && c.completed_date === dateStr && c.status === 'done');
  };

  const filtered = activeCategory === 'all' ? rituals : rituals.filter(r => r.category === activeCategory);
  const activeRituals = filtered.filter(r => r.is_active);
  const inactiveRituals = filtered.filter(r => !r.is_active);

  // Weekly completion rate
  const getWeeklyRate = (ritual: Ritual) => {
    // For flexible weekly (N times/week), expected = N
    if (ritual.frequency === 'weekly' && ritual.weekly_times_per_week) {
      const completedCount = weekDays.filter(d => isCompleted(ritual.id, d) && d <= today).length;
      return Math.min(100, Math.round((completedCount / ritual.weekly_times_per_week) * 100));
    }
    const expected = weekDays.filter(d => shouldCompleteOnDate(ritual, d) && (d <= today)).length;
    const completed = weekDays.filter(d => isCompleted(ritual.id, d) && shouldCompleteOnDate(ritual, d)).length;
    return expected > 0 ? Math.round((completed / expected) * 100) : 0;
  };

  const getFrequencyLabel = (ritual: Ritual) => {
    if (ritual.planning_mode === 'flexible') {
      return `${ritual.weekly_times_per_week || 2}× / settimana`;
    }
    if (ritual.frequency === 'weekly') {
      if (ritual.weekly_specific_days && ritual.weekly_specific_days.length > 0) {
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
        const sorted = [...ritual.weekly_specific_days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
        return sorted.map(d => dayNames[d]).join(', ');
      }
    }
    return FREQ_LABELS[ritual.frequency] || ritual.frequency;
  };

  const getWeeklyCompletedCount = (ritual: Ritual) => {
    return weekDays.filter(d => isCompleted(ritual.id, d)).length;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6 md:h-7 md:w-7" />
            Rituali
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Comportamenti strutturali che mantengono performance e coerenza
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Nuovo
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex gap-1 mb-5 bg-muted/40 rounded-xl p-1 overflow-x-auto">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            activeCategory === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Tutti ({rituals.length})
        </button>
        {Object.entries(CATEGORY_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const count = rituals.filter(r => r.category === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
              <span className="hidden sm:inline">{meta.label.split(' ')[0]}</span>
              {count > 0 && <span className="text-[10px] bg-muted-foreground/10 px-1.5 py-0.5 rounded-full">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Week header */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Settimana {format(weekStart, 'd MMM', { locale: it })} – {format(weekEnd, 'd MMM', { locale: it })}
          </span>
        </div>

        {activeRituals.length === 0 ? (
          <div className="text-center py-8">
            <Repeat className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nessun rituale attivo</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Crea il primo
            </Button>
          </div>
        ) : (
          <div className="space-y-0">
            {/* Day headers */}
            <div className="grid items-center gap-2 mb-2" style={{ gridTemplateColumns: '1fr repeat(7, 40px) 60px' }}>
              <div />
              {weekDays.map(d => (
                <div key={d.toISOString()} className={`text-center text-[10px] font-medium uppercase ${isToday(d) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                  <div>{format(d, 'EEE', { locale: it })}</div>
                  <div className={`text-sm ${isToday(d) ? 'text-primary' : ''}`}>{format(d, 'd')}</div>
                </div>
              ))}
              <div className="text-[10px] font-medium text-muted-foreground text-center">%</div>
            </div>

            {/* Ritual rows */}
            {activeRituals.map(ritual => {
              const catMeta = CATEGORY_META[ritual.category];
              const CatIcon = catMeta?.icon || Repeat;
              const rate = getWeeklyRate(ritual);
              const enterprise = enterprises.find(e => e.id === ritual.enterprise_id);

              return (
                <div
                  key={ritual.id}
                  className="grid items-center gap-2 py-2.5 border-t border-border/50 group"
                  style={{ gridTemplateColumns: '1fr repeat(7, 40px) 60px' }}
                >
                  {/* Ritual info */}
                  <div className="flex items-center gap-2 min-w-0">
                    <CatIcon className={`h-4 w-4 shrink-0 ${catMeta?.color || 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium truncate">{ritual.name}</p>
                        {ritual.planning_mode === 'flexible' ? (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 gap-0.5 border-dashed">
                            <Shuffle className="h-2.5 w-2.5" /> Flessibile
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0 gap-0.5">
                            <Pin className="h-2.5 w-2.5" /> Fisso
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{getFrequencyLabel(ritual)}</span>
                        {ritual.estimated_minutes && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{ritual.estimated_minutes}m</span>
                          </>
                        )}
                        {enterprise && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-0.5">
                              <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: `hsl(${enterprise.color})` }} />
                              {enterprise.name}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingRitual(ritual)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(ritual.id, !ritual.is_active)}>
                          {ritual.is_active ? 'Disattiva' : 'Attiva'}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteRitual(ritual.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Day checkboxes (fixed) or weekly counter (flexible) */}
                  {ritual.planning_mode === 'flexible' ? (
                    <>
                      {/* Show counter spanning the 7-day area */}
                      <div className="col-span-7 flex items-center justify-center gap-2">
                        <span className="text-sm font-bold" style={{ color: `hsl(${catMeta?.color === 'text-violet-500' ? '270 60% 55%' : catMeta?.color === 'text-amber-500' ? '40 80% 50%' : '210 70% 55%'})` }}>
                          {getWeeklyCompletedCount(ritual)}/{ritual.weekly_times_per_week || 2}
                        </span>
                        <span className="text-[10px] text-muted-foreground">completati</span>
                        <Progress
                          value={Math.min(100, (getWeeklyCompletedCount(ritual) / (ritual.weekly_times_per_week || 2)) * 100)}
                          className="h-1.5 w-20"
                        />
                      </div>
                    </>
                  ) : (
                    weekDays.map(d => {
                      const expected = shouldCompleteOnDate(ritual, d);
                      const completed = isCompleted(ritual.id, d);
                      const isFuture = d > today;

                      if (!expected) return <div key={d.toISOString()} />;

                      return (
                        <button
                          key={d.toISOString()}
                          onClick={() => !isFuture && toggleCompletion(ritual.id, d)}
                          disabled={isFuture}
                          className={`h-8 w-8 mx-auto rounded-lg flex items-center justify-center transition-all ${
                            completed
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : isFuture
                                ? 'bg-muted/30 border border-dashed border-border/50'
                                : 'bg-muted/40 hover:bg-accent border border-border/50'
                          }`}
                        >
                          {completed && <Check className="h-4 w-4" />}
                        </button>
                      );
                    })
                  )}

                  {/* Rate */}
                  <div className="text-center">
                    <span className={`text-sm font-bold ${rate === 100 ? 'text-primary' : rate >= 50 ? 'text-foreground' : 'text-destructive'}`}>
                      {rate}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Inactive rituals */}
      {inactiveRituals.length > 0 && (
        <Card className="p-4 opacity-50">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Disattivati ({inactiveRituals.length})</h3>
          <div className="space-y-2">
            {inactiveRituals.map(r => {
              const catMeta = CATEGORY_META[r.category];
              const CatIcon = catMeta?.icon || Repeat;
              return (
                <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <CatIcon className={`h-4 w-4 ${catMeta?.color || ''}`} />
                    <span className="text-sm truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={false} onCheckedChange={() => toggleActive(r.id, true)} />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteRitual(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Journal Section */}
      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Journal — Diario quotidiano
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setJournalDate(format(new Date(), 'yyyy-MM-dd'))} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Oggi
          </Button>
        </div>

        {journalEntries.length === 0 ? (
          <div className="text-center py-8">
            <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">Nessuna voce nel journal</p>
            <p className="text-muted-foreground text-xs mt-1">Inizia a scrivere il tuo diario quotidiano dal calendario o da qui</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(showAllJournals ? journalEntries : journalEntries.slice(0, 7)).map(entry => {
              const moodEmoji = { great: '😊', good: '🙂', neutral: '😐', tough: '😟', stressed: '😤' }[entry.mood || ''] || '';
              const dateLabel = new Date(entry.entryDate + 'T00:00:00').toLocaleDateString('it-IT', {
                weekday: 'short', day: 'numeric', month: 'short',
              });
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-2.5 border-t border-border/50 group cursor-pointer hover:bg-accent/30 rounded-md px-2 -mx-2 transition-colors"
                  onClick={() => setJournalDate(entry.entryDate)}
                >
                  <div className="flex flex-col items-center shrink-0 w-12 pt-0.5">
                    {moodEmoji && <span className="text-lg">{moodEmoji}</span>}
                    <span className="text-[10px] text-muted-foreground capitalize">{dateLabel}</span>
                  </div>
                  <p className="text-sm text-foreground/80 line-clamp-2 flex-1">{entry.content || <span className="text-muted-foreground italic">Solo mood registrato</span>}</p>
                </div>
              );
            })}
            {journalEntries.length > 7 && !showAllJournals && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowAllJournals(true)}>
                Mostra tutti ({journalEntries.length} voci)
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card className="p-4 bg-muted/50 border-dashed mt-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>🧠 Imprese vs Rituali:</strong> Le Imprese guidano la direzione (cosa costruisci).
          I Rituali garantiscono coerenza nel tempo (come ti comporti). Il journaling è un rituale di riflessione quotidiana.
        </p>
      </Card>

      <CreateRitualDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        enterprises={enterprises}
        onSubmit={handleCreate}
      />

      <EditRitualDialog
        open={!!editingRitual}
        onOpenChange={(open) => !open && setEditingRitual(null)}
        enterprises={enterprises}
        ritual={editingRitual}
        onSubmit={handleEdit}
      />

      {journalDate && (
        <JournalDialog
          open={!!journalDate}
          onOpenChange={(open) => !open && setJournalDate(null)}
          date={journalDate}
          entry={getJournalForDate(journalDate)}
          onSave={saveJournalEntry}
          onDelete={deleteJournalEntry}
        />
      )}
    </div>
  );
}
