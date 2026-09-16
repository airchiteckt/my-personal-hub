import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";
const AI_URL = "https://ai.gateway.lovable.dev/v1";
const ROME = "Europe/Rome";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function romeNow() {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: p.hour,
    time: `${p.hour}:${p.minute}`,
    weekday: p.weekday,
  };
}

function romeDayBounds(dateStr: string) {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: ROME, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts: any = Object.fromEntries(dtf.formatToParts(guess).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  const offset = asUtc - guess.getTime();
  const start = new Date(guess.getTime() - offset);
  return { start, end: new Date(start.getTime() + 24 * 3600_000) };
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) console.error(`Telegram ${method} failed`, res.status, JSON.stringify(json));
  return json;
}

async function buildDayContext(admin: any, userId: string, date: string) {
  const { start, end } = romeDayBounds(date);
  const [appts, rem, tasks, backlog, focus, objs, krs, ext, ent] = await Promise.all([
    admin.from("appointments").select("title,date,start_time,end_time,location,enterprise_id")
      .eq("user_id", userId).eq("date", date).order("start_time"),
    admin.from("reminders").select("title,reminder_date,reminder_time")
      .eq("user_id", userId).eq("is_dismissed", false).lte("reminder_date", date).order("reminder_date"),
    admin.from("tasks").select("title,scheduled_time,estimated_minutes,priority,deadline,enterprise_id,project_id")
      .eq("user_id", userId).neq("status", "done").eq("scheduled_date", date).order("scheduled_time"),
    admin.from("tasks").select("title,priority,deadline,enterprise_id,project_id")
      .eq("user_id", userId).neq("status", "done").is("scheduled_date", null)
      .order("priority", { ascending: false }).limit(15),
    admin.from("focus_periods").select("name,enterprise_id,end_date").eq("user_id", userId).eq("status", "active"),
    admin.from("objectives").select("title,enterprise_id").eq("user_id", userId).eq("status", "active"),
    admin.from("key_results").select("title,current_value,target_value,enterprise_id").eq("user_id", userId),
    admin.from("external_calendar_events").select("title,start_at,end_at,all_day,location")
      .eq("user_id", userId).gte("start_at", start.toISOString()).lt("start_at", end.toISOString()).order("start_at"),
    admin.from("enterprises").select("id,name").eq("user_id", userId),
  ]);

  return {
    appuntamenti: appts.data ?? [],
    promemoria: rem.data ?? [],
    task_pianificate: tasks.data ?? [],
    backlog_prioritario: backlog.data ?? [],
    focus_attivi: focus.data ?? [],
    obiettivi: objs.data ?? [],
    key_results: krs.data ?? [],
    eventi_google: ext.data ?? [],
    imprese: ent.data ?? [],
  };
}

async function buildBriefing(ctx: unknown, now: ReturnType<typeof romeNow>): Promise<string> {
  const res = await fetch(`${AI_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      messages: [
        {
          role: "system",
          content: `Sei Radar, l'assistente di FlyDeck. Scrivi il briefing del mattino su Telegram, in italiano, tono professionale e diretto.

Formato (HTML Telegram: <b>, <i>, nessun markdown, niente tabelle):
1. Riga di apertura con giorno e data.
2. <b>Agenda</b>: appuntamenti ed eventi in ordine di orario con l'ora (unisci appuntamenti FlyDeck ed eventi Google, evita duplicati).
3. <b>Da fare</b>: task pianificate oggi, con orario se presente.
4. <b>Promemoria</b> solo se ce ne sono.
5. <b>Considerazioni</b>: 2-4 righe utili — carico della giornata, buchi liberi, conflitti di orario, scadenze imminenti, task del backlog da incastrare, allineamento con focus e key result.

Regole: massimo ~1800 caratteri, niente frasi di riempimento, niente metafore aeronautiche, non inventare dati o link. Se una sezione è vuota, dillo in una riga. Il sito è solo https://www.flydeck.app.`,
        },
        {
          role: "user",
          content: `Oggi è ${now.weekday} ${now.date}, ore ${now.time} (Europe/Rome).\n\nDATI (JSON):\n${JSON.stringify(ctx)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI ${res.status}: ${body}`);
  }
  const json = await res.json();
  return (json?.choices?.[0]?.message?.content ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TELEGRAM_API_KEY || !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";
    const now = romeNow();
    if (!force && now.hour !== "08") {
      return new Response(JSON.stringify({ ok: true, skipped: `rome hour ${now.hour}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: links, error } = await admin.from("telegram_links").select("user_id,chat_id");
    if (error) throw error;

    const results: any[] = [];
    for (const link of links ?? []) {
      try {
        const ctx = await buildDayContext(admin, link.user_id, now.date);
        const text = await buildBriefing(ctx, now);
        if (!text) { results.push({ chat_id: link.chat_id, skipped: "empty briefing" }); continue; }
        await tg("sendMessage", { chat_id: link.chat_id, text, parse_mode: "HTML" });
        results.push({ chat_id: link.chat_id, sent: true });
      } catch (e) {
        console.error("briefing failed", link.chat_id, e);
        results.push({ chat_id: link.chat_id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, date: now.date, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
