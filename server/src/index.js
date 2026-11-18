// Online rooms for Chess in the margins.
// Each room is one Durable Object. It keeps the real game, checks every move with the same engine
// the browser uses, and talks to the players and spectators over WebSockets.
import "../../engine.js";

const { Game } = globalThis.ChessEngine;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no O/0, I/1, L
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const ROOM_TTL = 24 * 3600 * 1000; // a room is cleared a day after anyone last touched it
const MAX_MSG = 600; // bytes
const RATE = { per: 1000, max: 12 }; // messages per second per socket
const EMOTES = new Set(["wave", "laugh", "grr", "yawn", "love", "shock"]);
const MATCH_TTL = 60 * 1000; // a room waiting for a stranger is offered for a minute, then forgotten
const MAX_WAITING = 50; // never more than this many rooms waiting at once
const MAX_BODY = 256; // bytes a match request may carry
const MAX_SOCKETS = 64; // two players and a small crowd; more than that is someone hammering the room

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

function allowedOrigin(env, origin) {
  if (!origin) return false;
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).includes(origin);
}
function cors(env, req) {
  const origin = req.headers.get("origin");
  return allowedOrigin(env, origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type", vary: "origin" }
    : {};
}
const newCode = () => {
  // byte values past the last full run of the alphabet are drawn again, so every letter is equally likely
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < 6) for (const b of crypto.getRandomValues(new Uint8Array(8))) if (b < limit && code.length < 6) code += ALPHABET[b % ALPHABET.length];
  return code;
};
const newToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
// no control characters, and no invisible or direction-flipping ones that could dress a name up as someone else's
const cleanName = (s) =>
  (typeof s === "string" ? s : "")
    .replace(/[\u0000-\u001f\u007f-\u009f<>\u00ad\u061c\u115f\u1160\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufeff\uffa0\ufff0-\uffff]/g, "")
    .trim().slice(0, 20).trim() || "a friend";

// a short, one-way tag for the visitor's address: enough to tell two visitors apart for a minute, not enough to read back
async function visitorTag(ip) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("match:" + ip)));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    // POST /rooms: open a new room and hand back its code
    if (url.pathname === "/rooms" && req.method === "POST") {
      if (!allowedOrigin(env, req.headers.get("origin"))) return json({ error: "origin not allowed" }, 403);
      // a few new rooms a minute per address is plenty for people; more is a script filling up storage
      if (env.OPEN_LIMIT) {
        const { success } = await env.OPEN_LIMIT.limit({ key: req.headers.get("cf-connecting-ip") || "unknown" });
        if (!success) return json({ error: "too many new rooms, wait a minute" }, 429, h);
      }
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch("https://room/init", { method: "POST" });
        if (r.status === 201) return json({ code }, 201, h);
      }
      return json({ error: "could not open a room, try again" }, 503, h);
    }

    // POST /match: sit down with a waiting stranger, or open a room and wait for one
    if (url.pathname === "/match") {
      if (req.method !== "POST") return json({ error: "use POST" }, 405, h);
      if (!allowedOrigin(env, req.headers.get("origin"))) return json({ error: "origin not allowed" }, 403);
      // the body is optional and ignored, but anything that is not a small JSON object is turned away
      if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ error: "request too big" }, 413, h);
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: "request too big" }, 413, h);
      if (text.trim()) {
        let body;
        try { body = JSON.parse(text); } catch { body = null; }
        if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "bad request" }, 400, h);
      }
      const ip = req.headers.get("cf-connecting-ip") || "unknown";
      if (env.OPEN_LIMIT) {
        const { success } = await env.OPEN_LIMIT.limit({ key: ip });
        if (!success) return json({ error: "too many tries, wait a minute" }, 429, h);
      }
      if (!env.LOBBY) return json({ error: "matching is not available" }, 503, h);
      const lobby = env.LOBBY.get(env.LOBBY.idFromName("lobby"));
      const r = await lobby.fetch("https://lobby/match", { method: "POST", body: JSON.stringify({ visitor: await visitorTag(ip) }) });
      return new Response(r.body, { status: r.status, headers: { "content-type": "application/json; charset=utf-8", ...h } });
    }

    const m = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})(\/ws)?$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!CODE.test(code)) return json({ error: "no such room" }, 404, h);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      if (m[2]) {
        // the WebSocket: only from the game's own pages
        if (req.headers.get("upgrade") !== "websocket") return json({ error: "expected a websocket" }, 426);
        if (!allowedOrigin(env, req.headers.get("origin"))) return json({ error: "origin not allowed" }, 403);
        return stub.fetch("https://room/ws", req);
      }
      const r = await stub.fetch("https://room/info");
      return new Response(r.body, { status: r.status, headers: { ...Object.fromEntries(r.headers), ...h } });
    }
    return json({ ok: true, service: "chess-in-the-margins rooms" }, 200, h);
  },
};

