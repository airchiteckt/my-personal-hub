import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Copy, Send, Unlink, RefreshCw } from 'lucide-react';

interface TelegramLink {
  id: string;
  chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  created_at: string;
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function TelegramSettings() {
  const { user } = useAuth();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('telegram_links')
      .select('id, chat_id, telegram_username, telegram_first_name, created_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setLink((data as TelegramLink) ?? null);

    const { data: codeRow } = await supabase
      .from('telegram_link_codes')
      .select('code, expires_at')
      .eq('user_id', user.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setCode(codeRow?.code ?? null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const generateCode = async () => {
    if (!user) return;
    setWorking(true);
    const newCode = randomCode();
    const { error } = await supabase.from('telegram_link_codes').insert({ code: newCode, user_id: user.id });
    setWorking(false);
    if (error) { toast.error('Impossibile generare il codice'); return; }
    setCode(newCode);
  };

  const unlink = async () => {
    if (!link) return;
    setWorking(true);
    const { error } = await supabase.from('telegram_links').delete().eq('id', link.id);
    setWorking(false);
    if (error) { toast.error('Impossibile scollegare'); return; }
    setLink(null);
    toast.success('Telegram scollegato');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" /> Telegram
        </CardTitle>
        <CardDescription>
          Collega Telegram per usare Radar in chat: scrivi o manda un vocale e lui inserisce appuntamenti,
          promemoria e attività al posto tuo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : link ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Collegato</Badge>
                <span className="text-sm font-medium">
                  {link.telegram_username ? `@${link.telegram_username}` : link.telegram_first_name ?? 'Account Telegram'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Dal {new Date(link.created_at).toLocaleDateString('it-IT')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={unlink} disabled={working} className="gap-1.5">
              <Unlink className="h-3.5 w-3.5" /> Scollega
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Genera il codice qui sotto.</li>
              <li>Apri il bot su Telegram e invia il codice come messaggio.</li>
              <li>Da quel momento puoi parlare con Radar direttamente in chat.</li>
            </ol>

            {code ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-muted px-3 py-2 font-mono text-lg tracking-widest">{code}</code>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { navigator.clipboard.writeText(code); toast.success('Codice copiato'); }}
                >
                  <Copy className="h-3.5 w-3.5" /> Copia
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={generateCode} disabled={working}>
                  <RefreshCw className="h-3.5 w-3.5" /> Nuovo codice
                </Button>
                <p className="w-full text-xs text-muted-foreground">Il codice scade dopo 30 minuti.</p>
              </div>
            ) : (
              <Button onClick={generateCode} disabled={working} className="gap-1.5">
                <Send className="h-4 w-4" /> Genera codice di collegamento
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
