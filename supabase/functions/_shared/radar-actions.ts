// Logica Radar condivisa tra telegram-webhook, agente vocale ElevenLabs e promemoria.
// Nessun cambio di comportamento rispetto al codice originale di telegram-webhook.

export const ROME = "Europe/Rome";

export function romeNow() {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ROME, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "long",
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: parts.weekday,
  };
}

export function romeDayBounds(dateStr: string) {
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

// ---------- action execution ----------

export async function executeAction(
  admin: any,
  userId: string,
  name: string,
  a: Record<string, any>,
): Promise<{ table: string; id: string } | { error: string }> {
  try {
    if (name === "create_appointment") {
      const { data, error } = await admin.from("appointments").insert({
        user_id: userId,
        enterprise_id: a.enterprise_id ?? null,
        title: a.title,
        description: a.description ?? null,
        date: a.date,
        start_time: a.start_time,
        end_time: a.end_time,
      }).select("id").single();
      if (error) throw error;
      return { table: "appointments", id: data.id };
    }
    if (name === "create_reminder") {
      const { data, error } = await admin.from("reminders").insert({
        user_id: userId,
        title: a.title,
        description: a.description ?? null,
        reminder_date: a.reminder_date,
        reminder_time: a.reminder_time ?? null,
        enterprise_id: a.enterprise_id ?? null,
        is_urgent: a.is_urgent === true,
      }).select("id").single();
      if (error) throw error;
      return { table: "reminders", id: data.id };
    }
    if (name === "dismiss_reminder") {
      const { error } = await admin.from("reminders")
        .update({ is_dismissed: true })
        .eq("id", a.reminder_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "reminders", id: a.reminder_id };
    }
    if (name === "postpone_reminder") {
      const minutes = Math.min(Math.max(Number(a.minutes ?? 60), 5), 24 * 60);
      const now = romeNow();
      const [h, m] = now.time.split(":").map(Number);
      const total = h * 60 + m + minutes;
      const dayOffset = Math.floor(total / 1440);
      const hh = String(Math.floor((total % 1440) / 60)).padStart(2, "0");
      const mm = String(total % 60).padStart(2, "0");
      const d = new Date(`${now.date}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      const { error } = await admin.from("reminders")
        .update({ reminder_date: d.toISOString().slice(0, 10), reminder_time: `${hh}:${mm}`, call_status: null })
        .eq("id", a.reminder_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "reminders", id: a.reminder_id };
    }
    if (name === "create_task") {
      // Validate/resolve project: the AI may pass a non-existent or stale id
      let projectId: string | null = null;
      let enterpriseId: string | null = a.enterprise_id ?? null;

      if (a.project_id) {
        const { data: p } = await admin.from("projects")
          .select("id,enterprise_id").eq("id", a.project_id).eq("user_id", userId).maybeSingle();
        if (p) { projectId = p.id; enterpriseId = p.enterprise_id ?? enterpriseId; }
      }

      if (!projectId) {
        if (enterpriseId) {
          const { data: e } = await admin.from("enterprises")
            .select("id").eq("id", enterpriseId).eq("user_id", userId).maybeSingle();
          if (!e) enterpriseId = null;
        }
        if (!enterpriseId) {
          const { data: pe } = await admin.from("enterprises")
            .select("id").eq("user_id", userId).eq("is_personal", true).maybeSingle();
          enterpriseId = pe?.id ?? null;
        }
        if (!enterpriseId) {
          const { data: anyE } = await admin.from("enterprises")
            .select("id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
          enterpriseId = anyE?.id ?? null;
        }
        if (!enterpriseId) return { error: "Nessuna impresa disponibile: creane una prima di aggiungere attività." };

        const { data: existing } = await admin.from("projects")
          .select("id").eq("user_id", userId).eq("enterprise_id", enterpriseId)
          .eq("type", "operational").order("created_at", { ascending: true }).limit(1).maybeSingle();
        if (existing) projectId = existing.id;
        else {
          const { data: created, error: pErr } = await admin.from("projects").insert({
            user_id: userId,
            enterprise_id: enterpriseId,
            name: "Attività varie",
            type: "operational",
          }).select("id").single();
          if (pErr) throw pErr;
          projectId = created.id;
        }
      }

      const { data, error } = await admin.from("tasks").insert({
        user_id: userId,
        enterprise_id: enterpriseId,
        project_id: projectId,
        title: a.title,
        description: a.description ?? null,
        priority: a.priority ?? "medium",
        estimated_minutes: a.estimated_minutes ?? 30,
        status: a.scheduled_date ? "scheduled" : "backlog",
        scheduled_date: a.scheduled_date ?? null,
        scheduled_time: a.scheduled_time ?? null,
        deadline: a.deadline ?? null,
      }).select("id").single();
      if (error) throw error;
      return { table: "tasks", id: data.id };
    }

    if (name === "schedule_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "scheduled", scheduled_date: a.date, scheduled_time: a.time ?? null })
        .eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "complete_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "create_project") {
      const { data, error } = await admin.from("projects").insert({
        user_id: userId,
        enterprise_id: a.enterprise_id,
        name: a.name,
        type: a.type ?? "operational",
      }).select("id").single();
      if (error) throw error;
      return { table: "projects", id: data.id };
    }
    if (name === "move_appointment") {
      const patch: Record<string, any> = {};
      if (a.date) patch.date = a.date;
      if (a.start_time) patch.start_time = a.start_time;
      if (a.end_time) patch.end_time = a.end_time;
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("appointments").update(patch)
        .eq("id", a.appointment_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "appointments", id: a.appointment_id };
    }
    if (name === "cancel_appointment") {
      const { error } = await admin.from("appointments").delete()
        .eq("id", a.appointment_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "appointments", id: a.appointment_id };
    }
    if (name === "create_enterprise") {
      const { data, error } = await admin.from("enterprises").insert({
        user_id: userId,
        name: a.name,
        description: a.description ?? null,
        status: a.status ?? "development",
        color: "220 80% 55%",
      }).select("id").single();
      if (error) throw error;
      return { table: "enterprises", id: data.id };
    }
    return { error: `Azione sconosciuta: ${name}` };
  } catch (e: any) {
    console.error("executeAction error", name, e?.message ?? e);
    return { error: e?.message ?? "errore sconosciuto" };
  }
}

// ---------- context ----------

export async function buildContext(admin: any, userId: string) {
  const today = romeNow().date;
  const [ent, proj, tasks, appts, rem, focus, objs, krs] = await Promise.all([
    admin.from("enterprises").select("id,name,is_personal,status").eq("user_id", userId),
    admin.from("projects").select("id,name,enterprise_id,type").eq("user_id", userId),
    admin.from("tasks").select("id,title,project_id,enterprise_id,status,priority,scheduled_date,scheduled_time,estimated_minutes,deadline")
      .eq("user_id", userId).neq("status", "done").limit(150),
    admin.from("appointments").select("id,title,date,start_time,end_time,enterprise_id")
      .eq("user_id", userId).gte("date", today).order("date").limit(50),
    admin.from("reminders").select("id,title,reminder_date,reminder_time,is_urgent")
      .eq("user_id", userId).eq("is_dismissed", false).gte("reminder_date", today).limit(50),
    admin.from("focus_periods").select("id,name,enterprise_id,status").eq("user_id", userId).eq("status", "active"),
    admin.from("objectives").select("id,title,focus_period_id,enterprise_id").eq("user_id", userId).eq("status", "active"),
    admin.from("key_results").select("id,title,objective_id,enterprise_id,current_value,target_value").eq("user_id", userId),
  ]);
  return {
    enterprises: ent.data ?? [],
    projects: proj.data ?? [],
    tasks: tasks.data ?? [],
    appointments: appts.data ?? [],
    reminders: rem.data ?? [],
    focus_periods: focus.data ?? [],
    objectives: objs.data ?? [],
    key_results: krs.data ?? [],
  };
}

// ---------- day summary (testo parlato/leggibile) ----------

export async function buildDaySummary(admin: any, userId: string): Promise<string> {
  const now = romeNow();
  const ctx = await buildContext(admin, userId);
  const todayAppts = ctx.appointments.filter((a: any) => a.date === now.date)
    .map((a: any) => `${a.start_time}-${a.end_time} ${a.title}`);
  const todayTasks = ctx.tasks.filter((t: any) => t.scheduled_date === now.date)
    .map((t: any) => `${t.scheduled_time ? t.scheduled_time + " " : ""}${t.title}`);
  const todayRem = ctx.reminders.filter((r: any) => r.reminder_date === now.date)
    .map((r: any) => `${r.reminder_time ? r.reminder_time + " " : ""}${r.title}${r.is_urgent ? " (IMPORTANTE)" : ""}`);
  const backlog = ctx.tasks.filter((t: any) => t.status === "backlog").length;
  const parts = [`Oggi è ${now.weekday} ${now.date}, sono le ${now.time}.`];
  parts.push(todayAppts.length ? `Appuntamenti: ${todayAppts.join("; ")}.` : "Nessun appuntamento oggi.");
  parts.push(todayTasks.length ? `Attività pianificate: ${todayTasks.join("; ")}.` : "Nessuna attività pianificata oggi.");
  if (todayRem.length) parts.push(`Promemoria: ${todayRem.join("; ")}.`);
  parts.push(`In backlog ci sono ${backlog} attività.`);
  return parts.join("\n");
}

// ---------- interrogazione dati (risposte brevi, adatte alla voce) ----------

function addDays(dateStr: string, n: number) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function queryRadar(
  admin: any, userId: string, name: string, a: Record<string, any> = {},
): Promise<string> {
  const now = romeNow();
  try {
    if (name === "get_day_overview") return await buildDaySummary(admin, userId);

    if (name === "get_agenda") {
      const from = a.date || now.date;
      const to = a.to_date || from;
      const [{ data: appts }, { data: tasks }, { data: rem }] = await Promise.all([
        admin.from("appointments").select("id,title,date,start_time,end_time")
          .eq("user_id", userId).gte("date", from).lte("date", to).order("date"),
        admin.from("tasks").select("id,title,scheduled_date,scheduled_time,estimated_minutes")
          .eq("user_id", userId).neq("status", "done")
          .gte("scheduled_date", from).lte("scheduled_date", to).order("scheduled_date"),
        admin.from("reminders").select("id,title,reminder_date,reminder_time,is_urgent")
          .eq("user_id", userId).eq("is_dismissed", false)
          .gte("reminder_date", from).lte("reminder_date", to),
      ]);
      const lines: string[] = [`Agenda dal ${from} al ${to}:`];
      for (const x of appts ?? []) lines.push(`Appuntamento ${x.date} ${x.start_time}-${x.end_time}: ${x.title} (id ${x.id})`);
      for (const x of tasks ?? []) lines.push(`Attività ${x.scheduled_date} ${x.scheduled_time ?? ""}: ${x.title} (${x.estimated_minutes} min, id ${x.id})`);
      for (const x of rem ?? []) lines.push(`Promemoria ${x.reminder_date} ${x.reminder_time ?? ""}: ${x.title}${x.is_urgent ? " (importante)" : ""} (id ${x.id})`);
      return lines.length > 1 ? lines.join("\n") : "Niente in agenda in questo periodo.";
    }

    if (name === "list_tasks") {
      const scope: string = a.scope || "today";
      let q = admin.from("tasks")
        .select("id,title,status,priority,scheduled_date,scheduled_time,estimated_minutes,deadline,enterprise_id,project_id")
        .eq("user_id", userId).neq("status", "done").limit(30);
      if (scope === "today") q = q.eq("scheduled_date", now.date);
      else if (scope === "week") q = q.gte("scheduled_date", now.date).lte("scheduled_date", addDays(now.date, 7));
      else if (scope === "backlog") q = q.eq("status", "backlog");
      else if (scope === "overdue") q = q.lt("scheduled_date", now.date);
      if (a.search) q = q.ilike("title", `%${a.search}%`);
      const { data } = await q;
      if (!data?.length) return "Nessuna attività trovata con questi criteri.";
      return data.map((t: any) =>
        `${t.title} — ${t.status}${t.scheduled_date ? `, ${t.scheduled_date}${t.scheduled_time ? " " + t.scheduled_time : ""}` : ""}, priorità ${t.priority}, ${t.estimated_minutes} min (id ${t.id})`
      ).join("\n");
    }

    if (name === "list_projects") {
      const [{ data: projects }, { data: ent }] = await Promise.all([
        admin.from("projects").select("id,name,type,enterprise_id").eq("user_id", userId).limit(60),
        admin.from("enterprises").select("id,name").eq("user_id", userId),
      ]);
      const byId = new Map((ent ?? []).map((e: any) => [e.id, e.name]));
      let rows = projects ?? [];
      if (a.enterprise_name) {
        const needle = String(a.enterprise_name).toLowerCase();
        rows = rows.filter((p: any) => String(byId.get(p.enterprise_id) ?? "").toLowerCase().includes(needle));
      }
      if (!rows.length) return "Nessun progetto trovato.";
      return rows.map((p: any) => `${p.name} (${p.type}) — impresa ${byId.get(p.enterprise_id) ?? "?"} (id ${p.id})`).join("\n");
    }

    if (name === "list_enterprises") {
      const { data } = await admin.from("enterprises")
        .select("id,name,status,is_personal").eq("user_id", userId);
      if (!data?.length) return "Nessuna impresa.";
      return data.map((e: any) => `${e.name} (${e.status}${e.is_personal ? ", personale" : ""}, id ${e.id})`).join("\n");
    }

    if (name === "get_okr") {
      const [{ data: focus }, { data: objs }, { data: krs }, { data: ent }] = await Promise.all([
        admin.from("focus_periods").select("id,name,enterprise_id,start_date,end_date").eq("user_id", userId).eq("status", "active"),
        admin.from("objectives").select("id,title,focus_period_id").eq("user_id", userId).eq("status", "active"),
        admin.from("key_results").select("id,title,objective_id,current_value,target_value").eq("user_id", userId),
        admin.from("enterprises").select("id,name").eq("user_id", userId),
      ]);
      if (!focus?.length) return "Nessun focus period attivo.";
      const entName = new Map((ent ?? []).map((e: any) => [e.id, e.name]));
      const lines: string[] = [];
      for (const f of focus) {
        lines.push(`Focus "${f.name}" — ${entName.get(f.enterprise_id) ?? "?"} (fino al ${f.end_date})`);
        for (const o of (objs ?? []).filter((o: any) => o.focus_period_id === f.id)) {
          lines.push(`  Obiettivo: ${o.title}`);
          for (const k of (krs ?? []).filter((k: any) => k.objective_id === o.id)) {
            const pct = k.target_value ? Math.round((Number(k.current_value) / Number(k.target_value)) * 100) : 0;
            lines.push(`    Key result: ${k.title} — ${k.current_value} su ${k.target_value} (${pct}%)`);
          }
        }
      }
      return lines.join("\n");
    }

    if (name === "find_item") {
      const term = String(a.query ?? "").trim();
      if (!term) return "Indica cosa cercare.";
      const [{ data: tasks }, { data: appts }, { data: rem }] = await Promise.all([
        admin.from("tasks").select("id,title,scheduled_date,status").eq("user_id", userId).ilike("title", `%${term}%`).limit(10),
        admin.from("appointments").select("id,title,date,start_time").eq("user_id", userId).ilike("title", `%${term}%`).limit(10),
        admin.from("reminders").select("id,title,reminder_date").eq("user_id", userId).eq("is_dismissed", false).ilike("title", `%${term}%`).limit(10),
      ]);
      const lines: string[] = [];
      for (const t of tasks ?? []) lines.push(`Attività: ${t.title} (${t.status}${t.scheduled_date ? ", " + t.scheduled_date : ""}, id ${t.id})`);
      for (const x of appts ?? []) lines.push(`Appuntamento: ${x.title} (${x.date} ${x.start_time}, id ${x.id})`);
      for (const x of rem ?? []) lines.push(`Promemoria: ${x.title} (${x.reminder_date}, id ${x.id})`);
      return lines.length ? lines.join("\n") : `Nessun risultato per "${term}".`;
    }

    return `Interrogazione sconosciuta: ${name}`;
  } catch (e: any) {
    console.error("queryRadar error", name, e?.message ?? e);
    return "Non riesco a leggere i dati in questo momento.";
  }
}

export const RADAR_QUERY_TOOLS = new Set([
  "get_day_overview", "get_agenda", "list_tasks", "list_projects",
  "list_enterprises", "get_okr", "find_item",
]);

// ---------- definizione strumenti (condivisa voce/telegram) ----------

export const RADAR_TOOL_DEFS = [
  {
    name: "create_appointment",
    description: "Crea un appuntamento nel calendario",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        start_time: { type: "string", description: "HH:MM" },
        end_time: { type: "string", description: "HH:MM" },
        description: { type: "string" },
        enterprise_id: { type: "string" },
      },
      required: ["title", "date", "start_time", "end_time"],
    },
  },
  {
    name: "create_reminder",
    description: "Crea un promemoria. Marca is_urgent=true solo se l'utente chiede esplicitamente una chiamata o dice che è importante o urgente.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        reminder_date: { type: "string", description: "YYYY-MM-DD" },
        reminder_time: { type: "string", description: "HH:MM" },
        enterprise_id: { type: "string" },
        is_urgent: { type: "boolean" },
      },
      required: ["title", "reminder_date"],
    },
  },
  {
    name: "dismiss_reminder",
    description: "Segna un promemoria come fatto/chiuso",
    parameters: {
      type: "object",
      properties: { reminder_id: { type: "string" } },
      required: ["reminder_id"],
    },
  },
  {
    name: "postpone_reminder",
    description: "Rimanda un promemoria di N minuti da adesso",
    parameters: {
      type: "object",
      properties: { reminder_id: { type: "string" }, minutes: { type: "number" } },
      required: ["reminder_id", "minutes"],
    },
  },
  {
    name: "create_task",
    description: "Crea una task in un progetto esistente",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        project_id: { type: "string" },
        enterprise_id: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        estimated_minutes: { type: "number" },
        deadline: { type: "string", description: "YYYY-MM-DD" },
        scheduled_date: { type: "string", description: "YYYY-MM-DD" },
        scheduled_time: { type: "string", description: "HH:MM" },
      },
      required: ["title", "project_id", "enterprise_id"],
    },
  },
  {
    name: "schedule_task",
    description: "Pianifica una task esistente in una data",
    parameters: {
      type: "object",
      properties: {
        task_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM" },
      },
      required: ["task_id", "date"],
    },
  },
  {
    name: "complete_task",
    description: "Segna una task come completata",
    parameters: {
      type: "object",
      properties: { task_id: { type: "string" } },
      required: ["task_id"],
    },
  },
  {
    name: "get_day_overview",
    description: "Restituisce il riepilogo aggiornato della giornata dell'utente (appuntamenti, attività, promemoria, backlog)",
    parameters: { type: "object", properties: {}, required: [] },
  },
];
