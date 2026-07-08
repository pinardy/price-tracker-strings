# String Price Tracker 🎻

A local web app that tracks prices of strings for bowed instruments (violin, viola, cello, double bass) across multiple retailers and marketplaces, with price history charts, cross-retailer comparison in SGD, a watchlist, and price-drop alerts.

## Data sources

| Source | How | Currency | Auth |
|---|---|---|---|
| Fiddlershop | Shopify storefront JSON (`/products/<handle>.js`) | USD | none |
| Shar Music | Shopify storefront JSON | USD | none |
| Gramercy Music (SG) | Shopify storefront JSON | SGD | none |
| Thomann | server-rendered microdata (`itemprop="price"`) | varies by IP | none |
| Southwest Strings | WooCommerce Store API, JSON-LD fallback | USD | none |
| Synwin Music (SG) | WooCommerce Store API, JSON-LD fallback | SGD | none |
| LVL Music Academy (SG) | WooCommerce Store API, JSON-LD fallback | SGD | none |
| Reverb | official API — tracks the *lowest live listing* for a stored search query | USD | free personal token |

Every snapshot stores the shop's native price **plus a normalized `price_sgd`** captured with
that day's ECB reference rate (via the free [frankfurter.dev](https://frankfurter.dev) API, no
key). Comparison, charts, targets, and alerts all work in SGD; overseas prices display as
"S$… · US$…". WooCommerce *variable* products are tracked at the **variation** level because
the parent product reports only the minimum of its price range (a lone E string, not the set).
A paid Amazon provider (Rainforest/Keepa) can be added later as one module in
`server/src/providers/` plus one registry line.

## Setup

```bash
npm install
npm run seed      # optional: starter catalog of 21 tracked strings with verified store links
cp .env.example .env
npm run dev       # server on :3001, app on http://localhost:5173
```

### Enabling Reverb (optional)

1. Create a token at reverb.com → **My Profile → API & Integrations → Generate New Token** (only the `public` scope is needed).
2. Put it in `.env` as `REVERB_TOKEN=...` and restart. Without a token the Reverb source simply doesn't appear.

## How it works

- **Watchlist**: you create a product ("Evah Pirazzi Gold violin set, 4/4 medium"), then attach the exact matching listing on each source via the built-in search. No fuzzy matching — you confirm each link once, and fetches stay precise forever.
- **Fetching**: a daily cron (default 08:00, `FETCH_CRON` in `.env`) plus a catch-up run on server start if the last fetch is >20h old, plus a manual *Refresh prices* button. Requests are throttled to one per host per 1.5s with an identifying User-Agent.
- **Alerts**: set a target price in SGD on a product; when any source's converted price hits it, an alert appears in the app (deduped until you acknowledge it).

## Commands

```bash
npm run dev     # server + client with hot reload
npm test        # provider parser tests against saved fixtures
npm run smoke   # one live search + price fetch per enabled provider
npm run seed    # idempotent starter catalog
```

## Free hosting on GitHub Pages

The repo ships a workflow (`.github/workflows/pages.yml`) that turns GitHub into the backend:
every day (and on manual dispatch) an Action runs the price fetch, commits the updated
`server/data/app.db`, exports the data as JSON, and deploys a **read-only static build** of the
app to GitHub Pages. Watchlist management stays in the local app — commit and push after
changing it, and the next run publishes the update.

One-time setup on a **public** repo:

1. Push this repo to GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. (Optional) Add `REVERB_TOKEN` under Settings → Secrets → Actions.
4. Run the workflow once from the Actions tab; the site appears at `https://<user>.github.io/<repo>/`.

To test the static build locally:

```bash
npm run export:static -w server
VITE_STATIC=1 VITE_BASE=/price-tracker-strings/ npm run build -w client
cd client && VITE_BASE=/price-tracker-strings/ npx vite preview
```

## Notes & etiquette

- The DB is a single SQLite file at `server/data/app.db` (WAL mode). Back it up by copying the file.
- Scraping is polite (serial per host, delays, retries with backoff) and low-volume (one request per tracked link per day). Reverb's ToS asks that listing data link back to reverb.com — the UI does.
- Store titles are captured when you link a product; if a store restructures a page the fetch run logs an error for that link (visible in the header status bar) and you can re-attach it via search.
