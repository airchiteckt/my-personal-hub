import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { getMoonPhase, getMoonTimes, getNextMoonEvents, getMoonDataAtHour } from '@/lib/moon-utils';
import { calculateLII, calculateEnergiaAttesa } from '@/lib/lunar-influence';

export interface JournalEntry {
  id: string;
  entryDate: string;
  content: string;
  mood?: string;
  energyLevel?: number;
  energyMorning?: number;
  energyAfternoon?: number;
  energyEvening?: number;
  lunarData?: {
    liiScore?: number;
    energiaAttesa?: number;
    moonPhase?: string;
    illumination?: number;
  };
  createdAt: string;
  updatedAt: string;
}

const MOODS = [
  { emoji: '😊', label: 'Ottimo', value: 'great' },
  { emoji: '🙂', label: 'Bene', value: 'good' },
  { emoji: '😐', label: 'Neutro', value: 'neutral' },
  { emoji: '😟', label: 'Difficile', value: 'tough' },
  { emoji: '😤', label: 'Stressato', value: 'stressed' },
];

const TIME_SLOTS_HOURS = [
  { key: 'morning', hours: [8, 9, 10, 11] },
  { key: 'afternoon', hours: [13, 14, 15, 16] },
  { key: 'evening', hours: [20, 21, 22, 23] },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  entry: JournalEntry | null;
  onSave: (date: string, content: string, mood?: string, energyLevel?: number, energyMorning?: number, energyAfternoon?: number, energyEvening?: number, lunarData?: JournalEntry['lunarData']) => void;
  onDelete: (id: string) => void;
}

