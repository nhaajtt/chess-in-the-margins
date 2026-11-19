# Working on this project

## Set up

```bash
python -m http.server 5190 --bind 127.0.0.1   # the page, on this machine only
cd server && npm ci && npm run dev            # the rooms, only if you work on online play
```

Node 22 or newer and a Chrome or Edge are needed for the checks. Nothing is installed for the page itself.

## Before you send a change

```bash
npm run lint
npm test
npm run test:e2e
npm run test:e2e:online    # if you touched online play or server/
```

All of them run on every push as well.

## Ground rules

- No build step, no framework, and nothing new for the page to download at run time. Tools for development are fine.
- Nothing a player sees or hears is removed or shortened to make something else easier. A change for speed has to look the same or smoother.
- Saved data stays readable: the `chess-*` keys in `localStorage` keep their names and formats.
- The security headers forbid inline scripts and inline `style` attributes. Set styles from a stylesheet or through `element.style`.
- A new script has to be listed in `index.html` and in the `CORE` list of `sw.js`; `npm test` checks this. Raise `VERSION` in `sw.js` when a cached file changes.
- A new feature goes in its own file and talks to the game through `window.Margins` (see `docs/architecture.md`).
- A bug fix comes with a test that fails without it, where a test can reach it.
- Comments say why, in plain words.

## Where things are

`docs/architecture.md` has the map of the files, and what each file in `game/` holds.
