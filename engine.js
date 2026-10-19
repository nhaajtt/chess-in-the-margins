/* The rules of chess and a small searching opponent. No dependencies.
   Board: 0x88 array (rank * 16 + file, a1 = 0). Pieces: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king; +8 for black.
   Exposed as window.ChessEngine (or this.ChessEngine when loaded with node's vm for the perft check). */
(function (root) {
  "use strict";
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8;
  const WHITE = 0;
  const F_CAPTURE = 1, F_EP = 2, F_KCASTLE = 4, F_QCASTLE = 8, F_DOUBLE = 16, F_PROMO = 32;
  const KNIGHT = [33, 31, 18, 14, -33, -31, -18, -14];
  const BISHOP = [15, 17, -15, -17];
  const ROOK = [16, -16, 1, -1];
  const KING = [15, 16, 17, 1, -1, -15, -16, -17];
  const VALUE = [0, 100, 320, 330, 500, 900, 20000];
  const LETTER = ["", "", "N", "B", "R", "Q", "K"];
  const FEN_CH = { p: P, n: N, b: B, r: R, q: Q, k: K };
  const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  // Piece-square tables from white's side, rank 8 first so they read like a board (simplified evaluation tables).
  const PST = {
    [P]: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    [N]: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    [B]: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    [R]: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    [Q]: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    [K]: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  };
  const pst = (piece, sq) => {
    const t = PST[piece & 7], f = sq & 7, r = sq >> 4;
    return piece & BLACK ? t[r * 8 + f] : t[(7 - r) * 8 + f];
  };

  const name = (sq) => "abcdefgh"[sq & 7] + ((sq >> 4) + 1);
  const parse = (s) => (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);

  class Game {
    constructor(fen = START) { this.load(fen); }

    load(fen) {
      const [rows, turn, cast, ep, half, full] = fen.trim().split(/\s+/);
      this.board = new Array(128).fill(0);
      this.kings = [-1, -1];
      rows.split("/").forEach((row, i) => {
        let f = 0;
        for (const c of row) {
          if (/\d/.test(c)) { f += Number(c); continue; }
          const lower = c.toLowerCase();
          const piece = FEN_CH[lower] | (c === lower ? BLACK : 0);
          const sq = (7 - i) * 16 + f;
          this.board[sq] = piece;
          if ((piece & 7) === K) this.kings[piece & BLACK ? 1 : 0] = sq;
          f++;
        }
      });
      this.turn = turn === "b" ? 1 : 0;
      this.castling = (cast.includes("K") ? 1 : 0) | (cast.includes("Q") ? 2 : 0) | (cast.includes("k") ? 4 : 0) | (cast.includes("q") ? 8 : 0);
      this.ep = ep && ep !== "-" ? parse(ep) : -1;
      this.half = Number(half || 0);
      this.full = Number(full || 1);
      this.stack = [];
      this.played = [];
      this.keys = [this.key()];
    }

    fen() {
      const rows = [];
      for (let r = 7; r >= 0; r--) {
        let s = "", empty = 0;
        for (let f = 0; f < 8; f++) {
          const p = this.board[r * 16 + f];
          if (!p) { empty++; continue; }
          if (empty) { s += empty; empty = 0; }
          const c = "?pnbrqk"[p & 7];
          s += p & BLACK ? c : c.toUpperCase();
        }
        rows.push(s + (empty || ""));
      }
      const c = (this.castling & 1 ? "K" : "") + (this.castling & 2 ? "Q" : "") + (this.castling & 4 ? "k" : "") + (this.castling & 8 ? "q" : "");
      return `${rows.join("/")} ${this.turn ? "b" : "w"} ${c || "-"} ${this.ep >= 0 ? name(this.ep) : "-"} ${this.half} ${this.full}`;
    }
    // position identity for repetition: everything but the move counters
    key() { return this.fen().split(" ").slice(0, 4).join(" "); }

    get(sq) { return this.board[sq]; }

    attacked(sq, by) {
      const b = this.board, side = by ? BLACK : 0;
      // pawns attack diagonally forward, so look backwards from the square
      if (by === WHITE) { if (b[sq - 15] === P && !((sq - 15) & 0x88)) return true; if (b[sq - 17] === P && !((sq - 17) & 0x88)) return true; }
      else { if (b[sq + 15] === (P | BLACK) && !((sq + 15) & 0x88)) return true; if (b[sq + 17] === (P | BLACK) && !((sq + 17) & 0x88)) return true; }
      for (const d of KNIGHT) { const t = sq + d; if (!(t & 0x88) && b[t] === (N | side)) return true; }
      for (const d of KING) { const t = sq + d; if (!(t & 0x88) && b[t] === (K | side)) return true; }
      for (const d of BISHOP) {
        for (let t = sq + d; !(t & 0x88); t += d) { const p = b[t]; if (!p) continue; if ((p & BLACK) === side && ((p & 7) === B || (p & 7) === Q)) return true; break; }
      }
      for (const d of ROOK) {
        for (let t = sq + d; !(t & 0x88); t += d) { const p = b[t]; if (!p) continue; if ((p & BLACK) === side && ((p & 7) === R || (p & 7) === Q)) return true; break; }
      }
      return false;
    }
    // every square holding a piece of colour `by` that attacks sq
    attackers(sq, by) {
      const out = [], b = this.board, side = by ? BLACK : 0;
      const add = (t) => out.push(t);
      if (by === WHITE) { for (const t of [sq - 15, sq - 17]) if (!(t & 0x88) && b[t] === P) add(t); }
      else { for (const t of [sq + 15, sq + 17]) if (!(t & 0x88) && b[t] === (P | BLACK)) add(t); }
      for (const d of KNIGHT) { const t = sq + d; if (!(t & 0x88) && b[t] === (N | side)) add(t); }
      for (const d of KING) { const t = sq + d; if (!(t & 0x88) && b[t] === (K | side)) add(t); }
      for (const [dirs, kinds] of [[BISHOP, [B, Q]], [ROOK, [R, Q]]]) {
        for (const d of dirs) {
          for (let t = sq + d; !(t & 0x88); t += d) { const p = b[t]; if (!p) continue; if ((p & BLACK) === side && kinds.includes(p & 7)) add(t); break; }
        }
      }
      return out;
    }
    inCheck(color = this.turn) { return this.attacked(this.kings[color], color ^ 1); }

    pseudo(capturesOnly = false) {
      const moves = [], b = this.board, us = this.turn, side = us ? BLACK : 0;
      const push = (from, to, piece, flags, captured = 0) => {
        if ((piece & 7) === P && ((to >> 4) === 7 || (to >> 4) === 0)) {
          for (const pr of [Q, R, B, N]) moves.push({ from, to, piece, captured, promo: pr | side, flags: flags | F_PROMO });
        } else moves.push({ from, to, piece, captured, promo: 0, flags });
      };
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = b[sq];
        if (!p || (p & BLACK) !== side) continue;
        const kind = p & 7;
        if (kind === P) {
          const dir = us ? -16 : 16, startRank = us ? 6 : 1;
          const one = sq + dir;
          if (!capturesOnly && !(one & 0x88) && !b[one]) {
            push(sq, one, p, 0);
            const two = one + dir;
            if ((sq >> 4) === startRank && !b[two]) push(sq, two, p, F_DOUBLE);
          } else if (capturesOnly && !(one & 0x88) && !b[one] && ((one >> 4) === 7 || (one >> 4) === 0)) push(sq, one, p, 0);
          for (const t of [one - 1, one + 1]) {
            if (t & 0x88) continue;
            if (b[t] && (b[t] & BLACK) !== side) push(sq, t, p, F_CAPTURE, b[t]);
            else if (t === this.ep) push(sq, t, p, F_CAPTURE | F_EP, P | (side ^ BLACK));
          }
          continue;
        }
        const dirs = kind === N ? KNIGHT : kind === B ? BISHOP : kind === R ? ROOK : KING;
        const slide = kind === B || kind === R || kind === Q;
        for (const d of dirs) {
          for (let t = sq + d; !(t & 0x88); t += d) {
            const q = b[t];
            if (q) { if ((q & BLACK) !== side) push(sq, t, p, F_CAPTURE, q); break; }
            if (!capturesOnly) push(sq, t, p, 0);
            if (!slide) break;
          }
        }
        if (kind === K && !capturesOnly) {
          const home = us ? 116 : 4, them = us ^ 1;
          if (sq === home && !this.attacked(home, them)) {
            if (this.castling & (us ? 4 : 1) && !b[home + 1] && !b[home + 2] && !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) push(home, home + 2, p, F_KCASTLE);
            if (this.castling & (us ? 8 : 2) && !b[home - 1] && !b[home - 2] && !b[home - 3] && !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) push(home, home - 2, p, F_QCASTLE);
          }
        }
      }
      return moves;
    }

    make(m) {
      const b = this.board, us = this.turn;
      this.stack.push({ castling: this.castling, ep: this.ep, half: this.half, full: this.full, kings: this.kings.slice() });
      b[m.to] = m.promo || m.piece;
      b[m.from] = 0;
      if (m.flags & F_EP) b[m.to + (us ? 16 : -16)] = 0;
      if (m.flags & F_KCASTLE) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
      if (m.flags & F_QCASTLE) { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
      if ((m.piece & 7) === K) { this.kings[us] = m.to; this.castling &= us ? ~12 : ~3; }
      // a rook leaving or being taken on its corner ends that castle
      for (const sq of [m.from, m.to]) {
        if (sq === 0) this.castling &= ~2; else if (sq === 7) this.castling &= ~1;
        else if (sq === 112) this.castling &= ~8; else if (sq === 119) this.castling &= ~4;
      }
      this.ep = m.flags & F_DOUBLE ? m.from + (us ? -16 : 16) : -1;
      this.half = (m.piece & 7) === P || m.captured ? 0 : this.half + 1;
      if (us) this.full++;
      this.turn ^= 1;
    }
    unmake(m) {
      const b = this.board, s = this.stack.pop();
      this.turn ^= 1;
      const us = this.turn;
      b[m.from] = m.piece;
      b[m.to] = m.flags & F_EP ? 0 : m.captured;
      if (m.flags & F_EP) b[m.to + (us ? 16 : -16)] = m.captured;
      if (m.flags & F_KCASTLE) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
      if (m.flags & F_QCASTLE) { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
      Object.assign(this, { castling: s.castling, ep: s.ep, half: s.half, full: s.full, kings: s.kings });
    }

    moves(opts = {}) {
      const us = this.turn, out = [];
      for (const m of this.pseudo(opts.capturesOnly)) {
        this.make(m);
        if (!this.attacked(this.kings[us], us ^ 1)) out.push(m);
        this.unmake(m);
      }
      return opts.from != null ? out.filter((m) => m.from === opts.from) : out;
    }

    san(m, legal = this.moves()) {
      let s;
      if (m.flags & F_KCASTLE) s = "O-O";
      else if (m.flags & F_QCASTLE) s = "O-O-O";
      else {
        const kind = m.piece & 7;
        s = LETTER[kind];
        if (kind === P) { if (m.captured) s += name(m.from)[0]; }
        else {
          const twins = legal.filter((o) => o.to === m.to && o.from !== m.from && o.piece === m.piece);
          if (twins.length) {
            const sameFile = twins.some((o) => (o.from & 7) === (m.from & 7));
            const sameRank = twins.some((o) => (o.from >> 4) === (m.from >> 4));
            s += !sameFile ? name(m.from)[0] : !sameRank ? name(m.from)[1] : name(m.from);
          }
        }
        if (m.captured) s += "x";
        s += name(m.to);
        if (m.promo) s += "=" + LETTER[m.promo & 7];
      }
      this.make(m);
      if (this.inCheck()) s += this.moves().length ? "+" : "#";
      this.unmake(m);
      return s;
    }

    // play a move in the real game: keeps the record and the repetition list
    play(m) {
      const san = this.san(m);
      this.make(m);
      this.played.push({ move: m, san });
      this.keys.push(this.key());
      return san;
    }
    takeBack() {
      const last = this.played.pop();
      if (!last) return null;
      this.unmake(last.move);
      this.keys.pop();
      return last;
    }

    status() {
      const legal = this.moves();
      if (!legal.length) return this.inCheck() ? { over: true, result: this.turn ? "1-0" : "0-1", reason: "checkmate" } : { over: true, result: "1/2-1/2", reason: "stalemate" };
      if (this.half >= 100) return { over: true, result: "1/2-1/2", reason: "fifty moves" };
      const k = this.keys[this.keys.length - 1];
      if (this.keys.filter((x) => x === k).length >= 3) return { over: true, result: "1/2-1/2", reason: "repetition" };
      if (this.insufficient()) return { over: true, result: "1/2-1/2", reason: "not enough pieces" };
      return { over: false, check: this.inCheck() };
    }
    insufficient() {
      const rest = [];
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.board[sq];
        if (p && (p & 7) !== K) rest.push(p & 7);
      }
      return !rest.length || (rest.length === 1 && (rest[0] === N || rest[0] === B));
    }

    evaluate() {
      let s = 0;
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.board[sq];
        if (!p) continue;
        const v = VALUE[p & 7] + pst(p, sq);
        s += p & BLACK ? -v : v;
      }
      return this.turn ? -s : s;
    }
  }

  /* ---------- the opponent ---------- */

  const MATE = 100000;
  const order = (moves) => moves.sort((a, b) => score(b) - score(a));
  const score = (m) => (m.captured ? 10 * VALUE[m.captured & 7] - VALUE[m.piece & 7] : 0) + (m.promo ? VALUE[m.promo & 7] : 0);

  function think(game, level = "normal") {
    const depthFor = { easy: 1, normal: 2, hard: 4 }[level] || 2;
    const deadline = Date.now() + (level === "hard" ? 1000 : 600);
    let nodes = 0, stop = false;

    function quiesce(alpha, beta, qd) {
      const stand = game.evaluate();
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qd > 6) return alpha;
      for (const m of order(game.pseudo(true))) {
        const us = game.turn;
        game.make(m);
        if (game.attacked(game.kings[us], us ^ 1)) { game.unmake(m); continue; }
        const v = -quiesce(-beta, -alpha, qd + 1);
        game.unmake(m);
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      }
      return alpha;
    }
    function search(depth, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      if (depth === 0) return quiesce(alpha, beta, 0);
      let any = false;
      for (const m of order(game.pseudo())) {
        const us = game.turn;
        game.make(m);
        if (game.attacked(game.kings[us], us ^ 1)) { game.unmake(m); continue; }
        any = true;
        const v = -search(depth - 1, -beta, -alpha, ply + 1);
        game.unmake(m);
        if (stop) return 0;
        if (v >= beta) return beta;
        if (v > alpha) alpha = v;
      }
      if (!any) return game.inCheck() ? -MATE + ply : 0;
      return alpha;
    }

    const legal = order(game.moves());
    if (!legal.length) return null;
    let best = legal[0];
    // iterative deepening: keep the best move of the last finished depth
    for (let d = 1; d <= depthFor; d++) {
      let alpha = -Infinity, choice = null;
      const ranked = [best, ...legal.filter((m) => m !== best)];
      for (const m of ranked) {
        game.make(m);
        let v = -search(d - 1, -Infinity, -alpha, 1);
        game.unmake(m);
        if (stop) break;
        if (level === "easy") v += Math.random() * 120 - 60;
        if (v > alpha) { alpha = v; choice = m; }
      }
      if (stop) break;
      if (choice) best = choice;
    }
    return best;
  }

  function perft(game, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of game.moves()) { game.make(m); n += perft(game, depth - 1); game.unmake(m); }
    return n;
  }

  root.ChessEngine = { Game, think, perft, name, parse, START, P, N, B, R, Q, K, BLACK, VALUE, F_CAPTURE, F_EP, F_KCASTLE, F_QCASTLE, F_PROMO };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
