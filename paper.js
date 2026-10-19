/* The sheet of paper behind the page: plain cream with a fine grain and two soft folds,
   painted once on a canvas and used as the page background. */
(function () {
  "use strict";
  let s = 20261019;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const W = 1400, H = 1600;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  if (!g) return;

  g.fillStyle = "#f3eee2";
  g.fillRect(0, 0, W, H);
  // a fine grain, so it reads as paper rather than a flat colour
  const img = g.getImageData(0, 0, W, H), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 9;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  g.putImageData(img, 0, 0);

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

  try {
    const url = cv.toDataURL("image/jpeg", 0.85);
    document.documentElement.style.setProperty("--paper-img", `url("${url}")`);
  } catch { /* the plain colour is enough */ }
})();
