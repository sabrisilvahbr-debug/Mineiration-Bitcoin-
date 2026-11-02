import { sma, rsi } from "./indicators.ts";

export type Signal = "comprar" | "vender" | "manter";

export interface StrategyParams {
  fast: number;
  slow: number;
  rsiPeriod: number;
  rsiOverbought: number;
  rsiOversold: number;
}

export const DEFAULT_PARAMS: StrategyParams = { fast: 20, slow: 50, rsiPeriod: 14, rsiOverbought: 75, rsiOversold: 30 };

export interface StrategyOutput {
  signal: Signal;
  confidence: number;
  reason: string;
  fast: number | null;
  slow: number | null;
  rsi: number | null;
}

/**
 * Estratégia determinística (tendência + filtro): compra quando a média curta cruza acima da longa
 * e o RSI não está sobrecomprado; vende quando cruza abaixo ou o RSI fica sobrecomprado.
 * Sem dados suficientes → "manter" com confiança 0. Não é recomendação de investimento.
 */
export function evaluateStrategy(closes: number[], p: StrategyParams = DEFAULT_PARAMS): StrategyOutput {
  const fast = sma(closes, p.fast);
  const slow = sma(closes, p.slow);
  const r = rsi(closes, p.rsiPeriod);
  const base: StrategyOutput = { signal: "manter", confidence: 0, reason: "sem dados suficientes", fast, slow, rsi: r };
  if (fast === null || slow === null || r === null) return base;

  const spread = (fast - slow) / slow; // distância relativa entre as médias
  if (fast > slow && r < p.rsiOverbought) {
    const confidence = Math.min(1, Math.abs(spread) * 20 + (p.rsiOverbought - r) / 100);
    return { signal: "comprar", confidence: Math.max(0, confidence), reason: `média curta acima da longa (${(spread * 100).toFixed(2)}%), RSI ${r.toFixed(0)}`, fast, slow, rsi: r };
  }
  if (fast < slow || r >= p.rsiOverbought) {
    const confidence = Math.min(1, Math.abs(spread) * 20 + 0.3);
    return { signal: "vender", confidence: Math.max(0, confidence), reason: fast < slow ? "média curta abaixo da longa" : `RSI sobrecomprado (${r.toFixed(0)})`, fast, slow, rsi: r };
  }
  return { signal: "manter", confidence: 0.2, reason: "sem sinal claro", fast, slow, rsi: r };
}
