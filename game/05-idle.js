/* Chess in the margins, part 5 of 10: what the creatures do while nobody moves, and the running jokes. */
"use strict";

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
  if (askedName && Object.prototype.hasOwnProperty.call(SPECIAL, askedName)) { askedDone = true; if (SPECIAL[askedName]()) return; }
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
