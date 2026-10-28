import { BLOCKS_PER_DAY } from "./hashprice.ts";

export type Action = "pausar" | "manter" | "aumentar";
export type PoolMethod = "FPPS" | "PPLNS" | "SOLO";

export interface Policy {
  /** Margem (fração) em ou abaixo da qual se pausa. Política inicial: 0. */
  pauseMargin: number;
  /** Margem (fração) a partir da qual se retoma/aumenta, por N coletas seguidas. Política inicial: 0,10. */
  resumeMargin: number;
  /** Coletas seguidas necessárias. Política inicial: 3. */
  resumeConsecutive: number;
}

export const DEFAULT_POLICY: Policy = { pauseMargin: 0, resumeMargin: 0.1, resumeConsecutive: 3 };

export interface RentedInput {
  ph: number;
  hashpriceBtcPerPhDay: number;
  btcBrl: number;
  poolFee: number;
  pricePerPhDayBrl: number;
  platformFee: number;
}

export interface AsicInput {
  ph: number;
  kw: number;
  tariffBrlKwh: number;
  hostingBrlDay: number;
  maintenanceBrlDay: number;
  hashpriceBtcPerPhDay: number;
  btcBrl: number;
  poolFee: number;
}

export interface Economics {
  revenueBrlDay: number;
  costBrlDay: number;
  profitBrlDay: number;
  /** (receita − custo) / custo; null quando o custo é zero (indefinida). */
  margin: number | null;
  /** Hashprice (BTC/PH/dia) em que a margem é zero. */
  breakEvenHashpriceBtcPerPhDay: number | null;
  /** Só para ASIC: tarifa máxima (R$/kWh) para margem zero. */
  breakEvenTariffBrlKwh: number | null;
}

function need(name: string, v: number, opts: { max?: number } = {}): void {
  if (!Number.isFinite(v) || v < 0 || (opts.max !== undefined && v > opts.max)) {
    throw new RangeError(`entrada inválida: ${name}=${String(v)}`);
  }
}

function finish(revenue: number, cost: number, ph: number, btcBrl: number, poolFee: number): Economics {
  const denom = ph * (1 - poolFee) * btcBrl;
  return {
    revenueBrlDay: revenue,
    costBrlDay: cost,
    profitBrlDay: revenue - cost,
    margin: cost > 0 ? (revenue - cost) / cost : null,
    breakEvenHashpriceBtcPerPhDay: denom > 0 ? cost / denom : null,
    breakEvenTariffBrlKwh: null,
  };
}

export function computeRentedEconomics(i: RentedInput): Economics {
  need("ph", i.ph);
  need("hashpriceBtcPerPhDay", i.hashpriceBtcPerPhDay);
  need("btcBrl", i.btcBrl);
  need("poolFee", i.poolFee, { max: 1 });
  need("pricePerPhDayBrl", i.pricePerPhDayBrl);
  need("platformFee", i.platformFee, { max: 1 });
  const revenue = i.ph * i.hashpriceBtcPerPhDay * (1 - i.poolFee) * i.btcBrl;
  const cost = i.ph * i.pricePerPhDayBrl * (1 + i.platformFee);
  return finish(revenue, cost, i.ph, i.btcBrl, i.poolFee);
}

export function computeAsicEconomics(i: AsicInput): Economics {
  need("ph", i.ph);
  need("kw", i.kw);
  need("tariffBrlKwh", i.tariffBrlKwh);
  need("hostingBrlDay", i.hostingBrlDay);
  need("maintenanceBrlDay", i.maintenanceBrlDay);
  need("hashpriceBtcPerPhDay", i.hashpriceBtcPerPhDay);
  need("btcBrl", i.btcBrl);
  need("poolFee", i.poolFee, { max: 1 });
  const revenue = i.ph * i.hashpriceBtcPerPhDay * (1 - i.poolFee) * i.btcBrl;
  const cost = i.kw * 24 * i.tariffBrlKwh + i.hostingBrlDay + i.maintenanceBrlDay;
  const e = finish(revenue, cost, i.ph, i.btcBrl, i.poolFee);
  const kwhDay = i.kw * 24;
  e.breakEvenTariffBrlKwh = kwhDay > 0 ? (revenue - i.hostingBrlDay - i.maintenanceBrlDay) / kwhDay : null;
  return e;
}

/**
 * Decisão com histerese. `margins` em ordem cronológica (última = mais recente).
 * Margem indefinida (null) ou ausência de histórico: pausar (padrão seguro).
 */
export function decide(margins: Array<number | null>, prev: Action, p: Policy = DEFAULT_POLICY): Action {
  const latest = margins[margins.length - 1];
  if (latest === undefined || latest === null) return "pausar";
  if (latest <= p.pauseMargin) return "pausar";
  const lastN = margins.slice(-p.resumeConsecutive);
  if (lastN.length >= p.resumeConsecutive && lastN.every((m) => m !== null && m >= p.resumeMargin)) {
    return "aumentar";
  }
  return prev === "pausar" ? "pausar" : "manter";
}

/** Probabilidade de achar ao menos 1 bloco em `days` dias com `ph` de hashrate (Poisson). */
export function soloBlockProbability(ph: number, networkPh: number, days: number): number {
  if (!Number.isFinite(networkPh) || networkPh <= 0) throw new RangeError("hashrate da rede inválido");
  need("ph", ph);
  need("days", days);
  return 1 - Math.exp(-BLOCKS_PER_DAY * days * (ph / networkPh));
}
