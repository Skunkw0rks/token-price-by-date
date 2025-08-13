# Token Price by Date (Netlify + Vite + React + Tailwind)

Single‑page app to fetch a token’s price for a chosen date. It auto‑selects the data source:
- **Recent (≤ 12 months):** provider A via `/.netlify/functions/cg`
- **Archive (> 12 months):** provider B via `/.netlify/functions/cc`

Also includes a **20 requests/day per‑IP** rate limit, surfaced in the UI.


