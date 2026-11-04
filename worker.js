// Serves the static game; only /api/weather and room links (/r/:code) run code.
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/api/weather') return weather(req);
    if (url.pathname.startsWith('/r/')) return env.ASSETS.fetch(new Request(new URL('/', url), req));
    return env.ASSETS.fetch(req);
  },
};

// What the sky is doing where the visitor is, as one word, and whether it is windy. The rough place comes from the
// network (Cloudflare's IP lookup), rounded to half a degree before it is sent to Open-Meteo; nothing is stored.
async function weather(req) {
  const json = (o) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' } });
  const lat = parseFloat(req.cf?.latitude), lon = parseFloat(req.cf?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ sky: 'clear', wind: false, known: false });
  const round = (v) => (Math.round(v * 2) / 2).toFixed(1);
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${round(lat)}&longitude=${round(lon)}&current=weather_code,wind_speed_10m`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(String(r.status));
    const c = (await r.json()).current || {};
    const w = Number(c.weather_code);
    const sky = w >= 95 ? 'storm' : (w >= 71 && w <= 77) || w === 85 || w === 86 ? 'snow' : (w >= 61 && w <= 67) || (w >= 80 && w <= 82) ? 'rain'
      : w >= 51 && w <= 57 ? 'drizzle' : w === 45 || w === 48 ? 'fog' : w >= 1 && w <= 3 ? 'cloud' : 'clear';
    return json({ sky, wind: Number(c.wind_speed_10m) >= 28, known: true });
  } catch {
    return json({ sky: 'clear', wind: false, known: false });
  }
}
