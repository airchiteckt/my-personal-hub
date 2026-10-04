import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskDocumentEditor } from '@/components/TaskDocumentEditor';
import { usePrp } from '@/context/PrpContext';
import { useCallback, useState, useEffect } from 'react';
import type { Reminder } from '@/types/prp';
import { Archive, Bell, Pencil, Phone, Trash2 } from 'lucide-react';

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
  const [isUrgent, setIsUrgent] = useState(reminder.isUrgent ?? false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setTitle(reminder.title);
    setDescription(reminder.description || '');
    setReminderDate(reminder.reminderDate);
    setReminderTime(reminder.reminderTime || '');
    setIsUrgent(reminder.isUrgent ?? false);
    setEditing(false);
  }, [reminder]);

  const linkedTask = reminder.taskId ? tasks.find(t => t.id === reminder.taskId) : null;
  const linkedEnterprise = reminder.enterpriseId ? enterprises.find(e => e.id === reminder.enterpriseId) : null;

  const doSave = useCallback(() => {
    if (!title.trim() || !reminderDate) return;
    updateReminder(reminder.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      reminderDate,
      reminderTime: reminderTime || undefined,
      isUrgent,
    });
  }, [title, reminderDate, reminderTime, description, isUrgent, reminder.id, updateReminder]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) doSave();
    onOpenChange(isOpen);
  };

  const handleDismiss = () => {
    updateReminder(reminder.id, { isDismissed: true });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!window.confirm('Eliminare definitivamente questo promemoria? L\'azione non si può annullare.')) return;
    deleteReminder(reminder.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {reminder.isFollowUp ? '🔔 Promemoria Follow-up' : '🔔 Modifica Promemoria'}
          </DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 pt-2">
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

          <TaskDocumentEditor title={title} onTitleChange={setTitle} notes={description} onNotesChange={setDescription} titlePlaceholder="Cosa vuoi ricordare?" />

          {!editing ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-accent/30 px-2.5 py-2">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Bell className="h-3 w-3" />
                {new Date(`${reminderDate}T00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}{reminderTime ? ` · ${reminderTime.slice(0, 5)}` : ''}
              </span>
              {isUrgent && <span className="flex items-center gap-1 text-[11px] font-medium text-foreground"><Phone className="h-3 w-3" /> Chiamata vocale</span>}
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto h-7 gap-1 px-2 text-[11px]">
                <Pencil className="h-3 w-3" /> Modifica
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-md border p-3">
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
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                <Checkbox checked={isUrgent} onCheckedChange={v => setIsUrgent(v === true)} className="mt-0.5" />
                <span><span className="text-sm font-medium">Importante — chiamata vocale</span><span className="text-xs text-muted-foreground block mt-0.5">Radar ti telefona all'orario del promemoria.</span></span>
              </label>
              <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => { doSave(); setEditing(false); }}>Fatto</Button>
            </div>
          )}

          <div className="flex items-center gap-1.5 border-t pt-3">
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Elimina promemoria" title="Elimina promemoria" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
            {!reminder.isDismissed && (
              <Button className="ml-auto gap-1.5" size="sm" onClick={handleDismiss}><Archive className="h-3.5 w-3.5" /> Archivia</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
