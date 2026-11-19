/* How the creatures move: small lessons on a flat practice board.
   window.School.open() shows the list. One lesson per piece, then check, checkmate, castling, en passant and promotion.
   Star tasks use the simple move rules below; the others use the real rules from engine.js. */
(function () {
  "use strict";

  const KEY = "chess-school";
  const CREATURE = [null, ["mushroom", "blob"], ["pony", "zebra"], ["acorn", "wizard"], ["castle", "puffball"], ["bee queen", "crested bird"], ["owl", "penguin"]];
  const TEAM = ["orange", "purple"];

  /* squares are 0x88 numbers like in the engine: rank * 16 + file, a1 = 0 */
  const sq = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);
  const nm = (s) => "abcdefgh"[s & 7] + ((s >> 4) + 1);
  const onBoard = (s) => !(s & 0x88);
  const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14];
  const KING = [15, 16, 17, 1, -1, -15, -16, -17];
  const DIAG = [15, 17, -15, -17];
  const STRAIGHT = [16, -16, 1, -1];

  /* ---------- the lessons ---------- */
  // kind "stars": your one creature collects every star, moving by the simple rules. at = where it starts.
  // kind "engine": a tiny real position, you play one move as orange; goal says what counts.
  const star = (piece, at, stars, text, rocks) => ({ kind: "stars", piece, at, stars, rocks: rocks || [], text });
  const real = (fen, goal, text) => ({ kind: "engine", fen, goal, text });
  const TAP = { en: "Tap the creature. Dots show where it may go.", vi: "Chạm vào bạn thú. Các chấm cho thấy nó được đi đâu." };

  const LESSONS = [
    {
      id: "pawn", piece: 1, title: { en: "The mushroom (pawn)", vi: "Cây nấm (tốt)" },
      rule: {
        en: "The mushroom walks one step forward, and two from its home square. It never goes backwards. It catches things one step forward on the diagonal.",
        vi: "Cây nấm đi thẳng một bước về phía trước, và hai bước từ ô xuất phát. Nó không bao giờ đi lùi. Nó bắt quân ở ô chéo phía trước.",
      },
      tasks: [
        star(1, "e2", ["e4"], { en: "Walk to the star. " + TAP.en, vi: "Đi tới ngôi sao. " + TAP.vi }),
        star(1, "c2", ["d3", "d4"], { en: "The star on the diagonal can be caught sideways. Collect both stars.", vi: "Ngôi sao ở ô chéo được bắt bằng bước chéo. Hãy lấy cả hai ngôi sao." }),
      ],
    },
    {
      id: "knight", piece: 2, title: { en: "The pony (knight)", vi: "Chú ngựa con (mã)" },
      rule: {
        en: "The pony jumps in an L: two steps one way and one step to the side. It is the only one that can jump over others.",
        vi: "Chú ngựa con nhảy hình chữ L: hai bước theo một hướng rồi một bước sang bên. Chỉ có nó mới nhảy qua được quân khác.",
      },
      tasks: [
        star(2, "b1", ["c3"], { en: "Jump to the star. " + TAP.en, vi: "Nhảy tới ngôi sao. " + TAP.vi }),
        star(2, "b1", ["c3", "d5", "f4"], { en: "Collect every star in as few jumps as you can.", vi: "Lấy mọi ngôi sao với ít bước nhảy nhất có thể." }),
      ],
    },
    {
      id: "bishop", piece: 3, title: { en: "The acorn (bishop)", vi: "Quả sồi (tượng)" },
      rule: {
        en: "The acorn slides along diagonals, as far as it likes. It stays on the same colour of square all game.",
        vi: "Quả sồi trượt theo đường chéo, xa bao nhiêu cũng được. Nó luôn ở trên các ô cùng một màu.",
      },
      tasks: [
        star(3, "c1", ["g5"], { en: "Slide to the star. " + TAP.en, vi: "Trượt tới ngôi sao. " + TAP.vi }),
        star(3, "c1", ["g5", "d8", "a5"], { en: "Collect every star in as few slides as you can.", vi: "Lấy mọi ngôi sao với ít lần trượt nhất có thể." }),
      ],
    },
    {
      id: "rook", piece: 4, title: { en: "The castle (rook)", vi: "Lâu đài cát (xe)" },
      rule: {
        en: "The castle slides in straight lines: up, down, left and right, as far as it likes. It cannot go through a stone.",
        vi: "Lâu đài cát trượt theo đường thẳng: lên, xuống, trái, phải, xa bao nhiêu cũng được. Nó không đi xuyên qua đá được.",
      },
      tasks: [
        star(4, "a1", ["a6"], { en: "Slide to the star. " + TAP.en, vi: "Trượt tới ngôi sao. " + TAP.vi }),
        star(4, "a1", ["a5", "e5", "e8"], { en: "Collect every star in as few slides as you can.", vi: "Lấy mọi ngôi sao với ít lần trượt nhất có thể." }),
        star(4, "a1", ["a8"], { en: "A stone blocks the way. Go around it.", vi: "Một hòn đá chắn đường. Hãy đi vòng qua nó." }, ["a4"]),
      ],
    },
    {
      id: "queen", piece: 5, title: { en: "The bee queen (queen)", vi: "Ong chúa (hậu)" },
      rule: {
        en: "The bee queen does everything the castle and the acorn do: straight lines and diagonals, as far as she likes. She is the strongest of all.",
        vi: "Ong chúa làm được mọi việc của lâu đài và quả sồi: đi thẳng và đi chéo, xa bao nhiêu cũng được. Nàng là quân mạnh nhất.",
      },
      tasks: [
        star(5, "d1", ["h5", "h8"], { en: "Collect both stars. " + TAP.en, vi: "Lấy cả hai ngôi sao. " + TAP.vi }),
        star(5, "d4", ["a1", "a8", "h8"], { en: "Collect the three corners in as few moves as you can.", vi: "Lấy ba góc bàn cờ với ít nước đi nhất có thể." }),
      ],
    },
    {
      id: "king", piece: 6, title: { en: "The owl king (king)", vi: "Vua Cú (vua)" },
      rule: {
        en: "The owl king takes one step in any direction. He is the one piece you must never lose, so look after him.",
        vi: "Vua Cú đi một bước theo mọi hướng. Đây là quân bạn không bao giờ được để mất, nên hãy bảo vệ ông ấy.",
      },
      tasks: [
        star(6, "e1", ["e3"], { en: "Walk to the star. " + TAP.en, vi: "Đi tới ngôi sao. " + TAP.vi }),
        star(6, "e1", ["f2", "g3", "h4"], { en: "Collect every star in as few steps as you can.", vi: "Lấy mọi ngôi sao với ít bước nhất có thể." }),
      ],
    },
    {
      id: "check", piece: 5, title: { en: "Check", vi: "Chiếu" },
      rule: {
        en: "When a piece could catch the other king on its next move, that is check. The king must get out of the way. Give check with one move.",
        vi: "Khi một quân có thể bắt vua bên kia ở nước đi kế tiếp, đó gọi là chiếu. Vua phải tránh đi. Hãy đi một nước để chiếu.",
      },
      tasks: [
        real("4k3/8/8/8/8/8/R7/4K3 w - - 0 1", "check", { en: "Move the castle so it looks straight at the purple king.", vi: "Đưa lâu đài đi sao cho nó nhìn thẳng vào vua tím." }),
        real("4k3/8/8/8/8/8/8/5BK1 w - - 0 1", "check", { en: "Now do it with the acorn, along a diagonal.", vi: "Giờ hãy làm bằng quả sồi, theo đường chéo." }),
      ],
    },
    {
      id: "mate", piece: 6, title: { en: "Checkmate", vi: "Chiếu hết" },
      rule: {
        en: "Checkmate is check with no way out: the king cannot step away, nobody can block, and nobody can catch the attacker. The game ends and you win.",
        vi: "Chiếu hết là chiếu mà không còn đường thoát: vua không chạy được, không ai chắn được, cũng không ai bắt được quân đang chiếu. Ván cờ kết thúc và bạn thắng.",
      },
      tasks: [
        real("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", "mate", { en: "The penguin is hemmed in by its own pawns. Find the checkmate in one.", vi: "Chim cánh cụt bị chính các quân tốt của mình chặn kín. Hãy tìm nước chiếu hết.", }),
        real("k7/8/1K6/8/8/8/8/6Q1 w - - 0 1", "mate", { en: "The king and the queen work together. Find the checkmate in one.", vi: "Vua và hậu cùng phối hợp. Hãy tìm nước chiếu hết." }),
      ],
    },
    {
      id: "castling", piece: 4, title: { en: "Castling", vi: "Nhập thành" },
      rule: {
        en: "Once per game the king and a castle swap places in one move. The king hops two steps towards the castle and the castle jumps over him. Tap the king, then the dot two steps away.",
        vi: "Mỗi ván được một lần, vua và một lâu đài đổi chỗ trong một nước. Vua nhảy hai bước về phía lâu đài và lâu đài nhảy qua vua. Chạm vào vua, rồi chạm vào chấm cách hai ô.",
      },
      tasks: [
        real("4k3/8/8/8/8/8/8/4K2R w K - 0 1", "castle", { en: "Castle on the short side, next to the corner.", vi: "Nhập thành bên ngắn, gần góc bàn cờ." }),
        real("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1", "castle", { en: "Castle on the long side.", vi: "Nhập thành bên dài." }),
      ],
    },
    {
      id: "enpassant", piece: 1, title: { en: "En passant", vi: "Bắt tốt qua đường" },
      rule: {
        en: "If a pawn jumps two steps and lands right beside your pawn, you may catch it as if it had only stepped once. You must do it straight away, or the chance is gone.",
        vi: "Nếu một quân tốt nhảy hai bước và đứng ngay cạnh quân tốt của bạn, bạn được bắt nó như thể nó mới đi một bước. Phải bắt ngay, nếu không cơ hội sẽ mất.",
      },
      tasks: [
        real("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1", "ep", { en: "The purple blob just jumped two steps. Catch it as it passes.", vi: "Ma blob tím vừa nhảy hai bước. Hãy bắt nó khi nó đi ngang." }),
        real("4k3/8/8/4Pp2/8/8/8/4K3 w - f6 0 1", "ep", { en: "It happened again, on the other side.", vi: "Lại xảy ra một lần nữa, ở bên kia." }),
      ],
    },
    {
      id: "promotion", piece: 1, title: { en: "Promotion", vi: "Phong cấp" },
      rule: {
        en: "When a mushroom walks all the way to the far side, it grows up into something stronger. In these lessons it becomes a queen.",
        vi: "Khi cây nấm đi hết đường tới cuối bàn cờ, nó lớn lên thành quân mạnh hơn. Trong các bài này nó trở thành hậu.",
      },
      tasks: [
        real("4k3/P7/8/8/8/8/8/4K3 w - - 0 1", "promo", { en: "One step left. Walk the mushroom to the far side.", vi: "Chỉ còn một bước. Đưa cây nấm tới cuối bàn cờ." }),
        real("1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1", "promo", { en: "A pawn can grow up while catching, too.", vi: "Quân tốt cũng có thể lớn lên khi đang bắt quân." }),
      ],
    },
  ];

  /* ---------- the move rules ---------- */
  // where a lone creature may go on a star board; the pawn may step sideways only to catch a star
  function simpleDests(type, from, rocks, stars) {
    const out = [];
    const free = (t) => onBoard(t) && !rocks.has(t);
    if (type === 1) {
      if (free(from + 16)) {
        out.push(from + 16);
        if ((from >> 4) === 1 && free(from + 32)) out.push(from + 32);
      }
      for (const d of [15, 17]) if (free(from + d) && stars.has(from + d)) out.push(from + d);
    } else if (type === 2 || type === 6) {
      for (const d of type === 2 ? KNIGHT : KING) if (free(from + d)) out.push(from + d);
    } else {
      const dirs = type === 3 ? DIAG : type === 4 ? STRAIGHT : DIAG.concat(STRAIGHT);
      for (const d of dirs) for (let t = from + d; free(t); t += d) out.push(t);
    }
    return out;
  }

  // the fewest moves that collect every star; -1 when it cannot be done
  function par(task) {
    const rocks = new Set((task.rocks || []).map(sq));
    const stars = task.stars.map(sq);
    const full = (1 << stars.length) - 1;
    const seen = new Set();
    let layer = [[sq(task.at), 0]], depth = 0;
    seen.add(layer[0][0] * 64);
    while (layer.length && depth < 20) {
      const next = [];
      depth++;
      for (const [pos, mask] of layer) {
        const left = new Set(stars.filter((_, i) => !(mask & (1 << i))));
        for (const t of simpleDests(task.piece, pos, rocks, left)) {
          let m = mask;
          stars.forEach((s, i) => { if (s === t) m |= 1 << i; });
          if (m === full) return depth;
          const key = t * 64 + m;
          if (!seen.has(key)) { seen.add(key); next.push([t, m]); }
        }
      }
      layer = next;
    }
    return -1;
  }

  const engine = () => window.ChessEngine;
  // did this move, played on g, do what the task asks? (g is the game after the move)
  function judge(goal, move, g) {
    const E = engine();
    if (goal === "check") return g.inCheck() === true;
    if (goal === "mate") return g.status().reason === "checkmate";
    if (goal === "castle") return Boolean(move.flags & (E.F_KCASTLE | E.F_QCASTLE));
    if (goal === "ep") return Boolean(move.flags & E.F_EP);
    if (goal === "promo") return Boolean(move.flags & E.F_PROMO);
    return false;
  }
  // how many legal first moves solve a real-position task
  function solutions(task) {
    const E = engine();
    const base = new E.Game(task.fen);
    let n = 0;
    for (const m of base.moves()) {
      const g = new E.Game(task.fen);
      const same = g.moves().find((x) => x.from === m.from && x.to === m.to && x.promo === m.promo);
      g.play(same);
      if (judge(task.goal, same, g)) n++;
    }
    return n;
  }

  /* ---------- progress ---------- */
  const margins = () => window.Margins;
  function readDone() {
    try {
      const raw = margins() && margins().store.get(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((id) => LESSONS.some((l) => l.id === id)) : [];
    } catch (e) { return []; }
  }
  function saveDone(id) {
    const done = readDone();
    if (!done.includes(id) && margins()) { done.push(id); margins().store.set(KEY, JSON.stringify(done)); }
  }

  /* ---------- little DOM helpers ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function pair(en, vi, cls) {
    const box = el("div", "sch-bi" + (cls ? " " + cls : ""));
    const a = el("p", "sch-en", en); a.lang = "en";
    const b = el("p", "sch-vi", vi); b.lang = "vi";
    box.append(a, b);
    return box;
  }
  function button(label, cls, fn) {
    const b = el("button", "cx-btn " + cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function art(code, cls) {
    const wrap = el("span", cls || "sch-art");
    wrap.setAttribute("aria-hidden", "true");
    try { if (margins() && margins().mini) wrap.append(margins().mini(code)); } catch (e) { /* the picture is a bonus */ }
    return wrap;
  }
  const pieceName = (p) => `${TEAM[p >> 3]} ${CREATURE[p & 7][p >> 3]}`;

  /* ---------- the dialog ---------- */
  let dlg = null;
  let lessonAt = -1;     // -1 = the list
  let taskAt = 0;
  let t = null;          // the task being played

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "school-book";
    dlg.className = "cx-book sch";
    dlg.setAttribute("aria-labelledby", "sch-title");
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", (e) => {
      // Escape puts a picked-up creature back first; a second press closes the dialog
      if (e.key === "Escape" && t && t.sel !== null) { e.preventDefault(); drop(); say("Put back. Pick it up again whenever you like.", "Đã đặt lại. Khi nào muốn, bạn cứ nhấc lên nhé."); }
    });
    return dlg;
  }

  function title(d) {
    const h = el("h2", "", "How the creatures move");
    h.id = "sch-title";
    h.tabIndex = -1;
    d.append(h);
    return h;
  }

  function showList() {
    lessonAt = -1; t = null;
    const d = ensureDialog();
    d.replaceChildren();
    const h = title(d);
    const done = readDone();
    d.append(el("p", "cx-book__sub", `${done.length} of ${LESSONS.length} lessons done. / Đã xong ${done.length} trên ${LESSONS.length} bài.`));
    const ol = el("ol", "sch-menu");
    LESSONS.forEach((l, i) => {
      const li = el("li", done.includes(l.id) ? "is-done" : "");
      const b = el("button", "sch-row");
      b.type = "button";
      b.setAttribute("aria-label", `${l.title.en}${done.includes(l.id) ? ", done" : ""}`);
      const names = el("span", "sch-names");
      names.append(el("b", "", l.title.en), el("i", "", l.title.vi));
      const tick = el("span", "sch-tick", done.includes(l.id) ? "✓" : "");
      tick.setAttribute("aria-hidden", "true");
      b.append(art(l.piece), names, tick);
      b.addEventListener("click", () => showLesson(i, 0));
      if (i === Math.min(LESSONS.length - 1, LESSONS.findIndex((x) => !done.includes(x.id)) < 0 ? 0 : LESSONS.findIndex((x) => !done.includes(x.id)))) b.dataset.first = "";
      li.append(b);
      ol.append(li);
    });
    d.append(ol, button("Close", "cx-btn--solid sch-close", () => d.close()));
    if (d.open) (d.querySelector("[data-first]") || h).focus({ preventScroll: true });
  }

  let cells = [];

  function showLesson(li, ti) {
    lessonAt = li; taskAt = ti;
    const lesson = LESSONS[li], task = lesson.tasks[ti];
    const d = ensureDialog();
    d.replaceChildren();
    title(d);
    const top = el("div", "sch-top");
    top.append(button("Lessons", "cx-btn--small", showList), art(lesson.piece, "sch-art sch-art--big"));
    const head = el("h3", "", lesson.title.en);
    top.append(head);
    d.append(top, pair(lesson.rule.en, lesson.rule.vi, "sch-rule"));
    d.append(el("p", "sch-count", `Task ${ti + 1} of ${lesson.tasks.length} / Bài tập ${ti + 1} trên ${lesson.tasks.length}`));
    d.append(pair(task.text.en, task.text.vi, "sch-task"));

    const board = el("div", "sch-board");
    board.setAttribute("role", "group");
    board.setAttribute("aria-label", "Practice board");
    cells = [];
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const s = r * 16 + f;
        const b = el("button", "sch-sq " + ((r + f) % 2 ? "is-light" : "is-dark"));
        b.type = "button";
        b.dataset.sq = String(s);
        b.tabIndex = -1;
        b.addEventListener("click", () => press(s));
        cells[s] = b;
        board.append(b);
      }
    }
    board.addEventListener("keydown", onKey);
    d.append(board);

    const live = el("div", "sch-say");
    live.setAttribute("role", "status");
    const en = el("p", "sch-en"); en.lang = "en";
    const vi = el("p", "sch-vi"); vi.lang = "vi";
    live.append(en, vi);
    d.append(live);
    const row = el("div", "sch-actions");
    row.id = "sch-actions";
    d.append(row);

    t = newTask(task);
    paint();
    actions();
    focusSq(t.mode === "stars" ? t.pos : sq("e1"));
  }

  function newTask(task) {
    const s = { task, sel: null, dests: new Set(), moves: 0, done: false };
    if (task.kind === "stars") {
      s.mode = "stars";
      s.pos = sq(task.at);
      s.stars = new Set(task.stars.map(sq));
      s.rocks = new Set((task.rocks || []).map(sq));
      s.par = par(task);
    } else {
      s.mode = "engine";
      s.game = new (engine().Game)(task.fen);
    }
    return s;
  }

  /* ---------- reading the board ---------- */
  const pieceAt = (s) => (t.mode === "stars" ? (s === t.pos ? t.task.piece : 0) : t.game.get(s));
  const mine = (s) => { const p = pieceAt(s); return p && (p >> 3) === 0; };

  function destsOf(s) {
    if (t.mode === "stars") return simpleDests(t.task.piece, s, t.rocks, t.stars);
    return [...new Set(t.game.moves().filter((m) => m.from === s).map((m) => m.to))];
  }

  function paint() {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const s = r * 16 + f, b = cells[s];
        b.replaceChildren();
        const p = pieceAt(s);
        const isStar = t.mode === "stars" && t.stars.has(s);
        const isRock = t.mode === "stars" && t.rocks.has(s);
        const dot = t.dests.has(s);
        b.classList.toggle("is-sel", t.sel === s);
        b.classList.toggle("is-dot", dot);
        let what = "empty";
        if (f === 0 || r === 0) {
          const co = el("span", "sch-co", (f === 0 ? String(r + 1) : "") + (r === 0 ? "abcdefgh"[f] : ""));
          co.setAttribute("aria-hidden", "true");
          b.append(co);
        }
        if (isStar) { const st = el("span", "sch-star", "★"); st.setAttribute("aria-hidden", "true"); b.append(st); what = "star"; }
        if (isRock) { b.append(el("span", "sch-rock")); what = "stone"; }
        if (p) { b.append(art(p, "sch-piece")); what = pieceName(p); }
        if (dot) { b.append(el("span", "sch-dotmark")); what += p || isStar ? ", it can catch here" : ", it can go here"; }
        if (t.sel === s) what += ", picked up";
        b.setAttribute("aria-label", `${nm(s)}, ${what}`);
      }
    }
  }

  function say(en, vi) {
    const box = dlg.querySelector(".sch-say");
    if (!box) return;
    box.children[0].textContent = en;
    box.children[1].textContent = vi;
  }

  function focusSq(s) {
    cells.forEach((b) => { b.tabIndex = -1; });
    if (cells[s]) { cells[s].tabIndex = 0; cells[s].focus({ preventScroll: true }); }
  }

  // arrow keys walk over the squares; Enter and Space press the focused square like a tap
  function onKey(e) {
    const cur = Number(document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.sq : NaN);
    if (Number.isNaN(cur)) return;
    const step = { ArrowUp: 16, ArrowDown: -16, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const to = cur + step;
    if (onBoard(to)) focusSq(to);
  }

  /* ---------- playing ---------- */
  function drop() { t.sel = null; t.dests = new Set(); paint(); }

  function press(s) {
    if (t.done || t.busy) return;
    if (t.sel !== null && t.dests.has(s)) { move(t.sel, s); return; }
    if (t.sel === s) { drop(); say("Put back.", "Đã đặt lại."); return; }
    if (mine(s)) {
      t.sel = s;
      t.dests = new Set(destsOf(s));
      paint();
      const p = pieceAt(s), list = [...t.dests].map(nm);
      say(list.length ? `The ${CREATURE[p & 7][0]} can go to ${list.join(", ")}.` : `The ${CREATURE[p & 7][0]} cannot move right now.`,
        list.length ? `Có thể đi tới ${list.join(", ")}.` : "Lúc này nó chưa đi được.");
      return;
    }
    if (t.sel !== null) say("Pick a square with a dot, or press Escape to put the creature back.", "Hãy chọn ô có chấm, hoặc nhấn Escape để đặt bạn thú lại.");
    else say("Tap one of the orange creatures first.", "Hãy chạm vào một bạn thú màu cam trước.");
  }

  function move(from, to) {
    t.sel = null; t.dests = new Set();
    if (t.mode === "stars") {
      t.pos = to; t.moves++;
      t.stars.delete(to);
      paint();
      if (!t.stars.size) {
        const best = t.par;
        finish(t.moves <= best
          ? [`Done in ${t.moves} ${t.moves === 1 ? "move" : "moves"}. That is the fewest possible!`, `Xong trong ${t.moves} nước. Không thể ít hơn nữa!`]
          : [`Done in ${t.moves} moves. The fewest possible is ${best}. Reset to try for it!`, `Xong trong ${t.moves} nước. Ít nhất có thể là ${best}. Bấm Chơi lại để thử nhé!`]);
      } else say(`${t.stars.size} ${t.stars.size === 1 ? "star" : "stars"} left.`, `Còn ${t.stars.size} ngôi sao.`);
      focusSq(to);
      return;
    }
    // real position: the queen is chosen when a mushroom grows up
    const legal = t.game.moves().filter((m) => m.from === from && m.to === to);
    const m = legal.find((x) => (x.promo & 7) === 5) || legal[0];
    t.game.play(m);
    const ok = judge(t.task.goal, m, t.game);
    paint();
    if (ok) finish(["Yes! That is exactly it. Well done!", "Đúng rồi! Chính là nước đó. Giỏi lắm!"]);
    else {
      const cur = t;
      cur.busy = true;
      say("Not that one. The creatures go back where they were. Try again!", "Chưa đúng. Các bạn thú sẽ về chỗ cũ. Thử lại nhé!");
      setTimeout(() => { cur.game = new (engine().Game)(cur.task.fen); cur.busy = false; if (t === cur) paint(); }, 900);
    }
    focusSq(to);
  }

  function finish(lines) {
    t.done = true;
    say(lines[0], lines[1]);
    const lesson = LESSONS[lessonAt];
    if (taskAt === lesson.tasks.length - 1) saveDone(lesson.id);
    actions();
    const next = dlg.querySelector("#sch-actions [data-first]");
    if (next) next.focus({ preventScroll: true });
  }

  function actions() {
    const row = dlg.querySelector("#sch-actions");
    row.replaceChildren();
    const lesson = LESSONS[lessonAt];
    if (t.done) {
      let go;
      if (taskAt < lesson.tasks.length - 1) go = button("Next task", "cx-btn--solid", () => showLesson(lessonAt, taskAt + 1));
      else if (lessonAt < LESSONS.length - 1) go = button("Next lesson", "cx-btn--solid", () => showLesson(lessonAt + 1, 0));
      else go = button("Back to the lessons", "cx-btn--solid", showList);
      go.dataset.first = "";
      row.append(go);
    }
    row.append(button("Play again", "", () => showLesson(lessonAt, taskAt)));
    row.append(button("Lessons", "", showList));
  }

  function open() {
    const d = ensureDialog();
    showList();
    if (!d.open) d.showModal();
    (d.querySelector("[data-first]") || d.querySelector("h2")).focus({ preventScroll: true });
  }

  window.School = { open, lessons: LESSONS, par, solutions, simpleDests };
})();
