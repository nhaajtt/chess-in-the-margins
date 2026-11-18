# How the code is laid out

There is no build step. The page loads plain scripts in the order `index.html` lists them. Each script keeps to itself inside one function and hands the others a single object on `window`.

```
index.html
  vendor/gsap.min.js, vendor/rough.js      drawing and motion libraries, served from the site
  paper.js        window.Paper             the sheet of paper (runs first, before anything is shown)
  engine.js       window.ChessEngine       rules, notation, search; no DOM, also used by the worker and the rooms service
  creatures.js    window.Creatures         the twelve creatures and their parts
  themes.js       window.Themes            holidays and seasons
  sound.js        window.Sound
  torch.js        window.Torch
  sling.js        window.Sling
  weather.js      window.Weather           asks /api/weather for one word about the sky
  puzzles.js      window.CHESS_PUZZLES     data only
  game.js         window.Margins           the board, the moves, the page around it
  thinker.js      window.Thinker           runs engine.js in engine-worker.js and gives game.js its thinker
  look.js, match.js, pgn.js, review.js, openings.js, adventure.js, school.js
                                           features that only talk to window.Margins
sw.js                                      the offline copy
api/weather.js                             a Vercel function
server/                                    the rooms: a Cloudflare Worker with Durable Objects
```

## The door: `window.Margins`

Everything outside `game.js` goes through this object, defined at the end of `game.js`. Features listen with `Margins.on("new" | "move" | "end", fn)`, read the game with `Margins.fen()` and `Margins.played()`, start one with `Margins.load({ fen, moves, mode, level, human, style, tag })`, and never reach into the board's own variables. A new feature should be a new file that uses this door.

## Inside `game.js`

`game.js` is one function of about five thousand lines. It is long on purpose, for now. The board, the creatures on it, the camera and the doodles share a few hundred variables (the position, what is selected, which animations are running), and the animations depend on the exact order things happen in. Cutting it into files would mean either making those variables global or rewriting every access to them, and neither can be shown to leave every animation exactly as it is without checking each one by eye. Until that is done as its own project, the file is kept in sections, each under a `/* ---------- name ---------- */` banner:

| Line (about) | Section |
|---|---|
| 54 | geometry: the tilted board and where a square is on the page |
| 94 | the pen: every drawing exists three times and the copies take turns |
| 206 | marks: the ring, the dots, the trail |
| 275 | creatures: placing them, their life while idle |
| 416 | worry, check, sweat |
| 460 | the camera |
| 492 | stars, dust, words |
| 547 | the squares: the buttons the player really presses |
| 723 | moving: each kind travels its own way |
| 909 | captures: each kind has its own |
| 1123 | after each move: status, commentary, the end of a game |
| 1295 | the computer |
| 1333 | the clock |
| 1379 | the doodles around the page, and the night sky |
| 2531 | what happens while nobody moves |
| 3055 | running jokes and the creatures' own ways |
| 3736 | the controls |
| 3892 | playing a friend online |
| 4134 | sound and the volume slingshot |
| 4201 | puzzles and the rush |
| 4367 | stickers |
| 4475 | "teach me" |
| 4510 | the diary |
| 4585 | the opening story |
| 4971 | `window.Margins` |

Three rules keep it safe to change:

- A move on the board is a *job* (`playMove`). Jobs run one after another, each can be finished at once (`finishNow`), and a job that fails is put where it ends so the next one is not held up. A job lets go of the one before it as soon as that one is over.
- Anything that waits (a timer, a thinking computer, a puzzle reply) remembers which game it belongs to and does nothing if a new game has begun.
- Whatever is read from `localStorage` (the `chess-*` keys) is checked for its shape before use. The names and formats of those keys are a promise to players and do not change.

## The rooms service

`server/src/index.js` keeps the real game for two players and checks every move with the same `engine.js`. What can reach what:

- The page may talk only to its own origin, the fonts, and the rooms service (the `Content-Security-Policy` in `vercel.json`).
- The rooms service answers only pages from the origins in `server/wrangler.jsonc`, limits new rooms and lookups per network address, and limits messages per socket and per room.
- A seat is held by a random token kept in the player's browser; the service compares it in constant time.
- `api/weather.js` gives the page one word about the sky. The visitor's place never reaches the page, and nothing is stored beyond a short cache in memory.

## Checks

| Command | What it covers |
|---|---|
| `npm run lint` | every script, with ESLint's own rules (`eslint.config.mjs`) |
| `npm test` | the move generator (perft), the rules, notation, puzzles, the story's positions, the site's files and headers, the rooms service |
| `npm run test:e2e` | the page itself in a headless Chrome: rules on the board, a game against the computer, clocks, puzzles, saving and loading, the story, storage, keyboard, phone size, reduced motion, offline |
| `npm run test:e2e:online` | two pages playing each other through the rooms service running locally |

`scripts/e2e/README.md` explains how the browser tests are written.
