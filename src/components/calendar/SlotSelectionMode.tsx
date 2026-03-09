import { useState } from 'react';
import { format, addDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Copy, Check, Link2, CalendarCheck, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface SelectedSlot {
  date: string;
  startTime: string;
  endTime: string;
}

interface SlotSelectionModeProps {
  open: boolean;
  onClose: () => void;
  selectedSlots: SelectedSlot[];
  onRemoveSlot: (index: number) => void;
  onClearSlots: () => void;
  weekDays: Date[];
}

const MEETING_TYPES = [
  { key: 'video_call', label: 'Videochiamata' },
  { key: 'phone_call', label: 'Telefonata' },
  { key: 'in_person', label: 'Di persona' },
];

const DURATIONS = [15, 30, 45, 60];

export function SlotSelectionDialog({ open, onClose, selectedSlots, onRemoveSlot, onClearSlots, weekDays }: SlotSelectionModeProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState('Proposta orari');
  const [meetingType, setMeetingType] = useState('video_call');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Extra dates for availability poll
  const [extraDatesEnabled, setExtraDatesEnabled] = useState(false);
  const [extraDates, setExtraDates] = useState<string[]>([]);

  // Generate extra date options (next 14 days from today)
  const today = new Date();
  const extraDateOptions = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i);
    return format(d, 'yyyy-MM-dd');
  }).filter(d => !selectedSlots.some(s => s.date === d));

  const toggleExtraDate = (date: string) => {
    setExtraDates(prev => prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]);
  };

  const handleGenerate = async () => {
    if (!user || selectedSlots.length === 0) return;
    setSaving(true);

    const { data: profile } = await supabase
      .from('profiles')
      .select('public_slug')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.public_slug) {
      toast.error('Configura prima il tuo nome pubblico nelle Impostazioni → Link Pubblici');
      setSaving(false);
      return;
    }

    const slotsData = selectedSlots.map(s => ({
      date: s.date,
      start_time: s.startTime,
      end_time: s.endTime,
    }));

    const { data, error } = await supabase
      .from('slot_invitations' as any)
      .insert({
        user_id: user.id,
        title: title.trim() || 'Proposta orari',
        slots: slotsData,
        extra_dates: extraDatesEnabled ? extraDates : [],
        meeting_type: meetingType,
        duration_minutes: duration,
      } as any)
      .select('slug')
      .single() as any;

    setSaving(false);

    if (error || !data) {
      toast.error('Errore nella creazione del link');
      return;
    }

    const link = `${window.location.origin}/${profile.public_slug}/slots/${data.slug}`;
    setGeneratedLink(link);
    toast.success('Link creato!');
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copiato!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setCopied(false);
    onClose();
  };

  // Group slots by date
  const slotsByDate = selectedSlots.reduce<Record<string, { slot: SelectedSlot; index: number }[]>>((acc, slot, i) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push({ slot, index: i });
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Proponi slot
          </DialogTitle>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4">
            <Card className="p-4 bg-primary/5 border-primary/15">
              <p className="text-sm font-medium mb-2">Link pronto! Condividilo:</p>
              <div className="flex items-center gap-2">
                <Input value={generatedLink} readOnly className="text-xs font-mono" />
                <Button size="icon" variant="outline" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </Card>
            <p className="text-xs text-muted-foreground">
              Chi riceve il link potrà scegliere tra i {selectedSlots.length} slot proposti
              {extraDatesEnabled && extraDates.length > 0 && ` e indicare disponibilità per ${extraDates.length} date aggiuntive`}.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => { onClearSlots(); handleClose(); }}>
                Chiudi e resetta
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs">Titolo proposta</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Riunione progetto" />
            </div>

            {/* Meeting type + duration */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo incontro</Label>
                <Select value={meetingType} onValueChange={setMeetingType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map(t => (
                      <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Durata</Label>
                <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map(d => (
                      <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selected slots */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Slot selezionati ({selectedSlots.length})</Label>
                {selectedSlots.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={onClearSlots}>
                    Rimuovi tutti
                  </Button>
                )}
              </div>
              {selectedSlots.length === 0 ? (
                <Card className="p-4 text-center">
                  <CalendarCheck className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Clicca sugli slot del calendario per selezionarli
                  </p>
                </Card>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {Object.entries(slotsByDate).map(([date, items]) => (
                    <div key={date}>
                      <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                        {format(new Date(date + 'T00:00:00'), 'EEEE d MMM', { locale: it })}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map(({ slot, index }) => (
                          <Badge key={index} variant="secondary" className="gap-1 pr-1">
                            {slot.startTime}–{slot.endTime}
                            <button onClick={() => onRemoveSlot(index)} className="ml-0.5 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extra dates poll */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={extraDatesEnabled}
                  onCheckedChange={c => setExtraDatesEnabled(!!c)}
                  id="extra-dates"
                />
                <Label htmlFor="extra-dates" className="text-xs cursor-pointer">
                  Aggiungi sondaggio disponibilità per altre date
                </Label>
              </div>

              {extraDatesEnabled && (
                <div className="space-y-2 pl-6">
                  <p className="text-[10px] text-muted-foreground">
                    Seleziona le date aggiuntive per cui chiedere disponibilità
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {extraDateOptions.map(date => {
                      const active = extraDates.includes(date);
                      return (
                        <button
                          key={date}
                          onClick={() => toggleExtraDate(date)}
                          className={`text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/40 border-border hover:border-primary/30'
                          }`}
                        >
                          {format(new Date(date + 'T00:00:00'), 'EEE d MMM', { locale: it })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Annulla</Button>
              <Button
                onClick={handleGenerate}
                disabled={saving || selectedSlots.length === 0}
                className="gap-1.5"
              >
                {saving ? 'Generazione...' : (
                  <>
                    <Link2 className="h-4 w-4" /> Genera link
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
