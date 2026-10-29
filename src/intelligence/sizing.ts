/** Dimensionamento de posição em código. Nunca "tudo na mão". */

export interface SizingInput {
  capital: number;
  /** Fração do capital arriscada por operação (ex.: 0,01 = 1%). */
  riskPerTrade: number;
  /** Distância relativa até o stop (ex.: 0,05 = 5% abaixo da entrada). */
  stopDistance: number;
  price: number;
  /** Exposição máxima em fração do capital (ex.: 0,6 = 60%). */
  maxExposure: number;
}

export interface SizingOutput {
  /** Quantidade do ativo a comprar. */
  qty: number;
  /** Valor financeiro da posição. */
  notional: number;
  /** Quanto se perde se o stop for atingido. */
  riskAmount: number;
  cappedByExposure: boolean;
}

function ok(v: number): boolean {
  return Number.isFinite(v) && v > 0;
}

/** Tamanho tal que, se o preço cair stopDistance, a perda ≈ riskPerTrade × capital, limitado pela exposição máxima. */
export function sizePosition(i: SizingInput): SizingOutput {
  if (!ok(i.capital) || !ok(i.price) || !ok(i.stopDistance) || i.riskPerTrade <= 0 || i.maxExposure <= 0) {
    return { qty: 0, notional: 0, riskAmount: 0, cappedByExposure: false };
  }
  const riskBudget = i.capital * i.riskPerTrade;
  let notional = riskBudget / i.stopDistance; // perda = notional × stopDistance = riskBudget
  const maxNotional = i.capital * i.maxExposure;
  let cappedByExposure = false;
  if (notional > maxNotional) {
    notional = maxNotional;
    cappedByExposure = true;
  }
  const qty = notional / i.price;
  return { qty, notional, riskAmount: notional * i.stopDistance, cappedByExposure };
}
