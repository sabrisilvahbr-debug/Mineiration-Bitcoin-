import type { Costs } from "../intelligence/backtest.ts";

export interface Position {
  qty: number;
  avgPrice: number;
}
export interface Fill {
  at: string;
  side: "comprar" | "vender";
  product: string;
  qty: number;
  price: number;
  fee: number;
  realizedPnl: number;
}
export interface PaperAccount {
  cash: number;
  positions: Record<string, Position>;
  fills: Fill[];
  realizedPnl: number;
  startEquity: number;
}

export function createAccount(startEquity: number): PaperAccount {
  return { cash: startEquity, positions: {}, fills: [], realizedPnl: 0, startEquity };
}

/** Executa uma ordem SIMULADA com taxa e slippage. Long-only (sem venda a descoberto). */
export function applyOrder(acc: PaperAccount, side: "comprar" | "vender", product: string, qty: number, price: number, costs: Costs, at: string): { ok: boolean; reason?: string } {
  if (!(qty > 0) || !(price > 0)) return { ok: false, reason: "quantidade ou preço inválido" };
  const slip = side === "comprar" ? 1 + costs.slippagePct : 1 - costs.slippagePct;
  const execPrice = price * slip;
  const gross = qty * execPrice;
  const fee = gross * costs.feePct;
  const pos = acc.positions[product] ?? { qty: 0, avgPrice: 0 };

  if (side === "comprar") {
    const totalCost = gross + fee;
    if (totalCost > acc.cash + 1e-9) return { ok: false, reason: "caixa insuficiente" };
    const newQty = pos.qty + qty;
    const newAvg = (pos.qty * pos.avgPrice + qty * execPrice) / newQty;
    acc.positions[product] = { qty: newQty, avgPrice: newAvg };
    acc.cash -= totalCost;
    acc.fills.push({ at, side, product, qty, price: execPrice, fee, realizedPnl: 0 });
    return { ok: true };
  }

  // vender
  if (qty > pos.qty + 1e-12) return { ok: false, reason: "não há posição suficiente (sem venda a descoberto)" };
  const proceeds = gross - fee;
  const realized = (execPrice - pos.avgPrice) * qty - fee;
  const remaining = pos.qty - qty;
  if (remaining <= 1e-12) delete acc.positions[product];
  else acc.positions[product] = { qty: remaining, avgPrice: pos.avgPrice };
  acc.cash += proceeds;
  acc.realizedPnl += realized;
  acc.fills.push({ at, side, product, qty, price: execPrice, fee, realizedPnl: realized });
  return { ok: true };
}

export interface Equity {
  cash: number;
  positionsValue: number;
  equity: number;
  unrealizedPnl: number;
  exposure: number;
}

/** Marca a mercado com os preços atuais. */
export function markToMarket(acc: PaperAccount, prices: Record<string, number>): Equity {
  let positionsValue = 0;
  let unrealized = 0;
  for (const [product, pos] of Object.entries(acc.positions)) {
    const px = prices[product];
    if (px === undefined) continue;
    positionsValue += pos.qty * px;
    unrealized += (px - pos.avgPrice) * pos.qty;
  }
  const equity = acc.cash + positionsValue;
  return { cash: acc.cash, positionsValue, equity, unrealizedPnl: unrealized, exposure: equity > 0 ? positionsValue / equity : 0 };
}
