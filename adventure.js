/* The golden star: a story of eight chapters, each one a game against a boss, played on the real board.
   window.Adventure.open() shows the contents page. The chapter table below is plain data. */
(function () {
  "use strict";

  const KEY = "chess-adventure";
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  /* One row per chapter.
     human: 0 = you play orange (white), 1 = you play purple (black). The boss plays the other team.
     fen: the starting position; a boss that is missing pieces starts a handicap down.
     piece: the boss as a piece code for Margins.mini (1 pawn ... 6 king, +8 for purple). */
  const CHAPTERS = [
    {
      id: 1, boss: "Blob", piece: 9, human: 0, side: "orange", level: "easy", style: "sleepy",
      fen: "1nb1kbn1/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1",
      handicap: "no queen, no rooks",
      title: { en: "The sleepy blob", vi: "Ma blob buồn ngủ" },
      story: {
        en: "The purple blob floats near the star, yawning. It left its bird queen and both puffballs at home, because they were too noisy for napping. You play orange. Move gently, it is half asleep.",
        vi: "Ma blob tím lơ lửng gần ngôi sao và ngáp dài. Nó để nữ hoàng chim mào và hai cục bông ở nhà, vì chúng ồn quá, mà nó thì muốn ngủ. Bạn chơi quân cam. Đi nhẹ thôi nhé, nó đang ngủ gật.",
      },
      win: {
        en: "The blob wobbles, yawns and floats off to sleep. One page done. The star shines a little brighter.",
        vi: "Ma blob lắc lư, ngáp rồi bay đi ngủ. Xong một trang rồi! Ngôi sao sáng lên một chút.",
      },
      note: "the blob yawns. it forgot half its team at home",
    },
    {
      id: 2, boss: "Mushroom", piece: 1, human: 1, side: "purple", level: "easy", style: "reckless",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NB1KBN1 w kq - 0 1",
      handicap: "no queen, no rooks",
      title: { en: "The mushroom who charges", vi: "Cây nấm húc đầu" },
      story: {
        en: "The mushroom headbutts everything, even the wind. Its bee queen and both sandcastles went on a picnic. You play purple, so the mushroom goes first. Hold on to your hat.",
        vi: "Cây nấm húc đầu vào mọi thứ, kể cả gió. Ong chúa và hai lâu đài cát của nó đi dã ngoại rồi. Bạn chơi quân tím, nên cây nấm đi trước. Giữ chặt mũ nhé!",
      },
      win: {
        en: "The mushroom bonks itself on a tree and sits down, dizzy. “Good game,” it mumbles to the tree.",
        vi: "Cây nấm tự húc vào một cái cây rồi ngồi phịch xuống, chóng mặt. “Chơi hay lắm,” nó lẩm bẩm với cái cây.",
      },
      note: "the mushroom is charging at everything",
    },
    {
      id: 3, boss: "Zebra", piece: 10, human: 0, side: "orange", level: "easy", style: "greedy",
      fen: "rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      handicap: "no queen",
      title: { en: "The zebra who grabs", vi: "Ngựa vằn hay vồ" },
      story: {
        en: "The zebra grabs every piece it can reach, like a magpie with stripes. It lost its bird queen in the laundry. You play orange. If it offers you something, ask yourself why.",
        vi: "Ngựa vằn thấy quân nào cũng vồ lấy, như chú chim ác là có sọc. Nó làm mất nữ hoàng chim mào trong đống đồ giặt. Bạn chơi quân cam. Nếu nó mời bạn món gì, hãy tự hỏi vì sao.",
      },
      win: {
        en: "The zebra counts its stripes and some are missing. “Where did they go?” It is still looking.",
        vi: "Ngựa vằn đếm lại các sọc và thấy thiếu mất vài sọc. “Chúng đâu rồi nhỉ?” Nó vẫn đang đi tìm.",
      },
      note: "the zebra wants everything you have",
    },
    {
      id: 4, boss: "Acorn", piece: 3, human: 1, side: "purple", level: "normal", style: "careful",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1",
      handicap: "one rook down",
      title: { en: "The careful acorn", vi: "Quả sồi cẩn thận" },
      story: {
        en: "The acorn is very careful and hides behind its pawns, because it once fell on someone's head. One sandcastle rolled away. You play purple. Be patient: it will not give you anything for free.",
        vi: "Quả sồi rất cẩn thận và núp sau các quân tốt, vì nó từng rơi trúng đầu người ta. Một lâu đài cát đã lăn đi mất. Bạn chơi quân tím. Cứ kiên nhẫn nhé, nó không cho không ai cái gì đâu.",
      },
      win: {
        en: "The acorn peeks out from behind its pawns and sighs. “Fine. You were patient. I respect that.”",
        vi: "Quả sồi ló ra từ sau các quân tốt và thở dài. “Được rồi. Bạn kiên nhẫn thật. Tôi nể đấy.”",
      },
      note: "the acorn hides behind its pawns",
    },
    {
      id: 5, boss: "Wizard", piece: 11, human: 0, side: "orange", level: "normal", style: "reckless",
      fen: "r1bqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      handicap: "one knight down",
      title: { en: "The wizard who skips the manual", vi: "Phù thủy không đọc sách" },
      story: {
        en: "The wizard casts spells without reading them first. One of its zebras was turned into a teacup by mistake. You play orange. Watch out for sudden zigzag bolts.",
        vi: "Phù thủy niệm bùa mà không đọc trước. Một con ngựa vằn của nó đã bị biến thành tách trà do nhầm bùa. Bạn chơi quân cam. Coi chừng những tia sét ngoằn ngoèo bất ngờ nhé.",
      },
      win: {
        en: "The wizard reads the spell it just cast. “Oh. That was the wrong one.” Poof, a puff of purple smoke.",
        vi: "Phù thủy đọc lại câu thần chú vừa niệm. “Ôi. Nhầm bùa rồi.” Phụt, một làn khói tím bay lên.",
      },
      note: "the wizard is waving its wand about",
    },
    {
      id: 6, boss: "Bee queen", piece: 5, human: 1, side: "purple", level: "hard", style: "greedy",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKB1R w KQkq - 0 1",
      handicap: "one knight down",
      title: { en: "The bee queen's honey", vi: "Mật ong của ong chúa" },
      story: {
        en: "The bee queen loves honey and takes everything that looks sweet. She is quick and buzzy, and she left a pony in the hive. You play purple. Do not let her sting your queen.",
        vi: "Ong chúa mê mật ong và vồ lấy mọi thứ trông ngọt ngào. Nàng nhanh nhẹn và vo ve suốt, lại còn bỏ quên một chú ngựa con trong tổ. Bạn chơi quân tím. Đừng để nàng chích nữ hoàng của bạn nhé.",
      },
      win: {
        en: "The bee queen buzzes in a circle, then lands. “What a sweet game,” she says. “Here, have some honey.”",
        vi: "Ong chúa vo ve bay một vòng rồi đáp xuống. “Một ván ngọt như mật,” nàng nói. “Này, cầm ít mật ong đi.”",
      },
      note: "the bee queen smells something sweet",
    },
    {
      id: 7, boss: "Owl king", piece: 6, human: 1, side: "purple", level: "hard", style: "careful",
      fen: START,
      handicap: "none, an even game",
      title: { en: "The owl king", vi: "Vua Cú" },
      story: {
        en: "The owl king is wise, slow and very sure that the star is orange. This time all his friends are at home. He says very little and waits for you to slip. You play purple.",
        vi: "Vua Cú thông thái, chậm rãi và rất chắc chắn rằng ngôi sao là của bên cam. Lần này bạn bè của ông ấy có đủ cả. Ông ít nói, chỉ ngồi đợi bạn đi sai. Bạn chơi quân tím.",
      },
      win: {
        en: "The owl king blinks twice. “Hoo. I was so sure.” He takes off his crown, scratches his head and puts it back on.",
        vi: "Vua Cú chớp mắt hai lần. “Hú. Ta đã rất chắc chắn.” Ông tháo vương miện, gãi đầu rồi đội lại.",
      },
      note: "the owl king is thinking. for a long time",
    },
    {
      id: 8, boss: "Penguin king", piece: 14, human: 0, side: "orange", level: "master", style: "careful",
      fen: START,
      handicap: "none, an even game",
      title: { en: "The penguin king", vi: "Vua Chim Cánh Cụt" },
      story: {
        en: "The penguin king is waiting on the ice in the middle of the page. He has not lost a game since the page was drawn, and he is a little proud of it. The owl king watches from the margin. You play orange. Last page, deep breath.",
        vi: "Vua Chim Cánh Cụt đang chờ trên băng giữa trang giấy. Từ lúc trang này được vẽ, ông chưa thua ván nào và hơi tự hào về điều đó. Vua Cú đứng xem ngoài lề. Bạn chơi quân cam. Trang cuối rồi, hít một hơi thật sâu.",
      },
      win: {
        en: "The penguin king slides across the ice on his tummy and stops at your feet. “Well,” he says, “that was worth losing for.”",
        vi: "Vua Chim Cánh Cụt trượt bụng trên băng và dừng lại ngay chân bạn. “Chà,” ông nói, “thua thế này cũng đáng.”",
      },
      note: "the penguin king has never lost. he says so a lot",
    },
  ];

  // the last page of the story, shown after chapter 8
  const ENDING = {
    title: { en: "The golden star", vi: "Ngôi sao vàng" },
    en: [
      "The golden star floats down from the middle of the page, warm as toast, and lands in your hands.",
      "You hold it up. It shines orange on one side and purple on the other, because it was never just one colour.",
      "So you hang it back in the middle, where the Orange Meadow and the Purple Inkwell can both see it. The two kings share a cup of cocoa, and nobody shouts MINE ever again. Well, only a little.",
    ],
    vi: [
      "Ngôi sao vàng từ giữa trang giấy bay xuống, ấm như bánh mì nướng, và đậu vào tay bạn.",
      "Bạn giơ nó lên. Một mặt sáng màu cam, một mặt sáng màu tím, vì nó chưa bao giờ chỉ có một màu.",
      "Thế là bạn treo nó lại giữa trang, để cả Đồng Cỏ Cam và Lọ Mực Tím đều nhìn thấy. Hai vị vua chia nhau một tách ca cao, và không ai hét MỚI CỦA TÔI nữa. À, chỉ còn hét một chút thôi.",
    ],
  };

  // kind lines for a lost game, one pair each, picked by chapter
  const KIND = [
    { en: "That was a tough one. Rub it out and try again?", vi: "Ván này khó thật. Tẩy đi rồi thử lại nhé?" },
    { en: "Nobody wins every page the first time. Shall we try again?", vi: "Không ai thắng ngay lần đầu cả. Mình thử lại nhé?" },
    { en: "Good try! The boss is still smiling, so you can try again.", vi: "Cố gắng tốt lắm! Ông trùm vẫn đang cười, nên bạn thử lại được mà." },
  ];
  const DRAW = { en: "A draw! Nobody gets the star yet. Try again?", vi: "Hoà rồi! Chưa ai được ngôi sao cả. Thử lại nhé?" };

  /* ---------- progress ---------- */
  const margins = () => window.Margins;
  function readWon() {
    try {
      const raw = margins() && margins().store.get(KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((n) => Number.isInteger(n) && n >= 1 && n <= CHAPTERS.length) : [];
    } catch (e) { return []; }
  }
  function saveWon(id) {
    const won = readWon();
    if (!won.includes(id)) won.push(id);
    margins().store.set(KEY, JSON.stringify(won.sort((a, b) => a - b)));
  }
  const unlocked = (id, won) => id === 1 || won.includes(id - 1) || won.includes(id);

  /* ---------- little DOM helpers ---------- */
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function pair(en, vi) {
    const box = el("div", "adv-bi");
    const a = el("p", "adv-en", en); a.lang = "en";
    const b = el("p", "adv-vi", vi); b.lang = "vi";
    box.append(a, b);
    return box;
  }
  function button(label, cls, fn) {
    const b = el("button", "cx-btn " + cls, label);
    b.type = "button";
    b.addEventListener("click", fn);
    return b;
  }
  function art(piece) {
    const wrap = el("span", "adv-art");
    wrap.setAttribute("aria-hidden", "true");
    try { if (margins() && margins().mini) wrap.append(margins().mini(piece)); } catch (e) { /* the picture is a bonus */ }
    return wrap;
  }

  /* ---------- the dialog ---------- */
  let dlg = null;
  let view = { name: "list" };
  let hooked = false;
  let message = "";

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.id = "adventure-book";
    dlg.className = "cx-book adv";
    dlg.setAttribute("aria-labelledby", "adv-title");
    document.body.append(dlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    return dlg;
  }

  function show(next) {
    view = next;
    message = "";
    render();
  }

  function render() {
    const d = ensureDialog();
    d.replaceChildren();
    const head = el("h2", "", "The golden star");
    head.id = "adv-title";
    head.tabIndex = -1;
    d.append(head);
    if (view.name === "list") renderList(d);
    else if (view.name === "story") renderStory(d, CHAPTERS[view.i]);
    else if (view.name === "win") renderWin(d, CHAPTERS[view.i]);
    else if (view.name === "lose") renderLose(d, CHAPTERS[view.i], view.draw);
    else if (view.name === "end") renderEnd(d);
    const live = el("p", "adv-msg", message);
    live.setAttribute("role", "status");
    d.append(live);
    const first = d.querySelector("[data-first]") || head;
    if (d.open) first.focus({ preventScroll: true });
  }

  function renderList(d) {
    const won = readWon();
    d.append(el("p", "cx-book__sub", `${won.length} of ${CHAPTERS.length} chapters won. Your stars are kept on this device. / Bạn đã thắng ${won.length} trên ${CHAPTERS.length} chương.`));
    const ol = el("ol", "adv-list");
    let firstOpen = null;
    CHAPTERS.forEach((ch, i) => {
      const open = unlocked(ch.id, won);
      const done = won.includes(ch.id);
      const li = el("li", "adv-item" + (done ? " is-won" : "") + (open ? "" : " is-locked"));
      const b = el("button", "adv-row");
      b.type = "button";
      b.disabled = !open;
      b.setAttribute("aria-label", open ? `Chapter ${ch.id}, ${ch.title.en}${done ? ", won" : ""}` : `Chapter ${ch.id}, locked. Win chapter ${ch.id - 1} first`);
      const num = el("span", "adv-num", `${ch.id}.`);
      const names = el("span", "adv-names");
      names.append(el("b", "", open ? ch.title.en : "A page not turned yet"), el("i", "", open ? ch.title.vi : "Trang chưa lật"));
      const star = el("span", "adv-star", done ? "★" : "☆");
      star.setAttribute("aria-hidden", "true");
      b.append(num, art(ch.piece), names, star);
      b.addEventListener("click", () => show({ name: "story", i }));
      if (open && !done && !firstOpen) { firstOpen = b; }
      li.append(b);
      ol.append(li);
    });
    if (firstOpen) firstOpen.dataset.first = "";
    else if (ol.firstChild) ol.firstChild.firstChild.dataset.first = "";
    d.append(ol);
    if (won.length === CHAPTERS.length) {
      d.append(button("Read the ending again", "cx-btn--small", () => show({ name: "end" })));
    }
    d.append(button("Close", "cx-btn--solid adv-close", () => d.close()));
  }

  function sideLine(ch) {
    return ch.human === 0 ? "orange" : "purple";
  }

  function renderStory(d, ch) {
    const page = el("section", "adv-page");
    const top = el("div", "adv-top");
    top.append(art(ch.piece), el("h3", "", `${ch.id}. ${ch.title.en}`));
    page.append(top, pair(ch.story.en, ch.story.vi));
    d.append(page);
    const row = el("div", "adv-actions");
    const play = button("Play", "cx-btn--solid", () => start(ch.id));
    play.dataset.first = "";
    row.append(play, button("Back", "", () => show({ name: "list" })));
    d.append(row);
    d.setAttribute("data-side", sideLine(ch));
  }

  function renderWin(d, ch) {
    const page = el("section", "adv-page adv-victory");
    page.append(el("h3", "", `★ Chapter ${ch.id} won!`), pair(ch.win.en, ch.win.vi));
    d.append(page);
    const row = el("div", "adv-actions");
    if (CHAPTERS[ch.id]) {
      const next = button("Next chapter", "cx-btn--solid", () => show({ name: "story", i: ch.id }));
      next.dataset.first = "";
      row.append(next);
    }
    row.append(button("Contents", "", () => show({ name: "list" })));
    d.append(row);
  }

  function renderLose(d, ch, draw) {
    const line = draw ? DRAW : KIND[(ch.id - 1) % KIND.length];
    const page = el("section", "adv-page");
    page.append(pair(line.en, line.vi));
    d.append(page);
    const row = el("div", "adv-actions");
    const again = button("Try again", "cx-btn--solid", () => start(ch.id));
    again.dataset.first = "";
    row.append(again, button("Contents", "", () => show({ name: "list" })));
    d.append(row);
  }

  function renderEnd(d) {
    const page = el("section", "adv-page adv-ending");
    page.append(el("h3", "", `★ ${ENDING.title.en} ★`));
    const last = CHAPTERS[CHAPTERS.length - 1];
    page.append(pair(last.win.en, last.win.vi));
    ENDING.en.forEach((t, i) => page.append(pair(t, ENDING.vi[i])));
    page.append(el("p", "adv-theend", "The end / Hết"));
    d.append(page);
    const row = el("div", "adv-actions");
    const back = button("Contents", "cx-btn--solid", () => show({ name: "list" }));
    back.dataset.first = "";
    row.append(back);
    d.append(row);
  }

  /* ---------- playing a chapter ---------- */
  function start(id) {
    const ch = CHAPTERS[id - 1];
    const m = margins();
    if (!m || !m.load) { message = "The board is not ready yet."; render(); return; }
    const ok = m.load({ fen: ch.fen, mode: "cpu", level: ch.level, human: ch.human, style: ch.style, tag: "adventure:" + ch.id });
    if (ok === false) {
      message = "The board is busy. Wait a moment and press again. / Bàn cờ đang bận, đợi một chút rồi bấm lại nhé.";
      render();
      return;
    }
    if (dlg && dlg.open) dlg.close();
    if (m.note) m.note(ch.note);
    if (m.status) m.status(`Chapter ${ch.id}: ${ch.boss}. You play ${sideLine(ch)}.`);
  }

  function onEnd(e) {
    const detail = (e && e.detail) || e || {};
    const hit = /^adventure:(\d+)$/.exec(String(detail.tag || ""));
    if (!hit) return;
    const ch = CHAPTERS[Number(hit[1]) - 1];
    if (!ch) return;
    const won = (detail.result === "1-0" && detail.human === 0) || (detail.result === "0-1" && detail.human === 1);
    if (won) {
      saveWon(ch.id);
      view = ch.id === CHAPTERS.length ? { name: "end" } : { name: "win", i: ch.id - 1 };
    } else {
      view = { name: "lose", i: ch.id - 1, draw: detail.result === "1/2-1/2" };
    }
    message = "";
    // a short pause, so the last move on the board is seen before the page opens
    setTimeout(() => open(true), margins() && margins().reduce ? 600 : 1800);
  }

  function open(keepView) {
    const m = margins();
    if (m && !hooked && m.on) { m.on("end", onEnd); hooked = true; }
    if (!keepView) view = { name: "list" };
    const d = ensureDialog();
    render();
    if (!d.open) d.showModal();
    const first = d.querySelector("[data-first]") || d.querySelector("h2");
    if (first) first.focus({ preventScroll: true });
  }

  // listen for the end of a game as soon as the board exists, even before the page is first opened
  function hookEarly() {
    const m = margins();
    if (m && !hooked && m.on) { m.on("end", onEnd); hooked = true; }
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hookEarly);
    else hookEarly();
    window.addEventListener("load", hookEarly);
  }

  window.Adventure = { open: () => open(false), chapters: CHAPTERS, ending: ENDING };
})();
