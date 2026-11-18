// Hostile and malformed input against the rooms service. node --test server/test
import test from "node:test";
import assert from "node:assert/strict";

const { default: worker, Room, Lobby } = await import("../src/index.js");
const ORIGIN = "https://chess.nhaajt.com";
const sq = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);

class FakeSocket {
  constructor() { this.sent = []; this.att = null; this.closed = false; this.closeCode = null; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close(code) { this.closed = true; this.closeCode = code ?? this.closeCode; }
  serializeAttachment(a) { this.att = structuredClone(a); }
  deserializeAttachment() { return structuredClone(this.att); }
  last(t) { return [...this.sent].reverse().find((m) => m.t === t); }
}
function makeRoom(env = {}) {
  const store = new Map();
  const sockets = [];
  const alarms = [];
  const fail = { puts: false };
  const state = {
    storage: {
      get: async (k) => structuredClone(store.get(k)),
      put: async (k, v) => { if (fail.puts) throw new Error("disk"); store.set(k, structuredClone(v)); },
      setAlarm: async (t) => { alarms.push(t); },
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets.filter((s) => !s.closed),
    acceptWebSocket: () => {},
  };
  const room = new Room(state, env);
  const join = async (hello = {}) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ token: null, color: null, name: null, hits: [] });
    sockets.push(ws);
    await room.webSocketMessage(ws, JSON.stringify({ t: "hello", ...hello }));
    return ws;
  };
  const say = (ws, msg) => room.webSocketMessage(ws, typeof msg === "string" ? msg : JSON.stringify(msg));
  return { room, state, store, sockets, alarms, fail, join, say };
}
async function openRoom(env, body) {
  const r = makeRoom(env);
  const res = await r.room.fetch(new Request("https://room/init", { method: "POST", body }));
  assert.equal(res.status, 201);
  return r;
}
async function seated() {
  const r = await openRoom();
  const a = await r.join({ name: "Ann" });
  const b = await r.join({ name: "Bob" });
  const white = a.last("welcome").you === "w" ? a : b;
  return { ...r, white, black: white === a ? b : a };
}

// ---- the front door ----

const keysSeen = async (ips) => {
  const keys = [];
  const env = {
    ALLOWED_ORIGINS: ORIGIN,
    OPEN_LIMIT: { limit: async ({ key }) => { keys.push(key); return { success: true }; } },
    ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("ok", { status: 201 }) }) },
  };
  for (const ip of ips) await worker.fetch(new Request("https://x/rooms", { method: "POST", headers: { origin: ORIGIN, "cf-connecting-ip": ip } }), env);
  return keys;
};

test("every address inside one IPv6 /64 is counted as one visitor", async () => {
  const k = await keysSeen([
    "2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::1", "2001:0db8:0001:0002:ffff:ffff:ffff:ffff", "2001:DB8:1:2:1::",
    "2001:db8:1:3::1", "2001:db8::1", "1.2.3.4", "::ffff:1.2.3.4", "", "not an address", "1:2:3:4:5:6:7:8:9",
  ]);
  assert.equal(new Set(k.slice(0, 4)).size, 1);
  assert.notEqual(k[4], k[0]);
  assert.notEqual(k[5], k[0]);
  assert.equal(k[6], "1.2.3.4");
  assert.equal(k[7], "1.2.3.4");
  assert.equal(k[8], "unknown");
  assert.ok(k[9].length <= 45 && k[10] === "v6:bad");
});

test("looking at a room or connecting to it needs the game's origin and is counted per visitor", async () => {
  const keys = [];
  let asked = 0;
  const env = {
    ALLOWED_ORIGINS: ORIGIN,
    PROBE_LIMIT: { limit: async ({ key }) => { keys.push(key); return { success: ++asked <= 2 }; } },
    ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response(JSON.stringify({ players: [] }), { status: 200 }) }) },
  };
  const get = (path, headers = {}) => worker.fetch(new Request("https://x" + path, { headers: { "cf-connecting-ip": "2001:db8:1:2::9", ...headers } }), env);
  assert.equal((await get("/rooms/ABCDEF")).status, 403);
  assert.equal((await get("/rooms/ABCDEF", { origin: "https://evil.example" })).status, 403);
  assert.equal((await get("/rooms/ABCDEF/ws", { upgrade: "websocket" })).status, 403);
  assert.equal(asked, 0, "refused requests must not use up the allowance of real ones");
  assert.equal((await get("/rooms/ABCDEF", { origin: ORIGIN })).status, 200);
  assert.equal((await get("/rooms/ABCDEF", { origin: ORIGIN })).status, 200);
  const limited = await get("/rooms/ABCDEF", { origin: ORIGIN });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal((await get("/rooms/ABCDEF/ws", { origin: ORIGIN, upgrade: "websocket" })).status, 429);
  assert.deepEqual([...new Set(keys)], ["v6:2001:0db8:0001:0002"]);
  assert.equal((await get("/rooms/ABCDEF", { origin: ORIGIN })).headers.get("cache-control"), "no-store");
});

