import { useMemo } from 'react';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Calendar as CalendarIcon } from 'lucide-react';
import { BarChart3, CheckCircle2, Clock, TrendingUp, Building2 } from 'lucide-react';
import { format, startOfWeek, addDays, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatMinutes } from '@/lib/calendar-utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = [
  'hsl(220, 80%, 55%)', 'hsl(38, 90%, 50%)', 'hsl(350, 75%, 55%)',
  'hsl(160, 70%, 40%)', 'hsl(245, 65%, 55%)', 'hsl(25, 90%, 55%)',
];

const getAppointmentMinutes = (a: { startTime: string; endTime: string }) => {
  const [sh, sm] = a.startTime.split(':').map(Number);
  const [eh, em] = a.endTime.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
};

const Dashboard = () => {
  const { tasks, enterprises, projects, appointments, getEnterprise } = usePrp();

  // KPIs
  const completedTasks = useMemo(() => tasks.filter(t => t.status === 'done'), [tasks]);
  const scheduledTasks = useMemo(() => tasks.filter(t => t.status === 'scheduled'), [tasks]);
  const backlogTasks = useMemo(() => tasks.filter(t => t.status === 'backlog'), [tasks]);

  const totalAppointmentMinutes = useMemo(
    () => appointments.reduce((s, a) => s + getAppointmentMinutes(a), 0), [appointments]
  );

  const totalScheduledMinutes = useMemo(
    () => scheduledTasks.reduce((s, t) => s + t.estimatedMinutes, 0), [scheduledTasks]
  );
  const totalCompletedMinutes = useMemo(
    () => completedTasks.reduce((s, t) => s + t.estimatedMinutes, 0), [completedTasks]
  );

  // Time by enterprise (tasks + appointments)
  const timeByEnterprise = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of [...scheduledTasks, ...completedTasks]) {
      map.set(t.enterpriseId, (map.get(t.enterpriseId) || 0) + t.estimatedMinutes);
    }
    for (const a of appointments) {
      if (a.enterpriseId) {
        map.set(a.enterpriseId, (map.get(a.enterpriseId) || 0) + getAppointmentMinutes(a));
      }
    }
    return Array.from(map.entries()).map(([eid, minutes]) => {
      const ent = getEnterprise(eid);
      return { name: ent?.name || 'N/A', minutes, color: ent ? `hsl(${ent.color})` : '#888' };
    }).sort((a, b) => b.minutes - a.minutes);
  }, [scheduledTasks, completedTasks, appointments, getEnterprise]);

  // Tasks by priority
  const tasksByPriority = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const t of tasks.filter(t => t.status !== 'done')) {
      counts[t.priority]++;
    }
    return [
      { name: 'Alta', value: counts.high, color: 'hsl(0, 75%, 55%)' },
      { name: 'Media', value: counts.medium, color: 'hsl(38, 90%, 50%)' },
      { name: 'Bassa', value: counts.low, color: 'hsl(220, 10%, 70%)' },
    ].filter(d => d.value > 0);
  }, [tasks]);

  // Weekly activity (last 4 weeks) - tasks completed + appointments
  const weeklyActivity = useMemo(() => {
    const weeks: { label: string; tasks: number; appuntamenti: number }[] = [];
    const now = new Date();
    for (let i = 3; i >= 0; i--) {
      const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const we = addDays(ws, 6);
      const label = format(ws, 'd MMM', { locale: it });
      const weekTasks = completedTasks.filter(t => {
        if (!t.completedAt) return false;
        const d = new Date(t.completedAt);
        return d >= ws && d <= we;
      });
      const weekAppts = appointments.filter(a => {
        const d = new Date(a.date);
        return d >= ws && d <= we;
      });
      weeks.push({ label, tasks: weekTasks.length, appuntamenti: weekAppts.length });
    }
    return weeks;
  }, [completedTasks, appointments]);

  // Time by project type
  const timeByType = useMemo(() => {
    const map = { strategic: 0, operational: 0, maintenance: 0 };
    for (const t of [...scheduledTasks, ...completedTasks]) {
      const proj = projects.find(p => p.id === t.projectId);
      if (proj) map[proj.type] += t.estimatedMinutes;
    }
    return [
      { name: '🔵 Strategic', minutes: map.strategic, color: 'hsl(220, 80%, 55%)' },
      { name: '🟡 Operational', minutes: map.operational, color: 'hsl(38, 90%, 50%)' },
      { name: '⚪ Maintenance', minutes: map.maintenance, color: 'hsl(220, 10%, 70%)' },
    ].filter(d => d.minutes > 0);
  }, [scheduledTasks, completedTasks, projects]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 md:h-7 md:w-7" />
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Panoramica del tuo lavoro</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs font-medium">Completate</span>
          </div>
          <p className="text-2xl font-bold">{completedTasks.length}</p>
          <p className="text-xs text-muted-foreground">{formatMinutes(totalCompletedMinutes)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-medium">Pianificate</span>
          </div>
          <p className="text-2xl font-bold">{scheduledTasks.length}</p>
          <p className="text-xs text-muted-foreground">{formatMinutes(totalScheduledMinutes)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CalendarIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Appuntamenti</span>
          </div>
          <p className="text-2xl font-bold">{appointments.length}</p>
          <p className="text-xs text-muted-foreground">{formatMinutes(totalAppointmentMinutes)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-medium">Backlog</span>
          </div>
          <p className="text-2xl font-bold">{backlogTasks.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Building2 className="h-4 w-4" />
            <span className="text-xs font-medium">Imprese</span>
          </div>
          <p className="text-2xl font-bold">{enterprises.length}</p>
          <p className="text-xs text-muted-foreground">{projects.length} progetti</p>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Time by enterprise */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Tempo per Impresa</h3>
          {timeByEnterprise.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeByEnterprise} layout="vertical">
                <XAxis type="number" tickFormatter={(v) => formatMinutes(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMinutes(v)} />
                <Bar dataKey="minutes" radius={[0, 4, 4, 0]}>
                  {timeByEnterprise.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Priority distribution */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Distribuzione Priorità (attive)</h3>
          {tasksByPriority.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nessun dato</p>
          ) : (
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={tasksByPriority} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                    {tasksByPriority.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {tasksByPriority.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                {d.name}: {d.value}
              </div>
            ))}
          </div>
        </Card>

        {/* Weekly activity */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Attività Settimanale (ultime 4 settimane)</h3>
          {weeklyActivity.every(w => w.tasks === 0 && w.appuntamenti === 0) ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyActivity}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="tasks" fill="hsl(222, 60%, 25%)" radius={[4, 4, 0, 0]} name="Task completate" />
                <Bar dataKey="appuntamenti" fill="hsl(38, 90%, 50%)" radius={[4, 4, 0, 0]} name="Appuntamenti" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Time by project type */}
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">Tempo per Tipo Progetto</h3>
          {timeByType.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Nessun dato</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timeByType}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatMinutes(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatMinutes(v)} />
                <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                  {timeByType.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
