# Messa a fuoco del calendario

## Obiettivo
Trasformare lo zoom attuale in una singola ghiera che controlla insieme dettaglio temporale e ampiezza del periodo, mantenendo il momento attuale come centro naturale.

## Esperienza
- La ghiera parte dal massimo dettaglio: oggi, ora corrente al centro, 3 ore precedenti e 3 successive.
- Riducendo la messa a fuoco aumenta progressivamente la finestra oraria e compaiono giorni simmetrici prima e dopo quello centrale.
- Il movimento è continuo, con aggancio ai livelli **Momento**, **Giorno**, **3 giorni**, **Settimana**, **Mese** e **Anno**.
- Rotellina del mouse e pinch sul tablet agiscono sulla stessa ghiera, mantenendo stabile il punto osservato.
- I pulsanti di navigazione avanzano o arretrano in modo coerente con il periodo visibile; “Oggi” riporta al presente senza cambiare il livello.
- La scelta viene ricordata sul dispositivo.

## Viste
- **Momento → Settimana:** griglia oraria esistente, con numero di colonne e intervallo verticale adattivi.
- **Mese:** griglia sintetica giornaliera con indicatori di carico, appuntamenti, task e promemoria.
- **Anno:** panoramica dei 12 mesi, con densità giornaliera e accesso rapido al dettaglio.
- Cliccando un giorno nelle viste sintetiche si torna alla vista Giorno centrata su quella data.

## Dettagli tecnici
- Introdurre un modello unico di focus continuo con soglie di aggancio e livelli semanticamente nominati.
- Rendere dinamici numero di giorni, data centrale, altezza oraria e finestra visibile.
- Gestire wheel/pinch con eventi non passivi, normalizzazione del delta e ancoraggio al cursore/gesto.
- Separare la griglia sintetica mese/anno dalla griglia oraria, riusando i dati e i colori esistenti.
- Preservare creazione, modifica, drag & drop, giorno corrente e sincronizzazione dell’intestazione.
- Verificare compilazione e comportamento alle larghezze desktop e tablet disponibili.
