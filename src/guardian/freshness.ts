import { ageSeconds } from "../lib/types.ts";
import { priceDivergence } from "../intelligence/anomalies.ts";
import type { GuardianConfig } from "./config.ts";

export type GlobalState = "NORMAL" | "CAUTELA" | "PAUSADO_RISCO" | "PAUSADO_MANUAL";
export type Fresh = "ok" | "defasado" | "sem_dado";

export interface PricePoint {
  source: string;
  value: number;
  collectedAt: string;
}
export interface TimedValue {
  value: number;
  collectedAt: string;
}
export interface MarketView {
  prices: PricePoint[];
  hashpriceExternal: TimedValue | null;
  hashpriceOwn: TimedValue | null;
  network: { collectedAt: string } | null;
  orderStatus: { collectedAt: string; consecutiveFailures: number } | null;
}

export interface GuardianVerdict {
  state: GlobalState;
  /** Só NORMAL com orçamento definido permite compra. */
  purchasesAllowed: boolean;
  /** PAUSADO_RISCO e PAUSADO_MANUAL também pausam as ordens existentes. */
  pauseExistingOrders: boolean;
  reasons: string[];
  freshness: { price: Fresh; hashprice: Fresh; network: Fresh; orders: Fresh };
  hashpriceUsed: "externa" | "propria" | null;
  /** Mediana (com 2 fontes = média) dos preços frescos; null se não houver preço confiável. */
  priceBrl: number | null;
  priceDivergence: number | null;
}

export function budgetConfigured(cfg: GuardianConfig): boolean {
  const l = cfg.limits;
  return (l.dailySpendBrl ?? 0) > 0 && (l.totalSpendBrl ?? 0) > 0 && l.dailyStopLossBrl !== null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function evaluateGuardian(view: MarketView, cfg: GuardianConfig, now: Date, manualPause: boolean): GuardianVerdict {
  const f = cfg.freshness;
  const reasons: string[] = [];
  let risk = false;
  let caution = false;

  // Preço BTC/BRL
  const fresh = view.prices.filter((p) => {
    const a = ageSeconds(p.collectedAt, now);
    return a !== null && a <= f.priceMaxAgeSec && Number.isFinite(p.value) && p.value > 0;
  });
  let priceFresh: Fresh = "ok";
  let priceBrl: number | null = null;
  let divergence: number | null = null;
  if (fresh.length === 0) {
    priceFresh = "sem_dado";
    risk = true;
    reasons.push(`Preço BTC/BRL ausente ou mais velho que ${f.priceMaxAgeSec} s`);
  } else {
    priceBrl = median(fresh.map((p) => p.value));
    if (fresh.length === 1) {
      caution = true;
      reasons.push("Só uma fonte de preço está fresca: sem conferência, compras pausadas");
    } else {
      divergence = priceDivergence((fresh[0] as PricePoint).value, (fresh[1] as PricePoint).value);
      if (divergence > f.maxPriceDivergence) {
        risk = true;
        reasons.push(`Divergência entre fontes de preço ${(divergence * 100).toFixed(2)}% > ${(f.maxPriceDivergence * 100).toFixed(1)}%`);
      }
    }
  }

  // Hashprice: externo → próprio → pausa
  const hpFresh = (t: TimedValue | null, max: number) => {
    if (!t || !(t.value > 0)) return false;
    const a = ageSeconds(t.collectedAt, now);
    return a !== null && a <= max;
  };
  let hashpriceUsed: GuardianVerdict["hashpriceUsed"] = null;
  let hashpriceFresh: Fresh;
  if (hpFresh(view.hashpriceExternal, f.hashpriceMaxAgeSec)) {
    hashpriceUsed = "externa";
    hashpriceFresh = "ok";
  } else if (hpFresh(view.hashpriceOwn, f.hashpriceMaxAgeSec)) {
    hashpriceUsed = "propria";
    hashpriceFresh = "ok";
  } else {
    hashpriceFresh = "sem_dado";
    risk = true;
    reasons.push("Hashprice indisponível (fonte externa e cálculo próprio)");
  }

  // Rede
  let networkFresh: Fresh = "sem_dado";
  if (view.network) {
    const a = ageSeconds(view.network.collectedAt, now);
    if (a === null) {
      networkFresh = "sem_dado";
    } else if (a <= f.networkMaxAgeSec) {
      networkFresh = "ok";
    } else {
      networkFresh = "defasado";
      reasons.push("Dados da rede defasados (mantidos, marcados como defasado)");
    }
  }

  // Status de ordens/ASIC (só existe quando há ordens)
  let ordersFresh: Fresh = "ok";
  if (view.orderStatus) {
    const a = ageSeconds(view.orderStatus.collectedAt, now);
    if (a === null || a > f.orderStatusMaxAgeSec) {
      ordersFresh = "defasado";
      reasons.push("Status de ordens/ASIC defasado: alerta");
    }
    if (view.orderStatus.consecutiveFailures >= f.orderFailuresToPause) {
      risk = true;
      reasons.push(`${view.orderStatus.consecutiveFailures} falhas seguidas no status de ordens/ASIC`);
    }
  }

  let state: GlobalState = "NORMAL";
  if (manualPause) {
    state = "PAUSADO_MANUAL";
    reasons.unshift("Pausa manual ativada pelo CEO");
  } else if (risk) state = "PAUSADO_RISCO";
  else if (caution) state = "CAUTELA";

  const hasBudget = budgetConfigured(cfg);
  if (state === "NORMAL" && !hasBudget) reasons.push("Sem orçamento definido: nenhuma compra permitida");

  return {
    state,
    purchasesAllowed: state === "NORMAL" && hasBudget,
    pauseExistingOrders: state === "PAUSADO_RISCO" || state === "PAUSADO_MANUAL",
    reasons,
    freshness: { price: priceFresh, hashprice: hashpriceFresh, network: networkFresh, orders: ordersFresh },
    hashpriceUsed,
    priceBrl,
    priceDivergence: divergence,
  };
}
