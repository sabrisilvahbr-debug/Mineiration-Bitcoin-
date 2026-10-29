import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHashrate, parseDifficultyAdjustment, parseRewardStats, parseTipHeight, fetchNetwork, SUBSIDY_SATS } from "../../src/sources/mempool.ts";
import { parseMercadoBitcoin, parseCoinbase, fetchPrices } from "../../src/sources/price.ts";
import { parseMbCandles, parseCbCandles, fetchPriceHistory } from "../../src/sources/history.ts";
import type { FetchLike } from "../../src/sources/http.ts";

// Respostas ABAIXO são sintéticas e seguem o formato documentado de cada API.
// Servem só para provar o parsing; não são dados de mercado.
const hashrateJson = {
  hashrates: [{ timestamp: 1, avgHashrate: 9e20 }, { timestamp: 2, avgHashrate: 1e21 }],
  difficulty: [],
  currentHashrate: 1e21,
  currentDifficulty: 1.4e14,
};
const daJson = { progressPercent: 40.5, difficultyChange: 2.5, estimatedRetargetDate: 1790000000000, remainingBlocks: 1200 };
const rewardJson = { startBlock: 1, endBlock: 144, totalReward: "46080000000", totalFee: "1080000000", totalTx: "400000" };
const now = new Date("2026-10-28T12:00:00.000Z");

const route = (map: Record<string, unknown | Error>): FetchLike => async (url) => {
  const hit = Object.keys(map).find((k) => url.includes(k));
  if (!hit) return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  const v = map[hit];
  if (v instanceof Error) throw v;
  return { ok: true, status: 200, json: async () => v, text: async () => String(v) };
};

test("mempool: parsers aceitam o formato documentado", () => {
  assert.equal(parseHashrate(hashrateJson).currentHashrateHs, 1e21);
  assert.equal(parseDifficultyAdjustment(daJson).remainingBlocks, 1200);
  const rs = parseRewardStats(rewardJson, 144);
  assert.equal(rs.avgRewardSatsPerBlock, 46080000000 / 144);
  assert.equal(parseTipHeight("950000\n"), 950000);
});

test("mempool: parsers rejeitam formato diferente (campo faltando, tipo errado, ≤ 0)", () => {
  assert.throws(() => parseHashrate({ ...hashrateJson, currentHashrate: "abc" }), TypeError);
  assert.throws(() => parseHashrate({ ...hashrateJson, currentHashrate: 0 }), TypeError);
  assert.throws(() => parseHashrate({ hashrates: [{}] }), TypeError);
  assert.throws(() => parseDifficultyAdjustment({ progressPercent: 1 }), TypeError);
  assert.throws(() => parseRewardStats({ totalReward: 0, totalFee: 0 }, 144), TypeError);
  assert.throws(() => parseTipHeight("<html>"), TypeError);
});

test("mempool: fetchNetwork calcula hashprice próprio com taxas", async () => {
  const f = route({ "mining/hashrate": hashrateJson, "difficulty-adjustment": daJson, "reward-stats": rewardJson, "tip/height": "950000" });
  const r = await fetchNetwork(f, now);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.source, "mempool.space");
  assert.equal(r.collectedAt, now.toISOString());
  assert.equal(r.value.networkPh, 1e6);
  assert.equal(r.value.feesIncluded, true);
  assert.equal(r.value.hashpriceSatsPerPhDay, (46080000000 / 144) * 144 / 1e6);
  assert.equal(r.value.blocksToHalving, 100000);
});

test("mempool: sem reward-stats usa só o subsídio e avisa", async () => {
  const f = route({ "mining/hashrate": hashrateJson, "difficulty-adjustment": daJson, "reward-stats": new Error("fora"), "tip/height": "950000" });
  const r = await fetchNetwork(f, now);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.feesIncluded, false);
  assert.equal(r.value.hashpriceSatsPerPhDay, (SUBSIDY_SATS * 144) / 1e6);
  assert.ok(r.value.warnings.some((w) => /subsídio/.test(w)));
});

test("mempool: hashrate indisponível = sem dado (ok: false), sem inventar valor", async () => {
  const r = await fetchNetwork(route({ "mining/hashrate": new Error("timeout") }), now);
  assert.equal(r.ok, false);
  const r2 = await fetchNetwork(route({}), now); // 404
  assert.equal(r2.ok, false);
  if (!r2.ok) assert.match(r2.error, /404/);
});

test("preço: parsers e formatos errados", () => {
  const mb = parseMercadoBitcoin([{ pair: "BTC-BRL", last: "400000.5", buy: "1", sell: "2", date: 1790000000 }], now);
  assert.equal(mb.price, 400000.5);
  assert.equal(mb.at, new Date(1790000000 * 1000).toISOString());
  assert.equal(parseMercadoBitcoin([{ pair: "BTC-BRL", last: "10" }], now).at, now.toISOString());
  assert.throws(() => parseMercadoBitcoin([{ pair: "ETH-BRL", last: "1" }], now), TypeError);
  assert.throws(() => parseMercadoBitcoin({ error: "x" }, now), TypeError);
  assert.equal(parseCoinbase({ data: { amount: "401000.00", currency: "BRL" } }), 401000);
  assert.throws(() => parseCoinbase({ data: { amount: "1", currency: "USD" } }), TypeError);
  assert.throws(() => parseCoinbase({ data: { amount: "-1", currency: "BRL" } }), TypeError);
});

test("preço: uma fonte fora devolve a outra e marca a falha", async () => {
  const f = route({ "mercadobitcoin": new Error("fora"), "coinbase.com": { data: { amount: "400000", currency: "BRL" } } });
  const rs = await fetchPrices(f, now);
  assert.equal(rs.length, 2);
  assert.equal(rs.filter((r) => r.ok).length, 1);
  assert.equal(rs.filter((r) => !r.ok).length, 1);
});

test("histórico: candles e ordem cronológica", async () => {
  assert.deepEqual(parseMbCandles({ t: [3, 1, 2], c: ["30", "10", "20"] }), [10, 20, 30]);
  assert.deepEqual(parseCbCandles([[3, 0, 0, 0, 30, 0], [1, 0, 0, 0, 10, 0]]), [10, 30]);
  assert.throws(() => parseMbCandles({ t: [1], c: [] }), TypeError);
  const r = await fetchPriceHistory(route({ "api.mercadobitcoin.net": new Error("x"), "exchange.coinbase.com": [[2, 0, 0, 0, 20, 0], [1, 0, 0, 0, 10, 0]] }), now);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, [10, 20]);
  const bad = await fetchPriceHistory(route({}), now);
  assert.equal(bad.ok, false);
});
