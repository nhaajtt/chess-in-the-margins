/* Chess in the margins, part 7 of 10: the buttons and choices, and playing a friend online. */
"use strict";

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
  if (mode === "puzzle" && puzKind === "rush") { if (!rush.next) rushStart(); rush.next = false; } else rushStop();
  if (mode === "puzzle") { puz = pickPuzzle(); puzStep = 0; puzMisses = 0; if (puz) { game = new Game(puz.fen); human = game.turn; } }
  if (scene && (mode === "cpu" || mode === "friend")) {
    if (scene.fen) { try { game = new Game(scene.fen); } catch { game = new Game(); } }
    if (mode === "cpu" && scene.human != null) human = scene.human;
    if (mode === "friend" && scene.fen) flipped = game.turn === 1;
  }
  startFen = game.fen();
  flipped = mode === "cpu" || mode === "online" || mode === "puzzle" ? human === 1 : flipped;
  spinNow = 0;
  setBoardTransform();
  $("tray-0").replaceChildren(); $("tray-1").replaceChildren();
  $("resign").disabled = false;
  // a game brought in from outside comes with its moves: they are put on the board at once, and only the first time
  if (scene && scene.moves && (mode === "cpu" || mode === "friend")) {
    for (const san of scene.moves) { const mv = game.moves().find((x) => game.san(x) === san); if (!mv) break; game.play(mv); }
    scene.moves = null;
    if (game.played.length) { lastMove = game.played[game.played.length - 1].move; rebuildTrays(); firstCapture = false; }
    const st0 = game.status();
    if (st0.over) { over = st0; $("resign").disabled = true; }
  }
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
  if (over) statusEl.textContent = "This game is already finished. Look back at it, or start a new one.";
  freshGame(ready);
  $("card").hidden = true;
  // only for this game: a newer one has its own start
  const mine = game;
  if (mode === "cpu" && game.turn !== human) setTimeout(() => { if (game === mine) computer(); }, ready * 1000);
  else if (mode === "cpu" && level === "teach") setTimeout(() => { if (game === mine) coach(); }, (ready + 0.6) * 1000);
  tell("new", { mode, level, human, fen: startFen, tag: scene ? scene.tag || null : null });
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
  mode = i.value; scene = null;
  $("cpu-opts").disabled = mode !== "cpu";
  paintPuzzleOpts();
  showOnline();
  if (mode === "online") { onlineMsg(""); if (!busy) { human = 0; newGame(); } return; }
  if (!busy) newGame();
}));
const paintPuzzleOpts = () => { const po = $("puzzle-opts"); if (po) po.hidden = mode !== "puzzle"; };
document.querySelectorAll('input[name="pkind"]').forEach((i) => i.addEventListener("change", () => { puzKind = i.value; puzExtra = 0; if (mode === "puzzle" && !busy) newGame(); }));
document.querySelectorAll('input[name="level"]').forEach((i) => i.addEventListener("change", () => { level = i.value; }));
if ($("clock-inc")) $("clock-inc").addEventListener("change", (e) => { bonus = e.target.checked ? 2 : 0; });
$("play-purple").addEventListener("change", () => { if (!busy) newGame(); });
document.querySelectorAll('input[name="clock"]').forEach((i) => i.addEventListener("change", () => { minutes = Number(i.value); if (!busy) newGame(); }));

let resizeTimer = 0;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (!busy) { tiltNow = cssTilt(); setBoardTransform(); } relayout(); drawDeco(); bakePieces(); }, 120); });


/* ---------- playing a friend online ----------
   A room lives on a small Cloudflare service. It keeps the real game and checks every move with this same
   engine; this page sends moves, emotes and offers, and plays back whatever the room says happened. */

const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "http://localhost:8787" : "https://chess-rooms.chess-rooms.workers.dev";
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
// one message that goes wrong must not stop the ones after it
const report = (e) => { console.error(e); };
const net = { ws: null, code: null, ready: false, pending: false, players: [], spectators: 0, tries: 0, closing: false, timer: 0, queue: Promise.resolve(), offline: new Set() };
// a copy in memory as well, so a browser that blocks storage still keeps its seat for as long as the page is open
const kept = new Map();
const store = { get: (k) => { try { const v = localStorage.getItem(k); if (v !== null) return v; } catch { /* private window */ } return kept.has(k) ? kept.get(k) : null; }, set: (k, v) => { kept.set(k, v); try { localStorage.setItem(k, v); } catch { /* private window */ } } };
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
  else { const picked = document.querySelector("input[name=clock]:checked"); if (picked) minutes = Number(picked.value); }
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
// play someone now: the rooms service pairs two visitors who are both waiting
if ($("room-match")) $("room-match").addEventListener("click", async () => {
  if (!window.Matchmaker) { onlineMsg("Finding a stranger is not available right now."); return; }
  onlineMsg("Looking for someone to play…");
  try {
    const { code, waiting } = await window.Matchmaker.find({});
    enterRoom(code);
    if (waiting) onlineMsg("Nobody is waiting yet. Stay here and the next visitor joins you.");
  } catch (err) { onlineMsg((err && err.message) || "The rooms service did not answer. Try again in a moment."); }
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
  if (net.ws) { net.ws.onmessage = null; try { net.ws.close(1000, "left"); } catch { /* gone */ } }
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
  // one line to the room at a time: an older one is hung up first and no longer listened to
  const old = net.ws;
  if (old) { old.onmessage = null; old.onclose = null; try { old.close(1000, "again"); } catch { /* gone */ } }
  clearTimeout(net.timer);
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
    if ((human === 1) !== flipped || was !== human) net.queue = net.queue.catch(report).then(() => { flipped = human === 1; drawBoard(); buildSquares(); relayout(); drawMarks(); statusLine(game.status()); });
    return;
  }
  if (msg.t === "state") { net.queue = net.queue.catch(report).then(() => applyState(msg)); return; }
  if (msg.t === "move") {
    net.queue = net.queue.catch(report).then(async () => {
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
  if (!over) statusLine(game.status());
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
  if (!SAY[e]) return;
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
