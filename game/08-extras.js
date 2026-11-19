/* Chess in the margins, part 8 of 10: sound, the slingshot, puzzles, stickers, the coach, the diary. */
"use strict";

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



/* ---------- puzzles: one of each kind every day, and a three-minute rush (puzzles.js, from the Lichess puzzle database) ---------- */
const PUZZLES = window.CHESS_PUZZLES || [];
const PUZ_WHAT = { mate1: "mate in one", mate2: "mate in two", mate3: "mate in three", win: "win a piece in two moves" };
const kindOf = (p) => p.kind || "mate2";
const dayNo = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
let puz = null, puzStep = 0, puzMisses = 0, puzExtra = 0, puzKind = "mate2";
// the rush: as many as you can in three minutes, three wrong moves and it is over
const rush = { on: false, next: false, score: 0, lives: 3, endAt: 0, timer: 0, seen: new Set() };
const uciOf = (m) => name(m.from) + name(m.to) + (m.promo ? "nbrq"[[2, 3, 4, 5].indexOf(m.promo & 7)] : "");
const fromUci = (g, u) => g.moves().find((m) => uciOf(m) === u);
function pickPuzzle() {
  if (puzKind === "rush") {
    // easy ones first, harder as the count climbs; never the same one twice in a rush
    const want = rush.score < 4 ? "mate1" : rush.score < 10 ? "mate2" : pick(["mate2", "mate3", "win"]);
    let pool = PUZZLES.filter((p) => kindOf(p) === want && !rush.seen.has(p.id));
    if (!pool.length) pool = PUZZLES.filter((p) => !rush.seen.has(p.id));
    if (!pool.length) { rush.seen.clear(); pool = PUZZLES; }
    const p = pool.length ? pool[Math.floor(Math.random() * Math.min(pool.length, 30))] : null;
    if (p) rush.seen.add(p.id);
    return p;
  }
  const pool = PUZZLES.filter((p) => kindOf(p) === puzKind);
  return pool.length ? pool[(((dayNo() + puzExtra) % pool.length) + pool.length) % pool.length] : null;
}
// with the other side to move: whatever they answer, is there still a mate within n of our moves? (other mates count too)
function forcedMate(g, n, budget = { left: 60000 }) {
  const replies = g.moves();
  if (!replies.length) return g.inCheck();
  if (n <= 0) return false;
  return replies.every((r) => {
    g.make(r);
    const ok = g.moves().some((x) => {
      if (--budget.left < 0) return false;
      g.make(x);
      const yes = (g.inCheck() && !g.moves().length) || (n > 1 && forcedMate(g, n - 1, budget));
      g.unmake(x);
      return yes;
    });
    g.unmake(r);
    return ok;
  });
}
function puzzleIntro() {
  if (!puz) { statusEl.textContent = "No puzzle of that kind today, sorry."; return; }
  const what = PUZ_WHAT[kindOf(puz)];
  if (rush.on) { statusEl.textContent = `Rush puzzle ${rush.score + 1}: the ${TEAM[human]} team to move, ${what}.`; return; }
  statusEl.textContent = `The ${TEAM[human]} team to move: ${what}. (A puzzle from lichess.org; New game gives you another one.)`;
  note(kindOf(puz) === "win"
    ? pick(["somebody is standing in the wrong place. find them", "two moves and one of them goes in your pocket", "today's puzzle! no peeking at the whale"])
    : pick([`find the ${what}. the creatures are holding their breath`, "checkmate is in here somewhere. the owl believes in you", "today's puzzle! no peeking at the whale"]));
}
async function puzzleAnswer(m) {
  if (!puz) return;
  const mine = game;
  busy = true;
  if (motion && motion.promise) await motion.promise;
  await wait(anim ? 450 : 30);
  // another puzzle may have taken this one's place
  if (game !== mine) return;
  busy = false;
  if (game.status().reason === "checkmate") return;
  const line = puz.line, last = puzStep >= line.length - 1, onLine = uciOf(m) === line[puzStep];
  const mates = kindOf(puz) !== "win";
  if (mates && last) { await puzzleWrong(true); return; }
  if (!onLine && !(mates && forcedMate(game, (line.length - 1 - puzStep) / 2))) { await puzzleWrong(); return; }
  if (last) { over = { over: true, result: human ? "0-1" : "1-0", reason: "puzzle" }; sfx("win"); puzzleSolved(); return; }
  busy = true;
  await wait(anim ? 350 : 30);
  if (game !== mine) return;
  busy = false;
  const reply = (onLine && fromUci(game, line[puzStep + 1])) || game.moves()[0];
  puzStep += 2;
  if (reply) await playMove(reply);
  if (motion && motion.promise) await motion.promise;
  if (game !== mine) return;
  const togo = (line.length - 1 - puzStep) / 2 + 1;
  statusEl.textContent = !mates ? "Good! Now take what is yours." : togo === 1 ? "Good! Now the mate, in one move." : `Good! Mate in ${togo} moves from here.`;
  note(pick(["ooh. they did not see that coming", "keep going. make it count", "the creatures are on the edge of their squares"]));
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
  if (rush.on) {
    rush.lives--;
    paintRush();
    if (rush.lives <= 0) rushEnd(); else { statusEl.textContent = "Not that one. On to the next."; rushNext(); }
    return;
  }
  // after two misses, the creature that should move gives itself away
  if (puzMisses >= 2 && anim) {
    const m = fromUci(game, puz.line[puzStep]);
    if (m && els.get(m.from)) { quip(m.from, pick(["psst. me!", "pick me!", "I have an idea"]), 1.8); G.fromTo(els.get(m.from).__act, { y: 0 }, { y: -18, duration: 0.18, yoyo: true, repeat: 3 }); }
  }
}
function puzzleSolved() {
  if (rush.on) {
    rush.score++;
    paintRush();
    statusEl.textContent = `${pick(["Yes!", "Got it!", "Solved!"])} The next one is coming.`;
    rushNext();
    return;
  }
  let solved = [];
  try { solved = JSON.parse(store.get("chess-puzzles-solved") || "[]"); } catch { /* start again */ }
  if (!Array.isArray(solved)) solved = [];
  if (!solved.includes(puz.id)) solved.push(puz.id);
  store.set("chess-puzzles-solved", JSON.stringify(solved));
  const tries = puzMisses ? ` (after ${puzMisses} ${puzMisses === 1 ? "try" : "tries"})` : ", first time";
  statusEl.textContent = `Solved! ${cap(PUZ_WHAT[kindOf(puz)])}${tries}. New game gives you another puzzle.`;
  award("puzzle");
  if (solved.length >= 3) award("puzzle3");
}
function paintRush(done) {
  const el = $("rush");
  if (!el) return;
  el.hidden = false;
  el.textContent = done ? `rush over: ${rush.score} solved` : `${fmt(rush.endAt - Date.now())} left, ${rush.score} solved, ${"♥".repeat(Math.max(0, rush.lives))}`;
}
function rushStart() {
  clearInterval(rush.timer);
  rush.on = true; rush.score = 0; rush.lives = 3; rush.seen.clear();
  rush.endAt = Date.now() + 180000;
  rush.timer = setInterval(() => { if (Date.now() >= rush.endAt) rushEnd(); else paintRush(); }, 500);
  paintRush();
}
function rushStop() {
  clearInterval(rush.timer);
  rush.timer = 0; rush.on = false; rush.next = false;
  const el = $("rush");
  if (el) el.hidden = true;
}
function rushNext() {
  const mine = game;
  const go = () => {
    if (mode !== "puzzle" || puzKind !== "rush" || !rush.on || game !== mine) return;
    if (busy) { setTimeout(go, 200); return; }
    rush.next = true;
    newGame();
  };
  setTimeout(go, anim ? 1300 : 300);
}
function rushEnd() {
  const n = rush.score;
  clearInterval(rush.timer);
  rush.timer = 0; rush.on = false;
  over = { over: true, result: "*", reason: "rush" };
  deselect();
  const before = Number(store.get("chess-rush-best") || 0);
  if (n > before) store.set("chess-rush-best", String(n));
  const best = n > before && n ? ", your best yet" : before ? ` (your best is ${before})` : "";
  statusEl.textContent = `${rush.lives <= 0 ? "Three wrong moves" : "Time"}! You solved ${n} ${n === 1 ? "puzzle" : "puzzles"}${best}. New game starts another rush.`;
  note(n >= 8 ? "the owl has never seen a pencil move that fast" : n ? "not bad at all. the creatures are out of breath" : "the creatures say: one more go?");
  paintRush(true);
  sfx(n ? "win" : "draw");
  if (n >= 5) award("rush");
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
  { id: "rush", piece: 10, name: "In a rush", how: "Solve five puzzles in one rush." },
];
let stickers = {};
try { stickers = JSON.parse(store.get("chess-stickers") || "{}") || {}; } catch { stickers = {}; }
if (typeof stickers !== "object" || Array.isArray(stickers)) stickers = {};
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


