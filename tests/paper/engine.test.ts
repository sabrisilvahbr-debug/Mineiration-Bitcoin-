import { test } from "node:test";
import assert from "node:assert/strict";
import { createAccount, applyOrder, markToMarket } from "../../src/paper/engine.ts";

const costs = { feePct: 0.004, slippagePct: 0 };
const at = "2026-10-29T12:00:00Z";

test("compra debita caixa com taxa e cria posição", () => {
  const acc = createAccount(10000);
  const r = applyOrder(acc, "comprar", "BTC-USD", 0.1, 1000, costs, at);
  assert.equal(r.ok, true);
  // custo = 0.1*1000 = 100, taxa 0.4% = 0.4 → caixa 10000-100.4
  assert.ok(Math.abs(acc.cash - (10000 - 100.4)) < 1e-9);
  assert.equal(acc.positions["BTC-USD"]?.qty, 0.1);
});

test("não compra sem caixa e não vende a descoberto", () => {
  const acc = createAccount(50);
  assert.equal(applyOrder(acc, "comprar", "BTC-USD", 1, 1000, costs, at).ok, false);
  assert.equal(applyOrder(acc, "vender", "BTC-USD", 1, 1000, costs, at).ok, false);
});

test("venda realiza lucro/prejuízo e marca a mercado", () => {
  const acc = createAccount(10000);
  applyOrder(acc, "comprar", "BTC-USD", 1, 1000, costs, at); // caixa 10000-1004
  const sell = applyOrder(acc, "vender", "BTC-USD", 1, 1100, costs, at);
  assert.equal(sell.ok, true);
  // realizado = (1100-1000)*1 - taxa(1100*0.004=4.4) = 95.6
  assert.ok(Math.abs(acc.realizedPnl - 95.6) < 1e-9);
  assert.equal(acc.positions["BTC-USD"], undefined);
  const eq = markToMarket(acc, {});
  assert.ok(eq.equity > 10000);
  assert.equal(eq.exposure, 0);
});

test("marcação a mercado calcula exposição e lucro não realizado", () => {
  const acc = createAccount(10000);
  applyOrder(acc, "comprar", "BTC-USD", 1, 1000, costs, at);
  const eq = markToMarket(acc, { "BTC-USD": 1200 });
  assert.ok(Math.abs(eq.unrealizedPnl - 200) < 1e-9);
  assert.ok(eq.exposure > 0 && eq.exposure < 1);
});
