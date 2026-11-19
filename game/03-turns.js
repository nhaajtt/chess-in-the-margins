/* Chess in the margins, part 3 of 10: what happens after each move, the computer's turn, the clock. */
"use strict";

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
  else {
    // a couple of seconds back for the move just made, if that was asked for
    if (minutes && bonus && timer) { left[turn ^ 1] += bonus * 1000; writeClock(turn ^ 1); }
    clockSwitch(); statusLine(st, m);
  }
  tell("move", { move: m, san, ply: game.played.length, fen: game.fen(), check: Boolean(st.check), mode });
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
  writeDiary(st);
  tell("end", { result: st.result, reason: st.reason, mode, level, human, tag: scene ? scene.tag || null : null, plies: game.played.length });
}

/* ---------- the computer ---------- */

// the computer's move: another file may do the thinking (off the page's own thread), and a set-up game may ask for a style
async function thinkNow(g, lv) {
  const style = scene && scene.style ? scene.style : null;
  if (thinker) {
    try {
      const r = await thinker(g.fen(), lv, style);
      const mv = r && g.moves().find((x) => x.from === r.from && x.to === r.to && (x.promo || 0) === (r.promo || 0));
      if (mv) return mv;
    } catch (err) { console.error(err); }
  }
  return think(g, lv, style ? { style } : undefined);
}
async function computer() {
  const mine = game;
  busy = true;
  try { await computerMove(mine); } catch (e) {
    console.error(e);
    if (game === mine) busy = false;
  }
}
async function computerMove(mine) {
  if (motion && motion.promise) await motion.promise;
  // a new game may have begun while this one was waiting
  if (game !== mine) return;
  statusLine(game.status());
  await wait(anim ? 650 : 50);
  const t = performance.now();
  const m = mercyMove(await thinkNow(game, level === "teach" ? "easy" : level));
  // never answer instantly; a creature needs a moment
  await wait(Math.max(0, 350 - (performance.now() - t)));
  if (game !== mine) return;
  busy = false;
  if (m && !over) await playMove(m);
  if (level === "teach" && !over) { if (motion && motion.promise) await motion.promise; coach(); }
}

/* ---------- clock: each second the old number is crossed out and the new one written ---------- */

let bonus = 0;
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
