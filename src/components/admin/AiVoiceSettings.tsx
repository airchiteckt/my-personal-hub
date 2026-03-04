import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Volume2, Mic, Brain, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceSettings {
  id: string;
  tts_voice_id: string;
  tts_model: string;
  tts_stability: number;
  tts_similarity_boost: number;
  tts_style: number;
  tts_speed: number;
  tts_use_speaker_boost: boolean;
  stt_model: string;
  stt_language_code: string;
  stt_diarize: boolean;
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  llm_system_prompt: string;
}

const TTS_VOICES = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily' },
];

const TTS_MODELS = [
  { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5 (Low Latency)' },
  { id: 'eleven_multilingual_v2', name: 'Multilingual v2 (Highest Quality)' },
  { id: 'eleven_turbo_v2', name: 'Turbo v2 (Fast)' },
];

const LLM_MODELS = [
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash (Fast)' },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro (Best)' },
  { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
  { id: 'openai/gpt-5', name: 'GPT-5' },
];

export function AiVoiceSettings() {
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modified, setModified] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data, error } = await supabase
      .from('ai_voice_settings' as any)
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      setSettings(data as any);
    }
    setLoading(false);
  };

  const update = (key: keyof VoiceSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    setModified(true);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { id, ...rest } = settings;
    const { error } = await supabase
      .from('ai_voice_settings' as any)
      .update(rest as any)
      .eq('id', id);

    if (error) {
      toast.error('Errore nel salvataggio');
    } else {
      toast.success('Parametri AI salvati');
      setModified(false);
    }
    setSaving(false);
  };

  if (loading || !settings) {
    return <div className="text-muted-foreground text-sm py-10 text-center">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      {/* TTS Section */}
      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <Volume2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Text-to-Speech (ElevenLabs)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Voce</Label>
            <Select value={settings.tts_voice_id} onValueChange={v => update('tts_voice_id', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TTS_VOICES.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Modello TTS</Label>
            <Select value={settings.tts_model} onValueChange={v => update('tts_model', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TTS_MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Stability</Label>
              <span className="text-xs font-mono text-muted-foreground">{settings.tts_stability}</span>
            </div>
            <Slider value={[settings.tts_stability]} onValueChange={([v]) => update('tts_stability', v)} min={0} max={1} step={0.05} />
            <p className="text-[10px] text-muted-foreground">Basso = più espressivo, Alto = più consistente</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Similarity Boost</Label>
              <span className="text-xs font-mono text-muted-foreground">{settings.tts_similarity_boost}</span>
            </div>
            <Slider value={[settings.tts_similarity_boost]} onValueChange={([v]) => update('tts_similarity_boost', v)} min={0} max={1} step={0.05} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Style</Label>
              <span className="text-xs font-mono text-muted-foreground">{settings.tts_style}</span>
            </div>
            <Slider value={[settings.tts_style]} onValueChange={([v]) => update('tts_style', v)} min={0} max={1} step={0.05} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label className="text-xs">Speed</Label>
              <span className="text-xs font-mono text-muted-foreground">{settings.tts_speed}x</span>
            </div>
            <Slider value={[settings.tts_speed]} onValueChange={([v]) => update('tts_speed', v)} min={0.7} max={1.2} step={0.05} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={settings.tts_use_speaker_boost} onCheckedChange={v => update('tts_use_speaker_boost', v)} />
            <Label className="text-xs">Speaker Boost (chiarezza voce)</Label>
          </div>
        </div>
      </Card>

      {/* STT Section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Speech-to-Text (ElevenLabs)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Modello STT</Label>
            <Select value={settings.stt_model} onValueChange={v => update('stt_model', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="scribe_v2">Scribe v2 (Batch)</SelectItem>
                <SelectItem value="scribe_v2_realtime">Scribe v2 Realtime (Streaming)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Lingua</Label>
            <Select value={settings.stt_language_code} onValueChange={v => update('stt_language_code', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ita">Italiano</SelectItem>
                <SelectItem value="eng">English</SelectItem>
                <SelectItem value="fra">Français</SelectItem>
                <SelectItem value="deu">Deutsch</SelectItem>
                <SelectItem value="spa">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={settings.stt_diarize} onCheckedChange={v => update('stt_diarize', v)} />
          <Label className="text-xs">Diarizzazione (identifica parlanti diversi)</Label>
        </div>
      </Card>

      {/* LLM Section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">LLM (Lovable AI Gateway)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Modello</Label>
            <Select value={settings.llm_model} onValueChange={v => update('llm_model', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LLM_MODELS.map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Max Tokens</Label>
            <Input
              type="number"
              value={settings.llm_max_tokens}
              onChange={e => update('llm_max_tokens', parseInt(e.target.value) || 256)}
              min={64}
              max={4096}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs">Temperature</Label>
            <span className="text-xs font-mono text-muted-foreground">{settings.llm_temperature}</span>
          </div>
          <Slider value={[settings.llm_temperature]} onValueChange={([v]) => update('llm_temperature', v)} min={0} max={1.5} step={0.05} />
          <p className="text-[10px] text-muted-foreground">Basso = deterministico, Alto = creativo</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">System Prompt (Radar Voice)</Label>
          <Textarea
            value={settings.llm_system_prompt}
            onChange={e => update('llm_system_prompt', e.target.value)}
            rows={4}
            className="font-mono text-xs resize-y"
          />
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-2">
        {modified && (
          <Badge variant="outline" className="text-warning border-warning self-center mr-2">
            Modifiche non salvate
          </Badge>
        )}
        <Button onClick={handleSave} disabled={!modified || saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? 'Salvataggio...' : 'Salva Parametri'}
        </Button>
      </div>
    </div>
  );
}
