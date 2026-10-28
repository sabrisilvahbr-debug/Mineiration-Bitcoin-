import { test } from "node:test";
import assert from "node:assert/strict";
import { zscore, ewma, detectUnderDelivery, priceDivergence } from "../../src/intelligence/anomalies.ts";
import { scamScore, BLOCK_BELOW } from "../../src/intelligence/scamscore.ts";
import type { Rubric } from "../../src/intelligence/scamscore.ts";

test("zscore: valor conhecido e desvio zero → null", () => {
  const z = zscore([10, 12, 14, 16, 18], 30);
  assert.ok(Math.abs((z as number) - (30 - 14) / Math.sqrt(10)) < 1e-12);
  assert.equal(zscore([5, 5, 5], 6), null);
  assert.equal(zscore([5], 6), null);
});

test("ewma: média móvel exponencial", () => {
  assert.equal(ewma([10], 0.5), 10);
  assert.equal(ewma([10, 20], 0.5), 15);
  assert.throws(() => ewma([], 0.5), RangeError);
  assert.throws(() => ewma([1], 0), RangeError);
});

test("hashrate entregue menor que o contratado", () => {
  assert.deepEqual(detectUnderDelivery(10, 9.5, 0.1), { underDelivered: false, ratio: 0.95 });
  assert.equal(detectUnderDelivery(10, 8, 0.1).underDelivered, true);
  assert.equal(detectUnderDelivery(0, 0, 0.1).underDelivered, false);
});

test("divergência entre duas fontes de preço", () => {
  assert.ok(Math.abs(priceDivergence(100, 101) - 1 / 100.5) < 1e-12);
  assert.equal(priceDivergence(100, 100), 0);
  assert.throws(() => priceDivergence(0, 100), RangeError);
});

const clean: Rubric = {
  fixedReturnGuaranteed: false,
  referralBonus: false,
  opaqueContracts: false,
  noLegalEntityOrAudit: false,
  noWithdrawal: false,
  urgencyPressure: false,
  complaintsLevel: 0,
};

test("golpe: rubrica limpa = 100 e liberada", () => {
  const r = scamScore(clean);
  assert.equal(r.score, 100);
  assert.equal(r.blocked, false);
});

test("golpe: rendimento fixo garantido reprova automaticamente (nota 0)", () => {
  const r = scamScore({ ...clean, fixedReturnGuaranteed: true });
  assert.equal(r.score, 0);
  assert.equal(r.blocked, true);
  assert.ok(r.reasons.some((x) => /fixo/i.test(x)));
});

test("golpe: nota < 70 bloqueia; exatamente 70 libera", () => {
  assert.equal(BLOCK_BELOW, 70);
  const a = scamScore({ ...clean, referralBonus: true }); // 100-30 = 70
  assert.equal(a.score, 70);
  assert.equal(a.blocked, false);
  const b = scamScore({ ...clean, referralBonus: true, urgencyPressure: true }); // 55
  assert.equal(b.blocked, true);
  assert.ok(scamScore({ ...clean, noWithdrawal: true, opaqueContracts: true, complaintsLevel: 3 }).score >= 0);
});
