import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';
import { CalendarClock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultTime?: string;
}

export function CreateAppointmentDialog({ open, onOpenChange, defaultDate, defaultTime }: Props) {
  const { enterprises, addAppointment } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(defaultTime || '09:00');
  const [endTime, setEndTime] = useState(defaultTime ? addMinutes(defaultTime, 60) : '10:00');
  const [enterpriseId, setEnterpriseId] = useState<string>('none');

  function addMinutes(time: string, mins: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}`;
  }

  const handleSubmit = () => {
    if (!title.trim() || !date || !startTime || !endTime) return;
    addAppointment({
      title: title.trim(),
      description: description.trim() || undefined,
      date,
      startTime,
      endTime,
      enterpriseId: enterpriseId !== 'none' ? enterpriseId : undefined,
    });
    setTitle('');
    setDescription('');
    setEnterpriseId('none');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Nuovo Appuntamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Titolo</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Es. Call con cliente, Riunione team..."
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrizione (opzionale)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Note aggiuntive..."
              rows={2}
            />
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
                // Auto-update end time to +1h
                setEndTime(addMinutes(e.target.value, 60));
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
                      <span
                        className="h-2.5 w-2.5 rounded-full inline-block"
                        style={{ backgroundColor: `hsl(${e.color})` }}
                      />
                      {e.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} className="w-full">Crea Appuntamento</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
