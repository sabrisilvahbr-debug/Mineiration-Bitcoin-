// Backtest com dados reais da Coinbase. Uso: node scripts/run-backtest.ts BTC-USD
import { fetchCandles } from "../src/sources/coinbase.ts";
import { backtest, outOfSample, DEFAULT_COSTS } from "../src/intelligence/backtest.ts";
import { DEFAULT_PARAMS } from "../src/intelligence/strategy.ts";
import type { FetchLike } from "../src/sources/http.ts";

const product = process.argv[2] ?? "BTC-USD";
const r = await fetchCandles(fetch as unknown as FetchLike, product, 86400);
if (!r.ok) { console.error("Sem dados:", r.error); process.exit(1); }
const closes = r.value.map((c) => c.close);
const bt = backtest(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 10000);
const oos = outOfSample(closes, DEFAULT_PARAMS, DEFAULT_COSTS, 0.7);
console.log(JSON.stringify({ product, barras: closes.length, backtest: { retornoPct: bt.returnPct, buyHoldPct: bt.buyHoldReturnPct, drawdownPct: bt.maxDrawdownPct, trades: bt.trades, acertoPct: bt.winRatePct, sharpe: bt.sharpe, bateuBuyHold: bt.beatsBuyHold }, foraDaAmostra: { aprovada: oos.approved, testeRetornoPct: oos.test.returnPct } }, null, 2));
console.log("\nAviso: resultado passado não garante futuro. Isto não é recomendação de investimento.");
