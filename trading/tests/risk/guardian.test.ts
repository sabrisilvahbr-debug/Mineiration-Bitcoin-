import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRisk, validateOrderAgainstLimits, DEFAULT_LIMITS } from "../../src/risk/guardian.ts";
import type { RiskState } from "../../src/risk/guardian.ts";

const now = new Date("2026-10-29T12:00:00.000Z");
const fresh = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
const base: RiskState = { priceCollectedAt: fresh(3), priceDivergence: 0.001, dailyPnlPct: 0, drawdownPct: 0, exposure: 0.2, manualPause: false };

test("tudo saudável: NORMAL e pode abrir", () => {
  const v = evaluateRisk(base, DEFAULT_LIMITS, now);
  assert.equal(v.state, "NORMAL");
  assert.equal(v.canOpen, true);
});

test("preço velho ou divergente pausa", () => {
  assert.equal(evaluateRisk({ ...base, priceCollectedAt: fresh(20) }, DEFAULT_LIMITS, now).state, "PAUSADO_RISCO");
  assert.equal(evaluateRisk({ ...base, priceCollectedAt: null }, DEFAULT_LIMITS, now).state, "PAUSADO_RISCO");
  assert.equal(evaluateRisk({ ...base, priceDivergence: 0.01 }, DEFAULT_LIMITS, now).state, "PAUSADO_RISCO");
});

test("stop diário e drawdown máximo pausam", () => {
  assert.equal(evaluateRisk({ ...base, dailyPnlPct: -0.03 }, DEFAULT_LIMITS, now).state, "PAUSADO_RISCO");
  assert.equal(evaluateRisk({ ...base, dailyPnlPct: -0.029 }, DEFAULT_LIMITS, now).state, "NORMAL");
  assert.equal(evaluateRisk({ ...base, drawdownPct: 0.1 }, DEFAULT_LIMITS, now).state, "PAUSADO_RISCO");
});

test("exposição acima do alvo vira CAUTELA (não abre, mas pode fechar)", () => {
  const v = evaluateRisk({ ...base, exposure: 0.7 }, DEFAULT_LIMITS, now);
  assert.equal(v.state, "CAUTELA");
  assert.equal(v.canOpen, false);
  assert.equal(v.canTrade, true);
});

test("pausa manual vence tudo", () => {
  assert.equal(evaluateRisk({ ...base, manualPause: true }, DEFAULT_LIMITS, now).state, "PAUSADO_MANUAL");
});

test("alavancagem proibida por padrão", () => {
  assert.equal(validateOrderAgainstLimits(DEFAULT_LIMITS, 1.2).allowed, false);
  assert.equal(validateOrderAgainstLimits({ ...DEFAULT_LIMITS, allowLeverage: true, maxExposure: 2 }, 1.2).allowed, true);
  assert.equal(validateOrderAgainstLimits(DEFAULT_LIMITS, 0.7).allowed, false); // > maxExposure 0.6
});
