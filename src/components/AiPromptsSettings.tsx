import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Save, RotateCcw, Bot, Brain, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface PromptConfig {
  function_key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  defaultPrompt: string;
}

const PROMPT_CONFIGS: PromptConfig[] = [
  {
    function_key: 'general',
    label: 'Assistente Generale',
    description: 'Prompt per la chat generale con l\'assistente AI',
    icon: MessageSquare,
    defaultPrompt: `Sei l'assistente AI di PRP (Personal Resource Planning). Aiuti l'utente a gestire imprese, progetti e task. Rispondi in italiano, in modo conciso e utile.`,
  },
  {
    function_key: 'reminder',
    label: 'Promemoria & Priorità',
    description: 'Prompt per promemoria, scadenze e suggerimenti di priorità',
    icon: Clock,
    defaultPrompt: `Sei un assistente AI per la gestione del tempo e produttività personale. Il tuo compito è:
- Analizzare le task dell'utente e ricordare scadenze imminenti
- Suggerire priorità basate su urgenza e importanza
- Dare consigli brevi e azionabili
Rispondi sempre in italiano, in modo conciso e pratico.`,
  },
  {
    function_key: 'task_suggest',
    label: 'Suggeritore Task',
    description: 'Prompt per suggerire nuove task basate sul contesto',
    icon: Brain,
    defaultPrompt: `Sei un assistente AI specializzato nel suggerire task. Basandoti sul contesto dei progetti e delle imprese dell'utente:
- Suggerisci task specifiche e azionabili
- Indica priorità (high/medium/low) e stima di tempo in minuti
- Considera le task già esistenti per evitare duplicati
Rispondi in italiano con suggerimenti strutturati.`,
  },
  {
    function_key: 'effort_estimate',
    label: 'Stima Impegno',
    description: 'Prompt per stimare il tempo necessario per le task',
    icon: Bot,
    defaultPrompt: `Sei un assistente AI per la stima dell'impegno. Il tuo compito è:
- Stimare i minuti necessari per completare una task
- Considerare complessità, dipendenze e rischi
- Fornire una stima ottimistica, realistica e pessimistica
Rispondi in italiano in modo chiaro e sintetico.`,
  },
];

interface PromptState {
  id?: string;
  system_prompt: string;
  is_active: boolean;
  modified: boolean;
}

export function AiPromptsSettings() {
  const { user } = useAuth();
  const [prompts, setPrompts] = useState<Record<string, PromptState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPrompts();
  }, [user]);

  const loadPrompts = async () => {
    const { data } = await supabase
      .from('ai_prompts')
      .select('*')
      .eq('user_id', user!.id);

    const state: Record<string, PromptState> = {};
    for (const cfg of PROMPT_CONFIGS) {
      const existing = data?.find((d: any) => d.function_key === cfg.function_key);
      state[cfg.function_key] = {
        id: existing?.id,
        system_prompt: existing?.system_prompt ?? cfg.defaultPrompt,
        is_active: existing?.is_active ?? true,
        modified: false,
      };
    }
    setPrompts(state);
    setLoading(false);
  };

  const handleChange = (key: string, field: 'system_prompt' | 'is_active', value: string | boolean) => {
    setPrompts(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value, modified: true },
    }));
  };

  const handleReset = (key: string) => {
    const cfg = PROMPT_CONFIGS.find(c => c.function_key === key)!;
    setPrompts(prev => ({
      ...prev,
      [key]: { ...prev[key], system_prompt: cfg.defaultPrompt, modified: true },
    }));
  };

  const handleSave = async (key: string) => {
    if (!user) return;
    setSaving(key);
    const p = prompts[key];
    const cfg = PROMPT_CONFIGS.find(c => c.function_key === key)!;

    if (p.id) {
      const { error } = await supabase
        .from('ai_prompts')
        .update({ system_prompt: p.system_prompt, is_active: p.is_active })
        .eq('id', p.id);
      if (error) toast.error('Errore salvataggio');
      else {
        toast.success(`Prompt "${cfg.label}" salvato`);
        setPrompts(prev => ({ ...prev, [key]: { ...prev[key], modified: false } }));
      }
    } else {
      const { data, error } = await supabase
        .from('ai_prompts')
        .insert({
          user_id: user.id,
          function_key: key,
          label: cfg.label,
          description: cfg.description,
          system_prompt: p.system_prompt,
          is_active: p.is_active,
        })
        .select()
        .single();
      if (error) toast.error('Errore salvataggio');
      else {
        toast.success(`Prompt "${cfg.label}" salvato`);
        setPrompts(prev => ({
          ...prev,
          [key]: { ...prev[key], id: data.id, modified: false },
        }));
      }
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {PROMPT_CONFIGS.map(cfg => {
        const p = prompts[cfg.function_key];
        if (!p) return null;
        const Icon = cfg.icon;

        return (
          <Card key={cfg.function_key} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-accent-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{cfg.label}</h3>
                    <Badge variant={p.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {p.is_active ? 'Attivo' : 'Disattivato'}
                    </Badge>
                    {p.modified && (
                      <Badge variant="outline" className="text-[10px] text-warning border-warning">
                        Non salvato
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`active-${cfg.function_key}`} className="text-xs text-muted-foreground">
                  Attivo
                </Label>
                <Switch
                  id={`active-${cfg.function_key}`}
                  checked={p.is_active}
                  onCheckedChange={(v) => handleChange(cfg.function_key, 'is_active', v)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">System Prompt</Label>
              <Textarea
                value={p.system_prompt}
                onChange={(e) => handleChange(cfg.function_key, 'system_prompt', e.target.value)}
                rows={6}
                className="font-mono text-xs leading-relaxed resize-y"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleReset(cfg.function_key)}>
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Ripristina default
              </Button>
              <Button
                size="sm"
                onClick={() => handleSave(cfg.function_key)}
                disabled={!p.modified || saving === cfg.function_key}
              >
                <Save className="h-3 w-3 mr-1.5" />
                {saving === cfg.function_key ? 'Salvataggio...' : 'Salva'}
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
