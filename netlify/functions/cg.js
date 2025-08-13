// netlify/functions/cg.js
// Proxy for recent historical price lookups (provider A).
// Env: CG_DEMO_API_KEY or CG_PRO_API_KEY

const RATE_LIMIT = 20;
const bucket = new Map(); // key: `${ip}|${YYYY-MM-DD}` -> count

function getClientIP(event) {
  const h = event.headers || {};
  return (
    h["x-nf-client-connection-ip"] ||
    (h["x-forwarded-for"] || "").split(",")[0].trim() ||
    h["client-ip"] ||
    h["x-real-ip"] ||
    "unknown"
  );
}
function todayKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}`;
}
function checkRateLimit(event) {
  const ip = getClientIP(event);
  const key = `${ip}|${todayKey()}`;
  const count = bucket.get(key) || 0;
  if (count >= RATE_LIMIT) return { ok: false, ip, count };
  bucket.set(key, count + 1);
  return { ok: true, ip, count: count + 1 };
}
function rateHeaders(info) {
  const remaining = Math.max(0, RATE_LIMIT - (info?.count || 0));
  return { "X-RateLimit-Limit": String(RATE_LIMIT), "X-RateLimit-Remaining": String(remaining) };
}

export async function handler(event, _context) {
  try {
    if (event.httpMethod !== "GET") {
      const rl = { count: 0 };
      return { statusCode: 405, headers: rateHeaders(rl), body: "Method Not Allowed" };
    }

    const rl = checkRateLimit(event);
    if (!rl.ok) return { statusCode: 429, headers: rateHeaders(rl), body: JSON.stringify({ error: "Daily limit reached (20 per IP). Try again tomorrow." }) };

    const params = new URLSearchParams(event.queryStringParameters || {});
    const endpoint = params.get("endpoint");
    if (!endpoint || !endpoint.startsWith("/")) {
      return { statusCode: 400, headers: rateHeaders(rl), body: "Missing or invalid 'endpoint' parameter" };
    }
    params.delete("endpoint");

    const PRO_KEY = process.env.CG_PRO_API_KEY;
    const DEMO_KEY = process.env.CG_DEMO_API_KEY;

    let base = "https://api.coingecko.com/api/v3";
    let headerName = "x-cg-demo-api-key";
    let key = DEMO_KEY || "";

    if (PRO_KEY) {
      base = "https://pro-api.coingecko.com/api/v3";
      headerName = "x-cg-pro-api-key";
      key = PRO_KEY;
    } else if (!DEMO_KEY) {
      return { statusCode: 500, headers: rateHeaders(rl), body: "Server missing API key (CG_DEMO_API_KEY or CG_PRO_API_KEY)" };
    }

    const url = `${base}${endpoint}?${params.toString()}`;
    const res = await fetch(url, { headers: { [headerName]: key } });
    const text = await res.text();

    return {
      statusCode: res.status,
      headers: { "Content-Type": res.headers.get("content-type") || "application/json", "Cache-Control": "public, max-age=60", ...rateHeaders(rl) },
      body: text,
    };
  } catch (err) {
    const rl = { count: 0 };
    return { statusCode: 500, headers: rateHeaders(rl), body: `Proxy error: ${err.message}` };
  }
}
