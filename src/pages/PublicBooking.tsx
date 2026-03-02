import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Calendar as CalendarIcon, Clock, User, Mail, CheckCircle2,
  ChevronLeft, ChevronRight, Video, MapPin, Phone, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const DAY_START = 9;
const DAY_END = 18;

const MEETING_TYPES = [
  { key: 'video_call', label: 'Videochiamata', icon: Video, desc: 'Google Meet, Zoom o simili' },
  { key: 'phone_call', label: 'Telefonata', icon: Phone, desc: 'Ti chiameremo al numero indicato' },
  { key: 'in_person', label: 'Di persona', icon: MapPin, desc: 'Incontro in un luogo fisico' },
] as const;

const DURATIONS = [
  { mins: 15, label: '15 min', desc: 'Quick sync' },
  { mins: 30, label: '30 min', desc: 'Standard' },
  { mins: 45, label: '45 min', desc: 'Approfondito' },
  { mins: 60, label: '1 ora', desc: 'Deep dive' },
];

type MeetingType = typeof MEETING_TYPES[number]['key'];

function generateSlots(duration: number) {
  const slots: string[] = [];
  for (let mins = DAY_START * 60; mins + duration <= DAY_END * 60; mins += 30) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
  return slots;
}

function addMins(time: string, mins: number) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Steps: 0=type+duration, 1=date+time, 2=details, 3=done
type Step = 0 | 1 | 2 | 3;

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<{ display_name: string | null; user_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>(0);
  const [meetingType, setMeetingType] = useState<MeetingType>('video_call');
  const [duration, setDuration] = useState(30);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const allSlots = useMemo(() => generateSlots(duration), [duration]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, user_id')
        .eq('public_slug', slug)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setProfile(data);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (!profile) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    (async () => {
      const { data } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('user_id', profile.user_id)
        .eq('date', dateStr);
      setBusySlots(data?.map(a => ({ start: a.start_time, end: a.end_time })) ?? []);
    })();
  }, [profile, selectedDate]);

  const isSlotBusy = (slot: string) => {
    const slotEnd = addMins(slot, duration);
    return busySlots.some(b => slot < b.end && slotEnd > b.start);
  };

  const weekDays = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const handleSubmit = async () => {
    if (!profile || !selectedSlot || !guestName.trim() || !guestEmail.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('booking_requests').insert({
      host_user_id: profile.user_id,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      requested_date: format(selectedDate, 'yyyy-MM-dd'),
      requested_start_time: selectedSlot,
      requested_end_time: addMins(selectedSlot, duration),
      message: message.trim() || null,
      meeting_type: meetingType,
      duration_minutes: duration,
      location: meetingType === 'in_person' ? location.trim() || null : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Errore nell'invio della richiesta");
    } else {
      setStep(3);
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

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-sm">
          <CalendarIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Pagina non trovata</h1>
          <p className="text-muted-foreground text-sm">Questo link di prenotazione non esiste o non è più attivo.</p>
        </Card>
      </div>
    );
  }

  const hostName = profile?.display_name || slug;
  const selectedTypeInfo = MEETING_TYPES.find(t => t.key === meetingType)!;
  const selectedDurationInfo = DURATIONS.find(d => d.mins === duration)!;

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
  };

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
              <p className="text-[10px] text-muted-foreground mt-0.5">Open Calendar</p>
            </div>
          </div>

          {/* Step indicator */}
          {step < 3 && (
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(s => (
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
          {/* STEP 0: Meeting type + duration */}
          {step === 0 && (
            <motion.div key="step0" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="pt-2">
                <h2 className="text-lg font-bold">Che tipo di incontro?</h2>
                <p className="text-sm text-muted-foreground">Scegli la modalità e la durata</p>
              </div>

              {/* Meeting type cards */}
              <div className="space-y-2">
                {MEETING_TYPES.map(t => {
                  const Icon = t.icon;
                  const active = meetingType === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setMeetingType(t.key)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                        active
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/30 hover:bg-muted/30'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${active ? 'text-foreground' : ''}`}>{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                      </div>
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        active ? 'border-primary' : 'border-muted-foreground/30'
                      }`}>
                        {active && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Durata</Label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map(d => (
                    <button
                      key={d.mins}
                      onClick={() => { setDuration(d.mins); setSelectedSlot(null); }}
                      className={`rounded-xl py-3 text-center transition-all ${
                        duration === d.mins
                          ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/20'
                          : 'bg-muted/40 hover:bg-muted text-foreground'
                      }`}
                    >
                      <div className="text-sm font-semibold">{d.label}</div>
                      <div className={`text-[10px] mt-0.5 ${duration === d.mins ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={() => setStep(1)} className="w-full gap-2" size="lg">
                Continua <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* STEP 1: Date + Time */}
          {step === 1 && (
            <motion.div key="step1" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold">Scegli data e orario</h2>
                  <p className="text-sm text-muted-foreground">{selectedTypeInfo.label} · {selectedDurationInfo.label}</p>
                </div>
              </div>

              {/* Week picker */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="icon" onClick={() => setWeekStart(d => addDays(d, -7))} disabled={isBefore(weekStart, startOfDay(new Date()))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {format(weekStart, 'd MMM', { locale: it })} — {format(addDays(weekStart, 4), 'd MMM yyyy', { locale: it })}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => setWeekStart(d => addDays(d, 7))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {weekDays.map(day => {
                    const past = isBefore(day, startOfDay(new Date()));
                    const selected = isSameDay(day, selectedDate);
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => { if (!past) { setSelectedDate(day); setSelectedSlot(null); } }}
                        disabled={past}
                        className={`rounded-xl p-2.5 text-center transition-all ${
                          selected ? 'bg-primary text-primary-foreground font-bold shadow-sm' :
                          isToday(day) ? 'bg-accent font-medium' :
                          past ? 'opacity-25 cursor-not-allowed' :
                          'hover:bg-muted'
                        }`}
                      >
                        <div className="text-[11px] font-medium uppercase">{format(day, 'EEE', { locale: it })}</div>
                        <div className="text-xl font-bold mt-0.5">{format(day, 'd')}</div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {/* Slots */}
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5" />
                  {format(selectedDate, 'EEEE d MMMM', { locale: it })}
                </h3>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  {allSlots.map(slot => {
                    const busy = isSlotBusy(slot);
                    const selected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        onClick={() => { if (!busy) setSelectedSlot(slot); }}
                        disabled={busy}
                        className={`rounded-lg py-2.5 text-sm font-mono transition-all ${
                          selected ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/20 shadow-sm' :
                          busy ? 'bg-muted/30 text-muted-foreground/30 line-through cursor-not-allowed' :
                          'bg-muted/40 hover:bg-accent hover:font-medium'
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Button
                onClick={() => setStep(2)}
                disabled={!selectedSlot}
                className="w-full gap-2"
                size="lg"
              >
                Continua <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* STEP 2: Contact details */}
          {step === 2 && (
            <motion.div key="step2" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold">I tuoi dati</h2>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedDate, 'd MMMM', { locale: it })} · {selectedSlot}–{addMins(selectedSlot!, duration)} · {selectedTypeInfo.label}
                  </p>
                </div>
              </div>

              {/* Summary card */}
              <Card className="p-4 bg-primary/5 border-primary/15">
                <div className="flex items-center gap-3 text-sm">
                  <selectedTypeInfo.icon className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium">{selectedTypeInfo.label} con {hostName}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })} · {selectedSlot} – {addMins(selectedSlot!, duration)} ({selectedDurationInfo.label})
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Nome *</Label>
                    <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Il tuo nome completo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email *</Label>
                    <Input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="nome@email.com" />
                  </div>
                </div>

                {meetingType === 'phone_call' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Numero di telefono</Label>
                    <Input type="tel" value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="+39 ..." />
                  </div>
                )}

                {meetingType === 'in_person' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Luogo proposto</Label>
                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Indirizzo o luogo di incontro" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs">Di cosa vorresti parlare? (opzionale)</Label>
                  <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Breve descrizione dell'argomento..." rows={3} />
                </div>
              </Card>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !guestName.trim() || !guestEmail.trim()}
                className="w-full gap-2"
                size="lg"
              >
                {submitting ? 'Invio in corso...' : 'Conferma richiesta'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                L'appuntamento dovrà essere confermato da {hostName}.
              </p>
            </motion.div>
          )}

          {/* STEP 3: Confirmation */}
          {step === 3 && (
            <motion.div key="step3" {...stepVariants} transition={{ duration: 0.3 }} className="flex flex-col items-center justify-center pt-16 space-y-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
              >
                <div className="h-16 w-16 rounded-2xl bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </motion.div>
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Richiesta inviata!</h1>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  La tua richiesta di <strong>{selectedTypeInfo.label.toLowerCase()}</strong> con {hostName} per il <strong>{format(selectedDate, 'd MMMM yyyy', { locale: it })}</strong> alle <strong>{selectedSlot}</strong> è stata inviata con successo.
                </p>
              </div>
              <Card className="p-4 w-full max-w-sm space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <selectedTypeInfo.icon className="h-4 w-4 text-primary" />
                  <span>{selectedTypeInfo.label}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  <span>{format(selectedDate, 'EEEE d MMMM yyyy', { locale: it })}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{selectedSlot} – {addMins(selectedSlot!, duration)} ({selectedDurationInfo.label})</span>
                </div>
              </Card>
              <p className="text-xs text-muted-foreground">{hostName} confermerà l'appuntamento via email a {guestEmail}.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
