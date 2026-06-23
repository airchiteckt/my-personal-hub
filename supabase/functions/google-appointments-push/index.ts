import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "Europe/Rome";

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Refresh failed: " + JSON.stringify(data));
  return data as { access_token: string; expires_in: number };
}

async function ensureAccessToken(admin: any, conn: any): Promise<string> {
  let accessToken = conn.access_token;
  if (new Date(conn.token_expires_at).getTime() < Date.now() + 30_000) {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    accessToken = refreshed.access_token;
    await admin.from("google_calendar_connections").update({
      access_token: accessToken,
      token_expires_at: new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString(),
    }).eq("id", conn.id);
  }
  return accessToken;
}

function buildEventBody(appt: { title: string; description?: string | null; date: string; start_time: string; end_time: string; location?: string | null }) {
  // start_time / end_time are "HH:mm" or "HH:mm:ss"; ensure HH:mm:ss
  const t = (s: string) => (s.length === 5 ? `${s}:00` : s);
  return {
    summary: appt.title,
    description: appt.description ?? undefined,
    location: appt.location ?? undefined,
    start: { dateTime: `${appt.date}T${t(appt.start_time)}`, timeZone: TZ },
    end: { dateTime: `${appt.date}T${t(appt.end_time)}`, timeZone: TZ },
  };
}

async function getDefaultCalendar(admin: any, userId: string, enterpriseId: string | null) {
  let q = admin
    .from("google_calendar_list")
    .select("connection_id, google_calendar_id, enabled, is_default_for_writes, enterprise_id")
    .eq("user_id", userId)
    .eq("is_default_for_writes", true);
  q = enterpriseId === null ? q.is("enterprise_id", null) : q.eq("enterprise_id", enterpriseId);
  const { data } = await q.limit(1).maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const action = body.action as "create" | "update" | "delete";
    const appointmentId = body.appointment_id as string | undefined;
    if (!action || !appointmentId) {
      return new Response(JSON.stringify({ error: "Missing action/appointment_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // For delete we need the previous google_event_id; we receive it inline since the row is already gone
    if (action === "delete") {
      const googleEventId = body.google_event_id as string | undefined;
      const googleCalendarId = body.google_calendar_id as string | undefined;
      const googleConnectionId = body.google_connection_id as string | undefined;
      if (!googleEventId || !googleCalendarId || !googleConnectionId) {
        return new Response(JSON.stringify({ ok: true, skipped: "not previously synced" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: conn } = await admin.from("google_calendar_connections").select("*").eq("id", googleConnectionId).eq("user_id", user.id).maybeSingle();
      if (!conn) return new Response(JSON.stringify({ ok: true, skipped: "connection missing" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const token = await ensureAccessToken(admin, conn);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(googleCalendarId)}/events/${encodeURIComponent(googleEventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 404 / 410 are fine
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const txt = await res.text();
        throw new Error(`Google delete ${res.status}: ${txt}`);
      }
      return new Response(JSON.stringify({ ok: true, deleted: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // create / update: read appointment
    const { data: appt, error: apptErr } = await admin.from("appointments").select("*").eq("id", appointmentId).eq("user_id", user.id).maybeSingle();
    if (apptErr) throw apptErr;
    if (!appt) {
      return new Response(JSON.stringify({ error: "Appointment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find default calendar for this scope (enterprise or personal)
    const def = await getDefaultCalendar(admin, user.id, appt.enterprise_id ?? null);
    if (!def) {
      return new Response(JSON.stringify({ ok: true, skipped: "no default calendar for scope" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: conn } = await admin.from("google_calendar_connections").select("*").eq("id", def.connection_id).eq("user_id", user.id).maybeSingle();
    if (!conn) {
      return new Response(JSON.stringify({ error: "Connection missing" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = await ensureAccessToken(admin, conn);

    const targetCalendarId = def.google_calendar_id;
    const bodyPayload = buildEventBody(appt);

    let googleEventId = appt.google_event_id as string | null;
    let res: Response;

    const sameTarget = appt.google_calendar_id === targetCalendarId && appt.google_connection_id === conn.id;

    if (action === "create" || !googleEventId || !sameTarget) {
      // If exists on a different calendar/account, delete the old one first (best-effort)
      if (googleEventId && appt.google_calendar_id && appt.google_connection_id && !sameTarget) {
        const { data: oldConn } = await admin.from("google_calendar_connections").select("*").eq("id", appt.google_connection_id).maybeSingle();
        if (oldConn) {
          try {
            const oldToken = await ensureAccessToken(admin, oldConn);
            await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(appt.google_calendar_id)}/events/${encodeURIComponent(googleEventId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${oldToken}` },
            });
          } catch (_) { /* ignore */ }
        }
        googleEventId = null;
      }

      res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
    } else {
      res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(googleEventId)}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      // If the event vanished server-side, fall back to create
      if (res.status === 404 || res.status === 410) {
        res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(bodyPayload),
        });
        googleEventId = null;
      }
    }

    const respJson = await res.json();
    if (!res.ok) {
      await admin.from("appointments").update({ sync_error: `Google ${res.status}: ${JSON.stringify(respJson).slice(0, 500)}` }).eq("id", appointmentId);
      throw new Error(`Google API ${res.status}: ${JSON.stringify(respJson)}`);
    }

    await admin.from("appointments").update({
      google_event_id: respJson.id,
      google_calendar_id: targetCalendarId,
      google_connection_id: conn.id,
      synced_at: new Date().toISOString(),
      sync_error: null,
    }).eq("id", appointmentId);

    return new Response(JSON.stringify({ ok: true, google_event_id: respJson.id, html_link: respJson.htmlLink }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
