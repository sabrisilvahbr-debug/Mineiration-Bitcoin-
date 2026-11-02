/** Leitura de uma fonte externa: sempre com fonte e horário; falha vira "sem dado". */
export type Reading<T> =
  | { ok: true; value: T; source: string; collectedAt: string }
  | { ok: false; error: string; source: string; collectedAt: string };

const CLOCK_SKEW_SEC = 5;

export function ageSeconds(collectedAt: string, now: Date): number | null {
  const t = Date.parse(collectedAt);
  if (Number.isNaN(t)) return null;
  const age = (now.getTime() - t) / 1000;
  if (age < -CLOCK_SKEW_SEC) return null;
  return Math.max(0, age);
}

/** Barra OHLCV (candle). Preços na moeda de cotação do par. */
export interface Candle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
