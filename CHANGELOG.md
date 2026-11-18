# Changelog

## Unreleased

### Added
- A story in chapters, lessons, a look back at a finished game, saving and loading games, opening names, a three-minute puzzle rush, more clock choices, and kinds of paper.
- Three hundred puzzles: mate in one, two and three, and winning a piece.
- A stronger computer on hard, a master level, playing styles, and thinking in a worker.
- Online: the rooms service can pair two waiting visitors.
- Browser tests for the whole page, a lint step, and both in CI.

### Fixed
- A long session no longer keeps every creature that ever moved in memory.
- A move whose animation fails no longer blocks every move after it.
- A new game started while the computer, a puzzle reply or the rush was waiting no longer gets a move from the old game.
- Choosing a promotion after the game ended (on time, or replaced online) no longer plays the move.
- Joining the room you are already in no longer opens a second connection.
- The clock choice is honoured again after leaving an online game.
- The status line keeps the result after an online game ends.
- A pasted position that claims castling without the castle at home no longer lets the king jump.
- Saved diaries, stickers and solved puzzles of the wrong shape no longer break the end of a game.
- The look back on an empty game says so and keeps the keyboard focus.
- Vietnamese lines in the story and lessons are written in a handwriting that has their letters.
- On a desktop the move list is on the first screen again.

### Security
- Rooms: limits per network address (IPv6 by /64), origin checks on lookups and sockets, a message budget per room, size and type checks on every message, names cleaned, tokens compared in constant time.
- Weather: only GET and HEAD, a time limit, a checked reply, a short private cache.
