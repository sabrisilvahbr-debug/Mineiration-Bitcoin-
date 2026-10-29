import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAddressStats, fetchWallet, looksLikeBtcAddress } from "../../src/sources/wallet.ts";
import type { FetchLike } from "../../src/sources/http.ts";

const now = new Date("2026-10-29T12:00:00.000Z");
// Resposta no formato real do mempool.space /api/address/:addr (valores sintéticos).
const stats = { address: "bc1qxy", chain_stats: { funded_txo_count: 3, funded_txo_sum: 150000000, spent_txo_count: 1, spent_txo_sum: 50000000, tx_count: 4 }, mempool_stats: {} };

test("valida formato de endereço de forma leve", () => {
  assert.equal(looksLikeBtcAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"), true);
  assert.equal(looksLikeBtcAddress("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"), true);
  assert.equal(looksLikeBtcAddress("nao-e-endereco"), false);
  assert.equal(looksLikeBtcAddress(""), false);
});

test("calcula recebido e saldo em BTC a partir dos sats", () => {
  const w = parseAddressStats(stats, "bc1qxy");
  assert.equal(w.receivedBtc, 1.5);
  assert.equal(w.balanceBtc, 1.0);
  assert.equal(w.txCount, 4);
});

test("rejeita estatísticas incoerentes e formato errado", () => {
  assert.throws(() => parseAddressStats({ chain_stats: { funded_txo_sum: 10, spent_txo_sum: 20, tx_count: 1 } }, "x"), TypeError);
  assert.throws(() => parseAddressStats({ foo: 1 }, "x"), TypeError);
});

test("fetch: endereço inválido não chama a rede; falha vira sem dado", async () => {
  let called = 0;
  const f: FetchLike = async () => { called++; return { ok: true, status: 200, json: async () => stats, text: async () => "" }; };
  const bad = await fetchWallet(f, "lixo", now);
  assert.equal(bad.ok, false);
  assert.equal(called, 0);
  const good = await fetchWallet(f, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", now);
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.value.receivedBtc, 1.5);
  const downF: FetchLike = async () => { throw new Error("500"); };
  const down = await fetchWallet(downF, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", now);
  assert.equal(down.ok, false);
});
