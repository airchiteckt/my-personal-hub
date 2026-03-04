import { usePrp } from '@/context/PrpContext';
import { PrioritySettings, DEFAULT_PRIORITY_SETTINGS } from '@/types/prp';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCcw, Gauge, Clock, Target, FolderKanban, Settings as SettingsIcon, Link2 } from 'lucide-react';
import { PublicLinkSettings } from '@/components/PublicLinkSettings';

const Settings = () => {
  const { prioritySettings, setPrioritySettings } = usePrp();

  const update = (key: keyof PrioritySettings, value: number | boolean) => {
    setPrioritySettings({ ...prioritySettings, [key]: value });
  };

  const reset = () => setPrioritySettings(DEFAULT_PRIORITY_SETTINGS);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 md:h-7 md:w-7" />
          Impostazioni
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configura priorità e assistente AI
        </p>
      </div>

      <Tabs defaultValue="priority" className="space-y-4">
        <TabsList className="w-full">
          <TabsTrigger value="priority" className="flex-1 gap-1.5">
            <Gauge className="h-4 w-4" />
            Priorità
          </TabsTrigger>
          <TabsTrigger value="public" className="flex-1 gap-1.5">
            <Link2 className="h-4 w-4" />
            Link Pubblici
          </TabsTrigger>
        </TabsList>

        <TabsContent value="priority">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={reset}>
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
            </div>

            {/* Deadline Boost */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-destructive" />
                  <div>
                    <h3 className="font-semibold">Boost Deadline</h3>
                    <p className="text-xs text-muted-foreground">Aumenta priorità in base alla scadenza</p>
                  </div>
                </div>
                <Switch
                  checked={prioritySettings.deadlineBoostEnabled}
                  onCheckedChange={v => update('deadlineBoostEnabled', v)}
                />
              </div>

              {prioritySettings.deadlineBoostEnabled && (
                <div className="space-y-4 pt-2 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1">
                        🔴 Critica sotto <span className="font-mono font-bold">{prioritySettings.deadlineCriticalHours}h</span>
                      </Label>
                      <Slider value={[prioritySettings.deadlineCriticalHours]} onValueChange={([v]) => update('deadlineCriticalHours', v)} min={6} max={48} step={6} />
                      <Label className="text-xs text-muted-foreground">Boost: +{prioritySettings.deadlineCriticalBoost}</Label>
                      <Slider value={[prioritySettings.deadlineCriticalBoost]} onValueChange={([v]) => update('deadlineCriticalBoost', v)} min={1} max={5} step={1} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1">
                        🟠 Alta sotto <span className="font-mono font-bold">{prioritySettings.deadlineHighHours}h</span>
                      </Label>
                      <Slider value={[prioritySettings.deadlineHighHours]} onValueChange={([v]) => update('deadlineHighHours', v)} min={12} max={96} step={12} />
                      <Label className="text-xs text-muted-foreground">Boost: +{prioritySettings.deadlineHighBoost}</Label>
                      <Slider value={[prioritySettings.deadlineHighBoost]} onValueChange={([v]) => update('deadlineHighBoost', v)} min={1} max={5} step={1} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1">
                        🟡 Attenzione sotto <span className="font-mono font-bold">{prioritySettings.deadlineAttentionHours}h</span>
                      </Label>
                      <Slider value={[prioritySettings.deadlineAttentionHours]} onValueChange={([v]) => update('deadlineAttentionHours', v)} min={24} max={168} step={24} />
                      <Label className="text-xs text-muted-foreground">Boost: +{prioritySettings.deadlineAttentionBoost}</Label>
                      <Slider value={[prioritySettings.deadlineAttentionBoost]} onValueChange={([v]) => update('deadlineAttentionBoost', v)} min={1} max={5} step={1} />
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Strategic Weight */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Peso Tipo Progetto</h3>
                    <p className="text-xs text-muted-foreground">Strategic pesa di più, Maintenance meno</p>
                  </div>
                </div>
                <Switch checked={prioritySettings.strategicWeightEnabled} onCheckedChange={v => update('strategicWeightEnabled', v)} />
              </div>

              {prioritySettings.strategicWeightEnabled && (
                <div className="space-y-3 pt-2 border-t mt-4">
                  {[
                    { label: '🔵 Strategic', key: 'strategicWeight' as const, min: -3, max: 5 },
                    { label: '🟡 Operational', key: 'operationalWeight' as const, min: -3, max: 5 },
                    { label: '⚪ Maintenance', key: 'maintenanceWeight' as const, min: -3, max: 5 },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-4">
                      <span className="text-sm w-32 shrink-0">{item.label}</span>
                      <Slider value={[prioritySettings[item.key]]} onValueChange={([v]) => update(item.key, v)} min={item.min} max={item.max} step={1} className="flex-1" />
                      <span className="text-sm font-mono w-8 text-right">{prioritySettings[item.key] > 0 ? '+' : ''}{prioritySettings[item.key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Impact / Effort */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" style={{ color: 'hsl(var(--warning))' }} />
                  <div>
                    <h3 className="font-semibold">Impatto / Sforzo</h3>
                    <p className="text-xs text-muted-foreground">Score = (Impatto × mult) − (Sforzo × pen)</p>
                  </div>
                </div>
                <Switch checked={prioritySettings.impactEffortEnabled} onCheckedChange={v => update('impactEffortEnabled', v)} />
              </div>

              {prioritySettings.impactEffortEnabled && (
                <div className="space-y-3 pt-2 border-t mt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-40 shrink-0">Moltiplicatore Impatto</span>
                    <Slider value={[prioritySettings.impactMultiplier]} onValueChange={([v]) => update('impactMultiplier', v)} min={1} max={5} step={1} className="flex-1" />
                    <span className="text-sm font-mono w-8 text-right">×{prioritySettings.impactMultiplier}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm w-40 shrink-0">Penalità Sforzo</span>
                    <Slider value={[prioritySettings.effortPenalty]} onValueChange={([v]) => update('effortPenalty', v)} min={0} max={3} step={1} className="flex-1" />
                    <span className="text-sm font-mono w-8 text-right">×{prioritySettings.effortPenalty}</span>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-4 bg-muted/50 border-dashed">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong>Come funziona:</strong> La priorità effettiva = Manuale + Deadline Boost + Score Strategico + Peso Progetto.
                Tu continui a vedere Alta/Media/Bassa, ma l'ordinamento nel backlog e i suggerimenti usano il punteggio interno.
                Il sistema può solo <strong>aumentare</strong> la priorità, mai abbassarla rispetto a quella manuale.
              </p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="public">
          <PublicLinkSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
