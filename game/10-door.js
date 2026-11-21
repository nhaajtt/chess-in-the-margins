/* Chess in the margins, part 10 of 10: window.Margins, the door for the other files, and the start. */
"use strict";

/* ---------- a door for the other files (the look back, the adventure, the lessons): they listen and ask, the board stays here ---------- */
window.Margins = {
  on(type, fn) { if (!heard.has(type)) heard.set(type, new Set()); heard.get(type).add(fn); return () => heard.get(type).delete(fn); },
  get mode() { return mode; }, get level() { return level; }, get human() { return human; }, get busy() { return busy; },
  get over() { return over; }, get startFen() { return startFen; }, get tag() { return scene ? scene.tag || null : null; },
  fen: () => game.fen(),
  // every move so far, as plain data: squares (0x88), the piece codes and the written move
  played: () => game.played.map(({ move, san }) => ({ from: move.from, to: move.to, promo: move.promo || 0, piece: move.piece, captured: move.captured || 0, san })),
  // start a set-up game: { fen, moves (written moves played at once from fen), mode: "cpu" | "friend", level, human: 0 | 1, style, tag }. Answers false while the board is busy.
  load(opts = {}) {
    if (busy) return false;
    const want = opts.mode === "friend" ? "friend" : "cpu";
    if (mode === "online") leaveRoom(false);
    mode = want;
    const r = document.querySelector(`input[name="mode"][value="${want}"]`); if (r) r.checked = true;
    $("cpu-opts").disabled = mode !== "cpu";
    paintPuzzleOpts();
    showOnline();
    if (opts.level && ["easy", "normal", "hard", "teach", "master"].includes(opts.level)) {
      level = opts.level;
      const l = document.querySelector(`input[name="level"][value="${level}"]`); if (l) l.checked = true;
    }
    scene = { moves: Array.isArray(opts.moves) && opts.moves.length ? opts.moves.map(String) : null, fen: opts.fen || null, human: opts.human == null ? null : opts.human ? 1 : 0, style: opts.style || null, tag: opts.tag || null };
    newGame();
    return true;
  },
  // back to an ordinary game
  leave() { if (busy || !scene) return false; scene = null; newGame(); return true; },
  setThinker(fn) { thinker = typeof fn === "function" ? fn : null; },
  note: (text) => note(String(text)),
  status: (text) => { statusEl.textContent = String(text); },
  mini: (p) => mini(p),
  award: (id) => award(id),
  enterRoom: (code) => enterRoom(code),
  store,
  reduce,
};

// the buttons for what lives in the other files
for (const [id, thing, act] of [["adventure-btn", "Adventure", "open"], ["school-btn", "School", "open"], ["look-back-btn", "Review", "open"], ["pgn-btn", "Pgn", "openDialog"]]) {
  const b = $(id);
  if (b) b.addEventListener("click", () => { if (window[thing]) window[thing][act](); });
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
