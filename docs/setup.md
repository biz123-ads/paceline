# Configurare account, assistente AI e Stripe

Tutto è facoltativo. Senza nessuna chiave l'app funziona come prima: dati nel
browser, nessun account, nessun assistente. Ogni servizio si accende da solo
quando trova le sue variabili in `.env.local` (in locale) o nelle variabili
d'ambiente di Vercel (online). L'elenco completo è in [`.env.example`](../.env.example).

Per controllare cosa è acceso: apri `/api/status` (es. `http://localhost:3000/api/status`).

```bash
cp .env.example .env.local
```

Dopo ogni modifica a `.env.local` riavvia `npm run dev`.

---

## 1. Account e cloud: Supabase (gratis)

1. Crea un progetto su [supabase.com](https://supabase.com) (piano Free).
2. **SQL Editor → New query**: incolla tutto il contenuto di
   [`supabase/migrations/20261011000000_init.sql`](../supabase/migrations/20261011000000_init.sql)
   e premi **Run**. Crea le tabelle, le regole di sicurezza (ogni utente vede
   solo i suoi dati) e il registro dei crediti con 10 crediti di benvenuto.
3. **Authentication → URL Configuration**
   - *Site URL*: `http://localhost:3000` (poi l'indirizzo di Vercel).
   - *Redirect URLs*: aggiungi `http://localhost:3000/auth/confirm` (e poi
     `https://<tuo-dominio>/auth/confirm`).
4. **Consigliato – Authentication → Emails**: nei modelli *Magic Link* e
   *Confirm signup* sostituisci il link con
   ```
   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/projects
   ```
   Così il link funziona anche se lo apri su un altro dispositivo o browser.
   Con il modello predefinito funziona solo nello stesso browser.
5. **Project Settings → API Keys**: copia in `.env.local`
   - `NEXT_PUBLIC_SUPABASE_URL` → Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → publishable key (`sb_publishable_…`)
   - `SUPABASE_SECRET_KEY` → secret key (`sb_secret_…`). Mai con il prefisso
     `NEXT_PUBLIC_`: resta sul server.

Prova: vai su `/login`, inserisci la tua email, apri il link. Se avevi progetti
nel browser, la pagina Projects ti propone di spostarli nell'account.

> Le email di Supabase con il server SMTP incluso sono limitate a poche
> all'ora: va bene per provare. Per il lancio imposta un SMTP tuo
> (es. Resend) in *Authentication → Emails → SMTP Settings*.

## 2. Assistente AI: Anthropic

Serve anche Supabase (i crediti stanno lì).

1. Su [console.anthropic.com](https://console.anthropic.com) crea una API key.
2. In `.env.local`: `ANTHROPIC_API_KEY=sk-ant-…`
3. Consigliato: imposta un limite di spesa mensile nella console.

Il pulsante **Ask AI** compare nella pagina di ogni progetto. Ogni domanda
costa 1 credito (3 con la ricerca web); i crediti si riservano prima e tornano
indietro se la risposta fallisce. Il costo reale di ogni domanda (token, cache,
ricerche) finisce nella tabella `assistant_requests`: serve a fissare il prezzo
dei crediti in base ai dati veri. Modello: Claude Opus 5.5, con fallback
automatico in caso di rifiuto per sicurezza.

## 3. Vendita dei crediti: Stripe (modalità test)

1. Su [dashboard.stripe.com](https://dashboard.stripe.com), in **modalità test**,
   copia la *secret key* (`sk_test_…`) in `STRIPE_SECRET_KEY`.
2. Webhook in locale, con la [Stripe CLI](https://docs.stripe.com/stripe-cli):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   copia il `whsec_…` che stampa in `STRIPE_WEBHOOK_SECRET`.
3. In **Settings** dell'app compaiono i pacchetti di crediti. Paga con la carta
   di test `4242 4242 4242 4242`, una data futura e un CVC qualsiasi.

L'**import da Stripe** nella scheda Data non richiede niente di tutto questo:
l'utente incolla una sua chiave *restricted* con accesso in lettura a
*Subscriptions*, usata una volta e mai salvata. Per provarlo crea qualche
abbonamento di test nel tuo account Stripe.

> Vendere crediti con soldi veri richiede una posizione fiscale (in Italia
> partita IVA) oppure un *merchant of record* (Paddle, Lemon Squeezy). Per il
> portfolio basta la modalità test.

## 4. Online: Vercel

1. Pubblica il repository su GitHub.
2. Su [vercel.com](https://vercel.com) → *Add New → Project* → importa il
   repository (Next.js viene riconosciuto da solo).
3. In *Settings → Environment Variables* aggiungi le stesse variabili di
   `.env.local`, poi *Redeploy*.
4. Aggiorna gli indirizzi:
   - Supabase → *Site URL* e *Redirect URLs* con il dominio Vercel.
   - Stripe → *Developers → Webhooks → Add endpoint*:
     `https://<tuo-dominio>/api/stripe/webhook`, eventi
     `checkout.session.completed` e `checkout.session.async_payment_succeeded`;
     copia il nuovo *signing secret* in `STRIPE_WEBHOOK_SECRET` su Vercel.
