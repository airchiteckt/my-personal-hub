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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Auth
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
    };

    const systemPrompt =
      promptRow?.system_prompt ?? defaultPrompts[type] ?? defaultPrompts.general;

    // Build messages for the AI
    const aiMessages = [
      { role: "system", content: systemPrompt },
    ];

    // Inject context about user's data if provided
    if (context) {
      aiMessages.push({
        role: "system",
        content: `Contesto attuale dell'utente:\n${JSON.stringify(context, null, 2)}`,
      });
    }

    if (clientMessages?.length) {
      aiMessages.push(...clientMessages);
    }

    // Non-streaming for tool-calling / structured responses
    if (type === "task_suggest") {
      const response = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: aiMessages,
            tools: [
              {
                type: "function",
                function: {
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
                            priority: {
                              type: "string",
                              enum: ["low", "medium", "high"],
                            },
                            estimated_minutes: { type: "number" },
                            reason: { type: "string" },
                          },
                          required: [
                            "title",
                            "priority",
                            "estimated_minutes",
                            "reason",
                          ],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["suggestions"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "suggest_tasks" },
            },
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429)
          return new Response(
            JSON.stringify({ error: "Troppi richieste, riprova tra poco." }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        if (response.status === 402)
          return new Response(
            JSON.stringify({ error: "Crediti AI esauriti." }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      const result = toolCall
        ? JSON.parse(toolCall.function.arguments)
        : { suggestions: [] };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming for chat-like interactions
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: aiMessages,
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429)
        return new Response(
          JSON.stringify({ error: "Troppi richieste, riprova tra poco." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      if (response.status === 402)
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
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
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
