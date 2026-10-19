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
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
};
const newToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const cleanName = (s) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 20) || "a friend";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const h = cors(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });

    // POST /rooms: open a new room and hand back its code
    if (url.pathname === "/rooms" && req.method === "POST") {
      if (!allowedOrigin(env, req.headers.get("origin"))) return json({ error: "origin not allowed" }, 403);
      for (let i = 0; i < 5; i++) {
        const code = newCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch("https://room/init", { method: "POST" });
        if (r.status === 201) return json({ code }, 201, h);
      }
      return json({ error: "could not open a room, try again" }, 503, h);
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
      this.data = { open: true, players: [], moves: [], result: null, rematch: [], created: Date.now(), touched: Date.now() };
      await this.save();
      return new Response("ok", { status: 201 });
    }
    const d = await this.load();
    if (!d) return json({ error: "no such room" }, 404);
    if (url.pathname === "/info") {
      return json({ players: d.players.map((p) => ({ name: p.name, color: p.color })), moves: d.moves.length, result: d.result, full: d.players.length >= 2 });
    }
    if (url.pathname === "/ws") {
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
    const d = await this.load();
    if (!d) return this.send(ws, { t: "error", msg: "no such room" });

    if (msg.t === "hello") {
      // a returning player keeps their seat; a newcomer takes a free seat; everyone else watches
      let seat = typeof msg.token === "string" ? d.players.find((p) => p.token === msg.token) : null;
      if (seat && msg.name) seat.name = cleanName(msg.name);
      if (!seat && d.players.length < 2) {
        const color = d.players.length === 0 ? (crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? "w" : "b") : (d.players[0].color === "w" ? "b" : "w");
        seat = { token: newToken(), name: cleanName(msg.name), color };
        d.players.push(seat);
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
    if (await this.load()) this.broadcast(this.snapshot(ws), ws);
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }
}