/* ---------- "teach me": the computer plays gently, and a creature suggests a move and says why ---------- */
const sqName = (sq) => name(sq);
const creatureOf = (p) => CREATURE[p & 7][colorOf(p)];
function whyMove(m) {
  game.make(m);
  const check = game.inCheck(), mate = check && !game.moves().length;
  game.unmake(m);
  if (mate) return "it's checkmate!";
  const why = [];
  if (m.captured) why.push(`it takes their ${creatureOf(m.captured)} (a ${KIND[m.captured & 7]})`);
  if (m.promo) why.push("the pawn grows into a queen");
  if (check) why.push("it puts their king in check");
  if (m.flags & (E.F_KCASTLE | E.F_QCASTLE)) why.push("castling tucks your king away safe and wakes up a rook");
  if (!why.length && game.attackers(m.from, human ^ 1).length) why.push(`your ${creatureOf(m.piece)} was in danger on ${sqName(m.from)}, and this gets it out of trouble`);
  const kind = m.piece & 7, back = human ? 7 : 0;
  if ((kind === 2 || kind === 3) && (m.from >> 4) === back) why.push("it brings a sleepy piece out to join the game");
  if (kind === 1 && [0x33, 0x34, 0x43, 0x44].includes(m.to)) why.push("a pawn in the middle claims the centre of the board");
  if (!why.length) why.push("it makes your position a little stronger");
  return why.slice(0, 2).join(", and ");
}
function coach() {
  if (mode !== "cpu" || level !== "teach" || over || game.turn !== human) return;
  const best = think(game, "normal");
  if (!best) return;
  statusEl.textContent = `Tip: try the ${creatureOf(best.piece)} from ${sqName(best.from)} to ${sqName(best.to)}: ${whyMove(best)}. (Any move is fine; it's only a tip.)`;
  if (anim && els.get(best.from)) { quip(best.from, pick(["psst. me!", "try me!", "I have an idea"]), 1.8); G.fromTo(els.get(best.from).__act, { y: 0 }, { y: -14, duration: 0.18, yoyo: true, repeat: 3 }); }
}
// after your move: a gentle warning if what just moved can now be taken for free
function warnAfter(m) {
  if (mode !== "cpu" || level !== "teach" || over) return;
  const piece = m.promo || m.piece;
  if ((piece & 7) === 1 || (piece & 7) === 6) return;
  if (game.attackers(m.to, human ^ 1).length && !game.attackers(m.to, human).length) note(`careful: your ${creatureOf(piece)} on ${sqName(m.to)} can be taken, and nobody is guarding it`);
}

