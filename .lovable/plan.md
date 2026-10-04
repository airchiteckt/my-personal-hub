# Revisione schede Appuntamenti e Promemoria

## Obiettivo
Allineare le due schede alla UX già adottata per le task: contenuto leggibile subito, dettagli compatti e modifica intenzionale, senza cambiare il comportamento di calendario o notifiche.

## Interventi

### Appuntamenti
- Usare il riquadro documento già presente nelle task per titolo e note formattate.
- Nella scheda esistente, mostrare data, orario, impresa e stato “Importante” in una riga compatta.
- Aprire i controlli completi solo con “Modifica”; “Fatto” salva e richiude i dettagli.
- Rendere il cestino un’azione discreta nel footer, con conferma prima dell’eliminazione.
- Salvare le modifiche anche alla chiusura della scheda.

### Promemoria
- Usare lo stesso riquadro documento per titolo e note formattate.
- Mantenere sempre visibili gli eventuali collegamenti a task e impresa, ma in forma compatta.
- Riassumere data, ora e chiamata vocale in una sola riga; mostrare i controlli solo con “Modifica”.
- Trattare “Archivia” come azione principale di stato e il cestino come azione distruttiva secondaria con conferma.
- Salvare le modifiche anche alla chiusura, mantenendo il blocco della chiusura accidentale al tocco esterno.

### Coerenza visiva e verifica
- Applicare gli stessi limiti di larghezza, altezza e scorrimento delle schede task su desktop, iPad e mobile.
- Usare esclusivamente componenti e colori già presenti nel sistema visivo.
- Verificare creazione, modifica, archiviazione ed eliminazione e controllare che la build resti valida.

## Dettagli tecnici
- Riutilizzo di `TaskDocumentEditor` con placeholder specifici per appuntamenti e promemoria.
- Nessuna modifica a dati, sincronizzazione Google, notifiche o logica Radar.
