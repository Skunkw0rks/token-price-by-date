# Token Price by Date (Netlify + Vite + React + Tailwind)

A minimal single-page app that lets a user search a token (via CoinGecko search), pick a date, and retrieve the historical price snapshot for that date — all client-side, no API key required.

## Local dev
```bash
npm i
npm run dev
```
Open the local URL Vite prints (usually http://localhost:5173).

## Deploy to Netlify
1. Push this folder to a Git repository (GitHub, GitLab, etc.).
2. In Netlify: **New site from Git** → pick repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Deploy!

The included `netlify.toml` handles SPA fallback and useful security headers.

## Notes
- CoinGecko `/coins/{id}/history` expects date as **DD-MM-YYYY**; the UI converts from the date picker format.
- Historical values are *daily snapshots* and may reflect UTC.
- If you know the CoinGecko ID for WAL, add to the `quickPicks` array in `src/App.jsx`.

## Customize
- Tailwind is wired via `src/index.css` and `tailwind.config.js`.
- If you later need to hide an API key or add server logic, add a Netlify Function and call it from the client.

## Troubleshooting

- **Missing @vitejs/plugin-react**: Install it
  ```bash
  npm i -D @vitejs/plugin-react
  ```
- **Node version**: Vite 5 requires Node >= 18. Check with `node -v`. If needed, upgrade to Node 20 LTS.
- If issues persist, try a clean install:
  ```bash
  rm -rf node_modules package-lock.json
  npm i
  ```


## Secure key setup (recommended)
Use the included Netlify Function (`netlify/functions/cg.js`) so your API key stays server-side.

1) In Netlify → Site settings → Environment variables, add one of:
   - `CG_DEMO_API_KEY`  (for the free Demo API at api.coingecko.com)
   - `CG_PRO_API_KEY`   (for paid Pro API at pro-api.coingecko.com)

2) Update the client fetch to call the function instead of hitting CoinGecko directly:
   ```js
   // example:
   const endpoint = `/coins/${coinId}/history`;
   const qs = new URLSearchParams({ date: '02-06-2025', localization: 'false' });
   const res = await fetch(`/.netlify/functions/cg?endpoint=${encodeURIComponent(endpoint)}&${qs.toString()}`);
   ```

3) Redeploy. The function will inject the correct header and return the JSON.
