import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProjectType } from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
}

export function CreateProjectDialog({ open, onOpenChange, enterpriseId }: Props) {
  const { addProject } = usePrp();
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('strategic');

  const handleSubmit = () => {
    if (!name.trim()) return;
    addProject({ name: name.trim(), type, enterpriseId });
    setName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo Progetto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome progetto" onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={v => setType(v as ProjectType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="strategic">🔵 Strategic</SelectItem>
                <SelectItem value="operational">🟡 Operational</SelectItem>
                <SelectItem value="maintenance">⚪ Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSubmit} className="w-full">Crea Progetto</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
