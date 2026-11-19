/* Chess in the margins, part 4 of 10: the doodles around the page and the night sky. */
"use strict";

/* ---------- the doodles around the page: drawn with the same pen, all of them alive ---------- */

const deco = $("deco");
let whaleClip = null, sunAt = "0 0", moonAt = null, nightNow = false, decoTweens = [], decoDrawnAt = [0, 0];
// dusk and dawn come by the visitor's clock: the page checks now and then and redraws its margins
setInterval(() => { if (window.Themes && Themes.night && Themes.night() !== nightNow && !document.hidden) drawDeco(); }, 5 * 60 * 1000);
// the page grows as the move list does; redraw the doodles so the whale stays at the bottom
if (window.ResizeObserver) {
  let t = 0;
  new ResizeObserver(() => {
    const W = deco.clientWidth, H = deco.clientHeight;
    if (Math.abs(W - decoDrawnAt[0]) < 2 && Math.abs(H - decoDrawnAt[1]) < 40) return;
    clearTimeout(t);
    t = setTimeout(drawDeco, 250);
  }).observe(deco);
}
const WHALE_W = 310;
function face(g, rc, cx, cy, r, awake, k = 0) {
  const ink = { stroke: "#2b2f3a", strokeWidth: 1.6, roughness: 0.9 };
  const eyes = svgEl("g", { class: "d-eyes" });
  if (awake) {
    eyes.append(rc.circle(cx - r * 0.32, cy - r * 0.12, r * 0.16, { ...ink, fill: "#2b2f3a", fillStyle: "solid", seed: 3 + k }));
    eyes.append(rc.circle(cx + r * 0.32, cy - r * 0.12, r * 0.16, { ...ink, fill: "#2b2f3a", fillStyle: "solid", seed: 4 + k }));
  } else {
    eyes.append(rc.arc(cx - r * 0.32, cy - r * 0.14, r * 0.34, r * 0.24, 0.1, Math.PI - 0.1, false, { ...ink, seed: 3 + k }));
    eyes.append(rc.arc(cx + r * 0.32, cy - r * 0.14, r * 0.34, r * 0.24, 0.1, Math.PI - 0.1, false, { ...ink, seed: 4 + k }));
  }
  g.append(eyes);
  const mouth = svgEl("g", { class: "d-mouth" });
  mouth.append(rc.arc(cx, cy + r * 0.12, r * 0.7, r * 0.5, 0.25, Math.PI - 0.25, false, { ...ink, seed: 5 + k }));
  g.append(mouth);
}
const star5 = (x, y, big, small) => starPts(x, y, big, small);
// one doodle = an outer group that moves, holding three boiling copies
function doodle(cls, draw, transform) {
  const outer = svgEl("g", { class: cls });
  if (transform) outer.setAttribute("transform", transform);
  deco.append(outer);
  boil(outer, draw);
  return outer;
}
// every endless doodle animation runs on one clock, moved on every frame
const decoClock = G.timeline({ paused: true });
if (anim) {
  const t0 = G.ticker.time;
  G.ticker.add((t) => { decoClock.time(t - t0, false); });
}
const loop = (t) => { decoClock.add(t, decoClock.time()); decoTweens.push(t); return t; };
// a doodle moved by hand on every frame: gsap's quick setters write its transform straight away, by
// gsap's own rules, where a set() a frame would start a new tween and measure the drawing each time
const steer = (el) => { const to = {}; return (v) => { for (const k in v) (to[k] = to[k] || G.quickSetter(el, k))(v[k]); }; };

// once the doodles are drawn, their still pen strokes become pictures (see creatures.js), so each frame
// repaints only what moves; the pictures are let go when the doodles are drawn again

/* ---------- the night: a real night sky, not a dimmer ---------- */

