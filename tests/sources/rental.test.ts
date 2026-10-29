import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNicehashOrders, fetchNicehashRental, rentalMargin, EH_PER_PH } from "../../src/sources/rental.ts";
import type { FetchLike } from "../../src/sources/http.ts";

const now = new Date("2026-10-29T12:00:00.000Z");
// Respostas sintéticas no formato real observado na sondagem do CI (price em BTC/EH/dia).
const sample = {
  list: [
    { id: "a", price: 0.5, speedLimit: 1, acceptedCurrentSpeed: 2, alive: true },
    { id: "b", price: 0.4, speedLimit: 1, acceptedCurrentSpeed: 3, alive: true },
    { id: "c", price: 9, speedLimit: 1, acceptedCurrentSpeed: 0, alive: true }, // sem hashrate: ignorada
    { id: "d", price: 1, speedLimit: 1, acceptedCurrentSpeed: 5, alive: false }, // morta: ignorada
  ],
};

test("média ponderada pela velocidade entregue, em sats/PH/dia (price é BTC/EH/dia)", () => {
  const r = parseNicehashOrders(sample);
  // (0.5*2 + 0.4*3)/5 = 0.44 BTC/EH/dia → /1000 → *1e8 = 44000 sats/PH/dia
  assert.ok(Math.abs(r.marketSatsPerPhDay - 44000) < 1e-6);
  assert.ok(Math.abs(r.marketBtcPerPhDay - 0.44 / EH_PER_PH) < 1e-15);
  assert.equal(r.minSatsPerPhDay, 40000);
  assert.equal(r.maxSatsPerPhDay, 50000);
  assert.equal(r.acceptedEhs, 5);
  assert.equal(r.activeOrders, 2);
});

test("valores reais da sondagem caem numa faixa sã (dezenas de milhares de sats/PH/dia)", () => {
  const r = parseNicehashOrders({ list: [{ price: 0.472, speedLimit: 0.003, acceptedCurrentSpeed: 0.0032, alive: true }] });
  assert.ok(Math.abs(r.marketSatsPerPhDay - 47200) < 1e-6);
});

test("rejeita formato diferente e lista sem hashrate ativo", () => {
  assert.throws(() => parseNicehashOrders({ list: [{ price: "x", speedLimit: 1, acceptedCurrentSpeed: 1, alive: true }] }), TypeError);
  assert.throws(() => parseNicehashOrders({ list: [{ price: 1, speedLimit: 1, acceptedCurrentSpeed: 1 }] }), TypeError); // sem alive
  assert.throws(() => parseNicehashOrders({ foo: 1 }), TypeError);
  assert.throws(() => parseNicehashOrders({ list: [{ price: 1, speedLimit: 1, acceptedCurrentSpeed: 0, alive: true }] }), TypeError); // nada ativo
});

test("fetch devolve sem dado em falha, sem inventar valor", async () => {
  const down: FetchLike = async () => { throw new Error("timeout"); };
  const r = await fetchNicehashRental(down, now);
  assert.equal(r.ok, false);
  const ok: FetchLike = async () => ({ ok: true, status: 200, json: async () => sample, text: async () => "" });
  const r2 = await fetchNicehashRental(ok, now);
  assert.equal(r2.ok, true);
  if (r2.ok) assert.equal(r2.source, "NiceHash (marketplace SHA256ASICBOOST)");
});

test("margem do aluguel: prejuízo quando o preço supera o hashprice", () => {
  // Cenário real: alugar a 47200 e receber 41654 → margem bruta negativa.
  const m = rentalMargin(47200, 41654);
  assert.ok(m);
  assert.equal(m.profitable, false);
  assert.ok(m.grossMarginPct < 0 && m.grossMarginPct > -0.2);
  // Cenário lucrativo hipotético.
  const g = rentalMargin(40000, 44000);
  assert.ok(g && g.profitable && Math.abs(g.grossMarginPct - 0.1) < 1e-9);
  assert.equal(rentalMargin(0, 100), null);
});
