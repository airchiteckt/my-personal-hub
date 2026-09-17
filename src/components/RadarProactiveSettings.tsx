import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BellRing, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Prefs = {
  enabled: boolean;
  pre_task: boolean;
  task_checkin: boolean;
  appointment: boolean;
  free_slot: boolean;
  deadline_risk: boolean;
  postponed: boolean;
  day_close: boolean;
  weekly_review: boolean;
  lead_minutes: number;
  day_close_time: string;
  max_per_hour: number;
  snoozed_until: string | null;
};

const DEFAULTS: Prefs = {
  enabled: true,
  pre_task: true,
  task_checkin: true,
  appointment: true,
  free_slot: true,
  deadline_risk: true,
  postponed: true,
  day_close: true,
  weekly_review: true,
  lead_minutes: 10,
  day_close_time: '18:30',
  max_per_hour: 4,
  snoozed_until: null,
};

const TOGGLES: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'pre_task', label: 'Promemoria prima delle attività', hint: 'Avviso poco prima dell\'orario previsto' },
  { key: 'task_checkin', label: 'Controllo a fine attività', hint: 'Chiede se è completata o serve più tempo' },
  { key: 'appointment', label: 'Appuntamenti imminenti', hint: 'Avviso 15 minuti prima' },
  { key: 'free_slot', label: 'Proposte nei momenti liberi', hint: 'Suggerisce cosa fare quando hai almeno 45 minuti' },
  { key: 'deadline_risk', label: 'Scadenze a rischio', hint: 'Attività in scadenza entro 48 ore non pianificate' },
  { key: 'postponed', label: 'Attività rimandate troppe volte', hint: 'Segnala quelle rimandate 3 volte o più' },
  { key: 'day_close', label: 'Chiusura della giornata', hint: 'Riepilogo serale e spostamento delle attività rimaste' },
  { key: 'weekly_review', label: 'Revisione settimanale', hint: 'Domenica alle 18:00' },
];

export const RadarProactiveSettings = () => {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return setLoading(false);
      const { data } = await supabase.from('radar_preferences').select('*').eq('user_id', auth.user.id).maybeSingle();
      if (data) setPrefs({ ...DEFAULTS, ...data } as Prefs);
      setLoading(false);
    })();
  }, []);

  const save = async (next: Prefs) => {
    setPrefs(next);
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setSaving(false);
    const { error } = await supabase.from('radar_preferences').upsert(
      { ...next, user_id: auth.user.id },
      { onConflict: 'user_id' },
    );
    setSaving(false);
    if (error) toast.error('Non sono riuscito a salvare le preferenze');
  };

  if (loading) {
    return (
      <Card className="p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carico le preferenze…
      </Card>
    );
  }

  const snoozed = prefs.snoozed_until && new Date(prefs.snoozed_until) > new Date();

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Radar proattivo</h3>
            <p className="text-xs text-muted-foreground">
              Radar ti segnala su Telegram cosa sta per iniziare, cosa chiudere e cosa rischia di slittare.
            </p>
          </div>
        </div>
        <Switch checked={prefs.enabled} onCheckedChange={(v) => save({ ...prefs, enabled: v })} />
      </div>

      {snoozed && (
        <div className="flex items-center justify-between rounded-md border border-dashed p-3 text-sm">
          <span>In pausa fino alle {new Date(prefs.snoozed_until!).toLocaleString('it-IT')}</span>
          <Button size="sm" variant="outline" onClick={() => save({ ...prefs, snoozed_until: null })}>
            Riprendi
          </Button>
        </div>
      )}

      <div className={prefs.enabled ? 'space-y-4' : 'space-y-4 opacity-50 pointer-events-none'}>
        <div className="space-y-3">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm">{t.label}</Label>
                <p className="text-xs text-muted-foreground">{t.hint}</p>
              </div>
              <Switch
                checked={Boolean(prefs[t.key])}
                onCheckedChange={(v) => save({ ...prefs, [t.key]: v })}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
          <div className="space-y-1.5">
            <Label className="text-xs">Anticipo avviso (min)</Label>
            <Input
              type="number" min={1} max={60} value={prefs.lead_minutes}
              onChange={(e) => setPrefs({ ...prefs, lead_minutes: Number(e.target.value) })}
              onBlur={() => save(prefs)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Chiusura giornata</Label>
            <Input
              type="time" value={prefs.day_close_time}
              onChange={(e) => setPrefs({ ...prefs, day_close_time: e.target.value })}
              onBlur={() => save(prefs)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Max messaggi/ora</Label>
            <Input
              type="number" min={1} max={12} value={prefs.max_per_hour}
              onChange={(e) => setPrefs({ ...prefs, max_per_hour: Number(e.target.value) })}
              onBlur={() => save(prefs)}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Su Telegram puoi scrivere <span className="font-medium">/pausa 3</span> per silenziarlo tre ore e{' '}
          <span className="font-medium">/riprendi</span> per riattivarlo.
        </p>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Salvataggio…</p>}
    </Card>
  );
};