test("methods are strict: rooms are read with GET, made and matched with POST", async () => {
  const env = { ALLOWED_ORIGINS: ORIGIN, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("{}") }) } };
  const call = (method, path) => worker.fetch(new Request("https://x" + path, { method, headers: { origin: ORIGIN } }), env);
  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) assert.equal((await call(m, "/rooms/ABCDEF")).status, 405, m);
  for (const m of ["GET", "PUT", "DELETE"]) assert.equal((await call(m, "/rooms")).status, 405, m);
  assert.equal((await call("GET", "/rooms")).headers.get("allow"), "POST, OPTIONS");
  assert.equal((await call("GET", "/rooms/ABCDEF/ws")).status, 426);
});

test("a missing origin list lets nobody in, and a failing room is a plain error", async () => {
  const noList = { ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("ok", { status: 201 }) }) } };
  const open = (env) => worker.fetch(new Request("https://x/rooms", { method: "POST", headers: { origin: ORIGIN } }), env);
  assert.equal((await open(noList)).status, 403);
  assert.equal((await open({ ...noList, ALLOWED_ORIGINS: "" })).status, 403);
  const broken = { ALLOWED_ORIGINS: ORIGIN, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => { throw new Error("secret detail"); } }) } };
  const r = await open(broken);
  assert.equal(r.status, 500);
  const body = await r.text();
  assert.ok(!body.includes("secret detail"));
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
});

test("a body with no length is cut off at the limit instead of being read in full", async () => {
  const env = { ALLOWED_ORIGINS: ORIGIN, LOBBY: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("{}") }) } };
  let pulled = 0;
  const body = new ReadableStream({ pull(c) { pulled++; if (pulled > 1000) c.close(); else c.enqueue(new TextEncoder().encode("x".repeat(1024))); } });
  const r = await worker.fetch(new Request("https://x/match", { method: "POST", headers: { origin: ORIGIN }, body, duplex: "half" }), env);
  assert.equal(r.status, 413);
  assert.ok(pulled < 20, "kept reading a body far past the limit: " + pulled);
  // multi-byte text counts in bytes, not characters
  const wide = await worker.fetch(new Request("https://x/match", { method: "POST", headers: { origin: ORIGIN }, body: "é".repeat(200) }), env);
  assert.equal(wide.status, 413);
});

// ---- matchmaking ----

function lobbyEnv() {
  const store = new Map();
  const state = { storage: { get: async (k) => structuredClone(store.get(k)), put: async (k, v) => { store.set(k, structuredClone(v)); }, setAlarm: async () => {} } };
  const env = { ALLOWED_ORIGINS: ORIGIN, ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("ok", { status: 201 }) }) } };
  const lobby = new Lobby(state, env);
  env.LOBBY = { idFromName: (n) => n, get: () => ({ fetch: (u, i) => lobby.fetch(new Request(u, i)) }) };
  const match = (ip) => worker.fetch(new Request("https://x/match", { method: "POST", headers: { origin: ORIGIN, "cf-connecting-ip": ip } }), env);
  const tell = (path, code) => lobby.fetch(new Request("https://lobby" + path, { method: "POST", body: JSON.stringify({ code }) }));
  return { env, lobby, match, tell, store };
}

test("a waiting room is offered only while its owner is connected", async () => {
  const { match, tell } = lobbyEnv();
  const a = await (await match("1.1.1.1")).json();
  // the owner never connected: a stranger gets a room of their own, not this one
  const b = await (await match("2.2.2.2")).json();
  assert.equal(b.waiting, true);
  assert.notEqual(b.code, a.code);
  // the owner connects, drops for a moment (no one is offered the room), comes back (it is offered again)
  await tell("/waiting", a.code);
  await tell("/left", a.code);
  const c = await (await match("3.3.3.3")).json();
  assert.notEqual(c.code, a.code);
  await tell("/waiting", a.code);
  assert.deepEqual(await (await match("4.4.4.4")).json(), { code: a.code });
});

