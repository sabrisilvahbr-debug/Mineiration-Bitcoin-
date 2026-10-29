export function zscore(series: number[], value: number): number | null {
  if (series.length < 2) return null;
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const std = Math.sqrt(series.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
  if (std === 0) return null;
  return (value - mean) / std;
}

export function ewma(series: number[], alpha: number): number {
  if (series.length === 0) throw new RangeError("série vazia");
  if (!(alpha > 0 && alpha <= 1)) throw new RangeError("alpha deve estar em (0, 1]");
  let acc = series[0] as number;
  for (let i = 1; i < series.length; i++) acc = alpha * (series[i] as number) + (1 - alpha) * acc;
  return acc;
}

/** Hashrate entregue abaixo do contratado além da tolerância (fração, ex.: 0,1 = 10%). */
export function detectUnderDelivery(
  contracted: number,
  delivered: number,
  tolerance: number,
): { underDelivered: boolean; ratio: number } {
  if (contracted <= 0) return { underDelivered: false, ratio: 1 };
  const ratio = delivered / contracted;
  return { underDelivered: ratio < 1 - tolerance, ratio };
}

/** Divergência relativa entre duas fontes: |a − b| / média. */
export function priceDivergence(a: number, b: number): number {
  if (!(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) throw new RangeError("preço inválido");
  return Math.abs(a - b) / ((a + b) / 2);
}
