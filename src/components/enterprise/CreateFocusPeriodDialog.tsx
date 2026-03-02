import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import type { FocusPeriodStatus } from '@/types/prp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
}

export function CreateFocusPeriodDialog({ open, onOpenChange, enterpriseId }: Props) {
  const { addFocusPeriod } = usePrp();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<FocusPeriodStatus>('active');

  const handleSubmit = () => {
    if (!name.trim() || !startDate || !endDate) return;
    addFocusPeriod({ enterpriseId, name: name.trim(), startDate, endDate, status });
    setName(''); setStartDate(''); setEndDate('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuovo Focus Period</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input placeholder="es. Q2 2026 – Apertura" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Data inizio</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data fine</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Stato</Label>
            <Select value={status} onValueChange={v => setStatus(v as FocusPeriodStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">🟢 Attivo</SelectItem>
                <SelectItem value="future">🔵 Futuro</SelectItem>
                <SelectItem value="archived">📦 Archiviato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!name.trim() || !startDate || !endDate}>
            Crea Focus Period
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
