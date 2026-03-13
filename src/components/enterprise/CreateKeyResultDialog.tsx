import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePrp } from '@/context/PrpContext';
import { useAiInline } from '@/hooks/use-ai-inline';
import { OkrValidationFeedback } from '@/components/OkrValidationFeedback';
import { Sparkles, Loader2 } from 'lucide-react';
import type { MetricType } from '@/types/prp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  objectiveId: string;
}

export function CreateKeyResultDialog({ open, onOpenChange, enterpriseId, objectiveId }: Props) {
  const { addKeyResult, getEnterprise, getKeyResultsForObjective, getObjectivesForFocus, getFocusPeriodsForEnterprise } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('100');
  const [metricType, setMetricType] = useState<MetricType>('percentage');
  const [deadline, setDeadline] = useState('');

  const enterprise = getEnterprise(enterpriseId);
  const existingKRs = getKeyResultsForObjective(objectiveId);

  const focusPeriods = getFocusPeriodsForEnterprise(enterpriseId);
  const objectiveTitle = focusPeriods
    .flatMap(fp => getObjectivesForFocus(fp.id))
    .find(o => o.id === objectiveId)?.title || '';

  const { data: validation, loading: validating, debouncedFetch: fetchValidation, clear: clearValidation } = useAiInline<any>({
    type: 'validate_key_result',
    debounceMs: 1200,
  });

  const { data: descSuggestion, loading: descLoading, debouncedFetch: fetchDesc, clear: clearDesc } = useAiInline<{ description: string }>({
    type: 'describe_key_result',
    debounceMs: 1400,
  });

  useEffect(() => {
    if (title.trim().length >= 5 && enterprise) {
      const ctx = {
        enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory, phase: enterprise.phase },
        objective: objectiveTitle,
        existingKRs: existingKRs.map(kr => kr.title),
      };
      fetchValidation(ctx, `Valida questo Key Result per l'Objective "${objectiveTitle}": "${title.trim()}"`);
      fetchDesc(ctx, `Genera una descrizione breve (max 2 frasi) per questo Key Result: "${title.trim()}". Spiega come si misura, la fonte dati e perché questo numero è significativo per l'Objective "${objectiveTitle}".`);
    } else {
      clearValidation();
      clearDesc();
    }
  }, [title]);

  // Auto-fill description from AI
  useEffect(() => {
    if (descSuggestion?.description && !description.trim()) {
      setDescription(descSuggestion.description);
    }
  }, [descSuggestion]);

  const handleSubmit = () => {
    if (!title.trim() || !objectiveId) return;
    addKeyResult({
      objectiveId, enterpriseId, title: title.trim(),
      description: description.trim() || undefined,
      targetValue: metricType === 'boolean' ? 1 : Number(targetValue) || 100,
      currentValue: 0, metricType,
      deadline: deadline || undefined,
      status: 'active',
    });
    setTitle(''); setDescription(''); setTargetValue('100'); setDeadline(''); clearValidation(); clearDesc();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuovo Key Result
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              <Sparkles className="h-3 w-3" /> AI Coach
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {objectiveTitle && (
            <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-2">
              🎯 Objective: <span className="font-medium text-foreground">{objectiveTitle}</span>
            </div>
          )}

          <div>
            <Label className="text-xs">Titolo (numerico, misurabile)</Label>
            <Input 
              placeholder='es. "Generare almeno 50 lead qualificati"' 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Inizia con: Raggiungere, Ottenere, Generare, Ridurre, Aumentare...
            </p>
          </div>

          <OkrValidationFeedback
            data={validation}
            loading={validating}
            type="key_result"
            onApplySuggestion={(v) => setTitle(v)}
          />

          <div>
            <Label className="text-xs flex items-center gap-1.5">
              Descrizione
              {descLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            <Textarea
              placeholder="Come si misura, fonte dati, perché è significativo..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-16"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Definisce come si misura il KR, la fonte dati e il razionale del target.
            </p>
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
