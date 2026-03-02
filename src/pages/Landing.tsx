import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import {
  Rocket,
  Target,
  Calendar,
  Brain,
  BarChart3,
  RefreshCw,
  Shield,
  Zap,
  ArrowRight,
  Layers,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const features = [
  {
    icon: Layers,
    title: 'Imprese & Progetti',
    description:
      'Organizza le tue attività imprenditoriali in Imprese, Progetti e Task con priorità strategica, operativa o di manutenzione.',
  },
  {
    icon: Target,
    title: 'OKR & Focus Period',
    description:
      'Definisci Obiettivi e Key Results per ogni impresa. Crea periodi di focus per concentrare le energie dove conta.',
  },
  {
    icon: Calendar,
    title: 'Calendario Intelligente',
    description:
      "Pianifica la tua settimana con drag & drop. Visualizza task, appuntamenti e rituali in un'unica vista.",
  },
  {
    icon: RefreshCw,
    title: 'Rituali & Disciplina',
    description:
      'Slot fissi o cadenza flessibile: gestisci i rituali che costruiscono la tua disciplina imprenditoriale.',
  },
  {
    icon: BarChart3,
    title: 'Cockpit & Radar',
    description:
      'Dashboard in tempo reale con scoring delle imprese, avanzamento OKR e coerenza dei rituali settimanali.',
  },
  {
    icon: Brain,
    title: 'AI Personal Assistant',
    description:
      'Un assistente AI che conosce i tuoi dati: suggerisce priorità, analizza il carico e ti aiuta a decidere.',
  },
];

const pillars = [
  {
    icon: Rocket,
    label: 'Imprese',
    desc: 'Le tue attività imprenditoriali',
  },
  {
    icon: Shield,
    label: 'Rituali',
    desc: 'La tua disciplina quotidiana',
  },
  {
    icon: Zap,
    label: 'AI',
    desc: 'Il tuo copilota decisionale',
  },
];

export default function Landing() {
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setSubmitting(true);
    // For now, just show success - could be connected to a waitlist table later
    await new Promise((r) => setTimeout(r, 600));
    setSubmitted(true);
    setSubmitting(false);
    toast.success('Sei nella lista! Ti contatteremo presto.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-4 md:px-8">
          <div className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">FlyDeck</span>
            <span className="hidden sm:inline text-xs text-muted-foreground font-medium ml-1 uppercase tracking-widest">
              PRP
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Accedi</Link>
            </Button>
            <Button size="sm" disabled className="opacity-60 cursor-not-allowed">
              Registrati
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 md:px-8 pt-20 md:pt-32 pb-16 md:pb-24 text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-primary bg-accent px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Personal Resource Planning
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Il cockpit per
              <br />
              <span className="text-primary">l'imprenditore moderno</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
              FlyDeck è il tuo <strong>Personal Resource Planning</strong>: gestisci imprese, progetti,
              rituali e tempo con l'ausilio dell'AI come copilota decisionale.
            </p>
          </motion.div>

          {/* Waitlist CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {submitted ? (
              <div className="inline-flex items-center gap-2 text-primary font-medium bg-accent px-6 py-3 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                Sei nella waiting list!
              </div>
            ) : (
              <form
                onSubmit={handleWaitlist}
                className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto"
              >
                <Input
                  type="email"
                  placeholder="La tua email"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  required
                  className="h-12 text-base"
                />
                <Button type="submit" size="lg" disabled={submitting} className="w-full sm:w-auto h-12 px-8">
                  {submitting ? 'Invio...' : 'Iscriviti alla waiting list'}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </form>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Già registrato?{' '}
              <Link to="/auth" className="text-primary underline underline-offset-4">
                Accedi
              </Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* 3 Pillars */}
      <section className="border-t bg-card">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {pillars.map((p, i) => (
              <motion.div
                key={p.label}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                variants={fadeUp}
              >
                <Card className="p-6 text-center border-2 border-transparent hover:border-primary/20 transition-colors">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent mb-4">
                    <p.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold mb-1">{p.label}</h3>
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="border-t">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12 md:mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Tutto ciò che ti serve, in un unico cockpit
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Progettato per chi gestisce più attività contemporaneamente e vuole mantenere il controllo
              strategico senza perdersi nell'operatività.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-30px' }}
                variants={fadeUp}
              >
                <Card className="p-5 md:p-6 h-full group hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 w-10 h-10 rounded-xl bg-accent flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{f.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t bg-card">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Come funziona</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '01', title: 'Crea le Imprese', desc: 'Definisci le tue attività e il loro peso strategico.' },
              { step: '02', title: 'Pianifica', desc: 'Organizza task, rituali e obiettivi nel calendario.' },
              { step: '03', title: 'Esegui', desc: 'Completa le task quotidiane con priorità intelligenti.' },
              { step: '04', title: 'Analizza', desc: "Monitora il progresso nel Cockpit con l'AI." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="text-center"
              >
                <div className="text-4xl font-bold text-primary/20 mb-3">{s.step}</div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Pronto a prendere il controllo?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              FlyDeck è in accesso anticipato. Iscriviti alla waiting list per essere tra i primi a provarlo.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" asChild>
                <a href="#top" onClick={() => (document.querySelector('input[type="email"]') as HTMLElement)?.focus()}>
                  Iscriviti alla waiting list
                </a>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/auth">Accedi</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">FlyDeck</span>
            <span className="text-xs text-muted-foreground">© 2026</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Personal Resource Planning per l'imprenditore moderno.
          </p>
        </div>
      </footer>
    </div>
  );
}
