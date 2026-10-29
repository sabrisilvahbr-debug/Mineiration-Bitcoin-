import { ageSeconds } from "../lib/types.ts";

export type GlobalState = "NORMAL" | "CAUTELA" | "PAUSADO_RISCO" | "PAUSADO_MANUAL";

export interface RiskLimits {
  riskPerTrade: number;
  maxExposure: number;
  dailyStopPct: number;
  maxDrawdownPct: number;
  allowLeverage: boolean;
  priceMaxAgeSec: number;
  maxPriceDivergence: number;
}

export const DEFAULT_LIMITS: RiskLimits = {
  riskPerTrade: 0.01,
  maxExposure: 0.6,
  dailyStopPct: 0.03,
  maxDrawdownPct: 0.1,
  allowLeverage: false,
  priceMaxAgeSec: 15,
  maxPriceDivergence: 0.005,
};

export interface RiskState {
  priceCollectedAt: string | null;
  priceDivergence: number | null;
  dailyPnlPct: number;
  drawdownPct: number;
  exposure: number;
  manualPause: boolean;
}

export interface RiskVerdict {
  state: GlobalState;
  canOpen: boolean;
  canTrade: boolean;
  reasons: string[];
}

/** Valida se é seguro operar. O LLM nunca contorna isto. */
export function evaluateRisk(s: RiskState, limits: RiskLimits, now: Date): RiskVerdict {
  const reasons: string[] = [];
  let risk = false;
  let caution = false;

  if (s.priceCollectedAt === null) {
    risk = true;
    reasons.push("Sem preço fresco");
  } else {
    const age = ageSeconds(s.priceCollectedAt, now);
    if (age === null || age > limits.priceMaxAgeSec) {
      risk = true;
      reasons.push(`Preço mais velho que ${limits.priceMaxAgeSec} s`);
    }
  }
  if (s.priceDivergence !== null && s.priceDivergence > limits.maxPriceDivergence) {
    risk = true;
    reasons.push(`Divergência de preço ${(s.priceDivergence * 100).toFixed(2)}% acima do limite`);
  }
  if (s.dailyPnlPct <= -limits.dailyStopPct) {
    risk = true;
    reasons.push(`Stop diário atingido (${(s.dailyPnlPct * 100).toFixed(1)}%)`);
  }
  if (s.drawdownPct >= limits.maxDrawdownPct) {
    risk = true;
    reasons.push(`Drawdown máximo atingido (${(s.drawdownPct * 100).toFixed(1)}%)`);
  }
  if (s.exposure > limits.maxExposure) {
    caution = true;
    reasons.push("Exposição acima do alvo: não abrir novas posições");
  }

  let state: GlobalState = "NORMAL";
  if (s.manualPause) {
    state = "PAUSADO_MANUAL";
    reasons.unshift("Pausa manual ativada");
  } else if (risk) state = "PAUSADO_RISCO";
  else if (caution) state = "CAUTELA";

  return {
    state,
    canTrade: state === "NORMAL" || state === "CAUTELA",
    canOpen: state === "NORMAL" && s.exposure <= limits.maxExposure,
    reasons,
  };
}

/** Limites rígidos que não dependem do estado: alavancagem proibida por padrão. */
export function validateOrderAgainstLimits(
  limits: RiskLimits,
  exposureAfter: number,
): { allowed: boolean; reason: string } {
  if (!limits.allowLeverage && exposureAfter > 1) return { allowed: false, reason: "alavancagem não permitida" };
  if (exposureAfter > limits.maxExposure) return { allowed: false, reason: "excederia a exposição máxima" };
  return { allowed: true, reason: "dentro dos limites" };
}
