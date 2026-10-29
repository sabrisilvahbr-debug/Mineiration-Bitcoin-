import { test } from "node:test";
import assert from "node:assert/strict";
import { runCycle } from "../../src/agents/cycle.ts";
import { AGENTS } from "../../src/agents/registry.ts";
import { parseInputs } from "../../src/agents/inputs.ts";
import { MemoryStore } from "../../src/store/memory.ts";
import { RESTRICTED_CONFIG, loadGuardianConfig, signConfig } from "../../src/guardian/config.ts";
import type { GuardianConfig } from "../../src/guardian/config.ts";
import { appendAudit, verifyTail } from "../../src/audit/chain.ts";
import type { FetchLike } from "../../src/sources/http.ts";

// Todas as respostas abaixo são SINTÉTICAS (formato documentado, valores de teste).
const now = new Date("2026-10-28T12:00:00.000Z");
const hist = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));
const hashrateJson = {
  hashrates: hist(40, (i) => ({ timestamp: i, avgHashrate: 1e21 * (1 + i * 0.001) })),
  currentHashrate: 1e21,
  currentDifficulty: 1.4e14,
};
const mbCandles = { t: hist(40, (i) => 1_700_000_000 + i * 86400), c: hist(40, (i) => String(400000 + ((i * 7919) % 5000) * (i % 2 ? 1 : -1))) };

function makeFetch(down: string[] = []): { f: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const f: FetchLike = async (url) => {
    calls.push(url);
    if (down.some((d) => url.includes(d))) throw new Error("fora do ar");
    const body = (j: unknown) => ({ ok: true, status: 200, json: async () => j, text: async () => String(j) });
    if (url.includes("mining/hashrate")) return body(hashrateJson);
    if (url.includes("difficulty-adjustment")) return body({ progressPercent: 40, difficultyChange: 2.5, estimatedRetargetDate: 1790000000000, remainingBlocks: 1200 });
    if (url.includes("reward-stats")) return body({ totalReward: "46080000000", totalFee: "1080000000" });
    if (url.includes("tip/height")) return body("950000");
    if (url.includes("tickers")) return body([{ pair: "BTC-BRL", last: "400000" }]);
    if (url.includes("coinbase.com/v2")) return body({ data: { amount: "400500", currency: "BRL" } });
    if (url.includes("mercadobitcoin.net/api/v4/candles")) return body(mbCandles);
    if (url.includes("orders/active2")) return body({ list: [{ id: "a", price: 0.47, speedLimit: 0.003, acceptedCurrentSpeed: 0.003, alive: true }] });
    if (url.includes("/api/address/")) return body({ address: "bc1q", chain_stats: { funded_txo_sum: 25000000, spent_txo_sum: 5000000, tx_count: 7 }, mempool_stats: {} });
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  return { f, calls };
}

const restricted = loadGuardianConfig(RESTRICTED_CONFIG, undefined, undefined);
const budgetCfg: GuardianConfig = { ...RESTRICTED_CONFIG, limits: { dailySpendBrl: 1000, totalSpendBrl: 10000, dailyStopLossBrl: 500 } };
const secret = "segredo-de-teste";
const signed = loadGuardianConfig(budgetCfg, signConfig(budgetCfg, secret), secret);
const profitable = parseInputs(new URLSearchParams("ph=1&preco=100&taxaPool=0&taxaPlat=0")).inputs;
const losing = parseInputs(new URLSearchParams("ph=1&preco=900&taxaPool=2&taxaPlat=3")).inputs;
const empty = parseInputs(new URLSearchParams("")).inputs;

test("registry: 25 agentes, ids 1..25 e slugs únicos", () => {
  assert.equal(AGENTS.length, 25);
  assert.deepEqual(AGENTS.map((a) => a.id), Array.from({ length: 25 }, (_, i) => i + 1));
  assert.equal(new Set(AGENTS.map((a) => a.slug)).size, 25);
});

test("entradas do CEO: só calcula aluguel com PH, preço e as duas taxas; valida valores", () => {
  const ok = parseInputs(new URLSearchParams("ph=2&preco=150&taxaPool=2&taxaPlat=3&metodo=pplns"));
  assert.deepEqual(ok.inputs.rented, { ph: 2, pricePerPhDayBrl: 150, poolFee: 0.02, platformFee: 0.03 });
  assert.equal(ok.inputs.poolMethod, "PPLNS");
  assert.equal(parseInputs(new URLSearchParams("ph=2&preco=150")).inputs.rented, undefined); // taxas não são presumidas
  const bad = parseInputs(new URLSearchParams("ph=-1&preco=abc&taxaPool=150&metodo=X"));
  assert.ok(bad.errors.length >= 3);
  assert.equal(bad.inputs.rented, undefined);
  assert.equal(parseInputs(new URLSearchParams("ph=1,5&preco=10&taxaPool=0&taxaPlat=0")).inputs.rented?.ph, 1.5);
});

test("todas as APIs fora: PAUSADO_RISCO, sem decisão, sem ordens, sem números inventados", async () => {
  const { f } = makeFetch(["mempool", "mercadobitcoin", "coinbase"]);
  const r = await runCycle({ fetch: f, now, loaded: restricted, inputs: profitable, store: new MemoryStore() });
  assert.equal(r.verdict.state, "PAUSADO_RISCO");
  assert.equal(r.network.ok, false);
  assert.equal(r.verdict.priceBrl, null);
  assert.equal(r.economics.rented, null);
  assert.equal(r.decision, null);
  assert.deepEqual(r.orders, []);
  assert.equal(r.agents.length, 25);
  assert.match(r.report, /sem dado/i);
});

test("saudável e sem custos informados: NORMAL, pede os dados ao CEO, sem decisão", async () => {
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: restricted, inputs: empty, store: new MemoryStore() });
  assert.equal(r.verdict.state, "NORMAL");
  assert.equal(r.verdict.priceBrl, 400250);
  assert.equal(r.decision, null);
  assert.match(r.economics.message ?? "", /Informe/);
  assert.equal(r.network.ok && r.network.value.networkEhs, 1000);
  assert.ok(r.forecast);
  assert.equal(r.agents.find((a) => a.id === 5)?.status, "ocioso");
});

