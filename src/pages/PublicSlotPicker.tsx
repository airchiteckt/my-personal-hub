import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon, CheckCircle2, User, Mail,
  ArrowRight, ArrowLeft, Video, Phone, MapPin, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface SlotData {
  date: string;
  start_time: string;
  end_time: string;
}

interface InvitationData {
  id: string;
  title: string;
  slots: SlotData[];
  extra_dates: string[];
  meeting_type: string;
  duration_minutes: number;
  status: string;
}

const MEETING_ICONS: Record<string, typeof Video> = {
  video_call: Video,
  phone_call: Phone,
  in_person: MapPin,
};

const MEETING_LABELS: Record<string, string> = {
  video_call: 'Videochiamata',
  phone_call: 'Telefonata',
  in_person: 'Di persona',
};

type Step = 0 | 1 | 2;

export default function PublicSlotPicker() {
  const { slug, invitationSlug } = useParams<{ slug: string; invitationSlug: string }>();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [hostName, setHostName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>(0);
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const [extraAvailability, setExtraAvailability] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!slug || !invitationSlug) return;
    (async () => {
      // Get host profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('public_slug', slug)
        .maybeSingle();
      if (profile) setHostName(profile.display_name || slug);

      // Get invitation
      const { data, error } = await supabase
        .from('slot_invitations')
        .select('id, title, slots, extra_dates, meeting_type, duration_minutes, status')
        .eq('slug', invitationSlug)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
      } else {
        setInvitation({
          ...data,
          slots: (data.slots as unknown as SlotData[]) || [],
          extra_dates: (data.extra_dates as unknown as string[]) || [],
        });
      }
      setLoading(false);
    })();
  }, [slug, invitationSlug]);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    if (!invitation) return {};
    return invitation.slots.reduce<Record<string, SlotData[]>>((acc, slot) => {
      if (!acc[slot.date]) acc[slot.date] = [];
      acc[slot.date].push(slot);
      return acc;
    }, {});
  }, [invitation]);

  const toggleExtraDate = (date: string) => {
    setExtraAvailability(prev =>
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
  };

  const handleSubmit = async () => {
    if (!invitation || !name.trim() || !email.trim()) return;
    setSubmitting(true);

    const { error } = await supabase.from('slot_responses').insert({
      invitation_id: invitation.id,
      respondent_name: name.trim(),
      respondent_email: email.trim(),
      selected_slot: selectedSlot,
      extra_availability: extraAvailability,
      notes: notes.trim() || null,
    });

    setSubmitting(false);
    if (error) {
      toast.error("Errore nell'invio della risposta");
    } else {
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (notFound || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-sm">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Link non valido</h1>
          <p className="text-muted-foreground text-sm">Questa proposta non esiste o non è più attiva.</p>
        </Card>
      </div>
    );
  }

  const MeetingIcon = MEETING_ICONS[invitation.meeting_type] || Video;
  const meetingLabel = MEETING_LABELS[invitation.meeting_type] || invitation.meeting_type;
  const hasExtraDates = invitation.extra_dates.length > 0;

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <CalendarIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{hostName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Proposta orari</p>
            </div>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-4 md:p-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Risposta inviata!</h2>
            <p className="text-muted-foreground">
              {selectedSlot
                ? `Hai scelto ${format(new Date(selectedSlot.date + 'T00:00:00'), 'd MMMM', { locale: it })} dalle ${selectedSlot.start_time} alle ${selectedSlot.end_time}.`
                : 'La tua disponibilità è stata registrata.'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">{hostName} riceverà la tua risposta e ti confermerà l'appuntamento.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <CalendarIcon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{hostName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{invitation.title}</p>
            </div>
          </div>
          {step < 2 && (
            <div className="flex items-center gap-1.5">
              {[0, 1].map(s => (
                <div
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    s === step ? 'w-6 bg-primary' : s < step ? 'w-3 bg-primary/40' : 'w-3 bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <AnimatePresence mode="wait">
          {/* STEP 0: Pick a slot */}
          {step === 0 && (
            <motion.div key="step0" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="pt-2">
                <h2 className="text-lg font-bold">Scegli uno slot</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MeetingIcon className="h-4 w-4" />
                  {meetingLabel} · {invitation.duration_minutes} min
                </p>
              </div>

              {/* Slots grouped by date */}
              <div className="space-y-4">
                {Object.entries(slotsByDate)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([date, slots]) => (
                    <Card key={date} className="p-4">
                      <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(date + 'T00:00:00'), 'EEEE d MMMM', { locale: it })}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot, i) => {
                          const isSelected = selectedSlot?.date === slot.date && selectedSlot?.start_time === slot.start_time;
                          return (
                            <button
                              key={i}
                              onClick={() => setSelectedSlot(isSelected ? null : slot)}
                              className={`rounded-lg px-4 py-2.5 text-sm font-mono transition-all ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/20 shadow-sm'
                                  : 'bg-muted/40 hover:bg-accent hover:font-medium'
                              }`}
                            >
                              {slot.start_time}–{slot.end_time}
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  ))}
              </div>

              {/* Extra dates poll */}
              {hasExtraDates && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    📊 Disponibilità aggiuntiva (opzionale)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Nessuno slot tra quelli proposti ti va bene? Indica per quali altre date saresti disponibile
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {invitation.extra_dates.map(date => {
                      const checked = extraAvailability.includes(date);
                      return (
                        <button
                          key={date}
                          onClick={() => toggleExtraDate(date)}
                          className={`text-sm px-3 py-2 rounded-lg border transition-all flex items-center gap-2 ${
                            checked
                              ? 'bg-primary/10 border-primary/30 text-foreground font-medium'
                              : 'bg-muted/40 border-border hover:border-primary/30'
                          }`}
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          {format(new Date(date + 'T00:00:00'), 'EEE d MMM', { locale: it })}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              <Button
                onClick={() => setStep(1)}
                disabled={!selectedSlot && extraAvailability.length === 0}
                className="w-full gap-2"
                size="lg"
              >
                Continua <ArrowRight className="h-4 w-4" />
              </Button>
              {!selectedSlot && extraAvailability.length > 0 && (
                <p className="text-[11px] text-muted-foreground text-center -mt-2">
                  Procederai solo con la tua disponibilità aggiuntiva
                </p>
              )}
            </motion.div>
          )}

          {/* STEP 1: Contact details */}
          {step === 1 && (
            <motion.div key="step1" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold">I tuoi dati</h2>
                  {selectedSlot && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedSlot.date + 'T00:00:00'), 'd MMMM', { locale: it })} · {selectedSlot.start_time}–{selectedSlot.end_time} · {meetingLabel}
                    </p>
                  )}
                </div>
              </div>

              {/* Summary */}
              <Card className="p-4 bg-primary/5 border-primary/15">
                <div className="space-y-2 text-sm">
                  {selectedSlot && (
                    <div className="flex items-center gap-3">
                      <MeetingIcon className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="font-medium">{meetingLabel} con {hostName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(selectedSlot.date + 'T00:00:00'), 'EEEE d MMMM yyyy', { locale: it })} · {selectedSlot.start_time}–{selectedSlot.end_time}
                        </p>
                      </div>
                    </div>
                  )}
                  {extraAvailability.length > 0 && (
                    <div className="flex items-start gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">📊 Disponibilità extra:</span>
                      <div className="flex flex-wrap gap-1">
                        {extraAvailability.map(d => (
                          <Badge key={d} variant="secondary" className="text-[10px]">
                            {format(new Date(d + 'T00:00:00'), 'EEE d MMM', { locale: it })}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Nome *</Label>
                    <Input value={name} onChange={e => setName(e.target.value)} placeholder="Il tuo nome completo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email *</Label>
                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Note (opzionale)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Aggiungi un messaggio..." rows={3} />
                </div>
              </Card>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !name.trim() || !email.trim()}
                className="w-full gap-2"
                size="lg"
              >
                {submitting ? 'Invio...' : 'Invia risposta'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
