import { test } from "node:test";
import assert from "node:assert/strict";
import { backtest, outOfSample, DEFAULT_COSTS } from "../../src/intelligence/backtest.ts";
import { DEFAULT_PARAMS } from "../../src/intelligence/strategy.ts";
import { runScenarios } from "../../src/intelligence/montecarlo.ts";

// Série sintética (não é mercado): tendência + ruído determinístico.
const closes = Array.from({ length: 300 }, (_, i) => 100 * Math.exp(0.001 * i) * (1 + 0.02 * Math.sin(i / 5)));

test("backtest roda, tem curva de capital e métricas coerentes", () => {
  const r = backtest(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 10000);
  assert.ok(r.equityCurve.length > 0);
  assert.ok(Number.isFinite(r.returnPct));
  assert.ok(r.maxDrawdownPct >= 0);
  assert.ok(r.finalEquity > 0);
  assert.ok(r.trades >= 0);
});

test("custos reduzem o resultado (custo alto piora)", () => {
  const barato = backtest(closes, DEFAULT_PARAMS, { feePct: 0, slippagePct: 0 }, 10000);
  const caro = backtest(closes, DEFAULT_PARAMS, { feePct: 0.02, slippagePct: 0.01 }, 10000);
  assert.ok(caro.finalEquity <= barato.finalEquity);
});

test("validação fora da amostra retorna train/test e um veredito booleano", () => {
  const oos = outOfSample(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 0.7);
  assert.ok(oos.train.bars > 0 && oos.test.bars > 0);
  assert.equal(typeof oos.approved, "boolean");
});

test("Monte Carlo: percentis ordenados, prob de perda em [0,1], null sem dados", () => {
  const rets = Array.from({ length: 200 }, (_, i) => 0.001 * Math.sin(i) - 0.0002);
  const s = runScenarios(rets, 30, 1000, 7);
  assert.ok(s);
  assert.ok(s.p5Pct <= s.medianPct && s.medianPct <= s.p95Pct);
  assert.ok(s.probLoss >= 0 && s.probLoss <= 1);
  const again = runScenarios(rets, 30, 1000, 7);
  assert.deepEqual(s, again); // determinístico
  assert.equal(runScenarios([0.1, 0.2], 30), null);
});
