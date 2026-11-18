// Online rooms for Chess in the margins.
// Each room is one Durable Object. It keeps the real game, checks every move with the same engine
// the browser uses, and talks to the players and spectators over WebSockets.
import "../../engine.js";

const { Game } = globalThis.ChessEngine;

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no O/0, I/1, L
const CODE = /^[A-HJ-NP-Z2-9]{6}$/;
const ROOM_TTL = 24 * 3600 * 1000; // a room is cleared a day after anyone last touched it
const IDLE_TTL = 2 * 3600 * 1000; // a room nobody has sat down in is cleared after two hours
const MAX_MSG = 600; // bytes
const RATE = { per: 1000, max: 12 }; // messages per second per socket
const ROOM_RATE = { per: 1000, max: 40 }; // messages per second for the whole room, however many sockets
const MAX_STRIKES = 20; // a socket told to slow down this many times is hung up on; no honest page does that
const MAX_PLIES = 600; // a game still going after 300 moves each is called a draw, so a room cannot grow without end
const EMOTES = new Set(["wave", "laugh", "grr", "yawn", "love", "shock"]);
const MATCH_TTL = 60 * 1000; // a room waiting for a stranger is offered for a minute, then forgotten
const MAX_WAITING = 50; // never more than this many rooms waiting at once
const MAX_BODY = 256; // bytes a match request may carry
const MAX_SOCKETS = 64; // two players and a small crowd; more than that is someone hammering the room

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers } });

