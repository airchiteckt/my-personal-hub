import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, RefreshCw, Unlink, ExternalLink, Loader2, Plus, Building2, Star } from "lucide-react";
import { toast } from "sonner";

type Connection = {
  id: string;
  google_email: string | null;
  last_synced_at: string | null;
};
type CalendarRow = {
  id: string;
  connection_id: string;
  google_calendar_id: string;
  summary: string;
  color: string | null;
  background_color: string | null;
  enabled: boolean;
  is_primary: boolean;
  enterprise_id: string | null;
  is_default_for_writes: boolean;
};
type Enterprise = { id: string; name: string };

const REDIRECT_PATH = "/auth/google-calendar/callback";
const NONE = "__none__";

export function GoogleCalendarSettings() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | "all" | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data: conns }, { data: cals }, { data: ents }] = await Promise.all([
      supabase.from("google_calendar_connections").select("id, google_email, last_synced_at").eq("user_id", user.id).order("created_at"),
      supabase.from("google_calendar_list").select("*").eq("user_id", user.id).order("is_primary", { ascending: false }).order("summary"),
      supabase.from("enterprises").select("id, name").eq("user_id", user.id).order("name"),
    ]);
    setConnections((conns ?? []) as Connection[]);
    setCalendars((cals ?? []) as CalendarRow[]);
    setEnterprises((ents ?? []) as Enterprise[]);
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
      toast.error("Errore: " + e.message);
      setConnecting(false);
    }
  };

  const sync = async (connection_id?: string) => {
    setSyncingId(connection_id ?? "all");
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-sync", {
        body: connection_id ? { connection_id } : {},
      });
      if (error) throw error;
      toast.success(`Sincronizzati ${data.calendars} calendari, ${data.events} eventi`);
      await load();
    } catch (e: any) {
      toast.error("Errore sync: " + e.message);
    } finally {
      setSyncingId(null);
    }
  };

  const disconnect = async (conn: Connection) => {
    if (!confirm(`Disconnettere ${conn.google_email}? Tutti i calendari ed eventi associati saranno rimossi.`)) return;
    try {
      const { error } = await supabase.functions.invoke("google-calendar-disconnect", { body: { connection_id: conn.id } });
      if (error) throw error;
      toast.success("Account disconnesso");
      await load();
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

  const updateEnterprise = async (cal: CalendarRow, value: string) => {
    const enterprise_id = value === NONE ? null : value;
    // Removing the enterprise also clears the default-for-writes flag
    const patch: any = { enterprise_id };
    if (!enterprise_id) patch.is_default_for_writes = false;
    setCalendars(prev => prev.map(c => c.id === cal.id ? { ...c, ...patch } : c));
    const { error } = await supabase.from("google_calendar_list").update(patch).eq("id", cal.id);
    if (error) toast.error(error.message);
  };

  const toggleDefaultWrite = async (cal: CalendarRow) => {
    if (!cal.enterprise_id) {
      toast.error("Assegna prima un'impresa al calendario");
      return;
    }
    const becomingDefault = !cal.is_default_for_writes;
    // Optimistically clear other defaults for the same enterprise
    setCalendars(prev => prev.map(c => {
      if (c.id === cal.id) return { ...c, is_default_for_writes: becomingDefault };
      if (becomingDefault && c.enterprise_id === cal.enterprise_id) return { ...c, is_default_for_writes: false };
      return c;
    }));
    if (becomingDefault) {
      // Clear other defaults for same enterprise first to satisfy unique index
      await supabase.from("google_calendar_list")
        .update({ is_default_for_writes: false })
        .eq("enterprise_id", cal.enterprise_id)
        .neq("id", cal.id);
    }
    const { error } = await supabase.from("google_calendar_list")
      .update({ is_default_for_writes: becomingDefault })
      .eq("id", cal.id);
    if (error) { toast.error(error.message); await load(); }
    else toast.success(becomingDefault ? "Calendario predefinito per le scritture impostato" : "Predefinito rimosso");
  };

  if (loading) {
    return <Card className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold">Google Calendar</h3>
              <p className="text-xs text-muted-foreground">
                {connections.length === 0
                  ? "Collega uno o più account Google per importare gli eventi"
                  : `${connections.length} account collegato${connections.length === 1 ? "" : "i"}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {connections.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => sync()} disabled={syncingId !== null}>
                {syncingId === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Sincronizza tutto
              </Button>
            )}
            <Button size="sm" onClick={connect} disabled={connecting}>
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              {connections.length === 0 ? "Collega Google" : "Aggiungi account"}
            </Button>
          </div>
        </div>
      </Card>

      {connections.map(conn => {
        const connCalendars = calendars.filter(c => c.connection_id === conn.id);
        return (
          <Card key={conn.id} className="p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{conn.google_email}</span>
                </div>
                {conn.last_synced_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Ultima sync: {new Date(conn.last_synced_at).toLocaleString("it-IT")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => sync(conn.id)} disabled={syncingId !== null}>
                  {syncingId === conn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                  Sincronizza
                </Button>
                <Button variant="outline" size="sm" onClick={() => disconnect(conn)}>
                  <Unlink className="h-3.5 w-3.5 mr-1.5" />
                  Disconnetti
                </Button>
              </div>
            </div>

            {connCalendars.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nessun calendario caricato. Premi "Sincronizza" per scaricare la lista.</p>
            ) : (
              <div className="space-y-2">
                {connCalendars.map(cal => (
                  <div key={cal.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                    <Switch checked={cal.enabled} onCheckedChange={(v) => toggleCal(cal, v)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">
                        {cal.summary} {cal.is_primary && <span className="text-xs text-muted-foreground">(principale)</span>}
                      </div>
                    </div>
                    <Select value={cal.enterprise_id ?? NONE} onValueChange={(v) => updateEnterprise(cal, v)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <SelectValue placeholder="Nessuna impresa" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Nessuna impresa</SelectItem>
                        {enterprises.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() => toggleDefaultWrite(cal)}
                      title={cal.enterprise_id ? (cal.is_default_for_writes ? "Calendario predefinito per scrittura appuntamenti" : "Imposta come predefinito per scrittura") : "Assegna un'impresa per abilitare"}
                      disabled={!cal.enterprise_id}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                    >
                      <Star className={`h-4 w-4 ${cal.is_default_for_writes ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                    </button>
                    <Input
                      type="color"
                      value={cal.color ?? cal.background_color ?? "#3b82f6"}
                      onChange={(e) => updateColor(cal, e.target.value)}
                      className="w-12 h-8 p-1 cursor-pointer shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}

      {connections.length > 0 && (
        <p className="text-xs text-muted-foreground px-1">
          La stella ⭐ accanto a un calendario lo imposta come <strong>predefinito per scrittura</strong>: gli appuntamenti FlyDeck dell'impresa associata verranno creati anche su quel calendario Google.
        </p>
      )}
    </div>
  );
}