/* ---------- the diary: after each game the creatures write down what happened ---------- */
const DIARY_KEY = "chess-diaries";
const teamName = (side) => TEAM[side];
function writeDiary(st) {
  if (mode === "puzzle") return;
  const lines = [], played = game.played;
  const moveNo = (i) => Math.floor(i / 2) + 1;
  const who2 = (p) => `the ${creatureOf(p)}`;
  const against = mode === "cpu" ? `against the computer (${level === "teach" ? "teach me" : level})` : mode === "online" ? "against a friend, online" : "between two friends on one screen";
  if (played[0]) lines.push(`The ${teamName(colorOf(played[0].move.piece))} team began: ${who2(played[0].move.piece)} opened with ${played[0].san}.`);
  const caps = played.map((x, i) => ({ ...x, i })).filter((x) => x.move.captured);
  if (caps[0]) lines.push(`The first to fall was ${who2(caps[0].move.captured)}, taken by ${who2(caps[0].move.piece)} on ${sqName(caps[0].move.to)} (move ${moveNo(caps[0].i)}).`);
  const big = caps.slice().sort((a, b) => VALUE[b.move.captured & 7] - VALUE[a.move.captured & 7])[0];
  if (big && big !== caps[0] && VALUE[big.move.captured & 7] >= 500) lines.push(`The biggest loss: the ${teamName(colorOf(big.move.captured))} team's ${creatureOf(big.move.captured)}, on move ${moveNo(big.i)}.`);
  played.forEach((x, i) => { if (x.move.flags & (E.F_KCASTLE | E.F_QCASTLE)) lines.push(`The ${teamName(colorOf(x.move.piece))} king castled on move ${moveNo(i)} and felt much safer.`); });
  played.forEach((x, i) => { if (x.move.promo) lines.push(`On move ${moveNo(i)} ${who2(x.move.piece)} reached the far side and grew into ${who2(x.move.promo)}.`); });
  for (const side of [0, 1]) {
    const checks = played.filter((x) => colorOf(x.move.piece) === side && /[+#]/.test(x.san)).length;
    if (checks >= 2) lines.push(`The ${teamName(side)} team gave check ${checks} times.`);
  }
  const last = played[played.length - 1];
  if (st.reason === "checkmate" && last) lines.push(`On move ${moveNo(played.length - 1)}, ${who2(last.move.promo || last.move.piece)} on ${sqName(last.move.to)} checkmated the ${teamName(colorOf(last.move.piece) ^ 1)} king. The ${teamName(colorOf(last.move.piece))} team wins!`);
  else if (st.reason === "resigned") lines.push(`The ${teamName(st.result === "1-0" ? 1 : 0)} team resigned. A white flag went up.`);
  else if (st.reason === "time") lines.push(`The ${teamName(st.result === "1-0" ? 1 : 0)} team ran out of time.`);
  else lines.push(`It ended in a draw (${st.reason}). Everyone had tea.`);
  const n = Math.ceil(played.length / 2);
  lines.push(`In all: ${n} move${n === 1 ? "" : "s"}, and ${caps.length} creature${caps.length === 1 ? "" : "s"} went to the tray.`);
  const entry = { at: new Date().toISOString(), title: `A game ${against}`, lines, by: pick(["the owl", "the penguin", "the bee queen", "the wizard", "the acorn"]) };
  let all = [];
  try { all = JSON.parse(store.get(DIARY_KEY) || "[]"); } catch { all = []; }
  if (!Array.isArray(all)) all = [];
  all.unshift(entry);
  store.set(DIARY_KEY, JSON.stringify(all.slice(0, 12)));
  const btn = $("diary");
  if (btn) { btn.hidden = false; if (anim) G.fromTo(btn, { rotation: -6, scale: 1.15 }, { rotation: 0, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.4)" }); }
  G && G.delayedCall(4, () => note(`${entry.by} wrote this game down in the diary`));
}
function openDiary(start = 0) {
  let all = [];
  try { all = JSON.parse(store.get(DIARY_KEY) || "[]"); } catch { all = []; }
  if (!Array.isArray(all)) all = [];
  if (!all.length) return;
  let i = Math.max(0, Math.min(start, all.length - 1));
  let d = $("diary-book");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "diary-book";
    d.className = "cx-book cx-diary";
    d.setAttribute("aria-labelledby", "diary-title");
    document.body.append(d);
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  }
  const paint = () => {
    const e = all[i];
    const day = new Date(e.at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    d.innerHTML = `<p class="cx-diary__date"></p><h2 id="diary-title"></h2><ol class="cx-diary__lines"></ol><p class="cx-diary__by"></p>
        <p class="cx-diary__nav"><button class="cx-btn" type="button" data-go="1">older page</button><button class="cx-btn" type="button" data-go="-1">newer page</button><button class="cx-btn cx-btn--solid" type="button" data-close>Close</button></p>`;
    d.querySelector(".cx-diary__date").textContent = `${day} · page ${all.length - i} of ${all.length}`;
    d.querySelector("h2").textContent = e.title;
    d.querySelector("ol").append(...e.lines.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    d.querySelector(".cx-diary__by").textContent = `written in the margins by ${e.by}`;
    d.querySelector('[data-go="1"]').disabled = i >= all.length - 1;
    d.querySelector('[data-go="-1"]').disabled = i <= 0;
    d.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { i += Number(b.dataset.go); paint(); sfx("page"); }));
    d.querySelector("[data-close]").addEventListener("click", () => d.close());
  };
  paint();
  d.showModal();
  sfx("page");
}
if ($("diary")) {
  $("diary").addEventListener("click", () => openDiary(0));
  try { if (JSON.parse(store.get(DIARY_KEY) || "[]").length) $("diary").hidden = false; } catch { /* nothing yet */ }
}
