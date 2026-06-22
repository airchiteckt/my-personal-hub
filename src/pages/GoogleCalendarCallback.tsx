import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GoogleCalendarCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Connessione in corso...");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");

    if (error) {
      setStatus("error");
      setMessage("Autorizzazione annullata: " + error);
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Parametri mancanti");
      return;
    }

    (async () => {
      try {
        const redirect_uri = window.location.origin + "/auth/google-calendar/callback";
        const { data, error: fnErr } = await supabase.functions.invoke("google-oauth-callback", {
          body: { code, state, redirect_uri },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);

        // Trigger first sync
        await supabase.functions.invoke("google-calendar-sync");

        setStatus("ok");
        setMessage("Google Calendar collegato!");
        setTimeout(() => navigate("/settings"), 1200);
      } catch (e: any) {
        setStatus("error");
        setMessage(e.message ?? "Errore sconosciuto");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {status === "loading" && <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />}
        {status === "ok" && <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />}
        {status === "error" && <XCircle className="h-10 w-10 mx-auto text-destructive" />}
        <h1 className="text-xl font-semibold">{message}</h1>
        {status === "error" && (
          <Button onClick={() => navigate("/settings")}>Torna alle impostazioni</Button>
        )}
      </div>
    </div>
  );
}
