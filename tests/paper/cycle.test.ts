import { test } from "node:test";
import assert from "node:assert/strict";
import { runCycle } from "../../src/agents/cycle.ts";
import { createAccount } from "../../src/paper/engine.ts";
import type { Candle } from "../../src/lib/types.ts";

const now = new Date("2026-10-29T12:00:00.000Z");
const fresh = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
function candles(closes: number[]): Candle[] {
  return closes.map((c, i) => ({ time: new Date(1700000000000 + i * 86400000).toISOString(), open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1 }));
}
// Alta que estabiliza → sinal de compra (como no teste da estratégia).
const buyCloses: number[] = [];
for (let i = 0; i < 60; i++) buyCloses.push(100 + i * 0.5);
for (let k = 0; k < 20; k++) buyCloses.push(130 + 0.4 * Math.sin(k));
const downCloses = Array.from({ length: 80 }, (_, i) => 200 - i);

test("sinal de compra com preço fresco: abre posição paper dentro do risco", () => {
  const acc = createAccount(10000);
  const r = runCycle({ inputs: [{ product: "BTC-USD", candles: candles(buyCloses), price: 130, priceCollectedAt: fresh(3) }], account: acc, now });
  assert.equal(r.state, "NORMAL");
  assert.equal(r.products[0]!.signal, "comprar");
  assert.equal(r.products[0]!.action, "comprou (paper)");
  assert.ok(acc.positions["BTC-USD"]!.qty > 0);
  assert.ok(r.exposure > 0 && r.exposure <= 0.6 + 1e-9);
});

test("preço velho: Guardião pausa e não opera", () => {
  const acc = createAccount(10000);
  const r = runCycle({ inputs: [{ product: "BTC-USD", candles: candles(buyCloses), price: 130, priceCollectedAt: fresh(60) }], account: acc, now });
  assert.equal(r.state, "PAUSADO_RISCO");
  assert.equal(r.products[0]!.action, "nada");
  assert.equal(acc.positions["BTC-USD"], undefined);
});

test("com posição e sinal de venda: fecha no paper", () => {
  const acc = createAccount(10000);
  acc.positions["BTC-USD"] = { qty: 1, avgPrice: 150 };
  acc.cash = 10000 - 150;
  const r = runCycle({ inputs: [{ product: "BTC-USD", candles: candles(downCloses), price: 120, priceCollectedAt: fresh(2) }], account: acc, now });
  assert.equal(r.products[0]!.signal, "vender");
  assert.equal(r.products[0]!.action, "vendeu (paper)");
  assert.equal(acc.positions["BTC-USD"], undefined);
});

test("pausa manual: nenhuma ordem", () => {
  const acc = createAccount(10000);
  const r = runCycle({ inputs: [{ product: "BTC-USD", candles: candles(buyCloses), price: 130, priceCollectedAt: fresh(2) }], account: acc, now, manualPause: true });
  assert.equal(r.state, "PAUSADO_MANUAL");
  assert.equal(r.products[0]!.action, "nada");
});
