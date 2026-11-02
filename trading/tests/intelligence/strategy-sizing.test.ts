import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateStrategy, DEFAULT_PARAMS } from "../../src/intelligence/strategy.ts";
import { sizePosition } from "../../src/intelligence/sizing.ts";

test("sem dados suficientes: manter, confiança 0", () => {
  const o = evaluateStrategy([1, 2, 3], DEFAULT_PARAMS);
  assert.equal(o.signal, "manter");
  assert.equal(o.confidence, 0);
});

test("alta pura deixa RSI sobrecomprado → vende (proteção)", () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + i); // sobe sempre, RSI ~100
  assert.equal(evaluateStrategy(closes, DEFAULT_PARAMS).signal, "vender");
});

test("alta que estabiliza (RSI esfria) com média curta acima da longa → compra", () => {
  // 60 barras subindo, depois 20 barras de lado: fast(20) acima de slow(50), RSI volta ao meio.
  const closes: number[] = [];
  for (let i = 0; i < 60; i++) closes.push(100 + i * 0.5);
  for (let k = 0; k < 20; k++) closes.push(130 + 0.4 * Math.sin(k));
  const s = evaluateStrategy(closes, DEFAULT_PARAMS);
  assert.equal(s.signal, "comprar");
  assert.ok(s.confidence > 0 && (s.rsi as number) < DEFAULT_PARAMS.rsiOverbought);
});

test("tendência de baixa gera venda", () => {
  const closes = Array.from({ length: 80 }, (_, i) => 200 - i);
  const o = evaluateStrategy(closes, DEFAULT_PARAMS);
  assert.equal(o.signal, "vender");
});

test("dimensionamento: risco por operação respeitado e teto de exposição", () => {
  // capital 10000, risco 1% = 100; stop 5% → notional 2000; perda = 2000*0.05 = 100. OK.
  const a = sizePosition({ capital: 10000, riskPerTrade: 0.01, stopDistance: 0.05, price: 100, maxExposure: 0.6 });
  assert.ok(Math.abs(a.notional - 2000) < 1e-9);
  assert.ok(Math.abs(a.riskAmount - 100) < 1e-9);
  assert.equal(a.qty, 20);
  assert.equal(a.cappedByExposure, false);
  // stop apertado faria notional gigante → limitado a 60% de 10000 = 6000
  const b = sizePosition({ capital: 10000, riskPerTrade: 0.01, stopDistance: 0.005, price: 100, maxExposure: 0.6 });
  assert.equal(b.notional, 6000);
  assert.equal(b.cappedByExposure, true);
  // entradas inválidas → zero
  assert.equal(sizePosition({ capital: 0, riskPerTrade: 0.01, stopDistance: 0.05, price: 100, maxExposure: 0.6 }).qty, 0);
});
