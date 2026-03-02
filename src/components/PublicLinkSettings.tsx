import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link2, Copy, Check, ExternalLink, CalendarDays, Building2, Briefcase, Lock } from 'lucide-react';
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
    key: 'showcase',
    label: 'Showcase Imprese',
    description: 'Portfolio pubblico di tutte le tue imprese e i loro progressi',
    icon: Building2,
    path: '/showcase',
    available: false,
  },
  {
    key: 'enterprise',
    label: 'Pagina Singola Impresa',
    description: 'Pagina pubblica dedicata a una singola impresa con OKR e metriche',
    icon: Briefcase,
    path: '/enterprise/:id',
    available: false,
  },
];

export function PublicLinkSettings() {
  const { user } = useAuth();
  const [slug, setSlug] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('public_slug')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.public_slug) {
        setSlug(data.public_slug);
        setSavedSlug(data.public_slug);
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
        toast.error('Questo slug è già in uso, scegline un altro');
      } else {
        toast.error('Errore nel salvataggio');
      }
    } else {
      setSavedSlug(clean);
      setSlug(clean);
      toast.success('Slug pubblico salvato!');
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
            <h3 className="font-semibold">Il tuo identificativo pubblico</h3>
            <p className="text-xs text-muted-foreground">
              Questo slug è la base di tutti i tuoi link pubblici: <span className="font-mono">flydeck.app/<strong>{savedSlug || '...'}</strong>/...</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-mono whitespace-nowrap">flydeck.app /</span>
          <Input
            value={slug}
            onChange={e => setSlug(sanitize(e.target.value))}
            placeholder="es. se"
            className="font-mono max-w-[180px]"
          />
        </div>

        <Button onClick={handleSave} disabled={saving || !slug.trim() || slug === savedSlug} size="sm">
          {saving ? 'Salvataggio...' : 'Salva slug'}
        </Button>
      </Card>

      {/* Public pages */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pagine pubbliche</h3>

        {PUBLIC_PAGES.map(page => {
          const Icon = page.icon;
          const fullUrl = savedSlug ? `${window.location.origin}/${savedSlug}${page.path}` : null;

          return (
            <Card key={page.key} className={`p-4 ${!page.available ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${page.available ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Icon className={`h-4 w-4 ${page.available ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{page.label}</h4>
                    {page.available ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">attivo</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                        <Lock className="h-2.5 w-2.5" /> prossimamente
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{page.description}</p>

                  {page.available && savedSlug && fullUrl && (
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

                  {page.available && !savedSlug && (
                    <p className="text-[11px] text-amber-500 mt-1">Configura prima il tuo slug per attivare questo link.</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-muted/50 border-dashed">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>💡 Come funziona:</strong> Lo slug è il tuo identificativo unico. Una volta impostato, puoi condividere i link delle pagine pubbliche attive.
          Le pagine "prossimamente" verranno sbloccate nelle prossime versioni.
        </p>
      </Card>
    </div>
  );
}
