import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDashboard } from "../../src/agents/dashboard.ts";
import { createAccount } from "../../src/paper/engine.ts";
import type { Candle } from "../../src/lib/types.ts";

const now = new Date("2026-10-29T12:00:00.000Z");
const fresh = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
const candles = (closes: number[]): Candle[] => closes.map((c, i) => ({ time: new Date(1700000000000 + i * 86400000).toISOString(), open: c, high: c * 1.01, low: c * 0.99, close: c, volume: 1 }));
const up: number[] = [];
for (let i = 0; i < 60; i++) up.push(100 + i * 0.5);
for (let k = 0; k < 20; k++) up.push(130 + 0.4 * Math.sin(k));

test("monta estado completo com 25 agentes, backtest e cenários reais", () => {
  const acc = createAccount(10000);
  const s = buildDashboard({ inputs: [{ product: "BTC-USD", candles: candles(up), price: 130, priceCollectedAt: fresh(3), priceSource: "Coinbase" }], account: acc, now });
  assert.equal(s.agents.length, 25);
  assert.equal(s.mode, "PAPER");
  assert.ok(s.products[0]!.backtest);
  assert.ok(s.products[0]!.sma20 !== null && s.products[0]!.rsi !== null);
  assert.equal(s.state, "NORMAL");
  assert.ok(s.scenario30);
  assert.match(s.report, /paper trading/i);
});

test("preço velho pausa e nenhum agente de execução fica trabalhando", () => {
  const acc = createAccount(10000);
  const s = buildDashboard({ inputs: [{ product: "BTC-USD", candles: candles(up), price: 130, priceCollectedAt: fresh(99), priceSource: "Coinbase" }], account: acc, now });
  assert.equal(s.state, "PAUSADO_RISCO");
  assert.equal(s.agents.find((a) => a.id === 11)!.status, "pausado");
});
