/* The sheet of paper behind the page: plain cream with a fine grain and two soft folds, painted on a canvas
   and used as the page background. The visitor can pick other kinds (lined, squared, kraft); the choice is
   read here, before the body is painted, so there is no flash of the wrong sheet. */
(function () {
  "use strict";
  const KINDS = ["plain", "lined", "squared", "kraft"];
  const KEY = "chess-paper";
  const W = 1400, H = 1600;
  const root = document.documentElement;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return;
  const cache = {};
  let current = "plain";

  function paint(kind) {
    let s = 20261019;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    const kraft = kind === "kraft";
    g.clearRect(0, 0, W, H);
    g.fillStyle = kraft ? "#d2b48c" : "#f3eee2";
    g.fillRect(0, 0, W, H);
    // a fine grain, so it reads as paper rather than a flat colour
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const amount = kraft ? 12 : 9;
    for (let i = 0; i < d.length; i += 4) {
      const n = (rnd() - 0.5) * amount;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
    }
    g.putImageData(img, 0, 0);

    if (kraft) {
      // short darker fibres and a few pale ones, like wrapping paper
      g.lineWidth = 1;
      for (let i = 0; i < 4200; i++) {
        const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI, l = 6 + rnd() * 22;
        g.strokeStyle = rnd() < 0.8 ? "rgba(92,62,30,0.12)" : "rgba(255,240,210,0.14)";
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    } else if (kind === "lined") {
      // pale blue rules and one red line down the left margin
      g.lineWidth = 1.5;
      g.strokeStyle = "rgba(90,130,200,0.24)";
      g.beginPath();
      for (let y = 96; y < H; y += 40) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
      g.stroke();
      g.lineWidth = 2;
      g.strokeStyle = "rgba(200,69,46,0.34)";
      g.beginPath(); g.moveTo(118.5, 0); g.lineTo(118.5, H); g.stroke();
    } else if (kind === "squared") {
      // a fine pale grid, a little stronger on every fifth line
      for (let i = 0, p = 14; p < Math.max(W, H); i++, p += 28) {
        g.lineWidth = i % 5 === 4 ? 1.5 : 1;
        g.strokeStyle = i % 5 === 4 ? "rgba(90,130,170,0.22)" : "rgba(90,130,170,0.13)";
        g.beginPath();
        if (p < W) { g.moveTo(p + 0.5, 0); g.lineTo(p + 0.5, H); }
        if (p < H) { g.moveTo(0, p + 0.5); g.lineTo(W, p + 0.5); }
        g.stroke();
      }
    }

    // a fold: a thin shaded line with a highlight on one side, fading out at both ends
    const fold = (x0, y0, x1, y1, width) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const across = g.createLinearGradient(x0 - nx * width, y0 - ny * width, x0 + nx * width, y0 + ny * width);
      across.addColorStop(0, "rgba(0,0,0,0)");
      across.addColorStop(0.42, "rgba(120,100,70,0.05)");
      across.addColorStop(0.5, "rgba(100,82,55,0.13)");
      across.addColorStop(0.53, "rgba(255,253,246,0.45)");
      across.addColorStop(0.7, "rgba(255,253,246,0.08)");
      across.addColorStop(1, "rgba(0,0,0,0)");
      g.save();
      // fade the ends with a mask drawn along the fold
      g.beginPath();
      g.moveTo(x0 - nx * width, y0 - ny * width);
      g.lineTo(x1 - nx * width, y1 - ny * width);
      g.lineTo(x1 + nx * width, y1 + ny * width);
      g.lineTo(x0 + nx * width, y0 + ny * width);
      g.closePath();
      g.clip();
      g.fillStyle = across;
      g.fillRect(0, 0, W, H);
      g.restore();
    };
    fold(W * 0.62, -20, W * 0.58, H + 20, 18);
    fold(-20, H * 0.47, W + 20, H * 0.5, 16);
    return cv.toDataURL("image/jpeg", 0.85);
  }

  function apply(kind) {
    root.classList.toggle("paper-kraft", kind === "kraft");
    try {
      if (!cache[kind]) cache[kind] = paint(kind);
      root.style.setProperty("--paper-img", `url("${cache[kind]}")`);
    } catch { /* the plain colour is enough */ }
  }

  function set(kind) {
    if (!KINDS.includes(kind)) kind = "plain";
    current = kind;
    apply(kind);
    try { localStorage.setItem(KEY, kind); } catch { /* private window: not remembered */ }
    return kind;
  }

  let saved = "plain";
  try { const v = localStorage.getItem(KEY); if (KINDS.includes(v)) saved = v; } catch { /* no storage */ }
  current = saved;
  apply(saved);
  window.Paper = { set, get kind() { return current; }, kinds: KINDS.slice() };
})();
