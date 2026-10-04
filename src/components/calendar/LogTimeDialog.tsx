import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { usePrp } from '@/context/PrpContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date?: string;
  startTime?: string;
  endTime?: string;
}

const NONE = '__none__';

/** Registra tempo lavorato su un'impresa (e facoltativamente un progetto) senza creare una task. */
export function LogTimeDialog({ open, onOpenChange, date, startTime, endTime }: Props) {
  const { enterprises, projects, addTimeEntry } = usePrp();
  const [d, setD] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [projectId, setProjectId] = useState(NONE);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setD(date || format(new Date(), 'yyyy-MM-dd'));
    setStart(startTime || '09:00');
    setEnd(endTime || '10:00');
    setProjectId(NONE);
    setDescription('');
    setEnterpriseId(prev => prev || enterprises[0]?.id || '');
  }, [open, date, startTime, endTime, enterprises]);

  const entProjects = useMemo(() => projects.filter(p => p.enterpriseId === enterpriseId), [projects, enterpriseId]);

  const save = async () => {
    if (!enterpriseId) return toast.error("Scegli un'impresa");
    const s = new Date(`${d}T${start}:00`);
    const e = new Date(`${d}T${end}:00`);
    const mins = Math.round((e.getTime() - s.getTime()) / 60000);
    if (!(mins > 0)) return toast.error("L'ora di fine deve essere dopo l'inizio");
    setSaving(true);
    try {
      let pid = projectId !== NONE ? projectId : '';
      if (!pid) {
        const existing = entProjects.find(p => p.name.trim().toLowerCase() === 'altro');
        if (existing) pid = existing.id;
        else {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data, error } = await supabase.from('projects')
            .insert({ user_id: user.id, enterprise_id: enterpriseId, name: 'Altro', type: 'operational' })
            .select('id').single();
          if (error) throw error;
          pid = data.id;
        }
      }
      await addTimeEntry({
        enterpriseId, projectId: pid, taskId: undefined,
        description: description.trim() || 'Sessione di lavoro',
        startedAt: s.toISOString(), endedAt: e.toISOString(), durationMinutes: mins,
      } as any);
      toast.success(`Segnato: ${Math.floor(mins / 60) ? `${Math.floor(mins / 60)}h ` : ''}${mins % 60 ? `${mins % 60}m` : ''}`.trim());
      onOpenChange(false);
    } catch {
      toast.error('Non riesco a salvare il tempo lavorato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90dvh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-base">Tempo lavorato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            autoFocus
            placeholder="Cosa hai fatto?"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={2}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1"><Label className="text-xs">Giorno</Label><Input type="date" value={d} onChange={e => setD(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Dalle</Label><Input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Alle</Label><Input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Impresa</Label>
            <Select value={enterpriseId} onValueChange={v => { setEnterpriseId(v); setProjectId(NONE); }}>
              <SelectTrigger><SelectValue placeholder="Scegli impresa" /></SelectTrigger>
              <SelectContent>
                {enterprises.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Progetto (facoltativo)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nessuno (Altro)</SelectItem>
                {entProjects.filter(p => p.name.trim().toLowerCase() !== 'altro').map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button onClick={save} disabled={saving}>Salva</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
