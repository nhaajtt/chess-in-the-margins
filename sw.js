/* Keeps a copy of the game on the device so it opens and plays without a connection (against the computer, two
   on one screen, or the daily puzzles; playing online still needs the internet). Pages are fetched fresh when
   possible and fall back to the copy; everything else comes from the copy and is refreshed in the background.
   Bump VERSION when the list changes. */
const VERSION = "citm-5";
const CORE = [
  "/",
  "/chess.css",
  "/vendor/gsap.min.js",
  "/vendor/rough.js",
  "/paper.js",
  "/engine.js",
  "/creatures.js",
  "/themes.js",
  "/sound.js",
  "/torch.js",
  "/sling.js",
  "/weather.js",
  "/puzzles.js",
  "/game.js",
  "/bake-worker.js",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
];
const SOUNDS = [
  "/assets/sfx/achoo.mp3?v=3",
  "/assets/sfx/amb-day.mp3?v=3",
  "/assets/sfx/amb-night.mp3?v=3",
  "/assets/sfx/blob-hop.mp3?v=3",
  "/assets/sfx/bloop.mp3?v=3",
  "/assets/sfx/boing.mp3?v=3",
  "/assets/sfx/bonk.mp3?v=3",
  "/assets/sfx/buzz.mp3?v=3",
  "/assets/sfx/clack-wood.mp3?v=3",
  "/assets/sfx/clop.mp3?v=3",
  "/assets/sfx/crumble.mp3?v=3",
  "/assets/sfx/ding.mp3?v=3",
  "/assets/sfx/dizzy.mp3?v=3",
  "/assets/sfx/erase.mp3?v=3",
  "/assets/sfx/fanfare.mp3?v=3",
  "/assets/sfx/flap-soft.mp3?v=3",
  "/assets/sfx/flap.mp3?v=3",
  "/assets/sfx/gallop.mp3?v=3",
  "/assets/sfx/grass-hi.mp3?v=3",
  "/assets/sfx/grass.mp3?v=3",
  "/assets/sfx/gull.mp3?v=3",
  "/assets/sfx/hoot-far.mp3?v=3",
  "/assets/sfx/jump.mp3?v=3",
  "/assets/sfx/knock.mp3?v=3",
  "/assets/sfx/page.mp3?v=3",
  "/assets/sfx/paper.mp3?v=3",
  "/assets/sfx/peck.mp3?v=3",
  "/assets/sfx/pencil.mp3?v=3",
  "/assets/sfx/pinch.mp3?v=3",
  "/assets/sfx/poof.mp3?v=3",
  "/assets/sfx/pop.mp3?v=3",
  "/assets/sfx/popper.mp3?v=3",
  "/assets/sfx/punch.mp3?v=3",
  "/assets/sfx/rain.mp3?v=3",
  "/assets/sfx/rewind.mp3?v=3",
  "/assets/sfx/ribbit.mp3?v=3",
  "/assets/sfx/sandstep.mp3?v=3",
  "/assets/sfx/scrape.mp3?v=3",
  "/assets/sfx/shutter.mp3?v=3",
  "/assets/sfx/slap.mp3?v=3",
  "/assets/sfx/slide-down.mp3?v=3",
  "/assets/sfx/slide-up.mp3?v=3",
  "/assets/sfx/snore.mp3?v=3",
  "/assets/sfx/snort.mp3?v=3",
  "/assets/sfx/sparkle.mp3?v=3",
  "/assets/sfx/spell.mp3?v=3",
  "/assets/sfx/splash.mp3?v=3",
  "/assets/sfx/squeak.mp3?v=3",
  "/assets/sfx/squeak2.mp3?v=3",
  "/assets/sfx/squish.mp3?v=3",
  "/assets/sfx/star.mp3?v=3",
  "/assets/sfx/swish-wood.mp3?v=3",
  "/assets/sfx/swosh.mp3?v=3",
  "/assets/sfx/tea.mp3?v=3",
  "/assets/sfx/thud.mp3?v=3",
  "/assets/sfx/tiptoe.mp3?v=3",
  "/assets/sfx/trot.mp3?v=3",
  "/assets/sfx/ufo.mp3?v=3",
  "/assets/sfx/v-acorn.mp3?v=3",
  "/assets/sfx/v-bee.mp3?v=3",
  "/assets/sfx/v-bird.mp3?v=3",
  "/assets/sfx/v-blob.mp3?v=3",
  "/assets/sfx/v-mushroom.mp3?v=3",
  "/assets/sfx/v-owl.mp3?v=3",
  "/assets/sfx/v-penguin.mp3?v=3",
  "/assets/sfx/v-pony.mp3?v=3",
  "/assets/sfx/v-puff.mp3?v=3",
  "/assets/sfx/v-sand.mp3?v=3",
  "/assets/sfx/v-wizard.mp3?v=3",
  "/assets/sfx/v-zebra.mp3?v=3",
  "/assets/sfx/waddle.mp3?v=3",
  "/assets/sfx/wand.mp3?v=3",
  "/assets/sfx/whoosh.mp3?v=3",
  "/assets/sfx/yawn.mp3?v=3",
  "/assets/sfx/yay.mp3?v=3",
  "/assets/sfx/zap.mp3?v=3",
];
const FONTS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then(async (c) => {
    await c.addAll(CORE);
    // the sounds are a nice-to-have: one that fails to arrive does not stop the rest
    await Promise.all(SOUNDS.map((u) => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  const same = url.origin === location.origin, font = FONTS.includes(url.origin);
  if (!same && !font) return;
  if (same && url.pathname.startsWith("/api/")) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put("/", copy)); return r; }).catch(() => caches.match("/")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {
    const fresh = fetch(req).then((r) => { if (r.ok || r.type === "opaque") { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; });
    if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
    return fresh;
  }));
});
