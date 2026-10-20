/* The real weather, drawn on the page: rain, drizzle or a storm falls as pencil streaks, snow drifts down, fog rolls
   by, and on a windy day leaves and scraps of paper blow across. /api/weather answers with one word for the sky
   (the page never learns where you are). ?weather=rain (or snow, storm, fog, wind, clear) shows one on purpose.
   Shared by the chess game and the lab. */
(function (root) {
  "use strict";
  const W = { sky: "clear", wind: false, ready: null, cv: null, raf: 0, parts: [] };
  const reduce = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const R = (a, b) => a + Math.random() * (b - a);

  function ask() {
    const q = new URLSearchParams(location.search).get("weather");
    if (q) return Promise.resolve(q === "wind" ? { sky: "clear", wind: true } : { sky: q, wind: false });
    return fetch("/api/weather", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => j || { sky: "clear", wind: false });
  }
  function canvas() {
    if (W.cv) return W.cv;
    const cv = document.createElement("canvas");
    cv.className = "weather";
    cv.setAttribute("aria-hidden", "true");
    document.body.prepend(cv);
    const fit = () => { const k = Math.min(1.5, root.devicePixelRatio || 1); cv.width = innerWidth * k; cv.height = innerHeight * k; cv.__k = k; };
    fit();
    addEventListener("resize", fit);
    W.cv = cv;
    return cv;
  }
  // the bits that move, made once for the kind of weather
  function seed() {
    const n = { rain: 110, storm: 190, drizzle: 50, snow: 80, fog: 6 }[W.sky] || 0;
    W.parts = [];
    for (let i = 0; i < n; i++) W.parts.push({ x: R(0, innerWidth), y: R(-innerHeight, innerHeight), v: R(0.6, 1), r: R(0, Math.PI * 2) });
    if (W.wind) for (let i = 0; i < 9; i++) W.parts.push({ leaf: true, x: R(-innerWidth, 0), y: R(0, innerHeight), v: R(0.6, 1.2), r: R(0, 6), c: ["#5aa04a", "#e8902a", "#c8452e", "#f3eee2"][i % 4] });
  }
  function frame(t) {
    W.raf = requestAnimationFrame(frame);
    const cv = W.cv, g = cv.getContext("2d"), k = cv.__k, w = innerWidth, h = innerHeight;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, w, h);
    const night = document.body.classList.contains("is-night");
    const lean = W.wind ? 0.45 : 0.18;
    for (const p of W.parts) {
      if (p.leaf) {
        p.x += 2.6 * p.v; p.y += Math.sin(t / 400 + p.r) * 0.8; p.r += 0.05;
        if (p.x > w + 20) { p.x = -20; p.y = R(0, h); }
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.strokeStyle = night ? "#cdd1e2" : "#2b2f3a"; g.lineWidth = 1;
        g.beginPath(); g.ellipse(0, 0, 7, 3.2, 0, 0, Math.PI * 2); g.fill(); g.stroke(); g.restore();
        continue;
      }
      if (W.sky === "snow") {
        p.y += 0.7 * p.v; p.x += Math.sin(t / 900 + p.r) * 0.4 + (W.wind ? 0.8 : 0);
        if (p.y > h + 6) { p.y = -6; p.x = R(0, w); }
        g.fillStyle = night ? "rgba(240,242,255,0.85)" : "rgba(255,255,255,0.95)"; g.strokeStyle = "rgba(60,79,184,0.45)"; g.lineWidth = 1;
        g.beginPath(); g.arc(p.x, p.y, 2.2 + p.v * 1.6, 0, Math.PI * 2); g.fill(); g.stroke();
      } else if (W.sky === "fog") {
        p.x += 0.15 * p.v; if (p.x > w + 300) p.x = -300;
        const gr = g.createRadialGradient(p.x, p.y * 0.5 + h * 0.5, 0, p.x, p.y * 0.5 + h * 0.5, 260);
        gr.addColorStop(0, night ? "rgba(150,160,190,0.10)" : "rgba(200,205,215,0.16)"); gr.addColorStop(1, "rgba(200,205,215,0)");
        g.fillStyle = gr; g.fillRect(p.x - 260, p.y * 0.5 + h * 0.5 - 260, 520, 520);
      } else {
        // rain: short pencil streaks, falling on a slant
        const sp = (W.sky === "storm" ? 13 : W.sky === "drizzle" ? 6 : 10) * p.v, len = W.sky === "drizzle" ? 7 : 13;
        p.y += sp; p.x += sp * lean;
        if (p.y > h + 10) { p.y = R(-40, 0); p.x = R(-60, w); }
        g.strokeStyle = night ? "rgba(169,187,255,0.55)" : "rgba(60,79,184,0.38)"; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - len * lean, p.y - len); g.stroke();
      }
    }
  }
  function start() {
    if (reduce || (!W.parts.length)) return;
    canvas();
    if (!W.raf) W.raf = requestAnimationFrame(frame);
  }
  function stop() { cancelAnimationFrame(W.raf); W.raf = 0; if (W.cv) W.cv.getContext("2d").clearRect(0, 0, W.cv.width, W.cv.height); }
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });

  W.ready = ask().then((j) => {
    W.sky = j.sky || "clear"; W.wind = Boolean(j.wind);
    document.body.dataset.weather = W.sky + (W.wind ? " wind" : "");
    seed();
    start();
    if (root.Sound && root.Sound.weather) root.Sound.weather(W.sky);
    return { sky: W.sky, wind: W.wind };
  });
  root.Weather = { get sky() { return W.sky; }, get wind() { return W.wind; }, ready: W.ready };
})(window);
