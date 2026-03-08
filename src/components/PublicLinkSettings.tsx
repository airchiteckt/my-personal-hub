import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { usePrp } from '@/context/PrpContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Link2, Copy, Check, ExternalLink, CalendarDays, Building2, Lock, ClipboardList, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const PUBLIC_PAGES = [
  {
    key: 'opencalendar',
    label: 'Open Calendar',
    description: 'Permetti a chiunque di prenotare un appuntamento con te',
    icon: CalendarDays,
    path: '/opencalendar',
    available: true,
  },
  {
    key: 'openrequest',
    label: 'Open Request',
    description: 'Permetti a chiunque di richiederti attività — le approvi o archivi tu',
    icon: ClipboardList,
    path: '/openrequest',
    available: true,
  },
  {
    key: 'showcase',
    label: 'Showcase Imprese',
    description: 'Portfolio pubblico delle tue imprese — tutte quelle marcate come pubbliche',
    icon: Building2,
    path: '/showcase',
    available: true,
  },
];

export function PublicLinkSettings() {
  const { user } = useAuth();
  const { enterprises, updateEnterprise } = usePrp();
  const [slug, setSlug] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Showcase settings
  const [showcaseEnabled, setShowcaseEnabled] = useState(false);
  const [showcasePassword, setShowcasePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showcaseSaving, setShowcaseSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('public_slug, showcase_enabled, showcase_password')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        if (data.public_slug) {
          setSlug(data.public_slug);
          setSavedSlug(data.public_slug);
        }
        setShowcaseEnabled(data.showcase_enabled || false);
        setShowcasePassword(data.showcase_password || '');
      }
      setLoading(false);
    })();
  }, [user]);

  const sanitize = (v: string) => v.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);

  const handleSave = async () => {
    if (!user || !slug.trim()) return;
    setSaving(true);
    const clean = sanitize(slug);
    const { error } = await supabase
      .from('profiles')
      .update({ public_slug: clean })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        toast.error('Questo nome è già in uso, scegline un altro');
      } else {
        toast.error('Errore nel salvataggio');
      }
    } else {
      setSavedSlug(clean);
      setSlug(clean);
      toast.success('Nome pubblico salvato!');
    }
  };

  const saveShowcaseSettings = async () => {
    if (!user) return;
    setShowcaseSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        showcase_enabled: showcaseEnabled,
        showcase_password: showcasePassword.trim() || null,
      })
      .eq('user_id', user.id);
    setShowcaseSaving(false);
    if (error) {
      toast.error('Errore nel salvataggio');
    } else {
      toast.success('Impostazioni showcase salvate');
    }
  };

  const toggleEnterprisePublic = async (id: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('enterprises')
      .update({ is_public: !currentValue } as any)
      .eq('id', id);
    if (!error) {
      updateEnterprise(id, { is_public: !currentValue } as any);
      toast.success(!currentValue ? 'Impresa resa pubblica' : 'Impresa nascosta');
    }
  };

  const copyUrl = (path: string) => {
    const url = `${window.location.origin}/${savedSlug}${path}`;
    navigator.clipboard.writeText(url);
    setCopied(path);
    toast.success('Link copiato!');
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Caricamento...</div>;

  return (
    <div className="space-y-5">
      {/* Slug config */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Il tuo nome pubblico</h3>
            <p className="text-xs text-muted-foreground">
              Questo è il tuo identificativo nei link pubblici: <span className="font-mono">flydeck.app/<strong>{savedSlug || '...'}</strong>/...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">flydeck.app /</span>
          <Input
            value={slug}
            onChange={e => setSlug(sanitize(e.target.value))}
            placeholder="es. mario-rossi"
            className="font-mono max-w-[180px]"
          />
        </div>

        <Button onClick={handleSave} disabled={saving || !slug.trim() || slug === savedSlug} size="sm">
          {saving ? 'Salvataggio...' : 'Salva'}
        </Button>
      </Card>

      {/* Public pages */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pagine pubbliche</h3>

        {PUBLIC_PAGES.map(page => {
          const Icon = page.icon;
          const fullUrl = savedSlug ? `${window.location.origin}/${savedSlug}${page.path}` : null;

          return (
            <Card key={page.key} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{page.label}</h4>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">attivo</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{page.description}</p>

                  {savedSlug && fullUrl && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <code className="text-[11px] bg-background px-2 py-1 rounded border truncate flex-1">
                        /{savedSlug}{page.path}
                      </code>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyUrl(page.path)}>
                        {copied === page.path ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild>
                        <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                  )}

                  {!savedSlug && (
                    <p className="text-[11px] text-amber-500 mt-1">Configura prima il tuo nome pubblico per attivare questo link.</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Showcase settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Configurazione Showcase</h3>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <h3 className="font-semibold text-sm">Abilita Showcase</h3>
                <p className="text-xs text-muted-foreground">Rendi visibile il tuo portfolio pubblico</p>
              </div>
            </div>
            <Switch checked={showcaseEnabled} onCheckedChange={setShowcaseEnabled} />
          </div>

          {showcaseEnabled && (
            <>
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Password di accesso <span className="text-muted-foreground font-normal">(opzionale)</span>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={showcasePassword}
                      onChange={e => setShowcasePassword(e.target.value)}
                      placeholder="Lascia vuoto per accesso libero"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">Se impostata, i visitatori dovranno inserire questa password per vedere lo showcase.</p>
              </div>

              {/* Enterprise visibility toggles */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm">Imprese visibili nello Showcase — per ognuna puoi scegliere un nome per il link diretto</Label>
                {enterprises.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nessuna impresa creata</p>
                ) : (
                  <div className="space-y-3">
                    {enterprises.map(e => (
                      <div key={e.id} className="py-2 px-3 rounded-md border bg-background space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: `hsl(${e.color})` }} />
                            <span className="text-sm font-medium">{e.name}</span>
                          </div>
                          <Switch
                            checked={e.is_public || false}
                            onCheckedChange={() => toggleEnterprisePublic(e.id, e.is_public || false)}
                          />
                        </div>
                        {e.is_public && (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">Nome link:</span>
                              <Input
                                value={e.public_slug || ''}
                                onChange={ev => {
                                  const clean = ev.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
                                  updateEnterprise(e.id, { public_slug: clean } as any);
                                }}
                                onBlur={async () => {
                                  const val = e.public_slug?.trim() || null;
                                  const { error } = await supabase.from('enterprises').update({ public_slug: val } as any).eq('id', e.id);
                                  if (error) {
                                    if (error.message.includes('duplicate') || error.message.includes('unique')) {
                                      toast.error('Nome link già in uso');
                                    } else {
                                      toast.error('Errore salvataggio nome link');
                                    }
                                  } else if (val) {
                                    toast.success('Nome link impresa salvato');
                                  }
                                }}
                                placeholder="es. ambressa"
                                className="h-7 text-xs font-mono flex-1"
                              />
                            </div>
                            {e.public_slug && savedSlug && (
                              <div className="flex items-center gap-1.5">
                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate flex-1">
                                  /{savedSlug}/showcase/{e.public_slug}
                                </code>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                  onClick={() => copyUrl(`/showcase/${e.public_slug}`)}
                                >
                                  {copied === `/showcase/${e.public_slug}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                                  <a href={`${window.location.origin}/${savedSlug}/showcase/${e.public_slug}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <Button onClick={saveShowcaseSettings} disabled={showcaseSaving} size="sm">
            {showcaseSaving ? 'Salvataggio...' : 'Salva impostazioni showcase'}
          </Button>
        </Card>
      </div>

      <Card className="p-4 bg-muted/50 border-dashed">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>💡 Come funziona:</strong> Il nome pubblico è il tuo identificativo unico nei link. Attiva lo Showcase e scegli quali imprese rendere visibili.
          Se imposti una password, i visitatori dovranno autenticarsi prima di accedere.
        </p>
      </Card>
    </div>
  );
}
