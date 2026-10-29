import { getJson, num, obj, errMsg } from "./http.ts";
import type { FetchLike } from "./http.ts";
import type { Reading } from "../lib/types.ts";
import { MEMPOOL } from "./mempool.ts";

export const WALLET_SOURCE = "mempool.space (carteira on-chain)";

export interface WalletInfo {
  address: string;
  /** Total já recebido no endereço (confirmado), em BTC. É o "total encontrado/recebido" real. */
  receivedBtc: number;
  /** Saldo atual (recebido − gasto), em BTC. */
  balanceBtc: number;
  txCount: number;
}

/** Validação leve só para evitar chamadas óbvias inválidas; o mempool.space é o validador real. */
export function looksLikeBtcAddress(a: string): boolean {
  return /^(bc1[0-9a-z]{20,90}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
}

export function parseAddressStats(j: unknown, address: string): WalletInfo {
  const o = obj(j, "endereço");
  const chain = obj(o.chain_stats, "chain_stats");
  const funded = num(chain.funded_txo_sum, "funded_txo_sum");
  const spent = num(chain.spent_txo_sum, "spent_txo_sum");
  const txCount = num(chain.tx_count, "tx_count");
  if (funded < 0 || spent < 0 || spent > funded) throw new TypeError("estatísticas da carteira incoerentes");
  return { address, receivedBtc: funded / 1e8, balanceBtc: (funded - spent) / 1e8, txCount };
}

export async function fetchWallet(f: FetchLike, address: string, now: Date = new Date()): Promise<Reading<WalletInfo>> {
  const collectedAt = now.toISOString();
  if (!looksLikeBtcAddress(address)) {
    return { ok: false, source: WALLET_SOURCE, collectedAt, error: "endereço BTC em formato inválido" };
  }
  try {
    const j = await getJson(f, `${MEMPOOL}/api/address/${encodeURIComponent(address)}`);
    return { ok: true, value: parseAddressStats(j, address), source: WALLET_SOURCE, collectedAt };
  } catch (e) {
    return { ok: false, source: WALLET_SOURCE, collectedAt, error: errMsg(e) };
  }
}
