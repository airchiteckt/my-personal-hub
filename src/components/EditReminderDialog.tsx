import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';
import type { Reminder } from '@/types/prp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reminder: Reminder;
}

export function EditReminderDialog({ open, onOpenChange, reminder }: Props) {
  const { updateReminder, deleteReminder, enterprises, tasks } = usePrp();
  const [title, setTitle] = useState(reminder.title);
  const [description, setDescription] = useState(reminder.description || '');
  const [reminderDate, setReminderDate] = useState(reminder.reminderDate);
  const [reminderTime, setReminderTime] = useState(reminder.reminderTime || '');

  useEffect(() => {
    setTitle(reminder.title);
    setDescription(reminder.description || '');
    setReminderDate(reminder.reminderDate);
    setReminderTime(reminder.reminderTime || '');
  }, [reminder]);

  const linkedTask = reminder.taskId ? tasks.find(t => t.id === reminder.taskId) : null;
  const linkedEnterprise = reminder.enterpriseId ? enterprises.find(e => e.id === reminder.enterpriseId) : null;

  const handleSave = () => {
    if (!title.trim() || !reminderDate) return;
    updateReminder(reminder.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      reminderDate,
      reminderTime: reminderTime || undefined,
    });
    onOpenChange(false);
  };

  const handleDismiss = () => {
    updateReminder(reminder.id, { isDismissed: true });
    onOpenChange(false);
  };

  const handleDelete = () => {
    deleteReminder(reminder.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {reminder.isFollowUp ? '🔔 Promemoria Follow-up' : '🔔 Modifica Promemoria'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {linkedTask && (
            <div className="text-xs bg-accent/50 rounded-lg p-2.5 flex items-center gap-2">
              <span>📌 Collegato a:</span>
              <span className="font-medium">{linkedTask.title}</span>
            </div>
          )}
          {linkedEnterprise && (
            <div className="text-xs text-muted-foreground">
              Impresa: <span className="font-medium">{linkedEnterprise.name}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="resize-none" />
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
            <Button onClick={handleSave} className="flex-1" disabled={!title.trim() || !reminderDate}>Salva</Button>
            {!reminder.isDismissed && (
              <Button variant="outline" onClick={handleDismiss}>✅ Archivia</Button>
            )}
          </div>
          <Button variant="destructive" onClick={handleDelete} className="w-full">Elimina</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
