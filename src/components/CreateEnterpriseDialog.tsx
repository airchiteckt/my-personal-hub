import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ENTERPRISE_COLORS, ENTERPRISE_PHASE_LABELS, BUSINESS_CATEGORY_CONFIG, TIME_HORIZON_LABELS,
  EnterpriseStatus, EnterprisePhase, BusinessCategory, TimeHorizon,
} from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOTAL_STEPS = 3;

export function CreateEnterpriseDialog({ open, onOpenChange }: Props) {
  const { addEnterprise } = usePrp();
  const [step, setStep] = useState(0);

  // Step 0 - Identity
  const [name, setName] = useState('');
  const [status, setStatus] = useState<EnterpriseStatus>('development');
  const [color, setColor] = useState<string>(ENTERPRISE_COLORS[0].value);

  // Step 1 - Business Classification
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>('scale_opportunity');
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('medium');

  // Step 2 - Strategic Analysis
  const [strategicImportance, setStrategicImportance] = useState(3);
  const [growthPotential, setGrowthPotential] = useState(3);
  const [phase, setPhase] = useState<EnterprisePhase>('setup');
  const [priorityUntil, setPriorityUntil] = useState<Date | undefined>();

  const resetForm = () => {
    setStep(0); setName(''); setStatus('development');
    setColor(ENTERPRISE_COLORS[0].value);
    setBusinessCategory('scale_opportunity'); setTimeHorizon('medium');
    setStrategicImportance(3); setGrowthPotential(3);
    setPhase('setup'); setPriorityUntil(undefined);
  };

  // When category changes, auto-set strategic importance default
  const handleCategoryChange = (cat: BusinessCategory) => {
    setBusinessCategory(cat);
    setStrategicImportance(BUSINESS_CATEGORY_CONFIG[cat].defaultWeight);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    addEnterprise({
      name: name.trim(), status, color,
      strategicImportance, growthPotential, phase,
      businessCategory, timeHorizon,
      priorityUntil: priorityUntil ? format(priorityUntil, 'yyyy-MM-dd') : undefined,
    });
    resetForm();
    onOpenChange(false);
  };

  const importanceLabels = ['', 'Marginale', 'Bassa', 'Media', 'Alta', 'Priorità assoluta'];
  const growthLabels = ['', 'Stabile', 'Bassa crescita', 'Moderata', 'Buona', 'Forte espansione'];

  const stepTitles = ['Identità', 'Classificazione Business', 'Analisi Strategica'];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stepTitles[step]}</DialogTitle>
          <div className="flex gap-1.5 pt-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </DialogHeader>

        {/* STEP 0: Identity */}
        {step === 0 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome Impresa</Label>
              <Input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Nome impresa"
                onKeyDown={e => e.key === 'Enter' && name.trim() && setStep(1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={status} onValueChange={v => setStatus(v as EnterpriseStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">In sviluppo</SelectItem>
                  <SelectItem value="active">Attiva</SelectItem>
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
            <Button onClick={() => setStep(1)} className="w-full" disabled={!name.trim()}>
              Avanti <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP 1: Business Classification */}
        {step === 1 && (
          <div className="space-y-5 pt-2">
            <div className="space-y-3">
              <Label className="text-sm">🔮 Categoria Strategica</Label>
              <p className="text-[11px] text-muted-foreground">
                Che ruolo ha questo business nel tuo portfolio?
              </p>
              <div className="grid gap-2">
                {(Object.entries(BUSINESS_CATEGORY_CONFIG) as [BusinessCategory, typeof BUSINESS_CATEGORY_CONFIG[BusinessCategory]][]).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => handleCategoryChange(key)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      businessCategory === key
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-lg mt-0.5">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{cfg.label}</div>
                      <div className="text-[11px] text-muted-foreground">{cfg.description}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 shrink-0">
                      Peso: {cfg.defaultWeight}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">⏳ Orizzonte Temporale</Label>
              <p className="text-[11px] text-muted-foreground">
                In che orizzonte temporale vedi il massimo potenziale?
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TIME_HORIZON_LABELS) as [TimeHorizon, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTimeHorizon(key)}
                    className={cn(
                      "py-2 px-3 rounded-lg border text-sm font-medium transition-all text-center",
                      timeHorizon === key
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1">
                Avanti <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Strategic Analysis */}
        {step === 2 && (
          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">🎯 Importanza Strategica</Label>
              <p className="text-[11px] text-muted-foreground">
                Quanto è importante questa impresa per i prossimi 6 mesi?
              </p>
              <div className="flex items-center gap-3">
                <Slider
                  value={[strategicImportance]}
                  onValueChange={([v]) => setStrategicImportance(v)}
                  min={1} max={5} step={1} className="flex-1"
                />
                <span className="text-sm font-bold w-20 text-right">
                  {strategicImportance}/5 <span className="font-normal text-muted-foreground text-[10px]">{importanceLabels[strategicImportance]}</span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">📈 Potenziale di Crescita</Label>
              <p className="text-[11px] text-muted-foreground">
                Se investo tempo qui, quanto può crescere?
              </p>
              <div className="flex items-center gap-3">
                <Slider
                  value={[growthPotential]}
                  onValueChange={([v]) => setGrowthPotential(v)}
                  min={1} max={5} step={1} className="flex-1"
                />
                <span className="text-sm font-bold w-20 text-right">
                  {growthPotential}/5 <span className="font-normal text-muted-foreground text-[10px]">{growthLabels[growthPotential]}</span>
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">🔄 Fase Attuale</Label>
              <Select value={phase} onValueChange={v => setPhase(v as EnterprisePhase)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(ENTERPRISE_PHASE_LABELS) as [EnterprisePhase, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">⏰ Prioritaria fino a <span className="text-muted-foreground font-normal">(opzionale)</span></Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !priorityUntil && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {priorityUntil ? format(priorityUntil, 'PPP', { locale: it }) : 'Nessuna scadenza'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single" selected={priorityUntil} onSelect={setPriorityUntil}
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {priorityUntil && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setPriorityUntil(undefined)}>
                  Rimuovi data
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={handleSubmit} className="flex-1">
                Crea Impresa
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
