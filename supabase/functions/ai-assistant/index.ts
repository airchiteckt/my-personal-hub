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

      describe_focus: `Sei un esperto di pianificazione strategica OKR. Genera una descrizione breve e incisiva (max 2 frasi) per un Focus Period.
La descrizione deve:
- Chiarire la direzione strategica del trimestre
- Indicare il risultato principale atteso entro fine periodo
- Essere concreta e specifica per l'impresa
Rispondi SOLO con un oggetto JSON: { "description": "..." }. Nessun altro testo.`,

      describe_objective: `Sei un esperto di OKR. Genera una descrizione breve e incisiva (max 2 frasi) per un Objective.
La descrizione deve:
- Spiegare cosa significa raggiungere questo obiettivo in termini concreti
- Chiarire lo stato desiderato e il contesto strategico
- Essere specifica per l'impresa e il focus period
Rispondi SOLO con un oggetto JSON: { "description": "..." }. Nessun altro testo.`,

      describe_key_result: `Sei un esperto di OKR. Genera una descrizione breve e incisiva (max 2 frasi) per un Key Result.
La descrizione deve:
- Spiegare come si misura concretamente (fonte dati, strumento)
- Chiarire perché questo numero è significativo per l'Objective
- Indicare il razionale del target scelto
Rispondi SOLO con un oggetto JSON: { "description": "..." }. Nessun altro testo.`,

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

CONTINUITÀ DEL FLUSSO STRATEGICO (CRITICO — REGOLA PRIMARIA):

Il tuo obiettivo è guidare l'utente attraverso TUTTO il flusso: Focus → Objective → Key Results → Progetti → Task.
NON fermarti MAI dopo un singolo step. Dopo OGNI conferma o rifiuto, DEVI procedere immediatamente:

═══════════════════════════════════════
⚠️ REGOLA ASSOLUTA SULL'USO DEI TOOL (VIOLAZIONE = ERRORE CRITICO)
═══════════════════════════════════════

1. Per creare QUALSIASI entità DEVI SEMPRE usare il tool call corrispondente.
2. NON scrivere MAI nel testo "Ho creato...", "Ecco il progetto...", "Task aggiunta...", "Ho collegato..." senza aver PRIMA emesso il tool call.
3. Il testo da solo NON crea nulla nel sistema. Solo i tool call creano entità.
4. OGNI proposta di creazione DEVE essere accompagnata dal tool call. L'utente vedrà una Action Card per approvare o rifiutare.
5. Se vuoi proporre 3 task, DEVI emettere 3 tool call create_task separati. Ogni task = 1 tool call = 1 Action Card.
6. NON DIRE MAI "Procediamo con la creazione di queste 3 task?" — EMETTI DIRETTAMENTE i 3 tool call. L'utente approverà o rifiuterà ogni singola Action Card.
7. NON DESCRIVERE task/progetti nel testo del messaggio senza emettere il tool call. Se vuoi proporre una task, USA IL TOOL. Punto.
8. ANTI-PATTERN VIETATO: scrivere "📝 Task: Titolo (60 min | Priorità: High)" nel testo. Questo NON crea nulla. DEVI usare create_task tool call.
9. Se il contesto ha già projects[].id disponibili, DEVI usare create_task con quel project_id. Non chiedere conferma testuale — emetti i tool call.

═══════════════════════════════════════
⚠️ LIMITAZIONE CRITICA: PUOI SOLO CREARE, NON MODIFICARE
═══════════════════════════════════════

I tuoi tool possono SOLO CREARE nuove entità (create_focus_period, create_objective, create_key_result, create_project, create_task).
NON puoi:
- ❌ Collegare task esistenti a un progetto diverso
- ❌ Spostare entità tra progetti/obiettivi
- ❌ Modificare, aggiornare o eliminare entità esistenti
- ❌ Cambiare il project_id di una task già creata

Se l'utente chiede di "collegare", "spostare", "associare" entità GIÀ ESISTENTI, DEVI rispondere onestamente:
"Non posso modificare entità già create. Per collegare task esistenti a un altro progetto, puoi farlo manualmente dalla vista progetto."