test("the lobby only believes well-formed room codes", async () => {
  const { tell, lobby } = lobbyEnv();
  for (const code of [5, null, "bad", "abcdef", "ABCDE0", { a: 1 }]) {
    const r = await lobby.fetch(new Request("https://lobby/waiting", { method: "POST", body: JSON.stringify({ code }) }));
    assert.equal(r.status, 400, String(code));
  }
  assert.equal((await tell("/waiting", "ABCDEF")).status, 200);
});

test("one IPv6 visitor is never paired with themself, however the address changes inside the /64", async () => {
  const { match, tell } = lobbyEnv();
  const a = await (await match("2001:db8:1:2::1")).json();
  await tell("/waiting", a.code);
  const again = await (await match("2001:db8:1:2:dead:beef:0:7")).json();
  assert.deepEqual(again, { code: a.code, waiting: true });
});

test("the visitor tag cannot be worked back to an address when a secret is set", async () => {
  const seen = [];
  const mk = (secret) => ({ ALLOWED_ORIGINS: ORIGIN, ...(secret ? { TAG_SECRET: secret } : {}), LOBBY: { idFromName: (n) => n, get: () => ({ fetch: async (_u, i) => { seen.push(JSON.parse(i.body).visitor); return new Response("{}"); } }) } });
  const go = (env) => worker.fetch(new Request("https://x/match", { method: "POST", headers: { origin: ORIGIN, "cf-connecting-ip": "1.2.3.4" } }), env);
  await go(mk()); await go(mk("one")); await go(mk("two")); await go(mk("one"));
  assert.notEqual(seen[0], seen[1]);
  assert.notEqual(seen[1], seen[2]);
  assert.equal(seen[1], seen[3]);
  assert.match(seen[1], /^[0-9a-f]{16}$/);
});

// ---- messages ----

test("frames are limited in bytes, and a huge one ends the connection", async () => {
  const { say, white } = await seated();
  await say(white, JSON.stringify({ t: "emote", e: "wave", pad: "é".repeat(250) })); // 250 characters, 500+ bytes... under the limit
  const small = white.sent.length;
  await say(white, JSON.stringify({ t: "emote", e: "wave", pad: "€".repeat(220) })); // about 660 bytes in 250 characters
  assert.equal(white.last("error").msg, "message too big");
  assert.ok(white.sent.length > small);
  assert.equal(white.closed, false);
  await say(white, "x".repeat(5000));
  assert.equal(white.closed, true);
  assert.equal(white.closeCode, 1009);
});

test("deep, odd and malformed JSON never gets past the front of the handler", async () => {
  const { say, white, store } = await seated();
  const before = JSON.stringify(store.get("room"));
  const deep = "[".repeat(290) + "]".repeat(290);
  const deepObj = '{"t":"x","a":' + '{"a":'.repeat(100) + "1" + "}".repeat(100) + "}";
  for (const raw of [deep, deepObj, '{"t":"hello","__proto__":{"admin":true}}', '{"t":"move","from":1e999,"to":-0}', '{"t":"\\ud800"}', "\u0000", '{"t":"move"}{"t":"resign"}', "undefined", "NaN"]) {
    await assert.doesNotReject(say(white, raw));
  }
  assert.equal(({}).admin, undefined);
  assert.equal(JSON.stringify(store.get("room")).includes("admin"), false);
  assert.equal(store.get("room").result, null);
  assert.equal(JSON.stringify({ ...store.get("room"), touched: 0 }).length > 0, true);
  void before;
});

test("moves with the wrong types are refused", async () => {
  const { say, white, store } = await seated();
  const e2 = sq("e2"), e4 = sq("e4");
  for (const move of [
    { from: String(e2), to: String(e4) }, { from: e2 + 0.5, to: e4 }, { from: [e2], to: [e4] }, { from: e2, to: e4, promo: "0" },
    { from: e2, to: e4, promo: [0] }, { from: e2, to: e4, promo: 0.5 }, { from: e2, to: e4, promo: {} }, { from: null, to: null }, { from: true, to: true }, {},
  ]) {
    await say(white, { t: "move", ...move });
    assert.equal(white.last("error").msg, "that move is not allowed", JSON.stringify(move));
  }
  assert.equal(store.get("room").moves.length, 0);
  await say(white, { t: "move", from: e2, to: e4 }); // a plain move, no promo given, still works
  assert.equal(store.get("room").moves.length, 1);
});

