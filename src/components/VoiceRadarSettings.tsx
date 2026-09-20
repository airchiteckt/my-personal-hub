import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, PhoneIncoming, PhoneOutgoing, Loader2, RefreshCw, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
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

interface VoiceConfig {
  vapi_assistant_id: string | null;
  vapi_phone_number_id: string | null;
  radar_phone_display: string | null;
}

export function VoiceRadarSettings() {
  const { user } = useAuth();
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [linking, setLinking] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [cfgRes, callsRes] = await Promise.all([
      supabase
        .from('ai_voice_settings')
        .select('vapi_assistant_id, vapi_phone_number_id, radar_phone_display')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('voice_calls')
        .select('id, direction, phone_number, status, summary, started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(10),
    ]);
    setConfig((cfgRes.data as any) ?? null);
    setCalls((callsRes.data as any) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const activate = async () => {
    setActivating(true);
    const { data, error } = await supabase.functions.invoke('vapi-assistant-setup', { body: {} });
    setActivating(false);
    if (error) {
      toast({ title: 'Attivazione non riuscita', description: 'Riprova tra poco o contatta il supporto.', variant: 'destructive' });
      return;
    }
    if (data?.ok) {
      toast({ title: data.already_existed ? 'Radar vocale aggiornato' : 'Radar vocale attivato', description: 'Assistente VAPI pronto. Manca solo il numero di telefono.' });
      load();
    } else {
      toast({ title: 'Attivazione non riuscita', description: data?.error ?? 'Errore sconosciuto', variant: 'destructive' });
    }
  };

  const linkNumber = async () => {
    if (!phoneNumberId.trim()) return;
    setLinking(true);
    const { data, error } = await supabase.functions.invoke('vapi-assistant-setup', {
      body: { phone_number_id: phoneNumberId.trim() },
    });
    setLinking(false);
    if (error || !data?.ok) {
      toast({ title: 'Collegamento non riuscito', description: data?.error ?? "Controlla l'ID del numero su VAPI.", variant: 'destructive' });
      return;
    }
    toast({ title: 'Numero collegato', description: 'Il numero di Radar è attivo.' });
    setPhoneNumberId('');
    load();
  };

  const configured = Boolean(config?.vapi_assistant_id);
  const phoneReady = Boolean(config?.vapi_phone_number_id);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Radar al telefono</h3>
        </div>
        <Badge variant={phoneReady ? 'default' : 'outline'} className="text-xs">
          {phoneReady ? 'Attivo' : configured ? 'Da completare' : 'Non configurato'}
        </Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Chiama Radar al telefono per dettare attività, appuntamenti e promemoria a voce — e lascia che ti telefoni lui per i promemoria importanti.
        Ti riconosce dal numero di cellulare salvato nel profilo.
      </p>

      {config?.radar_phone_display && (
        <div className="rounded-lg bg-muted/60 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Numero di Radar</p>
          <p className="text-lg font-mono font-semibold tracking-wide">{config.radar_phone_display}</p>
        </div>
      )}

      {!loading && !configured && (
        <Button onClick={activate} disabled={activating} size="sm" className="w-full">
          {activating ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Settings2 className="h-4 w-4 mr-1.5" />}
          Attiva Radar vocale
        </Button>
      )}

      {configured && !phoneReady && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" /> Ultimo passo: il numero di telefono
          </p>
          <p>1. Su <strong>dashboard.vapi.ai → Phone Numbers → Import from Twilio</strong>: importa il numero Twilio (es. 081...).</p>
          <p>2. Copia l'<strong>ID del numero</strong> appena importato e incollalo qui sotto.</p>
          <div className="flex gap-2 pt-1">
            <div className="flex-1 space-y-1">
              <Label htmlFor="vapi-phone-id" className="text-[11px]">ID numero VAPI</Label>
              <Input
                id="vapi-phone-id"
                value={phoneNumberId}
                onChange={e => setPhoneNumberId(e.target.value)}
                placeholder="Es. 3f8a… (dalla dashboard VAPI)"
                className="h-8 text-xs"
              />
            </div>
            <Button onClick={linkNumber} disabled={linking || !phoneNumberId.trim()} size="sm" className="self-end h-8">
              {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Collega'}
            </Button>
          </div>
        </div>
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
