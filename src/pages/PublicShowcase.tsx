import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Lock, ArrowRight, Rocket, TrendingUp, Wrench } from 'lucide-react';

interface ShowcaseEnterprise {
  id: string;
  name: string;
  description: string | null;
  status: string;
  phase: string;
  color: string;
  enterprise_type: string;
  business_category: string;
}

interface ProfileData {
  display_name: string | null;
  showcase_enabled: boolean;
  showcase_password: string | null;
  user_id: string;
}

export default function PublicShowcase() {
  const { slug, enterpriseId } = useParams<{ slug: string; enterpriseId?: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [enterprises, setEnterprises] = useState<ShowcaseEnterprise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name, showcase_enabled, showcase_password, user_id')
        .eq('public_slug', slug)
        .maybeSingle();

      if (!profileData) {
        setError('Profilo non trovato');
        setLoading(false);
        return;
      }

      if (!profileData.showcase_enabled) {
        setError('Showcase non attivo');
        setLoading(false);
        return;
      }

      setProfile(profileData);

      if (profileData.showcase_password) {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }

      await loadEnterprises(profileData.user_id, enterpriseId);
      setLoading(false);
    })();
  }, [slug, enterpriseId]);

  const loadEnterprises = async (userId: string, singleId?: string) => {
    let query = supabase
      .from('enterprises')
      .select('id, name, description, status, phase, color, enterprise_type, business_category')
      .eq('user_id', userId)
      .eq('is_public', true);

    if (singleId) {
      query = query.eq('id', singleId);
    }

    const { data } = await query.order('name');
    setEnterprises((data as ShowcaseEnterprise[]) || []);
  };

  const handlePasswordSubmit = async () => {
    if (!profile) return;
    if (password === profile.showcase_password) {
      setAuthenticated(true);
      setNeedsPassword(false);
      setLoading(true);
      await loadEnterprises(profile.user_id, enterpriseId);
      setLoading(false);
    } else {
      setError('Password errata');
      setTimeout(() => setError(null), 2000);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'development': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'paused': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      default: return '';
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Attiva';
      case 'development': return 'In sviluppo';
      case 'paused': return 'In pausa';
      default: return status;
    }
  };

  const phaseIcon = (phase: string) => {
    switch (phase) {
      case 'setup': return <Wrench className="h-3.5 w-3.5" />;
      case 'growth': return <TrendingUp className="h-3.5 w-3.5" />;
      case 'scale': return <Rocket className="h-3.5 w-3.5" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Caricamento...</p>
      </div>
    );
  }

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-sm">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{error}</p>
        </Card>
      </div>
    );
  }

  if (needsPassword && !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="p-8 max-w-sm w-full space-y-4">
          <div className="text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Accesso protetto</h2>
            <p className="text-sm text-muted-foreground">
              Inserisci la password per visualizzare lo showcase di <strong>{profile?.display_name || slug}</strong>
            </p>
          </div>
          {error && <p className="text-sm text-destructive text-center">{error}</p>}
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <Button onClick={handlePasswordSubmit} className="w-full" disabled={!password}>
              Accedi
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{profile?.display_name || slug}</h1>
              <p className="text-sm text-muted-foreground">
                {enterpriseId ? 'Dettaglio Impresa' : `${enterprises.length} impres${enterprises.length === 1 ? 'a' : 'e'} pubblic${enterprises.length === 1 ? 'a' : 'he'}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {enterprises.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nessuna impresa pubblica disponibile</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {enterprises.map(e => (
              <Card key={e.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span
                      className="h-3 w-3 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: `hsl(${e.color})` }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{e.name}</h3>
                      {e.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{e.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusColor(e.status)}>
                      {statusLabel(e.status)}
                    </Badge>
                    <Badge variant="secondary" className="gap-1 text-xs">
                      {phaseIcon(e.phase)}
                      {e.phase}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {e.enterprise_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by <span className="font-semibold">FlyDeck</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
