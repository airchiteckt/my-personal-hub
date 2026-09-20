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
    if (name === "update_task") {
      const patch: Record<string, any> = {};
      for (const k of ["title", "description", "priority", "estimated_minutes", "deadline", "project_id", "impact", "effort"]) {
        if (a[k] !== undefined && a[k] !== null) patch[k] = a[k];
      }
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("tasks").update(patch).eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "unschedule_task") {
      const { error } = await admin.from("tasks")
        .update({ status: "backlog", scheduled_date: null, scheduled_time: null })
        .eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "delete_task") {
      const { error } = await admin.from("tasks").delete().eq("id", a.task_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "tasks", id: a.task_id };
    }
    if (name === "update_appointment") {
      const patch: Record<string, any> = {};
      for (const k of ["title", "description", "date", "start_time", "end_time", "enterprise_id"]) {
        if (a[k] !== undefined && a[k] !== null) patch[k] = a[k];
      }
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("appointments").update(patch)
        .eq("id", a.appointment_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "appointments", id: a.appointment_id };
    }
    if (name === "update_reminder") {
      const patch: Record<string, any> = {};
      if (a.title) patch.title = a.title;
      if (a.description !== undefined) patch.description = a.description;
      if (a.reminder_date) patch.reminder_date = a.reminder_date;
      if (a.reminder_time !== undefined) patch.reminder_time = a.reminder_time;
      if (a.is_urgent !== undefined) patch.is_urgent = a.is_urgent === true;
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("reminders").update(patch)
        .eq("id", a.reminder_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "reminders", id: a.reminder_id };
    }
    if (name === "delete_reminder") {
      const { error } = await admin.from("reminders").delete()
        .eq("id", a.reminder_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "reminders", id: a.reminder_id };
    }
    if (name === "convert_reminder_to_task") {
      const { data: r, error: rErr } = await admin.from("reminders")
        .select("id,title,description,enterprise_id,reminder_date,reminder_time")
        .eq("id", a.reminder_id).eq("user_id", userId).maybeSingle();
      if (rErr) throw rErr;
      if (!r) return { error: "Promemoria non trovato" };
      const created = await executeAction(admin, userId, "create_task", {
        title: a.title ?? r.title,
        description: r.description,
        enterprise_id: a.enterprise_id ?? r.enterprise_id,
        project_id: a.project_id,
        scheduled_date: a.scheduled_date ?? r.reminder_date,
        scheduled_time: a.scheduled_time ?? r.reminder_time,
        estimated_minutes: a.estimated_minutes ?? 30,
        priority: a.priority ?? "medium",
      });
      if ("error" in created) return created;
      await admin.from("reminders").update({ is_dismissed: true }).eq("id", r.id).eq("user_id", userId);
      return created;
    }
    if (name === "update_project") {
      const patch: Record<string, any> = {};
      if (a.name) patch.name = a.name;
      if (a.type) patch.type = a.type;
      if (a.key_result_id !== undefined) patch.key_result_id = a.key_result_id;
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("projects").update(patch)
        .eq("id", a.project_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "projects", id: a.project_id };
    }
    if (name === "delete_project") {
      const { error } = await admin.from("projects").delete()
        .eq("id", a.project_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "projects", id: a.project_id };
    }
    if (name === "update_enterprise") {
      const patch: Record<string, any> = {};
      if (a.name) patch.name = a.name;
      if (a.description !== undefined) patch.description = a.description;
      if (a.status) patch.status = a.status;
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("enterprises").update(patch)
        .eq("id", a.enterprise_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "enterprises", id: a.enterprise_id };
    }
    if (name === "create_focus_period") {
      const { data, error } = await admin.from("focus_periods").insert({
        user_id: userId,
        enterprise_id: a.enterprise_id,
        name: a.name,
        description: a.description ?? null,
        start_date: a.start_date,
        end_date: a.end_date,
        status: "active",
      }).select("id").single();
      if (error) throw error;
      return { table: "focus_periods", id: data.id };
    }
    if (name === "create_objective") {
      const { data: fp } = await admin.from("focus_periods")
        .select("id,enterprise_id").eq("id", a.focus_period_id).eq("user_id", userId).maybeSingle();
      if (!fp) return { error: "Focus period non trovato" };
      const { data, error } = await admin.from("objectives").insert({
        user_id: userId,
        focus_period_id: fp.id,
        enterprise_id: fp.enterprise_id,
        title: a.title,
        description: a.description ?? null,
        status: "active",
      }).select("id").single();
      if (error) throw error;
      return { table: "objectives", id: data.id };
    }
    if (name === "create_key_result") {
      const { data: o } = await admin.from("objectives")
        .select("id,enterprise_id").eq("id", a.objective_id).eq("user_id", userId).maybeSingle();
      if (!o) return { error: "Obiettivo non trovato" };
      const { data, error } = await admin.from("key_results").insert({
        user_id: userId,
        objective_id: o.id,
        enterprise_id: o.enterprise_id,
        title: a.title,
        target_value: a.target_value ?? 100,
        current_value: a.current_value ?? 0,
        metric_type: a.metric_type ?? "number",
        deadline: a.deadline ?? null,
        status: "active",
      }).select("id").single();
      if (error) throw error;
      return { table: "key_results", id: data.id };
    }
    if (name === "update_key_result") {
      const patch: Record<string, any> = {};
      if (a.current_value !== undefined) patch.current_value = a.current_value;
      if (a.target_value !== undefined) patch.target_value = a.target_value;
      if (a.title) patch.title = a.title;
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("key_results").update(patch)
        .eq("id", a.key_result_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "key_results", id: a.key_result_id };
    }
    if (name === "complete_ritual" || name === "skip_ritual") {
      const day = a.completed_date ?? romeNow().date;
      const status = name === "skip_ritual" ? "skipped" : "completed";
      const { data: existing } = await admin.from("ritual_completions")
        .select("id").eq("user_id", userId).eq("ritual_id", a.ritual_id)
        .eq("completed_date", day).maybeSingle();
      if (existing) {
        const { error } = await admin.from("ritual_completions")
          .update({ status, notes: a.notes ?? null }).eq("id", existing.id);
        if (error) throw error;
        return { table: "ritual_completions", id: existing.id };
      }
      const { data, error } = await admin.from("ritual_completions").insert({
        user_id: userId, ritual_id: a.ritual_id, completed_date: day, status,
        completed_time: a.completed_time ?? romeNow().time, notes: a.notes ?? null,
      }).select("id").single();
      if (error) throw error;
      return { table: "ritual_completions", id: data.id };
    }
    if (name === "create_ritual") {
      const { data, error } = await admin.from("rituals").insert({
        user_id: userId,
        name: a.name,
        category: a.category ?? "operativo",
        frequency: a.frequency ?? "daily",
        estimated_minutes: a.estimated_minutes ?? 15,
        enterprise_id: a.enterprise_id ?? null,
        suggested_time: a.suggested_time ?? null,
        suggested_day: a.suggested_day ?? null,
        description: a.description ?? null,
      }).select("id").single();
      if (error) throw error;
      return { table: "rituals", id: data.id };
    }
    if (name === "update_ritual") {
      const patch: Record<string, any> = {};
      for (const k of ["name", "category", "frequency", "estimated_minutes", "suggested_time", "suggested_day", "description", "is_active"]) {
        if (a[k] !== undefined) patch[k] = a[k];
      }
      if (!Object.keys(patch).length) return { error: "Nessuna modifica indicata" };
      const { error } = await admin.from("rituals").update(patch)
        .eq("id", a.ritual_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "rituals", id: a.ritual_id };
    }
    if (name === "delete_ritual") {
      const { error } = await admin.from("rituals").delete()
        .eq("id", a.ritual_id).eq("user_id", userId);
      if (error) throw error;
      return { table: "rituals", id: a.ritual_id };
    }
    if (name === "log_time") {
      const minutes = Math.round(Number(a.minutes ?? (a.hours ? Number(a.hours) * 60 : 0)));
      if (!minutes || minutes <= 0) return { error: "Indica quanto tempo (in minuti o ore)" };
      let taskId: string | null = a.task_id ?? null;
      let projectId: string | null = a.project_id ?? null;
      let enterpriseId: string | null = a.enterprise_id ?? null;
      if (taskId) {
        const { data: t } = await admin.from("tasks")
          .select("project_id,enterprise_id").eq("id", taskId).eq("user_id", userId).maybeSingle();
        if (!t) return { error: "Attività non trovata" };
        projectId = t.project_id; enterpriseId = t.enterprise_id;
      }
      if (!projectId) return { error: "Serve sapere su quale attività o progetto imputare il tempo" };
      if (!enterpriseId) {
        const { data: p } = await admin.from("projects")
          .select("enterprise_id").eq("id", projectId).maybeSingle();
        enterpriseId = p?.enterprise_id ?? null;
      }
      if (!enterpriseId) return { error: "Progetto non valido" };
      const day = a.entry_date ?? romeNow().date;
      const ended = new Date(`${day}T${a.end_time ?? "18:00"}:00+02:00`);
      const started = new Date(ended.getTime() - minutes * 60000);
      const { data, error } = await admin.from("time_entries").insert({
        user_id: userId, task_id: taskId, project_id: projectId, enterprise_id: enterpriseId,
        description: a.description ?? null,
        started_at: started.toISOString(), ended_at: ended.toISOString(),
        duration_minutes: minutes,
      }).select("id").single();
      if (error) throw error;
      return { table: "time_entries", id: data.id };
    }
    if (name === "save_journal_entry") {
      const day = a.entry_date ?? romeNow().date;
      const { data: existing } = await admin.from("journal_entries")
        .select("id").eq("user_id", userId).eq("entry_date", day).maybeSingle();
      if (existing) {
        const patch: Record<string, any> = {};
        if (a.content !== undefined) patch.content = a.content;
        if (a.mood) patch.mood = a.mood;
        for (const k of ["energy_level", "energy_morning", "energy_afternoon", "energy_evening"]) {
          if (a[k] !== undefined) patch[k] = a[k];
        }
        const { error } = await admin.from("journal_entries").update(patch).eq("id", existing.id);
        if (error) throw error;
        return { table: "journal_entries", id: existing.id };
      }
      const { data, error } = await admin.from("journal_entries").insert({
        user_id: userId, entry_date: day, content: a.content ?? "", mood: a.mood ?? null,
        energy_level: a.energy_level ?? null,
        energy_morning: a.energy_morning ?? null,
        energy_afternoon: a.energy_afternoon ?? null,
        energy_evening: a.energy_evening ?? null,
      }).select("id").single();
      if (error) throw error;
      return { table: "journal_entries", id: data.id };
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

/** Giorni lavorativi dell'utente (default lunedì-venerdì). */
export async function getWorkDays(admin: any, userId: string): Promise<number[]> {
  const { data } = await admin.from("priority_settings")
    .select("work_days").eq("user_id", userId).maybeSingle();
  const wd = data?.work_days;
  return Array.isArray(wd) && wd.length ? wd : [1, 2, 3, 4, 5];
}

/** Prossimo giorno lavorativo (YYYY-MM-DD) successivo a fromDate. */
export function nextWorkDayAfter(fromDate: string, workDays: number[]): string {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(fromDate, i);
    if (workDays.includes(new Date(`${d}T12:00:00Z`).getUTCDay())) return d;
  }
  return addDays(fromDate, 1);
}

