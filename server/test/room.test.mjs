// Room rules, run against a stand-in for the Durable Object state. node --test server/test
import test from "node:test";
import assert from "node:assert/strict";

const { default: worker, Room } = await import("../src/index.js");

class FakeSocket {
  constructor() { this.sent = []; this.att = null; this.closed = false; }
  send(s) { this.sent.push(JSON.parse(s)); }
  close() { this.closed = true; }
  serializeAttachment(a) { this.att = structuredClone(a); }
  deserializeAttachment() { return structuredClone(this.att); }
  last(t) { return [...this.sent].reverse().find((m) => m.t === t); }
}
function makeRoom() {
  const store = new Map();
  const sockets = [];
  const state = {
    storage: {
      get: async (k) => structuredClone(store.get(k)),
      put: async (k, v) => { store.set(k, structuredClone(v)); },
      setAlarm: async () => {},
      deleteAll: async () => store.clear(),
    },
    getWebSockets: () => sockets.filter((s) => !s.closed),
    acceptWebSocket: () => {},
  };
  const room = new Room(state, {});
  const join = async (hello = {}) => {
    const ws = new FakeSocket();
    ws.serializeAttachment({ token: null, color: null, name: null, hits: [] });
    sockets.push(ws);
    await room.webSocketMessage(ws, JSON.stringify({ t: "hello", ...hello }));
    return ws;
  };
  const say = (ws, msg) => room.webSocketMessage(ws, typeof msg === "string" ? msg : JSON.stringify(msg));
  return { room, state, store, sockets, join, say };
}
async function openRoom() {
  const r = makeRoom();
  const res = await r.room.fetch(new Request("https://room/init", { method: "POST" }));
  assert.equal(res.status, 201);
  return r;
}
const sq = (n) => (n.charCodeAt(1) - 49) * 16 + (n.charCodeAt(0) - 97);
async function seated() {
  const r = await openRoom();
  const a = await r.join({ name: "Ann" });
  const b = await r.join({ name: "Bob" });
  const white = a.last("welcome").you === "w" ? a : b;
  const black = white === a ? b : a;
  return { ...r, white, black };
}

test("a room code can only be opened once", async () => {
  const r = await openRoom();
  const again = await r.room.fetch(new Request("https://room/init", { method: "POST" }));
  assert.equal(again.status, 409);
});

test("two people get the two colours, the third only watches", async () => {
  const { join, white, black } = await seated();
  assert.equal(white.last("welcome").you, "w");
  assert.equal(black.last("welcome").you, "b");
  assert.match(white.last("welcome").token, /^[0-9a-f]{32}$/);
  const c = await join({ name: "Cy" });
  assert.equal(c.last("welcome").you, "spectator");
  assert.equal(c.last("welcome").token, null);
});

test("saying hello twice on one socket never takes the second seat", async () => {
  const r = await openRoom();
  const a = await r.join({ name: "Ann" });
  await r.say(a, { t: "hello", name: "Ann" });
  await r.say(a, { t: "hello", token: null, name: "Ann" });
  const d = r.store.get("room");
  assert.equal(d.players.length, 1);
  const b = await r.join({ name: "Bob" });
  assert.notEqual(b.last("welcome").you, "spectator");
});

test("a returning player keeps their seat with their token", async () => {
  const { join, white, room } = await seated();
  const token = white.last("welcome").token;
  white.close();
  const back = await join({ token, name: "Ann" });
  assert.equal(back.last("welcome").you, "w");
  assert.equal(back.last("welcome").token, token);
  await room.webSocketMessage(back, JSON.stringify({ t: "hello", token: "f".repeat(32) }));
  assert.equal(back.last("welcome").you, "w");
});

test("no one is ever told another player's token", async () => {
  const { join, white, black } = await seated();
  const spy = await join({ name: "Eve" });
  const tokens = [white.last("welcome").token, black.last("welcome").token];
  for (const m of spy.sent) for (const t of tokens) assert.ok(!JSON.stringify(m).includes(t), "token leaked to a spectator");
  for (const t of tokens) {
    const other = t === tokens[0] ? black : white;
    for (const m of other.sent) if (m.t !== "welcome") assert.ok(!JSON.stringify(m).includes(t));
  }
});

test("the info page shows names and colours only", async () => {
  const r = await seated();
  const res = await r.room.fetch(new Request("https://room/info"));
  const body = await res.json();
  assert.deepEqual(Object.keys(body.players[0]).sort(), ["color", "name"]);
  assert.ok(!JSON.stringify(body).includes(r.white.last("welcome").token));
});

test("only legal moves on your own turn are taken", async () => {
  const { say, white, black, store } = await seated();
  await say(black, { t: "move", from: sq("e7"), to: sq("e5") });
  assert.equal(black.last("error").msg, "not your turn");
  await say(white, { t: "move", from: sq("e2"), to: sq("e5") });
  assert.equal(white.last("error").msg, "that move is not allowed");
  await say(white, { t: "move", from: "e2", to: "e4" });
  assert.equal(white.last("error").msg, "that move is not allowed");
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  assert.equal(store.get("room").moves.length, 1);
  assert.equal(black.last("move").san, "e4");
});

test("spectators cannot move, resign, offer draws or emote", async () => {
  const { join, say, store, sockets } = await seated();
  const c = await join({ name: "Cy" });
  for (const msg of [{ t: "move", from: sq("e2"), to: sq("e4") }, { t: "resign" }, { t: "draw" }, { t: "rematch" }]) await say(c, msg);
  const before = sockets.map((s) => s.sent.length);
  await say(c, { t: "emote", e: "wave" });
  assert.deepEqual(sockets.filter((s) => s !== c).map((s) => s.sent.length), before.filter((_, i) => sockets[i] !== c));
  const d = store.get("room");
  assert.equal(d.moves.length, 0);
  assert.equal(d.result, null);
  assert.equal(d.drawOffer || null, null);
});

