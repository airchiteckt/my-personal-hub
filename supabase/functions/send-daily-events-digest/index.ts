import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TZ = "Europe/Rome";

function romeDateParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m, day] = fmt.format(d).split("-");
  return { y, m, day };
}

// Returns ISO bounds [start, end) for "tomorrow" in Europe/Rome
function tomorrowRomeBounds(now: Date) {
  const tomorrow = new Date(now.getTime() + 24 * 3600_000);
  const { y, m, day } = romeDateParts(tomorrow);
  // Compute UTC offset for Europe/Rome at that local midnight by probing
  const localMidnightUtcGuess = new Date(`${y}-${m}-${day}T00:00:00Z`);
  // Determine offset by formatting back
  const offsetMs = (() => {
    const dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = dtf.formatToParts(localMidnightUtcGuess).reduce((acc: any, p) => {
      acc[p.type] = p.value; return acc;
    }, {});
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return asUtc - localMidnightUtcGuess.getTime();
  })();
  const start = new Date(localMidnightUtcGuess.getTime() - offsetMs);
  const end = new Date(start.getTime() + 24 * 3600_000);
  return { start, end, localDate: `${day}/${m}/${y}` };
}

function formatRomeTime(iso: string) {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderEmail(localDate: string, events: any[], enterprisesById: Map<string, string>) {
  const rows = events.map((e) => {
    const time = e.all_day
      ? "Tutto il giorno"
      : `${formatRomeTime(e.start_at)} – ${formatRomeTime(e.end_at)}`;
    const ent = e.calendar?.enterprise_id ? enterprisesById.get(e.calendar.enterprise_id) : null;
    const calName = e.calendar?.summary ?? "";
    const meta = [ent, calName, e.location].filter(Boolean).map(escapeHtml).join(" · ");
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;width:140px;color:#475569;font-size:14px;white-space:nowrap;">${time}</td>
        <td style="padding:12px 0 12px 16px;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:600;color:#0f172a;font-size:15px;">${escapeHtml(e.title ?? "(senza titolo)")}</div>
          ${meta ? `<div style="color:#64748b;font-size:13px;margin-top:2px;">${meta}</div>` : ""}
        </td>
      </tr>`;
  }).join("");

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;">
    <div style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">FlyDeck · Agenda di domani</div>
    <h1 style="margin:6px 0 4px;font-size:22px;color:#0f172a;">${localDate}</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;">Hai ${events.length} event${events.length === 1 ? "o" : "i"} in programma.</p>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">Email automatica inviata da FlyDeck alle 20:00.</p>
  </div>
</body></html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "FlyDeck <noreply@radar.flydeck.app>",
      to: [to],
      subject,
      html,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // When invoked by cron, only run if it's currently 20:00 in Rome (handles DST).
    // Manual invocations (with ?force=1) bypass this gate.
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    if (!force) {
      const romeHour = new Intl.DateTimeFormat("en-GB", {
        timeZone: TZ, hour: "2-digit", hour12: false,
      }).format(new Date());
      if (romeHour !== "20") {
        return new Response(JSON.stringify({ ok: true, skipped: `rome hour is ${romeHour}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { start, end, localDate } = tomorrowRomeBounds(new Date());

    // Fetch all events for tomorrow (Rome local day) + calendar metadata
    const { data: events, error: evErr } = await admin
      .from("external_calendar_events")
      .select("id,user_id,title,location,start_at,end_at,all_day,google_calendar_id,connection_id")
      .gte("start_at", start.toISOString())
      .lt("start_at", end.toISOString())
      .order("start_at", { ascending: true });
    if (evErr) throw evErr;

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "no events" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calendar metadata (summary + enterprise mapping) — filter to enabled
    const { data: calRows } = await admin
      .from("google_calendar_list")
      .select("connection_id,google_calendar_id,summary,enterprise_id,enabled");
    const calKey = (cid: string, gid: string) => `${cid}::${gid}`;
    const calMap = new Map<string, any>();
    (calRows ?? []).forEach((c: any) => calMap.set(calKey(c.connection_id, c.google_calendar_id), c));

    const enabledEvents = events.filter((e: any) => {
      const c = calMap.get(calKey(e.connection_id, e.google_calendar_id));
      return c && c.enabled !== false;
    }).map((e: any) => ({ ...e, calendar: calMap.get(calKey(e.connection_id, e.google_calendar_id)) }));

    // Enterprises lookup
    const entIds = Array.from(new Set(enabledEvents.map((e: any) => e.calendar?.enterprise_id).filter(Boolean)));
    const entMap = new Map<string, string>();
    if (entIds.length > 0) {
      const { data: ents } = await admin.from("enterprises").select("id,name").in("id", entIds);
      (ents ?? []).forEach((e: any) => entMap.set(e.id, e.name));
    }

    // Group by user
    const byUser = new Map<string, any[]>();
    for (const e of enabledEvents) {
      const list = byUser.get(e.user_id) ?? [];
      list.push(e);
      byUser.set(e.user_id, list);
    }

    const results: any[] = [];
    for (const [userId, userEvents] of byUser) {
      // Get user email via RPC (uses SECURITY DEFINER access to auth.users)
      const { data: emailData } = await admin.rpc("get_user_email", { _user_id: userId });
      const email = emailData as string | null;
      if (!email) {
        results.push({ userId, skipped: "no email" });
        continue;
      }
      try {
        const html = renderEmail(localDate, userEvents, entMap);
        const subject = `Agenda di domani · ${userEvents.length} event${userEvents.length === 1 ? "o" : "i"}`;
        const r = await sendEmail(email, subject, html);
        results.push({ userId, email, count: userEvents.length, id: r.id });
      } catch (err) {
        console.error("send failed", userId, err);
        results.push({ userId, email, error: (err as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, date: localDate, sent: results.length, results }), {
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
