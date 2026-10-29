import type { ProductInput, CycleDeps } from "./cycle.ts";
import { runCycle } from "./cycle.ts";
import type { CycleResult } from "./cycle.ts";
import { sma, rsi } from "../intelligence/indicators.ts";
import { backtest, outOfSample, DEFAULT_COSTS } from "../intelligence/backtest.ts";
import { DEFAULT_PARAMS } from "../intelligence/strategy.ts";
import { DEFAULT_LIMITS } from "../risk/guardian.ts";
import type { RiskLimits } from "../risk/guardian.ts";
import { ageSeconds } from "../lib/types.ts";
import { AGENTS } from "./registry.ts";

export type AgentStatus = "trabalhando" | "alerta" | "ocioso" | "pausado" | "em_espera";
export interface AgentRuntime { id: number; name: string; status: AgentStatus; detail: string; }
export interface ProductView {
  product: string;
  price: number;
  priceSource: string;
  priceAgeSec: number | null;
  signal: CycleResult["products"][number]["signal"];
  confidence: number;
  reason: string;
  sma20: number | null;
  sma50: number | null;
  rsi: number | null;
  positionQty: number;
  unrealizedPnl: number;
  action: string;
  actionReason: string;
  backtest: { returnPct: number; buyHoldPct: number; maxDrawdownPct: number; trades: number; winRatePct: number; sharpe: number; approvedOOS: boolean } | null;
}
export interface DashboardState {
  at: string;
  mode: "PAPER";
  state: CycleResult["state"];
  canOpen: boolean;
  reasons: string[];
  startEquity: number;
  equity: number;
  exposure: number;
  realizedPnl: number;
  totalReturnPct: number;
  limits: RiskLimits;
  products: ProductView[];
  scenario30: CycleResult["scenario30"];
  agents: AgentRuntime[];
  report: string;
}

export interface DashboardInput {
  inputs: Array<ProductInput & { priceSource: string }>;
  account: CycleDeps["account"];
  now: Date;
  manualPause?: boolean;
  limits?: RiskLimits;
}

function agentStatus(state: DashboardState["state"], dataOk: boolean, id: number): [AgentStatus, string] {
  const spec = AGENTS.find((a) => a.id === id)!;
  if (spec.phase1 === "em_espera") return ["em_espera", spec.waitingReason ?? ""];
  const paused = state === "PAUSADO_RISCO" || state === "PAUSADO_MANUAL";
  switch (id) {
    case 2: return dataOk ? ["trabalhando", "Cotações reais (Coinbase)"] : ["alerta", "Sem dado de cotação"];
    case 9: return state === "NORMAL" ? ["trabalhando", "Limites e frescor conferidos"] : state === "CAUTELA" ? ["alerta", "Exposição no limite"] : ["pausado", "Pausa de risco/manual"];
    case 11: case 12: return paused ? ["pausado", "Execução suspensa"] : ["simulado", "Paper trading"] as [AgentStatus, string];
    default: return paused ? ["pausado", "Aguardando liberação do Guardião"] : ["trabalhando", spec.role];
  }
}

/** Monta o estado completo do painel a partir de dados reais. Nada é inventado. */
export function buildDashboard(d: DashboardInput): DashboardState {
  const limits = d.limits ?? DEFAULT_LIMITS;
  const cycle = runCycle({ inputs: d.inputs, account: d.account, now: d.now, manualPause: d.manualPause, limits });
  const dataOk = d.inputs.length > 0 && d.inputs.every((i) => i.candles.length > 0);

  const products: ProductView[] = d.inputs.map((i) => {
    const closes = i.candles.map((c) => c.close);
    const cp = cycle.products.find((p) => p.product === i.product)!;
    let bt: ProductView["backtest"] = null;
    if (closes.length >= Math.max(DEFAULT_PARAMS.slow, DEFAULT_PARAMS.rsiPeriod) + 5) {
      const b = backtest(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 10000);
      const oos = outOfSample(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 0.7);
      bt = { returnPct: b.returnPct, buyHoldPct: b.buyHoldReturnPct, maxDrawdownPct: b.maxDrawdownPct, trades: b.trades, winRatePct: b.winRatePct, sharpe: b.sharpe, approvedOOS: oos.approved };
    }
    return {
      product: i.product, price: i.price, priceSource: i.priceSource, priceAgeSec: ageSeconds(i.priceCollectedAt, d.now),
      signal: cp.signal, confidence: cp.confidence, reason: cp.reason,
      sma20: sma(closes, 20), sma50: sma(closes, 50), rsi: rsi(closes, 14),
      positionQty: cp.positionQty, unrealizedPnl: cp.unrealizedPnl, action: cp.action, actionReason: cp.actionReason, backtest: bt,
    };
  });

  const agents: AgentRuntime[] = AGENTS.map((a) => {
    const [status, detail] = agentStatus(cycle.state, dataOk, a.id);
    return { id: a.id, name: a.name, status, detail };
  });

  const totalReturnPct = ((cycle.equity - d.account.startEquity) / d.account.startEquity) * 100;
  const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
  const report = `Ciclo de paper trading. Estado ${cycle.state}. Patrimônio ${brl(cycle.equity)} (início ${brl(d.account.startEquity)}), retorno ${totalReturnPct.toFixed(2)}%. Exposição ${(cycle.exposure * 100).toFixed(0)}%. ${products.map((p) => `${p.product}: sinal ${p.signal}${p.action !== "nada" ? `, ${p.action}` : ""}`).join("; ")}. ${cycle.reasons[0] ?? "Sem alertas"}. Paper trading, dinheiro fictício. Não é recomendação de investimento.`;

  return {
    at: cycle.at, mode: "PAPER", state: cycle.state, canOpen: cycle.canOpen, reasons: cycle.reasons,
    startEquity: d.account.startEquity, equity: cycle.equity, exposure: cycle.exposure, realizedPnl: cycle.realizedPnl,
    totalReturnPct, limits, products, scenario30: cycle.scenario30, agents, report,
  };
}
