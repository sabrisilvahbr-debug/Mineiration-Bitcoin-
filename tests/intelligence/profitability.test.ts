import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeRentedEconomics,
  computeAsicEconomics,
  decide,
  soloBlockProbability,
  DEFAULT_POLICY,
} from "../../src/intelligence/profitability.ts";
import { hashpriceSatsPerPhDay, hsToPh } from "../../src/intelligence/hashprice.ts";

// Valores abaixo são ENTRADAS DE TESTE com contas feitas à mão, não dados de mercado.
const rented = {
  ph: 2,
  hashpriceBtcPerPhDay: 0.0005,
  btcBrl: 400000,
  poolFee: 0.02,
  pricePerPhDayBrl: 150,
  platformFee: 0.03,
};

test("aluguel: receita, custo, lucro e margem batem com a conta à mão", () => {
  const e = computeRentedEconomics(rented);
  assert.ok(Math.abs(e.revenueBrlDay - 392) < 1e-9); // 2*0.0005*0.98*400000
  assert.ok(Math.abs(e.costBrlDay - 309) < 1e-9); // 2*150*1.03
  assert.ok(Math.abs(e.profitBrlDay - 83) < 1e-9);
  assert.ok(Math.abs((e.margin as number) - 83 / 309) < 1e-12);
});

test("aluguel: ponto de equilíbrio do hashprice zera a margem", () => {
  const e = computeRentedEconomics(rented);
  const be = e.breakEvenHashpriceBtcPerPhDay as number;
  assert.ok(Math.abs(be - 309 / 784000) < 1e-15);
  const atBreakEven = computeRentedEconomics({ ...rented, hashpriceBtcPerPhDay: be });
  assert.ok(Math.abs(atBreakEven.profitBrlDay) < 1e-9);
});

test("custo zero ou ausente: margem indefinida (null), nunca 0 nem infinito", () => {
  const e = computeRentedEconomics({ ...rented, pricePerPhDayBrl: 0 });
  assert.equal(e.margin, null);
  assert.equal(e.breakEvenHashpriceBtcPerPhDay, 0);
});

test("entradas inválidas (NaN, negativo, infinito) são rejeitadas", () => {
  assert.throws(() => computeRentedEconomics({ ...rented, btcBrl: NaN }), RangeError);
  assert.throws(() => computeRentedEconomics({ ...rented, ph: -1 }), RangeError);
  assert.throws(() => computeRentedEconomics({ ...rented, poolFee: 1.5 }), RangeError);
  assert.throws(() => computeRentedEconomics({ ...rented, btcBrl: Infinity }), RangeError);
});

test("ASIC: custo de energia, prejuízo e tarifa máxima de equilíbrio", () => {
  const e = computeAsicEconomics({
    ph: 0.27,
    kw: 3.645,
    tariffBrlKwh: 0.8,
    hostingBrlDay: 0,
    maintenanceBrlDay: 5,
    hashpriceBtcPerPhDay: 0.0005,
    btcBrl: 400000,
    poolFee: 0.02,
  });
  assert.ok(Math.abs(e.revenueBrlDay - 52.92) < 1e-9);
  assert.ok(Math.abs(e.costBrlDay - 74.984) < 1e-9);
  assert.ok((e.margin as number) < 0);
  assert.ok(Math.abs((e.breakEvenTariffBrlKwh as number) - 47.92 / 87.48) < 1e-9);
});

test("histerese: ≤ pausa pausa; no meio mantém; N seguidas ≥ retomada aumenta", () => {
  const p = DEFAULT_POLICY; // pausa 0, retomada 0,10, N=3
  assert.equal(decide([0.2, 0.2, -0.01], "aumentar", p), "pausar");
  assert.equal(decide([0.0], "manter", p), "pausar"); // limite exato pausa
  assert.equal(decide([0.05], "manter", p), "manter");
  assert.equal(decide([0.05], "aumentar", p), "manter");
  assert.equal(decide([0.05], "pausar", p), "pausar"); // entre os limites não retoma
  assert.equal(decide([0.1, 0.1], "pausar", p), "pausar"); // só 2 coletas
  assert.equal(decide([0.1, 0.12, 0.3], "pausar", p), "aumentar");
});

test("margem indefinida ou sem histórico: pausar por padrão", () => {
  assert.equal(decide([null], "manter", DEFAULT_POLICY), "pausar");
  assert.equal(decide([], "manter", DEFAULT_POLICY), "pausar");
  assert.equal(decide([0.3, 0.3, null], "manter", DEFAULT_POLICY), "pausar");
});

test("probabilidade de achar bloco (solo/PPLNS)", () => {
  assert.equal(soloBlockProbability(0, 1_000_000, 30), 0);
  const p = soloBlockProbability(1, 1_000_000, 30);
  assert.ok(Math.abs(p - (1 - Math.exp(-144 * 30 * 1e-6))) < 1e-12);
  assert.throws(() => soloBlockProbability(1, 0, 30), RangeError);
});

test("hashprice próprio em sats por PH/dia e conversão H/s para PH/s", () => {
  assert.equal(hashpriceSatsPerPhDay(320_000_000, 1_000_000), 46_080);
  assert.equal(hsToPh(1e15), 1);
  assert.throws(() => hashpriceSatsPerPhDay(320_000_000, 0), RangeError);
});
