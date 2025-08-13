// netlify/functions/cc.js
// Proxy for older historical daily OHLC (provider B).
// Env: CRYPTOCOMPARE_API_KEY

const RATE_LIMIT = 20;
const bucket = new Map();

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
    const symbol = (params.get("symbol") || "").toUpperCase();
    const currency = (params.get("currency") || "USD").toUpperCase();
    const date = params.get("date"); // YYYY-MM-DD

    if (!symbol || !date) return { statusCode: 400, headers: rateHeaders(rl), body: "Missing 'symbol' and/or 'date' (YYYY-MM-DD)" };

    const apiKey = process.env.CRYPTOCOMPARE_API_KEY;
    if (!apiKey) return { statusCode: 500, headers: rateHeaders(rl), body: "Server missing CRYPTOCOMPARE_API_KEY" };

    const toTs = Math.floor(new Date(date + "T23:59:59Z").getTime() / 1000);
    const url = `https://min-api.cryptocompare.com/data/v2/histoday?fsym=${encodeURIComponent(symbol)}&tsym=${encodeURIComponent(currency)}&toTs=${toTs}&limit=1`;

    const res = await fetch(url, { headers: { Authorization: `Apikey ${apiKey}` } });
    const data = await res.json();

    if (!res.ok) return { statusCode: res.status, headers: rateHeaders(rl), body: JSON.stringify({ error: data?.Message || "CryptoCompare error" }) };

    const candles = data?.Data?.Data;
    if (!Array.isArray(candles) || candles.length === 0) {
      return { statusCode: 404, headers: rateHeaders(rl), body: JSON.stringify({ error: "No historical data found" }) };
    }

    const targetMidnight = Math.floor(new Date(date + "T00:00:00Z").getTime() / 1000);
    let match = candles.find(c => c.time === targetMidnight) || candles[candles.length - 1];

    const result = {
      price: match.close,
      ohlc: { open: match.open, high: match.high, low: match.low, close: match.close },
      volume: match.volumeto ?? null,
      source: "CryptoCompare",
      dateUtc: date,
      symbol,
      currency,
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60", ...rateHeaders(rl) },
      body: JSON.stringify(result),
    };
  } catch (err) {
    const rl = { count: 0 };
    return { statusCode: 500, headers: rateHeaders(rl), body: `Proxy error: ${err.message}` };
  }
}
