import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, Shield, Cog, Building2 } from 'lucide-react';

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
    customFrequencyDays: number[] | null;
    estimatedMinutes: number;
    enterpriseId: string | null;
    suggestedDay: number | null;
    suggestedTime: string | null;
    description: string | null;
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
  const [frequency, setFrequency] = useState('weekly');
  const [customDays, setCustomDays] = useState<number[]>([]);
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [enterpriseId, setEnterpriseId] = useState('');
  const [suggestedDay, setSuggestedDay] = useState<string>('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => {
    setName('');
    setCategory('performance');
    setFrequency('weekly');
    setCustomDays([]);
    setEstimatedMinutes(30);
    setEnterpriseId('');
    setSuggestedDay('');
    setSuggestedTime('');
    setDescription('');
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      category,
      frequency,
      customFrequencyDays: frequency === 'custom' && customDays.length > 0 ? customDays : null,
      estimatedMinutes,
      enterpriseId: enterpriseId || null,
      suggestedDay: suggestedDay !== '' ? Number(suggestedDay) : null,
      suggestedTime: suggestedTime || null,
      description: description.trim() || null,
    });
    reset();
    onOpenChange(false);
  };

  const toggleDay = (day: number) => {
    setCustomDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
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

          {/* Enterprise (for governance/operational) */}
          {category !== 'performance' && enterprises.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Impresa collegata</Label>
              <Select value={enterpriseId} onValueChange={setEnterpriseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nessuna (globale)" />
                </SelectTrigger>
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

          {/* Frequency + Duration row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Frequenza</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          {/* Custom days */}
          {frequency === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Giorni</Label>
              <div className="flex gap-1.5">
                {DAYS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => toggleDay(d.key)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                      customDays.includes(d.key)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 hover:bg-muted text-foreground'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested day (for weekly) */}
          {frequency === 'weekly' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Giorno suggerito</Label>
              <Select value={suggestedDay} onValueChange={setSuggestedDay}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualsiasi" />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map(d => (
                    <SelectItem key={d.key} value={String(d.key)}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Suggested time */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Orario suggerito</Label>
            <Input type="time" value={suggestedTime} onChange={e => setSuggestedTime(e.target.value)} />
          </div>

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
