import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: conn, error: connErr } = await admin
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connErr) throw connErr;
    if (!conn) return new Response(JSON.stringify({ error: "Not connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Refresh token if expired or near
    let accessToken = conn.access_token;
    if (new Date(conn.token_expires_at).getTime() < Date.now() + 30_000) {
      const refreshed = await refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      const newExpires = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString();
      await admin.from("google_calendar_connections").update({
        access_token: accessToken,
        token_expires_at: newExpires,
      }).eq("user_id", user.id);
    }

    const gfetch = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    // 1) Fetch calendar list and upsert
    const listRes = await gfetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250");
    const list = await listRes.json();
    if (!listRes.ok) throw new Error("calendarList: " + JSON.stringify(list));

    const calendars = (list.items ?? []) as any[];
    if (calendars.length > 0) {
      // Upsert keeping user-chosen enabled/color: only insert new ones, update summary/colors otherwise
      const { data: existing } = await admin
        .from("google_calendar_list")
        .select("google_calendar_id, enabled, color")
        .eq("user_id", user.id);
      const existingMap = new Map((existing ?? []).map((e: any) => [e.google_calendar_id, e]));

      const rows = calendars.map((c) => {
        const prev = existingMap.get(c.id);
        return {
          user_id: user.id,
          google_calendar_id: c.id,
          summary: c.summary ?? c.id,
          description: c.description ?? null,
          background_color: c.backgroundColor ?? null,
          color: prev?.color ?? c.backgroundColor ?? null,
          enabled: prev?.enabled ?? (c.primary === true),
          is_primary: c.primary === true,
        };
      });
      await admin.from("google_calendar_list").upsert(rows, { onConflict: "user_id,google_calendar_id" });
    }

    // 2) Fetch events from each enabled calendar (-7d → +60d)
    const { data: enabledCals } = await admin
      .from("google_calendar_list")
      .select("google_calendar_id")
      .eq("user_id", user.id)
      .eq("enabled", true);

    const timeMin = new Date(Date.now() - 7 * 86400_000).toISOString();
    const timeMax = new Date(Date.now() + 60 * 86400_000).toISOString();

    let totalEvents = 0;
    const calIds = (enabledCals ?? []).map((c: any) => c.google_calendar_id);

    // Wipe existing events in window for these calendars, then reinsert (simple approach)
    if (calIds.length > 0) {
      await admin.from("external_calendar_events")
        .delete()
        .eq("user_id", user.id)
        .in("google_calendar_id", calIds)
        .gte("start_at", timeMin)
        .lte("start_at", timeMax);
    }

    for (const calId of calIds) {
      let pageToken: string | undefined = undefined;
      do {
        const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`);
        u.searchParams.set("timeMin", timeMin);
        u.searchParams.set("timeMax", timeMax);
        u.searchParams.set("singleEvents", "true");
        u.searchParams.set("orderBy", "startTime");
        u.searchParams.set("maxResults", "250");
        if (pageToken) u.searchParams.set("pageToken", pageToken);

        const evRes = await gfetch(u.toString());
        const ev = await evRes.json();
        if (!evRes.ok) {
          console.error("events error for", calId, ev);
          break;
        }

        const rows = (ev.items ?? [])
          .filter((e: any) => e.status !== "cancelled" && (e.start?.dateTime || e.start?.date))
          .map((e: any) => {
            const allDay = !e.start?.dateTime;
            const startAt = allDay ? new Date(e.start.date).toISOString() : new Date(e.start.dateTime).toISOString();
            const endAt = allDay ? new Date(e.end.date).toISOString() : new Date(e.end.dateTime).toISOString();
            return {
              user_id: user.id,
              google_calendar_id: calId,
              google_event_id: e.id,
              title: e.summary ?? "(senza titolo)",
              description: e.description ?? null,
              location: e.location ?? null,
              start_at: startAt,
              end_at: endAt,
              all_day: allDay,
              html_link: e.htmlLink ?? null,
              status: e.status ?? null,
            };
          });
        if (rows.length > 0) {
          await admin.from("external_calendar_events").upsert(rows, { onConflict: "user_id,google_calendar_id,google_event_id" });
          totalEvents += rows.length;
        }
        pageToken = ev.nextPageToken;
      } while (pageToken);
    }

    await admin.from("google_calendar_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ ok: true, calendars: calendars.length, events: totalEvents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