function EnergyRow({ label, icon, value, onChange }: { label: string; icon: string; value?: number; onChange: (v: number | undefined) => void }) {
  const getColor = (level: number) => {
    if (level <= 3) return 'bg-destructive/80 text-destructive-foreground';
    if (level <= 6) return 'bg-accent text-accent-foreground';
    return 'bg-primary text-primary-foreground';
  };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <span>{icon}</span> {label}
      </p>
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
          <button
            key={level}
            onClick={() => onChange(value === level ? undefined : level)}
            className={`h-6 w-full rounded text-[10px] font-bold transition-all ${
              value !== undefined && level <= value ? getColor(level) : 'bg-muted/50 text-muted-foreground hover:bg-accent'
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );
}

export function JournalDialog({ open, onOpenChange, date, entry, onSave, onDelete }: Props) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | undefined>();
  const [energyLevel, setEnergyLevel] = useState<number | undefined>();
  const [energyMorning, setEnergyMorning] = useState<number | undefined>();
  const [energyAfternoon, setEnergyAfternoon] = useState<number | undefined>();
  const [energyEvening, setEnergyEvening] = useState<number | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      setContent(entry?.content || '');
      setMood(entry?.mood || undefined);
      setEnergyLevel(entry?.energyLevel || undefined);
      setEnergyMorning(entry?.energyMorning || undefined);
      setEnergyAfternoon(entry?.energyAfternoon || undefined);
      setEnergyEvening(entry?.energyEvening || undefined);
      setShowAdvanced(!!(entry?.energyMorning || entry?.energyAfternoon || entry?.energyEvening));
    }
  }, [open, entry]);

  // Compute lunar data for correlation
  const lunarCorrelation = useMemo(() => {
    const d = new Date(date + 'T12:00:00');
    const phase = getMoonPhase(d);
    const nextEvents = getNextMoonEvents(d);
    
    // Default location (Rome) - ideally we'd use user's location
    const lat = 41.9028, lon = 12.4964;
    const times = getMoonTimes(d, lat, lon);
    
    const parseTime = (t: string | null): number | null => {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h + m / 60;
    };
    const riseHour = parseTime(times.rise);
    const setHour = parseTime(times.set);
    const transitHour = parseTime(times.transit);

    // Compute predicted energy for each time slot
    const predictions = TIME_SLOTS_HOURS.map(slot => {
      const centerHour = slot.hours[Math.floor(slot.hours.length / 2)];
      const moonData = getMoonDataAtHour(d, centerHour, lat, lon, times);
      const lii = calculateLII({
        currentHour: centerHour, riseHour, setHour, transitHour,
        illumination: moonData.illumination, altitude: moonData.altitude,
      });

      // Compute hours to/post full moon
      const hoursToNext = (nextEvents.nextFull.getTime() - d.getTime()) / (1000 * 60 * 60);
      const prevFull = new Date(nextEvents.nextFull.getTime() - 29.53059 * 24 * 60 * 60 * 1000);
      const hoursSincePrev = (d.getTime() - prevFull.getTime()) / (1000 * 60 * 60);
      const hoursToFullMoon = Math.min(Math.abs(hoursToNext), Math.abs(hoursSincePrev));
      const hoursPostFullMoon = hoursToNext > 0 ? hoursSincePrev : Math.abs(hoursToNext);

      const energia = calculateEnergiaAttesa({
        liiExt: lii.extended,
        currentHour: centerHour,
        hoursPostFullMoon,
        hoursToFullMoon,
        moonAge: phase.age,
        illuminationFrac: phase.illumination / 100,
        dLIIScore: 0,
        transitHour,
        riseHour,
      });

      return { slot: slot.key, predicted: energia.score, liiScore: lii.score };
    });

    // Average LII for the day
    const avgLII = Math.round(predictions.reduce((s, p) => s + p.liiScore, 0) / predictions.length);
    const avgEnergia = Math.round(predictions.reduce((s, p) => s + p.predicted, 0) / predictions.length * 10) / 10;

    return {
      phase,
      predictions,
      avgLII,
      avgEnergia,
      lunarData: {
        liiScore: avgLII,
        energiaAttesa: avgEnergia,
        moonPhase: phase.nameIt,
        illumination: phase.illumination,
      },
    };
  }, [date]);


  const handleSave = () => {
    if (!content.trim() && !mood && !energyLevel && !energyMorning && !energyAfternoon && !energyEvening) return;
    // Auto-compute average if granular is provided
    const avgEnergy = (energyMorning || energyAfternoon || energyEvening)
      ? Math.round(([energyMorning, energyAfternoon, energyEvening].filter(Boolean) as number[]).reduce((a, b) => a + b, 0) / [energyMorning, energyAfternoon, energyEvening].filter(Boolean).length)
      : energyLevel;
    onSave(date, content.trim(), mood, avgEnergy, energyMorning, energyAfternoon, energyEvening, lunarCorrelation.lunarData);
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (entry) {
      onDelete(entry.id);
      onOpenChange(false);
    }
  };

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const getEnergyColor = (level: number) => {
    if (level <= 3) return 'bg-destructive/80 text-destructive-foreground';
    if (level <= 6) return 'bg-accent text-accent-foreground';
    return 'bg-primary text-primary-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Journal — {dateLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Mood selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Come ti senti oggi?</p>
            <div className="flex gap-2">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMood(mood === m.value ? undefined : m.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                    mood === m.value
                      ? 'border-primary bg-primary/10 scale-110'
                      : 'border-transparent hover:bg-accent'
                  }`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy level (simple) */}
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> Livello di energia
            </p>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map(level => (
                <button
                  key={level}
                  onClick={() => setEnergyLevel(energyLevel === level ? undefined : level)}
                  className={`h-8 w-full rounded-md text-xs font-bold transition-all ${
                    energyLevel !== undefined && level <= energyLevel
                      ? getEnergyColor(level)
                      : 'bg-muted/50 text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            {energyLevel && (
              <p className="text-[10px] text-muted-foreground text-center">
                {energyLevel <= 3 ? 'Bassa energia' : energyLevel <= 6 ? 'Energia media' : 'Alta energia'} — {energyLevel}/10
              </p>
            )}
          </div>

          {/* Advanced energy tracking (collapsible) */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Tracciamento avanzato energia
              </span>
              {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>

            {showAdvanced && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                <EnergyRow label="Mattina" icon="🌅" value={energyMorning} onChange={setEnergyMorning} />
                <EnergyRow label="Pomeriggio" icon="☀️" value={energyAfternoon} onChange={setEnergyAfternoon} />
                <EnergyRow label="Sera" icon="🌙" value={energyEvening} onChange={setEnergyEvening} />
              </div>
            )}
          </div>

          {/* Content */}
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Cosa hai in mente oggi? Riflessioni, gratitudine, appunti..."
            rows={5}
            className="resize-none"
          />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!content.trim() && !mood && !energyLevel && !energyMorning && !energyAfternoon && !energyEvening}>
              Salva
            </Button>
            {entry && (
              <Button variant="destructive" size="icon" onClick={handleDelete}>
                ×
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