test("custos que dão prejuízo: recomenda pausar e o relatório diz isso", async () => {
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: signed, inputs: losing, store: new MemoryStore() });
  assert.ok((r.economics.rented?.margin ?? 0) < 0);
  assert.equal(r.decision, "pausar");
  assert.deepEqual(r.orders, []);
  assert.match(r.report, /prejuízo/);
  assert.ok(r.scenarios.d30 && r.scenarios.d30.probLoss > 0.99);
});

test("lucrativo + orçamento assinado: histerese pede 3 coletas e só então simula 1 ordem", async () => {
  const store = new MemoryStore();
  const run = (minutes: number) =>
    runCycle({ fetch: makeFetch().f, now: new Date(now.getTime() + minutes * 60_000), loaded: signed, inputs: profitable, store });
  const a = await run(0);
  const b = await run(5);
  // Parte pausado (padrão seguro): só retoma após 3 coletas seguidas com margem ≥ 10%.
  assert.equal(a.decision, "pausar");
  assert.match(a.decisionNote, /1\/3/);
  assert.equal(b.decision, "pausar");
  assert.match(b.decisionNote, /2\/3/);
  assert.deepEqual(a.orders, []);
  const c = await run(10);
  assert.equal(c.decision, "aumentar");
  assert.equal(c.orders.length, 1);
  assert.match(c.orders[0]!.note, /SIMULADA/);
  const d = await run(15); // já gastou hoje: não repete
  assert.equal(d.orders.length, 0);
  assert.equal(d.chainOk, true);
});

test("sem orçamento (config restrita): recomenda aumentar mas NÃO cria ordem", async () => {
  const store = new MemoryStore();
  let last = await runCycle({ fetch: makeFetch().f, now, loaded: restricted, inputs: profitable, store });
  for (let i = 1; i <= 3; i++) {
    last = await runCycle({ fetch: makeFetch().f, now: new Date(now.getTime() + i * 300_000), loaded: restricted, inputs: profitable, store });
  }
  assert.equal(last.decision, "aumentar");
  assert.equal(last.verdict.purchasesAllowed, false);
  assert.deepEqual(last.orders, []);
});