// The lobby: a short list of rooms that have one player waiting for a stranger.
// It holds a room code, a one-way tag for who opened it and a time, for a minute at most.
// It is reachable only through the Worker and the rooms, never from outside.
export class Lobby {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.q = null; // [{ code, visitor, at }]
    this.ready = new WeakMap(); // room still being opened -> promise
  }
  async load() {
    if (!this.q) this.q = (await this.state.storage.get("q")) || [];
    const now = Date.now();
    this.q = this.q.filter((e) => now - e.at < MATCH_TTL);
    return this.q;
  }
  async save() {
    const keep = this.q.filter((e) => e.code);
    await this.state.storage.put("q", keep);
    if (keep.length) await this.state.storage.setAlarm(keep[0].at + MATCH_TTL + 1000);
  }
  async alarm() { await this.load(); await this.save(); }

  async fetch(req) {
    if (req.method !== "POST") return json({ error: "not found" }, 404);
    const path = new URL(req.url).pathname;
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
    await this.load();
    if (path === "/filled" || path === "/left") {
      // the room says its waiting player is gone or a second one has sat down: stop offering it
      if (body && typeof body.code === "string") { this.q = this.q.filter((e) => e.code !== body.code); await this.save(); }
      return json({ ok: true });
    }
    if (path !== "/match" || !body || typeof body.visitor !== "string" || !/^[0-9a-f]{16}$/.test(body.visitor)) return json({ error: "bad request" }, 400);
    return this.match(body.visitor);
  }

  async match(visitor) {
    // someone else's waiting room first; never the visitor's own
    for (;;) {
      const e = this.q.find((x) => x.visitor !== visitor);
      if (!e) break;
      this.q = this.q.filter((x) => x !== e);
      const ok = this.ready.has(e) ? await this.ready.get(e) : true;
      if (!ok || !e.code) continue;
      this.q = this.q.filter((x) => x.visitor !== visitor); // they found a game, so their own waiting room is not needed
      await this.save();
      return json({ code: e.code });
    }
    // asking again while still waiting gives back the same room
    const own = this.q.find((x) => x.visitor === visitor);
    if (own) {
      if (this.ready.has(own) && !(await this.ready.get(own))) return json({ error: "could not open a room, try again" }, 503);
      return json({ code: own.code, waiting: true });
    }
    if (this.q.length >= MAX_WAITING) return json({ error: "busy, try again in a moment" }, 503);
    const entry = { code: null, visitor, at: Date.now() };
    this.q.push(entry);
    const opening = (async () => {
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const stub = this.env.ROOMS.get(this.env.ROOMS.idFromName(code));
        const r = await stub.fetch("https://room/init", { method: "POST", body: JSON.stringify({ match: true, code }) });
        if (r.status === 201) { entry.code = code; return true; }
      }
      return false;
    })();
    this.ready.set(entry, opening);
    let ok = false;
    try { ok = await opening; } catch { ok = false; }
    if (!ok) { this.q = this.q.filter((x) => x !== entry); return json({ error: "could not open a room, try again" }, 503); }
    await this.save();
    return json({ code: entry.code, waiting: true });
  }
}

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.data = null; // { open, players: [{token, name, color}], moves: [{from,to,promo}], result, rematch: [] , touched }
  }

  async load() {
    if (!this.data) this.data = (await this.state.storage.get("room")) || null;
    return this.data;
  }
  async save() {
    this.data.touched = Date.now();
    await this.state.storage.put("room", this.data);
    await this.state.storage.setAlarm(Date.now() + ROOM_TTL);
  }
  async alarm() {
    const d = await this.load();
    if (d && Date.now() - d.touched < ROOM_TTL - 1000) { await this.state.storage.setAlarm(d.touched + ROOM_TTL); return; }
    for (const ws of this.state.getWebSockets()) try { ws.close(1000, "room expired"); } catch { /* gone */ }
    await this.state.storage.deleteAll();
    this.data = null;
  }

  game() {
    const g = new Game();
    for (const mv of this.data.moves) {
      const m = g.moves().find((x) => x.from === mv.from && x.to === mv.to && (x.promo || 0) === (mv.promo || 0));
      if (!m) break;
      g.play(m);
    }
    return g;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/init") {
      if (await this.load()) return new Response("taken", { status: 409 });
      let opts = null;
      try { opts = await req.json(); } catch { /* no body: an ordinary room */ }
      const match = Boolean(opts && opts.match === true && typeof opts.code === "string" && CODE.test(opts.code));
      this.data = { open: true, ...(match ? { match: true, code: opts.code } : {}), players: [], moves: [], result: null, rematch: [], created: Date.now(), touched: Date.now() };
      await this.save();
      return new Response("ok", { status: 201 });
    }
    const d = await this.load();
    if (!d) return json({ error: "no such room" }, 404);
    if (url.pathname === "/info") {
      return json({ players: d.players.map((p) => ({ name: p.name, color: p.color })), moves: d.moves.length, result: d.result, full: d.players.length >= 2 });
    }
    if (url.pathname === "/ws") {
      if (this.state.getWebSockets().length >= MAX_SOCKETS) return json({ error: "this room is full" }, 503);
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ token: null, color: null, name: null, hits: [] });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return json({ error: "not found" }, 404);
  }

  // what everyone in the room is told
  // gone: a socket that is closing and must not count as present
  snapshot(gone) {
    const live = this.state.getWebSockets().filter((ws) => ws !== gone);
    const online = new Set(live.map((ws) => ws.deserializeAttachment().color).filter(Boolean));
    return {
      t: "state",
      players: this.data.players.map((p) => ({ name: p.name, color: p.color, online: online.has(p.color) })),
      moves: this.data.moves,
      result: this.data.result,
      rematch: this.data.rematch,
      drawOffer: this.data.drawOffer || null,
      spectators: live.filter((ws) => ws.deserializeAttachment().color === "spectator").length,
    };
  }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) if (ws !== except) try { ws.send(s); } catch { /* closed */ }
  }
  // a matchmaking room tells the lobby when it stops waiting; a missed message only means the entry expires on its own
  async tellLobby(path) {
    const d = this.data;
    if (!d || !d.match || !this.env.LOBBY) return;
    try { await this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby")).fetch("https://lobby" + path, { method: "POST", body: JSON.stringify({ code: d.code }) }); } catch { /* lobby busy */ }
  }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return this.send(ws, { t: "error", msg: "message too big" });
    const att = ws.deserializeAttachment();
    const now = Date.now();
    att.hits = (att.hits || []).filter((x) => now - x < RATE.per);
    if (att.hits.length >= RATE.max) return this.send(ws, { t: "error", msg: "slow down" });
    att.hits.push(now);
    ws.serializeAttachment(att);
    let msg;
    try { msg = JSON.parse(raw); } catch { return this.send(ws, { t: "error", msg: "bad message" }); }
    if (!msg || typeof msg !== "object" || Array.isArray(msg) || typeof msg.t !== "string") return this.send(ws, { t: "error", msg: "bad message" });
    const d = await this.load();
    if (!d) return this.send(ws, { t: "error", msg: "no such room" });

    if (msg.t === "hello") {
      // a returning player keeps their seat; a newcomer takes a free seat; everyone else watches
      // a socket that has already said hello keeps what it got, so saying it twice never takes the second seat too
      const byToken = (t) => (typeof t === "string" && d.players.find((p) => p.token === t)) || null;
      let seat = byToken(msg.token) || byToken(att.token);
      if (seat && msg.name) seat.name = cleanName(msg.name);
      if (!seat && !att.color && d.players.length < 2) {
        const color = d.players.length === 0 ? (crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? "w" : "b") : (d.players[0].color === "w" ? "b" : "w");
        seat = { token: newToken(), name: cleanName(msg.name), color };
        d.players.push(seat);
        if (d.players.length === 2) await this.tellLobby("/filled");
      }
      att.token = seat ? seat.token : null;
      att.color = seat ? seat.color : "spectator";
      att.name = seat ? seat.name : cleanName(msg.name);
      ws.serializeAttachment(att);
      await this.save();
      this.send(ws, { t: "welcome", token: seat ? seat.token : null, you: att.color });
      this.broadcast(this.snapshot());
      return;
    }
    if (!att.color) return this.send(ws, { t: "error", msg: "say hello first" });

    if (msg.t === "emote") {
      if (!EMOTES.has(msg.e) || att.color === "spectator") return;
      this.broadcast({ t: "emote", color: att.color, e: msg.e });
      return;
    }
    if (att.color === "spectator") return this.send(ws, { t: "error", msg: "spectators only watch" });

    if (msg.t === "move") {
      if (d.result) return this.send(ws, { t: "error", msg: "the game is over" });
      if (d.players.length < 2) return this.send(ws, { t: "error", msg: "wait for your friend" });
      const g = this.game();
      if ((g.turn ? "b" : "w") !== att.color) return this.send(ws, { t: "error", msg: "not your turn" });
      const promo = Number(msg.promo) || 0;
      const m = g.moves().find((x) => x.from === msg.from && x.to === msg.to && (x.promo || 0) === promo);
      if (!m) return this.send(ws, { t: "error", msg: "that move is not allowed" });
      const san = g.play(m);
      d.moves.push({ from: m.from, to: m.to, promo: m.promo || 0 });
      d.drawOffer = null;
      const st = g.status();
      if (st.over) d.result = { result: st.result, reason: st.reason };
      await this.save();
      this.broadcast({ t: "move", from: m.from, to: m.to, promo: m.promo || 0, san, ply: d.moves.length, result: d.result });
      return;
    }
    if ((msg.t === "resign" || msg.t === "draw") && d.players.length < 2) return this.send(ws, { t: "error", msg: "wait for your friend" });
    if (msg.t === "resign") {
      if (d.result) return;
      d.result = { result: att.color === "w" ? "0-1" : "1-0", reason: "resigned" };
      await this.save();
      this.broadcast(this.snapshot());
      return;
    }
    if (msg.t === "draw") {
      if (d.result) return;
      if (d.drawOffer && d.drawOffer !== att.color) { d.result = { result: "1/2-1/2", reason: "agreement" }; d.drawOffer = null; }
      else d.drawOffer = att.color;
      await this.save();
      this.broadcast(this.snapshot());
      return;
    }
    if (msg.t === "rematch") {
      if (!d.result) return;
      if (!d.rematch.includes(att.color)) d.rematch.push(att.color);
      if (d.rematch.length === 2) {
        // swap colours and start again
        d.players.forEach((p) => { p.color = p.color === "w" ? "b" : "w"; });
        for (const s of this.state.getWebSockets()) {
          const a = s.deserializeAttachment();
          const p = d.players.find((x) => x.token === a.token);
          if (p) { a.color = p.color; s.serializeAttachment(a); this.send(s, { t: "welcome", token: p.token, you: p.color }); }
        }
        d.moves = []; d.result = null; d.rematch = []; d.drawOffer = null;
      }
      await this.save();
      this.broadcast(this.snapshot());
      return;
    }
    this.send(ws, { t: "error", msg: "unknown message" });
  }

  async webSocketClose(ws) {
    try { ws.close(1000, "bye"); } catch { /* already closed */ }
    if (await this.load()) {
      this.broadcast(this.snapshot(ws), ws);
      // the only player has gone: do not send a stranger to an empty room
      const d = this.data;
      if (d.match && d.players.length === 1) {
        const here = this.state.getWebSockets().some((s) => s !== ws && s.deserializeAttachment().color === d.players[0].color);
        if (!here) await this.tellLobby("/left");
      }
    }
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }
}
