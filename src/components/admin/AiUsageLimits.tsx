import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, Activity } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface Limits {
  id: string;
  daily_global_limit: number;
  monthly_global_limit: number;
  is_enabled: boolean;
}

export function AiUsageLimits() {
  const [limits, setLimits] = useState<Limits | null>(null);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: limitsData }, { count: dailyCount }, { count: monthlyCount }] = await Promise.all([
      supabase.from('ai_usage_limits').select('*').limit(1).maybeSingle(),
      supabase
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase
        .from('ai_usage_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);
    setLimits(limitsData as Limits | null);
    setDailyUsed(dailyCount || 0);
    setMonthlyUsed(monthlyCount || 0);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!limits) return;
    setSaving(true);
    const { error } = await supabase
      .from('ai_usage_limits')
      .update({
        daily_global_limit: limits.daily_global_limit,
        monthly_global_limit: limits.monthly_global_limit,
        is_enabled: limits.is_enabled,
      })
      .eq('id', limits.id);
    setSaving(false);
    if (error) {
      toast.error('Errore: ' + error.message);
    } else {
      toast.success('Limiti aggiornati');
      load();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!limits) {
    return <div className="text-sm text-muted-foreground p-4">Nessuna configurazione trovata.</div>;
  }

  const dailyPct = Math.min(100, (dailyUsed / limits.daily_global_limit) * 100);
  const monthlyPct = Math.min(100, (monthlyUsed / limits.monthly_global_limit) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-primary" />
            Utilizzo corrente
          </CardTitle>
          <CardDescription>Conteggio chiamate AI globali (tutti gli utenti)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Oggi</span>
              <span className="font-medium tabular-nums">
                {dailyUsed.toLocaleString()} / {limits.daily_global_limit.toLocaleString()}
              </span>
            </div>
            <Progress value={dailyPct} className={dailyPct >= 90 ? '[&>div]:bg-destructive' : ''} />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-muted-foreground">Questo mese</span>
              <span className="font-medium tabular-nums">
                {monthlyUsed.toLocaleString()} / {limits.monthly_global_limit.toLocaleString()}
              </span>
            </div>
            <Progress value={monthlyPct} className={monthlyPct >= 90 ? '[&>div]:bg-destructive' : ''} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Soglie globali AI</CardTitle>
          <CardDescription>
            Quando le chiamate AI superano queste soglie, il sistema blocca temporaneamente nuove richieste per
            tutti gli utenti (gli admin restano sempre operativi). Si resetta automaticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="font-medium">Protezione attiva</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se disattivata, nessun limite viene applicato.
              </p>
            </div>
            <Switch
              checked={limits.is_enabled}
              onCheckedChange={(v) => setLimits({ ...limits, is_enabled: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Limite giornaliero</Label>
              <Input
                type="number"
                min={1}
                value={limits.daily_global_limit}
                onChange={(e) =>
                  setLimits({ ...limits, daily_global_limit: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Limite mensile</Label>
              <Input
                type="number"
                min={1}
                value={limits.monthly_global_limit}
                onChange={(e) =>
                  setLimits({ ...limits, monthly_global_limit: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
          </div>

          {!limits.is_enabled && (
            <div className="flex gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Protezione disattivata: il sistema potrebbe esaurire la quota AI in caso di abuso o bug.</span>
            </div>
          )}

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salva modifiche
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
