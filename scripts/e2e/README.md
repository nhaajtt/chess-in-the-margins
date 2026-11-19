# Browser tests

End-to-end tests for the game, run in a real headless Chrome with nothing installed: Node 22's own `fetch`,
`WebSocket` and test runner, and the Chrome or Chromium already on the machine, driven over the DevTools protocol.

    npm run test:e2e            every browser test except the online rooms (about two minutes)
    npm run test:e2e:online     the online rooms, through the rooms service started locally with server/node_modules
    npm run test:all            unit tests, then both of the above

Run one file with `node --test scripts/e2e/rules.test.mjs`, or one test with `--test-name-pattern="castling"`.
Chrome is found from `CHROME_PATH`, then the usual places on Windows, macOS and Linux. Set `CHROME_PATH` if yours is somewhere else.

## What is here

| File | What it is |
| --- | --- |
| `server.mjs` | A static server for the project that applies `vercel.json`: the same response headers (so the real Content-Security-Policy is enforced), `cleanUrls`, the `/r/:code` rewrite, 404 for `/api/weather` and `/_vercel/*`. It listens on 127.0.0.1 on a free port. |
| `browser.mjs` | Finds and launches Chrome with a throwaway profile on a free debugging port, and drives it. One browser context per test, so storage never leaks between tests. Collects console errors, exceptions, unhandled rejections, policy violations and failed requests. Always kills Chrome and removes the profile. |
| `harness.mjs` | `e2e()` starts a server and a browser per test file; `Game` knows how to read and drive the board. |
| `run.mjs` | Runs the test files side by side (up to four at once). |
| `*.test.mjs` | The tests, one topic per file (see below). |

## Rules every test lives by

- **Any problem in the page fails the test**: a console error, an uncaught exception, an unhandled rejection, a
  `securitypolicyviolation`, a request for something that is not there, or any request to the internet apart from the fonts.
  Allowed: the 404s for `/api/weather` and `/_vercel/*` (the real host serves those), and the Google Fonts requests, which are answered
  with an empty file so a run does not need the internet. The page's harmless "GSAP target not found" warning is allowed and counted;
  the count is printed at the end of each file (`# GSAP "target not found" warnings tolerated ...`).
- **Waits happen inside the page.** In headless Chrome, page timers and worker messages stall unless an awaited
  `Runtime.evaluate` is pending, so every wait is an awaited promise in the page (`page.waitFor`), never a sleep in Node.
  The only fixed pauses are the short ones that prove that *nothing* happened (an illegal move being ignored).
- **Most flows run with reduced motion** (`Emulation.setEmulatedMedia`), which is fast and still. `motion.test.mjs` keeps the full animations
  running (and the online test opens its pages with them off, but the opening story, drawing, fights and flips are covered there).
- **Real input where it matters**: the keyboard tests press real keys (`Input.dispatchKeyEvent`) and the phone test taps with touch events.
- **The page decides what "settled" means**: `Game.settled()` waits until the creatures on the page stand exactly where the game says they do.

## The tests

| File | Covers |
| --- | --- |
| `rules.test.mjs` | Two players on one screen: castling both sides (and refused when not allowed), en passant, promotion with each choice, check, pinned pieces, checkmate, stalemate, insufficient material, repetition, undo, flip, resign, new game, captures of every kind. |
| `cpu-game.test.mjs` | A whole game against the computer on easy to checkmate: result, diary entry, sticker, result card; the computer's reply; playing purple; the teach level. |
| `clocks.test.mjs` | The clocks run for the side to move, the increment adds two seconds, a one-minute game is lost on time. |
| `puzzles-ui.test.mjs` | All four kinds solved by their stored lines, wrong moves, the rush (solve two, fail three, score and stored best). |
| `tools.test.mjs` | PGN export, PGN and FEN import, invalid input, the look back marking a blunder, opening names. |
| `story.test.mjs` | Adventure chapters (set-up, loss, win, draw, progress), school lessons. |
| `look.test.mjs` | Each paper kind, bold ink, persistence. |
| `storage.test.mjs` | Stickers, diary, puzzle and adventure progress survive a reload; every `chess-*` key holding rubbish does not crash the page. |
| `motion.test.mjs` | The same things with the animations on, the opening story, reduced motion. |
| `keyboard.test.mjs` | Playing with Tab, arrows and Enter; every dialog opens, keeps the focus, closes with Escape and gives the focus back. |
| `phone.test.mjs` | 390 x 844 with touch: the page loads, a move is played with a finger, every dialog fits. |
| `offline.test.mjs` | The service worker registers and fills its cache; a second visit works with the network off and the server stopped. |
| `online.test.mjs` | Two pages in a room: create, join, moves both ways, an emote, a draw offer, a cut connection and the way back. Skips itself, with the reason, if the rooms service cannot be started here. |
| `harness-check.test.mjs` | The net checks itself: the real policy is in force, and every kind of fault is really reported. |
| `server.test.mjs` | The test host does what `vercel.json` says. |

## Things to know

- The page registers its service worker only on https (`game/08-extras.js`), and the test host is plain http, so `offline.test.mjs` registers
  `/sw.js` itself. It tests the worker and its cache, not the one line that asks for the worker.
- The rooms service gives the first visitor of a room a random colour, so the online test finds out who is who.
- The online test gives the page's policy one extra entry (`connect-src http://localhost:8787 ws://localhost:8787`), because the page
  talks to port 8787 when it is opened from this machine. Every other test runs under the policy exactly as shipped.
- `online.test.mjs` needs port 8787 free and `npm ci` done in `server/`. It never touches a service that is already running.
- A test marked `todo` documents a bug that is known and not fixed. It runs and its failure is shown, but it does not fail the run.
  When the bug is fixed the test starts to pass, and the `todo` mark should be taken off.

## Does the net catch fish?

Each of these breaks was made, one at a time, in a copy of the project, and the whole browser suite was run on it.

Run with `E2E_TIMEOUT_SCALE=0.25` (every wait gives up four times sooner, so a red run is quick). "Red" is the list of tests that failed; the
"same page with motion allowed does move on its own" test was timing-sensitive at that scale and is left out of the lists.

| What was broken (in a copy) | Tests that went red |
| --- | --- |
| Castling no longer moves the castle on the page (`game/` playMove) | 4 red: both castling tests in `rules`, the castling test in `motion`, the reduced-motion flow |
| Castling no longer moves the castle in the rules (`engine.js` make) | 7 red: the same four, plus the PGN import and look tests that castle |
| Undo takes back nothing (`game/` undo) | 6 red: undo in `rules`, undo after the end, undo in `motion`, undo when playing purple, the reduced-motion flow |
| Promotion always makes a queen (`game/` askPromotion) | 7 red: promotion with rook, bishop and knight, the dialog test, black promotes, the motion promotion, the FEN import |
| The puzzle accepts any move (`game/` puzzleAnswer) | 3 red: the wrong-move test, the win-a-piece wrong-move test, the rush |
| A `chess-stickers` write is dropped (`game/` award) | 16 red: the whole game against the computer, every puzzle kind, storage and sticker tests |
| An inline `style` attribute is injected (`game/` start) | 125 of 142 red: the Content-Security-Policy violation fails every test that opens the page |
| `Margins.busy` stuck true after a capture (`game/` playMove) | 11 red: the capture fight, en passant and promotion, undo and flip, puzzles, the reduced-motion flow |

