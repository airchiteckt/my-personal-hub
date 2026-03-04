import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen } from 'lucide-react';

export interface JournalEntry {
  id: string;
  entryDate: string;
  content: string;
  mood?: string;
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
  onSave: (date: string, content: string, mood?: string) => void;
  onDelete: (id: string) => void;
}

export function JournalDialog({ open, onOpenChange, date, entry, onSave, onDelete }: Props) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | undefined>();

  useEffect(() => {
    if (open) {
      setContent(entry?.content || '');
      setMood(entry?.mood || undefined);
    }
  }, [open, entry]);

  const handleSave = () => {
    if (!content.trim() && !mood) return;
    onSave(date, content.trim(), mood);
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

          {/* Content */}
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Cosa hai in mente oggi? Riflessioni, gratitudine, appunti..."
            rows={6}
            className="resize-none"
          />

          <div className="flex gap-2">
            <Button onClick={handleSave} className="flex-1" disabled={!content.trim() && !mood}>
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
