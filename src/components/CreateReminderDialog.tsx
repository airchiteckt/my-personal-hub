import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskDocumentEditor } from '@/components/TaskDocumentEditor';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';

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
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle || '');
      setDescription('');
      setReminderDate(defaultDate || '');
      setReminderTime(defaultTime || '09:00');
      setSelectedEnterpriseId(enterpriseId || '');
      setIsUrgent(false);
    }
  }, [open, defaultDate, defaultTime, defaultTitle, enterpriseId]);

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
      isUrgent,
      color: undefined,
    });
    onOpenChange(false);
    setTitle('');
    setDescription('');
    setReminderDate('');
    setReminderTime('09:00');
    setSelectedEnterpriseId('');
    setIsUrgent(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{isFollowUp ? '🔔 Promemoria Follow-up' : '🔔 Nuovo Promemoria'}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 pt-2">
          <TaskDocumentEditor
            title={title}
            onTitleChange={setTitle}
            notes={description}
            onNotesChange={setDescription}
            onSubmit={handleSave}
            autoFocus
            titlePlaceholder="Cosa vuoi ricordare?"
          />

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

          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <Checkbox checked={isUrgent} onCheckedChange={v => setIsUrgent(v === true)} className="mt-0.5" />
            <span>
              <span className="text-sm font-medium flex items-center gap-1.5">⭐ Importante — chiamata vocale</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                Oltre a Telegram ed email, Radar ti telefona all'orario del promemoria (serve il numero di cellulare nel profilo).
              </span>
            </span>
          </label>

          <Button onClick={handleSave} className="w-full" disabled={!title.trim() || !reminderDate}>
            {isFollowUp ? 'Crea Promemoria Follow-up' : 'Crea Promemoria'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
