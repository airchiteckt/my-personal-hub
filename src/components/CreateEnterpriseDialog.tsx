import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ENTERPRISE_COLORS, EnterpriseStatus } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEnterpriseDialog({ open, onOpenChange }: Props) {
  const { addEnterprise } = usePrp();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<EnterpriseStatus>('active');
  const [color, setColor] = useState<string>(ENTERPRISE_COLORS[0].value);

  const handleSubmit = () => {
    if (!name.trim()) return;
    addEnterprise({ name: name.trim(), status, color });
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova Impresa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome impresa" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div className="space-y-2">
            <Label>Stato</Label>
            <Select value={status} onValueChange={v => setStatus(v as EnterpriseStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Attiva</SelectItem>
                <SelectItem value="development">In sviluppo</SelectItem>
                <SelectItem value="paused">In pausa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Colore</Label>
            <div className="flex gap-2 mt-1">
              {ENTERPRISE_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full transition-all ${color === c.value ? 'ring-2 ring-foreground ring-offset-2 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: `hsl(${c.value})` }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <Button onClick={handleSubmit} className="w-full">Crea Impresa</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
