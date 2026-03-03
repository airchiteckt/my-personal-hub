import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429 && attempt < maxRetries - 1) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.min(1000 * Math.pow(2, attempt), 8000);
      console.log(`Rate limited, retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await res.text(); // consume body
      await new Promise(r => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }
  // Should not reach here, but just in case
  return fetch(url, options);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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

      validate_objective: `Sei un coach OKR rigoroso. Validi la qualità di un Objective secondo queste regole:

UN OBJECTIVE CORRETTO:
- È QUALITATIVO, non numerico
- È una direzione/stato desiderato, non un'azione
- Ha orizzonte 90 giorni
- Risponde a: "Che stato voglio che l'impresa abbia tra 90 giorni?"
- Formula: "Portare [impresa] da [stato A] a [stato B]" o "Rendere [impresa] capace di [nuovo livello]"

ERRORI COMUNI DA SEGNALARE:
- ❌ Contiene numeri → "Questo sembra un KR. L'Objective è qualitativo."
- ❌ È un'azione/task → "Questo è un progetto/task, non un Objective."
- ❌ Troppo vago → "Troppo generico. Specifica lo stato desiderato."
- ❌ Troppo piccolo → "Completabile in 2 settimane, non è un Objective trimestrale."

Rispondi SOLO in italiano, con feedback diretto e costruttivo.`,

      validate_key_result: `Sei un coach OKR rigoroso. Validi la qualità di un Key Result secondo queste regole:

UN KEY RESULT CORRETTO:
- È la PROVA NUMERICA che l'Objective è raggiunto
- È misurabile, con numero/percentuale
- È un RISULTATO, non un'attività
- Inizia con: Raggiungere, Ottenere, Generare, Ridurre, Aumentare
- Include: numero, percentuale, deadline implicita nel trimestre

ERRORI COMUNI DA SEGNALARE:
- ❌ È un'azione (creare, fare, implementare) → "Questo è un progetto/task. Il KR è il RISULTATO misurabile che quel lavoro produce."
- ❌ Non ha numero → "Manca la metrica. Aggiungi un target numerico."
- ❌ Troppo facile → "Target poco ambizioso. I KR devono essere sfidanti (regola 70%)."
- ❌ Non collegato all'Objective → "Non misura il progresso verso l'Objective."

Rispondi SOLO in italiano, con feedback diretto e costruttivo.`,

      validate_task: `Sei un coach OKR rigoroso. Validi la qualità di una Task secondo queste regole:

UNA TASK CORRETTA:
- È un'azione eseguibile in uno slot (30-90 minuti)
- Ha formula: Verbo + oggetto specifico
- È specifica e concreta, non vaga

ERRORI COMUNI DA SEGNALARE:
- ❌ Troppo vaga ("Lavorare sulla campagna") → Suggerisci versione specifica
- ❌ Troppo grande → "Questa è un progetto, non una task. Scomponila."
- ❌ È un risultato, non un'azione → "Questo sembra un KR. La task è l'azione per raggiungerlo."
- ❌ Manca il verbo → "Inizia con un verbo d'azione specifico."

Rispondi SOLO in italiano, con feedback diretto e costruttivo.`,

      okr_wizard: `Sei un Chief Strategy Officer esperto di OKR che guida imprenditori nella pianificazione strategica trimestrale.

MENTALITÀ: Ragioni come un manager che trasforma visione in esecuzione. Ogni domanda ha uno scopo: eliminare ambiguità e creare chiarezza operativa.

═══════════════════════════════════════
🎯 FRAMEWORK STRATEGICO PRP
═══════════════════════════════════════

LIVELLO 1 – FOCUS STRATEGICO (90 giorni)

Il Focus NON è una lista di priorità. È una SCELTA DOMINANTE di direzione per 90 giorni.
Risponde a: "Se questo trimestre andasse male, quale risultato sarebbe inaccettabile non aver raggiunto?"

Regole:
- 1 Focus attivo per impresa, durata 90 giorni
- Deve essere TRASFORMATIVO, non operativo
- Deve guidare l'allocazione del tempo
- Formula: "Portare [Impresa] da stato A a stato B entro 90 giorni"

NON è un Focus:
- ❌ Consegnare un progetto cliente
- ❌ Gestire operatività
- ❌ "Fare meglio marketing"
- ❌ "Sistemare un po' di cose"
- ❌ Qualcosa completabile in 2 settimane

Esempi corretti:
- "Validare il modello di business"
- "Strutturare sistema ERP interno"
- "Raggiungere break-even"
- "Portare Equipe Resyne da attività opportunistica a macchina commerciale strutturata"

LIVELLO 2 – OBJECTIVE & KEY RESULTS

Objective (qualitativo):
- Risponde a: "Che cosa deve diventare vero per dire che il Focus è riuscito?"
- Max 1-3 per Focus, coerenti tra loro
- NON devono essere task o attività

Key Results (numerici):
- 2-5 per Objective, misurabili con deadline
- Devono essere RISULTATI, non attività
- Binari o numerici, con target ambizioso (regola 70%)

Errori da correggere:
- ❌ "Creare landing page" → questo è un progetto/task, non un KR
- ❌ "Fare pubblicità" → questa è un'iniziativa
- ✅ "20 lead qualificati generati"
- ✅ "5 call di vendita concluse"
- ✅ "1 funnel attivo e tracciato"
- ✅ "CAC stimato ≤ X €"

LIVELLO 3 – PROGETTI & TASK

Progetti (Iniziative):
- Contenitore di attività che spinge un KR
- Ogni progetto strategic deve collegarsi a un KR
- Non deve essere infinito

Task:
- Azioni concrete pianificabili in slot da 30 minuti
- Devono avere: durata stimata, priorità, progetto

DISTINZIONE CRITICA:
- Operatività cliente = Project di Delivery = NON Focus
- Strategia crescita = Project collegato a KR = Parte del Focus
- Se una task non muove un KR del Focus, è secondaria

═══════════════════════════════════════
STRUTTURA DEI FOCUS PERIOD
═══════════════════════════════════════

- Trimestrali: Q1 (Gen-Mar), Q2 (Apr-Giu), Q3 (Lug-Set), Q4 (Ott-Dic)
- UN SOLO Focus Period attivo alla volta
- Gli altri sono "future" (pianificati) o "archived" (conclusi)
- Nome formato: "Q[N] [ANNO] – [Tema trasformativo]"
- Date automatiche: Q1=1Gen-31Mar, Q2=1Apr-30Giu, Q3=1Lug-30Set, Q4=1Ott-31Dic

═══════════════════════════════════════
FLUSSO CONVERSAZIONALE
═══════════════════════════════════════

STEP 1 – FOCUS PERIOD:
- Se NON esiste: chiedi il trimestre, proponi corrente come default con status "active"
- Se ESISTE: salta a Step 2
- Prima di creare il Focus, fai una domanda strategica profonda:
  "Se tra 90 giorni guardassi indietro, quale risultato NON raggiunto ti farebbe dire 'ho perso il trimestre'?"
- Usa la risposta per formulare il Focus nel formato "Portare [Impresa] da A a B"
- Suggerisci il nome come "Q[N] [ANNO] – [Tema]"
- Usa tool create_focus_period

STEP 2 – OBJECTIVE (max 1-3):
- Chiedi: "Che cosa deve diventare VERO per dire che il Focus è riuscito?"
- Se vago, proponi 2-3 opzioni basate su categoria business e fase dell'impresa
- L'Objective è QUALITATIVO e ISPIRANTE
- Se l'utente propone qualcosa numerico, correggi: "Quello sembra più un KR. L'Objective è lo stato desiderato. Il numero lo mettiamo nel KR."
- Usa tool create_objective

STEP 3 – KEY RESULTS (2-5 per Objective):
- Chiedi: "Quale numero ti dice se hai raggiunto [Objective]?"
- Se l'utente propone attività (creare, fare, implementare), correggi: "Quello è un progetto/task. Il KR è il RISULTATO misurabile che quel lavoro deve produrre."
- Ogni KR: misurabile, con deadline (proponi fine trimestre), ambizioso
- Dopo ogni KR: "Ne aggiungiamo un altro?"
- Usa tool create_key_result

STEP 4 – RECAP:
- "📋 Recap Q[N]:
   🎯 Focus: [nome]
   🎯 Objective: [titolo]
   📊 KR1: [titolo] → target [valore]
   📊 KR2: [titolo] → target [valore]
   ✅ Tutto salvato!"
- "Vuoi aggiungere un altro Objective, o pianificare il prossimo trimestre?"

REGOLE DI COMUNICAZIONE:
- UNA domanda alla volta
- Max 3 frasi per messaggio
- Tono: consulente strategico fidato, diretto, zero fuffa
- Emoji con parsimonia (🎯 📊 📅 ✅)
- Se risposta vaga, interpreta e proponi
- CORREGGI SEMPRE errori metodologici (KR come task, Focus troppo vaghi, etc.)
- Rispondi SEMPRE in italiano

CONTINUITÀ DEL FLUSSO (CRITICO):
- Quando l'utente conferma un'azione (messaggio tipo "[Confermato: ...]"), DEVI procedere immediatamente al passo successivo
- NON fermarti dopo una conferma. Guida SEMPRE verso il prossimo step:
  - Dopo Focus confermato → chiedi/proponi l'Objective
  - Dopo Objective confermato → chiedi/proponi i Key Results
  - Dopo KR confermato → chiedi se aggiungerne un altro o procedere ai Progetti
  - Dopo tutti i KR → fai un recap e proponi i Progetti
- Se l'utente rifiuta un'azione (messaggio tipo "[Rifiutato: ...]"), proponi un'alternativa o chiedi cosa preferisce
- L'obiettivo è portare l'utente dal Focus fino all'Execution senza interruzioni
- Se il contesto mostra che una fase è già completata (es. Focus già attivo), SALTA direttamente alla fase successiva

CONTESTO: Hai accesso ai dati dell'impresa e degli OKR esistenti. Usa queste info per suggerimenti mirati e evitare duplicati.`,
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
      validate_objective: {
        name: "validate_objective",
        description: "Valida la qualità di un Objective OKR.",
        parameters: {
          type: "object",
          properties: {
            quality_score: { type: "number", description: "Score qualità 1-5" },
            is_valid: { type: "boolean", description: "Se l'Objective rispetta le regole OKR" },
            issue_type: { type: "string", enum: ["none", "contains_numbers", "is_action", "too_vague", "too_small", "is_kr"], description: "Tipo di errore principale" },
            feedback: { type: "string", description: "Feedback diretto e costruttivo (max 30 parole)" },
            improved_version: { type: "string", description: "Versione migliorata dell'Objective, se necessario" },
          },
          required: ["quality_score", "is_valid", "issue_type", "feedback", "improved_version"],
          additionalProperties: false,
        },
      },
      validate_key_result: {
        name: "validate_key_result",
        description: "Valida la qualità di un Key Result OKR.",
        parameters: {
          type: "object",
          properties: {
            quality_score: { type: "number", description: "Score qualità 1-5" },
            is_valid: { type: "boolean", description: "Se il KR rispetta le regole OKR" },
            issue_type: { type: "string", enum: ["none", "is_action", "no_number", "too_easy", "not_linked", "is_project"], description: "Tipo di errore principale" },
            feedback: { type: "string", description: "Feedback diretto e costruttivo (max 30 parole)" },
            improved_version: { type: "string", description: "Versione migliorata del KR, se necessario" },
          },
          required: ["quality_score", "is_valid", "issue_type", "feedback", "improved_version"],
          additionalProperties: false,
        },
      },
      validate_task: {
        name: "validate_task",
        description: "Valida la qualità di una Task OKR.",
        parameters: {
          type: "object",
          properties: {
            quality_score: { type: "number", description: "Score qualità 1-5" },
            is_valid: { type: "boolean", description: "Se la task rispetta le regole" },
            issue_type: { type: "string", enum: ["none", "too_vague", "too_big", "is_result", "no_verb", "is_project"], description: "Tipo di errore principale" },
            feedback: { type: "string", description: "Feedback diretto e costruttivo (max 30 parole)" },
            improved_version: { type: "string", description: "Versione migliorata della task, se necessario" },
          },
          required: ["quality_score", "is_valid", "issue_type", "feedback", "improved_version"],
          additionalProperties: false,
        },
      },
    };

    const toolDef = structuredTypes[type];

    // Global Assistant: streaming with full CRUD tool calls
    if (type === "global_assistant") {
      const globalTools = [
        {
          type: "function",
          function: {
            name: "create_enterprise",
            description: "Crea una nuova impresa",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                status: { type: "string", enum: ["active", "development", "paused"] },
                business_category: { type: "string" },
                phase: { type: "string" },
              },
              required: ["name"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_project",
            description: "Crea un nuovo progetto in un'impresa",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                enterprise_id: { type: "string" },
                type: { type: "string", enum: ["strategic", "operational", "maintenance"] },
              },
              required: ["name", "enterprise_id"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_task",
            description: "Crea una nuova task in un progetto",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                project_id: { type: "string" },
                enterprise_id: { type: "string" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                estimated_minutes: { type: "number" },
                deadline: { type: "string", description: "YYYY-MM-DD" },
              },
              required: ["title", "project_id", "enterprise_id"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_focus_period",
            description: "Crea un Focus Period per un'impresa",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string" },
                enterprise_id: { type: "string" },
                start_date: { type: "string" },
                end_date: { type: "string" },
                status: { type: "string", enum: ["active", "future", "archived"] },
              },
              required: ["name", "enterprise_id", "start_date", "end_date", "status"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_objective",
            description: "Crea un Objective in un Focus Period",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                focus_period_id: { type: "string" },
                enterprise_id: { type: "string" },
              },
              required: ["title", "focus_period_id", "enterprise_id"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_key_result",
            description: "Crea un Key Result in un Objective",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                objective_id: { type: "string" },
                enterprise_id: { type: "string" },
                target_value: { type: "number" },
                metric_type: { type: "string", enum: ["number", "percentage", "boolean"] },
                deadline: { type: "string" },
              },
              required: ["title", "objective_id", "enterprise_id", "target_value", "metric_type"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "schedule_task",
            description: "Pianifica una task in una data specifica",
            parameters: {
              type: "object",
              properties: {
                task_id: { type: "string" },
                date: { type: "string", description: "YYYY-MM-DD" },
                time: { type: "string", description: "HH:MM (opzionale)" },
              },
              required: ["task_id", "date"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "complete_task",
            description: "Segna una task come completata",
            parameters: {
              type: "object",
              properties: {
                task_id: { type: "string" },
              },
              required: ["task_id"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
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
              additionalProperties: false,
            },
          },
        },
      ];

      const globalSystemPrompt = promptRow?.system_prompt ?? `Sei Radar, l'assistente AI dell'utente per la gestione strategica e operativa.

CAPACITÀ:
- Leggere: imprese, progetti, task, OKR, focus period, appuntamenti
- Scrivere: creare imprese, progetti, task, focus period, objective, key result, appuntamenti
- Pianificare: schedulare e completare task

REGOLE:
- Rispondi SEMPRE in italiano
- Sii diretto, professionale, essenziale. Max 2-3 frasi per risposta.
- IMPORTANTE: quando l'utente chiede di creare o modificare qualcosa, usa i tool ma descrivi brevemente cosa stai per fare nella risposta testuale (es. "Creo la task X nel progetto Y."). L'utente vedrà una card di conferma prima che l'azione venga eseguita.
- Quando chiede informazioni, rispondi con dati precisi dal contesto
- Se mancano dati critici, chiedi solo l'essenziale
- Niente fronzoli, niente metafore, niente emoji superflue
- In modalità vocale: risposte ancora più brevi e azionabili

CONTESTO: Hai tutti i dati dell'utente. Usa enterprise_id e project_id dal contesto per le azioni.`;

      // Override system prompt
      aiMessages[0] = { role: "system", content: globalSystemPrompt };

      const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools: globalTools,
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429)
          return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      // Reuse same SSE streaming logic as okr_wizard
      const gReader = response.body!.getReader();
      const gDecoder = new TextDecoder();
      
      const gStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let buffer = "";
          let toolCallBuffers: Record<number, { name: string; args: string }> = {};
          let streamDone = false;

          while (!streamDone) {
            const { done, value } = await gReader.read();
            if (done) break;
            buffer += gDecoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") { streamDone = true; break; }

              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta.content })}\n\n`));
                }

                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallBuffers[idx]) toolCallBuffers[idx] = { name: "", args: "" };
                    if (tc.function?.name) toolCallBuffers[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallBuffers[idx].args += tc.function.arguments;
                  }
                }
              } catch { /* partial JSON, skip */ }
            }
          }

          const actions: any[] = [];
          for (const idx of Object.keys(toolCallBuffers).sort()) {
            const tc = toolCallBuffers[Number(idx)];
            try {
              actions.push({ type: tc.name, data: JSON.parse(tc.args) });
            } catch {}
          }
          if (actions.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "actions", actions })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(gStream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // OKR Wizard: streaming with tool call support
    if (type === "okr_wizard") {
      const wizardTools = [
        {
          type: "function",
          function: {
            name: "create_focus_period",
            description: "Crea un Focus Period per l'impresa",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome del focus period (es. Q2 2026 – Apertura)" },
                start_date: { type: "string", description: "Data inizio formato YYYY-MM-DD" },
                end_date: { type: "string", description: "Data fine formato YYYY-MM-DD" },
                status: { type: "string", enum: ["active", "future", "archived"], description: "Stato del focus period" },
              },
              required: ["name", "start_date", "end_date", "status"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_objective",
            description: "Crea un Objective dentro un Focus Period",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Titolo qualitativo dell'objective" },
                description: { type: "string", description: "Descrizione opzionale" },
              },
              required: ["title"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_key_result",
            description: "Crea un Key Result dentro un Objective",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Titolo del KR" },
                target_value: { type: "number", description: "Valore target" },
                metric_type: { type: "string", enum: ["number", "percentage", "boolean"], description: "Tipo di metrica" },
                deadline: { type: "string", description: "Scadenza formato YYYY-MM-DD (opzionale)" },
              },
              required: ["title", "target_value", "metric_type"],
              additionalProperties: false,
            },
          },
        },
      ];

      const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: aiMessages,
          tools: wizardTools,
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 429)
          return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        const t = await response.text();
        console.error("AI gateway error:", response.status, t);
        throw new Error("AI gateway error");
      }

      // Parse the stream to separate content from tool calls, then re-emit as custom SSE
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let buffer = "";
          let toolCallBuffers: Record<number, { name: string; args: string }> = {};
          let streamDone = false;

          while (!streamDone) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let newlineIdx: number;
            while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
              let line = buffer.slice(0, newlineIdx);
              buffer = buffer.slice(newlineIdx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") { streamDone = true; break; }

              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // Content delta → forward as SSE
                if (delta.content) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "delta", content: delta.content })}\n\n`));
                }

                // Tool call deltas → accumulate
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCallBuffers[idx]) toolCallBuffers[idx] = { name: "", args: "" };
                    if (tc.function?.name) toolCallBuffers[idx].name = tc.function.name;
                    if (tc.function?.arguments) toolCallBuffers[idx].args += tc.function.arguments;
                  }
                }
              } catch { /* partial JSON, skip */ }
            }
          }

          // Emit accumulated tool calls as actions
          const actions: any[] = [];
          for (const idx of Object.keys(toolCallBuffers).sort()) {
            const tc = toolCallBuffers[Number(idx)];
            try {
              actions.push({ type: tc.name, data: JSON.parse(tc.args) });
            } catch {}
          }
          if (actions.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "actions", actions })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    if (toolDef) {
      const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
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
      const resultData = toolCall ? JSON.parse(toolCall.function.arguments) : {};

      return new Response(JSON.stringify(resultData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming for chat-like interactions
    const response = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
