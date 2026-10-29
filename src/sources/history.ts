import { getJson, num, obj, arr, errMsg } from "./http.ts";
import type { FetchLike } from "./http.ts";
import type { Reading } from "../lib/types.ts";

export const MB_CANDLES_SOURCE = "Mercado Bitcoin (candles diários BTC-BRL)";
export const CB_CANDLES_SOURCE = "Coinbase Exchange (candles diários BTC-USD; proxy de volatilidade)";

/** Mercado Bitcoin v4 candles: { t: [epoch s], c: ["fechamento"] } (listas paralelas). */
export function parseMbCandles(j: unknown): number[] {
  const o = obj(j, "candles");
  const t = arr(o.t, "t");
  const c = arr(o.c, "c");
  if (t.length !== c.length || c.length === 0) throw new TypeError("listas t/c inconsistentes");
  const rows = t.map((x, i) => ({ t: num(x, "t"), c: num(c[i], "c") }));
  rows.sort((a, b) => a.t - b.t);
  const closes = rows.map((r) => r.c);
  if (closes.some((x) => x <= 0)) throw new TypeError("fechamento ≤ 0");
  return closes;
}

/** Coinbase Exchange: [[time, low, high, open, close, volume], …] do mais novo para o mais antigo. */
export function parseCbCandles(j: unknown): number[] {
  const rows = arr(j, "candles").map((r) => arr(r, "candle"));
  if (rows.length === 0) throw new TypeError("sem candles");
  const sorted = rows.map((r) => ({ t: num(r[0], "time"), c: num(r[4], "close") })).sort((a, b) => a.t - b.t);
  const closes = sorted.map((r) => r.c);
  if (closes.some((x) => x <= 0)) throw new TypeError("fechamento ≤ 0");
  return closes;
}

export async function fetchPriceHistory(f: FetchLike, now: Date = new Date()): Promise<Reading<number[]>> {
  const collectedAt = now.toISOString();
  const nowS = Math.floor(now.getTime() / 1000);
  try {
    const url = `https://api.mercadobitcoin.net/api/v4/candles?symbol=BTC-BRL&resolution=1d&from=${nowS - 120 * 86400}&to=${nowS}`;
    return { ok: true, value: parseMbCandles(await getJson(f, url)), source: MB_CANDLES_SOURCE, collectedAt };
  } catch (e1) {
    try {
      const value = parseCbCandles(await getJson(f, "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400"));
      return { ok: true, value, source: CB_CANDLES_SOURCE, collectedAt };
    } catch (e2) {
      return { ok: false, source: "candles diários", collectedAt, error: `${errMsg(e1)} | ${errMsg(e2)}` };
    }
  }
}
