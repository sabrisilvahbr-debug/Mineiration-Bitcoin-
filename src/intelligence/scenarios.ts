/** Monte Carlo simples e determinístico (semente fixa). Premissas declaradas:
 *  - preço do BTC sem tendência (média zero), volatilidade = a do histórico real informado;
 *  - hashrate da rede cresce com a média e a volatilidade do histórico real informado;
 *  - o hashprice varia na razão inversa do hashrate; taxas de transação ficam constantes. */

export interface ScenarioInput {
  days: number;
  paths: number;
  seed: number;
  ph: number;
  hashpriceBtcPerPhDay: number;
  btcBrl: number;
  poolFee: number;
  costBrlDay: number;
  /** Série diária de preços (mais antigo primeiro), mínimo 31 pontos. */
  priceHistory: number[];
  /** Série diária do hashrate da rede (mais antigo primeiro), mínimo 31 pontos. */
  networkHashrateHistory: number[];
  stopLossBrl?: number;
}

export interface ScenarioResult {
  days: number;
  p5: number;
  median: number;
  p95: number;
  probLoss: number;
  probStopLoss: number | null;
  priceVolDaily: number;
  hashrateGrowthDaily: number;
  hashrateVolDaily: number;
}

const MIN_POINTS = 31;

export function logReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) out.push(Math.log((series[i] as number) / (series[i - 1] as number)));
  return out;
}

export function meanStd(xs: number[]): { mean: number; std: number } {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) : 0;
  return { mean, std: Math.sqrt(variance) };
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

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function percentile(sorted: number[], q: number): number {
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return (sorted[lo] as number) * (1 - frac) + (sorted[hi] as number) * frac;
}

function validSeries(s: number[]): boolean {
  return s.length >= MIN_POINTS && s.every((x) => Number.isFinite(x) && x > 0);
}

/** Retorna null (sem dado) quando o histórico é curto/inválido ou as entradas não são números válidos. */
export function runScenarios(i: ScenarioInput): ScenarioResult | null {
  const nums = [i.days, i.paths, i.ph, i.hashpriceBtcPerPhDay, i.btcBrl, i.poolFee, i.costBrlDay];
  if (nums.some((x) => !Number.isFinite(x) || x < 0)) return null;
  if (i.days < 1 || i.paths < 1 || i.poolFee > 1) return null;
  if (!validSeries(i.priceHistory) || !validSeries(i.networkHashrateHistory)) return null;

  const price = meanStd(logReturns(i.priceHistory));
  const hash = meanStd(logReturns(i.networkHashrateHistory));
  const rand = mulberry32(i.seed);
  const finals: number[] = [];
  let losses = 0;
  let stops = 0;

  for (let p = 0; p < i.paths; p++) {
    let px = i.btcBrl;
    let hashRatio = 1; // H_t / H_0
    let cum = 0;
    let minCum = 0;
    for (let d = 0; d < i.days; d++) {
      px *= Math.exp(price.std * gaussian(rand) - (price.std ** 2) / 2);
      hashRatio *= Math.exp(hash.mean + hash.std * gaussian(rand));
      const revenue = (i.ph * (i.hashpriceBtcPerPhDay / hashRatio) * (1 - i.poolFee)) * px;
      cum += revenue - i.costBrlDay;
      if (cum < minCum) minCum = cum;
    }
    finals.push(cum);
    if (cum < 0) losses++;
    if (i.stopLossBrl !== undefined && minCum <= -i.stopLossBrl) stops++;
  }

  finals.sort((a, b) => a - b);
  return {
    days: i.days,
    p5: percentile(finals, 0.05),
    median: percentile(finals, 0.5),
    p95: percentile(finals, 0.95),
    probLoss: losses / i.paths,
    probStopLoss: i.stopLossBrl === undefined ? null : stops / i.paths,
    priceVolDaily: price.std,
    hashrateGrowthDaily: hash.mean,
    hashrateVolDaily: hash.std,
  };
}
