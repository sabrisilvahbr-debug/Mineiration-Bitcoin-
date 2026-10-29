/** Cenários e VaR a partir dos retornos históricos reais (bootstrap com semente fixa). */

export interface ScenarioResult {
  horizonDays: number;
  p5Pct: number;
  medianPct: number;
  p95Pct: number;
  probLoss: number;
  var95Pct: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], q: number): number {
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return (sorted[lo] as number) * (1 - frac) + (sorted[hi] as number) * frac;
}

/** Bootstrap: reamostra retornos diários reais. Retorna null se faltam dados. */
export function runScenarios(dailyReturns: number[], horizonDays: number, paths = 2000, seed = 42): ScenarioResult | null {
  if (dailyReturns.length < 20 || horizonDays < 1 || !dailyReturns.every(Number.isFinite)) return null;
  const rand = mulberry32(seed);
  const finals: number[] = [];
  let losses = 0;
  for (let p = 0; p < paths; p++) {
    let cum = 1;
    for (let d = 0; d < horizonDays; d++) {
      const r = dailyReturns[Math.floor(rand() * dailyReturns.length)] as number;
      cum *= 1 + r;
    }
    const pct = (cum - 1) * 100;
    finals.push(pct);
    if (pct < 0) losses++;
  }
  finals.sort((a, b) => a - b);
  return {
    horizonDays,
    p5Pct: percentile(finals, 0.05),
    medianPct: percentile(finals, 0.5),
    p95Pct: percentile(finals, 0.95),
    probLoss: losses / paths,
    var95Pct: percentile(finals, 0.05),
  };
}
