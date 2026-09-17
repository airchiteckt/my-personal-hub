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

const DEFAULTS = {
  enabled: true,
  pre_task: true,
  task_checkin: true,
  appointment: true,
  free_slot: true,
  deadline_risk: true,
  postponed: true,
  day_close: true,
  weekly_review: true,
  lead_minutes: 10,
  day_close_time: "18:30",
  max_per_hour: 4,
  snoozed_until: null as string | null,
};

function romeNow() {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value])) as any;
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: ROME, weekday: "short" })
    .format(new Date());
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    time: `${p.hour}:${p.minute}`,
    weekday: p.weekday as string,
    dow, // Sun, Mon, ...
  };
}

const toMin = (t?: string | null) => {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fromMin = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
};
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`);
const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

async function aiText(system: string, user: string): Promise<string | null> {
  try {
    const res = await fetch(`${AI_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) { console.error("AI error", res.status, await res.text()); return null; }
    const json = await res.json();
    return (json?.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch (e) {
    console.error("AI failed", e);
    return null;
  }
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

const addDays = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Nudge = {
  kind: string;
  dedupe: string;
  text: string;
  buttons?: { text: string; callback_data: string }[][];
  entity_table?: string;
  entity_id?: string;
};

async function evaluate(admin: any, userId: string, prefs: any, now: ReturnType<typeof romeNow>): Promise<Nudge[]> {
  const out: Nudge[] = [];
  const today = now.date;

  const { data: ps } = await admin.from("priority_settings")
    .select("work_start_time,work_end_time").eq("user_id", userId).maybeSingle();
  const workStart = toMin(ps?.work_start_time) ?? 9 * 60;
  const workEnd = toMin(ps?.work_end_time) ?? 19 * 60;

  const [tasksRes, apptsRes, extRes] = await Promise.all([
    admin.from("tasks").select("id,title,scheduled_time,estimated_minutes,priority,deadline,status,scheduled_date,postpone_count")
      .eq("user_id", userId).neq("status", "done"),
    admin.from("appointments").select("id,title,date,start_time,end_time,description")
      .eq("user_id", userId).eq("date", today),
    admin.from("external_calendar_events").select("title,start_at,end_at,all_day,google_event_id")
      .eq("user_id", userId)
      .gte("start_at", romeDayBounds(today).start.toISOString())
      .lt("start_at", romeDayBounds(today).end.toISOString()),
  ]);

  const allTasks: any[] = tasksRes.data ?? [];
  const todayTasks = allTasks.filter((t) => t.scheduled_date === today && toMin(t.scheduled_time) !== null);
  const appts: any[] = apptsRes.data ?? [];
  const ext: any[] = extRes.data ?? [];

  const inWork = now.minutes >= workStart && now.minutes <= workEnd;

  // 1. check-in a fine attività
  if (prefs.task_checkin && inWork) {
    for (const t of todayTasks) {
      const end = (toMin(t.scheduled_time) ?? 0) + (t.estimated_minutes ?? 30);
      const delta = now.minutes - end;
      if (delta >= 0 && delta < 10) {
        out.push({
          kind: "task_checkin",
          dedupe: `checkin:${t.id}:${today}`,
          entity_table: "tasks",
          entity_id: t.id,
          text: `⏱ <b>${esc(t.title)}</b> doveva finire alle ${fromMin(end)}.\nÈ completata?`,
          buttons: [
            [{ text: "✅ Completata", callback_data: `rd:done:${t.id}` }],
            [{ text: "+15 min", callback_data: `rd:m15:${t.id}` }, { text: "+30 min", callback_data: `rd:m30:${t.id}` }],
            [{ text: "📅 A domani", callback_data: `rd:tmr:${t.id}` }],
          ],
        });
      }
    }
  }

  // 2. prima di un'attività
  if (prefs.pre_task) {
    for (const t of todayTasks) {
      const start = toMin(t.scheduled_time) ?? 0;
      const delta = start - now.minutes;
      if (delta > 0 && delta <= (prefs.lead_minutes ?? 10)) {
        out.push({
          kind: "pre_task",
          dedupe: `pre:${t.id}:${today}`,
          entity_table: "tasks",
          entity_id: t.id,
          text: `🔔 Tra ${delta} min: <b>${esc(t.title)}</b> (${dur(t.estimated_minutes ?? 30)}, ore ${fromMin(start)}).`,
          buttons: [
            [{ text: "👍 Ok", callback_data: `rd:ack:${t.id}` }, { text: "⏭ +30 min", callback_data: `rd:snz:${t.id}` }],
            [{ text: "🚫 Oggi no", callback_data: `rd:skip:${t.id}` }],
          ],
        });
      }
    }
  }

  // 3. appuntamenti imminenti
  if (prefs.appointment) {
    for (const a of appts) {
      const start = toMin(a.start_time);
      if (start === null) continue;
      const delta = start - now.minutes;
      if (delta > 0 && delta <= 15) {
        out.push({
          kind: "appointment",
          dedupe: `appt:${a.id}`,
          entity_table: "appointments",
          entity_id: a.id,
          text: `📅 Tra ${delta} min: <b>${esc(a.title)}</b> (${a.start_time}–${a.end_time}).${a.description ? `\n${esc(String(a.description).slice(0, 300))}` : ""}`,
        });
      }
    }
    for (const e of ext) {
      if (e.all_day) continue;
      const startAt = new Date(e.start_at).getTime();
      const delta = Math.round((startAt - Date.now()) / 60000);
      if (delta > 0 && delta <= 15) {
        const hhmm = new Intl.DateTimeFormat("it-IT", { timeZone: ROME, hour: "2-digit", minute: "2-digit" }).format(new Date(e.start_at));
        out.push({
          kind: "appointment",
          dedupe: `gcal:${e.google_event_id ?? e.title}:${e.start_at}`,
          text: `📅 Tra ${delta} min: <b>${esc(e.title ?? "Evento")}</b> (ore ${hhmm}).`,
        });
      }
    }
  }

  // 4. scadenze a rischio
  if (prefs.deadline_risk && inWork) {
    const limit = Date.now() + 48 * 3600_000;
    for (const t of allTasks) {
      if (!t.deadline || t.scheduled_date) continue;
      const d = new Date(t.deadline).getTime();
      if (d > Date.now() && d <= limit) {
        out.push({
          kind: "deadline_risk",
          dedupe: `dl:${t.id}`,
          entity_table: "tasks",
          entity_id: t.id,
          text: `⚠️ <b>${esc(t.title)}</b> scade entro 48 ore e non è in agenda.\nLa pianifico oggi?`,
          buttons: [[
            { text: "📌 Pianifica oggi", callback_data: `rd:plan:${t.id}` },
            { text: "No", callback_data: `rd:no:${t.id}` },
          ]],
        });
      }
    }
  }

  // 5. attività rimandate troppe volte
  if (prefs.postponed && inWork) {
    for (const t of allTasks) {
      if ((t.postpone_count ?? 0) >= 3) {
        out.push({
          kind: "postponed",
          dedupe: `pp:${t.id}:${t.postpone_count}`,
          entity_table: "tasks",
          entity_id: t.id,
          text: `🔁 <b>${esc(t.title)}</b> l'hai rimandata ${t.postpone_count} volte.\nLa metti in agenda oggi o la togli?`,
          buttons: [[
            { text: "📌 Oggi", callback_data: `rd:plan:${t.id}` },
            { text: "🗑 Elimina", callback_data: `rd:del:${t.id}` },
          ]],
        });
      }
    }
  }

  // 6. buco libero
  if (prefs.free_slot && inWork) {
    const busy: [number, number][] = [
      ...todayTasks.map((t) => [toMin(t.scheduled_time)!, toMin(t.scheduled_time)! + (t.estimated_minutes ?? 30)] as [number, number]),
      ...appts.map((a) => [toMin(a.start_time) ?? 0, toMin(a.end_time) ?? 0] as [number, number]),
    ].sort((a, b) => a[0] - b[0]);

    const busyNow = busy.some(([s, e]) => now.minutes >= s && now.minutes < e);
    if (!busyNow) {
      const nextStart = busy.find(([s]) => s > now.minutes)?.[0] ?? workEnd;
      const gap = nextStart - now.minutes;
      if (gap >= 45) {
        const rank = { high: 3, medium: 2, low: 1 } as Record<string, number>;
        const candidate = allTasks
          .filter((t) => !t.scheduled_date && (t.estimated_minutes ?? 30) <= gap)
          .sort((a, b) => (rank[b.priority] ?? 0) - (rank[a.priority] ?? 0) || (b.estimated_minutes ?? 0) - (a.estimated_minutes ?? 0))[0];
        if (candidate) {
          out.push({
            kind: "free_slot",
            dedupe: `slot:${today}:${Math.floor(now.minutes / 120)}`,
            entity_table: "tasks",
            entity_id: candidate.id,
            text: `🕳 Hai ${dur(gap)} liberi fino alle ${fromMin(nextStart)}.\nTi propongo <b>${esc(candidate.title)}</b> (${dur(candidate.estimated_minutes ?? 30)}).`,
            buttons: [[
              { text: "📌 Pianifica ora", callback_data: `rd:plan:${candidate.id}` },
              { text: "No grazie", callback_data: `rd:no:${candidate.id}` },
            ]],
          });
        }
      }
    }
  }

  // 7. chiusura giornata
  if (prefs.day_close) {
    const close = toMin(prefs.day_close_time) ?? 18 * 60 + 30;
    if (now.minutes >= close && now.minutes < close + 10) {
      const { data: doneToday } = await admin.from("tasks").select("id,title")
        .eq("user_id", userId).eq("status", "done").eq("scheduled_date", today);
      const open = todayTasks;
      const lines = open.slice(0, 8).map((t) => `• ${esc(t.title)}`).join("\n");
      out.push({
        kind: "day_close",
        dedupe: `close:${today}`,
        text: `🌇 <b>Chiusura giornata</b>\nCompletate: ${doneToday?.length ?? 0} · Rimaste: ${open.length}` +
          (open.length ? `\n${lines}` : "\nGiornata pulita, tutto fatto.") +
          (open.length ? `\n\nSposto le rimanenti a domani?` : ""),
        buttons: open.length
          ? [[{ text: "📅 Chiudi e sposta a domani", callback_data: "rd:close:day" }, { text: "Vedo dopo", callback_data: "rd:no:none" }]]
          : undefined,
      });
    }
  }

  // 8. revisione settimanale (domenica)
  if (prefs.weekly_review && now.dow === "Sun" && now.minutes >= 18 * 60 && now.minutes < 18 * 60 + 10) {
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [krs, stale, nextWeek] = await Promise.all([
      admin.from("key_results").select("title,current_value,target_value,updated_at").eq("user_id", userId).eq("status", "active"),
      admin.from("tasks").select("id").eq("user_id", userId).neq("status", "done").lt("created_at", weekAgo).is("scheduled_date", null),
      admin.from("tasks").select("id,estimated_minutes").eq("user_id", userId).neq("status", "done")
        .gte("scheduled_date", addDays(today, 1)).lte("scheduled_date", addDays(today, 7)),
    ]);
    const fermi = (krs.data ?? []).filter((k: any) => k.updated_at && k.updated_at < weekAgo);
    const load = (nextWeek.data ?? []).reduce((s: number, t: any) => s + (t.estimated_minutes ?? 30), 0);
    const body = [
      `Key result fermi da 7+ giorni: ${fermi.length}${fermi.length ? "\n" + fermi.slice(0, 5).map((k: any) => `• ${esc(k.title)}`).join("\n") : ""}`,
      `Attività in backlog da oltre una settimana: ${stale.data?.length ?? 0}`,
      `Carico pianificato per la settimana: ${dur(load)}`,
    ].join("\n");
    const ai = await aiText(
      "Sei Radar, assistente di FlyDeck. Scrivi in italiano, tono professionale e diretto, HTML Telegram (<b>,<i>), max 900 caratteri, niente metafore aeronautiche, nessun link inventato.",
      `Scrivi una revisione settimanale con 2-3 considerazioni pratiche a partire da questi dati:\n${body}`,
    );
    out.push({
      kind: "weekly_review",
      dedupe: `weekly:${today}`,
      text: `📊 <b>Revisione settimanale</b>\n${ai ?? body}`,
    });
  }

  return out;
}

const PRIORITY = ["task_checkin", "pre_task", "appointment", "day_close", "weekly_review", "deadline_risk", "postponed", "free_slot"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!TELEGRAM_API_KEY || !LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = romeNow();
    const { data: links } = await admin.from("telegram_links").select("user_id,chat_id");
    const results: any[] = [];

    for (const link of links ?? []) {
      try {
        const { data: prefRow } = await admin.from("radar_preferences").select("*").eq("user_id", link.user_id).maybeSingle();
        const prefs = { ...DEFAULTS, ...(prefRow ?? {}) };
        if (!prefs.enabled) { results.push({ chat_id: link.chat_id, skipped: "disabled" }); continue; }
        if (prefs.snoozed_until && new Date(prefs.snoozed_until) > new Date()) {
          results.push({ chat_id: link.chat_id, skipped: "snoozed" }); continue;
        }

        const { count } = await admin.from("radar_nudges").select("id", { count: "exact", head: true })
          .eq("user_id", link.user_id).gte("sent_at", new Date(Date.now() - 3600_000).toISOString());
        if ((count ?? 0) >= (prefs.max_per_hour ?? 4)) {
          results.push({ chat_id: link.chat_id, skipped: "rate limit" }); continue;
        }

        const candidates = await evaluate(admin, link.user_id, prefs, now);
        if (!candidates.length) { results.push({ chat_id: link.chat_id, nudges: 0 }); continue; }
        candidates.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));

        let sent = 0;
        for (const n of candidates) {
          if (sent >= 1) break;
          const { data: inserted, error } = await admin.from("radar_nudges").insert({
            user_id: link.user_id, kind: n.kind, dedupe_key: n.dedupe,
            entity_table: n.entity_table ?? null, entity_id: n.entity_id ?? null,
          }).select("id").maybeSingle();
          if (error) continue; // già inviato (dedupe) o errore: salta
          const res = await tg("sendMessage", {
            chat_id: link.chat_id,
            text: n.text,
            parse_mode: "HTML",
            ...(n.buttons ? { reply_markup: { inline_keyboard: n.buttons } } : {}),
          });
          if (res?.result?.message_id && inserted?.id) {
            await admin.from("radar_nudges").update({ telegram_message_id: res.result.message_id }).eq("id", inserted.id);
          }
          sent++;
        }
        results.push({ chat_id: link.chat_id, nudges: sent });
      } catch (e) {
        console.error("radar-pulse failed", link.chat_id, e);
        results.push({ chat_id: link.chat_id, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ ok: true, at: now.time, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