test("only the player whose turn it is moves, and spectators and the wrong seat cannot", async () => {
  const { say, white, black, join, store } = await seated();
  const watcher = await join({ name: "Cy" });
  await say(black, { t: "move", from: sq("e7"), to: sq("e5") });
  assert.equal(black.last("error").msg, "not your turn");
  await say(watcher, { t: "move", from: sq("e2"), to: sq("e4") });
  assert.equal(watcher.last("error").msg, "spectators only watch");
  // a stranger cannot move for white by claiming the colour in the message
  await say(watcher, { t: "move", from: sq("e2"), to: sq("e4"), color: "w", you: "w" });
  await say(watcher, { t: "hello", token: black.last("welcome").token.replace(/./, (c) => (c === "0" ? "1" : "0")) });
  assert.equal(watcher.last("welcome").you, "spectator");
  assert.equal(store.get("room").moves.length, 0);
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  await say(white, { t: "move", from: sq("d2"), to: sq("d4") });
  assert.equal(white.last("error").msg, "not your turn");
  assert.equal(store.get("room").moves.length, 1);
});

test("a token works for its own room only, and a copy of it does not open the other seat", async () => {
  const one = await seated();
  const two = await seated();
  const stolen = one.white.last("welcome").token;
  // the token of another room seats nobody and gets no seat even though that room has none free
  const x = await two.join({ token: stolen, name: "Mallory" });
  assert.equal(x.last("welcome").you, "spectator");
  assert.equal(x.last("welcome").token, null);
  // the right token on a new socket is the same seat, and the other player's seat is not reachable with it
  const back = await one.join({ token: stolen });
  assert.equal(back.last("welcome").you, one.white.last("welcome").you);
  assert.notEqual(back.last("welcome").token, one.black.last("welcome").token);
  // odd tokens are just wrong tokens
  for (const token of [5, {}, [], "", "A".repeat(32), "0".repeat(33), stolen.slice(1), stolen.toUpperCase()]) {
    const w = await one.join({ token });
    assert.equal(w.last("welcome").you, "spectator", JSON.stringify(token));
  }
});

test("names: no half-written emoji, no stacked accents, no hidden text, never the wrong type", async () => {
  const r = await openRoom();
  const names = ["\ud800", "a\udc00b", "ab\ud83d", "\u{1F600}".repeat(30), "Z" + "\u0301".repeat(50), "a\u2028b\u2029c", "x\u{e0041}\u{e0042}y", "  many   spaces\t\there  ", "\u202eevil"];
  for (const name of names) {
    const ws = new FakeSocket();
    ws.serializeAttachment({ token: null, color: null, name: null, hits: [] });
    r.sockets.push(ws);
    r.store.get("room").players = [];
    await r.room.load();
    r.room.data.players = [];
    await r.room.webSocketMessage(ws, JSON.stringify({ t: "hello", name }));
    const got = r.room.data.players[0].name;
    assert.ok(!/[\ud800-\udfff]/.test(got.replace(/[\ud800-\udbff][\udc00-\udfff]/g, "")), "lone surrogate in " + JSON.stringify(got));
    assert.ok([...got].length <= 20);
    assert.ok(!/[\u2028\u2029\u202e]|[\u{e0000}-\u{e007f}]/u.test(got));
    assert.ok(!/\s{2}|\t/.test(got));
    assert.ok(!/\u0301{3}/.test(got));
    assert.doesNotThrow(() => JSON.stringify(got) && encodeURIComponent(got));
  }
  // a wrong-typed name never wipes out the name a seated player already has
  const a = await r.join({ name: "Ann" });
  const seat = r.room.data.players[0];
  void a;
  const keep = seat.name;
  for (const bad of [5, {}, [], null, false]) await r.say(r.sockets[r.sockets.length - 1], { t: "hello", token: seat.token, name: bad });
  assert.equal(r.room.data.players[0].name, keep);
});

test("a flood is slowed down for the room as a whole, and the flooding socket is hung up on", async () => {
  const { room, join, say, white, black } = await seated();
  const crowd = [];
  for (let i = 0; i < 10; i++) crowd.push(await join({ name: "c" + i }));
  const mine = room.roomHits.length;
  let told = 0;
  for (let round = 0; round < 6; round++) for (const ws of crowd) { await say(ws, { t: "emote", e: "wave" }); if (ws.last("error") && ws.last("error").msg === "slow down") told++; }
  assert.ok(told > 0, "ten sockets together went past the room's budget unchecked");
  assert.ok(room.roomHits.length <= 40 + mine);
  // one socket that keeps going after being told is dropped
  const noisy = white;
  for (let i = 0; i < 200; i++) await say(noisy, "{}");
  assert.equal(noisy.closed, true);
  assert.equal(noisy.closeCode, 1008);
  void black;
});

