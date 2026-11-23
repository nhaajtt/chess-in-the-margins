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
// A half-degree square's sky (not any visitor's) is remembered in memory for ten minutes to spare the weather service.
const TTL = 10 * 60 * 1000, FAIL_TTL = 60 * 1000, MAX_CELLS = 256, MAX_BYTES = 16 * 1024;
const CLEAR = { sky: 'clear', wind: false, known: false };
const cells = new Map(); // "lat,lon" -> { at, ttl, out }
const skyOf = (w) => w >= 95 ? 'storm' : (w >= 71 && w <= 77) || w === 85 || w === 86 ? 'snow' : (w >= 61 && w <= 67) || (w >= 80 && w <= 82) ? 'rain'
  : w >= 51 && w <= 57 ? 'drizzle' : w === 45 || w === 48 ? 'fog' : w >= 1 && w <= 3 ? 'cloud' : 'clear';
// only a whole weather code and a sensible wind speed are believed; anything else counts as no answer
function checked(j) {
  const c = j && typeof j === 'object' ? j.current : null;
  if (!c || typeof c !== 'object') return null;
  const code = c.weather_code, speed = c.wind_speed_10m;
  if (!Number.isInteger(code) || code < 0 || code > 99) return null;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0 || speed > 500) return null;
  return { sky: skyOf(code), wind: speed >= 28, known: true };
}
async function lookup(lat, lon) {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,wind_speed_10m`, { signal: AbortSignal.timeout(3000), redirect: 'error', headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(String(r.status));
  if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) throw new Error('too big');
  const text = await r.text();
  if (text.length > MAX_BYTES) throw new Error('too big');
  const out = checked(JSON.parse(text));
  if (!out) throw new Error('odd answer');
  return out;
}
async function weather(req) {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' };
  const json = (o, cache, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...headers, 'cache-control': cache, ...extra } });
  if (req.method !== 'GET' && req.method !== 'HEAD') return json({ error: 'use GET' }, 'no-store', 405, { allow: 'GET, HEAD' });
  const lat = Number(req.cf?.latitude), lon = Number(req.cf?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json(CLEAR, 'private, no-store');
  const half = (v) => (Math.round(v * 2) / 2 + 0).toFixed(1).replace(/^-0.0$/, '0.0');
  const key = `${half(lat)},${half(lon)}`;
  let hit = cells.get(key);
  if (!hit || Date.now() - hit.at > hit.ttl) {
    cells.delete(key);
    let out = CLEAR, ttl = FAIL_TTL;
    try { out = await lookup(half(lat), half(lon)); ttl = TTL; } catch { /* the sky stays clear for a minute */ }
    if (cells.size >= MAX_CELLS) cells.delete(cells.keys().next().value);
    hit = { at: Date.now(), ttl, out };
    cells.set(key, hit);
  }
  return json(hit.out, hit.out.known ? 'private, max-age=600' : 'private, no-store');
}
