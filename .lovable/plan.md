# Riprogrammazione automatica: regole di buon senso

Oggi tutto ciò che non è stato completato viene riversato sul primo giorno utile, senza limiti:
il risultato è la giornata sovraccarica e gli elementi sovrapposti che vedi nello screenshot.
Introduciamo regole da gestione del lavoro reale: la giornata ha una capacità, e quella si rispetta.

## Le regole

**1. La giornata ha una capacità massima**
Si calcola il tempo davvero libero del giorno di destinazione (fascia oraria di lavoro, meno
appuntamenti, eventi Google, rituali e attività già pianificate). Si riempie al massimo l'85% di
quel tempo: il resto della giornata resta respiro per imprevisti.

**2. Si riprogramma solo ciò che entra davvero**
Le attività vengono riprese in ordine di priorità effettiva (scadenza, priorità, impatto/sforzo).
Quelle che entrano ottengono un orario reale in uno spazio libero contiguo.
Quelle che non entrano **non vengono impilate**: tornano in Backlog, pronte da ripianificare.
Niente più attività senza orario ammucchiate sullo stesso slot.

**3. Mai nel passato**
Se il giorno di destinazione è oggi, si parte dal primo slot da adesso in poi (arrotondato ai 30
minuti), non dalle 9:00 del mattino.

**4. Salvaguardia delle scadenze**
Un'attività con scadenza entro 48 ore passa davanti a tutte ed entra comunque in giornata, anche
se la capacità è esaurita (è l'unica eccezione al limite).

**5. Ogni rinvio viene contato**
Ogni spostamento automatico incrementa il contatore di rinvii. Dal 3° rinvio l'attività non viene
più ripianificata a forza: va in Backlog segnalata come "da rivedere", e Radar te lo fa notare
proponendo di spezzarla, ridimensionarla o eliminarla.

**6. Promemoria: stesso orario, ma senza collisioni**
I promemoria scaduti si spostano al prossimo giorno lavorativo mantenendo l'orario; se più
promemoria finiscono nello stesso orario vengono distanziati di 15 minuti l'uno dall'altro.

**7. Una volta al giorno, con riepilogo**
Il controllo gira una sola volta al giorno per utente (non a ogni cambio pagina). Al termine
compare un riepilogo: quante attività riprogrammate, quante rimandate al Backlog e perché.

## Cosa non cambia

Gli appuntamenti restano alla loro data: sono impegni presi con altri.
I rituali seguono la loro cadenza e non vengono spostati.

## Dettagli tecnici

Riscrittura di `src/hooks/use-auto-reschedule.ts`:
- `computeFreeTime` / `findSlotsForTasks` di `src/lib/scheduling-utils.ts` per capacità e slot,
  estesi a considerare appuntamenti, eventi esterni e rituali come occupati.
- Ordinamento con `calculateEffectivePriority` e `getUrgencyLevel` di `src/lib/priority-engine.ts`.
- Budget = 85% dei minuti liberi; conteggio cumulativo mentre si assegnano gli slot.
- Overflow → `status: 'backlog'`, `scheduledDate/Time` azzerati, `postponeCount + 1`.
- `postponeCount >= 3` → sempre backlog, mai riprogrammazione forzata.
- Guardia giornaliera in `localStorage` per utente (`flydeck:autoresched:<userId>:<data>`).
- Toast unico con il riepilogo al posto dei due toast attuali.
