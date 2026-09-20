import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Phone, Loader2, Settings2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface VapiSettings {
  id: string;
  vapi_assistant_id: string | null;
  vapi_phone_number_id: string | null;
  radar_phone_display: string | null;
}

export function VapiConfig() {
  const [settings, setSettings] = useState<VapiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_voice_settings' as any)
      .select('id, vapi_assistant_id, vapi_phone_number_id, radar_phone_display')
      .limit(1)
      .maybeSingle();
    const s = (data as any) ?? null;
    setSettings(s);
    setPhoneNumberId(s?.vapi_phone_number_id ?? '');
    setPhoneDisplay(s?.radar_phone_display ?? '');
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async () => {
    setActivating(true);
    const { data, error } = await supabase.functions.invoke('vapi-assistant-setup', { body: {} });
    setActivating(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? 'Attivazione assistente non riuscita');
      return;
    }
    toast.success(data.already_existed ? 'Assistente VAPI aggiornato' : 'Assistente VAPI creato');
    load();
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('vapi-assistant-setup', {
      body: { phone_number_id: phoneNumberId.trim() || undefined },
    });
    if (error || !data?.ok) {
      setSaving(false);
      toast.error(data?.error ?? 'Collegamento numero non riuscito');
      return;
    }
    const { error: upErr } = await supabase
      .from('ai_voice_settings' as any)
      .update({ radar_phone_display: phoneDisplay.trim() || null } as any)
      .eq('id', settings.id);
    setSaving(false);
    if (upErr) { toast.error('Errore nel salvataggio del numero visualizzato'); return; }
    toast.success('Configurazione VAPI salvata');
    load();
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm py-10 text-center">Caricamento...</div>;
  }

  const configured = Boolean(settings?.vapi_assistant_id);
  const phoneReady = Boolean(settings?.vapi_phone_number_id);

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Radar vocale (VAPI)</h3>
        </div>
        <Badge variant={phoneReady ? 'default' : 'outline'} className="text-xs">
          {phoneReady ? 'Operativo' : configured ? 'Assistente pronto' : 'Non configurato'}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Configurazione globale del canale telefonico. Il numero è unico per tutti gli utenti:
        VAPI inoltra la chiamata al webhook, che riconosce il chiamante dal numero salvato nel profilo.
      </p>

      <div className="space-y-2">
        <Label className="text-xs">Assistente VAPI</Label>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={settings?.vapi_assistant_id ?? 'Nessun assistente'}
            className="font-mono text-xs"
          />
          <Button onClick={activate} disabled={activating} size="sm" variant={configured ? 'outline' : 'default'}>
            {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            <span className="ml-1.5">{configured ? 'Aggiorna' : 'Crea'}</span>
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Crea o riallinea l'assistente "Radar FlyDeck" su VAPI (prompt, voce, strumenti, webhook).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs">ID numero VAPI (SIP trunk)</Label>
          <Input
            value={phoneNumberId}
            onChange={e => setPhoneNumberId(e.target.value)}
            placeholder="es. 3f8a1c…"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Numero aggiunto in VAPI via SIP trunk, senza assistente assegnato.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Numero mostrato agli utenti</Label>
          <Input
            value={phoneDisplay}
            onChange={e => setPhoneDisplay(e.target.value)}
            placeholder="+39 081 000 0000"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !configured}>
          {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
          Salva configurazione
        </Button>
      </div>
    </Card>
  );
}
