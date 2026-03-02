import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { usePrp } from '@/context/PrpContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  focusPeriodId: string;
}

export function CreateObjectiveDialog({ open, onOpenChange, enterpriseId, focusPeriodId }: Props) {
  const { addObjective } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !focusPeriodId) return;
    addObjective({ focusPeriodId, enterpriseId, title: title.trim(), description: description.trim() || undefined, weight: 1, status: 'active' });
    setTitle(''); setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuovo Objective</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Titolo (qualitativo)</Label>
            <Input placeholder="es. Aprire locale sostenibile" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Descrizione (opzionale)</Label>
            <Textarea placeholder="Descrivi l'obiettivo..." value={description} onChange={e => setDescription(e.target.value)} className="h-16" />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!title.trim()}>
            Crea Objective
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
