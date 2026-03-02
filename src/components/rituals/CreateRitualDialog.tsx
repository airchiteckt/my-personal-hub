import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Shield, Cog, Building2, Pin, Shuffle } from 'lucide-react';

interface Enterprise {
  id: string;
  name: string;
  color: string;
}

interface CreateRitualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enterprises: Enterprise[];
  onSubmit: (data: {
    name: string;
    category: string;
    frequency: string;
    planningMode: 'fixed' | 'flexible';
    customFrequencyDays: number[] | null;
    estimatedMinutes: number;
    enterpriseId: string | null;
    suggestedDay: number | null;
    suggestedTime: string | null;
    description: string | null;
    weeklySpecificDays: number[] | null;
    weeklyTimesPerWeek: number | null;
  }) => void;
}

const CATEGORIES = [
  { key: 'performance', label: 'Performance Personale', icon: Brain, desc: 'Energia e lucidità' },
  { key: 'governance', label: 'Governance Aziendale', icon: Shield, desc: 'Controllo e direzione' },
  { key: 'operational', label: 'Operativo Ricorrente', icon: Cog, desc: 'Sistemi strutturali' },
] as const;

const FREQUENCIES = [
  { key: 'daily', label: 'Giornaliero' },
  { key: 'weekly', label: 'Settimanale' },
  { key: 'monthly', label: 'Mensile' },
  { key: 'custom', label: 'Personalizzato' },
] as const;

const DAYS = [
  { key: 1, label: 'Lun' },
  { key: 2, label: 'Mar' },
  { key: 3, label: 'Mer' },
  { key: 4, label: 'Gio' },
  { key: 5, label: 'Ven' },
  { key: 6, label: 'Sab' },
  { key: 0, label: 'Dom' },
];

export function CreateRitualDialog({ open, onOpenChange, enterprises, onSubmit }: CreateRitualDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('performance');
  const [planningMode, setPlanningMode] = useState<'fixed' | 'flexible'>('fixed');
  const [frequency, setFrequency] = useState('weekly');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [enterpriseId, setEnterpriseId] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [description, setDescription] = useState('');
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [weeklyTimesPerWeek, setWeeklyTimesPerWeek] = useState(2);

  const reset = () => {
    setName(''); setCategory('performance'); setPlanningMode('fixed');
    setFrequency('weekly'); setCustomDays([]); setEstimatedMinutes(30);
    setEnterpriseId(''); setSuggestedTime(''); setDescription('');
    setWeeklyDays([]); setWeeklyTimesPerWeek(2);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      category,
      frequency,
      planningMode,
      customFrequencyDays: frequency === 'custom' && customDays.length > 0 ? customDays : null,
      estimatedMinutes,
      enterpriseId: enterpriseId === 'none' ? null : (enterpriseId || null),
      suggestedDay: null,
      suggestedTime: planningMode === 'fixed' ? (suggestedTime || null) : null,
      description: description.trim() || null,
      weeklySpecificDays: planningMode === 'fixed' && frequency === 'weekly' && weeklyDays.length > 0 ? weeklyDays : null,
      weeklyTimesPerWeek: planningMode === 'flexible' ? weeklyTimesPerWeek : null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Rituale</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Es. Deep Work quotidiano" />
          </div>

          {/* Planning Mode */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo di pianificazione</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPlanningMode('fixed')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                  planningMode === 'fixed'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                <Pin className={`h-4 w-4 shrink-0 ${planningMode === 'fixed' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">Slot fisso</p>
                  <p className="text-[10px] text-muted-foreground">Giorno e ora precisi</p>
                </div>
              </button>
              <button
                onClick={() => setPlanningMode('flexible')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                  planningMode === 'flexible'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                <Shuffle className={`h-4 w-4 shrink-0 ${planningMode === 'flexible' ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-sm font-medium">Cadenza libera</p>
                  <p className="text-[10px] text-muted-foreground">N volte / settimana</p>
                </div>
              </button>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Categoria</Label>
            <div className="space-y-1.5">
              {CATEGORIES.map(c => {
                const Icon = c.icon;
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      active
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                    </div>
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ml-auto ${
                      active ? 'border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {active && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enterprise */}
          {category !== 'performance' && enterprises.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Impresa collegata</Label>
              <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                <SelectTrigger><SelectValue placeholder="Nessuna (globale)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna (globale)</SelectItem>
                  {enterprises.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: `hsl(${e.color})` }} />
                        {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fixed mode: frequency + days + time */}
          {planningMode === 'fixed' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Frequenza</Label>
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Durata (min)</Label>
                  <Input type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(Number(e.target.value))} min={5} max={240} step={5} />
                </div>
              </div>

              {frequency === 'custom' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Giorni</Label>
                  <div className="flex gap-1.5">
                    {DAYS.map(d => (
                      <button key={d.key} onClick={() => setCustomDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${customDays.includes(d.key) ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted text-foreground'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {frequency === 'weekly' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Giorni della settimana</Label>
                  <div className="flex gap-1.5">
                    {DAYS.map(d => (
                      <button key={d.key} onClick={() => setWeeklyDays(prev => prev.includes(d.key) ? prev.filter(x => x !== d.key) : [...prev, d.key])}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${weeklyDays.includes(d.key) ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted text-foreground'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Orario</Label>
                <Input type="time" value={suggestedTime} onChange={e => setSuggestedTime(e.target.value)} />
              </div>
            </>
          )}

          {/* Flexible mode: times per week + duration */}
          {planningMode === 'flexible' && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Quante volte a settimana?</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button key={n} onClick={() => setWeeklyTimesPerWeek(n)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${weeklyTimesPerWeek === n ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted/40 hover:bg-muted text-foreground'}`}>
                      {n}×
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Durata per sessione (min)</Label>
                <Input type="number" value={estimatedMinutes} onChange={e => setEstimatedMinutes(Number(e.target.value))} min={5} max={240} step={5} />
              </div>
            </>
          )}

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Note / Descrizione</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Dettagli opzionali..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>Crea Rituale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