/**
 * Avvia una chiamata in uscita di Radar verso l'utente (VAPI).
 * Ritorna un messaggio pronto da mostrare all'utente.
 */
export async function startOutboundCall(
  admin: any,
  userId: string,
  opts: { firstMessage?: string; daySummaryPrefix?: string; reminderId?: string } = {},
): Promise<{ ok: boolean; message: string }> {
  const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
  if (!VAPI_API_KEY) return { ok: false, message: "⚠️ Le chiamate non sono configurate." };

  const { data: profile } = await admin.from("profiles")
    .select("phone_number,display_name,phone_verified").eq("user_id", userId).maybeSingle();
  if (!profile?.phone_number) {
    return { ok: false, message: "📵 Non ho il tuo numero: salvalo in Impostazioni → Profilo e ti richiamo." };
  }
  if (!profile?.phone_verified) {
    return { ok: false, message: "🔒 Il tuo numero non è ancora verificato: vai in Impostazioni → Profilo e conferma il codice SMS." };
  }

  const { data: vs } = await admin.from("ai_voice_settings")
    .select("vapi_assistant_id,vapi_phone_number_id").limit(1).maybeSingle();
  if (!vs?.vapi_assistant_id || !vs?.vapi_phone_number_id) {
    return { ok: false, message: "⚠️ Il servizio di chiamata non è ancora attivo." };
  }

  const now = romeNow();
  const daySummary = await buildVoiceDaySummary(admin, userId).catch(() => "");
  const contextBrief = [
    `IMPRESE:\n${await queryRadar(admin, userId, "list_enterprises")}`,
    `PROGETTI:\n${await queryRadar(admin, userId, "list_projects")}`,
  ].join("\n\n").slice(0, 3000);

  const res = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      phoneNumberId: vs.vapi_phone_number_id,
      customer: { number: profile.phone_number },
      assistantId: vs.vapi_assistant_id,
      assistantOverrides: {
        variableValues: {
          user_known: "yes",
          user_name: profile.display_name ?? "",
          user_id: userId,
          ...(opts.reminderId ? { reminder_id: opts.reminderId } : {}),
          now_info: `${now.weekday} ${now.date}, ore ${now.time}`,
          context_brief: contextBrief,
          day_summary: `${opts.daySummaryPrefix ? opts.daySummaryPrefix + "\n" : ""}${daySummary}`,
        },
        firstMessage: opts.firstMessage
          ?? `Ciao${profile.display_name ? " " + profile.display_name : ""}, sono Radar. Dimmi pure.`,
      },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.id) {
    console.error("outbound call failed", res.status, JSON.stringify(json));
    return { ok: false, message: "⚠️ Non sono riuscito ad avviare la chiamata, riprova tra poco." };
  }

  await admin.from("voice_calls").insert({
    user_id: userId,
    direction: "outbound",
    phone_number: profile.phone_number,
    reminder_id: opts.reminderId ?? null,
    vapi_call_id: json.id,
    status: "started",
  });
  return { ok: true, message: "📞 Ti sto chiamando, rispondi pure." };
}

