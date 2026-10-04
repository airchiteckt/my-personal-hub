# Anteprima allegati a carosello

## Obiettivo
Trasformare l'elenco degli allegati della task in una galleria orizzontale compatta, con anteprima prima del download.

## Intervento
- Mostrare ogni allegato come tessera scorrevole, con miniatura per immagini e indicazione chiara per PDF e altri documenti.
- Aprire al tocco un visualizzatore sopra la scheda task, senza avviare automaticamente il download.
- Consentire di passare all'allegato precedente o successivo con swipe e comandi laterali.
- Visualizzare immagini e PDF direttamente; per i formati non visualizzabili mostrare nome, tipo e dimensione con download esplicito.
- Mantenere caricamento drag & drop, eliminazione e accesso privato tramite link temporanei.

## Dettagli tecnici
- Riutilizzare il carosello e le finestre di dialogo già presenti nel progetto.
- Generare i link temporanei solo quando servono e revocare lo stato dell'anteprima alla chiusura.
- Evitare che il click sui comandi della tessera apra o chiuda involontariamente altre finestre.

## Verifica
- Controllare anteprima immagine, PDF e file non supportato.
- Controllare swipe, navigazione, download, eliminazione e comportamento su tablet.
