// The weather function: strict inputs, bounded upstream call, private answers. node --test server/test
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const handler = createRequire(import.meta.url)("../../api/weather.js");

function run({ method = "GET", headers = {} } = {}) {
  const out = { headers: {}, status: 0, body: null };
  const res = {
    setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
    status(n) { out.status = n; return this; },
    json(b) { out.body = b; return this; },
  };
  return handler({ method, headers }, res).then(() => out);
}
const at = (lat, lon) => ({ "x-vercel-ip-latitude": lat, "x-vercel-ip-longitude": lon });
const withFetch = async (impl, fn) => {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return impl(url, init); };
  try { await fn(calls); } finally { globalThis.fetch = real; }
};
const ok = (current, extra = {}) => new Response(JSON.stringify({ current }), { status: 200, ...extra });

test("only GET and HEAD are answered", async () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH", "OPTIONS"]) {
    const r = await run({ method, headers: at("52.37", "4.89") });
    assert.equal(r.status, 405, method);
    assert.equal(r.headers.allow, "GET, HEAD");
  }
});

test("the place is rounded to half a degree and never sent on to the page", async () => {
  await withFetch(() => ok({ weather_code: 61, wind_speed_10m: 30 }), async (calls) => {
    const r = await run({ headers: at("52.3731", "-4.8997") });
    assert.deepEqual(r.body, { sky: "rain", wind: true, known: true });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /latitude=52\.5&longitude=-5\.0&/);
    assert.ok(!JSON.stringify(r.body).includes("52"));
    assert.equal(calls[0].init.redirect, "error");
    assert.ok(calls[0].init.signal, "the call has a timeout");
  });
});

test("the answer may be kept by the visitor's browser only, never by a shared cache", async () => {
  await withFetch(() => ok({ weather_code: 0, wind_speed_10m: 3 }), async () => {
    const good = await run({ headers: at("10.0", "10.0") });
    assert.match(good.headers["cache-control"], /^private, max-age=\d+$/);
    assert.ok(!/public|s-maxage/.test(good.headers["cache-control"]));
  });
  const none = await run({ headers: {} });
  assert.deepEqual(none.body, { sky: "clear", wind: false, known: false });
  assert.equal(none.headers["cache-control"], "private, no-store");
});

test("places that are not numbers or are out of range are no place at all", async () => {
  await withFetch(() => { throw new Error("must not be called"); }, async (calls) => {
    for (const [lat, lon] of [["91", "0"], ["0", "181"], ["abc", "1"], ["1;drop", "2"], ["1e2", "3"], ["", ""], ["NaN", "Infinity"], ["1".repeat(40), "2"], [["1", "2"], undefined], ["12.5&x=1", "3"], ["--5", "3"]]) {
      const r = await run({ headers: at(lat, lon) });
      assert.deepEqual(r.body, { sky: "clear", wind: false, known: false }, JSON.stringify([lat, lon]));
    }
    assert.equal(calls.length, 0);
  });
});

test("a bad answer from the weather service never reaches the page", async () => {
  const bad = [
    () => new Response("nope", { status: 500 }),
    () => new Response("not json", { status: 200 }),
    () => ok({ weather_code: "61", wind_speed_10m: 3 }),
    () => ok({ weather_code: 61.5, wind_speed_10m: 3 }),
    () => ok({ weather_code: 200, wind_speed_10m: 3 }),
    () => ok({ weather_code: 3, wind_speed_10m: -1 }),
    () => ok({ weather_code: 3, wind_speed_10m: 1e9 }),
    () => ok({ weather_code: 3 }),
    () => new Response(JSON.stringify({ current: null }), { status: 200 }),
    () => new Response("[]", { status: 200 }),
    () => new Response(JSON.stringify({ current: { weather_code: 1, wind_speed_10m: 1 }, pad: "x".repeat(40000) }), { status: 200 }),
    () => { throw new Error("offline"); },
    () => { throw new DOMException("timed out", "TimeoutError"); },
  ];
  let n = 0;
  for (const impl of bad) {
    n++; // a new square each time, so an earlier answer is not reused
    await withFetch(impl, async () => {
      const r = await run({ headers: at(String(20 + n), "5.0") });
      assert.equal(r.status, 200);
      assert.deepEqual(r.body, { sky: "clear", wind: false, known: false }, String(n));
      assert.equal(r.headers["cache-control"], "private, no-store");
    });
  }
});

test("the same square is asked about once, and a failure is not asked again straight away", async () => {
  await withFetch(() => ok({ weather_code: 71, wind_speed_10m: 1 }), async (calls) => {
    const a = await run({ headers: at("60.1", "30.1") });
    const b = await run({ headers: at("60.2", "29.9") }); // the same half-degree square
    assert.equal(a.body.sky, "snow");
    assert.deepEqual(b.body, a.body);
    assert.equal(calls.length, 1);
    await run({ headers: at("61.1", "30.1") });
    assert.equal(calls.length, 2);
  });
  await withFetch(() => new Response("", { status: 503 }), async (calls) => {
    await run({ headers: at("-33.0", "151.0") });
    await run({ headers: at("-33.1", "151.1") });
    assert.equal(calls.length, 1);
  });
});

test("the memory of squares never grows without bound", async () => {
  await withFetch(() => ok({ weather_code: 0, wind_speed_10m: 0 }), async (calls) => {
    for (let i = 0; i < 300; i++) await run({ headers: at(String(-40 + (i % 20)), String(100 + Math.floor(i / 20))) });
    assert.equal(calls.length, 300);
    await run({ headers: at("-40", "100") }); // the oldest square was let go to keep the memory small
    assert.equal(calls.length, 301);
    await run({ headers: at("-40", "100") }); // and is remembered again
    assert.equal(calls.length, 301);
  });
});
