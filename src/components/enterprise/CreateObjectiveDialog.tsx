import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { usePrp } from '@/context/PrpContext';
import { useAiInline } from '@/hooks/use-ai-inline';
import { OkrValidationFeedback } from '@/components/OkrValidationFeedback';
import { Sparkles, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
  focusPeriodId: string;
}

export function CreateObjectiveDialog({ open, onOpenChange, enterpriseId, focusPeriodId }: Props) {
  const { addObjective, getEnterprise, getFocusPeriodsForEnterprise, getObjectivesForFocus } = usePrp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const enterprise = getEnterprise(enterpriseId);
  const focusPeriods = getFocusPeriodsForEnterprise(enterpriseId);
  const activeFocus = focusPeriods.find(f => f.id === focusPeriodId);
  const existingObjectives = getObjectivesForFocus(focusPeriodId);

  const { data: validation, loading: validating, debouncedFetch: fetchValidation, clear: clearValidation } = useAiInline<any>({
    type: 'validate_objective',
    debounceMs: 1200,
  });

  const { data: descSuggestion, loading: descLoading, debouncedFetch: fetchDesc, clear: clearDesc } = useAiInline<{ description: string }>({
    type: 'describe_objective',
    debounceMs: 1400,
  });

  useEffect(() => {
    if (title.trim().length >= 5 && enterprise) {
      const ctx = {
        enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory, phase: enterprise.phase },
        focusPeriod: activeFocus ? { name: activeFocus.name, startDate: activeFocus.startDate, endDate: activeFocus.endDate } : null,
        existingObjectives: existingObjectives.map(o => o.title),
      };
      fetchValidation(ctx, `Valida questo Objective: "${title.trim()}"`);
      fetchDesc(ctx, `Genera una descrizione breve (max 2 frasi) per questo Objective: "${title.trim()}". Spiega cosa significa raggiungere questo obiettivo in termini concreti per l'impresa.`);
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
    if (!title.trim() || !focusPeriodId) return;
    addObjective({ focusPeriodId, enterpriseId, title: title.trim(), description: description.trim() || undefined, weight: 1, status: 'active' });
    setTitle(''); setDescription(''); clearValidation(); clearDesc();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuovo Objective
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              <Sparkles className="h-3 w-3" /> AI Coach
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Titolo (qualitativo, no numeri)</Label>
            <Input 
              placeholder='es. "Trasformare l&apos;offerta da ipotesi a modello validato e scalabile"' 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Formula: "Portare [impresa] da [stato A] a [stato B]"
            </p>
          </div>

          <OkrValidationFeedback
            data={validation}
            loading={validating}
            type="objective"
            onApplySuggestion={(v) => setTitle(v)}
          />

          <div>
            <Label className="text-xs flex items-center gap-1.5">
              Descrizione
              {descLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            <Textarea
              placeholder="Cosa significa concretamente raggiungere questo obiettivo..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-16"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Chiarisce lo stato desiderato e il contesto strategico dell'obiettivo.
            </p>
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={!title.trim()}>
            Crea Objective
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