function allowedOrigin(env, origin) {
  // no list set means nobody is allowed, never everybody
  if (!origin || typeof env.ALLOWED_ORIGINS !== "string") return false;
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
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
// the key a visitor is counted under. An IPv4 address counts as itself; an IPv6 visitor controls a whole /64
// (the first four groups), so every address inside one /64 is the same visitor
function ipKey(ip) {
  if (typeof ip !== "string" || !ip) return "unknown";
  const a = ip.trim().split("%")[0].toLowerCase();
  const mapped = a.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!a.includes(":")) return a.slice(0, 45);
  const halves = a.split("::");
  if (halves.length > 2) return "v6:bad";
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  let groups = left;
  if (halves.length === 2) {
    const gap = 8 - left.length - right.length;
    if (gap < 1) return "v6:bad";
    groups = [...left, ...Array(gap).fill("0"), ...right];
  }
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return "v6:bad";
  return "v6:" + groups.slice(0, 4).map((g) => g.padStart(4, "0")).join(":");
}
// two tokens are compared in the same time whichever characters differ
function sameToken(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
// reads a request body but never more than max bytes, even when the sender does not say how long it is
async function readLimited(req, max) {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { try { await reader.cancel(); } catch { /* gone */ } return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.byteLength; }
  return new TextDecoder().decode(all);
}

// no control characters, and no invisible or direction-flipping ones that could dress a name up as someone else's;
// no half-written emoji (lone surrogates), no towers of stacked accents, and a name is cut by whole characters
const BAD_NAME = /[\u0000-\u001f\u007f-\u009f<>\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180e\u200b-\u200f\u2028-\u202e\u2060-\u206f\u3164\ufe00\ufeff\uffa0\ufff0-\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]|[\u{e0000}-\u{e01ef}]/gu;
const cleanName = (s) =>
  [...(typeof s === "string" ? s.slice(0, 200) : "").replace(BAD_NAME, "").replace(/(\p{M}{2})\p{M}+/gu, "$1").replace(/\s+/g, " ").trim()]
    .slice(0, 20).join("").trim() || "a friend";

// a short, one-way tag for the visitor: enough to tell two visitors apart for a minute. With a TAG_SECRET set on the
// Worker the tag cannot be worked back to an address; without one it is a plain hash and lives a minute at most
async function visitorTag(env, ip) {
  const data = new TextEncoder().encode("match:" + ipKey(ip));
  let bytes;
  if (env && typeof env.TAG_SECRET === "string" && env.TAG_SECRET) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TAG_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  } else bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
// one place that counts a request against a limit: a missing binding (local testing) lets everything through
async function allowed(binding, key) {
  if (!binding) return true;
  try { return (await binding.limit({ key })).success; } catch { return true; }
}

export default {
  async fetch(req, env) {
    try {
      return await route(req, env);
    } catch {
      // never show the inside of a failure; the page just sees a plain error it can retry
      return json({ error: "something went wrong, try again" }, 500, cors(env, req));
    }
  },
};

async function route(req, env) {
  const url = new URL(req.url);
  const h = cors(env, req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  const origin = req.headers.get("origin");
  const who = ipKey(req.headers.get("cf-connecting-ip"));

  // POST /rooms: open a new room and hand back its code
  if (url.pathname === "/rooms") {
    if (req.method !== "POST") return json({ error: "use POST" }, 405, { ...h, allow: "POST, OPTIONS" });
    if (!allowedOrigin(env, origin)) return json({ error: "origin not allowed" }, 403);
    // a few new rooms a minute per visitor is plenty for people; more is a script filling up storage
    if (!(await allowed(env.OPEN_LIMIT, who))) return json({ error: "too many new rooms, wait a minute" }, 429, h);
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
    if (req.method !== "POST") return json({ error: "use POST" }, 405, { ...h, allow: "POST, OPTIONS" });
    if (!allowedOrigin(env, origin)) return json({ error: "origin not allowed" }, 403);
    // the body is optional and ignored, but anything that is not a small JSON object is turned away
    if (Number(req.headers.get("content-length") || 0) > MAX_BODY) return json({ error: "request too big" }, 413, h);
    const text = await readLimited(req, MAX_BODY);
    if (text === null) return json({ error: "request too big" }, 413, h);
    if (text.trim()) {
      let body;
      try { body = JSON.parse(text); } catch { body = null; }
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "bad request" }, 400, h);
    }
    if (!(await allowed(env.OPEN_LIMIT, who))) return json({ error: "too many tries, wait a minute" }, 429, h);
    if (!env.LOBBY) return json({ error: "matching is not available" }, 503, h);
    const lobby = env.LOBBY.get(env.LOBBY.idFromName("lobby"));
    const r = await lobby.fetch("https://lobby/match", { method: "POST", body: JSON.stringify({ visitor: await visitorTag(env, req.headers.get("cf-connecting-ip")) }) });
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...h } });
  }

  const m = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{6})(\/ws)?$/);
  if (m) {
    const code = m[1].toUpperCase();
    if (req.method !== "GET" && req.method !== "HEAD") return json({ error: "use GET" }, 405, { ...h, allow: "GET, HEAD, OPTIONS" });
    // both the room page and the WebSocket come from the game's own pages only, and both are counted per visitor
    // (a looser count than opening rooms: a page may ask a few times a minute, and a reconnect is a new request)
    if (!allowedOrigin(env, origin)) return json({ error: "origin not allowed" }, 403);
    if (!CODE.test(code)) return json({ error: "no such room" }, 404, h);
    if (!(await allowed(env.PROBE_LIMIT, who))) return json({ error: "too many tries, wait a minute" }, 429, h);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (m[2]) {
      if ((req.headers.get("upgrade") || "").toLowerCase() !== "websocket") return json({ error: "expected a websocket" }, 426, h);
      return stub.fetch("https://room/ws", req);
    }
    const r = await stub.fetch("https://room/info");
    return new Response(r.body, { status: r.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...h } });
  }
  return json({ ok: true, service: "chess-in-the-margins rooms" }, 200, h);
}

