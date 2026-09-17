# Radar proattivo — assistente che monitora la giornata

Oggi Radar risponde solo quando gli scrivi (app o Telegram), più il briefing delle 8:00.
L'idea è renderlo presente durante la giornata: ti avvisa prima, controlla durante, chiude la sera.

## Come si comporterà

**Prima di un'attività** (default 10 minuti prima)
"Tra 10 min: *Revisione offerta Zapper* (45 min)."
Pulsanti: `Inizio ora` · `Sposta di 30 min` · `Oggi non la faccio`

**Durante / a fine attività** (allo scadere del tempo stimato)
"*Revisione offerta* doveva finire alle 11:15. È completata?"
Pulsanti: `Completata` · `+15 min` · `+30 min` · `Riprogramma`
Con `+15/+30` il tempo stimato viene aggiornato davvero, così la giornata si ricalcola.

**Appuntamenti** (15 minuti prima)
Titolo, orario, luogo e link della videocall, se presenti.

**Buchi liberi** (spazio libero ≥ 45 min in orario di lavoro, max 1 proposta ogni 2 ore)
"Hai 1h libera fino alle 15:00. Ti propongo *X* (50 min), priorità alta."
Pulsanti: `Pianifica ora` · `No grazie`

**Scadenze a rischio** (deadline entro 48h e attività non ancora pianificata)
"*Y* scade domani e non è in agenda. La metto oggi alle 16:00?"

**Attività rimandate troppe volte** (dal 3° rinvio)
"*Z* l'hai rimandata 3 volte. La spezzo, la ridimensiono o la elimino?"

**Chiusura giornata** (18:30, orario configurabile)
Riepilogo: completate, non completate, tempo effettivo vs stimato.
Pulsanti: `Chiudi giornata` (sposta le rimanenti a domani) · `Vedo dopo`

**Revisione settimanale** (domenica 18:00)
Focus e key result fermi da 7+ giorni, progetti senza attività, carico della settimana entrante.

## Regole anti-disturbo

- Orari silenziosi: nessun messaggio fuori dalla fascia oraria di lavoro (default 09:00–19:00, presa dalle impostazioni esistenti).
- Massimo messaggi/ora configurabile (default 4); i check-in sulle attività hanno priorità sulle proposte.
- Un solo messaggio per evento: niente doppioni se il cron rigira.
- Comando `/pausa 2h` (e `/riprendi`) su Telegram per silenziare Radar.
- Ogni tipo di segnalazione si può spegnere singolarmente.

## Dove si configura

Impostazioni → Integrazioni → **Radar proattivo**: interruttore generale, un interruttore per ogni tipo di segnalazione, anticipo in minuti, orario di chiusura giornata, limite messaggi/ora.

## Dettagli tecnici

**Database (nuova migrazione)**
- `radar_preferences` (1 riga per utente): `enabled`, flag per tipo (`pre_task`, `task_checkin`, `appointment`, `free_slot`, `deadline_risk`, `postponed`, `day_close`, `weekly_review`), `lead_minutes`, `day_close_time`, `max_per_hour`, `snoozed_until`. RLS per utente + GRANT authenticated/service_role.
- `radar_nudges`: `user_id`, `kind`, `entity_table`, `entity_id`, `dedupe_key` (unique con user_id), `sent_at`, `telegram_message_id`, `response`, `responded_at`. Serve per deduplica, rate limit e per misurare cosa è utile.
- Colonna `postpone_count` su `tasks` se non esiste già (la usa la regola sui rinvii).

**Edge function `radar-pulse`** (verify_jwt = false), cron ogni 5 minuti:
per ogni riga di `telegram_links` → carica preferenze, ora locale Europe/Rome, verifica fascia oraria, snooze e rate limit → valuta le regole in ordine di priorità (check-in > pre-attività > appuntamento > scadenza > buco libero > rinvii) → per ogni trigger non ancora inviato (`dedupe_key`) genera il testo (frase breve dal modello `openai/gpt-6-astra`, con fallback a testo fisso se il gateway fallisce) e invia via gateway Telegram con `inline_keyboard`.
Riuso di `romeNow`/`romeDayBounds` e dell'helper `tg()` già presenti in `telegram-morning-briefing`.
Le regole su tempo libero/fit riusano la logica di `src/lib/scheduling-utils.ts` portata lato server.

**`telegram-webhook`**: nuovi prefissi di callback `rd:done:`, `rd:more:15`, `rd:more:30`, `rd:start:`, `rd:resched:`, `rd:plan:`, `rd:skip:`, `rd:closeday:`, `rd:no:` che aggiornano tasks/appointments, registrano la risposta in `radar_nudges` e modificano il messaggio con l'esito. Aggiunti i comandi `/pausa` e `/riprendi`.

**Cron**: due job (`0 * * * *` non basta) → `*/5 * * * *` per `radar-pulse`; la chiusura giornata e la revisione settimanale sono valutate dentro la stessa funzione in base all'ora locale, quindi non servono job extra.

**UI**: nuovo `src/components/RadarProactiveSettings.tsx` dentro il tab Integrazioni di `src/pages/Settings.tsx`.

## Fuori perimetro

Notifiche push nel browser e notifiche in-app: per ora tutto su Telegram, dove Radar già vive.