// the ink of the drawings turns to chalk, so the lines show on the dark sky (chess.css does the same for live lines)
const NIGHT_INK = {
  strokes: { "#2b2f3a": "#ecebf8", "#3c4fb8": "#a9bbff", "#4a4d57": "#d8dae6", "#5d6170": "#cdd1e2", "#3a2a1a": "#f0e2c8", "#4a3020": "#f0dcc0" },
  texts: { "#2b2f3a": "#ecebf8", "#3c4fb8": "#a9bbff", "#c8452e": "#ffab96", "#5d6170": "#cdd1e2" },
};
let skyPainted = false;
// Night is the same sheet of paper on the same beach, after dark: the sand-coloured paper turns the grey-blue
// of sand under the moon (grain and folds still there), and only the top of the page is sky, with a few stars
// that thin out towards the horizon.
function paintNightSky() {
  if (skyPainted) return;
  skyPainted = true;
  let s = 20261019;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const put = (name, cv, type, q) => { try { document.documentElement.style.setProperty(name, `url("${cv.toDataURL(type, q)}")`); } catch { /* the plain colour is enough */ } };
  // the paper by moonlight
  {
    const W = 1400, H = 1600, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    if (g) {
      g.fillStyle = "#5f5a66"; g.fillRect(0, 0, W, H);
      const img = g.getImageData(0, 0, W, H), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 12; d[i] += n; d[i + 1] += n * 0.95; d[i + 2] += n * 0.9; }
      g.putImageData(img, 0, 0);
      const fold = (x0, y0, x1, y1, w) => {
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
        const a = g.createLinearGradient(x0 - nx * w, y0 - ny * w, x0 + nx * w, y0 + ny * w);
        a.addColorStop(0, "rgba(0,0,0,0)"); a.addColorStop(0.45, "rgba(10,14,30,0.12)"); a.addColorStop(0.5, "rgba(10,14,30,0.22)");
        a.addColorStop(0.53, "rgba(200,210,255,0.12)"); a.addColorStop(1, "rgba(0,0,0,0)");
        g.save(); g.beginPath();
        g.moveTo(x0 - nx * w, y0 - ny * w); g.lineTo(x1 - nx * w, y1 - ny * w); g.lineTo(x1 + nx * w, y1 + ny * w); g.lineTo(x0 + nx * w, y0 + ny * w);
        g.closePath(); g.clip(); g.fillStyle = a; g.fillRect(0, 0, W, H); g.restore();
      };
      fold(W * 0.62, -20, W * 0.58, H + 20, 18);
      fold(-20, H * 0.47, W + 20, H * 0.5, 16);
      put("--night-paper", cv, "image/jpeg", 0.86);
    }
  }
  // the sky over the top of the page, fading into the paper
  {
    const W = 1400, H = 420, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    if (g) {
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "rgba(20, 26, 62, 0.95)"); sky.addColorStop(0.5, "rgba(44, 46, 86, 0.55)"); sky.addColorStop(1, "rgba(95, 90, 102, 0)");
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) {
        const y = Math.pow(rnd(), 1.8) * H * 0.8, x = rnd() * W, r = rnd() < 0.9 ? rnd() * 1 + 0.3 : rnd() * 1.4 + 1;
        g.fillStyle = `rgba(255, 250, 230, ${(0.3 + rnd() * 0.6) * (1 - y / (H * 0.85))})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      put("--night-sky", cv, "image/png");
    }
  }
}
// a few bright stars twinkle on their own layer, and now and then a star shoots across
const twinkles = document.createElement("div");
twinkles.className = "cx-sky";
twinkles.setAttribute("aria-hidden", "true");
document.body.prepend(twinkles);
let shooting = 0;
function nightLayer(on) {
  twinkles.hidden = !on;
  clearTimeout(shooting);
  if (!on) return;
  if (!twinkles.childElementCount) {
    for (let i = 0; i < 46; i++) {
      const st = document.createElement("i");
      st.style.left = `${R(0, 100)}%`; st.style.top = `${Math.pow(Math.random(), 1.6) * 80}%`;
      st.style.setProperty("--d", `${R(1.6, 4.2).toFixed(2)}s`); st.style.setProperty("--w", `${R(0, 4).toFixed(2)}s`);
      st.style.setProperty("--s", `${R(2, 4.5).toFixed(1)}px`);
      twinkles.append(st);
    }
  }
  if (!anim) return;
  const shoot = () => {
    const s = document.createElement("b");
    s.style.left = `${R(10, 70)}%`; s.style.top = `${R(4, 30)}%`;
    twinkles.append(s);
    sfx("shootingstar");
    G.fromTo(s, { x: 0, y: 0, opacity: 0, scaleX: 0.3 }, { x: R(260, 420), y: R(120, 200), opacity: 1, scaleX: 1, duration: 0.9, ease: "power1.in", onComplete: () => G.to(s, { opacity: 0, duration: 0.25, onComplete: () => s.remove() }) });
    shooting = setTimeout(shoot, R(5000, 13000));
  };
  shooting = setTimeout(shoot, R(1500, 5000));
}

// after dark the board is played by torchlight (torch.js): the light falls on the board, the warm paper under it
if (window.Torch) window.Torch.init({
  gsap: G, anim, sfx,
  target: () => $("cam").getBoundingClientRect(),
  // measured before anything is written, so the page is not made to lay itself out twice
  lit: { before: $("cam"), place(lit, rx, ry) { const cam = $("cam"), x = cam.offsetLeft + cam.offsetWidth / 2, y = cam.offsetTop + cam.offsetHeight / 2; Object.assign(lit.style, { width: `${rx * 2}px`, height: `${ry * 2}px`, left: `${x - rx}px`, top: `${y - ry}px` }); } },
});

let decoPics = [], decoGen = 0, decoDrawing = false, beachKit = null, frogKit = null;
function flattenDeco(after) {
  const gen = ++decoGen;
  G.delayedCall(after, async () => {
    if (gen !== decoGen) return;
    decoDrawing = false;
    if (!penBusy) bakePieces();
    const ppu = Math.min(4, Math.max(1.5, (window.devicePixelRatio || 1) * 1.5));
    const urls = await CR.flatten(deco, ppu, 24, nightNow ? NIGHT_INK : null);
    if (gen !== decoGen) { urls.forEach((u) => CR.release(u)); return; }
    decoPics.push(...urls);
  });
}
function drawDeco() {
  const W = deco.clientWidth, H = deco.clientHeight;
  if (!W || !H) return;
  decoDrawnAt = [W, H];
  decoGen++;
  beachKit = null;
  frogKit = null;
  nightNow = Boolean(TH.night && TH.night());
  if (nightNow) paintNightSky();
  document.body.classList.toggle("is-night", nightNow);
  nightLayer(nightNow);
  if (SND.ambience) SND.ambience(nightNow ? "night" : "day");
  if (window.Torch) window.Torch.set(nightNow);
  decoPics.forEach((u) => CR.release(u));
  decoPics = [];
  decoTweens.forEach((t) => t.kill());
  decoTweens = [];
  deco.setAttribute("viewBox", `0 0 ${W} ${H}`);
  // keep 1 unit = 1 px even before the next redraw: no stretching when the page grows
  deco.setAttribute("preserveAspectRatio", "xMinYMin slice");
  deco.replaceChildren();
  const narrow = W < 900;
  const pen = { stroke: "#3c4fb8", strokeWidth: 1.8, roughness: 1.3 };

  // the sun: rays turn slowly, it blinks, and it laughs when someone is taken
  {
    const r = narrow ? 16 : 30, cx = r + 24, cy = r + 16;
    sunAt = `${cx} ${cy}`;
    const sun = doodle("d-sun", (rc, g, k) => {
      const rays = svgEl("g", { class: "d-rays" });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, len = i % 2 ? 12 : 19;
        rays.append(rc.line(cx + Math.cos(a) * (r + 6), cy + Math.sin(a) * (r + 6), cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len), { stroke: "#e0a21a", strokeWidth: 2.2, roughness: 1.6, seed: 20 + i + k * 50 }));
      }
      g.append(rays);
      g.append(rc.circle(cx, cy, r * 2, { stroke: "#c98a12", strokeWidth: 2, roughness: 1.2, fill: "#f7c933", fillStyle: "hachure", hachureGap: 4, fillWeight: 1.3, seed: 2 + k * 50 }));
      face(g, rc, cx, cy, r, true, k * 50);
    });
    if (anim) {
      loop(G.to(sun.querySelectorAll(".d-rays"), { rotation: 360, svgOrigin: `${cx} ${cy}`, duration: 30, repeat: -1, ease: "none" }));
      loop(G.timeline({ repeat: -1, repeatDelay: 3.2 }).to(sun.querySelectorAll(".d-eyes"), { scaleY: 0.1, svgOrigin: `${cx} ${cy - r * 0.12}`, duration: 0.08, yoyo: true, repeat: 1 }));
      loop(G.to(sun, { y: -3, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    }
  }
  // the moon in its nightcap: bobs, and z's drift up from it
  {
    const r = narrow ? 18 : 30, cx = W - r * 1.6 - 20, cy = r * 1.7 + 12;
    moonAt = [cx, cy, r];
    const moon = doodle("d-moon", (rc, g, k) => {
      g.append(rc.path(`M ${cx} ${cy - r} A ${r} ${r} 0 1 0 ${cx} ${cy + r} A ${r * 0.72} ${r} 0 1 1 ${cx} ${cy - r} Z`, { ...pen, stroke: "#8a7a2a", fill: "#f3d77a", fillStyle: "hachure", hachureGap: 4, fillWeight: 1.2, seed: 6 + k * 50 }));
      g.append(rc.arc(cx - r * 0.45, cy - r * 0.05, r * 0.3, r * 0.2, 0.1, Math.PI - 0.1, false, { stroke: "#2b2f3a", strokeWidth: 1.6, roughness: 0.8, seed: 7 + k * 50 }));
      const cap2 = svgEl("g", { class: "d-cap" });
      cap2.append(rc.polygon([[cx - r * 0.95, cy - r * 0.62], [cx + r * 0.05, cy - r * 1.02], [cx + r * 1.1, cy - r * 1.55]], { ...pen, fill: "#9ab4f0", fillStyle: "zigzag", hachureGap: 5, seed: 8 + k * 50 }));
      cap2.append(rc.circle(cx + r * 1.1, cy - r * 1.55, r * 0.42, { ...pen, fill: "#fffdf7", fillStyle: "solid", seed: 9 + k * 50 }));
      g.append(cap2);
    });
    if (anim) {
      loop(G.to(moon, { y: 5, rotation: 4, svgOrigin: `${cx} ${cy}`, duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      loop(G.to(moon.querySelectorAll(".d-cap"), { rotation: 8, svgOrigin: `${cx} ${cy - r}`, duration: 1.7, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      const zz = () => {
        const z = svgEl("text", { x: cx - r * 1.4, y: cy, class: "cx-zz", fill: "#3c4fb8" });
        z.textContent = "z";
        deco.append(z);
        G.timeline({ onComplete: () => z.remove() }).fromTo(z, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.5 }).to(z, { x: -r * 1.4, y: -r * 1.8, rotation: -20, opacity: 0, duration: 2.2, ease: "sine.out" }, 0);
      };
      loop(G.timeline({ repeat: -1, repeatDelay: 0.6 }).call(zz).to({}, { duration: 0.9 }).call(zz));
    }
  }
  // a string of stars across the top, every star swinging on its thread
  if (!narrow) {
    const x0 = W * 0.3, x1 = W * 0.7, y0 = 4, sag = 30;
    const string = doodle("d-bunting", (rc, g, k) => g.append(rc.path(`M ${x0} ${y0} Q ${(x0 + x1) / 2} ${y0 + sag * 2} ${x1} ${y0}`, { stroke: "#2b2f3a", strokeWidth: 1.4, roughness: 1, seed: 11 + k * 50 })));
    for (let i = 1; i < 12; i++) {
      const t = i / 12, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const drop = 8 + (i % 3) * 5;
      const s = svgEl("g", { class: "d-star" });
      s.dataset.at = `${x} ${y + drop + 8}`;
      s.dataset.hang = `${x} ${y}`;
      string.append(s);
      boil(s, (rc, g, k) => {
        g.append(rc.line(x, y, x, y + drop, { stroke: "#2b2f3a", strokeWidth: 1, roughness: 0.6, seed: 30 + i + k * 50 }));
        g.append(rc.polygon(star5(x, y + drop + 8, 9, 4), { stroke: "#b57a10", strokeWidth: 1.2, fill: "#f7c933", fillStyle: "solid", roughness: 0.8, seed: 40 + i + k * 50 }));
        const f = svgEl("g", { class: "d-starface" });
        f.append(rc.circle(x - 2.4, y + drop + 7.5, 1.6, { stroke: "none", fill: "#3a2a1a", fillStyle: "solid", roughness: 0.3, seed: 1 }));
        f.append(rc.circle(x + 2.4, y + drop + 7.5, 1.6, { stroke: "none", fill: "#3a2a1a", fillStyle: "solid", roughness: 0.3, seed: 2 }));
        f.append(rc.arc(x, y + drop + 9.5, 4, 3, 0.3, Math.PI - 0.3, false, { stroke: "#3a2a1a", strokeWidth: 1, roughness: 0.4, seed: 3 }));
        g.append(f);
      });
      if (anim) loop(G.fromTo(s, { rotation: -9, svgOrigin: `${x} ${y}` }, { rotation: 9, svgOrigin: `${x} ${y}`, duration: R(1.1, 1.6), yoyo: true, repeat: -1, ease: "sine.inOut", delay: -i * 0.15 }));
    }
  }
  // a sleepy cloud drifting along the top
  if (!narrow) {
    const cx = 240, cy = 64;
    const cloud = doodle("d-cloud", (rc, g, k) => {
      [[-30, 6, 54, 38], [30, 6, 54, 38], [0, -8, 64, 50], [0, 12, 100, 32]].forEach(([dx, dy, w, h], j) => g.append(rc.ellipse(cx + dx, cy + dy, w, h, { ...pen, fill: "#f3eee2", fillStyle: "solid", seed: 50 + j + k * 50 })));
      face(g, rc, cx, cy + 6, 15, false, k * 50);
    });
    const [sx, sy] = sunAt.split(" ").map(Number);
    const parked = nightNow && store.get("chess-sky") === "night";
    if (parked) G.set(cloud, { x: sx - cx + 6, y: sy - cy + 4 });
    if (anim && !parked) loop(G.to(cloud, { x: 90, duration: 14, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    if (anim) loop(G.to(cloud, { y: (parked ? sy - cy + 4 : 0) + 6, duration: 3.4, yoyo: true, repeat: -1, ease: "sine.inOut" }));
  }
  // the whale with its island bobs on the waves; it is coloured in as the game goes on and spouts at every capture
  {
    const s = narrow ? 0.62 : 0.9;
    const x = W - WHALE_W * s - 12, y = H - 168 * s - 26;
    const outer = svgEl("g", { class: "d-whale", transform: `translate(${x} ${y}) scale(${s})` });
    deco.append(outer);
    const bob = svgEl("g", { class: "d-whale__bob" });
    outer.append(bob);
    const body = "M20 110 C 20 62, 92 42, 170 52 C 232 60, 262 92, 255 120 C 250 150, 200 166, 120 163 C 60 160, 20 140, 20 110 Z";
    const tail = "M248 116 C 266 100, 280 80, 296 70 C 292 92, 288 104, 300 120 C 282 120, 268 122, 252 128";
    const defs = svgEl("defs");
    const clip = svgEl("clipPath", { id: "whale-clip" });
    whaleClip = svgEl("rect", { x: 0, y: -60, height: 260, width: 0 });
    clip.append(whaleClip); defs.append(clip); bob.append(defs);
    const fillG = svgEl("g", { "clip-path": "url(#whale-clip)" });
    bob.append(fillG);
    boil(fillG, (rc, g, k) => {
      g.append(rc.path(body, { stroke: "none", fill: "#3c4fb8", fillStyle: "hachure", hachureGap: 5, hachureAngle: -40, fillWeight: 1.5, roughness: 1.4, seed: 60 + k * 50 }));
      g.append(rc.path(tail + " Z", { stroke: "none", fill: "#3c4fb8", fillStyle: "hachure", hachureGap: 5, fillWeight: 1.5, seed: 61 + k * 50 }));
    });
    boil(bob, (rc, g, k) => {
      g.append(rc.path(body, { ...pen, seed: 62 + k * 50 }));
      g.append(rc.path(tail, { ...pen, seed: 63 + k * 50 }));
      g.append(rc.arc(72, 104, 18, 12, 0.1, Math.PI - 0.1, false, { stroke: "#2b2f3a", strokeWidth: 1.8, roughness: 0.8, seed: 64 + k * 50 }));
      g.append(rc.path("M44 126 Q 72 142 104 128", { stroke: "#2b2f3a", strokeWidth: 1.6, roughness: 0.9, seed: 65 + k * 50 }));
      g.append(rc.path("M140 56 C 150 38, 214 34, 230 60", { stroke: "#b08a3e", strokeWidth: 2, fill: "#f0d68a", fillStyle: "hachure", hachureGap: 4, roughness: 1.2, seed: 66 + k * 50 }));
      g.append(rc.path("M186 44 C 188 24, 192 8, 200 -12", { stroke: "#7a5a2a", strokeWidth: 3, roughness: 1, seed: 67 + k * 50 }));
    });
    const leaves = svgEl("g", { class: "d-leaves" });
    bob.append(leaves);
    boil(leaves, (rc, g, k) => ["M200 -12 C 184 -22, 168 -20, 158 -8", "M200 -12 C 212 -26, 230 -24, 240 -12", "M200 -12 C 196 -32, 186 -40, 172 -40", "M200 -12 C 210 -34, 224 -38, 236 -34"].forEach((d, j) => g.append(rc.path(d, { stroke: "#4f8a3a", strokeWidth: 3, roughness: 1.2, seed: 68 + j + k * 50 }))));
    const spoutG = svgEl("g", { class: "d-spout", opacity: 0.25 });
    bob.append(spoutG);
    boil(spoutG, (rc, g, k) => g.append(rc.path("M96 46 C 92 30, 86 22, 78 16 M96 46 C 100 30, 108 22, 116 18 M96 46 L 97 14", { stroke: "#7db7ef", strokeWidth: 2.4, roughness: 1, seed: 72 + k * 50 })));
    const waves = svgEl("g", { class: "d-waves" });
    outer.append(waves);
    boil(waves, (rc, g, k) => {
      for (let j = 0; j < 2; j++) g.append(rc.path(`M -10 ${170 + j * 12} q 20 -10 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`, { stroke: "#7db7ef", strokeWidth: 2, roughness: 1, seed: 80 + j + k * 50 }));
    });
    if (anim) {
      loop(G.to(bob, { y: -6, rotation: -1.5, svgOrigin: "150 120", duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      loop(G.to(leaves, { rotation: 7, svgOrigin: "200 -12", duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      loop(G.to(waves, { x: -40, duration: 3, repeat: -1, ease: "none" }));
      loop(G.to(spoutG, { opacity: 0.6, duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    }
  }
  // grass waving, two mushrooms, a snail crawling along the bottom, a ladybird that flies by
  if (!narrow) {
    const y = H - 14;
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * ((W - 480) / 8) + (i % 2) * 14;
      const tuft = doodle("d-tuft", (rc, g, k) => g.append(rc.path(`M ${x - 8} ${y} L ${x - 4} ${y - 14} M ${x} ${y} L ${x} ${y - 20} M ${x + 8} ${y} L ${x + 5} ${y - 13}`, { stroke: "#5aa04a", strokeWidth: 1.8, roughness: 1.4, seed: 80 + i + k * 50 })));
      if (anim) loop(G.fromTo(tuft, { skewX: -8, svgOrigin: `${x} ${y}` }, { skewX: 8, svgOrigin: `${x} ${y}`, duration: R(1.2, 1.8), yoyo: true, repeat: -1, ease: "sine.inOut", delay: -i * 0.2 }));
    }
    const mx = W * 0.16;
    const mush = doodle("d-mush", (rc, g, k) => [mx, mx + 26].forEach((x, j) => {
      g.append(rc.line(x, y, x, y - 18 + j * 6, { stroke: "#2b2f3a", strokeWidth: 3, roughness: 0.8, seed: 90 + j + k * 50 }));
      g.append(rc.path(`M ${x - 14} ${y - 16 + j * 6} Q ${x} ${y - 40 + j * 6} ${x + 14} ${y - 16 + j * 6} Z`, { stroke: "#2b2f3a", strokeWidth: 1.4, fill: "#e8432e", fillStyle: "hachure", hachureGap: 3.5, roughness: 1, seed: 92 + j + k * 50 }));
    }));
    if (anim) loop(G.to(mush, { scaleY: 1.06, svgOrigin: `${mx} ${y}`, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    const sx = 0, sy = y - 12;
    const snail = doodle("d-snail", (rc, g, k) => {
      g.append(rc.path(`M ${sx - 14} ${sy + 12} L ${sx + 22} ${sy + 12} Q ${sx + 30} ${sy + 4} ${sx + 26} ${sy - 4}`, { ...pen, seed: 96 + k * 50 }));
      const horns = svgEl("g", { class: "d-horns" });
      horns.append(rc.path(`M ${sx + 26} ${sy - 4} L ${sx + 30} ${sy - 14} M ${sx + 26} ${sy - 4} L ${sx + 22} ${sy - 14}`, { ...pen, seed: 99 + k * 50 }));
      g.append(horns);
      g.append(rc.circle(sx + 4, sy, 26, { stroke: "#b4561d", strokeWidth: 1.8, fill: "#f0c08a", fillStyle: "hachure", hachureGap: 4, roughness: 1, seed: 97 + k * 50 }));
      g.append(rc.path(`M ${sx + 4} ${sy} m -6 0 a 6 6 0 1 1 12 0 a 4 4 0 1 1 -8 0`, { stroke: "#b4561d", strokeWidth: 1.6, roughness: 0.8, seed: 98 + k * 50 }));
    }, `translate(${W * 0.04} 0)`);
    if (anim) {
      // the snail takes the whole game to cross the page
      loop(G.fromTo(snail, { x: W * 0.04 }, { x: W * 0.55, duration: 160, ease: "none", repeat: -1, yoyo: true }));
      loop(G.to(snail.querySelectorAll(".d-horns"), { rotation: 10, svgOrigin: `${sx + 26} ${sy - 4}`, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      loop(G.to(snail, { scaleX: 1.04, svgOrigin: `${sx} ${sy + 12}`, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    }
    const bug = doodle("d-bug", (rc, g, k) => {
      g.append(rc.circle(0, 0, 18, { stroke: "#2b2f3a", strokeWidth: 1.4, fill: "#e8432e", fillStyle: "solid", roughness: 1, seed: 120 + k * 50 }));
      g.append(rc.line(0, -9, 0, 9, { stroke: "#2b2f3a", strokeWidth: 1.2, seed: 121 + k * 50 }));
      g.append(rc.circle(-4, -2, 3, { fill: "#2b2f3a", fillStyle: "solid", stroke: "none", seed: 122 }));
      g.append(rc.circle(4, 3, 3, { fill: "#2b2f3a", fillStyle: "solid", stroke: "none", seed: 123 }));
      g.append(rc.circle(0, -11, 7, { fill: "#2b2f3a", fillStyle: "solid", stroke: "none", seed: 124 }));
    });
    bug.setAttribute("opacity", "0");
    if (anim) loop(G.timeline({ repeat: -1, repeatDelay: 16, delay: 6 })
      .set(bug, { x: -30, y: H * 0.35, opacity: 1, rotation: 90 })
      .to(bug, { x: W * 0.5, duration: 5, ease: "none" })
      .to(bug, { keyframes: [{ y: H * 0.2, duration: 1.6 }, { y: H * 0.4, duration: 1.8 }, { y: H * 0.25, duration: 1.6 }], ease: "sine.inOut" }, "<")
      .to(bug, { rotation: 70, duration: 0.3, yoyo: true, repeat: 7 }, "<")
      .to(bug, { x: W + 40, duration: 5, ease: "none" })
      .to(bug, { y: H * 0.1, duration: 5, ease: "sine.inOut" }, "<")
      .set(bug, { opacity: 0 }));
  }

  /* ---------- more life around the board ---------- */
  const dr = deco.getBoundingClientRect(), br = cam.getBoundingClientRect();
  const bx0 = br.left - dr.left, by0 = br.top - dr.top, bx1 = br.right - dr.left, by1 = br.bottom - dr.top;
  // the stars on the string blink one after another
  if (anim && deco.querySelector(".d-starface")) loop(G.timeline({ repeat: -1, repeatDelay: 2.5 }).to(deco.querySelectorAll(".d-starface"), { scaleY: 0.15, svgOrigin: "0 0", transformOrigin: "50% 40%", duration: 0.08, yoyo: true, repeat: 1, stagger: 0.12 }));

  // two little moons asleep at the bottom corners of the board, breathing
  [[bx0 - 6, by1 - 10], [bx1 + 6, by1 - 10]].forEach(([x, y], j) => {
    const m = doodle("d-corner", (rc, g, k) => {
      g.append(rc.circle(x, y, narrow ? 20 : 28, { stroke: "#5d6170", strokeWidth: 1.4, fill: "#f1e7c4", fillStyle: "hachure", hachureGap: 3, roughness: 1.2, seed: 300 + j + k * 50 }));
      face(g, rc, x, y + 1, narrow ? 7 : 10, false, k * 50 + j);
    });
    if (anim) {
      loop(G.to(m, { scale: 1.06, svgOrigin: `${x} ${y + 12}`, duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut", delay: j }));
      loop(G.timeline({ repeat: -1, delay: j * 1.4 }).call(() => {
        const z = svgEl("text", { x: x + 10, y: y - 10, class: "cx-zz", fill: "#5d6170", "font-size": 13 });
        z.textContent = "z";
        deco.append(z);
        G.timeline({ onComplete: () => z.remove() }).fromTo(z, { opacity: 0 }, { opacity: 1, duration: 0.4 }).to(z, { x: 10, y: -24, opacity: 0, duration: 2, ease: "sine.out" }, 0);
      }).to({}, { duration: 2.8 }));
    }
  });

  // flowers and grass along the top edge of the board, swaying
  if (!narrow) for (let i = 0; i < 6; i++) {
    const x = bx0 + 30 + i * ((bx1 - bx0 - 60) / 5) + (i % 2) * 18, y = by0 + 4;
    const fl = doodle("d-flower", (rc, g, k) => {
      if (i % 2) {
        g.append(rc.path(`M ${x} ${y} Q ${x - 2} ${y - 10} ${x} ${y - 22}`, { stroke: "#5aa04a", strokeWidth: 1.6, roughness: 1, seed: 320 + i + k * 50 }));
        for (let pt = 0; pt < 5; pt++) { const a = (pt / 5) * Math.PI * 2; g.append(rc.ellipse(x + Math.cos(a) * 4.5, y - 24 + Math.sin(a) * 4.5, 6, 5, { stroke: "#5d6170", strokeWidth: 1, fill: "#fffaf0", fillStyle: "solid", roughness: 0.8, seed: 330 + pt + k * 50 })); }
        g.append(rc.circle(x, y - 24, 4.5, { stroke: "none", fill: "#f7c933", fillStyle: "solid", seed: 336 }));
      } else g.append(rc.path(`M ${x - 6} ${y} L ${x - 3} ${y - 10} M ${x} ${y} L ${x} ${y - 14} M ${x + 6} ${y} L ${x + 4} ${y - 9}`, { stroke: "#5aa04a", strokeWidth: 1.6, roughness: 1.3, seed: 340 + i + k * 50 }));
    });
    if (anim) loop(G.fromTo(fl, { rotation: -6, svgOrigin: `${x} ${y}` }, { rotation: 6, svgOrigin: `${x} ${y}`, duration: R(1.3, 2), yoyo: true, repeat: -1, ease: "sine.inOut", delay: -i * 0.3 }));
  }

  if (!narrow && bx0 > 120) {
    const mw = Math.min(210, bx0 - 30);
    // a rainbow with a little tree house under it, smoke curling out of the chimney
    {
      const cx = mw / 2 + 24, cy = by0 + (by1 - by0) * 0.42, r0 = mw / 2;
      const rb = doodle("d-rainbow", (rc, g, k) => {
        ["#e8432e", "#f08a24", "#f7c933", "#5aa04a", "#3c8fd8", "#8a6ad8"].forEach((col, j) => g.append(rc.arc(cx, cy, (r0 - j * 9) * 2, (r0 - j * 9) * 1.6, Math.PI, Math.PI * 2, false, { stroke: col, strokeWidth: 5, roughness: 1.4, seed: 400 + j + k * 50 })));
        g.append(rc.line(cx - 22, cy, cx - 22, cy - 26, { stroke: "#7a5a2a", strokeWidth: 4, roughness: 1, seed: 410 + k * 50 }));
        g.append(rc.circle(cx - 22, cy - 40, 34, { stroke: "#3d7a33", strokeWidth: 1.4, fill: "#7cb26a", fillStyle: "hachure", hachureGap: 3, roughness: 1.3, seed: 411 + k * 50 }));
        g.append(rc.rectangle(cx - 34, cy - 42, 22, 16, { stroke: "#5d4020", strokeWidth: 1.4, fill: "#e0a060", fillStyle: "hachure", hachureGap: 3, roughness: 1, seed: 412 + k * 50 }));
        g.append(rc.polygon([[cx - 37, cy - 42], [cx - 23, cy - 54], [cx - 9, cy - 42]], { stroke: "#5d4020", strokeWidth: 1.4, fill: "#c8452e", fillStyle: "zigzag", hachureGap: 3, roughness: 1, seed: 413 + k * 50 }));
        g.append(rc.line(cx - 15, cy - 50, cx - 15, cy - 57, { stroke: "#5d4020", strokeWidth: 3, seed: 414 }));
      });
      if (anim) {
        loop(G.to(rb, { y: -3, duration: 3.1, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.timeline({ repeat: -1 }).call(() => {
          const puff = rough.svg(deco).circle(0, 0, 8, { stroke: "#9a9a9a", strokeWidth: 1, fill: "rgba(220,220,220,0.5)", fillStyle: "solid", roughness: 1.4, seed: 7 });
          deco.append(puff);
          G.timeline({ onComplete: () => puff.remove() }).set(puff, { x: cx - 15, y: cy - 60, scale: 0.4 }).to(puff, { x: cx - 15 + R(-10, 10), y: cy - 95, scale: 1.6, opacity: 0, duration: 2.4, ease: "sine.out" });
        }).to({}, { duration: 0.9 }));
      }
    }
    // a frog on a lily pad that catches a buzzing fly with its tongue
    {
      const fx0 = 40 + mw * 0.35, fy0 = by1 - 40;
      const pad = doodle("d-frog", (rc, g, k) => {
        g.append(rc.ellipse(fx0, fy0 + 10, 90, 22, { stroke: "#3d7a33", strokeWidth: 1.4, fill: "#8cc47a", fillStyle: "hachure", hachureGap: 3, roughness: 1.3, seed: 430 + k * 50 }));
        g.append(rc.ellipse(fx0, fy0 - 4, 40, 28, { stroke: "#2f6a2a", strokeWidth: 1.6, fill: "#5aa04a", fillStyle: "hachure", hachureGap: 2.4, roughness: 1.2, seed: 431 + k * 50 }));
        g.append(rc.circle(fx0 - 9, fy0 - 18, 12, { stroke: "#2f6a2a", strokeWidth: 1.4, fill: "#fffaf0", fillStyle: "solid", seed: 432 }));
        g.append(rc.circle(fx0 + 9, fy0 - 18, 12, { stroke: "#2f6a2a", strokeWidth: 1.4, fill: "#fffaf0", fillStyle: "solid", seed: 433 }));
        g.append(rc.circle(fx0 - 8, fy0 - 17, 5, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 434 }));
        g.append(rc.circle(fx0 + 10, fy0 - 17, 5, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 435 }));
        g.append(rc.arc(fx0, fy0 - 4, 18, 8, 0.2, Math.PI - 0.2, false, { stroke: "#2f6a2a", strokeWidth: 1.4, seed: 436 }));
      });
      frogKit = { pad, fx: fx0, fy: fy0 };
      const tongue = svgEl("path", { d: `M ${fx0} ${fy0 - 2} L ${fx0 + 46} ${fy0 - 46}`, stroke: "#e2516a", "stroke-width": 3, "stroke-linecap": "round", fill: "none", opacity: 0 });
      const fly = svgEl("g", {});
      fly.append(rough.svg(deco).circle(0, 0, 5, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: 1 }));
      fly.append(rough.svg(deco).ellipse(-2, -4, 6, 4, { stroke: "#5d6170", strokeWidth: 0.8, fill: "rgba(255,255,255,0.7)", fillStyle: "solid", seed: 2 }));
      deco.append(tongue, fly);
      if (anim) {
        loop(G.to(pad, { y: 2, duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        const buzz = { a: 0 };
        const flyTo = steer(fly);
        loop(G.to(buzz, { a: Math.PI * 2, duration: 3.2, repeat: -1, ease: "none", onUpdate: () => flyTo({ x: fx0 + 46 + Math.cos(buzz.a) * 22, y: fy0 - 46 + Math.sin(buzz.a * 2) * 10 }) }));
        loop(G.timeline({ repeat: -1, repeatDelay: 5.5, delay: 3 })
          .set(tongue, { opacity: 1, attr: { d: `M ${fx0} ${fy0 - 2} L ${fx0} ${fy0 - 2}` } })
          .to(tongue, { attr: { d: `M ${fx0} ${fy0 - 2} L ${fx0 + 46} ${fy0 - 46}` }, duration: 0.12, ease: "power3.out" })
          .to(fly, { opacity: 0, duration: 0.05 })
          .to(tongue, { attr: { d: `M ${fx0} ${fy0 - 2} L ${fx0} ${fy0 - 2}` }, duration: 0.15, ease: "power2.in" })
          .set(tongue, { opacity: 0 })
          .to(pad, { scaleY: 1.08, svgOrigin: `${fx0} ${fy0 + 10}`, duration: 0.15, yoyo: true, repeat: 3 })
          .to(fly, { opacity: 1, duration: 0.4, delay: 1.5 }));
      }
    }
    // a line of ants marching down the left margin
    if (anim) for (let i = 0; i < 6; i++) {
      const ant = svgEl("g", {});
      const rc = rough.svg(deco);
      [[0, 0, 4], [5, 0, 3], [10, 0, 4.5]].forEach(([x, y, r], j) => ant.append(rc.circle(x, y, r, { stroke: "none", fill: "#3a2a1a", fillStyle: "solid", roughness: 0.5, seed: 450 + j })));
      ant.append(rc.path("M 3 0 l -2 4 M 6 0 l 0 4 M 8 0 l 2 4 M 3 0 l -2 -4 M 6 0 l 0 -4 M 8 0 l 2 -4", { stroke: "#3a2a1a", strokeWidth: 0.8, roughness: 0.6, seed: 455 }));
      deco.append(ant);
      loop(G.fromTo(ant, { x: 14, y: by0 - 20, rotation: 90 }, { y: by1 + 30, duration: 26, ease: "none", repeat: -1, delay: -i * 1.4 }));
      loop(G.to(ant, { x: 20, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut", delay: i * 0.1 }));
    }
  }
  // two butterflies wandering over the margins
  if (anim && !narrow) for (let j = 0; j < 2; j++) {
    const bf = svgEl("g", {});
    const rc = rough.svg(deco);
    const col = j ? "#f28ab2" : "#8db4ee";
    const wl = svgEl("g", {}), wr = svgEl("g", {});
    wl.append(rc.ellipse(-6, -2, 12, 14, { stroke: "#5d6170", strokeWidth: 1, fill: col, fillStyle: "hachure", hachureGap: 2, roughness: 1, seed: 470 + j }));
    wr.append(rc.ellipse(6, -2, 12, 14, { stroke: "#5d6170", strokeWidth: 1, fill: col, fillStyle: "hachure", hachureGap: 2, roughness: 1, seed: 472 + j }));
    bf.append(wl, wr, rc.line(0, -8, 0, 6, { stroke: "#3a2a1a", strokeWidth: 2, seed: 474 }));
    deco.append(bf);
    loop(G.to([wl, wr], { scaleX: 0.25, svgOrigin: "0 0", duration: 0.12, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    const path = { t: j * 0.5 }, bfTo = steer(bf);
    loop(G.to(path, { t: j * 0.5 + 1, duration: 22 + j * 6, repeat: -1, ease: "none", onUpdate: () => {
      const a = path.t * Math.PI * 2;
      const x = j ? W - 120 + Math.sin(a) * 90 : bx1 + 70 + Math.sin(a * 2) * 40;
      const y = j ? H * 0.3 + Math.sin(a * 3) * 70 + Math.cos(a) * 40 : H * 0.62 + Math.sin(a) * 120;
      bfTo({ x, y, rotation: Math.cos(a * 3) * 18 });
    } }));
  }
  // a pencil and a crayon lying under the board; they roll a little when a piece moves
  if (!narrow) {
    const px = (bx0 + bx1) / 2, py = Math.min(H - 30, by1 + 70);
    const pencils = doodle("d-pencils", (rc, g, k) => {
      g.append(rc.polygon([[px - 150, py - 6], [px - 50, py - 6], [px - 50, py + 6], [px - 150, py + 6]], { stroke: "#5d4020", strokeWidth: 1.3, fill: "#f7c933", fillStyle: "hachure", hachureGap: 2.5, roughness: 1, seed: 500 + k * 50 }));
      g.append(rc.polygon([[px - 50, py - 6], [px - 32, py], [px - 50, py + 6]], { stroke: "#5d4020", strokeWidth: 1.3, fill: "#e8c9a0", fillStyle: "solid", roughness: 1, seed: 501 + k * 50 }));
      g.append(rc.polygon([[px - 37, py - 2.5], [px - 32, py], [px - 37, py + 2.5]], { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: 502 }));
      g.append(rc.rectangle(px - 160, py - 6, 10, 12, { stroke: "#5d4020", strokeWidth: 1.2, fill: "#f28ab2", fillStyle: "solid", roughness: 1, seed: 503 + k * 50 }));
      g.append(rc.polygon([[px + 40, py - 7], [px + 120, py - 7], [px + 120, py + 7], [px + 40, py + 7]], { stroke: "#2b2f3a", strokeWidth: 1.3, fill: "#3c4fb8", fillStyle: "zigzag", hachureGap: 2.5, roughness: 1, seed: 504 + k * 50 }));
      g.append(rc.polygon([[px + 120, py - 7], [px + 136, py], [px + 120, py + 7]], { stroke: "#2b2f3a", strokeWidth: 1.3, fill: "#3c4fb8", fillStyle: "solid", roughness: 1, seed: 505 + k * 50 }));
      g.append(rc.rectangle(px + 60, py - 7, 40, 14, { stroke: "#2b2f3a", strokeWidth: 1, fill: "#fffaf0", fillStyle: "solid", roughness: 1, seed: 506 + k * 50 }));
    });
    pencilsAt = [px, py];
    void pencils;
  }

  /* ---------- the second crowd: everyone else who lives on this page ---------- */
  {
    const sr = document.querySelector(".cx-side").getBoundingClientRect();
    const sx0 = sr.left - dr.left;
    const rc = rough.svg(deco);
    const farL = Math.max(20, bx0 - 230), wideL = bx0 > 300;
    // a mover is drawn once around (0, 0) and positioned by GSAP
    const mover = (cls, draw) => { const g = svgEl("g", { class: cls }); draw(g); deco.append(g); return g; };

    // 1. a spider lets itself down on a thread from the top, wiggles, and climbs back up
    if (!narrow) {
      const x = W * 0.74;
      const thread = svgEl("line", { x1: x, y1: 0, x2: x, y2: 40, stroke: "#5d6170", "stroke-width": 1 });
      deco.append(thread);
      const spider = mover("d-spider", (g) => {
        g.append(rc.circle(0, 0, 14, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", roughness: 1, seed: 600 }));
        const legs = svgEl("g", { class: "d-legs" });
        legs.append(rc.path("M -5 -2 Q -12 -8 -15 -2 M -5 1 Q -13 -1 -16 5 M 5 -2 Q 12 -8 15 -2 M 5 1 Q 13 -1 16 5", { stroke: "#2b2f3a", strokeWidth: 1.4, roughness: 0.8, seed: 601 }));
        g.append(legs);
        g.append(rc.circle(-2.5, -1, 3, { stroke: "none", fill: "#fff", fillStyle: "solid", seed: 602 }));
        g.append(rc.circle(2.5, -1, 3, { stroke: "none", fill: "#fff", fillStyle: "solid", seed: 603 }));
      });
      const drop = { y: 40 };
      const put = () => { thread.setAttribute("y2", drop.y - 6); G.set(spider, { x, y: drop.y }); };
      put();
      if (anim) {
        loop(G.timeline({ repeat: -1, repeatDelay: 2.5 })
          .to(drop, { y: 150, duration: 2.6, ease: "power1.inOut", onUpdate: put })
          .to(spider.querySelector(".d-legs"), { scaleY: -1, svgOrigin: "0 0", duration: 0.12, yoyo: true, repeat: 7 })
          .to(drop, { y: 132, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut", onUpdate: put })
          .to(drop, { y: 40, duration: 2.2, ease: "power2.inOut", onUpdate: put }));
        loop(G.to(spider, { rotation: 10, svgOrigin: "0 0", duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }

    // 2. a hot-air balloon drifts across the top of the page, its basket swinging
    {
      const bal = mover("d-balloon", (g) => {
        g.append(rc.path("M 0 -40 C 26 -40 30 -10 12 8 L -12 8 C -30 -10 -26 -40 0 -40 Z", { stroke: "#5d4020", strokeWidth: 1.6, fill: "#e8432e", fillStyle: "hachure", hachureGap: 3, roughness: 1.2, seed: 610 }));
        g.append(rc.path("M 0 -40 C 9 -30 9 -6 4 8 M 0 -40 C -9 -30 -9 -6 -4 8", { stroke: "#f7c933", strokeWidth: 3, roughness: 1, seed: 611 }));
        const basket = svgEl("g", { class: "d-basket" });
        basket.append(rc.path("M -10 8 L -7 22 M 10 8 L 7 22", { stroke: "#5d4020", strokeWidth: 1.2, seed: 612 }));
        basket.append(rc.rectangle(-8, 22, 16, 11, { stroke: "#5d4020", strokeWidth: 1.4, fill: "#c8955a", fillStyle: "cross-hatch", hachureGap: 3, roughness: 1, seed: 613 }));
        g.append(basket);
      });
      G.set(bal, { x: W * 0.15, y: 70, scale: narrow ? 0.7 : 1 });
      if (anim) {
        loop(G.fromTo(bal, { x: -80 }, { x: W + 80, duration: narrow ? 40 : 70, ease: "none", repeat: -1, delay: -25 }));
        loop(G.to(bal, { y: 95, duration: 4, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.fromTo(bal.querySelector(".d-basket"), { rotation: -8, svgOrigin: "0 8" }, { rotation: 8, svgOrigin: "0 8", duration: 1.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }

    // 3. birds cross the sky in a little V, flapping
    {
      const birds = [0, 1, 2].map((i) => mover("d-bird", (g) => {
        const wing = svgEl("g", { class: "d-wing" });
        wing.append(rc.path("M -12 0 Q -6 -8 0 0 Q 6 -8 12 0", { stroke: "#2b2f3a", strokeWidth: 1.8, roughness: 0.9, seed: 620 + i }));
        g.append(wing);
      }));
      birds.forEach((b, i) => {
        G.set(b, { x: -60, y: 190 });
        if (!anim) return;
        loop(G.to(b.querySelector(".d-wing"), { scaleY: -0.6, svgOrigin: "0 0", duration: 0.22, yoyo: true, repeat: -1, ease: "sine.inOut", delay: i * 0.07 }));
        loop(G.timeline({ repeat: -1, repeatDelay: 14, delay: 4 + i * 0.25 })
          .set(b, { x: -40 - i * 26, y: 180 + (i % 2) * 18 + (i === 2 ? 30 : 0) })
          .to(b, { x: W + 60, duration: narrow ? 6 : 11, ease: "none" })
          .to(b, { y: "-=40", duration: narrow ? 6 : 11, ease: "sine.inOut" }, "<"));
      });
    }

    // 4. a paper aeroplane loops the loop over the empty paper under the board
    if (!narrow) {
      const plane = mover("d-plane", (g) => {
        g.append(rc.polygon([[18, 0], [-14, -9], [-6, 0]], { stroke: "#3c4fb8", strokeWidth: 1.5, fill: "#fffdf6", fillStyle: "solid", roughness: 0.8, seed: 630 }));
        g.append(rc.polygon([[18, 0], [-14, 9], [-6, 0]], { stroke: "#3c4fb8", strokeWidth: 1.5, fill: "#e6ecf8", fillStyle: "solid", roughness: 0.8, seed: 631 }));
      });
      const trail = svgEl("path", { d: "", stroke: "#3c4fb8", "stroke-width": 1.4, "stroke-dasharray": "4 6", fill: "none", opacity: 0.5 });
      deco.insertBefore(trail, plane);
      const x0 = Math.max(20, bx0 - 120), x1 = Math.min(sx0 - 20, bx1 + 140), cy = Math.min(H - 120, by1 + 190);
      const pos = (u) => { const a = Math.max(0, Math.min(1, (u - 0.4) / 0.25)) * Math.PI * 2; return [x0 + (x1 - x0) * u + Math.sin(a) * 60, cy - (1 - Math.cos(a)) * 55 + Math.sin(u * Math.PI * 2) * 12]; };
      const state = { u: 0 };
      let pts = [];
      G.set(plane, { x: pos(0.3)[0], y: pos(0.3)[1] });
      if (anim) loop(G.timeline({ repeat: -1, repeatDelay: 6 })
        .set(state, { u: 0 })
        .call(() => { pts = []; })
        .to(state, { u: 1, duration: 7, ease: "none", onUpdate: () => {
          const [x, y] = pos(state.u), [nx, ny] = pos(Math.min(1, state.u + 0.005));
          G.set(plane, { x, y, rotation: (Math.atan2(ny - y, nx - x) * 180) / Math.PI, opacity: 1 });
          pts.push(`${x.toFixed(0)} ${y.toFixed(0)}`);
          if (pts.length > 70) pts.shift();
          trail.setAttribute("d", `M ${pts.join(" L ")}`);
        } })
        .to([plane, trail], { opacity: 0, duration: 0.4 }));
    }

    // 5. a turtle takes a slow walk under the board, head bobbing, feet paddling
    {
      const ty = Math.min(H - 70, by1 + 120);
      const turtle = mover("d-turtle", (g) => {
        const legs = [-14, -4, 6, 14].map((lx, i) => { const l = svgEl("g", { class: "d-tleg" }); l.append(rc.ellipse(lx, 9, 7, 9, { stroke: "#3d7a33", strokeWidth: 1.3, fill: "#8cc47a", fillStyle: "solid", roughness: 1, seed: 640 + i })); g.append(l); return l; });
        const head = svgEl("g", { class: "d-thead" });
        head.append(rc.circle(26, -2, 13, { stroke: "#3d7a33", strokeWidth: 1.3, fill: "#8cc47a", fillStyle: "solid", roughness: 1, seed: 645 }));
        head.append(rc.circle(29, -4, 2.4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 646 }));
        g.append(head);
        g.append(rc.path("M -24 6 C -22 -18 22 -18 24 6 Z", { stroke: "#5d4020", strokeWidth: 1.6, fill: "#b07a3a", fillStyle: "hachure", hachureGap: 3, roughness: 1.2, seed: 647 }));
        g.append(rc.path("M -12 -8 L 0 -2 L 12 -8 M 0 -2 L 0 6", { stroke: "#5d4020", strokeWidth: 1.2, roughness: 1, seed: 648 }));
        g.__legs = legs; g.__head = head;
      });
      const left = Math.max(30, bx0 - 40), right = Math.min(sx0 - 60, bx1 + 40);
      G.set(turtle, { x: (left + right) / 2, y: ty, scale: narrow ? 0.8 : 1 });
      if (anim) {
        const turnTurtle = steer(turtle);
        loop(G.timeline({ repeat: -1, yoyo: true }).fromTo(turtle, { x: left }, { x: right, duration: 50, ease: "none",
          onRepeat: () => {}, onUpdate: function () { const dir = this.parent && this.parent.reversed() ? -1 : 1; turnTurtle({ scaleX: (narrow ? 0.8 : 1) * dir }); } }));
        loop(G.to(turtle.__head, { x: 3, y: -2, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        turtle.__legs.forEach((l, i) => loop(G.to(l, { x: i % 2 ? 2.5 : -2.5, duration: 0.45, yoyo: true, repeat: -1, ease: "sine.inOut" })));
      }
    }

    // 6. a caterpillar inches along the bottom edge of the page
    {
      const cy = H - 26;
      const cat = mover("d-caterpillar", (g) => {
        const segs = [];
        for (let i = 0; i < 6; i++) { const sg = svgEl("g", {}); sg.append(rc.circle(-i * 11, 0, 14, { stroke: "#3d7a33", strokeWidth: 1.2, fill: i % 2 ? "#a3d47a" : "#7cc05a", fillStyle: "solid", roughness: 1, seed: 650 + i })); g.prepend(sg); segs.push(sg); }
        const head = segs[0];
        head.append(rc.circle(3, -2, 3, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 657 }));
        head.append(rc.path("M -2 -6 L -4 -14 M 3 -6 L 5 -14", { stroke: "#3d7a33", strokeWidth: 1.2, seed: 658 }));
        g.__segs = segs;
      });
      G.set(cat, { x: 80, y: cy });
      if (anim) {
        const turnCat = steer(cat);
        loop(G.fromTo(cat, { x: 60 }, { x: Math.min(sx0 - 40, W * 0.6), duration: 70, ease: "none", repeat: -1, yoyo: true, onUpdate: function () { turnCat({ scaleX: this.reversed() ? -1 : 1 }); } }));
        loop(G.to(cat.__segs, { y: -7, duration: 0.3, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: { each: 0.09, repeat: -1, yoyo: true } }));
      }
    }

    // 7. a dandelion lets its seeds go, one puff of wind at a time
    if (!narrow) {
      const x = farL + 40, y = Math.min(H - 40, by1 + 230);
      doodle("d-dandelion", (r2, g, k) => {
        g.append(r2.path(`M ${x} ${y} Q ${x - 6} ${y - 40} ${x} ${y - 80}`, { stroke: "#5aa04a", strokeWidth: 1.8, roughness: 1, seed: 660 + k * 50 }));
        g.append(r2.path(`M ${x - 2} ${y - 20} q -14 -6 -18 -16 M ${x - 3} ${y - 34} q 12 -4 16 -14`, { stroke: "#5aa04a", strokeWidth: 1.4, roughness: 1, seed: 661 + k * 50 }));
        g.append(r2.circle(x, y - 84, 8, { stroke: "#7a6a3a", strokeWidth: 1, fill: "#c8b070", fillStyle: "solid", roughness: 1, seed: 662 }));
        for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.append(r2.line(x, y - 84, x + Math.cos(a) * 18, y - 84 + Math.sin(a) * 18, { stroke: "#9a9a9a", strokeWidth: 0.8, roughness: 0.6, seed: 663 + i })); }
      });
      if (anim) loop(G.timeline({ repeat: -1 }).call(() => {
        const seed = svgEl("g", {});
        seed.append(rc.line(0, 0, 0, 10, { stroke: "#8a7a5a", strokeWidth: 0.8, seed: 670 }));
        for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.35; seed.append(rc.line(0, 0, Math.cos(a) * 7, Math.sin(a) * 7, { stroke: "#9a9a9a", strokeWidth: 0.7, seed: 671 + i })); }
        deco.append(seed);
        G.timeline({ onComplete: () => seed.remove() })
          .set(seed, { x: x + R(-12, 12), y: y - 84 + R(-12, 12) })
          .to(seed, { x: `+=${R(160, 320)}`, duration: 9, ease: "sine.inOut" }, 0)
          .to(seed, { y: `-=${R(120, 260)}`, rotation: R(-40, 40), duration: 9, ease: "sine.out" }, 0)
          .to(seed, { opacity: 0, duration: 1.5 }, 7.5);
      }).to({}, { duration: 2.2 }));
    }

    // 8. a rain cloud waters a flower; every drop makes the flower grow a little, then it shakes and starts again
    if (!narrow && sx0 - bx1 > 90) {
      const x = (bx1 + sx0) / 2, cy0 = by0 + 30, fy = by0 + 230;
      const cloud = doodle("d-raincloud", (r2, g, k) => {
        [[-18, 4, 32, 22], [16, 4, 32, 22], [0, -6, 38, 30]].forEach(([dx, dy, w2, h2], j) => g.append(r2.ellipse(x + dx, cy0 + dy, w2, h2, { stroke: "#5d6170", strokeWidth: 1.4, fill: "#dfe4ee", fillStyle: "solid", roughness: 1.2, seed: 680 + j + k * 50 })));
        face(g, r2, x, cy0, 9, false, k * 50 + 3);
      });
      const flower = doodle("d-grower", (r2, g, k) => {
        g.append(r2.path(`M ${x} ${fy} L ${x} ${fy - 40}`, { stroke: "#5aa04a", strokeWidth: 2, roughness: 0.9, seed: 690 + k * 50 }));
        g.append(r2.path(`M ${x} ${fy - 14} q 12 -2 14 -12 q -12 0 -14 12`, { stroke: "#3d7a33", strokeWidth: 1.2, fill: "#7cb26a", fillStyle: "solid", roughness: 0.8, seed: 691 + k * 50 }));
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.append(r2.ellipse(x + Math.cos(a) * 7, fy - 46 + Math.sin(a) * 7, 10, 9, { stroke: "#a3322a", strokeWidth: 1, fill: "#f28ab2", fillStyle: "solid", roughness: 0.8, seed: 692 + i })); }
        g.append(r2.circle(x, fy - 46, 8, { stroke: "none", fill: "#f7c933", fillStyle: "solid", seed: 699 }));
        g.append(r2.ellipse(x, fy + 2, 34, 8, { stroke: "#7a5a2a", strokeWidth: 1.2, fill: "#b08a5a", fillStyle: "hachure", hachureGap: 2.5, roughness: 1, seed: 700 + k * 50 }));
      });
      if (anim) {
        loop(G.to(cloud, { x: 10, duration: 3, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        let growth = 1;
        loop(G.timeline({ repeat: -1, repeatDelay: 0.2 }).call(() => {
          const d = rc.path("M 0 0 q -3 6 0 8 q 3 -2 0 -8 Z", { stroke: "#3c6fc0", strokeWidth: 0.8, fill: "#8ec0f4", fillStyle: "solid", roughness: 0.4, seed: 710 });
          deco.append(d);
          const dx = x + R(-14, 14) + (G.getProperty(cloud, "x") || 0);
          G.timeline({ onComplete: () => {
            d.remove();
            growth = growth >= 1.45 ? 1 : growth + 0.05;
            if (growth === 1) G.fromTo(flower, { rotation: -8, svgOrigin: `${x} ${fy}` }, { rotation: 0, svgOrigin: `${x} ${fy}`, duration: 0.8, ease: "elastic.out(1, 0.3)" });
            G.to(flower, { scaleY: growth, scaleX: 0.9 + growth * 0.1, svgOrigin: `${x} ${fy}`, duration: 0.4, ease: "back.out(3)" });
          } }).fromTo(d, { x: dx, y: cy0 + 14 }, { y: fy - 40 * growth - 6, duration: 0.6, ease: "power1.in" });
        }).to({}, { duration: 0.55 }));
      }
      // 9. a bee loops round the flower in a figure eight
      const bee = mover("d-bee", (g) => {
        const wg = svgEl("g", { class: "d-bwings" });
        wg.append(rc.ellipse(-2, -6, 8, 10, { stroke: "#5d6170", strokeWidth: 0.8, fill: "rgba(255,255,255,0.85)", fillStyle: "solid", seed: 720 }));
        wg.append(rc.ellipse(3, -6, 8, 10, { stroke: "#5d6170", strokeWidth: 0.8, fill: "rgba(255,255,255,0.85)", fillStyle: "solid", seed: 721 }));
        g.append(wg);
        g.append(rc.ellipse(0, 0, 16, 11, { stroke: "#3a2a1a", strokeWidth: 1.2, fill: "#f7c933", fillStyle: "solid", roughness: 0.8, seed: 722 }));
        g.append(rc.path("M -2 -5 L -2 5 M 3 -5 L 3 5", { stroke: "#3a2a1a", strokeWidth: 1.6, seed: 723 }));
      });
      if (anim) {
        loop(G.to(bee.querySelector(".d-bwings"), { scaleY: 0.3, svgOrigin: "0 -2", duration: 0.05, yoyo: true, repeat: -1 }));
        const b8 = { a: 0 };
        const beeTo = steer(bee);
        loop(G.to(b8, { a: Math.PI * 2, duration: 5, repeat: -1, ease: "none", onUpdate: () => {
          const bx = x + Math.sin(b8.a) * 48, by = fy - 70 + Math.sin(b8.a * 2) * 22;
          beeTo({ x: bx, y: by, scaleX: Math.cos(b8.a) >= 0 ? 1 : -1 });
        } }));
      } else G.set(bee, { x: x + 30, y: fy - 70 });
    }

    // 10. a kite flies in the left margin, its tail of bows rippling in the wind
    if (!narrow && wideL) {
      const kx = farL + 70, ky = by0 + 30;
      const kite = mover("d-kite", (g) => {
        g.append(rc.polygon([[0, -26], [18, 0], [0, 34], [-18, 0]], { stroke: "#5d4020", strokeWidth: 1.5, fill: "#3c8fd8", fillStyle: "hachure", hachureGap: 3, roughness: 1.1, seed: 730 }));
        g.append(rc.path("M 0 -26 L 0 34 M -18 0 L 18 0", { stroke: "#5d4020", strokeWidth: 1.1, roughness: 0.8, seed: 731 }));
        const tail = svgEl("g", { class: "d-ktail" });
        for (let i = 0; i < 6; i++) { const b = svgEl("g", {}); b.append(rc.path(`M -6 ${44 + i * 14} L 6 ${38 + i * 14} L 6 ${50 + i * 14} L -6 ${44 + i * 14} L -6 ${38 + i * 14} L 6 ${50 + i * 14}`, { stroke: "#e8432e", strokeWidth: 1.2, fill: "#f28ab2", fillStyle: "solid", roughness: 0.8, seed: 732 + i })); tail.append(b); }
        tail.prepend(rc.path("M 0 34 Q 8 60 0 80 Q -8 100 0 120", { stroke: "#5d4020", strokeWidth: 1, roughness: 0.8, seed: 740 }));
        g.append(tail);
      });
      const string = svgEl("path", { d: "", stroke: "#5d6170", "stroke-width": 1, fill: "none" });
      deco.insertBefore(string, kite);
      const sp = { x: kx, y: ky };
      const drawString = () => { const kx2 = G.getProperty(kite, "x"), ky2 = G.getProperty(kite, "y") + 34; string.setAttribute("d", `M ${kx2} ${ky2} Q ${kx2 - 40} ${(ky2 + by1) / 2 + 60} ${farL} ${by1 - 60}`); };
      G.set(kite, { x: sp.x, y: sp.y });
      drawString();
      if (anim) {
        loop(G.to(kite, { x: kx + 26, y: ky - 16, rotation: 10, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut", onUpdate: drawString }));
        loop(G.to([...kite.querySelectorAll(".d-ktail > g")], { x: 7, duration: 0.45, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: { each: 0.1, repeat: -1, yoyo: true } }));
      }
    }

    // 11. a fish leaps out of the waves by the whale now and then
    {
      const wsc = narrow ? 0.62 : 0.9;
      const wx = W - WHALE_W * wsc - 12, wy = H - 168 * wsc - 26 + 160 * wsc;
      const fish = mover("d-fish", (g) => {
        g.append(rc.ellipse(0, 0, 26, 13, { stroke: "#c8452e", strokeWidth: 1.3, fill: "#f08a24", fillStyle: "hachure", hachureGap: 2.4, roughness: 1, seed: 750 }));
        g.append(rc.polygon([[-12, 0], [-22, -8], [-22, 8]], { stroke: "#c8452e", strokeWidth: 1.2, fill: "#f08a24", fillStyle: "solid", roughness: 0.8, seed: 751 }));
        g.append(rc.circle(6, -2, 2.6, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 752 }));
      });
      G.set(fish, { x: wx - 20, y: wy, opacity: 0 });
      if (anim) loop(G.timeline({ repeat: -1, repeatDelay: 5, delay: 3 })
        .set(fish, { x: wx - 10, y: wy, rotation: -60, opacity: 1 })
        .to(fish, { x: wx - 80, duration: 1.1, ease: "none" })
        .to(fish, { keyframes: [{ y: wy - 70, duration: 0.55, ease: "power2.out" }, { y: wy + 6, duration: 0.55, ease: "power2.in" }] }, "<")
        .to(fish, { rotation: -200, duration: 1.1, ease: "none" }, "<")
        .call(() => { if (!anim) return; for (let i = 0; i < 5; i++) { const d = rc.circle(0, 0, 5, { stroke: "#3c8fd8", strokeWidth: 1, fill: "#8ec0f4", fillStyle: "solid", seed: 760 + i }); deco.append(d); G.timeline({ onComplete: () => d.remove() }).set(d, { x: wx - 80, y: wy }).to(d, { x: `+=${R(-24, 24)}`, y: `-=${R(14, 34)}`, opacity: 0, duration: 0.6, ease: "power2.out" }); } })
        .set(fish, { opacity: 0 }));
    }

    // 12. a stack of books with a bookworm that peeks out, looks around and hides again
    if (!narrow && wideL) {
      const x = farL + 40, y = Math.min(H - 150, by1 + 90);
      doodle("d-books", (r2, g, k) => {
        [["#c8452e", 0, 60], ["#3c4fb8", 6, 52], ["#5aa04a", -4, 56]].forEach(([col, dx, w2], j) => g.append(r2.rectangle(x - w2 / 2 + dx, y - (j + 1) * 14, w2, 13, { stroke: "#3a2a1a", strokeWidth: 1.3, fill: col, fillStyle: "hachure", hachureGap: 2.6, roughness: 1, seed: 770 + j + k * 50 })));
      });
      const worm = mover("d-worm", (g) => {
        g.append(rc.path("M 0 0 C 0 -10 4 -16 8 -18", { stroke: "#d06a7a", strokeWidth: 7, roughness: 0.6, seed: 780 }));
        g.append(rc.circle(9, -19, 9, { stroke: "#a04a5a", strokeWidth: 1, fill: "#f3a0a6", fillStyle: "solid", seed: 781 }));
        g.append(rc.circle(11, -21, 2.2, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 782 }));
      });
      G.set(worm, { x: x + 22, y: y - 42, scaleY: 0, svgOrigin: "0 0" });
      if (anim) loop(G.timeline({ repeat: -1, repeatDelay: 3.5, delay: 2 })
        .to(worm, { scaleY: 1, svgOrigin: "0 0", duration: 0.4, ease: "back.out(3)" })
        .to(worm, { rotation: -20, svgOrigin: "0 0", duration: 0.4, yoyo: true, repeat: 3, ease: "sine.inOut" })
        .to(worm, { scaleY: 0, svgOrigin: "0 0", duration: 0.25, ease: "power2.in" }, "+=0.3"));
    }

    // 13. a sleepy cat curled up at the foot of the page, its tail flicking and its side rising and falling
    if (!narrow) {
      const x = Math.min(sx0 - 90, bx1 + 60), y = H - 50;
      const cat2 = doodle("d-cat", (r2, g, k) => {
        g.append(r2.ellipse(x, y, 70, 34, { stroke: "#5d4020", strokeWidth: 1.6, fill: "#f2a04a", fillStyle: "hachure", hachureGap: 2.8, roughness: 1.2, seed: 790 + k * 50 }));
        g.append(r2.circle(x + 30, y - 6, 30, { stroke: "#5d4020", strokeWidth: 1.6, fill: "#f2a04a", fillStyle: "hachure", hachureGap: 2.8, roughness: 1.2, seed: 791 + k * 50 }));
        g.append(r2.polygon([[x + 20, y - 18], [x + 22, y - 32], [x + 30, y - 21]], { stroke: "#5d4020", strokeWidth: 1.4, fill: "#f2a04a", fillStyle: "solid", seed: 792 }));
        g.append(r2.polygon([[x + 34, y - 21], [x + 42, y - 32], [x + 42, y - 16]], { stroke: "#5d4020", strokeWidth: 1.4, fill: "#f2a04a", fillStyle: "solid", seed: 793 }));
        g.append(r2.path(`M ${x + 22} ${y - 6} q 3 2 6 0 M ${x + 33} ${y - 6} q 3 2 6 0`, { stroke: "#3a2a1a", strokeWidth: 1.4, roughness: 0.6, seed: 794 }));
        g.append(r2.path(`M ${x - 20} ${y - 8} q -6 6 -2 12 M ${x + 4} ${y - 12} q -4 6 0 12`, { stroke: "#c06a2a", strokeWidth: 1.6, roughness: 1, seed: 795 + k * 50 }));
      });
      const tail = doodle("d-cattail", (r2, g, k) => g.append(r2.path(`M ${x - 32} ${y + 4} Q ${x - 56} ${y} ${x - 54} ${y - 18}`, { stroke: "#c06a2a", strokeWidth: 5, roughness: 1, seed: 796 + k * 50 })));
      if (anim) {
        loop(G.to(cat2, { scaleY: 1.06, svgOrigin: `${x} ${y + 17}`, duration: 1.7, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.timeline({ repeat: -1, repeatDelay: 1.5 }).to(tail, { rotation: -22, svgOrigin: `${x - 32} ${y + 4}`, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut" }));
        loop(G.timeline({ repeat: -1 }).call(() => {
          const z = svgEl("text", { x: x + 46, y: y - 30, class: "cx-zz", fill: "#c06a2a", "font-size": 16 });
          z.textContent = "z";
          deco.append(z);
          G.timeline({ onComplete: () => z.remove() }).fromTo(z, { opacity: 0 }, { opacity: 1, duration: 0.4 }).to(z, { x: 18, y: -34, rotation: 15, opacity: 0, duration: 2.4, ease: "sine.out" }, 0);
        }).to({}, { duration: 1.6 }));
      }
    }
  }

  // on wide screens the margin right of the panel gets a tree that drops apples and a rabbit that hops about
  {
    const sr = document.querySelector(".cx-side").getBoundingClientRect();
    const free = W - (sr.right - dr.left);
    if (!narrow && free > 220) {
      const rc = rough.svg(deco);
      const tx = sr.right - dr.left + free / 2, ty = Math.min(H - 220, by1 + 40);
      const trunk = doodle("d-tree", (r2, g, k) => {
        g.append(r2.path(`M ${tx - 10} ${ty} C ${tx - 6} ${ty - 60} ${tx - 8} ${ty - 110} ${tx - 4} ${ty - 150} L ${tx + 6} ${ty - 150} C ${tx + 8} ${ty - 110} ${tx + 6} ${ty - 60} ${tx + 12} ${ty} Z`, { stroke: "#5d4020", strokeWidth: 1.6, fill: "#9a6a3a", fillStyle: "hachure", hachureGap: 3, roughness: 1.2, seed: 800 + k * 50 }));
        g.append(r2.ellipse(tx, ty + 2, 90, 14, { stroke: "#3d7a33", strokeWidth: 1.2, fill: "#8cc47a", fillStyle: "hachure", hachureGap: 3, roughness: 1.2, seed: 801 + k * 50 }));
      });
      const crown = doodle("d-crown", (r2, g, k) => {
        [[-40, -170, 90, 70], [36, -176, 86, 66], [0, -210, 100, 80], [-22, -150, 70, 50], [26, -148, 70, 50]].forEach(([dx, dy, w2, h2], j) => g.append(r2.ellipse(tx + dx, ty + dy, w2, h2, { stroke: "#2f6a2a", strokeWidth: 1.4, fill: "#5aa04a", fillStyle: "hachure", hachureGap: 3, roughness: 1.3, seed: 810 + j + k * 50 })));
        [[-30, -190], [20, -200], [44, -160], [-46, -160], [4, -170]].forEach(([dx, dy], j) => g.append(r2.circle(tx + dx, ty + dy, 12, { stroke: "#8a2a1a", strokeWidth: 1.2, fill: "#e8432e", fillStyle: "solid", roughness: 0.8, seed: 820 + j })));
      });
      void trunk;
      if (anim) {
        loop(G.fromTo(crown, { rotation: -2, svgOrigin: `${tx} ${ty - 150}` }, { rotation: 2, svgOrigin: `${tx} ${ty - 150}`, duration: 2.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        // an apple falls, bounces and rolls away
        loop(G.timeline({ repeat: -1, repeatDelay: 7, delay: 4 }).call(() => {
          const a = rc.circle(0, 0, 12, { stroke: "#8a2a1a", strokeWidth: 1.2, fill: "#e8432e", fillStyle: "solid", roughness: 0.8, seed: 830 });
          deco.append(a);
          const dir = Math.random() < 0.5 ? -1 : 1;
          G.timeline({ onComplete: () => a.remove() })
            .set(a, { x: tx + R(-40, 40), y: ty - 170 })
            .to(a, { y: ty - 4, duration: 0.7, ease: "power2.in" })
            .to(a, { y: ty - 24, duration: 0.2, yoyo: true, repeat: 1, ease: "power1.out" })
            .to(a, { x: `+=${dir * 90}`, rotation: dir * 360, duration: 1.4, ease: "power1.out" }, "-=0.2")
            .to(a, { opacity: 0, duration: 0.5 });
        }));
      }
      // the rabbit hops back and forth under the tree, stops, twitches its ears
      const rab = svgEl("g", { class: "d-rabbit" });
      const ears = svgEl("g", {});
      ears.append(rc.ellipse(-4, -26, 7, 22, { stroke: "#7a6a6a", strokeWidth: 1.3, fill: "#f6f0ea", fillStyle: "solid", roughness: 1, seed: 840 }));
      ears.append(rc.ellipse(5, -26, 7, 22, { stroke: "#7a6a6a", strokeWidth: 1.3, fill: "#f6f0ea", fillStyle: "solid", roughness: 1, seed: 841 }));
      rab.append(ears);
      rab.append(rc.ellipse(-6, 6, 32, 24, { stroke: "#7a6a6a", strokeWidth: 1.4, fill: "#f6f0ea", fillStyle: "solid", roughness: 1, seed: 842 }));
      rab.append(rc.circle(4, -10, 20, { stroke: "#7a6a6a", strokeWidth: 1.4, fill: "#f6f0ea", fillStyle: "solid", roughness: 1, seed: 843 }));
      rab.append(rc.circle(-22, 8, 8, { stroke: "#7a6a6a", strokeWidth: 1, fill: "#fff", fillStyle: "solid", seed: 844 }));
      rab.append(rc.circle(8, -12, 2.6, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 845 }));
      rab.append(rc.circle(13, -8, 2, { stroke: "none", fill: "#f28ab2", fillStyle: "solid", seed: 846 }));
      deco.append(rab);
      const ry = Math.min(H - 60, ty + 60), rl = tx - free / 2 + 30, rr = tx + free / 2 - 30;
      G.set(rab, { x: rl + 20, y: ry });
      if (anim) {
        const hop = (to) => G.timeline()
          .to(rab, { scaleY: 0.85, svgOrigin: "0 18", duration: 0.1 })
          .to(rab, { x: to, duration: 0.45, ease: "none" })
          .to(rab, { keyframes: [{ y: ry - 30, duration: 0.22, ease: "power2.out" }, { y: ry, duration: 0.23, ease: "power2.in" }], scaleY: 1 }, "<");
        const tl = G.timeline({ repeat: -1, repeatDelay: 1 });
        const stops = [rl + 20, rl + 70, rl + 130, rr - 20, rr - 80, rl + 60];
        let last = rl + 20;
        stops.forEach((x) => {
          const dir = x >= last ? 1 : -1;
          tl.set(rab, { scaleX: dir }).add(hop(x)).to(ears, { rotation: 12, svgOrigin: "0 -14", duration: 0.12, yoyo: true, repeat: 3 }).to({}, { duration: R(0.6, 1.6) });
          last = x;
        });
        loop(tl);
      }
    }
  }

  /* ---------- the beach: the paper is the sand, the sea comes in at the bottom-right corner ---------- */
  {
    const rc = rough.svg(deco);
    const seaW = narrow ? W * 0.9 : Math.min(560, Math.max(340, W * 0.3)), seaH = narrow ? 230 : Math.min(270, H * 0.3);
    const sx = W - seaW, sy = H - seaH;
    // the shoreline is a curve from the bottom edge up to the right edge; B(t) walks along it
    const P0 = [sx, H + 4], P1 = [sx + seaW * 0.12, sy + seaH * 0.05], P2 = [W + 4, sy - 6];
    const B = (t, off = 0) => {
      const a = [P0[0] - off, P0[1]], b = [P1[0] - off * 0.8, P1[1] - off * 0.8], c = [P2[0], P2[1] - off];
      const u = 1 - t;
      return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
    };
    // a point in the water: d = 0 at the shore, 1 at the corner
    const inSea = (t, d) => { const [x, y] = B(t); return [x + (W - x) * d, y + (H - y) * d]; };
    const curve = (off) => { let d = ""; for (let i = 0; i <= 24; i++) { const [x, y] = B(i / 24, off); d += `${i ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)} `; } return d; };
    const seaPath = `${curve(0)} L ${W + 4} ${H + 4} Z`;
    const sandPath = `${curve(46)} L ${(B(1, 0))[0]} ${(B(1, 0))[1]} ${[...Array(25)].map((_, i) => { const [x, y] = B(1 - i / 24); return `L ${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ")} Z`;
    // no grass grows in the sea
    deco.querySelectorAll(".d-tuft").forEach((t) => { try { const b = t.getBBox(); if (b.x + b.width > B((b.y - sy) > 0 ? 0 : 0)[0] - 30 && b.x > sx - 30) t.remove(); } catch { /* not rendered */ } });
    const whaleEl = deco.querySelector(".d-whale");
    const under = (g) => { if (whaleEl) deco.insertBefore(g, whaleEl); };

    // drawn once (no boiling): big areas that change every frame are too costly to repaint
    const sand = svgEl("g", { class: "d-sand" });
    sand.append(rc.path(sandPath, { stroke: "none", fill: "rgba(214,184,130,0.35)", fillStyle: "solid", roughness: 1, seed: 900 }));
    let grains = "";
    for (let i = 0; i < 140; i++) { const t = Math.random(), [x, y] = B(t, 6 + Math.random() * 38); grains += `M ${x.toFixed(1)} ${y.toFixed(1)} l 1.4 0.6 `; }
    sand.append(rc.path(grains, { stroke: "#a8885a", strokeWidth: 1.6, roughness: 0.3, seed: 901 }));
    deco.append(sand);
    const sea = svgEl("g", { class: "d-sea" });
    sea.append(rc.path(seaPath, { stroke: "none", fill: "rgba(120,180,230,0.38)", fillStyle: "solid", roughness: 1.2, seed: 910 }));
    sea.append(rc.path(seaPath, { stroke: "#3c6fc0", strokeWidth: 1.6, fill: "rgba(60,111,192,0.5)", fillStyle: "hachure", hachureAngle: -20, hachureGap: 13, fillWeight: 1.1, roughness: 1.3, seed: 911 }));
    deco.append(sea);
    under(sand); under(sea);
    // foam along the shore, washing in and out
    const foam = svgEl("g", { class: "d-foam" });
    foam.append(rc.path(curve(-4), { stroke: "#ffffff", strokeWidth: 5, roughness: 1.8, seed: 920 }));
    foam.append(rc.path(curve(4), { stroke: "#cfe6f8", strokeWidth: 2.4, roughness: 2, seed: 921 }));
    under(foam);
    // little wave marks drifting across the water
    const waves = svgEl("g", { class: "d-seawaves" });
    for (let i = 0; i < 7; i++) { const [x, y] = inSea(0.2 + (i % 4) * 0.2, 0.25 + Math.floor(i / 4) * 0.35); waves.append(rc.path(`M ${x - 14} ${y} q 7 -6 14 0 q 7 -6 14 0`, { stroke: "#ffffff", strokeWidth: 1.8, roughness: 0.8, seed: 930 + i })); }
    under(waves);
    if (anim) {
      loop(G.to(foam, { x: -7, y: -7, duration: 2.4, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      loop(G.to(waves.children, { x: 12, duration: 2, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: { each: 0.3, repeat: -1, yoyo: true } }));
    }
    const mover = (cls, draw) => { const g = svgEl("g", { class: cls }); draw(g); deco.append(g); return g; };
    const k0 = narrow ? 0.7 : 1;

    // starfish and shells on the sand
    [[0.18, "#f08a24"], [0.62, "#e8432e"]].forEach(([t, col], i) => {
      const [x, y] = B(t, 26);
      const st = mover("d-starfish", (g) => {
        g.append(rc.polygon(starPts(0, 0, 13, 6), { stroke: "#9a4a1a", strokeWidth: 1.3, fill: col, fillStyle: "hachure", hachureGap: 2.2, roughness: 1.1, seed: 940 + i }));
        g.append(rc.circle(-2, -2, 2, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 942 }));
        g.append(rc.circle(3, -2, 2, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 943 }));
      });
      G.set(st, { x, y, scale: k0 });
      if (anim) loop(G.to(st, { rotation: i ? -12 : 12, duration: 1.8 + i * 0.4, yoyo: true, repeat: -1, ease: "sine.inOut" }));
    });
    {
      const [x, y] = B(0.42, 30);
      const shell = mover("d-shell", (g) => {
        g.append(rc.path("M 0 8 L -12 -6 Q 0 -16 12 -6 Z", { stroke: "#a0705a", strokeWidth: 1.3, fill: "#f6d2c2", fillStyle: "solid", roughness: 1, seed: 950 }));
        g.append(rc.path("M 0 8 L -6 -11 M 0 8 L 0 -13 M 0 8 L 6 -11", { stroke: "#a0705a", strokeWidth: 1, seed: 951 }));
      });
      G.set(shell, { x, y, scale: k0 });
    }

    // a crab scuttles sideways along the wet sand, snapping its claws
    {
      const crab = mover("d-crab", (g) => {
        const legs = svgEl("g", { class: "d-clegs" });
        legs.append(rc.path("M -10 4 l -10 6 M -8 7 l -8 8 M 10 4 l 10 6 M 8 7 l 8 8", { stroke: "#a3322a", strokeWidth: 1.6, roughness: 0.8, seed: 960 }));
        g.append(legs);
        const cl = svgEl("g", { class: "d-claw" }), cr = svgEl("g", { class: "d-claw" });
        cl.append(rc.path("M -12 -2 L -20 -12 M -20 -12 q -8 -4 -6 -10 q 6 2 6 10 M -20 -12 q -2 -8 4 -10", { stroke: "#a3322a", strokeWidth: 1.6, fill: "#e8432e", fillStyle: "solid", roughness: 0.8, seed: 961 }));
        cr.append(rc.path("M 12 -2 L 20 -12 M 20 -12 q 8 -4 6 -10 q -6 2 -6 10 M 20 -12 q 2 -8 -4 -10", { stroke: "#a3322a", strokeWidth: 1.6, fill: "#e8432e", fillStyle: "solid", roughness: 0.8, seed: 962 }));
        g.append(cl, cr);
        g.append(rc.ellipse(0, 2, 28, 18, { stroke: "#a3322a", strokeWidth: 1.6, fill: "#e8432e", fillStyle: "hachure", hachureGap: 2.2, roughness: 1, seed: 963 }));
        g.append(rc.path("M -5 -6 L -6 -14 M 5 -6 L 6 -14", { stroke: "#a3322a", strokeWidth: 1.4, seed: 964 }));
        g.append(rc.circle(-6, -15, 5, { stroke: "#1f1a2a", strokeWidth: 1, fill: "#fff", fillStyle: "solid", seed: 965 }));
        g.append(rc.circle(6, -15, 5, { stroke: "#1f1a2a", strokeWidth: 1, fill: "#fff", fillStyle: "solid", seed: 966 }));
        g.append(rc.circle(-6, -15, 2, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 967 }));
        g.append(rc.circle(6, -15, 2, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 968 }));
        g.append(rc.arc(0, 3, 8, 5, 0.3, Math.PI - 0.3, false, { stroke: "#1f1a2a", strokeWidth: 1, seed: 969 }));
      });
      const c = { t: 0.25 };
      const put = () => { const [x, y] = B(c.t, 22); G.set(crab, { x, y, scale: k0 }); };
      put();
      if (anim) {
        loop(G.timeline({ repeat: -1 })
          .to(c, { t: 0.7, duration: 7, ease: "sine.inOut", onUpdate: put })
          .to({}, { duration: 1.2 })
          .to(c, { t: 0.15, duration: 8, ease: "sine.inOut", onUpdate: put })
          .to({}, { duration: 1 }));
        loop(G.to(crab.querySelector(".d-clegs"), { y: -2, duration: 0.12, yoyo: true, repeat: -1 }));
        const claws = crab.querySelectorAll(".d-claw");
        loop(G.timeline({ repeat: -1, repeatDelay: 1.6 }).to(claws, { rotation: (i) => (i ? -18 : 18), svgOrigin: "0 -6", duration: 0.12, yoyo: true, repeat: 5 }));
      }
    }

    // the mermaid sits on a rock in the shallows: she waves, her tail flips, her hair drifts, bubbles rise
    {
      const [mx, my] = inSea(narrow ? 0.45 : 0.32, 0.22);
      const merm = mover("d-mermaid", (g) => {
        g.append(rc.ellipse(4, 22, 96, 34, { stroke: "#5d6170", strokeWidth: 1.6, fill: "#a8aab4", fillStyle: "hachure", hachureGap: 3, roughness: 1.4, seed: 980 }));
        const hair = svgEl("g", { class: "d-hair" });
        hair.append(rc.path("M -14 -56 C -30 -46 -30 -20 -22 -4 C -16 -14 -12 -28 -8 -44 Z", { stroke: "#a3322a", strokeWidth: 1.4, fill: "#e8532e", fillStyle: "hachure", hachureGap: 2, roughness: 1, seed: 981 }));
        g.append(hair);
        const tail = svgEl("g", { class: "d-mtail" });
        tail.append(rc.path("M -12 -4 C -16 20 12 34 36 26 L 38 18 C 16 22 6 14 10 -4 Z", { stroke: "#1f6a5a", strokeWidth: 1.5, fill: "#3fb39a", fillStyle: "hachure", hachureGap: 2.2, roughness: 1, seed: 982 }));
        tail.append(rc.path("M -6 6 q 4 3 8 0 M 4 14 q 4 3 8 0 M 16 20 q 4 3 8 0", { stroke: "#1f6a5a", strokeWidth: 1, seed: 983 }));
        const fin = svgEl("g", { class: "d-mfin" });
        fin.append(rc.path("M 36 22 L 58 6 L 52 24 L 62 40 Z", { stroke: "#1f6a5a", strokeWidth: 1.5, fill: "#6fd0b8", fillStyle: "solid", roughness: 1, seed: 984 }));
        tail.append(fin);
        g.append(tail);
        g.append(rc.path("M -11 -4 L -9 -32 L 11 -32 L 12 -4 Z", { stroke: "#a06a4a", strokeWidth: 1.4, fill: "#f6c9a0", fillStyle: "solid", roughness: 1, seed: 985 }));
        g.append(rc.circle(-5, -24, 8, { stroke: "#c06a8a", strokeWidth: 1.2, fill: "#f28ab2", fillStyle: "solid", seed: 986 }));
        g.append(rc.circle(5, -24, 8, { stroke: "#c06a8a", strokeWidth: 1.2, fill: "#f28ab2", fillStyle: "solid", seed: 987 }));
        const arm = svgEl("g", { class: "d-marm" });
        arm.append(rc.path("M 10 -30 L 24 -50", { stroke: "#a06a4a", strokeWidth: 4, roughness: 0.6, seed: 988 }));
        arm.append(rc.circle(25, -52, 7, { stroke: "#a06a4a", strokeWidth: 1, fill: "#f6c9a0", fillStyle: "solid", seed: 989 }));
        g.append(arm);
        g.append(rc.path("M -10 -30 L -18 -12", { stroke: "#a06a4a", strokeWidth: 4, roughness: 0.6, seed: 990 }));
        const head = svgEl("g", { class: "d-mhead" });
        head.append(rc.circle(0, -45, 24, { stroke: "#a06a4a", strokeWidth: 1.4, fill: "#f6c9a0", fillStyle: "solid", roughness: 1, seed: 991 }));
        head.append(rc.path("M -13 -50 C -10 -62 10 -64 13 -50 C 6 -56 -6 -56 -13 -50 Z", { stroke: "#a3322a", strokeWidth: 1.2, fill: "#e8532e", fillStyle: "solid", roughness: 1, seed: 992 }));
        const eyes = svgEl("g", { class: "d-meyes" });
        eyes.append(rc.circle(-4, -45, 3, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 993 }));
        eyes.append(rc.circle(5, -45, 3, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 994 }));
        head.append(eyes);
        head.append(rc.arc(1, -40, 8, 5, 0.3, Math.PI - 0.3, false, { stroke: "#a3322a", strokeWidth: 1.2, seed: 995 }));
        head.append(rc.ellipse(-8, -40, 5, 3, { stroke: "none", fill: "#f3a0a6", fillStyle: "solid", seed: 996 }));
        head.append(rc.ellipse(9, -40, 5, 3, { stroke: "none", fill: "#f3a0a6", fillStyle: "solid", seed: 997 }));
        g.append(head);
        g.append(rc.polygon(starPts(-8, -62, 5, 2.4), { stroke: "#b57a10", strokeWidth: 1, fill: "#f7c933", fillStyle: "solid", seed: 998 }));
      });
      G.set(merm, { x: mx, y: my, scale: (narrow ? 0.6 : 0.9) });
      if (anim) {
        loop(G.timeline({ repeat: -1, repeatDelay: 2.5 }).to(merm.querySelector(".d-marm"), { rotation: -30, svgOrigin: "10 -30", duration: 0.25, yoyo: true, repeat: 5, ease: "sine.inOut" }));
        loop(G.fromTo(merm.querySelector(".d-mfin"), { rotation: -14, svgOrigin: "38 22" }, { rotation: 18, svgOrigin: "38 22", duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.fromTo(merm.querySelector(".d-mtail"), { rotation: -3, svgOrigin: "0 0" }, { rotation: 4, svgOrigin: "0 0", duration: 1.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.fromTo(merm.querySelector(".d-hair"), { rotation: -6, svgOrigin: "-12 -50" }, { rotation: 6, svgOrigin: "-12 -50", duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.fromTo(merm.querySelector(".d-mhead"), { rotation: -5, svgOrigin: "0 -30" }, { rotation: 5, svgOrigin: "0 -30", duration: 2.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.timeline({ repeat: -1, repeatDelay: 3.4 }).to(merm.querySelector(".d-meyes"), { scaleY: 0.1, svgOrigin: "0 -45", duration: 0.07, yoyo: true, repeat: 1 }));
        loop(G.timeline({ repeat: -1 }).call(() => {
          const b = rc.circle(0, 0, R(4, 8), { stroke: "#ffffff", strokeWidth: 1.2, roughness: 0.6, seed: 999 });
          deco.append(b);
          G.timeline({ onComplete: () => b.remove() }).set(b, { x: mx + R(30, 60), y: my + 20 }).to(b, { y: `-=${R(30, 60)}`, x: `+=${R(-8, 8)}`, opacity: 0, duration: 1.8, ease: "sine.out" });
        }).to({}, { duration: 0.7 }));
      }
    }

    // two dolphins leap out of the water, one after the other, with a splash going in and coming out
    {
      const dolphin = () => mover("d-dolphin", (g) => {
        g.append(rc.path("M -30 4 L -42 -6 L -38 6 L -44 14 Z", { stroke: "#3a5a8a", strokeWidth: 1.4, fill: "#7aa0d0", fillStyle: "solid", roughness: 1, seed: 1000 }));
        g.append(rc.path("M -30 4 C -20 -14 16 -16 30 -2 L 40 -4 L 32 4 C 18 10 -14 14 -30 4 Z", { stroke: "#3a5a8a", strokeWidth: 1.5, fill: "#8fb4e0", fillStyle: "hachure", hachureGap: 2.4, roughness: 1, seed: 1001 }));
        g.append(rc.path("M -4 -12 L 2 -24 L 8 -11 Z", { stroke: "#3a5a8a", strokeWidth: 1.3, fill: "#7aa0d0", fillStyle: "solid", seed: 1002 }));
        g.append(rc.path("M -16 6 C -8 12 10 10 24 2", { stroke: "#ffffff", strokeWidth: 2, roughness: 0.8, seed: 1003 }));
        g.append(rc.circle(22, -4, 3, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 1004 }));
        g.append(rc.arc(32, 1, 8, 4, 0.2, Math.PI - 0.6, false, { stroke: "#1f1a2a", strokeWidth: 1, seed: 1005 }));
      });
      const splash = (x, y) => { for (let i = 0; i < 6; i++) { const d = rc.circle(0, 0, R(4, 7), { stroke: "#3c6fc0", strokeWidth: 1, fill: "#cfe6f8", fillStyle: "solid", seed: 1010 + i }); deco.append(d); G.timeline({ onComplete: () => d.remove() }).set(d, { x, y }).to(d, { x: `+=${R(-26, 26)}`, y: `-=${R(14, 40)}`, opacity: 0, duration: 0.7, ease: "power2.out" }); } };
      beachKit = { B, inSea, dolphin, splash, k0 };
      [0, 1].forEach((j) => {
        const dl = dolphin();
        G.set(dl, { opacity: 0 });
        if (!anim) { const [x, y] = inSea(0.6, 0.4); G.set(dl, { x, y: y - 20, opacity: 1, rotation: -10, scale: k0 }); return; }
        const [x0, y0] = inSea(narrow ? 0.4 : 0.48 + j * 0.06, 0.45 + j * 0.1), span = (narrow ? 90 : 150) * k0, hgt = (narrow ? 60 : 95) * k0;
        const st = { u: 0 };
        loop(G.timeline({ repeat: -1, repeatDelay: 6, delay: 2 + j * 0.7 })
          .set(st, { u: 0 })
          .call(() => splash(x0, y0))
          .to(st, { u: 1, duration: 1.3, ease: "none", onUpdate: () => {
            const u = st.u, x = x0 + span * u, y = y0 - hgt * 4 * u * (1 - u);
            const dy = -hgt * 4 * (1 - 2 * u);
            G.set(dl, { x, y, opacity: 1, scale: k0, rotation: (Math.atan2(dy, span) * 180) / Math.PI });
          } })
          .call(() => splash(x0 + span, y0))
          .set(dl, { opacity: 0 }));
      });
    }

    // a jellyfish pulses and drifts up and down in deeper water
    if (!narrow) {
      const [jx, jy] = inSea(0.75, 0.55);
      const jelly = mover("d-jelly", (g) => {
        const tent = svgEl("g", { class: "d-tent" });
        tent.append(rc.path("M -8 4 q -4 8 0 14 q 4 6 0 12 M 0 4 q 4 8 0 14 q -4 6 0 12 M 8 4 q -4 8 0 14 q 4 6 0 12", { stroke: "#b06ad8", strokeWidth: 1.4, roughness: 0.8, seed: 1020 }));
        g.append(tent);
        g.append(rc.path("M -14 4 C -14 -16 14 -16 14 4 Q 0 8 -14 4 Z", { stroke: "#8a4ab8", strokeWidth: 1.4, fill: "#e0b8f4", fillStyle: "hachure", hachureGap: 2.2, roughness: 1, seed: 1021 }));
        g.append(rc.circle(-4, -4, 2.4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 1022 }));
        g.append(rc.circle(4, -4, 2.4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 1023 }));
      });
      G.set(jelly, { x: jx, y: jy });
      if (anim) {
        loop(G.to(jelly, { y: jy - 30, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.to(jelly, { scaleY: 0.82, scaleX: 1.1, svgOrigin: "0 0", duration: 0.5, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        loop(G.to(jelly.querySelector(".d-tent"), { skewX: 12, svgOrigin: "0 4", duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      }
    }

    // a seagull circles over the water
    {
      const gull = mover("d-gull", (g) => {
        const w = svgEl("g", { class: "d-gwing" });
        w.append(rc.path("M -16 0 Q -8 -10 0 0 Q 8 -10 16 0", { stroke: "#5d6170", strokeWidth: 2, roughness: 0.8, seed: 1030 }));
        g.append(w);
        g.append(rc.circle(0, 1, 5, { stroke: "#5d6170", strokeWidth: 1, fill: "#ffffff", fillStyle: "solid", seed: 1031 }));
        g.append(rc.path("M 2 2 L 6 3 L 2 4", { stroke: "#f08a24", strokeWidth: 1.4, seed: 1032 }));
      });
      const [cx, cy] = inSea(0.55, 0.1);
      G.set(gull, { x: cx, y: cy - 90 });
      if (anim) {
        loop(G.to(gull.querySelector(".d-gwing"), { scaleY: -0.5, svgOrigin: "0 0", duration: 0.3, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        const o = { a: 0 };
        const gullTo = steer(gull);
        loop(G.to(o, { a: Math.PI * 2, duration: 14, repeat: -1, ease: "none", onUpdate: () => gullTo({ x: cx + Math.cos(o.a) * (seaW * 0.32), y: cy - 90 + Math.sin(o.a) * 26, scaleX: Math.sin(o.a) > 0 ? -1 : 1 }) }));
      }
    }
  }
  whale(true);
  if (TH.decorate) {
    const mover = (cls, draw) => { const g = svgEl("g", { class: cls }); draw(g); deco.append(g); return g; };
    const [sx, sy] = sunAt.split(" ").map(Number);
    TH.decorate({ deco, W, H, narrow, rc: rough.svg(deco), doodle, mover, loop, anim, G, svgEl, beach: beachKit, sun: [sx, sy, narrow ? 16 : 30], moon: moonAt });
  }
  // at night the moon lays a shimmering path across the sea
  if (nightNow && beachKit) {
    const rcN = rough.svg(deco), path = svgEl("g", { class: "t-moonpath" });
    for (let i = 0; i < 9; i++) {
      const [x, y] = beachKit.inSea(0.55 + (i % 3) * 0.08, 0.18 + i * 0.085), w = 14 + i * 4;
      const dash = svgEl("g");
      dash.append(rcN.line(x - w / 2, y, x + w / 2, y, { stroke: "#fff3c4", strokeWidth: 2.4, roughness: 0.6, seed: 3480 + i }));
      path.append(dash);
    }
    deco.append(path);
    if (anim) loop(G.to(path.children, { opacity: 0.25, x: 6, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut", stagger: { each: 0.15, repeat: -1, yoyo: true } }));
  }
  if (anim) flattenDeco(0.3);
  fitHandles();
}
let pencilsAt = null;
// the pencil and crayon roll a little whenever someone moves
function nudgePencils() {
  if (!anim || !pencilsAt) return;
  const g = deco.querySelector(".d-pencils");
  if (g) G.timeline().to(g, { x: R(-14, 14), rotation: R(-3, 3), svgOrigin: `${pencilsAt[0]} ${pencilsAt[1]}`, duration: 0.5, ease: "power2.out" });
}
// the doodles are drawn one after another, a new one starting every DECO_STEP seconds
const DECO_STEP = 0.12;
function drawDecoIn(at) {
  if (!anim) return;
  const groups = [...deco.children];
  groups.forEach((g, i) => {
    const all2 = [...g.querySelectorAll("path")];
    const fills = all2.filter((p) => (p.getAttribute("fill") || "none") !== "none" && (p.getAttribute("stroke") || "none") === "none");
    const paths = all2.filter((p) => !fills.includes(p)).map(dash);
    const lines = [...g.querySelectorAll("line")];
    const texts = [...g.querySelectorAll("text")];
    G.set([...fills, ...texts, ...lines], { opacity: 0 });
    const tl = G.timeline({ delay: at + i * DECO_STEP, onComplete: () => undash(paths) });
    if (i % 3 === 0) tl.call(() => sfx("pencil", 0.5, 0.45), null, 0);
    tl.call(() => sfx("doodle", i), null, 0.75);
    if (paths.length) tl.to(paths, { strokeDashoffset: 0, duration: 0.7, ease: "power1.inOut", stagger: { each: 0.5 / Math.max(1, paths.length) } });
    if (lines.length) tl.to(lines, { opacity: 1, duration: 0.3 }, 0);
    if (fills.length) tl.to(fills, { opacity: 1, duration: 0.6, ease: "none", stagger: { each: 0.3 / fills.length } }, paths.length ? "-=0.35" : 0);
    if (texts.length) tl.to(texts, { opacity: 1, duration: 0.3 }, "-=0.2");
  });
  decoDrawing = true;
  flattenDeco(at + groups.length * DECO_STEP + 1.8);
}
function whale(instant = false) {
  if (!whaleClip) return;
  const w = Math.min(1, game.played.length / 80) * (WHALE_W + 10);
  if (anim && !instant) G.to(whaleClip, { attr: { width: w }, duration: 1.4, ease: "power2.inOut" });
  else whaleClip.setAttribute("width", String(w));
}
function spout() {
  sfx("spout");
  if (!anim) return;
  const s = deco.querySelector(".d-spout");
  if (s) G.timeline().to(s, { opacity: 1, scaleY: 1.8, svgOrigin: "96 46", duration: 0.25, ease: "power2.out" }).to(s, { scaleY: 1, opacity: 0.3, duration: 0.8 });
}
function sunLaugh() {
  if (!anim) return;
  const [x, y] = sunAt.split(" ").map(Number);
  G.timeline().to(".d-sun .d-mouth", { scaleY: 1.8, svgOrigin: `${x} ${y}`, duration: 0.15, yoyo: true, repeat: 5 }).to(".d-sun", { rotation: 15, svgOrigin: sunAt, duration: 0.12, yoyo: true, repeat: 5 }, 0);
}