/**
 * Contesto vocale ricco: riassunto della giornata + agenda dei prossimi 7 giorni,
 * attività in ritardo e backlog, tutti con i loro id, così l'agente può
 * riconoscere ciò di cui parla l'utente senza chiamare strumenti.
 */
export async function buildVoiceDaySummary(admin: any, userId: string): Promise<string> {
  const now = romeNow();
  const [summary, agenda, overdue, backlog, rituals] = await Promise.all([
    buildDaySummary(admin, userId),
    queryRadar(admin, userId, "get_agenda", { date: now.date, to_date: addDays(now.date, 7) }),
    queryRadar(admin, userId, "list_tasks", { scope: "overdue" }),
    queryRadar(admin, userId, "list_tasks", { scope: "backlog" }),
    queryRadar(admin, userId, "list_rituals", {}),
  ]);
  return [
    summary,
    `\nAGENDA PROSSIMI 7 GIORNI (con id):\n${agenda}`,
    `\nATTIVITÀ IN RITARDO:\n${overdue}`,
    `\nBACKLOG:\n${backlog}`,
    `\nRITUALI DI OGGI:\n${rituals}`,
  ].join("\n").slice(0, 12000);
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
          .eq("user_id", userId).gte("date", from).lte("date", to)
          .order("date").order("start_time").limit(200),
        admin.from("tasks").select("id,title,status,scheduled_date,scheduled_time,estimated_minutes")
          .eq("user_id", userId)
          .gte("scheduled_date", from).lte("scheduled_date", to)
          .order("scheduled_date").order("scheduled_time").limit(200),
        admin.from("reminders").select("id,title,reminder_date,reminder_time,is_urgent,is_dismissed")
          .eq("user_id", userId)
          .gte("reminder_date", from).lte("reminder_date", to)
          .order("reminder_date").order("reminder_time").limit(200),
      ]);
      const apptRows = appts ?? [];
      const taskRows = (tasks ?? []).filter((t: any) => t.status !== "done");
      const doneRows = (tasks ?? []).filter((t: any) => t.status === "done");
      const remRows = (rem ?? []).filter((r: any) => !r.is_dismissed);
      const remClosed = (rem ?? []).filter((r: any) => r.is_dismissed);
      const lines: string[] = [
        `Agenda dal ${from} al ${to}. TOTALI: ${apptRows.length} appuntamenti, ${taskRows.length} attività da fare, ${remRows.length} promemoria attivi` +
        `${doneRows.length ? `, ${doneRows.length} attività già completate` : ""}` +
        `${remClosed.length ? `, ${remClosed.length} promemoria già chiusi` : ""}.`,
        "Elenca tutto senza omettere nulla.",
      ];
      for (const x of apptRows) lines.push(`Appuntamento ${x.date} ${x.start_time}-${x.end_time}: ${x.title} (id ${x.id})`);
      for (const x of taskRows) lines.push(`Attività ${x.scheduled_date} ${x.scheduled_time ?? ""}: ${x.title} (${x.estimated_minutes} min, id ${x.id})`);
      for (const x of doneRows) lines.push(`Attività già completata ${x.scheduled_date} ${x.scheduled_time ?? ""}: ${x.title} (id ${x.id})`);
      for (const x of remRows) lines.push(`Promemoria ${x.reminder_date} ${x.reminder_time ?? ""}: ${x.title}${x.is_urgent ? " (importante)" : ""} (id ${x.id})`);
      for (const x of remClosed) lines.push(`Promemoria già chiuso o trasformato in attività ${x.reminder_date} ${x.reminder_time ?? ""}: ${x.title} (id ${x.id})`);
      return apptRows.length || taskRows.length || remRows.length || doneRows.length || remClosed.length
        ? lines.join("\n")
        : "Niente in agenda in questo periodo.";
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
      // Ricerca tollerante: ogni parola significativa vale come corrispondenza parziale.
      const STOP = new Set(["il","lo","la","i","gli","le","un","una","di","del","della","dei","delle","con","per","su","da","in","a","al","alla","e","che","mio","mia","quello","quella","attivita","attività","task","appuntamento","promemoria"]);
      const words = term.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
      const needles = words.length ? words : [term];
      const orExpr = (col: string) => needles.map((w) => `${col}.ilike.%${w}%`).join(",");
      const [{ data: tasks }, { data: appts }, { data: rem }] = await Promise.all([
        admin.from("tasks").select("id,title,scheduled_date,status").eq("user_id", userId).or(orExpr("title")).limit(10),
        admin.from("appointments").select("id,title,date,start_time").eq("user_id", userId).or(orExpr("title")).limit(10),
        admin.from("reminders").select("id,title,reminder_date").eq("user_id", userId).eq("is_dismissed", false).or(orExpr("title")).limit(10),
      ]);
      const lines: string[] = [];
      for (const t of tasks ?? []) lines.push(`Attività: ${t.title} (${t.status}${t.scheduled_date ? ", " + t.scheduled_date : ""}, id ${t.id})`);
      for (const x of appts ?? []) lines.push(`Appuntamento: ${x.title} (${x.date} ${x.start_time}, id ${x.id})`);
      for (const x of rem ?? []) lines.push(`Promemoria: ${x.title} (${x.reminder_date}, id ${x.id})`);
      return lines.length ? lines.join("\n") : `Nessun risultato per "${term}". Prova con una sola parola chiave.`;
    }

    if (name === "list_reminders") {
      const from = a.date || now.date;
      const to = a.to_date || addDays(from, 14);
      const { data } = await admin.from("reminders")
        .select("id,title,reminder_date,reminder_time,is_urgent")
        .eq("user_id", userId).eq("is_dismissed", false)
        .gte("reminder_date", from).lte("reminder_date", to).order("reminder_date").limit(40);
      if (!data?.length) return "Nessun promemoria attivo nel periodo.";
      return data.map((r: any) => `${r.reminder_date} ${r.reminder_time ?? ""}: ${r.title}${r.is_urgent ? " (importante)" : ""} (id ${r.id})`).join("\n");
    }

    if (name === "list_rituals") {
      const day = a.date || now.date;
      const [{ data: rituals }, { data: comps }, { data: ent }] = await Promise.all([
        admin.from("rituals").select("id,name,category,frequency,estimated_minutes,suggested_time,enterprise_id,is_active")
          .eq("user_id", userId).eq("is_active", true).limit(100),
        admin.from("ritual_completions").select("ritual_id,status,completed_time")
          .eq("user_id", userId).eq("completed_date", day),
        admin.from("enterprises").select("id,name").eq("user_id", userId),
      ]);
      if (!rituals?.length) return "Nessun rituale attivo.";
      const entName = new Map((ent ?? []).map((e: any) => [e.id, e.name]));
      const byRitual = new Map((comps ?? []).map((c: any) => [c.ritual_id, c]));
      const lines = [`Rituali attivi al ${day} (${rituals.length} in tutto):`];
      for (const r of rituals) {
        const c: any = byRitual.get(r.id);
        const stato = c ? (c.status === "skipped" ? "saltato" : `fatto${c.completed_time ? " alle " + c.completed_time : ""}`) : "da fare";
        lines.push(`${r.name} — ${r.category}, ${r.frequency}, ${r.estimated_minutes} min${r.suggested_time ? `, orario ${r.suggested_time}` : ""}${r.enterprise_id ? `, impresa ${entName.get(r.enterprise_id) ?? "?"}` : ""} — ${stato} (id ${r.id})`);
      }
      return lines.join("\n");
    }

    if (name === "list_time_entries") {
      const day = a.date || now.date;
      const { data } = await admin.from("time_entries")
        .select("id,description,duration_minutes,started_at,task_id,project_id")
        .eq("user_id", userId)
        .gte("started_at", `${day}T00:00:00+02:00`)
        .lte("started_at", `${day}T23:59:59+02:00`)
        .limit(100);
      if (!data?.length) return `Nessun tempo registrato il ${day}.`;
      const total = data.reduce((s: number, e: any) => s + (e.duration_minutes ?? 0), 0);
      const lines = [`Tempo registrato il ${day}: ${Math.round(total / 60 * 10) / 10} ore in tutto.`];
      for (const e of data) lines.push(`${e.duration_minutes} min${e.description ? ` — ${e.description}` : ""} (id ${e.id})`);
      return lines.join("\n");
    }

    if (name === "get_journal") {
      const day = a.entry_date || now.date;
      const { data } = await admin.from("journal_entries")
        .select("entry_date,content,mood,energy_level,energy_morning,energy_afternoon,energy_evening").eq("user_id", userId).eq("entry_date", day).maybeSingle();
      if (!data) return `Nessuna nota di diario per il ${day}.`;
      return `Diario ${data.entry_date}${data.mood ? ` (umore ${data.mood})` : ""}${data.energy_level ? `, energia ${data.energy_level}` : ""}:\n${data.content}`;
    }

    return `Interrogazione sconosciuta: ${name}`;
  } catch (e: any) {
    console.error("queryRadar error", name, e?.message ?? e);
    return "Non riesco a leggere i dati in questo momento.";
  }
}

