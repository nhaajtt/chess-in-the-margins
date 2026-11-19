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
  game/*.js       window.Margins           the board, the moves, the page around it (ten files, one program)
  thinker.js      window.Thinker           runs engine.js in engine-worker.js and gives the game its thinker
  look.js, match.js, pgn.js, review.js, openings.js, adventure.js, school.js
                                           features that only talk to window.Margins
sw.js                                      the offline copy
api/weather.js                             a Vercel function
server/                                    the rooms: a Cloudflare Worker with Durable Objects
```

## The door: `window.Margins`

Everything outside `game/` goes through this object, defined in `game/10-door.js`. Features listen with `Margins.on("new" | "move" | "end", fn)`, read the game with `Margins.fen()` and `Margins.played()`, start one with `Margins.load({ fen, moves, mode, level, human, style, tag })`, and never reach into the board's own variables. A new feature should be a new file that uses this door.

## Inside `game/`

The board, the creatures on it, the camera and the doodles share a few hundred variables (the position, what is selected, which animations are running), and the animations depend on the exact order things happen in. So the game is one program cut into ten files by subject. They are plain scripts that load in order; what one declares at its top level, the later ones can use, and functions may call functions from later files once the page has loaded.

| File | What is in it |
|---|---|
| `01-board.js` | set-up, geometry of the tilted board, the pen (every drawing exists three times and the copies take turns), marks, placing the creatures and their idle life, worry and check, the camera, stars and dust |
| `02-moves.js` | the squares the player presses, `playMove`, how each kind travels and how each kind captures |
| `03-turns.js` | status and commentary after each move, the end of a game, the computer's turn, the clock |
| `04-doodles.js` | the doodles around the page and the night sky |
| `05-idle.js` | what the creatures do while nobody moves, the running jokes |
| `06-ways.js` | the creatures' own little ways |
| `07-controls.js` | new game, the buttons and choices, playing a friend online |
| `08-extras.js` | sound, the slingshot's targets, puzzles and the rush, stickers, "teach me", the diary |
| `09-story.js` | the opening story |
| `10-door.js` | `window.Margins` and the start |

What this costs, and the rules that go with it:

- The shared names live in the page's global scope (not on `window`, but visible to any script). A new top-level name in `game/` must not repeat one that exists; the browser refuses the whole file if it does, and the browser tests catch that at once.
- Code that runs while a file loads may only use what earlier files declared. Code inside functions may use anything.
- `04-doodles.js` is over a thousand lines because `drawDeco` is one drawing of the whole page; it is cut no further on purpose.
- The other scripts stay closed functions and never use these names; they go through `window.Margins`.
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
