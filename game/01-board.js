/* Chess in the margins: the board, the creatures and everything they do.
   Rules and the opponent live in engine.js. The board is drawn with rough.js inside a tilted plane;
   the creatures stand upright in a flat layer above it, placed by projecting each square through the same tilt.
   Everything is animated like a hand-drawn cartoon: the pen lines boil, the creatures breathe and blink,

/* Part 1 of 10: the board on its tilted plane, the pen, the marks, the creatures on their squares, the camera.
   The ten files in game/ are one program: they load in order and share what they declare. */
"use strict";

const E = window.ChessEngine;
if (!E) throw new Error("engine.js did not load");
const { Game, think, name, BLACK } = E;
const $ = (id) => document.getElementById(id);
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const G = window.gsap;
const anim = !reduce && Boolean(G);
const R = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
// wait for a timeline without taking over its own onComplete (props clean themselves up there)
const play = (tl) => new Promise((ok) => {
  tl.then(() => ok());
  // a timeline may already tidy up after itself when it is cut short: that still has to happen
  const tidy = tl.eventCallback("onInterrupt");
  tl.eventCallback("onInterrupt", () => { if (tidy) tidy(); ok(); });
});

const KIND = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];
// [orange team, purple team]
const CREATURE = [null, ["mushroom", "blob"], ["pony", "zebra"], ["acorn", "wizard"], ["castle", "puffball"], ["bee queen", "crested bird"], ["owl", "penguin"]];
const TEAM = ["orange", "purple"];
const VALUE = E.VALUE;
const key = (p) => `${p & BLACK ? "b" : "w"}-${KIND[p & 7]}`;
const who = (p) => `the ${CREATURE[p & 7][p & BLACK ? 1 : 0]}`;
const colorOf = (p) => (p & BLACK ? 1 : 0);
const all = () => { const out = []; for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) out.push(r * 16 + f); return out; };
const CR = window.Creature;
const SND = window.Sound || { play() {}, on: false, set() {} };
const sfx = (...a) => SND.play(...a);
// a small still drawing of a creature, for the trays and the promotion choice
const mini = (p) => CR.make(p, { copies: 1 }).svg;

const table = document.querySelector(".cx-table");
const cam = $("cam"), board = $("board"), ink = $("ink"), marks = $("marks"), squaresEl = $("squares"), layer = $("pieces"), fx = $("fx");
const statusEl = $("status"), talk = $("talk"), movesEl = $("moves"), caption = $("caption");

let game = new Game();
let flipped = false, mode = "cpu", level = "normal", human = 0;
// a set-up game asked for by another file (a chapter, a pasted position): where it starts, who you are, how the computer plays
let scene = null, startFen = E.START, thinker = null;
const heard = new Map();
const tell = (type, detail) => { for (const fn of heard.get(type) || []) { try { fn(detail); } catch (err) { console.error(err); } } };
let selected = -1, legal = [], busy = false, over = null, firstCapture = true;
const els = new Map();

/* ---------- geometry ---------- */

