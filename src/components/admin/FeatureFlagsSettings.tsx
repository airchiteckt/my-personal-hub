import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export function FeatureFlagsSettings() {
  const { flags, loading, toggleFlag } = useFeatureFlags();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const navFlags = flags.filter(f => f.category === 'navigation');
  const featureFlags = flags.filter(f => f.category === 'feature');

  const handleToggle = async (id: string, label: string, enabled: boolean) => {
    const { error } = await toggleFlag(id, enabled);
    if (error) {
      toast.error(`Errore: ${error}`);
    } else {
      toast.success(`${label} ${enabled ? 'abilitata' : 'nascosta'}`);
    }
  };

  const renderFlags = (items: typeof flags, title: string, description: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map(flag => (
          <div key={flag.id} className="flex items-center justify-between gap-4 py-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Label htmlFor={flag.id} className="font-medium cursor-pointer">
                  {flag.label}
                </Label>
                <Badge variant={flag.is_enabled ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                  {flag.is_enabled ? 'Pubblica' : 'Nascosta'}
                </Badge>
              </div>
              {flag.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
              )}
            </div>
            <Switch
              id={flag.id}
              checked={flag.is_enabled}
              onCheckedChange={(checked) => handleToggle(flag.id, flag.label, checked)}
            />
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nessun flag in questa categoria</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {renderFlags(navFlags, 'Sezioni di Navigazione', 'Mostra o nascondi le voci del menu principale per gli utenti')}
      {renderFlags(featureFlags, 'Funzionalità', 'Abilita o disabilita singole funzionalità dell\'app')}
    </div>
  );
}
