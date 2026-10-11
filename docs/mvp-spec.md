# MVP – Tracker di progetto con previsioni

Bozza v0.1 – da discutere. Nome del progetto: da decidere.

## 1. Obiettivo dell'MVP

Una persona con un SaaS/app/side project può:
1. creare una **scheda progetto** con caratteristiche e dettagli;
2. inserire **a mano** i numeri mensili (MRR, clienti, costi);
3. vedere un **grafico** dell'andamento;
4. vedere una **previsione a scenari** (pessimista / base / ottimista) con runway, pareggio e tempo stimato per raggiungere una soglia.

**Fuori dall'MVP** (di proposito): import CSV/Excel, Google Sheets, connettori Stripe/RevenueCat, pagamenti, team, pagine pubbliche, widget, notifiche.

**Come capiamo se funziona:** le persone tornano la settimana dopo, inseriscono almeno 3 mesi di dati e cambiano le ipotesi di uno scenario.

## 2. Principi

- **Modello dati unico, indipendente dalla fonte.** Manuale, CSV o Stripe scrivono tutti nella stessa tabella delle metriche. Aggiungere una fonte più avanti non cambia il resto.
- **Granularità mensile.** Più semplice degli eventi, sufficiente per le previsioni. Gli eventi (come i webhook di RevenueCat) si potranno aggiungere in un secondo momento e aggregare in snapshot mensili.
- **Si salva il dato, si calcola il resto.** Le previsioni e le metriche derivate (crescita, churn, runway) non si memorizzano: sono funzioni dei dati.
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
| period | primo giorno del mese, es. `2026-10-01`. **Unico per progetto** |
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

### `scenario`
| campo | note |
|---|---|
| id | |
| project_id | |
| kind | `pessimista` / `base` / `ottimista` |
| monthly_growth_rate | crescita nuovi ricavi, % |
| monthly_churn_rate | % di MRR perso ogni mese |
| monthly_costs | centesimi |
| horizon_months | es. 12 o 24 |

Alla prima apertura i valori sono **precompilati dalla storia** (media degli ultimi 3-6 mesi per il base; pessimista e ottimista come variazioni del base) e l'utente li può modificare.

### `milestone`
| campo | note |
|---|---|
| id | |
| project_id | |
| label | es. "Arrivare a 1.000 € di MRR" |
| target_mrr | centesimi |

Il tempo stimato per raggiungerla si calcola dallo scenario, non si salva.

### Più avanti (non ora)
`data_import` (file, mappatura colonne, stato), `connection` (credenziali cifrate per Stripe/RevenueCat), `plan` / `billing_period` (importo mensile calcolato dall'MRR, per Stripe).

## 4. Motore di previsione (versione semplice)

Per ogni mese futuro:

```
MRR(t+1) = MRR(t) × (1 − churn) + nuovo_MRR(t)
nuovo_MRR(t) = MRR(t) × crescita        (modello percentuale, MVP)
```

Output per scenario:
- curva dell'MRR sull'orizzonte scelto;
- **runway** = cassa / (costi − ricavi) se si è in perdita, altrimenti "in utile";
- **mese di pareggio** (ricavi ≥ costi);
- **mesi per raggiungere ogni milestone**.

Regole di onestà:
- con **meno di 3 mesi di storia** mostrare un avviso ("previsione indicativa, pochi dati");
- mostrare sempre **tre scenari**, mai un solo numero;
- le ipotesi sono sempre visibili e modificabili.

Il motore è una **funzione pura** (dati e ipotesi in ingresso, curve in uscita) con test automatici. È la parte più importante da fare bene.

## 5. Schermate

1. **Elenco progetti**: card con nome, fase e MRR attuale.
2. **Scheda progetto**: dettagli, KPI (MRR, crescita, clienti, runway), grafico.
3. **Inserimento dati**: tabella mensile in stile foglio di calcolo, con aggiunta rapida del mese corrente.
4. **Previsioni**: tre scenari sul grafico, ipotesi modificabili, milestone.
5. **Impostazioni** account.

## 6. Ordine di lavoro

1. Modello dati e database.
2. Motore di previsione con test (prima dell'interfaccia).
3. Inserimento dati e scheda progetto.
4. Grafico dell'andamento.
5. Schermata delle previsioni.
6. Prova con 5-10 persone reali.

## 7. Decisioni prese

- **Piattaforma:** web app.
- **Stack:** Next.js + TypeScript (database/Supabase solo quando arriva l'autenticazione).
- **Lingua del prodotto:** inglese.
- **Account:** nessuna registrazione nella v1. Autenticazione prevista circa un mese dopo il lancio dell'MVP.
- **Prezzi e fatturazione:** rimandati dopo l'MVP.

## 8. Dati senza account (v1) e migrazione verso l'autenticazione

Nella v1 i dati restano **nel browser dell'utente** (IndexedDB). Per non dover riscrivere tutto quando arriva l'autenticazione:

- Tutta l'app legge e scrive tramite un'interfaccia di storage (`ProjectRepository`, `SnapshotRepository`…), mai direttamente da IndexedDB.
- v1: implementazione locale. Più avanti: implementazione server (Postgres), scambiabile senza toccare interfaccia e motore di previsione.
- Gli ID sono UUID generati sul client, così i dati locali si possono caricare sul server senza conflitti.
- Alla registrazione: "importa i dati di questo browser nel tuo account".
- Da subito: **esporta/importa JSON**, perché i dati nel browser si possono perdere (cache cancellata, altro dispositivo) e va detto chiaramente all'utente.
- La tabella `user` e il campo `user_id` dei progetti restano nel modello, ma nella v1 non sono usati.
