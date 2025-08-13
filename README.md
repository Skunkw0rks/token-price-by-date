# Token Price by Date (Netlify + Vite + React + Tailwind)

Single‑page app to fetch a token’s price for a chosen date. It auto‑selects the data source:
- **Recent (≤ 12 months):** provider A via `/.netlify/functions/cg`
- **Archive (> 12 months):** provider B via `/.netlify/functions/cc`

Also includes a **20 requests/day per‑IP** rate limit, surfaced in the UI.

## Local dev
```bash
npm i
npm run dev
```
Note: Functions require env vars—run with Netlify CLI to load them locally:
```bash
npm i -g netlify-cli
netlify dev
```

## Deploy to Netlify
1. Push to a Git repo.
2. In Netlify: New site from Git → pick repo.
3. Build: `npm run build`  |  Publish: `dist`
4. Add environment variables:
   - `CG_DEMO_API_KEY` **or** `CG_PRO_API_KEY`
   - `CRYPTOCOMPARE_API_KEY`

## Notes
- Dates are treated as UTC; values are daily snapshots.
- The on‑page counter reads response headers (`X-RateLimit-*`) from the functions.
