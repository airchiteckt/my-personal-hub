import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
  taskId?: string;
  enterpriseId?: string;
  isFollowUp?: boolean;
  defaultTitle?: string;
}

export function CreateReminderDialog({ open, onOpenChange, defaultDate, defaultTime, taskId, enterpriseId, isFollowUp, defaultTitle }: Props) {
  const { addReminder, enterprises } = usePrp();
  const [title, setTitle] = useState(defaultTitle || '');
  const [description, setDescription] = useState('');
  const [reminderDate, setReminderDate] = useState(defaultDate || '');
  const [reminderTime, setReminderTime] = useState(defaultTime || '09:00');
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState(enterpriseId || '');

  const handleSave = () => {
    if (!title.trim() || !reminderDate) return;
    addReminder({
      title: title.trim(),
      description: description.trim() || undefined,
      reminderDate,
      reminderTime: reminderTime || undefined,
      enterpriseId: selectedEnterpriseId || undefined,
      taskId: taskId || undefined,
      isFollowUp: isFollowUp || false,
      isDismissed: false,
      color: undefined,
    });
    onOpenChange(false);
    setTitle('');
    setDescription('');
    setReminderDate('');
    setReminderTime('09:00');
    setSelectedEnterpriseId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isFollowUp ? '🔔 Promemoria Follow-up' : '🔔 Nuovo Promemoria'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Es: Richiamare cliente, Verificare consegna..."
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrizione <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Note aggiuntive..." rows={2} className="resize-none" />
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

          {!enterpriseId && (
            <div className="space-y-2">
              <Label>Impresa <span className="text-muted-foreground text-xs font-normal">(opzionale)</span></Label>
              <Select value={selectedEnterpriseId || "none"} onValueChange={v => setSelectedEnterpriseId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nessuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna</SelectItem>
                  {enterprises.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} className="w-full" disabled={!title.trim() || !reminderDate}>
            {isFollowUp ? 'Crea Promemoria Follow-up' : 'Crea Promemoria'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
