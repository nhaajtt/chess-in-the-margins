// What the sky is doing where the visitor is, as one word: clear, cloud, fog, drizzle, rain, storm or snow, and
// whether it is windy. The rough place comes from the network (Vercel's IP lookup), rounded to half a degree before
// it is sent to Open-Meteo; the page itself never sees a place, and nothing is stored.
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const lat = parseFloat(req.headers["x-vercel-ip-latitude"]), lon = parseFloat(req.headers["x-vercel-ip-longitude"]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) { res.status(200).json({ sky: "clear", wind: false, known: false }); return; }
  const round = (v) => (Math.round(v * 2) / 2).toFixed(1);
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${round(lat)}&longitude=${round(lon)}&current=weather_code,wind_speed_10m`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(String(r.status));
    const c = (await r.json()).current || {};
    const w = Number(c.weather_code);
    const sky = w >= 95 ? "storm" : (w >= 71 && w <= 77) || w === 85 || w === 86 ? "snow" : (w >= 61 && w <= 67) || (w >= 80 && w <= 82) ? "rain"
      : w >= 51 && w <= 57 ? "drizzle" : w === 45 || w === 48 ? "fog" : w >= 1 && w <= 3 ? "cloud" : "clear";
    res.status(200).json({ sky, wind: Number(c.wind_speed_10m) >= 28, known: true });
  } catch {
    res.status(200).json({ sky: "clear", wind: false, known: false });
  }
};
