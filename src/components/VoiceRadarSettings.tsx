import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneIncoming, PhoneOutgoing, RefreshCw, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface VoiceCall {
  id: string;
  direction: 'inbound' | 'outbound';
  phone_number: string;
  status: string;
  summary: string | null;
  started_at: string;
}

export function VoiceRadarSettings() {
  const { user } = useAuth();
  const [phoneDisplay, setPhoneDisplay] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [cfgRes, callsRes] = await Promise.all([
      supabase
        .from('ai_voice_settings')
        .select('vapi_phone_number_id, radar_phone_display')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('voice_calls')
        .select('id, direction, phone_number, status, summary, started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10),
    ]);
    const cfg = (cfgRes.data as any) ?? null;
    setPhoneDisplay(cfg?.radar_phone_display ?? null);
    setActive(Boolean(cfg?.vapi_phone_number_id));
    setCalls((callsRes.data as any) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Radar al telefono</h3>
        </div>
        <Badge variant={active ? 'default' : 'outline'} className="text-xs">
          {active ? 'Attivo' : 'In arrivo'}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Chiama Radar al telefono per dettare attività, appuntamenti e promemoria a voce — e lascia che ti telefoni lui per i promemoria importanti.
        Ti riconosce dal numero di cellulare salvato nel profilo.
      </p>

      {active && phoneDisplay && (
        <div className="rounded-lg bg-muted/60 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Numero di Radar</p>
          <p className="text-lg font-mono font-semibold tracking-wide">{phoneDisplay}</p>
        </div>
      )}

      {!active && !loading && (
        <p className="text-xs text-muted-foreground">
          Il servizio telefonico non è ancora disponibile. Ti avviseremo appena sarà attivo.
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ultime chiamate</p>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="h-7 px-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna chiamata ancora.</p>
        ) : (
          <div className="space-y-1.5">
            {calls.map(c => (
              <div key={c.id} className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm">
                {c.direction === 'inbound'
                  ? <PhoneIncoming className="h-4 w-4 text-primary shrink-0" />
                  : <PhoneOutgoing className="h-4 w-4 text-destructive shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-xs">
                    {c.direction === 'inbound' ? 'Chiamata fatta da te' : 'Chiamata di Radar'}
                    {c.summary ? ` — ${c.summary}` : ''}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(new Date(c.started_at), "d MMM yyyy, HH:mm", { locale: it })}
                  </p>
                </div>
                {c.status === 'completed'
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  : <Badge variant="outline" className="text-[10px] shrink-0">{c.status}</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
