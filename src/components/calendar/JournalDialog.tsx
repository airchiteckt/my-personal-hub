import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, Zap } from 'lucide-react';

export interface JournalEntry {
  id: string;
  entryDate: string;
  content: string;
  mood?: string;
  energyLevel?: number;
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  entry: JournalEntry | null;
  onSave: (date: string, content: string, mood?: string, energyLevel?: number) => void;
  onDelete: (id: string) => void;
}

export function JournalDialog({ open, onOpenChange, date, entry, onSave, onDelete }: Props) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | undefined>();
  const [energyLevel, setEnergyLevel] = useState<number | undefined>();

  useEffect(() => {
    if (open) {
      setContent(entry?.content || '');
      setMood(entry?.mood || undefined);
      setEnergyLevel(entry?.energyLevel || undefined);
    }
  }, [open, entry]);

  const handleSave = () => {
    if (!content.trim() && !mood && !energyLevel) return;
    onSave(date, content.trim(), mood, energyLevel);
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
      <DialogContent className="max-w-md">
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

          {/* Energy level */}
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

          {/* Content */}
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Cosa hai in mente oggi? Riflessioni, gratitudine, appunti..."
            rows={6}
            className="resize-none"
          />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!content.trim() && !mood && !energyLevel}>
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
