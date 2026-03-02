import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import type { MetricType } from '@/types/prp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  objectiveId: string;
}

export function CreateKeyResultDialog({ open, onOpenChange, enterpriseId, objectiveId }: Props) {
  const { addKeyResult } = usePrp();
  const [title, setTitle] = useState('');
  const [targetValue, setTargetValue] = useState('100');
  const [metricType, setMetricType] = useState<MetricType>('percentage');
  const [deadline, setDeadline] = useState('');

  const handleSubmit = () => {
    if (!title.trim() || !objectiveId) return;
    addKeyResult({
      objectiveId, enterpriseId, title: title.trim(),
      targetValue: metricType === 'boolean' ? 1 : Number(targetValue) || 100,
      currentValue: 0, metricType,
      deadline: deadline || undefined,
      status: 'active',
    });
    setTitle(''); setTargetValue('100'); setDeadline('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuovo Key Result</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Titolo</Label>
            <Input placeholder="es. Firmare contratto entro maggio" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Tipo metrica</Label>
            <Select value={metricType} onValueChange={v => setMetricType(v as MetricType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentuale (%)</SelectItem>
                <SelectItem value="number">Numero</SelectItem>
                <SelectItem value="boolean">Sì/No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {metricType !== 'boolean' && (
            <div>
              <Label className="text-xs">Target</Label>
              <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
            </div>
          )}
          <div>
            <Label className="text-xs">Deadline (opzionale)</Label>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!title.trim()}>
            Crea Key Result
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
