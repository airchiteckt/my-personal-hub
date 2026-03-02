import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar as CalendarIcon, Clock, User, Mail, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, isToday, isBefore, startOfDay } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';

const SLOT_DURATION = 30; // minutes
const DAY_START = 9; // 9:00
const DAY_END = 18; // 18:00

function generateSlots() {
  const slots: string[] = [];
  for (let h = DAY_START; h < DAY_END; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`);
    slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

function addMinutes(time: string, mins: number) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<{ display_name: string | null; user_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [busySlots, setBusySlots] = useState<{ start: string; end: string }[]>([]);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const allSlots = useMemo(() => generateSlots(), []);

  // Fetch profile by slug
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, user_id')
        .eq('public_slug', slug)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
      } else {
        setProfile(data);
      }
      setLoading(false);
    })();
  }, [slug]);

  // Fetch busy slots for selected date
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
    const slotEnd = addMinutes(slot, SLOT_DURATION);
    return busySlots.some(b => slot < b.end && slotEnd > b.start);
  };

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const handleSubmit = async () => {
    if (!profile || !selectedSlot || !guestName.trim() || !guestEmail.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('booking_requests').insert({
      host_user_id: profile.user_id,
      guest_name: guestName.trim(),
      guest_email: guestEmail.trim(),
      requested_date: format(selectedDate, 'yyyy-MM-dd'),
      requested_start_time: selectedSlot,
      requested_end_time: addMinutes(selectedSlot, SLOT_DURATION),
      message: message.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Errore nell\'invio della richiesta');
    } else {
      setSubmitted(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Pagina non trovata</h1>
          <p className="text-muted-foreground text-sm">Questo link di prenotazione non esiste.</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 text-center max-w-sm space-y-4">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-bold">Richiesta inviata!</h1>
          <p className="text-muted-foreground text-sm">
            La tua richiesta di appuntamento per il <strong>{format(selectedDate, 'd MMMM yyyy', { locale: it })}</strong> alle <strong>{selectedSlot}</strong> è stata inviata a {profile?.display_name || 'l\'utente'}.
          </p>
          <p className="text-xs text-muted-foreground">Riceverai conferma via email.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center mx-auto mb-3">
            <CalendarIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{profile?.display_name || slug}</h1>
          <p className="text-muted-foreground text-sm">Prenota un appuntamento</p>
        </div>

        {/* Week navigation */}
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
                  className={`rounded-lg p-2 text-center transition-all text-xs md:text-sm ${
                    selected ? 'bg-primary text-primary-foreground font-bold' :
                    isToday(day) ? 'bg-accent font-medium' :
                    past ? 'opacity-30 cursor-not-allowed' :
                    'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{format(day, 'EEE', { locale: it })}</div>
                  <div className="text-lg md:text-xl">{format(day, 'd')}</div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Time slots */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {format(selectedDate, 'EEEE d MMMM', { locale: it })}
          </h2>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {allSlots.map(slot => {
              const busy = isSlotBusy(slot);
              const selected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => { if (!busy) setSelectedSlot(slot); }}
                  disabled={busy}
                  className={`rounded-md py-2 text-sm font-mono transition-all ${
                    selected ? 'bg-primary text-primary-foreground font-bold ring-2 ring-primary/30' :
                    busy ? 'bg-muted/50 text-muted-foreground/40 line-through cursor-not-allowed' :
                    'bg-muted/30 hover:bg-accent'
                  }`}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Booking form */}
        {selectedSlot && (
          <Card className="p-5 space-y-4 border-primary/20">
            <h2 className="font-semibold text-sm">Conferma prenotazione — {selectedSlot}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Nome</Label>
                <Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Il tuo nome" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
                <Input type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="la@tua.email" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Messaggio (opzionale)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Di cosa vorresti parlare?" rows={2} />
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !guestName.trim() || !guestEmail.trim()} className="w-full">
              {submitting ? 'Invio...' : 'Richiedi appuntamento'}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              L'appuntamento dovrà essere confermato dal proprietario del calendario.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
