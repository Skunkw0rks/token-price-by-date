// netlify/functions/cg.js
// A simple GET-only proxy that injects a CoinGecko API key from env vars.
// Supports both Demo and Pro keys. Do NOT expose your key in the browser.
// Usage from client: /.netlify/functions/cg?endpoint=/coins/bitcoin/history&date=02-06-2025&localization=false&currency=usd
// The function constructs: https://api.coingecko.com/api/v3 + endpoint + query and adds the header.
// If PRO key is present, it will use the Pro API domain instead.

export async function handler(event, _context) {
  try {
    if (event.httpMethod !== "GET") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const params = new URLSearchParams(event.queryStringParameters || {});
    const endpoint = params.get("endpoint"); // must start with "/"
    if (!endpoint || !endpoint.startsWith("/")) {
      return { statusCode: 400, body: "Missing or invalid 'endpoint' parameter" };
    }

    // pull and remove internal params
    params.delete("endpoint");
    const currency = params.get("currency"); // optional, pass-through
    // Decide which base URL and header to use
    const PRO_KEY = process.env.CG_PRO_API_KEY;
    const DEMO_KEY = process.env.CG_DEMO_API_KEY;

    let base = "https://api.coingecko.com/api/v3";
    let authHeaderName = "x-cg-demo-api-key";
    let authKey = DEMO_KEY || "";

    if (PRO_KEY) {
      base = "https://pro-api.coingecko.com/api/v3";
      authHeaderName = "x-cg-pro-api-key";
      authKey = PRO_KEY;
    } else if (!DEMO_KEY) {
      return { statusCode: 500, body: "Server missing CoinGecko API key (CG_DEMO_API_KEY or CG_PRO_API_KEY)" };
    }

    const url = `${base}${endpoint}?${params.toString()}`;

    const res = await fetch(url, {
      headers: { [authHeaderName]: authKey },
    });

    const text = await res.text();
    return {
      statusCode: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Cache-Control": "public, max-age=60",
      },
      body: text,
    };
  } catch (err) {
    return { statusCode: 500, body: `Proxy error: ${err.message}` };
  }
}
