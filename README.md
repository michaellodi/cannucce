# Il barista ordinato

App HTML5/JavaScript creata da Michael Lodi con l'aiuto di Codex.

## Descrizione

Il barista ordinato è un gioco didattico sull'ordinamento: il giocatore deve mettere in ordine alcune cannucce dalla più corta alla più lunga scegliendone due alla volta. A ogni confronto, se le due cannucce sono fuori ordine, l'app le scambia automaticamente e tiene il conto di confronti e scambi.

## Come si gioca

- Ci sono cinque cannucce di colori e lunghezze diversi. Si possono scegliere due posizioni qualsiasi: se la cannuccia a sinistra è più lunga di quella a destra, vengono scambiate. L'ordine dei due clic non cambia la regola.
- Ogni coppia scelta conta come un confronto, anche quando non produce uno scambio. Selezionare nuovamente la prima cannuccia annulla la selezione senza aumentare i contatori.
- **Nuova partita** mostra le lunghezze e permette di esercitarsi con confronti e controlli.
- **Nuova partita coperta** nasconde le lunghezze. Quando si ritiene concluso l'ordinamento, si spiega la propria strategia e si preme **Scopri e termina**: il foglio viene tolto e il tentativo termina sempre, anche se il risultato è sbagliato. Non è possibile effettuare altri confronti nello stesso tentativo.
- Per riprovare si avvia una nuova partita coperta. L'app ricrea tutte le cannucce e rimescola l'associazione tra colori e lunghezze, così non si può riutilizzare l'ordine dei colori appena scoperto.
- Cambiare la disposizione iniziale avvia un nuovo tentativo nella modalità corrente e azzera i contatori.

Per scelta didattica, la disposizione iniziale non è mai già ordinata, neppure quando si sceglie **Casuale**.

Durante un confronto si attende la fine dell'animazione prima di scegliere altre cannucce o controllare il risultato. I pulsanti di nuova partita restano disponibili e annullano le operazioni ancora in corso.

## Esecuzione e verifiche

L'app non richiede installazione né servizi esterni: aprire `index.html` in un browser, oppure pubblicare i file su un server statico.

Con Node.js, eseguire i test dalla cartella del progetto:

```sh
node --test tests/app.test.cjs
```

I test eseguono il codice dell'app con un DOM e un orologio simulati. Controllano tutti i 4.800 casi di confronto ottenuti combinando le 120 disposizioni, le 10 coppie, i due ordini di selezione e le due modalità. Provano inoltre entrambe le strategie descritte nella guida su tutte le disposizioni, e verificano fine tentativo, contatori, reset durante le animazioni, nuove associazioni colore-lunghezza, selezione e focus da tastiera. I controlli di layout e interazione nei browser reali vanno eseguiti separatamente.

I test nei browser richiedono Playwright e i browser corrispondenti. Dopo aver installato Playwright nell'ambiente di sviluppo, eseguire:

```sh
node tests/browser.test.cjs
node tests/browser.test.cjs --engine=firefox
node tests/browser.test.cjs --engine=webkit
```

Il primo comando usa Chrome installato nel computer; `BROWSER_CHANNEL` permette di scegliere un altro canale Chromium disponibile. `PLAYWRIGHT_BROWSERS_PATH` può indicare una cartella personalizzata per i browser di Playwright. La suite controlla interazioni reali con mouse e tastiera, tocco su schermo da 390 px, fine tentativo corretta e fallita, annullamento delle operazioni al reset, ordinamento completo e disposizione del foglio a larghezze da 320 a 1440 px.

## File principali

- `index.html`: interfaccia dell'app
- `app.js`: logica della simulazione
- `styles.css`: grafica
- `LICENSE`: testo completo della licenza

## Licenza

Questo progetto è distribuito con licenza `AGPL-3.0-or-later`.

In breve:

- puoi usare, studiare, modificare e ridistribuire il progetto
- se distribuisci versioni modificate, devono restare sotto AGPL
- il progetto è fornito senza garanzia

Per i dettagli completi, vedi il file `LICENSE`.
