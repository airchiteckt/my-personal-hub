import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList, User, Mail, ArrowRight, ArrowLeft, CheckCircle2,
  AlertTriangle, TrendingUp, Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITIES = [
  { key: 'high', label: 'Alta', color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle },
  { key: 'medium', label: 'Media', color: 'bg-primary text-primary-foreground', icon: TrendingUp },
  { key: 'low', label: 'Bassa', color: 'bg-muted text-muted-foreground', icon: ClipboardList },
] as const;

type Step = 0 | 1 | 2;

export default function PublicTaskRequest() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<{ display_name: string | null; user_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState<Step>(0);

  // Step 0: task details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [deadline, setDeadline] = useState('');

  // Step 1: requester info
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!profile || !title.trim() || !requesterName.trim() || !requesterEmail.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('task_requests').insert({
      host_user_id: profile.user_id,
      requester_name: requesterName.trim(),
      requester_email: requesterEmail.trim(),
      title: title.trim(),
      description: description.trim() || null,
      suggested_priority: priority,
      suggested_deadline: deadline || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Errore nell'invio della richiesta");
    } else {
      setStep(2);
    }
  };

  const stepVariants = {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
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
          <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Pagina non trovata</h1>
          <p className="text-muted-foreground text-sm">Questo link non esiste o non è più attivo.</p>
        </Card>
      </div>
    );
  }

  const hostName = profile?.display_name || slug;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">{hostName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Open Request</p>
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
          {/* STEP 0: Task details */}
          {step === 0 && (
            <motion.div key="step0" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="pt-2">
                <h2 className="text-lg font-bold">Richiedi un'attività</h2>
                <p className="text-sm text-muted-foreground">
                  Descrivi cosa vorresti che {hostName} facesse per te
                </p>
              </div>

              <Card className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Titolo della richiesta *</Label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Es. Preparare presentazione progetto X"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Descrizione</Label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Dettagli aggiuntivi, contesto, link utili..."
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Priorità suggerita</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRIORITIES.map(p => {
                      const Icon = p.icon;
                      const active = priority === p.key;
                      return (
                        <button
                          key={p.key}
                          onClick={() => setPriority(p.key)}
                          className={`rounded-xl py-3 text-center transition-all ${
                            active
                              ? `${p.color} font-bold ring-2 ring-primary/20 shadow-sm`
                              : 'bg-muted/40 hover:bg-muted text-foreground'
                          }`}
                        >
                          <Icon className={`h-4 w-4 mx-auto mb-1 ${active ? '' : 'text-muted-foreground'}`} />
                          <div className="text-sm">{p.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" /> Scadenza suggerita (opzionale)
                  </Label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </Card>

              <Button
                onClick={() => setStep(1)}
                disabled={!title.trim()}
                className="w-full gap-2"
                size="lg"
              >
                Continua <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* STEP 1: Requester info */}
          {step === 1 && (
            <motion.div key="step1" {...stepVariants} transition={{ duration: 0.2 }} className="space-y-5">
              <div className="flex items-center gap-3 pt-2">
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h2 className="text-lg font-bold">Chi sei?</h2>
                  <p className="text-sm text-muted-foreground">I tuoi dati per il follow-up</p>
                </div>
              </div>

              {/* Summary */}
              <Card className="p-4 bg-primary/5 border-primary/15">
                <div className="flex items-center gap-3 text-sm">
                  <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {PRIORITIES.find(p => p.key === priority)?.label}
                      </Badge>
                      {deadline && (
                        <span className="text-[11px] text-muted-foreground">
                          Scadenza: {format(new Date(deadline + 'T00:00:00'), 'd MMM yyyy', { locale: it })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" /> Nome *</Label>
                  <Input value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Il tuo nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email *</Label>
                  <Input type="email" value={requesterEmail} onChange={e => setRequesterEmail(e.target.value)} placeholder="nome@email.com" />
                </div>
              </Card>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !requesterName.trim() || !requesterEmail.trim()}
                className="w-full gap-2"
                size="lg"
              >
                {submitting ? 'Invio in corso...' : 'Invia richiesta'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </Button>
            </motion.div>
          )}

          {/* STEP 2: Confirmation */}
          {step === 2 && (
            <motion.div key="step2" {...stepVariants} transition={{ duration: 0.2 }} className="flex flex-col items-center justify-center py-16 text-center space-y-5">
              <div className="h-16 w-16 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Richiesta inviata!</h2>
                <p className="text-muted-foreground text-sm max-w-sm">
                  La tua richiesta è stata inviata a <strong>{hostName}</strong>.
                  Riceverai un aggiornamento via email quando verrà presa in carico.
                </p>
              </div>
              <Card className="p-4 text-left w-full max-w-sm bg-muted/30">
                <p className="text-sm font-medium mb-1">{title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {PRIORITIES.find(p => p.key === priority)?.label}
                  </Badge>
                  {deadline && (
                    <span className="text-[11px] text-muted-foreground">
                      Scadenza: {format(new Date(deadline + 'T00:00:00'), 'd MMM yyyy', { locale: it })}
                    </span>
                  )}
                </div>
              </Card>
              <Button
                variant="outline"
                onClick={() => {
                  setStep(0);
                  setTitle('');
                  setDescription('');
                  setPriority('medium');
                  setDeadline('');
                  setRequesterName('');
                  setRequesterEmail('');
                }}
              >
                Invia un'altra richiesta
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
