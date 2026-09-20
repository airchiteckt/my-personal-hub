# Radar vocale: chiamate vere, in entrata e in uscita

## Cosa costruiamo

Radar ottiene un numero di telefono italiano (uno solo per tutti — le chiamate contemporanee vengono gestite in parallelo, il numero è solo un punto di ingresso).

**In uscita — promemoria urgenti.** Quando scatta un promemoria marcato come "urgente", Radar ti telefona: rispondi e ti parla con la sua voce, ti legge il promemoria e puoi rispondere a voce ("fatto", "rimandami di un'ora", "parliamone").

**In entrata — la linea Radar.** Chiami il numero quando vuoi: il sistema riconosce chi sei dal tuo numero di cellulare e ti mette in comunicazione con Radar, che conosce la tua giornata, le tue imprese, le attività. A voce puoi:
- creare e spostare attività, appuntamenti, promemoria ("domani alle 15 ricordami di chiamare il commercialista")
- chiedere come è messa la giornata o la settimana
- completare attività, chiedere cosa fare adesso
Esattamente le stesse cose che già fa su Telegram, ma parlando.

Se chiama un numero non registrato, Radar risponde che il numero non è collegato a nessun account e riaggancia.

## Come funziona (in breve)

- **Telefonia: Twilio** — numero italiano, gestisce le chiamate (in entrata e in uscita). Già disponibile come connessione in Lovable.
- **Voce e conversazione: ElevenLabs Conversational AI** — l'agente vocale vero e proprio: capisce l'italiano, parla con voce naturale professionale, e durante la chiamata interroga il nostro sistema.
- **Cervello: riusiamo Radar** — gli stessi strumenti e lo stesso contesto che già usa su Telegram (imprese, progetti, attività, appuntamenti, promemoria, focus), quindi a voce sa esattamente chi sei e cosa hai in programma.

## Cosa vedrai tu

1. **Impostazioni → Profilo**: campo "Numero di cellulare" (serve per riconoscerti quando chiami).
2. **Promemoria**: nuova opzione "Urgente — chiamami" al momento della creazione (e nella modifica).
3. **Impostazioni → Integrazioni → Radar vocale**: numero di telefono di Radar da salvare in rubrica, stato del servizio, e registro delle ultime chiamate.
4. **Escalation promemoria completa**: alla scadenza arriva (1) messaggio Telegram di Radar, (2) email, e — solo se marcato urgente — (3) la chiamata vocale.

## Dettagli tecnici

**Database (una migrazione)**
- `profiles.phone_number` (testo, formato internazionale +39...).
- `reminders.is_urgent` (boolean, default false) e `reminders.call_status` (null/pending/completed/failed).
- `voice_calls` (log): `user_id`, `direction` (inbound/outbound), `phone_number`, `started_at`, `ended_at`, `summary`, `elevenlabs_conversation_id`. GRANT + RLS per utente.
- Riuso di `radar_nudges` per la deduplica dell'escalation.

**Edge functions**
- `twilio-voice-webhook`: risponde alle chiamate in entrata su Twilio; cerca l'utente dal numero chiamante (`profiles.phone_number`), se non trovato riproduce un messaggio cortese e chiude; altrimenti connette la chiamata all'agente ElevenLabs (Twilio `<Connect><Stream>` verso ElevenLabs ConvAI).
- `elevenlabs-agent-tools`: webhook degli strumenti dell'agente vocale. Riceve le azioni richieste durante la chiamata (crea attività, sposta, completa, leggi giornata…) e le esegue riusando la stessa logica di `telegram-webhook` (estrarre `executeAction`/`buildContext` in `supabase/functions/_shared/radar-actions.ts`, usato da entrambe). Autenticata con un segreto condiviso.
- `radar-reminder-call`: chiamata dal cron esistente dei promemoria; per i promemoria urgenti non ancora gestiti: manda il nudge Telegram, invia l'email (riuso `send-email`) e avvia la chiamata Twilio verso `profiles.phone_number` con istruzioni per l'agente ("annuncia il promemoria X, chiedi se fatto/rimandare").
- Aggiornamento `process-appointment-reminders`/cron: instrada i promemoria urgenti a `radar-reminder-call`.
- Aggiornamento `telegram-webhook`: solo refactor verso `_shared/radar-actions.ts`, nessun cambio di comportamento.

**Frontend**
- `src/components/ProfileSettings.tsx`: campo numero di cellulare con salvataggio.
- `src/components/CreateReminderDialog.tsx` e `EditReminderDialog.tsx`: toggle "Urgente (chiamata vocale)".
- `src/components/VoiceRadarSettings.tsx`: nuova card in Integrazioni con il numero di Radar, lo stato e le ultime chiamate (lettura da `voice_calls`).
- Badge "Urgente" sui promemoria nel calendario.

**Connessioni e segreti**
- Collegare il connettore Twilio (account dell'utente: numero italiano + credenziali) e il connettore ElevenLabs (API key). La carta di collegamento si apre in chat.
- L'agente ElevenLabs viene creato/configurato via API al primo avvio (voce italiana professionale, prompt di sistema con le regole di Radar, strumenti puntati a `elevenlabs-agent-tools`).

**Costi da sapere**: il numero Twilio italiano costa pochi euro/mese; le chiamate si pagano al minuto (telefonia + ElevenLabs). Le chiamate partono solo per i promemoria marcati urgenti o quando chiami tu, quindi il costo resta sotto controllo.

## Fuori perimetro

Videochiamate, numeri dedicati per singolo cliente (non servono: il numero unico gestisce chiamate simultanee e riconosce il chiamante), segreteria/messaggi registrati.
