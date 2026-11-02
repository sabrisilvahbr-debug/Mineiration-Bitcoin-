import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCandles, parseSpot, fetchCandles, fetchSpot } from "../../src/sources/coinbase.ts";
import type { FetchLike } from "../../src/sources/http.ts";

// Formato real da Coinbase Exchange (valores sintéticos): [time, low, high, open, close, volume], mais novo primeiro.
const raw = [
  [1700003600, 99, 103, 100, 102, 5],
  [1700000000, 98, 101, 99, 100, 4],
];

test("candles: ordena do mais antigo para o mais novo e valida", () => {
  const c = parseCandles(raw);
  assert.equal(c.length, 2);
  assert.equal(c[0]!.close, 100);
  assert.equal(c[1]!.close, 102);
  assert.throws(() => parseCandles([[1, 5, 1, 2, 3, 1]]), TypeError); // high<low
  assert.throws(() => parseCandles([]), TypeError);
});

test("spot: extrai amount", () => {
  assert.equal(parseSpot({ data: { amount: "80540.12", currency: "USD" } }), 80540.12);
  assert.throws(() => parseSpot({ data: { amount: "-1" } }), TypeError);
});

test("fetch devolve sem dado em falha", async () => {
  const down: FetchLike = async () => { throw new Error("x"); };
  assert.equal((await fetchCandles(down, "BTC-USD", 3600)).ok, false);
  const ok: FetchLike = async () => ({ ok: true, status: 200, json: async () => raw });
  const r = await fetchCandles(ok, "BTC-USD", 3600);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.source, "Coinbase Exchange (candles reais)");
  const okp: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ data: { amount: "100", currency: "USD" } }) });
  assert.equal((await fetchSpot(okp, "BTC-USD")).ok, true);
});
