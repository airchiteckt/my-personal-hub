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
  const { addTask } = usePrp();
  const [title, setTitle] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleSubmit = () => {
    if (!title.trim() || !projectId) return;
    addTask({ title: title.trim(), estimatedMinutes, priority, enterpriseId, projectId, isRecurring: false });
    setTitle('');
    setEstimatedMinutes(30);
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
          <div className="space-y-2">
            <Label>Durata stimata (minuti)</Label>
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
          <Button onClick={handleSubmit} className="w-full">Crea Task</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
