import test from "node:test";
import assert from "node:assert/strict";
import { checkAll, loadPuzzles, KINDS } from "./puzzles.mjs";

test("every puzzle is legal, forced where it should be, and wins what it claims", () => {
  const { errors } = checkAll();
  assert.deepEqual(errors, []);
});

test("counts, ids and ratings", () => {
  const list = loadPuzzles();
  const { counts } = checkAll(list);
  for (const k in KINDS) assert.equal(counts[k], KINDS[k].count, k);
  assert.equal(new Set(list.map((p) => p.id)).size, list.length);
  for (const p of list) if (p.rating !== undefined) assert.equal(typeof p.rating, "number");
});
