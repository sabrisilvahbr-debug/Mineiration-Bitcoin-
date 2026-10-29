import { test } from "node:test";
import assert from "node:assert/strict";
import { AGENTS } from "../../src/agents/registry.ts";

test("25 agentes, ids 1..25 e slugs únicos", () => {
  assert.equal(AGENTS.length, 25);
  assert.deepEqual(AGENTS.map((a) => a.id), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.equal(new Set(AGENTS.map((a) => a.slug)).size, 25);
});
