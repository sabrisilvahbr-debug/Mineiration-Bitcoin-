import { test } from "node:test";
import assert from "node:assert/strict";
import { runScenarios, logReturns, meanStd } from "../../src/intelligence/scenarios.ts";
import type { ScenarioInput } from "../../src/intelligence/scenarios.ts";

// Dados abaixo são sintéticos, só para provar propriedades do simulador. Não são mercado.
const flat = Array.from({ length: 40 }, () => 100);
const base: ScenarioInput = {
  days: 30,
  paths: 500,
  seed: 42,
  ph: 1,
  hashpriceBtcPerPhDay: 0.0005,
  btcBrl: 400000,
  poolFee: 0,
  costBrlDay: 100,
  priceHistory: flat,
  networkHashrateHistory: flat,
  stopLossBrl: 1000,
};

test("logReturns e meanStd", () => {
  const r = logReturns([100, 110, 121]);
  assert.equal(r.length, 2);
  assert.ok(Math.abs((r[0] as number) - Math.log(1.1)) < 1e-12);
  const { mean, std } = meanStd([1, 2, 3, 4]);
  assert.equal(mean, 2.5);
  assert.ok(Math.abs(std - Math.sqrt(5 / 3)) < 1e-12);
});

test("sem volatilidade e sem crescimento: todos os percentis = dias × (receita − custo)", () => {
  const r = runScenarios(base);
  assert.ok(r);
  const expected = 30 * (0.0005 * 400000 - 100); // 30 * 100 = 3000
  for (const v of [r.p5, r.median, r.p95]) assert.ok(Math.abs(v - expected) < 1e-6);
  assert.equal(r.probLoss, 0);
  assert.equal(r.probStopLoss, 0);
});

test("determinismo: mesma semente, mesmo resultado", () => {
  const noisy = { ...base, priceHistory: [100, 105, 98, 110, 95, 120, 100, 90, 115, 100, 108, 97, 111, 99, 104, 96, 112, 101, 94, 118, 100, 107, 93, 109, 102, 98, 113, 95, 106, 100, 99, 111] };
  const a = runScenarios(noisy);
  const b = runScenarios(noisy);
  assert.deepEqual(a, b);
  const c = runScenarios({ ...noisy, seed: 43 });
  assert.notDeepEqual(a, c);
});

test("ordem dos percentis: P5 ≤ mediana ≤ P95", () => {
  const noisy = { ...base, priceHistory: [100, 105, 98, 110, 95, 120, 100, 90, 115, 100, 108, 97, 111, 99, 104, 96, 112, 101, 94, 118, 100, 107, 93, 109, 102, 98, 113, 95, 106, 100, 99, 111] };
  const r = runScenarios(noisy);
  assert.ok(r);
  assert.ok(r.p5 <= r.median && r.median <= r.p95);
});

test("custo enorme: prejuízo e stop-loss quase certos", () => {
  const r = runScenarios({ ...base, costBrlDay: 10_000 });
  assert.ok(r);
  assert.equal(r.probLoss, 1);
  assert.equal(r.probStopLoss, 1);
});

test("histórico curto demais ou inválido: null (sem dado), nunca chute", () => {
  assert.equal(runScenarios({ ...base, priceHistory: [100, 101] }), null);
  assert.equal(runScenarios({ ...base, networkHashrateHistory: [] }), null);
  assert.equal(runScenarios({ ...base, priceHistory: [...flat.slice(1), -5] }), null);
  assert.equal(runScenarios({ ...base, btcBrl: NaN }), null);
});