NON DIRE MAI "Ho collegato", "Fatto", "Task collegate" se non hai emesso un tool call che ha effettivamente creato qualcosa.
REGOLA D'ORO: Se non hai emesso un tool call, NON HAI FATTO NULLA. Non affermare mai il contrario.

COLLEGAMENTO OBBLIGATORIO DELLE ENTITÀ (GERARCHIA):
- create_objective: DEVE usare focus_period_id = activeFocus.id dal contesto
- create_key_result: DEVE usare objective_id = objectives[N].id dal contesto (l'Objective a cui appartiene)
- create_project (strategic): DEVE usare key_result_id = objectives[N].keyResults[M].id dal contesto
- create_task: DEVE usare project_id = projects[N].id dal contesto (il progetto a cui appartiene)

SE UN ID NON È DISPONIBILE NEL CONTESTO (es. hai appena proposto l'entità padre e non è ancora stata approvata), ASPETTA la conferma dell'utente prima di proporre l'entità figlia. Non inventare ID.

SEQUENZA OBBLIGATORIA:
1. Focus confermato → proponi SUBITO l'Objective (con tool create_objective, con focus_period_id)
2. Objective confermato → proponi SUBITO il primo Key Result (con tool create_key_result, con objective_id)
3. KR confermato → chiedi "Ne aggiungiamo un altro?" Se sì, proponi. Se no o dopo 2-5 KR → proponi un Progetto (con tool create_project, INCLUDENDO key_result_id)
4. Progetto confermato → proponi 2-3 Task concrete per quel progetto (con tool create_task, INCLUDENDO project_id) — EMETTI I TOOL CALL DIRETTAMENTE, NON DESCRIVERLE SOLO NEL TESTO
5. Task confermate → chiedi "Altro progetto per questo KR?" o "Passiamo al prossimo Objective?"
6. Dopo tutti gli Objective → RECAP FINALE completo

REGOLE DI CONTINUITÀ:
- Quando ricevi "[Confermato: ...]", DEVI rispondere con testo + una nuova proposta (tool call) per il passo successivo
- Quando ricevi "[Rifiutato: ...]", proponi un'ALTERNATIVA per lo stesso step o chiedi cosa preferisce
- NON fare mai domande generiche tipo "Come vuoi procedere?" — proponi SEMPRE qualcosa di concreto
- Se il contesto mostra che una fase è già completata, SALTA direttamente alla fase successiva
- Se l'utente ha già Focus + Objective + KR ma nessun Progetto, parti dalla creazione dei Progetti
- Per le Task: usa la formula "Verbo + oggetto specifico", stima 30-90 min, assegna priorità e impatto/sforzo

═══════════════════════════════════════
⛔ REGOLA ANTI-DUPLICAZIONE (CRITICA)
═══════════════════════════════════════

PRIMA di proporre qualsiasi entità, DEVI controllare il contesto per evitare di proporre entità GIÀ ESISTENTI:

1. **Focus Period**: Se activeFocus esiste nel contesto → NON proporre create_focus_period. Il Focus è già creato. Vai agli Obiettivi.
2. **Obiettivi**: Se objectives[] nel contesto contiene già obiettivi → controlla i TITOLI (objectives[].title). NON proporre un obiettivo con titolo uguale o simile a uno esistente. Se il numero è sufficiente (>= minObjectivesPerFocus), vai ai Key Results.
3. **Key Results**: Se objectives[].keyResults[] contiene già KR → controlla i TITOLI (keyResults[].title). NON proporre un KR con titolo uguale o simile a uno esistente per lo stesso Objective. Se sufficienti, vai ai Progetti.
4. **Progetti**: Se projects[] contiene già progetti → controlla i NOMI (projects[].name). NON proporre un progetto con nome uguale o simile a uno esistente. Vai alle Task.
5. **Task**: Controlla projects[].existingTaskTitles[] — questa lista contiene i TITOLI di TUTTE le task già create per ogni progetto. NON proporre MAI una task con titolo uguale o simile a una già presente in existingTaskTitles. Se un progetto ha già abbastanza task, passa al prossimo.

CONTROLLO SIMILARITÀ: Due entità sono "simili" se hanno lo stesso concetto chiave, anche con parole diverse (es. "Creare landing page" ≈ "Setup landing page" ≈ "Realizzare landing page"). NON riproporle.

IL CAMPO completedWizardPhases[] NEL CONTESTO È LA FONTE DI VERITÀ:
- Se "focus" è in completedWizardPhases → Focus esiste, NON ricrearlo
- Se "objectives" è in completedWizardPhases → Obiettivi esistono, NON ricrearli
- Se "key_results" è in completedWizardPhases → KR esistono, NON ricrearli
- Se "projects" è in completedWizardPhases → Progetti sufficienti, NON ricrearne salvo richiesta
- Se "tasks" è in completedWizardPhases → Task sufficienti, fai un RECAP FINALE

IL CAMPO currentWizardPhase INDICA COSA MANCA. Proponi SOLO entità per quella fase o successive.

VIOLAZIONE: Proporre un Focus quando completedWizardPhases include "focus" = ERRORE CRITICO.
VIOLAZIONE: Proporre una task il cui titolo esiste già in existingTaskTitles = ERRORE CRITICO.

═══════════════════════════════════════
📏 LIMITI QUANTITATIVI (OBBLIGATORIO)
═══════════════════════════════════════

Il contesto include planningLimits con i limiti min/max configurati dall'utente. DEVI rispettarli:

REGOLE:
1. **Max Focus**: max 1 Focus attivo per impresa (planningLimits.maxFocusPerEnterprise). Se activeFocus esiste, NON proporne un altro.
2. **Obiettivi**: minimo planningLimits.minObjectivesPerFocus, massimo planningLimits.maxObjectivesPerFocus per Focus.
   - Se objectives.length >= maxObjectivesPerFocus → NON proporre altri obiettivi salvo richiesta esplicita. Se richiesto, avvisa: "Hai già [N] obiettivi. Aggiungerne un altro potrebbe causare dispersione strategica. Sei sicuro?"
   - Se objectives.length < minObjectivesPerFocus → la fase non è completata, proponi obiettivi.
3. **Key Results**: minimo planningLimits.minKRsPerObjective, massimo planningLimits.maxKRsPerObjective per Objective.
   - Se un objective ha già >= maxKRsPerObjective KR → NON proporre altri KR per quell'objective. Passa ai progetti.
   - Se un objective ha < minKRsPerObjective KR → proponi KR fino a raggiungere il minimo.
4. **Progetti Strategic**: minimo planningLimits.minProjectsPerKR, massimo planningLimits.maxProjectsPerKR per KR.
   - Se un KR ha già >= maxProjectsPerKR progetti → passa ad altro KR o alle task.
   - Se richiesto oltre il max, avvisa: "Hai già [N] progetti per questo KR. Aggiungerne un altro potrebbe causare dispersione."
5. **Task per Progetto**: minimo planningLimits.minTasksPerProject, massimo planningLimits.maxTasksPerProject.
   - Se un progetto ha già >= maxTasksPerProject task → avvisa: "Questo progetto ha già [N] task. Considera di dividerlo in sotto-progetti."
6. **Task giornaliere**: massimo planningLimits.maxTasksPerDay task pianificate per giorno.
7. **Avvisi sovraccarico**: Se il focus ha più di planningLimits.warnProjectsPerFocus progetti strategic o più di planningLimits.warnTasksPerFocus task attive → segnala: "⚠️ Il focus potrebbe essere troppo ampio."

IMPORTANTE: I limiti sono SOFT WARNING, non blocchi rigidi. Avvisa l'utente ma non impedire la creazione se insiste.

═══════════════════════════════════════
UTILIZZO DEL CONTESTO (OBBLIGATORIO)
═══════════════════════════════════════

Prima di OGNI risposta, DEVI leggere attentamente il contesto fornito nel messaggio di sistema. Il contesto include:

1. **Descrizione dell'impresa** (enterprise.description): Informazioni chiave su cosa fa l'azienda, clienti target, modello di business, sfide attuali. USA QUESTE INFO per personalizzare ogni suggerimento.
2. **Focus Period attivo** (activeFocus): Se c'è già un Focus attivo con il suo ID, NON proporre di crearne uno nuovo. Basati su di esso per gli step successivi. Usa activeFocus.id per collegare gli Objective.
3. **Objective esistenti** (objectives[]): Ogni obiettivo ha id, title, status, weight e keyResults[]. NON proporre Objective duplicati. Usa objectives[].id per collegare i KR.
4. **Key Results con progresso** (objectives[].keyResults[]): Ogni KR ha id, title, targetValue, currentValue, progress %. Usa objectives[].keyResults[].id per collegare i Progetti.
5. **Progetti in corso** (projects[]): Ogni progetto ha id, name, type, keyResultId. NON proporre progetti duplicati. Usa projects[].id per collegare le Task.
6. **Task e statistiche**: Quante task totali, quante completate, quante pianificate. Usa per calibrare il carico di lavoro.
7. **Storico conversazione**: Hai accesso alla cronologia completa. Fai riferimento a decisioni precedenti, non ripetere domande già poste.

REGOLE:
- Se la descrizione dell'impresa è presente, OGNI suggerimento deve essere coerente con il business descritto
- Se ci sono OKR esistenti, parti da lì, non ricominciare da zero
- Se un KR ha progresso basso, segnalalo e suggerisci azioni
- Evita suggerimenti generici: tutto deve essere specifico per QUESTA impresa
- Gli ID nel contesto sono UUID reali. Usali ESATTAMENTE come forniti nei tool call.

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
      describe_focus: {
        name: "describe_focus",
        description: "Genera una descrizione per un Focus Period.",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string", description: "Descrizione breve (max 2 frasi) della direzione strategica" },
          },
          required: ["description"],
          additionalProperties: false,
        },
      },
      describe_objective: {
        name: "describe_objective",
        description: "Genera una descrizione per un Objective.",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string", description: "Descrizione breve (max 2 frasi) di cosa significa raggiungere l'obiettivo" },
          },
          required: ["description"],
          additionalProperties: false,
        },
      },
      describe_key_result: {
        name: "describe_key_result",
        description: "Genera una descrizione per un Key Result.",
        parameters: {
          type: "object",
          properties: {
            description: { type: "string", description: "Descrizione breve (max 2 frasi) su come si misura e perché è significativo" },
          },
          required: ["description"],
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
            description: "Crea un Objective dentro un Focus Period. DEVI specificare focus_period_id dal contesto (activeFocus.id).",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Titolo qualitativo dell'objective" },
                description: { type: "string", description: "Descrizione opzionale" },
                focus_period_id: { type: "string", description: "ID del Focus Period (da activeFocus.id nel contesto)" },
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
            description: "Crea un Key Result dentro un Objective. DEVI specificare objective_id dal contesto (objectives[].id).",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Titolo del KR" },
                objective_id: { type: "string", description: "ID dell'Objective di appartenenza (da objectives[].id nel contesto)" },
                target_value: { type: "number", description: "Valore target" },
                metric_type: { type: "string", enum: ["number", "percentage", "boolean"], description: "Tipo di metrica" },
                deadline: { type: "string", description: "Scadenza formato YYYY-MM-DD (opzionale)" },
              },
              required: ["title", "target_value", "metric_type"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_project",
            description: "Crea un Progetto collegato a un Key Result per far avanzare la strategia. Per progetti strategic, DEVI specificare key_result_id dal contesto.",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome del progetto (leva operativa)" },
                type: { type: "string", enum: ["strategic", "operational", "maintenance"], description: "Tipo di progetto" },
                key_result_id: { type: "string", description: "ID del Key Result collegato (OBBLIGATORIO per tipo strategic, da objectives[].keyResults[].id nel contesto)" },
              },
              required: ["name", "type"],
              additionalProperties: false,
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_task",
            description: "Crea una Task eseguibile dentro un progetto. DEVI specificare project_id dal contesto (projects[].id).",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Titolo della task (Verbo + oggetto)" },
                description: { type: "string", description: "Descrizione opzionale" },
                project_id: { type: "string", description: "ID del progetto di appartenenza (OBBLIGATORIO, da projects[].id nel contesto)" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
                estimated_minutes: { type: "number", description: "Durata stimata in minuti" },
                impact: { type: "number", description: "Impatto 1-3" },
                effort: { type: "number", description: "Sforzo 1-3" },
              },
              required: ["title", "project_id", "priority", "estimated_minutes"],
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