const PERSPECTIVE = 1400;
const cssTilt = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tilt")) || 0;
let tiltNow = anim ? 0 : cssTilt(), spinNow = 0;
// the turn is written straight onto the board's transform: a custom property there would be handed
// down to every pen stroke inside it, and the browser would restyle them all on every frame of a turn
function setBoardTransform() {
  board.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${tiltNow}deg) rotateZ(${spinNow}deg)`;
}
const dispCol = (sq) => (flipped ? 7 - (sq & 7) : sq & 7);
const dispRow = (sq) => (flipped ? sq >> 4 : 7 - (sq >> 4));
// square centre in the board drawing's own units (viewBox -60 -20 920 880, squares 100 wide)
const local = (sq) => ({ x: (dispCol(sq) + 0.5) * 100, y: (dispRow(sq) + 0.5) * 100 });
// a point of the drawing projected to the flat layer: the same perspective, tilt and spin as .cx-board
let camW = 0; // the camera's width, held while every creature is put back in one go
function project(x, y) {
  const W = camW || cam.clientWidth, H = (W * 880) / 920, u = W / 920, a = (tiltNow * Math.PI) / 180, s = (spinNow * Math.PI) / 180;
  let dx = (x + 60) * u - W / 2, dy = (y + 20) * u - H / 2;
  if (s) { const c = Math.cos(s), n = Math.sin(s); [dx, dy] = [dx * c - dy * n, dx * n + dy * c]; }
  const z = dy * Math.sin(a), k = PERSPECTIVE / (PERSPECTIVE - z);
  return { x: W / 2 + dx * k, y: H / 2 + dy * Math.cos(a) * k, k, u, depth: dy };
}
// where a creature standing on a square has its feet
function spot(sq) {
  const c = local(sq);
  const p = project(c.x, c.y + 30);
  return { ...p, w: 100 * p.u * 1.5 };
}
const zOf = (s, cam) => String(Math.round(1000 + s.depth));
function place(el, sq) {
  // where the creature stands on the page, which can lag behind the game while its moves play out
  el.__at = sq;
  const s = spot(sq);
  el.style.width = `${s.w}px`;
  el.style.zIndex = zOf(s);
  const props = { x: s.x - s.w / 2, y: s.y - s.w, scale: s.k };
  if (G) G.set(el, props); else el.style.transform = `translate(${props.x}px, ${props.y}px) scale(${props.k})`;
}

/* ---------- the pen: every drawing exists three times and they take turns, so lines boil ---------- */

const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const boiling = [ink, marks, $("deco")];
// draw(rc, g, k) is called three times with k = 0, 1, 2; seeds should add k so each copy wobbles differently
function boil(parent, draw, cls) {
  const holder = svgEl("g", cls ? { class: cls } : {});
  for (let k = 0; k < 3; k++) {
    const g = svgEl("g", { class: `f${k}` });
    draw(rough.svg(parent.ownerSVGElement || parent), g, k);
    holder.append(g);
  }
  parent.append(holder);
  return holder;
}
// the board and the doodles boil six times a second
if (anim) {
  let frame = 0, last = 0;
  G.ticker.add((t) => {
    if (t - last >= 0.16) { last = t; frame = (frame + 1) % 3; for (const s of boiling) s.dataset.boil = frame; }
  });
}
boiling.forEach((s) => { s.dataset.boil = 0; });
// creatures are drawn twice; they swap a little slower than the board so they do not flicker
const creatureBoil = [layer, $("intro")];
if (anim) {
  let cf = 0, cl = 0;
  G.ticker.add((t) => { if (t - cl < 0.2) return; cl = t; cf ^= 1; for (const s of creatureBoil) if (s) s.dataset.cboil = cf; });
}
creatureBoil.forEach((s) => { if (s) s.dataset.cboil = 0; });

// the board in three layers so it can be drawn in order: down strokes, across strokes, then the green hatching
function drawBoard() {
  ink.replaceChildren();
  // the dark squares are little patches of grass, drawn once and left still
  const lawn = svgEl("g", { class: "b-sq" });
  const rcl = rough.svg(ink);
  let gs = 7;
  const rnd = () => { gs = (gs * 1664525 + 1013904223) >>> 0; return gs / 4294967296; };
  const GREENS = ["#5d9e4a", "#6fb35a", "#4f8f3e", "#7fbf63"];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    if ((r + f) % 2 === 0) continue;
    const x0 = f * 100, y0 = r * 100;
    lawn.append(rcl.rectangle(x0 + 3, y0 + 3, 94, 94, { stroke: "none", fill: "rgba(140,196,110,0.32)", fillStyle: "solid", roughness: 1.4, seed: 10 + r * 8 + f }));
    // blades in a few colours: each is a short curved stroke leaning a little, in loose rows
    GREENS.forEach((col, ci) => {
      let d = "";
      for (let i = 0; i < 9; i++) {
        const bx = x0 + 6 + rnd() * 88, by = y0 + 16 + rnd() * 80, hgt = 8 + rnd() * 9, lean = (rnd() - 0.5) * 9;
        d += `M ${bx.toFixed(1)} ${by.toFixed(1)} Q ${(bx + lean * 0.3).toFixed(1)} ${(by - hgt * 0.6).toFixed(1)} ${(bx + lean).toFixed(1)} ${(by - hgt).toFixed(1)} `;
        if (rnd() < 0.5) d += `M ${(bx + 2).toFixed(1)} ${by.toFixed(1)} Q ${(bx + 3 + lean * 0.2).toFixed(1)} ${(by - hgt * 0.4).toFixed(1)} ${(bx + 4 + lean * 0.6).toFixed(1)} ${(by - hgt * 0.75).toFixed(1)} `;
      }
      lawn.append(rcl.path(d, { stroke: col, strokeWidth: 1.5, roughness: 0.5, bowing: 0.5, seed: 30 + r * 8 + f + ci * 97 }));
    });
  }
  ink.append(lawn);
  boil(ink, (rc, g, k) => {
    const v = svgEl("g", { class: "b-v" }), h = svgEl("g", { class: "b-h" });
    for (let i = 0; i <= 8; i++) {
      v.append(rc.line(i * 100, -4, i * 100 + (i % 3) - 1, 804, { stroke: "#2b2f3a", strokeWidth: 2.4, roughness: 1.1, bowing: 1.4, seed: 100 + i + k * 977 }));
      h.append(rc.line(-4, i * 100, 804, i * 100 + (i % 3) - 1, { stroke: "#2b2f3a", strokeWidth: 2.4, roughness: 1.1, bowing: 1.4, seed: 200 + i + k * 977 }));
    }
    g.append(v, h);
  }, "cx-grid");
  const labels = svgEl("g", { class: "cx-labels" });
  for (let i = 0; i < 8; i++) {
    const rank = flipped ? i + 1 : 8 - i, file = "abcdefgh"[flipped ? 7 - i : i];
    labels.append(label(-34, i * 100 + 62, String(rank), i % 2 ? "#c8452e" : "#3c4fb8"));
    labels.append(label(i * 100 + 50, 846, file, i % 2 ? "#3c4fb8" : "#c8452e"));
  }
  ink.append(labels);
}
// the pen draws the board: every down stroke left to right, every across stroke top to bottom,
// then the squares are hatched in and the coordinates written. Returns how long it takes.
const dash = (p) => { const L = CR.lengthOf(p); p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = `${L}`; return p; };
const undash = (list) => list.forEach((p) => { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; });
function drawBoardIn(at = 0) {
  if (!anim) return 0;
  const strokes = (cls) => {
    const perLine = [[], [], [], [], [], [], [], [], []];
    ink.querySelectorAll(`.${cls}`).forEach((g) => [...g.children].forEach((line, i) => line.querySelectorAll("path").forEach((pth) => perLine[i].push(dash(pth)))));
    return perLine;
  };
  const vs = strokes("b-v"), hs = strokes("b-h");
  const squares = [...ink.querySelectorAll(".b-sq path")];
  squares.forEach(dash);
  const washes = squares.filter((p) => (p.getAttribute("fill") || "none") !== "none");
  G.set(washes, { opacity: 0 });
  const labels = [...ink.querySelectorAll(".cx-labels text")];
  G.set(labels, { opacity: 0 });
  const tl = G.timeline({ delay: at, onComplete: () => { undash([...vs.flat(), ...hs.flat(), ...squares]); } });
  for (let i = 0; i < 18; i++) {
    const t0 = i < 9 ? i * 0.09 : 0.85 + (i - 9) * 0.09;
    tl.call(() => sfx("pencil", 0.3, 0.7), null, t0);
    tl.call(() => sfx("line", i), null, t0 + 0.3);
  }
  tl.call(() => sfx("pencil", 1.2, 0.9), null, 1.6);
  labels.forEach((_, i) => tl.call(() => sfx("line", 18 - i), null, 2.0 + i * 0.04));
  vs.forEach((l, i) => tl.to(l, { strokeDashoffset: 0, duration: 0.32, ease: "power1.inOut" }, i * 0.09));
  hs.forEach((l, i) => tl.to(l, { strokeDashoffset: 0, duration: 0.32, ease: "power1.inOut" }, 0.85 + i * 0.09));
  tl.to(washes, { opacity: 1, duration: 0.45, ease: "none", stagger: { each: 0.9 / Math.max(1, washes.length), from: "random" } }, 1.6);
  tl.to(squares.filter((p) => !washes.includes(p)), { strokeDashoffset: 0, duration: 0.5, ease: "none", stagger: { each: 1.1 / Math.max(1, squares.length), from: "random" } }, 1.7);
  tl.to(labels, { opacity: 1, duration: 0.18, stagger: 0.04 }, 2.0);
  return 2.9;
}
function label(x, y, text, fill) {
  const t = svgEl("text", { x, y, fill, "text-anchor": "middle", class: "cx-label" });
  t.textContent = text;
  return t;
}

/* ---------- marks: the pencil ring, the little oranges, the dotted trail ---------- */

let lastMove = null, markTweens = [];
function clearMarks() { markTweens.forEach((t) => t.kill()); markTweens = []; marks.replaceChildren(); }
function drawMarks(trailTo = -1, fresh = false) {
  clearMarks();
  if (lastMove) for (const sq of [lastMove.from, lastMove.to]) {
    const c = local(sq);
    boil(marks, (rc, g, k) => g.append(rc.rectangle(c.x - 44, c.y - 44, 88, 88, { fill: "rgba(247,201,51,0.5)", fillStyle: "zigzag", hachureGap: 7, fillWeight: 2, stroke: "none", roughness: 1.4, seed: sq + 3 + k * 50 })));
  }
  if (selected < 0) return;
  const s = local(selected);
  // the chosen creature, circled twice in pencil; the rings are drawn on, then keep turning slowly
  const ring = boil(marks, (rc, g, k) => {
    g.append(rc.ellipse(s.x, s.y + 18, 96, 50, { stroke: "#4a4d57", strokeWidth: 2.2, roughness: 2.2, seed: 7 + k * 31 }));
    g.append(rc.ellipse(s.x + 2, s.y + 17, 88, 46, { stroke: "#c8452e", strokeWidth: 1.3, roughness: 2.6, seed: 9 + k * 31 }));
  }, "cx-ring");
  if (anim) {
    if (fresh) {
      const paths = [...ring.querySelectorAll("path")];
      paths.forEach((p) => { const L = CR.lengthOf(p); p.style.strokeDasharray = `${L}`; p.style.strokeDashoffset = `${L}`; });
      markTweens.push(G.to(paths, { strokeDashoffset: 0, duration: 0.45, ease: "power2.out" }));
    }
    markTweens.push(G.to(ring, { rotation: 360, svgOrigin: `${s.x} ${s.y + 18}`, duration: 9, ease: "none", repeat: -1 }));
    markTweens.push(G.to(ring, { scale: 1.06, svgOrigin: `${s.x} ${s.y + 18}`, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" }));
  }
  const done = new Map();
  for (const m of legal) if (!done.has(m.to)) done.set(m.to, m);
  const ordered = [...done.values()].sort((a, b) => Math.hypot(local(a.to).x - s.x, local(a.to).y - s.y) - Math.hypot(local(b.to).x - s.x, local(b.to).y - s.y));
  ordered.forEach((m, i) => {
    const c = local(m.to);
    if (m.captured) {
      const g = boil(marks, (rc, gg, k) => gg.append(rc.ellipse(c.x, c.y + 20, 96, 50, { stroke: "#c8452e", strokeWidth: 3, roughness: 1.8, seed: m.to + k * 13 })), "cx-target");
      // a red ring beats like a heart around anything that can be taken
      if (anim) markTweens.push(G.fromTo(g, { scale: 0.9, svgOrigin: `${c.x} ${c.y + 20}` }, { scale: 1.08, svgOrigin: `${c.x} ${c.y + 20}`, duration: 0.42, yoyo: true, repeat: -1, ease: "power1.inOut", delay: i * 0.05 }));
    } else {
      // a little fruit with a leaf (an orange for orange, a plum for purple); they pop up nearest first and keep bobbing
      const purple = colorOf(m.piece) === 1;
      const g = boil(marks, (rc, gg, k) => {
        gg.append(rc.circle(c.x, c.y + 6, 34, { stroke: purple ? "#6660c8" : "#e8902a", strokeWidth: 2.6, roughness: 1.3, fill: purple ? "rgba(140,120,220,0.2)" : "rgba(240,160,60,0.18)", fillStyle: "solid", seed: m.to + k * 13 }));
        const leaf = svgEl("g", { class: "cx-leaf" });
        leaf.append(rc.path(`M ${c.x + 3} ${c.y - 11} q 9 -11 18 -6 q -6 9 -18 6`, { fill: "#5aa04a", fillStyle: "solid", stroke: "#3d7a33", strokeWidth: 1.2, roughness: 0.8, seed: 5 + k }));
        gg.append(leaf);
      }, "cx-orange");
      g.dataset.sq = m.to;
      if (anim) {
        markTweens.push(G.from(g, { scale: 0, svgOrigin: `${c.x} ${c.y + 6}`, duration: 0.45, ease: "back.out(3)", delay: fresh ? i * 0.04 : 0 }));
        markTweens.push(G.to(g, { y: -5, duration: R(0.5, 0.7), yoyo: true, repeat: -1, ease: "sine.inOut", delay: R(0, 0.5) }));
        markTweens.push(G.to(g.querySelectorAll(".cx-leaf"), { rotation: 18, svgOrigin: `${c.x + 3} ${c.y - 11}`, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }));
        if (m.to === trailTo) markTweens.push(G.to(g, { scale: 1.3, svgOrigin: `${c.x} ${c.y + 6}`, duration: 0.25, ease: "back.out(3)" }));
      }
    }
  });
  if (trailTo >= 0 && done.has(trailTo)) {
    // a dotted path that keeps marching from the creature to where it would go, like ants
    const t = local(trailTo), dx = t.x - s.x, dy = t.y - s.y, len = Math.hypot(dx, dy), n = Math.max(3, Math.floor(len / 22));
    const g = svgEl("g", { class: "cx-trail" });
    const col = game.turn ? "#3c4fb8" : "#c8452e";
    const rc = rough.svg(marks);
    const dots = [];
    for (let i = 1; i < n; i++) { const d = rc.circle(s.x + (dx * i) / n, s.y + (dy * i) / n, 8, { fill: col, fillStyle: "solid", stroke: col, strokeWidth: 1, roughness: 0.6, seed: i }); g.append(d); dots.push(d); }
    marks.append(g);
    if (anim) {
      markTweens.push(G.from(dots, { opacity: 0, duration: 0.15, stagger: 0.025 }));
      markTweens.push(G.to(dots, { opacity: 0.25, duration: 0.25, yoyo: true, repeat: -1, ease: "none", stagger: { each: 0.08, repeat: -1, yoyo: true }, delay: 0.3 }));
    }
  }
}

/* ---------- creatures: placement > action > life ---------- */

// every creature is drawn in code (creatures.js), so its legs, arms, hat and face all move
function makeEl(p) {
  const el = document.createElement("div");
  el.className = "cx-piece";
  el.dataset.key = key(p);
  const act = document.createElement("div");
  act.className = "cx-act";
  const body = document.createElement("div");
  body.className = "cx-body";
  const c = CR.make(p);
  body.append(c.svg);
  const bang = document.createElement("span");
  bang.className = "cx-bang";
  bang.textContent = "!";
  body.append(bang);
  act.append(body);
  el.append(act);
  el.__act = act; el.__body = body; el.__p = p; el.__c = c;
  layer.append(el);
  dressUp(c);
  if (anim) wake(el);
  return el;
}

const TH = window.Themes || { id: null };
function dressUp(c) { if (TH.id) c.swing = TH.dress(c) || []; }

// the creature's own life (breathing, swaying, blinking, looking around) comes from creatures.js
// the creatures' idle life (breathing, swaying, fidgeting) runs on its own clock, moved on every frame
const lifeClock = G.timeline({ paused: true });
if (anim) {
  const t0 = G.ticker.time;
  // while the board is scrolled right out of sight (reading the moves on a phone, say) the creatures
  // rest and nothing is painted; they carry on where the clock has got to when it comes back
  let seen = true;
  if (window.IntersectionObserver) new IntersectionObserver(([e]) => { seen = e.isIntersecting; }).observe(cam);
  // and while the pen is still drawing them they hold still, picking up from there once it is done
  let held = 0, last = 0;
  G.ticker.add((t) => {
    if (penBusy) held += t - (last || t);
    last = t;
    if (seen && !penBusy) lifeClock.time(t - t0 - held, false);
  });
  // then the creatures shown on canvases are painted where this frame left their joints, all on one stage
  const stage = CR.stage(layer);
  G.ticker.add(() => {
    if (!seen) return;
    const b = Number(layer.dataset.cboil) || 0, cast = [];
    for (const el of layer.children) if (el.__c && el.__c.cv) cast.push(el.__c);
    if (stage) stage.paint(cast, b); else cast.forEach((c) => CR.paint(c, b));
  });
}
function wake(el) {
  sleep(el);
  el.__live = CR.live(el.__c);
  el.__live.tweens.forEach((t) => { lifeClock.add(t, lifeClock.time()); t.progress(Math.random()); });
}
function sleep(el) {
  if (el.__live) el.__live.kill();
  el.__live = null;
}
// the side to move breathes faster
function paintTurn() {
  if (!anim) return;
  for (const [, el] of els) {
    if (el.__live) el.__live.timeScale(colorOf(el.__p) === game.turn ? 1.4 : 0.85);
  }
}

let drawAt = 0;
function buildPieces(entrance = false) {
  for (const [, el] of els) { sleep(el); if (el.__drip) el.__drip.kill(); }
  shivers.forEach((t) => t.kill());
  shivers.clear();
  layer.replaceChildren();
  els.clear();
  for (const sq of all()) {
    const p = game.get(sq);
    if (!p) continue;
    const el = makeEl(p);
    els.set(sq, el);
    place(el, sq);
    veteranCrown(el, sq);
  }
  paintWorry();
  paintTurn();
  if (entrance === "draw" && anim) {
    // the pen draws each creature, file by file, then it colours it in; when all are done they wave
    for (const [sq, el] of els) {
      const f = flipped ? 7 - (sq & 7) : sq & 7, back = (sq >> 4) === 0 || (sq >> 4) === 7;
      const t0 = drawAt + f * 0.2 + (back ? 0 : 0.08) + (colorOf(el.__p) ? 0.1 : 0);
      // each one moves onto the canvas as soon as the pen has finished it, not once the last one is done
      CR.drawIn(el.__c, t0, 0.8).then(() => { const ppu = piecePpu(), c = el.__c; if (ppu && els.get(sq) === el) CR.toCanvas(c, ppu); });
      if (back && !colorOf(el.__p)) G.delayedCall(t0, () => sfx("pencil", 0.6, 0.55));
      G.delayedCall(t0 + 0.75, () => sfx("appear", f, colorOf(el.__p), el.__p & 7));
    }
    G.delayedCall(drawAt + 8 * 0.2 + 0.85, () => sfx("tada"));
    G.delayedCall(drawAt + 8 * 0.2 + 1.8, askForTap);
    const done = drawAt + 8 * 0.2 + 0.9;
    penBusy = true;
    // moving them onto canvases takes only a few milliseconds a frame, so it need not wait for the margins
    G.delayedCall(done, () => { penBusy = false; bakePieces(); });
    G.delayedCall(done, () => { for (const [, el] of els) { const c = el.__c; if (c.state !== "open") continue; CR.setFace(c, "happy", c.spec.face.beak ? "open" : "grin"); G.delayedCall(R(0.6, 1.1), () => CR.restFace(c)); G.fromTo(el.__act, { y: 0 }, { y: -12, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out", delay: R(0, 0.3) }); } });
  } else if (entrance && anim) {
    // they hop in from the edge of the page, one rank at a time
    for (const [sq, el] of els) {
      const r = sq >> 4, fromTop = colorOf(el.__p) === (flipped ? 0 : 1);
      G.from(el.__act, { y: fromTop ? -260 : 260, opacity: 0, rotation: R(-40, 40), duration: 0.8, ease: "back.out(1.4)", delay: 0.3 + (fromTop ? 7 - r : r) * 0.12 + (sq & 7) * 0.03 });
    }
  }
  if (!(entrance === "draw" && anim)) { penBusy = false; bakePieces(); }
}
// put every creature back on its square; ones in the middle of a move are left alone
// the width is read once, not between one creature's new place and the next
function relayout() {
  camW = cam.clientWidth;
  try { for (const el of layer.children) if (el.__at != null && !el.__away && !(G && G.isTweening(el))) place(el, el.__at); } finally { camW = 0; }
}

// once a creature is drawn it moves onto a canvas (see creatures.js), or when nothing moves its strokes
// become pictures; either twice as sharp as the biggest creature on screen so the camera can lean in,
// and a bigger window makes sharper ones
let penBusy = false;
function piecePpu() {
  let w = 0;
  for (const [, el] of els) w = Math.max(w, el.__body.getBoundingClientRect().width);
  return w ? Math.min(5, Math.max(1.5, Math.ceil((w / 120) * (window.devicePixelRatio || 1) * 4) / 2)) : 0;
}
function bakePieces() {
  if (penBusy || !els.size) return;
  const ppu = piecePpu();
  if (!ppu) return;
  for (const [, el] of els) {
    const c = el.__c;
    if (anim && !c.noCanvas) { if ((c.cvPpu || 0) < ppu) CR.toCanvas(c, ppu).then((ok) => { if (!ok && c.noCanvas && el.__c === c) CR.bake(c, ppu); }); }
    else if (c.ppu < ppu) CR.bake(c, ppu);
  }
}

/* ---------- worry, check, sweat ---------- */

const shivers = new Map();
function paintWorry() {
  const us = game.turn;
  for (const [sq, el] of els) {
    const p = game.get(sq);
    const mine = p && colorOf(p) === us;
    const threatened = Boolean(mine && game.attackers(sq, us ^ 1).length > 0);
    const king = (p & 7) === 6;
    el.classList.toggle("is-worried", threatened && !king);
    el.classList.toggle("is-checked", threatened && king);
    if (!anim) continue;
    const on = shivers.get(el);
    if (threatened && !on) {
      // it trembles and sweats drop after drop
      const t = G.to(el.__act, { x: king ? 3 : 1.6, duration: king ? 0.05 : 0.06, yoyo: true, repeat: -1, ease: "none" });
      const drip = () => { if (!el.isConnected) return; sweat(el); el.__drip = G.delayedCall(R(0.5, 1.1), drip); };
      drip();
      if (king) G.fromTo(el.querySelector(".cx-bang"), { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.5, ease: "back.out(4)" });
      // wide eyes, a wobbly mouth, hands up to its face (a king in check clutches its head)
      const c = el.__c;
      CR.setFace(c, "scared", c.spec.face.beak ? "open" : "wavy");
      if (!c.spec.wings) c.arms.forEach((a, i) => G.to(a, { rotation: (i ? -1 : 1) * (king ? 150 : 110), svgOrigin: a.dataset.o, duration: 0.35, ease: "back.out(2)", overwrite: "auto" }));
      shivers.set(el, t);
    } else if (!threatened && on) {
      on.kill();
      if (el.__drip) el.__drip.kill();
      G.to(el.__act, { x: 0, duration: 0.2 });
      // relief: the arms come down, the face relaxes, a little hop
      CR.restFace(el.__c);
      CR.settle(el.__c);
      G.fromTo(el.__body, { y: 0 }, { y: -6, duration: 0.15, yoyo: true, repeat: 1, ease: "power2.out" });
      shivers.delete(el);
    }
  }
}
function sweat(el) {
  const d = document.createElement("span");
  d.className = "cx-drop";
  el.__body.append(d);
  G.fromTo(d, { x: R(-4, 4), y: 0, scale: 0.4, opacity: 1 }, { y: R(26, 40), x: `+=${R(-6, 6)}`, scale: 1, opacity: 0, duration: 0.9, ease: "power1.in", onComplete: () => d.remove() });
}

/* ---------- the camera ---------- */

// the whole table drifts a little all the time, as if the camera were handheld
if (anim) {
  G.to(table, { x: 6, duration: 7.3, yoyo: true, repeat: -1, ease: "sine.inOut" });
  G.to(table, { y: -4, rotation: 0.35, duration: 5.1, yoyo: true, repeat: -1, ease: "sine.inOut" });
  G.to(table, { scale: 1.012, duration: 8.7, yoyo: true, repeat: -1, ease: "sine.inOut" });
}
// a short camera move toward a point of the board, then back
function camTo(px, py, zoom = 1.06, hold = 0.3) {
  if (!anim) return;
  const W = cam.clientWidth, H = cam.clientHeight;
  G.killTweensOf(cam);
  G.set(cam, { transformOrigin: `${px}px ${py}px` });
  G.timeline()
    .to(cam, { x: (W / 2 - px) * 0.08, y: (H / 2 - py) * 0.08, scale: zoom, rotation: 0, duration: 0.5, ease: "power2.out" })
    .to(cam, { x: 0, y: 0, scale: 1, duration: 0.9, ease: "power2.inOut" }, `+=${hold}`);
}
// the shake rides on the CSS translate property, so it never fights the camera moves on transform
const jolt = { x: 0, y: 0 };
function shake(power = 8) {
  if (!anim) return;
  G.killTweensOf(jolt);
  G.timeline({ onUpdate: () => { cam.style.translate = `${jolt.x}px ${jolt.y}px`; }, onComplete: () => { cam.style.translate = ""; } })
    .to(jolt, { keyframes: [{ x: power, y: -power * 0.5 }, { x: -power, y: power * 0.6 }, { x: power * 0.6, y: -power * 0.3 }, { x: -power * 0.4, y: power * 0.2 }, { x: 0, y: 0 }], duration: 0.32, ease: "none" });
}
function leanBoard(to, duration = 0.6) {
  if (!anim) { tiltNow = to; setBoardTransform(); relayout(); return Promise.resolve(); }
  const o = { t: tiltNow };
  return play(G.timeline().to(o, { t: to, duration, ease: "power2.inOut", onUpdate: () => { tiltNow = o.t; setBoardTransform(); relayout(); } }));
}

/* ---------- fx helpers: stars, dust, words ---------- */

const rcFx = () => rough.svg(fx);
const starPts = (x, y, big, small) => { const pts = []; for (let k = 0; k < 10; k++) { const rr = k % 2 ? small : big, a = (Math.PI / 5) * k - Math.PI / 2; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return pts; };
function star(size, seed, fill = "#f7c933") { return rcFx().polygon(starPts(0, 0, size, size * 0.45), { fill, fillStyle: "solid", stroke: "#b57a10", strokeWidth: 1.4, roughness: 1, seed }); }
function burst(x, y, n = 8, spread = 110) {
  if (!anim) return;
  for (let i = 0; i < n; i++) {
    const st = star(R(8, 15), i + 1);
    fx.append(st);
    const ang = R(0, Math.PI * 2), dist = R(spread * 0.4, spread);
    G.timeline({ onComplete: () => st.remove() })
      .set(st, { x, y, scale: 0.2, rotation: R(0, 90) })
      .to(st, { x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist - 20, scale: 1, rotation: `+=${R(90, 300)}`, duration: 0.75, ease: "power2.out" })
      .to(st, { opacity: 0, duration: 0.3 }, "-=0.25");
  }
}
function dust(x, y, n = 4) {
  if (!anim) return;
  for (let i = 0; i < n; i++) {
    const d = rcFx().circle(0, 0, R(10, 18), { stroke: "rgba(90,80,70,0.5)", strokeWidth: 1.2, fill: "rgba(170,155,130,0.35)", fillStyle: "solid", roughness: 1.6, seed: i + 7 });
    fx.append(d);
    G.timeline({ onComplete: () => d.remove() })
      .set(d, { x: x + R(-8, 8), y: y + R(-3, 3), scale: 0.4 })
      .to(d, { x: `+=${R(-26, 26)}`, y: `-=${R(4, 16)}`, scale: R(1.2, 1.8), opacity: 0, duration: R(0.5, 0.8), ease: "power2.out" });
  }
}
// a comic-book word in a jagged bubble
function word(text, x, y, color = "#e8432e") {
  if (!anim) return;
  const g = svgEl("g", { class: "cx-pow" });
  const pts = [];
  for (let i = 0; i < 18; i++) { const r = i % 2 ? 26 : 46, a = (Math.PI / 9) * i; pts.push([Math.cos(a) * r * 1.5, Math.sin(a) * r]); }
  g.append(rcFx().polygon(pts, { fill: "#f7c933", fillStyle: "solid", stroke: "#2b2f3a", strokeWidth: 2, roughness: 1.4, seed: 3 }));
  const t = svgEl("text", { x: 0, y: 12, "text-anchor": "middle", fill: color, class: "cx-pow__text" });
  t.textContent = text;
  g.append(t);
  fx.append(g);
  G.timeline({ onComplete: () => g.remove() })
    .set(g, { x, y, rotation: R(-14, 14), scale: 0 })
    .to(g, { scale: 1, duration: 0.3, ease: "back.out(4)" })
    .to(g, { scale: 1.08, duration: 0.15, yoyo: true, repeat: 3 })
    .to(g, { scale: 0, opacity: 0, duration: 0.25, ease: "power2.in" }, "+=0.15");
}
// stars circling a dazed head
function dizzy(x, y, w) {
  const g = svgEl("g");
  for (let i = 0; i < 3; i++) { const st = star(7, 20 + i); st.setAttribute("transform", `translate(${Math.cos((i / 3) * Math.PI * 2) * w * 0.35} ${Math.sin((i / 3) * Math.PI * 2) * w * 0.12})`); g.append(st); }
  fx.append(g);
  G.set(g, { x, y });
  const spin = G.to(g.children, { rotation: 360, duration: 0.9, repeat: -1, ease: "none" });
  const orbit = G.to(g, { rotation: 360, duration: 1.2, repeat: -1, ease: "none", svgOrigin: "0 0" });
  return () => { spin.kill(); orbit.kill(); g.remove(); };
}
