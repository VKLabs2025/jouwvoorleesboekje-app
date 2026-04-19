# Jouw Voorleesboekje — MVP

AI-gegenereerde, gepersonaliseerde Nederlandse voorleesboekjes (PDF, €4,95) waarin het kind de held is. Werkend MVP met OpenAI (tekst + illustraties), Mollie iDEAL en Resend mail.

**Domein**: jouwvoorleesboekje.nl
**Stack**: Node.js · Express · SQLite (better-sqlite3) · PDFKit · vanilla SPA (geen framework)

---

## Wat kan het?

1. Ouder doorloopt een 4-stapsflow (leeftijd → thema → gegevens kind → controle)
2. Form-inhoud wordt gemodereerd (NL-blocklist + OpenAI Moderation)
3. Betaling via Mollie iDEAL sandbox (`test_…` key)
4. Na betaling genereert de pipeline:
   - een Nederlandse story met **GPT-4o** (karakterblad + 6–8 pagina's JSON)
   - per pagina een **warme waterverf-illustratie** met `gpt-image-1`, met auto-fallback naar `dall-e-3` bij safety-blocks
   - een A5-landschap PDF met cover, pagina's (links beeld, rechts tekst), colofon
5. PDF wordt gemaild via Resend (met preview-mode als fallback) en is downloadbaar via tijdelijke link
6. Auto-delete regels: kindgegevens na 72u, PDFs na 30d, facturen bewaard 7j

---

## Lokaal draaien

```bash
cd jouwvoorleesboekje-app
npm install            # 214 packages
cp .env.example .env.local   # vul keys in
node server/index.js   # luistert op :8000
open http://localhost:8000
```

### Env-variabelen

| Variabele                   | Verplicht | Toelichting                                                   |
| --------------------------- | --------- | ------------------------------------------------------------- |
| `OPENAI_API_KEY`            | Ja        | Voor moderation, GPT-4o en image-gen. Alleen server-side.     |
| `MOLLIE_API_KEY`            | Ja        | `test_…` of `live_…`. Ontbreekt → mock-betaalpagina.          |
| `RESEND_API_KEY`            | Optioneel | Ontbreekt → mail-preview in `logs/mail.log`.                  |
| `RESEND_DOMAIN_VERIFIED`    | `false`   | `false` → stuurt vanaf `onboarding@resend.dev`.               |
| `MAIL_FROM`                 | Optioneel | Default `"Jouw Voorleesboekje <noreply@jouwvoorleesboekje.nl>"` |
| `ADMIN_PASSWORD`            | Optioneel | Default `"testtest"`. Loginmuur voor `/admin`.                |
| `APP_BASE_URL`              | Optioneel | Voor downloadlinks in mail. Default `http://localhost:8000`.  |
| `PORT`                      | Optioneel | Default 8000.                                                 |

### Nuttige scripts

```bash
# End-to-end test met 1 sample order (schrijft naar tmp/)
node server/scripts/test-pipeline.js

# 3 voorbeeldboekjes genereren in public/examples/
node server/scripts/seed-examples.js

# Losse image-test
node server/scripts/test-image.js

# Mollie-sandbox order simuleren
node server/scripts/test-mollie.js
```

### iDEAL-flow lokaal testen

Mollie vereist een publieke webhook-URL. Lokaal kun je dus niet het echte `paid`-event ontvangen. Gebruik `/api/admin/simulate-paid/:id`:

```bash
# Na het aanmaken van een order via de UI (die blijft in state "payment_pending"):
curl -XPOST 'http://localhost:8000/api/admin/simulate-paid/<orderId>?pw=testtest'
```

De pipeline start dan alsof Mollie zojuist een paid-webhook had afgevuurd. Voor echte iDEAL-testen: deploy de backend naar een publieke URL of gebruik `ngrok http 8000` en zet `APP_BASE_URL=https://<tunnel>.ngrok.io` in `.env.local`.

---

## Auto-delete (productie)

Alle data-expiratie is idempotent in de admin-endpoint:

```bash
curl -XPOST 'http://localhost:8000/api/admin/cleanup?pw=testtest'
```

In productie: zet deze in een cron (bv. hourly):

```
0 * * * * curl -s -XPOST "https://jouwvoorleesboekje.nl/api/admin/cleanup?pw=$ADMIN_PASSWORD"
```

De cleanup verwijdert:
- `orders.child_*` kolommen en `tmp/orders/<id>/` afbeeldingen na 72u
- `tmp/pdfs/<id>.pdf` na 30d (de order-row blijft bestaan als factuurrecord)
- niets na factuur-bewaartermijn (7j wordt handmatig aangestuurd)

---

## Kosten per boekje

| Onderdeel                                    | Hoeveelheid | Prijs    |
| -------------------------------------------- | ----------- | -------- |
| GPT-4o verhaal (≈ 3k in + 2k out tokens)     | 1           | ~$0.03   |
| `dall-e-3` standard 1024×1024 illustraties   | 6–8         | $0.24-0.32 |
| Moderation (gratis)                          | 1           | $0.00    |
| **OpenAI-kosten per boekje**                 |             | **≈ €0.28–€0.33** |
| Mollie iDEAL (sandbox gratis, live €0.29)    | 1           | €0.29    |
| Resend mail (gratis tot 3.000/maand)         | 1           | €0.00    |
| **Totaal marginal COGS**                     |             | **≈ €0.55–€0.65** |

Bij €4,95 incl. 21 % btw = €4,09 ex btw. **Bruto marge ≈ €3,45–€3,55 per boekje.**

---

## Architectuur

```
browser (SPA)                         server (:8000)
─────────────                         ──────────────
public/index.html      ──GET /──►   express static public/
public/app.js          ──POST────►   /api/orders
                                     /api/orders/:id/moderate
                                     /api/orders/:id/payment
                       ◄── 302 ──   Mollie checkout URL
Mollie hosted checkout
                       ──webhook─►   /api/webhooks/mollie
                                     ──► runPipeline(id)
                                         ├─ OpenAI chat (GPT-4o) → JSON story
                                         ├─ OpenAI image (gpt-image-1 / dall-e-3) x7
                                         ├─ PDFKit → tmp/pdfs/<id>.pdf
                                         └─ Resend email met downloadlink
browser                ──GET /api/orders/:id/status──►
                       ◄── paid/pdfUrl ──
browser                ──GET /api/orders/:id/pdf──► stream
```

Belangrijke bestanden:
- `server/index.js` — routes
- `server/lib/generation-pipeline.js` — orchestrator (tekst → images → PDF → mail)
- `server/lib/story-generator.js` — GPT-4o system prompt (NL), json_object response
- `server/lib/image-generator.js` — sanitizer + auto-fallback naar dall-e-3
- `server/lib/pdf-builder.js` — PDFKit A5 landschap
- `server/lib/moderation.js` — OpenAI Moderation + NL-blocklist
- `server/lib/blocklist.js` — categorieën: geweld, angst, religie_politiek, merken, medisch
- `server/lib/db.js` — SQLite schema + migraties

---

## Veiligheid & privacy

- **OpenAI-key alleen server-side** — nooit in client-bundle
- **Input-moderatie**: elke naam/thema/hobby/etc. door OpenAI Moderation + NL-blocklist
- **Output-check**: na GPT-4o wordt de volledige story opnieuw gemodereerd; max 2× regenereren
- **Geen foto's, geen account** — alleen tekst-input
- **AI-disclosure** zichtbaar in elke footer ("Verhalen en illustraties worden met AI gegenereerd en automatisch gecontroleerd op kindveiligheid.")
- **Auto-delete** zoals beschreven boven

---

## Productie-checklist

- [ ] `RESEND_DOMAIN_VERIFIED=true` zetten zodra `jouwvoorleesboekje.nl` in Resend is gevalideerd
- [ ] `MOLLIE_API_KEY` vervangen door `live_…` key
- [ ] `ADMIN_PASSWORD` naar een sterke random string
- [ ] `APP_BASE_URL=https://jouwvoorleesboekje.nl`
- [ ] cron voor `/api/admin/cleanup` instellen (zie boven)
- [ ] HTTPS-terminator (reverse proxy, Vercel, Fly.io, …) met Mollie-webhook URL ingevuld
- [ ] tmp-volume persisteren (of naar S3 verplaatsen bij schaal)

---

## Admin-dashboard

`/#/admin` — login met `ADMIN_PASSWORD`. Toont laatste orders, status, pipeline-log. Endpoints:

- `GET /api/admin/orders` — laatste 50
- `GET /api/admin/stats` — dagelijks totalen + errorrate
- `POST /api/admin/run-pipeline/:id` — handmatig opnieuw genereren
- `POST /api/admin/simulate-paid/:id` — lokaal betalen simuleren (ook zonder Mollie-webhook)
- `POST /api/admin/force-error/:id` — forceer een fout-flow voor testing
- `POST /api/admin/cleanup` — draai auto-delete nu
- `POST /api/admin/test-email` — stuur test-mail

Alle admin-endpoints beveiligd via `?pw=` query param of `x-admin-pw` header.
