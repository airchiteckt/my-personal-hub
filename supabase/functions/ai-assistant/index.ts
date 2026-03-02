import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const userId = claimsData.claims.sub;
    const { type, messages: clientMessages, context } = await req.json();

    // Fetch the user's custom system prompt for this function type
    const { data: promptRow } = await supabase
      .from("ai_prompts")
      .select("system_prompt")
      .eq("user_id", userId)
      .eq("function_key", type)
      .eq("is_active", true)
      .maybeSingle();

    const defaultPrompts: Record<string, string> = {
      reminder: `Sei un assistente AI per la gestione del tempo e produttività personale. Il tuo compito è:
- Analizzare le task dell'utente e ricordare scadenze imminenti
- Suggerire priorità basate su urgenza e importanza
- Dare consigli brevi e azionabili
Rispondi sempre in italiano, in modo conciso e pratico.`,
      task_suggest: `Sei un assistente AI specializzato nel suggerire task. Basandoti sul contesto dei progetti e delle imprese dell'utente:
- Suggerisci task specifiche e azionabili
- Indica priorità (high/medium/low) e stima di tempo in minuti
- Considera le task già esistenti per evitare duplicati
Rispondi in italiano con suggerimenti strutturati.`,
      effort_estimate: `Sei un assistente AI per la stima dell'impegno. Il tuo compito è:
- Stimare i minuti necessari per completare una task
- Considerare complessità, dipendenze e rischi
- Fornire una stima ottimistica, realistica e pessimistica
Rispondi in italiano in modo chiaro e sintetico.`,
      general: `Sei l'assistente AI di PRP (Personal Resource Planning). Aiuti l'utente a gestire imprese, progetti e task. Rispondi in italiano, in modo conciso e utile.`,

      // --- OKR-specific prompts ---
      okr_project: `Sei un esperto di OKR (Objectives & Key Results) e strategia aziendale. Quando l'utente descrive un progetto:
- Suggerisci un Objective chiaro e misurabile allineato alla strategia dell'impresa
- Proponi 2-3 Key Results specifici, quantificabili e con scadenza
- Suggerisci il tipo di progetto più adatto (strategic/operational/maintenance)
- Valida l'allineamento con la categoria business e la fase dell'impresa
Rispondi SOLO in italiano, in modo conciso e strutturato.`,

      okr_task_suggest: `Sei un esperto di OKR. Dato un progetto con i suoi obiettivi e l'impresa di appartenenza:
- Genera 3-5 task actionable derivate dai Key Results del progetto
- Per ogni task indica: titolo, priorità (high/medium/low), durata stimata in minuti, impatto (1-3), sforzo (1-3)
- Le task devono essere specifiche, misurabili e contribuire direttamente ai KR
Rispondi SOLO in italiano.`,

      effort_inline: `Sei un esperto di stima effort per task di business e produttività. Data una task:
- Stima la durata in minuti (multipli di 5)
- Suggerisci priorità (high/medium/low) basata sul contesto
- Valuta impatto (1-3) e sforzo (1-3) 
- Fornisci una breve motivazione (max 15 parole)
Rispondi SOLO con dati strutturati, in italiano.`,

      alignment_check: `Sei un consulente strategico OKR. Il tuo compito è validare la coerenza tra un progetto/task e la strategia dell'impresa. Valuta:
- Allineamento con la categoria business dell'impresa
- Coerenza con la fase attuale e l'orizzonte temporale
- Potenziali conflitti o ridondanze con progetti/task esistenti
- Score di allineamento da 1 a 5
Rispondi in italiano, in modo conciso con un giudizio chiaro.`,
    };

    const systemPrompt =
      promptRow?.system_prompt ?? defaultPrompts[type] ?? defaultPrompts.general;

    const aiMessages = [{ role: "system", content: systemPrompt }];

    if (context) {
      aiMessages.push({
        role: "system",
        content: `Contesto attuale dell'utente:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    if (clientMessages?.length) {
      aiMessages.push(...clientMessages);
    }

    // --- Structured (non-streaming) responses ---
    const structuredTypes: Record<string, any> = {
      task_suggest: {
        name: "suggest_tasks",
        description: "Restituisci 3-5 suggerimenti di task azionabili.",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  estimated_minutes: { type: "number" },
                  reason: { type: "string" },
                },
                required: ["title", "priority", "estimated_minutes", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
      okr_project: {
        name: "suggest_okr_project",
        description: "Suggerisci OKR per il progetto e valida l'allineamento strategico.",
        parameters: {
          type: "object",
          properties: {
            objective: { type: "string", description: "L'Objective principale suggerito" },
            key_results: {
              type: "array",
              items: { type: "string" },
              description: "2-3 Key Results misurabili",
            },
            suggested_type: { type: "string", enum: ["strategic", "operational", "maintenance"] },
            alignment_score: { type: "number", description: "Score di allineamento 1-5" },
            alignment_note: { type: "string", description: "Breve nota sull'allineamento strategico" },
          },
          required: ["objective", "key_results", "suggested_type", "alignment_score", "alignment_note"],
          additionalProperties: false,
        },
      },
      okr_task_suggest: {
        name: "suggest_okr_tasks",
        description: "Genera task actionable dai Key Results del progetto.",
        parameters: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  priority: { type: "string", enum: ["low", "medium", "high"] },
                  estimated_minutes: { type: "number" },
                  impact: { type: "number", description: "1-3" },
                  effort: { type: "number", description: "1-3" },
                  reason: { type: "string" },
                },
                required: ["title", "priority", "estimated_minutes", "impact", "effort", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["tasks"],
          additionalProperties: false,
        },
      },
      effort_inline: {
        name: "estimate_effort",
        description: "Stima effort, priorità e impatto/sforzo per una task.",
        parameters: {
          type: "object",
          properties: {
            estimated_minutes: { type: "number" },
            priority: { type: "string", enum: ["low", "medium", "high"] },
            impact: { type: "number", description: "1-3" },
            effort: { type: "number", description: "1-3" },
            reason: { type: "string", description: "Breve motivazione" },
          },
          required: ["estimated_minutes", "priority", "impact", "effort", "reason"],
          additionalProperties: false,
        },
      },
      alignment_check: {
        name: "check_alignment",
        description: "Valida l'allineamento strategico di un progetto o task.",
        parameters: {
          type: "object",
          properties: {
            alignment_score: { type: "number", description: "Score 1-5" },
            is_aligned: { type: "boolean" },
            feedback: { type: "string", description: "Feedback breve sull'allineamento" },
            suggestions: {
              type: "array",
              items: { type: "string" },
              description: "Suggerimenti per migliorare l'allineamento",
            },
          },
          required: ["alignment_score", "is_aligned", "feedback", "suggestions"],
          additionalProperties: false,
        },
      },
    };

    const toolDef = structuredTypes[type];

    if (toolDef) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: aiMessages,
          tools: [{ type: "function", function: toolDef }],
          tool_choice: { type: "function", function: { name: toolDef.name } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429)
          return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (response.status === 402)
          return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const result = toolCall ? JSON.parse(toolCall.function.arguments) : {};

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming for chat-like interactions
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (response.status === 402)
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
