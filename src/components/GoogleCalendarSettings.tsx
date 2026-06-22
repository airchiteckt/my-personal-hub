import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, RefreshCw, Unlink, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Connection = {
  google_email: string | null;
  last_synced_at: string | null;
};

type CalendarRow = {
  id: string;
  google_calendar_id: string;
  summary: string;
  color: string | null;
  background_color: string | null;
  enabled: boolean;
  is_primary: boolean;
};

const REDIRECT_PATH = "/auth/google-calendar/callback";

export function GoogleCalendarSettings() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [calendars, setCalendars] = useState<CalendarRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: conn }, { data: cals }] = await Promise.all([
      supabase.from("google_calendar_connections").select("google_email,last_synced_at").eq("user_id", user.id).maybeSingle(),
      supabase.from("google_calendar_list").select("*").eq("user_id", user.id).order("is_primary", { ascending: false }).order("summary"),
    ]);
    setConnection(conn ?? null);
    setCalendars((cals ?? []) as CalendarRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const redirect_uri = window.location.origin + REDIRECT_PATH;
      const { data, error } = await supabase.functions.invoke("google-oauth-start", { body: { redirect_uri } });
      if (error) throw error;
      window.location.href = data.url;
    } catch (e: any) {
      toast.error("Errore avvio OAuth: " + e.message);
      setConnecting(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync");
      if (error) throw error;
      toast.success(`Sincronizzati ${data.calendars} calendari, ${data.events} eventi`);
      await load();
    } catch (e: any) {
      toast.error("Errore sync: " + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnettere Google Calendar? Tutti gli eventi sincronizzati saranno rimossi.")) return;
    try {
      const { error } = await supabase.functions.invoke("google-calendar-disconnect");
      if (error) throw error;
      toast.success("Disconnesso");
      setConnection(null);
      setCalendars([]);
    } catch (e: any) {
      toast.error("Errore: " + e.message);
    }
  };

  const toggleCal = async (cal: CalendarRow, enabled: boolean) => {
    setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, enabled } : c));
    const { error } = await supabase.from("google_calendar_list").update({ enabled }).eq("id", cal.id);
    if (error) toast.error(error.message);
  };

  const updateColor = async (cal: CalendarRow, color: string) => {
    setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, color } : c));
    await supabase.from("google_calendar_list").update({ color }).eq("id", cal.id);
  };

  if (loading) {
    return <Card className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Google Calendar</h3>
              <p className="text-xs text-muted-foreground">
                {connection
                  ? `Collegato: ${connection.google_email ?? "—"}`
                  : "Collega il tuo account Google per importare gli eventi"}
              </p>
              {connection?.last_synced_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ultima sync: {new Date(connection.last_synced_at).toLocaleString("it-IT")}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {connection ? (
              <>
                <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Sincronizza
                </Button>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  Disconnetti
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={connect} disabled={connecting}>
                {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ExternalLink className="h-3.5 w-3.5 mr-1.5" />}
                Collega Google
              </Button>
            )}
          </div>
        </div>
      </Card>

      {connection && calendars.length > 0 && (
        <Card className="p-5">
          <h4 className="font-semibold mb-3 text-sm">Calendari disponibili</h4>
          <div className="space-y-2">
            {calendars.map(cal => (
              <div key={cal.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Switch checked={cal.enabled} onCheckedChange={(v) => toggleCal(cal, v)} />
                  <span className="text-sm truncate">
                    {cal.summary} {cal.is_primary && <span className="text-xs text-muted-foreground">(principale)</span>}
                  </span>
                </div>
                <Input
                  type="color"
                  value={cal.color ?? cal.background_color ?? "#3b82f6"}
                  onChange={(e) => updateColor(cal, e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Premi "Sincronizza" dopo aver cambiato la selezione dei calendari per aggiornare gli eventi.
          </p>
        </Card>
      )}
    </div>
  );
}
