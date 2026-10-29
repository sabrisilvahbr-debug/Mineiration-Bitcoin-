/** Indicadores determinísticos sobre séries de preço de fechamento. Retornam null quando faltam dados. */

export function sma(values: number[], period: number): number | null {
  if (period < 1 || values.length < period) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i] as number;
  return sum / period;
}

export function emaSeries(values: number[], period: number): number[] {
  if (period < 1 || values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] as number;
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = (values[i] as number) * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  if (period < 1 || values.length < period) return null;
  const s = emaSeries(values, period);
  return s[s.length - 1] ?? null;
}

/** RSI de Wilder. null se não houver dados suficientes. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = (values[i] as number) - (values[i - 1] as number);
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = (values[i] as number) - (values[i - 1] as number);
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function logReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(Math.log((values[i] as number) / (values[i - 1] as number)));
  return out;
}

/** Volatilidade (desvio-padrão) dos retornos simples da janela. */
export function volatility(values: number[], period: number): number | null {
  if (values.length < period + 1) return null;
  const rets: number[] = [];
  for (let i = values.length - period; i < values.length; i++) {
    rets.push(((values[i] as number) - (values[i - 1] as number)) / (values[i - 1] as number));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}
