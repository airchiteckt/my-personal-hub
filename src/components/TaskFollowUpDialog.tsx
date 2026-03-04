import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';
import { format, addDays } from 'date-fns';
import type { Task } from '@/types/prp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
}

export function TaskFollowUpDialog({ open, onOpenChange, task }: Props) {
  const { addReminder } = usePrp();
  const [title, setTitle] = useState(`Follow-up: ${task.title}`);
  const [reminderDate, setReminderDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [reminderTime, setReminderTime] = useState('09:00');

  const handleCreate = () => {
    if (!title.trim() || !reminderDate) return;
    addReminder({
      title: title.trim(),
      description: `Follow-up automatico della task "${task.title}"`,
      reminderDate,
      reminderTime: reminderTime || undefined,
      enterpriseId: task.enterpriseId,
      taskId: task.id,
      isFollowUp: true,
      isDismissed: false,
      color: undefined,
    });
    onOpenChange(false);
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🔔 Creare un promemoria di follow-up?</DialogTitle>
          <DialogDescription>
            La task <span className="font-semibold">"{task.title}"</span> è stata completata. Vuoi impostare un promemoria per il follow-up?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo promemoria</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ora</Label>
              <Input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="flex-1" disabled={!title.trim() || !reminderDate}>
              🔔 Crea Promemoria
            </Button>
            <Button variant="outline" onClick={handleSkip}>
              Salta
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