export const RADAR_QUERY_TOOLS = new Set([
  "get_day_overview", "get_agenda", "list_tasks", "list_projects",
  "list_enterprises", "get_okr", "find_item", "list_reminders", "get_journal", "list_rituals",
  "list_time_entries",
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
  {
    name: "get_agenda",
    description: "Agenda (appuntamenti, attività pianificate, promemoria) per una data o un intervallo di date",
    parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD" }, to_date: { type: "string", description: "YYYY-MM-DD" } }, required: [] },
  },
  {
    name: "list_tasks",
    description: "Elenca le attività: scope today|week|backlog|overdue, opzionale search per titolo. Restituisce anche gli id.",
    parameters: { type: "object", properties: { scope: { type: "string", enum: ["today", "week", "backlog", "overdue"] }, search: { type: "string" } }, required: [] },
  },
  {
    name: "list_projects",
    description: "Elenca i progetti con impresa e id, opzionalmente filtrati per nome impresa",
    parameters: { type: "object", properties: { enterprise_name: { type: "string" } }, required: [] },
  },
  {
    name: "list_enterprises",
    description: "Elenca le imprese dell'utente con i relativi id",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_okr",
    description: "Focus period attivi con obiettivi e key result e relativo avanzamento",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "find_item",
    description: "Cerca per titolo tra attività, appuntamenti e promemoria e restituisce gli id, da usare prima di modificare qualcosa",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "move_appointment",
    description: "Sposta un appuntamento esistente a nuova data e/o orario",
    parameters: { type: "object", properties: { appointment_id: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, start_time: { type: "string", description: "HH:MM" }, end_time: { type: "string", description: "HH:MM" } }, required: ["appointment_id"] },
  },
  {
    name: "cancel_appointment",
    description: "Elimina un appuntamento esistente",
    parameters: { type: "object", properties: { appointment_id: { type: "string" } }, required: ["appointment_id"] },
  },
  {
    name: "list_reminders",
    description: "Elenca i promemoria attivi in un periodo, con i relativi id",
    parameters: { type: "object", properties: { date: { type: "string" }, to_date: { type: "string" } }, required: [] },
  },
  {
    name: "get_journal",
    description: "Legge la nota di diario di un giorno (default oggi)",
    parameters: { type: "object", properties: { entry_date: { type: "string", description: "YYYY-MM-DD" } }, required: [] },
  },
  {
    name: "update_task",
    description: "Modifica un'attività esistente (titolo, descrizione, priorità, durata, scadenza, progetto)",
    parameters: { type: "object", properties: { task_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] }, estimated_minutes: { type: "number" }, deadline: { type: "string" }, project_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "unschedule_task",
    description: "Rimette un'attività nel backlog togliendo data e ora",
    parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "delete_task",
    description: "Elimina definitivamente un'attività",
    parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] },
  },
  {
    name: "update_appointment",
    description: "Modifica titolo, descrizione, data o orari di un appuntamento",
    parameters: { type: "object", properties: { appointment_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, date: { type: "string" }, start_time: { type: "string" }, end_time: { type: "string" } }, required: ["appointment_id"] },
  },
  {
    name: "update_reminder",
    description: "Modifica un promemoria (titolo, data, ora, importante)",
    parameters: { type: "object", properties: { reminder_id: { type: "string" }, title: { type: "string" }, reminder_date: { type: "string" }, reminder_time: { type: "string" }, is_urgent: { type: "boolean" } }, required: ["reminder_id"] },
  },
  {
    name: "delete_reminder",
    description: "Elimina definitivamente un promemoria",
    parameters: { type: "object", properties: { reminder_id: { type: "string" } }, required: ["reminder_id"] },
  },
  {
    name: "convert_reminder_to_task",
    description: "Trasforma un promemoria in attività pianificata e chiude il promemoria",
    parameters: { type: "object", properties: { reminder_id: { type: "string" }, scheduled_date: { type: "string" }, scheduled_time: { type: "string" }, estimated_minutes: { type: "number" }, project_id: { type: "string" }, enterprise_id: { type: "string" }, priority: { type: "string", enum: ["high", "medium", "low"] } }, required: ["reminder_id"] },
  },
  {
    name: "create_project",
    description: "Crea un progetto dentro un'impresa",
    parameters: { type: "object", properties: { enterprise_id: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["strategic", "operational", "maintenance"] } }, required: ["enterprise_id", "name"] },
  },
  {
    name: "update_project",
    description: "Rinomina o cambia tipo a un progetto",
    parameters: { type: "object", properties: { project_id: { type: "string" }, name: { type: "string" }, type: { type: "string", enum: ["strategic", "operational", "maintenance"] } }, required: ["project_id"] },
  },
  {
    name: "delete_project",
    description: "Elimina un progetto (solo se vuoto o se l'utente conferma)",
    parameters: { type: "object", properties: { project_id: { type: "string" } }, required: ["project_id"] },
  },
  {
    name: "create_enterprise",
    description: "Crea una nuova impresa",
    parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, status: { type: "string", enum: ["active", "development", "paused"] } }, required: ["name"] },
  },
  {
    name: "update_enterprise",
    description: "Modifica nome, descrizione o stato di un'impresa",
    parameters: { type: "object", properties: { enterprise_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, status: { type: "string", enum: ["active", "development", "paused"] } }, required: ["enterprise_id"] },
  },
  {
    name: "create_focus_period",
    description: "Crea un focus period (ciclo 90 giorni) per un'impresa",
    parameters: { type: "object", properties: { enterprise_id: { type: "string" }, name: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, description: { type: "string" } }, required: ["enterprise_id", "name", "start_date", "end_date"] },
  },
  {
    name: "create_objective",
    description: "Crea un obiettivo dentro un focus period",
    parameters: { type: "object", properties: { focus_period_id: { type: "string" }, title: { type: "string" }, description: { type: "string" } }, required: ["focus_period_id", "title"] },
  },
  {
    name: "create_key_result",
    description: "Crea un key result misurabile per un obiettivo",
    parameters: { type: "object", properties: { objective_id: { type: "string" }, title: { type: "string" }, target_value: { type: "number" }, current_value: { type: "number" }, metric_type: { type: "string" }, deadline: { type: "string" } }, required: ["objective_id", "title"] },
  },
  {
    name: "update_key_result",
    description: "Aggiorna l'avanzamento o il target di un key result",
    parameters: { type: "object", properties: { key_result_id: { type: "string" }, current_value: { type: "number" }, target_value: { type: "number" }, title: { type: "string" } }, required: ["key_result_id"] },
  },
  {
    name: "list_rituals",
    description: "Elenca i rituali attivi con lo stato di oggi (fatto, saltato, da fare) e i relativi id",
    parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD, default oggi" } }, required: [] },
  },
  {
    name: "complete_ritual",
    description: "Segna un rituale come completato in un giorno",
    parameters: { type: "object", properties: { ritual_id: { type: "string" }, completed_date: { type: "string" }, completed_time: { type: "string" }, notes: { type: "string" } }, required: ["ritual_id"] },
  },
  {
    name: "skip_ritual",
    description: "Segna un rituale come saltato in un giorno",
    parameters: { type: "object", properties: { ritual_id: { type: "string" }, completed_date: { type: "string" }, notes: { type: "string" } }, required: ["ritual_id"] },
  },
  {
    name: "create_ritual",
    description: "Crea un nuovo rituale ricorrente",
    parameters: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, frequency: { type: "string", description: "daily, weekly, monthly" }, estimated_minutes: { type: "number" }, suggested_time: { type: "string" }, enterprise_id: { type: "string" }, description: { type: "string" } }, required: ["name"] },
  },
  {
    name: "update_ritual",
    description: "Modifica un rituale esistente (nome, frequenza, durata, orario, attivo)",
    parameters: { type: "object", properties: { ritual_id: { type: "string" }, name: { type: "string" }, category: { type: "string" }, frequency: { type: "string" }, estimated_minutes: { type: "number" }, suggested_time: { type: "string" }, description: { type: "string" }, is_active: { type: "boolean" } }, required: ["ritual_id"] },
  },
  {
    name: "delete_ritual",
    description: "Elimina definitivamente un rituale",
    parameters: { type: "object", properties: { ritual_id: { type: "string" } }, required: ["ritual_id"] },
  },
  {
    name: "save_journal_entry",
    description: "Scrive o aggiorna la nota di diario di un giorno, con umore ed energia (1-5)",
    parameters: { type: "object", properties: { entry_date: { type: "string" }, content: { type: "string" }, mood: { type: "string" }, energy_level: { type: "number" }, energy_morning: { type: "number" }, energy_afternoon: { type: "number" }, energy_evening: { type: "number" } }, required: ["content"] },
  },
];
