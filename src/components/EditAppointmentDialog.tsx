import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskDocumentEditor } from '@/components/TaskDocumentEditor';
import { usePrp } from '@/context/PrpContext';
import type { Appointment } from '@/types/prp';
import { CalendarClock, Pencil, Star, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
}

export function EditAppointmentDialog({ open, onOpenChange, appointment }: Props) {
  const { enterprises, updateAppointment, deleteAppointment } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [enterpriseId, setEnterpriseId] = useState<string>('none');
  const [isImportant, setIsImportant] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (open && appointment) {
      setTitle(appointment.title);
      setDescription(appointment.description || '');
      setDate(appointment.date);
      setStartTime(appointment.startTime);
      setEndTime(appointment.endTime);
      setEnterpriseId(appointment.enterpriseId || 'none');
      setIsImportant(!!appointment.isImportant);
      setEditing(false);
    }
  }, [open, appointment]);

  const doSave = useCallback(() => {
    if (!appointment || !title.trim()) return;
    updateAppointment(appointment.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime,
      endTime,
      enterpriseId: enterpriseId !== 'none' ? enterpriseId : undefined,
      isImportant,
    });
  }, [appointment, title, description, date, startTime, endTime, enterpriseId, isImportant, updateAppointment]);

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) doSave();
    onOpenChange(isOpen);
  };

  const handleDelete = () => {
    if (!appointment) return;
    if (!window.confirm('Eliminare definitivamente questo appuntamento? L\'azione non si può annullare.')) return;
    deleteAppointment(appointment.id);
    onOpenChange(false);
  };

  function addMins(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${(Math.floor(total / 60) % 24).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Modifica Appuntamento
          </DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4 pt-2">
          <TaskDocumentEditor title={title} onTitleChange={setTitle} notes={description} onNotesChange={setDescription} titlePlaceholder="Titolo dell'appuntamento" />

          {!editing ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-accent/30 px-2.5 py-2">
              <span className="text-[11px] text-muted-foreground">
                {date && new Date(`${date}T00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} · {startTime.slice(0, 5)}–{endTime.slice(0, 5)}
              </span>
              {enterpriseId !== 'none' && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${enterprises.find(e => e.id === enterpriseId)?.color})` }} />
                  {enterprises.find(e => e.id === enterpriseId)?.name}
                </span>
              )}
              {isImportant && <span className="flex items-center gap-1 text-[11px] font-medium text-foreground"><Star className="h-3 w-3" /> Importante</span>}
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto h-7 gap-1 px-2 text-[11px]">
                <Pencil className="h-3 w-3" /> Modifica
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-md border p-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Ora inizio</Label>
                  <Input type="time" value={startTime} onChange={e => { setStartTime(e.target.value); setEndTime(addMins(e.target.value, 60)); }} />
                </div>
                <div className="space-y-2">
                  <Label>Ora fine</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Impresa (opzionale)</Label>
                <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                  <SelectTrigger><SelectValue placeholder="Nessuna impresa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuna —</SelectItem>
                    {enterprises.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
                <Checkbox checked={isImportant} onCheckedChange={v => setIsImportant(v === true)} className="mt-0.5" />
                <span><span className="text-sm font-medium">Importante</span><span className="block text-xs text-muted-foreground">Radar ti chiama 5 minuti prima</span></span>
              </label>
              <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => { doSave(); setEditing(false); }}>Fatto</Button>
            </div>
          )}

          <div className="flex items-center border-t pt-3">
            <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Elimina appuntamento" title="Elimina appuntamento" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