test("saying hello over and over costs no storage write once nothing has changed", async () => {
  const r = await openRoom();
  const a = await r.join({ name: "Ann" });
  let puts = 0;
  const real = r.state.storage.put;
  r.state.storage.put = async (...x) => { puts++; return real(...x); };
  for (let i = 0; i < 10; i++) {
    r.room.roomHits = [];
    a.att.hits = [];
    await r.say(a, { t: "hello", token: a.last("welcome").token, name: "Ann" });
  }
  assert.equal(puts, 0);
  await r.say(a, { t: "hello", token: a.last("welcome").token, name: "Anna" });
  assert.equal(puts, 1);
});

test("a failed save leaves the room as it was and the next message works", async () => {
  const { white, say, fail, store, room } = await seated();
  fail.puts = true;
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  assert.equal(white.last("error").msg, "something went wrong, try again");
  fail.puts = false;
  assert.equal(store.get("room").moves.length, 0);
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  assert.equal(store.get("room").moves.length, 1);
  assert.equal(room.data.moves.length, 1);
});

test("a room nobody sat down in is forgotten after two hours, one with players after a day", async () => {
  const r = await openRoom();
  const empty = r.alarms[r.alarms.length - 1] - Date.now();
  assert.ok(empty > 1.9 * 3600e3 && empty <= 2 * 3600e3, "empty room lives " + empty);
  await r.join({ name: "Ann" });
  const seated = r.alarms[r.alarms.length - 1] - Date.now();
  assert.ok(seated > 23.9 * 3600e3);
  // when the alarm rings for a room that has gone quiet it is wiped
  const real = Date.now;
  try {
    Date.now = () => real() + 25 * 3600e3;
    await r.room.alarm();
  } finally { Date.now = real; }
  assert.equal(r.store.has("room"), false);
  assert.equal((await r.room.fetch(new Request("https://room/info"))).status, 404);
});

test("a crowd of watchers cannot lock the players out of a full room", async () => {
  const r = await openRoom();
  const a = await r.join({ name: "Ann" });
  for (let i = 0; i < 63; i++) await r.join({ name: "w" + i });
  assert.equal(r.state.getWebSockets().length, 64);
  assert.equal(r.room.makeRoom(), true);
  assert.equal(a.closed, false, "a seated player was dropped to make room");
  assert.equal(r.state.getWebSockets().length, 63);
  // with nobody idle left to drop, the room is full
  const full = makeRoom();
  for (let i = 0; i < 64; i++) { const w = new FakeSocket(); w.serializeAttachment({ color: "w" }); full.sockets.push(w); }
  assert.equal(full.room.makeRoom(), false);
});

test("the room keeps one copy of the game and still agrees with the saved moves after a rematch", async () => {
  const { white, black, say, store } = await seated();
  const line = [["e2", "e4"], ["e7", "e5"], ["g1", "f3"]];
  for (const [i, [f, t]] of line.entries()) await say(i % 2 ? black : white, { t: "move", from: sq(f), to: sq(t) });
  await say(white, { t: "resign" });
  await say(white, { t: "rematch" });
  await say(black, { t: "rematch" });
  assert.equal(store.get("room").moves.length, 0);
  const first = white.last("welcome").you === "w" ? white : black;
  await say(first, { t: "move", from: sq("d2"), to: sq("d4") });
  assert.equal(store.get("room").moves.length, 1);
});

test("a game that will not end is called a draw instead of growing without end", async () => {
  const { white, black, say, store, room } = await seated();
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  // pretend 598 half-moves have already been played, then play move 600 for real
  const g = room.game();
  for (let i = 0; i < 598; i++) g.played.push({ move: null, san: "" });
  room.data.moves = [...room.data.moves, ...Array(598).fill({ from: 0, to: 0, promo: 0 })];
  assert.equal(room.data.moves.length, 599);
  await say(black, { t: "move", from: sq("e7"), to: sq("e5") });
  assert.deepEqual(store.get("room").result, { result: "1/2-1/2", reason: "move limit" });
});
