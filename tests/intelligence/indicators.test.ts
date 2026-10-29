import { test } from "node:test";
import assert from "node:assert/strict";
import { sma, ema, rsi, volatility, logReturns } from "../../src/intelligence/indicators.ts";

test("SMA e EMA com valores conhecidos", () => {
  assert.equal(sma([1, 2, 3, 4, 5], 5), 3);
  assert.equal(sma([2, 4, 6], 2), 5);
  assert.equal(sma([1, 2], 3), null);
  assert.equal(ema([5, 5, 5, 5], 3), 5); // série constante → EMA constante
});

test("RSI: alta contínua ~100, queda contínua baixo", () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i);
  assert.equal(rsi(up, 14), 100);
  const down = Array.from({ length: 30 }, (_, i) => 100 - i);
  assert.ok((rsi(down, 14) as number) < 1);
  assert.equal(rsi([1, 2, 3], 14), null);
});

test("volatilidade de série constante = 0; e logReturns", () => {
  assert.equal(volatility([10, 10, 10, 10, 10], 4), 0);
  const r = logReturns([100, 110]);
  assert.ok(Math.abs((r[0] as number) - Math.log(1.1)) < 1e-12);
});
