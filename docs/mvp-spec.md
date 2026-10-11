# MVP – Tracker di progetto con piano verso l'obiettivo

Bozza v0.1 – da discutere. Nome del progetto: da decidere.

## 1. Obiettivo dell'MVP

Una persona con un SaaS/app/side project può:
1. creare una **scheda progetto** con caratteristiche e dettagli;
2. inserire **a mano** i numeri mensili (MRR, clienti, costi);
3. vedere un **grafico** dell'andamento;
4. fissare un **obiettivo** (es. 10.000 € di MRR entro dicembre 2027) e vedere **cosa serve per arrivarci**: clienti necessari, clienti nuovi al mese, confronto con il ritmo attuale, leve (prezzo, churn, acquisizione), runway e pareggio.

**Posizionamento:** non "prevediamo il futuro", ma "ecco i conti per arrivare dove vuoi". Stripe e simili mostrano dove sei; noi come arrivi all'obiettivo. Una previsione è una scommessa, un piano è aritmetica sulle ipotesi che l'utente vede.

**Fonti dei dati:** il prodotto accetta sia inserimento manuale sia collegamento (Stripe, RevenueCat… dopo l'MVP), nello stesso modello dati. Il manuale copre tutto ciò che un connettore non vede (App Store, bonifici, progetti in fase idea, costi).

**Fuori dall'MVP** (di proposito): import CSV/Excel, Google Sheets, connettori Stripe/RevenueCat, pagamenti, team, pagine pubbliche, widget, notifiche.

**Come capiamo se funziona:** le persone tornano la settimana dopo, inseriscono almeno 3 mesi di dati, fissano un obiettivo e muovono almeno una leva.

## 2. Principi

- **Modello dati unico, indipendente dalla fonte.** Manuale, CSV o Stripe scrivono tutti nella stessa tabella delle metriche. Aggiungere una fonte più avanti non cambia il resto.
- **Granularità mensile.** Più semplice degli eventi, sufficiente per le previsioni. Gli eventi (come i webhook di RevenueCat) si potranno aggiungere in un secondo momento e aggregare in snapshot mensili.
- **Si salva il dato, si calcola il resto.** Il piano e le metriche derivate (crescita, churn, runway, clienti necessari) non si memorizzano: sono funzioni dei dati, dell'obiettivo e delle leve.
- **Soldi in interi** (centesimi) con la valuta del progetto. Mai float.
- **Ogni snapshot ricorda la fonte** (`manual`, `csv`, `stripe`…), così la verifica dei dati per la fatturazione futura è già possibile.

## 3. Modello dati

### `user`
| campo | note |
|---|---|
| id | |
| email | |
| created_at | |

### `project`
| campo | note |
|---|---|
| id | |
| user_id | proprietario |
| name | |
| description | testo breve |
| kind | `saas` / `app` / `altro` |
| stage | `idea` / `in_sviluppo` / `lanciato` / `in_crescita` |
| website_url | opzionale |
| launch_date | opzionale |
| currency | ISO 4217, es. `EUR` |
| pricing_summary | testo libero (es. "9 €/mese, 79 €/anno") |
| target_audience | testo libero |
| tech_stack | tag |
| cash_balance | cassa attuale, in centesimi, per il runway |
| notes | testo libero |
| created_at, updated_at | |

I campi "caratteristiche e dettagli" sono fissi nell'MVP. Se servono campi personalizzati si aggiungono dopo.

### `metric_snapshot` (una riga per progetto e mese)
| campo | note |
|---|---|
| id | |
| project_id | |
| period | mese in formato `YYYY-MM`, es. `2026-10`. **Unico per progetto** |
| mrr | obbligatorio, centesimi |
| paying_customers | obbligatorio |
| new_mrr | opzionale |
| expansion_mrr | opzionale |
| contraction_mrr | opzionale |
| churned_mrr | opzionale |
| new_customers | opzionale |
| churned_customers | opzionale |
| costs | costi del mese, opzionale ma serve per runway e pareggio |
| source | `manual` (MVP), poi `csv`, `stripe`, `revenuecat` |
| created_at, updated_at | |

**Regola:** il minimo per iniziare è `mrr` + `paying_customers` per mese. I campi opzionali rendono le previsioni più precise. Se mancano, churn e crescita si ricavano dalla variazione tra un mese e il successivo.

### `goal` (uno per progetto nell'MVP)
| campo | note |
|---|---|
| id | |
| project_id | unico per progetto |
| label | es. "10k MRR" |
| target_mrr | centesimi |
| deadline | mese `YYYY-MM` entro cui arrivarci |
| baseline_period | mese di partenza (ultimo mese inserito quando si fissa l'obiettivo) |
| baseline_mrr | MRR in quel mese, centesimi |
| created_at, updated_at | |

La partenza si congela quando si fissa l'obiettivo: così la linea del piano resta ferma e i mesi successivi si confrontano con lei ("sopra / sotto il piano").

### `assumptions` (le leve, una riga per progetto)
| campo | note |
|---|---|
| project_id | chiave |
| arpu | ricavo medio per cliente al mese, centesimi; `null` = ricavato dai dati |
| monthly_churn_rate | frazione di clienti persi al mese; `null` = ricavato dai dati |
| new_customers_per_month | `null` = ricavato dai dati |
| monthly_costs | centesimi; `null` = costi dell'ultimo mese |
| updated_at | |

`null` significa "usa il valore misurato": appena l'utente sposta una leva il valore diventa suo, e può sempre tornare a quello dei dati. Se un valore non si può misurare (es. churn senza `churned_customers`) si usa un default dichiarato come ipotesi nell'interfaccia.

### Più avanti (non ora)
`data_import` (file, mappatura colonne, stato), `connection` (credenziali cifrate per Stripe/RevenueCat), `billing_plan` / `billing_period` (importo mensile calcolato dall'MRR, per Stripe), più obiettivi per progetto.

## 4. Motore del piano

Modello per clienti (più leggibile di un tasso di crescita):

```
clienti(t+1) = clienti(t) × (1 − churn) + nuovi
MRR(t)       = clienti(t) × ARPU
```

Dai dati (ultimi 3-6 mesi) si ricavano ARPU, churn e clienti nuovi al mese. L'utente può sovrascriverli (le leve).

Output:
- **clienti necessari** = obiettivo / ARPU;
- **clienti nuovi al mese necessari** per arrivarci entro la scadenza (formula chiusa del modello sopra);
- **al ritmo attuale**: mese in cui si arriva all'obiettivo, oppure il **tetto** (`nuovi / churn` clienti) se non ci si arriva mai;
- **con le leve scelte**: stessa cosa, con i valori modificati;
- **linea del piano**: MRR mese per mese dalla partenza all'obiettivo (crescita composta costante; lineare se si parte da zero), per il confronto con i mesi reali;
- **runway** = cassa / (costi − MRR) se si è in perdita, altrimenti "in utile";
- **mese di pareggio** (MRR ≥ costi) al ritmo attuale.

Regole di onestà:
- con **meno di 3 mesi di storia** mostrare un avviso ("pochi dati, i valori misurati sono indicativi");
- i valori non misurati sono marcati come **ipotesi**;
- le leve sono sempre visibili e modificabili;
- nel grafico i mesi reali e il piano hanno aspetto diverso (barre piene vs linea tratteggiata).

Il motore è una **funzione pura** (dati, obiettivo e leve in ingresso, numeri in uscita) con test automatici. È la parte più importante da fare bene.

## 5. Schermate

Stile: tema scuro e sobrio, tutto in nero, bianco e grigio; il **blu** solo per pochi dettagli speciali (obiettivo, proiezione "al ritmo attuale", valori impostati dall'utente). Rosso solo per errori e azioni distruttive. Numeri in monospace (reference tipo dashboard finanziaria). Colori come variabili CSS, così il tema chiaro si aggiunge dopo.

1. **Elenco progetti**: card con nome, fase, MRR attuale, variazione e avanzamento verso l'obiettivo.
2. **Panoramica progetto**: MRR grande con variazione, grafico (mesi reali a barre, piano tratteggiato), avanzamento obiettivo, runway/pareggio, ultimi mesi inseriti con la fonte.
3. **Dati**: tabella mensile in stile foglio di calcolo, con aggiunta rapida del mese.
4. **Piano**: obiettivo, cosa serve, ritmo attuale, leve modificabili, piano mese per mese.
5. **Dettagli** del progetto (modifica, eliminazione).
6. **Impostazioni**: backup e ripristino JSON.

## 6. Ordine di lavoro

1. Modello dati e database.
2. Motore del piano con test (prima dell'interfaccia).
3. Inserimento dati e scheda progetto.
4. Grafico dell'andamento.
5. Schermata del piano.
6. Prova con 5-10 persone reali.

## 7. Decisioni prese

- **Piattaforma:** web app.
- **Stack:** Next.js + TypeScript (database/Supabase solo quando arriva l'autenticazione).
- **Lingua del prodotto:** inglese.
- **Account:** nessuna registrazione nella v1. Autenticazione prevista circa un mese dopo il lancio dell'MVP.
- **Prezzi e fatturazione:** rimandati dopo l'MVP.
- **Piano invece di previsione (11/10/2026):** il centro del prodotto è l'obiettivo e i conti per arrivarci, non gli scenari pessimista/base/ottimista. La proiezione "al ritmo attuale" resta come termine di confronto.
- **Stile:** tema scuro in nero/bianco/grigio, blu solo per i dettagli speciali, numeri monospace.
- **Obiettivo finale:** prodotto completo e pubblicato (account, cloud, connettore Stripe, landing, demo pubblica), anche come progetto da portfolio. Niente fase di test con utenti prima di completarlo.

## 8. Dati senza account (v1) e migrazione verso l'autenticazione

Nella v1 i dati restano **nel browser dell'utente** (IndexedDB). Per non dover riscrivere tutto quando arriva l'autenticazione:

- Tutta l'app legge e scrive tramite un'interfaccia di storage (`ProjectRepository`, `SnapshotRepository`…), mai direttamente da IndexedDB.
- v1: implementazione locale. Più avanti: implementazione server (Postgres), scambiabile senza toccare interfaccia e motore del piano.
- Gli ID sono UUID generati sul client, così i dati locali si possono caricare sul server senza conflitti.
- Alla registrazione: "importa i dati di questo browser nel tuo account".
- Da subito: **esporta/importa JSON**, perché i dati nel browser si possono perdere (cache cancellata, altro dispositivo) e va detto chiaramente all'utente.
- La tabella `user` e il campo `user_id` dei progetti restano nel modello, ma nella v1 non sono usati.

## 9. Dopo l'MVP: roadmap verso il prodotto completo

1. ~~Fondamenta~~ (CSV, tema chiaro, CI, test end-to-end e di accessibilità) ✓
2. ~~Account e cloud~~ (Supabase): login con link via email, Postgres con Row Level Security, implementazione cloud dello storage, "sposta i dati di questo browser nel tuo account" ✓
3. ~~Assistente AI a crediti~~ ✓ (sotto)
4. ~~Stripe~~: import dei dati da chiave in sola lettura e acquisto dei pacchetti di crediti (Checkout + webhook) ✓
5. **Presentazione**: ~~landing~~ ✓, ~~demo pubblica (`/demo`)~~ ✓, ~~README da portfolio~~ ✓; restano il nome definitivo e il deploy (servono gli account: vedi [setup.md](setup.md)).

Tutti i servizi esterni si accendono con le variabili d'ambiente; senza, l'app funziona come prima (dati nel browser).

**Semplificazione (11/10/2026).** L'interfaccia era troppo densa. Ora:
- la pagina del progetto risponde a tre domande in ordine: *dove sei*, *dove vuoi arrivare*, *cosa serve* (con i numeri "e se…" e costi/cassa); Overview e Plan sono una pagina sola, le schede sono Overview · Data · Settings;
- un nuovo progetto parte da un setup in 3 passi (nome, numeri dell'ultimo mese, obiettivo);
- "Aggiungi mese" è una finestra con 2 campi obbligatori, il resto opzionale;
- parole semplici ("monthly revenue", "customers who leave") con un "?" che spiega MRR, churn, runway;
- l'import mostra solo ciò che funziona: foglio di calcolo (CSV) e Stripe; il catalogo di fonti "in arrivo" è stato tolto.

## 10. Assistente AI a crediti (fase 3)

**Cosa fa.** Una chat nella pagina del progetto. Esempi: "cosa ne pensi del grafico?", "cosa frena la crescita?", "e se alzo il prezzo a 25 €?", "chi sono i miei competitor diretti con questo MRR?".

**Come funziona (onestà come nel resto del prodotto):**
- Il modello riceve i **dati** del progetto (mesi, obiettivo, leve, risultati del motore), non uno screenshot: più preciso e meno costoso.
- I conti non li fa il modello: ha uno **strumento `run_plan`** che chiama il nostro motore con leve diverse ("e se…?"), così i numeri della chat coincidono con quelli dell'app.
- Le domande sui competitor usano la **ricerca web con fonti citate**; senza fonti il modello non deve nominare concorrenti come fatti.
- L'interfaccia dice chiaramente che i dati del progetto vengono inviati al fornitore AI.

**Modello.** Claude Opus 5.5 (`claude-opus-5-5`, 4 $ / 20 $ per milione di token in ingresso/uscita al 10/2026). Prompt di sistema e dati del progetto in cache per abbassare il costo delle domande successive. Un modello più economico (Sonnet 5.5 / Haiku 5.5) è una scelta da fare dopo aver misurato qualità e margini.

**Crediti.**
- Si comprano a pacchetti (fase 4, Stripe Checkout). Alla registrazione un piccolo bonus gratuito per provare (10 crediti; utile anche per la demo).
- Prezzo per tipo di domanda, mostrato prima di inviare: domanda normale = 1 credito, domanda con ricerca web = più crediti. Limiti fissi per richiesta (token in uscita, numero di ricerche) così ogni domanda ha un costo massimo noto.
- Il prezzo dei crediti si fissa **dopo aver misurato** il costo reale medio per domanda (log di `usage` per ogni risposta), con un margine.
- **Registro crediti a movimenti** (`credit_ledger`: id, user_id, delta intero, motivo `signup_bonus` / `purchase` / `chat` / `refund`, riferimento, data). Il saldo è la somma. I crediti si **riservano** prima della chiamata e si **restituiscono** se la risposta fallisce.
- Lato server soltanto: chiave API mai nel browser, controllo del saldo e limite di richieste per utente.

**Nota fiscale.** Vendere crediti con soldi veri richiede una posizione fiscale (in Italia partita IVA) oppure un *merchant of record* (es. Paddle, Lemon Squeezy) che gestisce l'IVA europea. Per il portfolio basta Stripe in modalità test; il passaggio a pagamenti reali si decide prima del lancio.