// The lobby: a short list of rooms that have one player waiting for a stranger.
// It holds a room code, a one-way tag for who opened it, whether that person is connected right now, and a time,
// for a minute at most. A room is only offered while its owner is connected.
// It is reachable only through the Worker and the rooms, never from outside.
export class Lobby {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.q = null; // [{ code, visitor, at, live }]
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
    if (path === "/filled" || path === "/left" || path === "/waiting") {
      if (!body || typeof body !== "object" || typeof body.code !== "string" || !CODE.test(body.code)) return json({ error: "bad request" }, 400);
      if (path === "/filled") this.q = this.q.filter((e) => e.code !== body.code); // a second one has sat down: stop offering it
      else for (const e of this.q) if (e.code === body.code) e.live = path === "/waiting"; // the owner is here, or has dropped off
      await this.save();
      return json({ ok: true });
    }
    if (path !== "/match" || !body || typeof body.visitor !== "string" || !/^[0-9a-f]{16}$/.test(body.visitor)) return json({ error: "bad request" }, 400);
    return this.match(body.visitor);
  }

  async match(visitor) {
    // someone else's waiting room first, and only one whose owner is connected right now; never the visitor's own
    for (;;) {
      const e = this.q.find((x) => x.visitor !== visitor && x.code && x.live === true);
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
    const entry = { code: null, visitor, at: Date.now(), live: false };
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
    this.g = null; // the game as played so far, kept in memory so a move does not replay the whole list
    this.roomHits = []; // when the last few messages arrived, from any socket
  }

  async load() {
    if (!this.data) this.data = (await this.state.storage.get("room")) || null;
    return this.data;
  }
  // a room with nobody seated is forgotten sooner than one with players
  ttl() { return this.data && this.data.players.length ? ROOM_TTL : IDLE_TTL; }
  async save() {
    this.data.touched = Date.now();
    await this.state.storage.put("room", this.data);
    await this.state.storage.setAlarm(Date.now() + this.ttl());
  }
  async alarm() {
    const d = await this.load();
    if (d && Date.now() - d.touched < this.ttl() - 1000) { await this.state.storage.setAlarm(d.touched + this.ttl()); return; }
    for (const ws of this.state.getWebSockets()) try { ws.close(1000, "room expired"); } catch { /* gone */ }
    await this.state.storage.deleteAll();
    this.data = null;
    this.g = null;
  }

  game() {
    const n = this.data.moves.length;
    if (this.g && this.g.played.length === n) return this.g;
    const g = new Game();
    for (const mv of this.data.moves) {
      const m = g.moves().find((x) => x.from === mv.from && x.to === mv.to && (x.promo || 0) === (mv.promo || 0));
      if (!m) break;
      g.play(m);
    }
    this.g = g;
    return g;
  }

  // a socket that has said nothing useful (no seat, or only watching) can be let go to make room for a player
  makeRoom() {
    const all = this.state.getWebSockets();
    if (all.length < MAX_SOCKETS) return true;
    // a watcher goes first; a socket that has not said hello yet may be a player on the way in, so it goes last
    const seat = (ws) => (ws.deserializeAttachment() || {}).color;
    const idle = all.find((ws) => seat(ws) === "spectator") || all.find((ws) => !seat(ws));
    if (!idle) return false;
    try { idle.close(1013, "room is busy"); } catch { /* gone */ }
    return true;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/init") {
      if (await this.load()) return new Response("taken", { status: 409 });
      let opts = null;
      try { opts = await req.json(); } catch { /* no body: an ordinary room */ }
      const match = Boolean(opts && typeof opts === "object" && opts.match === true && typeof opts.code === "string" && CODE.test(opts.code));
      this.data = { open: true, ...(match ? { match: true, code: opts.code } : {}), players: [], moves: [], result: null, rematch: [], created: Date.now(), touched: Date.now() };
      this.g = null;
      await this.save();
      return new Response("ok", { status: 201 });
    }
    const d = await this.load();
    if (!d) return json({ error: "no such room" }, 404);
    if (url.pathname === "/info") {
      return json({ players: d.players.map((p) => ({ name: p.name, color: p.color })), moves: d.moves.length, result: d.result, full: d.players.length >= 2 });
    }
    if (url.pathname === "/ws") {
      if (!this.makeRoom()) return json({ error: "this room is full" }, 503);
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ token: null, color: null, name: null, hits: [], strikes: 0 });
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return json({ error: "not found" }, 404);
  }

  // what everyone in the room is told
  // gone: a socket that is closing and must not count as present
  snapshot(gone) {
    const live = this.state.getWebSockets().filter((ws) => ws !== gone);
    const online = new Set(live.map((ws) => (ws.deserializeAttachment() || {}).color).filter(Boolean));
    return {
      t: "state",
      players: this.data.players.map((p) => ({ name: p.name, color: p.color, online: online.has(p.color) })),
      moves: this.data.moves,
      result: this.data.result,
      rematch: this.data.rematch,
      drawOffer: this.data.drawOffer || null,
      spectators: live.filter((ws) => (ws.deserializeAttachment() || {}).color === "spectator").length,
    };
  }
  broadcast(msg, except) {
    const s = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) if (ws !== except) try { ws.send(s); } catch { /* closed */ }
  }
  // a matchmaking room tells the lobby when its owner is waiting here, and when it stops waiting; a missed message
  // only means the entry is not offered, or expires on its own
  async tellLobby(path) {
    const d = this.data;
    if (!d || !d.match || !this.env.LOBBY) return;
    try { await this.env.LOBBY.get(this.env.LOBBY.idFromName("lobby")).fetch("https://lobby" + path, { method: "POST", body: JSON.stringify({ code: d.code }) }); } catch { /* lobby busy */ }
  }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch { /* closed */ } }
  hangUp(ws, code, why) { try { ws.close(code, why); } catch { /* already closed */ } }

  async webSocketMessage(ws, raw) {
    // bytes, not characters: a character can take up to three bytes. Anything far past the limit is not a game page
    if (typeof raw !== "string") return this.send(ws, { t: "error", msg: "message too big" });
    if (raw.length > MAX_MSG || (raw.length > MAX_MSG / 3 && new TextEncoder().encode(raw).length > MAX_MSG)) {
      this.send(ws, { t: "error", msg: "message too big" });
      if (raw.length > MAX_MSG * 4) this.hangUp(ws, 1009, "message too big");
      return;
    }
    const att = ws.deserializeAttachment() || { token: null, color: null, name: null, hits: [] };
    const now = Date.now();
    // the whole room has a budget too, so many sockets cannot add up to a flood
    this.roomHits = this.roomHits.filter((x) => now - x < ROOM_RATE.per);
    att.hits = (att.hits || []).filter((x) => now - x < RATE.per);
    // a full room budget only drops the message: the strike is for the socket that is itself too fast,
    // so a crowd saying hello at once after a restart is not hung up on
    // (the dropped message still counts against the sender's own rate, so one that keeps shouting is caught below)
    if (att.hits.length < RATE.max && this.roomHits.length >= ROOM_RATE.max) {
      att.hits.push(now);
      ws.serializeAttachment(att);
      return this.send(ws, { t: "error", msg: "slow down" });
    }
    if (att.hits.length >= RATE.max) {
      att.strikes = (att.strikes || 0) + 1;
      ws.serializeAttachment(att);
      if (att.strikes > MAX_STRIKES) return this.hangUp(ws, 1008, "too fast");
      return this.send(ws, { t: "error", msg: "slow down" });
    }
    att.hits.push(now);
    this.roomHits.push(now);
    ws.serializeAttachment(att);
    let msg;
    try { msg = JSON.parse(raw); } catch { return this.send(ws, { t: "error", msg: "bad message" }); }
    if (!msg || typeof msg !== "object" || Array.isArray(msg) || typeof msg.t !== "string") return this.send(ws, { t: "error", msg: "bad message" });
    try {
      await this.handle(ws, att, msg);
    } catch {
      // storage failed half way: forget what is in memory so the next message starts from what was really saved
      this.data = null;
      this.g = null;
      this.send(ws, { t: "error", msg: "something went wrong, try again" });
    }
  }

  async handle(ws, att, msg) {
    const d = await this.load();
    if (!d) return this.send(ws, { t: "error", msg: "no such room" });

    if (msg.t === "hello") {
      // a returning player keeps their seat; a newcomer takes a free seat; everyone else watches
      // a socket that has already said hello keeps what it got, so saying it twice never takes the second seat too
      // every seat is looked at, so a wrong guess and a right one take the same time
      const byToken = (t) => { let found = null; for (const p of d.players) if (sameToken(p.token, t)) found = p; return found; };
      let seat = byToken(msg.token) || byToken(att.token);
      let changed = false;
      if (seat && typeof msg.name === "string" && msg.name) {
        const name = cleanName(msg.name);
        if (name !== seat.name) { seat.name = name; changed = true; }
      }
      if (!seat && !att.color && d.players.length < 2) {
        const color = d.players.length === 0 ? (crypto.getRandomValues(new Uint8Array(1))[0] & 1 ? "w" : "b") : (d.players[0].color === "w" ? "b" : "w");
        seat = { token: newToken(), name: cleanName(msg.name), color };
        d.players.push(seat);
        changed = true;
        if (d.players.length === 2) await this.tellLobby("/filled");
      }
      att.token = seat ? seat.token : null;
      att.color = seat ? seat.color : "spectator";
      att.name = seat ? seat.name : cleanName(msg.name);
      const tell = Boolean(d.match && d.players.length === 1 && seat && !att.told);
      if (tell) att.told = true; // once per socket, so saying hello again does not keep waking the lobby
      // saying hello again changes nothing, so it costs no write; it only keeps an old room alive about once an hour
      if (changed || Date.now() - d.touched > 3600 * 1000) await this.save();
      ws.serializeAttachment(att);
      this.send(ws, { t: "welcome", token: seat ? seat.token : null, you: att.color });
      this.broadcast(this.snapshot());
      // the one player of a matchmaking room is here: it can be offered to a stranger
      if (tell) await this.tellLobby("/waiting");
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
      // squares are whole numbers and a promotion is a small whole number; anything else is not a move
      const promo = msg.promo === undefined || msg.promo === null ? 0 : msg.promo;
      if (!Number.isInteger(msg.from) || !Number.isInteger(msg.to) || !Number.isInteger(promo)) return this.send(ws, { t: "error", msg: "that move is not allowed" });
      const m = g.moves().find((x) => x.from === msg.from && x.to === msg.to && (x.promo || 0) === promo);
      if (!m) return this.send(ws, { t: "error", msg: "that move is not allowed" });
      const san = g.play(m);
      d.moves.push({ from: m.from, to: m.to, promo: m.promo || 0 });
      d.drawOffer = null;
      const st = g.status();
      if (st.over) d.result = { result: st.result, reason: st.reason };
      else if (d.moves.length >= MAX_PLIES) d.result = { result: "1/2-1/2", reason: "move limit" };
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
          const p = a && d.players.find((x) => sameToken(x.token, a.token));
          if (p) { a.color = p.color; s.serializeAttachment(a); this.send(s, { t: "welcome", token: p.token, you: p.color }); }
        }
        d.moves = []; d.result = null; d.rematch = []; d.drawOffer = null;
        this.g = null;
      }
      await this.save();
      this.broadcast(this.snapshot());
      return;
    }
    this.send(ws, { t: "error", msg: "unknown message" });
  }

  async webSocketClose(ws) {
    try { ws.close(1000, "bye"); } catch { /* already closed */ }
    try {
      if (await this.load()) {
        this.broadcast(this.snapshot(ws), ws);
        // the only player has gone: do not send a stranger to an empty room (they are offered again when they return)
        const d = this.data;
        if (d.match && d.players.length === 1) {
          const here = this.state.getWebSockets().some((s) => s !== ws && (s.deserializeAttachment() || {}).color === d.players[0].color);
          if (!here) await this.tellLobby("/left");
        }
      }
    } catch { /* a closing socket never needs to be answered */ }
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }
}