test("no resigning or draw offers before the friend arrives", async () => {
  const r = await openRoom();
  const a = await r.join({ name: "Ann" });
  await r.say(a, { t: "resign" });
  await r.say(a, { t: "draw" });
  assert.equal(r.store.get("room").result, null);
});

test("a draw needs both players, and a move withdraws the offer", async () => {
  const { say, white, black, store } = await seated();
  await say(white, { t: "draw" });
  await say(white, { t: "draw" });
  assert.equal(store.get("room").result, null);
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  assert.equal(store.get("room").drawOffer, null);
  await say(black, { t: "draw" });
  await say(white, { t: "draw" });
  assert.equal(store.get("room").result.reason, "agreement");
});

test("resigning, then a rematch swaps colours and clears the board", async () => {
  const { say, white, black, store } = await seated();
  await say(white, { t: "resign" });
  assert.equal(store.get("room").result.result, "0-1");
  await say(white, { t: "move", from: sq("e2"), to: sq("e4") });
  assert.equal(white.last("error").msg, "the game is over");
  await say(white, { t: "rematch" });
  await say(black, { t: "rematch" });
  const d = store.get("room");
  assert.equal(d.result, null);
  assert.equal(d.moves.length, 0);
  assert.equal(white.last("welcome").you, "b");
  assert.equal(black.last("welcome").you, "w");
});

test("checkmate ends the game on the server", async () => {
  const { say, white, black, store } = await seated();
  const line = [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]];
  for (const [i, [f, t]] of line.entries()) await say(i % 2 ? black : white, { t: "move", from: sq(f), to: sq(t) });
  assert.deepEqual(store.get("room").result, { result: "0-1", reason: "checkmate" });
});

test("junk messages are turned away without a crash", async () => {
  const { say, white } = await seated();
  for (const raw of ["null", "[]", "42", '"x"', "{", "{}", '{"t":5}', JSON.stringify({ t: "move", from: { a: 1 }, to: [] }), "x".repeat(601)]) {
    await assert.doesNotReject(say(white, raw));
  }
  await assert.doesNotReject(say(white, Buffer.from("binary")));
  assert.ok(white.sent.filter((m) => m.t === "error").length >= 9);
});

test("a flood from one socket is slowed down", async () => {
  const { say, white } = await seated();
  for (let i = 0; i < 20; i++) await say(white, { t: "emote", e: "wave" });
  assert.equal(white.last("error").msg, "slow down");
});

test("names lose control, markup and direction-flipping characters", async () => {
  const r = await openRoom();
  const a = await r.join({ name: "<b>Ann‮​nimda\u0007</b>" + "x".repeat(40) });
  const name = r.store.get("room").players[0].name;
  assert.ok(!/[<>‮​\u0007]/.test(name));
  assert.ok(name.length <= 20);
  const b = await r.join({ name: { toString: () => "<script>" } });
  void a; void b;
  assert.equal(r.store.get("room").players[1].name, "a friend");
});

test("a room takes only so many sockets", async () => {
  const r = await openRoom();
  for (let i = 0; i < 64; i++) r.sockets.push(new FakeSocket());
  const res = await r.room.fetch(new Request("https://room/ws"));
  assert.equal(res.status, 503);
});

test("the front door checks origins, codes and the room limit", async () => {
  const calls = [];
  const env = {
    ALLOWED_ORIGINS: "https://chess.nhaajt.com",
    OPEN_LIMIT: { limit: async () => ({ success: calls.push(1) <= 2 }) },
    ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("ok", { status: 201 }) }) },
  };
  const open = (origin) => worker.fetch(new Request("https://x/rooms", { method: "POST", headers: origin ? { origin } : {} }), env);
  assert.equal((await open()).status, 403);
  assert.equal((await open("https://evil.example")).status, 403);
  assert.equal((await open("http://localhost:5190")).status, 403);
  const ok = await open("https://chess.nhaajt.com");
  assert.equal(ok.status, 201);
  assert.match((await ok.json()).code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://chess.nhaajt.com");
  await open("https://chess.nhaajt.com");
  assert.equal((await open("https://chess.nhaajt.com")).status, 429);
  const ws = (origin) => worker.fetch(new Request("https://x/rooms/ABCDEF/ws", { headers: { upgrade: "websocket", ...(origin ? { origin } : {}) } }), env);
  assert.equal((await ws("https://evil.example")).status, 403);
  assert.equal((await worker.fetch(new Request("https://x/rooms/ABCDE0"), env)).status, 404);
  const evil = await worker.fetch(new Request("https://x/rooms/ABCDEF", { headers: { origin: "https://evil.example" } }), env);
  assert.equal(evil.headers.get("access-control-allow-origin"), null);
});

test("room codes use the whole alphabet evenly", async () => {
  const env = {
    ALLOWED_ORIGINS: "https://chess.nhaajt.com",
    ROOMS: { idFromName: (n) => n, get: () => ({ fetch: async () => new Response("ok", { status: 201 }) }) },
  };
  const count = new Map();
  for (let i = 0; i < 400; i++) {
    const r = await worker.fetch(new Request("https://x/rooms", { method: "POST", headers: { origin: "https://chess.nhaajt.com" } }), env);
    for (const ch of (await r.json()).code) count.set(ch, (count.get(ch) || 0) + 1);
  }
  assert.equal(count.size, 31);
  for (const ch of "O0I1L") assert.ok(!count.has(ch));
});
