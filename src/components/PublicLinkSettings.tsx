import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Link2, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function PublicLinkSettings() {
  const { user } = useAuth();
  const [slug, setSlug] = useState('');
  const [savedSlug, setSavedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
      toast.success('Link pubblico salvato!');
    }
  };

  const publicUrl = savedSlug ? `${window.location.origin}/p/${savedSlug}/opencalendar` : null;

  const copyUrl = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success('Link copiato!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Caricamento...</div>;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Link2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">Il tuo slug pubblico</h3>
            <p className="text-xs text-muted-foreground">Scegli un nome breve per il tuo link di prenotazione</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">/p/</span>
          <Input
            value={slug}
            onChange={e => setSlug(sanitize(e.target.value))}
            placeholder="es. se"
            className="font-mono max-w-[200px]"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">/opencalendar</span>
        </div>

        <Button onClick={handleSave} disabled={saving || !slug.trim() || slug === savedSlug} size="sm">
          {saving ? 'Salvataggio...' : 'Salva'}
        </Button>
      </Card>

      {publicUrl && (
        <Card className="p-4 bg-muted/30 border-dashed space-y-3">
          <Label className="text-xs font-medium">Il tuo link pubblico</Label>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-background px-3 py-2 rounded-md border flex-1 truncate">
              {publicUrl}
            </code>
            <Button variant="outline" size="icon" className="shrink-0" onClick={copyUrl}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="shrink-0" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Condividi questo link per permettere a chiunque di prenotare un appuntamento con te.
          </p>
        </Card>
      )}
    </div>
  );
}
