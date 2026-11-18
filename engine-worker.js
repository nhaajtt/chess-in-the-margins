/* Thinks about moves off the page's main thread. Asked with { id, fen, level, style, ms, analyse }, answers { id, move, score, depth }. */
importScripts("/engine.js");
const E = self.ChessEngine;

self.onmessage = (e) => {
  const { id, fen, level, style, ms, analyse } = e.data || {};
  try {
    const game = new E.Game(fen);
    const r = analyse ? E.analyse(game, { ms }) : E.search(game, level, { style, ms });
    const m = r.move;
    self.postMessage({ id, move: m ? { from: m.from, to: m.to, promo: m.promo || 0 } : null, score: r.score, depth: r.depth });
  } catch (err) {
    self.postMessage({ id, move: null, score: 0, depth: 0, error: String(err && err.message || err) });
  }
};
