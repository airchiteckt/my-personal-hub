import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  defaultEndTime?: string;
}

export function CalendarCreateTaskDialog({ open, onOpenChange, defaultDate, defaultTime, defaultEndTime }: Props) {
  const { enterprises, projects, addTask } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [schedDate, setSchedDate] = useState(defaultDate || '');
  const [schedTime, setSchedTime] = useState(defaultTime || '');

  const activeEnterprises = enterprises.filter(e => e.status !== 'paused');
  const availableProjects = projects.filter(p => p.enterpriseId === enterpriseId);

  // Sync defaults when dialog opens
  useEffect(() => {
    if (open) {
      setSchedDate(defaultDate || new Date().toISOString().split('T')[0]);
      setSchedTime(defaultTime || '09:00');
      if (defaultTime && defaultEndTime) {
        const [sh, sm] = defaultTime.split(':').map(Number);
        const [eh, em] = defaultEndTime.split(':').map(Number);
        let mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins <= 0) mins += 24 * 60;
        if (mins > 0) setEstimatedMinutes(mins);
      } else {
        setEstimatedMinutes(30);
      }
    }
  }, [open, defaultDate, defaultTime, defaultEndTime]);

  // Auto-select first enterprise/project
  useEffect(() => {
    if (open && !enterpriseId && activeEnterprises.length > 0) {
      setEnterpriseId(activeEnterprises[0].id);
    }
  }, [open, activeEnterprises]);

  useEffect(() => {
    if (enterpriseId && availableProjects.length > 0 && !availableProjects.find(p => p.id === projectId)) {
      setProjectId(availableProjects[0].id);
    }
  }, [enterpriseId, availableProjects]);

  const handleCreateAndSchedule = () => {
    if (!title.trim() || !enterpriseId || !projectId) return;

    addTask({
      title: title.trim(),
      description: description.trim() || undefined,
      estimatedMinutes,
      priority,
      enterpriseId,
      projectId,
      isRecurring: false,
      scheduledDate: schedDate || undefined,
      scheduledTime: schedTime || undefined,
    });

    setTitle('');
    setDescription('');
    setEstimatedMinutes(30);
    setPriority('medium');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuova Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Descrivi la task"
              onKeyDown={e => e.key === 'Enter' && handleCreateAndSchedule()}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Note, dettagli, contesto..." rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Impresa</Label>
              <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {activeEnterprises.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${e.color})` }} />
                        {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progetto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                <SelectContent>
                  {availableProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ora inizio</Label>
              <Input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Durata (minuti)</Label>
              <Input type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(Number(e.target.value))} min={5} step={5} />
            </div>
            <div className="space-y-2">
              <Label>Priorità</Label>
              <Select value={priority} onValueChange={v => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">🔴 Alta</SelectItem>
                  <SelectItem value="medium">🟡 Media</SelectItem>
                  <SelectItem value="low">⚪ Bassa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCreateAndSchedule} className="w-full" disabled={!title.trim() || !enterpriseId || !projectId}>
            Crea e Pianifica
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
