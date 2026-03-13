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
import { Sparkles, Loader2 } from 'lucide-react';
import type { FocusPeriodStatus } from '@/types/prp';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterpriseId: string;
}

export function CreateFocusPeriodDialog({ open, onOpenChange, enterpriseId }: Props) {
  const { addFocusPeriod, getEnterprise, getFocusPeriodsForEnterprise } = usePrp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<FocusPeriodStatus>('active');

  const enterprise = getEnterprise(enterpriseId);
  const existingFocus = getFocusPeriodsForEnterprise(enterpriseId);

  const { data: suggestion, loading: suggesting, debouncedFetch: fetchSuggestion, clear: clearSuggestion } = useAiInline<{ description: string }>({
    type: 'describe_focus',
    debounceMs: 1200,
  });

  useEffect(() => {
    if (name.trim().length >= 5 && enterprise) {
      fetchSuggestion(
        {
          enterprise: { name: enterprise.name, businessCategory: enterprise.businessCategory, phase: enterprise.phase },
          existingFocus: existingFocus.map(f => f.name),
          startDate, endDate,
        },
        `Genera una descrizione breve (max 2 frasi) per questo Focus Period: "${name.trim()}". La descrizione deve chiarire la direzione strategica e il risultato atteso entro fine periodo.`
      );
    } else {
      clearSuggestion();
    }
  }, [name]);

  // Auto-fill description from AI
  useEffect(() => {
    if (suggestion?.description && !description.trim()) {
      setDescription(suggestion.description);
    }
  }, [suggestion]);

  const handleSubmit = () => {
    if (!name.trim() || !startDate || !endDate) return;
    addFocusPeriod({ enterpriseId, name: name.trim(), description: description.trim() || undefined, startDate, endDate, status });
    setName(''); setDescription(''); setStartDate(''); setEndDate(''); clearSuggestion();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Nuovo Focus Period
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              <Sparkles className="h-3 w-3" /> AI
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input placeholder="es. Q2 2026 – Apertura" value={name} onChange={e => setName(e.target.value)} />
            <p className="text-[10px] text-muted-foreground mt-1">
              Formula: "Q[N] [ANNO] – [Tema trasformativo]"
            </p>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1.5">
              Descrizione
              {suggesting && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            <Textarea
              placeholder="Direzione strategica e risultato atteso..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="h-16"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Descrive la direzione strategica del trimestre e il risultato principale atteso.
            </p>
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
