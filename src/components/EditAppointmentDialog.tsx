import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import type { Appointment } from '@/types/prp';
import { CalendarClock, Trash2 } from 'lucide-react';

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

  useEffect(() => {
    if (open && appointment) {
      setTitle(appointment.title);
      setDescription(appointment.description || '');
      setDate(appointment.date);
      setStartTime(appointment.startTime);
      setEndTime(appointment.endTime);
      setEnterpriseId(appointment.enterpriseId || 'none');
    }
  }, [open, appointment]);

  const handleSave = () => {
    if (!appointment || !title.trim()) return;
    updateAppointment(appointment.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime,
      endTime,
      enterpriseId: enterpriseId !== 'none' ? enterpriseId : undefined,
    });
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!appointment) return;
    deleteAppointment(appointment.id);
    onOpenChange(false);
  };

  function addMins(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${(Math.floor(total / 60) % 24).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Modifica Appuntamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} />
          </div>

          <div className="space-y-2">
            <Label>Descrizione (opzionale)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ora inizio</Label>
              <Input type="time" value={startTime} onChange={e => {
                setStartTime(e.target.value);
                setEndTime(addMins(e.target.value, 60));
              }} />
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
                {enterprises.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: `hsl(${e.color})` }} />
                      {e.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1">Salva</Button>
            <Button variant="destructive" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
