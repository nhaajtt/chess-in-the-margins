/* Saving and loading games as text. PGN is the plain way chess games are written down;
   a FEN is one position. The core below takes the engine as a parameter, so it also runs in node. */
(function (root) {
  "use strict";

  const SQ = (name) => (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
  const plain = (s) => s.replace(/[+#!?]+$/g, "");

  // is this text one position written as a FEN, and is it sensible? Answers the full FEN or null
  function checkFen(text) {
    const parts = String(text).trim().split(/\s+/);
    if (parts.length < 2 || parts.length > 6) return null;
    const rows = parts[0].split("/");
    if (rows.length !== 8) return null;
    const kings = [0, 0];
    for (const row of rows) {
      let n = 0;
      for (const c of row) {
        if (/[1-8]/.test(c)) n += Number(c);
        else if (/[pnbrqkPNBRQK]/.test(c)) { n++; if (c === "k") kings[1]++; if (c === "K") kings[0]++; }
        else return null;
      }
      if (n !== 8) return null;
    }
    if (kings[0] !== 1 || kings[1] !== 1) return null;
    if (!/^[wb]$/.test(parts[1])) return null;
    const rest = parts.slice(2);
    const full = [parts[0], parts[1], rest[0] || "-", rest[1] || "-", rest[2] || "0", rest[3] || "1"];
    if (!/^(-|[KQkq]+)$/.test(full[2]) || !/^(-|[a-h][36])$/.test(full[3])) return null;
    if (!/^\d+$/.test(full[4]) || !/^\d+$/.test(full[5])) return null;
    return full.join(" ");
  }

  // find the legal move that a written move means; null when none or more than one
  function findMove(game, token) {
    const legal = game.moves();
    const want = plain(token.replace(/0/g, "O").replace(/=/g, "").replace(/\s+/g, ""));
    const exact = legal.filter((m) => plain(game.san(m, legal)).replace(/=/g, "") === want);
    if (exact.length === 1) return exact[0];
    // looser: a missing capture mark, a missing file or rank, a lower-case promotion piece
    if (/^O-O(-O)?$/.test(want)) return null;
    const m = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])([NBRQnbrq])?$/.exec(want);
    if (!m) return null;
    const kind = m[1] ? "?pNBRQK".indexOf(m[1]) : 1;
    const pr = m[5] ? "?pnbrqk".indexOf(m[5].toLowerCase()) : 0;
    const to = SQ(m[4]);
    const hits = legal.filter((x) => (x.piece & 7) === kind && x.to === to && (!m[2] || (x.from & 7) === m[2].charCodeAt(0) - 97) &&
      (!m[3] || (x.from >> 4) === Number(m[3]) - 1) && (x.promo & 7) === pr);
    return hits.length === 1 ? hits[0] : null;
  }

  // read a PGN or a FEN. Returns { fen, moves: [san], finalFen, result }
  function parse(E, text) {
    let src = String(text == null ? "" : text).replace(/^﻿/, "").trim();
    if (!src) throw new Error("There is nothing to read yet. Paste a game or a position first.");
    if (src.length > 200000) throw new Error("That is too long to be one game.");
    const asFen = checkFen(src);
    if (asFen && !/\[/.test(src)) return { fen: asFen, moves: [], finalFen: asFen, result: "*" };

    const tags = {};
    src = src.replace(/^[ \t]*\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\][ \t]*$/gm, (_, k, v) => { tags[k] = v; return ""; });
    // comments, notes to the end of a line, then side lines in brackets (they can nest)
    src = src.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ").replace(/^%[^\n]*/gm, " ");
    let depth = 0, out = "";
    for (const c of src) {
      if (c === "(") depth++;
      else if (c === ")") { if (depth) depth--; }
      else if (!depth) out += c;
    }
    src = out.replace(/\$\d+/g, " ").replace(/\d+\s*\.+/g, " ");

    let start = E.START;
    if (tags.FEN) {
      start = checkFen(tags.FEN);
      if (!start) throw new Error("The starting position in this game (the FEN tag) does not look right.");
    }
    const game = new E.Game(start);
    const moves = [];
    let result = /^(1-0|0-1|1\/2-1\/2|\*)$/.test(tags.Result || "") ? tags.Result : "*";
    for (const tok of src.split(/\s+/).filter(Boolean)) {
      if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(tok)) { result = tok; break; }
      const m = findMove(game, tok);
      if (!m) {
        if (!moves.length && !/^[a-hNBRQKO0]/.test(tok)) throw new Error("That does not look like a chess game or a position.");
        throw new Error(`I could not play "${tok}"${moves.length ? ` after ${moves[moves.length - 1]}` : " as the first move"}. Check that move.`);
      }
      moves.push(game.play(m));
    }
    if (!moves.length && !tags.FEN) throw new Error("I could not find any moves or a position in that text.");
    return { fen: start, moves, finalFen: game.fen(), result };
  }

  // build a PGN from a start position and moves [{from, to, promo}]; the engine writes the moves
  function build(E, startFen, list, opts = {}) {
    const first = new E.Game(startFen || E.START);
    const game = new E.Game(startFen || E.START);
    const sans = [];
    for (const mv of list) {
      const m = game.moves().find((x) => x.from === mv.from && x.to === mv.to && (x.promo & 7) === ((mv.promo || 0) & 7));
      if (!m) break;
      sans.push(game.play(m));
    }
    const st = game.status();
    const result = st.over ? st.result : "*";
    const d = opts.date || new Date();
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    const normal = !startFen || startFen === E.START;
    const head = [["Event", "Chess in the margins"], ["Site", "chess.nhaajt.com"], ["Date", date], ["Round", "-"],
      ["White", opts.white || "Orange"], ["Black", opts.black || "Purple"], ["Result", result]];
    if (!normal) head.push(["SetUp", "1"], ["FEN", startFen]);
    let n = first.full, black = first.turn === 1;
    const words = [];
    sans.forEach((s, i) => {
      if (!black) words.push(`${n}.`);
      else if (i === 0) words.push(`${n}...`);
      words.push(s);
      if (black) n++;
      black = !black;
    });
    words.push(result);
    const lines = [];
    let line = "";
    for (const w of words) {
      if (line && line.length + 1 + w.length > 80) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w;
    }
    if (line) lines.push(line);
    return head.map(([k, v]) => `[${k} "${v}"]`).join("\n") + "\n\n" + lines.join("\n") + "\n";
  }

  root.PgnCore = { parse, build, checkFen };

  /* ---------- the page part: the dialog and the door the other files use ---------- */
  if (typeof document === "undefined" || !root.ChessEngine) return;
  const E = root.ChessEngine;
  const M = () => root.Margins;

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(() => true, () => false);
    const t = document.createElement("textarea");
    t.value = text; t.className = "pg-hidden"; t.setAttribute("aria-hidden", "true");
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* no copy here */ }
    t.remove();
    return Promise.resolve(ok);
  }

  const Pgn = {
    export() { const m = M(); return build(E, m.startFen, m.played()); },
    parse(text) { return parse(E, text); },
    importText(text) {
      const r = parse(E, text);
      if (!M().load({ fen: r.fen, moves: r.moves, mode: "friend", tag: "import" })) throw new Error("The board is busy. Try again in a moment.");
      return r;
    },
    openDialog() {
      let d = document.getElementById("pgn-dialog");
      const opener = document.activeElement;
      if (!d) {
        d = document.createElement("dialog");
        d.id = "pgn-dialog";
        d.className = "cx-book pg-dialog";
        d.setAttribute("aria-labelledby", "pgn-title");
        document.body.append(d);
        d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
        d.addEventListener("close", () => { const o = d.__opener; if (o && o.focus && document.contains(o)) o.focus(); });
      }
      d.__opener = opener;
      d.innerHTML = `<h2 id="pgn-title">Save or load a game</h2>
<p class="cx-book__sub">Copy this game to keep it, or paste a game or a position to play from there.</p>
<div class="pg-row"><button class="cx-btn" type="button" id="pgn-copy-game">Copy the game (PGN)</button><button class="cx-btn" type="button" id="pgn-copy-fen">Copy the position (FEN)</button></div>
<label class="pg-label" for="pgn-text">Paste a game (PGN) or a position (FEN)</label>
<textarea id="pgn-text" class="pg-text" rows="6" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
<p class="pg-msg" id="pgn-msg" role="status" aria-live="polite"></p>
<div class="pg-row"><button class="cx-btn cx-btn--solid" type="button" id="pgn-play">Play from here</button><button class="cx-btn" type="button" id="pgn-close">Close</button></div>`;
      const msg = d.querySelector("#pgn-msg");
      const say = (t, bad) => { msg.textContent = t; msg.classList.toggle("is-bad", Boolean(bad)); };
      const done = (what) => (ok) => say(ok ? `The ${what} is copied.` : "Could not copy. Select the text and copy it by hand.", !ok);
      d.querySelector("#pgn-copy-game").addEventListener("click", () => {
        const text = Pgn.export();
        d.querySelector("#pgn-text").value = text;
        copy(text).then(done("game"));
      });
      d.querySelector("#pgn-copy-fen").addEventListener("click", () => {
        const text = M().fen();
        d.querySelector("#pgn-text").value = text;
        copy(text).then(done("position"));
      });
      d.querySelector("#pgn-play").addEventListener("click", () => {
        try {
          const r = Pgn.importText(d.querySelector("#pgn-text").value);
          d.close();
          if (M().note) M().note(r.moves.length ? `we play on from move ${r.moves.length}` : "a new position, ready to play");
        } catch (e) { say(e.message, true); }
      });
      d.querySelector("#pgn-close").addEventListener("click", () => d.close());
      d.showModal();
    },
  };
  root.Pgn = Pgn;
})(typeof window !== "undefined" ? window : globalThis);
