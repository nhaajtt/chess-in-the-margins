/* "Look back at the game": steps through the finished (or running) game on a small flat board, looks at every
   position in the background, and marks the moves the way a teacher marks homework in red pen.
   Review.open() opens the dialog. */
(function (root) {
  "use strict";

  const E = root.ChessEngine;
  const MATE = 100000;
  const BIG = 90000;            // a score this large means a checkmate is coming
  const MISTAKE = 150, BLUNDER = 350, TICK_NOISE = 25;
  const THINK_MS = 180;

  const CREATURE = [null, ["mushroom", "blob"], ["pony", "zebra"], ["acorn", "wizard"], ["castle", "puffball"], ["bee queen", "crested bird"], ["owl", "penguin"]];
  const TEAM = ["orange", "purple"];
  const sqName = (sq) => "abcdefgh"[sq & 7] + ((sq >> 4) + 1);
  const who = (p) => `the ${CREATURE[p & 7][p & 8 ? 1 : 0]}`;
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  const sameMove = (m, o) => Boolean(m && o) && m.from === o.from && m.to === o.to && (m.promo & 7) === ((o.promo || 0) & 7);

  /* ---------- looking at one position ---------- */

  // a small search of my own, for when the engine has no analyse yet: two plies, done in small chunks so the page keeps moving
  function fallback(fen) {
    return new Promise((resolve) => {
      const g = new E.Game(fen);
      const mine = g.moves();
      let i = 0, best = null, bestScore = -Infinity;
      const step = () => {
        const until = Date.now() + 12;
        while (i < mine.length && Date.now() < until) {
          const m = mine[i++];
          g.make(m);
          const replies = g.moves();
          let worst = Infinity;
          if (!replies.length) worst = g.inCheck() ? MATE : 0;
          else for (const r of replies) { g.make(r); const v = g.evaluate(); g.unmake(r); if (v < worst) worst = v; }
          g.unmake(m);
          if (worst > bestScore) { bestScore = worst; best = m; }
        }
        if (i < mine.length) setTimeout(step, 0);
        else resolve({ move: best ? { from: best.from, to: best.to, promo: best.promo || 0 } : null, score: bestScore, depth: 2 });
      };
      step();
    });
  }

  function analyse(fen) {
    const T = root.Thinker;
    const viaEngine = () => (E.analyse
      ? new Promise((res) => setTimeout(() => res(E.analyse(new E.Game(fen), { ms: THINK_MS })), 0))
      : fallback(fen));
    if (T && T.analyse) return Promise.resolve(T.analyse(fen, { ms: THINK_MS })).catch(viaEngine);
    return viaEngine();
  }

  /* ---------- the review itself: what happened at each move ---------- */

  // the plain data: positions, moves, and (once looked at) scores and marks
  function describe(startFen, played) {
    const g = new E.Game(startFen || E.START);
    const fens = [g.fen()], turns = [g.turn];
    const moves = [];
    for (const p of played) {
      const m = g.moves().find((x) => x.from === p.from && x.to === p.to && (x.promo & 7) === ((p.promo || 0) & 7));
      if (!m) break;
      moves.push({ from: m.from, to: m.to, promo: m.promo || 0, piece: m.piece, captured: m.captured || 0, san: g.san(m), legal: g.moves().length, by: g.turn });
      g.make(m);
      fens.push(g.fen()); turns.push(g.turn);
    }
    const st = g.status();
    return { fens, turns, moves, end: st.over ? st : null };
  }

  // the score for each position, from the point of view of the side to move there
  function endScore(g) { const st = g.status(); return st.reason === "checkmate" ? -MATE : 0; }

  // decide the mark for move i from the scores before and after it
  function judge(data, i) {
    const a = data.look[i], b = data.look[i + 1], mv = data.moves[i];
    if (!a || !b || mv.legal < 2) return null;
    const after = -b.score;
    const best = sameMove(a.move, mv);
    let loss, mate = null;
    if (a.score >= BIG && after < BIG) { loss = MATE; mate = "missed"; }
    else if (after <= -BIG && a.score > -BIG) { loss = MATE; mate = "allowed"; }
    else loss = Math.max(0, clamp(a.score, 1500) - clamp(after, 1500));
    if (best) loss = 0;
    if (loss >= BLUNDER) return { sym: "??", label: "blunder", loss, mate };
    if (loss >= MISTAKE) return { sym: "?", label: "mistake", loss, mate };
    if (best || loss <= TICK_NOISE) {
      const prev = data.marks[i - 1];
      const punished = best && prev && (prev.sym === "?" || prev.sym === "??") && a.score >= MISTAKE;
      const mated = best && i === data.moves.length - 1 && data.end && data.end.reason === "checkmate";
      if (punished || mated) return { sym: "!", label: "strong move", loss: 0 };
      return { sym: "✓", label: best ? "best move" : "good move", loss: 0 };
    }
    return null;
  }

  // one short, plain sentence for a mistake or a blunder
  function explain(data, i, mark) {
    const mv = data.moves[i], a = data.look[i];
    const g = new E.Game(data.fens[i]);
    const legal = g.moves();
    const bm = a.move && legal.find((x) => sameMove(a.move, x));
    if (!bm) return "";
    const bestSan = g.san(bm, legal);
    const me = who(bm.piece);
    if (mark.mate === "missed") return `there was checkmate: ${bestSan}!`;
    if (mark.mate === "allowed") return `this lets the other team checkmate. ${bestSan} was safer.`;
    if (bm.captured) {
      g.make(bm);
      const free = g.attackers(bm.to, bm.piece & 8 ? 0 : 1).length === 0;
      g.unmake(bm);
      return `${me} could have taken ${who(bm.captured)} on ${sqName(bm.to)}${free ? " for free" : ""} (${bestSan}).`;
    }
    // does the move played leave a creature to be taken?
    const reply = data.look[i + 1] && data.look[i + 1].move;
    if (reply) {
      const h = new E.Game(data.fens[i + 1]);
      const r = h.moves().find((x) => sameMove(reply, x));
      if (r && r.captured) return `${who(r.piece)} can now take ${who(r.captured)} on ${sqName(r.to)}. ${bestSan} was better.`;
    }
    g.make(bm);
    const check = g.inCheck();
    g.unmake(bm);
    if (check) return `${me} could have put the king in check with ${bestSan}.`;
    return `a better move was ${bestSan}, with ${me}.`;
  }

  /* ---------- the dialog ---------- */

  let token = 0;

  function open() {
    const M = root.Margins;
    if (!M || !E) return false;
    const data = describe(M.startFen, M.played());
    data.look = new Array(data.fens.length).fill(null);
    data.marks = new Array(data.moves.length).fill(null);
    data.notes = new Array(data.moves.length).fill("");
    const n = data.moves.length;
    const mine = ++token;
    const flip = M.human === 1;
    const opener = document.activeElement;

    let d = document.getElementById("review-dialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "review-dialog";
      d.className = "cx-book rv-dialog";
      d.setAttribute("aria-labelledby", "rv-title");
      document.body.append(d);
      d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
    }
    d.onclose = () => { token++; if (opener && opener.focus && document.contains(opener)) opener.focus(); };

    d.innerHTML = `<h2 id="rv-title">Look back at the game</h2>
<p class="rv-progress" id="rv-progress" role="status"></p>
<div class="rv-main">
  <div class="rv-left">
    <div class="rv-board" id="rv-board" aria-hidden="true"></div>
    <div class="rv-nav">
      <button class="cx-btn cx-btn--small" type="button" data-go="first" aria-label="First position">&#124;&lt;</button>
      <button class="cx-btn cx-btn--small" type="button" data-go="prev" aria-label="Previous move">&lt;</button>
      <button class="cx-btn cx-btn--small" type="button" data-go="next" aria-label="Next move">&gt;</button>
      <button class="cx-btn cx-btn--small" type="button" data-go="last" aria-label="Last position">&gt;&#124;</button>
    </div>
    <p class="rv-now" id="rv-now" aria-live="polite"></p>
  </div>
  <div class="rv-right">
    <svg class="rv-graph" id="rv-graph" viewBox="0 0 600 120" role="img" aria-label="Line across the game. Above the middle is better for orange, below is better for purple."></svg>
    <ol class="rv-moves" id="rv-moves"></ol>
  </div>
</div>
<div class="rv-summary" id="rv-summary"></div>
<button class="cx-btn cx-btn--solid" type="button" id="rv-close">Close</button>`;
    const $ = (id) => d.querySelector(`#${id}`);
    const board = $("rv-board"), now = $("rv-now"), list = $("rv-moves"), graph = $("rv-graph"), prog = $("rv-progress"), sum = $("rv-summary");
    $("rv-close").addEventListener("click", () => d.close());

    if (!n) {
      prog.textContent = "";
      $("rv-moves").textContent = "";
      now.textContent = "There are no moves to look at yet. Play a few and come back.";
    }

    /* the board: 64 squares, drawn again for each position */
    const cells = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const el = document.createElement("div");
      el.className = "rv-sq" + ((r + c) % 2 ? " rv-sq--dark" : "");
      const rank = flip ? r : 7 - r, file = flip ? 7 - c : c;
      el.dataset.sq = String(rank * 16 + file);
      board.append(el);
      cells.push(el);
    }
    const art = new Map();
    const creature = (p) => {
      if (!art.has(p)) art.set(p, M.mini(p));
      const s = art.get(p).cloneNode(true);
      s.setAttribute("aria-hidden", "true");
      return s;
    };

    let ply = n;   // how many moves are on the board
    const lastWord = (i) => {
      const mv = data.moves[i - 1];
      if (!mv) return n ? "The start of the game." : "There are no moves to look at yet. Play a few and come back.";
      const k = Math.ceil(i / 2);
      let t = `Move ${k}, ${TEAM[mv.by]}: ${mv.san}.`;
      const mk = data.marks[i - 1];
      if (mk) t += ` ${mk.label}.`;
      if (data.notes[i - 1]) t += ` ${data.notes[i - 1]}`;
      return t;
    };

    function show(p) {
      ply = Math.max(0, Math.min(n, p));
      const g = new E.Game(data.fens[ply]);
      const mv = data.moves[ply - 1];
      for (const el of cells) {
        const sq = Number(el.dataset.sq);
        const piece = g.get(sq);
        el.replaceChildren();
        if (piece) el.append(creature(piece));
        el.classList.toggle("is-move", Boolean(mv) && (sq === mv.from || sq === mv.to));
      }
      const said = lastWord(ply);
      if (now.textContent !== said) now.textContent = said;
      list.querySelectorAll("button").forEach((b) => {
        const on = Number(b.dataset.ply) === ply;
        if (on) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        b.classList.toggle("is-now", on);
        if (on) {
          const li = b.parentElement;
          if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop;
          else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight;
        }
      });
      drawGraph();
      d.querySelectorAll("[data-go]").forEach((b) => {
        b.disabled = (b.dataset.go === "first" || b.dataset.go === "prev") ? ply === 0 : ply === n;
      });
    }

    /* the move list, one entry per move, with the marks and the teacher's sentences */
    function drawList() {
      const keep = list.scrollTop;
      list.replaceChildren();
      data.moves.forEach((mv, i) => {
        const li = document.createElement("li");
        li.className = `rv-li rv-li--${mv.by ? "purple" : "orange"}`;
        const b = document.createElement("button");
        b.type = "button"; b.className = "rv-mv"; b.dataset.ply = String(i + 1);
        const num = mv.by ? (i === 0 ? `${Math.ceil((i + 1) / 2)}...` : "") : `${Math.ceil((i + 1) / 2)}.`;
        b.append(document.createTextNode(`${num} ${mv.san}`));
        const mk = data.marks[i];
        if (mk) {
          const s = document.createElement("span");
          s.className = `rv-mark rv-mark--${mk.label.replace(/ /g, "-")}`;
          s.textContent = mk.sym;
          b.append(s);
          b.setAttribute("aria-label", `Move ${Math.ceil((i + 1) / 2)}, ${TEAM[mv.by]}, ${mv.san}, ${mk.label}`);
        } else b.setAttribute("aria-label", `Move ${Math.ceil((i + 1) / 2)}, ${TEAM[mv.by]}, ${mv.san}`);
        b.addEventListener("click", () => show(i + 1));
        li.append(b);
        if (data.notes[i]) {
          li.classList.add("has-note");
          const sm = document.createElement("small");
          sm.className = "rv-teacher";
          sm.textContent = data.notes[i];
          li.append(sm);
        }
        list.append(li);
      });
      list.scrollTop = keep;
    }

    /* the line across the game: orange above the middle, purple below */
    const NS = "http://www.w3.org/2000/svg";
    const W = 600, H = 120, MID = 60;
    const svg = (tag, attrs, parent) => {
      const el = document.createElementNS(NS, tag);
      for (const k in attrs) el.setAttribute(k, attrs[k]);
      if (parent) parent.append(el);
      return el;
    };
    function drawGraph() {
      graph.replaceChildren();
      const defs = svg("defs", {}, graph);
      svg("rect", { x: 0, y: 0, width: W, height: MID }, svg("clipPath", { id: "rv-up" }, defs));
      svg("rect", { x: 0, y: MID, width: W, height: MID }, svg("clipPath", { id: "rv-down" }, defs));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const l = data.look[i];
        if (!l) break;
        const white = data.turns[i] === 0 ? l.score : -l.score;
        pts.push([n ? (i / n) * W : W / 2, MID - (MID - 6) * Math.tanh(clamp(white, 3000) / 400)]);
      }
      if (pts.length > 1) {
        const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        const area = `M0,${MID} L${line.replace(/ /g, " L")} L${pts[pts.length - 1][0].toFixed(1)},${MID} Z`;
        svg("path", { d: area, class: "rv-area rv-area--orange", "clip-path": "url(#rv-up)" }, graph);
        svg("path", { d: area, class: "rv-area rv-area--purple", "clip-path": "url(#rv-down)" }, graph);
      }
      svg("line", { x1: 0, y1: MID, x2: W, y2: MID, class: "rv-mid" }, graph);
      if (pts.length > 1) {
        svg("polyline", { points: pts.map((p) => `${p[0].toFixed(1)},${(p[1] + 1.2).toFixed(1)}`).join(" "), class: "rv-line rv-line--echo" }, graph);
        svg("polyline", { points: pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" "), class: "rv-line" }, graph);
      }
      const x = n ? (ply / n) * W : W / 2;
      svg("line", { x1: x, y1: 0, x2: x, y2: H, class: "rv-cursor" }, graph);
    }
    graph.addEventListener("click", (e) => {
      const r = graph.getBoundingClientRect();
      if (r.width && n) show(Math.round(((e.clientX - r.left) / r.width) * n));
    });

    /* the summary for each team, when everything has been looked at */
    function summary() {
      const count = (side, sym) => data.marks.filter((m, i) => m && data.moves[i].by === side && (sym === "tick" ? (m.sym === "✓" || m.sym === "!") : m.sym === sym)).length;
      sum.replaceChildren();
      [0, 1].forEach((side) => {
        const p = document.createElement("p");
        p.className = `rv-team rv-team--${TEAM[side]}`;
        const t = count(side, "tick"), mi = count(side, "?"), bl = count(side, "??");
        const plural = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
        p.textContent = `The ${TEAM[side]} team: ${plural(t, "tick")}, ${plural(mi, "mistake")}, ${plural(bl, "blunder")}.`;
        sum.append(p);
      });
    }

    d.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
      show({ first: 0, prev: ply - 1, next: ply + 1, last: n }[b.dataset.go]);
    }));
    d.onkeydown = (e) => {
      if (e.target && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName)) return;
      const to = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: n }[e.key];
      if (to === undefined || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      show(to);
    };

    drawList();
    if (!d.open) d.showModal();
    show(n);
    // a button that was just switched off cannot hold the focus: hand it to one that can
    if (!d.contains(document.activeElement) || document.activeElement.disabled) $("rv-close").focus();

    /* look at every position, one after another, and mark each move as soon as it can be judged */
    (async () => {
      if (!n) return;
      const g = new E.Game(data.fens[n]);
      const total = n + 1;
      for (let i = 0; i <= n; i++) {
        if (token !== mine) return;
        prog.textContent = `The owl is looking at the game: ${i} of ${total} positions.`;
        if (i === n && data.end) data.look[i] = { score: endScore(g), move: null };
        else {
          let r;
          try { r = await analyse(data.fens[i]); } catch { r = await fallback(data.fens[i]); }
          if (token !== mine) return;
          data.look[i] = { score: r.score, move: r.move };
        }
        if (i > 0) {
          const k = i - 1;
          data.marks[k] = judge(data, k);
          if (data.marks[k] && (data.marks[k].sym === "?" || data.marks[k].sym === "??")) data.notes[k] = explain(data, k, data.marks[k]);
        }
        drawGraph();
        if (i % 4 === 3 || i === n) { drawList(); show(ply); }
      }
      prog.textContent = "The owl has looked at every move.";
      drawList(); summary(); show(ply);
    })();
    return true;
  }

  root.Review = { open, _lab: { describe, judge, explain, fallback } };
})(typeof window !== "undefined" ? window : globalThis);
