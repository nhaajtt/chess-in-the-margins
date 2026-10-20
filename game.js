/* Chess in the margins: the board, the creatures and everything they do.
   Rules and the opponent live in engine.js. The board is drawn with rough.js inside a tilted plane;
   the creatures stand upright in a flat layer above it, placed by projecting each square through the same tilt.
   Everything is animated like a hand-drawn cartoon: the pen lines boil, the creatures breathe and blink,
   the camera drifts, and every capture is a little fight. With reduced motion it all holds still. */
(() => {
  "use strict";
  const E = window.ChessEngine;
  if (!E) return;
  const { Game, think, name, BLACK } = E;
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const G = window.gsap;
  const anim = !reduce && Boolean(G);
  const R = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
  // wait for a timeline without taking over its own onComplete (props clean themselves up there)
  const play = (tl) => new Promise((ok) => { tl.then(() => ok()); tl.eventCallback("onInterrupt", () => ok()); });

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
  let selected = -1, legal = [], busy = false, over = null, firstCapture = true;
  const els = new Map();

  /* ---------- geometry ---------- */

  const PERSPECTIVE = 1400;
  const cssTilt = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--tilt")) || 0;
  let tiltNow = anim ? 0 : cssTilt(), spinNow = 0;
  function setBoardTransform() {
    board.style.setProperty("--tilt-now", `${tiltNow}deg`);
    board.style.setProperty("--spin", `${spinNow}deg`);
  }
  const dispCol = (sq) => (flipped ? 7 - (sq & 7) : sq & 7);
  const dispRow = (sq) => (flipped ? sq >> 4 : 7 - (sq >> 4));
  // square centre in the board drawing's own units (viewBox -60 -20 920 880, squares 100 wide)
  const local = (sq) => ({ x: (dispCol(sq) + 0.5) * 100, y: (dispRow(sq) + 0.5) * 100 });
  // a point of the drawing projected to the flat layer: the same perspective, tilt and spin as .cx-board
  function project(x, y) {
    const W = cam.clientWidth, H = (W * 880) / 920, u = W / 920, a = (tiltNow * Math.PI) / 180, s = (spinNow * Math.PI) / 180;
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
  const dash = (p) => { const L = p.getTotalLength ? p.getTotalLength() : 900; p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = `${L}`; return p; };
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
        paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = `${L}`; p.style.strokeDashoffset = `${L}`; });
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
    G.ticker.add((t) => { lifeClock.time(t - t0, false); });
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
        CR.drawIn(el.__c, t0, 0.8);
        if (back && !colorOf(el.__p)) G.delayedCall(t0, () => sfx("pencil", 0.6, 0.55));
        G.delayedCall(t0 + 0.75, () => sfx("appear", f, colorOf(el.__p), el.__p & 7));
      }
      G.delayedCall(drawAt + 8 * 0.2 + 0.85, () => sfx("tada"));
      G.delayedCall(drawAt + 8 * 0.2 + 1.8, askForTap);
      const done = drawAt + 8 * 0.2 + 0.9;
      penBusy = true;
      G.delayedCall(done, () => { penBusy = false; if (!decoDrawing) bakePieces(); });
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
  function relayout() { for (const el of layer.children) if (el.__at != null && !el.__away && !(G && G.isTweening(el))) place(el, el.__at); }

  // once a creature is drawn its strokes become pictures (see creatures.js), twice as sharp as the
  // biggest creature on screen so the camera can lean in; a bigger window makes sharper ones
  let penBusy = false;
  function bakePieces() {
    if (penBusy || !els.size) return;
    let w = 0;
    for (const [, el] of els) w = Math.max(w, el.__c.svg.getBoundingClientRect().width);
    if (!w) return;
    const ppu = Math.min(5, Math.max(1.5, Math.ceil((w / 120) * (window.devicePixelRatio || 1) * 4) / 2));
    for (const [, el] of els) if (el.__c.ppu < ppu) CR.bake(el.__c, ppu);
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

  /* ---------- the squares (buttons, for pointer and keyboard) ---------- */

  const btns = new Map();
  let focusSq = 4;
  function buildSquares() {
    squaresEl.replaceChildren();
    btns.clear();
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const f = flipped ? 7 - col : col, r = flipped ? row : 7 - row, sq = r * 16 + f;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cx-sq";
      b.dataset.sq = sq;
      b.tabIndex = sq === focusSq ? 0 : -1;
      b.addEventListener("click", () => onSquare(sq));
      b.addEventListener("pointerenter", () => hover(sq, true));
      b.addEventListener("pointerleave", () => hover(sq, false));
      b.addEventListener("focus", () => { focusSq = sq; hover(sq, true); });
      b.addEventListener("blur", () => hover(sq, false));
      squaresEl.append(b);
      btns.set(sq, b);
    }
    labelSquares();
  }
  function labelSquares() {
    for (const [sq, b] of btns) {
      const p = game.get(sq);
      b.setAttribute("aria-label", `${name(sq)}, ${p ? `${TEAM[colorOf(p)]} ${CREATURE[p & 7][colorOf(p)]} (${KIND[p & 7]})` : "empty"}`);
    }
  }
  squaresEl.addEventListener("keydown", (e) => {
    const step = { ArrowUp: 16, ArrowDown: -16, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = focusSq + (flipped ? -step : step);
    if (next & 0x88) return;
    btns.get(focusSq).tabIndex = -1;
    focusSq = next;
    const b = btns.get(next);
    b.tabIndex = 0;
    b.focus();
  });

  // pointing at a creature makes it look up and lean toward you; pointing at a target draws the trail
  let peeked = null;
  function hover(sq, on) {
    if (on && selected >= 0) drawMarks(sq);
    const el = els.get(sq);
    if (!anim) return;
    if (on && el && el !== peeked && !busy) {
      if (peeked) G.to(peeked.__act, { y: 0, rotation: 0, duration: 0.3 });
      peeked = el;
      G.to(el.__act, { y: -8, rotation: R(-5, 5), duration: 0.25, ease: "back.out(3)" });
    } else if (!on && el && el === peeked) {
      G.to(el.__act, { y: 0, rotation: 0, duration: 0.35, ease: "power2.out" });
      peeked = null;
    }
  }

  function humanTurn() {
    if (mode === "online") return !over && !busy && net.ready && !net.pending && net.players.length === 2 && game.turn === human;
    return !over && !busy && (mode === "friend" || game.turn === human);
  }

  // a lean or a squash that was cut off halfway (a scene called off, a move that came first) would leave a creature
  // tilted; at the next touch everyone who is just standing on their square stands up straight again
  function straighten() {
    if (!anim || motions.length || busy) return;
    for (const [sq, el] of els) {
      if (el.__away || el.__at !== sq || el === peeked || !el.isConnected) continue;
      const a = el.__act;
      if (["rotation", "x", "y"].some((k) => Math.abs(G.getProperty(a, k)) > 0.5) || ["scaleX", "scaleY"].some((k) => Math.abs(G.getProperty(a, k) - 1) > 0.02))
        G.to(a, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: "power2.out", overwrite: "auto" });
      if (!el.__live) wake(el);
    }
  }
  document.addEventListener("pointerdown", straighten, true);
  document.addEventListener("keydown", straighten, true);
  function onSquare(sq) {
    if (mode === "online" && !humanTurn()) {
      const p = game.get(sq);
      if (p && human >= 0 && colorOf(p) === human && !over) onlineMsg(net.players.length < 2 ? "Wait for your friend to join." : "Not your turn yet.");
      else if (p) poke(sq);
      return;
    }
    if (!humanTurn()) { if (game.get(sq)) poke(sq); return; }
    const p = game.get(sq);
    if (selected >= 0) {
      const options = legal.filter((m) => m.to === sq);
      if (options.length) { choose(options); return; }
    }
    if (p && colorOf(p) === game.turn) select(sq);
    else { if (p) poke(sq); deselect(); }
  }
  function select(sq) {
    selected = sq;
    legal = game.moves({ from: sq });
    drawMarks(sq, true);
    fidget(sq);
    { const p = game.get(sq); sfx("select", p & 7, colorOf(p)); }
    if (!anim) return;
    const el = els.get(sq);
    // the chosen one jumps for joy and waves; its friends turn to look at it
    const c = el.__c;
    if (c.state === "open") CR.setFace(c, "happy", c.spec.face.beak ? "open" : "grin");
    G.delayedCall(0.9, () => { if (c.state === "happy") CR.restFace(c); });
    G.timeline().to(el.__act, { y: -26, scaleY: 1.1, scaleX: 0.92, duration: 0.18, ease: "power2.out" })
      .to(el.__act, { y: 0, scaleY: 1, scaleX: 1, duration: 0.45, ease: "bounce.out" });
    const wave = c.arms[c.arms.length - 1];
    if (wave && !c.spec.wings) G.timeline().to(wave, { rotation: -130, svgOrigin: wave.dataset.o, duration: 0.15 }).to(wave, { rotation: -100, svgOrigin: wave.dataset.o, duration: 0.12, yoyo: true, repeat: 3 }).to(wave, { rotation: 0, svgOrigin: wave.dataset.o, duration: 0.3 });
    const me = spot(sq);
    for (const [s2, other] of els) {
      if (other === el || colorOf(other.__p) !== colorOf(el.__p)) continue;
      const dx = spot(s2).x - me.x;
      G.to(other.__body, { rotation: `+=${dx > 0 ? -5 : 5}`, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut", delay: R(0, 0.2) });
      // and their eyes follow it
      G.to(other.__c.pupils, { x: dx > 0 ? -1.6 : 1.6, duration: 0.2, yoyo: true, repeat: 1, repeatDelay: 0.6 });
    }
  }
  function deselect() {
    if (selected >= 0) { sfx("deselect"); neigh(selected); }
    if (selected >= 0 && anim) {
      const ring = marks.querySelector(".cx-ring");
      if (ring) {
        // the ring is scribbled out and fades
        const c = local(selected);
        const scr = rough.svg(marks).path(`M ${c.x - 46} ${c.y + 30} L ${c.x + 46} ${c.y + 6} M ${c.x - 40} ${c.y + 8} L ${c.x + 42} ${c.y + 34}`, { stroke: "#4a4d57", strokeWidth: 2, roughness: 2, seed: 4 });
        marks.append(scr);
      }
      selected = -1; legal = [];
      G.to(marks.children, { opacity: 0, duration: 0.3, onComplete: () => drawMarks() });
      return;
    }
    selected = -1; legal = []; drawMarks();
  }

  async function choose(options) {
    let m = options[0];
    if (options.length > 1) m = await askPromotion(options);
    if (!m) return;
    if (mode === "online") {
      selected = -1; legal = []; drawMarks();
      if (net.send({ t: "move", from: m.from, to: m.to, promo: m.promo || 0 })) net.pending = true;
      return;
    }
    selected = -1; legal = [];
    playMove(m);
    pace();
    if (mode === "puzzle") { puzzleAnswer(m); return; }
    if (!over && mode === "cpu" && game.turn !== human) computer();
  }

  function askPromotion(options) {
    const dlg = $("promo"), row = $("promo-row");
    row.replaceChildren();
    return new Promise((ok) => {
      for (const m of options) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `${CREATURE[m.promo & 7][colorOf(m.piece)]} (${KIND[m.promo & 7]})`);
        b.append(mini(m.promo));
        b.addEventListener("click", () => { dlg.close(); ok(m); });
        row.append(b);
      }
      dlg.addEventListener("cancel", () => ok(null), { once: true });
      dlg.showModal();
      if (anim) G.from(row.children, { y: 30, opacity: 0, rotation: () => R(-20, 20), stagger: 0.07, duration: 0.5, ease: "back.out(2)" });
    });
  }

  /* ---------- moving: every kind travels its own way ---------- */

  // The game moves on at once: the board state, the move list, the turn and the clock update immediately,
  // so the next move can be made straight away. The animations keep their full length and play one after
  // another, in the order the moves were made. Only undo, flip, a new game or a fresh online state
  // put everything in place at once, since they redraw the board anyway.
  let motion = null;
  const motions = [];
  function finishMotion() { motions.splice(0).forEach((j) => j.finishNow()); }
  async function playMove(m) {
    if (outing) outing.hurry();
    const us = game.turn;
    const victimSq = m.flags & E.F_EP ? m.to + (us ? 16 : -16) : m.to;
    const mover = els.get(m.from), victim = m.captured ? els.get(victimSq) : null;
    let rook = null;
    if (m.flags & E.F_KCASTLE) rook = { el: els.get(m.to + 1), from: m.to + 1, to: m.to - 1 };
    if (m.flags & E.F_QCASTLE) rook = { el: els.get(m.to - 2), from: m.to - 2, to: m.to + 1 };

    const san = game.play(m);
    lastMove = m;
    drawMarks();
    els.delete(m.from);
    if (victim) els.delete(victimSq);
    if (rook) { els.delete(rook.from); els.set(rook.to, rook.el); }
    els.set(m.to, mover);
    if (peeked) { G.to(peeked.__act, { y: 0, rotation: 0, duration: 0.2 }); peeked = null; }

    const tray = victim ? $(`tray-${colorOf(m.captured)}`) : null;
    const job = { done: false, tls: [], trayed: false, grown: false, stopDizzy: null };
    job.track = (tl) => { job.tls.push(tl); return play(tl); };
    job.addToTray = () => {
      if (job.trayed || !tray) return;
      job.trayed = true;
      const im = mini(m.captured);
      tray.append(im);
      if (anim) G.from(im, { y: -40, rotation: R(-180, 180), scale: 0.3, duration: 0.8, ease: "bounce.out" });
    };
    // put everything where the move left it, right now
    job.finishNow = () => {
      if (job.done) return;
      job.done = true;
      job.shown();
      job.tls.forEach((t) => t.kill());
      const fix = (el, sq) => {
        if (!el) return;
        G.killTweensOf([el, el.__act]);
        G.set(el.__act, { x: 0, y: 0, rotation: 0, scale: 1, scaleX: 1, scaleY: 1 });
        el.style.opacity = "";
        place(el, sq);
        CR.settle(el.__c);
      };
      fix(mover, m.to);
      if (rook) fix(rook.el, rook.to);
      if (job.stopDizzy) job.stopDizzy();
      if (victim) { G.killTweensOf([victim, victim.__act]); victim.remove(); job.addToTray(); }
      if (m.promo && !job.grown) growNow(mover, m);
      paintWorry();
    };
    const prev = motion;
    motion = job;
    motions.push(job);

    job.shown = afterMove(m, san);
    job.promise = (async () => {
      if (prev) await prev.promise;
      if (job.done) return;
      const t = spot(m.to);
      camTo(t.x, t.y - t.w * 0.4, victim ? 1.14 : 1.05, victim ? 1.4 : 0.2);
      if (victim) await fight(mover, victim, m, victimSq, job);
      else if (rook) { sfx("castle"); await Promise.all([travel(mover, m.from, m.to, 6, 0, job), travel(rook.el, rook.from, rook.to, 4, 0.12, job)]); }
      else {
        const queen = (m.piece & 7) === 5;
        if (queen) divaClear(m);
        await travel(mover, m.from, m.to, m.piece & 7, 0, job);
        if (queen && !job.done) divaWave(mover, m.to);
      }
      if (job.done) return;
      if (m.promo) { await grow(mover, m, job); job.grown = true; }
      if (job.done) return;
      job.done = true;
      if (motions.includes(job)) motions.splice(motions.indexOf(job), 1);
      paintWorry();
      job.shown();
    })();
    return job.promise;
  }

  // the creature's feet go from one square to the next with its kind's gait
  function travel(el, from, to, kind, delay = 0, job = null) {
    const a = spot(from), b = spot(to);
    el.style.zIndex = String(Math.max(Number(zOf(a)), Number(zOf(b))) + 50);
    const end = () => { place(el, to); };
    if (!anim) { end(); return Promise.resolve(); }
    const dist = Math.max(Math.abs((to & 7) - (from & 7)), Math.abs((to >> 4) - (from >> 4)));
    const dir = b.x >= a.x ? 1 : -1;
    const act = el.__act;
    const sk = el.__p ? el.__p & 7 : kind, ss = el.__p ? colorOf(el.__p) : 0;
    const to2 = (s) => ({ x: s.x - s.w / 2, y: s.y - s.w, scale: s.k });
    const gait = CR.walk(el.__c, kind === 2 ? 0.09 : kind === 6 ? 0.2 : 0.13);
    gait.pause();
    const tl = G.timeline({ delay, onInterrupt: () => { gait.kill(); CR.settle(el.__c); }, onStart: () => { gait.play(); sfx("move", sk, ss); }, onComplete: () => { gait.kill(); CR.settle(el.__c); end(); } });
    // anticipation: crouch and lean back
    tl.to(act, { scaleY: 0.8, scaleX: 1.14, rotation: -dir * 6, transformOrigin: "50% 100%", duration: 0.14, ease: "power2.in" });
    const steps = kind === 1 || kind === 3 || kind === 6 ? Math.max(1, dist) : 1;
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const mid = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, w: a.w + (b.w - a.w) * f, k: a.k + (b.k - a.k) * f };
      const pos = to2(mid);
      const prevY = i === 1 ? G.getProperty(el, "y") : to2({ x: 0, y: a.y + (b.y - a.y) * ((i - 1) / steps), w: mid.w }).y;
      if (kind === 4) {
        // rooks slide, leaning into it, kicking up dust
        tl.to(act, { scaleY: 1, scaleX: 1, rotation: dir * 10, duration: 0.12 })
          .to(el, { x: pos.x, y: pos.y, scale: mid.k, duration: 0.25 + dist * 0.07, ease: "power2.inOut", onUpdate: () => { if (Math.random() < 0.25) dust(G.getProperty(el, "x") + mid.w / 2, G.getProperty(el, "y") + mid.w, 1); } });
      } else if (kind === 2) {
        // knights leap high and somersault
        tl.to(act, { scaleY: 1.1, scaleX: 0.92, duration: 0.1 })
          .to(el, { x: pos.x, scale: mid.k, duration: 0.6, ease: "power1.inOut" }, ">")
          .to(el, { keyframes: [{ y: Math.min(prevY, pos.y) - mid.w * 1.3, duration: 0.3, ease: "power2.out" }, { y: pos.y, duration: 0.3, ease: "power2.in" }] }, "<")
          .to(act, { rotation: `${dir * 360}`, duration: 0.6, ease: "power1.inOut" }, "<")
          .set(act, { rotation: 0 });
      } else if (kind === 5) {
        // queens fly: up, across, and down
        tl.to(act, { scaleY: 1.12, scaleX: 0.9, rotation: dir * 8, duration: 0.15 })
          .to(el, { y: Math.min(prevY, pos.y) - mid.w * 0.9, duration: 0.3, ease: "power2.out" }, ">")
          .to(el, { x: pos.x, scale: mid.k, duration: 0.5, ease: "sine.inOut" })
          .to(el, { y: pos.y, duration: 0.3, ease: "power2.in" });
      } else {
        // pawns hop, bishops glide in little steps, kings waddle slowly
        const lift = kind === 6 ? mid.w * 0.18 : kind === 3 ? mid.w * 0.25 : mid.w * 0.5;
        const d = kind === 6 ? 0.42 : kind === 3 ? 0.22 : 0.36;
        tl.to(act, { scaleY: 1.08, scaleX: 0.94, rotation: kind === 6 ? (i % 2 ? 9 : -9) : 0, duration: 0.08 })
          .to(el, { x: pos.x, scale: mid.k, duration: d, ease: "power1.inOut" }, ">")
          .to(el, { keyframes: [{ y: Math.min(prevY, pos.y) - lift, duration: d / 2, ease: "power2.out" }, { y: pos.y, duration: d / 2, ease: "power2.in" }] }, "<")
          .call(() => { dust(G.getProperty(el, "x") + mid.w / 2, G.getProperty(el, "y") + mid.w, 2); sfx("step", sk, ss); });
      }
    }
    // landing: squash, then spring back
    tl.to(act, { scaleY: 0.78, scaleX: 1.18, rotation: 0, duration: 0.07 })
      .call(() => { dust(b.x, b.y, 3); sfx("land", sk, ss); })
      .to(act, { scaleY: 1, scaleX: 1, duration: 0.55, ease: "elastic.out(1, 0.4)" });
    return job ? job.track(tl) : play(tl);
  }

  function growNow(el, m) {
    const fresh = CR.make(m.promo);
    el.__c.svg.replaceWith(fresh.svg);
    dressUp(fresh);
    sleep(el);
    el.__c = fresh; el.__p = m.promo; el.dataset.key = key(m.promo);
    if (anim) wake(el);
    bakePieces();
  }
  async function grow(el, m, job) {
    sfx("grow");
    const s = spot(m.to);
    if (!anim) { const fresh = CR.make(m.promo); el.__c.svg.replaceWith(fresh.svg); dressUp(fresh); el.__c = fresh; el.__p = m.promo; return; }
    burst(s.x, s.y - s.w * 0.5, 10);
    const track = job ? job.track : play;
    await track(G.timeline()
      .to(el.__act, { rotation: 720, scale: 0.2, duration: 0.6, ease: "power2.in" })
      .call(() => {
        const fresh = makeEl(m.promo);
        fresh.remove();
        el.__act.replaceWith(fresh.__act);
        sleep(fresh);
        Object.assign(el, { __act: fresh.__act, __body: fresh.__body, __c: fresh.__c, __p: m.promo });
        el.dataset.key = key(m.promo);
        wake(el);
        bakePieces();
        if (job) job.grown = true;
        G.set(el.__act, { rotation: 0, scale: 0.2 });
      })
      .to({}, { duration: 0.01 })
      .add(() => { G.to(el.__act, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.4)" }); }));
    await wait(700);
  }

  /* ---------- captures get personal: every kind has its own move ---------- */

  const WORDS = { 1: ["BONK!", "GULP!"], 2: ["WHAM!", "WHAM!"], 3: ["SLASH!", "ZAP!"], 4: ["BOOM!", "POW!"], 5: ["ZING!", "PECK!"], 6: ["SLAP!", "SPLAT!"] };

  // each returns a timeline that ends at the moment of impact; ctx has screen points of both creatures
  const MOVES = {
    // mushroom: a running headbutt; blob: grows huge over its victim
    1: (c) => c.side
      ? G.timeline().to(c.ma, { scale: 1.5, y: -10, duration: 0.3, ease: "back.out(2)" }).to(c.ma, { scale: 1, y: 0, duration: 0.25, ease: "power2.in" })
      : G.timeline().to(c.ma, { rotation: c.dir * 30, x: c.dir * c.w * 0.35, duration: 0.18, ease: "power3.in" }).to(c.ma, { rotation: 0, x: 0, duration: 0.3, ease: "power2.out" }),
    // pony and zebra rear up and kick
    2: (c) => G.timeline().to(c.ma, { rotation: -c.dir * 32, y: -c.w * 0.15, duration: 0.3, ease: "power2.out" })
      .to(c.ma, { rotation: c.dir * 24, y: 0, duration: 0.12, ease: "power4.in" })
      .call(() => wind(c.tx - c.dir * c.w * 0.3, c.ty - c.w * 0.4, c.dir))
      .to(c.ma, { rotation: 0, duration: 0.4, ease: "elastic.out(1, 0.5)" }),
    // acorn throws an acorn; wizard casts a zigzag bolt
    3: (c) => c.side ? bolt(c) : lob(c),
    // castle jumps and stamps a shockwave; puffball rolls into its victim
    4: (c) => c.side
      ? G.timeline().to(c.ma, { rotation: c.dir * 540, x: c.dir * c.w * 0.3, duration: 0.45, ease: "power2.in" }).set(c.ma, { rotation: 0 }).to(c.ma, { x: 0, duration: 0.3 })
      : G.timeline().to(c.ma, { y: -c.w * 0.9, scaleY: 1.1, duration: 0.3, ease: "power2.out" }).to(c.ma, { y: 0, scaleY: 0.75, scaleX: 1.2, duration: 0.14, ease: "power4.in" })
        .call(() => { quake(c.mx, c.my); shake(10); }).to(c.ma, { scaleY: 1, scaleX: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" }),
    // bee queen waves her wand and a stream of stars flies; crested bird pecks three times
    5: (c) => c.side
      ? G.timeline().to(c.ma, { rotation: c.dir * 22, x: c.dir * c.w * 0.25, duration: 0.09, yoyo: true, repeat: 5, ease: "power2.in" })
      : G.timeline().to(c.ma, { rotation: -c.dir * 15, duration: 0.2 }).call(() => wand(c)).to(c.ma, { rotation: c.dir * 12, duration: 0.15 }).to({}, { duration: 0.4 }).to(c.ma, { rotation: 0, duration: 0.3 }),
    // owl slaps with a wing; penguin belly-slides into its victim
    6: (c) => c.side
      ? G.timeline().to(c.ma, { rotation: c.dir * 80, y: c.w * 0.25, duration: 0.2, ease: "power2.in" }).to(c.ma, { x: c.dir * c.w * 0.4, duration: 0.2, ease: "power3.in" }).to(c.ma, { rotation: 0, x: 0, y: 0, duration: 0.4, ease: "back.out(2)" })
      : G.timeline().to(c.ma, { rotation: -c.dir * 25, duration: 0.2 }).to(c.ma, { rotation: c.dir * 35, duration: 0.1, ease: "power4.in" })
        .call(() => wind(c.tx - c.dir * c.w * 0.2, c.ty - c.w * 0.5, c.dir)).to(c.ma, { rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" }),
  };
  function wind(x, y, dir) {
    for (let i = 0; i < 3; i++) {
      const p = rcFx().path(`M 0 ${i * 12} q ${dir * 22} -14 ${dir * 44} 0`, { stroke: "#7db7ef", strokeWidth: 2.4, roughness: 1, seed: 40 + i });
      fx.append(p);
      G.timeline({ onComplete: () => p.remove() }).set(p, { x: x - dir * 20, y: y + R(-6, 6) }).to(p, { x: x + dir * 30, opacity: 0, duration: 0.45, ease: "power2.out", delay: i * 0.05 });
    }
  }
  function lob(c) {
    const nut = svgEl("g");
    nut.append(rcFx().ellipse(0, 4, 16, 20, { fill: "#d89a3a", fillStyle: "solid", stroke: "#6b4416", strokeWidth: 1.4, roughness: 1, seed: 2 }));
    nut.append(rcFx().ellipse(0, -5, 18, 9, { fill: "#8a5a26", fillStyle: "solid", stroke: "#4a2c0e", strokeWidth: 1.2, roughness: 1, seed: 3 }));
    fx.append(nut);
    const x0 = c.mx, y0 = c.my - c.w * 0.7, x1 = c.tx, y1 = c.ty - c.w * 0.6;
    return G.timeline({ onComplete: () => nut.remove() })
      .to(c.ma, { rotation: -c.dir * 25, duration: 0.2 })
      .to(c.ma, { rotation: c.dir * 15, duration: 0.1 })
      .set(nut, { x: x0, y: y0 })
      .to(nut, { x: x1, duration: 0.45, ease: "none" }, "<")
      .to(nut, { keyframes: [{ y: Math.min(y0, y1) - c.w * 0.8, duration: 0.225, ease: "power2.out" }, { y: y1, duration: 0.225, ease: "power2.in" }] }, "<")
      .to(nut, { rotation: 540, duration: 0.45, ease: "none" }, "<")
      .to(c.ma, { rotation: 0, duration: 0.3 }, "<");
  }
  function bolt(c) {
    const pts = [];
    const x0 = c.mx, y0 = c.my - c.w * 0.75, x1 = c.tx, y1 = c.ty - c.w * 0.5;
    for (let i = 0; i <= 7; i++) { const f = i / 7; pts.push([x0 + (x1 - x0) * f + (i % 2 ? 1 : -1) * (i && i < 7 ? 14 : 0), y0 + (y1 - y0) * f + (i % 2 ? -10 : 10) * (i && i < 7 ? 1 : 0)]); }
    const z = rcFx().linearPath(pts, { stroke: "#9b59e8", strokeWidth: 4, roughness: 1.2, seed: 5 });
    fx.append(z);
    const path = z.querySelector("path");
    const L = path ? path.getTotalLength() : 300;
    if (path) { path.style.strokeDasharray = `${L}`; path.style.strokeDashoffset = `${L}`; }
    return G.timeline({ onComplete: () => z.remove() })
      .to(c.ma, { y: -c.w * 0.12, rotation: c.dir * 8, duration: 0.25, ease: "power2.out" })
      .to(path || z, { strokeDashoffset: 0, duration: 0.18, ease: "none" })
      .to(z, { opacity: 0.2, duration: 0.05, yoyo: true, repeat: 3 })
      .to(c.ma, { y: 0, rotation: 0, duration: 0.3 }, "<");
  }
  function wand(c) {
    for (let i = 0; i < 6; i++) {
      const st = star(R(6, 10), 60 + i, i % 2 ? "#f7c933" : "#f28ab2");
      fx.append(st);
      G.timeline({ delay: i * 0.06, onComplete: () => st.remove() })
        .set(st, { x: c.mx + c.dir * c.w * 0.3, y: c.my - c.w * 0.8 })
        .to(st, { x: c.tx + R(-10, 10), y: c.ty - c.w * 0.5 + R(-12, 12), rotation: 360, duration: 0.45, ease: "power1.in" })
        .to(st, { opacity: 0, scale: 2, duration: 0.2 });
    }
  }
  function quake(x, y) {
    for (let i = 0; i < 3; i++) {
      const e = rcFx().ellipse(0, 0, 60, 18, { stroke: "#8a7a5a", strokeWidth: 2, roughness: 1.5, seed: 70 + i });
      fx.append(e);
      G.timeline({ delay: i * 0.1, onComplete: () => e.remove() }).set(e, { x, y, scale: 0.4 }).to(e, { scale: 3, opacity: 0, duration: 0.7, ease: "power2.out" });
    }
  }

  async function fight(mover, victim, m, victimSq, job) {
    const tray = $(`tray-${colorOf(m.captured)}`);
    const addToTray = job.addToTray;
    if (!anim) { victim.remove(); place(mover, m.to); addToTray(); return; }
    const kind = m.piece & 7, side = colorOf(m.piece);
    const a = spot(m.from), t = spot(victimSq);
    const dir = t.x >= a.x ? 1 : -1;
    if (firstCapture) { firstCapture = false; say("captures get personal"); }
    // the victim notices: wide-eyed, a jump back
    const others = [...els].filter(([s2, el]) => el !== mover && Math.max(Math.abs((s2 & 7) - (victimSq & 7)), Math.abs((s2 >> 4) - (victimSq >> 4))) === 1).map(([, el]) => el);
    G.timeline().to(victim.__act, { y: -14, scaleY: 1.12, duration: 0.15, ease: "power2.out" }).to(victim.__act, { y: 0, scaleY: 1, duration: 0.3, ease: "bounce.out" });
    sfx("whoosh");
    // the attacker charges to just short of the square
    const near = { x: a.x + (t.x - a.x) * 0.62, y: a.y + (t.y - a.y) * 0.62, w: t.w, k: t.k };
    mover.style.zIndex = String(Number(zOf(t)) + 60);
    await job.track(G.timeline()
      .to(mover.__act, { scaleY: 0.78, scaleX: 1.16, rotation: -dir * 10, transformOrigin: "50% 100%", duration: 0.22, ease: "power2.in" })
      .to(mover.__act, { scaleY: 1, scaleX: 1, rotation: dir * 6, duration: 0.1 })
      .to(mover, { x: near.x - near.w / 2, y: near.y - near.w, scale: near.k, duration: 0.3, ease: "power2.in" }, "<")
      .call(() => dust(near.x, near.y, 3)));
    if (job.done) return;
    // its own move, ending at the moment of impact
    const ctx = { ma: mover.__act, side, dir, w: t.w, mx: near.x, my: near.y, tx: t.x, ty: t.y, c: mover.__c };
    CR.setFace(mover.__c, "hurt", mover.__c.spec.face.beak ? "open" : "grin");
    CR.setFace(victim.__c, "scared", victim.__c.spec.face.beak ? "open" : "open");
    limbs(mover.__c, kind, dir);
    sfx("windup", kind, side);
    await job.track((MOVES[kind] || MOVES[1])(ctx));
    if (job.done) return;
    sfx("hit", kind, side);
    if (victim.__p) sfx("ouch", victim.__p & 7, colorOf(victim.__p));
    // impact: a word, stars, the camera shakes, the neighbours jump
    const hx = t.x, hy = t.y - t.w * 0.55;
    word(pick([WORDS[kind][side], WORDS[kind][side], "POW!"]), hx, hy - t.w * 0.5, side ? "#3c4fb8" : "#e8432e");
    burst(hx, hy, 9);
    shake(7);
    spout();
    sunLaugh();
    others.forEach((el) => G.timeline().to(el.__act, { y: -18, rotation: R(-12, 12), duration: 0.14, ease: "power2.out" }).to(el.__act, { y: 0, rotation: 0, duration: 0.4, ease: "bounce.out" }));
    // the loser falls flat on its back, eyes crossed, stars circling
    victim.__ko = true;
    if (shivers.has(victim)) { shivers.get(victim).kill(); shivers.delete(victim); }
    if (victim.__drip) victim.__drip.kill();
    sleep(victim);
    const vc = victim.__c;
    CR.setFace(vc, "hurt", vc.spec.face.beak ? "open" : "open");
    lastWords(victim, t.x - dir * t.w * 0.15, t.y - t.w * 1.25);
    G.delayedCall(0.45, () => CR.setFace(vc, "dizzy", vc.spec.face.beak ? "none" : "wavy"));
    hatOff(vc, dir);
    if (vc.hat) sfx("pop");
    setTimeout(() => sfx("dizzy"), 450);
    // legs and arms fly up as it goes over
    vc.legs.forEach((l, i) => G.to(l, { rotation: dir * (i % 2 ? 40 : 60), svgOrigin: l.dataset.o, duration: 0.3, ease: "power2.out" }));
    vc.arms.forEach((a, i) => G.to(a, { rotation: (i ? -1 : 1) * 120, svgOrigin: a.dataset.o, duration: 0.3, ease: "power2.out" }));
    CR.restFace(mover.__c);
    CR.setFace(mover.__c, "happy", mover.__c.spec.face.beak ? "open" : "grin");
    G.delayedCall(1.6, () => CR.restFace(mover.__c));
    const fallDir = dir;
    await job.track(G.timeline()
      .to(victim.__act, { rotation: fallDir * 88, x: fallDir * t.w * 0.25, y: t.w * 0.1, scaleY: 0.9, transformOrigin: "50% 95%", duration: 0.35, ease: "bounce.out" }));
    if (job.done) return;
    const stopDizzy = dizzy(t.x + fallDir * t.w * 0.3, t.y - t.w * 0.18, t.w);
    job.stopDizzy = stopDizzy;
    // the winner steps onto the square and stamps
    // (one plain hop from where it stands; "0" is no kind's gait, so it hops once)
    const landing = travel(mover, m.from, m.to, 0, 0, job);
    await wait(500);
    if (job.done) return;
    sfx("float");
    // the loser floats up as a little ghost and drifts off to the tray
    const trayBox = tray.getBoundingClientRect(), camBox = cam.getBoundingClientRect();
    const tx = trayBox.left - camBox.left + Math.min(trayBox.width, 200), ty = trayBox.top - camBox.top;
    await job.track(G.timeline()
      .to(victim, { opacity: 0.55, y: `-=${t.w * 0.6}`, duration: 0.5, ease: "sine.out" })
      .to(victim.__act, { rotation: 0, duration: 0.5 }, "<")
      .call(stopDizzy)
      .to(victim, { x: tx, y: ty, scale: 0.25, opacity: 0, duration: 0.8, ease: "power2.in" }));
    if (job.done) return;
    victim.remove();
    job.stopDizzy = null;
    addToTray();
    await landing;
    if (job.done) return;
    await job.track(G.timeline().to(mover.__act, { y: -10, duration: 0.1, yoyo: true, repeat: 3, ease: "power2.out" }));
  }
  // what the attacker's own limbs do on the way in: kicks, wand flicks, wing slaps, a headbutt
  function limbs(c, kind, dir) {
    const o = (g) => g.dataset.o;
    if (c.spec.horse) {
      // a pony or zebra rears up and kicks out with the back legs
      const back = c.legs.slice(2);
      G.timeline().to(back, { rotation: -dir * 70, svgOrigin: o(back[0]), duration: 0.18, ease: "power3.in", delay: 0.32 }).to(back, { rotation: 0, svgOrigin: o(back[0]), duration: 0.35, ease: "back.out(2)" });
      if (c.head) G.timeline().to(c.head, { rotation: dir * 18, svgOrigin: o(c.head), duration: 0.3 }).to(c.head, { rotation: 0, svgOrigin: o(c.head), duration: 0.4 });
      return;
    }
    if (c.prop && kind === 5) G.timeline().to(c.prop, { rotation: -60, svgOrigin: o(c.prop), duration: 0.22 }).to(c.prop, { rotation: 40, svgOrigin: o(c.prop), duration: 0.12, ease: "power3.in" }).to(c.prop, { rotation: 0, svgOrigin: o(c.prop), duration: 0.4 });
    if (c.spec.wings) { G.to(c.arms, { scaleY: 0.3, svgOrigin: o(c.arms[0]), duration: 0.05, yoyo: true, repeat: 9 }); return; }
    // everyone else winds up an arm and swings it (the acorn draws a wooden sword for it)
    const arm = dir > 0 ? c.arms[1] : c.arms[0];
    if (arm && c.key === "w-bishop") {
      const [hx, hy] = arm === c.arms[1] ? [80, 61] : [20, 61], sgn = arm === c.arms[1] ? 1 : -1;
      const sword = svgEl("g", { class: "cx-sword" });
      const rc = rough.svg(c.svg);
      sword.append(rc.path(`M ${hx} ${hy} L ${hx + sgn * 4} ${hy - 30} L ${hx + sgn * 7} ${hy - 33} L ${hx + sgn * 6} ${hy - 1} Z`, { stroke: "#7a4a1c", strokeWidth: 1.2, fill: "#d8b07a", fillStyle: "solid", roughness: 0.8, seed: 77 }));
      sword.append(rc.line(hx - 6, hy + 1, hx + 8 * sgn + (sgn < 0 ? 0 : 0), hy - 2, { stroke: "#7a4a1c", strokeWidth: 3, roughness: 0.5, seed: 78 }));
      arm.append(sword);
      G.fromTo(sword, { opacity: 0 }, { opacity: 1, duration: 0.1 });
      G.delayedCall(1.3, () => G.to(sword, { opacity: 0, duration: 0.3, onComplete: () => sword.remove() }));
    }
    if (arm) G.timeline().to(arm, { rotation: dir > 0 ? 140 : -140, svgOrigin: o(arm), duration: 0.25, ease: "power2.out" }).to(arm, { rotation: dir > 0 ? -30 : 30, svgOrigin: o(arm), duration: 0.1, ease: "power4.in" }).to(arm, { rotation: 0, svgOrigin: o(arm), duration: 0.4, ease: "back.out(2)" });
    if (c.hat && kind === 1) G.timeline().to(c.hat, { rotation: dir * 20, svgOrigin: o(c.hat), duration: 0.25 }).to(c.hat, { rotation: 0, svgOrigin: o(c.hat), duration: 0.5, ease: "elastic.out(1, 0.4)" });
  }
  // the hat, cap, crown or battlements comes off and spins away
  function hatOff(c, dir) {
    if (!c.hat) return;
    G.timeline().to(c.hat, { x: dir * 26, y: -46, rotation: dir * 260, svgOrigin: c.hat.dataset.o, duration: 0.5, ease: "power2.out" })
      .to(c.hat, { y: -10, x: dir * 40, rotation: dir * 400, svgOrigin: c.hat.dataset.o, duration: 0.45, ease: "bounce.out" });
  }

  function say(text) {
    if (!anim) return;
    caption.textContent = text;
    G.timeline()
      .fromTo(caption, { opacity: 0, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "power1.inOut" })
      .to(caption, { opacity: 0, duration: 0.5 }, "+=0.8");
  }

  /* ---------- after each move ---------- */

  // the move list, the clock and the status line change at once; the rest is shown when the creature
  // has finished playing the move out (the returned function, called once)
  function afterMove(m, san) {
    writeMoves(true);
    labelSquares();
    armIdle();
    moveMade(m);
    const st = game.status();
    const turn = game.turn;
    const king = st.check ? [...els].find(([, el]) => (el.__p & 7) === 6 && colorOf(el.__p) === turn) : null;
    if (st.over) { over = st; stopClock(); }
    else { clockSwitch(); statusLine(st, m); }
    let shown = false;
    return () => {
      if (shown) return;
      shown = true;
      paintWorry();
      paintTurn();
      whale();
      nudgePencils();
      moveShown(turn ^ 1);
      const cheered = captureStreak(m, turn ^ 1);
      if (st.over) { if (over === st) finish(st); return; }
      if (!cheered) remark(m, st);
      if (st.check) {
        sfx("check");
        nervousKing(turn);
        // the camera pushes in on the king in check and the stars on the string shake
        if (king && king[1].isConnected) { const s = spot(king[0]); camTo(s.x, s.y - s.w * 0.4, 1.1, 0.6); }
        if (anim && document.querySelector(".d-bunting .d-star")) G.fromTo(".d-bunting .d-star", { y: -3 }, { y: 3, duration: 0.07, yoyo: true, repeat: 7, ease: "none", clearProps: "y" });
      }
      // the board leans a little toward whoever moves next
      leanBoard(cssTilt() + (turn ? -1 : 1), 0.5);
    };
  }

  function statusLine(st, m) {
    const turn = TEAM[game.turn];
    let s;
    if (mode === "cpu") s = game.turn === human ? "Your move." : `The ${turn} team is thinking.`;
    else if (mode === "online") {
      const them = net.players.find((p) => p.color !== (human ? "b" : "w"));
      if (human < 0) s = `You are watching. The ${turn} team to move.`;
      else if (net.players.length < 2) s = "Waiting for your friend to join.";
      else s = game.turn === human ? "Your move." : `Waiting for ${them ? them.name : "your friend"}.`;
    } else s = `The ${turn} team to move.`;
    if (m) s = `${cap(who(m.promo || m.piece))} went to ${name(m.to)}. ${s}`;
    if (st && st.check) s += " Check!";
    statusEl.textContent = s;
    statusEl.classList.toggle("is-alarm", Boolean(st && st.check));
  }
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  // the moves are written into the margin one letter at a time
  function writeMoves(fresh = false) {
    const list = game.played;
    movesEl.replaceChildren();
    let newest = null;
    for (let i = 0; i < list.length; i += 2) {
      const li = document.createElement("li");
      const w = document.createElement("span");
      w.className = "w"; w.textContent = list[i].san;
      li.append(w);
      newest = w;
      if (list[i + 1]) { const b = document.createElement("span"); b.className = "b"; b.textContent = list[i + 1].san; li.append(b); newest = b; }
      movesEl.append(li);
    }
    movesEl.scrollTop = movesEl.scrollHeight;
    if (fresh && anim && newest) G.fromTo(newest, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "steps(6)" });
  }

  // a sticky note that comments on the game; each new note is slapped on and written out
  function note(text) {
    talk.textContent = text;
    sfx("note");
    if (!anim) return;
    G.timeline()
      .fromTo(talk, { rotationX: -70, y: -20, opacity: 0.3, transformPerspective: 600, transformOrigin: "50% 0%" }, { rotationX: 0, y: 0, opacity: 1, duration: 0.55, ease: "back.out(2)" })
      .fromTo(talk, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.7, ease: "steps(14)" }, "<0.1")
      .to(talk, { rotation: -1.4, duration: 0.4, ease: "elastic.out(1, 0.4)" });
  }
  function remark(m, st) {
    const mover = who(m.promo || m.piece), them = game.turn, ours = them ^ 1;
    let text;
    if (st.check) text = `${who(6 | (them ? BLACK : 0))} is nervous!`;
    else if (m.flags & (E.F_KCASTLE | E.F_QCASTLE)) text = `${who(m.piece)} hides behind ${who(4 | (ours ? BLACK : 0))}`;
    else if (m.promo) text = `${who(m.piece)} grew up into ${who(m.promo)}!`;
    else {
      const hits = all().filter((sq) => { const p = game.get(sq); return p && colorOf(p) === them && (p & 7) !== 1 && game.attackers(sq, ours).includes(m.to); });
      const big = hits.map((sq) => game.get(sq)).sort((a, b) => VALUE[b & 7] - VALUE[a & 7]);
      const hanging = game.attackers(m.to, them).length > 0 && game.attackers(m.to, ours).length === 0;
      if (hits.length >= 2) text = `fork! ${mover} wants ${who(big[0])} and ${who(big[1])}`;
      else if (m.captured) text = `${mover} flattened ${who(m.captured)}`;
      else if (hanging) text = `${mover} looks lost out there`;
      else if (big.length) text = `${mover} is eyeing ${who(big[0])}`;
      else text = pick(["the whale is watching", "hmm, a quiet one", "the moon yawns", "the snail approves", "nobody panics yet", "the sun keeps score",
        "the snail is winning on points", "the cat has seen better moves", "the crab wants a rematch", "a pawn just sighed",
        "the whale thinks you should castle", "the frog bet on purple", "the cloud is pretending not to look", "bold. very bold.",
        "the mermaid would have done that too", "the ants are taking notes", "somewhere, a grandmaster gasps", "the balloon saw that coming"]);
    }
    note(text);
  }

  function finish(st) {
    // in a puzzle only a checkmate finishes it; anything else is put back by the puzzle itself
    if (mode === "puzzle" && st.reason !== "checkmate") { over = null; return; }
    over = st;
    if (st.reason === "checkmate" || st.reason === "resigned" || st.reason === "time") {
      const winner = st.result === "1-0" ? 0 : 1;
      // online or against the computer, the fanfare is for whoever won from where you sit
      const mine = mode === "friend" ? true : winner === human;
      sfx(mine ? "win" : "lose");
    } else sfx("draw");
    stopClock();
    let text;
    if (st.reason === "checkmate" || st.reason === "resigned" || st.reason === "time") {
      const winner = st.result === "1-0" ? 0 : 1;
      text = `the ${TEAM[winner]} team wins${st.reason === "checkmate" ? "" : st.reason === "time" ? " on time" : ", the other side resigned"}!`;
      countCpuResult(winner);
      statusEl.textContent = `${st.reason === "checkmate" ? "Checkmate." : st.reason === "time" ? "Out of time." : "Resigned."} The ${TEAM[winner]} team wins.`;
      note(`${who(6 | (winner ? BLACK : 0))} does a little dance`);
      if (anim) {
        // winners dance, losers flop over, the stars swing, the sun spins
        for (const [, el] of els) {
          const c = el.__c;
          if (colorOf(el.__p) === winner) {
            // the winners cheer with both arms up
            CR.setFace(c, "happy", c.spec.face.beak ? "open" : "grin");
            G.to(el.__act, { y: -20, rotation: () => R(-10, 10), duration: 0.22, yoyo: true, repeat: 9, ease: "power2.out", delay: R(0, 0.4) });
            if (!c.spec.wings) c.arms.forEach((a, i) => G.to(a, { rotation: (i ? -1 : 1) * 150, svgOrigin: a.dataset.o, duration: 0.2, yoyo: true, repeat: 9 }));
          } else {
            // the losers sit down and cry
            CR.setFace(c, "cry", c.spec.face.beak ? "none" : "frown");
            G.to(el.__act, { scaleY: 0.85, y: 4, transformOrigin: "50% 100%", duration: 0.6, ease: "bounce.out", delay: R(0, 0.5) });
          }
        }
        if (st.reason === "resigned") whiteFlag(winner ^ 1);
        const quick = st.reason === "checkmate" && game.played.length <= 16;
        if (quick) G.delayedCall(2.6, () => replay(lastMove, game.played.length));
        if ($(`tray-${winner}`).children.length === 0) G.delayedCall(quick ? 13 : 3.2, () => teamPhoto(winner));
        if (document.querySelector(".d-bunting .d-star")) G.fromTo(".d-bunting .d-star", { y: -6 }, { y: 6, duration: 0.25, yoyo: true, repeat: 9, ease: "sine.inOut", stagger: 0.04 });
        G.fromTo(".d-sun", { rotation: 0, svgOrigin: sunAt }, { rotation: 360, svgOrigin: sunAt, duration: 2.4, ease: "power2.inOut" });
        // a slow camera sweep over the board
        G.killTweensOf(cam); G.set(cam, { transformOrigin: "50% 50%", x: 0, y: 0 });
        G.timeline().to(cam, { rotation: -2, scale: 1.06, duration: 1.6, ease: "sine.inOut" }).to(cam, { rotation: 2, duration: 2, ease: "sine.inOut" }).to(cam, { rotation: 0, scale: 1, duration: 1.4, ease: "sine.inOut" });
      }
    } else {
      text = `a draw: ${st.reason}`;
      statusEl.textContent = `Draw by ${st.reason}.`;
      note("the moon falls asleep");
      teaParty(st.reason);
      if (anim) {
        G.to(".d-sun", { y: 50, opacity: 0.4, duration: 2, ease: "power2.in" });
        G.fromTo(".d-moon", { y: -6 }, { y: 6, duration: 1.2, yoyo: true, repeat: 3, ease: "sine.inOut" });
      }
    }
    statusEl.classList.remove("is-alarm");
    say(text);
    $("resign").disabled = true;
    $("card").hidden = false;
    stickersForEnd(st);
  }

  /* ---------- the computer ---------- */

  async function computer() {
    busy = true;
    if (motion && motion.promise) await motion.promise;
    statusLine(game.status());
    await wait(anim ? 650 : 50);
    const t = performance.now();
    const m = mercyMove(think(game, level));
    // never answer instantly; a creature needs a moment
    await wait(Math.max(0, 350 - (performance.now() - t)));
    busy = false;
    if (m && !over) await playMove(m);
  }

  /* ---------- clock: each second the old number is crossed out and the new one written ---------- */

  let minutes = 0, left = [0, 0], tickAt = 0, timer = 0, shown = ["", ""];
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  function writeClock(side) {
    const text = fmt(left[side]);
    if (text === shown[side]) return;
    shown[side] = text;
    const box = $(`clock-${side}`);
    box.querySelectorAll("span:not(.is-struck)").forEach((old) => {
      old.classList.add("is-struck");
      if (anim) G.to(old, { opacity: 0, y: -10, duration: 0.6, delay: 0.25, onComplete: () => old.remove() }); else old.remove();
    });
    const s = document.createElement("span");
    s.textContent = text;
    box.append(s);
    if (anim) G.fromTo(s, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.3 });
    box.closest(".cx-clock").classList.toggle("is-low", left[side] < 30000);
    if (left[side] < 10000 && left[side] > 0) sfx("tick");
  }
  function startClock() {
    stopClock();
    $("clocks").hidden = !minutes || mode === "puzzle";
    if (!minutes || mode === "puzzle") return;
    left = [minutes * 60000, minutes * 60000];
    shown = ["", ""];
    $("clock-0").replaceChildren(); $("clock-1").replaceChildren();
    writeClock(0); writeClock(1);
    clockSwitch();
    tickAt = performance.now();
    timer = setInterval(() => {
      if (over || !minutes) return;
      const now = performance.now(), side = game.turn;
      left[side] -= now - tickAt;
      tickAt = now;
      writeClock(side);
      if (left[side] <= 0) finish({ over: true, result: side ? "1-0" : "0-1", reason: "time" });
    }, 200);
  }
  function stopClock() { clearInterval(timer); timer = 0; }
  function clockSwitch() {
    tickAt = performance.now();
    document.querySelectorAll(".cx-clock").forEach((c) => c.classList.toggle("is-running", Number(c.dataset.side) === game.turn && Boolean(minutes)));
  }

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
    lit: { before: $("cam"), place(lit, rx, ry) { const cam = $("cam"); lit.style.width = `${rx * 2}px`; lit.style.height = `${ry * 2}px`; lit.style.left = `${cam.offsetLeft + cam.offsetWidth / 2 - rx}px`; lit.style.top = `${cam.offsetTop + cam.offsetHeight / 2 - ry}px`; } },
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
          loop(G.to(buzz, { a: Math.PI * 2, duration: 3.2, repeat: -1, ease: "none", onUpdate: () => G.set(fly, { x: fx0 + 46 + Math.cos(buzz.a) * 22, y: fy0 - 46 + Math.sin(buzz.a * 2) * 10 }) }));
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
      const path = { t: j * 0.5 };
      loop(G.to(path, { t: j * 0.5 + 1, duration: 22 + j * 6, repeat: -1, ease: "none", onUpdate: () => {
        const a = path.t * Math.PI * 2;
        const x = j ? W - 120 + Math.sin(a) * 90 : bx1 + 70 + Math.sin(a * 2) * 40;
        const y = j ? H * 0.3 + Math.sin(a * 3) * 70 + Math.cos(a) * 40 : H * 0.62 + Math.sin(a) * 120;
        G.set(bf, { x, y, rotation: Math.cos(a * 3) * 18 });
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
      const ink2 = { stroke: "#3a3550", strokeWidth: 1.5, roughness: 1.1 };
      const bottom = Math.min(H - 30, by1 + 330);
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
          loop(G.timeline({ repeat: -1, yoyo: true }).fromTo(turtle, { x: left }, { x: right, duration: 50, ease: "none",
            onRepeat: () => {}, onUpdate: function () { const dir = this.parent && this.parent.reversed() ? -1 : 1; G.set(turtle, { scaleX: (narrow ? 0.8 : 1) * dir }); } }));
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
          loop(G.fromTo(cat, { x: 60 }, { x: Math.min(sx0 - 40, W * 0.6), duration: 70, ease: "none", repeat: -1, yoyo: true, onUpdate: function () { G.set(cat, { scaleX: this.reversed() ? -1 : 1 }); } }));
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
          loop(G.to(b8, { a: Math.PI * 2, duration: 5, repeat: -1, ease: "none", onUpdate: () => {
            const bx = x + Math.sin(b8.a) * 48, by = fy - 70 + Math.sin(b8.a * 2) * 22;
            G.set(bee, { x: bx, y: by, scaleX: Math.cos(b8.a) >= 0 ? 1 : -1 });
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
          loop(G.to(o, { a: Math.PI * 2, duration: 14, repeat: -1, ease: "none", onUpdate: () => G.set(gull, { x: cx + Math.cos(o.a) * (seaW * 0.32), y: cy - 90 + Math.sin(o.a) * 26, scaleX: Math.sin(o.a) > 0 ? -1 : 1 }) }));
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

  /* ---------- while nobody moves ---------- */

  // After seven quiet seconds a mushroom wanders off to the beach to play. A dolphin leaps up out of the
  // sea right next to it, the mushroom gets the fright of its life and runs back to its square.
  // Any touch, key or move calls it home at once (it still runs back, it never just jumps home).
  const IDLE_WAIT = 7;
  let idleCall = null, outing = null;
  function armIdle() {
    if (idleCall) idleCall.kill();
    idleCall = anim ? G.delayedCall(IDLE_WAIT, wanderOff) : null;
  }
  const tableEl = $("cam").parentElement;
  function pageToLayer(px, py) {
    const r = layer.getBoundingClientRect(), k = r.width / (layer.offsetWidth || 1);
    return [(px - r.left) / k, (py - r.top) / k];
  }
  function goToTheBeach(el, target, sand) {
    const home = el.__at, s0 = spot(home), c = el.__c, act = el.__act;
    const back = { x: s0.x - s0.w / 2, y: s0.y - s0.w }, there = { x: target[0] - s0.w / 2, y: target[1] - s0.w };
    const dist = Math.hypot(there.x - back.x, there.y - back.y);
    const kit = beachKit;
    const gait = CR.walk(c, 0.12);
    gait.pause();
    let dl = null, dlTl = null, boo = null, drips = null;
    const job = { done: false };
    job.promise = new Promise((ok) => { job.resolve = ok; });
    outing = job; motion = job; motions.push(job);
    el.__away = true;
    el.style.zIndex = "2000";
    // the table is lifted above the doodles so the mushroom walks over the sand, not under it
    tableEl.style.zIndex = "3";

    const startle = () => {
      CR.setFace(c, "scared", c.spec.face.beak ? "open" : "wavy");
      el.classList.add("is-startled");
      G.fromTo(el.querySelector(".cx-bang"), { scale: 0, rotation: -40 }, { scale: 1, rotation: 0, duration: 0.4, ease: "back.out(4)" });
      sfx("pop");
      sweat(el);
      drips = G.delayedCall(0.3, function again() { sweat(el); drips = G.delayedCall(0.3, again); });
    };
    const runHome = (t, fast) => {
      t.call(() => { gait.timeScale(fast ? 2.2 : 1.8); gait.play(); sfx("whoosh"); })
        .to(el, { x: back.x, y: back.y, duration: fast ? Math.max(0.5, dist / 1100) : Math.max(0.9, dist / 650), ease: "power1.in" })
        .to(act, { y: -5, duration: 0.07, yoyo: true, repeat: 15, ease: "sine.out" }, "<");
    };
    let tl = null;
    const end = () => {
      if (job.done) return;
      job.done = true;
      if (tl) tl.kill();
      if (job.tl2) job.tl2.kill();
      gait.kill();
      if (drips) drips.kill();
      if (dlTl) dlTl.kill();
      if (dl) dl.remove();
      if (boo) boo.remove();
      G.killTweensOf([el, act]);
      G.set(act, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
      el.classList.remove("is-startled");
      el.__away = false;
      tableEl.style.zIndex = "";
      place(el, home);
      CR.settle(c);
      CR.restFace(c);
      if (motions.includes(job)) motions.splice(motions.indexOf(job), 1);
      outing = null;
      job.resolve();
      armIdle();
    };

    // the dolphin's leap: out of the water, over the mushroom with a "boo!", back into the sea
    const leap = () => {
      dl = kit.dolphin();
      const p0 = kit.inSea(0.2, 0.16), p2 = kit.inSea(0.4, 0.2), p1 = [sand[0] + 40, sand[1] - 140];
      const at = (u) => { const v = 1 - u; return [v * v * p0[0] + 2 * v * u * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * v * u * p1[1] + u * u * p2[1]]; };
      const st = { u: 0 };
      kit.splash(p0[0], p0[1]);
      sfx("spout");
      boo = svgEl("text", { x: sand[0] + 46, y: sand[1] - 96, class: "d-boo" });
      boo.textContent = "boo!";
      deco.append(boo);
      dlTl = G.timeline({ onComplete: () => { kit.splash(p2[0], p2[1]); if (dl) dl.remove(); dl = null; if (boo) boo.remove(); boo = null; } })
        .to(st, { u: 1, duration: 1.5, ease: "sine.inOut", onUpdate: () => {
          const [x, y] = at(st.u), [x2, y2] = at(Math.min(1, st.u + 0.02));
          G.set(dl, { x, y, opacity: 1, scale: kit.k0 * 1.25, rotation: (Math.atan2(y2 - y, x2 - x) * 180) / Math.PI });
        } })
        .fromTo(boo, { scale: 0, opacity: 0, svgOrigin: `${sand[0] + 60} ${sand[1] - 104}` }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(3)" }, 0.55)
        .to(boo, { opacity: 0, y: -16, duration: 0.5 }, 1.3);
    };

    tl = G.timeline({ onComplete: end });
    const walkFor = Math.max(1.6, dist / 320);
    tl.call(() => { CR.setFace(c, "happy", c.spec.face.beak ? "open" : "grin"); sfx("boing", 1); })
      .to(act, { y: -16, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" })
      .call(() => gait.play())
      .to(el, { x: there.x, y: there.y, duration: walkFor, ease: "sine.inOut" })
      .to(act, { y: -7, duration: 0.15, yoyo: true, repeat: Math.max(3, Math.round(walkFor / 0.15) - 1), ease: "sine.out" }, "<")
      .call(() => { gait.pause(); CR.settle(c); })
      // playing in the sand: little jumps, a twirl, a happy wiggle
      .to(act, { y: -22, duration: 0.2, yoyo: true, repeat: 3, ease: "power2.out" })
      .to(act, { rotation: 360, duration: 0.6, ease: "back.out(1.6)" }, "-=0.2")
      .set(act, { rotation: 0 })
      .to(act, { scaleX: 1.12, scaleY: 0.9, duration: 0.12, yoyo: true, repeat: 3, transformOrigin: "50% 100%" })
      .call(leap)
      .to({}, { duration: 0.6 })
      .call(startle)
      .to(act, { y: -48, scaleY: 1.15, scaleX: 0.9, duration: 0.2, ease: "power2.out" })
      .to(act, { y: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: "bounce.out" });
    runHome(tl, false);
    tl.call(() => { gait.pause(); CR.settle(c); })
      .to(act, { y: -10, duration: 0.1, yoyo: true, repeat: 1 });

    // called home early: it turns round and runs back, frightened or not
    job.hurry = () => {
      if (job.done || job.hurrying) return;
      job.hurrying = true;
      tl.kill();
      G.killTweensOf([el, act]);
      G.set(act, { y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
      job.tl2 = G.timeline({ onComplete: end });
      runHome(job.tl2, true);
    };
    job.finishNow = end;
  }
  // Every time the wait runs out, one of these little scenes plays, never the same one twice in a row.
  // Each one is a job like a move: a move made meanwhile waits for it, and any touch or key wraps it up.
  let lastSkit = -1;
  function wanderOff() {
    idleCall = null;
    const quiet = !over && !busy && !penBusy && !decoDrawing && !motions.length && !outing && selected < 0 && !document.hidden && !$("intro").classList.contains("is-on");
    if (!quiet) { armIdle(); return; }
    const SPECIAL = { bored, ufo, rain, stranger };
    const askedName = !askedDone ? new URLSearchParams(location.search).get("scene") : null;
    if (askedName && SPECIAL[askedName]) { askedDone = true; if (SPECIAL[askedName]()) return; }
    if (!boredDone && stamp() - lastMoveAt > 30000) { boredDone = true; if (bored()) return; }
    if (rareKind && !rareDone && game.played.length >= 2) { rareDone = true; if (SPECIAL[rareKind]()) return; }
    let order = SKITS.map((_, i) => i).filter((i) => i !== lastSkit).sort(() => Math.random() - 0.5);
    // ?scene=crab (beach, crab, frog, nap, rps, wave, snore, sneeze) puts that scene first, to see it
    const asked = lastSkit < 0 ? SKIT_NAMES.indexOf(new URLSearchParams(location.search).get("scene")) : -1;
    if (asked >= 0) order = [asked, ...order.filter((i) => i !== asked)];
    for (const i of order) if (SKITS[i]()) { lastSkit = i; return; }
    armIdle();
  }
  const onBoard = (test) => [...els].filter(([sq, el]) => el.__at === sq && el.isConnected && test(el.__p, sq)).map(([sq, el]) => ({ sq, el }));
  const anyOf = (list) => (list.length ? pick(list) : null);
  // a scene that keeps some creatures busy; they are handed back exactly as they were
  function skit(cast) {
    const job = { done: false, tls: [], temp: [], cast };
    job.promise = new Promise((ok) => { job.resolve = ok; });
    outing = job; motion = job; motions.push(job);
    cast.forEach((el) => { el.__away = true; sleep(el); });
    job.add = (tl) => { job.tls.push(tl); return tl; };
    job.keep = (n) => { job.temp.push(n); return n; };
    const parts = (c) => [c.root, c.head, c.hat, c.prop, c.tail, ...c.legs, ...c.arms, ...c.pupils].filter(Boolean);
    job.end = () => {
      if (job.done) return;
      job.done = true;
      job.tls.forEach((t) => t.kill());
      job.temp.forEach((n) => { G.killTweensOf(n); n.remove(); });
      cast.forEach((el) => {
        el.__away = false;
        if (!el.isConnected) return;
        const c = el.__c;
        G.killTweensOf([el.__act, ...parts(c)]);
        G.set(el.__act, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        // parts turn on their own joints, so they are cleared rather than set back by hand
        parts(c).forEach((p) => G.set(p, { clearProps: "transform" }));
        el.classList.remove("is-startled");
        place(el, el.__at);
        CR.restFace(c);
        if (anim) wake(el);
      });
      if (job.after) job.after();
      if (motions.includes(job)) motions.splice(motions.indexOf(job), 1);
      outing = null;
      job.resolve();
      armIdle();
    };
    // called away early: everyone settles back over a moment, nobody just snaps
    job.hurry = () => {
      if (job.done || job.hurrying) return;
      job.hurrying = true;
      job.tls.forEach((t) => t.kill());
      job.temp.forEach((n) => G.to(n, { opacity: 0, duration: 0.25 }));
      const acts = cast.filter((el) => el.isConnected).map((el) => el.__act);
      G.timeline({ onComplete: job.end }).to(acts.length ? acts : {}, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, duration: 0.3, ease: "power2.out" });
      if (job.onHurry) job.onHurry();
    };
    job.finishNow = job.end;
    return job;
  }
  // something drawn inside a creature, in its own units, so it moves with it
  function inside(c, job, build) {
    const g = svgEl("g", { class: "cx-extra" });
    build(rough.svg(c.svg), g);
    c.root.append(g);
    job.keep(g);
    return g;
  }
  // a speech bubble over the board
  function bubble(text, x, y, job, tilt = 0) {
    const g = svgEl("g", { class: "cx-say" });
    const t = svgEl("text", { x: 0, y: 6, "text-anchor": "middle" });
    t.textContent = text;
    g.append(t);
    fx.append(g);
    const rc = rcFx();
    const back = svgEl("g");
    g.prepend(back);
    const fit = () => {
      let w = 56;
      try { w = Math.max(56, t.getComputedTextLength() + 26); } catch { w = Math.max(56, t.textContent.length * 9 + 26); }
      back.replaceChildren(rc.path(`M ${-w / 2} -16 Q 0 -24 ${w / 2} -16 Q ${w / 2 + 8} 0 ${w / 2} 14 Q 0 20 ${-w / 2} 14 Q ${-w / 2 - 8} 0 ${-w / 2} -16 Z M -6 15 L -2 28 L 6 15`, { stroke: "#2b2f3a", strokeWidth: 1.6, fill: "#fffdf4", fillStyle: "solid", roughness: 1.1, seed: 7 }));
    };
    fit();
    G.set(g, { x, y, rotation: tilt });
    if (job) job.keep(g);
    g.say = (s) => { t.textContent = s; fit(); };
    return g;
  }
  const headOf = (sq) => { const s = spot(sq); return [s.x, s.y - s.w * 1.08, s.w]; };
  // a bubble on the side of the creature that faces the middle of the board, so it covers nobody
  const sayAt = (sq) => { const s = spot(sq), mid = (spot(0x33).y + spot(0x44).y) / 2; return s.y - s.w * 0.5 < mid ? [s.x, s.y + s.w * 0.42] : [s.x, s.y - s.w * 1.08]; };

  /* the beach outing */
  function beach() {
    if (!beachKit) return false;
    const dr = deco.getBoundingClientRect();
    const [bx, by] = beachKit.B(0.3, 34);
    const target = pageToLayer(dr.left + bx, dr.top + by);
    let best = null, bd = Infinity;
    for (const { sq, el } of onBoard((p) => p === 1)) {
      const s = spot(sq), d = Math.hypot(s.x - target[0], s.y - target[1]);
      if (d < bd) { bd = d; best = el; }
    }
    if (!best) return false;
    goToTheBeach(best, target, [bx, by]);
    return true;
  }

  /* a crab scuttles onto the board and pinches a pony's tail; the pony kicks it into orbit */
  function crabPinch() {
    const k = anyOf(onBoard((p) => (p & 7) === 2));
    if (!k) return false;
    const { sq, el } = k, c = el.__c, s = spot(sq);
    const job = skit([el]);
    const dir = (sq & 7) < 4 ? -1 : 1;
    // it comes in over the empty middle of the board, not through the back row
    const midRank = (sq >> 4) >= 4 ? (sq >> 4) - 2 : (sq >> 4) + 2;
    const edge = spot((midRank << 4) | (dir < 0 ? 0 : 7));
    const size = s.w * 0.78;
    const crab = document.createElement("div");
    crab.className = "cx-guest";
    const svg = svgEl("svg", { viewBox: "-40 -40 80 80", width: size, height: size });
    crab.append(svg);
    const rc = rough.svg(svg);
    const legs = svgEl("g"); legs.append(rc.path("M -10 4 l -10 6 M -8 7 l -8 8 M 10 4 l 10 6 M 8 7 l 8 8", { stroke: "#a3322a", strokeWidth: 1.8, roughness: 0.8, seed: 3060 }));
    const cl = svgEl("g"), cr = svgEl("g");
    cl.append(rc.path("M -12 -2 L -20 -12 M -20 -12 q -8 -4 -6 -10 q 6 2 6 10 M -20 -12 q -2 -8 4 -10", { stroke: "#a3322a", strokeWidth: 1.8, fill: "#e8432e", fillStyle: "solid", seed: 3061 }));
    cr.append(rc.path("M 12 -2 L 20 -12 M 20 -12 q 8 -4 6 -10 q -6 2 -6 10 M 20 -12 q 2 -8 -4 -10", { stroke: "#a3322a", strokeWidth: 1.8, fill: "#e8432e", fillStyle: "solid", seed: 3062 }));
    svg.append(legs, cl, cr);
    svg.append(rc.ellipse(0, 2, 28, 18, { stroke: "#a3322a", strokeWidth: 1.8, fill: "#e8432e", fillStyle: "hachure", hachureGap: 2.2, seed: 3063 }));
    svg.append(rc.path("M -5 -6 L -6 -14 M 5 -6 L 6 -14", { stroke: "#a3322a", strokeWidth: 1.4, seed: 3064 }));
    [[-6, 0], [6, 1]].forEach(([x, i]) => { svg.append(rc.circle(x, -15, 6, { stroke: "#1f1a2a", strokeWidth: 1, fill: "#fff", fillStyle: "solid", seed: 3065 + i })); svg.append(rc.circle(x + dir * -1, -15, 2.4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 3067 + i })); });
    const grin = svgEl("g"); grin.append(rc.arc(0, 3, 9, 6, 0.2, Math.PI - 0.2, false, { stroke: "#1f1a2a", strokeWidth: 1.2, seed: 3069 })); svg.append(grin);
    layer.append(crab);
    job.keep(crab);
    const at = (x, y) => ({ x: x - size / 2, y: y - size * 0.62 });
    const start = at(edge.x + dir * s.w * 1.4, edge.y), stop = at(s.x + dir * s.w * 0.4, s.y + s.w * 0.22);
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.set(crab, start)
      .call(() => sfx("step", 1))
      .to(crab, { x: stop.x, y: stop.y, duration: 1.7, ease: "power1.inOut" })
      .to(legs, { y: -2, duration: 0.08, yoyo: true, repeat: 19 }, "<")
      .to(crab, { rotation: dir * 10, duration: 0.15, yoyo: true, repeat: 3, transformOrigin: "50% 100%" })
      // two little practice snaps, then the real one
      .to([cl, cr], { rotation: (i) => (i ? -22 : 22), svgOrigin: "0 -6", duration: 0.1, yoyo: true, repeat: 3 })
      .to({}, { duration: 0.35 })
      .to([cl, cr], { rotation: (i) => (i ? -30 : 30), svgOrigin: "0 -6", duration: 0.06, yoyo: true, repeat: 1 })
      .call(() => {
        word("PINCH!", s.x + dir * s.w * 0.3, s.y - s.w * 0.9, "#c8452e");
        sfx("pinch");
        el.classList.add("is-startled");
        CR.setFace(c, "hurt", "open");
      })
      .to(el.__act, { y: -s.w * 0.9, rotation: -dir * 25, duration: 0.25, ease: "power2.out" })
      .to(c.legs.slice(2), { rotation: dir * 70, svgOrigin: (i, t) => t.dataset.o, duration: 0.15 }, "<0.05")
      .to(el.__act, { y: 0, rotation: 0, duration: 0.45, ease: "bounce.out" })
      .to(c.legs.slice(2), { rotation: 0, svgOrigin: (i, t) => t.dataset.o, duration: 0.3 }, "<")
      // a kick, and the crab goes into orbit
      .to(c.legs.slice(2), { rotation: dir * 85, svgOrigin: (i, t) => t.dataset.o, duration: 0.12, ease: "power3.in" })
      .call(() => { sfx("hit", 2, 0); word("WHEEE!", stop.x + dir * s.w * 1.5, stop.y - s.w * 0.8, "#3c4fb8"); CR.setFace(c, "happy", "grin"); })
      .to(crab, { x: stop.x + dir * s.w * 6, y: stop.y - s.w * 4, rotation: dir * 900, scale: 0.4, duration: 1.2, ease: "power2.out" })
      .to(crab, { opacity: 0, duration: 0.3 }, "-=0.3")
      .to(c.legs.slice(2), { rotation: 0, svgOrigin: (i, t) => t.dataset.o, duration: 0.4 }, "<")
      .call(() => note(pick(["the crab has left the chat", "the pony did not ask for a pedicure", "one crab, sent to the moon"])))
      .to(el.__act, { rotation: dir * 6, duration: 0.2, yoyo: true, repeat: 3 });
    return true;
  }

  /* the frog's tongue shoots all the way up to the string and steals a star */
  function frogStar() {
    if (!frogKit) return false;
    const stars = [...deco.querySelectorAll(".d-bunting .d-star")].filter((s) => s.dataset.at);
    if (!stars.length) return false;
    const star = pick(stars);
    const [sx, sy] = star.dataset.at.split(" ").map(Number);
    const [hx, hy] = star.dataset.hang.split(" ").map(Number);
    const { pad, fx: fx0, fy: fy0 } = frogKit;
    const mx = fx0, my = fy0 - 2;
    const job = skit([]);
    const tongue = job.keep(svgEl("path", { d: `M ${mx} ${my} L ${mx} ${my}`, stroke: "#e2516a", "stroke-width": 4, "stroke-linecap": "round", fill: "none" }));
    deco.append(tongue);
    const reach = { t: 0 }, pull = { t: 0 };
    const lineTo = (x, y) => tongue.setAttribute("d", `M ${mx} ${my} Q ${(mx + x) / 2} ${Math.min(my, y) - 60} ${x} ${y}`);
    job.after = () => { G.killTweensOf(star); G.set(star, { x: 0, y: 0, scale: 1, opacity: 1, svgOrigin: `${hx} ${hy}` }); };
    job.onHurry = () => G.to(star, { x: 0, y: 0, scale: 1, opacity: 1, svgOrigin: `${hx} ${hy}`, duration: 0.25 });
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.to(pad, { scaleY: 0.9, svgOrigin: `${fx0} ${fy0 + 10}`, duration: 0.3, yoyo: true, repeat: 1 })
      .call(() => sfx("boing", 2))
      .to(reach, { t: 1, duration: 0.28, ease: "power3.out", onUpdate: () => lineTo(mx + (sx - mx) * reach.t, my + (sy - my) * reach.t) })
      .call(() => { sfx("pop"); bubbleDeco("!", sx + 14, sy - 18, job); })
      .to(pull, { t: 1, duration: 0.55, ease: "power2.in", onUpdate: () => {
        const x = sx + (mx - sx) * pull.t, y = sy + (my - sy) * pull.t;
        lineTo(x, y);
        G.set(star, { x: x - sx, y: y - sy, scale: 1 - pull.t * 0.7, svgOrigin: `${hx} ${hy}` });
      } })
      .set(star, { opacity: 0 })
      .set(tongue, { opacity: 0 })
      // chewing, then a burp, then the star is put back on its string as if nothing happened
      .to(pad, { scaleX: 1.12, scaleY: 0.92, svgOrigin: `${fx0} ${fy0 + 10}`, duration: 0.14, yoyo: true, repeat: 5 })
      .call(() => { sfx("burp"); bubbleDeco("burp!", fx0 + 30, fy0 - 40, job); note(pick(["the frog ate a star. it tasted of lemons", "the frog says the stars are crunchy", "one star missing. the frog knows nothing"])); })
      .to(pad, { scaleY: 1.15, svgOrigin: `${fx0} ${fy0 + 10}`, duration: 0.12, yoyo: true, repeat: 1 })
      .to({}, { duration: 1.2 })
      .set(star, { x: 0, y: 0, opacity: 1, scale: 0, svgOrigin: `${hx} ${hy}` })
      .to(star, { scale: 1, duration: 0.5, ease: "back.out(3)" });
    return true;
  }
  function bubbleDeco(text, x, y, job) {
    const t = svgEl("text", { x, y, class: "t-pop" });
    t.textContent = text;
    deco.append(t);
    job.keep(t);
    G.timeline().fromTo(t, { scale: 0.2, opacity: 1, svgOrigin: `${x} ${y}` }, { scale: 1.1, duration: 0.3, ease: "back.out(3)" }).to(t, { opacity: 0, y: -14, duration: 0.6 }, "+=0.8");
  }

  /* a pony nods off on its feet, snores, and wakes up insisting it was never asleep */
  function knightNap() {
    const k = anyOf(onBoard((p) => (p & 7) === 2));
    if (!k) return false;
    const { el } = k, c = el.__c;
    const job = skit([el]);
    const head = c.head, o = head ? head.dataset.o : "50 50";
    const zs = inside(c, job, () => {});
    const zed = (i) => {
      const t = svgEl("text", { x: 30, y: 10, class: "cx-zz" });
      t.textContent = i % 2 ? "Z" : "z";
      zs.append(t);
      G.timeline({ onComplete: () => t.remove() }).fromTo(t, { opacity: 0, x: 0, y: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.3 }).to(t, { x: -14 - i * 3, y: -34, rotation: -15, opacity: 0, duration: 1.6, ease: "sine.out" }, 0.1);
    };
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.call(() => CR.setFace(c, "closed", "wavy"))
      .to(head || {}, { rotation: -16, svgOrigin: o, duration: 0.9, ease: "sine.inOut" })
      .to(el.__act, { scaleY: 0.96, transformOrigin: "50% 100%", duration: 0.9, ease: "sine.inOut" }, "<");
    for (let i = 0; i < 6; i++) tl.call(() => zed(i)).to(head || {}, { rotation: i % 2 ? -16 : -22, svgOrigin: o, duration: 0.5, ease: "sine.inOut" });
    tl.to(head || {}, { rotation: -30, svgOrigin: o, duration: 0.25, ease: "power2.in" })
      .call(() => { el.classList.add("is-startled"); CR.setFace(c, "scared", "open"); sfx("pop"); })
      .to(head || {}, { rotation: 6, svgOrigin: o, duration: 0.15, ease: "back.out(3)" })
      .to(el.__act, { y: -26, scaleY: 1, duration: 0.18, ease: "power2.out" }, "<")
      .to(el.__act, { y: 0, duration: 0.35, ease: "bounce.out" })
      .to(c.pupils, { x: -1.8, duration: 0.2 })
      .to(c.pupils, { x: 1.8, duration: 0.3 })
      .to(c.pupils, { x: 0, duration: 0.2 })
      .call(() => { el.classList.remove("is-startled"); CR.setFace(c, "happy", "grin"); const [x, y] = headOf(k.sq); bubble(pick(["I was resting my eyes", "I was NOT asleep", "who said that?"]), x, y - 10, job, -3); })
      .to({}, { duration: 1.8 });
    return true;
  }

  /* two pawns settle something the old way: rock, paper, scissors */
  function rps() {
    const a = onBoard((p) => p === 1), b = onBoard((p) => p === (1 | BLACK));
    if (!a.length || !b.length) return false;
    let pair = null, bd = Infinity;
    a.forEach((x) => b.forEach((y) => { const d = Math.abs((x.sq & 7) - (y.sq & 7)) * 2 + Math.abs((x.sq >> 4) - (y.sq >> 4)); if (d < bd) { bd = d; pair = [x, y]; } }));
    const job = skit(pair.map((x) => x.el));
    const bubbles = pair.map((x, i) => { const [hx, hy] = sayAt(x.sq); return bubble("...", hx, hy, job, i ? 4 : -4); });
    const SIGNS = ["rock!", "paper!", "scissors!"];
    let pa, pb;
    do { pa = Math.floor(R(0, 3)); pb = Math.floor(R(0, 3)); } while (pa === pb && Math.random() < 0.6);
    const tie = pa === pb;
    const tl = job.add(G.timeline({ onComplete: job.end }));
    const bob = () => tl.to(pair.map((x) => x.el.__act), { y: -12, duration: 0.16, yoyo: true, repeat: 1, ease: "power2.out" });
    ["rock...", "paper...", "scissors..."].forEach((w) => { tl.call(() => bubbles.forEach((g) => g.say(w))); bob(); tl.to({}, { duration: 0.12 }); });
    tl.call(() => { bubbles[0].say(SIGNS[pa]); bubbles[1].say(SIGNS[pb]); sfx("pop"); }).to({}, { duration: 0.9 });
    if (tie) {
      tl.call(() => { bubbles.forEach((g) => g.say("...again?!")); pair.forEach((x) => CR.setFace(x.el.__c, "scared", "open")); }).to({}, { duration: 0.9 });
      do { pb = Math.floor(R(0, 3)); } while (pb === pa);
      ["rock...", "paper...", "scissors..."].forEach((w) => { tl.call(() => bubbles.forEach((g) => g.say(w))); bob(); });
      tl.call(() => { bubbles[0].say(SIGNS[pa]); bubbles[1].say(SIGNS[pb]); sfx("pop"); }).to({}, { duration: 0.9 });
    }
    const aWins = (pa + 3 - pb) % 3 === 1;
    const [win, lose] = aWins ? pair : [pair[1], pair[0]];
    tl.call(() => {
      CR.setFace(win.el.__c, "happy", "grin");
      CR.setFace(lose.el.__c, "cry", "frown");
      sfx("emote", 0, colorOf(win.el.__p));
      bubbles[aWins ? 0 : 1].say(pick(["yes!!", "never doubt me", "best of one!"]));
      bubbles[aWins ? 1 : 0].say(pick(["best of three?", "no fair", "...rematch"]));
      note(`${who(win.el.__p)} beat ${who(lose.el.__p)} at rock, paper, scissors`);
    })
      .to(win.el.__act, { y: -22, duration: 0.2, yoyo: true, repeat: 5, ease: "power2.out" })
      .to(lose.el.__act, { scaleY: 0.85, transformOrigin: "50% 100%", duration: 0.4, ease: "bounce.out" }, "<")
      .call(() => sweat(lose.el), null, "<0.3")
      .call(() => sweat(lose.el), null, "<0.5")
      .to({}, { duration: 0.6 });
    return true;
  }

  /* the whole board does the wave, and one creature misses it */
  function wave() {
    const team = (t) => onBoard((p) => colorOf(p) === t).sort((x, y) => (x.sq & 7) - (y.sq & 7) || (x.sq >> 4) - (y.sq >> 4));
    const a = team(0), b = team(1).reverse();
    if (a.length < 4 || b.length < 4) return false;
    const late = pick([...a, ...b]);
    const cast = [...a, ...b];
    const job = skit(cast.map((x) => x.el));
    const tl = job.add(G.timeline({ onComplete: job.end }));
    const up = (list, at) => list.forEach((x, i) => {
      if (x === late) return;
      const c = x.el.__c, arms = c.spec.wings ? [] : c.arms;
      tl.to(x.el.__act, { y: -24, duration: 0.18, yoyo: true, repeat: 1, ease: "power2.out" }, at + i * 0.08);
      if (arms.length) tl.to(arms, { rotation: (j) => (j ? -150 : 150), svgOrigin: (j) => arms[j].dataset.o, duration: 0.18, yoyo: true, repeat: 1 }, at + i * 0.08);
      tl.call(() => CR.setFace(c, "happy", c.spec.face.beak ? "open" : "grin"), null, at + i * 0.08);
    });
    tl.call(() => sfx("emote", 0, 0), null, 0);
    up(a, 0);
    up(b, a.length * 0.08 + 0.2);
    const end = (a.length + b.length) * 0.08 + 0.6;
    // ...and the one who was not paying attention
    tl.call(() => { CR.setFace(late.el.__c, "happy", "grin"); sfx("boing", 1); }, null, end + 0.5)
      .to(late.el.__act, { y: -30, duration: 0.2, yoyo: true, repeat: 1, ease: "power2.out" }, end + 0.5)
      .call(() => { CR.setFace(late.el.__c, "scared", "open"); const [x, y] = headOf(late.sq); bubble("...oh.", x, y, job); }, null, end + 0.95)
      .call(() => note(pick(["the wave went round the board. nearly.", "there is always one", "a lovely wave. well, almost."])), null, end + 1)
      .to(late.el.__act, { scaleY: 0.9, transformOrigin: "50% 100%", duration: 0.3 }, end + 1)
      .to({}, { duration: 1.6 });
    return true;
  }

  /* the king falls asleep standing up and blows a snot bubble until it pops */
  function kingSnore() {
    const k = anyOf(onBoard((p) => (p & 7) === 6));
    if (!k) return false;
    const { el } = k, c = el.__c, f = c.spec.face;
    const job = skit([el]);
    const nx = f.mouth[0] + 3, ny = (f.beakY || f.mouth[1]) - 3;
    let ball;
    const zs = inside(c, job, (rc, g) => {
      ball = svgEl("g");
      ball.append(rc.circle(nx + 4, ny + 2, 7, { stroke: "#6a9ad0", strokeWidth: 1, fill: "rgba(170,210,245,0.75)", fillStyle: "solid", roughness: 0.4, seed: 3100 }));
      ball.append(rc.circle(nx + 2, ny, 2, { stroke: "none", fill: "#ffffff", fillStyle: "solid", seed: 3101 }));
      g.append(ball);
    });
    const zed = (i) => {
      const t = svgEl("text", { x: 70, y: 30, class: "cx-zz" });
      t.textContent = i % 2 ? "Z" : "z";
      zs.append(t);
      G.timeline({ onComplete: () => t.remove() }).fromTo(t, { opacity: 0, x: 0, y: 0 }, { opacity: 1, duration: 0.3 }).to(t, { x: 12 + i * 2, y: -36, rotation: 15, opacity: 0, duration: 1.6, ease: "sine.out" }, 0.1);
    };
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.call(() => { CR.setFace(c, "closed", f.beak ? "none" : "wavy"); sfx("snore"); })
      .set(ball, { scale: 0.3, svgOrigin: `${nx} ${ny}` });
    [1.6, 0.8, 2.2, 1, 3.2].forEach((sc, i) => {
      tl.call(() => zed(i)).to(ball, { scale: sc, svgOrigin: `${nx} ${ny}`, duration: i % 2 ? 0.8 : 1.1, ease: "sine.inOut" })
        .to(el.__act, { scaleY: i % 2 ? 0.98 : 1.03, transformOrigin: "50% 100%", duration: 0.8, ease: "sine.inOut" }, "<");
    });
    tl.to(ball, { scale: 3.6, svgOrigin: `${nx} ${ny}`, duration: 0.25 })
      .call(() => { ball.remove(); sfx("pop"); el.classList.add("is-startled"); CR.setFace(c, "scared", "open"); const s = spot(k.sq); word("POP!", s.x, s.y - s.w * 1.1, "#4a8fe0"); })
      .to(el.__act, { y: -30, scaleY: 1, duration: 0.18, ease: "power2.out" })
      .to(el.__act, { y: 0, duration: 0.35, ease: "bounce.out" })
      .to(c.pupils, { x: -1.8, duration: 0.2 }).to(c.pupils, { x: 1.8, duration: 0.3 }).to(c.pupils, { x: 0, duration: 0.2 })
      .call(() => { el.classList.remove("is-startled"); CR.setFace(c, "happy", f.beak ? "open" : "grin"); note(pick(["the king was only resting his eyes", "nobody saw that. nobody.", "the king is very alert, thank you"])); })
      .to(c.hat || {}, { rotation: 8, svgOrigin: c.hat ? c.hat.dataset.o : "0 0", duration: 0.2, yoyo: true, repeat: 1 })
      .to({}, { duration: 1.2 });
    return true;
  }

  /* a wizard or an acorn sneezes so hard its hat takes off */
  function bishopSneeze() {
    const k = anyOf(onBoard((p) => (p & 7) === 3));
    if (!k) return false;
    const { el, sq } = k, c = el.__c, s = spot(sq);
    const job = skit([el]);
    const [hx, hy] = headOf(sq);
    const say = bubble("ah...", hx, hy, job, -4);
    G.set(say, { opacity: 0 });
    const [ox, oy] = (c.hat ? c.hat.dataset.o : "50 50").split(" ").map(Number);
    // the hat's flight is written out by hand: up, a spin and back down onto the head
    const fly = { y: 0, r: 0 };
    const flyHat = () => { if (c.hat) c.hat.setAttribute("transform", `translate(0 ${fly.y}) rotate(${fly.r} ${ox} ${oy})`); };
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.call(() => CR.setFace(c, "closed", "open")).set(say, { opacity: 1 });
    ["ah...", "ahh...", "AHHH..."].forEach((w, i) => tl.call(() => say.say(w)).to(el.__act, { rotation: -6 - i * 3, scaleY: 1.04 + i * 0.02, transformOrigin: "50% 100%", duration: 0.45, ease: "sine.inOut" }).to({}, { duration: 0.15 }));
    tl.call(() => { say.remove(); word("ACHOO!", s.x, s.y - s.w * 1.0, "#3c4fb8"); sfx("achoo"); CR.setFace(c, "hurt", "open"); })
      .to(el.__act, { rotation: 16, scaleY: 0.92, duration: 0.08, ease: "power4.in" })
      .to(fly, { y: -70, r: 540, duration: 0.6, ease: "power2.out", onUpdate: flyHat }, "<")
      .to(el.__act, { rotation: 0, scaleY: 1, duration: 0.4, ease: "elastic.out(1, 0.4)" })
      .to(fly, { y: 0, r: 720, duration: 0.55, ease: "bounce.out", onUpdate: flyHat })
      .call(() => {
        // the neighbours lean away, a little disgusted
        onBoard((p, q) => q !== sq && Math.max(Math.abs((q & 7) - (sq & 7)), Math.abs((q >> 4) - (sq >> 4))) === 1).forEach(({ el: n, sq: q }) => {
          if (n.__away || motions.some((j) => j !== job)) return;
          G.timeline().to(n.__act, { x: Math.sign((q & 7) - (sq & 7) || 1) * 6, rotation: Math.sign((q & 7) - (sq & 7) || 1) * 8, duration: 0.2 }).to(n.__act, { x: 0, rotation: 0, duration: 0.4, delay: 0.6 });
        });
        note(pick(["bless you!", "gesundheit, wizard", "somebody pass a tissue"]));
      })
      .call(() => CR.setFace(c, "happy", "grin"))
      .to(el.__act, { scaleY: 1.04, duration: 0.12, yoyo: true, repeat: 3, transformOrigin: "50% 100%" })
      .to({}, { duration: 0.8 });
    return true;
  }

  const SKITS = [beach, crabPinch, frogStar, knightNap, rps, wave, kingSnore, bishopSneeze];
  const SKIT_NAMES = ["beach", "crab", "frog", "nap", "rps", "wave", "snore", "sneeze"];

  /* ---------- running jokes during a game ---------- */

  // famous last words, said while falling over
  const LAST_WORDS = ["tell my mum I was brave", "worth it", "not the hat!", "I regret nothing", "ouch, my everything", "I was about to win", "this is fine", "rematch!", "I'll be back (in the tray)", "it was the pony's idea", "I bruise easily", "see you in the box", "avenge me!", "at least I tried"];
  function lastWords(victim, x, y) {
    if (!anim || Math.random() < 0.35) return;
    const g = bubble(pick(LAST_WORDS), x, y, null, R(-5, 5));
    G.timeline({ onComplete: () => g.remove() }).fromTo(g, { scale: 0, svgOrigin: "0 20" }, { scale: 1, duration: 0.25, ease: "back.out(3)" }).to(g, { opacity: 0, y: y - 16, duration: 0.4 }, "+=1.3");
  }
  // two captures in a row by the same team: they celebrate, the others weep
  const streak = [0, 0];
  function captureStreak(m, us) {
    if (!m.captured) { streak[us] = 0; return false; }
    streak[us] += 1;
    streak[us ^ 1] = 0;
    if (streak[us] < 2 || !anim) return false;
    const n = streak[us];
    const winners = onBoard((p) => colorOf(p) === us), losers = onBoard((p) => colorOf(p) !== us);
    const free = (x) => !x.el.__away && !motions.some((j) => j.cast && j.cast.includes(x.el));
    const t = spot(m.to);
    word(n === 2 ? "COMBO!" : `COMBO x${n}!`, t.x, t.y - t.w * 1.6, us ? "#3c4fb8" : "#e8432e");
    winners.filter(free).forEach((x, i) => {
      const c = x.el.__c;
      CR.setFace(c, "happy", c.spec.face.beak ? "open" : "grin");
      G.timeline({ delay: i * 0.05 }).to(x.el.__act, { y: -16, duration: 0.15, yoyo: true, repeat: 3, ease: "power2.out" }).call(() => CR.restFace(c));
    });
    losers.filter(free).forEach((x, i) => {
      const c = x.el.__c;
      CR.setFace(c, "cry", c.spec.face.beak ? "none" : "frown");
      G.delayedCall(0.2 + i * 0.05, () => sweat(x.el));
      G.delayedCall(1.6, () => { if (c.state === "cry") CR.restFace(c); });
    });
    note(n >= 3 ? `the ${TEAM[us]} team cannot be stopped` : pick([`the ${TEAM[us]} team is on a roll`, `the ${TEAM[us ^ 1]} team needs a hug`]));
    return true;
  }
  // a king that keeps being checked starts to sweat, and gets out a hanky
  const checks = [0, 0];
  function nervousKing(side) {
    checks[side] += 1;
    if (checks[side] < 3 || !anim) return false;
    const k = onBoard((p) => (p & 7) === 6 && colorOf(p) === side)[0];
    if (!k || k.el.__away) return false;
    const c = k.el.__c, f = c.spec.face;
    for (let i = 0; i < 6; i++) G.delayedCall(i * 0.22, () => sweat(k.el));
    const g = svgEl("g", { class: "cx-extra" });
    const rc = rough.svg(c.svg);
    const fy = f.eyes[0][1] - f.r * 2.4;
    g.append(rc.path(`M 44 ${fy - 4} L 60 ${fy - 6} L 62 ${fy + 4} L 46 ${fy + 6} Z`, { stroke: "#8a8f9a", strokeWidth: 1, fill: "#ffffff", fillStyle: "solid", roughness: 1.2, seed: 3200 }));
    g.append(rc.path(`M 46 ${fy - 2} L 58 ${fy - 3}`, { stroke: "#4a8fe0", strokeWidth: 1, seed: 3201 }));
    c.root.append(g);
    G.timeline({ onComplete: () => g.remove() })
      .fromTo(g, { x: -14, opacity: 0 }, { opacity: 1, duration: 0.2 })
      .to(g, { x: 10, duration: 0.22, yoyo: true, repeat: 5, ease: "sine.inOut" })
      .to(g, { opacity: 0, y: 14, duration: 0.3 });
    note(checks[side] >= 5 ? `${who(6 | (side ? BLACK : 0))} would like to speak to a manager` : pick([`${who(6 | (side ? BLACK : 0))} is having a terrible day`, `${who(6 | (side ? BLACK : 0))} needs a holiday`, "check AGAIN?"]));
    return true;
  }
  // giving up: the king waves a little white flag
  function whiteFlag(side) {
    if (!anim) return;
    const k = onBoard((p) => (p & 7) === 6 && colorOf(p) === side)[0];
    if (!k) return;
    const c = k.el.__c;
    const g = svgEl("g", { class: "cx-extra cx-flag" });
    const rc = rough.svg(c.svg);
    g.append(rc.line(76, 92, 84, 18, { stroke: "#7a4a1c", strokeWidth: 2.4, seed: 3300 }));
    const cloth = svgEl("g");
    cloth.append(rc.path("M 84 20 Q 96 16 108 22 Q 102 30 108 40 Q 96 34 83 38 Z", { stroke: "#8a8f9a", strokeWidth: 1.2, fill: "#ffffff", fillStyle: "solid", seed: 3301 }));
    g.append(cloth);
    c.root.append(g);
    G.fromTo(g, { rotation: 20, svgOrigin: "76 92", opacity: 0 }, { rotation: 0, opacity: 1, duration: 0.5, ease: "back.out(2)" });
    G.to(g, { rotation: -10, svgOrigin: "76 92", duration: 0.45, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.5 });
    G.to(cloth, { skewY: 8, svgOrigin: "84 28", duration: 0.25, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }

  // touching the page or pressing a key calls a wandering mushroom home and starts the wait again
  ["pointerdown", "keydown"].forEach((t) => document.addEventListener(t, () => { if (outing) outing.hurry(); armIdle(); }, { capture: true, passive: true }));


  /* ---------- the creatures' own little ways ---------- */

  const stamp = () => Date.now();
  let lastMoveAt = stamp(), boredDone = false, rareKind = null, rareDone = false, askedDone = false;
  let mercy = false, mercyUsed = false, bearded = false, paceQuietUntil = 0;
  const picks = { sq: -1, n: 0 };
  const paceLog = [], undoLog = [];
  const pokes = new WeakMap();
  // a short remark in a bubble that goes away by itself
  function quip(sq, text, hold = 1.4) {
    if (!anim) return;
    const [x, y] = sayAt(sq);
    const g = bubble(text, x, y, null, R(-4, 4));
    G.timeline({ onComplete: () => g.remove() }).fromTo(g, { scale: 0, svgOrigin: "0 20" }, { scale: 1, duration: 0.25, ease: "back.out(3)" }).to(g, { opacity: 0, duration: 0.35 }, `+=${hold}`);
  }
  const beak = (c) => c.spec.face.beak;

  // a new game: the counts start again, and maybe something rare will happen in this one
  function freshGame(ready) {
    lastMoveAt = stamp(); boredDone = false; rareDone = false; bearded = false; mercyUsed = false;
    picks.sq = -1; picks.n = 0; undoLog.length = 0;
    rareKind = Math.random() < 0.15 ? pick(["ufo", "rain", "stranger"]) : null;
    mercy = mode === "cpu" && Number(store.get("chess-cpu-losses") || 0) >= 2;
    if (anim) G.delayedCall(ready + 1.6, grudge);
  }
  // every move: the clock of boredom starts again, grudges and veterans are noted
  function moveMade(m) {
    lastMoveAt = stamp(); boredDone = false;
    picks.sq = -1; picks.n = 0;
    if (m.captured) store.set("chess-grudge", JSON.stringify({ hunter: m.promo || m.piece, victim: m.captured }));
    stickersForMove(m);
    if (m.promo) { const k = `chess-veterans-${colorOf(m.piece)}`; store.set(k, String(Math.min(8, Number(store.get(k) || 0) + 1))); }
  }
  // once a move has played out: the team's tune, and beards in a very long game
  function moveShown(us) {
    let a = 0, b = 0;
    for (const sq of all()) { const p = game.get(sq); if (p && (p & 7) !== 6) { if (colorOf(p) === us) a += VALUE[p & 7]; else b += VALUE[p & 7]; } }
    sfx("tune", us, a - b >= 200 ? 1 : b - a >= 200 ? -1 : 0);
    if (game.played.length >= 120 && !bearded) { bearded = true; growBeards(); }
  }

  /* 1. a creature whose friend was taken last game has not forgotten */
  function grudge() {
    let g = null;
    try { g = JSON.parse(store.get("chess-grudge") || "null"); } catch { g = null; }
    store.set("chess-grudge", "");
    if (!g || outing || motions.length || over || penBusy) return;
    const avenger = anyOf(onBoard((p) => p === g.victim)) || anyOf(onBoard((p) => colorOf(p) === colorOf(g.victim) && (p & 7) === 1));
    const hunter = anyOf(onBoard((p) => p === g.hunter));
    if (!avenger || !hunter) return;
    const job = skit([avenger.el]);
    const a = spot(avenger.sq), h = spot(hunter.sq), dir = Math.sign(h.x - a.x) || 1;
    const c = avenger.el.__c;
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.call(() => CR.setFace(c, "closed", beak(c) ? "none" : "frown"))
      .to(avenger.el.__act, { x: dir * 6, rotation: dir * 7, duration: 0.5, ease: "sine.inOut" })
      .call(() => CR.setFace(c, "open", beak(c) ? "none" : "frown"))
      .to(c.pupils, { x: dir * 2, y: h.y < a.y ? -1 : 1, duration: 0.3 })
      .call(() => {
        const [x, y] = sayAt(avenger.sq);
        bubble(pick(["I remember you.", "you know what you did", "we meet again..."]), x, y, job);
        note(`${who(avenger.el.__p)} remembers what ${who(hunter.el.__p)} did last game`);
      })
      .to(avenger.el.__act, { y: -6, duration: 0.15, yoyo: true, repeat: 3 })
      .to({}, { duration: 1.8 });
  }

  /* 2. pawns that once reached the far side wear a little crown */
  function veteranCrown(el, sq) {
    if ((el.__p & 7) !== 1 || !TH.veteran) return;
    const v = Number(store.get(`chess-veterans-${colorOf(el.__p)}`) || 0);
    if ((sq & 7) < v) TH.veteran(el.__c);
  }

  /* 3. the queen sweeps by and everyone gets out of her way */
  function divaClear(m) {
    if (!anim) return;
    const df = Math.sign((m.to & 7) - (m.from & 7)), dr = Math.sign((m.to >> 4) - (m.from >> 4));
    const path = [];
    for (let s = m.from, i = 0; s !== m.to && i < 8; i++) { s += dr * 16 + df; path.push(s); }
    const midF = ((m.from & 7) + (m.to & 7)) / 2, midR = ((m.from >> 4) + (m.to >> 4)) / 2;
    onBoard((p, q) => q !== m.from && !path.includes(q) && path.some((x) => Math.max(Math.abs((x & 7) - (q & 7)), Math.abs((x >> 4) - (q >> 4))) === 1)).forEach(({ el, sq }, i) => {
      if (el.__away) return;
      const s0 = spot(sq), away = Math.sign((sq & 7) - midF || (sq >> 4) - midR) || 1;
      G.timeline({ delay: i * 0.04 }).to(el.__act, { x: away * s0.w * 0.14, rotation: away * 10, scaleY: 0.94, transformOrigin: "50% 100%", duration: 0.2 }).to(el.__act, { x: 0, rotation: 0, scaleY: 1, duration: 0.4, delay: 0.9 });
    });
  }
  function divaWave(el, sq) {
    if (!anim) return;
    const c = el.__c;
    CR.setFace(c, "happy", beak(c) ? "open" : "grin");
    if (c.spec.wings) G.to(c.arms, { scaleY: 0.3, svgOrigin: (i, t) => t.dataset.o, duration: 0.06, yoyo: true, repeat: 9 });
    else { const arm = c.arms[c.arms.length - 1]; if (arm) G.timeline().to(arm, { rotation: -140, svgOrigin: arm.dataset.o, duration: 0.2 }).to(arm, { rotation: -110, svgOrigin: arm.dataset.o, duration: 0.15, yoyo: true, repeat: 3 }).to(arm, { rotation: 0, svgOrigin: arm.dataset.o, duration: 0.3 }); }
    G.delayedCall(1.2, () => { if (c.state === "happy") CR.restFace(c); });
    if (Math.random() < 0.5) quip(sq, pick(["thank you, darlings", "no autographs today", "make way!", "I know, I know"]));
  }

  /* 4. a pony picked up and put down again asks the obvious question */
  function neigh(sq) {
    const p = game.get(sq);
    if (!p || (p & 7) !== 2 || Math.random() < 0.45) return;
    sfx("neigh");
    quip(sq, pick(["neigh?", "neigh...?", "oh. ok then."]), 1);
  }

  /* 5. thinking for half a minute: everyone sits down, yawns, and someone brings a picnic */
  function bored() {
    const cast = onBoard(() => true);
    if (cast.length < 6) return false;
    const middle = [0x33, 0x34, 0x43, 0x44, 0x23, 0x24, 0x53, 0x54, 0x32, 0x35, 0x42, 0x45].find((q) => !game.get(q) && !game.get(q + 1) && (q & 7) < 7);
    const job = skit(cast.map((x) => x.el));
    const tl = job.add(G.timeline({ onComplete: job.end }));
    // everyone sits
    cast.forEach(({ el }, i) => tl.to(el.__act, { scaleY: 0.86, y: 3, transformOrigin: "50% 100%", duration: 0.35, ease: "power2.out" }, i * 0.02));
    if (middle !== undefined) {
      const a = spot(middle), b = spot(middle + 1);
      const rc = rcFx(), w = a.w;
      const mat = job.keep(svgEl("g", { class: "cx-picnic" }));
      const x0 = a.x - w * 0.45, y0 = a.y - w * 0.55, ww = b.x - a.x + w * 0.9, hh = w * 0.5;
      mat.append(rc.rectangle(x0, y0, ww, hh, { stroke: "#a3322a", strokeWidth: 1.6, fill: "#fffaf0", fillStyle: "solid", seed: 3500 }));
      for (let i = 1; i < 6; i++) mat.append(rc.line(x0 + (ww * i) / 6, y0, x0 + (ww * i) / 6, y0 + hh, { stroke: "#e8432e", strokeWidth: 3, roughness: 0.8, seed: 3501 + i }));
      for (let i = 1; i < 3; i++) mat.append(rc.line(x0, y0 + (hh * i) / 3, x0 + ww, y0 + (hh * i) / 3, { stroke: "#e8432e", strokeWidth: 3, roughness: 0.8, seed: 3510 + i }));
      mat.append(rc.rectangle(x0 + ww * 0.62, y0 - w * 0.3, w * 0.42, w * 0.32, { stroke: "#7a4a1c", strokeWidth: 1.4, fill: "#c8a050", fillStyle: "hachure", hachureGap: 2.4, seed: 3520 }));
      mat.append(rc.path(`M ${x0 + ww * 0.62} ${y0 - w * 0.3} Q ${x0 + ww * 0.62 + w * 0.21} ${y0 - w * 0.62} ${x0 + ww * 0.62 + w * 0.42} ${y0 - w * 0.3}`, { stroke: "#7a4a1c", strokeWidth: 2, seed: 3521 }));
      mat.append(rc.path(`M ${x0 + ww * 0.2} ${y0 + hh * 0.3} l ${w * 0.3} 0 l ${-w * 0.15} ${w * 0.18} Z`, { stroke: "#9a5a26", strokeWidth: 1.2, fill: "#f6d290", fillStyle: "solid", seed: 3522 }));
      fx.prepend(mat);
      tl.fromTo(mat, { opacity: 0, scale: 0.6, svgOrigin: `${a.x} ${a.y - w * 0.3}` }, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 0.4);
    }
    // a few yawns, one after another
    const yawners = [...cast].sort(() => Math.random() - 0.5).slice(0, 4);
    yawners.forEach(({ el, sq }, i) => {
      const c = el.__c;
      tl.call(() => { CR.setFace(c, "closed", beak(c) ? "open" : "open"); sfx("yawn"); if (i === 0) { const [x, y] = sayAt(sq); bubble("yaaaawn", x, y, job); } }, null, 1 + i * 0.9)
        .to(el.__act, { scaleY: 0.95, rotation: R(-6, 6), duration: 0.4, yoyo: true, repeat: 1 }, 1 + i * 0.9)
        .call(() => CR.setFace(c, "closed", beak(c) ? "none" : "wavy"), null, 1.6 + i * 0.9);
    });
    // and two of them start a game of cards
    const players = cast.filter((x) => (x.el.__p & 7) === 1).slice(0, 2);
    if (players.length === 2) {
      tl.call(() => { const [x, y] = sayAt(players[0].sq); bubble("got any sevens?", x, y, job, -3); }, null, 2.2)
        .call(() => { const [x, y] = sayAt(players[1].sq); bubble("go fish.", x, y, job, 3); }, null, 3.2);
    }
    tl.call(() => note(pick(["take your time. we brought snacks.", "the creatures have started a picnic", "wake us up when it's your move"])), null, 1.2)
      .to({}, { duration: 2.6 }, 4.4);
    return true;
  }

  /* 6. lots of quick moves: the creatures are out of breath */
  function pace() {
    const t = stamp();
    paceLog.push(t);
    while (paceLog.length && t - paceLog[0] > 9000) paceLog.shift();
    if (paceLog.length < 4 || t < paceQuietUntil || !anim) return;
    paceQuietUntil = t + 30000;
    G.delayedCall(2.6, () => {
      onBoard(() => true).sort(() => Math.random() - 0.5).slice(0, 5).forEach(({ el, sq }, i) => {
        if (el.__away) return;
        G.delayedCall(i * 0.2, () => {
          sweat(el); G.delayedCall(0.25, () => sweat(el));
          G.to(el.__act, { scaleY: 0.92, duration: 0.15, yoyo: true, repeat: 5, transformOrigin: "50% 100%" });
          if (i === 0) quip(sq, "huff... huff...", 1.6);
        });
      });
      note(pick(["slow down, we have little legs", "the creatures need a breather", "speed chess? nobody told us"]));
    });
  }

  /* 7. picked up three times and put back: it crosses its arms */
  function fidget(sq) {
    if (picks.sq === sq) picks.n++; else { picks.sq = sq; picks.n = 1; }
    if (picks.n !== 3 || !anim) return;
    const el = els.get(sq);
    if (!el) return;
    const c = el.__c;
    if (!c.spec.wings && c.arms.length === 2) G.timeline({ delay: 0.6 }).to(c.arms, { rotation: (i) => (i ? -70 : 70), svgOrigin: (i, t) => t.dataset.o, duration: 0.25 }).to(c.arms, { rotation: 0, svgOrigin: (i, t) => t.dataset.o, duration: 0.3, delay: 1.6 });
    G.delayedCall(0.6, () => quip(sq, pick(["so are we going or not?", "make up your mind!", "I'm not a yo-yo"]), 1.8));
  }

  /* 8. undo: the board winds back like a tape */
  function rewind() {
    const t = stamp();
    undoLog.push(t);
    while (undoLog.length && t - undoLog[0] > 20000) undoLog.shift();
    const n = undoLog.length;
    sfx("rewind");
    if (anim) {
      const s = spot(0x34);
      if (n >= 2) word(n >= 3 ? "REWIND x" + n : "REWIND!", s.x, s.y - s.w, "#3c4fb8");
      for (const [, el] of els) G.from(el.__act, { rotation: -360, y: -14, duration: 0.6, ease: "power2.out" });
    }
    note(n >= 4 ? "time travel is not free, you know" : n === 3 ? "rewinding... rewinding... rewinding..." : n === 2 ? "again? the creatures are getting dizzy" : "let's pretend that never happened");
  }

  /* 9. losing to the computer again and again: it goes a little easy, once */
  function mercyMove(best) {
    if (!mercy || mercyUsed || game.played.length < 8 || Math.random() > 0.25) return best;
    const soft = game.moves().filter((x) => !x.captured && !x.promo);
    if (!soft.length) return best;
    mercyUsed = true;
    G.delayedCall(3, () => note("the computer feels a bit bad and goes easy on you"));
    return pick(soft);
  }
  function countCpuResult(winner) {
    if (mode !== "cpu") return;
    store.set("chess-cpu-losses", winner === human ? "0" : String(Number(store.get("chess-cpu-losses") || 0) + 1));
  }

  /* 10. a flying saucer beams a creature up, puts it down in the wrong place, and fixes it */
  function guestSvg(view, size, draw) {
    const d = document.createElement("div");
    d.className = "cx-guest";
    const svg = svgEl("svg", { viewBox: view, width: size, height: size });
    d.append(svg);
    draw(rough.svg(svg), svg);
    layer.append(d);
    return d;
  }
  function ufo() {
    const victim = anyOf(onBoard((p) => (p & 7) !== 6));
    if (!victim) return false;
    const { el, sq } = victim, s = spot(sq);
    const wrong = anyOf(all().filter((q) => !game.get(q) && Math.abs((q >> 4) - (sq >> 4)) <= 3 && Math.abs((q & 7) - (sq & 7)) <= 3));
    if (wrong === undefined || wrong === null) return false;
    const w2 = spot(wrong);
    const job = skit([el]);
    const size = s.w * 1.7, u = size / 120;
    let beam, lights;
    const saucer = job.keep(guestSvg("-60 -40 120 190", size, (rc, svg) => {
      beam = svgEl("g", { opacity: 0 });
      beam.append(rc.polygon([[-16, 10], [16, 10], [42, 150], [-42, 150]], { stroke: "none", fill: "rgba(255,236,120,0.45)", fillStyle: "solid", roughness: 0.6, seed: 3600 }));
      svg.append(beam);
      svg.append(rc.ellipse(0, -8, 48, 40, { stroke: "#3a6aa0", strokeWidth: 1.4, fill: "rgba(170,215,250,0.85)", fillStyle: "solid", seed: 3601 }));
      svg.append(rc.circle(0, -10, 18, { stroke: "#2a6a2a", strokeWidth: 1.2, fill: "#8fd08a", fillStyle: "solid", seed: 3602 }));
      svg.append(rc.circle(-3, -12, 4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 3603 }));
      svg.append(rc.circle(4, -12, 4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 3604 }));
      svg.append(rc.path("M 0 -18 L -4 -30 M 0 -18 L 5 -29", { stroke: "#2a6a2a", strokeWidth: 1.2, seed: 3605 }));
      svg.append(rc.ellipse(0, 6, 112, 26, { stroke: "#4a4d57", strokeWidth: 1.6, fill: "#a8aab4", fillStyle: "hachure", hachureGap: 2.6, seed: 3606 }));
      lights = svgEl("g");
      [-40, -20, 0, 20, 40].forEach((x, i) => lights.append(rc.circle(x, 9, 6, { stroke: "none", fill: ["#e8432e", "#f6c945", "#3fb39a", "#4a8fe0", "#ef5a7a"][i], fillStyle: "solid", seed: 3607 + i })));
      svg.append(lights);
    }));
    // the saucer hangs so that the bottom of its beam reaches the creature's feet
    const over = (p) => ({ x: p.x - size / 2, y: p.y - 140 * u - 40 * u });
    const home = { x: s.x - s.w / 2, y: s.y - s.w }, there = { x: w2.x - w2.w / 2, y: w2.y - w2.w };
    const tl = job.add(G.timeline({ onComplete: job.end }));
    job.add(G.to(lights.children, { opacity: 0.3, duration: 0.2, yoyo: true, repeat: -1, stagger: 0.08 }));
    tl.set(saucer, { x: -size * 1.5, y: -size * 2 })
      .call(() => sfx("ufo"))
      .to(saucer, { ...over(s), duration: 1.6, ease: "power2.out" })
      .to(saucer, { rotation: 6, duration: 0.25, yoyo: true, repeat: 3 })
      .to(beam, { opacity: 1, duration: 0.3 })
      .call(() => { CR.setFace(el.__c, "scared", "open"); el.classList.add("is-startled"); })
      .to(el.__act, { y: -s.w * 0.7, scale: 0.8, duration: 1, ease: "sine.inOut" })
      .call(() => { const [x, y] = sayAt(sq); bubble(pick(["take me to your leader!", "put me down!", "is this a promotion?"]), x, y, job); })
      // off it goes, the creature dangling in the beam
      .to(saucer, { ...over(w2), duration: 1.2, ease: "sine.inOut" })
      .to(el, { x: there.x, y: there.y, duration: 1.2, ease: "sine.inOut" }, "<")
      .to(el.__act, { y: 0, scale: 1, duration: 0.6, ease: "bounce.out" })
      .call(() => { const [x, y] = [w2.x, w2.y - w2.w * 1.9]; bubble(pick(["oops. wrong square.", "wait, that's not legal", "sorry, new pilot"]), x, y, job); })
      .to({}, { duration: 1 })
      .to(el.__act, { y: -s.w * 0.7, scale: 0.8, duration: 0.6, ease: "sine.inOut" })
      .to(saucer, { ...over(s), duration: 1, ease: "sine.inOut" })
      .to(el, { x: home.x, y: home.y, duration: 1, ease: "sine.inOut" }, "<")
      .to(el.__act, { y: 0, scale: 1, duration: 0.5, ease: "bounce.out" })
      .to(beam, { opacity: 0, duration: 0.3 })
      .call(() => { el.classList.remove("is-startled"); CR.setFace(el.__c, "dizzy", "wavy"); note(pick(["aliens came. they put everything back. mostly.", "the creatures were briefly abducted", "UFO sighted over the board"])); })
      .to(saucer, { x: decoDrawnAt[0] + size, y: -size * 2, rotation: -12, duration: 0.9, ease: "power3.in" })
      .to({}, { duration: 0.6 });
    return true;
  }

  /* 11 & 13. a sudden shower: leaves for umbrellas, a happy frog, and a double rainbow after */
  function rain() {
    const cast = onBoard(() => true);
    if (!cast.length) return false;
    const job = skit(cast.map((x) => x.el));
    const [W, H] = decoDrawnAt;
    const rc = rough.svg(deco);
    const sheet = job.keep(svgEl("g", { class: "t-rain" }));
    deco.append(sheet);
    for (let i = 0; i < 70; i++) {
      const d = svgEl("g");
      d.append(rc.line(0, 0, -5, 16, { stroke: "#5a8ad0", strokeWidth: 1.4, roughness: 0.4, seed: 3700 + (i % 9) }));
      sheet.append(d);
      const x0 = R(0, W + 100);
      job.add(G.fromTo(d, { x: x0, y: R(-H, 0) }, { x: x0 - 60, y: H + 20, duration: R(0.7, 1.1), ease: "none", repeat: -1 }));
    }
    G.set(sheet, { opacity: 0 });
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.to(sheet, { opacity: 1, duration: 0.8 })
      .call(() => { sfx("rain", 5); note(pick(["a sudden shower!", "rain! nobody brought an umbrella", "it's raining on the board"])); });
    // everyone holds a leaf over their head
    cast.forEach(({ el }, i) => {
      const c = el.__c;
      let top = 30;
      try { top = c.root.getBBox().y; } catch { /* not drawn yet */ }
      tl.call(() => {
        const leaf = inside(c, job, (r, g) => {
          g.append(r.path(`M 22 ${top + 2} Q 50 ${top - 22} 78 ${top + 2} Q 50 ${top - 6} 22 ${top + 2} Z`, { stroke: "#2f6a2a", strokeWidth: 1.4, fill: "#6fbf5a", fillStyle: "hachure", hachureGap: 2.2, seed: 3720 }));
          g.append(r.path(`M 50 ${top - 8} L 52 ${top + 14}`, { stroke: "#2f6a2a", strokeWidth: 1.6, seed: 3721 }));
        });
        G.fromTo(leaf, { scale: 0, svgOrigin: `50 ${top + 10}` }, { scale: 1, duration: 0.35, ease: "back.out(2)" });
        CR.setFace(c, i % 3 ? "open" : "scared", beak(c) ? "none" : "frown");
      }, null, 0.6 + i * 0.03);
    });
    // the frog loves it
    if (frogKit) tl.to(frogKit.pad, { y: -22, duration: 0.25, yoyo: true, repeat: 7, ease: "power2.out" }, 1.4).call(() => bubbleDeco("ribbit!", frogKit.fx + 30, frogKit.fy - 50, job), null, 1.6);
    tl.to(sheet, { opacity: 0, duration: 1 }, 6)
      .call(() => job.temp.filter((n) => n.classList && n.classList.contains("cx-extra")).forEach((n) => G.to(n, { scale: 0, svgOrigin: "50 30", duration: 0.3 })), null, 6.4);
    // and then a double rainbow
    tl.call(() => {
      const cx = W * 0.5, cy = Math.min(H * 0.62, 620), r1 = Math.min(W * 0.42, 620);
      const bow = job.keep(svgEl("g", { class: "t-rainbow" }));
      ["#e8432e", "#f08a24", "#f6c945", "#3fb39a", "#4a8fe0", "#7a5ad0"].forEach((col, i) => {
        bow.append(rc.arc(cx, cy, (r1 - i * 9) * 2, (r1 - i * 9) * 2, Math.PI, Math.PI * 2, false, { stroke: col, strokeWidth: 8, roughness: 0.9, seed: 3730 + i }));
        const ghost = rc.arc(cx, cy, (r1 + 70 + i * 7) * 2, (r1 + 70 + i * 7) * 2, Math.PI, Math.PI * 2, false, { stroke: ["#7a5ad0", "#4a8fe0", "#3fb39a", "#f6c945", "#f08a24", "#e8432e"][i], strokeWidth: 5, roughness: 0.9, seed: 3740 + i });
        ghost.setAttribute("opacity", "0.5");
        bow.append(ghost);
      });
      deco.prepend(bow);
      G.fromTo(bow, { opacity: 0 }, { opacity: 0.85, duration: 1.2 });
      const check = game.status().check;
      note(check ? "a double rainbow during check! a good omen for the king" : pick(["a double rainbow! what does it mean?!", "double rainbow all the way across the page"]));
    }, null, 6.8)
      .to({}, { duration: 4.5 }, 7)
      .call(() => job.temp.filter((n) => n.classList && n.classList.contains("t-rainbow")).forEach((n) => G.to(n, { opacity: 0, duration: 1 })), null, 11);
    tl.to({}, { duration: 1.1 }, 11);
    return true;
  }

  /* 12. an ordinary chess piece wanders onto the board; nobody knows what to make of it */
  function stranger() {
    const cast = onBoard(() => true);
    const spotSq = [0x34, 0x33, 0x44, 0x43, 0x24, 0x54].find((q) => !game.get(q));
    if (spotSq === undefined || !cast.length) return false;
    const job = skit(cast.map((x) => x.el));
    const s = spot(spotSq), size = s.w * 0.9;
    const plain = job.keep(guestSvg("-30 -66 60 72", size, (rc, svg) => {
      svg.append(rc.ellipse(0, 0, 50, 12, { stroke: "#2b2f3a", strokeWidth: 1.4, fill: "#d8d4c8", fillStyle: "hachure", hachureGap: 2.4, seed: 3800 }));
      svg.append(rc.path("M -18 -2 Q -10 -10 -9 -24 L 9 -24 Q 10 -10 18 -2 Z", { stroke: "#2b2f3a", strokeWidth: 1.4, fill: "#d8d4c8", fillStyle: "hachure", hachureGap: 2.4, seed: 3801 }));
      svg.append(rc.ellipse(0, -26, 28, 7, { stroke: "#2b2f3a", strokeWidth: 1.4, fill: "#d8d4c8", fillStyle: "solid", seed: 3802 }));
      svg.append(rc.circle(0, -42, 26, { stroke: "#2b2f3a", strokeWidth: 1.4, fill: "#d8d4c8", fillStyle: "hachure", hachureGap: 2.4, seed: 3803 }));
    }));
    const at = (x, y) => ({ x: x - size / 2, y: y - size * 0.92 });
    const edge = spot((spotSq & 0x70) | 7);
    const tl = job.add(G.timeline({ onComplete: job.end }));
    tl.set(plain, at(edge.x + s.w * 2, edge.y));
    // it moves the way a plain piece moves: a small, stiff slide, square by square
    const steps = 7 - (spotSq & 7) + 2;
    for (let i = 1; i <= steps; i++) {
      const x = edge.x + s.w * 2 + ((s.x - edge.x - s.w * 2) * i) / steps, y = edge.y + ((s.y - edge.y) * i) / steps;
      tl.to(plain, { ...at(x, y), duration: 0.32, ease: "power1.inOut" }).to({}, { duration: 0.12 });
    }
    tl.call(() => {
      cast.forEach(({ el, sq }) => { const d = Math.sign(s.x - spot(sq).x); G.to(el.__c.pupils, { x: d * 1.8, y: Math.sign(s.y - spot(sq).y) * 0.8, duration: 0.3 }); });
      const talkers = [...cast].sort((a, b) => Math.hypot(spot(a.sq).x - s.x, spot(a.sq).y - s.y) - Math.hypot(spot(b.sq).x - s.x, spot(b.sq).y - s.y)).slice(0, 2);
      talkers.forEach(({ sq }, i) => G.delayedCall(i * 1.1, () => { const [x, y] = sayAt(sq); bubble(i ? "it has no face!" : "...who's that?", x, y, job, i ? 3 : -3); }));
      cast.forEach(({ el }) => CR.setFace(el.__c, "scared", beak(el.__c) ? "open" : "open"));
    })
      .to({}, { duration: 2.4 })
      .to(plain, { rotation: 8, duration: 0.3, yoyo: true, repeat: 3, transformOrigin: "50% 100%" })
      .call(() => note(pick(["a normal chess piece wandered in. how boring.", "an ordinary piece was here. it said nothing. at all.", "a visitor from a serious chess set"])))
      .to(plain, { ...at(edge.x + s.w * 3, edge.y), duration: 1.4, ease: "power1.in" })
      .to(plain, { opacity: 0, duration: 0.3 }, "-=0.3")
      .to({}, { duration: 0.6 });
    return true;
  }

  /* 14. checkmate in a few moves: a slow-motion replay with a parrot on commentary */
  function replay(m, plies) {
    const el = els.get(m.to);
    if (!el || !anim) return;
    const job = skit([el]);
    const bars = job.keep(document.createElement("div"));
    bars.className = "cx-replay";
    bars.innerHTML = "<span>REPLAY</span>";
    document.body.append(bars);
    const a = spot(m.from), b = spot(m.to);
    const corner = spot(flipped ? 0x70 : 0x07), size = corner.w * 1.3;
    const parrot = job.keep(guestSvg("-40 -50 80 90", size, (rc, svg) => {
      svg.append(rc.line(-30, 30, 34, 30, { stroke: "#7a4a1c", strokeWidth: 3, seed: 3900 }));
      svg.append(rc.path("M -6 26 Q -22 0 -8 -26 Q 10 -40 20 -20 Q 26 2 10 28 Z", { stroke: "#2a6a2a", strokeWidth: 1.4, fill: "#3fb39a", fillStyle: "hachure", hachureGap: 2.2, seed: 3901 }));
      svg.append(rc.path("M -6 26 L -16 44 L -2 40 L 4 46 L 4 28", { stroke: "#9a2a1a", strokeWidth: 1.2, fill: "#e8432e", fillStyle: "solid", seed: 3902 }));
      svg.append(rc.circle(10, -22, 10, { stroke: "#1f1a2a", strokeWidth: 1, fill: "#ffffff", fillStyle: "solid", seed: 3903 }));
      svg.append(rc.circle(11, -22, 4, { stroke: "none", fill: "#1f1a2a", fillStyle: "solid", seed: 3904 }));
      svg.append(rc.path("M 20 -18 Q 32 -16 26 -6 Q 22 -12 18 -10 Z", { stroke: "#9a6a10", strokeWidth: 1, fill: "#f6c945", fillStyle: "solid", seed: 3905 }));
    }));
    G.set(parrot, { x: corner.x + corner.w * 0.4, y: corner.y - size * 1.1 });
    const say = (text) => { const g = bubble(text, corner.x + corner.w * 0.2, corner.y - size * 1.25, job, -4); return g; };
    const tl = job.add(G.timeline({ onComplete: job.end }));
    let line = null;
    tl.fromTo(bars, { opacity: 0 }, { opacity: 1, duration: 0.4 })
      .call(() => { CR.restFace(el.__c); G.set(el, { x: a.x - a.w / 2, y: a.y - a.w, scale: a.k }); sfx("rewind"); line = say("let's see that again..."); })
      .to(el, { x: b.x - b.w / 2, y: b.y - b.w, scale: b.k, duration: 2.8, ease: "power1.inOut" }, "+=0.6")
      .to(el.__act, { y: -b.w * 0.5, duration: 1.4, yoyo: true, repeat: 1, ease: "sine.inOut" }, "<")
      .call(() => { shake(9); sfx("hit", m.piece & 7, colorOf(m.piece)); if (line) line.say("WHAT. A. FINISH!"); CR.setFace(el.__c, "happy", beak(el.__c) ? "open" : "grin"); })
      .to(parrot, { y: `-=${size * 0.2}`, duration: 0.12, yoyo: true, repeat: 5 })
      .call(() => { if (line) line.say(`checkmate in ${Math.ceil(plies / 2)} moves!`); })
      .to({}, { duration: 1.6 })
      .call(() => { if (line) line.say("squawk!"); })
      .to({}, { duration: 1 })
      .to(bars, { opacity: 0, duration: 0.4 });
  }

  /* 15 & 21. pictures to keep: a team photo for a flawless win, and a card for any finished game */
  function savePicture(svgText, w, h, name) {
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = w * 2; cv.height = h * 2;
      const x = cv.getContext("2d");
      x.drawImage(im, 0, 0, w * 2, h * 2);
      cv.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }, "image/png");
    };
    im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
  }
  const creatureSvg = (p, x, y, size) => { const c = CR.make(p, { copies: 1 }); c.svg.setAttribute("x", x); c.svg.setAttribute("y", y); c.svg.setAttribute("width", size); c.svg.setAttribute("height", size); return new XMLSerializer().serializeToString(c.svg); };
  const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const FONT = "font-family=\"Comic Sans MS, Chalkboard SE, cursive\"";
  function teamPhoto(winner) {
    if (!anim) return;
    const team = onBoard((p) => colorOf(p) === winner).map((x) => x.el.__p).sort((a, b) => VALUE[b & 7] - VALUE[a & 7]);
    const W = 640, H = 520, size = 86;
    let crowd = "";
    team.forEach((p, i) => { const row = i < 8 ? 0 : 1, col = i % 8; crowd += creatureSvg(p, 28 + col * 72 + (row ? 36 : 0), 120 + row * 110 - (row ? 0 : 20), size); });
    const date = new Date().toLocaleDateString();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fffdf6"/><rect x="18" y="18" width="${W - 36}" height="${H - 140}" fill="#f3eee2" stroke="#d8d0bc"/><path d="M 30 360 Q 320 320 610 360" stroke="#c8e0b0" stroke-width="40" fill="none" opacity="0.6"/>${crowd}<text x="${W / 2}" y="${H - 70}" text-anchor="middle" font-size="40" ${FONT} fill="#2b2f3a">flawless! not one lost</text><text x="${W / 2}" y="${H - 32}" text-anchor="middle" font-size="20" ${FONT} fill="#6a6f7a">the ${TEAM[winner]} team · ${esc(date)} · chess.nhaajt.com</text></svg>`;
    const card = document.createElement("div");
    card.className = "cx-photo";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Team photo");
    card.innerHTML = `${svg}<div class="cx-photo__row"><button class="cx-btn" type="button" data-act="save">Save the photo</button><button class="cx-btn" type="button" data-act="close">Close</button></div>`;
    document.body.append(card);
    sfx("shutter");
    G.fromTo(card, { y: 60, rotation: -8, opacity: 0 }, { y: 0, rotation: -3, opacity: 1, duration: 0.7, ease: "back.out(1.6)" });
    note(`the ${TEAM[winner]} team won without losing anyone. photo time!`);
    card.addEventListener("click", (e) => {
      const act = e.target.dataset && e.target.dataset.act;
      if (act === "save") savePicture(svg, W, H, "chess-in-the-margins-team-photo.png");
      if (act === "close") G.to(card, { opacity: 0, y: 40, duration: 0.3, onComplete: () => card.remove() });
    });
  }
  function resultCard() {
    const W = 1000, H = 640, sq = 64, bx = 40, by = 64;
    let board = "";
    for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
      const x = bx + f * sq, y = by + (7 - r) * sq, s = r * 16 + f;
      board += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}" fill="${(r + f) % 2 ? "#fffdf6" : "#cfe4bc"}" stroke="#2b2f3a" stroke-width="1.4"/>`;
      const p = game.get(s);
      if (p) board += creatureSvg(p, x + 2, y, sq - 4);
    }
    // long lines are wrapped by hand, since an SVG picture does not wrap text
    const wrap = (text, n) => { const out = [""]; for (const w of String(text).split(/\s+/)) { if ((out[out.length - 1] + " " + w).trim().length > n) out.push(w); else out[out.length - 1] = (out[out.length - 1] + " " + w).trim(); } return out.filter(Boolean); };
    const lines = (list, x, y, gap, attrs) => list.map((t, i) => `<text x="${x}" y="${y + i * gap}" ${attrs}>${esc(t)}</text>`).join("");
    const tx = bx + 8 * sq + 60;
    const status = lines(wrap(statusEl.textContent || "", 26), tx, 170, 32, `font-size="26" ${FONT} fill="#c8452e"`);
    const said = lines(wrap(talk.textContent || "", 26), 20, 46, 30, `font-size="22" ${FONT} fill="#2b2f3a"`);
    const moves = game.played.length;
    const date = esc(new Date().toLocaleDateString());
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f3eee2"/><line x1="0" y1="44" x2="${W}" y2="44" stroke="#b9c9e6" stroke-width="1.4"/><line x1="${bx + 8 * sq + 30}" y1="0" x2="${bx + 8 * sq + 30}" y2="${H}" stroke="#e8a0a0" stroke-width="1.6"/>${board}<text x="${tx}" y="104" font-size="34" ${FONT} fill="#2b2f3a">Chess in the margins</text>${status}<text x="${tx}" y="260" font-size="22" ${FONT} fill="#3c4fb8">${Math.ceil(moves / 2)} moves</text><g transform="translate(${tx} 300) rotate(-2)"><rect width="370" height="130" fill="#fff3b0"/><rect x="140" y="-10" width="90" height="20" fill="#f4a6c0" opacity="0.8"/>${said}</g><text x="${bx + 8 * sq + 60}" y="${H - 40}" font-size="20" ${FONT} fill="#6a6f7a">${date} · chess.nhaajt.com</text></svg>`;
    savePicture(svg, W, H, "chess-in-the-margins-result.png");
    sfx("shutter");
  }

  /* 16. a draw: the two kings have tea */
  function teaParty(reason) {
    if (!anim) return;
    onBoard((p) => (p & 7) === 6).forEach(({ el, sq }, i) => {
      const c = el.__c, f = c.spec.face;
      const g = svgEl("g", { class: "cx-extra" });
      const rc = rough.svg(c.svg);
      const x = 72, y = f.mouth[1] + 10;
      g.append(rc.path(`M ${x - 9} ${y} L ${x + 9} ${y} L ${x + 6} ${y + 12} L ${x - 6} ${y + 12} Z`, { stroke: "#5d6170", strokeWidth: 1.2, fill: "#fffaf0", fillStyle: "solid", seed: 4000 }));
      g.append(rc.path(`M ${x + 9} ${y + 2} q 6 2 0 7`, { stroke: "#5d6170", strokeWidth: 1.2, seed: 4001 }));
      g.append(rc.ellipse(x, y + 13, 24, 4, { stroke: "#5d6170", strokeWidth: 1, fill: "#e8f0f8", fillStyle: "solid", seed: 4002 }));
      const steam = svgEl("g");
      steam.append(rc.path(`M ${x - 3} ${y - 3} q -4 -6 0 -10 q 4 -5 0 -10 M ${x + 3} ${y - 3} q 4 -6 0 -10`, { stroke: "#9aa0ac", strokeWidth: 1, seed: 4003 }));
      g.append(steam);
      c.root.append(g);
      G.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.5, delay: 0.4 });
      G.to(steam, { y: -4, opacity: 0.3, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" });
      G.delayedCall(0.8 + i * 1.1, () => quip(sq, i ? "lovely." : "tea?", 1.4));
    });
    note(reason === "repetition" ? "round and round we went. tea, anyone?" : "a draw. the kings are having tea");
  }

  /* 17. a very long game: everyone grows a beard */
  function growBeards() {
    if (!anim) return;
    for (const [, el] of els) {
      const c = el.__c, f = c.spec.face, [mx, my, ms] = f.mouth;
      const g = svgEl("g", { class: "cx-extra" });
      const rc = rough.svg(c.svg), w = ms * 3.2;
      g.append(rc.path(`M ${mx - w} ${my + 1} Q ${mx - w * 0.6} ${my + w * 1.8} ${mx} ${my + w * 2.2} Q ${mx + w * 0.6} ${my + w * 1.8} ${mx + w} ${my + 1} Q ${mx} ${my + w * 0.6} ${mx - w} ${my + 1} Z`, { stroke: "#8a8f9a", strokeWidth: 1.1, fill: "#e8e8ee", fillStyle: "hachure", hachureGap: 1.6, seed: 4100 }));
      c.face.parentNode.append(g);
      G.fromTo(g, { scaleY: 0, svgOrigin: `${mx} ${my}` }, { scaleY: 1, duration: 2, ease: "power1.out", delay: R(0, 0.8) });
    }
    note("this game has gone on so long everyone grew a beard");
  }

  /* 18. poking a creature that is not yours to move: it giggles, and after five pokes it is cross */
  function poke(sq) {
    const el = els.get(sq);
    if (!el || !anim || el.__away) return;
    const t = stamp();
    const rec = pokes.get(el) || { n: 0, at: 0 };
    if (t - rec.at > 8000) rec.n = 0;
    rec.n++; rec.at = t;
    pokes.set(el, rec);
    const c = el.__c;
    if (rec.n >= 5) {
      rec.n = 0;
      award("cross");
      el.classList.add("is-cross");
      CR.setFace(c, "hurt", beak(c) ? "open" : "frown");
      sfx("hit", 1, colorOf(el.__p));
      quip(sq, pick(["STOP. POKING. ME.", "I bite, you know", "rude!", "that's it, I'm telling the king"]), 1.6);
      G.timeline().to(el.__act, { x: 4, duration: 0.05, yoyo: true, repeat: 11 }).call(() => { el.classList.remove("is-cross"); CR.restFace(c); }, null, "+=1.2");
      return;
    }
    sfx("nudge", el.__p & 7, colorOf(el.__p));
    CR.setFace(c, "happy", beak(c) ? "open" : "grin");
    G.timeline().to(el.__act, { rotation: 8, duration: 0.07, yoyo: true, repeat: 5 }).call(() => { if (c.state === "happy") CR.restFace(c); });
    if (rec.n >= 2) quip(sq, ["", "", "hehe", "that tickles!", "stop it! hehe"][rec.n], 0.9);
  }

  /* 19. the sky: drag the cloud over the sun for night, drag it away for day; on a phone, tap the moon */
  // the handles live on the page itself, above the title and the board, so they can always be grabbed
  const skyBox = document.body;
  const cloudHandle = document.createElement("button");
  cloudHandle.type = "button";
  cloudHandle.className = "cx-skyhandle";
  cloudHandle.setAttribute("aria-label", "Drag the cloud over the sun to turn the page to night, and away again for day");
  const moonHandle = document.createElement("button");
  moonHandle.type = "button";
  moonHandle.className = "cx-skyhandle cx-skyhandle--moon";
  moonHandle.setAttribute("aria-label", "Switch between day and night");
  skyBox.append(cloudHandle, moonHandle);
  function setSky(v) {
    store.set("chess-sky", v);
    sfx("pop");
    drawDeco();
    note(v === "night" ? pick(["who turned off the sun?", "night mode. the fireflies are thrilled", "lights out, creatures"]) : pick(["good morning, creatures!", "the sun is back. everyone squints."]));
  }
  function fitHandles() {
    const box = { left: -window.scrollX, top: -window.scrollY };
    const put = (h, target) => {
      if (!target) { h.hidden = true; return; }
      const r = target.getBoundingClientRect();
      h.hidden = false;
      Object.assign(h.style, { left: `${r.left - box.left}px`, top: `${r.top - box.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    };
    if (!dragging) put(cloudHandle, deco.querySelector(".d-cloud"));
    put(moonHandle, deco.querySelector(".d-moon"));
  }
  let dragging = null;
  setInterval(() => { if (!document.hidden) fitHandles(); }, 500);
  cloudHandle.addEventListener("pointerdown", (e) => {
    const cloud = deco.querySelector(".d-cloud");
    if (!cloud) return;
    G.killTweensOf(cloud);
    dragging = { cloud, x0: e.clientX, y0: e.clientY, gx: Number(G.getProperty(cloud, "x")) || 0, gy: Number(G.getProperty(cloud, "y")) || 0, l: parseFloat(cloudHandle.style.left), t: parseFloat(cloudHandle.style.top) };
    cloudHandle.setPointerCapture(e.pointerId);
    cloudHandle.classList.add("is-dragging");
  });
  cloudHandle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x0, dy = e.clientY - dragging.y0;
    G.set(dragging.cloud, { x: dragging.gx + dx, y: dragging.gy + dy });
    Object.assign(cloudHandle.style, { left: `${dragging.l + dx}px`, top: `${dragging.t + dy}px` });
  });
  const dropCloud = () => {
    if (!dragging) return;
    const { cloud } = dragging;
    dragging = null;
    cloudHandle.classList.remove("is-dragging");
    const sun = deco.querySelector(".d-sun");
    if (!sun) return;
    const a = cloud.getBoundingClientRect(), b = sun.getBoundingClientRect();
    const d = Math.hypot(a.left + a.width / 2 - (b.left + b.width / 2), a.top + a.height / 2 - (b.top + b.height / 2));
    const covering = d < Math.max(60, b.width * 0.6);
    if (covering && !nightNow) setSky("night");
    else if (!covering && nightNow) setSky("day");
  };
  cloudHandle.addEventListener("pointerup", dropCloud);
  cloudHandle.addEventListener("pointercancel", dropCloud);
  cloudHandle.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSky(nightNow ? "day" : "night"); } });
  moonHandle.addEventListener("click", () => setSky(nightNow ? "day" : "night"));

  /* ---------- controls ---------- */

  // while the page is being drawn, the margin panel is written in too, one line at a time,
  // and it cannot be used until the drawing is done, so no button can interrupt it
  let panelTl = null;
  function drawPanelIn(at, until) {
    const side = document.querySelector(".cx-side");
    if (!side || !anim) return;
    side.inert = true;
    side.classList.add("is-drawing");
    const bits = [...side.querySelectorAll(".cx-status, .cx-note, .cx-buttons > *, .cx-opts, .cx-online:not([hidden]), .cx-side__head, .cx-moves, .cx-tray")].filter((el) => el.offsetParent !== null);
    if (panelTl) panelTl.kill();
    const unlock = () => { side.inert = false; side.classList.remove("is-drawing"); };
    G.set(bits, { clipPath: "inset(0 100% 0 0)", opacity: 0 });
    panelTl = G.timeline({ delay: at, onComplete: () => G.set(bits, { clearProps: "clipPath,opacity" }) })
      .call(() => sfx("pencil", Math.min(2.5, until - at), 0.5), null, 0)
      .to(bits, { opacity: 1, clipPath: "inset(0 0% 0 0)", duration: 0.55, ease: "steps(9)", stagger: Math.max(0.05, (until - at - 0.8) / Math.max(1, bits.length)) });
    // the panel unlocks exactly when the board is ready
    G.delayedCall(until, unlock);
  }

  function newGame(first = false) {
    finishMotion();
    armIdle();
    streak[0] = streak[1] = checks[0] = checks[1] = 0;
    game = new Game();
    over = null; selected = -1; legal = []; lastMove = null; firstCapture = true; busy = false;
    if (mode !== "online") human = mode === "cpu" && $("play-purple").checked ? 1 : 0;
    if (mode === "puzzle") { puz = pickPuzzle(); puzStep = 0; puzMisses = 0; if (puz) { game = new Game(puz.fen); human = game.turn; } }
    flipped = mode === "cpu" || mode === "online" || mode === "puzzle" ? human === 1 : flipped;
    spinNow = 0;
    setBoardTransform();
    $("tray-0").replaceChildren(); $("tray-1").replaceChildren();
    $("resign").disabled = false;
    drawBoard(); buildSquares();
    let ready = anim ? 1.4 : 0;
    if (anim && first) {
      // the camera looks straight down at a blank page, the pen draws the board, then the creatures, then the margins
      tiltNow = 0; setBoardTransform();
      const boardTime = drawBoardIn(0.1);
      drawAt = boardTime;
      buildPieces("draw");
      relayout();
      leanBoard(cssTilt(), 2.4);
      // the margins come last, once the board and every creature are drawn
      drawDecoIn(boardTime + 8 * 0.2 + 1.1);
      ready = boardTime + 8 * 0.2 + 1.2;
      if (mode !== "online") writeYourMove(ready);
      drawPanelIn(boardTime * 0.5, ready);
    } else {
      buildPieces(true);
      leanBoard(cssTilt(), 0.5);
    }
    drawMarks(); writeMoves(); whale();
    note(TH.note || (nightNow ? pick(["it's late. the creatures are sleepy", "a night game! the fireflies are watching"]) : "every piece is a creature"));
    startClock();
    statusLine(game.status());
    if (mode === "puzzle") puzzleIntro();
    freshGame(ready);
    $("card").hidden = true;
    if (mode === "cpu" && game.turn !== human) setTimeout(computer, ready * 1000);
  }

  $("new").addEventListener("click", () => {
    if (mode === "online") { if (!net.code) return; if (over) { net.send({ t: "rematch" }); onlineMsg("You asked for a rematch."); } else onlineMsg("Finish or resign this game first."); return; }
    if (!busy) { if (mode === "puzzle") puzExtra++; newGame(); }
  });
  const again = $("again");
  if (again) again.addEventListener("click", () => { if (busy || !anim) return; book().then(() => { drawDeco(); newGame(true); }); });
  // flipping turns the whole board round on the table
  $("flip").addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    deselect();
    finishMotion();
    if (anim) {
      const o = { s: 0 };
      await play(G.timeline().to(o, { s: 180, duration: 1.2, ease: "power2.inOut", onUpdate: () => { spinNow = o.s; setBoardTransform(); relayout(); } }));
    }
    flipped = !flipped;
    spinNow = 0;
    setBoardTransform();
    drawBoard(); buildSquares(); drawMarks(); relayout();
    busy = false;
  });
  $("undo").addEventListener("click", () => {
    if (mode === "online") { onlineMsg("No take-backs online."); return; }
    if (mode === "puzzle") { if (!busy) newGame(); return; }
    if (busy || !game.played.length) return;
    finishMotion();
    game.takeBack();
    if (mode === "cpu" && game.turn !== human && game.played.length) game.takeBack();
    over = null; selected = -1; legal = [];
    lastMove = game.played.length ? game.played[game.played.length - 1].move : null;
    $("resign").disabled = false;
    rebuildTrays();
    buildPieces(); drawMarks(); writeMoves(); labelSquares(); whale();
    clockSwitch();
    statusLine(game.status());
    rewind();
  });
  function rebuildTrays() {
    for (const side of [0, 1]) {
      const tray = $(`tray-${side}`);
      tray.replaceChildren();
      for (const { move } of game.played) if (move.captured && colorOf(move.captured) === side) tray.append(mini(move.captured));
    }
  }
  $("card").addEventListener("click", resultCard);
  $("resign").addEventListener("click", () => {
    if (mode === "online") { if (!over && human >= 0 && net.players.length === 2) { net.send({ t: "resign" }); if (anim) G.fromTo("#resign", { rotation: 2 }, { rotation: -14, y: 6, duration: 0.6, ease: "bounce.out" }); } return; }
    if (over || busy) return;
    const loser = mode === "cpu" ? human : game.turn;
    if (anim) G.fromTo("#resign", { rotation: 2 }, { rotation: -14, y: 6, duration: 0.6, ease: "bounce.out" });
    finish({ over: true, result: loser ? "1-0" : "0-1", reason: "resigned" });
  });
  document.querySelectorAll('input[name="mode"]').forEach((i) => i.addEventListener("change", () => {
    if (mode === "online" && i.value !== "online") leaveRoom(false);
    mode = i.value;
    $("cpu-opts").disabled = mode !== "cpu";
    showOnline();
    if (mode === "online") { onlineMsg(""); if (!busy) { human = 0; newGame(); } return; }
    if (!busy) newGame();
  }));
  document.querySelectorAll('input[name="level"]').forEach((i) => i.addEventListener("change", () => { level = i.value; }));
  $("play-purple").addEventListener("change", () => { if (!busy) newGame(); });
  document.querySelectorAll('input[name="clock"]').forEach((i) => i.addEventListener("change", () => { minutes = Number(i.value); if (!busy) newGame(); }));

  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!busy) { tiltNow = cssTilt(); setBoardTransform(); } relayout(); drawDeco(); bakePieces(); }, 120); });


  /* ---------- playing a friend online ----------
     A room lives on a small Cloudflare service. It keeps the real game and checks every move with this same
     engine; this page sends moves, emotes and offers, and plays back whatever the room says happened. */

  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8787" : "https://chess-rooms.chess-rooms.workers.dev";
  const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
  const net = { ws: null, code: null, ready: false, pending: false, players: [], spectators: 0, tries: 0, closing: false, timer: 0, queue: Promise.resolve(), offline: new Set() };
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } } };
  const myName = $("my-name");
  if (myName) myName.value = store.get("chess-name") || "";

  function roomFromUrl() {
    const m = location.pathname.match(/^\/r\/([A-Za-z0-9]{6})\/?$/);
    const code = (m ? m[1] : new URLSearchParams(location.search).get("room") || "").toUpperCase();
    return CODE_RE.test(code) ? code : null;
  }
  const roomLink = (code) => (location.hostname === "localhost" ? `${location.origin}/?room=${code}` : `${location.origin}/r/${code}`);
  function onlineMsg(t) { const m = $("online-msg"); if (m) m.textContent = t; }
  function showOnline() {
    const on = mode === "online";
    $("online").hidden = !on;
    $("cpu-opts").hidden = on;
    $("clock-opts").hidden = on;
    $("lobby").hidden = Boolean(net.code);
    $("room").hidden = !net.code;
    $("undo").disabled = on;
    if (on) { minutes = 0; stopClock(); $("clocks").hidden = true; }
  }
  const nameNow = () => { const v = (myName && myName.value.trim()) || "a friend"; store.set("chess-name", v); return v.slice(0, 20); };

  $("room-create").addEventListener("click", async () => {
    onlineMsg("Opening a room…");
    try {
      const r = await fetch(`${API}/rooms`, { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      const { code } = await r.json();
      enterRoom(code);
    } catch { onlineMsg("The rooms service did not answer. Try again in a moment."); }
  });
  $("room-join").addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = $("room-code").value.trim().toUpperCase();
    if (!CODE_RE.test(code)) { onlineMsg("A room code is six letters and numbers."); return; }
    onlineMsg("Looking for the room…");
    try {
      const r = await fetch(`${API}/rooms/${code}`);
      if (r.status === 404) { onlineMsg("There is no room with that code."); return; }
      if (!r.ok) throw new Error(String(r.status));
      enterRoom(code);
    } catch { onlineMsg("The rooms service did not answer. Try again in a moment."); }
  });
  $("room-copy").addEventListener("click", async () => {
    const link = roomLink(net.code);
    try { await navigator.clipboard.writeText(link); onlineMsg("Link copied. Send it to your friend."); }
    catch { onlineMsg(link); }
  });
  $("room-leave").addEventListener("click", () => leaveRoom(true));
  $("room-draw").addEventListener("click", () => { if (!over && human >= 0) { net.send({ t: "draw" }); onlineMsg("You offered a draw."); } });
  $("emotes").addEventListener("click", (e) => { const b = e.target.closest("button[data-e]"); if (b && human >= 0) net.send({ t: "emote", e: b.dataset.e }); });

  function enterRoom(code) {
    if (mode !== "online") { mode = "online"; const r = document.querySelector('input[name="mode"][value="online"]'); if (r) r.checked = true; $("cpu-opts").disabled = true; }
    if (net.code && net.code !== code) leaveRoom(false);
    net.code = code;
    $("room-code-show").textContent = code;
    try { history.replaceState(null, "", location.hostname === "localhost" ? `/?room=${code}` : `/r/${code}`); } catch { /* fine */ }
    showOnline();
    onlineMsg("");
    connect();
  }
  function leaveRoom(reset) {
    net.closing = true;
    clearTimeout(net.timer);
    if (net.ws) try { net.ws.close(1000, "left"); } catch { /* gone */ }
    net.ws = null; net.code = null; net.ready = false; net.pending = false; net.players = []; net.offline.clear();
    try { history.replaceState(null, "", "/"); } catch { /* fine */ }
    if (reset) { human = 0; showOnline(); newGame(); onlineMsg("You left the room."); }
  }

  net.send = (msg) => {
    if (!net.ws || net.ws.readyState !== 1) { onlineMsg("Not connected yet."); return false; }
    net.ws.send(JSON.stringify(msg));
    return true;
  };
  function connect() {
    net.closing = false;
    const code = net.code;
    const ws = new WebSocket(`${API.replace(/^http/, "ws")}/rooms/${code}/ws`);
    net.ws = ws;
    ws.onopen = () => { net.tries = 0; ws.send(JSON.stringify({ t: "hello", token: store.get(`chess-room-${code}`), name: nameNow() })); };
    ws.onmessage = (e) => { let msg; try { msg = JSON.parse(e.data); } catch { return; } onMessage(msg); };
    ws.onclose = () => {
      net.ready = false;
      if (net.closing || net.code !== code) return;
      // come back on our own: 1, 2, 4… seconds
      const wait2 = Math.min(15000, 1000 * 2 ** net.tries++);
      onlineMsg("Lost the connection. Reconnecting…");
      net.timer = setTimeout(() => { if (net.code === code) connect(); }, wait2);
    };
  }

  function onMessage(msg) {
    if (msg.t === "welcome") {
      if (msg.token) store.set(`chess-room-${net.code}`, msg.token);
      const was = human;
      human = msg.you === "w" ? 0 : msg.you === "b" ? 1 : -1;
      net.ready = true;
      onlineMsg(human < 0 ? "Both seats are taken, so you are watching." : "");
      if ((human === 1) !== flipped || was !== human) net.queue = net.queue.then(() => { flipped = human === 1; drawBoard(); buildSquares(); relayout(); drawMarks(); statusLine(game.status()); });
      return;
    }
    if (msg.t === "state") { net.queue = net.queue.then(() => applyState(msg)); return; }
    if (msg.t === "move") {
      net.queue = net.queue.then(async () => {
        const m = game.moves().find((x) => x.from === msg.from && x.to === msg.to && (x.promo || 0) === (msg.promo || 0));
        if (!m || game.played.length !== msg.ply - 1) { await resyncFromServer(); return; }
        playMove(m);
        net.pending = false;
        if (!over && game.turn === human) writeYourMove(0.2);
        if (msg.result && !over) finish({ over: true, ...msg.result });
      });
      return;
    }
    if (msg.t === "emote") { emote(msg.color === "w" ? 0 : 1, msg.e); return; }
    if (msg.t === "error") { net.pending = false; onlineMsg(msg.msg); }
  }
  async function resyncFromServer() {
    try { const r = await fetch(`${API}/rooms/${net.code}`); void r; } catch { /* the next state will fix it */ }
    if (net.ws && net.ws.readyState === 1) net.ws.send(JSON.stringify({ t: "hello", token: store.get(`chess-room-${net.code}`), name: nameNow() }));
  }

  // bring the page in line with the room: the same moves, the same result, who is here
  async function applyState(st) {
    finishMotion();
    net.players = st.players;
    net.spectators = st.spectators;
    renderPlayers(st);
    const same = st.moves.length === game.played.length && st.moves.every((mv, i) => { const p = game.played[i].move; return p.from === mv.from && p.to === mv.to && (p.promo || 0) === (mv.promo || 0); });
    if (!same) {
      if (st.moves.length === 0) { over = null; newGame(); note("a fresh page: rematch!"); }
      else rebuildFrom(st.moves);
    }
    net.pending = false;
    if (st.result && !over) finish({ over: true, ...st.result });
    if (!st.result && st.drawOffer && st.drawOffer !== (human ? "b" : "w") && human >= 0) onlineMsg("Your friend offers a draw. Press “Offer a draw” to accept.");
    if (st.result && st.rematch && st.rematch.length === 1 && st.rematch[0] !== (human ? "b" : "w") && human >= 0) onlineMsg("Your friend wants a rematch. Press “New game” to accept.");
    // a player who drops out: their creatures doze off until they come back
    for (const p of st.players) {
      const side = p.color === "w" ? 0 : 1;
      const was = net.offline.has(side);
      if (!p.online && !was) { net.offline.add(side); doze(side, true); if (side !== human && human >= 0) note(`${p.name}'s creatures doze off`); }
      if (p.online && was) { net.offline.delete(side); doze(side, false); if (side !== human && human >= 0) note(`${p.name} is back!`); }
    }
    statusLine(game.status());
  }
  function rebuildFrom(moves) {
    game = new Game();
    for (const mv of moves) {
      const m = game.moves().find((x) => x.from === mv.from && x.to === mv.to && (x.promo || 0) === (mv.promo || 0));
      if (!m) break;
      game.play(m);
    }
    over = null; selected = -1; legal = [];
    lastMove = game.played.length ? game.played[game.played.length - 1].move : null;
    rebuildTrays(); buildPieces(); drawMarks(); writeMoves(); labelSquares(); whale();
    const s2 = game.status();
    if (s2.over) finish(s2);
  }
  function renderPlayers(st) {
    const ul = $("room-players");
    ul.replaceChildren();
    for (const color of ["w", "b"]) {
      const p = st.players.find((x) => x.color === color);
      const li = document.createElement("li");
      if (p && p.online) li.className = "is-on";
      const dot = document.createElement("i");
      const nm = document.createElement("span");
      nm.textContent = p ? `${p.name}${(color === "w" ? 0 : 1) === human ? " (you)" : ""}` : "waiting…";
      const team = document.createElement("span");
      team.className = "cx-team";
      team.textContent = color === "w" ? "orange" : "purple";
      li.append(dot, nm, team);
      ul.append(li);
    }
    if (st.spectators) { const li = document.createElement("li"); li.textContent = `${st.spectators} watching`; li.className = "cx-team"; ul.append(li); }
    $("room-draw").disabled = Boolean(st.result) || human < 0;
  }
  function doze(side, asleep) {
    for (const [, el] of els) {
      if (colorOf(el.__p) !== side) continue;
      if (asleep) { CR.setFace(el.__c, "closed", el.__c.spec.face.beak ? "none" : "wavy"); el.__c.state = "asleep"; if (el.__live) el.__live.timeScale(0.4); }
      else { CR.restFace(el.__c); if (el.__live) el.__live.timeScale(1); }
    }
  }
  // an emote: that side's king pipes up with a word and a little hop
  const SAY = { wave: "hi!", laugh: "ha ha!", grr: "grr!", yawn: "yaaawn", love: "\u2665", shock: "!!" };
  function emote(side, e) {
    sfx("emote", e, side);
    const k = [...els].find(([, el]) => (el.__p & 7) === 6 && colorOf(el.__p) === side);
    if (!k) return;
    const [sq, el] = k, s2 = spot(sq), c = el.__c;
    const face = { wave: "happy", laugh: "happy", grr: "hurt", yawn: "closed", love: "happy", shock: "scared" }[e] || "happy";
    if (c.state !== "asleep") { CR.setFace(c, face, c.spec.face.beak ? "open" : face === "hurt" ? "grin" : "open"); setTimeout(() => { if (c.state === face) CR.restFace(c); }, 1600); }
    if (anim) {
      G.timeline().to(el.__act, { y: -16, duration: 0.15, ease: "power2.out" }).to(el.__act, { y: 0, duration: 0.4, ease: "bounce.out" });
      if (e === "wave" && !c.spec.wings) { const a = c.arms[c.arms.length - 1]; if (a) G.to(a, { rotation: -130, svgOrigin: a.dataset.o, duration: 0.18, yoyo: true, repeat: 5 }); }
      const g = svgEl("g", {});
      const rc2 = rough.svg(fx);
      const w = 38 + SAY[e].length * 9;
      g.append(rc2.path(`M ${-w / 2} -16 Q ${-w / 2} -34 0 -34 Q ${w / 2} -34 ${w / 2} -16 Q ${w / 2} 0 6 0 L -4 14 L -6 0 Q ${-w / 2} 0 ${-w / 2} -16 Z`, { stroke: side ? "#3c4fb8" : "#c8452e", strokeWidth: 2, fill: "#fffdf6", fillStyle: "solid", roughness: 1.2, seed: 7 }));
      const t = svgEl("text", { x: 0, y: -10, "text-anchor": "middle", class: "cx-say__text", fill: e === "love" ? "#e2516a" : side ? "#3c4fb8" : "#c8452e" });
      t.textContent = SAY[e];
      g.append(t);
      fx.append(g);
      G.timeline({ onComplete: () => g.remove() })
        .fromTo(g, { x: s2.x, y: s2.y - s2.w * 1.05, scale: 0, transformOrigin: "50% 100%" }, { scale: 1, duration: 0.35, ease: "back.out(3)" })
        .to(g, { y: "-=8", duration: 1.2, ease: "sine.inOut" })
        .to(g, { opacity: 0, scale: 0.6, duration: 0.3 });
    }
  }
  showOnline();

  /* ---------- sound ---------- */

  const soundBtn = $("sound");
  const paintSound = () => { soundBtn.textContent = SND.on ? "sound: on" : "sound: off"; soundBtn.setAttribute("aria-pressed", String(SND.on)); };
  if (soundBtn) { paintSound(); soundBtn.addEventListener("click", () => { SND.set(!SND.on); paintSound(); }); }
  /* ---------- the volume slingshot (sling.js), and the creatures it can be aimed at ---------- */
  const quietNow = () => !over && !busy && !penBusy && !decoDrawing && !motions.length && !outing && selected < 0 && !document.hidden && !$("intro").classList.contains("is-on");
  // a creature on the board, described the way sling.js wants it: where it is, how to move it, how to hand it back
  const pieceActor = (sq, el) => {
    const s = () => spot(el.__at);
    return {
      el, act: el.__act, c: el.__c, kind: el.__p & 7, side: colorOf(el.__p), name: CREATURE[el.__p & 7][colorOf(el.__p)],
      rect: () => el.getBoundingClientRect(),
      free: () => el.isConnected && !el.__away && el.__at === sq,
      toFrame: (vx, vy) => pageToLayer(vx, vy),
      width: () => s().w,
      put: (fx, fy) => ({ x: fx - s().w / 2, y: fy - s().w }),
      pos: () => [G.getProperty(el, "x") + s().w / 2, G.getProperty(el, "y") + s().w],
      home: () => { const p = s(); return [p.x, p.y]; },
      cross: (on) => el.classList.toggle("is-cross", on),
    };
  };
  const boardActors = () => onBoard(() => true).map(({ sq, el }) => pieceActor(sq, el));
  const slingEl = $("sling");
  const slingApi = slingEl && window.Sling ? window.Sling.mount(slingEl, {
    gsap: G, anim, sound: SND, sfx, paintSound,
    world: () => !$("intro").classList.contains("is-on"),
    range: () => { const r = $("cam").getBoundingClientRect(), s = slingEl.getBoundingClientRect(); return Math.max(420, s.left - r.left + 60); },
    targets: boardActors,
    actors: boardActors,
    quiet: quietNow,
    onHit: () => { const n = Number(store.get("chess-sling-hits") || 0) + 1; store.set("chess-sling-hits", String(n)); if (n >= 10) award("aim"); },
    onRevenge: (kind) => award(kind),
    calm: () => { if (outing && outing.hurry) outing.hurry(); },
    borrow(list, onEnd) {
      if (!quietNow()) return null;
      const job = skit(list.map((a) => a.el));
      tableEl.style.zIndex = "5";
      list.forEach((a) => { a.el.style.zIndex = "2000"; });
      job.after = () => { tableEl.style.zIndex = ""; list.forEach((a) => a.cross(false)); onEnd(); };
      return { add: job.add, end: job.end, get done() { return job.done; } };
    },
  }) : null;
  if (soundBtn && slingApi) soundBtn.addEventListener("click", slingApi.paint);

  // the browser keeps the page quiet until it is touched, so once the board is drawn a little one asks for that touch
  let tapAsked = false;
  function askForTap() {
    if (tapAsked || !window.Sling || SND.live) return;
    tapAsked = true;
    const sq = human === 1 ? 0x64 : 0x14, el = els.get(sq) || [...els.values()].find((e) => colorOf(e.__p) === (human === 1 ? 1 : 0));
    if (!el) return;
    window.Sling.tapMe({
      sound: SND, gsap: G, anim, paintSound: () => { paintSound(); if (slingApi) slingApi.paint(); },
      rect: () => el.isConnected ? el.getBoundingClientRect() : null,
      raise: (on) => { if (!anim || !el.isConnected) return; const arm = el.__c.arms[el.__c.arms.length - 1]; if (arm && !el.__c.spec.wings) G.to(arm, { rotation: on ? -150 : 0, svgOrigin: arm.dataset.o, duration: 0.3 }); },
      thanks: () => {
        sfx("select", el.__p & 7, colorOf(el.__p));
        if (!anim || !el.isConnected) return;
        CR.setFace(el.__c, "happy", beak(el.__c) ? "open" : "grin");
        G.timeline().to(el.__act, { y: -26, duration: 0.18, ease: "power2.out" }).to(el.__act, { y: 0, duration: 0.45, ease: "bounce.out" }).call(() => CR.restFace(el.__c), null, "+=0.6");
      },
    });
  }



  /* ---------- today's puzzle: mate in two, a new one every day (puzzles.js, from the Lichess puzzle database) ---------- */
  const PUZZLES = window.CHESS_PUZZLES || [];
  const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  let puz = null, puzStep = 0, puzMisses = 0, puzExtra = 0;
  const uciOf = (m) => name(m.from) + name(m.to) + (m.promo ? "nbrq"[[2, 3, 4, 5].indexOf(m.promo & 7)] : "");
  const fromUci = (g, u) => g.moves().find((m) => uciOf(m) === u);
  const pickPuzzle = () => (PUZZLES.length ? PUZZLES[(((dayNo() + puzExtra) % PUZZLES.length) + PUZZLES.length) % PUZZLES.length] : null);
  // after the first move: whatever the other side answers, is there a mate in one? (other mates in two count too)
  function forcesMate(g) {
    const replies = g.moves();
    if (!replies.length) return g.inCheck();
    return replies.every((r) => {
      g.make(r);
      const ok = g.moves().some((x) => { g.make(x); const mate = g.inCheck() && !g.moves().length; g.unmake(x); return mate; });
      g.unmake(r);
      return ok;
    });
  }
  function puzzleIntro() {
    if (!puz) { statusEl.textContent = "No puzzle today, sorry."; return; }
    const n = PUZZLES.indexOf(puz) + 1;
    statusEl.textContent = `Puzzle ${n}: the ${TEAM[human]} team to move, and mate in two. (A puzzle from lichess.org; New game gives you another one.)`;
    note(pick(["find the mate in two. the creatures are holding their breath", "two moves to checkmate. the owl believes in you", "today's puzzle! no peeking at the whale"]));
  }
  async function puzzleAnswer(m) {
    if (!puz) return;
    busy = true;
    if (motion && motion.promise) await motion.promise;
    await wait(anim ? 450 : 30);
    busy = false;
    const st = game.status();
    if (st.reason === "checkmate") return;
    if (puzStep === 0) {
      const good = uciOf(m) === puz.line[0] || forcesMate(game);
      if (!good) { await puzzleWrong(); return; }
      puzStep = 2;
      busy = true;
      await wait(anim ? 350 : 30);
      busy = false;
      const reply = fromUci(game, puz.line[1]) || game.moves()[0];
      if (reply) await playMove(reply);
      if (motion && motion.promise) await motion.promise;
      statusEl.textContent = "Good! Now the mate, in one move.";
      note(pick(["ooh. they did not see that coming", "one more move. make it count", "the creatures are on the edge of their squares"]));
    } else await puzzleWrong(true);
  }
  async function puzzleWrong(second) {
    puzMisses++;
    busy = true;
    await wait(anim ? 500 : 30);
    sfx("nudge");
    note(pick(["not quite. the creatures put it back", "close! try another move", "hmm, no. the owl shakes its head"]));
    game.takeBack();
    over = null; selected = -1; legal = [];
    lastMove = game.played.length ? game.played[game.played.length - 1].move : null;
    rebuildTrays(); buildPieces(); drawMarks(); writeMoves(); labelSquares();
    statusEl.textContent = second ? "That is not mate yet. Try again." : "Not that one. Try again.";
    busy = false;
    // after two misses, the creature that should move gives itself away
    if (puzMisses >= 2 && anim) {
      const m = fromUci(game, puz.line[puzStep]);
      if (m && els.get(m.from)) { quip(m.from, pick(["psst. me!", "pick me!", "I have an idea"]), 1.8); G.fromTo(els.get(m.from).__act, { y: 0 }, { y: -18, duration: 0.18, yoyo: true, repeat: 3 }); }
    }
  }
  function puzzleSolved() {
    let solved = [];
    try { solved = JSON.parse(store.get("chess-puzzles-solved") || "[]"); } catch { /* start again */ }
    if (!solved.includes(puz.id)) solved.push(puz.id);
    store.set("chess-puzzles-solved", JSON.stringify(solved));
    statusEl.textContent = `Solved! Mate in two${puzMisses ? ` (after ${puzMisses} ${puzMisses === 1 ? "try" : "tries"})` : ", first time"}. New game gives you another puzzle.`;
    award("puzzle");
    if (solved.length >= 3) award("puzzle3");
  }

  /* ---------- stickers: little prizes for things done, kept on this device ---------- */
  const STICKERS = [
    { id: "win", piece: 6, name: "First win", how: "Beat the computer." },
    { id: "hard", piece: 14, name: "Giant slayer", how: "Beat the computer on hard." },
    { id: "knight", piece: 2, name: "Hoof finish", how: "Checkmate with a knight." },
    { id: "flawless", piece: 5, name: "Not a scratch", how: "Win without losing a single creature." },
    { id: "quick", piece: 13, name: "Speedy", how: "Checkmate in eight moves or fewer." },
    { id: "promo", piece: 1, name: "All grown up", how: "Turn a pawn into something bigger." },
    { id: "castle", piece: 4, name: "Moving house", how: "Castle." },
    { id: "ep", piece: 9, name: "In passing", how: "Take a pawn en passant." },
    { id: "tea", piece: 12, name: "Tea for two", how: "Finish a game in a draw." },
    { id: "night", piece: 14, name: "Night owl", how: "Finish a game after dark." },
    { id: "rain", piece: 10, name: "Rainy day", how: "Play while it is raining or snowing outside." },
    { id: "puzzle", piece: 3, name: "Puzzler", how: "Solve a puzzle." },
    { id: "puzzle3", piece: 11, name: "Puzzle fiend", how: "Solve three different puzzles." },
    { id: "cross", piece: 1, name: "Poke!", how: "Poke a creature until it is cross." },
    { id: "aim", piece: 3, name: "Sharpshooter", how: "Hit ten creatures with the slingshot." },
    { id: "stomp", piece: 4, name: "Flattened", how: "Get your slingshot stomped." },
    { id: "gang", piece: 9, name: "Outnumbered", how: "Get a whole team after you." },
    { id: "zap", piece: 11, name: "Toast", how: "Get your slingshot zapped by the wizard." },
  ];
  let stickers = {};
  try { stickers = JSON.parse(store.get("chess-stickers") || "{}") || {}; } catch { stickers = {}; }
  const stickerBtn = $("stickers-btn");
  const paintStickers = () => { if (stickerBtn) stickerBtn.textContent = `stickers: ${Object.keys(stickers).length} of ${STICKERS.length}`; };
  paintStickers();
  function award(id) {
    const s = STICKERS.find((x) => x.id === id);
    if (!s || stickers[id]) return;
    stickers[id] = new Date().toISOString().slice(0, 10);
    store.set("chess-stickers", JSON.stringify(stickers));
    paintStickers();
    // the new sticker is slapped onto the corner of the page for a moment
    const t = document.createElement("div");
    t.className = "cx-toast";
    t.setAttribute("role", "status");
    const art = mini(s.piece);
    art.setAttribute("aria-hidden", "true");
    const words = document.createElement("p");
    words.innerHTML = `<b>New sticker!</b> ${s.name}`;
    t.append(art, words);
    document.body.append(t);
    sfx("page");
    if (anim) G.timeline({ onComplete: () => t.remove() })
      .fromTo(t, { scale: 1.8, rotation: -14, opacity: 0 }, { scale: 1, rotation: -3, opacity: 1, duration: 0.35, ease: "back.out(2)" })
      .to(t, { y: 20, opacity: 0, duration: 0.4, delay: 3.2 });
    else setTimeout(() => t.remove(), 3800);
  }
  const mineMove = (m) => mode === "friend" || colorOf(m.piece) === human;
  function stickersForMove(m) {
    if (!mineMove(m)) return;
    if (m.promo) award("promo");
    if (m.flags & (E.F_KCASTLE | E.F_QCASTLE)) award("castle");
    if (m.flags & E.F_EP) award("ep");
    if (window.Weather && ["rain", "storm", "drizzle", "snow"].includes(window.Weather.sky)) award("rain");
  }
  function stickersForEnd(st) {
    if (nightNow) award("night");
    if (st.reason !== "checkmate") { if (st.result === "1/2-1/2") award("tea"); return; }
    const winner = st.result === "1-0" ? 0 : 1, mine = mode === "friend" || winner === human;
    if (mode === "puzzle") { puzzleSolved(); return; }
    if (!mine) return;
    if (mode === "cpu") { award("win"); if (level === "hard") award("hard"); }
    if (lastMove && (lastMove.piece & 7) === 2) award("knight");
    if ($(`tray-${winner}`).children.length === 0) award("flawless");
    if (game.played.length <= 16) award("quick");
  }
  // the sticker book
  function openStickers() {
    let d = $("sticker-book");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "sticker-book";
      d.className = "cx-book";
      d.setAttribute("aria-labelledby", "sticker-title");
      document.body.append(d);
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    }
    d.innerHTML = `<h2 id="sticker-title">Stickers</h2><p class="cx-book__sub">${Object.keys(stickers).length} of ${STICKERS.length} collected. They are kept on this device.</p><ul class="cx-book__grid"></ul><button class="cx-btn cx-btn--solid" type="button" id="sticker-close">Close</button>`;
    const grid = d.querySelector("ul");
    STICKERS.forEach((s) => {
      const got = Boolean(stickers[s.id]);
      const li = document.createElement("li");
      li.className = got ? "is-got" : "is-locked";
      const art = mini(s.piece);
      art.setAttribute("aria-hidden", "true");
      const t = document.createElement("div");
      t.innerHTML = `<b>${got ? s.name : "not yet"}</b><span>${s.how}</span>`;
      li.append(art, t);
      grid.append(li);
    });
    d.querySelector("#sticker-close").addEventListener("click", () => d.close());
    d.showModal();
    sfx("page");
  }
  if (stickerBtn) stickerBtn.addEventListener("click", openStickers);
  if (window.Weather) window.Weather.ready.then(({ sky, wind }) => {
    const words = { rain: "it's raining outside. the whale is delighted", storm: "a storm outside! the creatures huddle together", drizzle: "a little drizzle outside. the frog approves",
      snow: "it's snowing outside! the penguin is very happy", fog: "foggy outside. the owl can't see a thing" }[sky] || (wind ? "a windy day. hold on to your hats" : null);
    if (words && !game.played.length && mode !== "puzzle") note(words);
  });

  // a copy of the game is kept on the device, so it opens and plays without a connection (sw.js)
  if ("serviceWorker" in navigator && location.protocol === "https:") addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => { /* fine without */ }));

  /* ---------- the opening, once per visitor ---------- */

  // "your move", written under the board once everything has been drawn
  function writeYourMove(at) {
    const y = $("yourmove");
    if (!y || !anim) return;
    G.delayedCall(at, () => {
      // online, only the player whose turn it is gets told
      if (mode === "online" && (game.turn !== human || net.players.length < 2)) return;
      G.fromTo(y, { clipPath: "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0% 0 0)", duration: 1.1, ease: "steps(12)" });
      G.to(y, { opacity: 0, duration: 0.6, delay: 3.5 });
    });
  }

  // the opening is a short story told in pen. Each scene is written and drawn on the page,
  // then an eraser rubs it out from left to right and the next scene is drawn in its place.
  const storyLives = [];
  // the star of the story: coloured in orange crayon, outlined in purple ink. That is the whole quarrel.
  const theStar = (cx, cy, R2, seed = 21) => (rc) => {
    const g = svgEl("g", { class: "st-star" });
    g.append(rc.polygon(starPts(cx, cy, R2, R2 * 0.44), { stroke: "none", fill: "#f39a2e", fillStyle: "hachure", hachureGap: 3.2, fillWeight: 2.4, hachureAngle: -35, roughness: 1.4, seed }));
    g.append(rc.polygon(starPts(cx, cy, R2, R2 * 0.44), { stroke: "#6660c8", strokeWidth: Math.max(2.4, R2 / 22), roughness: 1.2, seed: seed + 1 }));
    g.append(rc.circle(cx - R2 * 0.14, cy - R2 * 0.06, R2 * 0.09, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: seed + 2 }));
    g.append(rc.circle(cx + R2 * 0.14, cy - R2 * 0.06, R2 * 0.09, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: seed + 3 }));
    g.append(rc.arc(cx, cy + R2 * 0.07, R2 * 0.22, R2 * 0.14, 0.3, Math.PI - 0.3, false, { stroke: "#2b2f3a", strokeWidth: 2, seed: seed + 4 }));
    return g;
  };
  const twinkle = (cx, cy) => (el) => {
    storyLives.push({ kill: G.to(el, { rotation: 8, svgOrigin: `${cx} ${cy}`, duration: 0.9, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill });
    storyLives.push({ kill: G.to(el, { scale: 1.08, svgOrigin: `${cx} ${cy}`, duration: 0.6, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill });
  };
  const hop = (c, h = 18, times = 3, d = 0.18) => G.timeline().to(c.wrap, { y: `-=${h}`, duration: d, yoyo: true, repeat: times * 2 - 1, ease: "power2.out" });
  const waveArm = (c, n = 5) => { const a2 = c.arms[c.arms.length - 1]; if (a2 && !c.spec.wings) G.to(a2, { rotation: -130, svgOrigin: a2.dataset.o, duration: 0.2, yoyo: true, repeat: n }); };
  const SCENES = [
    {
      draw(sc) {
        sc.write("Chess in the margins", 500, 245, 86, [["Chess", "#c8452e"], [" in the margins", "#3c4fb8"]]);
        // the author's name in navy, its shadow in royal gold just behind it
        sc.write("", 502, 327, 30, [["a little story drawn by ", "rgba(0,0,0,0)"], ["Nhat Nguyen", "#c9a227"]]);
        sc.write("", 500, 325, 30, [["a little story drawn by ", "#5d6170"], ["Nhat Nguyen", "#14213d"]]);
        sc.write("", 502, 370, 28, [["một câu chuyện nhỏ vẽ bởi ", "rgba(0,0,0,0)"], ["Nhật Nguyễn", "#c9a227"]], undefined, true);
        sc.write("", 500, 368, 28, [["một câu chuyện nhỏ vẽ bởi ", "#5d6170"], ["Nhật Nguyễn", "#14213d"]], undefined, true);
        sc.ink((rc) => rc.path("M 300 270 Q 400 284 500 270 T 700 272", { stroke: "#c8452e", strokeWidth: 2.4, roughness: 1.2, seed: 3 }));
        sc.ink(theStar(232, 210, 18, 4), twinkle(232, 210));
        sc.ink(theStar(768, 212, 14, 8), twinkle(768, 212));
        sc.creature(6, 120, 400, 120, "happy", false, (c) => waveArm(c));
        sc.creature(14, 760, 400, 120, "happy", false, (c) => waveArm(c));
      },
    },
    {
      en: "Once upon a time, one notebook page had two neighbours.",
      vi: "Ngày xửa ngày xưa, trên một trang vở có hai nhà hàng xóm.",
      hold: 0.8,
      draw(sc) {
        sc.ink((rc) => rc.line(500, 150, 502, 570, { stroke: "#e2483d", strokeWidth: 2.4, roughness: 1, seed: 11 }));
        sc.write("the Orange Meadow", 250, 190, 30, null, "#c8452e");
        sc.write("Đồng Cỏ Cam", 250, 222, 24, null, "#c8452e", true);
        sc.write("the Purple Inkwell", 750, 190, 30, null, "#3c4fb8");
        sc.write("Lọ Mực Tím", 750, 222, 24, null, "#3c4fb8", true);
        sc.ink((rc) => { let d = ""; for (let i = 0; i < 14; i++) { const x = 40 + i * 32; d += `M ${x} 560 l -4 -14 M ${x + 5} 560 l 0 -18 M ${x + 10} 560 l 4 -12 `; } return rc.path(d, { stroke: "#5aa04a", strokeWidth: 1.8, roughness: 1.3, seed: 12 }); });
        sc.ink((rc) => rc.path("M 880 560 L 878 470 Q 878 452 896 452 L 944 452 Q 962 452 962 470 L 960 560 Z", { stroke: "#2b2f3a", strokeWidth: 1.8, fill: "#6660c8", fillStyle: "hachure", hachureGap: 4, roughness: 1.2, seed: 13 }));
        sc.ink((rc) => rc.rectangle(902, 430, 36, 22, { stroke: "#2b2f3a", strokeWidth: 1.6, fill: "#c8955a", fillStyle: "solid", roughness: 1, seed: 14 }));
        sc.creature(6, 60, 300, 140, null, false, (c) => waveArm(c, 3));
        sc.creature(1, 210, 390, 110, null, false, (c) => hop(c, 14, 2));
        sc.creature(2, 320, 360, 140);
        sc.creature(14, 540, 300, 140, null, false, (c) => waveArm(c, 3));
        sc.creature(9, 690, 390, 110, null, false, (c) => hop(c, 14, 2));
        sc.creature(10, 760, 360, 140, null, true);
        sc.pop("good morning!", 130, 290, 24, "#c8452e", 2.4, -4);
        sc.pop("chào buổi sáng!", 610, 290, 24, "#3c4fb8", 2.8, 4);
      },
    },
    {
      en: "They got along fine. Mostly. The mushrooms and the blobs even played tag.",
      vi: "Họ sống khá hoà thuận. Phần lớn là vậy. Nấm và ma blob còn chơi đuổi bắt.",
      hold: 1.4,
      draw(sc) {
        sc.ink((rc) => rc.line(500, 150, 502, 570, { stroke: "#e2483d", strokeWidth: 2.4, roughness: 1, seed: 15 }));
        sc.creature(1, 140, 410, 110, "happy", false, (c) => G.timeline({ repeat: 1, yoyo: true }).to(c.wrap, { x: "+=520", duration: 2.2, ease: "sine.inOut" }));
        sc.creature(9, 300, 410, 110, "scared", false, (c) => G.timeline({ repeat: 1, yoyo: true }).to(c.wrap, { x: "+=520", duration: 2.2, ease: "sine.inOut" }));
        sc.pop("tag!", 500, 380, 40, "#c8452e", 3.2, -8);
        sc.pop("không công bằng!", 500, 430, 26, "#3c4fb8", 4.2, 5);
        sc.creature(3, 760, 230, 100, "happy");
        sc.creature(11, 860, 230, 100, "happy");
      },
    },
    {
      en: "Then one rainy afternoon, someone doodled a star right on the red line.",
      vi: "Rồi một chiều mưa, ai đó vẽ nguệch ngoạc một ngôi sao ngay trên đường kẻ đỏ.",
      hold: 0.8,
      draw(sc) {
        sc.ink((rc) => rc.line(500, 150, 502, 570, { stroke: "#e2483d", strokeWidth: 2.4, roughness: 1, seed: 16 }));
        sc.ink((rc) => { let d = ""; for (let i = 0; i < 26; i++) { const x = 40 + (i * 37) % 920, y = 150 + ((i * 53) % 80); d += `M ${x} ${y} l -6 16 `; } return rc.path(d, { stroke: "#8ec0f4", strokeWidth: 1.6, roughness: 0.8, seed: 17 }); });
        sc.ink((rc) => rc.path("M 420 470 C 450 300 560 300 580 420", { stroke: "#5d6170", strokeWidth: 1.6, strokeLineDash: [6, 8], roughness: 1, seed: 18 }));
        sc.ink(theStar(500, 360, 92, 21), twinkle(500, 360));
        sc.ink((rc) => rc.path("M 380 250 l -16 -16 M 620 250 l 16 -16 M 370 400 l -20 6 M 630 400 l 20 6 M 500 240 l 0 -24", { stroke: "#e0a21a", strokeWidth: 2.4, roughness: 1, seed: 22 }));
        sc.creature(6, 90, 330, 150, "scared", false, (c) => G.to(c.pupils, { x: 2.4, duration: 0.3 }));
        sc.creature(14, 760, 330, 150, "scared", false, (c) => G.to(c.pupils, { x: -2.4, duration: 0.3 }));
        sc.pop("!", 175, 320, 64, "#c8452e", 2.4);
        sc.pop("!", 845, 320, 64, "#3c4fb8", 2.5);
        sc.pop("ooh, shiny", 500, 540, 26, "#5d6170", 3.2);
      },
    },
    {
      en: "“It's coloured in ORANGE crayon,” said the owl king. “So it's ours!”",
      vi: "“Nó được tô bằng sáp CAM,” vua Cú nói. “Vậy nó là của bọn ta!”",
      hold: 0.6,
      draw(sc) {
        sc.ink(theStar(560, 380, 80, 31), (el) => G.fromTo(el.firstChild, { opacity: 0.4 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 5 }));
        sc.ink((rc) => rc.path("M 330 330 Q 400 300 470 350", { stroke: "#c8452e", strokeWidth: 2.4, roughness: 1, seed: 33 }));
        sc.ink((rc) => rc.path("M 456 336 L 472 352 L 450 356", { stroke: "#c8452e", strokeWidth: 2.4, roughness: 1, seed: 34 }));
        sc.creature(6, 140, 300, 190, "happy", false, (c) => { hop(c, 22, 2); const a2 = c.arms[1]; if (a2) G.to(a2, { rotation: -80, svgOrigin: a2.dataset.o, duration: 0.3 }); });
        sc.creature(1, 40, 440, 90, "happy", false, (c) => hop(c, 12, 4, 0.15));
        sc.creature(2, 330, 440, 110, "happy", false, (c) => hop(c, 12, 4, 0.16));
        sc.pop("ORANGE!", 560, 520, 42, "#c8452e", 2.6, -5);
        sc.pop("CAM!", 700, 260, 34, "#c8452e", 3.0, 6);
      },
    },
    {
      en: "“But the OUTLINE is purple ink,” said the penguin king. “So it's ours!”",
      vi: "“Nhưng NÉT VIỀN là mực tím,” vua Chim Cánh Cụt đáp. “Vậy nó là của bọn ta!”",
      hold: 0.6,
      draw(sc) {
        sc.ink(theStar(440, 380, 80, 41), (el) => G.fromTo(el.children[1], { opacity: 0.2 }, { opacity: 1, duration: 0.3, yoyo: true, repeat: 5 }));
        sc.ink((rc) => rc.path("M 670 330 Q 600 300 530 350", { stroke: "#3c4fb8", strokeWidth: 2.4, roughness: 1, seed: 43 }));
        sc.ink((rc) => rc.path("M 544 336 L 528 352 L 550 356", { stroke: "#3c4fb8", strokeWidth: 2.4, roughness: 1, seed: 44 }));
        sc.creature(14, 670, 300, 190, "happy", false, (c) => { hop(c, 22, 2); const a2 = c.arms[0]; if (a2) G.to(a2, { rotation: 80, svgOrigin: a2.dataset.o, duration: 0.3 }); });
        sc.creature(9, 870, 440, 90, "happy", false, (c) => hop(c, 12, 4, 0.15));
        sc.creature(10, 560, 440, 110, "happy", true, (c) => hop(c, 12, 4, 0.16));
        sc.pop("PURPLE!", 440, 520, 42, "#3c4fb8", 2.6, 5);
        sc.pop("TÍM!", 300, 260, 34, "#3c4fb8", 3.0, -6);
      },
    },
    {
      en: "So they pulled. And pulled. The star stretched like chewing gum.",
      vi: "Thế là họ kéo. Kéo mãi. Ngôi sao dãn ra như kẹo cao su.",
      hold: 2.2,
      draw(sc) {
        const rope = sc.ink((rc) => rc.path("M 260 390 Q 500 410 740 390", { stroke: "#7a5a2a", strokeWidth: 3, roughness: 1.4, seed: 51 }));
        sc.ink(theStar(500, 380, 70, 52), (el) => storyLives.push({ kill: G.to(el, { scaleX: 1.45, scaleY: 0.8, svgOrigin: "500 380", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill }));
        void rope;
        sc.creature(6, 120, 300, 170, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "-=18", rotation: -8, svgOrigin: "200 470", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill }));
        sc.creature(14, 710, 300, 170, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "+=18", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut" }).kill }));
        sc.creature(1, 20, 420, 90, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "-=10", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.1 }).kill }));
        sc.creature(9, 890, 420, 90, "hurt", false, (c) => storyLives.push({ kill: G.to(c.wrap, { x: "+=10", duration: 0.35, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.1 }).kill }));
        sc.pop("hngggh!", 230, 270, 30, "#c8452e", 2.4, -6);
        sc.pop("ugh!!", 790, 270, 30, "#3c4fb8", 2.8, 6);
        sc.pop("boing", 500, 300, 28, "#5d6170", 4.0, -3);
      },
    },
    {
      en: "The pony tried sitting on it. The blob tried swallowing it. Ptui.",
      vi: "Chú ngựa thử ngồi lên nó. Ma blob thử nuốt chửng nó. Phụt.",
      hold: 2.4,
      draw(sc) {
        const star = sc.ink(theStar(500, 430, 60, 61), (el) => {
          G.timeline({ delay: 1.6 })
            .to(el, { scale: 0.2, svgOrigin: "500 430", duration: 0.2 })
            .to(el, { opacity: 0, duration: 0.05 })
            .to(el, { opacity: 1, scale: 1, x: 40, y: -120, rotation: 400, svgOrigin: "500 430", duration: 0.6, ease: "power2.out", delay: 0.6 })
            .to(el, { y: 0, x: 0, rotation: 720, svgOrigin: "500 430", duration: 0.6, ease: "bounce.out" });
        });
        void star;
        sc.creature(2, 380, 230, 150, "happy", false, (c) => G.timeline().to(c.wrap, { y: "+=110", x: "+=40", duration: 0.4, ease: "power2.in" }).to(c.wrap, { y: "-=150", x: "-=120", rotation: -40, duration: 0.5, ease: "power2.out" }).to(c.wrap, { y: "+=40", rotation: 0, duration: 0.4, ease: "bounce.out" }).call(() => CR.setFace(c, "dizzy", "wavy")));
        sc.creature(9, 640, 380, 120, "happy", true, (c) => G.timeline({ delay: 1.2 }).to(c.wrap, { x: "-=110", duration: 0.35, ease: "power2.in" }).to(c.root, { scale: 1.6, svgOrigin: "50 94", duration: 0.25 }).call(() => CR.setFace(c, "hurt", "open")).to(c.root, { scale: 1, svgOrigin: "50 94", duration: 0.25, delay: 0.5 }).to(c.wrap, { x: "+=110", duration: 0.5, ease: "power2.out" }));
        sc.pop("boing!", 420, 330, 34, "#c8452e", 2.6, -8);
        sc.pop("gulp…", 560, 360, 28, "#3c4fb8", 3.4, 4);
        sc.pop("PTUI!", 590, 300, 44, "#3c4fb8", 4.2, -6);
      },
    },
    {
      en: "Then the snail, who had been crossing the page for three days, spoke up.",
      vi: "Rồi chú ốc sên, đã bò ngang trang giấy suốt ba ngày, lên tiếng.",
      hold: 3.0,
      draw(sc) {
        const sn = sc.ink((rc) => {
          const g = svgEl("g", {});
          g.append(rc.path("M 120 470 L 200 470 Q 218 460 210 446 L 218 424 M 210 446 L 200 424", { stroke: "#3c4fb8", strokeWidth: 2.4, roughness: 1, seed: 71 }));
          g.append(rc.circle(140, 446, 56, { stroke: "#b4561d", strokeWidth: 2.4, fill: "#f0c08a", fillStyle: "hachure", hachureGap: 4, roughness: 1, seed: 72 }));
          g.append(rc.path("M 140 446 m -12 0 a 12 12 0 1 1 24 0 a 8 8 0 1 1 -16 0", { stroke: "#b4561d", strokeWidth: 2, seed: 73 }));
          g.append(rc.circle(218, 422, 6, { stroke: "none", fill: "#2b2f3a", fillStyle: "solid", seed: 74 }));
          return g;
        }, (el) => storyLives.push({ kill: G.to(el, { x: 260, duration: 9, ease: "none" }).kill }));
        void sn;
        sc.ink((rc) => rc.path("M 520 250 Q 520 190 640 190 L 820 190 Q 900 190 900 250 Q 900 310 820 310 L 580 310 L 500 360 L 530 306 Q 520 296 520 250 Z", { stroke: "#2b2f3a", strokeWidth: 2, fill: "#fffdf6", fillStyle: "solid", roughness: 1.2, seed: 75 }));
        sc.pop("“…why not play for it?”", 710, 245, 30, "#2b2f3a", 2.4);
        sc.pop("“…sao không đánh cờ mà phân xử?”", 710, 285, 22, "#5d6170", 3.0);
        sc.creature(6, 60, 220, 110, "scared", false, (c) => G.to(c.pupils, { x: 2, y: 1.5, duration: 0.3 }));
        sc.creature(14, 230, 220, 110, "scared", false, (c) => G.to(c.pupils, { x: 2, y: 1.5, duration: 0.3 }));
      },
    },
    {
      en: "So they settled it the old way: sixty-four squares, one move at a time.",
      vi: "Thế là họ phân xử theo cách xưa: sáu mươi tư ô cờ, mỗi lượt một nước.",
      hold: 0.6,
      draw(sc) {
        sc.ink((rc) => { let d = ""; for (let i = 0; i <= 4; i++) { d += `M ${380 + i * 60} 250 L ${380 + i * 60} 490 M 380 ${250 + i * 60} L 620 ${250 + i * 60} `; } return rc.path(d, { stroke: "#2b2f3a", strokeWidth: 2.2, roughness: 1.1, seed: 81 }); });
        sc.ink((rc) => { let d = ""; for (let r = 0; r < 4; r++) for (let f = 0; f < 4; f++) if ((r + f) % 2) { const x = 384 + f * 60, y = 254 + r * 60; for (let i = 0; i < 6; i++) d += `M ${x + 6 + i * 9} ${y + 48} l ${(i % 3) - 1} -10 `; } return rc.path(d, { stroke: "#5aa04a", strokeWidth: 1.6, roughness: 1, seed: 82 }); });
        sc.ink(theStar(500, 200, 30, 83), twinkle(500, 200));
        sc.creature(1, 390, 380, 50, "happy");
        sc.creature(9, 570, 250, 50, "happy");
        sc.creature(6, 130, 330, 150, "open", false, (c) => { const a2 = c.arms[1]; if (a2) G.to(a2, { rotation: -100, svgOrigin: a2.dataset.o, duration: 0.4 }); G.to(c.wrap, { rotation: 10, svgOrigin: "205 480", duration: 0.4, yoyo: true, repeat: 1, delay: 0.6 }); });
        sc.creature(14, 720, 330, 150, "open", false, (c) => { const a2 = c.arms[0]; if (a2) G.to(a2, { rotation: 100, svgOrigin: a2.dataset.o, duration: 0.4 }); G.to(c.wrap, { rotation: -10, svgOrigin: "795 480", duration: 0.4, yoyo: true, repeat: 1, delay: 0.6 }); });
        sc.pop("a fair fight!", 500, 548, 30, "#2b2f3a", 2.6);
      },
    },
    {
      en: "Winner keeps the star. Loser has to draw the next one.",
      vi: "Bên thắng giữ ngôi sao. Bên thua phải vẽ ngôi sao tiếp theo.",
      hold: 0.8,
      draw(sc) {
        sc.ink(theStar(500, 330, 70, 91), (el) => storyLives.push({ kill: G.to(el, { rotation: 360, svgOrigin: "500 330", duration: 4, repeat: -1, ease: "none" }).kill }));
        [1, 2, 6, 3].forEach((pc, i) => sc.creature(pc, 40 + i * 95, 420, 95, "happy", false, (c) => hop(c, 16, 3, 0.16 + i * 0.01)));
        [9, 10, 14, 11].forEach((pc, i) => sc.creature(pc, 590 + i * 95, 420, 95, "happy", false, (c) => hop(c, 16, 3, 0.17 + i * 0.01)));
        sc.pop("your move!", 500, 215, 46, "#c8452e", 3.0, -3);
        sc.pop("tới lượt bạn!", 500, 572, 30, "#3c4fb8", 3.4, 2);
      },
    },
  ];

  function story() {
    const box = $("intro"), skip = $("intro-skip");
    box.replaceChildren(skip);
    box.classList.add("is-on");
    G.set(box, { opacity: 1 });
    const svg = svgEl("svg", { viewBox: "0 0 1000 600", class: "st-svg", preserveAspectRatio: "xMidYMid meet" });
    box.append(svg);
    const rc = rough.svg(svg);
    let cancelled = false;

    // what one scene can put on the page; everything it adds is collected so it can be drawn in and rubbed out
    function makeScene(g) {
      const items = { inks: [], texts: [], crs: [] };
      return {
        items,
        write(text, x, y, size, parts, color = "#2b2f3a", vi = false) {
          const t = svgEl("text", { x, y, "text-anchor": "middle", class: `st-text${vi ? " st-vi" : ""}`, "font-size": size });
          if (parts) for (const [w, col] of parts) { const sp = svgEl("tspan", { fill: col, stroke: col }); sp.textContent = w; t.append(sp); }
          else { t.setAttribute("fill", color); t.setAttribute("stroke", color); t.textContent = text; }
          g.append(t);
          items.texts.push(t);
        },
        ink(make, act) { const el = make(rc); g.append(el); items.inks.push(el); if (act) (items.inkActs = items.inkActs || []).push([el, act]); return el; },
        // the sticky words that pop up during a scene (bubbles, sound effects): written later, not with the caption
        pop(text, x, y, size, color, at = 2.2, rot = 0) { const t = svgEl("text", { x, y, "text-anchor": "middle", class: "st-pop", "font-size": size, fill: color, transform: `rotate(${rot} ${x} ${y})` }); t.textContent = text; t.style.opacity = "0"; g.append(t); (items.pops = items.pops || []).push([t, at]); return t; },
        creature(p, x, y, w, face, flip, act) {
          const c = CR.make(p);
          // the creature's own svg sits at 0,0 at 120 units; a wrapper places and sizes it on the page
          c.svg.setAttribute("x", 0); c.svg.setAttribute("y", 0); c.svg.setAttribute("width", 120); c.svg.setAttribute("height", 120);
          const wrap = svgEl("g", { transform: `translate(${x} ${y}) scale(${w / 120})` });
          const inner = svgEl("g", flip ? { transform: "translate(120 0) scale(-1 1)" } : {});
          inner.append(c.svg); wrap.append(inner); g.append(wrap);
          c.svg.dataset.x = x + w / 2;
          c.wrap = wrap; c.at = [x, y, w];
          items.crs.push({ c, face, act });
        },
      };
    }

    const dashAll = (els) => els.flatMap((el) => [...(el.tagName === "path" ? [el] : el.querySelectorAll("path"))]).map((p) => {
      const L = p.getTotalLength ? p.getTotalLength() : 600;
      p.style.strokeDasharray = `${L} ${L}`;
      return [p, L];
    });
    const midX = (el) => { try { const b = el.getBBox(); return b.x + b.width / 2; } catch { return 500; } };

    function drawScene(sc, g, tl, at) {
      const { inks, texts, crs } = sc.items;
      // the caption is written first, the English line then the Vietnamese one
      tl.call(() => { sfx("scene"); sfx("pencil", 1.4, 0.8); }, null, at);
      tl.call(() => sfx("pencil", 1.4, 0.6), null, at + 0.7);
      texts.forEach((t, i) => {
        tl.fromTo(t, { strokeDashoffset: 2600, fillOpacity: 0 }, { strokeDashoffset: 0, duration: 1.3, ease: "power1.inOut" }, at + i * 0.35)
          .to(t, { fillOpacity: 1, duration: 0.5 }, at + i * 0.35 + 0.9);
      });
      // the pen draws every line from left to right across the page
      const dashed = dashAll(inks);
      dashed.forEach(([p, L]) => { p.style.strokeDashoffset = `${L}`; });
      inks.forEach((el) => { G.set(el, { opacity: 1 }); });
      dashed.forEach(([p, L]) => tl.to(p, { strokeDashoffset: 0, duration: Math.min(1.1, 0.3 + L / 900), ease: "power1.inOut" }, at + 0.6 + (midX(p) / 1000) * 0.9));
      crs.forEach(({ c, face, act }, i) => {
        const t0 = at + 1 + i * 0.22;
        tl.add(CR.drawIn(c, 0, 0.8), t0);
        tl.call(() => { if (!cancelled) sfx("appear", i + 1, i % 2); }, null, t0 + 0.75);
        tl.call(() => {
          if (cancelled) return;
          if (act) sfx("hop", i);
          const l = CR.live(c); storyLives.push(l);
          if (face) CR.setFace(c, face, c.spec.face.beak ? "open" : face === "happy" ? "grin" : face === "hurt" ? "grin" : "open");
          if (act) act(c);
        }, null, t0 + 0.9);
      });
      const drawn = at + Math.max(2.4, 1 + crs.length * 0.22 + 1, texts.length * 0.35 + 1.6);
      (sc.items.inkActs || []).forEach(([el, act], i) => tl.call(() => { if (!cancelled) { act(el); sfx("doodle", i); } }, null, drawn - 0.3));
      (sc.items.pops || []).forEach(([t, when]) => tl.call(() => sfx("pop"), null, at + when));
      (sc.items.pops || []).forEach(([t, when]) => tl.fromTo(t, { opacity: 0, scale: 0.2, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.35, ease: "back.out(3)" }, at + when));
      return drawn;
    }

    // a pink eraser sweeps across and the strokes it passes disappear
    const eraser = svgEl("g", { class: "st-eraser" });
    eraser.append(rc.rectangle(-30, -16, 60, 32, { stroke: "#a0505a", strokeWidth: 1.8, fill: "#f3a0b0", fillStyle: "solid", roughness: 1, seed: 90 }));
    eraser.append(rc.rectangle(10, -16, 20, 32, { stroke: "#2b3a78", strokeWidth: 1.8, fill: "#6f8fd8", fillStyle: "hachure", hachureGap: 3, roughness: 1, seed: 91 }));
    G.set(eraser, { opacity: 0 });
    function eraseScene(g, sc, tl, at, dur = 1.3) {
      const { inks, texts, crs } = sc.items;
      tl.call(() => sfx("erase", dur), null, at);
      tl.call(() => { svg.append(eraser); }, null, at)
        .set(eraser, { opacity: 1, x: -40, y: 160, rotation: -25 }, at)
        .to(eraser, { x: 1040, duration: dur, ease: "none" }, at)
        .to(eraser, { keyframes: [{ y: 460, duration: dur / 6 }, { y: 180, duration: dur / 6 }, { y: 480, duration: dur / 6 }, { y: 150, duration: dur / 6 }, { y: 470, duration: dur / 6 }, { y: 260, duration: dur / 6 }], ease: "sine.inOut" }, at)
        .to(eraser, { rotation: -10, duration: dur / 12, yoyo: true, repeat: 11 }, at)
        .set(eraser, { opacity: 0 }, at + dur);
      tl.call(() => {
        dashAll(inks).forEach(([p, L]) => {
          const d = (midX(p) / 1000) * dur;
          G.fromTo(p, { strokeDashoffset: 0 }, { strokeDashoffset: -L, duration: 0.3, delay: d, ease: "power1.in" });
          G.to(p, { opacity: 0, duration: 0.25, delay: d + 0.08 });
        });
        texts.forEach((t) => { const d = (midX(t) / 1000) * dur; G.to(t, { fillOpacity: 0, strokeDashoffset: -2600, duration: 0.45, delay: Math.max(0, d - 0.15), ease: "power1.in" }); });
        (sc.items.pops || []).forEach(([t]) => { const d = (midX(t) / 1000) * dur; G.to(t, { opacity: 0, duration: 0.3, delay: d }); });
        crs.forEach(({ c }) => { const d = (Number(c.svg.dataset.x) / 1000) * dur; G.to(c.svg, { opacity: 0, duration: 0.3, delay: d }); });
        // eraser crumbs
        for (let i = 0; i < 10; i++) {
          const cr = rc.circle(0, 0, 4, { stroke: "none", fill: "#e8a0ac", fillStyle: "solid", seed: 95 + i });
          svg.append(cr);
          const x = 80 + i * 90;
          G.timeline({ delay: (x / 1000) * dur, onComplete: () => cr.remove() }).set(cr, { x, y: 300 + R(-120, 120) }).to(cr, { y: "+=60", x: `+=${R(-20, 20)}`, opacity: 0, duration: 0.8, ease: "power1.in" });
        }
      }, null, at);
      tl.call(() => { storyLives.splice(0).forEach((l) => l.kill()); g.remove(); }, null, at + dur + 0.35);
      return at + dur + 0.45;
    }

    const tl = G.timeline();
    let at = 0.3;
    // a sound switch on the story page itself, since the story starts before anyone reaches the panel
    const sndBtn = document.createElement("button");
    sndBtn.type = "button";
    sndBtn.className = "cx-intro__sound";
    const paintSnd = () => { sndBtn.textContent = SND.on ? "sound: on" : "sound: off"; sndBtn.setAttribute("aria-pressed", String(SND.on)); };
    paintSnd();
    sndBtn.addEventListener("click", () => { SND.set(!SND.on); paintSnd(); const main = $("sound"); if (main) main.textContent = SND.on ? "sound: on" : "sound: off"; });
    box.append(sndBtn);
    SCENES.forEach((scene) => {
      const g = svgEl("g", { class: "st-scene" });
      svg.append(g);
      const sc = makeScene(g);
      if (scene.en) { sc.write(scene.en, 500, 70, scene.en.length > 70 ? 26 : 32, null, "#2b2f3a"); sc.write(scene.vi, 500, 112, scene.vi.length > 70 ? 23 : 27, null, "#5d6170", true); }
      scene.draw(sc);
      // the scene stays invisible until its turn
      G.set(g, { opacity: 0 });
      tl.set(g, { opacity: 1 }, at);
      const end = drawScene(sc, g, tl, at);
      at = eraseScene(g, sc, tl, end + 2.2 + (scene.hold || 0));
    });
    return new Promise((ok) => {
      const finish = () => {
        if (cancelled) return;
        cancelled = true;
        storyLives.splice(0).forEach((l) => l.kill());
        G.to(box, { opacity: 0, duration: 0.4, onComplete: () => { box.classList.remove("is-on"); box.replaceChildren(skip); G.set(box, { opacity: 1 }); } });
        ok();
      };
      // the music box plays softly under the whole story
      for (let t = 0.3, bar = 0; t < at - 1; t += 1.6, bar++) { const b = bar; tl.call(() => { if (!cancelled) sfx("musicbox", b); }, null, t); }
      tl.call(finish, null, at);
      skip.onclick = () => { tl.kill(); finish(); };
      skip.tabIndex = 0;
    });
  }
  const book = story;

  function intro() {
    let seen = false;
    try { seen = localStorage.getItem("chess-intro") === "1"; } catch { /* no storage: show it */ }
    if (!anim || seen || roomFromUrl()) return Promise.resolve();
    try { localStorage.setItem("chess-intro", "1"); } catch { /* fine */ }
    return book();
  }

  function start() {
    if (!window.rough) { statusEl.textContent = "The pencil (rough.js) did not load, so the board cannot be drawn. Try reloading."; return; }
    setBoardTransform();
    drawDeco();
    newGame(true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => relayout());
    const code = roomFromUrl();
    if (code) enterRoom(code);
  }
  // the board is set up once the opening line has been written and the page lifts
  intro().then(start);
})();
