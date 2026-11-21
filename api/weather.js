// What the sky is doing where the visitor is, as one word: clear, cloud, fog, drizzle, rain, storm or snow, and
// whether it is windy. The rough place comes from the network (Vercel's IP lookup), rounded to half a degree before
// it is sent to Open-Meteo; the page itself never sees a place, and nothing about a visitor is stored.
//
// Caching: the answer depends on where the visitor is, and the place is not in the address, so a shared cache (the
// CDN) could hand one visitor's sky to someone far away. The answer is therefore marked private: only the visitor's
// own browser may keep it, for ten minutes. To spare the weather service, this function also remembers the sky of a
// half-degree square (not of any visitor) for ten minutes, in memory only, never written anywhere.
const TTL = 10 * 60 * 1000; // how long a square's sky is reused
const FAIL_TTL = 60 * 1000; // how long a failure is remembered, so a broken service is not hammered
const MAX_CELLS = 256; // the memory never holds more squares than this
const MAX_BYTES = 16 * 1024; // the weather service's answer is a few hundred bytes; anything bigger is refused
const CLEAR = { sky: "clear", wind: false, known: false };
const cells = new Map(); // "lat,lon" -> { at, ttl, out }

// the headers are numbers like "52.37"; anything else (too long, letters, out of range) is not a place
function coord(v, limit) {
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== "string" || s.length > 12 || !/^-?\d{1,3}(\.\d{1,8})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}
const half = (v) => (Math.round(v * 2) / 2 + 0).toFixed(1).replace(/^-0\.0$/, "0.0");

function skyOf(w) {
  return w >= 95 ? "storm" : (w >= 71 && w <= 77) || w === 85 || w === 86 ? "snow" : (w >= 61 && w <= 67) || (w >= 80 && w <= 82) ? "rain"
    : w >= 51 && w <= 57 ? "drizzle" : w === 45 || w === 48 ? "fog" : w >= 1 && w <= 3 ? "cloud" : "clear";
}
// only a whole weather code and a sensible wind speed are believed; anything else counts as no answer
function checked(j) {
  const c = j && typeof j === "object" ? j.current : null;
  if (!c || typeof c !== "object") return null;
  const code = c.weather_code, speed = c.wind_speed_10m;
  if (!Number.isInteger(code) || code < 0 || code > 99) return null;
  if (typeof speed !== "number" || !Number.isFinite(speed) || speed < 0 || speed > 500) return null;
  return { sky: skyOf(code), wind: speed >= 28, known: true };
}
async function lookup(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,wind_speed_10m`;
  const r = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "error", headers: { accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) throw new Error("too big");
  const text = await r.text();
  if (text.length > MAX_BYTES) throw new Error("too big");
  const out = checked(JSON.parse(text));
  if (!out) throw new Error("odd answer");
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Cache-Control", "no-store");
    res.status(405).json({ error: "use GET" });
    return;
  }
  // private: not for the shared CDN, because the answer belongs to where this visitor is
  const h = req.headers || {};
  const lat = coord(h["x-vercel-ip-latitude"], 90), lon = coord(h["x-vercel-ip-longitude"], 180);
  if (lat === null || lon === null) {
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).json(CLEAR);
    return;
  }
  const key = `${half(lat)},${half(lon)}`;
  const now = Date.now();
  let hit = cells.get(key);
  if (!hit || now - hit.at > hit.ttl) {
    hit = null;
    cells.delete(key);
    let out = CLEAR, ttl = FAIL_TTL;
    try { out = await lookup(half(lat), half(lon)); ttl = TTL; } catch { /* the sky stays clear for a minute */ }
    if (cells.size >= MAX_CELLS) cells.delete(cells.keys().next().value);
    hit = { at: Date.now(), ttl, out };
    cells.set(key, hit);
  }
  res.setHeader("Cache-Control", hit.out.known ? "private, max-age=600" : "private, no-store");
  res.status(200).json(hit.out);
};
