import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Building2, Target, ListChecks, CalendarDays, Repeat, Gauge, Sparkles, Rocket,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_PREFIX = 'flydeck_onboarding_completed_';

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  highlights: string[];
}

const STEPS: Step[] = [
  {
    icon: Rocket,
    title: 'Benvenuto in FlyDeck',
    description: 'Il tuo centro di esecuzione strategica. Ti guido in 60 secondi tra le funzionalità chiave per partire subito con il piede giusto.',
    highlights: [
      'Pianifica con metodo: Imprese → Progetti → Task',
      'Esegui con focus: timeline giornaliera e backlog intelligente',
      'Misura i risultati: OKR e Focus Period trimestrali',
    ],
  },
  {
    icon: Building2,
    title: '1. Crea le tue Imprese',
    description: 'Le Imprese sono le aree di vita o business su cui investi tempo (es. "Lavoro principale", "Side project", "Salute"). Sono la radice di tutto.',
    highlights: [
      'Vai in "Imprese" e crea la tua prima area',
      'Scegli un colore per identificarla nel calendario',
      'Definisci priorità strategica e potenziale di crescita',
    ],
  },
  {
    icon: Target,
    title: '2. Imposta Focus e Obiettivi',
    description: 'Per ogni Impresa puoi definire un Focus Period di 90 giorni con Obiettivi e Key Result misurabili. È il cuore della pianificazione strategica.',
    highlights: [
      'Apri il dettaglio di un\'Impresa',
      'Crea un Focus Period (es. Q1) con Obiettivi e KR',
      'Collega i progetti strategici ai Key Result',
    ],
  },
  {
    icon: ListChecks,
    title: '3. Aggiungi Progetti e Task',
    description: 'I Progetti si dividono in Strategici (collegati ai KR), Operativi e di Manutenzione. Ogni Task appartiene sempre a un Progetto.',
    highlights: [
      'Strategic: spinge i risultati del Focus',
      'Operational: gestisce il day-by-day',
      'Maintenance: mantiene attivo l\'esistente',
    ],
  },
  {
    icon: CalendarDays,
    title: '4. Pianifica la giornata',
    description: 'La pagina "Oggi" è il tuo centro di esecuzione: vedi timeline, backlog intelligente con le top priorità e suggerimenti automatici.',
    highlights: [
      'Trascina le task dal backlog alla timeline',
      'Usa "Schedule Top 3" per pianificare in un click',
      'Le task non completate vengono riprogrammate automaticamente',
    ],
  },
  {
    icon: Repeat,
    title: '5. Crea i tuoi Rituali',
    description: 'I Rituali sono routine ricorrenti per performance e governance personale (es. revisione settimanale, sport, lettura).',
    highlights: [
      'Slot fisso o cadenza libera (N volte/settimana)',
      'Categorie: Strategico, Governance, Operativo, Performance',
      'Completamento manuale per tenere il controllo',
    ],
  },
  {
    icon: Gauge,
    title: '6. Monitora con il Cockpit',
    description: 'Il Cockpit ti mostra avanzamento OKR, allocazione tempo per Impresa e suggerimenti dell\'AI Radar per ottimizzare la tua strategia.',
    highlights: [
      'Score di priorità di ogni Impresa',
      'Analisi mismatch tra tempo speso e priorità',
      'Suggerimenti AI per ribilanciare il portfolio',
    ],
  },
  {
    icon: Sparkles,
    title: 'Sei pronto al decollo!',
    description: 'Ora tocca a te. Inizia creando la tua prima Impresa: bastano 30 secondi per gettare le basi del tuo sistema strategico.',
    highlights: [
      'Puoi rivedere questa guida in Impostazioni',
      'L\'assistente AI è disponibile sul pulsante in basso a destra',
      'Buon lavoro!',
    ],
  },
];

export function OnboardingTour() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (loading || !user) return;
    const key = `${STORAGE_PREFIX}${user.id}`;
    const completed = localStorage.getItem(key);
    if (!completed) {
      // small delay to avoid colliding with other dialogs/animations
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user, loading]);

  const close = (markComplete: boolean) => {
    if (markComplete && user) {
      localStorage.setItem(`${STORAGE_PREFIX}${user.id}`, new Date().toISOString());
    }
    setOpen(false);
    setTimeout(() => setStep(0), 300);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close(true)}>
      <DialogContent className="max-w-xl p-0 overflow-hidden gap-0">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pb-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Step {step + 1} di {STEPS.length}
            </span>
            <button
              onClick={() => close(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Salta tour
            </button>
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        <div className="p-6 pt-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <DialogHeader className="space-y-3 text-left">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <DialogTitle className="text-xl">{current.title}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  {current.description}
                </DialogDescription>
              </DialogHeader>

              <ul className="mt-5 space-y-2">
                {current.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span className="text-foreground/90">{h}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-7 pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              Indietro
            </Button>
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted hover:bg-muted-foreground/30'
                  }`}
                  aria-label={`Vai allo step ${i + 1}`}
                />
              ))}
            </div>
            {isLast ? (
              <Button size="sm" onClick={() => close(true)}>
                Inizia
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Avanti
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function resetOnboarding(userId: string) {
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
}
