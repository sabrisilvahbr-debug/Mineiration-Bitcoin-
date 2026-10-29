import { getJson, num, obj, arr, errMsg } from "./http.ts";
import type { FetchLike } from "./http.ts";
import type { Reading } from "../lib/types.ts";

export const MB_SOURCE = "Mercado Bitcoin (BTC-BRL, v4)";
export const CB_SOURCE = "Coinbase (BTC-BRL spot)";

/** Mercado Bitcoin v4: GET /api/v4/tickers?symbols=BTC-BRL → [{ pair, last, buy, sell, date }]. */
export function parseMercadoBitcoin(j: unknown, fetchedAt: Date): { price: number; at: string } {
  const list = arr(j, "tickers");
  const t = list.map((x) => obj(x, "ticker")).find((x) => x.pair === "BTC-BRL");
  if (!t) throw new TypeError("par BTC-BRL ausente na resposta");
  const price = num(t.last, "last");
  if (price <= 0) throw new TypeError("preço ≤ 0");
  // `date` (epoch em segundos) é o horário do dado na corretora; sem ele, usa o horário da consulta.
  let at = fetchedAt.toISOString();
  if (t.date !== undefined) {
    const d = num(t.date, "date");
    at = new Date(d * 1000).toISOString();
  }
  return { price, at };
}

/** Coinbase: GET /v2/prices/BTC-BRL/spot → { data: { amount, currency } }. */
export function parseCoinbase(j: unknown): number {
  const d = obj(obj(j, "resposta").data, "data");
  if (d.currency !== "BRL") throw new TypeError(`moeda inesperada: ${String(d.currency)}`);
  const price = num(d.amount, "amount");
  if (price <= 0) throw new TypeError("preço ≤ 0");
  return price;
}

export async function fetchMercadoBitcoin(f: FetchLike, now: Date = new Date()): Promise<Reading<number>> {
  const collectedAt = now.toISOString();
  try {
    const { price, at } = parseMercadoBitcoin(await getJson(f, "https://api.mercadobitcoin.net/api/v4/tickers?symbols=BTC-BRL"), now);
    return { ok: true, value: price, source: MB_SOURCE, collectedAt: at };
  } catch (e) {
    return { ok: false, source: MB_SOURCE, collectedAt, error: errMsg(e) };
  }
}

export async function fetchCoinbase(f: FetchLike, now: Date = new Date()): Promise<Reading<number>> {
  const collectedAt = now.toISOString();
  try {
    const price = parseCoinbase(await getJson(f, "https://api.coinbase.com/v2/prices/BTC-BRL/spot"));
    return { ok: true, value: price, source: CB_SOURCE, collectedAt };
  } catch (e) {
    return { ok: false, source: CB_SOURCE, collectedAt, error: errMsg(e) };
  }
}

export async function fetchPrices(f: FetchLike, now: Date = new Date()): Promise<Reading<number>[]> {
  return Promise.all([fetchMercadoBitcoin(f, now), fetchCoinbase(f, now)]);
}
