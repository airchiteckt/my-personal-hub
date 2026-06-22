## Obiettivo

Quando crei / modifichi / elimini un **appuntamento** su FlyDeck, l'evento viene anche scritto sul Google Calendar predefinito dell'impresa associata. Gli eventi di Google continuano a essere visualizzati come oggi (read-only, separati dagli appuntamenti).

## 1. Permessi Google (riconnessione)

Le connessioni Google attuali hanno solo lo scope `calendar.readonly`. Per scrivere serve `https://www.googleapis.com/auth/calendar.events`.

Aggiornerò il flow OAuth (`google-oauth-start`) per richiedere il nuovo scope e ti chiederò di **riconnettere** gli account Google esistenti. Senza riconnessione le scritture falliranno con 403.

## 2. Calendario predefinito per impresa

Aggiungo una colonna `is_default_for_writes boolean` su `google_calendar_list`. Vincolo: max **un** calendario di default per impresa.

Nella pagina **Impostazioni → Integrazioni Google**, accanto a ciascun calendario assegnato a un'impresa compare una stella "Imposta come predefinito per scrittura". Se un'impresa non ha un calendario di default, gli appuntamenti vengono creati solo su FlyDeck (nessuna scrittura su Google, nessun errore).

## 3. Schema appuntamenti

Aggiungo a `appointments`:
- `google_event_id text` — id dell'evento su Google
- `google_calendar_id text` — calendario di destinazione usato
- `google_connection_id uuid` — quale account Google ha scritto
- `synced_at timestamptz`
- `sync_error text` — ultimo errore (se la push fallisce non blocco il salvataggio)

## 4. Push verso Google

Nuova edge function `google-appointments-push` (invocata dal client dopo create/update/delete dell'appuntamento) che:

```text
CREATE  → POST   /calendars/{calId}/events
UPDATE  → PATCH  /calendars/{calId}/events/{googleEventId}
DELETE  → DELETE /calendars/{calId}/events/{googleEventId}
```

Logica:
1. Carica appuntamento + impresa + calendario di default + connessione Google.
2. Se nessun calendario di default → no-op (success silenzioso).
3. Rinfresca l'access token se scaduto (riusa `refreshAccessToken` di `google-calendar-sync`).
4. Costruisce il payload con `summary`, `description`, `start`/`end` in `Europe/Rome`, `location`.
5. Scrive `google_event_id` / `google_calendar_id` / `google_connection_id` / `synced_at` sull'appuntamento; in caso di errore registra `sync_error` ma non rompe l'app.

Wiring: chiamata dal client (`PrpContext`) dopo `addAppointment` / `updateAppointment` / `deleteAppointment`. Fire-and-forget con toast su errore.

## 5. Anti-loop

Il sync inverso (`google-calendar-sync`) popola la tabella `external_calendar_events`, **separata** da `appointments`. Per evitare di vedere lo stesso appuntamento due volte (una come blocco FlyDeck e una come "evento Google"), il filtro che alimenta gli eventi nel calendario scarta le righe di `external_calendar_events` il cui `google_event_id` corrisponde a un appuntamento già presente.

## 6. Cosa NON cambia

- I task schedulati restano locali (richiesto).
- Gli eventi Google esistenti restano visualizzati read-only come adesso.
- Nessun cambio sulla mail serale.

---

## File toccati

- **Migration**: colonne `appointments.google_*`, `google_calendar_list.is_default_for_writes` + indice unico parziale.
- **Edge function nuova**: `supabase/functions/google-appointments-push/index.ts`.
- **Edge function modificata**: `google-oauth-start` (aggiunge scope `calendar.events`).
- **UI**: `src/pages/Settings.tsx` (o componente integrazioni Google) — toggle "predefinito per scrittura".
- **Context**: `PrpContext.tsx` — invoca la push dopo CRUD appuntamenti; filtra `external_calendar_events` duplicati.
- **Types**: `src/types/prp.ts` aggiunge campi `googleEventId`, ecc.

Dopo l'approvazione procedo con migration + codice in un solo passaggio, poi ti chiedo di riconnettere i 2 account Google per ottenere lo scope di scrittura.
