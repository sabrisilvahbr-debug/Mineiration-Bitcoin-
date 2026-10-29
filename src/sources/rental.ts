import { getJson, num, obj, arr, errMsg } from "./http.ts";
import type { FetchLike } from "./http.ts";
import type { Reading } from "../lib/types.ts";

export const NICEHASH_SOURCE = "NiceHash (marketplace SHA256ASICBOOST)";
const URL = "https://api2.nicehash.com/main/api/v2/public/orders/active2?algorithm=SHA256ASICBOOST";

/** No NiceHash, o preço das ordens de SHA256 é em BTC por EH/s por dia (buy-info: speed_text "EH").
 *  1 EH/s = 1000 PH/s, então BTC/PH/dia = preço / 1000, e sats/PH/dia = preço × 1e5. */
export const EH_PER_PH = 1000;

export interface RentalInfo {
  /** Preço representativo (média ponderada pela velocidade realmente entregue), em sats por PH/s por dia. */
  marketSatsPerPhDay: number;
  marketBtcPerPhDay: number;
  /** Faixa entre as ordens que estão de fato recebendo hashrate, em sats/PH/dia. */
  minSatsPerPhDay: number;
  maxSatsPerPhDay: number;
  /** Hashrate total sendo entregue agora, em EH/s. */
  acceptedEhs: number;
  activeOrders: number;
}

interface Order {
  price: number;
  speedLimit: number;
  acceptedCurrentSpeed: number;
  alive: boolean;
}

export function parseNicehashOrders(j: unknown): RentalInfo {
  const o = obj(j, "resposta");
  const list = arr(o.list, "list");
  const orders: Order[] = list.map((raw, i) => {
    const r = obj(raw, `list[${i}]`);
    if (typeof r.alive !== "boolean") throw new TypeError(`list[${i}].alive não é booleano`);
    return {
      price: num(r.price, `list[${i}].price`),
      speedLimit: num(r.speedLimit, `list[${i}].speedLimit`),
      acceptedCurrentSpeed: num(r.acceptedCurrentSpeed, `list[${i}].acceptedCurrentSpeed`),
      alive: r.alive,
    };
  });
  // Mercado real: ordens vivas que estão de fato recebendo hashrate.
  const active = orders.filter((x) => x.alive && x.acceptedCurrentSpeed > 0 && x.price > 0);
  if (active.length === 0) throw new TypeError("nenhuma ordem viva recebendo hashrate");
  const totalSpeed = active.reduce((a, x) => a + x.acceptedCurrentSpeed, 0);
  const weightedPriceEh = active.reduce((a, x) => a + x.price * x.acceptedCurrentSpeed, 0) / totalSpeed;
  const prices = active.map((x) => x.price);
  const toSats = (btcPerEhDay: number) => (btcPerEhDay / EH_PER_PH) * 1e8;
  return {
    marketSatsPerPhDay: toSats(weightedPriceEh),
    marketBtcPerPhDay: weightedPriceEh / EH_PER_PH,
    minSatsPerPhDay: toSats(Math.min(...prices)),
    maxSatsPerPhDay: toSats(Math.max(...prices)),
    acceptedEhs: totalSpeed,
    activeOrders: active.length,
  };
}

export async function fetchNicehashRental(f: FetchLike, now: Date = new Date()): Promise<Reading<RentalInfo>> {
  const collectedAt = now.toISOString();
  try {
    return { ok: true, value: parseNicehashOrders(await getJson(f, URL)), source: NICEHASH_SOURCE, collectedAt };
  } catch (e) {
    return { ok: false, source: NICEHASH_SOURCE, collectedAt, error: errMsg(e) };
  }
}

/** Margem de alugar hashrate ao preço de mercado, por PH/s, antes das taxas de pool e plataforma. */
export interface RentalMargin {
  rentalSatsPerPhDay: number;
  revenueSatsPerPhDay: number;
  /** (receita − custo) / custo. Positivo = alugar dá lucro bruto; negativo = prejuízo. */
  grossMarginPct: number;
  profitable: boolean;
}

export function rentalMargin(rentalSatsPerPhDay: number, hashpriceSatsPerPhDay: number): RentalMargin | null {
  if (!(rentalSatsPerPhDay > 0) || !(hashpriceSatsPerPhDay >= 0)) return null;
  const grossMarginPct = (hashpriceSatsPerPhDay - rentalSatsPerPhDay) / rentalSatsPerPhDay;
  return { rentalSatsPerPhDay, revenueSatsPerPhDay: hashpriceSatsPerPhDay, grossMarginPct, profitable: grossMarginPct > 0 };
}
