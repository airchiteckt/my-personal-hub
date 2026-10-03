import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePrp } from '@/context/PrpContext';
import type { Task } from '@/types/prp';

const toMin = (t?: string) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ceil5 = (m: number) => Math.ceil(m / 5) * 5;

/**
 * Tracking del lavoro reale su una task (Play / Pausa / Completa).
 * La sessione aperta è la time_entry con ended_at nullo.
 * Con `ripple` attivo, le task successive di oggi slittano in avanti mentre la sessione supera lo slot previsto.
 */
export function useTaskTimer({ ripple = false }: { ripple?: boolean } = {}) {
  const { timeEntries, tasks, updateTask, completeTask, getAppointmentsForDate } = usePrp();
  const [now, setNow] = useState(() => Date.now());
  const busy = useRef(false);

  const active = timeEntries.find(te => !te.endedAt && te.taskId) ?? null;

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [active?.id]);

  const close = useCallback(async (entryId: string, startedAt: string) => {
    const end = new Date();
    const mins = Math.max(1, Math.round((end.getTime() - new Date(startedAt).getTime()) / 60000));
    await supabase.from('time_entries').update({ ended_at: end.toISOString(), duration_minutes: mins }).eq('id', entryId);
  }, []);

  const start = useCallback(async (task: Task) => {
    if (busy.current) return;
    busy.current = true;
    try {
      if (active) await close(active.id, active.startedAt);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('time_entries').insert({
        user_id: user.id, task_id: task.id, project_id: task.projectId,
        enterprise_id: task.enterpriseId, description: task.title,
        started_at: new Date().toISOString(),
      });
      if (error) toast.error('Non riesco ad avviare il tracciamento');
      else toast.success(`In corso: ${task.title}`);
    } finally { busy.current = false; }
  }, [active, close]);

  const pause = useCallback(async () => {
    if (!active || busy.current) return;
    busy.current = true;
    try { await close(active.id, active.startedAt); toast('Sessione in pausa'); }
    finally { busy.current = false; }
  }, [active, close]);

  const complete = useCallback(async (task: Task) => {
    if (active?.taskId === task.id) await close(active.id, active.startedAt);
    completeTask(task.id);
  }, [active, close, completeTask]);

  // Slittamento a cascata delle task successive di oggi
  useEffect(() => {
    if (!ripple || !active) return;
    const task = tasks.find(t => t.id === active.taskId);
    const today = format(new Date(), 'yyyy-MM-dd');
    if (!task || task.scheduledDate !== today || !task.scheduledTime) return;
    const d = new Date(now);
    const nowMin = d.getHours() * 60 + d.getMinutes();
    const plannedStart = toMin(task.scheduledTime);
    let cursor = Math.max(plannedStart + task.estimatedMinutes, ceil5(nowMin));
    if (nowMin <= plannedStart + task.estimatedMinutes) return;

    const blocks = getAppointmentsForDate(today).map(a => [toMin(a.startTime), toMin(a.endTime)] as const);
    const next = tasks
      .filter(t => t.id !== task.id && t.status === 'scheduled' && t.scheduledDate === today && t.scheduledTime && toMin(t.scheduledTime) >= plannedStart)
      .sort((a, b) => toMin(a.scheduledTime) - toMin(b.scheduledTime));

    for (const t of next) {
      const s = toMin(t.scheduledTime);
      if (s >= cursor) break; // nessuna sovrapposizione: il resto della giornata resta com'è
      let ns = cursor;
      for (const [as, ae] of blocks) if (ns < ae && ns + t.estimatedMinutes > as) ns = ae;
      if (ns + t.estimatedMinutes > 24 * 60) break;
      if (ns !== s) updateTask(t.id, { scheduledTime: fromMin(ns) });
      cursor = ns + t.estimatedMinutes;
    }
  }, [ripple, active?.id, active?.taskId, now, tasks, getAppointmentsForDate, updateTask]);

  const elapsedMin = active ? Math.max(0, Math.round((now - new Date(active.startedAt).getTime()) / 60000)) : 0;

  return { active, activeTaskId: active?.taskId ?? null, elapsedMin, now, start, pause, complete };
}
