/* Chess in the margins, part 6 of 10: the creatures' own little ways. */
"use strict";

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
    const b = CR.box(c, c.root);
    if (b && (b.width || b.height)) top = b.y;
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
  if (!m) return;
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
  // safe-anything:ignore fixed markup; the date is escaped
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
  // both are measured before either moves, so the page lays itself out once
  const at = (target) => (target ? target.getBoundingClientRect() : null);
  const put = (h, r) => {
    if (!r) { h.hidden = true; return; }
    h.hidden = false;
    Object.assign(h.style, { left: `${r.left - box.left}px`, top: `${r.top - box.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  };
  const cloud = dragging ? null : at(deco.querySelector(".d-cloud")), moon = at(deco.querySelector(".d-moon"));
  if (!dragging) put(cloudHandle, cloud);
  put(moonHandle, moon);
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
