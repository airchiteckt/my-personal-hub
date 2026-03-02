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
  ENTERPRISE_TEMPLATES,
  EnterpriseStatus, EnterprisePhase, BusinessCategory, TimeHorizon, EnterpriseTemplateType,
  Enterprise,
} from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterprise: Enterprise;
}

export function EditEnterpriseDialog({ open, onOpenChange, enterprise }: Props) {
  const { updateEnterprise } = usePrp();

  const [name, setName] = useState(enterprise.name);
  const [status, setStatus] = useState<EnterpriseStatus>(enterprise.status);
  const [color, setColor] = useState(enterprise.color);
  const [templateType, setTemplateType] = useState<EnterpriseTemplateType>(enterprise.enterpriseType);
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>(enterprise.businessCategory);
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>(enterprise.timeHorizon);
  const [strategicImportance, setStrategicImportance] = useState(enterprise.strategicImportance);
  const [growthPotential, setGrowthPotential] = useState(enterprise.growthPotential);
  const [phase, setPhase] = useState<EnterprisePhase>(enterprise.phase);
  const [priorityUntil, setPriorityUntil] = useState<Date | undefined>(
    enterprise.priorityUntil ? parseISO(enterprise.priorityUntil) : undefined
  );

  useEffect(() => {
    setName(enterprise.name);
    setStatus(enterprise.status);
    setColor(enterprise.color);
    setTemplateType(enterprise.enterpriseType);
    setBusinessCategory(enterprise.businessCategory);
    setTimeHorizon(enterprise.timeHorizon);
    setStrategicImportance(enterprise.strategicImportance);
    setGrowthPotential(enterprise.growthPotential);
    setPhase(enterprise.phase);
    setPriorityUntil(enterprise.priorityUntil ? parseISO(enterprise.priorityUntil) : undefined);
  }, [enterprise]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    updateEnterprise(enterprise.id, {
      name: name.trim(), status, color,
      strategicImportance, growthPotential, phase,
      businessCategory, timeHorizon,
      enterpriseType: templateType,
      priorityUntil: priorityUntil ? format(priorityUntil, 'yyyy-MM-dd') : undefined,
    });
    toast.success('Impresa aggiornata');
    onOpenChange(false);
  };

  const importanceLabels = ['', 'Marginale', 'Bassa', 'Media', 'Alta', 'Priorità assoluta'];
  const growthLabels = ['', 'Stabile', 'Bassa crescita', 'Moderata', 'Buona', 'Forte espansione'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Impresa</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>Nome Impresa</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          {/* Color */}
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

          {/* Status */}
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

          {/* Enterprise Type */}
          <div className="space-y-2">
            <Label className="text-sm">🧩 Tipo Impresa</Label>
            <div className="grid gap-1.5">
              {(Object.entries(ENTERPRISE_TEMPLATES) as [EnterpriseTemplateType, typeof ENTERPRISE_TEMPLATES[EnterpriseTemplateType]][]).map(([key, tmpl]) => (
                <button
                  key={key}
                  onClick={() => setTemplateType(key)}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                    templateType === key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-base">{tmpl.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{tmpl.label}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Business Category */}
          <div className="space-y-2">
            <Label className="text-sm">🔮 Categoria Strategica</Label>
            <div className="grid gap-1.5">
              {(Object.entries(BUSINESS_CATEGORY_CONFIG) as [BusinessCategory, typeof BUSINESS_CATEGORY_CONFIG[BusinessCategory]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setBusinessCategory(key); setStrategicImportance(cfg.defaultWeight); }}
                  className={cn(
                    "flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all",
                    businessCategory === key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="text-base">{cfg.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{cfg.label}</div>
                    <div className="text-[10px] text-muted-foreground">{cfg.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Time Horizon */}
          <div className="space-y-2">
            <Label className="text-sm">⏳ Orizzonte Temporale</Label>
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

          {/* Strategic Importance */}
          <div className="space-y-2">
            <Label className="text-sm">🎯 Importanza Strategica</Label>
            <div className="flex items-center gap-3">
              <Slider value={[strategicImportance]} onValueChange={([v]) => setStrategicImportance(v)} min={1} max={5} step={1} className="flex-1" />
              <span className="text-sm font-bold w-20 text-right">
                {strategicImportance}/5 <span className="font-normal text-muted-foreground text-[10px]">{importanceLabels[strategicImportance]}</span>
              </span>
            </div>
          </div>

          {/* Growth Potential */}
          <div className="space-y-2">
            <Label className="text-sm">📈 Potenziale di Crescita</Label>
            <div className="flex items-center gap-3">
              <Slider value={[growthPotential]} onValueChange={([v]) => setGrowthPotential(v)} min={1} max={5} step={1} className="flex-1" />
              <span className="text-sm font-bold w-20 text-right">
                {growthPotential}/5 <span className="font-normal text-muted-foreground text-[10px]">{growthLabels[growthPotential]}</span>
              </span>
            </div>
          </div>

          {/* Phase */}
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

          {/* Priority Until */}
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

          <Button onClick={handleSubmit} className="w-full" disabled={!name.trim()}>
            Salva Modifiche
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}