test("pausa manual vence: decisão pausar e estado PAUSADO_MANUAL", async () => {
  const store = new MemoryStore();
  store.state.manualPause = true;
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: signed, inputs: profitable, store });
  assert.equal(r.verdict.state, "PAUSADO_MANUAL");
  assert.equal(r.decision, "pausar");
  assert.equal(r.agents.find((a) => a.id === 6)?.status, "pausado_risco");
});

test("chave com permissão de saque no ambiente bloqueia tudo", async () => {
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: signed, inputs: profitable, store: new MemoryStore(), env: { NICEHASH_WITHDRAW_KEY: "x" } });
  assert.equal(r.verdict.state, "PAUSADO_RISCO");
  assert.equal(r.verdict.purchasesAllowed, false);
  assert.ok(r.notices.some((n) => /CRÍTICO/.test(n)));
});

test("config adulterada: ciclo recusado, nenhuma consulta externa", async () => {
  const { f, calls } = makeFetch();
  const tampered = loadGuardianConfig({ ...budgetCfg, limits: { ...budgetCfg.limits, dailySpendBrl: 1e9 } }, signConfig(budgetCfg, secret), secret);
  const store = new MemoryStore();
  const r = await runCycle({ fetch: f, now, loaded: tampered, inputs: profitable, store });
  assert.equal(r.refused, true);
  assert.equal(calls.length, 0);
  assert.equal(r.verdict.state, "PAUSADO_RISCO");
  assert.equal((await store.load(now)).lastAudit, null); // nada gravado
});

test("só uma fonte de preço: CAUTELA, preço exibido, sem ordem", async () => {
  const r = await runCycle({ fetch: makeFetch(["coinbase"]).f, now, loaded: signed, inputs: profitable, store: new MemoryStore() });
  assert.equal(r.verdict.state, "CAUTELA");
  assert.equal(r.verdict.priceBrl, 400000);
  assert.deepEqual(r.orders, []);
});

test("aluguel real integrado: margem bruta negativa quando preço > hashprice, sem ordens", async () => {
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: signed, inputs: profitable, store: new MemoryStore() });
  assert.equal(r.rental.ok, true);
  assert.ok(r.rentalMargin);
  // hashprice do fixture ~46080/1e6... na verdade price 0.47 BTC/EH = 47000 sats/PH; hashprice do fixture:
  // reward 46080000000/144 *144 /1e6 = 46080 sats/PH. Aluguel 47000 > 46080 → prejuízo.
  assert.equal(r.rentalMargin!.profitable, false);
  assert.ok(r.rentalMargin!.grossMarginPct < 0);
  assert.equal(r.agents.find((a) => a.id === 6)?.detail.includes("prejuízo"), true);
});

test("carteira conectada: totalBtcFound e realConnected vêm do on-chain real", async () => {
  const withWallet = { ...profitable, wallet: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" };
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: signed, inputs: withWallet, store: new MemoryStore() });
  assert.equal(r.realConnected, true);
  assert.equal(r.totalBtcFound, 0.25); // 25000000 sats
  assert.equal(r.wallet?.ok, true);
  assert.equal(r.agents.find((a) => a.id === 13)?.status, "trabalhando");
  assert.match(r.report, /0\.25000000 BTC|0,25/);
});

test("sem carteira: BTC encontrados = 0, nunca inventado", async () => {
  const r = await runCycle({ fetch: makeFetch().f, now, loaded: signed, inputs: profitable, store: new MemoryStore() });
  assert.equal(r.realConnected, false);
  assert.equal(r.totalBtcFound, 0);
  assert.match(r.report, /nenhuma mineração real/);
});

test("auditoria: verifyTail aceita trecho íntegro e rejeita adulterado", () => {
  const e1 = appendAudit(null, { a: 1 }, "2026-10-28T12:00:00Z");
  const e2 = appendAudit(e1, { a: 2 }, "2026-10-28T12:01:00Z");
  const e3 = appendAudit(e2, { a: 3 }, "2026-10-28T12:02:00Z");
  assert.equal(verifyTail([e2, e3]).ok, true);
  assert.equal(verifyTail([e2, { ...e3, payload: "{}" }]).ok, false);
  assert.equal(verifyTail([]).ok, true);
});
