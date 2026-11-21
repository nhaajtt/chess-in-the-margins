/* The names of well-known openings. find() takes the moves played so far (as written, like "e4") and
   answers the longest named line they start with. In the page, the owl mentions a new name once. */
(function (root) {
  "use strict";

  // ECO code | name | moves
  const TABLE = `
A00|Grob Opening|g4
A00|Polish Opening|b4
A00|Van Geet Opening|Nc3
A00|Mieses Opening|d3
A00|Hungarian Opening|g3
A01|Nimzowitsch-Larsen Attack|b3
A02|Bird Opening|f4
A02|Bird Opening: From Gambit|f4 e5
A03|Bird Opening: Dutch Variation|f4 d5
A04|Zukertort Opening|Nf3
A06|Reti Opening|Nf3 d5
A09|Reti Opening: Advance Variation|Nf3 d5 c4
A07|King's Indian Attack|Nf3 d5 g3
A10|English Opening|c4
A16|Anglo-Indian Defence|c4 Nf6
A20|English Opening: King's English|c4 e5
A22|English Opening: Bremen System|c4 e5 Nc3 Nf6
A30|English Opening: Symmetrical Variation|c4 c5
A40|Queen's Pawn Game|d4
A41|Queen's Pawn Game: Old Defence|d4 d6
A43|Old Benoni Defence|d4 c5
A45|Indian Defence|d4 Nf6
A45|Trompowsky Attack|d4 Nf6 Bg5
A46|Torre Attack|d4 Nf6 Nf3 e6 Bg5
A50|Queen's Indian Accelerated|d4 Nf6 c4
A51|Budapest Gambit|d4 Nf6 c4 e5
A57|Benko Gambit|d4 Nf6 c4 c5 d5 b5
A60|Benoni Defence|d4 Nf6 c4 c5 d5 e6
A80|Dutch Defence|d4 f5
A83|Dutch Defence: Staunton Gambit|d4 f5 e4
A84|Dutch Defence: Classical|d4 f5 c4 Nf6
A40|Englund Gambit|d4 e5
B00|Owen's Defence|e4 b6
B00|St. George Defence|e4 a6
B00|Nimzowitsch Defence|e4 Nc6
B01|Scandinavian Defence|e4 d5
B01|Scandinavian Defence: Modern Variation|e4 d5 exd5 Nf6
B01|Scandinavian Defence: Main Line|e4 d5 exd5 Qxd5 Nc3 Qa5
B02|Alekhine Defence|e4 Nf6
B06|Modern Defence|e4 g6
B07|Pirc Defence|e4 d6 d4 Nf6 Nc3
B09|Pirc Defence: Austrian Attack|e4 d6 d4 Nf6 Nc3 g6 f4
B10|Caro-Kann Defence|e4 c6
B10|Caro-Kann Defence: Two Knights|e4 c6 Nc3 d5 Nf3
B12|Caro-Kann Defence: Advance Variation|e4 c6 d4 d5 e5
B12|Caro-Kann Defence: Fantasy Variation|e4 c6 d4 d5 f3
B13|Caro-Kann Defence: Exchange Variation|e4 c6 d4 d5 exd5 cxd5
B14|Caro-Kann Defence: Panov Attack|e4 c6 d4 d5 exd5 cxd5 c4
B15|Caro-Kann Defence: Main Line|e4 c6 d4 d5 Nc3 dxe4 Nxe4
B17|Caro-Kann Defence: Karpov Variation|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7
B18|Caro-Kann Defence: Classical Variation|e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5
B20|Sicilian Defence|e4 c5
B21|Sicilian Defence: Smith-Morra Gambit|e4 c5 d4 cxd4 c3
B21|Sicilian Defence: Grand Prix Attack|e4 c5 f4
B22|Sicilian Defence: Alapin Variation|e4 c5 c3
B23|Sicilian Defence: Closed|e4 c5 Nc3
B25|Sicilian Defence: Closed, Fianchetto|e4 c5 Nc3 Nc6 g3
B27|Sicilian Defence: Hyperaccelerated Dragon|e4 c5 Nf3 g6
B30|Sicilian Defence: Old Sicilian|e4 c5 Nf3 Nc6
B31|Sicilian Defence: Rossolimo Variation|e4 c5 Nf3 Nc6 Bb5
B35|Sicilian Defence: Accelerated Dragon|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6
B33|Sicilian Defence: Sveshnikov Variation|e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5
B40|Sicilian Defence: French Variation|e4 c5 Nf3 e6
B41|Sicilian Defence: Kan Variation|e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6
B44|Sicilian Defence: Taimanov Variation|e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6
B50|Sicilian Defence: Modern Variations|e4 c5 Nf3 d6
B51|Sicilian Defence: Moscow Variation|e4 c5 Nf3 d6 Bb5+
B54|Sicilian Defence: Open|e4 c5 Nf3 d6 d4 cxd4 Nxd4
B56|Sicilian Defence: Classical Variation|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3
B60|Sicilian Defence: Richter-Rauzer Attack|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 Nc6 Bg5
B70|Sicilian Defence: Dragon Variation|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6
B80|Sicilian Defence: Scheveningen Variation|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6
B90|Sicilian Defence: Najdorf Variation|e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6
C00|French Defence|e4 e6
C01|French Defence: Exchange Variation|e4 e6 d4 d5 exd5 exd5
C02|French Defence: Advance Variation|e4 e6 d4 d5 e5
C03|French Defence: Tarrasch Variation|e4 e6 d4 d5 Nd2
C10|French Defence: Rubinstein Variation|e4 e6 d4 d5 Nc3 dxe4
C11|French Defence: Classical Variation|e4 e6 d4 d5 Nc3 Nf6
C15|French Defence: Winawer Variation|e4 e6 d4 d5 Nc3 Bb4
C20|King's Pawn Game|e4 e5
C21|Danish Gambit|e4 e5 d4 exd4 c3
C21|Centre Game|e4 e5 d4 exd4 Qxd4
C23|Bishop's Opening|e4 e5 Bc4
C25|Vienna Game|e4 e5 Nc3
C26|Vienna Game: Vienna Gambit|e4 e5 Nc3 Nf6 f4
C30|King's Gambit|e4 e5 f4
C30|King's Gambit Declined|e4 e5 f4 Bc5
C33|King's Gambit Accepted|e4 e5 f4 exf4
C40|Latvian Gambit|e4 e5 Nf3 f5
C41|Philidor Defence|e4 e5 Nf3 d6
C42|Petrov's Defence|e4 e5 Nf3 Nf6
C42|Petrov's Defence: Classical Attack|e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4
C44|Ponziani Opening|e4 e5 Nf3 Nc6 c3
C44|Scotch Game|e4 e5 Nf3 Nc6 d4
C45|Scotch Game: Main Line|e4 e5 Nf3 Nc6 d4 exd4 Nxd4
C46|Three Knights Game|e4 e5 Nf3 Nc6 Nc3
C47|Four Knights Game|e4 e5 Nf3 Nc6 Nc3 Nf6
C48|Four Knights Game: Spanish Variation|e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5
C50|Italian Game|e4 e5 Nf3 Nc6 Bc4
C50|Hungarian Defence|e4 e5 Nf3 Nc6 Bc4 Be7
C51|Evans Gambit|e4 e5 Nf3 Nc6 Bc4 Bc5 b4
C53|Italian Game: Giuoco Piano|e4 e5 Nf3 Nc6 Bc4 Bc5 c3
C55|Italian Game: Two Knights Defence|e4 e5 Nf3 Nc6 Bc4 Nf6
C57|Two Knights Defence: Knight Attack|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5
C57|Two Knights Defence: Fried Liver Attack|e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7
C60|Ruy Lopez|e4 e5 Nf3 Nc6 Bb5
C63|Ruy Lopez: Schliemann Defence|e4 e5 Nf3 Nc6 Bb5 f5
C64|Ruy Lopez: Classical Defence|e4 e5 Nf3 Nc6 Bb5 Bc5
C65|Ruy Lopez: Berlin Defence|e4 e5 Nf3 Nc6 Bb5 Nf6
C67|Ruy Lopez: Berlin Defence, Rio Gambit Accepted|e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4
C68|Ruy Lopez: Exchange Variation|e4 e5 Nf3 Nc6 Bb5 a6 Bxc6
C70|Ruy Lopez: Morphy Defence|e4 e5 Nf3 Nc6 Bb5 a6 Ba4
C84|Ruy Lopez: Closed Variation|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7
C88|Ruy Lopez: Closed, Anti-Marshall|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3
C92|Ruy Lopez: Closed, Zaitsev System|e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O
D00|Queen's Pawn Game: London System|d4 d5 Bf4
D01|Richter-Veresov Attack|d4 d5 Nc3 Nf6 Bg5
D02|Queen's Pawn Game: Zukertort Variation|d4 d5 Nf3
D02|London System|d4 d5 Nf3 Nf6 Bf4
D06|Queen's Gambit|d4 d5 c4
D07|Queen's Gambit Declined: Chigorin Defence|d4 d5 c4 Nc6
D08|Queen's Gambit Declined: Albin Countergambit|d4 d5 c4 e5
D10|Slav Defence|d4 d5 c4 c6
D20|Queen's Gambit Accepted|d4 d5 c4 dxc4
D30|Queen's Gambit Declined|d4 d5 c4 e6
D31|Queen's Gambit Declined: Tarrasch Defence|d4 d5 c4 e6 Nc3 c5
D35|Queen's Gambit Declined: Exchange Variation|d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5
D43|Semi-Slav Defence|d4 d5 c4 c6 Nf3 Nf6 Nc3 e6
D50|Queen's Gambit Declined: Modern Variation|d4 d5 c4 e6 Nc3 Nf6 Bg5
D60|Queen's Gambit Declined: Orthodox Defence|d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7
D70|Neo-Grunfeld Defence|d4 Nf6 c4 g6 f3 d5
D80|Grunfeld Defence|d4 Nf6 c4 g6 Nc3 d5
D85|Grunfeld Defence: Exchange Variation|d4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4
E00|Catalan Opening|d4 Nf6 c4 e6 g3
E04|Catalan Opening: Open Defence|d4 Nf6 c4 e6 g3 d5 Bg2 dxc4
E10|Queen's Pawn Game: Indian Defence|d4 Nf6 c4 e6
E11|Bogo-Indian Defence|d4 Nf6 c4 e6 Nf3 Bb4+
E12|Queen's Indian Defence|d4 Nf6 c4 e6 Nf3 b6
E20|Nimzo-Indian Defence|d4 Nf6 c4 e6 Nc3 Bb4
E60|King's Indian Defence|d4 Nf6 c4 g6
E70|King's Indian Defence: Normal Variation|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6
E80|King's Indian Defence: Samisch Variation|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3
E90|King's Indian Defence: Classical Variation|d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3
`;

  const LINES = TABLE.trim().split("\n").map((row) => {
    const [eco, name, moves] = row.split("|");
    return { eco, name, moves: moves.split(" ") };
  });
  const BOOK = new Map(LINES.map((l) => [l.moves.join(" "), { name: l.name, eco: l.eco }]));
  const LONGEST = LINES.reduce((n, l) => Math.max(n, l.moves.length), 0);
  const plain = (s) => String(s).replace(/[+#!?]+$/g, "");

  // the longest named line that the moves start with, or null
  function find(sans) {
    const list = (sans || []).slice(0, LONGEST).map(plain);
    for (let n = list.length; n > 0; n--) {
      const hit = BOOK.get(list.slice(0, n).join(" "));
      if (hit) return { name: hit.name, eco: hit.eco, plies: n };
    }
    return null;
  }

  root.Openings = { find, lines: LINES };

  /* ---------- in the page: the owl speaks up the first time a new name is reached ---------- */
  if (typeof document === "undefined") return;
  let said = null;
  function listen(M) {
    M.on("new", () => { said = null; });
    M.on("move", (e) => {
      if (M.mode === "puzzle" || (e && e.mode === "puzzle")) return;
      const sans = M.played().map((m) => m.san);
      if (sans.length > 16) return;
      const hit = find(sans);
      if (!hit || hit.name === said) return;
      said = hit.name;
      M.note(`the owl knows this one: the ${hit.name}`);
    });
  }
  // the game may load after this file
  if (root.Margins && root.Margins.on) listen(root.Margins);
  else root.addEventListener("load", () => { if (root.Margins && root.Margins.on) listen(root.Margins); });
})(typeof window !== "undefined" ? window : globalThis);
