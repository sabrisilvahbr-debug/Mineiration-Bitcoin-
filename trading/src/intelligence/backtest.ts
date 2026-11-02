import { evaluateStrategy, DEFAULT_PARAMS } from "./strategy.ts";
import type { StrategyParams } from "./strategy.ts";

export interface Costs {
  /** Taxa por operação (ex.: 0,004 = 0,4% na Coinbase). */
  feePct: number;
  /** Slippage estimado por operação (ex.: 0,0005 = 0,05%). */
  slippagePct: number;
}

export const DEFAULT_COSTS: Costs = { feePct: 0.004, slippagePct: 0.0005 };

export interface BacktestResult {
  bars: number;
  trades: number;
  winRatePct: number;
  returnPct: number;
  buyHoldReturnPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  finalEquity: number;
  equityCurve: number[];
  /** true se a estratégia bateu comprar-e-segurar depois de custos. */
  beatsBuyHold: boolean;
}

/**
 * Backtest long/flat determinístico, com custos aplicados a cada troca de posição.
 * Decide no fecho da barra e aplica no fecho seguinte (sem olhar o futuro).
 */
export function backtest(closes: number[], params: StrategyParams = DEFAULT_PARAMS, costs: Costs = DEFAULT_COSTS, startEquity = 10000): BacktestResult {
  const n = closes.length;
  const equityCurve: number[] = [];
  let equity = startEquity;
  let inPosition = false;
  let trades = 0;
  let wins = 0;
  let entryEquity = 0;
  const cost = costs.feePct + costs.slippagePct;
  const barReturns: number[] = [];
  const warmup = Math.max(params.slow, params.rsiPeriod + 1);

  for (let i = warmup; i < n - 1; i++) {
    const sig = evaluateStrategy(closes.slice(0, i + 1), params).signal;
    const nextRet = ((closes[i + 1] as number) - (closes[i] as number)) / (closes[i] as number);
    const prevEquity = equity;
    if (!inPosition && sig === "comprar") {
      equity *= 1 - cost; // custo de entrada
      inPosition = true;
      entryEquity = equity;
    } else if (inPosition && sig === "vender") {
      equity *= 1 - cost; // custo de saída
      inPosition = false;
      trades++;
      if (equity > entryEquity) wins++;
    }
    if (inPosition) equity *= 1 + nextRet;
    barReturns.push((equity - prevEquity) / prevEquity);
    equityCurve.push(equity);
  }
  if (inPosition) {
    equity *= 1 - cost;
    trades++;
    if (equity > entryEquity) wins++;
  }

  let peak = startEquity;
  let maxDd = 0;
  for (const e of equityCurve) {
    if (e > peak) peak = e;
    const dd = (peak - e) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  const mean = barReturns.length ? barReturns.reduce((a, b) => a + b, 0) / barReturns.length : 0;
  const variance = barReturns.length > 1 ? barReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / (barReturns.length - 1) : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252) : 0;
  const returnPct = (equity - startEquity) / startEquity;
  const buyHoldReturnPct = n > warmup ? ((closes[n - 1] as number) - (closes[warmup] as number)) / (closes[warmup] as number) : 0;

  return {
    bars: n,
    trades,
    winRatePct: trades > 0 ? (wins / trades) * 100 : 0,
    returnPct: returnPct * 100,
    buyHoldReturnPct: buyHoldReturnPct * 100,
    maxDrawdownPct: maxDd * 100,
    sharpe,
    finalEquity: equity,
    equityCurve,
    beatsBuyHold: returnPct > buyHoldReturnPct,
  };
}

/** Separação treino/validação: a estratégia só vale se for positiva E bater comprar-e-segurar FORA da amostra. */
export function outOfSample(closes: number[], params: StrategyParams, costs: Costs = DEFAULT_COSTS, trainFrac = 0.7): { train: BacktestResult; test: BacktestResult; approved: boolean } {
  const cut = Math.floor(closes.length * trainFrac);
  const train = backtest(closes.slice(0, cut), params, costs);
  const test = backtest(closes.slice(cut), params, costs);
  const approved = test.returnPct > 0 && test.beatsBuyHold;
  return { train, test, approved };
}
