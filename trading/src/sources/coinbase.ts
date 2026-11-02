import { getJson, num, obj, arr, errMsg } from "./http.ts";
import type { FetchLike } from "./http.ts";
import type { Reading, Candle } from "../lib/types.ts";

export const CANDLES_SOURCE = "Coinbase Exchange (candles reais)";
export const PRICE_SOURCE = "Coinbase (preço spot real)";

const EXCHANGE = "https://api.exchange.coinbase.com";
const SPOT = "https://api.coinbase.com";

/** Coinbase Exchange: [[time(s), low, high, open, close, volume], ...] do mais novo para o mais antigo. */
export function parseCandles(j: unknown): Candle[] {
  const rows = arr(j, "candles").map((r) => arr(r, "candle"));
  if (rows.length === 0) throw new TypeError("sem candles");
  const out = rows.map((r) => {
    const time = num(r[0], "time");
    const low = num(r[1], "low");
    const high = num(r[2], "high");
    const open = num(r[3], "open");
    const close = num(r[4], "close");
    const volume = num(r[5], "volume");
    if (low <= 0 || high <= 0 || open <= 0 || close <= 0 || high < low) throw new TypeError("candle incoerente");
    return { t: time, candle: { time: new Date(time * 1000).toISOString(), open, high, low, close, volume } };
  });
  out.sort((a, b) => a.t - b.t); // mais antigo primeiro
  return out.map((x) => x.candle);
}

export function parseSpot(j: unknown): number {
  const d = obj(obj(j, "resposta").data, "data");
  const price = num(d.amount, "amount");
  if (price <= 0) throw new TypeError("preço ≤ 0");
  return price;
}

/** granularity em segundos: 60,300,900,3600,21600,86400. */
export async function fetchCandles(f: FetchLike, product: string, granularity: number, now: Date = new Date()): Promise<Reading<Candle[]>> {
  const collectedAt = now.toISOString();
  try {
    const j = await getJson(f, `${EXCHANGE}/products/${encodeURIComponent(product)}/candles?granularity=${granularity}`);
    return { ok: true, value: parseCandles(j), source: CANDLES_SOURCE, collectedAt };
  } catch (e) {
    return { ok: false, source: CANDLES_SOURCE, collectedAt, error: errMsg(e) };
  }
}

export async function fetchSpot(f: FetchLike, product: string, now: Date = new Date()): Promise<Reading<number>> {
  const collectedAt = now.toISOString();
  try {
    const price = parseSpot(await getJson(f, `${SPOT}/v2/prices/${encodeURIComponent(product)}/spot`));
    return { ok: true, value: price, source: PRICE_SOURCE, collectedAt };
  } catch (e) {
    return { ok: false, source: PRICE_SOURCE, collectedAt, error: errMsg(e) };
  }
}
