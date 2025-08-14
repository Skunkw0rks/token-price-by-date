import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function App() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedCoin, setSelectedCoin] = useState(null)
  const [date, setDate] = useState('') // yyyy-mm-dd
  const [currency, setCurrency] = useState('usd')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [rateInfo, setRateInfo] = useState({ limit: 20, remaining: null })

  const controllerRef = useRef(null)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery) { setSuggestions([]); return }
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    ;(async () => {
      try {
        const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(debouncedQuery)}`, { signal: controller.signal })
        if (!res.ok) throw new Error(`Search failed: ${res.status}`)
        const data = await res.json()
        const coins = (data?.coins ?? []).slice(0, 8)
        setSuggestions(coins)
      } catch (err) {
        if (err?.name !== 'AbortError') console.error(err)
      }
    })()
    return () => controller.abort()
  }, [debouncedQuery])

  function pickCoin(coin) {
    setSelectedCoin(coin)
    setQuery(`${coin.name} (${coin.symbol?.toUpperCase?.() || ''})`)
    setSuggestions([])
    setResult(null)
    setError('')
  }

  function daysBetween(aISO, bISO) {
    const a = new Date(aISO + 'T00:00:00Z')
    const b = new Date(bISO + 'T00:00:00Z')
    const ms = Math.abs(b - a)
    return Math.floor(ms / (1000*60*60*24))
  }
  function ddmmyyyyFromISO(iso) {
    try {
      const [y, m, d] = iso.split('-')
      if (!y || !m || !d) return ''
      return `${d}-${m}-${y}`
    } catch { return '' }
  }

  async function fetchPrice() {
    setError(''); setResult(null)
    if (!selectedCoin?.id) { setError('Please select a token from the suggestions.'); return }
    if (!date) { setError('Please choose a date.'); return }

    const todayISO = new Date().toISOString().slice(0,10)
    const ageDays = daysBetween(date, todayISO)
    setLoading(true)
    try {
      if (ageDays <= 365) {
        const dateParam = ddmmyyyyFromISO(date)
        const endpoint = `/coins/${encodeURIComponent(selectedCoin.id)}/history`
        const qs = new URLSearchParams({ date: dateParam, localization: 'false' })
        const res = await fetch(`/.netlify/functions/cg?endpoint=${encodeURIComponent(endpoint)}&${qs.toString()}`)
        const rl = readRateHeaders(res); setRateInfo(rl)
        if (!res.ok) throw new Error(`Price lookup failed: ${res.status}`)
        const data = await res.json()
        const price = data?.market_data?.current_price?.[currency]
        const mcap = data?.market_data?.market_cap?.[currency]
        const vol = data?.market_data?.total_volume?.[currency]
        if (price == null) throw new Error('Price not available for that token/date/currency.')
        setResult({
          price,
          mcap: mcap ?? null,
          vol: vol ?? null,
          image: data?.image?.small ?? selectedCoin?.thumb ?? null,
          name: data?.name ?? selectedCoin?.name,
          symbol: selectedCoin?.symbol?.toUpperCase?.() ?? '',
          date,
          currency,
          source: 'Recent (provider A)',
        })
      } else {
        const symbol = (selectedCoin?.symbol || '').toUpperCase()
        if (!symbol) throw new Error('Missing token symbol for historical lookup.')
        const qs = new URLSearchParams({ symbol, currency: currency.toUpperCase(), date })
        const res = await fetch(`/.netlify/functions/cc?${qs.toString()}`)
        const rl = readRateHeaders(res); setRateInfo(rl)
        if (!res.ok) {
          const t = await res.text()
          throw new Error(`Historical lookup failed: ${res.status} ${t}`)
        }
        const data = await res.json()
        setResult({
          price: data.price,
          mcap: null,
          vol: data.volume ?? null,
          image: selectedCoin?.thumb ?? null,
          name: selectedCoin?.name,
          symbol,
          date,
          currency,
          source: 'Archive (provider B)',
        })
      }
    } catch (err) {
      console.error(err)
      setError(err?.message || 'Something went wrong fetching the price.')
    } finally {
      setLoading(false)
    }
  }

  function pickQuick(coin) {
    setSelectedCoin(coin)
    setQuery(`${coin.name} (${coin.symbol})`)
    setSuggestions([])
    setResult(null)
    setError('')
  }

  const quickPicks = useMemo(() => [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'sui', name: 'Sui', symbol: 'SUI' },
    { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' },
  ], [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Token price on a specific date</h1>
          <p className="text-sm text-gray-600 mt-2">
            Search for a token, pick a date, and get the historical price.
          </p>
        </header>

        <div className="grid gap-6">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="sm:col-span-2 relative">
              <label className="block text-sm font-medium mb-1">Token</label>
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedCoin(null) }}
                placeholder="Try 'wal', 'sui', 'bitcoin'…"
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-2xl border border-gray-200 bg-white shadow-lg max-h-72 overflow-auto">
                  {suggestions.map((coin) => (
                    <button key={coin.id} onClick={() => pickCoin(coin)} className="w-full text-left px-4 py-2 hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {coin.thumb ? <img src={coin.thumb} alt="" className="w-5 h-5 rounded" /> : <div className="w-5 h-5 rounded bg-gray-200" />}
                        <div>
                          <div className="text-sm font-medium">{coin.name}</div>
                          <div className="text-xs text-gray-500">{coin.symbol?.toUpperCase?.()} · Rank {coin.market_cap_rank ?? '—'}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="rounded-2xl border border-gray-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {'usd,eur,gbp,aed,cad,aud,sgd,jpy,krw,inr'.split(',').map((c) => (
                <option key={c} value={c}>{c.toUpperCase()}</option>
              ))}
            </select>

            <div className="flex-1" />
            <div className="text-xs text-gray-500">
              {rateInfo.remaining != null && rateInfo.remaining >= 0 ? (
                <span>Requests today: {rateInfo.limit - rateInfo.remaining}/{rateInfo.limit} used · {rateInfo.remaining} left</span>
              ) : (
                <span>Daily limit: {rateInfo.limit}</span>
              )}
            </div>

            <button
              onClick={fetchPrice}
              disabled={loading}
              className="rounded-2xl bg-indigo-600 text-white px-5 py-2 font-medium shadow hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? 'Fetching…' : 'Get price'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <span className="text-xs text-gray-500">Quick picks:</span>
            {quickPicks.map((c) => (
              <button key={c.id} onClick={() => pickQuick(c)} className="rounded-full border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100">
                {c.name}
              </button>
            ))}
          </div>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}

          {result && (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {result.image ? <img src={result.image} alt="" className="w-8 h-8 rounded" /> : <div className="w-8 h-8 rounded bg-gray-200" />}
                <div className="text-lg font-semibold">
                  {result.name} ({result.symbol})
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 text-sm">
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-gray-500">Date</div>
                  <div className="font-medium">{new Date(result.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' })}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-gray-500">Price ({result.currency.toUpperCase()})</div>
                  <div className="font-semibold text-lg">{formatNumber(result.price)}</div>
                </div>
                <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-gray-500">Market Cap ({result.currency.toUpperCase()})</div>
                  <div className="font-medium">{result.mcap != null ? formatNumber(result.mcap) : '—'}</div>
                </div>
		  {/* <div className="rounded-xl bg-gray-50 p-4">
                  <div className="text-gray-500">Source</div>
                  <div className="font-medium">{result.source || '—'}</div>
                </div> */} 
                <div className="rounded-xl bg-gray-50 p-4 sm:col-span-3">
                  <div className="text-gray-500">24h Volume ({result.currency.toUpperCase()})</div>
                  <div className="font-medium">{result.vol != null ? formatNumber(result.vol) : '—'}</div>
                </div>
              </div>
            </div>
          )}

          <footer className="pt-6 text-xs text-gray-500">
            Prices are daily snapshopts in UTC. Tooling by ProdS3c, All rights reserved.  
          </footer>
        </div>
      </div>
    </div>
  )
}

{/* Thanks for using me any comments or suggestions email helloprods3c at gmail.com */}

function formatNumber(n) {
  try {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`
    if (n < 1 && n > 0) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(n)
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n)
  } catch { return String(n) }
}

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function readRateHeaders(res) {
  try {
    const limit = parseInt(res.headers.get('x-ratelimit-limit') || '20', 10)
    const remaining = parseInt(res.headers.get('x-ratelimit-remaining') || '-1', 10)
    return { limit, remaining }
  } catch { return { limit: 20, remaining: -1 } }
}
