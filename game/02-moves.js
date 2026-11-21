/* Chess in the margins, part 2 of 10: the squares the player presses, how each kind travels, and how each kind captures. */
"use strict";

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
  if (options.length > 1) {
    const asked = game;
    m = await askPromotion(options);
    // the game can end or be replaced while the question is open
    if (!m || over || game !== asked || !game.moves().some((x) => x.from === m.from && x.to === m.to && (x.promo || 0) === (m.promo || 0))) return;
  }
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
  warnAfter(m);
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
    if (victim) { G.killTweensOf([victim, victim.__act]); sleep(victim); victim.remove(); job.addToTray(); }
    if (m.promo && !job.grown) growNow(mover, m);
    paintWorry();
  };
  let prev = motion;
  motion = job;
  motions.push(job);

  job.shown = afterMove(m, san);
  const act = async () => {
    // the move before is let go of once it is over, or every move ever made would be kept, creatures and all
    if (prev) { await prev.promise; prev = null; }
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
  };
  // a step that goes wrong must not hold up every move after it: the move is put where it ends
  job.promise = act().catch((e) => {
    console.error(e);
    try { job.finishNow(); } catch (e2) { console.error(e2); }
    if (motions.includes(job)) motions.splice(motions.indexOf(job), 1);
  });
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
  CR.unbake(el.__c);
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
  if (!anim) { const fresh = CR.make(m.promo); el.__c.svg.replaceWith(fresh.svg); dressUp(fresh); el.__c = fresh; el.__p = m.promo; el.dataset.key = key(m.promo); return; }
  burst(s.x, s.y - s.w * 0.5, 10);
  const track = job ? job.track : play;
  await track(G.timeline()
    .to(el.__act, { rotation: 720, scale: 0.2, duration: 0.6, ease: "power2.in" })
    .call(() => {
      const fresh = makeEl(m.promo);
      fresh.remove();
      CR.unbake(el.__c);
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
