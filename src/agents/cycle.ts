import type { Candle } from "../lib/types.ts";
import { evaluateStrategy, DEFAULT_PARAMS } from "../intelligence/strategy.ts";
import type { StrategyParams, Signal } from "../intelligence/strategy.ts";
import { volatility } from "../intelligence/indicators.ts";
import { sizePosition } from "../intelligence/sizing.ts";
import { runScenarios } from "../intelligence/montecarlo.ts";
import type { ScenarioResult } from "../intelligence/montecarlo.ts";
import { evaluateRisk, DEFAULT_LIMITS } from "../risk/guardian.ts";
import type { RiskLimits, RiskVerdict } from "../risk/guardian.ts";
import { applyOrder, markToMarket } from "../paper/engine.ts";
import type { PaperAccount } from "../paper/engine.ts";
import { DEFAULT_COSTS } from "../intelligence/backtest.ts";
import type { Costs } from "../intelligence/backtest.ts";

export interface ProductInput {
  product: string;
  candles: Candle[];
  price: number;
  priceCollectedAt: string;
  priceDivergence?: number;
}
export interface ProductResult {
  product: string;
  price: number;
  signal: Signal;
  confidence: number;
  reason: string;
  positionQty: number;
  unrealizedPnl: number;
  action: "comprou (paper)" | "vendeu (paper)" | "nada";
  actionReason: string;
}
export interface CycleResult {
  at: string;
  state: RiskVerdict["state"];
  canOpen: boolean;
  reasons: string[];
  equity: number;
  exposure: number;
  realizedPnl: number;
  products: ProductResult[];
  scenario30: ScenarioResult | null;
}

export interface CycleDeps {
  inputs: ProductInput[];
  account: PaperAccount;
  now: Date;
  manualPause?: boolean;
  limits?: RiskLimits;
  params?: StrategyParams;
  costs?: Costs;
  stopDistance?: number;
}

/** Um ciclo de paper trading: dados → sinal → risco → execução simulada. Nada é inventado; preços vêm do chamador. */
export function runCycle(d: CycleDeps): CycleResult {
  const limits = d.limits ?? DEFAULT_LIMITS;
  const params = d.params ?? DEFAULT_PARAMS;
  const costs = d.costs ?? DEFAULT_COSTS;
  const at = d.now.toISOString();
  const prices: Record<string, number> = {};
  for (const i of d.inputs) prices[i.product] = i.price;

  const eqBefore = markToMarket(d.account, prices);
  const drawdown = eqBefore.equity < d.account.startEquity ? (d.account.startEquity - eqBefore.equity) / d.account.startEquity : 0;
  // Frescor: usa o pior (mais velho) entre os preços; divergência máxima informada.
  let worstAge: string | null = d.inputs.length ? d.inputs[0]!.priceCollectedAt : null;
  let maxDiv = 0;
  for (const i of d.inputs) {
    if (Date.parse(i.priceCollectedAt) < Date.parse(worstAge ?? at)) worstAge = i.priceCollectedAt;
    if (i.priceDivergence && i.priceDivergence > maxDiv) maxDiv = i.priceDivergence;
  }
  const verdict = evaluateRisk(
    { priceCollectedAt: worstAge, priceDivergence: maxDiv || null, dailyPnlPct: 0, drawdownPct: drawdown, exposure: eqBefore.exposure, manualPause: d.manualPause ?? false },
    limits,
    d.now,
  );

  const products: ProductResult[] = [];
  for (const i of d.inputs) {
    const closes = i.candles.map((c) => c.close);
    const s = evaluateStrategy(closes, params);
    const pos = d.account.positions[i.product];
    const unrealized = pos ? (i.price - pos.avgPrice) * pos.qty : 0;
    let action: ProductResult["action"] = "nada";
    let actionReason = "sem mudança";

    if (!verdict.canTrade) {
      actionReason = `Guardião: ${verdict.reasons[0] ?? verdict.state}`;
    } else if (s.signal === "comprar" && !pos && verdict.canOpen) {
      const stopDistance = d.stopDistance ?? Math.max(0.02, (volatility(closes, 20) ?? 0.05) * 2);
      const size = sizePosition({ capital: eqBefore.equity, riskPerTrade: limits.riskPerTrade, stopDistance, price: i.price, maxExposure: limits.maxExposure });
      if (size.qty > 0) {
        const r = applyOrder(d.account, "comprar", i.product, size.qty, i.price, costs, at);
        if (r.ok) { action = "comprou (paper)"; actionReason = `risco ${(limits.riskPerTrade * 100).toFixed(1)}%, stop ${(stopDistance * 100).toFixed(1)}%`; }
        else actionReason = r.reason ?? "ordem recusada";
      } else actionReason = "tamanho calculado zero";
    } else if (s.signal === "vender" && pos) {
      const r = applyOrder(d.account, "vender", i.product, pos.qty, i.price, costs, at);
      if (r.ok) { action = "vendeu (paper)"; actionReason = "saída por sinal"; }
      else actionReason = r.reason ?? "ordem recusada";
    } else if (s.signal === "comprar" && !verdict.canOpen) {
      actionReason = "sinal de compra, mas o Guardião não libera abrir agora";
    }

    const posAfter = d.account.positions[i.product];
    products.push({
      product: i.product, price: i.price, signal: s.signal, confidence: s.confidence, reason: s.reason,
      positionQty: posAfter?.qty ?? 0, unrealizedPnl: unrealized, action, actionReason,
    });
  }

  const eqAfter = markToMarket(d.account, prices);
  // Cenários a partir dos retornos reais do primeiro ativo.
  let scenario30: ScenarioResult | null = null;
  const first = d.inputs[0];
  if (first) {
    const closes = first.candles.map((c) => c.close);
    const rets: number[] = [];
    for (let k = 1; k < closes.length; k++) rets.push((closes[k]! - closes[k - 1]!) / closes[k - 1]!);
    scenario30 = runScenarios(rets, 30, 2000, Math.floor(d.now.getTime() / 86400000));
  }

  return {
    at, state: verdict.state, canOpen: verdict.canOpen, reasons: verdict.reasons,
    equity: eqAfter.equity, exposure: eqAfter.exposure, realizedPnl: d.account.realizedPnl,
    products, scenario30,
  };
}
