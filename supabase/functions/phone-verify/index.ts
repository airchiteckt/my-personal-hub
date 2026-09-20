import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const SENDER_NAME = "FlyDeck";
const SETTINGS_KEY = "twilio_verify_service_sid";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function twilio(path: string, method: "GET" | "POST", form?: Record<string, string>) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY ?? "",
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok) {
    console.error(`Twilio ${method} ${path} failed [${res.status}]: ${text}`);
    throw new Error(parsed?.message || text || `Twilio error ${res.status}`);
  }
  return parsed;
}

async function getVerifyServiceSid(admin: ReturnType<typeof createClient>) {
  const { data } = await admin.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  if (data?.value) return data.value as string;

  const list = await twilio("/verify/v2/Services", "GET");
  let sid: string | undefined = (list?.services ?? []).find(
    (s: any) => s.friendly_name === SENDER_NAME,
  )?.sid;

  if (!sid) {
    // FriendlyName is also used by Twilio Verify as the alphanumeric sender where supported.
    const created = await twilio("/verify/v2/Services", "POST", {
      FriendlyName: SENDER_NAME,
      CodeLength: "6",
    });
    sid = created?.sid;
  }
  if (!sid) throw new Error("Impossibile creare il servizio di verifica Twilio");

  await admin.from("app_settings").upsert({ key: SETTINGS_KEY, value: sid, updated_at: new Date().toISOString() });
  return sid;
}

function normalizePhone(raw: string) {
  const cleaned = (raw || "").trim().replace(/[\s.\-()]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) return "+" + cleaned.slice(1).replace(/\D/g, "");
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2).replace(/\D/g, "");
  const digits = cleaned.replace(/\D/g, "");
  return digits ? `+39${digits}` : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return json({ error: "Verifica SMS non configurata" }, 500);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const phone = normalizePhone(String(body.phone || ""));

    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return json({ error: "Numero non valido. Usa il formato internazionale, es. +39 333 1234567." }, 400);
    }

    const serviceSid = await getVerifyServiceSid(admin);

    if (action === "send") {
      // Il numero non può essere già verificato da un altro account.
      const { data: taken } = await admin
        .from("profiles")
        .select("user_id")
        .eq("phone_number", phone)
        .eq("phone_verified", true)
        .neq("user_id", user.id)
        .maybeSingle();
      if (taken) return json({ error: "Questo numero è già collegato a un altro account." }, 409);

      await twilio(`/verify/v2/Services/${serviceSid}/Verifications`, "POST", {
        To: phone,
        Channel: "sms",
        Locale: "it",
      });
      return json({ ok: true, phone });
    }

    if (action === "check") {
      const code = String(body.code || "").replace(/\D/g, "");
      if (code.length < 4) return json({ error: "Codice non valido" }, 400);

      const result = await twilio(`/verify/v2/Services/${serviceSid}/VerificationCheck`, "POST", {
        To: phone,
        Code: code,
      });

      if (result?.status !== "approved") {
        return json({ error: "Codice errato o scaduto" }, 400);
      }

      const { error } = await admin
        .from("profiles")
        .update({
          phone_number: phone,
          phone_verified: true,
          phone_verified_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (error) throw error;

      return json({ ok: true, verified: true, phone });
    }

    return json({ error: "Azione non supportata" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
