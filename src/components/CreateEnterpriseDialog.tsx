import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ENTERPRISE_COLORS, ENTERPRISE_PHASE_LABELS, BUSINESS_CATEGORY_CONFIG, TIME_HORIZON_LABELS,
  ENTERPRISE_TEMPLATES,
  EnterpriseStatus, EnterprisePhase, BusinessCategory, TimeHorizon, EnterpriseTemplateType,
} from '@/types/prp';
import { usePrp } from '@/context/PrpContext';
import { useState } from 'react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { CalendarIcon, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TOTAL_STEPS = 4;

export function CreateEnterpriseDialog({ open, onOpenChange }: Props) {
  const { addEnterprise, addProject } = usePrp();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Step 0 - Identity
  const [name, setName] = useState('');
  const [status, setStatus] = useState<EnterpriseStatus>('development');
  const [color, setColor] = useState<string>(ENTERPRISE_COLORS[0].value);

  // Step 1 - Enterprise Type (Template)
  const [templateType, setTemplateType] = useState<EnterpriseTemplateType>('digital_services');
  const [selectedProjects, setSelectedProjects] = useState<Record<string, boolean>>({});

  // Step 2 - Business Classification
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory>('scale_opportunity');
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('medium');

  // Step 3 - Strategic Analysis
  const [strategicImportance, setStrategicImportance] = useState(3);
  const [growthPotential, setGrowthPotential] = useState(3);
  const [phase, setPhase] = useState<EnterprisePhase>('setup');
  const [priorityUntil, setPriorityUntil] = useState<Date | undefined>();

  const resetForm = () => {
    setStep(0); setName(''); setStatus('development');
    setColor(ENTERPRISE_COLORS[0].value);
    setTemplateType('digital_services'); setSelectedProjects({});
    setBusinessCategory('scale_opportunity'); setTimeHorizon('medium');
    setStrategicImportance(3); setGrowthPotential(3);
    setPhase('setup'); setPriorityUntil(undefined);
    setCreating(false);
  };

  const handleTemplateChange = (type: EnterpriseTemplateType) => {
    setTemplateType(type);
    // Auto-select all non-optional projects, optional ones unchecked by default
    const template = ENTERPRISE_TEMPLATES[type];
    const sel: Record<string, boolean> = {};
    template.projects.forEach(p => {
      sel[p.name] = !p.optional;
    });
    setSelectedProjects(sel);
  };

  // Initialize selection when entering step 1
  const goToStep1 = () => {
    if (Object.keys(selectedProjects).length === 0) {
      handleTemplateChange(templateType);
    }
    setStep(1);
  };

  const handleCategoryChange = (cat: BusinessCategory) => {
    setBusinessCategory(cat);
    setStrategicImportance(BUSINESS_CATEGORY_CONFIG[cat].defaultWeight);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    
    const enterpriseId = await addEnterprise({
      name: name.trim(), status, color,
      strategicImportance, growthPotential, phase,
      businessCategory, timeHorizon,
      enterpriseType: templateType,
      priorityUntil: priorityUntil ? format(priorityUntil, 'yyyy-MM-dd') : undefined,
    });

    if (enterpriseId) {
      // Create selected template projects
      const template = ENTERPRISE_TEMPLATES[templateType];
      const projectsToCreate = template.projects.filter(p => selectedProjects[p.name]);
      
      for (const proj of projectsToCreate) {
        await addProject({
          enterpriseId,
          name: proj.name,
          type: proj.type,
        });
      }
      
      toast.success(`Impresa creata con ${projectsToCreate.length} progetti`);
    }

    resetForm();
    onOpenChange(false);
  };

  const importanceLabels = ['', 'Marginale', 'Bassa', 'Media', 'Alta', 'Priorità assoluta'];
  const growthLabels = ['', 'Stabile', 'Bassa crescita', 'Moderata', 'Buona', 'Forte espansione'];
  const stepTitles = ['Identità', 'Tipo Impresa', 'Classificazione Business', 'Analisi Strategica'];

  const currentTemplate = ENTERPRISE_TEMPLATES[templateType];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
                onKeyDown={e => e.key === 'Enter' && name.trim() && goToStep1()}
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
            <Button onClick={goToStep1} className="w-full" disabled={!name.trim()}>
              Avanti <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* STEP 1: Enterprise Type / Template */}
        {step === 1 && (
          <div className="space-y-4 pt-2">
            <div className="space-y-3">
              <Label className="text-sm">🧩 Tipo di Impresa</Label>
              <p className="text-[11px] text-muted-foreground">
                Seleziona il tipo per pre-compilare i progetti operativi
              </p>
              <div className="grid gap-2">
                {(Object.entries(ENTERPRISE_TEMPLATES) as [EnterpriseTemplateType, typeof ENTERPRISE_TEMPLATES[EnterpriseTemplateType]][]).map(([key, tmpl]) => (
                  <button
                    key={key}
                    onClick={() => handleTemplateChange(key)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                      templateType === key
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-lg mt-0.5">{tmpl.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{tmpl.label}</div>
                      <div className="text-[11px] text-muted-foreground">{tmpl.description}</div>
                      <div className="text-[10px] text-muted-foreground/70 italic mt-0.5">{tmpl.examples}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Projects preview */}
            <div className="space-y-2">
              <Label className="text-sm">📋 Progetti che verranno creati</Label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {currentTemplate.projects.map(proj => (
                  <label
                    key={proj.name}
                    className={cn(
                      "flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-all text-sm",
                      selectedProjects[proj.name]
                        ? "border-primary/30 bg-primary/5"
                        : "border-border opacity-60"
                    )}
                  >
                    <Checkbox
                      checked={!!selectedProjects[proj.name]}
                      onCheckedChange={(checked) => {
                        setSelectedProjects(prev => ({ ...prev, [proj.name]: !!checked }));
                      }}
                    />
                    <span className="text-xs">
                      {proj.type === 'operational' ? '🟡' : '⚪'}
                    </span>
                    <span className="flex-1">{proj.name}</span>
                    {proj.optional && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">opzionale</span>
                    )}
                  </label>
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

        {/* STEP 2: Business Classification */}
        {step === 2 && (
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
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Avanti <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Strategic Analysis */}
        {step === 3 && (
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
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1" disabled={creating}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Indietro
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={creating}>
                {creating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Creazione...</> : 'Crea Impresa'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}