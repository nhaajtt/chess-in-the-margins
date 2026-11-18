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

  // Zobrist keys (two independent 32-bit halves) from a fixed seed, so the same position always hashes the same
  let seed = 0x2545f491;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed | 0; };
  const keys = (n) => Int32Array.from({ length: n }, rnd);
  const Z1 = keys(2048), Z2 = keys(2048), C1 = keys(16), C2 = keys(16), E1 = keys(128), E2 = keys(128), S1 = rnd(), S2 = rnd();

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
      this.hashAll();
      this.keys = [this.key()];
    }

    // the position's hash, rebuilt from scratch here and then kept up to date by make/unmake
    hashAll() {
      let a = 0, b = 0;
      for (let sq = 0; sq < 128; sq++) {
        if (sq & 0x88) { sq += 7; continue; }
        const p = this.board[sq];
        if (p) { a ^= Z1[p << 7 | sq]; b ^= Z2[p << 7 | sq]; }
      }
      a ^= C1[this.castling]; b ^= C2[this.castling];
      if (this.ep >= 0) { a ^= E1[this.ep]; b ^= E2[this.ep]; }
      if (this.turn) { a ^= S1; b ^= S2; }
      this.h1 = a; this.h2 = b;
    }
    // pass the turn without moving (the search uses this to test how safe the side to move is)
    nullMake() {
      if (this.ep >= 0) { this.h1 ^= E1[this.ep]; this.h2 ^= E2[this.ep]; }
      this.h1 ^= S1; this.h2 ^= S2;
      this.ep = -1; this.turn ^= 1;
    }
    nullUnmake(ep, h1, h2) { this.turn ^= 1; this.ep = ep; this.h1 = h1; this.h2 = h2; }

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
    // (the en passant square only counts when a pawn can really take there, as the rules say)
    key() {
      const [rows, turn, cast] = this.fen().split(" ");
      const ep = this.ep >= 0 && this.moves().some((m) => m.flags & F_EP) ? name(this.ep) : "-";
      return `${rows} ${turn} ${cast} ${ep}`;
    }

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
      this.stack.push({ castling: this.castling, ep: this.ep, half: this.half, full: this.full, kings: this.kings.slice(), h1: this.h1, h2: this.h2 });
      const oc = this.castling, oe = this.ep;
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
      // hash: lift the mover, drop it on its new square, remove what it took, move a castling rook, then the flags
      const pc = m.piece, np = m.promo || pc, rk = R | (us ? BLACK : 0);
      let a = this.h1 ^ Z1[pc << 7 | m.from] ^ Z1[np << 7 | m.to] ^ C1[oc] ^ C1[this.castling] ^ S1;
      let c = this.h2 ^ Z2[pc << 7 | m.from] ^ Z2[np << 7 | m.to] ^ C2[oc] ^ C2[this.castling] ^ S2;
      if (m.captured) { const cs = m.flags & F_EP ? m.to + (us ? 16 : -16) : m.to; a ^= Z1[m.captured << 7 | cs]; c ^= Z2[m.captured << 7 | cs]; }
      if (m.flags & F_KCASTLE) { a ^= Z1[rk << 7 | (m.to + 1)] ^ Z1[rk << 7 | (m.to - 1)]; c ^= Z2[rk << 7 | (m.to + 1)] ^ Z2[rk << 7 | (m.to - 1)]; }
      if (m.flags & F_QCASTLE) { a ^= Z1[rk << 7 | (m.to - 2)] ^ Z1[rk << 7 | (m.to + 1)]; c ^= Z2[rk << 7 | (m.to - 2)] ^ Z2[rk << 7 | (m.to + 1)]; }
      if (oe >= 0) { a ^= E1[oe]; c ^= E2[oe]; }
      if (this.ep >= 0) { a ^= E1[this.ep]; c ^= E2[this.ep]; }
      this.h1 = a; this.h2 = c;
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
      Object.assign(this, { castling: s.castling, ep: s.ep, half: s.half, full: s.full, kings: s.kings, h1: s.h1, h2: s.h2 });
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
  const STYLES = ["careful", "reckless", "greedy", "sleepy"];
  // easy and normal keep the plain search and the old board sense; hard and master search deeper with all the tricks
  const LEVELS = {
    easy: { depth: 1, ms: 600, strong: false, noise: 60 },
    normal: { depth: 2, ms: 600, strong: false },
    hard: { depth: 64, ms: 1000, strong: true },
    master: { depth: 64, ms: 2500, strong: true },
  };

  // king squares for the late game: the middle is the place to be (tables read like a board, rank 8 first)
  PST.kEnd = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
  const PASSED = [0, 10, 15, 25, 45, 75, 120, 0];
  const cheb = (a, b) => Math.max(Math.abs((a >> 4) - (b >> 4)), Math.abs((a & 7) - (b & 7)));
  const hi = [new Int8Array(8), new Int8Array(8)], lo = [new Int8Array(8), new Int8Array(8)], cnt = [new Int8Array(8), new Int8Array(8)];
  const pawnAt = new Int16Array(16), rookAt = new Int16Array(8);

  // a fuller look at the board than Game.evaluate, in centipawns for the side to move; `style` and `me` tilt it toward a playing character
  function evalPos(g, style, me) {
    const b = g.board, mat = [0, 0], shield = [0, 0], bish = [0, 0], style_ = [0, 0];
    let phase = 0, np = 0, nr = 0, pos = 0, pieces = 0, lone = 0;
    for (let c = 0; c < 2; c++) { hi[c].fill(-1); lo[c].fill(8); cnt[c].fill(0); }
    const ek = g.kings[me ^ 1];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const kind = p & 7, c = p & BLACK ? 1 : 0, r = sq >> 4, f = sq & 7;
      if (kind === K) continue;
      mat[c] += VALUE[kind];
      pos += (c ? -1 : 1) * pst(p, sq);
      if (kind === P) {
        pawnAt[np++] = sq; cnt[c][f]++;
        if (r > hi[c][f]) hi[c][f] = r;
        if (r < lo[c][f]) lo[c][f] = r;
      } else {
        pieces++;
        phase += kind === Q ? 4 : kind === R ? 2 : 1;
        if (kind === B) bish[c]++; else if (kind === R) rookAt[nr++] = sq;
        if (kind === N || kind === B) lone++;
      }
      if (style === "reckless" && c === me) style_[0] += kind === P ? (c ? 6 - r : r - 1) * 3 : (7 - cheb(sq, ek)) * 4;
    }
    if (phase > 24) phase = 24;
    let s = mat[0] - mat[1] + pos + (bish[0] > 1 ? 30 : 0) - (bish[1] > 1 ? 30 : 0);
    // dead drawn endings: bare kings, or one lone minor piece and nothing else
    if (!np && !nr && mat[0] + mat[1] < 700 && lone < 2 && pieces === lone) return 0;
    // pawns: passed ones count more the nearer they are to promotion, doubled ones count less
    for (let i = 0; i < np; i++) {
      const sq = pawnAt[i], c = b[sq] & BLACK ? 1 : 0, r = sq >> 4, f = sq & 7, e = c ^ 1;
      let free = true;
      for (let x = Math.max(f - 1, 0); x <= Math.min(f + 1, 7); x++) if (c ? lo[e][x] < r : hi[e][x] > r) { free = false; break; }
      if (free) s += c ? -PASSED[6 - r] : PASSED[r - 1];
    }
    for (let c = 0; c < 2; c++) for (let f = 0; f < 8; f++) if (cnt[c][f] > 1) s += c ? 12 * (cnt[c][f] - 1) : -12 * (cnt[c][f] - 1);
    // rooks like files with no pawn of their own
    for (let i = 0; i < nr; i++) {
      const sq = rookAt[i], c = b[sq] & BLACK ? 1 : 0, f = sq & 7;
      if (!cnt[c][f]) s += (c ? -1 : 1) * (cnt[c ^ 1][f] ? 10 : 18);
    }
    // kings: tucked behind pawns while the board is full, in the middle once it empties
    for (let c = 0; c < 2; c++) {
      const sq = g.kings[c], f = sq & 7, w = c ? -1 : 1, dir = c ? -16 : 16;
      const k = PST[K], e = PST.kEnd, i = c ? (sq >> 4) * 8 + f : (7 - (sq >> 4)) * 8 + f;
      let sh = 0;
      for (let x = Math.max(f - 1, 0); x <= Math.min(f + 1, 7); x++) {
        const one = b[sq + dir - f + x], two = b[sq + 2 * dir - f + x], pawn = P | (c ? BLACK : 0);
        sh += one === pawn ? 12 : two === pawn ? 6 : -8;
      }
      if ((sq + dir) & 0x88) sh = 0;
      shield[c] = sh * phase / 24;
      s += w * ((k[i] * phase + e[i] * (24 - phase)) / 24 + shield[c]);
    }
    if (style) {
      const o = me ^ 1;
      if (style === "greedy") style_[0] += 0.5 * (mat[me] - mat[o]);
      else if (style === "careful") {
        style_[0] += shield[me] + 6 * (cnt[me].reduce((x, y) => x + y, 0));
        if (mat[me] < mat[o] - 100) style_[0] += 5 * pieces;
      } else if (style === "reckless" && g.turn !== me && g.inCheck()) style_[0] += 40;
      s += me ? -style_[0] : style_[0];
    }
    s += g.turn ? -10 : 10;
    return g.turn ? -s : s;
  }

  // transposition table, shared between searches and wiped at the start of each (styles change the scores)
  const TT_MASK = (1 << 18) - 1;
  let ttKey, ttMove, ttScore, ttDepth, ttFlag;
  const ttReset = () => {
    if (ttFlag) { ttFlag.fill(0); return; }
    ttKey = new Int32Array(TT_MASK + 1); ttMove = new Int32Array(TT_MASK + 1); ttScore = new Int32Array(TT_MASK + 1);
    ttDepth = new Int8Array(TT_MASK + 1); ttFlag = new Uint8Array(TT_MASK + 1);
  };
  const moveKey = (m) => m.from | m.to << 7 | (m.promo & 7) << 14;
  const INF = 1000000;

  // one search of the position in `game`, returning { move, score, depth, nodes }; the game is left as it was
  function run(game, cfg) {
    const strong = cfg.strong, style = cfg.style || "", me = game.turn, noise = cfg.noise || 0, margin = cfg.margin || 0;
    const deadline = Date.now() + cfg.ms;
    let nodes = 0, stop = false;
    const killers = new Int32Array(256), hist = new Int32Array(2048), path = new Int32Array(256);
    const fresh = strong || style;
    const evalNow = fresh ? () => evalPos(game, style, me) : () => game.evaluate();
    if (strong) ttReset();

    const rank = (moves, ttm, ply) => {
      for (const m of moves) {
        const k = moveKey(m);
        let s;
        if (k === ttm) s = 1e7;
        else if (m.captured) s = 1e6 + 10 * VALUE[m.captured & 7] - VALUE[m.piece & 7] + (m.promo ? VALUE[m.promo & 7] : 0);
        else if (m.promo) s = 9e5 + VALUE[m.promo & 7];
        else if (k === killers[ply << 1]) s = 8e5;
        else if (k === killers[ply << 1 | 1]) s = 7e5;
        else s = hist[m.piece << 7 | m.to];
        if (style === "greedy" && m.captured) s += 5e5;
        else if (style === "reckless" && !m.captured) s += 5000 - 300 * cheb(m.to, game.kings[me ^ 1]);
        m.s = s;
      }
      return moves.sort((a, b) => b.s - a.s);
    };

    function quiesce(alpha, beta, qd) {
      ++nodes;
      const stand = evalNow();
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qd > 6) return alpha;
      for (const m of rank(game.pseudo(true), 0, 0)) {
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

    function search(depth, alpha, beta, ply, nullOk) {
      if ((++nodes & 2047) === 0 && Date.now() > deadline) stop = true;
      if (stop) return 0;
      const inChk = game.inCheck();
      let ttm = 0;
      const pv = beta - alpha > 1;
      if (strong) {
        if (ply >= 120) return evalNow();
        if (game.half >= 100) return 0;
        const h = game.h1;
        for (let i = ply - 2; i >= 0; i -= 2) if (path[i] === h) return 0;
        path[ply] = h;
        if (inChk && ply < 60) depth++;
        if (depth > 0) {
          const i = h & TT_MASK;
          if (ttFlag[i] && ttKey[i] === game.h2) {
            ttm = ttMove[i];
            if (!pv && ttDepth[i] >= depth) {
              let sc = ttScore[i];
              if (sc > MATE - 200) sc -= ply; else if (sc < 200 - MATE) sc += ply;
              const f = ttFlag[i];
              if (f === 1 || (f === 2 && sc >= beta) || (f === 3 && sc <= alpha)) return sc;
            }
          }
        }
      }
      if (depth <= 0) return quiesce(alpha, beta, 0);
      // null move: if even passing the turn keeps the score above beta, this line is too good to be played
      if (strong && !pv && !inChk && nullOk && depth >= 3 && evalNow() >= beta) {
        let rich = false;
        const side = game.turn ? BLACK : 0;
        for (let sq = 0; sq < 128 && !rich; sq++) {
          if (sq & 0x88) { sq += 7; continue; }
          const p = game.board[sq];
          if (p && (p & BLACK) === side && (p & 7) > P && (p & 7) < K) rich = true;
        }
        if (rich) {
          const ep = game.ep, h1 = game.h1, h2 = game.h2;
          game.nullMake();
          const v = -search(depth - (depth > 6 ? 4 : 3), -beta, -beta + 1, ply + 1, false);
          game.nullUnmake(ep, h1, h2);
          if (stop) return 0;
          if (v >= beta) return v > MATE - 200 ? beta : v;
        }
      }
      const a0 = alpha;
      let any = false, best = -INF, bestMove = null, n = 0;
      for (const m of rank(game.pseudo(), ttm, ply)) {
        const us = game.turn;
        game.make(m);
        if (game.attacked(game.kings[us], us ^ 1)) { game.unmake(m); continue; }
        any = true; n++;
        const quiet = !m.captured && !m.promo;
        let v;
        if (!strong || n === 1) v = -search(depth - 1, -beta, -alpha, ply + 1, true);
        else {
          // later quiet moves are searched shallower first, and only looked at fully if they surprise
          const r = depth >= 3 && n > 4 && quiet && !inChk ? 1 + (n > 10 ? 1 : 0) : 0;
          v = -search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
          if (v > alpha && r) v = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
          if (v > alpha && v < beta) v = -search(depth - 1, -beta, -alpha, ply + 1, true);
        }
        game.unmake(m);
        if (stop) return 0;
        if (v > best) { best = v; bestMove = m; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) {
          if (quiet) {
            const k = moveKey(m);
            if (killers[ply << 1] !== k) { killers[ply << 1 | 1] = killers[ply << 1]; killers[ply << 1] = k; }
            const hi_ = m.piece << 7 | m.to;
            hist[hi_] += depth * depth;
            if (hist[hi_] > 4e5) for (let j = 0; j < 2048; j++) hist[j] >>= 1;
          }
          break;
        }
      }
      if (!any) return inChk ? -MATE + ply : 0;
      if (strong) {
        const i = game.h1 & TT_MASK;
        const sc = best > MATE - 200 ? best + ply : best < 200 - MATE ? best - ply : best;
        ttKey[i] = game.h2; ttMove[i] = bestMove ? moveKey(bestMove) : 0; ttScore[i] = sc; ttDepth[i] = depth;
        ttFlag[i] = best >= beta ? 2 : best > a0 ? 1 : 3;
      }
      return best;
    }

    const legal = game.moves();
    if (!legal.length) return { move: null, score: game.inCheck() ? -MATE : 0, depth: 0, nodes: 0 };
    rank(legal, 0, 0);
    let best = legal[0], bestScore = 0, done = 0;
    path[0] = game.h1;
    // iterative deepening: keep the best move of the last finished depth, and try it first at the next
    for (let d = 1; d <= cfg.depth; d++) {
      let alpha = -INF, choice = null, first = true;
      const ranked = [best, ...legal.filter((m) => m !== best).sort((a, b) => (b.rs ?? b.s) - (a.rs ?? a.s))];
      for (const m of ranked) {
        game.make(m);
        let v;
        if (strong && !noise && !margin && !first) {
          v = -search(d - 1, -alpha - 1, -alpha, 1, true);
          if (v > alpha) v = -search(d - 1, -INF, -alpha, 1, true);
        } else v = -search(d - 1, -INF, -(alpha - margin), 1, true);
        game.unmake(m);
        if (stop) break;
        first = false;
        m.rs = v;
        if (noise) v += Math.random() * 2 * noise - noise;
        if (style === "sleepy" && (m.captured || m.promo)) v -= 20;
        if (v > alpha) { alpha = v; choice = m; }
      }
      if (choice) { best = choice; bestScore = alpha; done = d; }
      if (stop || alpha > MATE - 200 || alpha < 200 - MATE) break;
    }
    delete best.s; delete best.rs;
    return { move: best, score: bestScore, depth: done, nodes };
  }

  // search(game, level, { style, ms }) -> { move, score, depth, nodes }
  function search(game, level = "normal", opts = {}) {
    const lv = LEVELS[level] || LEVELS.normal;
    const style = STYLES.includes(opts.style) ? opts.style : "";
    const sleepy = style === "sleepy";
    return run(game, {
      depth: sleepy ? Math.min(lv.depth, 4) : lv.depth, ms: opts.ms > 0 ? opts.ms : lv.ms, strong: lv.strong, style,
      noise: sleepy ? 35 : lv.noise || 0, margin: sleepy ? 70 : 0,
    });
  }
  function think(game, level = "normal", opts = {}) { return search(game, level, opts).move; }

  // how the side to move stands: best move and its score in centipawns (mate is about +-MATE), by time or fixed depth
  function analyse(game, { ms, depth } = {}) {
    const r = run(game, { depth: depth || 64, ms: ms > 0 ? ms : depth ? 600000 : 300, strong: true });
    return { move: r.move, score: r.score, depth: r.depth };
  }

  function perft(game, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of game.moves()) { game.make(m); n += perft(game, depth - 1); game.unmake(m); }
    return n;
  }

  root.ChessEngine = { Game, think, search, analyse, MATE, perft, name, parse, START, P, N, B, R, Q, K, BLACK, VALUE, F_CAPTURE, F_EP, F_KCASTLE, F_QCASTLE, F_PROMO };
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
