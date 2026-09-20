import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Loader2, Settings2, Save, Brain, Volume2, Mic, Gauge, DownloadCloud, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_VAPI_TUNING, type VapiTuning } from '@/types/vapiTuning';
import {
  VAPI_AI_MODELS,
  VAPI_VOICE_PROVIDERS,
  VAPI_TRANSCRIBER_PROVIDERS,
  getTtsOptions,
  getTranscriberOptions,
  getAiProviderFromModel,
} from '@/constants/vapiOptions';

interface VapiSettingsRow {
  id: string;
  vapi_assistant_id: string | null;
  vapi_phone_number_id: string | null;
  radar_phone_display: string | null;
  vapi_tuning: Partial<VapiTuning> | null;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function VapiConfig() {
  const [settings, setSettings] = useState<VapiSettingsRow | null>(null);
  const [tuning, setTuning] = useState<VapiTuning>(DEFAULT_VAPI_TUNING);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [importing, setImporting] = useState(false);
  const [modified, setModified] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ai_voice_settings' as any)
      .select('id, vapi_assistant_id, vapi_phone_number_id, radar_phone_display, vapi_tuning')
      .limit(1)
      .maybeSingle();
    const s = (data as any) ?? null;
    setSettings(s);
    setTuning({ ...DEFAULT_VAPI_TUNING, ...(s?.vapi_tuning ?? {}) });
    setPhoneNumberId(s?.vapi_phone_number_id ?? '');
    setPhoneDisplay(s?.radar_phone_display ?? '');
    setModified(false);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof VapiTuning>(key: K, value: VapiTuning[K]) => {
    setTuning(prev => ({ ...prev, [key]: value }));
    setModified(true);
  };

  const apply = async () => {
    setApplying(true);
    const { data, error } = await supabase.functions.invoke('vapi-assistant-setup', {
      body: { tuning, phone_number_id: phoneNumberId.trim() || undefined },
    });
    if (error || !data?.ok) {
      setApplying(false);
      toast.error(data?.error ?? error?.message ?? 'Sincronizzazione con VAPI non riuscita');
      return;
    }
    if (settings) {
      await supabase
        .from('ai_voice_settings' as any)
        .update({ radar_phone_display: phoneDisplay.trim() || null } as any)
        .eq('id', settings.id);
    }
    setApplying(false);
    toast.success(data.already_existed ? 'Assistente VAPI aggiornato' : 'Assistente VAPI creato');
    load();
  };

  const importFromVapi = async () => {
    setImporting(true);
    const { data, error } = await supabase.functions.invoke('vapi-assistant-setup', { body: { action: 'import' } });
    setImporting(false);
    if (error || !data?.ok) {
      toast.error(data?.error ?? error?.message ?? 'Importazione non riuscita');
      return;
    }
    setTuning({ ...DEFAULT_VAPI_TUNING, ...(data.tuning ?? {}) });
    setModified(false);
    toast.success('Configurazione importata da VAPI');
  };

  const resetDefaults = () => {
    setTuning(DEFAULT_VAPI_TUNING);
    setModified(true);
    toast.info('Valori consigliati ripristinati: premi "Salva e applica su VAPI" per confermare');
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm py-10 text-center">Caricamento...</div>;
  }

  const configured = Boolean(settings?.vapi_assistant_id);
  const phoneReady = Boolean(settings?.vapi_phone_number_id);
  const ttsOptions = getTtsOptions(tuning.voiceProvider);
  const sttOptions = getTranscriberOptions(tuning.transcriberProvider);
  const isElevenLabs = tuning.voiceProvider === '11labs';
  const customVoice = ttsOptions.voices
    ? !ttsOptions.voices.some(v => v.value === tuning.voiceId)
    : true;

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Radar al telefono (VAPI)</h3>
          </div>
          <Badge variant={phoneReady ? 'default' : 'outline'} className="text-xs">
            {phoneReady ? 'Operativo' : configured ? 'Assistente pronto' : 'Non configurato'}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Configurazione globale del canale telefonico. Il numero è unico per tutti gli utenti: VAPI inoltra la
          chiamata al webhook di FlyDeck, che riconosce il chiamante dal numero salvato nel profilo. Gli strumenti
          operativi di Radar (attività, appuntamenti, promemoria, OKR) restano sempre attivi.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Row label="Assistente VAPI">
            <Input readOnly value={settings?.vapi_assistant_id ?? 'Nessun assistente'} className="font-mono text-xs" />
          </Row>
          <Row label="ID numero VAPI" hint="Numero importato in VAPI, senza assistente assegnato.">
            <Input value={phoneNumberId} onChange={e => setPhoneNumberId(e.target.value)} placeholder="es. 3f8a1c…" className="font-mono text-xs" />
          </Row>
          <Row label="Numero mostrato agli utenti">
            <Input value={phoneDisplay} onChange={e => setPhoneDisplay(e.target.value)} placeholder="+39 081 000 0000" />
          </Row>
        </div>
      </Card>

      <Tabs defaultValue="llm" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="llm" className="text-xs"><Brain className="h-3.5 w-3.5 mr-1.5" />Cervello</TabsTrigger>
          <TabsTrigger value="voice" className="text-xs"><Volume2 className="h-3.5 w-3.5 mr-1.5" />Voce</TabsTrigger>
          <TabsTrigger value="stt" className="text-xs"><Mic className="h-3.5 w-3.5 mr-1.5" />Ascolto</TabsTrigger>
          <TabsTrigger value="flow" className="text-xs"><Gauge className="h-3.5 w-3.5 mr-1.5" />Dinamica</TabsTrigger>
        </TabsList>

        {/* ---------- LLM ---------- */}
        <TabsContent value="llm" className="mt-4">
          <Card className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Row label="Modello AI" hint="Il modello che ragiona e sceglie gli strumenti durante la chiamata.">
                <Select
                  value={tuning.llmModel}
                  onValueChange={v => {
                    setTuning(prev => ({ ...prev, llmModel: v, llmProvider: getAiProviderFromModel(v) }));
                    setModified(true);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {VAPI_AI_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label} — {m.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Provider" hint="Impostato automaticamente dal modello scelto.">
                <Input readOnly value={tuning.llmProvider} className="font-mono text-xs" />
              </Row>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Temperatura</Label>
                <span className="text-xs font-mono text-muted-foreground">{tuning.temperature}</span>
              </div>
              <Slider value={[tuning.temperature]} onValueChange={([v]) => set('temperature', v)} min={0} max={1.5} step={0.05} />
              <p className="text-[10px] text-muted-foreground">Basso = preciso e prevedibile, alto = più creativo.</p>
            </div>

            <Row label="Max token per risposta" hint="Tenerlo basso mantiene le risposte telefoniche brevi e veloci.">
              <Input type="number" min={64} max={2048} value={tuning.maxTokens} onChange={e => set('maxTokens', parseInt(e.target.value) || 250)} />
            </Row>

            <Row label="Messaggio di apertura">
              <Input value={tuning.firstMessage} onChange={e => set('firstMessage', e.target.value)} />
            </Row>

            <Row
              label="System prompt di Radar"
              hint="È lo stesso prompt usato nelle chiamate. Le variabili {{user_name}}, {{now_info}}, {{day_summary}}, {{context_brief}} vengono riempite a ogni chiamata: non rimuoverle."
            >
              <div className="space-y-2">
                <Textarea
                  rows={22}
                  value={tuning.systemPrompt || RADAR_VOICE_SYSTEM_PROMPT}
                  onChange={e => set('systemPrompt', e.target.value)}
                  className="font-mono text-xs resize-y leading-relaxed"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {(tuning.systemPrompt || RADAR_VOICE_SYSTEM_PROMPT).length} caratteri
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => set('systemPrompt', RADAR_VOICE_SYSTEM_PROMPT)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Ripristina prompt Radar
                  </Button>
                </div>
              </div>
            </Row>
          </Card>
        </TabsContent>

        {/* ---------- Voice ---------- */}
        <TabsContent value="voice" className="mt-4">
          <Card className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Row label="Provider voce">
                <Select value={tuning.voiceProvider} onValueChange={v => { setTuning(p => ({ ...p, voiceProvider: v })); setModified(true); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {VAPI_VOICE_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label} — {p.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>

              {ttsOptions.models && (
                <Row label="Modello voce">
                  <Select value={tuning.voiceModel || ''} onValueChange={v => set('voiceModel', v)}>
                    <SelectTrigger><SelectValue placeholder="Predefinito" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {ttsOptions.models.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label} — {m.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
              )}
            </div>

            {ttsOptions.voices && (
              <Row label="Voce">
                <Select
                  value={customVoice ? 'custom' : tuning.voiceId}
                  onValueChange={v => set('voiceId', v === 'custom' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Scegli voce" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {ttsOptions.voices.map(v => (
                      <SelectItem key={v.value} value={v.value}>{v.label}{'description' in v ? ` — ${v.description}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            )}

            <Row label="Voice ID" hint="Identificativo esatto della voce inviato a VAPI.">
              <Input value={tuning.voiceId} onChange={e => set('voiceId', e.target.value)} className="font-mono text-xs" />
            </Row>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs">Velocità</Label>
                <span className="text-xs font-mono text-muted-foreground">{tuning.voiceSpeed}x</span>
              </div>
              <Slider value={[tuning.voiceSpeed]} onValueChange={([v]) => set('voiceSpeed', v)} min={0.7} max={1.3} step={0.01} />
            </div>

            {isElevenLabs && (
              <div className="space-y-4 rounded-lg border border-border/60 p-4">
                <p className="text-xs font-medium">Parametri ElevenLabs</p>
                <div className="space-y-2">
                  <div className="flex justify-between"><Label className="text-xs">Stabilità</Label><span className="text-xs font-mono text-muted-foreground">{tuning.voiceStability}</span></div>
                  <Slider value={[tuning.voiceStability]} onValueChange={([v]) => set('voiceStability', v)} min={0} max={1} step={0.05} />
                  <p className="text-[10px] text-muted-foreground">Basso = più espressivo, alto = più costante.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><Label className="text-xs">Somiglianza</Label><span className="text-xs font-mono text-muted-foreground">{tuning.voiceSimilarityBoost}</span></div>
                  <Slider value={[tuning.voiceSimilarityBoost]} onValueChange={([v]) => set('voiceSimilarityBoost', v)} min={0} max={1} step={0.05} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><Label className="text-xs">Stile</Label><span className="text-xs font-mono text-muted-foreground">{tuning.voiceStyle}</span></div>
                  <Slider value={[tuning.voiceStyle]} onValueChange={([v]) => set('voiceStyle', v)} min={0} max={1} step={0.05} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={tuning.voiceUseSpeakerBoost} onCheckedChange={v => set('voiceUseSpeakerBoost', v)} />
                  <Label className="text-xs">Speaker boost (più chiarezza)</Label>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ---------- STT ---------- */}
        <TabsContent value="stt" className="mt-4">
          <Card className="p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Row label="Provider trascrizione">
                <Select value={tuning.transcriberProvider} onValueChange={v => { setTuning(p => ({ ...p, transcriberProvider: v })); setModified(true); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {VAPI_TRANSCRIBER_PROVIDERS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label} — {p.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              {sttOptions.models ? (
                <Row label="Modello">
                  <Select value={tuning.transcriberModel || ''} onValueChange={v => set('transcriberModel', v)}>
                    <SelectTrigger><SelectValue placeholder="Predefinito" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {sttOptions.models.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label} — {m.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
              ) : (
                <Row label="Modello" hint="Questo provider non richiede un modello.">
                  <Input value={tuning.transcriberModel} onChange={e => set('transcriberModel', e.target.value)} placeholder="—" />
                </Row>
              )}
              <Row label="Lingua">
                <Select value={tuning.transcriberLanguage} onValueChange={v => set('transcriberLanguage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {sttOptions.languages?.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={tuning.smartDenoisingEnabled} onCheckedChange={v => set('smartDenoisingEnabled', v)} />
              <Label className="text-xs">Riduzione intelligente del rumore di fondo</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={tuning.recordingEnabled} onCheckedChange={v => set('recordingEnabled', v)} />
              <Label className="text-xs">Registra le chiamate (per riascolto e analisi)</Label>
            </div>
          </Card>
        </TabsContent>

        {/* ---------- Conversation dynamics ---------- */}
        <TabsContent value="flow" className="mt-4">
          <Card className="p-5 space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-medium">Quando Radar prende la parola</p>
              <div className="space-y-2">
                <div className="flex justify-between"><Label className="text-xs">Attesa prima di rispondere</Label><span className="text-xs font-mono text-muted-foreground">{tuning.startSpeakingWaitSeconds}s</span></div>
                <Slider value={[tuning.startSpeakingWaitSeconds]} onValueChange={([v]) => set('startSpeakingWaitSeconds', v)} min={0} max={2} step={0.05} />
                <p className="text-[10px] text-muted-foreground">Più basso = risposta immediata, più alto = meno rischio di tagliare la frase.</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={tuning.smartEndpointingEnabled} onCheckedChange={v => set('smartEndpointingEnabled', v)} />
                <Label className="text-xs">Rilevamento intelligente di fine frase</Label>
              </div>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium">Quando puoi interrompere Radar</p>
              <div className="space-y-2">
                <div className="flex justify-between"><Label className="text-xs">Parole minime per interrompere</Label><span className="text-xs font-mono text-muted-foreground">{tuning.stopSpeakingNumWords}</span></div>
                <Slider value={[tuning.stopSpeakingNumWords]} onValueChange={([v]) => set('stopSpeakingNumWords', v)} min={0} max={10} step={1} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><Label className="text-xs">Durata voce per interrompere</Label><span className="text-xs font-mono text-muted-foreground">{tuning.stopSpeakingVoiceSeconds}s</span></div>
                <Slider value={[tuning.stopSpeakingVoiceSeconds]} onValueChange={([v]) => set('stopSpeakingVoiceSeconds', v)} min={0} max={1} step={0.05} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between"><Label className="text-xs">Pausa dopo l'interruzione</Label><span className="text-xs font-mono text-muted-foreground">{tuning.stopSpeakingBackoffSeconds}s</span></div>
                <Slider value={[tuning.stopSpeakingBackoffSeconds]} onValueChange={([v]) => set('stopSpeakingBackoffSeconds', v)} min={0} max={3} step={0.1} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={tuning.firstMessageInterruptionsEnabled} onCheckedChange={v => set('firstMessageInterruptionsEnabled', v)} />
                <Label className="text-xs">Si può interrompere già il saluto iniziale</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={tuning.backchannelingEnabled} onCheckedChange={v => set('backchannelingEnabled', v)} />
                <Label className="text-xs">Segnali di ascolto ("mhm", "certo") mentre parli</Label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border/60 pt-5">
              <Row label="Silenzio massimo (s)" hint="Dopo questo silenzio la chiamata si chiude.">
                <Input type="number" min={5} max={120} value={tuning.silenceTimeoutSeconds} onChange={e => set('silenceTimeoutSeconds', parseInt(e.target.value) || 20)} />
              </Row>
              <Row label="Durata massima chiamata (s)">
                <Input type="number" min={60} max={3600} value={tuning.maxDurationSeconds} onChange={e => set('maxDurationSeconds', parseInt(e.target.value) || 900)} />
              </Row>
              <Row label="Suono di fondo">
                <Select value={tuning.backgroundSound} onValueChange={v => set('backgroundSound', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Nessuno</SelectItem>
                    <SelectItem value="office">Ufficio</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {modified && (
          <Badge variant="outline" className="text-warning border-warning self-center mr-auto">
            Modifiche non applicate
          </Badge>
        )}
        <Button variant="ghost" size="sm" onClick={resetDefaults}>
          <RotateCcw className="h-4 w-4 mr-1.5" />Valori consigliati
        </Button>
        <Button variant="outline" size="sm" onClick={importFromVapi} disabled={importing || !configured}>
          {importing ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <DownloadCloud className="h-4 w-4 mr-1.5" />}
          Importa da VAPI
        </Button>
        <Button onClick={apply} disabled={applying}>
          {applying ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : configured ? <Save className="h-4 w-4 mr-1.5" /> : <Settings2 className="h-4 w-4 mr-1.5" />}
          {configured ? 'Salva e applica su VAPI' : 'Crea assistente su VAPI'}
        </Button>
      </div>
    </div>
  );
}
