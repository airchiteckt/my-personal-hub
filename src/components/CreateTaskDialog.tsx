import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskPriority } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  projectId: string;
}

export function CreateTaskDialog({ open, onOpenChange, enterpriseId, projectId }: Props) {
  const { addTask, prioritySettings } = usePrp();
  const [title, setTitle] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [deadline, setDeadline] = useState('');
  const [impact, setImpact] = useState(2);
  const [effort, setEffort] = useState(2);

  const handleSubmit = () => {
    if (!title.trim() || !projectId) return;
    addTask({
      title: title.trim(),
      estimatedMinutes,
      priority,
      enterpriseId,
      projectId,
      isRecurring: false,
      ...(deadline ? { deadline } : {}),
      ...(prioritySettings.impactEffortEnabled ? { impact, effort } : {}),
    });
    setTitle('');
    setEstimatedMinutes(30);
    setDeadline('');
    setImpact(2);
    setEffort(2);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Descrivi la task" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
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

          <div className="space-y-2">
            <Label>Deadline (opzionale)</Label>
            <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>

          {prioritySettings.impactEffortEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Impatto (1-3)</Label>
                <Select value={String(impact)} onValueChange={v => setImpact(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 – Basso</SelectItem>
                    <SelectItem value="2">2 – Medio</SelectItem>
                    <SelectItem value="3">3 – Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sforzo (1-3)</Label>
                <Select value={String(effort)} onValueChange={v => setEffort(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 – Basso</SelectItem>
                    <SelectItem value="2">2 – Medio</SelectItem>
                    <SelectItem value="3">3 – Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={handleSubmit} className="w-full">Crea Task</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
